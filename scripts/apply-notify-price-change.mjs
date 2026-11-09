#!/usr/bin/env node
/**
 * Aplica notificação automática em alterações de preço de assinatura.
 *
 * Uso:
 *   node scripts/apply-notify-price-change.mjs
 *   npm run db:apply-notify-price-change
 */
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PROJECT_REF = 'afueujnyeglgnaylaxmp'
const migrationPath = join(
    ROOT,
    'supabase',
    'migrations',
    '20261109_notify_price_change_institutions.sql',
)

function loadEnvFile() {
    const envPath = join(ROOT, '.env')
    if (!existsSync(envPath)) return
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        if (!line || line.startsWith('#')) continue
        const i = line.indexOf('=')
        if (i <= 0) continue
        const key = line.slice(0, i).trim()
        let value = line.slice(i + 1).trim()
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1)
        }
        if (!(key in process.env)) process.env[key] = value
    }
}

loadEnvFile()

const sql = readFileSync(migrationPath, 'utf8')
const databaseUrl =
    process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL

async function applyViaPostgres() {
    const client = new pg.Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false },
    })
    console.log('🔧 A aplicar via DATABASE_URL ...')
    await client.connect()
    try {
        await client.query(sql)
    } finally {
        await client.end().catch(() => {})
    }
}

async function applyViaManagementApi() {
    const token = process.env.SUPABASE_ACCESS_TOKEN
    if (!token) {
        throw new Error(
            'Sem DATABASE_URL nem SUPABASE_ACCESS_TOKEN. Aplique no SQL Editor: ' +
                migrationPath,
        )
    }

    console.log('🔧 A aplicar via Management API (SUPABASE_ACCESS_TOKEN) ...')
    const res = await fetch(
        `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: sql }),
        },
    )
    const text = await res.text()
    if (!res.ok) {
        throw new Error(`Management API ${res.status}: ${text.slice(0, 800)}`)
    }
    console.log('Resposta API:', text.slice(0, 200))
}

try {
    if (databaseUrl) {
        await applyViaPostgres()
    } else {
        await applyViaManagementApi()
    }
    console.log('✅ Migração 20261109_notify_price_change_institutions aplicada.')
} catch (err) {
    console.error('❌ Falha ao aplicar migração:', err.message)
    process.exit(1)
}
