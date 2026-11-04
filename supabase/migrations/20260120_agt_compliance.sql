-- Enable pgcrypto for hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    changed_by UUID, -- Can be null if system action
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    client_info JSONB -- Headers, IP, etc if available
);

-- Secure Audit Log (RSL)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- Internal use mostly, but allow reading if strictly necessary
CREATE POLICY "Admins can view audit logs" ON audit_logs FOR SELECT TO authenticated USING (
    auth.uid() IN (SELECT id FROM auth.users) -- Should be tighter in prod
);

-- 2. Generic Audit Trigger Function
CREATE OR REPLACE FUNCTION log_audit_event() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (
        TG_TABLE_NAME::TEXT,
        COALESCE(NEW.id::TEXT, OLD.id::TEXT),
        TG_OP,
        row_to_json(OLD)::JSONB,
        row_to_json(NEW)::JSONB,
        auth.uid()
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply Audit to pagamentos_propinas
DROP TRIGGER IF EXISTS tr_audit_pagamentos_propinas ON pagamentos_propinas;
CREATE TRIGGER tr_audit_pagamentos_propinas
AFTER INSERT OR UPDATE OR DELETE ON pagamentos_propinas
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- 3. Chained Hash Generation Function (AGT Requirement)
CREATE OR REPLACE FUNCTION generate_hash_chained() RETURNS TRIGGER AS $$
DECLARE
    previous_hash TEXT;
    canonical_string TEXT;
    new_hash TEXT;
BEGIN
    -- 1. Find Previous Hash
    -- Order by created_at DESC to find the immediate predecessor.
    -- In a high-concurrency real env, we'd need strict serial locking, but for this scope:
    SELECT hash INTO previous_hash 
    FROM pagamentos_propinas 
    WHERE id != NEW.id 
    ORDER BY created_at DESC, id DESC 
    LIMIT 1;
    
    IF previous_hash IS NULL THEN
        previous_hash := '0000000000000000000000000000000000000000'; -- 40 chars of zeros
    END IF;

    -- 2. Build Canonical String
    -- Format: DataPagamento;DataVencimento;ReciboNr;ValorBruto;HashAnterior
    -- Using YYYY-MM-DD for dates.
    canonical_string := to_char(NEW.data_pagamento::DATE, 'YYYY-MM-DD') || ';' || 
                        to_char(NEW.data_pagamento::DATE, 'YYYY-MM-DD') || ';' || 
                        NEW.numero_recibo || ';' || 
                        NEW.valor::TEXT || ';' || 
                        previous_hash;
                        
    -- 3. Generate SHA1
    new_hash := encode(digest(canonical_string, 'sha1'), 'hex');
    
    -- 4. Apply to Record
    NEW.hash := new_hash;
    NEW.hash_control := substring(new_hash from 1 for 4);
    NEW.sistema_certificado := 'EduGest-AGT-v1 (Simulated RSA)';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to Force Hash on Insert
DROP TRIGGER IF EXISTS tr_generate_hash ON pagamentos_propinas;
CREATE TRIGGER tr_generate_hash
BEFORE INSERT ON pagamentos_propinas
FOR EACH ROW EXECUTE FUNCTION generate_hash_chained();

-- 4. Immutability Enforcer
CREATE OR REPLACE FUNCTION prevent_modification_of_valid_receipts() RETURNS TRIGGER AS $$
BEGIN
    -- Prevent DELETE
    IF (TG_OP = 'DELETE') THEN
        IF OLD.estado = 'valido' THEN
             RAISE EXCEPTION 'AGT Security: Não é permitido apagar recibos válidos. Use a função de anulação.';
        END IF;
        -- Anulados podem ser removidos (ex.: limpeza de seed / CASCADE). RETURN OLD, não NEW.
        RETURN OLD;
    -- Prevent UPDATE of critical fields
    ELSIF (TG_OP = 'UPDATE') THEN
        -- If it was annulled, it's dead. No changes allowed.
        IF OLD.estado = 'anulado' THEN
             RAISE EXCEPTION 'AGT Security: Não é permitido alterar um recibo já anulado.';
        END IF;
        
        -- If Valid, allow ONLY state change to 'anulado' (and metadata)
        IF (NEW.valor != OLD.valor) OR 
           (NEW.aluno_id != OLD.aluno_id) OR 
           (NEW.numero_recibo != OLD.numero_recibo) OR
           (NEW.hash != OLD.hash) THEN
             RAISE EXCEPTION 'AGT Security: Violação de integridade. Valores financeiros/fiscais são imutáveis.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_protect_receipts ON pagamentos_propinas;
CREATE TRIGGER tr_protect_receipts
BEFORE UPDATE OR DELETE ON pagamentos_propinas
FOR EACH ROW EXECUTE FUNCTION prevent_modification_of_valid_receipts();
