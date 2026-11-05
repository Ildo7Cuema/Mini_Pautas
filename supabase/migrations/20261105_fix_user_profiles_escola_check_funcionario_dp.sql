-- Fix: FUNCIONARIO_PROVINCIAL must allow escola_id IS NULL.
-- The live constraint is named user_profiles_escola_check (not
-- user_profiles_superadmin_escola_check), so the earlier migration
-- did not update the rule that blocked registration.

ALTER TABLE user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_escola_check;

ALTER TABLE user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_superadmin_escola_check;

ALTER TABLE user_profiles
    ADD CONSTRAINT user_profiles_escola_check
    CHECK (
        (
            tipo_perfil IN (
                'SUPERADMIN',
                'DIRECAO_MUNICIPAL',
                'DIRECAO_PROVINCIAL',
                'FUNCIONARIO_PROVINCIAL'
            )
            AND escola_id IS NULL
        )
        OR
        (
            tipo_perfil NOT IN (
                'SUPERADMIN',
                'DIRECAO_MUNICIPAL',
                'DIRECAO_PROVINCIAL',
                'FUNCIONARIO_PROVINCIAL'
            )
            AND escola_id IS NOT NULL
        )
    );
