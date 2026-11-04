#!/usr/bin/env node
/**
 * Aplica a correção do trigger AGT (RETURN OLD no DELETE de recibos anulados).
 *
 * Requer DATABASE_URL (connection string Postgres do Supabase):
 *   $env:DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"
 *   node scripts/apply-agt-receipt-delete-fix.mjs
 */
import pg from 'pg'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnvFile() {
    for (const file of [resolve(ROOT, '.env'), resolve(ROOT, '.env.local')]) {
        if (!existsSync(file)) continue
        for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('#')) continue
            const i = trimmed.indexOf('=')
            if (i <= 0) continue
            const key = trimmed.slice(0, i).trim()
            const value = trimmed.slice(i + 1).trim()
            if (!(key in process.env) || process.env[key] === '') process.env[key] = value
        }
    }
}

loadEnvFile()

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL
if (!databaseUrl) {
    console.error('❌ Defina DATABASE_URL (connection string do Postgres no Supabase).')
    process.exit(1)
}

const sql = readFileSync(
    resolve(ROOT, 'supabase/migrations/20261104_fix_agt_receipt_delete_return.sql'),
    'utf8'
)

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })

await client.connect()
try {
    await client.query(sql)
    console.log('✅ Trigger AGT actualizado (DELETE de recibos anulados usa RETURN OLD).')

    const del = await client.query(`
        DELETE FROM pagamentos_propinas
        WHERE numero_recibo LIKE 'SEED-%' OR motivo_anulacao ILIKE 'Seed test cleanup%'
        RETURNING id, numero_recibo
    `)
    console.log(`🧹 Recibos seed removidos: ${del.rowCount}`)
} finally {
    await client.end()
}
