/**
 * Shared helpers for EduGest test seed / unseed scripts.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')

export const SEED_EMAIL_DOMAIN = 'seed.edugest.test'
export const SEED_PASSWORD = 'SeedTest@2026!'
export const SEED_MARKER = 'edugest-test-seed'
export const SEED_CODIGO_PREFIX = 'SEED-'
export const ANO_LECTIVO = '2026'

export function loadEnv() {
    const candidates = [resolve(ROOT, '.env'), resolve(ROOT, '.env.local')]
    const env = { ...process.env }

    for (const file of candidates) {
        if (!existsSync(file)) continue
        const text = readFileSync(file, 'utf8')
        for (const line of text.split(/\r?\n/)) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('#')) continue
            const i = trimmed.indexOf('=')
            if (i <= 0) continue
            const key = trimmed.slice(0, i).trim()
            const value = trimmed.slice(i + 1).trim()
            if (!(key in env) || env[key] === '') env[key] = value
        }
    }

    const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
    const serviceKey =
        env.SUPABASE_SECRET_KEY ||
        env.SUPABASE_SERVICE_ROLE_KEY ||
        env.SUPABASE_SERVICE_KEY

    if (!url || !serviceKey) {
        throw new Error(
            'Missing SUPABASE_URL / VITE_SUPABASE_URL or SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY in .env'
        )
    }

    return { url, serviceKey, root: ROOT }
}

export function createServiceClient() {
    const { url, serviceKey } = loadEnv()
    return createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
}

export function seedEmail(localPart) {
    return `${localPart}@${SEED_EMAIL_DOMAIN}`
}

export function log(step, message) {
    console.log(`[${step}] ${message}`)
}

export function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
}

export async function createAuthUser(supabase, { email, password, fullName, role }) {
    const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
            full_name: fullName,
            role,
            seed: true,
            seed_marker: SEED_MARKER,
        },
    })

    if (error) {
        // Idempotent-ish: if already exists, try to find it
        if (/already|registered|exists/i.test(error.message)) {
            const existing = await findAuthUserByEmail(supabase, email)
            if (existing) return existing
        }
        throw new Error(`createUser(${email}): ${error.message}`)
    }

    return data.user
}

export async function findAuthUserByEmail(supabase, email) {
    const target = email.toLowerCase()
    let page = 1
    const perPage = 200

    while (true) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
        if (error) throw new Error(`listUsers: ${error.message}`)
        const users = data?.users || []
        const found = users.find((u) => (u.email || '').toLowerCase() === target)
        if (found) return found
        if (users.length < perPage) return null
        page += 1
        if (page > 50) return null
    }
}

export async function listSeedAuthUsers(supabase) {
    const result = []
    let page = 1
    const perPage = 200

    while (true) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
        if (error) throw new Error(`listUsers: ${error.message}`)
        const users = data?.users || []
        for (const u of users) {
            const email = (u.email || '').toLowerCase()
            const meta = u.user_metadata || {}
            if (email.endsWith(`@${SEED_EMAIL_DOMAIN}`) || meta.seed_marker === SEED_MARKER) {
                result.push(u)
            }
        }
        if (users.length < perPage) break
        page += 1
        if (page > 50) break
    }

    return result
}

export async function listSeedEscolas(supabase) {
    const { data, error } = await supabase
        .from('escolas')
        .select('id, nome, codigo_escola, email, user_id, configuracoes')
        .like('codigo_escola', `${SEED_CODIGO_PREFIX}%`)

    if (error) throw new Error(`listSeedEscolas: ${error.message}`)
    return data || []
}

export async function generateProcesso(supabase, turmaId) {
    const { data, error } = await supabase.rpc('generate_numero_processo', {
        turma_uuid: turmaId,
    })
    if (error) throw new Error(`generate_numero_processo: ${error.message}`)
    return String(data)
}
