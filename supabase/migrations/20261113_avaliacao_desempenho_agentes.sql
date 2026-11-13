-- ============================================
-- Avaliação de Desempenho dos Agentes de Educação
-- Decreto Presidencial n.º 28/22 (Fase 1 — Escola)
-- Instrumentos: fichas trimestrais/anuais (Anexos II–IV) + mapa geral (Art. 32.º)
-- ============================================

-- Catálogo de instrumentos (Anexos II–IV)
CREATE TABLE IF NOT EXISTS ad_instrumentos_catalogo (
    codigo TEXT PRIMARY KEY,
    anexo_ref TEXT NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ad_instrumentos_catalogo IS
    'Instrumentos oficiais DP 28/22 — Anexos II/III (docente) e IV (técnico/admin)';

INSERT INTO ad_instrumentos_catalogo (codigo, anexo_ref, nome, descricao) VALUES
    (
        'FICHA_DOCENTE',
        'Anexos II e III',
        'Ficha de avaliação — Educador de Infância / Professor',
        'Indicadores Art. 18.º n.º 1 — graduação Anexo I (5/10/15/20)'
    ),
    (
        'FICHA_TECNICO_ADMIN',
        'Anexo IV',
        'Ficha de avaliação — Técnico Pedagógico / Especialista de Administração',
        'Indicadores Art. 18.º n.º 2 — graduação Anexo I (5/10/15/20)'
    )
ON CONFLICT (codigo) DO UPDATE SET
    anexo_ref = EXCLUDED.anexo_ref,
    nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao;

-- Indicadores com coeficientes de ponderação (ajustáveis quando PDF oficial dos anexos estiver disponível)
CREATE TABLE IF NOT EXISTS ad_indicadores_catalogo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instrumento_codigo TEXT NOT NULL REFERENCES ad_instrumentos_catalogo(codigo) ON DELETE CASCADE,
    codigo TEXT NOT NULL,
    nome TEXT NOT NULL,
    coeficiente_ponderacao NUMERIC(8, 4) NOT NULL DEFAULT 1,
    ordem INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (instrumento_codigo, codigo)
);

CREATE INDEX IF NOT EXISTS idx_ad_indicadores_instrumento
    ON ad_indicadores_catalogo(instrumento_codigo);

COMMENT ON TABLE ad_indicadores_catalogo IS
    'Indicadores Art. 18.º DP 28/22. Coeficientes seedáveis — CF = Σ(graduação×coef) / Σ(coef)';

-- Seed docentes (5 indicadores — pesos relativos iniciais que somam 100)
INSERT INTO ad_indicadores_catalogo (instrumento_codigo, codigo, nome, coeficiente_ponderacao, ordem)
VALUES
    ('FICHA_DOCENTE', 'QUALIDADE_EA', 'Qualidade do processo de Ensino-Aprendizagem', 30, 1),
    ('FICHA_DOCENTE', 'PROGRESSO_ALUNO', 'Progresso do aluno ou desenvolvimento do aluno', 25, 2),
    ('FICHA_DOCENTE', 'RESPONSABILIDADE', 'Responsabilidade', 15, 3),
    ('FICHA_DOCENTE', 'APERFEICOAMENTO', 'Aperfeiçoamento profissional e inovação pedagógica', 15, 4),
    ('FICHA_DOCENTE', 'RELACOES_HUMANAS', 'Relações humanas', 15, 5)
ON CONFLICT (instrumento_codigo, codigo) DO UPDATE SET
    nome = EXCLUDED.nome,
    coeficiente_ponderacao = EXCLUDED.coeficiente_ponderacao,
    ordem = EXCLUDED.ordem,
    ativo = true;

-- Seed técnico/admin (10 indicadores — pesos iguais 10)
INSERT INTO ad_indicadores_catalogo (instrumento_codigo, codigo, nome, coeficiente_ponderacao, ordem)
VALUES
    ('FICHA_TECNICO_ADMIN', 'ANALISE_PROFISSIONAL', 'Capacidade de análise profissional', 10, 1),
    ('FICHA_TECNICO_ADMIN', 'INTERESSE', 'Interesse', 10, 2),
    ('FICHA_TECNICO_ADMIN', 'CONHECIMENTOS', 'Conhecimentos ligados ao trabalho', 10, 3),
    ('FICHA_TECNICO_ADMIN', 'ORGANIZACAO', 'Organização', 10, 4),
    ('FICHA_TECNICO_ADMIN', 'SIGILO', 'Sigilo profissional', 10, 5),
    ('FICHA_TECNICO_ADMIN', 'CRIATIVIDADE', 'Criatividade', 10, 6),
    ('FICHA_TECNICO_ADMIN', 'RELACIONAMENTO', 'Relacionamento interpessoal', 10, 7),
    ('FICHA_TECNICO_ADMIN', 'ATENCAO', 'Atenção', 10, 8),
    ('FICHA_TECNICO_ADMIN', 'PONTUALIDADE_ASSIDUIDADE', 'Pontualidade e assiduidade', 10, 9),
    ('FICHA_TECNICO_ADMIN', 'DISCIPLINA', 'Disciplina', 10, 10)
ON CONFLICT (instrumento_codigo, codigo) DO UPDATE SET
    nome = EXCLUDED.nome,
    coeficiente_ponderacao = EXCLUDED.coeficiente_ponderacao,
    ordem = EXCLUDED.ordem,
    ativo = true;

-- Ciclos de avaliação por escola
CREATE TABLE IF NOT EXISTS ad_ciclos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
    ano_referencia TEXT NOT NULL,
    tipo_periodo TEXT NOT NULL CHECK (tipo_periodo IN ('ANO_LECTIVO', 'ANO_CIVIL')),
    estado TEXT NOT NULL DEFAULT 'ABERTO' CHECK (estado IN ('ABERTO', 'ENCERRADO')),
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (escola_id, ano_referencia, tipo_periodo)
);

CREATE INDEX IF NOT EXISTS idx_ad_ciclos_escola ON ad_ciclos(escola_id);
CREATE INDEX IF NOT EXISTS idx_ad_ciclos_estado ON ad_ciclos(estado);

DROP TRIGGER IF EXISTS update_ad_ciclos_updated_at ON ad_ciclos;
CREATE TRIGGER update_ad_ciclos_updated_at
    BEFORE UPDATE ON ad_ciclos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE ad_ciclos IS
    'Ciclo de avaliação DP 28/22 Art. 13.º — ANO_LECTIVO (docentes) / ANO_CIVIL (técnico-admin)';

-- Avaliações individuais
CREATE TABLE IF NOT EXISTS ad_avaliacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ciclo_id UUID NOT NULL REFERENCES ad_ciclos(id) ON DELETE CASCADE,
    escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
    avaliado_tipo TEXT NOT NULL CHECK (avaliado_tipo IN ('PROFESSOR', 'FUNCIONARIO')),
    professor_id UUID REFERENCES professores(id) ON DELETE CASCADE,
    funcionario_id UUID REFERENCES funcionarios_escola(id) ON DELETE CASCADE,
    avaliador_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    instrumento_codigo TEXT NOT NULL REFERENCES ad_instrumentos_catalogo(codigo),
    periodo TEXT NOT NULL CHECK (periodo IN ('TRIM1', 'TRIM2', 'TRIM3', 'ANUAL')),
    objectivos_texto TEXT,
    observacoes TEXT,
    classificacao_final NUMERIC(5, 2),
    mencao TEXT CHECK (mencao IS NULL OR mencao IN ('MUITO_BOM', 'BOM', 'SUFICIENTE', 'MAU')),
    estado TEXT NOT NULL DEFAULT 'RASCUNHO' CHECK (estado IN (
        'RASCUNHO', 'EM_AVALIACAO', 'DIVULGADA', 'ASSINADA', 'CONCLUIDA'
    )),
    concordancia_avaliado BOOLEAN,
    assinado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT ad_avaliacoes_avaliado_xor CHECK (
        (avaliado_tipo = 'PROFESSOR' AND professor_id IS NOT NULL AND funcionario_id IS NULL)
        OR
        (avaliado_tipo = 'FUNCIONARIO' AND funcionario_id IS NOT NULL AND professor_id IS NULL)
    ),
    CONSTRAINT ad_avaliacoes_instrumento_tipo CHECK (
        (avaliado_tipo = 'PROFESSOR' AND instrumento_codigo = 'FICHA_DOCENTE')
        OR
        (avaliado_tipo = 'FUNCIONARIO' AND instrumento_codigo = 'FICHA_TECNICO_ADMIN')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ad_avaliacoes_prof_periodo
    ON ad_avaliacoes (ciclo_id, professor_id, periodo)
    WHERE professor_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ad_avaliacoes_func_periodo
    ON ad_avaliacoes (ciclo_id, funcionario_id, periodo)
    WHERE funcionario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ad_avaliacoes_escola ON ad_avaliacoes(escola_id);
CREATE INDEX IF NOT EXISTS idx_ad_avaliacoes_ciclo ON ad_avaliacoes(ciclo_id);
CREATE INDEX IF NOT EXISTS idx_ad_avaliacoes_estado ON ad_avaliacoes(estado);
CREATE INDEX IF NOT EXISTS idx_ad_avaliacoes_periodo ON ad_avaliacoes(periodo);

DROP TRIGGER IF EXISTS update_ad_avaliacoes_updated_at ON ad_avaliacoes;
CREATE TRIGGER update_ad_avaliacoes_updated_at
    BEFORE UPDATE ON ad_avaliacoes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE ad_avaliacoes IS
    'Ficha de avaliação trimestral/anual — DP 28/22 Arts. 17–26. Menção Art. 20.º';

-- Scores por indicador
CREATE TABLE IF NOT EXISTS ad_avaliacao_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    avaliacao_id UUID NOT NULL REFERENCES ad_avaliacoes(id) ON DELETE CASCADE,
    indicador_id UUID NOT NULL REFERENCES ad_indicadores_catalogo(id) ON DELETE RESTRICT,
    graduacao INTEGER NOT NULL CHECK (graduacao IN (5, 10, 15, 20)),
    valor NUMERIC(12, 4) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (avaliacao_id, indicador_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_scores_avaliacao ON ad_avaliacao_scores(avaliacao_id);

DROP TRIGGER IF EXISTS update_ad_avaliacao_scores_updated_at ON ad_avaliacao_scores;
CREATE TRIGGER update_ad_avaliacao_scores_updated_at
    BEFORE UPDATE ON ad_avaliacao_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON COLUMN ad_avaliacao_scores.graduacao IS 'Anexo I DP 28/22: 5, 10, 15 ou 20';
COMMENT ON COLUMN ad_avaliacao_scores.valor IS 'graduação × coeficiente_ponderacao do indicador';

-- ============================================
-- RLS
-- ============================================

ALTER TABLE ad_instrumentos_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_indicadores_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_ciclos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_avaliacao_scores ENABLE ROW LEVEL SECURITY;

-- Catálogos: leitura autenticada
DROP POLICY IF EXISTS "ad_instrumentos_select_auth" ON ad_instrumentos_catalogo;
CREATE POLICY "ad_instrumentos_select_auth" ON ad_instrumentos_catalogo
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ad_indicadores_select_auth" ON ad_indicadores_catalogo;
CREATE POLICY "ad_indicadores_select_auth" ON ad_indicadores_catalogo
    FOR SELECT TO authenticated USING (true);

-- Helper: escola do utilizador (ESCOLA ou SECRETARIO)
-- Ciclos
DROP POLICY IF EXISTS "ad_ciclos_select_escola" ON ad_ciclos;
CREATE POLICY "ad_ciclos_select_escola" ON ad_ciclos
    FOR SELECT TO authenticated
    USING (
        escola_id IN (
            SELECT escola_id FROM user_profiles
            WHERE user_id = auth.uid()
              AND ativo = true
              AND tipo_perfil IN ('ESCOLA', 'SECRETARIO', 'PROFESSOR')
        )
    );

DROP POLICY IF EXISTS "ad_ciclos_write_escola" ON ad_ciclos;
CREATE POLICY "ad_ciclos_write_escola" ON ad_ciclos
    FOR ALL TO authenticated
    USING (
        escola_id IN (
            SELECT escola_id FROM user_profiles
            WHERE user_id = auth.uid()
              AND ativo = true
              AND tipo_perfil IN ('ESCOLA', 'SECRETARIO')
        )
    )
    WITH CHECK (
        escola_id IN (
            SELECT escola_id FROM user_profiles
            WHERE user_id = auth.uid()
              AND ativo = true
              AND tipo_perfil IN ('ESCOLA', 'SECRETARIO')
        )
    );

-- Avaliações
DROP POLICY IF EXISTS "ad_avaliacoes_select" ON ad_avaliacoes;
CREATE POLICY "ad_avaliacoes_select" ON ad_avaliacoes
    FOR SELECT TO authenticated
    USING (
        escola_id IN (
            SELECT escola_id FROM user_profiles
            WHERE user_id = auth.uid()
              AND ativo = true
              AND tipo_perfil IN ('ESCOLA', 'SECRETARIO')
        )
        OR professor_id IN (
            SELECT id FROM professores WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "ad_avaliacoes_write" ON ad_avaliacoes;
CREATE POLICY "ad_avaliacoes_write" ON ad_avaliacoes
    FOR ALL TO authenticated
    USING (
        escola_id IN (
            SELECT escola_id FROM user_profiles
            WHERE user_id = auth.uid()
              AND ativo = true
              AND tipo_perfil IN ('ESCOLA', 'SECRETARIO')
        )
    )
    WITH CHECK (
        escola_id IN (
            SELECT escola_id FROM user_profiles
            WHERE user_id = auth.uid()
              AND ativo = true
              AND tipo_perfil IN ('ESCOLA', 'SECRETARIO')
        )
    );

-- Scores: via avaliação da mesma escola / próprio professor
DROP POLICY IF EXISTS "ad_scores_select" ON ad_avaliacao_scores;
CREATE POLICY "ad_scores_select" ON ad_avaliacao_scores
    FOR SELECT TO authenticated
    USING (
        avaliacao_id IN (
            SELECT id FROM ad_avaliacoes
            WHERE escola_id IN (
                SELECT escola_id FROM user_profiles
                WHERE user_id = auth.uid()
                  AND ativo = true
                  AND tipo_perfil IN ('ESCOLA', 'SECRETARIO')
            )
            OR professor_id IN (
                SELECT id FROM professores WHERE user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "ad_scores_write" ON ad_avaliacao_scores;
CREATE POLICY "ad_scores_write" ON ad_avaliacao_scores
    FOR ALL TO authenticated
    USING (
        avaliacao_id IN (
            SELECT id FROM ad_avaliacoes
            WHERE escola_id IN (
                SELECT escola_id FROM user_profiles
                WHERE user_id = auth.uid()
                  AND ativo = true
                  AND tipo_perfil IN ('ESCOLA', 'SECRETARIO')
            )
        )
    )
    WITH CHECK (
        avaliacao_id IN (
            SELECT id FROM ad_avaliacoes
            WHERE escola_id IN (
                SELECT escola_id FROM user_profiles
                WHERE user_id = auth.uid()
                  AND ativo = true
                  AND tipo_perfil IN ('ESCOLA', 'SECRETARIO')
            )
        )
    );
