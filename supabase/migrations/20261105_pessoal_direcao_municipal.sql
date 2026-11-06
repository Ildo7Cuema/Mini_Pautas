-- ============================================
-- Pessoal da Direção Municipal por secção
-- (Decreto Executivo 35/23 / Estatutos orgânicos municipais)
-- Secções: Educação e Ensino; Planeamento, Estatística e RH;
--          Inspecção/Supervisão Pedagógica; Ciências, Tecnologia e Inovação
-- ============================================

-- 1) Extender tipo_perfil (+ escola_id null para FUNCIONARIO_MUNICIPAL)
ALTER TABLE user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_tipo_perfil_check;

ALTER TABLE user_profiles
    ADD CONSTRAINT user_profiles_tipo_perfil_check
    CHECK (tipo_perfil IN (
        'ESCOLA', 'PROFESSOR', 'SUPERADMIN', 'ALUNO', 'ENCARREGADO',
        'SECRETARIO', 'DIRECAO_MUNICIPAL', 'DIRECAO_PROVINCIAL',
        'FUNCIONARIO_PROVINCIAL', 'FUNCIONARIO_MUNICIPAL'
    ));

ALTER TABLE user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_escola_check;

ALTER TABLE user_profiles
    ADD CONSTRAINT user_profiles_escola_check
    CHECK (
        (tipo_perfil IN (
            'SUPERADMIN', 'DIRECAO_MUNICIPAL', 'DIRECAO_PROVINCIAL',
            'FUNCIONARIO_PROVINCIAL', 'FUNCIONARIO_MUNICIPAL'
         ) AND escola_id IS NULL)
        OR
        (tipo_perfil NOT IN (
            'SUPERADMIN', 'DIRECAO_MUNICIPAL', 'DIRECAO_PROVINCIAL',
            'FUNCIONARIO_PROVINCIAL', 'FUNCIONARIO_MUNICIPAL'
         ) AND escola_id IS NOT NULL)
    );

-- 2) Tabela pessoal
CREATE TABLE IF NOT EXISTS pessoal_direcao_municipal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    direcao_municipal_id UUID NOT NULL REFERENCES direcoes_municipais(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    telefone TEXT,
    numero_funcionario TEXT,
    departamento TEXT NOT NULL CHECK (departamento IN (
        'EDUCACAO_ENSINO',
        'PLANEAMENTO_RH',
        'INSPECCAO_SUPERVISAO',
        'CIENCIA_TECNOLOGIA'
    )),
    cargo TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pessoal_direcao_municipal_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_pessoal_dm_direcao ON pessoal_direcao_municipal(direcao_municipal_id);
CREATE INDEX IF NOT EXISTS idx_pessoal_dm_user ON pessoal_direcao_municipal(user_id);
CREATE INDEX IF NOT EXISTS idx_pessoal_dm_email ON pessoal_direcao_municipal(email);
CREATE INDEX IF NOT EXISTS idx_pessoal_dm_departamento ON pessoal_direcao_municipal(departamento);
CREATE INDEX IF NOT EXISTS idx_pessoal_dm_ativo ON pessoal_direcao_municipal(ativo);

DROP TRIGGER IF EXISTS update_pessoal_dm_updated_at ON pessoal_direcao_municipal;
CREATE TRIGGER update_pessoal_dm_updated_at
    BEFORE UPDATE ON pessoal_direcao_municipal
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE pessoal_direcao_municipal ENABLE ROW LEVEL SECURITY;

-- 3) Helpers RLS
CREATE OR REPLACE FUNCTION is_admin_direcao_municipal()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
          AND tipo_perfil = 'DIRECAO_MUNICIPAL'
          AND ativo = true
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_funcionario_municipal()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
          AND tipo_perfil = 'FUNCIONARIO_MUNICIPAL'
          AND ativo = true
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Âmbito municipal (admin OU funcionário) — usado pelas policies existentes
CREATE OR REPLACE FUNCTION is_direcao_municipal()
RETURNS BOOLEAN AS $$
DECLARE
    cached_result BOOLEAN;
BEGIN
    SELECT is_direcao_municipal INTO cached_result
    FROM role_cache
    WHERE user_id = auth.uid();

    IF cached_result IS TRUE THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
          AND tipo_perfil IN ('DIRECAO_MUNICIPAL', 'FUNCIONARIO_MUNICIPAL')
          AND ativo = true
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_direcao_municipal_id()
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    SELECT dm.id INTO v_id
    FROM direcoes_municipais dm
    WHERE dm.user_id = auth.uid()
      AND dm.ativo = true;

    IF v_id IS NULL THEN
        SELECT p.direcao_municipal_id INTO v_id
        FROM pessoal_direcao_municipal p
        WHERE p.user_id = auth.uid()
          AND p.ativo = true;
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_direcao_municipio()
RETURNS TEXT AS $$
DECLARE
    result_municipio TEXT;
BEGIN
    SELECT municipio INTO result_municipio
    FROM role_cache
    WHERE user_id = auth.uid()
      AND is_direcao_municipal = true
      AND municipio IS NOT NULL;

    IF result_municipio IS NULL THEN
        SELECT dm.municipio INTO result_municipio
        FROM direcoes_municipais dm
        WHERE dm.user_id = auth.uid()
          AND dm.ativo = true;
    END IF;

    IF result_municipio IS NULL THEN
        SELECT dm.municipio INTO result_municipio
        FROM pessoal_direcao_municipal p
        JOIN direcoes_municipais dm ON dm.id = p.direcao_municipal_id
        WHERE p.user_id = auth.uid()
          AND p.ativo = true
          AND dm.ativo = true;
    END IF;

    RETURN result_municipio;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_funcionario_municipal_departamento()
RETURNS TEXT AS $$
DECLARE
    v_dep TEXT;
BEGIN
    SELECT departamento INTO v_dep
    FROM pessoal_direcao_municipal
    WHERE user_id = auth.uid()
      AND ativo = true
    LIMIT 1;
    RETURN v_dep;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_admin_direcao_municipal() TO authenticated;
GRANT EXECUTE ON FUNCTION is_funcionario_municipal() TO authenticated;
GRANT EXECUTE ON FUNCTION is_direcao_municipal() TO authenticated;
GRANT EXECUTE ON FUNCTION get_direcao_municipal_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_direcao_municipio() TO authenticated;
GRANT EXECUTE ON FUNCTION get_funcionario_municipal_departamento() TO authenticated;

-- 4) Policies pessoal
DROP POLICY IF EXISTS "Admin DM manage pessoal" ON pessoal_direcao_municipal;
CREATE POLICY "Admin DM manage pessoal"
    ON pessoal_direcao_municipal
    FOR ALL
    USING (
        is_admin_direcao_municipal()
        AND direcao_municipal_id = get_direcao_municipal_id()
    )
    WITH CHECK (
        is_admin_direcao_municipal()
        AND direcao_municipal_id = get_direcao_municipal_id()
    );

DROP POLICY IF EXISTS "Funcionario DM read own" ON pessoal_direcao_municipal;
CREATE POLICY "Funcionario DM read own"
    ON pessoal_direcao_municipal
    FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Funcionario RH read pessoal same DM" ON pessoal_direcao_municipal;
CREATE POLICY "Funcionario RH read pessoal same DM"
    ON pessoal_direcao_municipal
    FOR SELECT
    USING (
        is_funcionario_municipal()
        AND get_funcionario_municipal_departamento() = 'PLANEAMENTO_RH'
        AND direcao_municipal_id = get_direcao_municipal_id()
    );

DROP POLICY IF EXISTS "SUPERADMIN pessoal DM" ON pessoal_direcao_municipal;
CREATE POLICY "SUPERADMIN pessoal DM"
    ON pessoal_direcao_municipal
    FOR ALL
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

GRANT SELECT, INSERT, UPDATE, DELETE ON pessoal_direcao_municipal TO authenticated;

-- Staff pode ler a própria Direção Municipal (evita bloqueio no login)
DROP POLICY IF EXISTS "Funcionario DM read own direcao" ON direcoes_municipais;
CREATE POLICY "Funcionario DM read own direcao"
    ON direcoes_municipais
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM pessoal_direcao_municipal p
            WHERE p.direcao_municipal_id = direcoes_municipais.id
              AND p.user_id = auth.uid()
              AND p.ativo = true
        )
    );

-- 5) Registo de conta
CREATE OR REPLACE FUNCTION register_funcionario_municipal_account(
    p_email TEXT,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_pessoal RECORD;
    v_municipio TEXT;
    v_provincia TEXT;
    v_existing_tipo TEXT;
BEGIN
    SELECT * INTO v_pessoal
    FROM pessoal_direcao_municipal
    WHERE lower(email) = lower(p_email)
      AND ativo = true;

    IF v_pessoal IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Funcionário municipal não encontrado com este email'
        );
    END IF;

    SELECT tipo_perfil INTO v_existing_tipo
    FROM user_profiles
    WHERE user_id = p_user_id;

    IF v_existing_tipo IS NOT NULL
       AND v_existing_tipo <> 'FUNCIONARIO_MUNICIPAL' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format(
                'Este email já está associado ao perfil %s. Use outro email no convite.',
                v_existing_tipo
            )
        );
    END IF;

    UPDATE pessoal_direcao_municipal
    SET user_id = p_user_id,
        updated_at = NOW()
    WHERE id = v_pessoal.id;

    INSERT INTO user_profiles (user_id, tipo_perfil, escola_id, ativo)
    VALUES (p_user_id, 'FUNCIONARIO_MUNICIPAL', NULL, true)
    ON CONFLICT (user_id) DO UPDATE
    SET tipo_perfil = 'FUNCIONARIO_MUNICIPAL',
        escola_id = NULL,
        ativo = true
    WHERE user_profiles.tipo_perfil IS NULL
       OR user_profiles.tipo_perfil = 'FUNCIONARIO_MUNICIPAL';

    SELECT municipio, provincia INTO v_municipio, v_provincia
    FROM direcoes_municipais
    WHERE id = v_pessoal.direcao_municipal_id;

    INSERT INTO role_cache (
        user_id, tipo_perfil, is_direcao_municipal, municipio, provincia, ativo, updated_at
    ) VALUES (
        p_user_id, 'FUNCIONARIO_MUNICIPAL', true, v_municipio, v_provincia, true, NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        tipo_perfil = 'FUNCIONARIO_MUNICIPAL',
        is_direcao_municipal = true,
        municipio = EXCLUDED.municipio,
        provincia = EXCLUDED.provincia,
        ativo = true,
        updated_at = NOW();

    RETURN jsonb_build_object(
        'success', true,
        'pessoal_id', v_pessoal.id,
        'direcao_municipal_id', v_pessoal.direcao_municipal_id,
        'departamento', v_pessoal.departamento
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION register_funcionario_municipal_account(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION register_funcionario_municipal_account(TEXT, UUID) TO anon;

CREATE OR REPLACE FUNCTION lookup_funcionario_dm_invite_departamento(p_email TEXT)
RETURNS TEXT AS $$
DECLARE
    v_dep TEXT;
BEGIN
    SELECT departamento INTO v_dep
    FROM pessoal_direcao_municipal
    WHERE lower(email) = lower(p_email)
      AND ativo = true
    LIMIT 1;
    RETURN v_dep;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION lookup_funcionario_dm_invite_departamento(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION lookup_funcionario_dm_invite_departamento(TEXT) TO authenticated;

-- 6) Contexto de login (bypass RLS na leitura da DM)
CREATE OR REPLACE FUNCTION get_funcionario_municipal_login_context()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pessoal pessoal_direcao_municipal%ROWTYPE;
    v_dm direcoes_municipais%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
    END IF;

    SELECT * INTO v_pessoal
    FROM pessoal_direcao_municipal
    WHERE user_id = auth.uid()
      AND ativo = true
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'pessoal_not_found');
    END IF;

    SELECT * INTO v_dm
    FROM direcoes_municipais
    WHERE id = v_pessoal.direcao_municipal_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'direcao_missing');
    END IF;

    IF v_dm.ativo IS NOT TRUE THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'direcao_inactive',
            'direcao', to_jsonb(v_dm),
            'pessoal', to_jsonb(v_pessoal)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'pessoal', to_jsonb(v_pessoal),
        'direcao', to_jsonb(v_dm)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_funcionario_municipal_login_context() TO authenticated;

COMMENT ON TABLE pessoal_direcao_municipal IS
    'Pessoal da Direção Municipal da Educação por secção (Dec. Exec. 35/23 e estatutos orgânicos)';

-- 7) Bootstrap de auth — incluir FUNCIONARIO_MUNICIPAL
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

        WHEN 'FUNCIONARIO_MUNICIPAL' THEN
            role_payload := jsonb_build_object(
                'pessoalMunicipal', (
                    SELECT to_jsonb(p)
                    FROM public.pessoal_direcao_municipal p
                    WHERE p.user_id = uid
                      AND p.ativo = true
                    LIMIT 1
                ),
                'direcaoMunicipal', (
                    SELECT to_jsonb(d)
                    FROM public.direcoes_municipais d
                    JOIN public.pessoal_direcao_municipal p
                      ON p.direcao_municipal_id = d.id
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
