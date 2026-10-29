import { buildAdminWhatsAppLink } from '../utils/registrationNotifications'

export type AdminAlertState = 'pending' | 'sent' | 'manual'

interface AdminWhatsAppAlertProps {
    status: AdminAlertState
    message: string
    onOpen?: () => void
}

/**
 * Mostrado no ecrã de sucesso do registo.
 * - Envio automático feito pelo servidor: apenas confirma.
 * - Caso contrário: botão que abre o WhatsApp do Administrador
 *   (+244 921 923 232) com a mensagem já preenchida.
 */
export function AdminWhatsAppAlert({ status, message, onOpen }: AdminWhatsAppAlertProps) {
    if (status === 'pending') {
        return (
            <p className="text-xs text-slate-400 mb-4">A notificar o administrador...</p>
        )
    }

    if (status === 'sent') {
        return (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
                ✅ O administrador foi notificado por WhatsApp.
            </p>
        )
    }

    return (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 text-left">
            <p className="text-sm text-green-800 mb-3">
                Para agilizar a aprovação, envie a notificação ao administrador pelo WhatsApp.
            </p>
            <a
                href={buildAdminWhatsAppLink(message)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onOpen}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
            >
                <span aria-hidden>💬</span> Notificar administrador no WhatsApp
            </a>
        </div>
    )
}
