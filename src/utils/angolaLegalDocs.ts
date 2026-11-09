/**
 * Diplomas oficiais do Ministério da Educação de Angola usados pelo EduGest.
 * Actualizar esta lista quando for publicada nova legislação.
 */

export interface AngolaLegalDoc {
    id: string
    tag: string
    title: string
    description: string
    published: string
    url: string
    /** Diploma de avaliação actualmente em vigor. */
    current?: boolean
    /** Relevante para regras de avaliação e frequência escolar. */
    avaliacaoFrequencia?: boolean
}

export const ANGOLA_LEGAL_DOCS: AngolaLegalDoc[] = [
    {
        id: 'raa',
        tag: 'Avaliação e Frequência',
        title: 'Decreto Executivo n.º 106/26 — Regulamento da Avaliação das Aprendizagens (RAA)',
        description:
            'Ministério da Educação. Escalas de classificação, arredondamento das notas, frequência mínima e regras de transição/retenção no Ensino Primário e Secundário Geral (revoga o Decreto Executivo n.º 424/25).',
        published: 'Publicado a 27 de Abril de 2026',
        url: 'https://www.angolex.com/paginas/decreto-executivo/regulamento-da-avaliacao-das-aprendizagens-dos-subsistemas-da-educacao-pre-escolar-ensino-geral-e-educacao-de-adultos-raa-106a-26a.html',
        current: true,
        avaliacaoFrequencia: true,
    },
    {
        id: 'regime-ensino-geral',
        tag: 'Sistema de Ensino',
        title: 'Decreto Presidencial n.º 162/23 — Regime Jurídico do Ensino Primário e Secundário',
        description:
            'Organização, gestão escolar e curricular das instituições do Subsistema de Ensino Geral, incluindo a avaliação das aprendizagens e os Exames Nacionais.',
        published: 'Publicado a 1 de Agosto de 2023',
        url: 'https://lex.ao/docs/presidente-da-republica/2023/decreto-presidencial-n-o-162-23-de-01-de-agosto/',
        avaliacaoFrequencia: true,
    },
    {
        id: 'lei-bases',
        tag: 'Lei de Bases',
        title: 'Lei n.º 17/16, alterada e republicada pela Lei n.º 32/20 — Lei de Bases do Sistema de Educação e Ensino',
        description: 'Princípios, objectivos e estrutura do Sistema de Educação e Ensino de Angola.',
        published: 'Lei n.º 32/20, de 12 de Agosto de 2020',
        url: 'https://lex.ao/docs/assembleia-nacional/2020/lei-n-o-32-20-de-12-de-agosto/',
    },
]

export const MED_NORMATIVOS_URL = 'https://xilonga.med.gov.ao/normativos'

/** Diplomas centrados no processo de avaliação e frequência. */
export function getAvaliacaoFrequenciaDocs(): AngolaLegalDoc[] {
    return ANGOLA_LEGAL_DOCS.filter(d => d.avaliacaoFrequencia)
}

/**
 * Resumo operacional (para leitura rápida no produto) alinhado às regras
 * aplicadas pelo sistema: notas + frequência ≥ 66,67%.
 */
export const AVALIACAO_FREQUENCIA_RESUMO = [
    'A decisão de Transita / Não Transita combina o resultado académico (notas) com a frequência anual.',
    'Escala oficial RAA: Ensino Primário 1–10 valores; Ensino Secundário 0–20 valores (instituições privadas podem definir escala própria).',
    'Ensino Primário: transitam alunos com classificação final ≥ 5 valores em todas as disciplinas e frequência anual ≥ 66,67%.',
    'Ensino Secundário: aplicam-se os limiares e excepções do RAA (incluindo matrícula condicional quando prevista).',
    'Frequência anual inferior a 66,67% implica Não Transita, mesmo com médias positivas e sem disciplinas reprovadas.',
] as const
