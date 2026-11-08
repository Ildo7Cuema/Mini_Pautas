-- =============================================================================
-- Fechar exposição pública perigosa (anon)
-- - escolas: SELECT USING (true) permitia enumerar TODAS as escolas
-- - transacoes_pagamento: INSERT WITH CHECK (true) permitia inserts arbitrários
-- O fluxo público passa a usar Edge Functions (service role) + rate limit.
-- =============================================================================

DROP POLICY IF EXISTS "Public can lookup schools for payment" ON escolas;

DROP POLICY IF EXISTS "Public can create payment transactions" ON transacoes_pagamento;

-- Manter preços activos visíveis (não sensível); reforçar que só activo=true
DROP POLICY IF EXISTS "Public can view license prices" ON precos_licenca;
CREATE POLICY "Public can view license prices"
    ON precos_licenca FOR SELECT
    TO anon
    USING (ativo = true);

COMMENT ON TABLE escolas IS
    'Lookup público de escolas: usar Edge Function public-school-lookup (não RLS anon SELECT all).';
