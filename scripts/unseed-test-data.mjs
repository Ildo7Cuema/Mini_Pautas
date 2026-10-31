#!/usr/bin/env node
/**
 * Remove a seed de testes EduGest Angola (escolas SEED-* + users @seed.edugest.test).
 *
 * Uso:
 *   npm run seed:test:clean
 *   node scripts/unseed-test-data.mjs
 */
import {
    createServiceClient,
    listSeedAuthUsers,
    listSeedEscolas,
    log,
    sleep,
} from './seed/_shared.mjs'

/**
 * @param {{ silent?: boolean, asModule?: boolean }} [opts]
 */
export async function unseed(opts = {}) {
    const { silent = false } = opts
    const say = silent ? () => {} : log

    console.log('\n🧹 EduGest — Limpeza da seed de testes\n')
    const supabase = createServiceClient()

    const escolas = await listSeedEscolas(supabase)
    say('escolas', `${escolas.length} escola(s) seed encontradas`)

    for (const escola of escolas) {
        const { error } = await supabase.from('escolas').delete().eq('id', escola.id)
        if (error) {
            throw new Error(`Falha ao apagar ${escola.codigo_escola}: ${error.message}`)
        }
        say('delete', `Apagada ${escola.codigo_escola} · ${escola.nome}`)
    }

    // Catch any leftover seed escolas by marker in configuracoes (belt-and-braces)
    const { data: marked } = await supabase
        .from('escolas')
        .select('id, codigo_escola, nome, configuracoes')
        .filter('configuracoes->>seed_marker', 'eq', 'edugest-test-seed')

    for (const escola of marked || []) {
        const { error } = await supabase.from('escolas').delete().eq('id', escola.id)
        if (error) console.warn(`! residual ${escola.codigo_escola}: ${error.message}`)
        else say('delete', `Apagada residual ${escola.codigo_escola}`)
    }

    const users = await listSeedAuthUsers(supabase)
    say('auth', `${users.length} utilizador(es) seed a remover`)

    let deletedUsers = 0
    for (const user of users) {
        const { error } = await supabase.auth.admin.deleteUser(user.id)
        if (error) {
            console.warn(`! auth ${user.email}: ${error.message}`)
            continue
        }
        deletedUsers += 1
        await sleep(80)
    }

    console.log('\n✅ Limpeza concluída')
    console.log(`   Escolas removidas: ${escolas.length + (marked?.length || 0)}`)
    console.log(`   Utilizadores auth removidos: ${deletedUsers}\n`)

    return { escolas: escolas.length, users: deletedUsers }
}

const isDirectRun =
    process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('unseed-test-data.mjs')

if (isDirectRun) {
    unseed().catch((err) => {
        console.error('\n❌ Unseed falhou:', err.message || err)
        process.exit(1)
    })
}

export default unseed
