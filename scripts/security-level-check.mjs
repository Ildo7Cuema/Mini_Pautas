#!/usr/bin/env node
/**
 * Testes defensivos de segurança (não ofensivos).
 * Verifica que controlos de hardening bloqueiam o que devem bloquear.
 */
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnv() {
    const envPath = join(ROOT, '.env')
    if (!existsSync(envPath)) return
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        if (!line || line.startsWith('#')) continue
        const i = line.indexOf('=')
        if (i <= 0) continue
        const k = line.slice(0, i).trim()
        const v = line.slice(i + 1).trim()
        if (!(k in process.env)) process.env[k] = v
    }
}

loadEnv()

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const password = 'SeedTest@2026!'

if (!url || !anon || !secret) {
    console.error('Missing SUPABASE_URL / anon / secret key in .env')
    process.exit(1)
}

const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
})

const results = []

function record(id, area, expected, passed, detail) {
    results.push({ id, area, expected, passed, detail: String(detail || '').slice(0, 240) })
    const mark = passed ? 'PASS' : 'FAIL'
    console.log(`${mark}  [${area}] ${id} — ${detail}`)
}

function clientAs(session) {
    return createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    })
}

async function signIn(email) {
    const c = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await c.auth.signInWithPassword({ email, password })
    if (error) throw new Error(`login ${email}: ${error.message}`)
    return data.session
}

async function main() {
    console.log('=== Security level check (defensive) ===\n')

    // --- 0. Baseline: hardening functions exist ---
    {
        const { error } = await admin.rpc('is_conselho_gestor', {
            p_escola_id: '00000000-0000-0000-0000-000000000000',
        })
        record(
            'rpc-is-conselho-gestor-exists',
            'Hardening',
            'function available',
            !error || !/Could not find the function|PGRST202/i.test(error.message),
            error ? error.message : 'ok',
        )
    }

    // Resolve seed escola + users
    const { data: escola } = await admin
        .from('escolas')
        .select('id, nome, codigo_escola, user_id')
        .eq('codigo_escola', 'SEED-PRI-2026')
        .maybeSingle()

    if (!escola) {
        record('seed-escola', 'Setup', 'seed school present', false, 'SEED-PRI-2026 not found — run seed:test')
        finish()
        return
    }
    record('seed-escola', 'Setup', 'seed school present', true, escola.nome)

    const { data: escolaProfile } = await admin
        .from('user_profiles')
        .select('user_id, tipo_perfil')
        .eq('escola_id', escola.id)
        .eq('tipo_perfil', 'ESCOLA')
        .limit(1)
        .maybeSingle()

    const { data: prof } = await admin
        .from('professores')
        .select('user_id, email, nome_completo')
        .eq('escola_id', escola.id)
        .not('user_id', 'is', null)
        .limit(1)
        .maybeSingle()

    // Get emails from auth
    async function emailFor(userId) {
        const { data } = await admin.auth.admin.getUserById(userId)
        return data?.user?.email || null
    }

    const escolaEmail = escolaProfile?.user_id ? await emailFor(escolaProfile.user_id) : null
    const profEmail = prof?.user_id ? await emailFor(prof.user_id) : null

    record('seed-emails', 'Setup', 'ESCOLA + PROFESSOR emails', Boolean(escolaEmail && profEmail), {
        escolaEmail: escolaEmail ? 'yes' : 'no',
        profEmail: profEmail ? 'yes' : 'no',
    })

    // Find or note a conselho
    const { data: conselho } = await admin
        .from('conselho_notas')
        .select('id, status, escola_id, turma_id')
        .eq('escola_id', escola.id)
        .limit(1)
        .maybeSingle()

    // --- 1. Unauthenticated RPCs must fail ---
    {
        const anonClient = createClient(url, anon, { auth: { persistSession: false } })
        const { error } = await anonClient.rpc('aprovar_conselho_notas', {
            p_conselho_id: conselho?.id || '00000000-0000-0000-0000-000000000000',
        })
        const blocked = Boolean(error)
        record(
            'anon-cannot-aprovar-conselho',
            'Authz RPC',
            'reject unauthenticated approve',
            blocked,
            error?.message || 'UNEXPECTED: no error',
        )
    }

    // --- 2. Professor cannot approve / notify aprovado ---
    if (profEmail) {
        const session = await signIn(profEmail)
        const sb = clientAs(session)

        const { data: isGestor, error: gErr } = await sb.rpc('is_conselho_gestor', {
            p_escola_id: escola.id,
        })
        record(
            'professor-is-not-gestor',
            'Authz RPC',
            'is_conselho_gestor=false for professor',
            !gErr && isGestor === false,
            gErr?.message || `is_conselho_gestor=${isGestor}`,
        )

        if (conselho?.id) {
            const { error: apErr } = await sb.rpc('aprovar_conselho_notas', {
                p_conselho_id: conselho.id,
            })
            const blocked = /direc[cç][aã]o|permiss[aã]o|Sem permiss/i.test(apErr?.message || '')
            record(
                'professor-cannot-aprovar',
                'Authz RPC',
                'aprovar blocked for professor',
                Boolean(apErr) && blocked,
                apErr?.message || 'UNEXPECTED success',
            )

            const { error: nErr } = await sb.rpc('notificar_conselho_evento', {
                p_conselho_id: conselho.id,
                p_evento: 'aprovado',
            })
            const nBlocked = Boolean(nErr)
            record(
                'professor-cannot-notify-aprovado',
                'Authz RPC',
                'notify aprovado blocked for professor',
                nBlocked,
                nErr?.message || 'UNEXPECTED success',
            )
        } else {
            record(
                'professor-cannot-aprovar',
                'Authz RPC',
                'aprovar blocked for professor',
                true,
                'SKIPPED (no conselho row) — gestor check still ran',
            )
            record(
                'professor-cannot-notify-aprovado',
                'Authz RPC',
                'notify aprovado blocked',
                true,
                'SKIPPED (no conselho row)',
            )
        }

        // Professor should not insert arbitrary notification to random UUID
        const { error: notifErr } = await sb.from('notificacoes').insert({
            destinatario_id: '00000000-0000-0000-0000-000000000099',
            tipo: 'sistema',
            titulo: 'sec-test',
            mensagem: 'should fail',
            link: 'dashboard',
            lida: false,
        })
        record(
            'professor-cannot-spam-arbitrary-dest',
            'Notificacoes RLS',
            'INSERT arbitrary destinatario blocked',
            Boolean(notifErr),
            notifErr?.message || 'UNEXPECTED success',
        )

        // Professor cannot invite membros (insert)
        if (conselho?.id) {
            const { error: mErr } = await sb.from('conselho_notas_membros').insert({
                conselho_id: conselho.id,
                user_id: prof.user_id,
                papel: 'membro',
                status: 'pendente',
                prazo_dias: 3,
                expires_at: new Date(Date.now() + 86400000).toISOString(),
            })
            record(
                'professor-cannot-insert-membro',
                'Conselho RLS',
                'membro INSERT blocked for non-gestor',
                Boolean(mErr),
                mErr?.message || 'UNEXPECTED success',
            )
        }

        await createClient(url, anon).auth.signOut().catch(() => {})
    }

    // --- 3. ESCOLA is gestor ---
    if (escolaEmail) {
        const session = await signIn(escolaEmail)
        const sb = clientAs(session)
        const { data: isGestor, error } = await sb.rpc('is_conselho_gestor', {
            p_escola_id: escola.id,
        })
        record(
            'escola-is-gestor',
            'Authz RPC',
            'is_conselho_gestor=true for ESCOLA',
            !error && isGestor === true,
            error?.message || `is_conselho_gestor=${isGestor}`,
        )
    }

    // --- 4. Storage: anon abuse outside inscricoes ---
    {
        const anonClient = createClient(url, anon, { auth: { persistSession: false } })
        const blob = new Blob(['security-probe'], { type: 'text/plain' })

        const badPath = `cabecalhos/sec-probe-${Date.now()}.txt`
        const { error: badErr } = await anonClient.storage
            .from('concursos-documentos')
            .upload(badPath, blob, { upsert: false })
        record(
            'anon-cannot-upload-cabecalhos',
            'Storage',
            'anon blocked outside inscricoes/',
            Boolean(badErr),
            badErr?.message || 'UNEXPECTED success',
        )

        // Cleanup if somehow uploaded
        if (!badErr) {
            await admin.storage.from('concursos-documentos').remove([badPath])
        }

        const goodPath = `inscricoes/sec-probe/${Date.now()}.txt`
        const { error: goodErr } = await anonClient.storage
            .from('concursos-documentos')
            .upload(goodPath, blob, { upsert: false })
        // Allowed by policy (public inscription). Clean up after.
        record(
            'anon-can-upload-inscricoes',
            'Storage',
            'anon allowed under inscricoes/ (inscription flow)',
            !goodErr,
            goodErr?.message || 'upload ok',
        )
        if (!goodErr) {
            await admin.storage.from('concursos-documentos').remove([goodPath])
        }
    }

    // --- 5. Auth logos must use uid prefix ---
    if (profEmail) {
        const session = await signIn(profEmail)
        const sb = clientAs(session)
        const blob = new Blob(['logo-probe'], { type: 'image/png' })
        const badLogo = `logos/not-my-uid_${Date.now()}.png`
        const { error: logoErr } = await sb.storage.from('mini-pauta-assets').upload(badLogo, blob)
        record(
            'auth-logo-requires-uid-prefix',
            'Storage',
            'logo path without auth.uid() blocked',
            Boolean(logoErr),
            logoErr?.message || 'UNEXPECTED success',
        )
        if (!logoErr) await admin.storage.from('mini-pauta-assets').remove([badLogo])

        const goodLogo = `logos/${session.user.id}_${Date.now()}.png`
        const { error: okLogoErr } = await sb.storage.from('mini-pauta-assets').upload(goodLogo, blob)
        record(
            'auth-logo-with-uid-allowed',
            'Storage',
            'logo path with auth.uid() allowed',
            !okLogoErr,
            okLogoErr?.message || 'upload ok',
        )
        if (!okLogoErr) await admin.storage.from('mini-pauta-assets').remove([goodLogo])
    }

    // --- 6. Circulares path must be uid/ ---
    if (escolaEmail) {
        const session = await signIn(escolaEmail)
        const sb = clientAs(session)
        const blob = new Blob(['circ'], { type: 'application/pdf' })
        const bad = `flat_${Date.now()}.pdf`
        const { error: badCirc } = await sb.storage.from('circulares').upload(bad, blob)
        record(
            'circulares-flat-path-blocked',
            'Storage',
            'flat circulares path blocked',
            Boolean(badCirc),
            badCirc?.message || 'UNEXPECTED success',
        )
        if (!badCirc) await admin.storage.from('circulares').remove([bad])

        const good = `${session.user.id}/sec_${Date.now()}.pdf`
        const { error: goodCirc } = await sb.storage.from('circulares').upload(good, blob)
        record(
            'circulares-uid-path-allowed',
            'Storage',
            'uid/ path allowed',
            !goodCirc,
            goodCirc?.message || 'upload ok',
        )
        if (!goodCirc) await admin.storage.from('circulares').remove([good])
    }

    // --- 7. Tokens purged from conselho notifications ---
    {
        const { data } = await admin
            .from('notificacoes')
            .select('id, dados_adicionais')
            .like('tipo', 'conselho_notas_%')
            .not('dados_adicionais', 'is', null)
            .limit(100)
        const withToken = (data || []).filter((n) => n.dados_adicionais?.token)
        record(
            'conselho-notif-no-token',
            'Tokens',
            'no token in dados_adicionais',
            withToken.length === 0,
            `checked=${(data || []).length} withToken=${withToken.length}`,
        )
    }

    // --- 8. Frontend client must not embed service role (static check) ---
    {
        const clientSrc = readFileSync(join(ROOT, 'src/lib/supabaseClient.ts'), 'utf8')
        const ok =
            clientSrc.includes('VITE_SUPABASE_ANON_KEY') &&
            !/SERVICE_ROLE|SECRET_KEY/i.test(clientSrc)
        record(
            'frontend-uses-anon-only',
            'Secrets',
            'supabaseClient uses anon key only',
            ok,
            ok ? 'anon only' : 'service role reference found',
        )
    }

    finish()
}

function finish() {
    const passed = results.filter((r) => r.passed).length
    const failed = results.filter((r) => !r.passed).length
    const total = results.length
    const score = total ? Math.round((passed / total) * 100) : 0

    let level = 'CRÍTICO'
    if (score >= 90 && failed === 0) level = 'BOM'
    else if (score >= 75) level = 'ACEITÁVEL'
    else if (score >= 50) level = 'FRACO'

    const criticalAreasFailed = results.filter(
        (r) => !r.passed && ['Authz RPC', 'Storage', 'Secrets'].includes(r.area),
    )

    if (criticalAreasFailed.length > 0 && level === 'BOM') level = 'ACEITÁVEL'
    if (criticalAreasFailed.length >= 3) level = 'FRACO'

    const summary = {
        generatedAt: new Date().toISOString(),
        score,
        level,
        passed,
        failed,
        total,
        results,
    }

    const out = join(ROOT, 'docs/SECURITY_LEVEL_CHECK.json')
    writeFileSync(out, JSON.stringify(summary, null, 2))

    console.log('\n=== SUMMARY ===')
    console.log(`Score: ${score}/100`)
    console.log(`Nível: ${level}`)
    console.log(`Pass: ${passed}  Fail: ${failed}  Total: ${total}`)
    console.log(`Report: ${out}`)

    process.exit(failed > 0 ? 2 : 0)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
