-- Migração RAA: Ensino Primário escala 1–10 (não privada).
-- Converte notas existentes 0–20 → 1–10 com clamp(round(valor/2), 1, 10).
-- Escolas com configuracoes.natureza = 'privada' são excluídas.

-- 1) Templates de componentes do primário (classes 1ª–6ª)
UPDATE componentes_template ct
SET
    escala_minima = 1,
    escala_maxima = 10
FROM disciplinas_template dt
JOIN escolas e ON e.id = dt.escola_id
WHERE ct.disciplina_template_id = dt.id
  AND (
      dt.classe ILIKE '%1ª%' OR dt.classe ILIKE '%1a%' OR dt.classe ILIKE '1 %'
      OR dt.classe ILIKE '%2ª%' OR dt.classe ILIKE '%2a%'
      OR dt.classe ILIKE '%3ª%' OR dt.classe ILIKE '%3a%'
      OR dt.classe ILIKE '%4ª%' OR dt.classe ILIKE '%4a%'
      OR dt.classe ILIKE '%5ª%' OR dt.classe ILIKE '%5a%'
      OR dt.classe ILIKE '%6ª%' OR dt.classe ILIKE '%6a%'
  )
  AND COALESCE(e.configuracoes->>'natureza', 'publica') <> 'privada'
  AND (ct.escala_maxima IS DISTINCT FROM 10 OR ct.escala_minima IS DISTINCT FROM 1);

-- 2) Componentes de avaliação em turmas do Ensino Primário
UPDATE componentes_avaliacao ca
SET
    escala_minima = 1,
    escala_maxima = 10
FROM disciplinas d
JOIN turmas t ON t.id = d.turma_id
JOIN escolas e ON e.id = t.escola_id
WHERE ca.disciplina_id = d.id
  AND (
      COALESCE(t.nivel_ensino, '') ILIKE '%primar%'
      OR t.nome ILIKE '%1ª%' OR t.nome ILIKE '%2ª%' OR t.nome ILIKE '%3ª%'
      OR t.nome ILIKE '%4ª%' OR t.nome ILIKE '%5ª%' OR t.nome ILIKE '%6ª%'
  )
  AND COALESCE(t.nivel_ensino, '') NOT ILIKE '%secund%'
  AND COALESCE(e.configuracoes->>'natureza', 'publica') <> 'privada'
  AND (ca.escala_maxima IS DISTINCT FROM 10 OR ca.escala_minima IS DISTINCT FROM 1);

-- 3) Normalizar notas lançadas nestes componentes (apenas que ainda estejam em escala ~0–20)
UPDATE notas n
SET valor = LEAST(10, GREATEST(1, ROUND(n.valor / 2.0)))
FROM componentes_avaliacao ca
JOIN disciplinas d ON d.id = ca.disciplina_id
JOIN turmas t ON t.id = d.turma_id
JOIN escolas e ON e.id = t.escola_id
WHERE n.componente_id = ca.id
  AND (
      COALESCE(t.nivel_ensino, '') ILIKE '%primar%'
      OR t.nome ILIKE '%1ª%' OR t.nome ILIKE '%2ª%' OR t.nome ILIKE '%3ª%'
      OR t.nome ILIKE '%4ª%' OR t.nome ILIKE '%5ª%' OR t.nome ILIKE '%6ª%'
  )
  AND COALESCE(t.nivel_ensino, '') NOT ILIKE '%secund%'
  AND COALESCE(e.configuracoes->>'natureza', 'publica') <> 'privada'
  AND n.valor IS NOT NULL
  AND n.valor > 10;

-- 4) Notas finais (quando existirem) no primário — mesma conversão
UPDATE notas_finais nf
SET nota_final = LEAST(10, GREATEST(1, ROUND(nf.nota_final / 2.0)))
FROM alunos a
JOIN turmas t ON t.id = a.turma_id
JOIN escolas e ON e.id = t.escola_id
WHERE nf.aluno_id = a.id
  AND (
      COALESCE(t.nivel_ensino, '') ILIKE '%primar%'
      OR t.nome ILIKE '%1ª%' OR t.nome ILIKE '%2ª%' OR t.nome ILIKE '%3ª%'
      OR t.nome ILIKE '%4ª%' OR t.nome ILIKE '%5ª%' OR t.nome ILIKE '%6ª%'
  )
  AND COALESCE(t.nivel_ensino, '') NOT ILIKE '%secund%'
  AND COALESCE(e.configuracoes->>'natureza', 'publica') <> 'privada'
  AND nf.nota_final IS NOT NULL
  AND nf.nota_final > 10;

-- 5) Preencher natureza pública por defeito onde ainda não existe (não sobrescreve privada)
UPDATE escolas
SET configuracoes = COALESCE(configuracoes, '{}'::jsonb) || jsonb_build_object('natureza', 'publica')
WHERE COALESCE(configuracoes->>'natureza', '') = '';
