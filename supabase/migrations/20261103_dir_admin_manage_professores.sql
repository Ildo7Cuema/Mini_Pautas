-- ============================================
-- Director Administrativo: manage professores
-- Prefer secretarios.cargo; fallback to HR subcategoria
-- (funcionarios_escola) matched by email + escola.
-- ============================================

DROP POLICY IF EXISTS "Director Administrativo can view professores" ON professores;
CREATE POLICY "Director Administrativo can view professores"
    ON professores FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM secretarios s
            WHERE s.user_id = auth.uid()
              AND s.ativo = true
              AND s.escola_id = professores.escola_id
              AND (
                  COALESCE(s.cargo, '') = 'DIRECTOR_ADMINISTRATIVO'
                  OR EXISTS (
                      SELECT 1
                      FROM funcionarios_escola f
                      WHERE f.escola_id = s.escola_id
                        AND lower(coalesce(f.email, '')) = lower(coalesce(s.email, ''))
                        AND f.subcategoria = 'DIRECTOR_ADMINISTRATIVO'
                  )
              )
        )
    );

DROP POLICY IF EXISTS "Director Administrativo can insert professores" ON professores;
CREATE POLICY "Director Administrativo can insert professores"
    ON professores FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM secretarios s
            WHERE s.user_id = auth.uid()
              AND s.ativo = true
              AND s.escola_id = professores.escola_id
              AND (
                  COALESCE(s.cargo, '') = 'DIRECTOR_ADMINISTRATIVO'
                  OR EXISTS (
                      SELECT 1
                      FROM funcionarios_escola f
                      WHERE f.escola_id = s.escola_id
                        AND lower(coalesce(f.email, '')) = lower(coalesce(s.email, ''))
                        AND f.subcategoria = 'DIRECTOR_ADMINISTRATIVO'
                  )
              )
        )
    );

DROP POLICY IF EXISTS "Director Administrativo can update professores" ON professores;
CREATE POLICY "Director Administrativo can update professores"
    ON professores FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM secretarios s
            WHERE s.user_id = auth.uid()
              AND s.ativo = true
              AND s.escola_id = professores.escola_id
              AND (
                  COALESCE(s.cargo, '') = 'DIRECTOR_ADMINISTRATIVO'
                  OR EXISTS (
                      SELECT 1
                      FROM funcionarios_escola f
                      WHERE f.escola_id = s.escola_id
                        AND lower(coalesce(f.email, '')) = lower(coalesce(s.email, ''))
                        AND f.subcategoria = 'DIRECTOR_ADMINISTRATIVO'
                  )
              )
        )
    );

DROP POLICY IF EXISTS "Director Administrativo can delete professores" ON professores;
CREATE POLICY "Director Administrativo can delete professores"
    ON professores FOR DELETE
    USING (
        EXISTS (
            SELECT 1
            FROM secretarios s
            WHERE s.user_id = auth.uid()
              AND s.ativo = true
              AND s.escola_id = professores.escola_id
              AND (
                  COALESCE(s.cargo, '') = 'DIRECTOR_ADMINISTRATIVO'
                  OR EXISTS (
                      SELECT 1
                      FROM funcionarios_escola f
                      WHERE f.escola_id = s.escola_id
                        AND lower(coalesce(f.email, '')) = lower(coalesce(s.email, ''))
                        AND f.subcategoria = 'DIRECTOR_ADMINISTRATIVO'
                  )
              )
        )
    );
