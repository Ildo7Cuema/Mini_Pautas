/**
 * Identificação de escolas / perfis de teste (seed).
 * Alinhado com docs/SEED_TEST_CREDENTIALS.md e scripts/seed/_shared.mjs
 */

export const SEED_EMAIL_DOMAIN = 'seed.edugest.test'
export const SEED_CODIGO_PREFIX = 'SEED-'
export const SEED_MARKER = 'edugest-test-seed'

export function isSeedEmail(email?: string | null): boolean {
    if (!email) return false
    return email.toLowerCase().endsWith(`@${SEED_EMAIL_DOMAIN}`)
}

export function isSeedCodigo(codigo?: string | null): boolean {
    if (!codigo) return false
    return codigo.toUpperCase().startsWith(SEED_CODIGO_PREFIX)
}

export function isSeedEscola(escola: {
    codigo_escola?: string | null
    configuracoes?: Record<string, unknown> | null
}): boolean {
    if (isSeedCodigo(escola.codigo_escola)) return true
    const cfg = escola.configuracoes || {}
    if (cfg.seed_marker === SEED_MARKER) return true
    if (cfg.seed === true || cfg.seed === 'true' || cfg.seed === 1) return true
    return false
}

export function isSeedDirecao(entity: {
    email?: string | null
    numero_funcionario?: string | null
}): boolean {
    return isSeedEmail(entity.email) || isSeedCodigo(entity.numero_funcionario)
}
