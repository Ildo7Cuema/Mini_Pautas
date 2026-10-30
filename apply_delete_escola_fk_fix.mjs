/**
 * Aplica a migração que permite ao SUPERADMIN apagar escolas
 * com dados ligados a componentes_catalogo / disciplina_componentes.
 *
 * Uso (PowerShell):
 *   $env:DATABASE_URL="postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"
 *   node apply_delete_escola_fk_fix.mjs
 *
 * Alternativa: SQL Editor do Supabase → colar o ficheiro
 *   supabase/migrations/20261029_fix_delete_escola_catalog_fk.sql
 */

import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationPath = join(__dirname, 'supabase', 'migrations', '20261029_fix_delete_escola_catalog_fk.sql')

function loadEnvFile() {
  const envPath = join(__dirname, '.env')
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
  console.error('❌ Defina DATABASE_URL (connection string do Postgres no Supabase).')
  console.error('')
  console.error('Como obter:')
  console.error('  Project Settings → Database → Connection string (URI)')
  console.error('')
  console.error('Alternativa: abra o SQL Editor e execute o ficheiro:')
  console.error(`  ${migrationPath}`)
  process.exit(1)
}

const sql = readFileSync(migrationPath, 'utf8')
const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })

try {
  console.log('🔧 A aplicar migração 20261029_fix_delete_escola_catalog_fk.sql ...')
  await client.connect()
  await client.query(sql)
  console.log('✅ Migração aplicada com sucesso.')
  console.log('   O SUPERADMIN já pode eliminar escolas com catálogo/componentes ligados.')
} catch (err) {
  console.error('❌ Falha ao aplicar migração:', err.message)
  process.exit(1)
} finally {
  await client.end().catch(() => {})
}
