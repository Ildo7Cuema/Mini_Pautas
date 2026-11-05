-- ============================================
-- Pessoal da Direção Provincial por departamento
-- + módulos Planeamento / Contratação Empresas / Projectos CTI
-- ============================================

-- 1) Extender tipo_perfil
ALTER TABLE user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_tipo_perfil_check;

ALTER TABLE user_profiles
    ADD CONSTRAINT user_profiles_tipo_perfil_check
    CHECK (tipo_perfil IN (
        'ESCOLA', 'PROFESSOR', 'SUPERADMIN', 'ALUNO', 'ENCARREGADO',
        'SECRETARIO', 'DIRECAO_MUNICIPAL', 'DIRECAO_PROVINCIAL',
        'FUNCIONARIO_PROVINCIAL'
    ));

ALTER TABLE user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_superadmin_escola_check;

ALTER TABLE user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_escola_check;

ALTER TABLE user_profiles
    ADD CONSTRAINT user_profiles_escola_check
    CHECK (
        (tipo_perfil IN ('SUPERADMIN', 'DIRECAO_MUNICIPAL', 'DIRECAO_PROVINCIAL', 'FUNCIONARIO_PROVINCIAL')
            AND escola_id IS NULL)
        OR
        (tipo_perfil NOT IN ('SUPERADMIN', 'DIRECAO_MUNICIPAL', 'DIRECAO_PROVINCIAL', 'FUNCIONARIO_PROVINCIAL')
            AND escola_id IS NOT NULL)
    );

-- 2) Tabela pessoal
CREATE TABLE IF NOT EXISTS pessoal_direcao_provincial (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    direcao_provincial_id UUID NOT NULL REFERENCES direcoes_provinciais(id) ON DELETE CASCADE,
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
    CONSTRAINT pessoal_direcao_provincial_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_pessoal_dp_direcao ON pessoal_direcao_provincial(direcao_provincial_id);
CREATE INDEX IF NOT EXISTS idx_pessoal_dp_user ON pessoal_direcao_provincial(user_id);
CREATE INDEX IF NOT EXISTS idx_pessoal_dp_email ON pessoal_direcao_provincial(email);
CREATE INDEX IF NOT EXISTS idx_pessoal_dp_departamento ON pessoal_direcao_provincial(departamento);
CREATE INDEX IF NOT EXISTS idx_pessoal_dp_ativo ON pessoal_direcao_provincial(ativo);

DROP TRIGGER IF EXISTS update_pessoal_dp_updated_at ON pessoal_direcao_provincial;
CREATE TRIGGER update_pessoal_dp_updated_at
    BEFORE UPDATE ON pessoal_direcao_provincial
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE pessoal_direcao_provincial ENABLE ROW LEVEL SECURITY;

-- 3) Helpers RLS
CREATE OR REPLACE FUNCTION is_admin_direcao_provincial()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
          AND tipo_perfil = 'DIRECAO_PROVINCIAL'
          AND ativo = true
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_funcionario_provincial()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
          AND tipo_perfil = 'FUNCIONARIO_PROVINCIAL'
          AND ativo = true
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Âmbito provincial (admin OU funcionário) — usado pelas policies existentes
CREATE OR REPLACE FUNCTION is_direcao_provincial()
RETURNS BOOLEAN AS $$
DECLARE
    cached_result BOOLEAN;
BEGIN
    SELECT is_direcao_provincial INTO cached_result
    FROM role_cache
    WHERE user_id = auth.uid();

    IF cached_result IS TRUE THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid()
          AND tipo_perfil IN ('DIRECAO_PROVINCIAL', 'FUNCIONARIO_PROVINCIAL')
          AND ativo = true
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- STABLE: não pode fazer UPDATE (Postgres 0A000 em policies RLS)
CREATE OR REPLACE FUNCTION get_direcao_provincia()
RETURNS TEXT AS $$
DECLARE
    result_provincia TEXT;
BEGIN
    SELECT provincia INTO result_provincia
    FROM role_cache
    WHERE user_id = auth.uid()
      AND is_direcao_provincial = true
      AND provincia IS NOT NULL;

    IF result_provincia IS NULL THEN
        SELECT dp.provincia INTO result_provincia
        FROM direcoes_provinciais dp
        WHERE dp.user_id = auth.uid()
          AND dp.ativo = true;
    END IF;

    IF result_provincia IS NULL THEN
        SELECT dp.provincia INTO result_provincia
        FROM pessoal_direcao_provincial p
        JOIN direcoes_provinciais dp ON dp.id = p.direcao_provincial_id
        WHERE p.user_id = auth.uid()
          AND p.ativo = true
          AND dp.ativo = true;
    END IF;

    RETURN result_provincia;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_direcao_provincial_id()
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    SELECT dp.id INTO v_id
    FROM direcoes_provinciais dp
    WHERE dp.user_id = auth.uid()
      AND dp.ativo = true;

    IF v_id IS NULL THEN
        SELECT p.direcao_provincial_id INTO v_id
        FROM pessoal_direcao_provincial p
        WHERE p.user_id = auth.uid()
          AND p.ativo = true;
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_funcionario_provincial_departamento()
RETURNS TEXT AS $$
DECLARE
    v_dep TEXT;
BEGIN
    SELECT departamento INTO v_dep
    FROM pessoal_direcao_provincial
    WHERE user_id = auth.uid()
      AND ativo = true
    LIMIT 1;
    RETURN v_dep;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_admin_direcao_provincial() TO authenticated;
GRANT EXECUTE ON FUNCTION is_funcionario_provincial() TO authenticated;
GRANT EXECUTE ON FUNCTION is_direcao_provincial() TO authenticated;
GRANT EXECUTE ON FUNCTION get_direcao_provincia() TO authenticated;
GRANT EXECUTE ON FUNCTION get_direcao_provincial_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_funcionario_provincial_departamento() TO authenticated;

-- 4) Policies pessoal
DROP POLICY IF EXISTS "Admin DP manage pessoal" ON pessoal_direcao_provincial;
CREATE POLICY "Admin DP manage pessoal"
    ON pessoal_direcao_provincial
    FOR ALL
    USING (
        is_admin_direcao_provincial()
        AND direcao_provincial_id = get_direcao_provincial_id()
    )
    WITH CHECK (
        is_admin_direcao_provincial()
        AND direcao_provincial_id = get_direcao_provincial_id()
    );

DROP POLICY IF EXISTS "Funcionario DP read own" ON pessoal_direcao_provincial;
CREATE POLICY "Funcionario DP read own"
    ON pessoal_direcao_provincial
    FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Funcionario RH read pessoal same DP" ON pessoal_direcao_provincial;
CREATE POLICY "Funcionario RH read pessoal same DP"
    ON pessoal_direcao_provincial
    FOR SELECT
    USING (
        is_funcionario_provincial()
        AND get_funcionario_provincial_departamento() = 'PLANEAMENTO_RH'
        AND direcao_provincial_id = get_direcao_provincial_id()
    );

DROP POLICY IF EXISTS "SUPERADMIN pessoal DP" ON pessoal_direcao_provincial;
CREATE POLICY "SUPERADMIN pessoal DP"
    ON pessoal_direcao_provincial
    FOR ALL
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

GRANT SELECT, INSERT, UPDATE, DELETE ON pessoal_direcao_provincial TO authenticated;

-- 5) Registo de conta
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
        updated_at = NOW();

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

CREATE OR REPLACE FUNCTION lookup_funcionario_dp_invite_departamento(p_email TEXT)
RETURNS TEXT AS $$
DECLARE
    v_dep TEXT;
BEGIN
    SELECT departamento INTO v_dep
    FROM pessoal_direcao_provincial
    WHERE lower(email) = lower(p_email)
      AND ativo = true
    LIMIT 1;
    RETURN v_dep;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION lookup_funcionario_dp_invite_departamento(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION lookup_funcionario_dp_invite_departamento(TEXT) TO authenticated;

-- 6) Módulos operacionais (Fase 2)
CREATE TABLE IF NOT EXISTS planos_provinciais (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    direcao_provincial_id UUID NOT NULL REFERENCES direcoes_provinciais(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descricao TEXT,
    periodo TEXT,
    objectivos TEXT,
    metas TEXT,
    responsavel TEXT,
    estado TEXT NOT NULL DEFAULT 'rascunho'
        CHECK (estado IN ('rascunho', 'em_curso', 'concluido', 'suspenso')),
    data_inicio DATE,
    data_fim DATE,
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planos_prov_dp ON planos_provinciais(direcao_provincial_id);

CREATE TABLE IF NOT EXISTS contratacoes_empresas_provinciais (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    direcao_provincial_id UUID NOT NULL REFERENCES direcoes_provinciais(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    empresa TEXT,
    objecto TEXT,
    valor_estimado NUMERIC(14, 2),
    responsavel TEXT,
    estado TEXT NOT NULL DEFAULT 'rascunho'
        CHECK (estado IN ('rascunho', 'em_curso', 'concluido', 'suspenso')),
    data_inicio DATE,
    data_fim DATE,
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contratacoes_prov_dp ON contratacoes_empresas_provinciais(direcao_provincial_id);

CREATE TABLE IF NOT EXISTS projectos_provinciais (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    direcao_provincial_id UUID NOT NULL REFERENCES direcoes_provinciais(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descricao TEXT,
    area TEXT NOT NULL DEFAULT 'ciencia'
        CHECK (area IN ('ciencia', 'tecnologia', 'inovacao', 'investigacao')),
    responsavel TEXT,
    estado TEXT NOT NULL DEFAULT 'rascunho'
        CHECK (estado IN ('rascunho', 'em_curso', 'concluido', 'suspenso')),
    data_inicio DATE,
    data_fim DATE,
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projectos_prov_dp ON projectos_provinciais(direcao_provincial_id);

DROP TRIGGER IF EXISTS update_planos_prov_updated_at ON planos_provinciais;
CREATE TRIGGER update_planos_prov_updated_at
    BEFORE UPDATE ON planos_provinciais
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contratacoes_prov_updated_at ON contratacoes_empresas_provinciais;
CREATE TRIGGER update_contratacoes_prov_updated_at
    BEFORE UPDATE ON contratacoes_empresas_provinciais
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projectos_prov_updated_at ON projectos_provinciais;
CREATE TRIGGER update_projectos_prov_updated_at
    BEFORE UPDATE ON projectos_provinciais
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE planos_provinciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratacoes_empresas_provinciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE projectos_provinciais ENABLE ROW LEVEL SECURITY;

-- Admin DP: full CRUD on all three
DROP POLICY IF EXISTS "Admin DP planos" ON planos_provinciais;
CREATE POLICY "Admin DP planos" ON planos_provinciais FOR ALL
    USING (is_admin_direcao_provincial() AND direcao_provincial_id = get_direcao_provincial_id())
    WITH CHECK (is_admin_direcao_provincial() AND direcao_provincial_id = get_direcao_provincial_id());

DROP POLICY IF EXISTS "RH planos" ON planos_provinciais;
CREATE POLICY "RH planos" ON planos_provinciais FOR ALL
    USING (
        is_funcionario_provincial()
        AND get_funcionario_provincial_departamento() = 'PLANEAMENTO_RH'
        AND direcao_provincial_id = get_direcao_provincial_id()
    )
    WITH CHECK (
        is_funcionario_provincial()
        AND get_funcionario_provincial_departamento() = 'PLANEAMENTO_RH'
        AND direcao_provincial_id = get_direcao_provincial_id()
    );

DROP POLICY IF EXISTS "Admin DP contratacoes" ON contratacoes_empresas_provinciais;
CREATE POLICY "Admin DP contratacoes" ON contratacoes_empresas_provinciais FOR ALL
    USING (is_admin_direcao_provincial() AND direcao_provincial_id = get_direcao_provincial_id())
    WITH CHECK (is_admin_direcao_provincial() AND direcao_provincial_id = get_direcao_provincial_id());

DROP POLICY IF EXISTS "RH contratacoes" ON contratacoes_empresas_provinciais;
CREATE POLICY "RH contratacoes" ON contratacoes_empresas_provinciais FOR ALL
    USING (
        is_funcionario_provincial()
        AND get_funcionario_provincial_departamento() = 'PLANEAMENTO_RH'
        AND direcao_provincial_id = get_direcao_provincial_id()
    )
    WITH CHECK (
        is_funcionario_provincial()
        AND get_funcionario_provincial_departamento() = 'PLANEAMENTO_RH'
        AND direcao_provincial_id = get_direcao_provincial_id()
    );

DROP POLICY IF EXISTS "Admin DP projectos" ON projectos_provinciais;
CREATE POLICY "Admin DP projectos" ON projectos_provinciais FOR ALL
    USING (is_admin_direcao_provincial() AND direcao_provincial_id = get_direcao_provincial_id())
    WITH CHECK (is_admin_direcao_provincial() AND direcao_provincial_id = get_direcao_provincial_id());

DROP POLICY IF EXISTS "CTI projectos" ON projectos_provinciais;
CREATE POLICY "CTI projectos" ON projectos_provinciais FOR ALL
    USING (
        is_funcionario_provincial()
        AND get_funcionario_provincial_departamento() = 'CIENCIA_TECNOLOGIA'
        AND direcao_provincial_id = get_direcao_provincial_id()
    )
    WITH CHECK (
        is_funcionario_provincial()
        AND get_funcionario_provincial_departamento() = 'CIENCIA_TECNOLOGIA'
        AND direcao_provincial_id = get_direcao_provincial_id()
    );

DROP POLICY IF EXISTS "SUPERADMIN planos" ON planos_provinciais;
CREATE POLICY "SUPERADMIN planos" ON planos_provinciais FOR ALL
    USING (is_superadmin()) WITH CHECK (is_superadmin());

DROP POLICY IF EXISTS "SUPERADMIN contratacoes" ON contratacoes_empresas_provinciais;
CREATE POLICY "SUPERADMIN contratacoes" ON contratacoes_empresas_provinciais FOR ALL
    USING (is_superadmin()) WITH CHECK (is_superadmin());

DROP POLICY IF EXISTS "SUPERADMIN projectos" ON projectos_provinciais;
CREATE POLICY "SUPERADMIN projectos" ON projectos_provinciais FOR ALL
    USING (is_superadmin()) WITH CHECK (is_superadmin());

GRANT SELECT, INSERT, UPDATE, DELETE ON planos_provinciais TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON contratacoes_empresas_provinciais TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON projectos_provinciais TO authenticated;

COMMENT ON TABLE pessoal_direcao_provincial IS 'Pessoal do Gabinete Provincial da Educação por departamento';
COMMENT ON TABLE planos_provinciais IS 'Planos de actividades do departamento Planeamento/RH';
COMMENT ON TABLE contratacoes_empresas_provinciais IS 'Acompanhamento sectorial de contratação de empresas (educação)';
COMMENT ON TABLE projectos_provinciais IS 'Projectos de Ciência, Tecnologia e Inovação';
