-- Funcionário provincial precisa de ler a Direção Provincial a que pertence
-- (login / perfil). A policy antiga só permitia user_id = auth.uid() na DP.

DROP POLICY IF EXISTS "Funcionario DP can view own direcao provincial"
    ON direcoes_provinciais;

CREATE POLICY "Funcionario DP can view own direcao provincial"
    ON direcoes_provinciais
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM pessoal_direcao_provincial p
            WHERE p.user_id = auth.uid()
              AND p.direcao_provincial_id = direcoes_provinciais.id
              AND p.ativo = true
        )
    );
