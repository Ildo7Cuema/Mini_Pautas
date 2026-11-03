#!/usr/bin/env node
/**
 * Aplica migrações de staff login + Dir. Admin em professores.
 * Requer DATABASE_URL (Postgres do Supabase).
 */
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve, basename } from 'path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const migrationPaths = [
    join(ROOT, 'supabase', 'migrations', '20261103_staff_login_cargos.sql'),
    join(ROOT, 'supabase', 'migrations', '20261103_dir_admin_manage_professores.sql'),
    join(ROOT, 'supabase', 'migrations', '20261103_lookup_staff_invite_cargo.sql'),
]

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

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL

if (!databaseUrl) {
    console.error('❌ Defina DATABASE_URL para aplicar as migrações de staff.')
    for (const p of migrationPaths) console.error(`   - ${p}`)
    process.exit(1)
}

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })

try {
    await client.connect()
    for (const migrationPath of migrationPaths) {
        const name = basename(migrationPath)
        console.log(`🔧 A aplicar ${name} ...`)
        const sql = readFileSync(migrationPath, 'utf8')
        await client.query(sql)
        console.log(`✅ ${name} aplicada.`)
    }
} catch (err) {
    console.error('❌ Falha ao aplicar migração:', err.message)
    process.exit(1)
} finally {
    await client.end().catch(() => {})
}
