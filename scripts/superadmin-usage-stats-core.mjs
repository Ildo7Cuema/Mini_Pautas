/**
 * Agrega estatísticas de utilização do sistema para SUPERADMIN.
 * Usa service role (bypassa RLS) após validar o access token.
 */
import { createClient } from '@supabase/supabase-js'

function toDayKey(value) {
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    return d.toISOString().slice(0, 10)
}

function maxIso(...values) {
    let best = null
    for (const v of values) {
        if (!v) continue
        if (!best || v > best) best = v
    }
    return best
}

/**
 * @param {{
 *  url: string
 *  serviceKey: string
 *  anonKey?: string
 *  accessToken: string
 *  diasActividade?: number
 *  limiteEscolas?: number
 * }} opts
 */
export async function getSuperAdminUsageStats(opts) {
    const {
        url,
        serviceKey,
        anonKey = '',
        accessToken,
        diasActividade = 14,
        limiteEscolas = 200,
    } = opts

    if (!url || !serviceKey) {
        return { success: false, status: 500, error: 'Server misconfigured' }
    }
    if (!accessToken) {
        return { success: false, status: 401, error: 'Não autenticado' }
    }

    const userClient = createClient(url, anonKey || serviceKey, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user?.id) {
        return { success: false, status: 401, error: 'Sessão inválida' }
    }

    const admin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: profile, error: profileErr } = await admin
        .from('user_profiles')
        .select('tipo_perfil, ativo')
        .eq('user_id', userData.user.id)
        .maybeSingle()

    if (profileErr) {
        return { success: false, status: 500, error: profileErr.message }
    }
    if (!profile || profile.tipo_perfil !== 'SUPERADMIN' || profile.ativo === false) {
        return { success: false, status: 403, error: 'Acesso negado: apenas SUPERADMIN' }
    }

    const dias = Math.max(Number(diasActividade) || 14, 1)
    const limite = Math.min(Math.max(Number(limiteEscolas) || 200, 1), 500)
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const d7 = new Date(now.getTime() - 7 * 86400000)
    const d30 = new Date(now.getTime() - 30 * 86400000)
    const seriesStart = new Date(now.getTime() - (dias - 1) * 86400000)
    seriesStart.setHours(0, 0, 0, 0)
    const seriesStartIso = seriesStart.toISOString()
    const d7Iso = d7.toISOString()
    const d30Iso = d30.toISOString()
    const todayIso = startOfToday.toISOString()

    const [
        escolasRes,
        professoresRes,
        turmasRes,
        alunosRes,
        notasRes,
        visitasRes,
    ] = await Promise.all([
        admin.from('escolas').select('id, nome, codigo_escola, provincia, municipio, ativo, bloqueado'),
        admin.from('professores').select('escola_id, created_at, ativo'),
        admin.from('turmas').select('id, escola_id'),
        admin.from('alunos').select('turma_id, created_at, ativo'),
        admin.from('notas').select('turma_id, created_at, data_lancamento'),
        admin.from('system_visits').select('escola_id, user_id, created_at').gte('created_at', d30Iso),
    ])

    for (const [label, res] of [
        ['escolas', escolasRes],
        ['professores', professoresRes],
        ['turmas', turmasRes],
        ['alunos', alunosRes],
        ['notas', notasRes],
    ]) {
        if (res.error) {
            return { success: false, status: 500, error: `${label}: ${res.error.message}` }
        }
    }
    if (visitasRes.error) {
        console.warn('usage visits:', visitasRes.error.message)
    }

    const escolas = escolasRes.data || []
    const professores = professoresRes.data || []
    const turmas = turmasRes.data || []
    const alunos = alunosRes.data || []
    const notas = notasRes.data || []
    const visitas = visitasRes.data || []

    const turmaToEscola = new Map()
    for (const t of turmas) turmaToEscola.set(t.id, t.escola_id)

    const byEscola = new Map()
    const ensure = (id) => {
        let row = byEscola.get(id)
        if (!row) {
            row = {
                professores: 0,
                alunos: 0,
                turmas: 0,
                notas: 0,
                professores_7d: 0,
                alunos_7d: 0,
                notas_7d: 0,
                acessos_7d: 0,
                acessos_30d: 0,
                ultimo_acesso: null,
                ultimo_prof: null,
                ultimo_aluno: null,
                ultimo_nota: null,
            }
            byEscola.set(id, row)
        }
        return row
    }

    for (const t of turmas) ensure(t.escola_id).turmas += 1

    for (const p of professores) {
        if (p.ativo === false) continue
        const row = ensure(p.escola_id)
        row.professores += 1
        if (p.created_at && p.created_at >= d7Iso) row.professores_7d += 1
        row.ultimo_prof = maxIso(row.ultimo_prof, p.created_at)
    }

    for (const a of alunos) {
        if (a.ativo === false) continue
        const escolaId = turmaToEscola.get(a.turma_id)
        if (!escolaId) continue
        const row = ensure(escolaId)
        row.alunos += 1
        if (a.created_at && a.created_at >= d7Iso) row.alunos_7d += 1
        row.ultimo_aluno = maxIso(row.ultimo_aluno, a.created_at)
    }

    for (const n of notas) {
        const escolaId = turmaToEscola.get(n.turma_id)
        if (!escolaId) continue
        const when = n.data_lancamento || n.created_at
        const row = ensure(escolaId)
        row.notas += 1
        if (when && when >= d7Iso) row.notas_7d += 1
        row.ultimo_nota = maxIso(row.ultimo_nota, when)
    }

    for (const v of visitas) {
        if (!v.escola_id || !v.created_at) continue
        const row = ensure(v.escola_id)
        if (v.created_at >= d7Iso) row.acessos_7d += 1
        if (v.created_at >= d30Iso) row.acessos_30d += 1
        row.ultimo_acesso = maxIso(row.ultimo_acesso, v.created_at)
    }

    const escolasRows = escolas.map((e) => {
        const acc = byEscola.get(e.id) || ensure(e.id)
        const ultima = maxIso(acc.ultimo_acesso, acc.ultimo_prof, acc.ultimo_aluno, acc.ultimo_nota)
        const estado_uso =
            acc.acessos_7d > 0 || acc.notas_7d > 0
                ? 'activo'
                : acc.professores > 0 && acc.alunos > 0
                    ? 'parcial'
                    : 'inactivo'
        return {
            escola_id: e.id,
            nome: e.nome,
            codigo_escola: e.codigo_escola,
            provincia: e.provincia,
            municipio: e.municipio,
            ativo: Boolean(e.ativo),
            bloqueado: Boolean(e.bloqueado),
            professores: acc.professores,
            alunos: acc.alunos,
            turmas: acc.turmas,
            notas: acc.notas,
            professores_7d: acc.professores_7d,
            alunos_7d: acc.alunos_7d,
            notas_7d: acc.notas_7d,
            acessos_7d: acc.acessos_7d,
            acessos_30d: acc.acessos_30d,
            ultimo_acesso: acc.ultimo_acesso || null,
            ultima_actividade: ultima,
            estado_uso,
        }
    })

    escolasRows.sort((a, b) => {
        const rank = { activo: 0, parcial: 1, inactivo: 2 }
        const ra = rank[a.estado_uso] - rank[b.estado_uso]
        if (ra !== 0) return ra
        return String(b.ultima_actividade || '').localeCompare(String(a.ultima_actividade || ''))
    })

    const dailyMap = new Map()
    for (let i = 0; i < dias; i++) {
        const d = new Date(seriesStart.getTime() + i * 86400000)
        dailyMap.set(toDayKey(d), { professores: 0, alunos: 0, notas: 0, acessos: 0 })
    }
    for (const p of professores) {
        const bucket = dailyMap.get(toDayKey(p.created_at))
        if (bucket) bucket.professores += 1
    }
    for (const a of alunos) {
        const bucket = dailyMap.get(toDayKey(a.created_at))
        if (bucket) bucket.alunos += 1
    }
    for (const n of notas) {
        const bucket = dailyMap.get(toDayKey(n.data_lancamento || n.created_at))
        if (bucket) bucket.notas += 1
    }
    for (const v of visitas) {
        const bucket = dailyMap.get(toDayKey(v.created_at))
        if (bucket) bucket.acessos += 1
    }

    const activeProf = professores.filter((p) => p.ativo !== false)
    const activeAlunos = alunos.filter((a) => a.ativo !== false)
    const notas7d = notas.filter((n) => (n.data_lancamento || n.created_at || '') >= d7Iso).length
    const notas30d = notas.filter((n) => (n.data_lancamento || n.created_at || '') >= d30Iso).length
    const acessosHoje = visitas.filter((v) => (v.created_at || '') >= todayIso).length
    const acessos7d = visitas.filter((v) => (v.created_at || '') >= d7Iso).length
    const users7d = new Set(
        visitas.filter((v) => (v.created_at || '') >= d7Iso && v.user_id).map((v) => v.user_id),
    ).size

    const payload = {
        resumo: {
            total_escolas: escolas.length,
            escolas_com_professores: escolasRows.filter((e) => e.professores > 0).length,
            escolas_com_alunos: escolasRows.filter((e) => e.alunos > 0).length,
            escolas_com_notas: escolasRows.filter((e) => e.notas > 0).length,
            escolas_activas_7d: escolasRows.filter((e) => e.estado_uso === 'activo').length,
            escolas_sem_uso: escolasRows.filter(
                (e) => e.professores === 0 && e.alunos === 0 && e.notas === 0 && e.acessos_7d === 0,
            ).length,
            total_professores: activeProf.length,
            total_alunos: activeAlunos.length,
            total_turmas: turmas.length,
            total_notas: notas.length,
            professores_7d: activeProf.filter((p) => (p.created_at || '') >= d7Iso).length,
            professores_30d: activeProf.filter((p) => (p.created_at || '') >= d30Iso).length,
            alunos_7d: activeAlunos.filter((a) => (a.created_at || '') >= d7Iso).length,
            alunos_30d: activeAlunos.filter((a) => (a.created_at || '') >= d30Iso).length,
            notas_7d: notas7d,
            notas_30d: notas30d,
            acessos_hoje: acessosHoje,
            acessos_7d: acessos7d,
            utilizadores_unicos_7d: users7d,
            gerado_em: now.toISOString(),
        },
        actividade_diaria: Array.from(dailyMap.entries()).map(([dia, vals]) => ({ dia, ...vals })),
        escolas: escolasRows.slice(0, limite),
        parametros: { dias_actividade: dias, limite_escolas: limite },
    }

    return { success: true, status: 200, ...payload }
}
