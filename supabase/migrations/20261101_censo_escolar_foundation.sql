-- ============================================
-- CENSO ESCOLAR — Fundação (MVP)
-- Modalidades: Primário Geral + I/II Ciclo Secundário Geral
-- ============================================

-- Extensões em alunos (dimensões do censo)
ALTER TABLE alunos
    ADD COLUMN IF NOT EXISTS tipo_deficiencia TEXT
        CHECK (
            tipo_deficiencia IS NULL OR tipo_deficiencia IN (
                'nenhuma',
                'visual',
                'auditiva',
                'fisica_motora',
                'intelectual',
                'espectro_autista',
                'sindrome_down',
                'surdo_cegueira',
                'altas_habilidades',
                'multiplas',
                'outra'
            )
        );

ALTER TABLE alunos
    ADD COLUMN IF NOT EXISTS primeira_matricula_na_classe BOOLEAN DEFAULT false;

ALTER TABLE alunos
    ADD COLUMN IF NOT EXISTS frequentou_pre_escolar BOOLEAN;

COMMENT ON COLUMN alunos.tipo_deficiencia IS 'Tipo de deficiência para Censo Escolar MED';
COMMENT ON COLUMN alunos.primeira_matricula_na_classe IS 'Matriculado pela 1ª vez na classe actual (ex.: 1ª ou 7ª/10ª)';
COMMENT ON COLUMN alunos.frequentou_pre_escolar IS 'Frequentou ensino pré-escolar antes da 1ª classe';

-- Extensões em professores (qualificação pedagógica / nacionalidade censo)
ALTER TABLE professores
    ADD COLUMN IF NOT EXISTS formacao_pedagogica BOOLEAN;

ALTER TABLE professores
    ADD COLUMN IF NOT EXISTS nacionalidade_censo TEXT
        CHECK (nacionalidade_censo IS NULL OR nacionalidade_censo IN ('nacional', 'estrangeiro'));

ALTER TABLE professores
    ADD COLUMN IF NOT EXISTS interprete_lingua_gestual BOOLEAN DEFAULT false;

ALTER TABLE professores
    ADD COLUMN IF NOT EXISTS formacao_diferenciada_sala BOOLEAN DEFAULT false;

COMMENT ON COLUMN professores.formacao_pedagogica IS 'Possui formação pedagógica (Censo Escolar)';
COMMENT ON COLUMN professores.nacionalidade_censo IS 'Nacional ou estrangeiro para agregação do censo';

-- Perfil institucional estável da escola (ficha-mãe, campos essenciais)
CREATE TABLE IF NOT EXISTS censo_escola_perfil (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escola_id UUID NOT NULL UNIQUE REFERENCES escolas(id) ON DELETE CASCADE,
    situacao_funcionamento TEXT DEFAULT 'em_funcionamento'
        CHECK (situacao_funcionamento IN ('em_funcionamento', 'paralisada', 'extinta')),
    sala_anexa BOOLEAN DEFAULT false,
    escola_principal_nome TEXT,
    escola_principal_codigo TEXT,
    ponto_referencia TEXT,
    natureza TEXT
        CHECK (natureza IS NULL OR natureza IN ('publica', 'publico_privada', 'privada')),
    decreto_criacao TEXT,
    licenca TEXT,
    comuna_distrito TEXT,
    localidade TEXT,
    zona_geografica TEXT
        CHECK (zona_geografica IS NULL OR zona_geografica IN ('urbana', 'rural')),
    modalidades_oferecidas TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_censo_escola_perfil_escola ON censo_escola_perfil(escola_id);

-- Infraestrutura / mobiliário por escola + ano + modalidade
CREATE TABLE IF NOT EXISTS censo_infraestrutura (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
    ano_lectivo TEXT NOT NULL,
    modalidade_codigo TEXT NOT NULL,
    mes_inicio SMALLINT CHECK (mes_inicio IS NULL OR (mes_inicio BETWEEN 1 AND 12)),
    mes_termino SMALLINT CHECK (mes_termino IS NULL OR (mes_termino BETWEEN 1 AND 12)),
    total_salas INTEGER DEFAULT 0,
    salas_proprias INTEGER DEFAULT 0,
    salas_emprestadas INTEGER DEFAULT 0,
    salas_arrendadas INTEGER DEFAULT 0,
    salas_proprias_bom_estado INTEGER DEFAULT 0,
    total_assentos INTEGER DEFAULT 0,
    assentos_bom_estado INTEGER DEFAULT 0,
    assentos_acessiveis INTEGER DEFAULT 0,
    total_mesas INTEGER DEFAULT 0,
    mesas_bom_estado INTEGER DEFAULT 0,
    mesas_acessiveis INTEGER DEFAULT 0,
    total_quadros INTEGER DEFAULT 0,
    quadros_bom_estado INTEGER DEFAULT 0,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_censo_infra_escola_ano_mod UNIQUE (escola_id, ano_lectivo, modalidade_codigo)
);

CREATE INDEX IF NOT EXISTS idx_censo_infra_escola_ano ON censo_infraestrutura(escola_id, ano_lectivo);

-- Snapshots gerados do questionário (auditoria / reexportação)
CREATE TABLE IF NOT EXISTS censo_questionarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
    ano_lectivo TEXT NOT NULL,
    modalidade_codigo TEXT NOT NULL,
    data_referencia_idade DATE NOT NULL,
    estado TEXT NOT NULL DEFAULT 'rascunho'
        CHECK (estado IN ('rascunho', 'gerado', 'submetido', 'recebido_dme')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    lacunas TEXT[] DEFAULT '{}'::TEXT[],
    gerado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    gerado_em TIMESTAMPTZ DEFAULT NOW(),
    submetido_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_censo_questionarios_escola_ano
    ON censo_questionarios(escola_id, ano_lectivo, modalidade_codigo);
CREATE INDEX IF NOT EXISTS idx_censo_questionarios_estado
    ON censo_questionarios(estado);

-- RLS
ALTER TABLE censo_escola_perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE censo_infraestrutura ENABLE ROW LEVEL SECURITY;
ALTER TABLE censo_questionarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "censo_perfil_select" ON censo_escola_perfil;
CREATE POLICY "censo_perfil_select" ON censo_escola_perfil FOR SELECT
    USING (user_belongs_to_escola(escola_id));

DROP POLICY IF EXISTS "censo_perfil_insert" ON censo_escola_perfil;
CREATE POLICY "censo_perfil_insert" ON censo_escola_perfil FOR INSERT
    WITH CHECK (user_belongs_to_escola(escola_id));

DROP POLICY IF EXISTS "censo_perfil_update" ON censo_escola_perfil;
CREATE POLICY "censo_perfil_update" ON censo_escola_perfil FOR UPDATE
    USING (user_belongs_to_escola(escola_id));

DROP POLICY IF EXISTS "censo_infra_select" ON censo_infraestrutura;
CREATE POLICY "censo_infra_select" ON censo_infraestrutura FOR SELECT
    USING (user_belongs_to_escola(escola_id));

DROP POLICY IF EXISTS "censo_infra_insert" ON censo_infraestrutura;
CREATE POLICY "censo_infra_insert" ON censo_infraestrutura FOR INSERT
    WITH CHECK (user_belongs_to_escola(escola_id));

DROP POLICY IF EXISTS "censo_infra_update" ON censo_infraestrutura;
CREATE POLICY "censo_infra_update" ON censo_infraestrutura FOR UPDATE
    USING (user_belongs_to_escola(escola_id));

DROP POLICY IF EXISTS "censo_infra_delete" ON censo_infraestrutura;
CREATE POLICY "censo_infra_delete" ON censo_infraestrutura FOR DELETE
    USING (user_belongs_to_escola(escola_id));

DROP POLICY IF EXISTS "censo_quest_select" ON censo_questionarios;
CREATE POLICY "censo_quest_select" ON censo_questionarios FOR SELECT
    USING (user_belongs_to_escola(escola_id));

DROP POLICY IF EXISTS "censo_quest_insert" ON censo_questionarios;
CREATE POLICY "censo_quest_insert" ON censo_questionarios FOR INSERT
    WITH CHECK (user_belongs_to_escola(escola_id));

DROP POLICY IF EXISTS "censo_quest_update" ON censo_questionarios;
CREATE POLICY "censo_quest_update" ON censo_questionarios FOR UPDATE
    USING (user_belongs_to_escola(escola_id));

-- updated_at triggers (reutiliza função existente se disponível)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        DROP TRIGGER IF EXISTS update_censo_escola_perfil_updated_at ON censo_escola_perfil;
        CREATE TRIGGER update_censo_escola_perfil_updated_at
            BEFORE UPDATE ON censo_escola_perfil
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS update_censo_infraestrutura_updated_at ON censo_infraestrutura;
        CREATE TRIGGER update_censo_infraestrutura_updated_at
            BEFORE UPDATE ON censo_infraestrutura
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS update_censo_questionarios_updated_at ON censo_questionarios;
        CREATE TRIGGER update_censo_questionarios_updated_at
            BEFORE UPDATE ON censo_questionarios
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
