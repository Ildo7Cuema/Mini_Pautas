/**
 * Core logic: eliminate school + responsável auth accounts.
 * Used by Vite middleware and verification scripts.
 */
import { createClient } from '@supabase/supabase-js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * @param {{ url: string, serviceKey: string, anonKey?: string, accessToken: string, escolaId: string, motivo: string, createBackup?: boolean }} opts
 */
export async function superadminDeleteEscola(opts) {
    const {
        url,
        serviceKey,
        anonKey,
        accessToken,
        escolaId,
        motivo,
        createBackup = true,
    } = opts

    if (!UUID_RE.test(escolaId)) {
        return { success: false, error: 'escola_id inválido', status: 400 }
    }
    if (!String(motivo || '').trim()) {
        return { success: false, error: 'Motivo da eliminação é obrigatório', status: 400 }
    }

    const userClient = createClient(url, anonKey || serviceKey, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { autoRefreshToken: false, persistSession: false },
    })
    const admin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) {
        return { success: false, error: 'Sessão inválida', status: 401 }
    }
    const callerId = userData.user.id

    const { data: profile } = await admin
        .from('user_profiles')
        .select('tipo_perfil, ativo')
        .eq('user_id', callerId)
        .maybeSingle()

    if (!profile || profile.tipo_perfil !== 'SUPERADMIN' || profile.ativo !== true) {
        return { success: false, error: 'Apenas SUPERADMIN pode eliminar escolas', status: 403 }
    }

    const { data: escola } = await admin
        .from('escolas')
        .select('id, nome, codigo_escola, user_id')
        .eq('id', escolaId)
        .maybeSingle()

    if (!escola) {
        return { success: false, error: 'Escola não encontrada', status: 404 }
    }

    const userIdSet = new Set()
    if (escola.user_id) userIdSet.add(escola.user_id)

    for (const table of ['user_profiles', 'professores', 'secretarios', 'funcionarios_escola']) {
        const query = admin.from(table).select('user_id')
        const { data, error } = table === 'user_profiles'
            ? await query.eq('escola_id', escolaId)
            : await query.eq('escola_id', escolaId)
        if (error) continue
        for (const row of data || []) {
            if (row.user_id) userIdSet.add(row.user_id)
        }
    }

    userIdSet.delete(callerId)

    const deletableIds = []
    for (const uid of userIdSet) {
        const { count: otherProfiles } = await admin
            .from('user_profiles')
            .select('user_id', { count: 'exact', head: true })
            .eq('user_id', uid)
            .or(`escola_id.is.null,escola_id.neq.${escolaId}`)

        const { count: otherEscolas } = await admin
            .from('escolas')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', uid)
            .neq('id', escolaId)

        if ((otherProfiles || 0) === 0 && (otherEscolas || 0) === 0) {
            deletableIds.push(uid)
        }
    }

    const { data: rpcResult, error: rpcError } = await userClient.rpc('backup_and_delete_escola', {
        p_escola_id: escolaId,
        p_motivo: motivo,
        p_create_backup: createBackup,
    })

    if (rpcError) {
        return { success: false, error: rpcError.message, status: 500 }
    }

    const rpcPayload = rpcResult || {}
    if (rpcPayload.success === false) {
        return { success: false, error: rpcPayload.error || 'Falha ao eliminar escola', status: 500 }
    }

    // If RPC already deleted auth users (new migration), prefer that count
    let deletedAuthUsers = Number(rpcPayload.deleted_auth_users || 0)
    const authErrors = []

    if (deletedAuthUsers === 0 && deletableIds.length > 0) {
        for (const uid of deletableIds) {
            const { count: remaining } = await admin
                .from('user_profiles')
                .select('user_id', { count: 'exact', head: true })
                .eq('user_id', uid)

            if ((remaining || 0) > 0) continue

            const { data: stillEscola } = await admin
                .from('escolas')
                .select('id')
                .eq('user_id', uid)
                .maybeSingle()
            if (stillEscola) continue

            const { error: delErr } = await admin.auth.admin.deleteUser(uid)
            if (delErr) {
                authErrors.push(`${uid}: ${delErr.message}`)
                continue
            }
            deletedAuthUsers += 1
        }
    }

    return {
        success: true,
        status: 200,
        backup_id: rpcPayload.backup_id,
        deleted_auth_users: deletedAuthUsers,
        auth_errors: authErrors.length ? authErrors : undefined,
        message:
            rpcPayload.message ||
            `Escola eliminada. Removidas ${deletedAuthUsers} conta(s) de acesso (responsável e utilizadores da escola).`,
    }
}
