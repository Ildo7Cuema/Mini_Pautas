/**
 * Concursos Públicos — types
 */

export type EstadoConcurso = 'rascunho' | 'publicado' | 'encerrado'
export type EstadoAbertura = 'fechado' | 'aberto' | 'encerrado'
export type EstadoInscricao = 'recebida' | 'em_analise' | 'aceite' | 'rejeitada' | 'cancelada'
export type TipoRequisito = 'campo' | 'documento'
export type TipoCampoRequisito = 'texto' | 'numero' | 'data' | 'select' | 'textarea' | 'email' | 'telefone'

export interface ConcursoPublico {
    id: string
    direcao_provincial_id: string
    provincia: string
    titulo: string
    descricao: string | null
    instrucoes: string | null
    data_inicio: string | null
    data_fim: string | null
    estado: EstadoConcurso
    created_by: string | null
    created_at: string
    updated_at: string
    categorias?: ConcursoCategoria[]
    requisitos?: ConcursoRequisito[]
    aberturas_count?: number
    inscricoes_count?: number
}

export interface ConcursoCategoria {
    id: string
    concurso_id: string
    nome: string
    descricao: string | null
    idade_min: number | null
    idade_max: number | null
    ordem: number
    created_at?: string
}

export interface ConcursoRequisito {
    id: string
    concurso_id: string
    tipo: TipoRequisito
    codigo: string
    label: string
    descricao: string | null
    obrigatorio: boolean
    tipo_campo: TipoCampoRequisito | null
    opcoes: string[] | null
    permite_upload: boolean
    tipos_ficheiro: string[] | null
    tamanho_max_mb: number | null
    ordem: number
    created_at?: string
}

export interface CabecalhoConcursoPdf {
    logo_url?: string | null
    logo_width?: number
    logo_height?: number
    mostrar_republica?: boolean
    texto_republica?: string
    mostrar_governo_provincial?: boolean
    provincia?: string
    mostrar_orgao_educacao?: boolean
    nivel_ensino?: string
    municipio?: string
    nome_instituicao?: string
    tamanho_fonte?: number
}

export interface ConcursoAberturaMunicipal {
    id: string
    concurso_id: string
    direcao_municipal_id: string
    municipio: string
    provincia: string
    slug: string
    estado: EstadoAbertura
    data_abertura: string | null
    data_fecho: string | null
    cabecalho: CabecalhoConcursoPdf
    created_by: string | null
    created_at: string
    updated_at: string
    concurso?: ConcursoPublico
    inscricoes_count?: number
}

export interface ConcursoInscricaoDocumento {
    id: string
    inscricao_id: string
    requisito_id: string
    file_url: string
    filename: string
    mime_type: string | null
    tamanho_bytes: number | null
    created_at?: string
    requisito?: ConcursoRequisito
}

export interface ConcursoInscricao {
    id: string
    abertura_id: string
    concurso_id: string
    direcao_municipal_id: string
    categoria_id: string | null
    nome_completo: string
    data_nascimento: string
    idade: number | null
    genero: 'M' | 'F' | 'OUTRO' | null
    municipio: string
    bilhete_identidade: string | null
    telefone: string | null
    email: string | null
    campos_extra: Record<string, string>
    estado: EstadoInscricao
    observacoes: string | null
    created_at: string
    updated_at: string
    categoria?: ConcursoCategoria | null
    documentos?: ConcursoInscricaoDocumento[]
}

export interface CreateConcursoRequest {
    titulo: string
    descricao?: string
    instrucoes?: string
    data_inicio?: string | null
    data_fim?: string | null
    categorias: Omit<ConcursoCategoria, 'id' | 'concurso_id' | 'created_at'>[]
    requisitos: Omit<ConcursoRequisito, 'id' | 'concurso_id' | 'created_at'>[]
}

export interface PublicConcursoPayload {
    ok: boolean
    error?: string
    estado?: EstadoAbertura
    abertura?: {
        id: string
        slug: string
        municipio: string
        provincia: string
        data_abertura: string | null
        data_fecho: string | null
    }
    concurso?: {
        id: string
        titulo: string
        descricao: string | null
        instrucoes: string | null
        data_inicio: string | null
        data_fim: string | null
        provincia: string
    }
    categorias?: ConcursoCategoria[]
    requisitos?: ConcursoRequisito[]
}

export type OrdenacaoInscricoes = 'alfabetica' | 'idade' | 'categoria' | 'municipio' | 'data'

export const LABELS_ESTADO_CONCURSO: Record<EstadoConcurso, string> = {
    rascunho: 'Rascunho',
    publicado: 'Publicado',
    encerrado: 'Encerrado',
}

export const LABELS_ESTADO_ABERTURA: Record<EstadoAbertura, string> = {
    fechado: 'Fechado',
    aberto: 'Aberto',
    encerrado: 'Encerrado',
}

export const LABELS_ESTADO_INSCRICAO: Record<EstadoInscricao, string> = {
    recebida: 'Recebida',
    em_analise: 'Em análise',
    aceite: 'Aceite',
    rejeitada: 'Rejeitada',
    cancelada: 'Cancelada',
}

export const CORES_ESTADO_CONCURSO: Record<EstadoConcurso, { bg: string; text: string }> = {
    rascunho: { bg: 'bg-slate-100', text: 'text-slate-700' },
    publicado: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
    encerrado: { bg: 'bg-amber-100', text: 'text-amber-800' },
}

export const CORES_ESTADO_ABERTURA: Record<EstadoAbertura, { bg: string; text: string }> = {
    fechado: { bg: 'bg-slate-100', text: 'text-slate-700' },
    aberto: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
    encerrado: { bg: 'bg-amber-100', text: 'text-amber-800' },
}
