-- =============================================================================
-- Performance: auth bootstrap RPC + RLS initPlan for user_profiles
-- =============================================================================
-- 1) Wrap auth.uid() in (select auth.uid()) so Postgres evaluates once per statement
-- 2) Provide a single SECURITY DEFINER RPC that returns profile + role payload
-- =============================================================================

-- -----------------------------------------------------------------------------
-- RLS: re-create "own profile" policies with initPlan-friendly auth.uid()
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    pol record;
BEGIN
    -- Drop common own-profile SELECT policies (names vary across migrations)
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'user_profiles'
          AND cmd = 'SELECT'
          AND (
            policyname ILIKE '%own%'
            OR policyname ILIKE '%user_profiles_select_own%'
            OR policyname = 'Users can view own profile'
            OR policyname = 'own_profile_select'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON user_profiles', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "user_profiles_select_own_fast"
    ON user_profiles
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id_ativo
    ON user_profiles (user_id)
    WHERE ativo = true;

-- -----------------------------------------------------------------------------
-- Fast auth bootstrap (one round-trip for shell render)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_auth_bootstrap()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid uuid := auth.uid();
    profile_row public.user_profiles%ROWTYPE;
    payload jsonb;
    role_payload jsonb := '{}'::jsonb;
BEGIN
    IF uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
    END IF;

    SELECT *
    INTO profile_row
    FROM public.user_profiles
    WHERE user_id = uid
      AND ativo = true
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'no_profile');
    END IF;

    payload := jsonb_build_object(
        'success', true,
        'profile', to_jsonb(profile_row)
    );

    CASE profile_row.tipo_perfil
        WHEN 'SUPERADMIN' THEN
            role_payload := '{}'::jsonb;

        WHEN 'ESCOLA' THEN
            role_payload := jsonb_build_object(
                'escola', (
                    SELECT to_jsonb(e)
                    FROM public.escolas e
                    WHERE e.id = profile_row.escola_id
                    LIMIT 1
                )
            );

        WHEN 'PROFESSOR' THEN
            role_payload := jsonb_build_object(
                'professor', (
                    SELECT to_jsonb(p) || jsonb_build_object(
                        'escola', (
                            SELECT to_jsonb(e)
                            FROM public.escolas e
                            WHERE e.id = p.escola_id
                            LIMIT 1
                        )
                    )
                    FROM public.professores p
                    WHERE p.user_id = uid
                      AND p.ativo = true
                    LIMIT 1
                ),
                'turmas_associadas', COALESCE((
                    SELECT jsonb_agg(
                        to_jsonb(tp) || jsonb_build_object(
                            'turma', to_jsonb(t),
                            'disciplina', to_jsonb(d)
                        )
                    )
                    FROM public.turma_professores tp
                    LEFT JOIN public.turmas t ON t.id = tp.turma_id
                    LEFT JOIN public.disciplinas d ON d.id = tp.disciplina_id
                    WHERE tp.professor_id = (
                        SELECT p2.id FROM public.professores p2
                        WHERE p2.user_id = uid AND p2.ativo = true
                        LIMIT 1
                    )
                ), '[]'::jsonb)
            );

        WHEN 'SECRETARIO' THEN
            role_payload := jsonb_build_object(
                'secretario', (
                    SELECT to_jsonb(s) || jsonb_build_object(
                        'escola', to_jsonb(e)
                    )
                    FROM public.secretarios s
                    LEFT JOIN public.escolas e ON e.id = s.escola_id
                    WHERE s.user_id = uid
                      AND s.ativo = true
                    LIMIT 1
                )
            );

        WHEN 'DIRECAO_MUNICIPAL' THEN
            role_payload := jsonb_build_object(
                'direcaoMunicipal', (
                    SELECT to_jsonb(d)
                    FROM public.direcoes_municipais d
                    WHERE d.user_id = uid
                    LIMIT 1
                )
            );

        WHEN 'DIRECAO_PROVINCIAL' THEN
            role_payload := jsonb_build_object(
                'direcaoProvincial', (
                    SELECT to_jsonb(d)
                    FROM public.direcoes_provinciais d
                    WHERE d.user_id = uid
                    LIMIT 1
                )
            );

        WHEN 'FUNCIONARIO_PROVINCIAL' THEN
            role_payload := jsonb_build_object(
                'pessoal', (
                    SELECT to_jsonb(p)
                    FROM public.pessoal_direcao_provincial p
                    WHERE p.user_id = uid
                      AND p.ativo = true
                    LIMIT 1
                ),
                'direcaoProvincial', (
                    SELECT to_jsonb(d)
                    FROM public.direcoes_provinciais d
                    JOIN public.pessoal_direcao_provincial p
                      ON p.direcao_provincial_id = d.id
                    WHERE p.user_id = uid
                      AND p.ativo = true
                    LIMIT 1
                )
            );

        WHEN 'ALUNO' THEN
            role_payload := jsonb_build_object(
                'aluno', (
                    SELECT to_jsonb(a) || jsonb_build_object(
                        'turma', to_jsonb(t),
                        'escola', to_jsonb(e)
                    )
                    FROM public.alunos a
                    LEFT JOIN public.turmas t ON t.id = a.turma_id
                    LEFT JOIN public.escolas e ON e.id = t.escola_id
                    WHERE a.user_id = uid
                      AND a.ativo = true
                    LIMIT 1
                )
            );

        WHEN 'ENCARREGADO' THEN
            role_payload := jsonb_build_object(
                'alunos', COALESCE((
                    SELECT jsonb_agg(
                        to_jsonb(a) || jsonb_build_object(
                            'turma', to_jsonb(t),
                            'escola', to_jsonb(e)
                        )
                    )
                    FROM public.alunos a
                    LEFT JOIN public.turmas t ON t.id = a.turma_id
                    LEFT JOIN public.escolas e ON e.id = t.escola_id
                    WHERE a.encarregado_user_id = uid
                      AND a.ativo = true
                ), '[]'::jsonb)
            );

        ELSE
            role_payload := '{}'::jsonb;
    END CASE;

    RETURN payload || role_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.get_auth_bootstrap() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_bootstrap() TO authenticated;
