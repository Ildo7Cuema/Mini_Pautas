import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Edge Function: Payment Webhook
 *
 * POST /payment-webhook
 *
 * Receives payment confirmation callbacks from payment providers.
 * Updates transaction status and activates/renews licenses upon success.
 *
 * Headers:
 *   - x-provider: The payment provider sending the webhook
 *   - x-signature: HMAC-SHA256 hex of raw body (or sha256=<hex>)
 *
 * Secrets (podem ser configurados mais tarde):
 *   EMIS_GPO_WEBHOOK_SECRET, PROXYPAY_WEBHOOK_SECRET,
 *   APPYPAY_WEBHOOK_SECRET, MANUAL_WEBHOOK_SECRET
 *
 * Enquanto os secrets não existirem em desenvolvimento:
 *   SKIP_WEBHOOK_VERIFICATION=true  (bloqueado se ENVIRONMENT=production)
 */

interface WebhookPayload {
    transaction_id?: string
    reference?: string
    status: 'success' | 'failed' | 'cancelled' | 'pending' | string
    amount?: number
    currency?: string
    provider_data?: Record<string, unknown>
}

const ALLOWED_PROVIDERS = new Set(['emis_gpo', 'proxypay', 'appypay', 'manual'])

function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    let mismatch = 0
    for (let i = 0; i < a.length; i++) {
        mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    return mismatch === 0
}

function normalizeHex(input: string): string {
    return input.trim().toLowerCase().replace(/^sha256=/i, '')
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    )
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    return Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}

/**
 * Verifies webhook authenticity.
 * - Production: requires configured secret + matching HMAC-SHA256 signature.
 * - Dev only: SKIP_WEBHOOK_VERIFICATION=true is allowed when Deno.env DENO_ENV/ENVIRONMENT is not production.
 * - Provider "manual" requires MANUAL_WEBHOOK_SECRET (never open).
 */
async function verifyWebhookSignature(
    provider: string,
    signature: string | null,
    body: string,
): Promise<boolean> {
    const isProduction =
        (Deno.env.get('ENVIRONMENT') || Deno.env.get('DENO_ENV') || Deno.env.get('NODE_ENV') || '')
            .toLowerCase() === 'production'

    if (Deno.env.get('SKIP_WEBHOOK_VERIFICATION') === 'true') {
        if (isProduction) {
            console.error('SKIP_WEBHOOK_VERIFICATION is forbidden in production')
            return false
        }
        console.log('Webhook verification skipped (development mode)')
        return true
    }

    if (!ALLOWED_PROVIDERS.has(provider)) {
        console.error('Unknown payment provider:', provider)
        return false
    }

    const webhookSecrets: Record<string, string> = {
        emis_gpo: Deno.env.get('EMIS_GPO_WEBHOOK_SECRET') || '',
        proxypay: Deno.env.get('PROXYPAY_WEBHOOK_SECRET') || '',
        appypay: Deno.env.get('APPYPAY_WEBHOOK_SECRET') || '',
        manual: Deno.env.get('MANUAL_WEBHOOK_SECRET') || '',
    }

    const secret = webhookSecrets[provider]
    if (!secret) {
        console.error('Missing webhook secret for provider:', provider)
        return false
    }

    if (!signature) {
        console.error('Missing signature for provider:', provider)
        return false
    }

    const expected = await hmacSha256Hex(secret, body)
    const provided = normalizeHex(signature)
    return timingSafeEqual(expected, provided)
}

function isSafeTransactionId(value: string): boolean {
    // UUID, provider refs, alphanumeric refs — reject PostgREST filter metacharacters
    return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
}

function mapProviderStatus(provider: string, providerStatus: string): string {
    const statusMaps: Record<string, Record<string, string>> = {
        emis_gpo: {
            PAID: 'sucesso',
            APPROVED: 'sucesso',
            FAILED: 'falha',
            CANCELLED: 'cancelado',
            PENDING: 'processando',
            EXPIRED: 'cancelado',
            success: 'sucesso',
            failed: 'falha',
            cancelled: 'cancelado',
            pending: 'processando',
        },
        proxypay: {
            paid: 'sucesso',
            pending: 'processando',
            failed: 'falha',
            deleted: 'cancelado',
            success: 'sucesso',
            cancelled: 'cancelado',
        },
        appypay: {
            completed: 'sucesso',
            processing: 'processando',
            failed: 'falha',
            cancelled: 'cancelado',
            success: 'sucesso',
            pending: 'processando',
        },
        manual: {
            success: 'sucesso',
            failed: 'falha',
            cancelled: 'cancelado',
            pending: 'processando',
        },
    }

    return statusMaps[provider]?.[providerStatus] || providerStatus
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers':
                    'authorization, x-client-info, apikey, content-type, x-provider, x-signature',
            },
        })
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    try {
        const provider = (req.headers.get('x-provider') || 'manual').toLowerCase()
        const signature = req.headers.get('x-signature')
        const rawBody = await req.text()

        if (!(await verifyWebhookSignature(provider, signature, rawBody))) {
            console.error('Webhook signature verification failed for provider:', provider)
            return new Response(JSON.stringify({ error: 'Invalid signature' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        const payload: WebhookPayload = JSON.parse(rawBody)

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        )

        const transactionId = payload.transaction_id || payload.reference
        if (!transactionId || !isSafeTransactionId(String(transactionId))) {
            return new Response(
                JSON.stringify({ error: 'Missing or invalid transaction_id / reference' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
            )
        }

        const safeId = String(transactionId)

        // Prefer exact equality lookups (no string-interpolated .or filter)
        let transacao: Record<string, any> | null = null
        let searchError: { message?: string } | null = null

        {
            const { data, error } = await supabaseAdmin
                .from('transacoes_pagamento')
                .select('*, licencas(*), escolas(*)')
                .eq('provider', provider)
                .eq('provider_transaction_id', safeId)
                .maybeSingle()
            if (error) searchError = error
            if (data) transacao = data
        }

        if (!transacao) {
            const { data, error } = await supabaseAdmin
                .from('transacoes_pagamento')
                .select('*, licencas(*), escolas(*)')
                .eq('provider', provider)
                .contains('metadata', { reference: safeId })
                .maybeSingle()
            if (error) searchError = error
            if (data) transacao = data
        }

        if (!transacao && /^[0-9a-f-]{36}$/i.test(safeId)) {
            const { data, error } = await supabaseAdmin
                .from('transacoes_pagamento')
                .select('*, licencas(*), escolas(*)')
                .eq('id', safeId)
                .maybeSingle()
            if (error) searchError = error
            if (data) transacao = data
        }

        if (searchError || !transacao) {
            console.error('Transaction not found:', safeId, searchError)
            return new Response(JSON.stringify({ error: 'Transação não encontrada' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        // Reject replay of already-successful payments mutating license again unnecessarily
        // but still allow idempotent success responses.
        const internalStatus = mapProviderStatus(provider, payload.status)

        if (
            payload.amount != null &&
            transacao.valor != null &&
            Number(payload.amount) !== Number(transacao.valor)
        ) {
            console.error('Webhook amount mismatch', {
                expected: transacao.valor,
                received: payload.amount,
            })
            return new Response(JSON.stringify({ error: 'Amount mismatch' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        const { error: updateError } = await supabaseAdmin
            .from('transacoes_pagamento')
            .update({
                estado: internalStatus,
                provider_transaction_id: payload.transaction_id || transacao.provider_transaction_id,
                metadata: {
                    ...(transacao.metadata || {}),
                    webhook_received_at: new Date().toISOString(),
                    provider_data: payload.provider_data,
                },
                updated_at: new Date().toISOString(),
            })
            .eq('id', transacao.id)

        if (updateError) {
            console.error('Error updating transaction:', updateError)
            return new Response(JSON.stringify({ error: 'Erro ao actualizar transação' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        if (internalStatus === 'sucesso' && transacao.licenca_id && transacao.estado !== 'sucesso') {
            const { error: licenseError } = await supabaseAdmin
                .from('licencas')
                .update({
                    estado: 'ativa',
                    data_ultimo_pagamento: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', transacao.licenca_id)

            if (licenseError) {
                console.error('Error updating license:', licenseError)
            }

            const { error: unblockError } = await supabaseAdmin
                .from('escolas')
                .update({
                    bloqueado: false,
                    bloqueado_motivo: null,
                    bloqueado_em: null,
                    bloqueado_por: null,
                    ativo: true,
                })
                .eq('id', transacao.escola_id)

            if (unblockError) {
                console.error('Error unblocking school:', unblockError)
            }

            await supabaseAdmin.from('historico_licencas').insert({
                licenca_id: transacao.licenca_id,
                escola_id: transacao.escola_id,
                estado_anterior: transacao.licencas?.estado || 'pendente',
                estado_novo: 'ativa',
                motivo: `Pagamento confirmado via ${provider} - Ref: ${safeId}`,
                metadata: { transaction_id: transacao.id, provider },
            })

            console.log('License activated and school unblocked:', transacao.escola_id)
        }

        if (internalStatus === 'falha' && transacao.licenca_id) {
            await supabaseAdmin.from('historico_licencas').insert({
                licenca_id: transacao.licenca_id,
                escola_id: transacao.escola_id,
                estado_anterior: transacao.licencas?.estado,
                estado_novo: transacao.licencas?.estado || 'pendente',
                motivo: `Pagamento falhou via ${provider} - Ref: ${safeId}`,
                metadata: { transaction_id: transacao.id, provider, error: payload.provider_data },
            })
        }

        return new Response(
            JSON.stringify({
                success: true,
                transaction_id: transacao.id,
                status: internalStatus,
                message:
                    internalStatus === 'sucesso'
                        ? 'Pagamento confirmado e licença activada'
                        : `Status actualizado para: ${internalStatus}`,
            }),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            },
        )
    } catch (error) {
        console.error('Webhook error:', error)
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Erro interno do servidor',
            }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            },
        )
    }
})
