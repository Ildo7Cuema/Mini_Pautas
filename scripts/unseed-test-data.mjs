#!/usr/bin/env node
/**
 * Remove a seed de testes EduGest Angola
 * (escolas SEED-* + direções SEED-* + users @seed.edugest.test).
 *
 * Uso:
 *   npm run seed:test:clean
 *   node scripts/unseed-test-data.mjs
 */
import {
    SEED_CODIGO_PREFIX,
    SEED_EMAIL_DOMAIN,
    SEED_MARKER,
    createServiceClient,
    listSeedAuthUsers,
    listSeedDirecoesMunicipais,
    listSeedDirecoesProvinciais,
    listSeedEscolas,
    log,
    sleep,
} from './seed/_shared.mjs'

async function deleteSeedCirculares(supabase, say) {
    // Municipal circulars by seed numero prefix
    const { data: circMun } = await supabase
        .from('circulares_municipais')
        .select('id, numero_circular')
        .like('numero_circular', `${SEED_CODIGO_PREFIX}%`)

    for (const c of circMun || []) {
        await supabase.from('leitura_circulares').delete().eq('circular_id', c.id)
        const { error } = await supabase.from('circulares_municipais').delete().eq('id', c.id)
        if (error) console.warn(`! circular mun ${c.numero_circular}: ${error.message}`)
        else say('circ', `Circular municipal ${c.numero_circular}`)
    }

    const { data: circProv } = await supabase
        .from('circulares_provinciais')
        .select('id, numero_circular')
        .like('numero_circular', `${SEED_CODIGO_PREFIX}%`)

    for (const c of circProv || []) {
        await supabase.from('leituras_circulares_provinciais').delete().eq('circular_id', c.id)
        const { error } = await supabase.from('circulares_provinciais').delete().eq('id', c.id)
        if (error) console.warn(`! circular prov ${c.numero_circular}: ${error.message}`)
        else say('circ', `Circular provincial ${c.numero_circular}`)
    }

    return { mun: circMun?.length || 0, prov: circProv?.length || 0 }
}

async function deleteSeedSolicitacoes(supabase, say) {
    const { data: sols } = await supabase
        .from('solicitacoes_documentos')
        .select('id, assunto')
        .or(`assunto.ilike.Seed —%,dados_adicionais->>seed_marker.eq.${SEED_MARKER}`)

    let deleted = 0
    for (const s of sols || []) {
        const { error } = await supabase.from('solicitacoes_documentos').delete().eq('id', s.id)
        if (error) console.warn(`! solicitação: ${error.message}`)
        else deleted += 1
    }
    if (deleted) say('sols', `${deleted} solicitação(ões) seed removida(s)`)
    return deleted
}

/**
 * AGT: recibos estado=valido não podem ser apagados.
 * Fluxo: soltar FKs de auth → anular → apagar (precisa trigger com RETURN OLD).
 */
async function clearSeedPropinas(supabase, escolas, say) {
    const escolaIds = (escolas || []).map((e) => e.id)

    const { data: byEscola, error: e1 } = escolaIds.length
        ? await supabase
              .from('pagamentos_propinas')
              .select('id, estado, numero_recibo, escola_id, registado_por')
              .in('escola_id', escolaIds)
        : { data: [], error: null }
    if (e1) throw new Error(`list pagamentos_propinas: ${e1.message}`)

    const { data: byRecibo, error: e2 } = await supabase
        .from('pagamentos_propinas')
        .select('id, estado, numero_recibo, escola_id, registado_por')
        .like('numero_recibo', `${SEED_CODIGO_PREFIX}%`)
    if (e2) throw new Error(`list pagamentos SEED-*: ${e2.message}`)

    const { data: byMotivo, error: e3 } = await supabase
        .from('pagamentos_propinas')
        .select('id, estado, numero_recibo, escola_id, registado_por')
        .ilike('motivo_anulacao', 'Seed test cleanup%')
    if (e3) throw new Error(`list pagamentos motivo seed: ${e3.message}`)

    const byId = new Map()
    for (const p of [...(byEscola || []), ...(byRecibo || []), ...(byMotivo || [])]) {
        byId.set(p.id, p)
    }
    const pagos = [...byId.values()]
    if (!pagos.length) return 0

    const validos = pagos.filter((p) => p.estado === 'valido')
    if (validos.length) {
        // Enquanto válidos, registado_por ainda pode ser limpo (não é campo fiscal imutável)
        const { error: fkErr } = await supabase
            .from('pagamentos_propinas')
            .update({ registado_por: null, anulado_por: null })
            .in(
                'id',
                validos.map((p) => p.id)
            )
        if (fkErr) console.warn(`! limpar FKs recibos: ${fkErr.message}`)

        const { error: anulErr } = await supabase
            .from('pagamentos_propinas')
            .update({
                estado: 'anulado',
                motivo_anulacao: 'Seed test cleanup — anulação automática antes de remover escola SEED-*',
                data_anulacao: new Date().toISOString(),
            })
            .in(
                'id',
                validos.map((p) => p.id)
            )

        if (anulErr) throw new Error(`anular recibos seed: ${anulErr.message}`)
        say('propinas', `${validos.length} recibo(s) válido(s) anulado(s)`)
    }

    const ids = pagos.map((p) => p.id)
    const { error: delErr, count } = await supabase
        .from('pagamentos_propinas')
        .delete({ count: 'exact' })
        .in('id', ids)

    const removed = count ?? 0
    if (delErr) {
        throw new Error(`apagar recibos seed: ${delErr.message}`)
    }

    if (removed < ids.length) {
        console.warn(
            `! ${ids.length - removed} recibo(s) anulado(s) não foram apagados (trigger AGT com RETURN NEW).`
        )
        console.warn(
            '  Aplique: node scripts/apply-agt-receipt-delete-fix.mjs  (requer DATABASE_URL)'
        )
    } else {
        say('propinas', `${removed} recibo(s) de propinas removido(s)`)
    }

    return removed
}

/** Remove FKs / perfis que impedem auth.admin.deleteUser dos users seed. */
async function clearSeedAuthDependencies(supabase, users, say) {
    for (const user of users) {
        await supabase.from('historico_administrativo_escolas').delete().eq('alterado_por', user.id)
        await supabase
            .from('historico_administrativo_direcoes_municipais')
            .delete()
            .eq('alterado_por', user.id)
        await supabase.from('leitura_circulares').delete().eq('lido_por', user.id)
        await supabase.from('leituras_circulares_provinciais').delete().eq('lido_por', user.id)
        await supabase.from('circulares_municipais').delete().eq('created_by', user.id)
        await supabase.from('circulares_provinciais').delete().eq('created_by', user.id)
        await supabase.from('solicitacoes_documentos').delete().eq('solicitante_user_id', user.id)
        await supabase
            .from('solicitacoes_documentos')
            .update({ analisado_por: null })
            .eq('analisado_por', user.id)
        await supabase.from('audit_logs').delete().eq('changed_by', user.id)
        await supabase.from('role_cache').delete().eq('user_id', user.id)
        await supabase.from('user_profiles').delete().eq('user_id', user.id)
        await supabase.from('direcoes_municipais').delete().eq('user_id', user.id)
        await supabase.from('direcoes_provinciais').delete().eq('user_id', user.id)

        // Recibos ainda válidos registados pelo user seed (antes de anular/apagar)
        const { data: pagos } = await supabase
            .from('pagamentos_propinas')
            .select('id, estado')
            .or(`registado_por.eq.${user.id},anulado_por.eq.${user.id}`)

        const validos = (pagos || []).filter((p) => p.estado === 'valido')
        if (validos.length) {
            await supabase
                .from('pagamentos_propinas')
                .update({ registado_por: null, anulado_por: null })
                .in(
                    'id',
                    validos.map((p) => p.id)
                )
        }
        // Anulados: registado_por é imutável até o trigger AGT ser corrigido
        await supabase
            .from('pagamentos_propinas')
            .update({ anulado_por: null })
            .eq('anulado_por', user.id)
            .eq('estado', 'valido')
    }
    say('auth', `Dependências limpas para ${users.length} user(s) seed`)
}

async function deleteSeedDirecoes(supabase, say) {
    const dms = await listSeedDirecoesMunicipais(supabase)
    const dps = await listSeedDirecoesProvinciais(supabase)

    say('dm', `${dms.length} direção(ões) municipal(is) seed`)
    for (const d of dms) {
        await supabase
            .from('historico_administrativo_direcoes_municipais')
            .delete()
            .eq('direcao_municipal_id', d.id)
        const { error } = await supabase.from('direcoes_municipais').delete().eq('id', d.id)
        if (error) throw new Error(`Falha ao apagar DM ${d.email}: ${error.message}`)
        say('delete', `DM ${d.municipio} · ${d.email}`)
    }

    say('dp', `${dps.length} direção(ões) provincial(is) seed`)
    for (const d of dps) {
        const { error } = await supabase.from('direcoes_provinciais').delete().eq('id', d.id)
        if (error) throw new Error(`Falha ao apagar DP ${d.email}: ${error.message}`)
        say('delete', `DP ${d.provincia} · ${d.email}`)
    }

    return { dms: dms.length, dps: dps.length }
}

/**
 * Remove only municipal/provincial seed (keeps escolas SEED-*).
 * @param {{ silent?: boolean }} [opts]
 */
export async function unseedDirecoesOnly(opts = {}) {
    const { silent = false } = opts
    const say = silent ? () => {} : log

    console.log('\n🧹 EduGest — Limpeza seed das Direções\n')
    const supabase = createServiceClient()

    const circ = await deleteSeedCirculares(supabase, say)
    const sols = await deleteSeedSolicitacoes(supabase, say)
    const dirs = await deleteSeedDirecoes(supabase, say)

    // Remove only auth users for DM/DP (emails dm.* / dp.*)
    const users = await listSeedAuthUsers(supabase)
    const dirUsers = users.filter((u) => {
        const email = (u.email || '').toLowerCase()
        return email.startsWith('dm.') || email.startsWith('dp.')
    })

    await clearSeedAuthDependencies(supabase, dirUsers, say)

    let deletedUsers = 0
    for (const user of dirUsers) {
        const { error } = await supabase.auth.admin.deleteUser(user.id)
        if (error) {
            console.warn(`! auth ${user.email}: ${error.message}`)
            continue
        }
        deletedUsers += 1
        await sleep(80)
    }

    console.log('\n✅ Limpeza de direções concluída')
    console.log(`   Circulares: ${circ.mun} mun. + ${circ.prov} prov.`)
    console.log(`   Solicitações: ${sols}`)
    console.log(`   Direções: ${dirs.dms} mun. + ${dirs.dps} prov.`)
    console.log(`   Utilizadores auth removidos: ${deletedUsers}\n`)

    return { ...dirs, circulares: circ.mun + circ.prov, solicitacoes: sols, users: deletedUsers }
}

/**
 * @param {{ silent?: boolean, asModule?: boolean }} [opts]
 */
export async function unseed(opts = {}) {
    const { silent = false } = opts
    const say = silent ? () => {} : log

    console.log('\n🧹 EduGest — Limpeza da seed de testes\n')
    const supabase = createServiceClient()

    // 1. Circulares + solicitações (antes de apagar users / direções)
    const circ = await deleteSeedCirculares(supabase, say)
    const sols = await deleteSeedSolicitacoes(supabase, say)

    // 2. Direções (antes das escolas — leituras podem referenciar escolas)
    const dirs = await deleteSeedDirecoes(supabase, say)

    // 3. Escolas seed (anular recibos AGT antes — CASCADE bloqueia estado=valido)
    const escolas = await listSeedEscolas(supabase)
    say('escolas', `${escolas.length} escola(s) seed encontradas`)

    // Catch marker leftovers early so propinas cover them too
    const { data: marked } = await supabase
        .from('escolas')
        .select('id, codigo_escola, nome, configuracoes')
        .filter('configuracoes->>seed_marker', 'eq', 'edugest-test-seed')

    const allEscolas = [
        ...escolas,
        ...(marked || []).filter((m) => !escolas.some((e) => e.id === m.id)),
    ]

    await clearSeedPropinas(supabase, allEscolas, say)

    for (const escola of allEscolas) {
        const { error } = await supabase.from('escolas').delete().eq('id', escola.id)
        if (error) {
            throw new Error(`Falha ao apagar ${escola.codigo_escola}: ${error.message}`)
        }
        say('delete', `Apagada ${escola.codigo_escola} · ${escola.nome}`)
    }

    // 4. Auth users @seed.edugest.test
    const users = await listSeedAuthUsers(supabase)
    say('auth', `${users.length} utilizador(es) seed a remover`)
    await clearSeedAuthDependencies(supabase, users, say)

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
    console.log(`   Circulares: ${circ.mun} mun. + ${circ.prov} prov.`)
    console.log(`   Solicitações: ${sols}`)
    console.log(`   Direções: ${dirs.dms} mun. + ${dirs.dps} prov.`)
    console.log(`   Escolas removidas: ${allEscolas.length}`)
    console.log(`   Utilizadores auth removidos: ${deletedUsers}`)
    console.log(`   Domínio limpo: @${SEED_EMAIL_DOMAIN} / ${SEED_CODIGO_PREFIX}*\n`)

    return {
        escolas: escolas.length,
        users: deletedUsers,
        direcoesMunicipais: dirs.dms,
        direcoesProvinciais: dirs.dps,
        circulares: circ.mun + circ.prov,
        solicitacoes: sols,
    }
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
