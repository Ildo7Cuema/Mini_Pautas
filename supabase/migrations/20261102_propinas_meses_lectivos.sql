-- ============================================
-- Migration: Meses lectivos configuráveis nas propinas
-- Purpose: School admin defines which months are billable
-- instead of always counting calendar months 1..N
-- Date: 2026-11-02
-- ============================================

-- 1) Column: configured lective/billing months (1-12)
ALTER TABLE propinas_config
ADD COLUMN IF NOT EXISTS meses_lectivos INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,7,8,9,10,11,12];

COMMENT ON COLUMN propinas_config.meses_lectivos IS
  'Meses lectivos de cobrança (1=Jan .. 12=Dez) definidos pelo administrador da escola';

-- Ensure non-empty and valid month numbers
ALTER TABLE propinas_config
DROP CONSTRAINT IF EXISTS propinas_config_meses_lectivos_valid;

ALTER TABLE propinas_config
ADD CONSTRAINT propinas_config_meses_lectivos_valid
CHECK (
    cardinality(meses_lectivos) >= 1
    AND meses_lectivos <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]
);

-- 2) Stats RPC: count only configured lective months that are due
DROP FUNCTION IF EXISTS get_estatisticas_propinas(uuid, integer);

CREATE OR REPLACE FUNCTION get_estatisticas_propinas(
    p_escola_id UUID,
    p_ano INTEGER DEFAULT NULL
)
RETURNS TABLE (
    total_alunos INTEGER,
    total_previsto NUMERIC,
    total_recebido NUMERIC,
    total_em_falta NUMERIC,
    percentagem_recebido NUMERIC
) AS $$
DECLARE
    v_ano INTEGER;
    v_ano_atual INTEGER;
    v_mes_atual INTEGER;
    v_meses_decorridos INTEGER;
    v_meses_lectivos INTEGER[];
    v_valor_mensal NUMERIC;
BEGIN
    v_ano := COALESCE(p_ano, EXTRACT(YEAR FROM NOW())::INTEGER);
    v_ano_atual := EXTRACT(YEAR FROM NOW())::INTEGER;
    v_mes_atual := EXTRACT(MONTH FROM NOW())::INTEGER;

    -- Load school tuition config (valor + meses lectivos)
    SELECT
        COALESCE(pc.valor_mensalidade, 0),
        COALESCE(pc.meses_lectivos, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12])
    INTO v_valor_mensal, v_meses_lectivos
    FROM propinas_config pc
    WHERE pc.escola_id = p_escola_id
      AND pc.ano_lectivo::TEXT = v_ano::TEXT
      AND pc.ativo = true
    ORDER BY pc.turma_id NULLS LAST, pc.created_at DESC
    LIMIT 1;

    v_valor_mensal := COALESCE(v_valor_mensal, 0);
    v_meses_lectivos := COALESCE(v_meses_lectivos, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]);

    -- Billable months elapsed among configured lective months
    IF v_ano < v_ano_atual THEN
        v_meses_decorridos := cardinality(v_meses_lectivos);
    ELSIF v_ano > v_ano_atual THEN
        v_meses_decorridos := 0;
    ELSE
        SELECT COUNT(*)::INTEGER INTO v_meses_decorridos
        FROM unnest(v_meses_lectivos) AS m(mes)
        WHERE m.mes <= v_mes_atual;
    END IF;

    RETURN QUERY
    WITH alunos_ativos AS (
        SELECT a.id, a.turma_id
        FROM alunos a
        JOIN turmas t ON a.turma_id = t.id
        WHERE t.escola_id = p_escola_id
          AND a.ativo = true
          AND t.ano_lectivo::TEXT ILIKE '%' || v_ano::TEXT || '%'
    ),
    totais AS (
        SELECT
            (SELECT COUNT(*)::INTEGER FROM alunos_ativos) AS total_alunos,
            v_valor_mensal AS valor_mensal,
            COALESCE((
                SELECT SUM(pp.valor)
                FROM pagamentos_propinas pp
                WHERE pp.escola_id = p_escola_id
                  AND pp.ano_referencia::INTEGER = v_ano
                  AND pp.estado = 'valido'
                  AND pp.mes_referencia = ANY (v_meses_lectivos)
            ), 0) AS total_pago
    )
    SELECT
        t.total_alunos,
        (t.total_alunos * t.valor_mensal * v_meses_decorridos)::NUMERIC AS total_previsto,
        t.total_pago AS total_recebido,
        ((t.total_alunos * t.valor_mensal * v_meses_decorridos) - t.total_pago)::NUMERIC AS total_em_falta,
        CASE
            WHEN (t.total_alunos * t.valor_mensal * v_meses_decorridos) > 0 THEN
                ROUND((t.total_pago / (t.total_alunos * t.valor_mensal * v_meses_decorridos)) * 100, 2)
            ELSE 0
        END AS percentagem_recebido
    FROM totais t;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_estatisticas_propinas IS
  'Estatísticas de propinas usando meses lectivos configurados pela escola';

-- 3) Student month status: only configured lective months
DROP FUNCTION IF EXISTS get_pagamentos_aluno_por_mes(uuid, integer);

CREATE OR REPLACE FUNCTION get_pagamentos_aluno_por_mes(
    p_aluno_id UUID,
    p_ano INTEGER DEFAULT NULL
)
RETURNS TABLE (
    mes INTEGER,
    status TEXT,
    valor_pago NUMERIC,
    valor_total NUMERIC,
    detalhes_pagamentos JSONB
) AS $$
DECLARE
    v_ano INTEGER;
    v_valor_mensal NUMERIC;
    v_meses_lectivos INTEGER[];
    v_escola_id UUID;
    v_turma_id UUID;
BEGIN
    v_ano := COALESCE(p_ano, EXTRACT(YEAR FROM NOW())::INTEGER);

    SELECT t.escola_id, a.turma_id INTO v_escola_id, v_turma_id
    FROM alunos a
    JOIN turmas t ON a.turma_id = t.id
    WHERE a.id = p_aluno_id;

    SELECT
        COALESCE(pc.valor_mensalidade, 0),
        COALESCE(pc.meses_lectivos, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12])
    INTO v_valor_mensal, v_meses_lectivos
    FROM propinas_config pc
    WHERE pc.escola_id = v_escola_id
      AND (pc.turma_id IS NULL OR pc.turma_id = v_turma_id)
      AND pc.ano_lectivo::TEXT = v_ano::TEXT
      AND pc.ativo = true
    ORDER BY pc.turma_id NULLS LAST, pc.created_at DESC
    LIMIT 1;

    v_valor_mensal := COALESCE(v_valor_mensal, 0);
    v_meses_lectivos := COALESCE(v_meses_lectivos, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]);

    RETURN QUERY
    WITH pagamentos_mes AS (
        SELECT
            mes_referencia,
            SUM(valor) AS total_pago,
            jsonb_agg(jsonb_build_object(
                'id', id,
                'data', data_pagamento,
                'valor', valor,
                'recibo', numero_recibo,
                'estado', estado,
                'hash_control', hash_control
            )) AS detalhes
        FROM pagamentos_propinas
        WHERE aluno_id = p_aluno_id
          AND ano_referencia::INTEGER = v_ano
          AND estado = 'valido'
        GROUP BY mes_referencia
    )
    SELECT
        m.mes,
        CASE
            WHEN COALESCE(pm.total_pago, 0) >= v_valor_mensal AND v_valor_mensal > 0 THEN 'pago'
            WHEN COALESCE(pm.total_pago, 0) > 0 THEN 'parcial'
            ELSE 'pendente'
        END AS status,
        COALESCE(pm.total_pago, 0) AS valor_pago,
        v_valor_mensal AS valor_total,
        COALESCE(pm.detalhes, '[]'::jsonb) AS detalhes_pagamentos
    FROM unnest(v_meses_lectivos) AS m(mes)
    LEFT JOIN pagamentos_mes pm ON pm.mes_referencia = m.mes
    ORDER BY m.mes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_pagamentos_aluno_por_mes IS
  'Status mensal de propinas apenas para meses lectivos configurados';

GRANT EXECUTE ON FUNCTION get_estatisticas_propinas(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pagamentos_aluno_por_mes(UUID, INTEGER) TO authenticated;
