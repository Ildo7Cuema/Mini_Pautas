/**
 * Acesso do pessoal da Direção Provincial por departamento
 * (Gabinete Provincial da Educação — Decreto 202/19 / Estatutos 2024).
 */

export type DepartamentoProvincial =
    | 'EDUCACAO_ENSINO'
    | 'PLANEAMENTO_RH'
    | 'INSPECCAO_SUPERVISAO'
    | 'CIENCIA_TECNOLOGIA'

export const DEPARTAMENTO_PROVINCIAL_LABELS: Record<DepartamentoProvincial, string> = {
    EDUCACAO_ENSINO: 'Educação e Ensino',
    PLANEAMENTO_RH: 'Planeamento, Estatística e Recursos Humanos',
    INSPECCAO_SUPERVISAO: 'Inspecção e Supervisão Pedagógica',
    CIENCIA_TECNOLOGIA: 'Ciências, Tecnologia e Inovação',
}

export const DEPARTAMENTO_PROVINCIAL_OPTIONS: {
    value: DepartamentoProvincial
    label: string
}[] = (
    Object.entries(DEPARTAMENTO_PROVINCIAL_LABELS) as [DepartamentoProvincial, string][]
).map(([value, label]) => ({ value, label }))

/** Páginas permitidas por departamento (paths do DashboardLayout) */
const PAGES_BY_DEPARTAMENTO: Record<DepartamentoProvincial, string[]> = {
    EDUCACAO_ENSINO: [
        'dashboard',
        'provincial-direcoes-municipais',
        'provincial-escolas',
        'provincial-circulares',
        'provincial-relatorios',
    ],
    PLANEAMENTO_RH: [
        'dashboard',
        'provincial-escolas',
        'provincial-relatorios',
        'provincial-concursos',
        'provincial-pessoal',
        'provincial-planeamento',
        'provincial-estatisticas',
        'provincial-contratacao-empresas',
    ],
    INSPECCAO_SUPERVISAO: [
        'dashboard',
        'provincial-escolas',
        'provincial-supervisao',
        'provincial-relatorios',
    ],
    CIENCIA_TECNOLOGIA: [
        'dashboard',
        'provincial-circulares',
        'provincial-relatorios',
        'provincial-projectos',
    ],
}

/** Admin DP — acesso total */
export const ADMIN_PROVINCIAL_PAGES = [
    'dashboard',
    'provincial-direcoes-municipais',
    'provincial-escolas',
    'provincial-supervisao',
    'provincial-circulares',
    'provincial-concursos',
    'provincial-relatorios',
    'provincial-pessoal',
    'provincial-planeamento',
    'provincial-estatisticas',
    'provincial-contratacao-empresas',
    'provincial-projectos',
    'settings',
] as const

export function normalizeDepartamentoProvincial(
    value?: string | null,
): DepartamentoProvincial | null {
    const v = (value || '').trim().toUpperCase()
    if (
        v === 'EDUCACAO_ENSINO' ||
        v === 'PLANEAMENTO_RH' ||
        v === 'INSPECCAO_SUPERVISAO' ||
        v === 'CIENCIA_TECNOLOGIA'
    ) {
        return v
    }
    return null
}

export function getDepartamentoProvincialLabel(departamento?: string | null): string {
    const d = normalizeDepartamentoProvincial(departamento)
    return d ? DEPARTAMENTO_PROVINCIAL_LABELS[d] : 'Departamento'
}

export function provincialStaffAllowedPages(departamento?: string | null): string[] {
    const d = normalizeDepartamentoProvincial(departamento)
    if (!d) return ['dashboard']
    return [...PAGES_BY_DEPARTAMENTO[d]]
}

export function provincialStaffCanOpenPage(
    departamento: string | null | undefined,
    page: string,
): boolean {
    return provincialStaffAllowedPages(departamento).includes(page)
}

export function buildFuncionarioProvincialInviteLink(
    origin: string,
    email: string,
    departamento?: string | null,
): string {
    const params = new URLSearchParams()
    params.set('email', email)
    const d = normalizeDepartamentoProvincial(departamento)
    if (d) params.set('departamento', d)
    return `${origin}/register-funcionario-dp?${params.toString()}`
}

export type EstadoProcessoProvincial = 'rascunho' | 'em_curso' | 'concluido' | 'suspenso'

export const ESTADO_PROCESSO_LABELS: Record<EstadoProcessoProvincial, string> = {
    rascunho: 'Rascunho',
    em_curso: 'Em curso',
    concluido: 'Concluído',
    suspenso: 'Suspenso',
}

export type AreaProjectoProvincial = 'ciencia' | 'tecnologia' | 'inovacao' | 'investigacao'

export const AREA_PROJECTO_LABELS: Record<AreaProjectoProvincial, string> = {
    ciencia: 'Ciência',
    tecnologia: 'Tecnologia',
    inovacao: 'Inovação',
    investigacao: 'Investigação',
}
