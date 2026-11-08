import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Edge Function: Public School Lookup
 *
 * POST /public-school-lookup
 * Public lookup by school code or email for blocked-school payment flow.
 * Uses service role (bypasses RLS) — keep response minimal + rate-limited.
 */

interface LookupRequest {
    identifier: string
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
}

// In-memory rate limit (per isolate). Best-effort — not a substitute for gateway limits.
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 20
const hits = new Map<string, { count: number; resetAt: number }>()

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

function escapeIlike(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function maskEmail(email: string | null | undefined): string | undefined {
    if (!email || !email.includes('@')) return undefined
    const [user, domain] = email.split('@')
    if (!user || !domain) return undefined
    const visible = user.slice(0, Math.min(2, user.length))
    return `${visible}***@${domain}`
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
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
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        )

        const body: LookupRequest = await req.json()
        const { identifier } = body

        if (!identifier || typeof identifier !== 'string' || identifier.trim().length < 3) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Identificador inválido. Forneça o código ou email da escola.',
                }),
                { status: 400, headers: corsHeaders },
            )
        }

        if (identifier.trim().length > 120) {
            return new Response(
                JSON.stringify({ success: false, error: 'Identificador demasiado longo.' }),
                { status: 400, headers: corsHeaders },
            )
        }

        const searchValue = identifier.trim()
        const looksLikeEmail = searchValue.includes('@')

        let school: {
            id: string
            nome: string
            codigo_escola: string
            email?: string | null
            bloqueado: boolean
            bloqueado_motivo?: string | null
            provincia?: string | null
            municipio?: string | null
        } | null = null

        if (looksLikeEmail) {
            const { data, error } = await supabaseAdmin
                .from('escolas')
                .select('id, nome, codigo_escola, email, bloqueado, bloqueado_motivo, provincia, municipio')
                .ilike('email', escapeIlike(searchValue))
                .limit(1)
                .maybeSingle()
            if (error) console.error('Error searching by email:', error)
            school = data
        } else {
            const { data, error } = await supabaseAdmin
                .from('escolas')
                .select('id, nome, codigo_escola, email, bloqueado, bloqueado_motivo, provincia, municipio')
                .ilike('codigo_escola', escapeIlike(searchValue))
                .limit(1)
                .maybeSingle()
            if (error) console.error('Error searching by code:', error)
            school = data
        }

        // Resposta uniforme (não revelar se o email vs código falhou)
        if (!school) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Escola não encontrada. Verifique o código ou email inserido.',
                }),
                { status: 404, headers: corsHeaders },
            )
        }

        return new Response(
            JSON.stringify({
                success: true,
                school: {
                    id: school.id,
                    nome: school.nome,
                    codigo_escola: school.codigo_escola,
                    // email mascarado — evita enumeração de contactos
                    email: maskEmail(school.email),
                    bloqueado: school.bloqueado,
                    bloqueado_motivo: school.bloqueado_motivo,
                    provincia: school.provincia,
                    municipio: school.municipio,
                },
            }),
            { status: 200, headers: corsHeaders },
        )
    } catch (error) {
        console.error('Error:', error)
        return new Response(JSON.stringify({ success: false, error: 'Erro interno do servidor' }), {
            status: 500,
            headers: corsHeaders,
        })
    }
})
