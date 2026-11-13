-- ============================================
-- Concordância da ficha: só o próprio avaliado (Art. 25.º DP 28/22)
-- Direcção / administrativo NÃO assina em nome de outrem.
-- ============================================

CREATE OR REPLACE FUNCTION ad_registar_concordancia(
    p_avaliacao_id UUID,
    p_concorda BOOLEAN
)
RETURNS ad_avaliacoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_row ad_avaliacoes%ROWTYPE;
    v_ok BOOLEAN := false;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Não autenticado';
    END IF;

    SELECT * INTO v_row
    FROM ad_avaliacoes
    WHERE id = p_avaliacao_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Avaliação não encontrada';
    END IF;

    IF v_row.concordancia_avaliado IS NOT NULL THEN
        RAISE EXCEPTION 'A concordância desta ficha já foi registada';
    END IF;

    -- Aceita DIVULGADA/EM_AVALIACAO; também CONCLUIDA se a escola avançou sem aguardar Art. 25.º
    IF v_row.estado NOT IN ('DIVULGADA', 'EM_AVALIACAO', 'CONCLUIDA') THEN
        RAISE EXCEPTION 'A ficha só pode ser assinada após divulgação ao avaliado';
    END IF;

    IF v_row.avaliado_tipo = 'PROFESSOR' AND v_row.professor_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM professores p
            WHERE p.id = v_row.professor_id
              AND p.user_id = v_uid
              AND p.ativo = true
        ) INTO v_ok;
    ELSIF v_row.avaliado_tipo = 'FUNCIONARIO' AND v_row.funcionario_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM funcionarios_escola f
            WHERE f.id = v_row.funcionario_id
              AND f.user_id = v_uid
              AND f.ativo = true
        ) INTO v_ok;
    END IF;

    IF NOT v_ok THEN
        RAISE EXCEPTION 'Apenas o próprio avaliado pode registar a concordância (Art. 25.º)';
    END IF;

    UPDATE ad_avaliacoes
    SET
        concordancia_avaliado = p_concorda,
        assinado_em = NOW(),
        estado = 'ASSINADA',
        updated_at = NOW()
    WHERE id = p_avaliacao_id
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION ad_registar_concordancia(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ad_registar_concordancia(UUID, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION ad_registar_concordancia(UUID, BOOLEAN) IS
    'DP 28/22 Art. 25.º — só o avaliado (professor/funcionário com user_id) regista concordância';
