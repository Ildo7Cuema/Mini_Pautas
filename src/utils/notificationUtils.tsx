// Notification types and utilities

export type NotificationType = 'aluno_novo' | 'nota_lancada' | 'nota_lancada_admin' | 'nota_final_calculada' | 'relatorio_gerado' | 'sistema' | 'escola_nova' | 'atualizacao_sistema' | 'sugestao' | 'documento_status'

export interface AppNotification {
    id: string
    destinatario_id: string
    escola_id?: string
    tipo: string  // Can be NotificationType or other custom types from database
    titulo: string
    mensagem?: string
    link?: string
    lida: boolean
    created_at: string
    updated_at?: string
    dados_adicionais?: any
}

export interface NotificationIconConfig {
    icon: React.ReactNode
    color: string
    bgColor: string
}

/**
 * Get relative time string from a date
 * Examples: "há 5 minutos", "há 2 horas", "ontem", "há 3 dias"
 */
export function getRelativeTime(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSeconds < 60) {
        return 'agora mesmo'
    } else if (diffMinutes < 60) {
        return `há ${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minutos'}`
    } else if (diffHours < 24) {
        return `há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`
    } else if (diffDays === 1) {
        return 'ontem'
    } else if (diffDays < 7) {
        return `há ${diffDays} dias`
    } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7)
        return `há ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`
    } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30)
        return `há ${months} ${months === 1 ? 'mês' : 'meses'}`
    } else {
        const years = Math.floor(diffDays / 365)
        return `há ${years} ${years === 1 ? 'ano' : 'anos'}`
    }
}

/**
 * Get icon configuration for notification type
 */
export function getNotificationIcon(tipo: string): NotificationIconConfig {
    switch (tipo) {
        case 'aluno_novo':
            return {
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                ),
                color: 'text-blue-600',
                bgColor: 'bg-blue-100'
            }
        case 'nota_lancada':
            return {
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                ),
                color: 'text-green-600',
                bgColor: 'bg-green-100'
            }
        case 'relatorio_gerado':
            return {
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                ),
                color: 'text-purple-600',
                bgColor: 'bg-purple-100'
            }
        case 'sistema':
            return {
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ),
                color: 'text-amber-600',
                bgColor: 'bg-amber-100'
            }
        case 'escola_nova':
            return {
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                ),
                color: 'text-indigo-600',
                bgColor: 'bg-indigo-100'
            }
        case 'atualizacao_sistema':
            return {
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                ),
                color: 'text-emerald-600',
                bgColor: 'bg-emerald-100'
            }
        case 'nota_lancada_admin':
            return {
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                ),
                color: 'text-orange-600',
                bgColor: 'bg-orange-100'
            }
        case 'nota_final_calculada':
            return {
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                ),
                color: 'text-teal-600',
                bgColor: 'bg-teal-100'
            }
        case 'sugestao':
            return {
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                ),
                color: 'text-yellow-600',
                bgColor: 'bg-yellow-100'
            }
        case 'documento_status':
            return {
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                ),
                color: 'text-cyan-600',
                bgColor: 'bg-cyan-100'
            }
        case 'novo_concurso_publico':
            return {
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                ),
                color: 'text-emerald-700',
                bgColor: 'bg-emerald-100'
            }
        case 'conselho_notas_convite':
        case 'conselho_notas_rascunho':
        case 'conselho_notas_aprovado':
            return {
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                ),
                color:
                    tipo === 'conselho_notas_aprovado'
                        ? 'text-emerald-700'
                        : tipo === 'conselho_notas_rascunho'
                          ? 'text-amber-700'
                          : 'text-slate-700',
                bgColor:
                    tipo === 'conselho_notas_aprovado'
                        ? 'bg-emerald-100'
                        : tipo === 'conselho_notas_rascunho'
                          ? 'bg-amber-100'
                          : 'bg-slate-200',
            }
        default:
            return {
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ),
                color: 'text-slate-600',
                bgColor: 'bg-slate-100'
            }
    }
}

/**
 * Format notification count for badge
 * Returns "99+" for counts over 99
 */
export function formatNotificationCount(count: number): string {
    if (count > 99) {
        return '99+'
    }
    return count.toString()
}
