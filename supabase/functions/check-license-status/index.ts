import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Edge Function: Check License Status
 *
 * POST /check-license-status  body: { escola_id }
 * GET  /check-license-status?escola_id=xxx  (compat)
 *
 * Returns the current license status for a school.
 * Used by frontend to display license information and handle blocking.
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LicenseStatusResponse {
    valid: boolean
    dias_restantes: number
    estado?: string
    plano?: string
    data_fim?: string
    licenca?: {
        id: string
        plano: string
        data_inicio: string
        data_fim: string
        estado: string
        valor: number
    }
    escola_bloqueada: boolean
    bloqueio_motivo?: string
}

async function resolveEscolaId(req: Request): Promise<string | null> {
    if (req.method === 'GET') {
        return new URL(req.url).searchParams.get('escola_id')
    }

    try {
        const body = await req.json()
        return typeof body?.escola_id === 'string' ? body.escola_id : null
    } catch {
        return null
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            {
                status: 405,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    }

    try {
        const escola_id = await resolveEscolaId(req)

        if (!escola_id) {
            return new Response(
                JSON.stringify({ error: 'escola_id é obrigatório' }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization')! },
                },
            }
        )

        const { data: escola, error: escolaError } = await supabaseClient
            .from('escolas')
            .select('id, nome, bloqueado, bloqueado_motivo, ativo')
            .eq('id', escola_id)
            .maybeSingle()

        if (escolaError || !escola) {
            return new Response(
                JSON.stringify({ error: 'Escola não encontrada' }),
                {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        const { data: licenca } = await supabaseClient
            .from('licencas')
            .select('id, plano, data_inicio, data_fim, estado, valor')
            .eq('escola_id', escola_id)
            .eq('estado', 'ativa')
            .order('data_fim', { ascending: false })
            .limit(1)
            .maybeSingle()

        let diasRestantes = -1
        let licencaValida = false

        if (licenca) {
            const dataFim = new Date(licenca.data_fim)
            const hoje = new Date()
            hoje.setHours(0, 0, 0, 0)
            dataFim.setHours(0, 0, 0, 0)

            diasRestantes = Math.ceil((dataFim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
            licencaValida = diasRestantes >= 0
        }

        const response: LicenseStatusResponse = {
            valid: licencaValida && !escola.bloqueado && escola.ativo !== false,
            dias_restantes: diasRestantes,
            estado: licenca?.estado,
            plano: licenca?.plano,
            data_fim: licenca?.data_fim,
            licenca: licenca
                ? {
                    id: licenca.id,
                    plano: licenca.plano,
                    data_inicio: licenca.data_inicio,
                    data_fim: licenca.data_fim,
                    estado: licenca.estado,
                    valor: licenca.valor,
                }
                : undefined,
            escola_bloqueada: escola.bloqueado === true,
            bloqueio_motivo: escola.bloqueado_motivo || undefined,
        }

        return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error('Error:', error)
        return new Response(
            JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    }
})
