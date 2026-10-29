import { buildAdminWhatsAppLink } from '../utils/registrationNotifications'

export type AdminAlertState = 'pending' | 'sent' | 'manual'

interface AdminWhatsAppAlertProps {
    status: AdminAlertState
    message: string
    onOpen?: () => void
}

/**
 * Mostrado no ecrã de sucesso do registo, ANTES do redirecionamento para o login.
 * Botão que abre o WhatsApp do Administrador (+244 921 923 232) com a
 * mensagem já preenchida. Se o servidor já enviou o alerta automaticamente,
 * mostra também essa confirmação.
 */
export function AdminWhatsAppAlert({ status, message, onOpen }: AdminWhatsAppAlertProps) {
    return (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 text-left">
            {status === 'sent' && (
                <p className="text-sm text-green-700 mb-3">
                    ✅ O administrador já foi notificado automaticamente.
                </p>
            )}
            <p className="text-sm text-green-800 mb-3">
                Para agilizar a aprovação, notifique o administrador pelo WhatsApp.
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
