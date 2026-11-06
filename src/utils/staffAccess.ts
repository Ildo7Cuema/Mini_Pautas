/**
 * School staff access profiles (login via secretarios + tipo_perfil SECRETARIO).
 * Aligned with Angolan school organisation:
 * - Subdirector Pedagógico → Área Pedagógica
 * - Subdirector Administrativo → Área Administrativa
 * - Técnico de Secretaria → Área de Secretaria
 *
 * Internal codes keep DIRECTOR_* for compatibility with DB / RLS / invites.
 */

export type StaffLoginCargo =
    | 'TECNICO_SECRETARIA'
    | 'DIRECTOR_PEDAGOGICO'
    | 'DIRECTOR_ADMINISTRATIVO'

export const STAFF_CARGO_LABELS: Record<StaffLoginCargo, string> = {
    TECNICO_SECRETARIA: 'Técnico de Secretaria',
    DIRECTOR_PEDAGOGICO: 'Subdirector Pedagógico',
    DIRECTOR_ADMINISTRATIVO: 'Subdirector Administrativo',
}

/** Named functional areas each login profile accesses */
export const STAFF_AREA_LABELS: Record<StaffLoginCargo, string> = {
    DIRECTOR_PEDAGOGICO: 'Área Pedagógica',
    DIRECTOR_ADMINISTRATIVO: 'Área Administrativa',
    TECNICO_SECRETARIA: 'Área de Secretaria',
}

/** Module names shown in menus for each cargo (user-facing) */
export const STAFF_AREA_MODULES: Record<StaffLoginCargo, string[]> = {
    DIRECTOR_PEDAGOGICO: [
        'Dashboard',
        'Turmas',
        'Relatórios',
        'Matrículas',
        'Configurações',
    ],
    DIRECTOR_ADMINISTRATIVO: [
        'Dashboard',
        'Professores',
        'Pagamentos',
        'Turmas',
        'Matrículas',
        'Configurações',
    ],
    TECNICO_SECRETARIA: [
        'Dashboard',
        'Pagamentos',
        'Configurações',
    ],
}

export function normalizeStaffCargo(cargo?: string | null): StaffLoginCargo {
    if (cargo === 'DIRECTOR_PEDAGOGICO') return 'DIRECTOR_PEDAGOGICO'
    if (cargo === 'DIRECTOR_ADMINISTRATIVO') return 'DIRECTOR_ADMINISTRATIVO'
    if (cargo === 'TECNICO_SECRETARIA') return 'TECNICO_SECRETARIA'
    // Legacy secretarios without cargo
    return 'TECNICO_SECRETARIA'
}

export function getStaffCargoLabel(cargo?: string | null): string {
    return STAFF_CARGO_LABELS[normalizeStaffCargo(cargo)]
}

export function getStaffAreaLabel(cargo?: string | null): string {
    return STAFF_AREA_LABELS[normalizeStaffCargo(cargo)]
}

export function getStaffAreaModules(cargo?: string | null): string[] {
    return STAFF_AREA_MODULES[normalizeStaffCargo(cargo)]
}

export function formatStaffAccessSummary(cargo?: string | null): string {
    const area = getStaffAreaLabel(cargo)
    const modules = getStaffAreaModules(cargo)
    return `${area}: ${modules.join(', ')}`
}

export function isDirectorPedagogico(cargo?: string | null): boolean {
    return normalizeStaffCargo(cargo) === 'DIRECTOR_PEDAGOGICO'
}

export function isDirectorAdministrativo(cargo?: string | null): boolean {
    return normalizeStaffCargo(cargo) === 'DIRECTOR_ADMINISTRATIVO'
}

export function isTecnicoSecretaria(cargo?: string | null): boolean {
    return normalizeStaffCargo(cargo) === 'TECNICO_SECRETARIA'
}

/** Tuition / payments operational area */
export function staffCanManagePayments(cargo?: string | null): boolean {
    const c = normalizeStaffCargo(cargo)
    return c === 'TECNICO_SECRETARIA' || c === 'DIRECTOR_ADMINISTRATIVO'
}

/** Pedagogical reports, pautas, class oversight */
export function staffCanAccessPedagogical(cargo?: string | null): boolean {
    return normalizeStaffCargo(cargo) === 'DIRECTOR_PEDAGOGICO'
}

/** Class list / student admin context */
export function staffCanAccessClasses(cargo?: string | null): boolean {
    const c = normalizeStaffCargo(cargo)
    return c === 'DIRECTOR_PEDAGOGICO' || c === 'DIRECTOR_ADMINISTRATIVO'
}

/** Year transitions / matrículas */
export function staffCanAccessMatriculas(cargo?: string | null): boolean {
    const c = normalizeStaffCargo(cargo)
    return c === 'DIRECTOR_PEDAGOGICO' || c === 'DIRECTOR_ADMINISTRATIVO'
}

/** Cadastro e gestão de professores (área administrativa) */
export function staffCanManageTeachers(cargo?: string | null): boolean {
    return normalizeStaffCargo(cargo) === 'DIRECTOR_ADMINISTRATIVO'
}

/** Pages allowed for a staff login cargo */
export function staffAllowedPages(cargo?: string | null): string[] {
    const c = normalizeStaffCargo(cargo)
    const base = ['dashboard', 'settings']

    if (c === 'DIRECTOR_PEDAGOGICO') {
        return [...base, 'classes', 'class-details', 'reports', 'matriculas', 'grades']
    }
    if (c === 'DIRECTOR_ADMINISTRATIVO') {
        return [...base, 'teachers', 'propinas', 'tuition', 'classes', 'class-details', 'matriculas']
    }
    // Técnico de Secretaria
    return [...base, 'propinas', 'tuition']
}

export function staffCanOpenPage(cargo: string | null | undefined, page: string): boolean {
    return staffAllowedPages(cargo).includes(page)
}

/** Invite URL for staff login registration (perfil reflected on the welcome page) */
export function buildStaffInviteLink(
    origin: string,
    email: string,
    cargo?: string | null,
): string {
    const params = new URLSearchParams()
    params.set('email', email)
    const normalized = normalizeStaffCargo(cargo)
    // Always include cargo so the invite page does not depend on anonymous RLS reads
    params.set('cargo', normalized)
    return `${origin}/register-secretary?${params.toString()}`
}

/** Resolve cargo from invite URL param or free-text HR values */
export function resolveStaffCargoFromInvite(
    cargoParam?: string | null,
    subcategoria?: string | null,
    cargoField?: string | null,
): StaffLoginCargo {
    const fromParam = (cargoParam || '').trim().toUpperCase()
    if (
        fromParam === 'DIRECTOR_PEDAGOGICO' ||
        fromParam === 'DIRECTOR_ADMINISTRATIVO' ||
        fromParam === 'TECNICO_SECRETARIA'
    ) {
        return fromParam
    }
    const sub = (subcategoria || '').trim().toUpperCase()
    if (sub === 'SECRETARIO') return 'TECNICO_SECRETARIA'
    if (
        sub === 'DIRECTOR_PEDAGOGICO' ||
        sub === 'DIRECTOR_ADMINISTRATIVO' ||
        sub === 'TECNICO_SECRETARIA'
    ) {
        return sub
    }
    const field = (cargoField || '').trim().toUpperCase()
    if (
        field === 'DIRECTOR_PEDAGOGICO' ||
        field === 'DIRECTOR_ADMINISTRATIVO' ||
        field === 'TECNICO_SECRETARIA'
    ) {
        return field
    }
    // Human labels stored in funcionarios_escola.cargo (Director / Subdirector)
    if (/pedag[oó]gico/i.test(cargoField || '') && /director|diretor|subdirector|subdiretor/i.test(cargoField || '')) {
        return 'DIRECTOR_PEDAGOGICO'
    }
    if (/administrativo/i.test(cargoField || '') && /director|diretor|subdirector|subdiretor/i.test(cargoField || '')) {
        return 'DIRECTOR_ADMINISTRATIVO'
    }
    if (/t[eé]cnico.*secretaria|secretaria/i.test(cargoField || '')) return 'TECNICO_SECRETARIA'
    return normalizeStaffCargo(null)
}
