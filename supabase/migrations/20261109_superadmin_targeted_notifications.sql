-- ============================================================
-- SUPERADMIN: notificações particulares (IDs específicos)
-- ============================================================

DROP FUNCTION IF EXISTS superadmin_broadcast_notification(TEXT, TEXT, TEXT[], TEXT, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION superadmin_broadcast_notification(
    p_titulo TEXT,
    p_mensagem TEXT,
    p_audiencias TEXT[] DEFAULT ARRAY['escolas']::TEXT[],
    p_tipo TEXT DEFAULT 'sistema',
    p_link TEXT DEFAULT NULL,
    p_incluir_seeds BOOLEAN DEFAULT false,
    p_escola_ids UUID[] DEFAULT NULL,
    p_direcao_municipal_ids UUID[] DEFAULT NULL,
    p_direcao_provincial_ids UUID[] DEFAULT NULL
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
    v_escola_ids UUID[] := COALESCE(p_escola_ids, ARRAY[]::UUID[]);
    v_dm_ids UUID[] := COALESCE(p_direcao_municipal_ids, ARRAY[]::UUID[]);
    v_dp_ids UUID[] := COALESCE(p_direcao_provincial_ids, ARRAY[]::UUID[]);
    v_has_escola_ids BOOLEAN := COALESCE(array_length(v_escola_ids, 1), 0) > 0;
    v_has_dm_ids BOOLEAN := COALESCE(array_length(v_dm_ids, 1), 0) > 0;
    v_has_dp_ids BOOLEAN := COALESCE(array_length(v_dp_ids, 1), 0) > 0;
    v_inserted INTEGER := 0;
    v_destinatarios UUID[];
    v_count_escolas INTEGER := 0;
    v_count_dm INTEGER := 0;
    v_count_dp INTEGER := 0;
    v_modo TEXT;
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

    v_audiencias := ARRAY(
        SELECT DISTINCT LOWER(TRIM(a))
        FROM UNNEST(v_audiencias) AS a
        WHERE LOWER(TRIM(a)) IN ('escolas', 'direcoes_municipais', 'direcoes_provinciais')
    );

    -- Se houver IDs particulares, activar automaticamente a audiência correspondente
    IF v_has_escola_ids AND NOT ('escolas' = ANY (COALESCE(v_audiencias, ARRAY[]::TEXT[]))) THEN
        v_audiencias := array_append(COALESCE(v_audiencias, ARRAY[]::TEXT[]), 'escolas');
    END IF;
    IF v_has_dm_ids AND NOT ('direcoes_municipais' = ANY (COALESCE(v_audiencias, ARRAY[]::TEXT[]))) THEN
        v_audiencias := array_append(COALESCE(v_audiencias, ARRAY[]::TEXT[]), 'direcoes_municipais');
    END IF;
    IF v_has_dp_ids AND NOT ('direcoes_provinciais' = ANY (COALESCE(v_audiencias, ARRAY[]::TEXT[]))) THEN
        v_audiencias := array_append(COALESCE(v_audiencias, ARRAY[]::TEXT[]), 'direcoes_provinciais');
    END IF;

    IF array_length(v_audiencias, 1) IS NULL THEN
        RAISE EXCEPTION 'Seleccione pelo menos um destinatário';
    END IF;

    v_modo := CASE
        WHEN v_has_escola_ids OR v_has_dm_ids OR v_has_dp_ids THEN 'particular'
        ELSE 'broadcast'
    END;

    WITH dests AS (
        -- Escolas
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
          AND (
              v_modo = 'broadcast'
              OR (v_modo = 'particular' AND v_has_escola_ids AND e.id = ANY (v_escola_ids))
          )

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
          AND (
              v_modo = 'broadcast'
              OR (v_modo = 'particular' AND v_has_dm_ids AND dm.id = ANY (v_dm_ids))
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
          AND (
              v_modo = 'broadcast'
              OR (v_modo = 'particular' AND v_has_dp_ids AND dp.id = ANY (v_dp_ids))
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
            'modo', v_modo,
            'message', 'Nenhum destinatário activo encontrado para a selecção.'
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
            'modo', v_modo,
            'audiencias', to_jsonb(v_audiencias),
            'escola_ids', to_jsonb(v_escola_ids),
            'direcao_municipal_ids', to_jsonb(v_dm_ids),
            'direcao_provincial_ids', to_jsonb(v_dp_ids),
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
                'modo', v_modo,
                'audiencias', v_audiencias,
                'escola_ids', v_escola_ids,
                'direcao_municipal_ids', v_dm_ids,
                'direcao_provincial_ids', v_dp_ids,
                'enviadas', v_inserted,
                'escolas', v_count_escolas,
                'direcoes_municipais', v_count_dm,
                'direcoes_provinciais', v_count_dp
            )
        );
    EXCEPTION
        WHEN OTHERS THEN
            NULL;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'enviadas', v_inserted,
        'escolas', v_count_escolas,
        'direcoes_municipais', v_count_dm,
        'direcoes_provinciais', v_count_dp,
        'modo', v_modo,
        'message', format('Notificação enviada a %s destinatário(s).', v_inserted)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION superadmin_broadcast_notification(TEXT, TEXT, TEXT[], TEXT, TEXT, BOOLEAN, UUID[], UUID[], UUID[]) TO authenticated;

COMMENT ON FUNCTION superadmin_broadcast_notification(TEXT, TEXT, TEXT[], TEXT, TEXT, BOOLEAN, UUID[], UUID[], UUID[]) IS
    'SUPERADMIN: envia notificações in-app (broadcast por tipo ou particulares por ID).';
