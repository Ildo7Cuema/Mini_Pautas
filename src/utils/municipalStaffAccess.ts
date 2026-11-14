/**
 * Acesso do pessoal da Direção Municipal por secção
 * (Decreto Executivo n.º 35/23 e estatutos orgânicos municipais).
 *
 * Secções: Educação e Ensino; Planeamento, Estatística e RH;
 * Inspecção/Supervisão Pedagógica; Ciências, Tecnologia e Inovação.
 */

export type DepartamentoMunicipal =
    | 'EDUCACAO_ENSINO'
    | 'PLANEAMENTO_RH'
    | 'INSPECCAO_SUPERVISAO'
    | 'CIENCIA_TECNOLOGIA'

export const DEPARTAMENTO_MUNICIPAL_LABELS: Record<DepartamentoMunicipal, string> = {
    EDUCACAO_ENSINO: 'Secção de Educação e Ensino',
    PLANEAMENTO_RH: 'Secção de Planeamento, Estatística e Recursos Humanos',
    INSPECCAO_SUPERVISAO: 'Secção de Inspecção e Supervisão Pedagógica',
    CIENCIA_TECNOLOGIA: 'Secção de Ciências, Tecnologia e Inovação',
}

export const DEPARTAMENTO_MUNICIPAL_OPTIONS: {
    value: DepartamentoMunicipal
    label: string
}[] = (
    Object.entries(DEPARTAMENTO_MUNICIPAL_LABELS) as [DepartamentoMunicipal, string][]
).map(([value, label]) => ({ value, label }))

/** Páginas permitidas por secção (paths do DashboardLayout) */
const PAGES_BY_DEPARTAMENTO: Record<DepartamentoMunicipal, string[]> = {
    EDUCACAO_ENSINO: [
        'dashboard',
        'escolas',
        'circulares',
        'solicitacoes',
        'relatorios-municipais',
        'avaliacao-desempenho-municipal',
    ],
    PLANEAMENTO_RH: [
        'dashboard',
        'escolas',
        'funcionarios',
        'concursos-publicos',
        'relatorios-municipais',
        'municipal-pessoal',
        'avaliacao-desempenho-municipal',
    ],
    INSPECCAO_SUPERVISAO: [
        'dashboard',
        'escolas',
        'supervisao-pedagogica',
        'relatorios-municipais',
        'avaliacao-desempenho-municipal',
    ],
    CIENCIA_TECNOLOGIA: [
        'dashboard',
        'circulares',
        'relatorios-municipais',
    ],
}

/** Admin DM — acesso total */
export const ADMIN_MUNICIPAL_PAGES = [
    'dashboard',
    'escolas',
    'supervisao-pedagogica',
    'funcionarios',
    'circulares',
    'solicitacoes',
    'concursos-publicos',
    'relatorios-municipais',
    'municipal-pessoal',
    'avaliacao-desempenho-municipal',
    'config-documentos',
    'reports',
    'settings',
] as const

export function normalizeDepartamentoMunicipal(
    value?: string | null,
): DepartamentoMunicipal | null {
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

export function getDepartamentoMunicipalLabel(departamento?: string | null): string {
    const d = normalizeDepartamentoMunicipal(departamento)
    return d ? DEPARTAMENTO_MUNICIPAL_LABELS[d] : 'Secção'
}

export function municipalStaffAllowedPages(departamento?: string | null): string[] {
    const d = normalizeDepartamentoMunicipal(departamento)
    if (!d) return ['dashboard']
    return [...PAGES_BY_DEPARTAMENTO[d]]
}

export function municipalStaffCanOpenPage(
    departamento: string | null | undefined,
    page: string,
): boolean {
    return municipalStaffAllowedPages(departamento).includes(page)
}

export function buildFuncionarioMunicipalInviteLink(
    origin: string,
    email: string,
    departamento?: string | null,
): string {
    const params = new URLSearchParams()
    params.set('email', email)
    const d = normalizeDepartamentoMunicipal(departamento)
    if (d) params.set('departamento', d)
    return `${origin}/register-funcionario-dm?${params.toString()}`
}
