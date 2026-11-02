#!/usr/bin/env node
/**
 * Verifica que eliminar uma escola remove também o responsável (auth).
 * Cria uma escola temporária, elimina-a via core logic, confirma que a conta auth sumiu.
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnv, createServiceClient, sleep } from './seed/_shared.mjs'
import { superadminDeleteEscola } from './superadmin-delete-escola-core.mjs'

async function getSuperAdminAccessToken(admin) {
    const { data: sas, error } = await admin
        .from('user_profiles')
        .select('user_id')
        .eq('tipo_perfil', 'SUPERADMIN')
        .eq('ativo', true)
        .limit(1)

    if (error || !sas?.length) throw new Error('Nenhum SUPERADMIN activo encontrado')

    const { data: userData } = await admin.auth.admin.getUserById(sas[0].user_id)
    const email = userData?.user?.email
    if (!email) throw new Error('SuperAdmin sem email')

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
    })
    if (linkErr) throw linkErr

    const tokenHash = linkData.properties.hashed_token
    const env = loadEnv()

    // loadEnv() only returns url/serviceKey; re-read .env for anon/publishable
    const { readFileSync, existsSync } = await import('fs')
    const { resolve } = await import('path')
    const fileEnv = {}
    for (const file of [resolve(env.root, '.env'), resolve(env.root, '.env.local')]) {
        if (!existsSync(file)) continue
        for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('#')) continue
            const i = trimmed.indexOf('=')
            if (i <= 0) continue
            fileEnv[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim()
        }
    }

    const anonKey =
        fileEnv.VITE_SUPABASE_ANON_KEY ||
        fileEnv.SUPABASE_PUBLISHABLE_KEY ||
        fileEnv.SUPABASE_ANON_KEY ||
        ''
    if (!anonKey) throw new Error('Missing VITE_SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY in .env')

    const userClient = createClient(env.url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: verified, error: verifyErr } = await userClient.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'email',
    })
    if (verifyErr || !verified.session?.access_token) {
        throw new Error(`Falha ao obter sessão SuperAdmin: ${verifyErr?.message || 'sem token'}`)
    }

    return {
        accessToken: verified.session.access_token,
        email,
        url: env.url,
        anonKey,
        serviceKey: env.serviceKey,
    }
}

async function main() {
    console.log('\n🧪 Verificar eliminação de escola + responsável\n')
    const admin = createServiceClient()
    const { accessToken, email, url, anonKey, serviceKey } = await getSuperAdminAccessToken(admin)
    console.log(`[auth] SuperAdmin: ${email}`)

    const stamp = Date.now().toString(36)
    const tempEmail = `tmp.del.${stamp}@seed.edugest.test`
    const tempPassword = 'TempDelete@2026!'

    const { data: createdUser, error: createUserErr } = await admin.auth.admin.createUser({
        email: tempEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: `Tmp Responsavel ${stamp}`, role: 'ESCOLA' },
    })
    if (createUserErr) throw createUserErr
    const responsavelId = createdUser.user.id
    console.log(`[auth] Responsável temporário: ${tempEmail} (${responsavelId.slice(0, 8)}…)`)

    const codigo = `TMP-DEL-${stamp}`.toUpperCase().slice(0, 20)
    const { data: escola, error: escolaErr } = await admin
        .from('escolas')
        .insert({
            user_id: responsavelId,
            nome: `Escola Temporária Delete ${stamp}`,
            codigo_escola: codigo,
            provincia: 'Luanda',
            municipio: 'Belas',
            email: tempEmail,
            configuracoes: { seed_marker: 'tmp-delete-escola-test' },
            ativo: true,
        })
        .select('id, codigo_escola, user_id')
        .single()

    if (escolaErr) {
        await admin.auth.admin.deleteUser(responsavelId)
        throw escolaErr
    }
    console.log(`[escola] Criada ${escola.codigo_escola} (${escola.id.slice(0, 8)}…)`)

    // Ensure profile exists (trigger should create it)
    await sleep(300)
    const { data: profile } = await admin
        .from('user_profiles')
        .select('user_id, tipo_perfil, escola_id')
        .eq('user_id', responsavelId)
        .maybeSingle()
    console.log(`[perfil] ${profile ? profile.tipo_perfil : 'AUSENTE'} escola=${profile?.escola_id?.slice(0, 8) || '—'}`)

    const result = await superadminDeleteEscola({
        url,
        serviceKey,
        anonKey,
        accessToken,
        escolaId: escola.id,
        motivo: 'Teste automático: eliminação com responsável',
        createBackup: true,
    })

    console.log('[delete]', result)

    if (!result.success) {
        throw new Error(result.error || 'Delete falhou')
    }

    const { data: escolaAfter } = await admin.from('escolas').select('id').eq('id', escola.id).maybeSingle()
    const { data: profileAfter } = await admin
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', responsavelId)
        .maybeSingle()
    const { data: authAfter, error: authAfterErr } = await admin.auth.admin.getUserById(responsavelId)

    console.log('\n📋 Resultado')
    console.log(`   Escola removida: ${!escolaAfter ? 'SIM' : 'NÃO'}`)
    console.log(`   Perfil removido: ${!profileAfter ? 'SIM' : 'NÃO'}`)
    console.log(
        `   Conta auth responsável removida: ${authAfterErr || !authAfter?.user ? 'SIM' : 'NÃO'}`
    )
    console.log(`   deleted_auth_users: ${result.deleted_auth_users ?? 0}`)

    if (escolaAfter || profileAfter || authAfter?.user) {
        // cleanup leftovers
        if (escolaAfter) await admin.from('escolas').delete().eq('id', escola.id)
        if (authAfter?.user) await admin.auth.admin.deleteUser(responsavelId)
        console.error('\n❌ Verificação FALHOU — dados residuais encontrados\n')
        process.exit(1)
    }

    console.log('\n✅ Verificação OK — escola, perfil e responsável auth foram eliminados\n')
}

main().catch((err) => {
    console.error('\n❌', err.message || err)
    process.exit(1)
})
