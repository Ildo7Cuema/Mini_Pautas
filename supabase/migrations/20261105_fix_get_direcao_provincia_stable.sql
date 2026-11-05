-- Fix: get_direcao_provincia() was STABLE but contained UPDATE role_cache
-- → Postgres error 0A000 "UPDATE is not allowed in a non-volatile function"
-- when RLS policies call it (direcoes_municipais, circulares_provinciais, etc.)

CREATE OR REPLACE FUNCTION get_direcao_provincia()
RETURNS TEXT AS $$
DECLARE
    result_provincia TEXT;
BEGIN
    SELECT provincia INTO result_provincia
    FROM role_cache
    WHERE user_id = auth.uid()
      AND is_direcao_provincial = true
      AND provincia IS NOT NULL;

    IF result_provincia IS NULL THEN
        SELECT dp.provincia INTO result_provincia
        FROM direcoes_provinciais dp
        WHERE dp.user_id = auth.uid()
          AND dp.ativo = true;
    END IF;

    IF result_provincia IS NULL THEN
        SELECT dp.provincia INTO result_provincia
        FROM pessoal_direcao_provincial p
        JOIN direcoes_provinciais dp ON dp.id = p.direcao_provincial_id
        WHERE p.user_id = auth.uid()
          AND p.ativo = true
          AND dp.ativo = true;
    END IF;

    RETURN result_provincia;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_direcao_provincia() TO authenticated;
