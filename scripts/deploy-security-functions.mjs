#!/usr/bin/env node
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PROJECT_REF = 'afueujnyeglgnaylaxmp'
const FUNCS = ['public-school-lookup', 'public-payment-request', 'payment-webhook']

function loadEnv() {
    const envPath = join(ROOT, '.env')
    if (!existsSync(envPath)) throw new Error('.env missing')
    const env = {}
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        if (!line || line.startsWith('#')) continue
        const i = line.indexOf('=')
        if (i <= 0) continue
        let v = line.slice(i + 1).trim()
        if (
            (v.startsWith('"') && v.endsWith('"')) ||
            (v.startsWith("'") && v.endsWith("'"))
        ) {
            v = v.slice(1, -1)
        }
        env[line.slice(0, i).trim()] = v
    }
    return env
}

function run(cmd, args, env) {
    console.log(`\n> ${cmd} ${args.join(' ')}`)
    const r = spawnSync(cmd, args, {
        cwd: ROOT,
        env: { ...process.env, ...env },
        encoding: 'utf8',
        shell: true,
    })
    if (r.stdout) process.stdout.write(r.stdout)
    if (r.stderr) process.stderr.write(r.stderr)
    if (r.status !== 0) {
        throw new Error(`Command failed (${r.status}): ${cmd} ${args.join(' ')}`)
    }
}

const envFile = loadEnv()
const token = envFile.SUPABASE_ACCESS_TOKEN
if (!token) {
    console.error('❌ SUPABASE_ACCESS_TOKEN em falta no .env')
    process.exit(1)
}
console.log(`✅ Token presente (len=${token.length})`)

const childEnv = {
    SUPABASE_ACCESS_TOKEN: token,
    SUPABASE_YES: '1',
}

// Ensure linked to the Mini_pautas project (not db_Saude)
writeFileSync(
    join(ROOT, 'supabase', '.temp', 'project-ref'),
    PROJECT_REF,
    'utf8',
)

try {
    run('npx', ['--yes', 'supabase', 'link', '--project-ref', PROJECT_REF, '--yes'], childEnv)
} catch (e) {
    console.warn('⚠️ link avisou/falhou — a tentar deploy com --project-ref / --use-api mesmo assim')
    console.warn(String(e.message || e))
}

for (const name of FUNCS) {
    run(
        'npx',
        [
            '--yes',
            'supabase',
            'functions',
            'deploy',
            name,
            `--remote=${PROJECT_REF}`,
            '--no-verify-jwt',
            '--use-api',
            '--yes',
        ],
        childEnv,
    )
}

console.log('\n✅ Deploy concluído. A verificar endpoints...')
const url = (envFile.SUPABASE_URL || envFile.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const anon = envFile.VITE_SUPABASE_ANON_KEY || envFile.SUPABASE_PUBLISHABLE_KEY
if (!url || !anon) {
    console.log('Sem URL/anon para smoke test.')
    process.exit(0)
}

for (const name of FUNCS) {
    const body =
        name === 'public-school-lookup'
            ? { identifier: 'SEED-PRI-2026' }
            : name === 'public-payment-request'
              ? { escola_id: '00000000-0000-0000-0000-000000000001', plano: 'anual' }
              : { status: 'pending' }
    const res = await fetch(`${url}/functions/v1/${name}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anon}`,
            apikey: anon,
        },
        body: JSON.stringify(body),
    })
    const text = await res.text()
    console.log(`${name}: HTTP ${res.status} ${text.slice(0, 180)}`)
}
