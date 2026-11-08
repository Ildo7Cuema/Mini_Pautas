-- Strengthen template → mapas sync so component add/edit/delete always reach
-- componentes_avaliacao for linked turmas, including partial code renames
-- (match by código OR ordem within the same trimestre).

CREATE OR REPLACE FUNCTION sync_componente_template_changes()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE componentes_avaliacao ca
    SET
        nome = NEW.nome,
        codigo_componente = NEW.codigo_componente,
        peso_percentual = NEW.peso_percentual,
        escala_minima = NEW.escala_minima,
        escala_maxima = NEW.escala_maxima,
        obrigatorio = NEW.obrigatorio,
        ordem = NEW.ordem,
        descricao = NEW.descricao,
        trimestre = NEW.trimestre,
        is_calculated = NEW.is_calculated,
        formula_expression = NEW.formula_expression,
        depends_on_components = NEW.depends_on_components,
        tipo_calculo = NEW.tipo_calculo,
        updated_at = NOW()
    FROM turma_template_link ttl
    WHERE ca.disciplina_id = ttl.disciplina_id
      AND ttl.disciplina_template_id = NEW.disciplina_template_id
      AND ca.trimestre IS NOT DISTINCT FROM OLD.trimestre
      AND (
          ca.codigo_componente = OLD.codigo_componente
          OR ca.codigo_componente = NEW.codigo_componente
          OR ca.ordem IS NOT DISTINCT FROM OLD.ordem
      );

    UPDATE turma_template_link
    SET sincronizado_em = NOW()
    WHERE disciplina_template_id = NEW.disciplina_template_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_componente_template ON componentes_template;
CREATE TRIGGER trigger_sync_componente_template
    AFTER UPDATE ON componentes_template
    FOR EACH ROW
    EXECUTE FUNCTION sync_componente_template_changes();

COMMENT ON FUNCTION sync_componente_template_changes IS
'Propagates template component edits to componentes_avaliacao of linked turmas. Matches by código (old/new) or ordem within the same trimestre so renames still update mapas.';

CREATE OR REPLACE FUNCTION sync_deleted_componente_template()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM componentes_avaliacao ca
    USING turma_template_link ttl
    WHERE ca.disciplina_id = ttl.disciplina_id
      AND ttl.disciplina_template_id = OLD.disciplina_template_id
      AND ca.trimestre IS NOT DISTINCT FROM OLD.trimestre
      AND (
          ca.codigo_componente = OLD.codigo_componente
          OR ca.ordem IS NOT DISTINCT FROM OLD.ordem
      )
      AND NOT EXISTS (
          SELECT 1 FROM notas n WHERE n.componente_id = ca.id
      );

    UPDATE turma_template_link
    SET sincronizado_em = NOW()
    WHERE disciplina_template_id = OLD.disciplina_template_id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_deleted_componente_template ON componentes_template;
CREATE TRIGGER trigger_sync_deleted_componente_template
    AFTER DELETE ON componentes_template
    FOR EACH ROW
    EXECUTE FUNCTION sync_deleted_componente_template();

COMMENT ON FUNCTION sync_deleted_componente_template IS
'Removes deleted template components from linked turmas mapas when no grades exist. Uses IS NOT DISTINCT FROM for trimestre and also matches by ordem.';

-- INSERT path: NULL-safe trimestre match; never abort mapas sync when
-- associate_componente_to_disciplina rejects non-1/2/3 trimestre.
CREATE OR REPLACE FUNCTION sync_new_componente_template()
RETURNS TRIGGER AS $$
DECLARE
    v_link RECORD;
    v_componente_catalogo_id UUID;
    v_safe_is_calculated BOOLEAN;
BEGIN
    IF COALESCE(NEW.is_calculated, false) = true
       AND (NEW.formula_expression IS NULL OR trim(NEW.formula_expression) = '') THEN
        v_safe_is_calculated := false;
    ELSE
        v_safe_is_calculated := COALESCE(NEW.is_calculated, false);
    END IF;

    FOR v_link IN
        SELECT ttl.disciplina_id, ttl.turma_id, t.escola_id
        FROM turma_template_link ttl
        JOIN turmas t ON ttl.turma_id = t.id
        WHERE ttl.disciplina_template_id = NEW.disciplina_template_id
    LOOP
        v_componente_catalogo_id := get_or_create_componente_catalogo(
            v_link.escola_id,
            NEW.codigo_componente,
            NEW.nome,
            NEW.peso_percentual,
            NEW.escala_minima,
            NEW.escala_maxima,
            v_safe_is_calculated,
            NEW.formula_expression,
            COALESCE(
                (
                    SELECT array_agg(ct2.codigo_componente)
                    FROM componentes_template ct2
                    WHERE ct2.id::text IN (
                        SELECT jsonb_array_elements_text(
                            CASE
                                WHEN NEW.depends_on_components IS NULL THEN '[]'::jsonb
                                WHEN jsonb_typeof(NEW.depends_on_components) = 'array' THEN NEW.depends_on_components
                                ELSE '[]'::jsonb
                            END
                        )
                    )
                ),
                '{}'::text[]
            ),
            NEW.tipo_calculo,
            NEW.descricao
        );

        -- disciplina_componentes only accepts trimestre 1/2/3; skip without aborting mapas sync
        IF NEW.trimestre IN (1, 2, 3) THEN
            PERFORM associate_componente_to_disciplina(
                v_link.disciplina_id,
                v_componente_catalogo_id,
                NEW.trimestre,
                NEW.peso_percentual,
                NEW.ordem,
                NEW.obrigatorio
            );
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM componentes_avaliacao
            WHERE disciplina_id = v_link.disciplina_id
              AND codigo_componente = NEW.codigo_componente
              AND trimestre IS NOT DISTINCT FROM NEW.trimestre
        ) THEN
            INSERT INTO componentes_avaliacao (
                disciplina_id,
                turma_id,
                nome,
                codigo_componente,
                peso_percentual,
                escala_minima,
                escala_maxima,
                obrigatorio,
                ordem,
                descricao,
                trimestre,
                is_calculated,
                formula_expression,
                depends_on_components,
                tipo_calculo
            ) VALUES (
                v_link.disciplina_id,
                v_link.turma_id,
                NEW.nome,
                NEW.codigo_componente,
                NEW.peso_percentual,
                NEW.escala_minima,
                NEW.escala_maxima,
                NEW.obrigatorio,
                NEW.ordem,
                NEW.descricao,
                NEW.trimestre,
                v_safe_is_calculated,
                NEW.formula_expression,
                NEW.depends_on_components,
                NEW.tipo_calculo
            );
        END IF;
    END LOOP;

    UPDATE turma_template_link
    SET sincronizado_em = NOW()
    WHERE disciplina_template_id = NEW.disciplina_template_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_new_componente_template ON componentes_template;
CREATE TRIGGER trigger_sync_new_componente_template
    AFTER INSERT ON componentes_template
    FOR EACH ROW
    EXECUTE FUNCTION sync_new_componente_template();

COMMENT ON FUNCTION sync_new_componente_template IS
'Syncs new template components to linked turmas mapas. NULL-safe trimestre match; association to disciplina_componentes is skipped (not aborted) when trimestre is outside 1–3.';
