-- Contexto de login do funcionário provincial (bypass RLS na leitura da DP).
-- Usado pelo AuthContext para não expulsar o utilizador quando a policy
-- de SELECT em direcoes_provinciais ainda não permite o staff.

CREATE OR REPLACE FUNCTION get_funcionario_provincial_login_context()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pessoal pessoal_direcao_provincial%ROWTYPE;
    v_dp direcoes_provinciais%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
    END IF;

    SELECT * INTO v_pessoal
    FROM pessoal_direcao_provincial
    WHERE user_id = auth.uid()
      AND ativo = true
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'pessoal_not_found');
    END IF;

    SELECT * INTO v_dp
    FROM direcoes_provinciais
    WHERE id = v_pessoal.direcao_provincial_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'direcao_missing');
    END IF;

    IF v_dp.ativo IS NOT TRUE THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'direcao_inactive',
            'direcao', to_jsonb(v_dp),
            'pessoal', to_jsonb(v_pessoal)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'pessoal', to_jsonb(v_pessoal),
        'direcao', to_jsonb(v_dp)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_funcionario_provincial_login_context() TO authenticated;
