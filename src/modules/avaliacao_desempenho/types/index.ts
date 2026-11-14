/**
 * Avaliação de Desempenho dos Agentes de Educação — DP 28/22
 * Fase 1: Escola · Fase 2: consolidado tutela (DME / Provincial)
 */

export type TipoPeriodoCiclo = 'ANO_LECTIVO' | 'ANO_CIVIL'
export type EstadoCiclo = 'ABERTO' | 'ENCERRADO'

export type InstrumentoCodigo = 'FICHA_DOCENTE' | 'FICHA_TECNICO_ADMIN'
export type AvaliadoTipo = 'PROFESSOR' | 'FUNCIONARIO'
export type PeriodoAvaliacao = 'TRIM1' | 'TRIM2' | 'TRIM3' | 'ANUAL'
export type GraduacaoIndicador = 5 | 10 | 15 | 20
export type MencaoClassificacao = 'MUITO_BOM' | 'BOM' | 'SUFICIENTE' | 'MAU'
export type EstadoAvaliacao =
    | 'RASCUNHO'
    | 'EM_AVALIACAO'
    | 'DIVULGADA'
    | 'ASSINADA'
    | 'CONCLUIDA'

export interface AdCiclo {
    id: string
    escola_id: string
    ano_referencia: string
    tipo_periodo: TipoPeriodoCiclo
    estado: EstadoCiclo
    observacoes?: string | null
    created_at?: string
    updated_at?: string
}

export interface AdInstrumento {
    codigo: InstrumentoCodigo
    anexo_ref: string
    nome: string
    descricao?: string | null
}

export interface AdIndicador {
    id: string
    instrumento_codigo: InstrumentoCodigo
    codigo: string
    nome: string
    coeficiente_ponderacao: number
    ordem: number
    ativo: boolean
}

export interface AdAvaliacaoScore {
    id?: string
    avaliacao_id?: string
    indicador_id: string
    graduacao: GraduacaoIndicador
    valor: number
    indicador?: AdIndicador
}

export interface AdAvaliacao {
    id: string
    ciclo_id: string
    escola_id: string
    avaliado_tipo: AvaliadoTipo
    professor_id: string | null
    funcionario_id: string | null
    avaliador_user_id: string | null
    instrumento_codigo: InstrumentoCodigo
    periodo: PeriodoAvaliacao
    objectivos_texto: string | null
    observacoes: string | null
    classificacao_final: number | null
    mencao: MencaoClassificacao | null
    estado: EstadoAvaliacao
    concordancia_avaliado: boolean | null
    assinado_em: string | null
    created_at?: string
    updated_at?: string
    /** joined */
    professor?: {
        id: string
        nome_completo: string
        email?: string | null
        user_id?: string | null
        numero_agente?: string | null
        especialidade?: string | null
        funcoes?: string[] | null
    } | null
    funcionario?: {
        id: string
        nome_completo: string
        categoria?: string | null
        cargo?: string | null
        subcategoria?: string | null
        user_id?: string | null
        numero_funcionario?: string | null
    } | null
    scores?: AdAvaliacaoScore[]
    ciclo?: AdCiclo | null
}

export interface MapaGeralLinha {
    nome: string
    categoria: string
    avaliado_tipo: AvaliadoTipo
    periodo: PeriodoAvaliacao
    classificacao_final: number | null
    mencao: MencaoClassificacao | null
    estado: EstadoAvaliacao
    ano_referencia: string
}

export interface CreateCicloInput {
    escola_id: string
    ano_referencia: string
    tipo_periodo: TipoPeriodoCiclo
    observacoes?: string
}

export interface SaveAvaliacaoInput {
    objectivos_texto?: string | null
    observacoes?: string | null
    estado?: EstadoAvaliacao
    scores: Array<{ indicador_id: string; graduacao: GraduacaoIndicador }>
}

/** Resumo por escola para DME / DP (consolidado automático). */
export interface EscolaAvaliacaoResumo {
    escola_id: string
    escola_nome: string
    municipio: string
    provincia: string
    ano_referencia: string | null
    ciclo_id: string | null
    ciclo_estado: EstadoCiclo | null
    total_fichas: number
    concluidas: number
    pendentes: number
    pct_conclusao: number
    media_classificacao: number | null
    mencoes: Record<MencaoClassificacao, number>
}

export interface MunicipioAvaliacaoResumo {
    municipio: string
    total_escolas: number
    escolas_com_ciclo: number
    total_fichas: number
    concluidas: number
    pct_conclusao: number
    media_classificacao: number | null
}

export interface ConsolidadoAvaliacaoTutela {
    ambito: 'municipio' | 'provincia'
    territorio: string
    ano_referencia: string | null
    anos_disponiveis: string[]
    total_escolas: number
    escolas_com_ciclo: number
    total_fichas: number
    concluidas: number
    pendentes: number
    pct_conclusao: number
    media_classificacao: number | null
    mencoes: Record<MencaoClassificacao, number>
    por_escola: EscolaAvaliacaoResumo[]
    por_municipio?: MunicipioAvaliacaoResumo[]
}
