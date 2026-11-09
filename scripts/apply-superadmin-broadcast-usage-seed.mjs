#!/usr/bin/env node
/**
 * Aplica broadcast SUPERADMIN + exclusão de seeds no uso do sistema.
 * Requer DATABASE_URL (Postgres do Supabase).
 *
 * Uso:
 *   node scripts/apply-superadmin-broadcast-usage-seed.mjs
 *   npm run db:apply-superadmin-broadcast
 */
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const migrationPath = join(
    ROOT,
    'supabase',
    'migrations',
    '20261109_superadmin_broadcast_and_usage_seed_filter.sql',
)

function loadEnvFile() {
    const envPath = join(ROOT, '.env')
    if (!existsSync(envPath)) return
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        if (!line || line.startsWith('#')) continue
        const i = line.indexOf('=')
        if (i <= 0) continue
        const key = line.slice(0, i).trim()
        const value = line.slice(i + 1).trim()
        if (!(key in process.env)) process.env[key] = value
    }
}

loadEnvFile()

const databaseUrl =
    process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL

if (!databaseUrl) {
    console.error('❌ Defina DATABASE_URL (connection string do Postgres no Supabase).')
    console.error('')
    console.error('Alternativa: SQL Editor do Supabase → colar e executar:')
    console.error(`  ${migrationPath}`)
    process.exit(1)
}

const sql = readFileSync(migrationPath, 'utf8')
const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
})

try {
    console.log('🔧 A aplicar 20261109_superadmin_broadcast_and_usage_seed_filter.sql ...')
    await client.connect()
    await client.query(sql)
    console.log('✅ Migração de broadcast + filtro seed aplicada.')
} catch (err) {
    console.error('❌ Falha ao aplicar migração:', err.message)
    process.exit(1)
} finally {
    await client.end().catch(() => {})
}
