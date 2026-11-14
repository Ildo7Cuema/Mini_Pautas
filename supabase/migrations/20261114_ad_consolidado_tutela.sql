-- =============================================================================
-- Avaliação de Desempenho (DP 28/22) — leitura consolidada pela tutela
-- Direção Municipal / Provincial: SELECT nas tabelas ad_* das escolas do
-- município / província (Opção A — consolidado automático, sem escrita).
-- =============================================================================

-- Ciclos: DME
DROP POLICY IF EXISTS "ad_ciclos_select_tutela_municipal" ON ad_ciclos;
CREATE POLICY "ad_ciclos_select_tutela_municipal" ON ad_ciclos
    FOR SELECT TO authenticated
    USING (
        is_direcao_municipal()
        AND escola_in_direcao_municipio(escola_id)
    );

-- Ciclos: DP
DROP POLICY IF EXISTS "ad_ciclos_select_tutela_provincial" ON ad_ciclos;
CREATE POLICY "ad_ciclos_select_tutela_provincial" ON ad_ciclos
    FOR SELECT TO authenticated
    USING (
        is_direcao_provincial()
        AND escola_in_direcao_provincia(escola_id)
    );

-- Avaliações: DME
DROP POLICY IF EXISTS "ad_avaliacoes_select_tutela_municipal" ON ad_avaliacoes;
CREATE POLICY "ad_avaliacoes_select_tutela_municipal" ON ad_avaliacoes
    FOR SELECT TO authenticated
    USING (
        is_direcao_municipal()
        AND escola_in_direcao_municipio(escola_id)
    );

-- Avaliações: DP
DROP POLICY IF EXISTS "ad_avaliacoes_select_tutela_provincial" ON ad_avaliacoes;
CREATE POLICY "ad_avaliacoes_select_tutela_provincial" ON ad_avaliacoes
    FOR SELECT TO authenticated
    USING (
        is_direcao_provincial()
        AND escola_in_direcao_provincia(escola_id)
    );

-- Scores: DME (via avaliação da escola do município)
DROP POLICY IF EXISTS "ad_scores_select_tutela_municipal" ON ad_avaliacao_scores;
CREATE POLICY "ad_scores_select_tutela_municipal" ON ad_avaliacao_scores
    FOR SELECT TO authenticated
    USING (
        is_direcao_municipal()
        AND avaliacao_id IN (
            SELECT a.id FROM ad_avaliacoes a
            WHERE escola_in_direcao_municipio(a.escola_id)
        )
    );

-- Scores: DP
DROP POLICY IF EXISTS "ad_scores_select_tutela_provincial" ON ad_avaliacao_scores;
CREATE POLICY "ad_scores_select_tutela_provincial" ON ad_avaliacao_scores
    FOR SELECT TO authenticated
    USING (
        is_direcao_provincial()
        AND avaliacao_id IN (
            SELECT a.id FROM ad_avaliacoes a
            WHERE escola_in_direcao_provincia(a.escola_id)
        )
    );
