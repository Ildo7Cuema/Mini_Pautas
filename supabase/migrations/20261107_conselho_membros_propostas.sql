-- Conselho de Notas: membros com convite (prazo configurável) + propostas de nota
-- Aplicação das propostas apenas na aprovação (RPC).

-- ---------------------------------------------------------------------------
-- Membros
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conselho_notas_membros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conselho_id UUID NOT NULL REFERENCES conselho_notas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    papel TEXT NOT NULL CHECK (papel IN ('coordenador', 'secretario', 'membro')),
    status TEXT NOT NULL DEFAULT 'pendente'
        CHECK (status IN ('pendente', 'aceite', 'expirado', 'revogado')),
    token UUID NOT NULL DEFAULT gen_random_uuid(),
    prazo_dias INTEGER NOT NULL CHECK (prazo_dias >= 1),
    expires_at TIMESTAMPTZ NOT NULL,
    convidado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    convidado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aceite_em TIMESTAMPTZ,
    nome_exibicao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT conselho_membros_papel_unique UNIQUE (conselho_id, papel),
    CONSTRAINT conselho_membros_token_unique UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_conselho_membros_conselho ON conselho_notas_membros(conselho_id);
CREATE INDEX IF NOT EXISTS idx_conselho_membros_user ON conselho_notas_membros(user_id);
CREATE INDEX IF NOT EXISTS idx_conselho_membros_token ON conselho_notas_membros(token);
CREATE INDEX IF NOT EXISTS idx_conselho_membros_expires ON conselho_notas_membros(expires_at);

-- ---------------------------------------------------------------------------
-- Propostas de alteração de nota (aplicadas só na aprovação)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conselho_notas_propostas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conselho_id UUID NOT NULL REFERENCES conselho_notas(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    disciplina_id UUID NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
    componente_id UUID NOT NULL REFERENCES componentes_avaliacao(id) ON DELETE CASCADE,
    valor_atual NUMERIC(5,2) NOT NULL,
    valor_proposto NUMERIC(5,2) NOT NULL,
    motivo TEXT NOT NULL,
    proposto_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pendente'
        CHECK (status IN ('pendente', 'aplicada', 'descartada')),
    aplicada_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT conselho_propostas_unique UNIQUE (conselho_id, aluno_id, componente_id)
);

CREATE INDEX IF NOT EXISTS idx_conselho_propostas_conselho ON conselho_notas_propostas(conselho_id);
CREATE INDEX IF NOT EXISTS idx_conselho_propostas_status ON conselho_notas_propostas(conselho_id, status);

ALTER TABLE conselho_notas_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE conselho_notas_propostas ENABLE ROW LEVEL SECURITY;

-- Helpers: escola do conselho / membro activo
CREATE OR REPLACE FUNCTION conselho_notas_escola_id(p_conselho_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT escola_id FROM conselho_notas WHERE id = p_conselho_id
$$;

CREATE OR REPLACE FUNCTION is_conselho_membro_activo(p_conselho_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM conselho_notas_membros m
        WHERE m.conselho_id = p_conselho_id
          AND m.user_id = auth.uid()
          AND m.status = 'aceite'
          AND m.expires_at > NOW()
    )
$$;

-- Policies membros
DROP POLICY IF EXISTS "conselho_membros_select" ON conselho_notas_membros;
CREATE POLICY "conselho_membros_select" ON conselho_notas_membros FOR SELECT
    USING (
        user_belongs_to_escola(conselho_notas_escola_id(conselho_id))
        OR user_id = auth.uid()
    );

DROP POLICY IF EXISTS "conselho_membros_insert" ON conselho_notas_membros;
CREATE POLICY "conselho_membros_insert" ON conselho_notas_membros FOR INSERT
    WITH CHECK (user_belongs_to_escola(conselho_notas_escola_id(conselho_id)));

DROP POLICY IF EXISTS "conselho_membros_update" ON conselho_notas_membros;
CREATE POLICY "conselho_membros_update" ON conselho_notas_membros FOR UPDATE
    USING (
        user_belongs_to_escola(conselho_notas_escola_id(conselho_id))
        OR user_id = auth.uid()
    );

DROP POLICY IF EXISTS "conselho_membros_delete" ON conselho_notas_membros;
CREATE POLICY "conselho_membros_delete" ON conselho_notas_membros FOR DELETE
    USING (user_belongs_to_escola(conselho_notas_escola_id(conselho_id)));

-- Policies propostas
DROP POLICY IF EXISTS "conselho_propostas_select" ON conselho_notas_propostas;
CREATE POLICY "conselho_propostas_select" ON conselho_notas_propostas FOR SELECT
    USING (
        user_belongs_to_escola(conselho_notas_escola_id(conselho_id))
        OR is_conselho_membro_activo(conselho_id)
    );

DROP POLICY IF EXISTS "conselho_propostas_insert" ON conselho_notas_propostas;
CREATE POLICY "conselho_propostas_insert" ON conselho_notas_propostas FOR INSERT
    WITH CHECK (
        user_belongs_to_escola(conselho_notas_escola_id(conselho_id))
        OR is_conselho_membro_activo(conselho_id)
    );

DROP POLICY IF EXISTS "conselho_propostas_update" ON conselho_notas_propostas;
CREATE POLICY "conselho_propostas_update" ON conselho_notas_propostas FOR UPDATE
    USING (
        user_belongs_to_escola(conselho_notas_escola_id(conselho_id))
        OR is_conselho_membro_activo(conselho_id)
    );

DROP POLICY IF EXISTS "conselho_propostas_delete" ON conselho_notas_propostas;
CREATE POLICY "conselho_propostas_delete" ON conselho_notas_propostas FOR DELETE
    USING (user_belongs_to_escola(conselho_notas_escola_id(conselho_id)));

-- Aceitar convite por token
CREATE OR REPLACE FUNCTION aceitar_conselho_convite(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_membro conselho_notas_membros%ROWTYPE;
    v_conselho conselho_notas%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'É necessário autenticar-se para aceitar o convite';
    END IF;

    SELECT * INTO v_membro
    FROM conselho_notas_membros
    WHERE token = p_token
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Convite inválido ou inexistente';
    END IF;

    IF v_membro.user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Este convite destina-se a outro utilizador';
    END IF;

    IF v_membro.status = 'revogado' THEN
        RAISE EXCEPTION 'Este convite foi revogado';
    END IF;

    IF v_membro.expires_at <= NOW() THEN
        UPDATE conselho_notas_membros
        SET status = 'expirado', updated_at = NOW()
        WHERE id = v_membro.id;
        RAISE EXCEPTION 'O prazo deste convite expirou';
    END IF;

    UPDATE conselho_notas_membros
    SET status = 'aceite',
        aceite_em = COALESCE(aceite_em, NOW()),
        updated_at = NOW()
    WHERE id = v_membro.id
    RETURNING * INTO v_membro;

    SELECT * INTO v_conselho FROM conselho_notas WHERE id = v_membro.conselho_id;

    RETURN jsonb_build_object(
        'membro_id', v_membro.id,
        'conselho_id', v_membro.conselho_id,
        'turma_id', v_conselho.turma_id,
        'papel', v_membro.papel,
        'expires_at', v_membro.expires_at
    );
END;
$$;

GRANT EXECUTE ON FUNCTION aceitar_conselho_convite(UUID) TO authenticated;

-- Aprovar conselho e aplicar propostas pendentes
CREATE OR REPLACE FUNCTION aprovar_conselho_notas(p_conselho_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_conselho conselho_notas%ROWTYPE;
    v_prop RECORD;
    v_updated INTEGER := 0;
    v_missing INTEGER := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Não autenticado';
    END IF;

    SELECT * INTO v_conselho FROM conselho_notas WHERE id = p_conselho_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conselho não encontrado';
    END IF;

    IF NOT user_belongs_to_escola(v_conselho.escola_id) THEN
        RAISE EXCEPTION 'Sem permissão para aprovar este Conselho';
    END IF;

    IF v_conselho.status = 'aprovado' THEN
        RAISE EXCEPTION 'Conselho já está aprovado';
    END IF;

    IF COALESCE(TRIM(v_conselho.coordenador_nome), '') = ''
       OR COALESCE(TRIM(v_conselho.secretario_nome), '') = ''
       OR COALESCE(TRIM(v_conselho.membro_2_nome), '') = '' THEN
        RAISE EXCEPTION 'Indique Coordenador, Secretário e Membro antes de aprovar';
    END IF;

    FOR v_prop IN
        SELECT * FROM conselho_notas_propostas
        WHERE conselho_id = p_conselho_id AND status = 'pendente'
        FOR UPDATE
    LOOP
        UPDATE notas
        SET valor = v_prop.valor_proposto,
            observacao = COALESCE(observacao, '') ||
                CASE WHEN observacao IS NULL OR observacao = '' THEN '' ELSE ' | ' END ||
                'Ajuste Conselho de Notas',
            updated_at = NOW()
        WHERE aluno_id = v_prop.aluno_id
          AND componente_id = v_prop.componente_id;

        IF FOUND THEN
            v_updated := v_updated + 1;
            UPDATE conselho_notas_propostas
            SET status = 'aplicada',
                aplicada_em = NOW(),
                updated_at = NOW()
            WHERE id = v_prop.id;
        ELSE
            v_missing := v_missing + 1;
            -- Mantém pendente se a nota ainda não existir (não inventar lancado_por)
        END IF;
    END LOOP;

    IF v_missing > 0 THEN
        RAISE EXCEPTION 'Existem % proposta(s) sem nota lançada correspondente. Lance a nota ou remova a proposta.', v_missing;
    END IF;

    UPDATE conselho_notas
    SET status = 'aprovado',
        aprovado_em = NOW(),
        aprovado_por = auth.uid(),
        updated_at = NOW()
    WHERE id = p_conselho_id;

    RETURN jsonb_build_object(
        'conselho_id', p_conselho_id,
        'propostas_aplicadas', v_updated,
        'status', 'aprovado'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION aprovar_conselho_notas(UUID) TO authenticated;

-- updated_at triggers
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        DROP TRIGGER IF EXISTS update_conselho_membros_updated_at ON conselho_notas_membros;
        CREATE TRIGGER update_conselho_membros_updated_at
            BEFORE UPDATE ON conselho_notas_membros
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS update_conselho_propostas_updated_at ON conselho_notas_propostas;
        CREATE TRIGGER update_conselho_propostas_updated_at
            BEFORE UPDATE ON conselho_notas_propostas
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
