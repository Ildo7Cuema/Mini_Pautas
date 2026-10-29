import { supabase } from '../lib/supabaseClient'

export type RegistrationType = 'ESCOLA' | 'DIRECAO_MUNICIPAL' | 'DIRECAO_PROVINCIAL'

/** WhatsApp do Administrador (formato internacional, sem "+") */
export const ADMIN_WHATSAPP_NUMBER = '244921923232'

/**
 * - 'sent'   : o servidor enviou o WhatsApp automaticamente
 * - 'manual' : o servidor não enviou (sem serviço configurado / erro) -> usar o link wa.me
 */
export type AdminAlertResult = 'sent' | 'manual'

/**
 * Alerta o Administrador (WhatsApp +244 921 923 232 e, quando aplicável,
 * notificação no perfil) de que um novo registo foi concluído.
 *
 * É "best effort": nunca lança erro nem bloqueia o fluxo de registo.
 * O envio automático é feito pela Edge Function `notify-admin-registration`
 * a partir dos dados gravados na base de dados.
 */
export async function notifyAdminNewRegistration(
    tipo: RegistrationType,
    userId: string
): Promise<AdminAlertResult> {
    try {
        const { data, error } = await supabase.functions.invoke('notify-admin-registration', {
            body: { tipo, user_id: userId },
        })
        if (error) {
            console.warn('Admin notification skipped:', error.message)
            return 'manual'
        }
        return data?.whatsapp === 'sent' ? 'sent' : 'manual'
    } catch (err) {
        console.warn('Admin notification failed:', err)
        return 'manual'
    }
}

/** Link "click-to-chat" para o WhatsApp do Administrador com a mensagem preenchida */
export function buildAdminWhatsAppLink(message: string): string {
    return `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

const line = (label: string, value?: string | null) => `${label}: ${value?.trim() || '—'}`

export function buildRegistrationMessage(
    tipo: RegistrationType,
    d: {
        nome: string
        provincia?: string
        municipio?: string
        codigo?: string
        responsavel?: string
        telefone?: string
        email?: string
        cargo?: string
    }
): string {
    const data = new Date().toLocaleString('pt-PT', { timeZone: 'Africa/Luanda' })

    if (tipo === 'ESCOLA') {
        return [
            '🏫 *Novo cadastro de ESCOLA*',
            line('Nome', d.nome),
            line('Código', d.codigo),
            line('Local', `${d.municipio || '—'}, ${d.provincia || '—'}`),
            line('Responsável', d.responsavel),
            line('Telefone', d.telefone),
            line('Email', d.email),
            line('Data', data),
        ].join('\n')
    }

    if (tipo === 'DIRECAO_MUNICIPAL') {
        return [
            '🏛️ *Nova DIREÇÃO MUNICIPAL pendente de aprovação*',
            line('Município', `${d.municipio || '—'} - ${d.provincia || '—'}`),
            line('Responsável', d.nome),
            line('Cargo', d.cargo),
            line('Telefone', d.telefone),
            line('Email', d.email),
            line('Data', data),
        ].join('\n')
    }

    return [
        '🏛️ *Nova DIREÇÃO PROVINCIAL pendente de aprovação*',
        line('Província', d.provincia),
        line('Responsável', d.nome),
        line('Cargo', d.cargo),
        line('Telefone', d.telefone),
        line('Email', d.email),
        line('Data', data),
    ].join('\n')
}
