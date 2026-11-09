-- ============================================================
-- Fix: editar preço global (precos_licenca) no painel SUPERADMIN
-- Sintoma: PATCH .../precos_licenca?...&select=* → 406 (PGRST116)
-- Causa: UPDATE directo + .single() falha quando is_superadmin()
--        (role_cache) não bate com o perfil SUPERADMIN.
-- Solução: RPC SECURITY DEFINER com assert_is_superadmin() +
--          reforço RLS e sync do role_cache.
-- ============================================================

-- 1) Sincronizar SUPERADMINs no role_cache
INSERT INTO role_cache (user_id, tipo_perfil, is_superadmin, ativo, updated_at)
SELECT
    up.user_id,
    up.tipo_perfil,
    true,
    up.ativo,
    NOW()
FROM user_profiles up
WHERE up.tipo_perfil = 'SUPERADMIN'
ON CONFLICT (user_id) DO UPDATE SET
    tipo_perfil = 'SUPERADMIN',
    is_superadmin = true,
    ativo = EXCLUDED.ativo,
    updated_at = NOW();

-- 2) Reforçar políticas de precos_licenca
DROP POLICY IF EXISTS "Anyone can view precos" ON precos_licenca;
CREATE POLICY "Anyone can view precos"
    ON precos_licenca FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "SUPERADMIN can manage precos" ON precos_licenca;
CREATE POLICY "SUPERADMIN can manage precos"
    ON precos_licenca FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

GRANT SELECT, INSERT, UPDATE, DELETE ON precos_licenca TO authenticated;

-- 3) RPC segura para actualizar preço global
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
                )
            )
        );
    EXCEPTION WHEN OTHERS THEN
        -- Auditoria não deve bloquear a actualização do preço
        NULL;
    END;

    RETURN to_jsonb(v_after);
END;
$$;

GRANT EXECUTE ON FUNCTION atualizar_preco_licenca(UUID, NUMERIC, NUMERIC, TEXT, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION atualizar_preco_licenca IS
    'Actualiza preço global de licença (SUPERADMIN). Evita 406 do PATCH+select.single sob RLS.';
