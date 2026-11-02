-- ============================================
-- Preços de assinatura por instituição
-- SuperAdmin define Trimestral / Semestral / Anual
-- por Escola, Direção Municipal ou Direção Provincial.
-- Se não houver override, usa o preço global (precos_licenca).
-- ============================================

CREATE TABLE IF NOT EXISTS precos_licenca_instituicao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_instituicao TEXT NOT NULL
        CHECK (tipo_instituicao IN ('ESCOLA', 'DIRECAO_MUNICIPAL', 'DIRECAO_PROVINCIAL')),
    instituicao_id UUID NOT NULL,
    plano TEXT NOT NULL
        CHECK (plano IN ('trimestral', 'semestral', 'anual')),
    valor NUMERIC(10, 2) NOT NULL CHECK (valor > 0),
    desconto_percentual NUMERIC(5, 2) NOT NULL DEFAULT 0
        CHECK (desconto_percentual >= 0 AND desconto_percentual <= 100),
    descricao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_preco_instituicao_plano UNIQUE (tipo_instituicao, instituicao_id, plano)
);

CREATE INDEX IF NOT EXISTS idx_precos_instituicao_lookup
    ON precos_licenca_instituicao (tipo_instituicao, instituicao_id);

CREATE INDEX IF NOT EXISTS idx_precos_instituicao_plano
    ON precos_licenca_instituicao (plano);

DROP TRIGGER IF EXISTS update_precos_instituicao_updated_at ON precos_licenca_instituicao;
CREATE TRIGGER update_precos_instituicao_updated_at
    BEFORE UPDATE ON precos_licenca_instituicao
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE precos_licenca_instituicao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "precos_instituicao_select_authenticated" ON precos_licenca_instituicao;
CREATE POLICY "precos_instituicao_select_authenticated"
    ON precos_licenca_instituicao FOR SELECT
    TO authenticated
    USING (ativo = true OR is_superadmin());

DROP POLICY IF EXISTS "precos_instituicao_superadmin_all" ON precos_licenca_instituicao;
CREATE POLICY "precos_instituicao_superadmin_all"
    ON precos_licenca_instituicao FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Garante os 3 planos base (globais)
INSERT INTO precos_licenca (plano, valor, desconto_percentual, descricao, ativo) VALUES
    ('trimestral', 15000.00, 0, 'Plano trimestral - 3 meses de acesso', true),
    ('semestral', 27000.00, 10, 'Plano semestral - 6 meses de acesso (10% desconto)', true),
    ('anual', 48000.00, 20, 'Plano anual - 12 meses de acesso (20% desconto)', true)
ON CONFLICT (plano) DO UPDATE SET
    ativo = true,
    updated_at = NOW();

-- Resolve valor efectivo (instituição > global)
CREATE OR REPLACE FUNCTION resolver_preco_licenca(
    p_tipo_instituicao TEXT,
    p_instituicao_id UUID,
    p_plano TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_valor NUMERIC;
BEGIN
    SELECT pi.valor INTO v_valor
    FROM precos_licenca_instituicao pi
    WHERE pi.tipo_instituicao = p_tipo_instituicao
      AND pi.instituicao_id = p_instituicao_id
      AND pi.plano = p_plano
      AND pi.ativo = true
    LIMIT 1;

    IF v_valor IS NOT NULL THEN
        RETURN v_valor;
    END IF;

    SELECT pl.valor INTO v_valor
    FROM precos_licenca pl
    WHERE pl.plano = p_plano
      AND pl.ativo = true
    LIMIT 1;

    RETURN v_valor;
END;
$$;

GRANT EXECUTE ON FUNCTION resolver_preco_licenca(TEXT, UUID, TEXT) TO authenticated;

COMMENT ON TABLE precos_licenca_instituicao IS
    'Preços de planos (trimestral/semestral/anual) personalizados por instituição';
COMMENT ON FUNCTION resolver_preco_licenca IS
    'Devolve o preço da instituição ou, se inexistente, o preço global do plano';
