-- ============================================
-- Confirmação de matrícula pela observação da Pauta Final
-- Transita  → classe seguinte
-- Não Transita → mesma classe
-- Migração: 20261031_confirmar_matricula_por_observacao_pauta.sql
-- ============================================

CREATE OR REPLACE FUNCTION confirmar_matricula(
    p_matricula_id UUID,
    p_turma_destino_id UUID,
    p_classe_destino TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_matricula RECORD;
    v_turma_destino RECORD;
    v_observacao TEXT;
    v_classe_esperada TEXT;
    v_classe_origem TEXT;
    v_num_origem INTEGER;
    v_num_esperada INTEGER;
    v_num_turma INTEGER;
    v_promove BOOLEAN;
BEGIN
    SELECT * INTO v_matricula
    FROM matriculas
    WHERE id = p_matricula_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Matrícula não encontrada: %', p_matricula_id;
    END IF;

    IF NOT user_belongs_to_escola(v_matricula.escola_id) THEN
        RAISE EXCEPTION 'Sem permissão para confirmar matrículas nesta escola';
    END IF;

    IF v_matricula.estado_matricula NOT IN ('pendente', 'exame_realizado') THEN
        RAISE EXCEPTION 'Matrícula já processada. Estado atual: %', v_matricula.estado_matricula;
    END IF;

    v_observacao := COALESCE(NULLIF(TRIM(v_matricula.status_transicao), ''), NULLIF(TRIM(v_matricula.observacao_padronizada), ''));

    IF v_observacao IS NULL OR v_observacao = 'AguardandoNotas' THEN
        RAISE EXCEPTION 'Não é possível confirmar matrícula sem observação definitiva da Pauta Final (Transita ou Não Transita)';
    END IF;

    IF v_observacao = 'Condicional' THEN
        RAISE EXCEPTION 'Aluno condicional deve realizar exame extraordinário antes da confirmação. A observação da Pauta Final ainda não é definitiva.';
    END IF;

    IF v_observacao NOT IN ('Transita', 'Não Transita') THEN
        RAISE EXCEPTION 'Observação da Pauta Final inválida para confirmação: %. Use Transita ou Não Transita.', v_observacao;
    END IF;

    v_classe_origem := COALESCE(NULLIF(TRIM(v_matricula.classe_origem), ''), NULLIF(TRIM(p_classe_destino), ''));

    IF v_observacao = 'Transita' THEN
        v_promove := true;
        v_classe_esperada := COALESCE(
            NULLIF(TRIM(p_classe_destino), ''),
            NULLIF(TRIM(v_matricula.classe_destino), ''),
            v_classe_origem
        );
        -- Se ainda for a mesma classe de origem, avançar 1 nível quando possível
        IF v_classe_esperada IS NOT NULL AND v_classe_origem IS NOT NULL
           AND regexp_replace(lower(v_classe_esperada), '\s+', '', 'g')
             = regexp_replace(lower(v_classe_origem), '\s+', '', 'g') THEN
            v_num_origem := NULLIF(regexp_replace(v_classe_origem, '\D', '', 'g'), '')::INTEGER;
            IF v_num_origem IS NOT NULL AND v_num_origem < 12 THEN
                v_classe_esperada := (v_num_origem + 1)::TEXT || 'ª Classe';
            END IF;
        ELSIF v_classe_esperada IS NULL AND v_classe_origem IS NOT NULL THEN
            v_num_origem := NULLIF(regexp_replace(v_classe_origem, '\D', '', 'g'), '')::INTEGER;
            IF v_num_origem IS NOT NULL AND v_num_origem < 12 THEN
                v_classe_esperada := (v_num_origem + 1)::TEXT || 'ª Classe';
            ELSE
                v_classe_esperada := v_classe_origem;
            END IF;
        END IF;
    ELSE
        -- Não Transita → permanece na mesma classe
        v_promove := false;
        v_classe_esperada := COALESCE(
            NULLIF(TRIM(v_matricula.classe_origem), ''),
            NULLIF(TRIM(p_classe_destino), '')
        );
    END IF;

    IF v_classe_esperada IS NULL OR TRIM(v_classe_esperada) = '' THEN
        RAISE EXCEPTION 'Não foi possível determinar a classe de destino a partir da observação da Pauta Final (%)', v_observacao;
    END IF;

    SELECT id, escola_id, ano_lectivo, nome INTO v_turma_destino
    FROM turmas WHERE id = p_turma_destino_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Turma de destino não encontrada';
    END IF;

    IF v_turma_destino.escola_id <> v_matricula.escola_id THEN
        RAISE EXCEPTION 'A turma de destino não pertence à mesma escola';
    END IF;

    IF v_turma_destino.ano_lectivo::TEXT IS DISTINCT FROM v_matricula.ano_lectivo_destino THEN
        RAISE EXCEPTION
            'A turma de destino pertence ao ano %, mas a matrícula é para %',
            v_turma_destino.ano_lectivo, v_matricula.ano_lectivo_destino;
    END IF;

    v_num_esperada := NULLIF(regexp_replace(v_classe_esperada, '\D', '', 'g'), '')::INTEGER;
    v_num_turma := NULLIF(regexp_replace(COALESCE(substring(v_turma_destino.nome from '\d+[ªº]?\s*[Cc]lasse'), v_turma_destino.nome), '\D', '', 'g'), '')::INTEGER;

    -- Validar que a turma corresponde à classe esperada pela observação
    IF v_num_esperada IS NOT NULL AND v_num_turma IS NOT NULL THEN
        IF v_num_esperada <> v_num_turma THEN
            IF v_promove THEN
                RAISE EXCEPTION
                    'Observação da Pauta Final: Transita. A turma "%" não é da classe seguinte (%).',
                    v_turma_destino.nome, v_classe_esperada;
            ELSE
                RAISE EXCEPTION
                    'Observação da Pauta Final: Não Transita. A turma "%" não é da mesma classe (%).',
                    v_turma_destino.nome, v_classe_esperada;
            END IF;
        END IF;
    ELSIF position(lower(v_classe_esperada) in lower(v_turma_destino.nome)) = 0 THEN
        RAISE EXCEPTION
            'A turma de destino "%" não corresponde à classe esperada "%" (observação: %).',
            v_turma_destino.nome, v_classe_esperada, v_observacao;
    END IF;

    UPDATE matriculas SET
        turma_destino_id = p_turma_destino_id,
        classe_destino = v_classe_esperada,
        estado_matricula = 'confirmada',
        confirmado_por = auth.uid(),
        confirmado_em = NOW(),
        updated_at = NOW()
    WHERE id = p_matricula_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION confirmar_matricula(UUID, UUID, TEXT) TO authenticated;
