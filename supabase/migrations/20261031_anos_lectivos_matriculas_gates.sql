-- ============================================
-- Ciclo de Ano Lectivo + Gates de Matrículas
-- Migração: 20261031_anos_lectivos_matriculas_gates.sql
--
-- Regras:
-- 1) Matrículas só podem ser geradas depois do ano de origem
--    estar FECHADO e o ano de destino estar ABERTO.
-- 2) Encerrar o ano exige pautas finais (MF/MFD) completas
--    em todas as turmas/classes da escola nesse ano.
-- 3) Confirmação bloqueia status AguardandoNotas.
-- ============================================

-- ============================================
-- TABELA: anos_lectivos
-- ============================================

CREATE TABLE IF NOT EXISTS anos_lectivos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
    ano TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'aberto'
        CHECK (estado IN ('aberto', 'em_encerramento', 'fechado')),
    aberto_em TIMESTAMPTZ DEFAULT NOW(),
    aberto_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    fechado_em TIMESTAMPTZ,
    fechado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_anos_lectivos_escola_ano UNIQUE (escola_id, ano)
);

CREATE INDEX IF NOT EXISTS idx_anos_lectivos_escola ON anos_lectivos(escola_id);
CREATE INDEX IF NOT EXISTS idx_anos_lectivos_estado ON anos_lectivos(escola_id, estado);

ALTER TABLE anos_lectivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view anos_lectivos from their escola" ON anos_lectivos;
CREATE POLICY "Users can view anos_lectivos from their escola"
    ON anos_lectivos FOR SELECT
    USING (user_belongs_to_escola(escola_id));

DROP POLICY IF EXISTS "Users can insert anos_lectivos for their escola" ON anos_lectivos;
CREATE POLICY "Users can insert anos_lectivos for their escola"
    ON anos_lectivos FOR INSERT
    WITH CHECK (user_belongs_to_escola(escola_id));

DROP POLICY IF EXISTS "Users can update anos_lectivos from their escola" ON anos_lectivos;
CREATE POLICY "Users can update anos_lectivos from their escola"
    ON anos_lectivos FOR UPDATE
    USING (user_belongs_to_escola(escola_id));

DROP TRIGGER IF EXISTS update_anos_lectivos_updated_at ON anos_lectivos;
CREATE TRIGGER update_anos_lectivos_updated_at
    BEFORE UPDATE ON anos_lectivos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Bootstrap: anos já existentes nas turmas ficam como 'aberto'
INSERT INTO anos_lectivos (escola_id, ano, estado)
SELECT DISTINCT t.escola_id, t.ano_lectivo::TEXT, 'aberto'
FROM turmas t
WHERE t.escola_id IS NOT NULL
  AND t.ano_lectivo IS NOT NULL
  AND TRIM(t.ano_lectivo::TEXT) <> ''
ON CONFLICT (escola_id, ano) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON anos_lectivos TO authenticated;

-- ============================================
-- FUNÇÃO: Verificar prontidão das pautas finais
-- ============================================

CREATE OR REPLACE FUNCTION verificar_prontidao_pautas_finais(
    p_escola_id UUID,
    p_ano_lectivo TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_turma RECORD;
    v_total_turmas INTEGER := 0;
    v_turmas_prontas INTEGER := 0;
    v_turmas_sem_mf INTEGER := 0;
    v_turmas_incompletas INTEGER := 0;
    v_detalhes JSONB := '[]'::JSONB;
    v_componentes_mf INTEGER;
    v_alunos_ativos INTEGER;
    v_alunos_completos INTEGER;
    v_pronta BOOLEAN;
    v_motivo TEXT;
BEGIN
    IF NOT user_belongs_to_escola(p_escola_id) THEN
        RAISE EXCEPTION 'Sem permissão para consultar esta escola';
    END IF;

    FOR v_turma IN
        SELECT t.id, t.nome, t.nivel_ensino, t.ano_lectivo::TEXT AS ano_lectivo
        FROM turmas t
        WHERE t.escola_id = p_escola_id
          AND t.ano_lectivo::TEXT = p_ano_lectivo
        ORDER BY t.nome
    LOOP
        v_total_turmas := v_total_turmas + 1;

        SELECT COUNT(*) INTO v_componentes_mf
        FROM componentes_avaliacao ca
        WHERE ca.turma_id = v_turma.id
          AND ca.codigo_componente IN ('MF', 'MFD');

        SELECT COUNT(*) INTO v_alunos_ativos
        FROM alunos a
        WHERE a.turma_id = v_turma.id
          AND a.ativo = true;

        IF v_componentes_mf = 0 THEN
            v_turmas_sem_mf := v_turmas_sem_mf + 1;
            v_pronta := false;
            v_motivo := 'Sem componente final (MF/MFD) configurado';
            v_alunos_completos := 0;
        ELSIF v_alunos_ativos = 0 THEN
            -- Turma sem alunos activos conta como pronta (não bloqueia encerramento)
            v_turmas_prontas := v_turmas_prontas + 1;
            v_pronta := true;
            v_motivo := 'Sem alunos activos';
            v_alunos_completos := 0;
        ELSE
            -- Aluno completo = tem nota em TODOS os componentes MF/MFD da turma
            SELECT COUNT(*) INTO v_alunos_completos
            FROM alunos a
            WHERE a.turma_id = v_turma.id
              AND a.ativo = true
              AND (
                  SELECT COUNT(*)
                  FROM componentes_avaliacao ca
                  WHERE ca.turma_id = v_turma.id
                    AND ca.codigo_componente IN ('MF', 'MFD')
                    AND EXISTS (
                        SELECT 1 FROM notas n
                        WHERE n.aluno_id = a.id
                          AND n.componente_id = ca.id
                          AND n.turma_id = v_turma.id
                          AND n.valor IS NOT NULL
                    )
              ) = v_componentes_mf;

            IF v_alunos_completos = v_alunos_ativos THEN
                v_turmas_prontas := v_turmas_prontas + 1;
                v_pronta := true;
                v_motivo := 'Pauta final completa';
            ELSE
                v_turmas_incompletas := v_turmas_incompletas + 1;
                v_pronta := false;
                v_motivo := format(
                    '%s de %s alunos sem notas finais (MF/MFD) completas',
                    v_alunos_ativos - v_alunos_completos,
                    v_alunos_ativos
                );
            END IF;
        END IF;

        v_detalhes := v_detalhes || jsonb_build_array(
            jsonb_build_object(
                'turma_id', v_turma.id,
                'turma_nome', v_turma.nome,
                'nivel_ensino', v_turma.nivel_ensino,
                'pronta', v_pronta,
                'motivo', v_motivo,
                'alunos_ativos', v_alunos_ativos,
                'alunos_completos', v_alunos_completos,
                'componentes_mf', v_componentes_mf
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'escola_id', p_escola_id,
        'ano_lectivo', p_ano_lectivo,
        'pronta', (v_total_turmas > 0 AND v_turmas_prontas = v_total_turmas),
        'total_turmas', v_total_turmas,
        'turmas_prontas', v_turmas_prontas,
        'turmas_sem_mf', v_turmas_sem_mf,
        'turmas_incompletas', v_turmas_incompletas,
        'turmas', v_detalhes
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNÇÃO: Abrir ano lectivo
-- ============================================

CREATE OR REPLACE FUNCTION abrir_ano_lectivo(
    p_escola_id UUID,
    p_ano TEXT,
    p_observacao TEXT DEFAULT NULL
)
RETURNS anos_lectivos AS $$
DECLARE
    v_row anos_lectivos;
BEGIN
    IF NOT user_belongs_to_escola(p_escola_id) THEN
        RAISE EXCEPTION 'Sem permissão para abrir ano lectivo nesta escola';
    END IF;

    IF p_ano IS NULL OR TRIM(p_ano) = '' THEN
        RAISE EXCEPTION 'Ano lectivo inválido';
    END IF;

    INSERT INTO anos_lectivos (escola_id, ano, estado, aberto_em, aberto_por, observacao)
    VALUES (p_escola_id, TRIM(p_ano), 'aberto', NOW(), auth.uid(), p_observacao)
    ON CONFLICT (escola_id, ano) DO UPDATE
        SET estado = CASE
                WHEN anos_lectivos.estado = 'fechado' THEN anos_lectivos.estado
                ELSE 'aberto'
            END,
            aberto_em = COALESCE(anos_lectivos.aberto_em, NOW()),
            aberto_por = COALESCE(anos_lectivos.aberto_por, auth.uid()),
            observacao = COALESCE(EXCLUDED.observacao, anos_lectivos.observacao),
            updated_at = NOW()
    RETURNING * INTO v_row;

    IF v_row.estado = 'fechado' THEN
        RAISE EXCEPTION 'O ano lectivo % já está encerrado e não pode ser reaberto por esta operação', p_ano;
    END IF;

    RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNÇÃO: Encerrar ano lectivo
-- ============================================

CREATE OR REPLACE FUNCTION encerrar_ano_lectivo(
    p_escola_id UUID,
    p_ano TEXT,
    p_forcar BOOLEAN DEFAULT false
)
RETURNS anos_lectivos AS $$
DECLARE
    v_prontidao JSONB;
    v_row anos_lectivos;
BEGIN
    IF NOT user_belongs_to_escola(p_escola_id) THEN
        RAISE EXCEPTION 'Sem permissão para encerrar ano lectivo nesta escola';
    END IF;

    -- Garantir registo do ano
    INSERT INTO anos_lectivos (escola_id, ano, estado, aberto_por)
    VALUES (p_escola_id, TRIM(p_ano), 'aberto', auth.uid())
    ON CONFLICT (escola_id, ano) DO NOTHING;

    SELECT * INTO v_row
    FROM anos_lectivos
    WHERE escola_id = p_escola_id AND ano = TRIM(p_ano);

    IF v_row.estado = 'fechado' THEN
        RETURN v_row;
    END IF;

    v_prontidao := verificar_prontidao_pautas_finais(p_escola_id, TRIM(p_ano));

    IF (v_prontidao->>'total_turmas')::INTEGER = 0 THEN
        RAISE EXCEPTION 'Não existem turmas no ano lectivo %. Crie turmas antes de encerrar.', p_ano;
    END IF;

    IF NOT (v_prontidao->>'pronta')::BOOLEAN AND NOT p_forcar THEN
        RAISE EXCEPTION
            'Não é possível encerrar o ano %. Pautas finais incompletas: % turma(s) pronta(s) de %. Complete as MF/MFD de todas as turmas.',
            p_ano,
            v_prontidao->>'turmas_prontas',
            v_prontidao->>'total_turmas';
    END IF;

    UPDATE anos_lectivos
    SET estado = 'fechado',
        fechado_em = NOW(),
        fechado_por = auth.uid(),
        updated_at = NOW()
    WHERE id = v_row.id
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNÇÃO: Estado do ciclo (origem + destino)
-- ============================================

CREATE OR REPLACE FUNCTION obter_estado_ciclo_matriculas(
    p_escola_id UUID,
    p_ano_origem TEXT,
    p_ano_destino TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_origem_estado TEXT;
    v_destino_estado TEXT;
    v_origem_existe BOOLEAN;
    v_destino_existe BOOLEAN;
    v_prontidao JSONB;
BEGIN
    IF NOT user_belongs_to_escola(p_escola_id) THEN
        RAISE EXCEPTION 'Sem permissão para consultar esta escola';
    END IF;

    SELECT estado INTO v_origem_estado
    FROM anos_lectivos
    WHERE escola_id = p_escola_id AND ano = TRIM(p_ano_origem);
    v_origem_existe := FOUND;

    SELECT estado INTO v_destino_estado
    FROM anos_lectivos
    WHERE escola_id = p_escola_id AND ano = TRIM(p_ano_destino);
    v_destino_existe := FOUND;

    v_prontidao := verificar_prontidao_pautas_finais(p_escola_id, TRIM(p_ano_origem));

    RETURN jsonb_build_object(
        'ano_origem', TRIM(p_ano_origem),
        'ano_destino', TRIM(p_ano_destino),
        'origem_existe', v_origem_existe,
        'origem_estado', COALESCE(v_origem_estado, 'inexistente'),
        'destino_existe', v_destino_existe,
        'destino_estado', COALESCE(v_destino_estado, 'inexistente'),
        'pode_gerar_matriculas',
            COALESCE(v_origem_estado, 'inexistente') = 'fechado'
            AND COALESCE(v_destino_estado, 'inexistente') = 'aberto',
        'prontidao_pautas', v_prontidao
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ACTUALIZAR: gerar_matriculas_pendentes (gates)
-- ============================================

CREATE OR REPLACE FUNCTION gerar_matriculas_pendentes(
    p_turma_id UUID,
    p_ano_lectivo_destino TEXT
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_turma RECORD;
    v_aluno RECORD;
    v_origem_estado TEXT;
    v_destino_estado TEXT;
    v_prontidao JSONB;
    v_turma_detalhe JSONB;
BEGIN
    SELECT id, escola_id, ano_lectivo, nivel_ensino, nome INTO v_turma
    FROM turmas WHERE id = p_turma_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Turma não encontrada: %', p_turma_id;
    END IF;

    IF NOT user_belongs_to_escola(v_turma.escola_id) THEN
        RAISE EXCEPTION 'Sem permissão para gerar matrículas nesta escola';
    END IF;

    -- Garantir registo do ano de origem a partir das turmas existentes
    INSERT INTO anos_lectivos (escola_id, ano, estado, aberto_por)
    VALUES (v_turma.escola_id, v_turma.ano_lectivo::TEXT, 'aberto', auth.uid())
    ON CONFLICT (escola_id, ano) DO NOTHING;

    SELECT estado INTO v_origem_estado
    FROM anos_lectivos
    WHERE escola_id = v_turma.escola_id
      AND ano = v_turma.ano_lectivo::TEXT;

    SELECT estado INTO v_destino_estado
    FROM anos_lectivos
    WHERE escola_id = v_turma.escola_id
      AND ano = TRIM(p_ano_lectivo_destino);

    IF v_origem_estado IS DISTINCT FROM 'fechado' THEN
        RAISE EXCEPTION
            'O ano lectivo de origem % ainda não foi encerrado. Encerre o ano (com pautas finais completas) antes de gerar matrículas.',
            v_turma.ano_lectivo;
    END IF;

    IF v_destino_estado IS NULL THEN
        RAISE EXCEPTION
            'O ano lectivo de destino % ainda não foi aberto. Abra o novo ano lectivo antes de gerar matrículas.',
            p_ano_lectivo_destino;
    END IF;

    IF v_destino_estado IS DISTINCT FROM 'aberto' THEN
        RAISE EXCEPTION
            'O ano lectivo de destino % não está aberto (estado: %).',
            p_ano_lectivo_destino, v_destino_estado;
    END IF;

    -- Validar pauta final desta turma
    v_prontidao := verificar_prontidao_pautas_finais(v_turma.escola_id, v_turma.ano_lectivo::TEXT);
    SELECT t INTO v_turma_detalhe
    FROM jsonb_array_elements(v_prontidao->'turmas') AS t
    WHERE t->>'turma_id' = p_turma_id::TEXT
    LIMIT 1;

    IF v_turma_detalhe IS NULL OR NOT COALESCE((v_turma_detalhe->>'pronta')::BOOLEAN, false) THEN
        RAISE EXCEPTION
            'A turma % não tem pauta final completa. %',
            v_turma.nome,
            COALESCE(v_turma_detalhe->>'motivo', 'Verifique as notas MF/MFD');
    END IF;

    FOR v_aluno IN
        SELECT a.id, a.numero_processo, a.frequencia_anual
        FROM alunos a
        WHERE a.turma_id = p_turma_id AND a.ativo = true
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM matriculas
            WHERE aluno_id = v_aluno.id
              AND ano_lectivo_origem = v_turma.ano_lectivo::TEXT
              AND ano_lectivo_destino = TRIM(p_ano_lectivo_destino)
        ) THEN
            INSERT INTO matriculas (
                aluno_id,
                escola_id,
                turma_origem_id,
                ano_lectivo_origem,
                ano_lectivo_destino,
                status_transicao,
                estado_matricula,
                frequencia_anual,
                criado_por
            ) VALUES (
                v_aluno.id,
                v_turma.escola_id,
                p_turma_id,
                v_turma.ano_lectivo::TEXT,
                TRIM(p_ano_lectivo_destino),
                'AguardandoNotas',
                'pendente',
                v_aluno.frequencia_anual,
                auth.uid()
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNÇÃO: Gerar matrículas de TODAS as turmas do ano
-- ============================================

CREATE OR REPLACE FUNCTION gerar_matriculas_ano_lectivo(
    p_escola_id UUID,
    p_ano_origem TEXT,
    p_ano_destino TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_turma RECORD;
    v_geradas INTEGER := 0;
    v_total INTEGER := 0;
    v_turmas INTEGER := 0;
    v_detalhes JSONB := '[]'::JSONB;
    v_count INTEGER;
BEGIN
    IF NOT user_belongs_to_escola(p_escola_id) THEN
        RAISE EXCEPTION 'Sem permissão para gerar matrículas nesta escola';
    END IF;

    FOR v_turma IN
        SELECT id, nome
        FROM turmas
        WHERE escola_id = p_escola_id
          AND ano_lectivo::TEXT = TRIM(p_ano_origem)
        ORDER BY nome
    LOOP
        v_turmas := v_turmas + 1;
        v_count := gerar_matriculas_pendentes(v_turma.id, TRIM(p_ano_destino));
        v_geradas := v_geradas + v_count;
        v_total := v_total + v_count;
        v_detalhes := v_detalhes || jsonb_build_array(
            jsonb_build_object(
                'turma_id', v_turma.id,
                'turma_nome', v_turma.nome,
                'matriculas_geradas', v_count
            )
        );
    END LOOP;

    IF v_turmas = 0 THEN
        RAISE EXCEPTION 'Não existem turmas no ano lectivo de origem %', p_ano_origem;
    END IF;

    RETURN jsonb_build_object(
        'turmas_processadas', v_turmas,
        'matriculas_geradas', v_geradas,
        'detalhes', v_detalhes
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ACTUALIZAR: confirmar_matricula pela observação da Pauta Final
-- Transita → classe seguinte | Não Transita → mesma classe
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

GRANT EXECUTE ON FUNCTION verificar_prontidao_pautas_finais(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION abrir_ano_lectivo(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION encerrar_ano_lectivo(UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION obter_estado_ciclo_matriculas(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION gerar_matriculas_pendentes(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION gerar_matriculas_ano_lectivo(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION confirmar_matricula(UUID, UUID, TEXT) TO authenticated;
