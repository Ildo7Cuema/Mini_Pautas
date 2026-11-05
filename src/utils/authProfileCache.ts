/**
 * Session cache for auth bootstrap — paints the shell immediately while
 * the network revalidates the profile in the background.
 */

import type {
    AuthUser,
    EscolaProfile,
    ProfessorProfile,
    AlunoProfile,
    EncarregadoProfile,
    SecretarioProfile,
    DirecaoMunicipalProfile,
    DirecaoProvincialProfile,
    PessoalDirecaoProvincialProfile,
} from '../types'

const CACHE_KEY = 'edugest_auth_profile_v1'
const MAX_AGE_MS = 1000 * 60 * 60 * 12 // 12 hours

export interface CachedAuthSnapshot {
    userId: string
    cachedAt: number
    user: AuthUser
    isEscola: boolean
    isProfessor: boolean
    isAluno: boolean
    isEncarregado: boolean
    isSecretario: boolean
    isDirecaoMunicipal: boolean
    isDirecaoProvincial: boolean
    isFuncionarioProvincial: boolean
    escolaProfile: EscolaProfile | null
    professorProfile: ProfessorProfile | null
    alunoProfile: AlunoProfile | null
    encarregadoProfile: EncarregadoProfile | null
    secretarioProfile: SecretarioProfile | null
    direcaoMunicipalProfile: DirecaoMunicipalProfile | null
    direcaoProvincialProfile: DirecaoProvincialProfile | null
    pessoalDirecaoProvincialProfile: PessoalDirecaoProvincialProfile | null
}

export function readAuthProfileCache(userId: string): CachedAuthSnapshot | null {
    try {
        const raw = sessionStorage.getItem(CACHE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as CachedAuthSnapshot
        if (!parsed?.userId || parsed.userId !== userId) return null
        if (Date.now() - (parsed.cachedAt || 0) > MAX_AGE_MS) return null
        return parsed
    } catch {
        return null
    }
}

export function writeAuthProfileCache(snapshot: Omit<CachedAuthSnapshot, 'cachedAt'>): void {
    try {
        const payload: CachedAuthSnapshot = {
            ...snapshot,
            cachedAt: Date.now(),
        }
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload))
    } catch {
        // Ignore quota / private-mode failures
    }
}

export function clearAuthProfileCache(): void {
    try {
        sessionStorage.removeItem(CACHE_KEY)
    } catch {
        // ignore
    }
}
