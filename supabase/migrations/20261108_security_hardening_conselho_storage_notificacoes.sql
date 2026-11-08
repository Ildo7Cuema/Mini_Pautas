-- =============================================================================
-- Security hardening (2026-11-08)
-- 1) Conselho de Notas: gestor real (ESCOLA / Director Pedagógico)
-- 2) Policies de membros / reabertura / aprovação
-- 3) Storage: concursos, logos, circulares
-- 4) Notificações INSERT (destinatario_id)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: gestor do Conselho (= canManage do UI)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_conselho_gestor(p_escola_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.user_id = auth.uid()
              AND up.escola_id = p_escola_id
              AND up.tipo_perfil = 'ESCOLA'
              AND COALESCE(up.ativo, true) IS TRUE
        )
        OR EXISTS (
            SELECT 1
            FROM secretarios s
            WHERE s.user_id = auth.uid()
              AND s.escola_id = p_escola_id
              AND s.ativo IS TRUE
              AND (
                  UPPER(COALESCE(s.cargo, '')) = 'DIRECTOR_PEDAGOGICO'
                  OR (
                      s.cargo ~* 'pedag[oó]gico'
                      AND s.cargo ~* 'director|diretor|subdirector|subdiretor'
                  )
              )
        );
$$;

REVOKE ALL ON FUNCTION is_conselho_gestor(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_conselho_gestor(UUID) TO authenticated;

COMMENT ON FUNCTION is_conselho_gestor(UUID) IS
    'True se o utilizador é admin ESCOLA ou Director/Subdirector Pedagógico da escola';

-- ---------------------------------------------------------------------------
-- Aprovar conselho: só gestores
-- ---------------------------------------------------------------------------
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

    IF NOT is_conselho_gestor(v_conselho.escola_id) THEN
        RAISE EXCEPTION 'Sem permissão para aprovar este Conselho (apenas direcção)';
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

-- ---------------------------------------------------------------------------
-- Notificar eventos: gestor real (não user_belongs_to_escola)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notificar_conselho_evento(
    p_conselho_id UUID,
    p_evento TEXT,
    p_actor_nome TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_conselho conselho_notas%ROWTYPE;
    v_turma_nome TEXT;
    v_actor UUID := auth.uid();
    v_titulo TEXT;
    v_mensagem TEXT;
    v_tipo TEXT;
    v_dest UUID;
    v_count INTEGER := 0;
    v_propostas INTEGER := 0;
    v_is_membro BOOLEAN := false;
    v_is_gestor BOOLEAN := false;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Não autenticado';
    END IF;

    IF p_evento NOT IN ('rascunho_guardado', 'aprovado') THEN
        RAISE EXCEPTION 'Evento inválido: %', p_evento;
    END IF;

    SELECT * INTO v_conselho FROM conselho_notas WHERE id = p_conselho_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conselho não encontrado';
    END IF;

    SELECT COALESCE(NULLIF(TRIM(t.nome), ''), t.codigo_turma, 'turma')
      INTO v_turma_nome
      FROM turmas t
     WHERE t.id = v_conselho.turma_id;

    v_is_membro := COALESCE(is_conselho_membro_activo(p_conselho_id), false);
    v_is_gestor := COALESCE(is_conselho_gestor(v_conselho.escola_id), false);

    IF p_evento = 'rascunho_guardado' THEN
        IF NOT v_is_membro THEN
            RAISE EXCEPTION 'Apenas membros activos do Conselho podem notificar o rascunho';
        END IF;

        v_tipo := 'conselho_notas_rascunho';
        v_titulo := 'Rascunho do Conselho actualizado';
        v_mensagem := COALESCE(NULLIF(TRIM(p_actor_nome), ''), 'Um membro do Conselho')
            || ' guardou o rascunho do Conselho de Notas da turma '
            || v_turma_nome
            || '. Revise as deliberações e propostas na sala do Conselho.';

        FOR v_dest IN
            SELECT up.user_id
            FROM user_profiles up
            WHERE up.escola_id = v_conselho.escola_id
              AND up.tipo_perfil = 'ESCOLA'
              AND COALESCE(up.ativo, true) IS TRUE
              AND up.user_id IS DISTINCT FROM v_actor
        LOOP
            INSERT INTO notificacoes (destinatario_id, tipo, titulo, mensagem, link, lida, dados_adicionais)
            VALUES (
                v_dest, v_tipo, v_titulo, v_mensagem, 'reports', false,
                jsonb_build_object(
                    'conselho_id', p_conselho_id,
                    'turma_id', v_conselho.turma_id,
                    'ano_lectivo', v_conselho.ano_lectivo,
                    'evento', 'rascunho_guardado'
                )
            );
            v_count := v_count + 1;
        END LOOP;

        FOR v_dest IN
            SELECT s.user_id
            FROM secretarios s
            WHERE s.escola_id = v_conselho.escola_id
              AND s.ativo IS TRUE
              AND s.user_id IS NOT NULL
              AND s.user_id IS DISTINCT FROM v_actor
              AND (
                  UPPER(COALESCE(s.cargo, '')) = 'DIRECTOR_PEDAGOGICO'
                  OR (
                      s.cargo ~* 'pedag[oó]gico'
                      AND s.cargo ~* 'director|diretor|subdirector|subdiretor'
                  )
              )
        LOOP
            INSERT INTO notificacoes (destinatario_id, tipo, titulo, mensagem, link, lida, dados_adicionais)
            VALUES (
                v_dest, v_tipo, v_titulo, v_mensagem, 'reports', false,
                jsonb_build_object(
                    'conselho_id', p_conselho_id,
                    'turma_id', v_conselho.turma_id,
                    'ano_lectivo', v_conselho.ano_lectivo,
                    'evento', 'rascunho_guardado'
                )
            );
            v_count := v_count + 1;
        END LOOP;

    ELSE
        IF NOT v_is_gestor THEN
            RAISE EXCEPTION 'Apenas a direcção pode notificar a aprovação do Conselho';
        END IF;

        SELECT COUNT(*)::INTEGER INTO v_propostas
        FROM conselho_notas_propostas
        WHERE conselho_id = p_conselho_id AND status = 'aplicada';

        v_tipo := 'conselho_notas_aprovado';
        v_titulo := 'Conselho de Notas aprovado';
        v_mensagem := 'O Conselho de Notas da turma '
            || v_turma_nome
            || ' foi aprovado pela direcção.';
        IF v_propostas > 0 THEN
            v_mensagem := v_mensagem
                || ' Foram aplicadas '
                || v_propostas
                || ' proposta(s) de nota.';
        END IF;
        v_mensagem := v_mensagem || ' A Pauta-Geral pode ser exportada.';

        FOR v_dest IN
            SELECT DISTINCT m.user_id
            FROM conselho_notas_membros m
            WHERE m.conselho_id = p_conselho_id
              AND m.user_id IS NOT NULL
              AND m.user_id IS DISTINCT FROM v_actor
              AND m.status IN ('aceite', 'pendente')
        LOOP
            INSERT INTO notificacoes (destinatario_id, tipo, titulo, mensagem, link, lida, dados_adicionais)
            VALUES (
                v_dest, v_tipo, v_titulo, v_mensagem, 'reports', false,
                jsonb_build_object(
                    'conselho_id', p_conselho_id,
                    'turma_id', v_conselho.turma_id,
                    'ano_lectivo', v_conselho.ano_lectivo,
                    'evento', 'aprovado',
                    'propostas_aplicadas', v_propostas
                )
            );
            v_count := v_count + 1;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'evento', p_evento,
        'notificados', v_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION notificar_conselho_evento(UUID, TEXT, TEXT) TO authenticated;

-- Aceitar convite pendente sem expor token em notificações
CREATE OR REPLACE FUNCTION aceitar_conselho_convite_pendente(p_conselho_id UUID)
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
    WHERE conselho_id = p_conselho_id
      AND user_id = auth.uid()
      AND status = 'pendente'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Não tem convite pendente para este Conselho';
    END IF;

    IF v_membro.expires_at <= NOW() THEN
        UPDATE conselho_notas_membros
        SET status = 'expirado', updated_at = NOW()
        WHERE id = v_membro.id;
        RAISE EXCEPTION 'Convite expirado';
    END IF;

    UPDATE conselho_notas_membros
    SET status = 'aceite',
        aceite_em = NOW(),
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

GRANT EXECUTE ON FUNCTION aceitar_conselho_convite_pendente(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS Conselho: gestão / reabertura só por gestores
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "conselho_notas_insert" ON conselho_notas;
CREATE POLICY "conselho_notas_insert" ON conselho_notas FOR INSERT
    WITH CHECK (is_conselho_gestor(escola_id));

DROP POLICY IF EXISTS "conselho_notas_update" ON conselho_notas;
CREATE POLICY "conselho_notas_update" ON conselho_notas FOR UPDATE
    USING (
        is_conselho_gestor(escola_id)
        OR (
            is_conselho_membro_activo(id)
            AND status IS DISTINCT FROM 'aprovado'
        )
    )
    WITH CHECK (
        is_conselho_gestor(escola_id)
        OR (
            is_conselho_membro_activo(id)
            AND status IS DISTINCT FROM 'aprovado'
        )
    );

DROP POLICY IF EXISTS "conselho_notas_delete" ON conselho_notas;
CREATE POLICY "conselho_notas_delete" ON conselho_notas FOR DELETE
    USING (is_conselho_gestor(escola_id));

-- Deliberações: só gestor ou membro activo
DROP POLICY IF EXISTS "conselho_delib_insert" ON conselho_notas_deliberacoes;
CREATE POLICY "conselho_delib_insert" ON conselho_notas_deliberacoes FOR INSERT
    WITH CHECK (
        conselho_id IN (
            SELECT c.id FROM conselho_notas c
            WHERE is_conselho_gestor(c.escola_id)
               OR is_conselho_membro_activo(c.id)
        )
        AND conselho_id IN (
            SELECT c.id FROM conselho_notas c WHERE c.status IS DISTINCT FROM 'aprovado'
        )
    );

DROP POLICY IF EXISTS "conselho_delib_update" ON conselho_notas_deliberacoes;
CREATE POLICY "conselho_delib_update" ON conselho_notas_deliberacoes FOR UPDATE
    USING (
        conselho_id IN (
            SELECT c.id FROM conselho_notas c
            WHERE is_conselho_gestor(c.escola_id)
               OR (is_conselho_membro_activo(c.id) AND c.status IS DISTINCT FROM 'aprovado')
        )
    );

DROP POLICY IF EXISTS "conselho_delib_delete" ON conselho_notas_deliberacoes;
CREATE POLICY "conselho_delib_delete" ON conselho_notas_deliberacoes FOR DELETE
    USING (
        conselho_id IN (
            SELECT c.id FROM conselho_notas c WHERE is_conselho_gestor(c.escola_id)
        )
    );

-- Impedir membro reabrir aprovado: trigger de salvaguarda
CREATE OR REPLACE FUNCTION conselho_notas_guard_reopen()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status = 'aprovado' AND NEW.status IS DISTINCT FROM 'aprovado' THEN
        IF NOT is_conselho_gestor(OLD.escola_id) THEN
            RAISE EXCEPTION 'Apenas a direcção pode reabrir um Conselho aprovado';
        END IF;
    END IF;
    IF OLD.status = 'aprovado' AND NEW.status = 'aprovado' THEN
        -- membros não alteram campos de um conselho já aprovado
        IF NOT is_conselho_gestor(OLD.escola_id) THEN
            RAISE EXCEPTION 'Conselho aprovado está bloqueado para edição';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conselho_notas_guard_reopen ON conselho_notas;
CREATE TRIGGER trg_conselho_notas_guard_reopen
    BEFORE UPDATE ON conselho_notas
    FOR EACH ROW EXECUTE FUNCTION conselho_notas_guard_reopen();

-- Membros: insert/delete só gestor; update do próprio só via RPC (bloquear self-service)
DROP POLICY IF EXISTS "conselho_membros_select" ON conselho_notas_membros;
CREATE POLICY "conselho_membros_select" ON conselho_notas_membros FOR SELECT
    USING (
        user_id = auth.uid()
        OR is_conselho_gestor(conselho_notas_escola_id(conselho_id))
        OR is_conselho_membro_activo(conselho_id)
    );

DROP POLICY IF EXISTS "conselho_membros_insert" ON conselho_notas_membros;
CREATE POLICY "conselho_membros_insert" ON conselho_notas_membros FOR INSERT
    WITH CHECK (is_conselho_gestor(conselho_notas_escola_id(conselho_id)));

DROP POLICY IF EXISTS "conselho_membros_update" ON conselho_notas_membros;
CREATE POLICY "conselho_membros_update" ON conselho_notas_membros FOR UPDATE
    USING (is_conselho_gestor(conselho_notas_escola_id(conselho_id)))
    WITH CHECK (is_conselho_gestor(conselho_notas_escola_id(conselho_id)));

DROP POLICY IF EXISTS "conselho_membros_delete" ON conselho_notas_membros;
CREATE POLICY "conselho_membros_delete" ON conselho_notas_membros FOR DELETE
    USING (is_conselho_gestor(conselho_notas_escola_id(conselho_id)));

-- ---------------------------------------------------------------------------
-- Notificações INSERT policies (coluna correcta: destinatario_id)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Escola pode criar notificacoes" ON notificacoes;
CREATE POLICY "Escola pode criar notificacoes"
    ON notificacoes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_id = auth.uid()
              AND tipo_perfil = 'ESCOLA'
              AND COALESCE(ativo, true) IS TRUE
        )
        AND destinatario_id IN (
            SELECT p.user_id
            FROM professores p
            WHERE p.escola_id IN (
                SELECT up.escola_id FROM user_profiles up
                WHERE up.user_id = auth.uid() AND up.tipo_perfil = 'ESCOLA'
            )
            AND p.user_id IS NOT NULL
            UNION
            SELECT s.user_id
            FROM secretarios s
            WHERE s.escola_id IN (
                SELECT up.escola_id FROM user_profiles up
                WHERE up.user_id = auth.uid() AND up.tipo_perfil = 'ESCOLA'
            )
            AND s.user_id IS NOT NULL
        )
    );

DROP POLICY IF EXISTS "Professor pode criar notificacoes" ON notificacoes;
CREATE POLICY "Professor pode criar notificacoes"
    ON notificacoes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_id = auth.uid()
              AND tipo_perfil = 'PROFESSOR'
              AND COALESCE(ativo, true) IS TRUE
        )
        AND destinatario_id IN (
            -- Admin ESCOLA da mesma escola
            SELECT up.user_id
            FROM user_profiles up
            WHERE up.tipo_perfil = 'ESCOLA'
              AND COALESCE(up.ativo, true) IS TRUE
              AND up.escola_id IN (
                  SELECT p.escola_id FROM professores p WHERE p.user_id = auth.uid()
              )
            UNION
            -- Outros professores da mesma escola
            SELECT p2.user_id
            FROM professores p2
            WHERE p2.user_id IS NOT NULL
              AND p2.escola_id IN (
                  SELECT p.escola_id FROM professores p WHERE p.user_id = auth.uid()
              )
        )
    );

-- Permitir gestor (ESCOLA / Dir. Pedagógico) criar convite de conselho para staff da escola
DROP POLICY IF EXISTS "Gestor conselho pode criar notificacoes" ON notificacoes;
CREATE POLICY "Gestor conselho pode criar notificacoes"
    ON notificacoes FOR INSERT
    WITH CHECK (
        tipo IN ('conselho_notas_convite', 'conselho_notas_rascunho', 'conselho_notas_aprovado')
        AND (
            EXISTS (
                SELECT 1 FROM user_profiles up
                WHERE up.user_id = auth.uid()
                  AND up.tipo_perfil = 'ESCOLA'
                  AND COALESCE(up.ativo, true) IS TRUE
                  AND destinatario_id IN (
                      SELECT p.user_id FROM professores p
                      WHERE p.escola_id = up.escola_id AND p.user_id IS NOT NULL
                      UNION
                      SELECT s.user_id FROM secretarios s
                      WHERE s.escola_id = up.escola_id AND s.user_id IS NOT NULL
                  )
            )
            OR EXISTS (
                SELECT 1 FROM secretarios s
                WHERE s.user_id = auth.uid()
                  AND s.ativo IS TRUE
                  AND (
                      UPPER(COALESCE(s.cargo, '')) = 'DIRECTOR_PEDAGOGICO'
                      OR (
                          s.cargo ~* 'pedag[oó]gico'
                          AND s.cargo ~* 'director|diretor|subdirector|subdiretor'
                      )
                  )
                  AND destinatario_id IN (
                      SELECT p.user_id FROM professores p
                      WHERE p.escola_id = s.escola_id AND p.user_id IS NOT NULL
                      UNION
                      SELECT s2.user_id FROM secretarios s2
                      WHERE s2.escola_id = s.escola_id AND s2.user_id IS NOT NULL
                  )
            )
        )
    );

-- Remover tokens já persistidos em notificações (reduzir superfície)
UPDATE notificacoes
SET dados_adicionais = dados_adicionais - 'token'
WHERE dados_adicionais ? 'token'
  AND tipo LIKE 'conselho_notas_%';

-- ---------------------------------------------------------------------------
-- Storage: concursos-documentos
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anon can upload concurso docs" ON storage.objects;
DROP POLICY IF EXISTS "Auth can upload concurso docs" ON storage.objects;
DROP POLICY IF EXISTS "Public can view concurso docs" ON storage.objects;
DROP POLICY IF EXISTS "Auth can delete own concurso docs" ON storage.objects;

-- Anon: apenas pasta de inscrições públicas
CREATE POLICY "Anon can upload concurso inscricao docs"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (
    bucket_id = 'concursos-documentos'
    AND (storage.foldername(name))[1] = 'inscricoes'
);

-- Authenticated: cabecalhos + inscricoes
CREATE POLICY "Auth can upload concurso docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'concursos-documentos'
    AND (storage.foldername(name))[1] IN ('inscricoes', 'cabecalhos')
);

CREATE POLICY "Public can view concurso docs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'concursos-documentos');

CREATE POLICY "Auth can delete own concurso docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'concursos-documentos'
    AND owner = auth.uid()
);

-- ---------------------------------------------------------------------------
-- Storage: mini-pauta-assets (logos scoped ao user)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own logos" ON storage.objects;

CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'mini-pauta-assets'
    AND (storage.foldername(name))[1] = 'logos'
    AND name LIKE 'logos/' || auth.uid()::text || '_%'
);

CREATE POLICY "Users can update their own logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'mini-pauta-assets'
    AND (storage.foldername(name))[1] = 'logos'
    AND (owner = auth.uid() OR name LIKE 'logos/' || auth.uid()::text || '_%')
);

CREATE POLICY "Users can delete their own logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'mini-pauta-assets'
    AND (storage.foldername(name))[1] = 'logos'
    AND (owner = auth.uid() OR name LIKE 'logos/' || auth.uid()::text || '_%')
);

-- ---------------------------------------------------------------------------
-- Storage: circulares (pasta por uid)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can upload circular attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own circular attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own circular attachments" ON storage.objects;

CREATE POLICY "Authenticated users can upload circular attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'circulares'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own circular attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'circulares'
    AND (
        owner = auth.uid()
        OR (storage.foldername(name))[1] = auth.uid()::text
    )
);

CREATE POLICY "Users can delete their own circular attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'circulares'
    AND (
        owner = auth.uid()
        OR (storage.foldername(name))[1] = auth.uid()::text
    )
);
