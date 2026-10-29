-- ============================================
-- MIGRATION: Evitar violação de check_calculated_has_formula nos triggers de sincronização
-- Problema: ao adicionar a um template um componente do catálogo com
--           is_calculated = true e formula_expression NULL/vazia, o trigger
--           sync_new_componente_template copiava os valores tal como vinham para
--           componentes_avaliacao e violava a constraint check_calculated_has_formula
--           (erro 23514), revertendo também o insert em componentes_template.
-- Solução:  aplicar a mesma regra segura já usada em apply_template_to_turma
--           (migration 20260303): sem fórmula válida, is_calculated é gravado como false
--           em componentes_avaliacao. Nada mais é alterado.
-- Date: 2026-10-29
-- ============================================

-- ============================================
-- 1. sync_new_componente_template (template -> turmas ligadas)
--    Igual à versão 202603231900, com is_calculated "seguro".
-- ============================================
CREATE OR REPLACE FUNCTION sync_new_componente_template()
RETURNS TRIGGER AS $$
DECLARE
    v_link RECORD;
    v_escola_id UUID;
    v_componente_catalogo_id UUID;
    v_safe_is_calculated BOOLEAN;
BEGIN
    -- Sem fórmula válida, o componente não pode ser tratado como calculado
    IF COALESCE(NEW.is_calculated, false) = true
       AND (NEW.formula_expression IS NULL OR trim(NEW.formula_expression) = '') THEN
        v_safe_is_calculated := false;
        RAISE NOTICE 'Componente % (template %) marcado como calculado sem fórmula: sincronizado como não calculado.',
            NEW.codigo_componente, NEW.disciplina_template_id;
    ELSE
        v_safe_is_calculated := COALESCE(NEW.is_calculated, false);
    END IF;

    FOR v_link IN
        SELECT ttl.disciplina_id, ttl.turma_id, t.escola_id
        FROM turma_template_link ttl
        JOIN turmas t ON ttl.turma_id = t.id
        WHERE ttl.disciplina_template_id = NEW.disciplina_template_id
    LOOP
        -- Get or create in catalog
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

        -- Associate to disciplina (handles duplicate via upsert logic inside)
        PERFORM associate_componente_to_disciplina(
            v_link.disciplina_id,
            v_componente_catalogo_id,
            NEW.trimestre,
            NEW.peso_percentual,
            NEW.ordem,
            NEW.obrigatorio
        );

        -- Sync to componentes_avaliacao (backwards compatibility)
        IF NOT EXISTS (
            SELECT 1 FROM componentes_avaliacao
            WHERE disciplina_id = v_link.disciplina_id
              AND codigo_componente = NEW.codigo_componente
              AND trimestre = NEW.trimestre
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

-- Recria o trigger para garantir que aponta para a função actualizada
DROP TRIGGER IF EXISTS trigger_sync_new_componente_template ON componentes_template;

CREATE TRIGGER trigger_sync_new_componente_template
    AFTER INSERT ON componentes_template
    FOR EACH ROW
    EXECUTE FUNCTION sync_new_componente_template();

COMMENT ON FUNCTION sync_new_componente_template IS
'Syncs a new component from a template to all linked turmas.
Safe: if is_calculated = true but formula_expression is empty, it is synced as
is_calculated = false to respect check_calculated_has_formula.';

-- ============================================
-- 2. sync_catalogo_calculated_to_avaliacao (catálogo -> componentes_avaliacao)
--    Igual à versão 20260403, mas nunca grava is_calculated = true sem fórmula.
--    Se o catálogo ficar calculado sem fórmula, os registos existentes mantêm
--    os valores actuais (em vez de a actualização do catálogo falhar).
-- ============================================
CREATE OR REPLACE FUNCTION sync_catalogo_calculated_to_avaliacao()
RETURNS TRIGGER AS $$
DECLARE
    v_has_formula BOOLEAN;
BEGIN
    IF TG_OP = 'UPDATE' AND (
        OLD.is_calculated       IS DISTINCT FROM NEW.is_calculated OR
        OLD.formula_expression  IS DISTINCT FROM NEW.formula_expression OR
        OLD.tipo_calculo        IS DISTINCT FROM NEW.tipo_calculo
    ) THEN
        v_has_formula := NEW.formula_expression IS NOT NULL AND trim(NEW.formula_expression) <> '';

        IF COALESCE(NEW.is_calculated, false) = true AND NOT v_has_formula THEN
            -- Estado inválido para componentes_avaliacao: só sincroniza o tipo de cálculo
            UPDATE componentes_avaliacao ca
            SET tipo_calculo = COALESCE(NEW.tipo_calculo, 'trimestral')
            FROM turmas t
            WHERE ca.turma_id          = t.id
              AND t.escola_id          = NEW.escola_id
              AND ca.codigo_componente = NEW.codigo_componente;
        ELSE
            UPDATE componentes_avaliacao ca
            SET
                is_calculated      = COALESCE(NEW.is_calculated, false),
                formula_expression = NEW.formula_expression,
                tipo_calculo       = COALESCE(NEW.tipo_calculo, 'trimestral')
            FROM turmas t
            WHERE ca.turma_id          = t.id
              AND t.escola_id          = NEW.escola_id
              AND ca.codigo_componente = NEW.codigo_componente;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_catalogo_calculated_to_avaliacao
    ON componentes_catalogo;

CREATE TRIGGER trigger_sync_catalogo_calculated_to_avaliacao
    AFTER UPDATE ON componentes_catalogo
    FOR EACH ROW
    EXECUTE FUNCTION sync_catalogo_calculated_to_avaliacao();

COMMENT ON FUNCTION sync_catalogo_calculated_to_avaliacao IS
'Mantém is_calculated, formula_expression e tipo_calculo em componentes_avaliacao
sincronizados com componentes_catalogo. Não grava is_calculated = true sem fórmula.';
