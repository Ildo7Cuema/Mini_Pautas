-- Notificações do Conselho de Notas (rascunho guardado / aprovação)
-- RPC SECURITY DEFINER: contorna RLS restritivo de notificacoes INSERT.

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
    v_is_gestor := user_belongs_to_escola(v_conselho.escola_id)
        OR EXISTS (
            SELECT 1 FROM secretarios s
            WHERE s.user_id = v_actor
              AND s.escola_id = v_conselho.escola_id
              AND s.ativo IS TRUE
              AND (
                  s.cargo ILIKE '%DIRECTOR_PEDAGOGICO%'
                  OR (
                      s.cargo ~* 'pedag[oó]gico'
                      AND s.cargo ~* 'director|diretor|subdirector|subdiretor'
                  )
              )
        );

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

        -- Admin ESCOLA da escola
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
                v_dest,
                v_tipo,
                v_titulo,
                v_mensagem,
                'reports',
                false,
                jsonb_build_object(
                    'conselho_id', p_conselho_id,
                    'turma_id', v_conselho.turma_id,
                    'ano_lectivo', v_conselho.ano_lectivo,
                    'evento', 'rascunho_guardado'
                )
            );
            v_count := v_count + 1;
        END LOOP;

        -- Subdirector Pedagógico
        FOR v_dest IN
            SELECT s.user_id
            FROM secretarios s
            WHERE s.escola_id = v_conselho.escola_id
              AND s.ativo IS TRUE
              AND s.user_id IS NOT NULL
              AND s.user_id IS DISTINCT FROM v_actor
              AND (
                  s.cargo ILIKE '%DIRECTOR_PEDAGOGICO%'
                  OR (
                      s.cargo ~* 'pedag[oó]gico'
                      AND s.cargo ~* 'director|diretor|subdirector|subdiretor'
                  )
              )
        LOOP
            INSERT INTO notificacoes (destinatario_id, tipo, titulo, mensagem, link, lida, dados_adicionais)
            VALUES (
                v_dest,
                v_tipo,
                v_titulo,
                v_mensagem,
                'reports',
                false,
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
        -- aprovado
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
                v_dest,
                v_tipo,
                v_titulo,
                v_mensagem,
                'reports',
                false,
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
