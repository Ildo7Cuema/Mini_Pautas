-- ============================================================
-- Notificar escolas / DMs / DPs quando o preço de assinatura muda
-- Conteúdo: manutenção, estabilidade e melhorias da plataforma
-- ============================================================

CREATE OR REPLACE FUNCTION formatar_plano_assinatura(p_plano TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE LOWER(COALESCE(p_plano, ''))
        WHEN 'trimestral' THEN 'Trimestral'
        WHEN 'semestral' THEN 'Semestral'
        WHEN 'anual' THEN 'Anual'
        ELSE INITCAP(COALESCE(p_plano, 'plano'))
    END;
$$;

CREATE OR REPLACE FUNCTION formatar_valor_aoa(p_valor NUMERIC)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT TRIM(TO_CHAR(COALESCE(p_valor, 0), 'FM999G999G999G990D00')) || ' Kz';
$$;

/**
 * Constrói título/mensagem benéficos e envia via broadcast SUPERADMIN.
 * - Global: todas as audiências activas (exclui seeds)
 * - Instituição: apenas a entidade alvo
 */
CREATE OR REPLACE FUNCTION notificar_actualizacao_preco_assinatura(
    p_escopo TEXT,               -- 'global' | 'instituicao'
    p_evento TEXT,               -- 'update' | 'clear'
    p_plano TEXT,
    p_valor NUMERIC DEFAULT NULL,
    p_desconto_percentual NUMERIC DEFAULT NULL,
    p_tipo_instituicao TEXT DEFAULT NULL,
    p_instituicao_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plano TEXT := formatar_plano_assinatura(p_plano);
    v_valor TEXT := CASE WHEN p_valor IS NULL THEN NULL ELSE formatar_valor_aoa(p_valor) END;
    v_desconto NUMERIC := COALESCE(p_desconto_percentual, 0);
    v_titulo TEXT;
    v_mensagem TEXT;
    v_audiencias TEXT[];
    v_escola_ids UUID[] := NULL;
    v_dm_ids UUID[] := NULL;
    v_dp_ids UUID[] := NULL;
    v_result JSONB;
    v_desconto_txt TEXT;
BEGIN
    IF p_evento = 'clear' THEN
        v_titulo := 'Harmonização de planos — valor do catálogo global';
        v_mensagem := format(
            E'Caros parceiros educativos,\n\n'
            || E'Informamos que o preço personalizado do plano %s deixou de vigorar para a vossa instituição. '
            || E'A partir de agora aplica-se o valor do catálogo global de assinaturas.\n\n'
            || E'Esta harmonização faz parte do nosso ciclo de manutenção e melhoria contínua, com o objectivo de:\n'
            || E'• garantir coerência e transparência nos planos;\n'
            || E'• reforçar a estabilidade e a segurança da plataforma;\n'
            || E'• acelerar a entrega de melhorias pedagógicas e operacionais;\n'
            || E'• manter suporte técnico e actualizações regulares.\n\n'
            || E'Continuamos empenhados em servir escolas e direcções com qualidade e inovação.\n\n'
            || E'EduGest Angola — obrigado pela confiança.',
            v_plano
        );
    ELSE
        v_desconto_txt := CASE
            WHEN v_desconto > 0 THEN format(' (desconto de %s%%)', TRIM(TO_CHAR(v_desconto, 'FM990D00')))
            ELSE ''
        END;
        v_titulo := 'Melhorias contínuas na plataforma — actualização de planos';
        v_mensagem := format(
            E'Caros parceiros educativos,\n\n'
            || E'Informamos a actualização do plano %s%s%s.\n\n'
            || E'Esta alteração enquadra-se no nosso programa de manutenção e evolução do EduGest, e visa:\n'
            || E'• reforçar a segurança, a estabilidade e o desempenho do sistema;\n'
            || E'• melhorar mini-pautas, pautas, relatórios e fluxos de gestão;\n'
            || E'• disponibilizar novas funcionalidades de apoio pedagógico;\n'
            || E'• assegurar suporte técnico e actualizações regulares aos utilizadores.\n\n'
            || E'O investimento nas assinaturas permite-nos continuar a servir escolas e direcções '
            || E'com fiabilidade, inovação e acompanhamento próximo.\n\n'
            || E'EduGest Angola — obrigado pela parceria.',
            v_plano,
            CASE WHEN v_valor IS NOT NULL THEN format(', agora em %s', v_valor) ELSE '' END,
            v_desconto_txt
        );
    END IF;

    IF LOWER(COALESCE(p_escopo, 'global')) = 'instituicao' THEN
        IF p_instituicao_id IS NULL OR p_tipo_instituicao IS NULL THEN
            RAISE EXCEPTION 'Instituição obrigatória para notificação particular';
        END IF;

        IF p_tipo_instituicao = 'ESCOLA' THEN
            v_audiencias := ARRAY['escolas']::TEXT[];
            v_escola_ids := ARRAY[p_instituicao_id]::UUID[];
        ELSIF p_tipo_instituicao = 'DIRECAO_MUNICIPAL' THEN
            v_audiencias := ARRAY['direcoes_municipais']::TEXT[];
            v_dm_ids := ARRAY[p_instituicao_id]::UUID[];
        ELSIF p_tipo_instituicao = 'DIRECAO_PROVINCIAL' THEN
            v_audiencias := ARRAY['direcoes_provinciais']::TEXT[];
            v_dp_ids := ARRAY[p_instituicao_id]::UUID[];
        ELSE
            RAISE EXCEPTION 'tipo_instituicao inválido: %', p_tipo_instituicao;
        END IF;
    ELSE
        v_audiencias := ARRAY['escolas', 'direcoes_municipais', 'direcoes_provinciais']::TEXT[];
    END IF;

    BEGIN
        v_result := superadmin_broadcast_notification(
            v_titulo,
            v_mensagem,
            v_audiencias,
            'sistema',
            NULL,
            false,
            v_escola_ids,
            v_dm_ids,
            v_dp_ids
        );
    EXCEPTION
        WHEN OTHERS THEN
            -- Notificação não deve impedir a alteração do preço
            v_result := jsonb_build_object(
                'success', false,
                'enviadas', 0,
                'error', SQLERRM
            );
    END;

    RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION notificar_actualizacao_preco_assinatura(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, UUID) TO authenticated;

-- ------------------------------------------------------------
-- Actualizar preço global + notificar todas as instituições
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION atualizar_preco_licenca(
    p_id UUID,
    p_valor NUMERIC DEFAULT NULL,
    p_desconto_percentual NUMERIC DEFAULT NULL,
    p_descricao TEXT DEFAULT NULL,
    p_ativo BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_before precos_licenca%ROWTYPE;
    v_after precos_licenca%ROWTYPE;
    v_changed BOOLEAN := false;
    v_notif JSONB;
BEGIN
    BEGIN
        PERFORM assert_is_superadmin();
    EXCEPTION
        WHEN undefined_function THEN
            IF NOT COALESCE(is_superadmin(), false) THEN
                RAISE EXCEPTION 'Acesso negado: apenas SUPERADMIN';
            END IF;
    END;

    SELECT * INTO v_before
    FROM precos_licenca
    WHERE id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Preço de licença não encontrado: %', p_id;
    END IF;

    IF p_valor IS NOT NULL AND p_valor <= 0 THEN
        RAISE EXCEPTION 'O valor deve ser maior que 0';
    END IF;

    IF p_desconto_percentual IS NOT NULL
       AND (p_desconto_percentual < 0 OR p_desconto_percentual > 100) THEN
        RAISE EXCEPTION 'O desconto deve estar entre 0 e 100';
    END IF;

    UPDATE precos_licenca
    SET
        valor = COALESCE(p_valor, valor),
        desconto_percentual = COALESCE(p_desconto_percentual, desconto_percentual),
        descricao = COALESCE(p_descricao, descricao),
        ativo = COALESCE(p_ativo, ativo),
        updated_at = NOW()
    WHERE id = p_id
    RETURNING * INTO v_after;

    v_changed :=
        v_before.valor IS DISTINCT FROM v_after.valor
        OR v_before.desconto_percentual IS DISTINCT FROM v_after.desconto_percentual
        OR v_before.ativo IS DISTINCT FROM v_after.ativo
        OR v_before.descricao IS DISTINCT FROM v_after.descricao;

    BEGIN
        PERFORM log_superadmin_action(
            'UPDATE_PRICE',
            NULL,
            jsonb_build_object(
                'price_id', v_after.id,
                'plano', v_after.plano,
                'before', jsonb_build_object(
                    'valor', v_before.valor,
                    'desconto_percentual', v_before.desconto_percentual,
                    'descricao', v_before.descricao,
                    'ativo', v_before.ativo
                ),
                'after', jsonb_build_object(
                    'valor', v_after.valor,
                    'desconto_percentual', v_after.desconto_percentual,
                    'descricao', v_after.descricao,
                    'ativo', v_after.ativo
                ),
                'notificou', v_changed
            )
        );
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    IF v_changed THEN
        v_notif := notificar_actualizacao_preco_assinatura(
            'global',
            'update',
            v_after.plano,
            v_after.valor,
            v_after.desconto_percentual,
            NULL,
            NULL
        );
    END IF;

    RETURN to_jsonb(v_after) || jsonb_build_object(
        'notificacao', COALESCE(v_notif, jsonb_build_object('enviadas', 0, 'skipped', NOT v_changed))
    );
END;
$$;

GRANT EXECUTE ON FUNCTION atualizar_preco_licenca(UUID, NUMERIC, NUMERIC, TEXT, BOOLEAN) TO authenticated;

-- ------------------------------------------------------------
-- Upsert preço por instituição + notificar a entidade
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_preco_licenca_instituicao(
    p_tipo_instituicao TEXT,
    p_instituicao_id UUID,
    p_plano TEXT,
    p_valor NUMERIC,
    p_desconto_percentual NUMERIC DEFAULT 0,
    p_descricao TEXT DEFAULT NULL,
    p_ativo BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_before precos_licenca_instituicao%ROWTYPE;
    v_after precos_licenca_instituicao%ROWTYPE;
    v_changed BOOLEAN := true;
    v_notif JSONB;
BEGIN
    BEGIN
        PERFORM assert_is_superadmin();
    EXCEPTION
        WHEN undefined_function THEN
            IF NOT COALESCE(is_superadmin(), false) THEN
                RAISE EXCEPTION 'Acesso negado: apenas SUPERADMIN';
            END IF;
    END;

    IF p_tipo_instituicao NOT IN ('ESCOLA', 'DIRECAO_MUNICIPAL', 'DIRECAO_PROVINCIAL') THEN
        RAISE EXCEPTION 'tipo_instituicao inválido';
    END IF;
    IF p_plano NOT IN ('trimestral', 'semestral', 'anual') THEN
        RAISE EXCEPTION 'plano inválido';
    END IF;
    IF p_valor IS NULL OR p_valor <= 0 THEN
        RAISE EXCEPTION 'O valor deve ser maior que 0';
    END IF;
    IF COALESCE(p_desconto_percentual, 0) < 0 OR COALESCE(p_desconto_percentual, 0) > 100 THEN
        RAISE EXCEPTION 'O desconto deve estar entre 0 e 100';
    END IF;

    SELECT * INTO v_before
    FROM precos_licenca_instituicao
    WHERE tipo_instituicao = p_tipo_instituicao
      AND instituicao_id = p_instituicao_id
      AND plano = p_plano;

    INSERT INTO precos_licenca_instituicao AS t (
        tipo_instituicao,
        instituicao_id,
        plano,
        valor,
        desconto_percentual,
        descricao,
        ativo,
        updated_at
    ) VALUES (
        p_tipo_instituicao,
        p_instituicao_id,
        p_plano,
        p_valor,
        COALESCE(p_desconto_percentual, 0),
        NULLIF(TRIM(COALESCE(p_descricao, '')), ''),
        COALESCE(p_ativo, true),
        NOW()
    )
    ON CONFLICT (tipo_instituicao, instituicao_id, plano) DO UPDATE SET
        valor = EXCLUDED.valor,
        desconto_percentual = EXCLUDED.desconto_percentual,
        descricao = EXCLUDED.descricao,
        ativo = EXCLUDED.ativo,
        updated_at = NOW()
    RETURNING * INTO v_after;

    IF FOUND AND v_before.id IS NOT NULL THEN
        v_changed :=
            v_before.valor IS DISTINCT FROM v_after.valor
            OR v_before.desconto_percentual IS DISTINCT FROM v_after.desconto_percentual
            OR v_before.ativo IS DISTINCT FROM v_after.ativo
            OR v_before.descricao IS DISTINCT FROM v_after.descricao;
    END IF;

    BEGIN
        PERFORM log_superadmin_action(
            'UPDATE_INSTITUTION_PRICE',
            CASE WHEN p_tipo_instituicao = 'ESCOLA' THEN p_instituicao_id ELSE NULL END,
            jsonb_build_object(
                'tipo_instituicao', p_tipo_instituicao,
                'instituicao_id', p_instituicao_id,
                'plano', p_plano,
                'valor', v_after.valor,
                'desconto_percentual', v_after.desconto_percentual,
                'ativo', v_after.ativo
            )
        );
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    IF v_changed THEN
        v_notif := notificar_actualizacao_preco_assinatura(
            'instituicao',
            'update',
            v_after.plano,
            v_after.valor,
            v_after.desconto_percentual,
            p_tipo_instituicao,
            p_instituicao_id
        );
    END IF;

    RETURN to_jsonb(v_after) || jsonb_build_object(
        'notificacao', COALESCE(v_notif, jsonb_build_object('enviadas', 0, 'skipped', NOT v_changed))
    );
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_preco_licenca_instituicao(TEXT, UUID, TEXT, NUMERIC, NUMERIC, TEXT, BOOLEAN) TO authenticated;

-- ------------------------------------------------------------
-- Remover override institucional + notificar a entidade
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION remover_preco_licenca_instituicao(
    p_tipo_instituicao TEXT,
    p_instituicao_id UUID,
    p_plano TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted INTEGER := 0;
    v_notif JSONB;
BEGIN
    BEGIN
        PERFORM assert_is_superadmin();
    EXCEPTION
        WHEN undefined_function THEN
            IF NOT COALESCE(is_superadmin(), false) THEN
                RAISE EXCEPTION 'Acesso negado: apenas SUPERADMIN';
            END IF;
    END;

    DELETE FROM precos_licenca_instituicao
    WHERE tipo_instituicao = p_tipo_instituicao
      AND instituicao_id = p_instituicao_id
      AND plano = p_plano;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    IF v_deleted > 0 THEN
        BEGIN
            PERFORM log_superadmin_action(
                'UPDATE_INSTITUTION_PRICE',
                CASE WHEN p_tipo_instituicao = 'ESCOLA' THEN p_instituicao_id ELSE NULL END,
                jsonb_build_object(
                    'acao', 'clear',
                    'tipo_instituicao', p_tipo_instituicao,
                    'instituicao_id', p_instituicao_id,
                    'plano', p_plano
                )
            );
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;

        v_notif := notificar_actualizacao_preco_assinatura(
            'instituicao',
            'clear',
            p_plano,
            NULL,
            NULL,
            p_tipo_instituicao,
            p_instituicao_id
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'removed', v_deleted,
        'notificacao', COALESCE(v_notif, jsonb_build_object('enviadas', 0, 'skipped', v_deleted = 0))
    );
END;
$$;

GRANT EXECUTE ON FUNCTION remover_preco_licenca_instituicao(TEXT, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION notificar_actualizacao_preco_assinatura IS
    'Notifica escolas/DMs/DPs sobre alteração de preços com mensagem de manutenção e melhorias.';
COMMENT ON FUNCTION upsert_preco_licenca_instituicao IS
    'Cria/actualiza preço por instituição (SUPERADMIN) e notifica a entidade.';
COMMENT ON FUNCTION remover_preco_licenca_instituicao IS
    'Remove override de preço institucional (SUPERADMIN) e notifica a entidade.';
