import { supabase } from '../lib/supabaseClient'
import { logSuperAdminAction } from './superadmin'
import type {
    Licenca,
    TransacaoPagamento,
    PrecoLicenca,
    PrecoLicencaInstituicao,
    PlanoAssinaturaResolvido,
    TipoInstituicaoAssinatura,
    LicenseStatus,
    LicenseStats,
    PlanoLicenca,
    CreatePaymentRequest,
    CreatePaymentResponse
} from '../types'

export const PLANOS_ASSINATURA: PlanoLicenca[] = ['trimestral', 'semestral', 'anual']

export const PLANO_ASSINATURA_LABELS: Record<PlanoLicenca, string> = {
    trimestral: 'Trimestral',
    semestral: 'Semestral',
    anual: 'Anual',
}

export const TIPO_INSTITUICAO_LABELS: Record<TipoInstituicaoAssinatura, string> = {
    ESCOLA: 'Escola',
    DIRECAO_MUNICIPAL: 'Direção Municipal',
    DIRECAO_PROVINCIAL: 'Direção Provincial',
}

/**
 * License Management Utility Functions
 * Provides API functions for license and payment operations
 */

// ============================================
// LICENSE STATUS & QUERIES
// ============================================

/**
 * Check license status for a school.
 * Uses a direct RLS-backed query to avoid CORS/preflight failures from the Edge Function
 * when called from the browser (supabase.functions.invoke always POSTs).
 */
export async function checkLicenseStatus(escolaId: string): Promise<LicenseStatus> {
    try {
        return await checkLicenseStatusDirect(escolaId)
    } catch (error) {
        console.error('Error checking license status:', error)
        return {
            valid: false,
            dias_restantes: -1,
        }
    }
}

/**
 * Direct database query for license status (fallback)
 */
async function checkLicenseStatusDirect(escolaId: string): Promise<LicenseStatus> {
    const [{ data: escola }, { data: licenca }] = await Promise.all([
        supabase
            .from('escolas')
            .select('bloqueado, bloqueado_motivo, ativo')
            .eq('id', escolaId)
            .maybeSingle(),
        supabase
            .from('licencas')
            .select('*')
            .eq('escola_id', escolaId)
            .eq('estado', 'ativa')
            .order('data_fim', { ascending: false })
            .limit(1)
            .maybeSingle(),
    ])

    if (!licenca) {
        return {
            valid: false,
            dias_restantes: -1,
            escola_bloqueada: escola?.bloqueado === true,
            bloqueio_motivo: escola?.bloqueado_motivo || undefined,
        }
    }

    const dataFim = new Date(licenca.data_fim)
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    dataFim.setHours(0, 0, 0, 0)

    const diasRestantes = Math.ceil((dataFim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
    const licencaValida = diasRestantes >= 0

    return {
        valid: licencaValida && !escola?.bloqueado && escola?.ativo !== false,
        dias_restantes: diasRestantes,
        estado: licenca.estado,
        plano: licenca.plano,
        data_fim: licenca.data_fim,
        licenca,
        escola_bloqueada: escola?.bloqueado === true,
        bloqueio_motivo: escola?.bloqueado_motivo || undefined,
    }
}

/**
 * Fetch all licenses (SUPERADMIN only)
 * Prefer RPC SECURITY DEFINER to avoid empty lists caused by RLS/role_cache issues.
 */
export async function fetchAllLicenses(filters?: {
    estado?: string
    plano?: string
    escolaId?: string
}): Promise<Licenca[]> {
    try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('listar_licencas_admin', {
            p_estado: filters?.estado || null,
            p_plano: filters?.plano || null,
            p_escola_id: filters?.escolaId || null
        })

        if (!rpcError && Array.isArray(rpcData)) {
            return rpcData as Licenca[]
        }

        if (rpcError) {
            console.warn('listar_licencas_admin RPC unavailable, falling back to direct query:', rpcError.message)
        }

        let query = supabase
            .from('licencas')
            .select('*, escolas(id, nome, codigo_escola, provincia, municipio)')
            .order('created_at', { ascending: false })

        if (filters?.estado) {
            query = query.eq('estado', filters.estado)
        }
        if (filters?.plano) {
            query = query.eq('plano', filters.plano)
        }
        if (filters?.escolaId) {
            query = query.eq('escola_id', filters.escolaId)
        }

        const { data, error } = await query

        if (error) throw error
        return data || []
    } catch (error) {
        console.error('Error fetching licenses:', error)
        throw error
    }
}

/**
 * Fetch license for a specific school
 */
export async function fetchSchoolLicense(escolaId: string): Promise<Licenca | null> {
    try {
        const { data, error } = await supabase
            .from('licencas')
            .select('*')
            .eq('escola_id', escolaId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (error) throw error
        return data
    } catch (error) {
        console.error('Error fetching school license:', error)
        return null
    }
}

// ============================================
// LICENSE MANAGEMENT (SUPERADMIN)
// ============================================

/**
 * Create a manual license (SUPERADMIN only)
 */
export async function createManualLicense(
    escolaId: string,
    plano: PlanoLicenca,
    valor?: number,
    motivo?: string
): Promise<Licenca> {
    try {
        const { data, error } = await supabase.rpc('criar_licenca_manual', {
            p_escola_id: escolaId,
            p_plano: plano,
            p_valor: valor || null,
            p_motivo: motivo || 'Licença criada manualmente pelo SUPERADMIN'
        })

        if (error) throw error
        await logSuperAdminAction('CREATE_LICENSE', escolaId, {
            action: 'Licença criada manualmente',
            plano,
            valor: valor ?? null,
            motivo: motivo || 'Licença criada manualmente pelo SUPERADMIN',
        })
        return data as Licenca
    } catch (error) {
        console.error('Error creating manual license:', error)
        throw error
    }
}

/**
 * Suspend a license (SUPERADMIN only)
 */
export async function suspendLicense(
    licencaId: string,
    motivo?: string
): Promise<Licenca> {
    try {
        const { data, error } = await supabase.rpc('suspender_licenca', {
            p_licenca_id: licencaId,
            p_motivo: motivo || 'Suspensa pelo SUPERADMIN'
        })

        if (error) throw error
        const escolaId = (data as Licenca)?.escola_id || null
        await logSuperAdminAction('SUSPEND_LICENSE', escolaId, {
            action: 'Licença suspensa',
            licenca_id: licencaId,
            motivo: motivo || 'Suspensa pelo SUPERADMIN',
        })
        return data as Licenca
    } catch (error) {
        console.error('Error suspending license:', error)
        throw error
    }
}

/**
 * Reactivate a suspended license (SUPERADMIN only)
 */
export async function reactivateLicense(licencaId: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('licencas')
            .update({
                estado: 'ativa',
                updated_at: new Date().toISOString()
            })
            .eq('id', licencaId)

        if (error) throw error

        // Unblock the school
        const { data: licenca } = await supabase
            .from('licencas')
            .select('escola_id')
            .eq('id', licencaId)
            .maybeSingle()

        if (licenca) {
            await logSuperAdminAction('REACTIVATE_LICENSE', licenca.escola_id, {
                action: 'Licença reactivada',
                licenca_id: licencaId,
            })
            await supabase
                .from('escolas')
                .update({
                    bloqueado: false,
                    bloqueado_motivo: null,
                    bloqueado_em: null,
                    bloqueado_por: null
                })
                .eq('id', licenca.escola_id)
        }
    } catch (error) {
        console.error('Error reactivating license:', error)
        throw error
    }
}

// ============================================
// PAYMENT OPERATIONS
// ============================================

/**
 * Create a new payment
 */
export async function createPayment(
    request: CreatePaymentRequest
): Promise<CreatePaymentResponse> {
    try {
        const { data, error } = await supabase.functions.invoke('create-payment', {
            body: request
        })

        if (error) throw error
        return data as CreatePaymentResponse
    } catch (error) {
        console.error('Error creating payment:', error)
        throw error
    }
}

/**
 * Fetch payment transactions for a school
 */
export async function fetchTransactions(escolaId?: string): Promise<TransacaoPagamento[]> {
    try {
        let query = supabase
            .from('transacoes_pagamento')
            .select('*, licencas(*), escolas(id, nome, codigo_escola)')
            .order('created_at', { ascending: false })

        if (escolaId) {
            query = query.eq('escola_id', escolaId)
        }

        const { data, error } = await query

        if (error) throw error
        return data || []
    } catch (error) {
        console.error('Error fetching transactions:', error)
        throw error
    }
}

// ============================================
// PRICING
// ============================================

/**
 * Fetch global license prices (catalog Trimestral / Semestral / Anual)
 */
export async function fetchPrices(): Promise<PrecoLicenca[]> {
    try {
        const { data, error } = await supabase
            .from('precos_licenca')
            .select('*')
            .eq('ativo', true)
            .order('valor', { ascending: true })

        if (error) throw error

        const prices = data || []
        // Ordenação estável: trimestral → semestral → anual
        const order: Record<string, number> = { trimestral: 0, semestral: 1, anual: 2 }
        return [...prices].sort((a, b) => (order[a.plano] ?? 99) - (order[b.plano] ?? 99))
    } catch (error) {
        console.error('Error fetching prices:', error)
        throw error
    }
}

/**
 * Update a global license price (SUPERADMIN only)
 */
export async function updatePrice(
    priceId: string,
    updates: {
        valor?: number
        desconto_percentual?: number
        descricao?: string
        ativo?: boolean
    }
): Promise<PrecoLicenca> {
    try {
        const { data, error } = await supabase
            .from('precos_licenca')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', priceId)
            .select()
            .single()

        if (error) throw error
        return data as PrecoLicenca
    } catch (error) {
        console.error('Error updating price:', error)
        throw error
    }
}

/**
 * Fetch institution-specific price overrides
 */
export async function fetchInstitutionPrices(
    tipo: TipoInstituicaoAssinatura,
    instituicaoId: string
): Promise<PrecoLicencaInstituicao[]> {
    try {
        const { data, error } = await supabase
            .from('precos_licenca_instituicao')
            .select('*')
            .eq('tipo_instituicao', tipo)
            .eq('instituicao_id', instituicaoId)
            .order('plano')

        if (error) throw error
        return (data || []) as PrecoLicencaInstituicao[]
    } catch (error) {
        console.error('Error fetching institution prices:', error)
        throw error
    }
}

/**
 * Resolve effective plans for an institution (override > global)
 */
export async function resolvePricesForInstitution(
    tipo: TipoInstituicaoAssinatura,
    instituicaoId: string
): Promise<PlanoAssinaturaResolvido[]> {
    const [globals, overrides] = await Promise.all([
        fetchPrices(),
        fetchInstitutionPrices(tipo, instituicaoId),
    ])

    const byPlano = new Map(overrides.filter(o => o.ativo).map(o => [o.plano, o]))

    return PLANOS_ASSINATURA.map(plano => {
        const global = globals.find(g => g.plano === plano)
        const custom = byPlano.get(plano)
        if (custom) {
            return {
                plano,
                valor: custom.valor,
                desconto_percentual: custom.desconto_percentual,
                descricao: custom.descricao || global?.descricao,
                origem: 'instituicao' as const,
                global_price_id: global?.id,
                instituicao_price_id: custom.id,
            }
        }
        return {
            plano,
            valor: global?.valor ?? 0,
            desconto_percentual: global?.desconto_percentual ?? 0,
            descricao: global?.descricao,
            origem: 'global' as const,
            global_price_id: global?.id,
        }
    }).filter(p => p.valor > 0)
}

/**
 * Create or update institution-specific plan price (SUPERADMIN)
 */
export async function upsertInstitutionPrice(input: {
    tipo_instituicao: TipoInstituicaoAssinatura
    instituicao_id: string
    plano: PlanoLicenca
    valor: number
    desconto_percentual?: number
    descricao?: string
    ativo?: boolean
}): Promise<PrecoLicencaInstituicao> {
    try {
        const { data, error } = await supabase
            .from('precos_licenca_instituicao')
            .upsert(
                {
                    tipo_instituicao: input.tipo_instituicao,
                    instituicao_id: input.instituicao_id,
                    plano: input.plano,
                    valor: input.valor,
                    desconto_percentual: input.desconto_percentual ?? 0,
                    descricao: input.descricao || null,
                    ativo: input.ativo ?? true,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'tipo_instituicao,instituicao_id,plano' }
            )
            .select()
            .single()

        if (error) throw error
        return data as PrecoLicencaInstituicao
    } catch (error) {
        console.error('Error upserting institution price:', error)
        throw error
    }
}

/**
 * Remove institution override (reverts to global price)
 */
export async function clearInstitutionPrice(
    tipo: TipoInstituicaoAssinatura,
    instituicaoId: string,
    plano: PlanoLicenca
): Promise<void> {
    try {
        const { error } = await supabase
            .from('precos_licenca_instituicao')
            .delete()
            .eq('tipo_instituicao', tipo)
            .eq('instituicao_id', instituicaoId)
            .eq('plano', plano)

        if (error) throw error
    } catch (error) {
        console.error('Error clearing institution price:', error)
        throw error
    }
}

/**
 * Resolve a single plan value via RPC (fallback to client merge)
 */
export async function resolvePlanValor(
    tipo: TipoInstituicaoAssinatura,
    instituicaoId: string,
    plano: PlanoLicenca
): Promise<number | null> {
    try {
        const { data, error } = await supabase.rpc('resolver_preco_licenca', {
            p_tipo_instituicao: tipo,
            p_instituicao_id: instituicaoId,
            p_plano: plano,
        })
        if (!error && data != null) return Number(data)

        const plans = await resolvePricesForInstitution(tipo, instituicaoId)
        return plans.find(p => p.plano === plano)?.valor ?? null
    } catch (error) {
        console.error('Error resolving plan valor:', error)
        const plans = await resolvePricesForInstitution(tipo, instituicaoId)
        return plans.find(p => p.plano === plano)?.valor ?? null
    }
}

// ============================================
// STATISTICS (SUPERADMIN)
// ============================================

/**
 * Fetch license statistics for SUPERADMIN dashboard
 */
export async function fetchLicenseStats(): Promise<LicenseStats> {
    try {
        // Fetch all licenses
        const { data: licencas, error: licError } = await supabase
            .from('licencas')
            .select('id, estado, valor, plano, created_at')

        if (licError) throw licError

        // Fetch blocked schools count
        const { count: escolasBloqueadas, error: bloqError } = await supabase
            .from('escolas')
            .select('id', { count: 'exact' })
            .eq('bloqueado', true)

        if (bloqError) throw bloqError

        // Fetch successful transactions for revenue
        const { data: transacoes, error: transError } = await supabase
            .from('transacoes_pagamento')
            .select('valor, created_at')
            .eq('estado', 'sucesso')

        if (transError) throw transError

        // Calculate statistics
        const total_licencas = licencas?.length || 0
        const licencas_ativas = licencas?.filter(l => l.estado === 'ativa').length || 0
        const licencas_expiradas = licencas?.filter(l => l.estado === 'expirada').length || 0
        const licencas_suspensas = licencas?.filter(l => l.estado === 'suspensa').length || 0

        const receita_total = transacoes?.reduce((sum, t) => sum + (t.valor || 0), 0) || 0

        // Calculate revenue by period
        const now = new Date()
        const trimestre = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
        const semestre = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
        const ano = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())

        const receita_trimestre = transacoes?.filter(t => new Date(t.created_at) >= trimestre)
            .reduce((sum, t) => sum + (t.valor || 0), 0) || 0
        const receita_semestre = transacoes?.filter(t => new Date(t.created_at) >= semestre)
            .reduce((sum, t) => sum + (t.valor || 0), 0) || 0
        const receita_ano = transacoes?.filter(t => new Date(t.created_at) >= ano)
            .reduce((sum, t) => sum + (t.valor || 0), 0) || 0

        // Calculate monthly revenue
        const receitas_por_mes: Array<{ mes: string; ano: number; total: number }> = []
        for (let i = 11; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const mes = date.toLocaleString('pt-AO', { month: 'short' })
            const anoNum = date.getFullYear()
            const mesNum = date.getMonth()

            const total = transacoes?.filter(t => {
                const tDate = new Date(t.created_at)
                return tDate.getFullYear() === anoNum && tDate.getMonth() === mesNum
            }).reduce((sum, t) => sum + (t.valor || 0), 0) || 0

            receitas_por_mes.push({ mes, ano: anoNum, total })
        }

        return {
            total_licencas,
            licencas_ativas,
            licencas_expiradas,
            licencas_suspensas,
            escolas_bloqueadas_por_falta_pagamento: escolasBloqueadas || 0,
            receita_total,
            receita_trimestre,
            receita_semestre,
            receita_ano,
            receitas_por_mes
        }
    } catch (error) {
        console.error('Error fetching license stats:', error)
        throw error
    }
}

/**
 * Run expired license check (triggers blocking)
 */
export async function runExpirationCheck(): Promise<void> {
    try {
        const { error } = await supabase.rpc('verificar_licencas_expiradas')
        if (error) throw error
    } catch (error) {
        console.error('Error running expiration check:', error)
        throw error
    }
}

// ============================================
// MANUAL SUBSCRIPTION WORKFLOW
// ============================================

export interface SuperAdminContact {
    numero: string
    nome: string
    mensagem_padrao?: string
}

export interface DadosBancarios {
    banco: string
    conta: string
    iban: string
    titular: string
    instrucoes?: string
}

export interface PaymentModeConfig {
    modo_atual: 'manual' | 'online'
    pagamento_online_habilitado: boolean
    providers_configurados: string[]
    mensagem_modo_manual?: string
}

/**
 * Get SuperAdmin WhatsApp contact for payment proofs
 */
export async function getSuperAdminContact(): Promise<SuperAdminContact | null> {
    try {
        const { data, error } = await supabase
            .from('configuracoes_sistema')
            .select('valor')
            .eq('chave', 'superadmin_whatsapp')
            .maybeSingle()

        if (error) {
            console.warn('Error fetching SuperAdmin contact:', error)
            return null
        }

        return data?.valor as SuperAdminContact
    } catch (error) {
        console.error('Error fetching SuperAdmin contact:', error)
        return null
    }
}

/**
 * Get bank details for manual transfers
 */
export async function getDadosBancarios(): Promise<DadosBancarios | null> {
    try {
        const { data, error } = await supabase
            .from('configuracoes_sistema')
            .select('valor')
            .eq('chave', 'dados_bancarios')
            .maybeSingle()

        if (error) {
            console.warn('Error fetching bank details:', error)
            return null
        }

        return data?.valor as DadosBancarios
    } catch (error) {
        console.error('Error fetching bank details:', error)
        return null
    }
}

/**
 * Get payment mode configuration
 */
export async function getPaymentModeConfig(): Promise<PaymentModeConfig | null> {
    try {
        const { data, error } = await supabase
            .from('configuracoes_sistema')
            .select('valor')
            .eq('chave', 'modo_pagamento')
            .maybeSingle()

        if (error) {
            console.warn('Error fetching payment mode:', error)
            return null
        }

        return data?.valor as PaymentModeConfig
    } catch (error) {
        console.error('Error fetching payment mode:', error)
        return null
    }
}

/**
 * Check if online payment is enabled
 */
export async function isOnlinePaymentEnabled(): Promise<boolean> {
    const config = await getPaymentModeConfig()
    return config?.pagamento_online_habilitado ?? false
}

/**
 * Generate a unique reference code for manual subscription request
 */
function generateReferenceCode(escolaCode: string): string {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `${escolaCode}-${timestamp}-${random}`
}

/**
 * Request a manual subscription (creates pending transaction)
 */
export async function requestManualSubscription(
    escolaId: string,
    escolaCodigo: string,
    plano: PlanoLicenca
): Promise<{ success: boolean; reference: string; transaction_id?: string; error?: string }> {
    try {
        // Check if school has an active license (maybeSingle avoids HTTP 406 when none exists)
        const { data: activeLicense } = await supabase
            .from('licencas')
            .select('id, estado, data_fim')
            .eq('escola_id', escolaId)
            .eq('estado', 'ativa')
            .order('data_fim', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (activeLicense) {
            return {
                success: false,
                reference: '',
                error: 'Você já possui uma licença activa. Aguarde a expiração para renovar.'
            }
        }

        // Check if school has a pending manual subscription request
        const { data: pendingTransaction } = await supabase
            .from('transacoes_pagamento')
            .select('id, metadata')
            .eq('escola_id', escolaId)
            .eq('provider', 'manual')
            .eq('estado', 'pendente')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (pendingTransaction) {
            return {
                success: false,
                reference: '',
                error: 'Você já tem uma solicitação pendente. Aguarde a aprovação ou entre em contacto com o suporte.'
            }
        }

        // Preço efectivo: override da escola ou catálogo global
        const valorResolvido = await resolvePlanValor('ESCOLA', escolaId, plano)
        if (valorResolvido == null || valorResolvido <= 0) {
            throw new Error('Plano não encontrado ou sem preço configurado')
        }

        const reference = generateReferenceCode(escolaCodigo)

        // Create pending transaction
        const { data: transaction, error: transError } = await supabase
            .from('transacoes_pagamento')
            .insert({
                escola_id: escolaId,
                provider: 'manual',
                valor: valorResolvido,
                estado: 'pendente',
                metodo_pagamento: 'transferencia',
                descricao: `Solicitação de assinatura ${plano} - Aguardando comprovativo`,
                metadata: {
                    plano,
                    reference,
                    solicitado_em: new Date().toISOString(),
                    tipo: 'manual_subscription_request',
                    preco_origem: 'resolver_preco_licenca'
                }
            })
            .select()
            .single()

        if (transError) {
            throw transError
        }

        return {
            success: true,
            reference,
            transaction_id: transaction.id
        }
    } catch (error) {
        console.error('Error requesting manual subscription:', error)
        return {
            success: false,
            reference: '',
            error: error instanceof Error ? error.message : 'Erro ao solicitar assinatura'
        }
    }
}

/**
 * Fetch pending subscription approvals (SUPERADMIN only)
 */
export async function fetchPendingApprovals(): Promise<TransacaoPagamento[]> {
    try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('listar_aprovacoes_pendentes_admin')

        if (!rpcError && Array.isArray(rpcData)) {
            return rpcData as TransacaoPagamento[]
        }

        if (rpcError) {
            console.warn('listar_aprovacoes_pendentes_admin RPC unavailable, falling back:', rpcError.message)
        }

        const { data, error } = await supabase
            .from('transacoes_pagamento')
            .select('*, escolas(id, nome, codigo_escola, provincia, municipio)')
            .eq('provider', 'manual')
            .eq('estado', 'pendente')
            .order('created_at', { ascending: false })

        if (error) throw error
        return data || []
    } catch (error) {
        console.error('Error fetching pending approvals:', error)
        throw error
    }
}

/**
 * Human-readable label for payment transaction status
 */
export function getTransactionStatusLabel(estado: string): string {
    const labels: Record<string, string> = {
        sucesso: 'Pagamento Confirmado',
        pendente: 'Aguardando Confirmação',
        processando: 'Em Processamento',
        falha: 'Pagamento Falhou',
        cancelado: 'Pagamento Cancelado',
        reembolsado: 'Reembolsado'
    }

    return labels[estado] || estado.charAt(0).toUpperCase() + estado.slice(1)
}

/**
 * Approve a manual subscription request (SUPERADMIN only)
 */
export async function approveManualSubscription(
    transactionId: string,
    plano: PlanoLicenca,
    motivo?: string
): Promise<{ success: boolean; licenca?: Licenca; error?: string }> {
    try {
        const { data, error } = await supabase.rpc('aprovar_pagamento_manual', {
            p_transacao_id: transactionId,
            p_plano: plano,
            p_motivo: motivo || null
        })

        if (error) {
            throw error
        }

        if (!data?.success) {
            throw new Error(data?.error || 'Erro ao aprovar assinatura')
        }

        const licenca = data.licenca as Licenca | undefined
        await logSuperAdminAction('APPROVE_SUBSCRIPTION', licenca?.escola_id || null, {
            action: 'Assinatura manual aprovada',
            transacao_id: transactionId,
            plano,
            motivo: motivo || null,
            licenca_id: licenca?.id || null,
        })

        return {
            success: true,
            licenca
        }
    } catch (error) {
        console.error('Error approving manual subscription:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao aprovar assinatura'
        }
    }
}

/**
 * Reject a manual subscription request (SUPERADMIN only)
 */
export async function rejectManualSubscription(
    transactionId: string,
    motivo: string
): Promise<void> {
    try {
        const { data, error } = await supabase.rpc('rejeitar_pagamento_manual', {
            p_transacao_id: transactionId,
            p_motivo: motivo
        })

        if (error) throw error
        if (!data?.success) {
            throw new Error(data?.error || 'Erro ao rejeitar solicitação')
        }
        await logSuperAdminAction('REJECT_SUBSCRIPTION', null, {
            action: 'Assinatura manual rejeitada',
            transacao_id: transactionId,
            motivo,
        })
    } catch (error) {
        console.error('Error rejecting manual subscription:', error)
        throw error
    }
}

/**
 * Generate WhatsApp link with pre-filled message
 */
export function generateWhatsAppLink(
    phoneNumber: string,
    escolaNome: string,
    escolaCodigo: string,
    plano: string,
    reference: string
): string {
    const message = encodeURIComponent(
        `Olá! Gostaria de enviar o comprovativo de pagamento.\n\n` +
        `📋 Escola: ${escolaNome}\n` +
        `🔢 Código: ${escolaCodigo}\n` +
        `📦 Plano: ${plano}\n` +
        `🔖 Referência: ${reference}\n\n` +
        `Segue em anexo o comprovativo de pagamento.`
    )

    // Clean phone number (remove spaces, dashes, etc)
    const cleanPhone = phoneNumber.replace(/[^\d+]/g, '')

    return `https://wa.me/${cleanPhone}?text=${message}`
}
