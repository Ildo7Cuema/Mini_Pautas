-- ============================================================
-- SUPERADMIN: estatísticas de utilização do sistema
-- Observabilidade pedagógica + acessos por escola
-- ============================================================

CREATE OR REPLACE FUNCTION get_system_usage_stats(
    p_dias_actividade INTEGER DEFAULT 14,
    p_limite_escolas INTEGER DEFAULT 200
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_dias INTEGER := GREATEST(COALESCE(p_dias_actividade, 14), 1);
    v_limite INTEGER := LEAST(GREATEST(COALESCE(p_limite_escolas, 200), 1), 500);
    v_now TIMESTAMPTZ := NOW();
    v_hoje DATE := CURRENT_DATE;
    v_7d TIMESTAMPTZ := NOW() - INTERVAL '7 days';
    v_30d TIMESTAMPTZ := NOW() - INTERVAL '30 days';
    v_inicio_serie DATE := CURRENT_DATE - GREATEST(COALESCE(p_dias_actividade, 14), 1) + 1;
    v_resumo JSONB;
    v_actividade JSONB;
    v_escolas JSONB;
BEGIN
    BEGIN
        PERFORM assert_is_superadmin();
    EXCEPTION
        WHEN undefined_function THEN
            IF NOT COALESCE(is_superadmin(), false) THEN
                RAISE EXCEPTION 'Acesso negado: apenas SUPERADMIN';
            END IF;
        WHEN OTHERS THEN
            IF NOT COALESCE(is_superadmin(), false) THEN
                RAISE EXCEPTION 'Acesso negado: apenas SUPERADMIN';
            END IF;
    END;

    WITH
    prof AS (
        SELECT
            COUNT(*)::BIGINT AS total,
            COUNT(*) FILTER (WHERE created_at >= v_7d)::BIGINT AS d7,
            COUNT(*) FILTER (WHERE created_at >= v_30d)::BIGINT AS d30
        FROM professores
        WHERE COALESCE(ativo, true) = true
    ),
    alunos AS (
        SELECT
            COUNT(*)::BIGINT AS total,
            COUNT(*) FILTER (WHERE a.created_at >= v_7d)::BIGINT AS d7,
            COUNT(*) FILTER (WHERE a.created_at >= v_30d)::BIGINT AS d30
        FROM alunos a
        WHERE COALESCE(a.ativo, true) = true
    ),
    turmas AS (
        SELECT COUNT(*)::BIGINT AS total FROM turmas
    ),
    notas AS (
        SELECT
            COUNT(*)::BIGINT AS total,
            COUNT(*) FILTER (WHERE COALESCE(data_lancamento, created_at) >= v_7d)::BIGINT AS d7,
            COUNT(*) FILTER (WHERE COALESCE(data_lancamento, created_at) >= v_30d)::BIGINT AS d30
        FROM notas
    ),
    visitas AS (
        SELECT
            COUNT(*) FILTER (WHERE created_at >= date_trunc('day', v_now))::BIGINT AS hoje,
            COUNT(*) FILTER (WHERE created_at >= v_7d)::BIGINT AS d7,
            COUNT(DISTINCT user_id) FILTER (WHERE created_at >= v_7d AND user_id IS NOT NULL)::BIGINT AS users_7d
        FROM system_visits
    ),
    escola_flags AS (
        SELECT
            e.id,
            EXISTS (
                SELECT 1 FROM professores p
                WHERE p.escola_id = e.id AND COALESCE(p.ativo, true) = true
            ) AS tem_professores,
            EXISTS (
                SELECT 1
                FROM alunos a
                JOIN turmas t ON t.id = a.turma_id
                WHERE t.escola_id = e.id AND COALESCE(a.ativo, true) = true
            ) AS tem_alunos,
            EXISTS (
                SELECT 1
                FROM notas n
                JOIN turmas t ON t.id = n.turma_id
                WHERE t.escola_id = e.id
            ) AS tem_notas,
            EXISTS (
                SELECT 1 FROM system_visits sv
                WHERE sv.escola_id = e.id AND sv.created_at >= v_7d
            ) AS acesso_7d,
            EXISTS (
                SELECT 1
                FROM notas n
                JOIN turmas t ON t.id = n.turma_id
                WHERE t.escola_id = e.id
                  AND COALESCE(n.data_lancamento, n.created_at) >= v_7d
            ) AS notas_7d
        FROM escolas e
    ),
    flags_agg AS (
        SELECT
            COUNT(*)::BIGINT AS total_escolas,
            COUNT(*) FILTER (WHERE tem_professores)::BIGINT AS escolas_com_professores,
            COUNT(*) FILTER (WHERE tem_alunos)::BIGINT AS escolas_com_alunos,
            COUNT(*) FILTER (WHERE tem_notas)::BIGINT AS escolas_com_notas,
            COUNT(*) FILTER (WHERE acesso_7d OR notas_7d)::BIGINT AS escolas_activas_7d,
            COUNT(*) FILTER (
                WHERE NOT tem_professores AND NOT tem_alunos AND NOT tem_notas AND NOT acesso_7d
            )::BIGINT AS escolas_sem_uso
        FROM escola_flags
    )
    SELECT jsonb_build_object(
        'total_escolas', fa.total_escolas,
        'escolas_com_professores', fa.escolas_com_professores,
        'escolas_com_alunos', fa.escolas_com_alunos,
        'escolas_com_notas', fa.escolas_com_notas,
        'escolas_activas_7d', fa.escolas_activas_7d,
        'escolas_sem_uso', fa.escolas_sem_uso,
        'total_professores', p.total,
        'total_alunos', a.total,
        'total_turmas', t.total,
        'total_notas', n.total,
        'professores_7d', p.d7,
        'professores_30d', p.d30,
        'alunos_7d', a.d7,
        'alunos_30d', a.d30,
        'notas_7d', n.d7,
        'notas_30d', n.d30,
        'acessos_hoje', v.hoje,
        'acessos_7d', v.d7,
        'utilizadores_unicos_7d', v.users_7d,
        'gerado_em', v_now
    )
    INTO v_resumo
    FROM flags_agg fa, prof p, alunos a, turmas t, notas n, visitas v;

    WITH dias AS (
        SELECT generate_series(v_inicio_serie, v_hoje, INTERVAL '1 day')::DATE AS dia
    ),
    prof_dia AS (
        SELECT created_at::DATE AS dia, COUNT(*)::BIGINT AS total
        FROM professores
        WHERE created_at >= v_inicio_serie
        GROUP BY 1
    ),
    aluno_dia AS (
        SELECT created_at::DATE AS dia, COUNT(*)::BIGINT AS total
        FROM alunos
        WHERE created_at >= v_inicio_serie
        GROUP BY 1
    ),
    nota_dia AS (
        SELECT COALESCE(data_lancamento, created_at)::DATE AS dia, COUNT(*)::BIGINT AS total
        FROM notas
        WHERE COALESCE(data_lancamento, created_at) >= v_inicio_serie
        GROUP BY 1
    ),
    acesso_dia AS (
        SELECT created_at::DATE AS dia, COUNT(*)::BIGINT AS total
        FROM system_visits
        WHERE created_at >= v_inicio_serie
        GROUP BY 1
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'dia', d.dia,
                'professores', COALESCE(pd.total, 0),
                'alunos', COALESCE(ad.total, 0),
                'notas', COALESCE(nd.total, 0),
                'acessos', COALESCE(vd.total, 0)
            )
            ORDER BY d.dia
        ),
        '[]'::jsonb
    )
    INTO v_actividade
    FROM dias d
    LEFT JOIN prof_dia pd ON pd.dia = d.dia
    LEFT JOIN aluno_dia ad ON ad.dia = d.dia
    LEFT JOIN nota_dia nd ON nd.dia = d.dia
    LEFT JOIN acesso_dia vd ON vd.dia = d.dia;

    WITH
    prof_esc AS (
        SELECT
            escola_id,
            COUNT(*) FILTER (WHERE COALESCE(ativo, true))::BIGINT AS total,
            COUNT(*) FILTER (WHERE created_at >= v_7d)::BIGINT AS d7,
            MAX(created_at) AS ultimo
        FROM professores
        GROUP BY escola_id
    ),
    turma_esc AS (
        SELECT escola_id, COUNT(*)::BIGINT AS total
        FROM turmas
        GROUP BY escola_id
    ),
    aluno_esc AS (
        SELECT
            t.escola_id,
            COUNT(*) FILTER (WHERE COALESCE(a.ativo, true))::BIGINT AS total,
            COUNT(*) FILTER (WHERE a.created_at >= v_7d)::BIGINT AS d7,
            MAX(a.created_at) AS ultimo
        FROM alunos a
        JOIN turmas t ON t.id = a.turma_id
        GROUP BY t.escola_id
    ),
    nota_esc AS (
        SELECT
            t.escola_id,
            COUNT(*)::BIGINT AS total,
            COUNT(*) FILTER (WHERE COALESCE(n.data_lancamento, n.created_at) >= v_7d)::BIGINT AS d7,
            MAX(COALESCE(n.data_lancamento, n.created_at)) AS ultimo
        FROM notas n
        JOIN turmas t ON t.id = n.turma_id
        GROUP BY t.escola_id
    ),
    visita_esc AS (
        SELECT
            escola_id,
            COUNT(*) FILTER (WHERE created_at >= v_7d)::BIGINT AS d7,
            COUNT(*) FILTER (WHERE created_at >= v_30d)::BIGINT AS d30,
            MAX(created_at) AS ultimo
        FROM system_visits
        WHERE escola_id IS NOT NULL
        GROUP BY escola_id
    ),
    ranked AS (
        SELECT
            e.id AS escola_id,
            e.nome,
            e.codigo_escola,
            e.provincia,
            e.municipio,
            COALESCE(e.ativo, true) AS ativo,
            COALESCE(e.bloqueado, false) AS bloqueado,
            COALESCE(pe.total, 0) AS professores,
            COALESCE(ae.total, 0) AS alunos,
            COALESCE(te.total, 0) AS turmas,
            COALESCE(ne.total, 0) AS notas,
            COALESCE(pe.d7, 0) AS professores_7d,
            COALESCE(ae.d7, 0) AS alunos_7d,
            COALESCE(ne.d7, 0) AS notas_7d,
            COALESCE(ve.d7, 0) AS acessos_7d,
            COALESCE(ve.d30, 0) AS acessos_30d,
            ve.ultimo AS ultimo_acesso,
            GREATEST(pe.ultimo, ae.ultimo, ne.ultimo, ve.ultimo) AS ultima_actividade,
            CASE
                WHEN COALESCE(ve.d7, 0) > 0 OR COALESCE(ne.d7, 0) > 0 THEN 'activo'
                WHEN COALESCE(pe.total, 0) > 0 AND COALESCE(ae.total, 0) > 0 THEN 'parcial'
                ELSE 'inactivo'
            END AS estado_uso
        FROM escolas e
        LEFT JOIN prof_esc pe ON pe.escola_id = e.id
        LEFT JOIN aluno_esc ae ON ae.escola_id = e.id
        LEFT JOIN turma_esc te ON te.escola_id = e.id
        LEFT JOIN nota_esc ne ON ne.escola_id = e.id
        LEFT JOIN visita_esc ve ON ve.escola_id = e.id
    )
    SELECT COALESCE(
        jsonb_agg(to_jsonb(r) ORDER BY
            CASE r.estado_uso
                WHEN 'activo' THEN 0
                WHEN 'parcial' THEN 1
                ELSE 2
            END,
            COALESCE(r.ultima_actividade, '1970-01-01'::TIMESTAMPTZ) DESC,
            r.nome
        ),
        '[]'::jsonb
    )
    INTO v_escolas
    FROM (
        SELECT * FROM ranked
        ORDER BY
            CASE estado_uso
                WHEN 'activo' THEN 0
                WHEN 'parcial' THEN 1
                ELSE 2
            END,
            COALESCE(ultima_actividade, '1970-01-01'::TIMESTAMPTZ) DESC,
            nome
        LIMIT v_limite
    ) r;

    RETURN jsonb_build_object(
        'resumo', COALESCE(v_resumo, '{}'::jsonb),
        'actividade_diaria', COALESCE(v_actividade, '[]'::jsonb),
        'escolas', COALESCE(v_escolas, '[]'::jsonb),
        'parametros', jsonb_build_object(
            'dias_actividade', v_dias,
            'limite_escolas', v_limite
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_system_usage_stats(INTEGER, INTEGER) TO authenticated;

COMMENT ON FUNCTION get_system_usage_stats(INTEGER, INTEGER) IS
    'Agrega utilização do sistema (professores, alunos, notas, acessos) para SUPERADMIN.';
