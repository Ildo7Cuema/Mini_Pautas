import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Edge Function: Notify Admin Registration
 *
 * POST /notify-admin-registration
 * Body: { tipo: 'ESCOLA' | 'DIRECAO_MUNICIPAL' | 'DIRECAO_PROVINCIAL', user_id: string }
 *
 * Chamada pelo formulário de registo logo após o cadastro ter sucesso.
 * - Envia um alerta por WhatsApp para o Administrador.
 * - Para Direção Municipal (cujo RPC não gera notificação), cria também a
 *   notificação no perfil dos SuperAdmins. Escola e Direção Provincial já
 *   são notificadas no perfil pelo trigger / RPC existentes.
 *
 * Segurança (a função é chamada por utilizadores ainda não autenticados):
 * - O cliente NÃO envia texto: a mensagem é construída aqui a partir da BD.
 * - O registo tem de existir e ter sido criado nos últimos 30 minutos.
 * - Idempotente por (tipo, user_id): nunca envia dois WhatsApp para o mesmo registo.
 *
 * Secrets (supabase secrets set ...):
 *   ADMIN_WHATSAPP_NUMBER   opcional, por omissão +244921923232
 *   WHATSAPP_PROVIDER       'callmebot' | 'twilio' | 'cloudapi'
 *
 *   callmebot: CALLMEBOT_API_KEY
 *   twilio:    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (ex: whatsapp:+14155238886)
 *   cloudapi:  WHATSAPP_CLOUD_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
 *              WHATSAPP_CLOUD_TEMPLATE (opcional; template com 1 variável de corpo),
 *              WHATSAPP_CLOUD_TEMPLATE_LANG (opcional, por omissão pt_PT)
 *
 * Sem provider configurado a função não falha: regista 'not_configured'.
 */

type Tipo = 'ESCOLA' | 'DIRECAO_MUNICIPAL' | 'DIRECAO_PROVINCIAL'

const TIPOS: Tipo[] = ['ESCOLA', 'DIRECAO_MUNICIPAL', 'DIRECAO_PROVINCIAL']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_AGE_MS = 30 * 60 * 1000
const PENDING_RETRY_MS = 2 * 60 * 1000
const MAX_ATTEMPTS = 3
const DEFAULT_ADMIN_NUMBER = '+244921923232'

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
}

interface RegistoInfo {
    created_at: string
    texto: string // mensagem WhatsApp
    inApp?: { titulo: string; mensagem: string; link: string; dados: Record<string, unknown> }
}

const clean = (v: unknown) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim()
const orDash = (v: unknown) => clean(v) || '—'

function formatDate(iso: string) {
    try {
        return new Date(iso).toLocaleString('pt-PT', { timeZone: 'Africa/Luanda' })
    } catch {
        return iso
    }
}

async function loadRegisto(admin: SupabaseClient, tipo: Tipo, userId: string): Promise<RegistoInfo | null> {
    if (tipo === 'ESCOLA') {
        const { data } = await admin
            .from('escolas')
            .select('id, nome, codigo_escola, provincia, municipio, telefone, email, created_at')
            .eq('user_id', userId)
            .maybeSingle()
        if (!data) return null

        let responsavel = ''
        try {
            const { data: u } = await admin.auth.admin.getUserById(userId)
            responsavel = clean(u?.user?.user_metadata?.full_name)
        } catch (_) { /* opcional */ }

        return {
            created_at: data.created_at,
            texto: [
                '🏫 *Novo cadastro de ESCOLA*',
                `Nome: ${orDash(data.nome)}`,
                `Código: ${orDash(data.codigo_escola)}`,
                `Local: ${orDash(data.municipio)}, ${orDash(data.provincia)}`,
                `Responsável: ${orDash(responsavel)}`,
                `Telefone: ${orDash(data.telefone)}`,
                `Email: ${orDash(data.email)}`,
                `Data: ${formatDate(data.created_at)}`,
            ].join('\n'),
        }
    }

    if (tipo === 'DIRECAO_MUNICIPAL') {
        const { data } = await admin
            .from('direcoes_municipais')
            .select('nome, provincia, municipio, email, telefone, cargo, created_at')
            .eq('user_id', userId)
            .maybeSingle()
        if (!data) return null

        return {
            created_at: data.created_at,
            texto: [
                '🏛️ *Nova DIREÇÃO MUNICIPAL pendente de aprovação*',
                `Município: ${orDash(data.municipio)} - ${orDash(data.provincia)}`,
                `Responsável: ${orDash(data.nome)}`,
                `Cargo: ${orDash(data.cargo)}`,
                `Telefone: ${orDash(data.telefone)}`,
                `Email: ${orDash(data.email)}`,
                `Data: ${formatDate(data.created_at)}`,
                'Aceda ao painel SuperAdmin para aprovar ou rejeitar.',
            ].join('\n'),
            inApp: {
                titulo: 'Nova Direção Municipal Pendente',
                mensagem: `Nova solicitação de registo de Direção Municipal de ${clean(data.municipio)} - ${clean(data.provincia)} aguarda aprovação.`,
                link: 'superadmin-direcoes-municipais',
                dados: {
                    tipo: 'aprovacao_direcao_municipal',
                    direcao_nome: clean(data.nome),
                    municipio: clean(data.municipio),
                    provincia: clean(data.provincia),
                    email: clean(data.email),
                    link: 'superadmin-direcoes-municipais',
                },
            },
        }
    }

    // DIRECAO_PROVINCIAL
    const { data } = await admin
        .from('direcoes_provinciais')
        .select('nome, provincia, email, telefone, cargo, created_at')
        .eq('user_id', userId)
        .maybeSingle()
    if (!data) return null

    return {
        created_at: data.created_at,
        texto: [
            '🏛️ *Nova DIREÇÃO PROVINCIAL pendente de aprovação*',
            `Província: ${orDash(data.provincia)}`,
            `Responsável: ${orDash(data.nome)}`,
            `Cargo: ${orDash(data.cargo)}`,
            `Telefone: ${orDash(data.telefone)}`,
            `Email: ${orDash(data.email)}`,
            `Data: ${formatDate(data.created_at)}`,
            'Aceda ao painel SuperAdmin para aprovar ou rejeitar.',
        ].join('\n'),
    }
}

// ---------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------

type WhatsAppResult =
    | { status: 'sent'; provider: string }
    | { status: 'not_configured' }
    | { status: 'failed'; provider: string; error: string }

async function sendWhatsApp(text: string): Promise<WhatsAppResult> {
    const provider = (Deno.env.get('WHATSAPP_PROVIDER') ?? '').toLowerCase().trim()
    const toRaw = Deno.env.get('ADMIN_WHATSAPP_NUMBER') ?? DEFAULT_ADMIN_NUMBER
    const digits = toRaw.replace(/\D/g, '') // 244921923232

    try {
        if (provider === 'callmebot') {
            const apikey = Deno.env.get('CALLMEBOT_API_KEY')
            if (!apikey) return { status: 'not_configured' }
            const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent('+' + digits)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`
            const res = await fetch(url)
            if (!res.ok) return { status: 'failed', provider, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` }
            return { status: 'sent', provider }
        }

        if (provider === 'twilio') {
            const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
            const token = Deno.env.get('TWILIO_AUTH_TOKEN')
            const from = Deno.env.get('TWILIO_WHATSAPP_FROM')
            if (!sid || !token || !from) return { status: 'not_configured' }
            const body = new URLSearchParams({
                From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
                To: `whatsapp:+${digits}`,
                Body: text,
            })
            const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
                method: 'POST',
                headers: {
                    Authorization: 'Basic ' + btoa(`${sid}:${token}`),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body,
            })
            if (!res.ok) return { status: 'failed', provider, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` }
            return { status: 'sent', provider }
        }

        if (provider === 'cloudapi') {
            const token = Deno.env.get('WHATSAPP_CLOUD_TOKEN')
            const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
            if (!token || !phoneId) return { status: 'not_configured' }
            const template = Deno.env.get('WHATSAPP_CLOUD_TEMPLATE')
            const payload = template
                ? {
                    messaging_product: 'whatsapp',
                    to: digits,
                    type: 'template',
                    template: {
                        name: template,
                        language: { code: Deno.env.get('WHATSAPP_CLOUD_TEMPLATE_LANG') ?? 'pt_PT' },
                        // Variáveis de template não aceitam quebras de linha
                        components: [{ type: 'body', parameters: [{ type: 'text', text: text.replace(/\n+/g, ' | ') }] }],
                    },
                }
                : { messaging_product: 'whatsapp', to: digits, type: 'text', text: { body: text } }
            const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) return { status: 'failed', provider, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` }
            return { status: 'sent', provider }
        }

        return { status: 'not_configured' }
    } catch (err) {
        return { status: 'failed', provider, error: err instanceof Error ? err.message : String(err) }
    }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
    if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405)

    try {
        const body = await req.json().catch(() => ({}))
        const tipo = body?.tipo as Tipo
        const userId = String(body?.user_id ?? '')

        if (!TIPOS.includes(tipo) || !UUID_RE.test(userId)) {
            return json({ success: false, error: 'Parâmetros inválidos' }, 400)
        }

        const admin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. O registo tem de existir e ser recente
        const registo = await loadRegisto(admin, tipo, userId)
        if (!registo) return json({ success: false, error: 'Registo não encontrado' }, 404)
        if (Date.now() - new Date(registo.created_at).getTime() > MAX_AGE_MS) {
            return json({ success: false, error: 'Registo demasiado antigo para notificar' }, 410)
        }

        // 2. Idempotência
        let alertId: string
        let inAppCreated = false
        let attempts = 1

        const { data: inserted, error: insertError } = await admin
            .from('admin_registration_alerts')
            .insert({ tipo, user_id: userId })
            .select('id')
            .single()

        if (inserted) {
            alertId = inserted.id
        } else if (insertError?.code === '23505') {
            const { data: existing } = await admin
                .from('admin_registration_alerts')
                .select('id, whatsapp_status, in_app_created, attempts, updated_at')
                .eq('tipo', tipo)
                .eq('user_id', userId)
                .single()
            if (!existing) return json({ success: false, error: 'Estado do alerta indisponível' }, 500)

            const stalePending =
                existing.whatsapp_status === 'pending' &&
                Date.now() - new Date(existing.updated_at).getTime() > PENDING_RETRY_MS
            const retryable =
                (existing.whatsapp_status === 'failed' || existing.whatsapp_status === 'not_configured' || stalePending) &&
                existing.attempts < MAX_ATTEMPTS

            if (!retryable) return json({ success: true, duplicate: true, whatsapp: existing.whatsapp_status })

            alertId = existing.id
            inAppCreated = existing.in_app_created
            attempts = existing.attempts + 1
            await admin
                .from('admin_registration_alerts')
                .update({ whatsapp_status: 'pending', attempts, updated_at: new Date().toISOString() })
                .eq('id', alertId)
        } else {
            throw insertError ?? new Error('Falha ao registar alerta')
        }

        // 3. Notificação no perfil (apenas quando o fluxo existente não a cria)
        if (registo.inApp && !inAppCreated) {
            const { data: admins } = await admin
                .from('user_profiles')
                .select('user_id')
                .eq('tipo_perfil', 'SUPERADMIN')
                .eq('ativo', true)

            if (admins && admins.length > 0) {
                const { error: notifError } = await admin.from('notificacoes').insert(
                    admins.map((a: { user_id: string }) => ({
                        destinatario_id: a.user_id,
                        tipo: 'sistema',
                        titulo: registo.inApp!.titulo,
                        mensagem: registo.inApp!.mensagem,
                        dados_adicionais: registo.inApp!.dados,
                        lida: false,
                    }))
                )
                if (notifError) console.error('In-app notification error:', notifError)
                else inAppCreated = true
            }
        }

        // 4. WhatsApp
        const wa = await sendWhatsApp(registo.texto)
        if (wa.status === 'failed') console.error('WhatsApp error:', wa.error)
        if (wa.status === 'not_configured') console.warn('WhatsApp provider not configured')

        await admin
            .from('admin_registration_alerts')
            .update({
                whatsapp_status: wa.status,
                whatsapp_provider: 'provider' in wa ? wa.provider : null,
                whatsapp_error: wa.status === 'failed' ? wa.error : null,
                in_app_created: inAppCreated,
                updated_at: new Date().toISOString(),
            })
            .eq('id', alertId)

        return json({ success: true, whatsapp: wa.status, in_app: inAppCreated })
    } catch (error) {
        console.error('Error:', error)
        return json({ success: false, error: 'Erro interno do servidor' }, 500)
    }
})
