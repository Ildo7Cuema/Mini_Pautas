-- Fix template → turmas sync so renames (nome/código) always reach componentes_avaliacao.
-- Previous match used `ca.trimestre = OLD.trimestre`, which fails when trimestre IS NULL.

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
      AND ca.codigo_componente = OLD.codigo_componente
      AND ca.trimestre IS NOT DISTINCT FROM OLD.trimestre;

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
'Propagates template component edits (nome, código, fórmula, etc.) to componentes_avaliacao of linked turmas. Uses IS NOT DISTINCT FROM so NULL trimestres also match.';
