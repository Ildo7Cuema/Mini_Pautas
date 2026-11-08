-- Fix mapa/mini-pauta distortion when adding components to later trimesters:
-- 1) Sync UPDATE/DELETE must match by código within the same trimestre only
--    (never by ordem alone — shared ordem=1 corrupted sibling slots).
-- 2) Resequence duplicate ordens per (disciplina, trimestre) so positions stay stable.

CREATE OR REPLACE FUNCTION sync_componente_template_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_safe_is_calculated BOOLEAN;
    v_safe_formula TEXT;
BEGIN
    -- Respect check_calculated_has_formula: never push is_calculated=true with empty formula
    v_safe_formula := NULLIF(trim(COALESCE(NEW.formula_expression, '')), '');
    IF COALESCE(NEW.is_calculated, false) = true AND v_safe_formula IS NULL THEN
        v_safe_is_calculated := false;
    ELSE
        v_safe_is_calculated := COALESCE(NEW.is_calculated, false);
    END IF;

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
        is_calculated = v_safe_is_calculated,
        formula_expression = v_safe_formula,
        depends_on_components = NEW.depends_on_components,
        tipo_calculo = NEW.tipo_calculo,
        updated_at = NOW()
    FROM turma_template_link ttl
    WHERE ca.disciplina_id = ttl.disciplina_id
      AND ttl.disciplina_template_id = NEW.disciplina_template_id
      AND ca.trimestre IS NOT DISTINCT FROM OLD.trimestre
      AND (
          ca.codigo_componente = OLD.codigo_componente
          OR (
              NEW.codigo_componente IS DISTINCT FROM OLD.codigo_componente
              AND ca.codigo_componente = NEW.codigo_componente
          )
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
'Propagates template component edits to componentes_avaliacao of linked turmas. Matches by código within the same trimestre only (never by ordem alone). Sanitizes is_calculated when formula is empty to satisfy check_calculated_has_formula.';

CREATE OR REPLACE FUNCTION sync_deleted_componente_template()
RETURNS TRIGGER AS $$
BEGIN
    -- notas.componente_id cascades, so the column leaves the mini-pauta
    -- even when grades were already launched.
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

-- Keep INSERT path from preserve migration (NULL-safe trimestre; skip invalid associate).
CREATE OR REPLACE FUNCTION sync_new_componente_template()
RETURNS TRIGGER AS $$
DECLARE
    v_link RECORD;
    v_componente_catalogo_id UUID;
    v_safe_is_calculated BOOLEAN;
    v_ordem INTEGER;
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

        -- Prefer template ordem; if empty, append after existing slots in this trimestre
        v_ordem := COALESCE(NEW.ordem, 0);
        IF v_ordem <= 0 THEN
            SELECT COALESCE(MAX(ca.ordem), 0) + 1
              INTO v_ordem
              FROM componentes_avaliacao ca
             WHERE ca.disciplina_id = v_link.disciplina_id
               AND ca.trimestre IS NOT DISTINCT FROM NEW.trimestre;
        END IF;

        IF NEW.trimestre IN (1, 2, 3) THEN
            PERFORM associate_componente_to_disciplina(
                v_link.disciplina_id,
                v_componente_catalogo_id,
                NEW.trimestre,
                NEW.peso_percentual,
                v_ordem,
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
                v_ordem,
                NEW.descricao,
                NEW.trimestre,
                v_safe_is_calculated,
                NEW.formula_expression,
                NEW.depends_on_components,
                NEW.tipo_calculo
            );
        ELSE
            -- Align position/metadata without changing identity of the slot
            UPDATE componentes_avaliacao
            SET
                nome = NEW.nome,
                peso_percentual = NEW.peso_percentual,
                escala_minima = NEW.escala_minima,
                escala_maxima = NEW.escala_maxima,
                obrigatorio = NEW.obrigatorio,
                ordem = v_ordem,
                descricao = NEW.descricao,
                is_calculated = v_safe_is_calculated,
                formula_expression = NEW.formula_expression,
                depends_on_components = NEW.depends_on_components,
                tipo_calculo = NEW.tipo_calculo,
                updated_at = NOW()
            WHERE disciplina_id = v_link.disciplina_id
              AND codigo_componente = NEW.codigo_componente
              AND trimestre IS NOT DISTINCT FROM NEW.trimestre;
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
'Syncs new template components to linked turmas mapas with per-trimestre ordem. Matches existing rows by código+trimestre only.';

-- Repair duplicate/shared ordens inside each trimestre so mini-pauta columns stay stable.
-- Prefer the template ordem for the same código when a link exists; otherwise keep relative created_at.
WITH ranked_avaliacao AS (
    SELECT
        ca.id,
        ROW_NUMBER() OVER (
            PARTITION BY ca.disciplina_id, ca.trimestre
            ORDER BY
                COALESCE(
                    (
                        SELECT ct.ordem
                        FROM turma_template_link ttl
                        JOIN componentes_template ct
                          ON ct.disciplina_template_id = ttl.disciplina_template_id
                         AND ct.codigo_componente = ca.codigo_componente
                         AND ct.trimestre IS NOT DISTINCT FROM ca.trimestre
                        WHERE ttl.disciplina_id = ca.disciplina_id
                        LIMIT 1
                    ),
                    ca.ordem,
                    9999
                ),
                ca.created_at NULLS LAST,
                ca.codigo_componente
        ) AS new_ordem
    FROM componentes_avaliacao ca
)
UPDATE componentes_avaliacao ca
SET ordem = ra.new_ordem,
    updated_at = NOW()
FROM ranked_avaliacao ra
WHERE ca.id = ra.id
  AND ca.ordem IS DISTINCT FROM ra.new_ordem;

-- Ordem-only repair on templates must not fire full mapa sync (avoids pushing
-- legacy is_calculated=true + empty formula into componentes_avaliacao).
ALTER TABLE componentes_template DISABLE TRIGGER trigger_sync_componente_template;

WITH ranked_template AS (
    SELECT
        ct.id,
        ROW_NUMBER() OVER (
            PARTITION BY ct.disciplina_template_id, ct.trimestre
            ORDER BY COALESCE(ct.ordem, 9999), ct.created_at NULLS LAST, ct.codigo_componente
        ) AS new_ordem
    FROM componentes_template ct
)
UPDATE componentes_template ct
SET ordem = rt.new_ordem,
    updated_at = NOW()
FROM ranked_template rt
WHERE ct.id = rt.id
  AND ct.ordem IS DISTINCT FROM rt.new_ordem;

ALTER TABLE componentes_template ENABLE TRIGGER trigger_sync_componente_template;
