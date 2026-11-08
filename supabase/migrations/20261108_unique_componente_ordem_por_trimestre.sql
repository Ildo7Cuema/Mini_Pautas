-- Prevent two evaluation components from sharing the same position
-- inside the same discipline + trimestre (templates and mini-pauta).

-- 1) Repair any remaining duplicate ordens before adding the constraint.
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

WITH ranked_avaliacao AS (
    SELECT
        ca.id,
        ROW_NUMBER() OVER (
            PARTITION BY ca.disciplina_id, ca.trimestre
            ORDER BY COALESCE(ca.ordem, 9999), ca.created_at NULLS LAST, ca.codigo_componente
        ) AS new_ordem
    FROM componentes_avaliacao ca
)
UPDATE componentes_avaliacao ca
SET ordem = ra.new_ordem,
    updated_at = NOW()
FROM ranked_avaliacao ra
WHERE ca.id = ra.id
  AND ca.ordem IS DISTINCT FROM ra.new_ordem;

-- 2) Unique position per disciplina/template + trimestre
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'unique_componente_template_ordem_trimestre'
    ) THEN
        ALTER TABLE componentes_template
            ADD CONSTRAINT unique_componente_template_ordem_trimestre
            UNIQUE (disciplina_template_id, trimestre, ordem);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'unique_componente_avaliacao_ordem_trimestre'
    ) THEN
        ALTER TABLE componentes_avaliacao
            ADD CONSTRAINT unique_componente_avaliacao_ordem_trimestre
            UNIQUE (disciplina_id, trimestre, ordem);
    END IF;
END $$;

COMMENT ON CONSTRAINT unique_componente_template_ordem_trimestre ON componentes_template IS
'Each display position (ordem) is unique within a template disciplina + trimestre.';

COMMENT ON CONSTRAINT unique_componente_avaliacao_ordem_trimestre ON componentes_avaliacao IS
'Each display position (ordem) is unique within a turma disciplina + trimestre (mini-pauta).';
