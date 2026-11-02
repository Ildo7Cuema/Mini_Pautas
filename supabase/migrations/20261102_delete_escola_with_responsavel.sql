-- ============================================
-- FIX: Eliminar escola remove também o responsável
-- (auth.users + perfis) e dados relacionados
--
-- Problema: DELETE FROM escolas faz CASCADE nas
-- tabelas com escola_id, mas as contas auth do
-- responsável / professores / secretários ficavam
-- órfãs e podiam voltar a autenticar-se.
-- ============================================

CREATE OR REPLACE FUNCTION backup_and_delete_escola(
    p_escola_id UUID,
    p_motivo TEXT,
    p_create_backup BOOLEAN DEFAULT true
)
RETURNS JSON AS $$
DECLARE
    v_escola_data JSONB;
    v_related_data JSONB;
    v_backup_id UUID;
    v_user_id UUID;
    v_professores JSONB;
    v_turmas JSONB;
    v_alunos JSONB;
    v_disciplinas JSONB;
    v_componentes JSONB;
    v_notas JSONB;
    v_notas_finais JSONB;
    v_formulas JSONB;
    v_licencas JSONB;
    v_secretarios JSONB;
    v_user_profiles JSONB;
    v_turma_professores JSONB;
    v_componentes_catalogo JSONB;
    v_disciplina_componentes JSONB;
    v_auth_users JSONB;
    v_school_user_ids UUID[];
    v_deleted_auth_count INT := 0;
    v_uid UUID;
BEGIN
    v_user_id := auth.uid();

    IF NOT EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = v_user_id
        AND tipo_perfil = 'SUPERADMIN'
        AND ativo = true
    ) THEN
        RAISE EXCEPTION 'Apenas SUPERADMIN pode eliminar escolas';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM escolas WHERE id = p_escola_id) THEN
        RAISE EXCEPTION 'Escola não encontrada';
    END IF;

    SELECT to_jsonb(e.*) INTO v_escola_data
    FROM escolas e
    WHERE e.id = p_escola_id;

    -- Contas ligadas exclusivamente a esta escola (responsável + staff)
    SELECT COALESCE(array_agg(DISTINCT uid), ARRAY[]::UUID[])
    INTO v_school_user_ids
    FROM (
        SELECT e.user_id AS uid
        FROM escolas e
        WHERE e.id = p_escola_id AND e.user_id IS NOT NULL
        UNION
        SELECT up.user_id
        FROM user_profiles up
        WHERE up.escola_id = p_escola_id AND up.user_id IS NOT NULL
        UNION
        SELECT p.user_id
        FROM professores p
        WHERE p.escola_id = p_escola_id AND p.user_id IS NOT NULL
        UNION
        SELECT s.user_id
        FROM secretarios s
        WHERE s.escola_id = p_escola_id AND s.user_id IS NOT NULL
        UNION
        SELECT f.user_id
        FROM funcionarios_escola f
        WHERE f.escola_id = p_escola_id AND f.user_id IS NOT NULL
    ) linked
    WHERE uid IS NOT NULL
      -- Nunca apagar o SuperAdmin que está a executar a acção
      AND uid <> v_user_id
      -- Só apagar se o utilizador não tiver perfil noutra escola / direcção
      AND NOT EXISTS (
          SELECT 1 FROM user_profiles up2
          WHERE up2.user_id = uid
            AND (up2.escola_id IS DISTINCT FROM p_escola_id)
      )
      AND NOT EXISTS (
          SELECT 1 FROM escolas e2
          WHERE e2.user_id = uid
            AND e2.id <> p_escola_id
      );

    IF p_create_backup THEN
        SELECT COALESCE(jsonb_agg(to_jsonb(p.*)), '[]'::jsonb) INTO v_professores
        FROM professores p
        WHERE p.escola_id = p_escola_id;

        SELECT COALESCE(jsonb_agg(to_jsonb(t.*)), '[]'::jsonb) INTO v_turmas
        FROM turmas t
        WHERE t.escola_id = p_escola_id;

        SELECT COALESCE(jsonb_agg(to_jsonb(a.*)), '[]'::jsonb) INTO v_alunos
        FROM alunos a
        INNER JOIN turmas t ON t.id = a.turma_id
        WHERE t.escola_id = p_escola_id;

        SELECT COALESCE(jsonb_agg(to_jsonb(d.*)), '[]'::jsonb) INTO v_disciplinas
        FROM disciplinas d
        INNER JOIN turmas t ON t.id = d.turma_id
        WHERE t.escola_id = p_escola_id;

        SELECT COALESCE(jsonb_agg(to_jsonb(c.*)), '[]'::jsonb) INTO v_componentes
        FROM componentes_avaliacao c
        INNER JOIN turmas t ON t.id = c.turma_id
        WHERE t.escola_id = p_escola_id;

        SELECT COALESCE(jsonb_agg(to_jsonb(n.*)), '[]'::jsonb) INTO v_notas
        FROM notas n
        INNER JOIN turmas t ON t.id = n.turma_id
        WHERE t.escola_id = p_escola_id;

        SELECT COALESCE(jsonb_agg(to_jsonb(nf.*)), '[]'::jsonb) INTO v_notas_finais
        FROM notas_finais nf
        INNER JOIN turmas t ON t.id = nf.turma_id
        WHERE t.escola_id = p_escola_id;

        SELECT COALESCE(jsonb_agg(to_jsonb(f.*)), '[]'::jsonb) INTO v_formulas
        FROM formulas f
        INNER JOIN turmas t ON t.id = f.turma_id
        WHERE t.escola_id = p_escola_id;

        SELECT COALESCE(jsonb_agg(to_jsonb(tp.*)), '[]'::jsonb) INTO v_turma_professores
        FROM turma_professores tp
        INNER JOIN turmas t ON t.id = tp.turma_id
        WHERE t.escola_id = p_escola_id;

        SELECT COALESCE(jsonb_agg(to_jsonb(l.*)), '[]'::jsonb) INTO v_licencas
        FROM licencas l
        WHERE l.escola_id = p_escola_id;

        SELECT COALESCE(jsonb_agg(to_jsonb(s.*)), '[]'::jsonb) INTO v_secretarios
        FROM secretarios s
        WHERE s.escola_id = p_escola_id;

        SELECT COALESCE(jsonb_agg(to_jsonb(up.*)), '[]'::jsonb) INTO v_user_profiles
        FROM user_profiles up
        WHERE up.escola_id = p_escola_id;

        SELECT COALESCE(jsonb_agg(to_jsonb(cc.*)), '[]'::jsonb) INTO v_componentes_catalogo
        FROM componentes_catalogo cc
        WHERE cc.escola_id = p_escola_id;

        SELECT COALESCE(jsonb_agg(to_jsonb(dc.*)), '[]'::jsonb) INTO v_disciplina_componentes
        FROM disciplina_componentes dc
        INNER JOIN componentes_catalogo cc ON cc.id = dc.componente_catalogo_id
        WHERE cc.escola_id = p_escola_id;

        -- Metadados das contas auth (sem hashes de password)
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', u.id,
                'email', u.email,
                'phone', u.phone,
                'created_at', u.created_at,
                'raw_user_meta_data', u.raw_user_meta_data,
                'is_responsavel', (u.id = (v_escola_data->>'user_id')::UUID)
            )
        ), '[]'::jsonb)
        INTO v_auth_users
        FROM auth.users u
        WHERE u.id = ANY (v_school_user_ids);

        v_related_data := jsonb_build_object(
            'professores', v_professores,
            'turmas', v_turmas,
            'alunos', v_alunos,
            'disciplinas', v_disciplinas,
            'componentes', v_componentes,
            'notas', v_notas,
            'notas_finais', v_notas_finais,
            'formulas', v_formulas,
            'turma_professores', v_turma_professores,
            'licencas', v_licencas,
            'secretarios', v_secretarios,
            'user_profiles', v_user_profiles,
            'componentes_catalogo', v_componentes_catalogo,
            'disciplina_componentes', v_disciplina_componentes,
            'auth_users', v_auth_users,
            'school_user_ids', to_jsonb(v_school_user_ids)
        );

        INSERT INTO escola_backups (escola_id, escola_data, related_data, deleted_by, motivo)
        VALUES (p_escola_id, v_escola_data, v_related_data, v_user_id, p_motivo)
        RETURNING id INTO v_backup_id;
    END IF;

    PERFORM log_superadmin_action(
        'DELETE_ESCOLA',
        NULL,
        jsonb_build_object(
            'escola_id', p_escola_id,
            'escola_nome', v_escola_data->>'nome',
            'escola_codigo', v_escola_data->>'codigo_escola',
            'motivo', p_motivo,
            'backup_created', p_create_backup,
            'backup_id', v_backup_id,
            'responsavel_user_id', v_escola_data->>'user_id',
            'auth_users_to_delete', COALESCE(array_length(v_school_user_ids, 1), 0)
        )
    );

    -- Limpeza explícita de catálogo (evita conflitos RESTRICT / ordem)
    DELETE FROM disciplina_componentes dc
    USING componentes_catalogo cc
    WHERE dc.componente_catalogo_id = cc.id
      AND cc.escola_id = p_escola_id;

    UPDATE componentes_template ct
    SET componente_catalogo_id = NULL
    WHERE ct.componente_catalogo_id IN (
        SELECT cc.id FROM componentes_catalogo cc WHERE cc.escola_id = p_escola_id
    );

    DELETE FROM componentes_catalogo
    WHERE escola_id = p_escola_id;

    -- Desligar FK escolas.user_id antes do DELETE da escola
    -- (evita efeitos colaterais se a ordem CASCADE/auth mudar)
    UPDATE escolas
    SET user_id = NULL
    WHERE id = p_escola_id;

    -- Apaga escola + dados relacionados via CASCADE
    DELETE FROM escolas WHERE id = p_escola_id;

    -- Apagar contas auth do responsável e utilizadores exclusivos da escola
    IF array_length(v_school_user_ids, 1) IS NOT NULL THEN
        FOREACH v_uid IN ARRAY v_school_user_ids
        LOOP
            -- Reconfirmar que já não há perfil / outra escola
            IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = v_uid)
               AND NOT EXISTS (SELECT 1 FROM escolas WHERE user_id = v_uid)
            THEN
                DELETE FROM auth.users WHERE id = v_uid;
                v_deleted_auth_count := v_deleted_auth_count + 1;
            END IF;
        END LOOP;
    END IF;

    RETURN json_build_object(
        'success', true,
        'backup_id', v_backup_id,
        'deleted_auth_users', v_deleted_auth_count,
        'message', CASE
            WHEN p_create_backup THEN
                format(
                    'Escola eliminada com backup. Removidas %s conta(s) de acesso (responsável e utilizadores da escola).',
                    v_deleted_auth_count
                )
            ELSE
                format(
                    'Escola eliminada sem backup. Removidas %s conta(s) de acesso (responsável e utilizadores da escola).',
                    v_deleted_auth_count
                )
        END
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;

GRANT EXECUTE ON FUNCTION backup_and_delete_escola(UUID, TEXT, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION backup_and_delete_escola IS
'SUPERADMIN: backup opcional + hard-delete da escola, dados relacionados e contas auth do responsável/utilizadores exclusivos da escola';
