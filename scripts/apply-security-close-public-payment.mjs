#!/usr/bin/env node
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
    '20261108_security_close_public_escola_payment.sql',
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
    console.error('❌ Defina DATABASE_URL ou aplique no SQL Editor:', migrationPath)
    process.exit(1)
}

const sql = readFileSync(migrationPath, 'utf8')
const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
})

try {
    console.log('🔧 A aplicar 20261108_security_close_public_escola_payment.sql ...')
    await client.connect()
    await client.query(sql)
    console.log('✅ Políticas públicas perigosas removidas.')
} catch (err) {
    console.error('❌ Falha:', err.message)
    process.exit(1)
} finally {
    await client.end().catch(() => {})
}
