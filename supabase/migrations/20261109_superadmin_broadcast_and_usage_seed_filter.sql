-- ============================================================
-- SUPERADMIN: broadcast de notificações + excluir seeds do uso
-- ============================================================

-- 1) Auditoria: novo tipo de acção
ALTER TABLE superadmin_actions
DROP CONSTRAINT IF EXISTS superadmin_actions_action_type_check;

ALTER TABLE superadmin_actions
ADD CONSTRAINT superadmin_actions_action_type_check
CHECK (action_type IN (
    'ACTIVATE_ESCOLA',
    'DEACTIVATE_ESCOLA',
    'BLOCK_ESCOLA',
    'UNBLOCK_ESCOLA',
    'EDIT_ESCOLA',
    'CREATE_ESCOLA',
    'DELETE_ESCOLA',
    'RESTORE_ESCOLA',
    'VIEW_ESCOLA_DATA',
    'ACTIVATE_DIRECAO_MUNICIPAL',
    'DEACTIVATE_DIRECAO_MUNICIPAL',
    'BLOCK_DIRECAO_MUNICIPAL',
    'UNBLOCK_DIRECAO_MUNICIPAL',
    'ACTIVATE_DIRECAO_PROVINCIAL',
    'DEACTIVATE_DIRECAO_PROVINCIAL',
    'BLOCK_DIRECAO_PROVINCIAL',
    'UNBLOCK_DIRECAO_PROVINCIAL',
    'CREATE_LICENSE',
    'SUSPEND_LICENSE',
    'REACTIVATE_LICENSE',
    'APPROVE_SUBSCRIPTION',
    'REJECT_SUBSCRIPTION',
    'UPDATE_PRICE',
    'UPDATE_INSTITUTION_PRICE',
    'EDIT_SYSTEM_CONFIG',
    'CREATE_USER',
    'EDIT_USER',
    'DELETE_USER',
    'EXPORT_DATA',
    'BROADCAST_NOTIFICATION',
    'OTHER'
));

-- 2) Helper: escola de teste (seed)
CREATE OR REPLACE FUNCTION is_seed_escola(p_escola escolas)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT
        COALESCE(p_escola.codigo_escola, '') LIKE 'SEED-%'
        OR COALESCE(p_escola.configuracoes->>'seed_marker', '') = 'edugest-test-seed'
        OR LOWER(COALESCE(p_escola.configuracoes->>'seed', 'false')) IN ('true', '1', 't', 'yes');
$$;

CREATE OR REPLACE FUNCTION is_seed_escola_id(p_escola_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM escolas e
        WHERE e.id = p_escola_id
          AND is_seed_escola(e)
    );
$$;

-- 3) Helper: perfil / email seed
CREATE OR REPLACE FUNCTION is_seed_email(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT COALESCE(LOWER(p_email), '') LIKE '%@seed.edugest.test';
$$;

-- 4) Uso do sistema: excluir escolas e dados seed
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
    escolas_reais AS (
        SELECT e.*
        FROM escolas e
        WHERE NOT is_seed_escola(e)
    ),
    seed_escola_ids AS (
        SELECT e.id
        FROM escolas e
        WHERE is_seed_escola(e)
    ),
    seed_user_ids AS (
        SELECT dm.user_id AS uid
        FROM direcoes_municipais dm
        WHERE dm.user_id IS NOT NULL
          AND (
              is_seed_email(dm.email)
              OR COALESCE(dm.numero_funcionario, '') LIKE 'SEED-%'
          )
        UNION
        SELECT dp.user_id
        FROM direcoes_provinciais dp
        WHERE dp.user_id IS NOT NULL
          AND (
              is_seed_email(dp.email)
              OR COALESCE(dp.numero_funcionario, '') LIKE 'SEED-%'
          )
        UNION
        SELECT up.user_id
        FROM user_profiles up
        WHERE up.escola_id IN (SELECT id FROM seed_escola_ids)
        UNION
        SELECT e.user_id
        FROM escolas e
        WHERE e.user_id IS NOT NULL
          AND e.id IN (SELECT id FROM seed_escola_ids)
    ),
    prof AS (
        SELECT
            COUNT(*)::BIGINT AS total,
            COUNT(*) FILTER (WHERE created_at >= v_7d)::BIGINT AS d7,
            COUNT(*) FILTER (WHERE created_at >= v_30d)::BIGINT AS d30
        FROM professores p
        WHERE COALESCE(p.ativo, true) = true
          AND p.escola_id NOT IN (SELECT id FROM seed_escola_ids)
    ),
    alunos_agg AS (
        SELECT
            COUNT(*)::BIGINT AS total,
            COUNT(*) FILTER (WHERE a.created_at >= v_7d)::BIGINT AS d7,
            COUNT(*) FILTER (WHERE a.created_at >= v_30d)::BIGINT AS d30
        FROM public.alunos a
        JOIN public.turmas t ON t.id = a.turma_id
        WHERE COALESCE(a.ativo, true) = true
          AND t.escola_id NOT IN (SELECT id FROM seed_escola_ids)
    ),
    turmas_agg AS (
        SELECT COUNT(*)::BIGINT AS total
        FROM public.turmas t
        WHERE t.escola_id NOT IN (SELECT id FROM seed_escola_ids)
    ),
    notas_agg AS (
        SELECT
            COUNT(*)::BIGINT AS total,
            COUNT(*) FILTER (WHERE COALESCE(n.data_lancamento, n.created_at) >= v_7d)::BIGINT AS d7,
            COUNT(*) FILTER (WHERE COALESCE(n.data_lancamento, n.created_at) >= v_30d)::BIGINT AS d30
        FROM public.notas n
        JOIN public.turmas t ON t.id = n.turma_id
        WHERE t.escola_id NOT IN (SELECT id FROM seed_escola_ids)
    ),
    visitas AS (
        SELECT
            COUNT(*) FILTER (WHERE sv.created_at >= date_trunc('day', v_now))::BIGINT AS hoje,
            COUNT(*) FILTER (WHERE sv.created_at >= v_7d)::BIGINT AS d7,
            COUNT(DISTINCT sv.user_id) FILTER (
                WHERE sv.created_at >= v_7d AND sv.user_id IS NOT NULL
            )::BIGINT AS users_7d
        FROM system_visits sv
        WHERE (sv.escola_id IS NULL OR sv.escola_id NOT IN (SELECT id FROM seed_escola_ids))
          AND (sv.user_id IS NULL OR sv.user_id NOT IN (SELECT uid FROM seed_user_ids WHERE uid IS NOT NULL))
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
                FROM public.alunos a
                JOIN public.turmas t ON t.id = a.turma_id
                WHERE t.escola_id = e.id AND COALESCE(a.ativo, true) = true
            ) AS tem_alunos,
            EXISTS (
                SELECT 1
                FROM public.notas n
                JOIN public.turmas t ON t.id = n.turma_id
                WHERE t.escola_id = e.id
            ) AS tem_notas,
            EXISTS (
                SELECT 1 FROM system_visits sv
                WHERE sv.escola_id = e.id AND sv.created_at >= v_7d
            ) AS acesso_7d,
            EXISTS (
                SELECT 1
                FROM public.notas n
                JOIN public.turmas t ON t.id = n.turma_id
                WHERE t.escola_id = e.id
                  AND COALESCE(n.data_lancamento, n.created_at) >= v_7d
            ) AS notas_7d
        FROM escolas_reais e
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
    FROM flags_agg fa, prof p, alunos_agg a, turmas_agg t, notas_agg n, visitas v;

    WITH
    seed_escola_ids AS (
        SELECT e.id FROM escolas e WHERE is_seed_escola(e)
    ),
    seed_user_ids AS (
        SELECT dm.user_id AS uid
        FROM direcoes_municipais dm
        WHERE dm.user_id IS NOT NULL
          AND (is_seed_email(dm.email) OR COALESCE(dm.numero_funcionario, '') LIKE 'SEED-%')
        UNION
        SELECT dp.user_id
        FROM direcoes_provinciais dp
        WHERE dp.user_id IS NOT NULL
          AND (is_seed_email(dp.email) OR COALESCE(dp.numero_funcionario, '') LIKE 'SEED-%')
        UNION
        SELECT up.user_id
        FROM user_profiles up
        WHERE up.escola_id IN (SELECT id FROM seed_escola_ids)
        UNION
        SELECT e.user_id
        FROM escolas e
        WHERE e.user_id IS NOT NULL AND e.id IN (SELECT id FROM seed_escola_ids)
    ),
    dias AS (
        SELECT generate_series(v_inicio_serie, v_hoje, INTERVAL '1 day')::DATE AS dia
    ),
    prof_dia AS (
        SELECT p.created_at::DATE AS dia, COUNT(*)::BIGINT AS total
        FROM professores p
        WHERE p.created_at >= v_inicio_serie
          AND p.escola_id NOT IN (SELECT id FROM seed_escola_ids)
        GROUP BY 1
    ),
    aluno_dia AS (
        SELECT a.created_at::DATE AS dia, COUNT(*)::BIGINT AS total
        FROM public.alunos a
        JOIN public.turmas t ON t.id = a.turma_id
        WHERE a.created_at >= v_inicio_serie
          AND t.escola_id NOT IN (SELECT id FROM seed_escola_ids)
        GROUP BY 1
    ),
    nota_dia AS (
        SELECT COALESCE(n.data_lancamento, n.created_at)::DATE AS dia, COUNT(*)::BIGINT AS total
        FROM public.notas n
        JOIN public.turmas t ON t.id = n.turma_id
        WHERE COALESCE(n.data_lancamento, n.created_at) >= v_inicio_serie
          AND t.escola_id NOT IN (SELECT id FROM seed_escola_ids)
        GROUP BY 1
    ),
    acesso_dia AS (
        SELECT sv.created_at::DATE AS dia, COUNT(*)::BIGINT AS total
        FROM system_visits sv
        WHERE sv.created_at >= v_inicio_serie
          AND (sv.escola_id IS NULL OR sv.escola_id NOT IN (SELECT id FROM seed_escola_ids))
          AND (sv.user_id IS NULL OR sv.user_id NOT IN (SELECT uid FROM seed_user_ids WHERE uid IS NOT NULL))
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
    escolas_reais AS (
        SELECT e.* FROM escolas e WHERE NOT is_seed_escola(e)
    ),
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
        FROM public.turmas
        GROUP BY escola_id
    ),
    aluno_esc AS (
        SELECT
            t.escola_id,
            COUNT(*) FILTER (WHERE COALESCE(a.ativo, true))::BIGINT AS total,
            COUNT(*) FILTER (WHERE a.created_at >= v_7d)::BIGINT AS d7,
            MAX(a.created_at) AS ultimo
        FROM public.alunos a
        JOIN public.turmas t ON t.id = a.turma_id
        GROUP BY t.escola_id
    ),
    nota_esc AS (
        SELECT
            t.escola_id,
            COUNT(*)::BIGINT AS total,
            COUNT(*) FILTER (WHERE COALESCE(n.data_lancamento, n.created_at) >= v_7d)::BIGINT AS d7,
            MAX(COALESCE(n.data_lancamento, n.created_at)) AS ultimo
        FROM public.notas n
        JOIN public.turmas t ON t.id = n.turma_id
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
        FROM escolas_reais e
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
    'Agrega utilização do sistema para SUPERADMIN, excluindo escolas e perfis seed.';

-- 5) Broadcast de notificações (contorna RLS INSERT)
CREATE OR REPLACE FUNCTION superadmin_broadcast_notification(
    p_titulo TEXT,
    p_mensagem TEXT,
    p_audiencias TEXT[] DEFAULT ARRAY['escolas']::TEXT[],
    p_tipo TEXT DEFAULT 'sistema',
    p_link TEXT DEFAULT NULL,
    p_incluir_seeds BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_titulo TEXT := NULLIF(TRIM(COALESCE(p_titulo, '')), '');
    v_mensagem TEXT := NULLIF(TRIM(COALESCE(p_mensagem, '')), '');
    v_tipo TEXT := NULLIF(TRIM(COALESCE(p_tipo, 'sistema')), '');
    v_link TEXT := NULLIF(TRIM(COALESCE(p_link, '')), '');
    v_audiencias TEXT[] := COALESCE(p_audiencias, ARRAY[]::TEXT[]);
    v_inserted INTEGER := 0;
    v_destinatarios UUID[];
    v_count_escolas INTEGER := 0;
    v_count_dm INTEGER := 0;
    v_count_dp INTEGER := 0;
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

    IF v_titulo IS NULL THEN
        RAISE EXCEPTION 'Título obrigatório';
    END IF;
    IF v_mensagem IS NULL THEN
        RAISE EXCEPTION 'Mensagem obrigatória';
    END IF;
    IF v_tipo IS NULL THEN
        v_tipo := 'sistema';
    END IF;
    IF array_length(v_audiencias, 1) IS NULL THEN
        RAISE EXCEPTION 'Seleccione pelo menos um destinatário';
    END IF;

    -- Normalizar audiências
    v_audiencias := ARRAY(
        SELECT DISTINCT LOWER(TRIM(a))
        FROM UNNEST(v_audiencias) AS a
        WHERE LOWER(TRIM(a)) IN ('escolas', 'direcoes_municipais', 'direcoes_provinciais')
    );

    IF array_length(v_audiencias, 1) IS NULL THEN
        RAISE EXCEPTION 'Audiências inválidas';
    END IF;

    WITH dests AS (
        -- Escolas (admin ESCOLA)
        SELECT DISTINCT COALESCE(up.user_id, e.user_id) AS user_id, 'escolas'::TEXT AS audience
        FROM escolas e
        LEFT JOIN user_profiles up
            ON up.escola_id = e.id
           AND up.tipo_perfil = 'ESCOLA'
           AND COALESCE(up.ativo, true) IS TRUE
        WHERE 'escolas' = ANY (v_audiencias)
          AND COALESCE(e.ativo, true) IS TRUE
          AND COALESCE(e.bloqueado, false) IS FALSE
          AND (p_incluir_seeds OR NOT is_seed_escola(e))
          AND COALESCE(up.user_id, e.user_id) IS NOT NULL

        UNION

        -- Direções Municipais
        SELECT DISTINCT dm.user_id, 'direcoes_municipais'::TEXT
        FROM direcoes_municipais dm
        WHERE 'direcoes_municipais' = ANY (v_audiencias)
          AND dm.user_id IS NOT NULL
          AND COALESCE(dm.ativo, true) IS TRUE
          AND COALESCE(dm.bloqueado, false) IS FALSE
          AND (
              p_incluir_seeds
              OR (
                  NOT is_seed_email(dm.email)
                  AND COALESCE(dm.numero_funcionario, '') NOT LIKE 'SEED-%'
              )
          )

        UNION

        -- Direções Provinciais
        SELECT DISTINCT dp.user_id, 'direcoes_provinciais'::TEXT
        FROM direcoes_provinciais dp
        WHERE 'direcoes_provinciais' = ANY (v_audiencias)
          AND dp.user_id IS NOT NULL
          AND COALESCE(dp.ativo, true) IS TRUE
          AND COALESCE(dp.bloqueado, false) IS FALSE
          AND (
              p_incluir_seeds
              OR (
                  NOT is_seed_email(dp.email)
                  AND COALESCE(dp.numero_funcionario, '') NOT LIKE 'SEED-%'
              )
          )
    )
    SELECT
        COALESCE(ARRAY_AGG(DISTINCT user_id), ARRAY[]::UUID[]),
        COUNT(*) FILTER (WHERE audience = 'escolas'),
        COUNT(*) FILTER (WHERE audience = 'direcoes_municipais'),
        COUNT(*) FILTER (WHERE audience = 'direcoes_provinciais')
    INTO v_destinatarios, v_count_escolas, v_count_dm, v_count_dp
    FROM dests
    WHERE user_id IS NOT NULL;

    IF COALESCE(array_length(v_destinatarios, 1), 0) = 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'enviadas', 0,
            'escolas', 0,
            'direcoes_municipais', 0,
            'direcoes_provinciais', 0,
            'message', 'Nenhum destinatário activo encontrado para as audiências seleccionadas.'
        );
    END IF;

    INSERT INTO notificacoes (
        destinatario_id,
        tipo,
        titulo,
        mensagem,
        link,
        lida,
        dados_adicionais
    )
    SELECT
        d,
        v_tipo,
        v_titulo,
        v_mensagem,
        COALESCE(v_link, ''),
        false,
        jsonb_build_object(
            'origem', 'superadmin_broadcast',
            'audiencias', to_jsonb(v_audiencias),
            'enviado_por', auth.uid()
        )
    FROM UNNEST(v_destinatarios) AS d;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    BEGIN
        PERFORM log_superadmin_action(
            'BROADCAST_NOTIFICATION',
            NULL,
            jsonb_build_object(
                'titulo', v_titulo,
                'tipo', v_tipo,
                'audiencias', v_audiencias,
                'enviadas', v_inserted,
                'escolas', v_count_escolas,
                'direcoes_municipais', v_count_dm,
                'direcoes_provinciais', v_count_dp
            )
        );
    EXCEPTION
        WHEN OTHERS THEN
            NULL; -- não falhar o envio por causa da auditoria
    END;

    RETURN jsonb_build_object(
        'success', true,
        'enviadas', v_inserted,
        'escolas', v_count_escolas,
        'direcoes_municipais', v_count_dm,
        'direcoes_provinciais', v_count_dp,
        'message', format('Notificação enviada a %s destinatário(s).', v_inserted)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION superadmin_broadcast_notification(TEXT, TEXT, TEXT[], TEXT, TEXT, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION superadmin_broadcast_notification(TEXT, TEXT, TEXT[], TEXT, TEXT, BOOLEAN) IS
    'SUPERADMIN: envia notificações in-app para escolas, DMs e/ou DPs.';
