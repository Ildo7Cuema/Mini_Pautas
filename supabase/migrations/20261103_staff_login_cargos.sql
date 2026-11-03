-- ============================================
-- MIGRATION: Staff login cargos (Directors + Técnico)
-- Purpose: Differentiate school staff login access by cargo
-- while keeping user_profiles.tipo_perfil = 'SECRETARIO' for RLS compatibility.
-- ============================================

-- 1) Cargo on secretarios (system access account)
ALTER TABLE secretarios
    ADD COLUMN IF NOT EXISTS cargo TEXT;

UPDATE secretarios
SET cargo = 'TECNICO_SECRETARIA'
WHERE cargo IS NULL OR cargo = '' OR cargo ILIKE 'secret%';

ALTER TABLE secretarios
    DROP CONSTRAINT IF EXISTS secretarios_cargo_check;

ALTER TABLE secretarios
    ADD CONSTRAINT secretarios_cargo_check
    CHECK (cargo IS NULL OR cargo IN (
        'TECNICO_SECRETARIA',
        'DIRECTOR_PEDAGOGICO',
        'DIRECTOR_ADMINISTRATIVO'
    ));

COMMENT ON COLUMN secretarios.cargo IS
    'Access profile: TECNICO_SECRETARIA | DIRECTOR_PEDAGOGICO | DIRECTOR_ADMINISTRATIVO';

-- 2) Pedagogical read access for school staff with SECRETARIO profile
-- (Director Pedagógico needs reports/pautas; Dir. Administrativo may consult classes)

DROP POLICY IF EXISTS "SECRETARIO can view school disciplinas" ON disciplinas;
CREATE POLICY "SECRETARIO can view school disciplinas"
    ON disciplinas FOR SELECT
    USING (
        turma_id IN (
            SELECT id FROM turmas
            WHERE escola_id IN (
                SELECT escola_id FROM user_profiles
                WHERE user_id = auth.uid()
                  AND tipo_perfil = 'SECRETARIO'
                  AND ativo = true
            )
        )
    );

DROP POLICY IF EXISTS "SECRETARIO can view school componentes" ON componentes_avaliacao;
CREATE POLICY "SECRETARIO can view school componentes"
    ON componentes_avaliacao FOR SELECT
    USING (
        turma_id IN (
            SELECT id FROM turmas
            WHERE escola_id IN (
                SELECT escola_id FROM user_profiles
                WHERE user_id = auth.uid()
                  AND tipo_perfil = 'SECRETARIO'
                  AND ativo = true
            )
        )
    );

DROP POLICY IF EXISTS "SECRETARIO can view school notas" ON notas;
CREATE POLICY "SECRETARIO can view school notas"
    ON notas FOR SELECT
    USING (
        turma_id IN (
            SELECT id FROM turmas
            WHERE escola_id IN (
                SELECT escola_id FROM user_profiles
                WHERE user_id = auth.uid()
                  AND tipo_perfil = 'SECRETARIO'
                  AND ativo = true
            )
        )
    );

DROP POLICY IF EXISTS "SECRETARIO can view school notas_finais" ON notas_finais;
CREATE POLICY "SECRETARIO can view school notas_finais"
    ON notas_finais FOR SELECT
    USING (
        turma_id IN (
            SELECT id FROM turmas
            WHERE escola_id IN (
                SELECT escola_id FROM user_profiles
                WHERE user_id = auth.uid()
                  AND tipo_perfil = 'SECRETARIO'
                  AND ativo = true
            )
        )
    );

-- Optional: turma_professores read for class oversight
DROP POLICY IF EXISTS "SECRETARIO can view school turma_professores" ON turma_professores;
CREATE POLICY "SECRETARIO can view school turma_professores"
    ON turma_professores FOR SELECT
    USING (
        turma_id IN (
            SELECT id FROM turmas
            WHERE escola_id IN (
                SELECT escola_id FROM user_profiles
                WHERE user_id = auth.uid()
                  AND tipo_perfil = 'SECRETARIO'
                  AND ativo = true
            )
        )
    );
