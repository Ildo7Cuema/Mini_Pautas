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
    {
        id: 'avaliacao-desempenho-agentes',
        tag: 'Avaliação de Desempenho',
        title: 'Decreto Presidencial n.º 28/22 — Regime Jurídico da Avaliação de Desempenho dos Agentes de Educação',
        description:
            'Regras, procedimentos e critérios de avaliação de Educadores, Professores, Técnicos Pedagógicos e Especialistas de Administração da Educação. Instrumentos Anexos II–VIII; classificação Art. 20.º; mapa geral Art. 32.º. Revoga o Decreto n.º 7/08.',
        published: 'Diário da República Iª Série n.º 18 de 27 de Janeiro de 2022',
        url: 'https://lex.ao/docs/presidente-da-republica/2022/decreto-presidencial-n-o-28-22-de-27-de-janeiro/',
    },
    {
        id: 'proteccao-velhice',
        tag: 'Reforma / Tempo de Serviço',
        title: 'Decreto Presidencial n.º 299/20 — Regime Jurídico sobre a Protecção Social na Velhice',
        description:
            'Reforma por velhice aos 60 anos ou 420 meses de contribuições; prazo de garantia de 180 meses; redução de idade para mães trabalhadoras (1 ano por filho, máx. 5); contagem do tempo de serviço (Arts. 4.º, 7.º e 9.º). Aplicável aos agentes da educação no âmbito da Protecção Social Obrigatória.',
        published: 'Diário da República Iª Série n.º 186 de 23 de Novembro de 2020',
        url: 'https://lex.ao/docs/presidente-da-republica/2020/decreto-presidencial-n-o-299-20-de-23-de-novembro/',
    },
    {
        id: 'lei-bases-funcao-publica',
        tag: 'Função Pública',
        title: 'Lei n.º 26/22 — Lei de Bases da Função Pública',
        description:
            'Regime geral dos funcionários públicos, incluindo contagem de tempo de serviço em cargos de direcção e chefia para efeitos de carreira (Art. 54.º).',
        published: '22 de Agosto de 2022',
        url: 'https://inacom.gov.ao/wp-content/uploads/2025/08/Lei-de-Bases-da-Funcao-Publica.pdf',
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
