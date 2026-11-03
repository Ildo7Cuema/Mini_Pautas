import { supabase } from '../lib/supabaseClient'
import type {
    PropinasConfig,
    PagamentoPropina,
    PagamentoMesStatus,
    EstatisticasPropinas,
    RegistarPagamentoRequest,
    MesReferencia,
    Aluno
} from '../types'

/**
 * Tuition Payment Utility Functions
 * Provides API functions for tuition/propinas management
 */

// ============================================
// CONFIGURATION
// ============================================

/**
 * Fetch tuition configuration for a school
 */
export async function fetchPropinasConfig(
    escolaId: string,
    anoLectivo?: number | string
): Promise<PropinasConfig[]> {
    try {
        const ano = String(anoLectivo ?? new Date().getFullYear())

        const { data, error } = await supabase
            .from('propinas_config')
            .select('*, turmas(id, nome, codigo_turma)')
            .eq('escola_id', escolaId)
            .eq('ano_lectivo', ano)
            .eq('ativo', true)
            .order('created_at', { ascending: false })

        if (error) throw error

        const mesesFallback = await fetchMesesLectivosDaEscola(escolaId, ano)

        // Map turmas to turma field; prefer column, then escola.configuracoes
        return (data || []).map(item => ({
            ...item,
            turma: item.turmas,
            meses_lectivos: normalizeMesesLectivos(
                Array.isArray(item.meses_lectivos) && item.meses_lectivos.length > 0
                    ? item.meses_lectivos
                    : mesesFallback
            )
        }))
    } catch (error) {
        console.error('Error fetching propinas config:', error)
        throw error
    }
}

/**
 * Create or update tuition configuration
 */
/** Default: all calendar months (backward compatible). Prefer Feb–Nov for new Angolan school years in the UI. */
export const MESES_LECTIVOS_DEFAULT = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
export const MESES_LECTIVOS_FEV_NOV = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
export const MESES_LECTIVOS_JAN_NOV = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

export function normalizeMesesLectivos(meses?: number[] | null): number[] {
    const cleaned = Array.from(new Set((meses || []).map(Number).filter(m => m >= 1 && m <= 12)))
        .sort((a, b) => a - b)
    return cleaned.length > 0 ? cleaned : [...MESES_LECTIVOS_DEFAULT]
}

/** How many configured lective months are already due for billing. */
export function countMesesLectivosDecorridos(
    mesesLectivos: number[],
    ano: number,
    now: Date = new Date()
): number {
    const meses = normalizeMesesLectivos(mesesLectivos)
    const anoAtual = now.getFullYear()
    const mesAtual = now.getMonth() + 1
    if (ano < anoAtual) return meses.length
    if (ano > anoAtual) return 0
    return meses.filter(m => m <= mesAtual).length
}

export function recalcularEstatisticasComMesesLectivos(
    stats: EstatisticasPropinas,
    valorMensalidade: number,
    mesesLectivos: number[],
    ano: number
): EstatisticasPropinas {
    const mesesDecorridos = countMesesLectivosDecorridos(mesesLectivos, ano)
    const total_previsto = (stats.total_alunos || 0) * (valorMensalidade || 0) * mesesDecorridos
    const total_recebido = stats.total_recebido || 0
    const total_em_falta = total_previsto - total_recebido
    return {
        total_alunos: stats.total_alunos || 0,
        total_previsto,
        total_recebido,
        total_em_falta,
        percentagem_recebido: total_previsto > 0
            ? Math.round((total_recebido / total_previsto) * 10000) / 100
            : 0
    }
}

async function saveMesesLectivosNaEscola(
    escolaId: string,
    anoLectivo: string,
    mesesLectivos: number[]
): Promise<void> {
    const { data: escola, error } = await supabase
        .from('escolas')
        .select('configuracoes')
        .eq('id', escolaId)
        .single()

    if (error) throw error

    const configuracoes = (escola?.configuracoes && typeof escola.configuracoes === 'object')
        ? { ...(escola.configuracoes as Record<string, unknown>) }
        : {}
    const propinas = {
        ...((configuracoes.propinas as Record<string, unknown>) || {}),
        meses_lectivos_por_ano: {
            ...(((configuracoes.propinas as any)?.meses_lectivos_por_ano) || {}),
            [anoLectivo]: mesesLectivos
        }
    }

    const { error: updateError } = await supabase
        .from('escolas')
        .update({
            configuracoes: {
                ...configuracoes,
                propinas
            }
        })
        .eq('id', escolaId)

    if (updateError) throw updateError
}

async function fetchMesesLectivosDaEscola(
    escolaId: string,
    anoLectivo: string
): Promise<number[] | null> {
    const { data, error } = await supabase
        .from('escolas')
        .select('configuracoes')
        .eq('id', escolaId)
        .maybeSingle()

    if (error || !data?.configuracoes) return null
    const porAno = (data.configuracoes as any)?.propinas?.meses_lectivos_por_ano
    const meses = porAno?.[anoLectivo] ?? porAno?.[String(anoLectivo)]
    return Array.isArray(meses) ? normalizeMesesLectivos(meses) : null
}

export async function savePropinasConfig(config: {
    escola_id: string
    turma_id?: string
    ano_lectivo: number | string
    valor_mensalidade: number
    meses_lectivos?: number[]
    descricao?: string
}): Promise<PropinasConfig> {
    try {
        const anoLectivo = String(config.ano_lectivo)
        const turmaId = config.turma_id || null
        const mesesLectivos = normalizeMesesLectivos(config.meses_lectivos)

        // Prefer the most recent school-wide (or turma) config to update
        let existingQuery = supabase
            .from('propinas_config')
            .select('id')
            .eq('escola_id', config.escola_id)
            .eq('ano_lectivo', anoLectivo)
            .eq('ativo', true)
            .order('created_at', { ascending: false })
            .limit(1)

        existingQuery = turmaId
            ? existingQuery.eq('turma_id', turmaId)
            : existingQuery.is('turma_id', null)

        const { data: existingRows, error: existingError } = await existingQuery
        if (existingError) throw existingError

        const existing = existingRows?.[0]
        const basePayload = {
            valor_mensalidade: config.valor_mensalidade,
            descricao: config.descricao,
            updated_at: new Date().toISOString()
        }

        let saved: PropinasConfig

        if (existing) {
            // Try with meses_lectivos column (after migration); fallback without it
            let { data, error } = await supabase
                .from('propinas_config')
                .update({ ...basePayload, meses_lectivos: mesesLectivos })
                .eq('id', existing.id)
                .select()
                .single()

            if (error && /meses_lectivos|schema cache|column/i.test(error.message || '')) {
                const retry = await supabase
                    .from('propinas_config')
                    .update(basePayload)
                    .eq('id', existing.id)
                    .select()
                    .single()
                data = retry.data
                error = retry.error
            }

            if (error) throw error
            saved = data as PropinasConfig
        } else {
            let { data, error } = await supabase
                .from('propinas_config')
                .insert({
                    escola_id: config.escola_id,
                    turma_id: turmaId,
                    ano_lectivo: anoLectivo,
                    ...basePayload,
                    meses_lectivos: mesesLectivos,
                    ativo: true
                })
                .select()
                .single()

            if (error && /meses_lectivos|schema cache|column/i.test(error.message || '')) {
                const retry = await supabase
                    .from('propinas_config')
                    .insert({
                        escola_id: config.escola_id,
                        turma_id: turmaId,
                        ano_lectivo: anoLectivo,
                        valor_mensalidade: config.valor_mensalidade,
                        descricao: config.descricao,
                        ativo: true
                    })
                    .select()
                    .single()
                data = retry.data
                error = retry.error
            }

            if (error) throw error
            saved = data as PropinasConfig
        }

        // Persist lective months on escola.configuracoes (works without DDL migration)
        await saveMesesLectivosNaEscola(config.escola_id, anoLectivo, mesesLectivos)

        return {
            ...saved,
            meses_lectivos: mesesLectivos
        }
    } catch (error) {
        console.error('Error saving propinas config:', error)
        throw error
    }
}

// ============================================
// PAYMENTS
// ============================================

/**
 * Fetch payments for a school with optional filters
 */
export async function fetchPagamentosPropinas(
    escolaId: string,
    filters?: {
        turmaId?: string
        mesReferencia?: MesReferencia
        anoReferencia?: number
        alunoId?: string
    }
): Promise<PagamentoPropina[]> {
    try {
        let query = supabase
            .from('pagamentos_propinas')
            .select(`
                *,
                alunos!inner(
                    id, nome_completo, numero_processo, turma_id,
                    turmas(id, nome, codigo_turma)
                )
            `)
            .eq('escola_id', escolaId)
            .order('data_pagamento', { ascending: false })

        if (filters?.anoReferencia) {
            query = query.eq('ano_referencia', filters.anoReferencia)
        }
        if (filters?.mesReferencia) {
            query = query.eq('mes_referencia', filters.mesReferencia)
        }
        if (filters?.alunoId) {
            query = query.eq('aluno_id', filters.alunoId)
        }
        if (filters?.turmaId) {
            query = query.eq('alunos.turma_id', filters.turmaId)
        }

        const { data, error } = await query

        if (error) throw error

        // Map alunos to aluno field (keep turmas + turma for receipt/UI)
        return (data || []).map(item => {
            const alunoRaw = item.alunos
            return {
                ...item,
                aluno: alunoRaw
                    ? {
                        ...alunoRaw,
                        turma: alunoRaw.turmas || alunoRaw.turma,
                        turmas: alunoRaw.turmas || alunoRaw.turma
                    }
                    : undefined
            }
        })
    } catch (error) {
        console.error('Error fetching pagamentos:', error)
        throw error
    }
}

/**
 * Fetch payment status by month for a student
 */
export async function fetchPagamentosAlunoPorMes(
    alunoId: string,
    ano?: number
): Promise<PagamentoMesStatus[]> {
    try {
        const { data, error } = await supabase.rpc('get_pagamentos_aluno_por_mes', {
            p_aluno_id: alunoId,
            p_ano: ano || new Date().getFullYear()
        })

        if (error) throw error
        return data as PagamentoMesStatus[]
    } catch (error) {
        console.error('Error fetching pagamentos por mes:', error)
        throw error
    }
}

/**
 * Generate receipt number
 */
export async function gerarNumeroRecibo(escolaId: string): Promise<string> {
    try {
        const { data, error } = await supabase.rpc('gerar_numero_recibo', {
            p_escola_id: escolaId
        })

        if (error) throw error
        return data as string
    } catch (error) {
        console.error('Error generating receipt number:', error)
        throw error
    }
}

/**
 * Register a new tuition payment
 */
export async function registarPagamento(
    request: RegistarPagamentoRequest
): Promise<PagamentoPropina> {
    try {
        // Generate receipt number
        const numero_recibo = await gerarNumeroRecibo(request.escola_id)

        // Get current user
        const { data: { user } } = await supabase.auth.getUser()

        // VALIDATION: Check for overpayment or duplicate payment
        // 1. Get Monthly Fee (ano_lectivo is TEXT in DB)
        const { data: config } = await supabase
            .from('propinas_config')
            .select('valor_mensalidade')
            .eq('escola_id', request.escola_id)
            .eq('ano_lectivo', String(request.ano_referencia))
            .eq('ativo', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        const valorMensal = config?.valor_mensalidade || 0

        // 2. Get existing payments total
        const { data: existingPayments } = await supabase
            .from('pagamentos_propinas')
            .select('valor')
            .eq('aluno_id', request.aluno_id)
            .eq('mes_referencia', request.mes_referencia)
            .eq('ano_referencia', request.ano_referencia)
            .eq('estado', 'valido')

        const totalPago = (existingPayments || []).reduce((sum, p) => sum + p.valor, 0)

        // 3. Check Condition
        if (totalPago >= valorMensal && valorMensal > 0) {
            throw new Error(`A mensalidade de ${getNomeMes(request.mes_referencia)} já se encontra totalmente liquidada.`)
        }

        if (totalPago + request.valor > valorMensal && valorMensal > 0) {
            const restante = valorMensal - totalPago
            throw new Error(`O valor excede o montante em dívida. Valor restante: ${formatarValor(restante)}`)
        }

        // Generate AGT Hash (Simplified for demo/mvp)
        // Format: Date + Recibo + Valor
        const dataPagamento = new Date().toISOString()
        const hashInput = `${dataPagamento}${numero_recibo}${request.valor.toFixed(2)}`

        // Simulating a hash - in production usage use crypto.subtle.digest('SHA-1', ...)
        // For now we do a simple string manipulation for display
        const simpleHash = btoa(hashInput).replace(/[^a-zA-Z0-9]/g, '').substring(0, 100)
        const hash = `AGT:${simpleHash}`.padEnd(60, 'X')
        const hash_control = simpleHash.substring(0, 4).toUpperCase()

        const { data, error } = await supabase
            .from('pagamentos_propinas')
            .insert({
                aluno_id: request.aluno_id,
                escola_id: request.escola_id,
                mes_referencia: request.mes_referencia,
                ano_referencia: request.ano_referencia,
                valor: request.valor,
                metodo_pagamento: request.metodo_pagamento,
                observacao: request.observacao,
                numero_recibo,
                registado_por: user?.id,
                data_pagamento: dataPagamento,

                // New Fields
                estado: 'valido',
                hash,
                hash_control,
                sistema_certificado: 'Processado por programa válido n31.1/AGT20',
                tipo_documento: 'RG'
            })
            .select(`
                *,
                alunos(
                    id, nome_completo, numero_processo, turma_id,
                    turmas(id, nome, codigo_turma)
                )
            `)
            .single()

        if (error) {
            throw error
        }

        const alunoRaw = data.alunos
        return {
            ...data,
            aluno: alunoRaw
                ? {
                    ...alunoRaw,
                    turma: alunoRaw.turmas || null,
                    turmas: alunoRaw.turmas || null
                }
                : undefined
        } as PagamentoPropina
    } catch (error) {
        console.error('Error registering payment:', error)
        throw error
    }
}

/**
 * Anular um pagamento (Compliance AGT: Não apagar, apenas marcar como anulado)
 * Segundo o Decreto Presidencial n.º 292/18 (RJFDE), os documentos não devem ser apagados.
 */
export async function anularPagamento(pagamentoId: string, motivo: string): Promise<void> {
    try {
        if (!motivo || motivo.trim().length < 5) {
            throw new Error('É obrigatório indicar um motivo válido para a anulação.')
        }

        // Get current user for audit
        const { data: { user } } = await supabase.auth.getUser()

        // First check if payment is recent (within 24 hours) - Regra de Negócio comum
        const { data: pagamento, error: fetchError } = await supabase
            .from('pagamentos_propinas')
            .select('created_at, estado')
            .eq('id', pagamentoId)
            .single()

        if (fetchError) throw fetchError

        if (pagamento.estado === 'anulado') {
            throw new Error('Este pagamento já se encontra anulado.')
        }

        const createdAt = new Date(pagamento.created_at)
        const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60)

        // Regra de Negócio: Só permitir anulação nas primeiras 24 horas
        // Após isso, deve ser tratado contabilísticamente (Nota de Crédito, etc)
        if (hoursSinceCreation > 24) {
            throw new Error('Só é possível anular recibos emitidos há menos de 24 horas. Para documentos mais antigos, contacte a administração.')
        }

        const { error } = await supabase
            .from('pagamentos_propinas')
            .update({
                estado: 'anulado',
                motivo_anulacao: motivo,
                data_anulacao: new Date().toISOString(),
                anulado_por: user?.id
            })
            .eq('id', pagamentoId)

        if (error) throw error
    } catch (error) {
        console.error('Error canceling payment:', error)
        throw error
    }
}

// ============================================
// STATISTICS
// ============================================

/**
 * Fetch tuition payment statistics for a school
 */
export async function fetchEstatisticasPropinas(
    escolaId: string,
    ano?: number
): Promise<EstatisticasPropinas> {
    try {
        const { data, error } = await supabase.rpc('get_estatisticas_propinas', {
            p_escola_id: escolaId,
            p_ano: ano || new Date().getFullYear()
        })

        if (error) throw error

        // RPC returns an array, get first row
        const stats = Array.isArray(data) ? data[0] : data

        return {
            total_alunos: stats?.total_alunos || 0,
            total_previsto: stats?.total_previsto || 0,
            total_recebido: stats?.total_recebido || 0,
            total_em_falta: stats?.total_em_falta || 0,
            percentagem_recebido: stats?.percentagem_recebido || 0
        }
    } catch (error) {
        console.error('Error fetching estatisticas:', error)
        // Return empty stats on error
        return {
            total_alunos: 0,
            total_previsto: 0,
            total_recebido: 0,
            total_em_falta: 0,
            percentagem_recebido: 0
        }
    }
}

/**
 * Fetch students with their payment status for current year
 */
export async function fetchAlunosComStatusPagamento(
    escolaId: string,
    turmaId?: string,
    ano?: number
): Promise<Array<Aluno & { pagamentos: PagamentoMesStatus[] }>> {
    try {
        const currentYear = ano || new Date().getFullYear()

        // First get students
        // Note: ano_lectivo is TEXT and can be "2025" or "2025/2026"
        let query = supabase
            .from('alunos')
            .select(`
                *,
                turmas!inner(id, nome, codigo_turma, escola_id, ano_lectivo)
            `)
            .eq('turmas.escola_id', escolaId)
            .ilike('turmas.ano_lectivo', `%${currentYear}%`)
            .eq('ativo', true)
            .order('nome_completo')

        if (turmaId) {
            query = query.eq('turma_id', turmaId)
        }

        const { data: alunos, error: alunosError } = await query

        if (alunosError) throw alunosError

        // For each student, get payment status
        const alunosComPagamentos = await Promise.all(
            (alunos || []).map(async (aluno) => {
                const pagamentos = await fetchPagamentosAlunoPorMes(aluno.id, currentYear)
                return {
                    ...aluno,
                    turma: aluno.turmas,
                    pagamentos
                }
            })
        )

        return alunosComPagamentos
    } catch (error) {
        console.error('Error fetching alunos com status:', error)
        throw error
    }
}

// ============================================
// HELPERS
// ============================================

/**
 * Get month name in Portuguese
 */
export function getNomeMes(mes: number): string {
    const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril',
        'Maio', 'Junho', 'Julho', 'Agosto',
        'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
    return meses[mes - 1] || ''
}

/**
 * Get short month name in Portuguese
 */
export function getNomeMesCurto(mes: number): string {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return meses[mes - 1] || ''
}

/**
 * Format currency in Angolan Kwanza
 */
export function formatarValor(valor: number): string {
    return new Intl.NumberFormat('pt-AO', {
        style: 'currency',
        currency: 'AOA',
        minimumFractionDigits: 2
    }).format(valor)
}

/**
 * Get method of payment label
 */
export function getMetodoPagamentoLabel(metodo: string): string {
    const labels: Record<string, string> = {
        'numerario': 'Numerário',
        'transferencia': 'Transferência Bancária',
        'deposito': 'Depósito Bancário'
    }
    return labels[metodo] || metodo
}
