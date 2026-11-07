-- Conselho de Notas (MED Angola)
-- Sessão por turma/ano antes da publicação da Pauta-Geral.

CREATE TABLE IF NOT EXISTS conselho_notas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
    turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    ano_lectivo TEXT NOT NULL,
    data_reuniao DATE,
    local_reuniao TEXT,
    coordenador_nome TEXT,
    secretario_nome TEXT,
    membro_2_nome TEXT,
    status TEXT NOT NULL DEFAULT 'rascunho'
        CHECK (status IN ('rascunho', 'aprovado', 'anulado')),
    parecer_geral TEXT,
    aprovado_em TIMESTAMPTZ,
    aprovado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT conselho_notas_turma_ano_unique UNIQUE (turma_id, ano_lectivo)
);

CREATE INDEX IF NOT EXISTS idx_conselho_notas_escola ON conselho_notas(escola_id);
CREATE INDEX IF NOT EXISTS idx_conselho_notas_turma ON conselho_notas(turma_id);
CREATE INDEX IF NOT EXISTS idx_conselho_notas_status ON conselho_notas(escola_id, status);

CREATE TABLE IF NOT EXISTS conselho_notas_deliberacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conselho_id UUID NOT NULL REFERENCES conselho_notas(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    situacao_sistema TEXT NOT NULL
        CHECK (situacao_sistema IN ('Transita', 'Não Transita', 'Condicional', 'AguardandoNotas')),
    situacao_deliberada TEXT NOT NULL
        CHECK (situacao_deliberada IN ('Transita', 'Não Transita', 'Condicional', 'AguardandoNotas')),
    motivo TEXT,
    is_caso_critico BOOLEAN NOT NULL DEFAULT FALSE,
    media_geral NUMERIC(5,2),
    frequencia_anual NUMERIC(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT conselho_delib_unique UNIQUE (conselho_id, aluno_id)
);

CREATE INDEX IF NOT EXISTS idx_conselho_delib_conselho ON conselho_notas_deliberacoes(conselho_id);
CREATE INDEX IF NOT EXISTS idx_conselho_delib_critico ON conselho_notas_deliberacoes(conselho_id, is_caso_critico);

ALTER TABLE conselho_notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE conselho_notas_deliberacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conselho_notas_select" ON conselho_notas;
CREATE POLICY "conselho_notas_select" ON conselho_notas FOR SELECT
    USING (user_belongs_to_escola(escola_id));

DROP POLICY IF EXISTS "conselho_notas_insert" ON conselho_notas;
CREATE POLICY "conselho_notas_insert" ON conselho_notas FOR INSERT
    WITH CHECK (user_belongs_to_escola(escola_id));

DROP POLICY IF EXISTS "conselho_notas_update" ON conselho_notas;
CREATE POLICY "conselho_notas_update" ON conselho_notas FOR UPDATE
    USING (user_belongs_to_escola(escola_id));

DROP POLICY IF EXISTS "conselho_notas_delete" ON conselho_notas;
CREATE POLICY "conselho_notas_delete" ON conselho_notas FOR DELETE
    USING (user_belongs_to_escola(escola_id));

DROP POLICY IF EXISTS "conselho_delib_select" ON conselho_notas_deliberacoes;
CREATE POLICY "conselho_delib_select" ON conselho_notas_deliberacoes FOR SELECT
    USING (
        conselho_id IN (
            SELECT id FROM conselho_notas WHERE user_belongs_to_escola(escola_id)
        )
    );

DROP POLICY IF EXISTS "conselho_delib_insert" ON conselho_notas_deliberacoes;
CREATE POLICY "conselho_delib_insert" ON conselho_notas_deliberacoes FOR INSERT
    WITH CHECK (
        conselho_id IN (
            SELECT id FROM conselho_notas WHERE user_belongs_to_escola(escola_id)
        )
    );

DROP POLICY IF EXISTS "conselho_delib_update" ON conselho_notas_deliberacoes;
CREATE POLICY "conselho_delib_update" ON conselho_notas_deliberacoes FOR UPDATE
    USING (
        conselho_id IN (
            SELECT id FROM conselho_notas WHERE user_belongs_to_escola(escola_id)
        )
    );

DROP POLICY IF EXISTS "conselho_delib_delete" ON conselho_notas_deliberacoes;
CREATE POLICY "conselho_delib_delete" ON conselho_notas_deliberacoes FOR DELETE
    USING (
        conselho_id IN (
            SELECT id FROM conselho_notas WHERE user_belongs_to_escola(escola_id)
        )
    );

-- updated_at
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        DROP TRIGGER IF EXISTS update_conselho_notas_updated_at ON conselho_notas;
        CREATE TRIGGER update_conselho_notas_updated_at
            BEFORE UPDATE ON conselho_notas
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS update_conselho_delib_updated_at ON conselho_notas_deliberacoes;
        CREATE TRIGGER update_conselho_delib_updated_at
            BEFORE UPDATE ON conselho_notas_deliberacoes
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
