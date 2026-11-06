import { supabase } from '../lib/supabaseClient'
import type {
    SuperAdminStats,
    SuperAdminAction,
    SuperAdminUsageStats,
    Escola,
    EscolaBackup,
    SystemVisit,
    SystemVisitStats,
} from '../types'

/**
 * SUPERADMIN Utility Functions
 * Provides API functions for SUPERADMIN operations
 */

// ============================================
// SYSTEM VISIT TRACKING FUNCTIONS
// ============================================

/**
 * Detect device type from user agent
 */
function detectDeviceType(userAgent: string): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
    if (!userAgent) return 'unknown'
    const ua = userAgent.toLowerCase()
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
    if (/mobile|iphone|ipod|android|blackberry|opera mini|windows phone/i.test(ua)) return 'mobile'
    if (/windows|macintosh|linux/i.test(ua)) return 'desktop'
    return 'unknown'
}

/**
 * Detect browser from user agent
 */
function detectBrowser(userAgent: string): string {
    if (!userAgent) return 'unknown'
    const ua = userAgent.toLowerCase()
    if (ua.includes('edg/')) return 'Edge'
    if (ua.includes('chrome')) return 'Chrome'
    if (ua.includes('firefox')) return 'Firefox'
    if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari'
    if (ua.includes('opera') || ua.includes('opr/')) return 'Opera'
    return 'unknown'
}

/**
 * Detect OS from user agent
 */
function detectOS(userAgent: string): string {
    if (!userAgent) return 'unknown'
    const ua = userAgent.toLowerCase()
    if (ua.includes('windows')) return 'Windows'
    if (ua.includes('mac')) return 'macOS'
    if (ua.includes('linux')) return 'Linux'
    if (ua.includes('android')) return 'Android'
    if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS'
    return 'unknown'
}

/**
 * Log a system visit (call after successful login)
 */
export async function logSystemVisit(
    escolaId?: string,
    tipoPerfil?: string
): Promise<void> {
    try {
        const userAgent = navigator.userAgent
        const deviceType = detectDeviceType(userAgent)
        const browser = detectBrowser(userAgent)
        const os = detectOS(userAgent)

        const { error } = await supabase.rpc('log_system_visit', {
            p_escola_id: escolaId || null,
            p_tipo_perfil: tipoPerfil || null,
            p_device_type: deviceType,
            p_browser: browser,
            p_os: os
        })

        if (error) {
            console.error('Error logging system visit:', error)
            // Don't throw - logging failure shouldn't break the main operation
        }
    } catch (error) {
        console.error('Error logging system visit:', error)
        // Don't throw - logging failure shouldn't break the main operation
    }
}

/**
 * Fetch system visit statistics for SuperAdmin dashboard
 */
export async function fetchSystemVisitStats(): Promise<SystemVisitStats | null> {
    try {
        const { data, error } = await supabase
            .from('system_visit_stats')
            .select('*')
            .single()

        if (error) {
            console.error('Error fetching visit stats:', error)
            return null
        }

        return data as SystemVisitStats
    } catch (error) {
        console.error('Error fetching visit stats:', error)
        return null
    }
}

/**
 * Fetch system visits with filters (for SuperAdmin)
 */
export async function fetchSystemVisits(filters?: {
    tipoPerfil?: string
    escolaId?: string
    startDate?: string
    endDate?: string
    deviceType?: string
    limit?: number
}): Promise<SystemVisit[]> {
    try {
        let query = supabase
            .from('system_visits')
            .select(`
                *,
                escolas:escola_id (nome)
            `)
            .order('created_at', { ascending: false })

        if (filters?.tipoPerfil) {
            query = query.eq('tipo_perfil', filters.tipoPerfil)
        }

        if (filters?.escolaId) {
            query = query.eq('escola_id', filters.escolaId)
        }

        if (filters?.startDate) {
            query = query.gte('created_at', filters.startDate)
        }

        if (filters?.endDate) {
            query = query.lte('created_at', filters.endDate)
        }

        if (filters?.deviceType) {
            query = query.eq('device_type', filters.deviceType)
        }

        if (filters?.limit) {
            query = query.limit(filters.limit)
        } else {
            query = query.limit(100)
        }

        const { data, error } = await query

        if (error) throw error

        // Map escola name from joined data
        return (data || []).map(visit => ({
            ...visit,
            escola_nome: visit.escolas?.nome
        }))
    } catch (error) {
        console.error('Error fetching system visits:', error)
        throw error
    }
}

function normalizeUsageStatsPayload(data: unknown): SuperAdminUsageStats {
    const payload = (data || {}) as Partial<SuperAdminUsageStats>
    return {
        resumo: {
            total_escolas: Number(payload.resumo?.total_escolas ?? 0),
            escolas_com_professores: Number(payload.resumo?.escolas_com_professores ?? 0),
            escolas_com_alunos: Number(payload.resumo?.escolas_com_alunos ?? 0),
            escolas_com_notas: Number(payload.resumo?.escolas_com_notas ?? 0),
            escolas_activas_7d: Number(payload.resumo?.escolas_activas_7d ?? 0),
            escolas_sem_uso: Number(payload.resumo?.escolas_sem_uso ?? 0),
            total_professores: Number(payload.resumo?.total_professores ?? 0),
            total_alunos: Number(payload.resumo?.total_alunos ?? 0),
            total_turmas: Number(payload.resumo?.total_turmas ?? 0),
            total_notas: Number(payload.resumo?.total_notas ?? 0),
            professores_7d: Number(payload.resumo?.professores_7d ?? 0),
            professores_30d: Number(payload.resumo?.professores_30d ?? 0),
            alunos_7d: Number(payload.resumo?.alunos_7d ?? 0),
            alunos_30d: Number(payload.resumo?.alunos_30d ?? 0),
            notas_7d: Number(payload.resumo?.notas_7d ?? 0),
            notas_30d: Number(payload.resumo?.notas_30d ?? 0),
            acessos_hoje: Number(payload.resumo?.acessos_hoje ?? 0),
            acessos_7d: Number(payload.resumo?.acessos_7d ?? 0),
            utilizadores_unicos_7d: Number(payload.resumo?.utilizadores_unicos_7d ?? 0),
            gerado_em: payload.resumo?.gerado_em,
        },
        actividade_diaria: Array.isArray(payload.actividade_diaria)
            ? payload.actividade_diaria.map((p) => ({
                dia: String(p.dia),
                professores: Number(p.professores ?? 0),
                alunos: Number(p.alunos ?? 0),
                notas: Number(p.notas ?? 0),
                acessos: Number(p.acessos ?? 0),
            }))
            : [],
        escolas: Array.isArray(payload.escolas)
            ? payload.escolas.map((e) => ({
                ...e,
                professores: Number(e.professores ?? 0),
                alunos: Number(e.alunos ?? 0),
                turmas: Number(e.turmas ?? 0),
                notas: Number(e.notas ?? 0),
                professores_7d: Number(e.professores_7d ?? 0),
                alunos_7d: Number(e.alunos_7d ?? 0),
                notas_7d: Number(e.notas_7d ?? 0),
                acessos_7d: Number(e.acessos_7d ?? 0),
                acessos_30d: Number(e.acessos_30d ?? 0),
                estado_uso: e.estado_uso || 'inactivo',
            }))
            : [],
        parametros: payload.parametros,
    }
}

function toDayKey(value: string | Date): string {
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    return d.toISOString().slice(0, 10)
}

function maxIso(...values: Array<string | null | undefined>): string | null {
    let best: string | null = null
    for (const v of values) {
        if (!v) continue
        if (!best || v > best) best = v
    }
    return best
}

/**
 * Client-side fallback when get_system_usage_stats RPC is not yet applied.
 * Relies on existing SUPERADMIN SELECT policies.
 */
async function fetchSuperAdminUsageStatsClientFallback(options?: {
    diasActividade?: number
    limiteEscolas?: number
}): Promise<SuperAdminUsageStats> {
    const dias = Math.max(options?.diasActividade ?? 14, 1)
    const limite = Math.min(Math.max(options?.limiteEscolas ?? 200, 1), 500)
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
        notasTotalRes,
        notasRecentesRes,
        visitasRes,
    ] = await Promise.all([
        supabase.from('escolas').select('id, nome, codigo_escola, provincia, municipio, ativo, bloqueado'),
        supabase.from('professores').select('escola_id, created_at, ativo'),
        supabase.from('turmas').select('id, escola_id'),
        supabase.from('alunos').select('turma_id, created_at, ativo'),
        supabase.from('notas').select('id', { count: 'exact', head: true }),
        supabase
            .from('notas')
            .select('turma_id, created_at, data_lancamento')
            .or(`created_at.gte.${seriesStartIso},data_lancamento.gte.${seriesStartIso}`),
        supabase
            .from('system_visits')
            .select('escola_id, user_id, created_at')
            .gte('created_at', d30Iso),
    ])

    if (escolasRes.error) throw escolasRes.error
    if (professoresRes.error) throw professoresRes.error
    if (turmasRes.error) throw turmasRes.error
    if (alunosRes.error) throw alunosRes.error
    if (notasTotalRes.error) throw notasTotalRes.error
    if (notasRecentesRes.error) throw notasRecentesRes.error
    if (visitasRes.error) console.warn('Usage visits fallback:', visitasRes.error.message)

    const escolas = escolasRes.data || []
    const professores = professoresRes.data || []
    const turmas = turmasRes.data || []
    const alunos = alunosRes.data || []
    const notasRecentes = notasRecentesRes.data || []
    const visitas = visitasRes.data || []

    const turmaToEscola = new Map<string, string>()
    for (const t of turmas) turmaToEscola.set(t.id, t.escola_id)

    // Totals of notes per school require a broader fetch; use recent window + presence flag
    const notasAllLight = await supabase.from('notas').select('turma_id')
    if (notasAllLight.error) console.warn('Usage notas totals fallback:', notasAllLight.error.message)
    const notasAll = notasAllLight.data || []

    type Acc = {
        professores: number
        alunos: number
        turmas: number
        notas: number
        professores_7d: number
        alunos_7d: number
        notas_7d: number
        acessos_7d: number
        acessos_30d: number
        ultimo_acesso?: string | null
        ultimo_prof?: string | null
        ultimo_aluno?: string | null
        ultimo_nota?: string | null
    }

    const byEscola = new Map<string, Acc>()
    const ensure = (id: string): Acc => {
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

    for (const n of notasAll) {
        const escolaId = turmaToEscola.get(n.turma_id)
        if (!escolaId) continue
        ensure(escolaId).notas += 1
    }

    for (const n of notasRecentes) {
        const escolaId = turmaToEscola.get(n.turma_id)
        if (!escolaId) continue
        const when = n.data_lancamento || n.created_at
        if (!when) continue
        const row = ensure(escolaId)
        if (when >= d7Iso) row.notas_7d += 1
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
            estado_uso: estado_uso as 'activo' | 'parcial' | 'inactivo',
        }
    })

    escolasRows.sort((a, b) => {
        const rank = { activo: 0, parcial: 1, inactivo: 2 } as const
        const ra = rank[a.estado_uso] - rank[b.estado_uso]
        if (ra !== 0) return ra
        return (b.ultima_actividade || '').localeCompare(a.ultima_actividade || '')
    })

    const dailyMap = new Map<string, { professores: number; alunos: number; notas: number; acessos: number }>()
    for (let i = 0; i < dias; i++) {
        const d = new Date(seriesStart.getTime() + i * 86400000)
        dailyMap.set(toDayKey(d), { professores: 0, alunos: 0, notas: 0, acessos: 0 })
    }
    for (const p of professores) {
        const key = toDayKey(p.created_at)
        const bucket = dailyMap.get(key)
        if (bucket) bucket.professores += 1
    }
    for (const a of alunos) {
        const key = toDayKey(a.created_at)
        const bucket = dailyMap.get(key)
        if (bucket) bucket.alunos += 1
    }
    for (const n of notasRecentes) {
        const key = toDayKey(n.data_lancamento || n.created_at)
        const bucket = dailyMap.get(key)
        if (bucket) bucket.notas += 1
    }
    for (const v of visitas) {
        const key = toDayKey(v.created_at)
        const bucket = dailyMap.get(key)
        if (bucket) bucket.acessos += 1
    }

    const activeProf = professores.filter((p) => p.ativo !== false)
    const activeAlunos = alunos.filter((a) => a.ativo !== false)
    const notas7d = notasRecentes.filter((n) => (n.data_lancamento || n.created_at || '') >= d7Iso).length
    const notas30d = notasRecentes.filter((n) => (n.data_lancamento || n.created_at || '') >= d30Iso).length
    const acessosHoje = visitas.filter((v) => (v.created_at || '') >= todayIso).length
    const acessos7d = visitas.filter((v) => (v.created_at || '') >= d7Iso).length
    const users7d = new Set(
        visitas.filter((v) => (v.created_at || '') >= d7Iso && v.user_id).map((v) => v.user_id as string),
    ).size

    const escolas_com_professores = escolasRows.filter((e) => e.professores > 0).length
    const escolas_com_alunos = escolasRows.filter((e) => e.alunos > 0).length
    const escolas_com_notas = escolasRows.filter((e) => e.notas > 0).length
    const escolas_activas_7d = escolasRows.filter((e) => e.estado_uso === 'activo').length
    const escolas_sem_uso = escolasRows.filter(
        (e) => e.professores === 0 && e.alunos === 0 && e.notas === 0 && e.acessos_7d === 0,
    ).length

    return {
        resumo: {
            total_escolas: escolas.length,
            escolas_com_professores,
            escolas_com_alunos,
            escolas_com_notas,
            escolas_activas_7d,
            escolas_sem_uso,
            total_professores: activeProf.length,
            total_alunos: activeAlunos.length,
            total_turmas: turmas.length,
            total_notas: notasTotalRes.count || notasAll.length,
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
}

/**
 * Fetch pedagogical + access usage statistics (SUPERADMIN observability)
 */
export async function fetchSuperAdminUsageStats(options?: {
    diasActividade?: number
    limiteEscolas?: number
}): Promise<SuperAdminUsageStats> {
    const diasActividade = options?.diasActividade ?? 14
    const limiteEscolas = options?.limiteEscolas ?? 200

    const { data, error } = await supabase.rpc('get_system_usage_stats', {
        p_dias_actividade: diasActividade,
        p_limite_escolas: limiteEscolas,
    })

    if (!error && data) {
        return normalizeUsageStatsPayload(data)
    }

    if (error) {
        console.warn('get_system_usage_stats unavailable:', error.message)
    }

    // Dev API (Vite middleware) — service role after SUPERADMIN auth check
    try {
        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData.session?.access_token
        if (accessToken) {
            const localRes = await fetch('/api/superadmin-usage-stats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    dias_actividade: diasActividade,
                    limite_escolas: limiteEscolas,
                }),
            })
            if (localRes.ok) {
                const payload = await localRes.json()
                if (payload?.success !== false && payload?.resumo) {
                    return normalizeUsageStatsPayload(payload)
                }
            }
        }
    } catch {
        // Not running behind Vite middleware — continue
    }

    console.warn('Using limited client fallback for usage stats (RLS may hide turmas/alunos/notas)')
    return fetchSuperAdminUsageStatsClientFallback(options)
}

/**
 * Fetch system-wide statistics for SUPERADMIN dashboard
 */
function summarizeEntityRows(
    rows: Array<{ ativo?: boolean | null; bloqueado?: boolean | null }> | null | undefined
) {
    const list = rows || []
    return {
        total: list.length,
        ativas: list.filter(e => e.ativo && !e.bloqueado).length,
        inativas: list.filter(e => !e.ativo && !e.bloqueado).length,
        bloqueadas: list.filter(e => Boolean(e.bloqueado)).length,
    }
}

export async function fetchSuperAdminStats(): Promise<SuperAdminStats> {
    try {
        const [
            { data: escolas, error: escolasError },
            { data: direcoesMunicipais, error: dmError },
            { data: direcoesProvinciais, error: dpError },
            { data: licencas, error: licError },
        ] = await Promise.all([
            supabase.from('escolas').select('id, provincia, municipio, ativo, bloqueado, created_at'),
            supabase.from('direcoes_municipais').select('id, ativo, bloqueado, created_at'),
            supabase.from('direcoes_provinciais').select('id, ativo, bloqueado, created_at'),
            supabase.from('licencas').select('id, estado'),
        ])

        if (escolasError) throw escolasError
        // Direções / licenças: não derrubar o dashboard se RLS ou tabela falhar
        if (dmError) console.warn('Stats direções municipais:', dmError.message)
        if (dpError) console.warn('Stats direções provinciais:', dpError.message)
        if (licError) console.warn('Stats licenças:', licError.message)

        const total_escolas = escolas?.length || 0
        const escolas_ativas = escolas?.filter(e => e.ativo && !e.bloqueado).length || 0
        const escolas_inativas = escolas?.filter(e => !e.ativo && !e.bloqueado).length || 0
        const escolas_bloqueadas = escolas?.filter(e => e.bloqueado).length || 0

        // Calculate statistics by province
        const estatisticas_por_provincia: Record<string, number> = {}
        escolas?.forEach(escola => {
            const provincia = escola.provincia || 'Desconhecido'
            estatisticas_por_provincia[provincia] = (estatisticas_por_provincia[provincia] || 0) + 1
        })

        // Calculate statistics by municipality
        const estatisticas_por_municipio: Record<string, number> = {}
        escolas?.forEach(escola => {
            const municipio = escola.municipio || 'Desconhecido'
            estatisticas_por_municipio[municipio] = (estatisticas_por_municipio[municipio] || 0) + 1
        })

        // Calculate monthly growth (last 12 months) — escolas + direções
        const crescimento_mensal: Array<{ mes: string; ano: number; total: number }> = []
        const now = new Date()
        const allEntities = [
            ...(escolas || []),
            ...(direcoesMunicipais || []),
            ...(direcoesProvinciais || []),
        ]

        for (let i = 11; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const mes = date.toLocaleString('pt-AO', { month: 'short' })
            const ano = date.getFullYear()

            const total = allEntities.filter(e => {
                const createdDate = new Date(e.created_at)
                return createdDate.getFullYear() === ano &&
                    createdDate.getMonth() === date.getMonth()
            }).length

            crescimento_mensal.push({ mes, ano, total })
        }

        return {
            total_escolas,
            escolas_ativas,
            escolas_inativas,
            escolas_bloqueadas,
            estatisticas_por_provincia,
            estatisticas_por_municipio,
            crescimento_mensal,
            direcoes_municipais: summarizeEntityRows(direcoesMunicipais),
            direcoes_provinciais: summarizeEntityRows(direcoesProvinciais),
            licencas: {
                total: licencas?.length || 0,
                ativas: licencas?.filter(l => l.estado === 'ativa').length || 0,
                expiradas: licencas?.filter(l => l.estado === 'expirada').length || 0,
                suspensas: licencas?.filter(l => l.estado === 'suspensa').length || 0,
            },
        }
    } catch (error) {
        console.error('Error fetching SUPERADMIN stats:', error)
        throw error
    }
}

/**
 * Fetch all escolas with optional filters
 */
export async function fetchAllEscolas(filters?: {
    ativo?: boolean
    bloqueado?: boolean
    provincia?: string
    municipio?: string
    search?: string
    needsAttention?: boolean
}): Promise<Escola[]> {
    try {
        let query = supabase.from('escolas').select('*')

        // If needsAttention filter is active, we need to fetch schools that are inactive OR blocked
        if (filters?.needsAttention) {
            // Use OR filter: ativo = false OR bloqueado = true
            query = query.or('ativo.eq.false,bloqueado.eq.true')
        } else {
            if (filters?.ativo !== undefined) {
                query = query.eq('ativo', filters.ativo)
            }

            if (filters?.bloqueado !== undefined) {
                query = query.eq('bloqueado', filters.bloqueado)
            }
        }

        if (filters?.provincia) {
            query = query.eq('provincia', filters.provincia)
        }

        if (filters?.municipio) {
            query = query.eq('municipio', filters.municipio)
        }

        if (filters?.search) {
            query = query.or(`nome.ilike.%${filters.search}%,codigo_escola.ilike.%${filters.search}%`)
        }

        const { data, error } = await query.order('created_at', { ascending: false })

        if (error) throw error

        return data || []
    } catch (error) {
        console.error('Error fetching escolas:', error)
        throw error
    }
}


/**
 * Activate a school
 */
export async function activateEscola(escolaId: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('escolas')
            .update({ ativo: true })
            .eq('id', escolaId)

        if (error) throw error

        // Log the action
        await logSuperAdminAction('ACTIVATE_ESCOLA', escolaId, {
            action: 'Escola activated',
            escola_id: escolaId
        })
    } catch (error) {
        console.error('Error activating escola:', error)
        throw error
    }
}

/**
 * Deactivate a school
 */
export async function deactivateEscola(escolaId: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('escolas')
            .update({ ativo: false })
            .eq('id', escolaId)

        if (error) throw error

        // Log the action
        await logSuperAdminAction('DEACTIVATE_ESCOLA', escolaId, {
            action: 'Escola deactivated',
            escola_id: escolaId
        })
    } catch (error) {
        console.error('Error deactivating escola:', error)
        throw error
    }
}

/**
 * Block a school with reason (uses RPC to bypass RLS)
 */
export async function blockEscola(escolaId: string, motivo: string): Promise<void> {
    console.log('🚫 blockEscola called with ID:', escolaId)

    try {
        const { data, error } = await supabase.rpc('superadmin_block_escola', {
            p_escola_id: escolaId,
            p_motivo: motivo
        })

        console.log('📝 Block result:', data, 'error:', error)

        if (error) {
            console.error('❌ Supabase RPC error:', error)
            throw error
        }

        if (data && !data.success) {
            throw new Error(data.error || 'Erro ao bloquear escola')
        }

        // Log the action
        await logSuperAdminAction('BLOCK_ESCOLA', escolaId, {
            action: 'Escola blocked',
            escola_id: escolaId,
            motivo: motivo
        })

        console.log('✅ Block operation completed')
    } catch (error) {
        console.error('❌ Error blocking escola:', error)
        throw error
    }
}

/**
 * Unblock a school (uses RPC to bypass RLS)
 */
export async function unblockEscola(escolaId: string): Promise<void> {
    console.log('🔓 unblockEscola called with ID:', escolaId)

    try {
        const { data, error } = await supabase.rpc('superadmin_unblock_escola', {
            p_escola_id: escolaId
        })

        console.log('📝 Unblock result:', data, 'error:', error)

        if (error) {
            console.error('❌ Supabase RPC error:', error)
            throw error
        }

        if (data && !data.success) {
            throw new Error(data.error || 'Erro ao desbloquear escola')
        }

        // Log the action
        await logSuperAdminAction('UNBLOCK_ESCOLA', escolaId, {
            action: 'Escola unblocked',
            escola_id: escolaId
        })

        console.log('✅ Unblock operation completed')
    } catch (error) {
        console.error('❌ Error unblocking escola:', error)
        throw error
    }
}



/**
 * Log SUPERADMIN action to audit table
 */
export async function logSuperAdminAction(
    actionType: string,
    escolaId: string | null,
    details: Record<string, any>
): Promise<void> {
    try {
        const { data, error } = await supabase.rpc('log_superadmin_action', {
            p_action_type: actionType,
            p_target_escola_id: escolaId,
            p_action_details: details
        })

        if (error) {
            console.error('Error logging SUPERADMIN action:', actionType, error)
            // Don't throw - logging failure shouldn't break the main operation
            return
        }
        if (!data) {
            console.warn('log_superadmin_action returned empty id for', actionType)
        }
    } catch (error) {
        console.error('Error logging SUPERADMIN action:', actionType, error)
        // Don't throw - logging failure shouldn't break the main operation
    }
}

/**
 * Fetch SUPERADMIN audit log with filters
 * Prefers SECURITY DEFINER RPC to avoid empty lists from RLS/role_cache issues.
 */
export async function fetchSuperAdminAuditLog(filters?: {
    actionType?: string
    actionTypePrefix?: string
    escolaId?: string
    startDate?: string
    endDate?: string
    limit?: number
}): Promise<SuperAdminAction[]> {
    try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('listar_superadmin_actions', {
            p_action_type: filters?.actionType || null,
            p_action_type_prefix: filters?.actionTypePrefix || null,
            p_escola_id: filters?.escolaId || null,
            p_limit: filters?.limit ?? 100,
        })

        if (!rpcError && Array.isArray(rpcData)) {
            let rows = rpcData as SuperAdminAction[]
            if (filters?.startDate) {
                rows = rows.filter(r => r.created_at >= filters.startDate!)
            }
            if (filters?.endDate) {
                rows = rows.filter(r => r.created_at <= filters.endDate!)
            }
            return rows
        }

        if (rpcError) {
            console.warn('listar_superadmin_actions unavailable, falling back to direct query:', rpcError.message)
        }

        let query = supabase
            .from('superadmin_actions')
            .select('*')
            .order('created_at', { ascending: false })

        if (filters?.actionType) {
            query = query.eq('action_type', filters.actionType)
        } else if (filters?.actionTypePrefix) {
            query = query.ilike('action_type', `%${filters.actionTypePrefix}%`)
        }

        if (filters?.escolaId) {
            query = query.eq('target_escola_id', filters.escolaId)
        }

        if (filters?.startDate) {
            query = query.gte('created_at', filters.startDate)
        }

        if (filters?.endDate) {
            query = query.lte('created_at', filters.endDate)
        }

        if (filters?.limit) {
            query = query.limit(filters.limit)
        }

        const { data, error } = await query

        if (error) throw error

        return data || []
    } catch (error) {
        console.error('Error fetching audit log:', error)
        throw error
    }
}

/**
 * Update escola details (SUPERADMIN only)
 */
export async function updateEscola(
    escolaId: string,
    updates: Partial<Escola>
): Promise<void> {
    try {
        // Get current escola data for logging
        const { data: currentEscola } = await supabase
            .from('escolas')
            .select('*')
            .eq('id', escolaId)
            .single()

        const { error } = await supabase
            .from('escolas')
            .update(updates)
            .eq('id', escolaId)

        if (error) throw error

        // Log the action
        await logSuperAdminAction('EDIT_ESCOLA', escolaId, {
            action: 'Escola details updated',
            escola_id: escolaId,
            before: currentEscola,
            after: updates
        })
    } catch (error) {
        console.error('Error updating escola:', error)
        throw error
    }
}

type DeleteEscolaResult = {
    success: boolean
    backup_id?: string
    message?: string
    error?: string
    deleted_auth_users?: number
}

/**
 * Delete a school with optional backup.
 * Also removes the school responsável and exclusive school user auth accounts.
 *
 * Order:
 * 1) Local Vite API /api/superadmin-delete-escola (dev)
 * 2) Edge Function superadmin-delete-escola
 * 3) RPC backup_and_delete_escola (production after migration 20261102)
 */
export async function deleteEscola(
    escolaId: string,
    motivo: string,
    createBackup: boolean = true
): Promise<DeleteEscolaResult> {
    try {
        const body = {
            escola_id: escolaId,
            motivo,
            create_backup: createBackup,
        }

        // 1) Dev API (Vite middleware) — full cleanup including auth users
        try {
            const { data: sessionData } = await supabase.auth.getSession()
            const accessToken = sessionData.session?.access_token
            if (accessToken) {
                const localRes = await fetch('/api/superadmin-delete-escola', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify(body),
                })
                if (localRes.ok) {
                    const payload = (await localRes.json()) as DeleteEscolaResult
                    if (payload?.success) return payload
                    if (payload && payload.success === false && payload.error) {
                        return payload
                    }
                }
            }
        } catch {
            // Not running behind Vite middleware — continue
        }

        // 2) Edge Function
        const { data: fnData, error: fnError } = await supabase.functions.invoke('superadmin-delete-escola', {
            body,
        })

        if (!fnError && fnData) {
            const payload = fnData as DeleteEscolaResult
            if (payload.success === false) {
                return {
                    success: false,
                    error: payload.error || 'Erro ao eliminar escola',
                }
            }
            if (payload.success) {
                return {
                    success: true,
                    backup_id: payload.backup_id,
                    message: payload.message,
                    deleted_auth_users: payload.deleted_auth_users,
                }
            }
        }

        if (fnError) {
            console.warn('superadmin-delete-escola unavailable, falling back to RPC:', fnError.message)
        }

        // 3) RPC (includes auth cleanup after migration 20261102)
        const { data, error } = await supabase.rpc('backup_and_delete_escola', {
            p_escola_id: escolaId,
            p_motivo: motivo,
            p_create_backup: createBackup,
        })

        if (error) throw error

        return data as DeleteEscolaResult
    } catch (error) {
        console.error('Error deleting escola:', error)
        throw error
    }
}

/**
 * Fetch all escola backups
 */
export async function fetchEscolaBackups(filters?: {
    limit?: number
    includeRestored?: boolean
}): Promise<EscolaBackup[]> {
    try {
        const { data, error } = await supabase.rpc('fetch_escola_backups', {
            p_limit: filters?.limit || 50,
            p_include_restored: filters?.includeRestored || false
        })

        if (error) throw error

        return data || []
    } catch (error) {
        console.error('Error fetching escola backups:', error)
        throw error
    }
}

/**
 * Restore a school from backup
 */
export async function restoreEscola(
    backupId: string
): Promise<{ success: boolean; escola_id?: string; message?: string; error?: string }> {
    try {
        const { data, error } = await supabase.rpc('restore_escola_from_backup', {
            p_backup_id: backupId
        })

        if (error) throw error

        return data as { success: boolean; escola_id?: string; message?: string; error?: string }
    } catch (error) {
        console.error('Error restoring escola:', error)
        throw error
    }
}

// ============================================
// DIREÇÃO MUNICIPAL MANAGEMENT FUNCTIONS
// ============================================

export interface DirecaoMunicipal {
    id: string
    user_id: string | null
    nome: string
    provincia: string
    municipio: string
    email: string
    telefone: string | null
    cargo: string
    numero_funcionario: string | null
    ativo: boolean
    bloqueado: boolean
    bloqueado_motivo: string | null
    bloqueado_em: string | null
    bloqueado_por: string | null
    created_at: string
    updated_at: string
}

/**
 * Fetch all direções municipais with optional filters
 */
export async function fetchAllDirecoesMunicipais(filters?: {
    ativo?: boolean
    bloqueado?: boolean
    provincia?: string
    municipio?: string
    search?: string
    needsAttention?: boolean
}): Promise<DirecaoMunicipal[]> {
    try {
        // Log session info for debugging RLS issues
        const { data: { user } } = await supabase.auth.getUser()
        console.log('🔐 fetchAllDirecoesMunicipais - Current user:', user?.id)

        let query = supabase.from('direcoes_municipais').select('*')

        if (filters?.needsAttention) {
            // Needs attention: inactive OR blocked
            query = query.or('ativo.eq.false,bloqueado.eq.true')
        } else {
            if (filters?.ativo !== undefined) {
                query = query.eq('ativo', filters.ativo)
            }

            if (filters?.bloqueado !== undefined) {
                query = query.eq('bloqueado', filters.bloqueado)
            }
        }

        if (filters?.provincia) {
            query = query.eq('provincia', filters.provincia)
        }

        if (filters?.municipio) {
            query = query.eq('municipio', filters.municipio)
        }

        if (filters?.search) {
            query = query.or(`nome.ilike.%${filters.search}%,municipio.ilike.%${filters.search}%,provincia.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
        }

        const { data, error } = await query.order('created_at', { ascending: false })

        console.log('🔍 fetchAllDirecoesMunicipais result:', { data, error, filters })

        if (error) throw error

        return data || []
    } catch (error) {
        console.error('❌ Error fetching direções municipais:', error)
        throw error
    }
}

/**
 * Activate a direção municipal
 */
export async function activateDirecaoMunicipal(direcaoId: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('direcoes_municipais')
            .update({ ativo: true })
            .eq('id', direcaoId)

        if (error) throw error

        // Log the action
        await logSuperAdminAction('ACTIVATE_DIRECAO_MUNICIPAL', null, {
            action: 'Direção Municipal activated',
            direcao_id: direcaoId
        })
    } catch (error) {
        console.error('Error activating direção municipal:', error)
        throw error
    }
}

/**
 * Deactivate a direção municipal
 */
export async function deactivateDirecaoMunicipal(direcaoId: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('direcoes_municipais')
            .update({ ativo: false })
            .eq('id', direcaoId)

        if (error) throw error

        // Log the action
        await logSuperAdminAction('DEACTIVATE_DIRECAO_MUNICIPAL', null, {
            action: 'Direção Municipal deactivated',
            direcao_id: direcaoId
        })
    } catch (error) {
        console.error('Error deactivating direção municipal:', error)
        throw error
    }
}

/**
 * Block a direção municipal with reason
 */
export async function blockDirecaoMunicipal(direcaoId: string, motivo: string): Promise<void> {
    try {
        const { data: { user } } = await supabase.auth.getUser()

        const { error } = await supabase
            .from('direcoes_municipais')
            .update({
                bloqueado: true,
                bloqueado_motivo: motivo,
                bloqueado_em: new Date().toISOString(),
                bloqueado_por: user?.id
            })
            .eq('id', direcaoId)

        if (error) throw error

        // Log the action
        await logSuperAdminAction('BLOCK_DIRECAO_MUNICIPAL', null, {
            action: 'Direção Municipal blocked',
            direcao_id: direcaoId,
            motivo: motivo
        })
    } catch (error) {
        console.error('Error blocking direção municipal:', error)
        throw error
    }
}

/**
 * Unblock a direção municipal
 */
export async function unblockDirecaoMunicipal(direcaoId: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('direcoes_municipais')
            .update({
                bloqueado: false,
                bloqueado_motivo: null,
                bloqueado_em: null,
                bloqueado_por: null
            })
            .eq('id', direcaoId)

        if (error) throw error

        // Log the action
        await logSuperAdminAction('UNBLOCK_DIRECAO_MUNICIPAL', null, {
            action: 'Direção Municipal unblocked',
            direcao_id: direcaoId
        })
    } catch (error) {
        console.error('Error unblocking direção municipal:', error)
        throw error
    }
}

// ============================================
// DIREÇÃO PROVINCIAL MANAGEMENT FUNCTIONS
// ============================================

export interface DirecaoProvincial {
    id: string
    user_id: string | null
    nome: string
    provincia: string
    email: string
    telefone: string | null
    cargo: string
    numero_funcionario: string | null
    ativo: boolean
    bloqueado: boolean
    bloqueado_motivo: string | null
    bloqueado_em: string | null
    bloqueado_por: string | null
    created_at: string
    updated_at: string
}

/**
 * Fetch all direções provinciais with optional filters
 */
export async function fetchAllDirecoesProvinciais(filters?: {
    ativo?: boolean
    bloqueado?: boolean
    provincia?: string
    search?: string
    needsAttention?: boolean
}): Promise<DirecaoProvincial[]> {
    try {
        // Log session info for debugging RLS issues
        const { data: { user } } = await supabase.auth.getUser()
        console.log('🔐 fetchAllDirecoesProvinciais - Current user:', user?.id)

        let query = supabase.from('direcoes_provinciais').select('*')

        if (filters?.needsAttention) {
            // Needs attention: inactive OR blocked
            query = query.or('ativo.eq.false,bloqueado.eq.true')
        } else {
            if (filters?.ativo !== undefined) {
                query = query.eq('ativo', filters.ativo)
            }

            if (filters?.bloqueado !== undefined) {
                query = query.eq('bloqueado', filters.bloqueado)
            }
        }

        if (filters?.provincia) {
            query = query.eq('provincia', filters.provincia)
        }

        if (filters?.search) {
            query = query.or(`nome.ilike.%${filters.search}%,provincia.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
        }

        const { data, error } = await query.order('created_at', { ascending: false })

        console.log('🔍 fetchAllDirecoesProvinciais result:', { data, error, filters })

        if (error) throw error

        return data || []
    } catch (error) {
        console.error('❌ Error fetching direções provinciais:', error)
        throw error
    }
}

/**
 * Activate a direção provincial
 */
export async function activateDirecaoProvincial(direcaoId: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('direcoes_provinciais')
            .update({ ativo: true })
            .eq('id', direcaoId)

        if (error) throw error

        // Log the action
        await logSuperAdminAction('ACTIVATE_DIRECAO_PROVINCIAL', null, {
            action: 'Direção Provincial activated',
            direcao_id: direcaoId
        })
    } catch (error) {
        console.error('Error activating direção provincial:', error)
        throw error
    }
}

/**
 * Deactivate a direção provincial
 */
export async function deactivateDirecaoProvincial(direcaoId: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('direcoes_provinciais')
            .update({ ativo: false })
            .eq('id', direcaoId)

        if (error) throw error

        // Log the action
        await logSuperAdminAction('DEACTIVATE_DIRECAO_PROVINCIAL', null, {
            action: 'Direção Provincial deactivated',
            direcao_id: direcaoId
        })
    } catch (error) {
        console.error('Error deactivating direção provincial:', error)
        throw error
    }
}

/**
 * Block a direção provincial with reason
 */
export async function blockDirecaoProvincial(direcaoId: string, motivo: string): Promise<void> {
    try {
        const { data: { user } } = await supabase.auth.getUser()

        const { error } = await supabase
            .from('direcoes_provinciais')
            .update({
                bloqueado: true,
                bloqueado_motivo: motivo,
                bloqueado_em: new Date().toISOString(),
                bloqueado_por: user?.id
            })
            .eq('id', direcaoId)

        if (error) throw error

        // Log the action
        await logSuperAdminAction('BLOCK_DIRECAO_PROVINCIAL', null, {
            action: 'Direção Provincial blocked',
            direcao_id: direcaoId,
            motivo: motivo
        })
    } catch (error) {
        console.error('Error blocking direção provincial:', error)
        throw error
    }
}

/**
 * Unblock a direção provincial
 */
export async function unblockDirecaoProvincial(direcaoId: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('direcoes_provinciais')
            .update({
                bloqueado: false,
                bloqueado_motivo: null,
                bloqueado_em: null,
                bloqueado_por: null
            })
            .eq('id', direcaoId)

        if (error) throw error

        // Log the action
        await logSuperAdminAction('UNBLOCK_DIRECAO_PROVINCIAL', null, {
            action: 'Direção Provincial unblocked',
            direcao_id: direcaoId
        })
    } catch (error) {
        console.error('Error unblocking direção provincial:', error)
        throw error
    }
}
