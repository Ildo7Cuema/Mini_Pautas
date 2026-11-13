-- ============================================
-- Membros da escola podem LER o cabeçalho configurado
-- (exportação de PDFs: fichas, mapa, pautas, etc.)
-- Escrita continua restrita ao dono (user_id).
-- ============================================

DROP POLICY IF EXISTS "Membros da escola podem ver cabeçalho da escola"
    ON configuracao_cabecalho;

CREATE POLICY "Membros da escola podem ver cabeçalho da escola"
    ON configuracao_cabecalho
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.user_id = auth.uid()
              AND up.escola_id = configuracao_cabecalho.escola_id
              AND COALESCE(up.ativo, true) = true
        )
    );

COMMENT ON POLICY "Membros da escola podem ver cabeçalho da escola"
    ON configuracao_cabecalho IS
    'Permite a professores/staff da escola usar o cabeçalho das Configurações nas exportações PDF';
