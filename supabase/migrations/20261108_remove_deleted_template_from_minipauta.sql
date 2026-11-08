-- Components removed from a discipline template must leave the mini-pauta,
-- including when grades already exist (notas cascade with the component).

CREATE OR REPLACE FUNCTION classes_same_grade(a TEXT, b TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    ga TEXT;
    gb TEXT;
BEGIN
    IF a IS NULL OR b IS NULL THEN
        RETURN FALSE;
    END IF;
    IF a = b OR a LIKE b || ' %' OR b LIKE a || ' %' THEN
        RETURN TRUE;
    END IF;
    ga := substring(a FROM '^([0-9]+ª[[:space:]]+Classe)');
    gb := substring(b FROM '^([0-9]+ª[[:space:]]+Classe)');
    RETURN ga IS NOT NULL AND ga = gb;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION sync_deleted_componente_template()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM componentes_avaliacao ca
    USING turma_template_link ttl
    WHERE ca.disciplina_id = ttl.disciplina_id
      AND ttl.disciplina_template_id = OLD.disciplina_template_id
      AND ca.trimestre IS NOT DISTINCT FROM OLD.trimestre
      AND ca.codigo_componente = OLD.codigo_componente;

    DELETE FROM disciplina_componentes dc
    USING turma_template_link ttl, componentes_catalogo cc, turmas t
    WHERE dc.disciplina_id = ttl.disciplina_id
      AND ttl.disciplina_template_id = OLD.disciplina_template_id
      AND ttl.turma_id = t.id
      AND cc.id = dc.componente_catalogo_id
      AND cc.escola_id = t.escola_id
      AND cc.codigo_componente = OLD.codigo_componente
      AND dc.trimestre IS NOT DISTINCT FROM OLD.trimestre;

    -- Ciências / Humanidades of the same grade must drop the component too.
    -- Guard avoids recursive fan-out; each sibling delete still clears its mini-pauta above.
    IF current_setting('app.syncing_componente_delete', true) IS DISTINCT FROM '1' THEN
        PERFORM set_config('app.syncing_componente_delete', '1', true);

        DELETE FROM componentes_template ct
        USING disciplinas_template src, disciplinas_template dst
        WHERE src.id = OLD.disciplina_template_id
          AND dst.escola_id = src.escola_id
          AND dst.nome = src.nome
          AND dst.id <> src.id
          AND classes_same_grade(dst.classe, src.classe)
          AND ct.disciplina_template_id = dst.id
          AND ct.codigo_componente = OLD.codigo_componente
          AND ct.trimestre IS NOT DISTINCT FROM OLD.trimestre;
    END IF;

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
'Removes deleted template components from linked turmas mini-pautas (componentes_avaliacao + disciplina_componentes). Grades cascade. Matches by código + trimestre only.';

-- Drop variant copies (Ciências/Humanidades) when the base class template no longer has them.
DELETE FROM componentes_template ct
USING disciplinas_template variant, disciplinas_template base
WHERE ct.disciplina_template_id = variant.id
  AND variant.escola_id = base.escola_id
  AND variant.nome = base.nome
  AND variant.id <> base.id
  AND variant.classe LIKE base.classe || ' %'
  AND NOT EXISTS (
      SELECT 1
      FROM componentes_template base_ct
      WHERE base_ct.disciplina_template_id = base.id
        AND base_ct.codigo_componente = ct.codigo_componente
        AND base_ct.trimestre IS NOT DISTINCT FROM ct.trimestre
  );

-- Catch components already removed from the template that are still on the mini-pauta.
DELETE FROM componentes_avaliacao ca
USING turma_template_link ttl
WHERE ca.disciplina_id = ttl.disciplina_id
  AND NOT EXISTS (
      SELECT 1
      FROM componentes_template ct
      WHERE ct.disciplina_template_id = ttl.disciplina_template_id
        AND ct.codigo_componente = ca.codigo_componente
        AND ct.trimestre IS NOT DISTINCT FROM ca.trimestre
  );

DELETE FROM disciplina_componentes dc
USING turma_template_link ttl, componentes_catalogo cc, turmas t
WHERE dc.disciplina_id = ttl.disciplina_id
  AND ttl.turma_id = t.id
  AND cc.id = dc.componente_catalogo_id
  AND cc.escola_id = t.escola_id
  AND NOT EXISTS (
      SELECT 1
      FROM componentes_template ct
      WHERE ct.disciplina_template_id = ttl.disciplina_template_id
        AND ct.codigo_componente = cc.codigo_componente
        AND ct.trimestre IS NOT DISTINCT FROM dc.trimestre
  );
