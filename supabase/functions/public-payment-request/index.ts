import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Edge Function: Public Payment Request
 * Creates a pending manual payment request for a school (blocked/renewal flow).
 * Replaces insecure anon INSERT on transacoes_pagamento.
 */

type Plano = 'trimestral' | 'semestral' | 'anual'

interface Body {
    escola_id: string
    plano: Plano
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
}

const RATE_WINDOW_MS = 60_000
const RATE_MAX = 10
const hits = new Map<string, { count: number; resetAt: number }>()

const DEFAULT_PRICES: Record<Plano, number> = {
    trimestral: 15000,
    semestral: 27000,
    anual: 48000,
}

function clientKey(req: Request): string {
    return (
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('cf-connecting-ip') ||
        req.headers.get('x-real-ip') ||
        'unknown'
    )
}

function allowRequest(key: string): boolean {
    const now = Date.now()
    const cur = hits.get(key)
    if (!cur || now >= cur.resetAt) {
        hits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
        return true
    }
    if (cur.count >= RATE_MAX) return false
    cur.count += 1
    return true
}

function isUuid(v: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

function endDateFor(plano: Plano, start: Date): Date {
    const end = new Date(start)
    if (plano === 'trimestral') end.setMonth(end.getMonth() + 3)
    else if (plano === 'semestral') end.setMonth(end.getMonth() + 6)
    else end.setFullYear(end.getFullYear() + 1)
    return end
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
            status: 405,
            headers: corsHeaders,
        })
    }

    const key = clientKey(req)
    if (!allowRequest(key)) {
        return new Response(
            JSON.stringify({ success: false, error: 'Demasiados pedidos. Tente novamente dentro de um minuto.' }),
            { status: 429, headers: { ...corsHeaders, 'Retry-After': '60' } },
        )
    }

    try {
        const body = (await req.json()) as Body
        const escolaId = String(body.escola_id || '').trim()
        const plano = body.plano

        if (!isUuid(escolaId)) {
            return new Response(JSON.stringify({ success: false, error: 'escola_id inválido' }), {
                status: 400,
                headers: corsHeaders,
            })
        }
        if (!['trimestral', 'semestral', 'anual'].includes(plano)) {
            return new Response(JSON.stringify({ success: false, error: 'Plano inválido' }), {
                status: 400,
                headers: corsHeaders,
            })
        }

        const admin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        )

        const { data: school, error: schoolErr } = await admin
            .from('escolas')
            .select('id, nome, codigo_escola')
            .eq('id', escolaId)
            .maybeSingle()

        if (schoolErr || !school) {
            return new Response(JSON.stringify({ success: false, error: 'Escola não encontrada' }), {
                status: 404,
                headers: corsHeaders,
            })
        }

        // Preço server-side (nunca confiar no cliente)
        let valor = DEFAULT_PRICES[plano]
        const { data: priceRow } = await admin
            .from('precos_licenca')
            .select('valor')
            .eq('plano', plano)
            .eq('ativo', true)
            .maybeSingle()
        if (priceRow?.valor != null) valor = Number(priceRow.valor)

        const dataInicio = new Date()
        const dataFim = endDateFor(plano, dataInicio)
        const reference = `PAG-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`

        const { data: transacao, error: txErr } = await admin
            .from('transacoes_pagamento')
            .insert({
                escola_id: school.id,
                provider: 'manual',
                provider_transaction_id: reference,
                valor,
                estado: 'pendente',
                moeda: 'AOA',
                descricao: `Licença ${plano} - ${school.nome} (${school.codigo_escola})`,
                metadata: {
                    plano,
                    reference,
                    public_payment: true,
                    tipo: 'manual_subscription_request',
                    solicitado_em: new Date().toISOString(),
                    data_inicio: dataInicio.toISOString().split('T')[0],
                    data_fim: dataFim.toISOString().split('T')[0],
                },
            })
            .select('id')
            .single()

        if (txErr) {
            console.error('public-payment-request insert error', txErr)
            return new Response(
                JSON.stringify({ success: false, error: 'Não foi possível registar o pedido de pagamento' }),
                { status: 500, headers: corsHeaders },
            )
        }

        return new Response(
            JSON.stringify({
                success: true,
                transaction_id: transacao.id,
                reference,
                valor,
                moeda: 'AOA',
                message:
                    'Pagamento registado com sucesso! Utilize a referência abaixo para efectuar o pagamento.',
            }),
            { status: 200, headers: corsHeaders },
        )
    } catch (error) {
        console.error('public-payment-request error', error)
        return new Response(JSON.stringify({ success: false, error: 'Erro interno do servidor' }), {
            status: 500,
            headers: corsHeaders,
        })
    }
})
