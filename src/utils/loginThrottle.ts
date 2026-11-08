/**
 * Throttle client-side de tentativas de login (defesa em profundidade).
 * Não substitui rate-limit do Supabase Auth — reduz brute-force casual no browser.
 */

const STORAGE_KEY = 'edugest_login_throttle_v1'
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 min
const LOCK_MS = 15 * 60 * 1000

type ThrottleState = {
    fails: number
    firstFailAt: number
    lockedUntil: number
}

function read(): ThrottleState {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY)
        if (!raw) return { fails: 0, firstFailAt: 0, lockedUntil: 0 }
        return JSON.parse(raw) as ThrottleState
    } catch {
        return { fails: 0, firstFailAt: 0, lockedUntil: 0 }
    }
}

function write(state: ThrottleState) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
        /* ignore quota */
    }
}

export function getLoginBlockMessage(): string | null {
    const s = read()
    const now = Date.now()
    if (s.lockedUntil > now) {
        const mins = Math.ceil((s.lockedUntil - now) / 60000)
        return `Demasiadas tentativas de login. Aguarde cerca de ${mins} minuto(s) e tente novamente.`
    }
    return null
}

export function registerLoginFailure(): string | null {
    const now = Date.now()
    let s = read()

    if (s.lockedUntil > now) {
        return getLoginBlockMessage()
    }

    if (!s.firstFailAt || now - s.firstFailAt > WINDOW_MS) {
        s = { fails: 1, firstFailAt: now, lockedUntil: 0 }
    } else {
        s.fails += 1
    }

    if (s.fails >= MAX_ATTEMPTS) {
        s.lockedUntil = now + LOCK_MS
        write(s)
        return getLoginBlockMessage()
    }

    write(s)
    const left = MAX_ATTEMPTS - s.fails
    return left <= 2
        ? `Credenciais inválidas. Restam ${left} tentativa(s) antes do bloqueio temporário.`
        : null
}

export function registerLoginSuccess() {
    try {
        sessionStorage.removeItem(STORAGE_KEY)
    } catch {
        /* ignore */
    }
}
