import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Edge Function: SuperAdmin delete escola
 *
 * POST /superadmin-delete-escola
 * Body: { escola_id: string, motivo: string, create_backup?: boolean }
 *
 * 1. Valida JWT + perfil SUPERADMIN activo
 * 2. Chama RPC backup_and_delete_escola (dados da escola)
 * 3. Remove contas auth do responsável e utilizadores exclusivos da escola
 */

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS_HEADERS })
    }

    if (req.method !== 'POST') {
        return json({ success: false, error: 'Method not allowed' }, 405)
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? ''
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

        if (!supabaseUrl || !serviceKey) {
            return json({ success: false, error: 'Server misconfigured' }, 500)
        }

        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return json({ success: false, error: 'Não autenticado' }, 401)
        }

        const userClient = createClient(supabaseUrl, anonKey || serviceKey, {
            global: { headers: { Authorization: authHeader } },
            auth: { autoRefreshToken: false, persistSession: false },
        })

        const admin = createClient(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        })

        const { data: userData, error: userErr } = await userClient.auth.getUser()
        if (userErr || !userData?.user) {
            return json({ success: false, error: 'Sessão inválida' }, 401)
        }

        const callerId = userData.user.id

        const { data: profile, error: profileErr } = await admin
            .from('user_profiles')
            .select('tipo_perfil, ativo')
            .eq('user_id', callerId)
            .maybeSingle()

        if (profileErr || !profile || profile.tipo_perfil !== 'SUPERADMIN' || profile.ativo !== true) {
            return json({ success: false, error: 'Apenas SUPERADMIN pode eliminar escolas' }, 403)
        }

        const body = await req.json().catch(() => ({}))
        const escolaId = String(body?.escola_id ?? '')
        const motivo = String(body?.motivo ?? '').trim()
        const createBackup = body?.create_backup !== false

        if (!UUID_RE.test(escolaId)) {
            return json({ success: false, error: 'escola_id inválido' }, 400)
        }
        if (!motivo) {
            return json({ success: false, error: 'Motivo da eliminação é obrigatório' }, 400)
        }

        const { data: escola, error: escolaErr } = await admin
            .from('escolas')
            .select('id, nome, codigo_escola, user_id')
            .eq('id', escolaId)
            .maybeSingle()

        if (escolaErr || !escola) {
            return json({ success: false, error: 'Escola não encontrada' }, 404)
        }

        // Recolher contas a eliminar ANTES do hard-delete
        const userIdSet = new Set<string>()
        if (escola.user_id) userIdSet.add(escola.user_id)

        const { data: profiles } = await admin
            .from('user_profiles')
            .select('user_id')
            .eq('escola_id', escolaId)

        for (const row of profiles || []) {
            if (row.user_id) userIdSet.add(row.user_id)
        }

        const { data: professores } = await admin
            .from('professores')
            .select('user_id')
            .eq('escola_id', escolaId)

        for (const row of professores || []) {
            if (row.user_id) userIdSet.add(row.user_id)
        }

        const { data: secretarios } = await admin
            .from('secretarios')
            .select('user_id')
            .eq('escola_id', escolaId)

        for (const row of secretarios || []) {
            if (row.user_id) userIdSet.add(row.user_id)
        }

        const { data: funcionarios } = await admin
            .from('funcionarios_escola')
            .select('user_id')
            .eq('escola_id', escolaId)

        for (const row of funcionarios || []) {
            if (row.user_id) userIdSet.add(row.user_id)
        }

        userIdSet.delete(callerId)

        // Filtrar utilizadores que também pertencem a outras escolas / direcções
        const candidateIds = [...userIdSet]
        const deletableIds: string[] = []

        for (const uid of candidateIds) {
            const { count: otherProfiles } = await admin
                .from('user_profiles')
                .select('user_id', { count: 'exact', head: true })
                .eq('user_id', uid)
                .neq('escola_id', escolaId)

            const { count: otherEscolas } = await admin
                .from('escolas')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', uid)
                .neq('id', escolaId)

            // Perfis com escola_id NULL (direcções / superadmin) também bloqueiam
            const { count: nullSchoolProfiles } = await admin
                .from('user_profiles')
                .select('user_id', { count: 'exact', head: true })
                .eq('user_id', uid)
                .is('escola_id', null)

            if ((otherProfiles || 0) === 0 && (otherEscolas || 0) === 0 && (nullSchoolProfiles || 0) === 0) {
                deletableIds.push(uid)
            }
        }

        // Hard-delete via RPC com o JWT do SuperAdmin (auth.uid() obrigatório)
        const { data: rpcResult, error: rpcError } = await userClient.rpc('backup_and_delete_escola', {
            p_escola_id: escolaId,
            p_motivo: motivo,
            p_create_backup: createBackup,
        })

        if (rpcError) {
            return json({ success: false, error: rpcError.message }, 500)
        }

        const rpcPayload = rpcResult as { success?: boolean; error?: string; backup_id?: string; message?: string } | null
        if (rpcPayload && rpcPayload.success === false) {
            return json({
                success: false,
                error: rpcPayload.error || 'Falha ao eliminar escola',
            }, 500)
        }

        let deletedAuthUsers = 0
        const authErrors: string[] = []

        for (const uid of deletableIds) {
            // Confirmar que já não há perfil (CASCADE do delete da escola)
            const { count: remaining } = await admin
                .from('user_profiles')
                .select('user_id', { count: 'exact', head: true })
                .eq('user_id', uid)

            if ((remaining || 0) > 0) continue

            const { error: delErr } = await admin.auth.admin.deleteUser(uid)
            if (delErr) {
                authErrors.push(`${uid}: ${delErr.message}`)
                continue
            }
            deletedAuthUsers += 1
        }

        return json({
            success: true,
            backup_id: rpcPayload?.backup_id,
            deleted_auth_users: deletedAuthUsers,
            auth_errors: authErrors.length ? authErrors : undefined,
            message:
                rpcPayload?.message ||
                `Escola eliminada. Removidas ${deletedAuthUsers} conta(s) de acesso (responsável e utilizadores da escola).`,
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return json({ success: false, error: message }, 500)
    }
})
