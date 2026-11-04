-- Fix AGT receipt trigger: on DELETE of annulled receipts, RETURN OLD (not NEW).
-- Returning NEW on DELETE is NULL and silently skips the row delete, which also
-- blocks escola CASCADE cleanup after seed/test receipts are annulled.

CREATE OR REPLACE FUNCTION prevent_modification_of_valid_receipts() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        IF OLD.estado = 'valido' THEN
             RAISE EXCEPTION 'AGT Security: Não é permitido apagar recibos válidos. Use a função de anulação.';
        END IF;
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF OLD.estado = 'anulado' THEN
             RAISE EXCEPTION 'AGT Security: Não é permitido alterar um recibo já anulado.';
        END IF;

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
