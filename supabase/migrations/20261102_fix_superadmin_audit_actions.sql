-- ============================================
-- Fix auditoria SUPERADMIN
-- 1) Expandir action_type (direções, licenças, etc.)
-- 2) RPC fiável para listar acções (bypass RLS flaky)
-- 3) Reforçar log_superadmin_action
-- ============================================

-- 1. Constraint de tipos de acção
ALTER TABLE superadmin_actions
DROP CONSTRAINT IF EXISTS superadmin_actions_action_type_check;

ALTER TABLE superadmin_actions
ADD CONSTRAINT superadmin_actions_action_type_check
CHECK (action_type IN (
    -- Escolas
    'ACTIVATE_ESCOLA',
    'DEACTIVATE_ESCOLA',
    'BLOCK_ESCOLA',
    'UNBLOCK_ESCOLA',
    'EDIT_ESCOLA',
    'CREATE_ESCOLA',
    'DELETE_ESCOLA',
    'RESTORE_ESCOLA',
    'VIEW_ESCOLA_DATA',
    -- Direção Municipal
    'ACTIVATE_DIRECAO_MUNICIPAL',
    'DEACTIVATE_DIRECAO_MUNICIPAL',
    'BLOCK_DIRECAO_MUNICIPAL',
    'UNBLOCK_DIRECAO_MUNICIPAL',
    -- Direção Provincial
    'ACTIVATE_DIRECAO_PROVINCIAL',
    'DEACTIVATE_DIRECAO_PROVINCIAL',
    'BLOCK_DIRECAO_PROVINCIAL',
    'UNBLOCK_DIRECAO_PROVINCIAL',
    -- Licenças / assinaturas
    'CREATE_LICENSE',
    'SUSPEND_LICENSE',
    'REACTIVATE_LICENSE',
    'APPROVE_SUBSCRIPTION',
    'REJECT_SUBSCRIPTION',
    'UPDATE_PRICE',
    'UPDATE_INSTITUTION_PRICE',
    -- Sistema
    'EDIT_SYSTEM_CONFIG',
    'CREATE_USER',
    'EDIT_USER',
    'DELETE_USER',
    'EXPORT_DATA',
    'OTHER'
));

-- 2. Logging mais robusto
CREATE OR REPLACE FUNCTION log_superadmin_action(
    p_action_type TEXT,
    p_target_escola_id UUID DEFAULT NULL,
    p_action_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_action_id UUID;
    v_uid UUID := auth.uid();
    v_ip_address TEXT;
    v_user_agent TEXT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Utilizador não autenticado para auditoria';
    END IF;

    BEGIN
        v_ip_address := COALESCE(
            current_setting('request.headers', true)::json->>'x-real-ip',
            current_setting('request.headers', true)::json->>'x-forwarded-for',
            'unknown'
        );
        v_user_agent := COALESCE(
            current_setting('request.headers', true)::json->>'user-agent',
            'unknown'
        );
    EXCEPTION WHEN OTHERS THEN
        v_ip_address := 'unknown';
        v_user_agent := 'unknown';
    END;

    INSERT INTO superadmin_actions (
        superadmin_user_id,
        action_type,
        target_escola_id,
        action_details,
        ip_address,
        user_agent
    ) VALUES (
        v_uid,
        p_action_type,
        p_target_escola_id,
        COALESCE(p_action_details, '{}'::jsonb),
        v_ip_address,
        v_user_agent
    )
    RETURNING id INTO v_action_id;

    RETURN v_action_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_superadmin_action(TEXT, UUID, JSONB) TO authenticated;

-- 3. Listagem via RPC (evita listas vazias por RLS/role_cache)
CREATE OR REPLACE FUNCTION listar_superadmin_actions(
    p_action_type TEXT DEFAULT NULL,
    p_action_type_prefix TEXT DEFAULT NULL,
    p_escola_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 100
)
RETURNS SETOF superadmin_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Preferir assert_is_superadmin se existir; fallback is_superadmin()
    BEGIN
        PERFORM assert_is_superadmin();
    EXCEPTION
        WHEN undefined_function THEN
            IF NOT COALESCE(is_superadmin(), false) THEN
                RAISE EXCEPTION 'Acesso negado: apenas SUPERADMIN';
            END IF;
        WHEN OTHERS THEN
            IF SQLERRM ILIKE 'Acesso negado%' OR SQLERRM ILIKE '%SUPERADMIN%' THEN
                RAISE;
            END IF;
            IF NOT COALESCE(is_superadmin(), false) THEN
                RAISE EXCEPTION 'Acesso negado: apenas SUPERADMIN';
            END IF;
    END;

    RETURN QUERY
    SELECT sa.*
    FROM superadmin_actions sa
    WHERE (p_action_type IS NULL OR sa.action_type = p_action_type)
      AND (p_action_type_prefix IS NULL OR sa.action_type ILIKE '%' || p_action_type_prefix || '%')
      AND (p_escola_id IS NULL OR sa.target_escola_id = p_escola_id)
    ORDER BY sa.created_at DESC
    LIMIT GREATEST(COALESCE(p_limit, 100), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION listar_superadmin_actions(TEXT, TEXT, UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION listar_superadmin_actions IS
    'Lista acções de auditoria do SUPERADMIN (SECURITY DEFINER)';
COMMENT ON FUNCTION log_superadmin_action IS
    'Regista acção do SUPERADMIN na tabela superadmin_actions';
