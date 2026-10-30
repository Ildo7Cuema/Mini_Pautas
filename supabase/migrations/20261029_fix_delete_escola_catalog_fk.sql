-- ============================================
-- FIX: Allow SUPERADMIN to delete escolas with
-- catalog / disciplina_componentes linkages
--
-- Error fixed:
--   update or delete on table "componentes_catalogo"
--   violates foreign key constraint
--   "disciplina_componentes_componente_catalogo_id_fkey"
-- ============================================

-- 1) disciplina_componentes → componentes_catalogo: RESTRICT → CASCADE
--    When a school (or its catalog) is removed, associations must go with it.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'disciplina_componentes_componente_catalogo_id_fkey'
    ) THEN
        ALTER TABLE disciplina_componentes
            DROP CONSTRAINT disciplina_componentes_componente_catalogo_id_fkey;
    END IF;
END $$;

ALTER TABLE disciplina_componentes
    ADD CONSTRAINT disciplina_componentes_componente_catalogo_id_fkey
    FOREIGN KEY (componente_catalogo_id)
    REFERENCES componentes_catalogo(id)
    ON DELETE CASCADE;

-- 2) componentes_template → componentes_catalogo: NO ACTION → SET NULL
--    Templates may outlive a catalog row during cascade ordering; nullify link.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'componentes_template_componente_catalogo_id_fkey'
    ) THEN
        ALTER TABLE componentes_template
            DROP CONSTRAINT componentes_template_componente_catalogo_id_fkey;
    END IF;
END $$;

ALTER TABLE componentes_template
    ADD CONSTRAINT componentes_template_componente_catalogo_id_fkey
    FOREIGN KEY (componente_catalogo_id)
    REFERENCES componentes_catalogo(id)
    ON DELETE SET NULL;

-- 3) Harden backup_and_delete_escola: explicitly clear FK blockers
--    before DELETE FROM escolas (belt-and-suspenders with CASCADE above).
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
            'disciplina_componentes', v_disciplina_componentes
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
            'backup_id', v_backup_id
        )
    );

    -- Explicit cleanup of catalog associations (avoids RESTRICT / order races)
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

    DELETE FROM escolas WHERE id = p_escola_id;

    RETURN json_build_object(
        'success', true,
        'backup_id', v_backup_id,
        'message', CASE
            WHEN p_create_backup THEN 'Escola eliminada com backup completo criado'
            ELSE 'Escola eliminada sem backup'
        END
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION backup_and_delete_escola(UUID, TEXT, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION backup_and_delete_escola IS
'SUPERADMIN: backup (optional) and hard-delete escola including catalog/disciplina_componentes links';
