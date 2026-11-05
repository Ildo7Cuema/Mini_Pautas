/*
component-meta:
  name: NotificationDetailModal
  description: Modal for viewing notification details with delete option
  tokens: [--color-primary, --fs-sm, min-h-touch]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppNotification, getNotificationIcon, getRelativeTime } from '../utils/notificationUtils'
import { supabase } from '../lib/supabaseClient'

interface NotificationDetailModalProps {
    notification: AppNotification | null
    isOpen: boolean
    onClose: () => void
    onDelete: (id: string) => void
    onNavigate?: (link: string) => void
}

export const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
    notification,
    isOpen,
    onClose,
    onDelete,
    onNavigate
}) => {
    const [circularDetails, setCircularDetails] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
            document.body.style.overflow = 'hidden'
            return () => {
                document.removeEventListener('keydown', handleEscape)
                document.body.style.overflow = 'auto'
            }
        }
    }, [isOpen, onClose])

    // Fetch details for circulars (municipal and provincial)
    useEffect(() => {
        if (isOpen && notification) {
            const isMunicipalCircular = notification.tipo === 'nova_circular_municipal' && notification.dados_adicionais?.circular_id;
            const isProvincialCircular = notification.tipo === 'nova_circular_provincial' && notification.dados_adicionais?.circular_id;

            if (isMunicipalCircular || isProvincialCircular) {
                setLoadingDetails(true);
                const fetchDetails = async () => {
                    const tableName = isMunicipalCircular ? 'circulares_municipais' : 'circulares_provinciais';
                    const { data, error } = await supabase
                        .from(tableName)
                        .select('anexo_url, anexo_filename, conteudo')
                        .eq('id', notification.dados_adicionais.circular_id)
                        .single();

                    if (data && !error) {
                        setCircularDetails(data);
                    }
                    setLoadingDetails(false);
                };
                fetchDetails();
            } else {
                setCircularDetails(null);
            }
        }
    }, [isOpen, notification]);

    if (!isOpen || !notification) return null

    const iconConfig = getNotificationIcon(notification.tipo)
    const relativeTime = getRelativeTime(notification.created_at)
    const formattedDate = new Date(notification.created_at).toLocaleDateString('pt-AO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })

    const handleDelete = () => {
        onDelete(notification.id)
        onClose()
    }

    const handleNavigate = () => {
        if (notification.link && onNavigate) {
            onNavigate(notification.link)
            onClose()
        }
    }

    // Get notification type label
    const getTypeLabel = (tipo: string): string => {
        const labels: Record<string, string> = {
            'aluno_novo': 'Novo Aluno',
            'nota_lancada': 'Nota Lançada',
            'nota_lancada_admin': 'Nota Lançada pela Direcção',
            'nota_final_calculada': 'Nota Final Calculada',
            'relatorio_gerado': 'Relatório Gerado',
            'sistema': 'Sistema',
            'escola_nova': 'Nova Escola',
            'atualizacao_sistema': 'Actualização do Sistema',
            'nova_circular_municipal': 'Comunicação Oficial',
            'nova_circular_provincial': 'Circular Provincial',
            'novo_concurso_publico': 'Concurso Público'
        }
        return labels[tipo] || 'Notificação'
    }

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] animate-fade-in"
                onClick={onClose}
            />

            {/* Modal Container - Scrollable if content is tall */}
            <div className="fixed inset-0 z-[1000] overflow-y-auto overflow-x-hidden flex justify-center py-4 md:py-10">
                <div
                    className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-slide-up self-center mx-4 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className={`p-6 ${iconConfig.bgColor} relative`}>
                        <div className="flex items-start justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className={`
                                    w-14 h-14 rounded-2xl flex items-center justify-center
                                    bg-white/95 ${iconConfig.color} shadow-lg ring-4 ring-white/20
                                `}>
                                    <div className="scale-125">
                                        {iconConfig.icon}
                                    </div>
                                </div>
                                <div className="min-w-0">
                                    <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${iconConfig.color} opacity-80 mb-1 block`}>
                                        {getTypeLabel(notification.tipo)}
                                    </span>
                                    <h2 className="text-xl font-extrabold text-slate-900 leading-tight">
                                        {notification.titulo}
                                    </h2>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/60 rounded-xl transition-all duration-200 -mr-2 -mt-2 group"
                            >
                                <svg className="w-5 h-5 text-slate-600 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Aesthetic abstract shape in header background */}
                        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
                    </div>

                    {/* Body */}
                    <div className="p-6 md:p-8 space-y-6">
                        {/* Message / Circular Content */}
                        {(notification.mensagem || circularDetails?.conteudo) && (
                            <div className="mb-6">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                    {(notification.tipo === 'nova_circular_provincial' || notification.tipo === 'nova_circular_municipal')
                                        ? 'Conteúdo da Circular'
                                        : 'Mensagem'}
                                </h4>
                                <div className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap">
                                    {/* Use full content if available, otherwise message */}
                                    {circularDetails?.conteudo || notification.mensagem}
                                </div>
                            </div>
                        )}

                        {/* Circular Info Badge */}
                        {(notification.tipo === 'nova_circular_provincial' || notification.tipo === 'nova_circular_municipal') && (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {notification.dados_adicionais?.urgente && (
                                    <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full flex items-center gap-1">
                                        🔴 URGENTE
                                    </span>
                                )}
                                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                                    {notification.dados_adicionais?.tipo || 'Circular'}
                                </span>
                                {notification.dados_adicionais?.provincia && (
                                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                                        📍 {notification.dados_adicionais.provincia}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Concurso Público Info Badge */}
                        {notification.tipo === 'novo_concurso_publico' && (
                            <div className="flex flex-wrap gap-2 mb-4">
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-full">
                                    Concurso Público
                                </span>
                                {notification.dados_adicionais?.provincia && (
                                    <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-full">
                                        📍 {notification.dados_adicionais.provincia}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Loading State */}
                        {loadingDetails && (
                            <div className="flex justify-center p-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                            </div>
                        )}

                        {/* Attachment Download Section */}
                        {circularDetails?.anexo_url && (
                            <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-sm">
                                <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                                    📎 Documento Anexo
                                </h4>
                                <a
                                    href={circularDetails.anexo_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download
                                    className="flex items-center gap-3 p-4 bg-white rounded-lg border border-blue-200 hover:border-blue-400 hover:shadow-lg transition-all text-blue-700 font-medium group"
                                >
                                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                        <span className="text-2xl">📄</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold truncate">{circularDetails.anexo_filename || 'Documento'}</p>
                                        <p className="text-xs text-blue-500">Clique para descarregar</p>
                                    </div>
                                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white group-hover:bg-blue-700 transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                    </div>
                                </a>
                            </div>
                        )}

                        {/* Metadata */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs">Recebida</p>
                                    <p className="text-slate-900 font-medium">{relativeTime}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs">Data completa</p>
                                    <p className="text-slate-900 font-medium capitalize">{formattedDate}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    {notification.lida ? (
                                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs">Estado</p>
                                    <p className={`font-medium ${notification.lida ? 'text-green-600' : 'text-blue-600'}`}>
                                        {notification.lida ? 'Lida' : 'Não lida'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-100 flex gap-3">
                        <button
                            onClick={handleDelete}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-medium transition-colors min-h-touch"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Eliminar
                        </button>

                        {notification.link && onNavigate && notification.tipo !== 'nota_lancada_admin' && (
                            <button
                                onClick={handleNavigate}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors min-h-touch"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                                Ver Detalhes
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>,
        document.body
    )
}
