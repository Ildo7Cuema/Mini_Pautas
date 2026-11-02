import type { RegistrationType } from './registrationNotifications'

const STORAGE_KEY = 'edugest_pending_admin_notify'

export type PendingAdminAlertState = 'pending' | 'sent' | 'manual'

export interface PendingAdminNotify {
    type: RegistrationType
    displayName: string
    message: string
    adminAlert: PendingAdminAlertState
    waOpened: boolean
    createdAt: number
}

export function getPendingAdminNotify(): PendingAdminNotify | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as PendingAdminNotify
        if (!parsed?.type || !parsed?.message) return null
        return parsed
    } catch {
        return null
    }
}

export function savePendingAdminNotify(
    data: Omit<PendingAdminNotify, 'createdAt' | 'waOpened'> & { waOpened?: boolean }
): void {
    const payload: PendingAdminNotify = {
        type: data.type,
        displayName: data.displayName,
        message: data.message,
        adminAlert: data.adminAlert,
        waOpened: data.waOpened ?? false,
        createdAt: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function updatePendingAdminNotify(
    patch: Partial<Pick<PendingAdminNotify, 'adminAlert' | 'waOpened' | 'message' | 'displayName'>>
): void {
    const current = getPendingAdminNotify()
    if (!current) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }))
}

export function markPendingAdminNotifyOpened(): void {
    updatePendingAdminNotify({ waOpened: true })
}

export function clearPendingAdminNotify(): void {
    localStorage.removeItem(STORAGE_KEY)
}

/** True while o utilizador ainda não clicou em "Notificar administrador". */
export function isAdminNotifyLocked(): boolean {
    const pending = getPendingAdminNotify()
    return Boolean(pending && !pending.waOpened)
}

export function pathForPendingType(type: RegistrationType): string {
    switch (type) {
        case 'DIRECAO_MUNICIPAL':
            return '/register-direcao-municipal'
        case 'DIRECAO_PROVINCIAL':
            return '/register-direcao-provincial'
        case 'ESCOLA':
        default:
            return '/'
    }
}
