-- Harden register_funcionario_provincial_account:
-- do not overwrite an existing non-FUNCIONARIO_PROVINCIAL profile.

CREATE OR REPLACE FUNCTION register_funcionario_provincial_account(
    p_email TEXT,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_pessoal RECORD;
    v_provincia TEXT;
    v_existing_tipo TEXT;
BEGIN
    SELECT * INTO v_pessoal
    FROM pessoal_direcao_provincial
    WHERE lower(email) = lower(p_email)
      AND ativo = true;

    IF v_pessoal IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Funcionário provincial não encontrado com este email'
        );
    END IF;

    SELECT tipo_perfil INTO v_existing_tipo
    FROM user_profiles
    WHERE user_id = p_user_id;

    IF v_existing_tipo IS NOT NULL
       AND v_existing_tipo <> 'FUNCIONARIO_PROVINCIAL' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format(
                'Este email já está associado ao perfil %s. Use outro email no convite.',
                v_existing_tipo
            )
        );
    END IF;

    UPDATE pessoal_direcao_provincial
    SET user_id = p_user_id,
        updated_at = NOW()
    WHERE id = v_pessoal.id;

    INSERT INTO user_profiles (user_id, tipo_perfil, escola_id, ativo)
    VALUES (p_user_id, 'FUNCIONARIO_PROVINCIAL', NULL, true)
    ON CONFLICT (user_id) DO UPDATE
    SET tipo_perfil = 'FUNCIONARIO_PROVINCIAL',
        escola_id = NULL,
        ativo = true
    WHERE user_profiles.tipo_perfil IS NULL
       OR user_profiles.tipo_perfil = 'FUNCIONARIO_PROVINCIAL';

    SELECT provincia INTO v_provincia
    FROM direcoes_provinciais
    WHERE id = v_pessoal.direcao_provincial_id;

    INSERT INTO role_cache (
        user_id, tipo_perfil, is_direcao_provincial, provincia, ativo, updated_at
    ) VALUES (
        p_user_id, 'FUNCIONARIO_PROVINCIAL', true, v_provincia, true, NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        tipo_perfil = 'FUNCIONARIO_PROVINCIAL',
        is_direcao_provincial = true,
        provincia = EXCLUDED.provincia,
        ativo = true,
        updated_at = NOW()
    WHERE role_cache.tipo_perfil IS NULL
       OR role_cache.tipo_perfil = 'FUNCIONARIO_PROVINCIAL';

    RETURN jsonb_build_object(
        'success', true,
        'pessoal_id', v_pessoal.id,
        'direcao_provincial_id', v_pessoal.direcao_provincial_id,
        'departamento', v_pessoal.departamento
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION register_funcionario_provincial_account(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION register_funcionario_provincial_account(TEXT, UUID) TO anon;
