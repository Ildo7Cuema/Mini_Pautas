-- =============================================================================
-- Concursos Públicos: Direção Provincial define; Direção Municipal abre/gere
-- Inscrição pública (anon) apenas quando a abertura municipal está activa
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS concursos_publicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    direcao_provincial_id UUID NOT NULL REFERENCES direcoes_provinciais(id) ON DELETE CASCADE,
    provincia TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    instrucoes TEXT,
    data_inicio DATE,
    data_fim DATE,
    estado TEXT NOT NULL DEFAULT 'rascunho'
        CHECK (estado IN ('rascunho', 'publicado', 'encerrado')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_concursos_publicos_provincia ON concursos_publicos(provincia);
CREATE INDEX IF NOT EXISTS idx_concursos_publicos_estado ON concursos_publicos(estado);
CREATE INDEX IF NOT EXISTS idx_concursos_publicos_dp ON concursos_publicos(direcao_provincial_id);

CREATE TABLE IF NOT EXISTS concurso_categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concurso_id UUID NOT NULL REFERENCES concursos_publicos(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT,
    idade_min INTEGER,
    idade_max INTEGER,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_concurso_categorias_concurso ON concurso_categorias(concurso_id);

CREATE TABLE IF NOT EXISTS concurso_requisitos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concurso_id UUID NOT NULL REFERENCES concursos_publicos(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('campo', 'documento')),
    codigo TEXT NOT NULL,
    label TEXT NOT NULL,
    descricao TEXT,
    obrigatorio BOOLEAN NOT NULL DEFAULT true,
    -- campo
    tipo_campo TEXT CHECK (tipo_campo IS NULL OR tipo_campo IN ('texto', 'numero', 'data', 'select', 'textarea', 'email', 'telefone')),
    opcoes JSONB DEFAULT '[]'::jsonb,
    -- documento
    permite_upload BOOLEAN NOT NULL DEFAULT false,
    tipos_ficheiro TEXT[] DEFAULT ARRAY['pdf', 'jpg', 'jpeg', 'png'],
    tamanho_max_mb NUMERIC(5,2) DEFAULT 5,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (concurso_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_concurso_requisitos_concurso ON concurso_requisitos(concurso_id);

CREATE TABLE IF NOT EXISTS concurso_aberturas_municipais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concurso_id UUID NOT NULL REFERENCES concursos_publicos(id) ON DELETE CASCADE,
    direcao_municipal_id UUID NOT NULL REFERENCES direcoes_municipais(id) ON DELETE CASCADE,
    municipio TEXT NOT NULL,
    provincia TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    estado TEXT NOT NULL DEFAULT 'fechado'
        CHECK (estado IN ('fechado', 'aberto', 'encerrado')),
    data_abertura TIMESTAMPTZ,
    data_fecho TIMESTAMPTZ,
    -- Cabeçalho PDF configurado pela DM
    cabecalho JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (concurso_id, direcao_municipal_id)
);

CREATE INDEX IF NOT EXISTS idx_concurso_aberturas_dm ON concurso_aberturas_municipais(direcao_municipal_id);
CREATE INDEX IF NOT EXISTS idx_concurso_aberturas_estado ON concurso_aberturas_municipais(estado);
CREATE INDEX IF NOT EXISTS idx_concurso_aberturas_slug ON concurso_aberturas_municipais(slug);

CREATE TABLE IF NOT EXISTS concurso_inscricoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    abertura_id UUID NOT NULL REFERENCES concurso_aberturas_municipais(id) ON DELETE CASCADE,
    concurso_id UUID NOT NULL REFERENCES concursos_publicos(id) ON DELETE CASCADE,
    direcao_municipal_id UUID NOT NULL REFERENCES direcoes_municipais(id) ON DELETE CASCADE,
    categoria_id UUID REFERENCES concurso_categorias(id) ON DELETE SET NULL,
    nome_completo TEXT NOT NULL,
    data_nascimento DATE NOT NULL,
    idade INTEGER,
    genero TEXT CHECK (genero IS NULL OR genero IN ('M', 'F', 'OUTRO')),
    municipio TEXT NOT NULL,
    bilhete_identidade TEXT,
    telefone TEXT,
    email TEXT,
    campos_extra JSONB NOT NULL DEFAULT '{}'::jsonb,
    estado TEXT NOT NULL DEFAULT 'recebida'
        CHECK (estado IN ('recebida', 'em_analise', 'aceite', 'rejeitada', 'cancelada')),
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_concurso_inscricoes_abertura ON concurso_inscricoes(abertura_id);
CREATE INDEX IF NOT EXISTS idx_concurso_inscricoes_dm ON concurso_inscricoes(direcao_municipal_id);
CREATE INDEX IF NOT EXISTS idx_concurso_inscricoes_categoria ON concurso_inscricoes(categoria_id);
CREATE INDEX IF NOT EXISTS idx_concurso_inscricoes_municipio ON concurso_inscricoes(municipio);
CREATE INDEX IF NOT EXISTS idx_concurso_inscricoes_nome ON concurso_inscricoes(nome_completo);

CREATE TABLE IF NOT EXISTS concurso_inscricao_documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inscricao_id UUID NOT NULL REFERENCES concurso_inscricoes(id) ON DELETE CASCADE,
    requisito_id UUID NOT NULL REFERENCES concurso_requisitos(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT,
    tamanho_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (inscricao_id, requisito_id)
);

CREATE INDEX IF NOT EXISTS idx_concurso_inscricao_docs ON concurso_inscricao_documentos(inscricao_id);

-- ---------------------------------------------------------------------------
-- UPDATED_AT triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at_concursos()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_concursos_publicos_updated ON concursos_publicos;
CREATE TRIGGER trg_concursos_publicos_updated
    BEFORE UPDATE ON concursos_publicos
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_concursos();

DROP TRIGGER IF EXISTS trg_concurso_aberturas_updated ON concurso_aberturas_municipais;
CREATE TRIGGER trg_concurso_aberturas_updated
    BEFORE UPDATE ON concurso_aberturas_municipais
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_concursos();

DROP TRIGGER IF EXISTS trg_concurso_inscricoes_updated ON concurso_inscricoes;
CREATE TRIGGER trg_concurso_inscricoes_updated
    BEFORE UPDATE ON concurso_inscricoes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_concursos();

-- ---------------------------------------------------------------------------
-- HELPERS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_direcao_municipal_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    SELECT id INTO v_id
    FROM direcoes_municipais
    WHERE user_id = auth.uid()
      AND ativo = true
    LIMIT 1;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_direcao_provincial_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    SELECT id INTO v_id
    FROM direcoes_provinciais
    WHERE user_id = auth.uid()
      AND ativo = true
    LIMIT 1;
    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_direcao_municipal_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_direcao_provincial_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- PUBLIC RPCs (anon)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_concurso_publico_por_slug(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_abertura concurso_aberturas_municipais%ROWTYPE;
    v_concurso concursos_publicos%ROWTYPE;
    v_categorias JSONB;
    v_requisitos JSONB;
BEGIN
    SELECT * INTO v_abertura
    FROM concurso_aberturas_municipais
    WHERE slug = p_slug;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Concurso não encontrado');
    END IF;

    IF v_abertura.estado <> 'aberto' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Não há concurso aberto neste momento', 'estado', v_abertura.estado);
    END IF;

    SELECT * INTO v_concurso FROM concursos_publicos WHERE id = v_abertura.concurso_id;

    IF NOT FOUND OR v_concurso.estado <> 'publicado' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Concurso indisponível');
    END IF;

    -- Date window (abertura municipal overrides if set; else provincial)
    IF v_abertura.data_abertura IS NOT NULL AND NOW() < v_abertura.data_abertura THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Inscrições ainda não iniciaram');
    END IF;
    IF v_abertura.data_fecho IS NOT NULL AND NOW() > v_abertura.data_fecho THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Prazo de inscrição encerrado');
    END IF;
    IF v_concurso.data_inicio IS NOT NULL AND CURRENT_DATE < v_concurso.data_inicio THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Inscrições ainda não iniciaram');
    END IF;
    IF v_concurso.data_fim IS NOT NULL AND CURRENT_DATE > v_concurso.data_fim THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Prazo de inscrição encerrado');
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.ordem, c.nome), '[]'::jsonb)
    INTO v_categorias
    FROM concurso_categorias c
    WHERE c.concurso_id = v_concurso.id;

    SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.ordem, r.label), '[]'::jsonb)
    INTO v_requisitos
    FROM concurso_requisitos r
    WHERE r.concurso_id = v_concurso.id;

    RETURN jsonb_build_object(
        'ok', true,
        'abertura', jsonb_build_object(
            'id', v_abertura.id,
            'slug', v_abertura.slug,
            'municipio', v_abertura.municipio,
            'provincia', v_abertura.provincia,
            'data_abertura', v_abertura.data_abertura,
            'data_fecho', v_abertura.data_fecho
        ),
        'concurso', jsonb_build_object(
            'id', v_concurso.id,
            'titulo', v_concurso.titulo,
            'descricao', v_concurso.descricao,
            'instrucoes', v_concurso.instrucoes,
            'data_inicio', v_concurso.data_inicio,
            'data_fim', v_concurso.data_fim,
            'provincia', v_concurso.provincia
        ),
        'categorias', v_categorias,
        'requisitos', v_requisitos
    );
END;
$$;

CREATE OR REPLACE FUNCTION submeter_inscricao_concurso(
    p_slug TEXT,
    p_categoria_id UUID,
    p_nome_completo TEXT,
    p_data_nascimento DATE,
    p_genero TEXT DEFAULT NULL,
    p_bilhete_identidade TEXT DEFAULT NULL,
    p_telefone TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_municipio TEXT DEFAULT NULL,
    p_campos_extra JSONB DEFAULT '{}'::jsonb,
    p_documentos JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_abertura concurso_aberturas_municipais%ROWTYPE;
    v_concurso concursos_publicos%ROWTYPE;
    v_idade INTEGER;
    v_inscricao_id UUID;
    v_req RECORD;
    v_doc JSONB;
    v_found BOOLEAN;
BEGIN
    SELECT * INTO v_abertura FROM concurso_aberturas_municipais WHERE slug = p_slug;
    IF NOT FOUND OR v_abertura.estado <> 'aberto' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Inscrições não estão abertas');
    END IF;

    SELECT * INTO v_concurso FROM concursos_publicos WHERE id = v_abertura.concurso_id;
    IF NOT FOUND OR v_concurso.estado <> 'publicado' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Concurso indisponível');
    END IF;

    IF v_abertura.data_abertura IS NOT NULL AND NOW() < v_abertura.data_abertura THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Inscrições ainda não iniciaram');
    END IF;
    IF v_abertura.data_fecho IS NOT NULL AND NOW() > v_abertura.data_fecho THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Prazo de inscrição encerrado');
    END IF;

    IF p_nome_completo IS NULL OR length(trim(p_nome_completo)) < 3 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Nome completo é obrigatório');
    END IF;
    IF p_data_nascimento IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Data de nascimento é obrigatória');
    END IF;

    IF p_categoria_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM concurso_categorias
        WHERE id = p_categoria_id AND concurso_id = v_concurso.id
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Categoria inválida');
    END IF;

    v_idade := EXTRACT(YEAR FROM age(CURRENT_DATE, p_data_nascimento))::INTEGER;

    -- Validate required field requisitos
    FOR v_req IN
        SELECT * FROM concurso_requisitos
        WHERE concurso_id = v_concurso.id AND tipo = 'campo' AND obrigatorio = true
    LOOP
        IF p_campos_extra IS NULL
           OR p_campos_extra->>v_req.codigo IS NULL
           OR length(trim(COALESCE(p_campos_extra->>v_req.codigo, ''))) = 0 THEN
            RETURN jsonb_build_object('ok', false, 'error', format('Campo obrigatório em falta: %s', v_req.label));
        END IF;
    END LOOP;

    -- Validate required document requisitos
    FOR v_req IN
        SELECT * FROM concurso_requisitos
        WHERE concurso_id = v_concurso.id AND tipo = 'documento' AND obrigatorio = true
    LOOP
        v_found := false;
        IF p_documentos IS NOT NULL AND jsonb_typeof(p_documentos) = 'array' THEN
            FOR v_doc IN SELECT * FROM jsonb_array_elements(p_documentos)
            LOOP
                IF (v_doc->>'requisito_id')::UUID = v_req.id
                   AND COALESCE(v_doc->>'file_url', '') <> '' THEN
                    v_found := true;
                    EXIT;
                END IF;
            END LOOP;
        END IF;
        IF NOT v_found THEN
            RETURN jsonb_build_object('ok', false, 'error', format('Documento obrigatório em falta: %s', v_req.label));
        END IF;
    END LOOP;

    INSERT INTO concurso_inscricoes (
        abertura_id, concurso_id, direcao_municipal_id, categoria_id,
        nome_completo, data_nascimento, idade, genero, municipio,
        bilhete_identidade, telefone, email, campos_extra, estado
    ) VALUES (
        v_abertura.id, v_concurso.id, v_abertura.direcao_municipal_id, p_categoria_id,
        trim(p_nome_completo), p_data_nascimento, v_idade,
        NULLIF(upper(trim(COALESCE(p_genero, ''))), ''),
        COALESCE(NULLIF(trim(p_municipio), ''), v_abertura.municipio),
        NULLIF(trim(p_bilhete_identidade), ''),
        NULLIF(trim(p_telefone), ''),
        NULLIF(trim(p_email), ''),
        COALESCE(p_campos_extra, '{}'::jsonb),
        'recebida'
    )
    RETURNING id INTO v_inscricao_id;

    IF p_documentos IS NOT NULL AND jsonb_typeof(p_documentos) = 'array' THEN
        FOR v_doc IN SELECT * FROM jsonb_array_elements(p_documentos)
        LOOP
            IF COALESCE(v_doc->>'file_url', '') = '' OR v_doc->>'requisito_id' IS NULL THEN
                CONTINUE;
            END IF;
            -- Ensure requisito belongs to this concurso
            IF NOT EXISTS (
                SELECT 1 FROM concurso_requisitos
                WHERE id = (v_doc->>'requisito_id')::UUID
                  AND concurso_id = v_concurso.id
                  AND tipo = 'documento'
            ) THEN
                CONTINUE;
            END IF;

            INSERT INTO concurso_inscricao_documentos (
                inscricao_id, requisito_id, file_url, filename, mime_type, tamanho_bytes
            ) VALUES (
                v_inscricao_id,
                (v_doc->>'requisito_id')::UUID,
                v_doc->>'file_url',
                COALESCE(v_doc->>'filename', 'documento'),
                v_doc->>'mime_type',
                NULLIF(v_doc->>'tamanho_bytes', '')::BIGINT
            )
            ON CONFLICT (inscricao_id, requisito_id) DO UPDATE
            SET file_url = EXCLUDED.file_url,
                filename = EXCLUDED.filename,
                mime_type = EXCLUDED.mime_type,
                tamanho_bytes = EXCLUDED.tamanho_bytes;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'inscricao_id', v_inscricao_id,
        'idade', v_idade,
        'message', 'Inscrição submetida com sucesso'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_concurso_publico_por_slug(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION submeter_inscricao_concurso(TEXT, UUID, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE concursos_publicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE concurso_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE concurso_requisitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE concurso_aberturas_municipais ENABLE ROW LEVEL SECURITY;
ALTER TABLE concurso_inscricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE concurso_inscricao_documentos ENABLE ROW LEVEL SECURITY;

-- concursos_publicos
DROP POLICY IF EXISTS "DP manage own province concursos" ON concursos_publicos;
CREATE POLICY "DP manage own province concursos"
    ON concursos_publicos FOR ALL
    TO authenticated
    USING (
        is_direcao_provincial()
        AND provincia = get_direcao_provincia()
    )
    WITH CHECK (
        is_direcao_provincial()
        AND provincia = get_direcao_provincia()
        AND direcao_provincial_id = get_direcao_provincial_id()
    );

DROP POLICY IF EXISTS "DM view published concursos in province" ON concursos_publicos;
CREATE POLICY "DM view published concursos in province"
    ON concursos_publicos FOR SELECT
    TO authenticated
    USING (
        is_direcao_municipal()
        AND estado = 'publicado'
        AND provincia = (
            SELECT provincia FROM direcoes_municipais
            WHERE id = get_direcao_municipal_id()
        )
    );

DROP POLICY IF EXISTS "SUPERADMIN all concursos" ON concursos_publicos;
CREATE POLICY "SUPERADMIN all concursos"
    ON concursos_publicos FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- categorias / requisitos: via concurso ownership
DROP POLICY IF EXISTS "DP manage categorias" ON concurso_categorias;
CREATE POLICY "DP manage categorias"
    ON concurso_categorias FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM concursos_publicos c
            WHERE c.id = concurso_id
              AND is_direcao_provincial()
              AND c.provincia = get_direcao_provincia()
        )
        OR is_superadmin()
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM concursos_publicos c
            WHERE c.id = concurso_id
              AND is_direcao_provincial()
              AND c.provincia = get_direcao_provincia()
              AND c.direcao_provincial_id = get_direcao_provincial_id()
        )
        OR is_superadmin()
    );

DROP POLICY IF EXISTS "DM view categorias published" ON concurso_categorias;
CREATE POLICY "DM view categorias published"
    ON concurso_categorias FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM concursos_publicos c
            WHERE c.id = concurso_id
              AND c.estado = 'publicado'
              AND is_direcao_municipal()
              AND c.provincia = (SELECT provincia FROM direcoes_municipais WHERE id = get_direcao_municipal_id())
        )
    );

DROP POLICY IF EXISTS "DP manage requisitos" ON concurso_requisitos;
CREATE POLICY "DP manage requisitos"
    ON concurso_requisitos FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM concursos_publicos c
            WHERE c.id = concurso_id
              AND is_direcao_provincial()
              AND c.provincia = get_direcao_provincia()
        )
        OR is_superadmin()
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM concursos_publicos c
            WHERE c.id = concurso_id
              AND is_direcao_provincial()
              AND c.provincia = get_direcao_provincia()
              AND c.direcao_provincial_id = get_direcao_provincial_id()
        )
        OR is_superadmin()
    );

DROP POLICY IF EXISTS "DM view requisitos published" ON concurso_requisitos;
CREATE POLICY "DM view requisitos published"
    ON concurso_requisitos FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM concursos_publicos c
            WHERE c.id = concurso_id
              AND c.estado = 'publicado'
              AND is_direcao_municipal()
              AND c.provincia = (SELECT provincia FROM direcoes_municipais WHERE id = get_direcao_municipal_id())
        )
    );

-- aberturas municipais
DROP POLICY IF EXISTS "DM manage own aberturas" ON concurso_aberturas_municipais;
CREATE POLICY "DM manage own aberturas"
    ON concurso_aberturas_municipais FOR ALL
    TO authenticated
    USING (
        is_direcao_municipal()
        AND direcao_municipal_id = get_direcao_municipal_id()
    )
    WITH CHECK (
        is_direcao_municipal()
        AND direcao_municipal_id = get_direcao_municipal_id()
    );

DROP POLICY IF EXISTS "DP view aberturas in province" ON concurso_aberturas_municipais;
CREATE POLICY "DP view aberturas in province"
    ON concurso_aberturas_municipais FOR SELECT
    TO authenticated
    USING (
        is_direcao_provincial()
        AND provincia = get_direcao_provincia()
    );

DROP POLICY IF EXISTS "SUPERADMIN aberturas" ON concurso_aberturas_municipais;
CREATE POLICY "SUPERADMIN aberturas"
    ON concurso_aberturas_municipais FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- inscricoes: DM only own institution
DROP POLICY IF EXISTS "DM manage own inscricoes" ON concurso_inscricoes;
CREATE POLICY "DM manage own inscricoes"
    ON concurso_inscricoes FOR ALL
    TO authenticated
    USING (
        is_direcao_municipal()
        AND direcao_municipal_id = get_direcao_municipal_id()
    )
    WITH CHECK (
        is_direcao_municipal()
        AND direcao_municipal_id = get_direcao_municipal_id()
    );

DROP POLICY IF EXISTS "DP view inscricoes province" ON concurso_inscricoes;
CREATE POLICY "DP view inscricoes province"
    ON concurso_inscricoes FOR SELECT
    TO authenticated
    USING (
        is_direcao_provincial()
        AND EXISTS (
            SELECT 1 FROM concursos_publicos c
            WHERE c.id = concurso_id AND c.provincia = get_direcao_provincia()
        )
    );

DROP POLICY IF EXISTS "SUPERADMIN inscricoes" ON concurso_inscricoes;
CREATE POLICY "SUPERADMIN inscricoes"
    ON concurso_inscricoes FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- documentos
DROP POLICY IF EXISTS "DM manage docs own inscricoes" ON concurso_inscricao_documentos;
CREATE POLICY "DM manage docs own inscricoes"
    ON concurso_inscricao_documentos FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM concurso_inscricoes i
            WHERE i.id = inscricao_id
              AND is_direcao_municipal()
              AND i.direcao_municipal_id = get_direcao_municipal_id()
        )
        OR is_superadmin()
        OR (
            is_direcao_provincial()
            AND EXISTS (
                SELECT 1 FROM concurso_inscricoes i
                JOIN concursos_publicos c ON c.id = i.concurso_id
                WHERE i.id = inscricao_id AND c.provincia = get_direcao_provincia()
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM concurso_inscricoes i
            WHERE i.id = inscricao_id
              AND is_direcao_municipal()
              AND i.direcao_municipal_id = get_direcao_municipal_id()
        )
        OR is_superadmin()
    );

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON concursos_publicos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON concurso_categorias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON concurso_requisitos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON concurso_aberturas_municipais TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON concurso_inscricoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON concurso_inscricao_documentos TO authenticated;

-- ---------------------------------------------------------------------------
-- STORAGE
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('concursos-documentos', 'concursos-documentos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anon can upload concurso docs" ON storage.objects;
CREATE POLICY "Anon can upload concurso docs"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'concursos-documentos');

DROP POLICY IF EXISTS "Public can view concurso docs" ON storage.objects;
CREATE POLICY "Public can view concurso docs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'concursos-documentos');

DROP POLICY IF EXISTS "Auth can delete own concurso docs" ON storage.objects;
CREATE POLICY "Auth can delete own concurso docs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'concursos-documentos');

COMMENT ON TABLE concursos_publicos IS 'Concursos públicos definidos pela Direção Provincial';
COMMENT ON TABLE concurso_aberturas_municipais IS 'Abertura local do concurso pela Direção Municipal (inscrições públicas)';
COMMENT ON TABLE concurso_inscricoes IS 'Inscrições públicas geridas pela Direção Municipal da instituição';
