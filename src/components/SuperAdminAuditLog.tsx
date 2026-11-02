/**
 * @component SuperAdminAuditLog
 * @description Log de auditoria moderno mobile-first para SUPERADMIN
 * @tokens [--color-primary, --gradient-primary, --shadow-elevation-2]
 * @responsive true
 * @tested-on [375x667, 768x1024, 1440x900]
 */

import React, { useEffect, useState } from 'react'
import { fetchSuperAdminAuditLog } from '../utils/superadmin'
import type { SuperAdminAction } from '../types'

export const SuperAdminAuditLog: React.FC = () => {
    const [actions, setActions] = useState<SuperAdminAction[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [filterType, setFilterType] = useState<string>('all')
    const [selectedAction, setSelectedAction] = useState<SuperAdminAction | null>(null)

    useEffect(() => {
        loadAuditLog()
    }, [filterType])

    const loadAuditLog = async () => {
        try {
            setLoading(true)
            setError(null)

            const filters: any = { limit: 100 }
            if (filterType.startsWith('group:')) {
                filters.actionTypePrefix = filterType.replace('group:', '')
            } else if (filterType !== 'all') {
                filters.actionType = filterType
            }

            const data = await fetchSuperAdminAuditLog(filters)
            setActions(data)
        } catch (err) {
            console.error('Error loading audit log:', err)
            const message = err instanceof Error ? err.message : 'Erro ao carregar histórico de auditoria'
            setError(
                message.includes('listar_superadmin_actions') || message.includes('schema cache')
                    ? 'Auditoria indisponível: aplique a migration 20261102_fix_superadmin_audit_actions no Supabase.'
                    : message || 'Erro ao carregar histórico de auditoria'
            )
        } finally {
            setLoading(false)
        }
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleString('pt-AO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const formatRelativeTime = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'Agora mesmo'
        if (diffMins < 60) return `${diffMins}m atrás`
        if (diffHours < 24) return `${diffHours}h atrás`
        if (diffDays < 7) return `${diffDays}d atrás`
        return formatDate(dateString)
    }

    const getActionConfig = (actionType: string) => {
        const configs: Record<string, { icon: string; label: string; color: string; bgColor: string }> = {
            'ACTIVATE_ESCOLA': { icon: '✅', label: 'Activar Escola', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
            'DEACTIVATE_ESCOLA': { icon: '⏸️', label: 'Desactivar Escola', color: 'text-amber-700', bgColor: 'bg-amber-100' },
            'BLOCK_ESCOLA': { icon: '🚫', label: 'Bloquear Escola', color: 'text-red-700', bgColor: 'bg-red-100' },
            'UNBLOCK_ESCOLA': { icon: '🔓', label: 'Desbloquear Escola', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
            'EDIT_ESCOLA': { icon: '✏️', label: 'Editar Escola', color: 'text-blue-700', bgColor: 'bg-blue-100' },
            'CREATE_ESCOLA': { icon: '➕', label: 'Criar Escola', color: 'text-purple-700', bgColor: 'bg-purple-100' },
            'DELETE_ESCOLA': { icon: '🗑️', label: 'Eliminar Escola', color: 'text-red-700', bgColor: 'bg-red-100' },
            'VIEW_ESCOLA_DATA': { icon: '👁️', label: 'Ver Dados', color: 'text-neutral-700', bgColor: 'bg-neutral-100' },
            'EDIT_SYSTEM_CONFIG': { icon: '⚙️', label: 'Editar Config.', color: 'text-violet-700', bgColor: 'bg-violet-100' },
            'CREATE_USER': { icon: '👤', label: 'Criar Utilizador', color: 'text-blue-700', bgColor: 'bg-blue-100' },
            'EDIT_USER': { icon: '✏️', label: 'Editar Utilizador', color: 'text-blue-700', bgColor: 'bg-blue-100' },
            'DELETE_USER': { icon: '🗑️', label: 'Eliminar Utilizador', color: 'text-red-700', bgColor: 'bg-red-100' },
            'EXPORT_DATA': { icon: '📥', label: 'Exportar Dados', color: 'text-teal-700', bgColor: 'bg-teal-100' },
            'CREATE_LICENSE': { icon: '📋', label: 'Criar Licença', color: 'text-green-700', bgColor: 'bg-green-100' },
            'SUSPEND_LICENSE': { icon: '⏸️', label: 'Suspender Licença', color: 'text-orange-700', bgColor: 'bg-orange-100' },
            'REACTIVATE_LICENSE': { icon: '🔄', label: 'Reactivar Licença', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
            'APPROVE_SUBSCRIPTION': { icon: '✅', label: 'Aprovar Assinatura', color: 'text-green-700', bgColor: 'bg-green-100' },
            'REJECT_SUBSCRIPTION': { icon: '✗', label: 'Rejeitar Assinatura', color: 'text-red-700', bgColor: 'bg-red-100' },
            'UPDATE_PRICE': { icon: '💳', label: 'Actualizar Preço Global', color: 'text-blue-700', bgColor: 'bg-blue-100' },
            'UPDATE_INSTITUTION_PRICE': { icon: '🏛️', label: 'Preço por Instituição', color: 'text-violet-700', bgColor: 'bg-violet-100' },
            'RESTORE_ESCOLA': { icon: '♻️', label: 'Restaurar Escola', color: 'text-teal-700', bgColor: 'bg-teal-100' },
            'ACTIVATE_DIRECAO_MUNICIPAL': { icon: '✅', label: 'Activar Dir. Municipal', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
            'DEACTIVATE_DIRECAO_MUNICIPAL': { icon: '⏸️', label: 'Desactivar Dir. Municipal', color: 'text-amber-700', bgColor: 'bg-amber-100' },
            'BLOCK_DIRECAO_MUNICIPAL': { icon: '🚫', label: 'Bloquear Dir. Municipal', color: 'text-red-700', bgColor: 'bg-red-100' },
            'UNBLOCK_DIRECAO_MUNICIPAL': { icon: '🔓', label: 'Desbloquear Dir. Municipal', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
            'ACTIVATE_DIRECAO_PROVINCIAL': { icon: '✅', label: 'Activar Dir. Provincial', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
            'DEACTIVATE_DIRECAO_PROVINCIAL': { icon: '⏸️', label: 'Desactivar Dir. Provincial', color: 'text-amber-700', bgColor: 'bg-amber-100' },
            'BLOCK_DIRECAO_PROVINCIAL': { icon: '🚫', label: 'Bloquear Dir. Provincial', color: 'text-red-700', bgColor: 'bg-red-100' },
            'UNBLOCK_DIRECAO_PROVINCIAL': { icon: '🔓', label: 'Desbloquear Dir. Provincial', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
            'OTHER': { icon: '📝', label: 'Outra Acção', color: 'text-neutral-700', bgColor: 'bg-neutral-100' }
        }
        return configs[actionType] || configs['OTHER']
    }

    const filterOptions = [
        { value: 'all', label: 'Todas', icon: '📋' },
        { value: 'group:ESCOLA', label: 'Escolas', icon: '🏫' },
        { value: 'group:DIRECAO_MUNICIPAL', label: 'Municipais', icon: '🏛️' },
        { value: 'group:DIRECAO_PROVINCIAL', label: 'Provinciais', icon: '🗺️' },
        { value: 'group:LICENSE', label: 'Licenças', icon: '📋' },
        { value: 'group:SUBSCRIPTION', label: 'Assinaturas', icon: '💳' },
    ]

    return (
        <div className="min-h-screen bg-neutral-50 pb-24 md:pb-8">
            {/* Header with Gradient */}
            <div className="bg-gradient-to-r from-violet-700 via-purple-800 to-indigo-900 text-white px-4 py-6 md:px-8 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2"></div>
                </div>

                <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="animate-fade-in">
                        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                            <span className="text-3xl">📊</span>
                            Auditoria do Sistema
                        </h1>
                        <p className="text-purple-200 mt-1 text-sm md:text-base">
                            Histórico de escolas, direções e licenças
                        </p>
                    </div>
                    <button
                        onClick={loadAuditLog}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl font-medium transition-all touch-feedback backdrop-blur-sm self-start md:self-auto"
                    >
                        <span>🔄</span>
                        <span>Actualizar</span>
                    </button>
                </div>
            </div>

            <div className="px-4 md:px-8 -mt-4 space-y-4">
                {/* Filter Pills - Horizontal Scroll on Mobile */}
                <div className="bg-white rounded-2xl p-3 shadow-sm border border-neutral-100 animate-slide-up">
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                        {filterOptions.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setFilterType(option.value)}
                                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all touch-feedback ${filterType === option.value
                                        ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-md'
                                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                    }`}
                            >
                                <span>{option.icon}</span>
                                <span>{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100 animate-slide-up" style={{ animationDelay: '50ms' }}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">📈</span>
                            <span className="text-sm text-neutral-600">
                                <strong className="text-neutral-800">{actions.length}</strong> acções registadas
                            </span>
                        </div>
                        {actions.length > 0 && (
                            <span className="text-xs text-neutral-500">
                                Última: {formatRelativeTime(actions[0]?.created_at)}
                            </span>
                        )}
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 animate-fade-in">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">⚠️</span>
                            <p className="text-red-800 text-sm flex-1">{error}</p>
                            <button onClick={loadAuditLog} className="text-red-600 font-medium text-sm">Retry</button>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100 animate-pulse">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 bg-neutral-200 rounded-xl"></div>
                                    <div className="flex-1">
                                        <div className="h-4 bg-neutral-200 rounded w-2/3 mb-2"></div>
                                        <div className="h-3 bg-neutral-100 rounded w-1/2"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {/* Mobile Timeline */}
                        <div className="md:hidden space-y-3">
                            {actions.map((action, index) => {
                                const config = getActionConfig(action.action_type)
                                return (
                                    <div
                                        key={action.id}
                                        className="relative bg-white rounded-2xl p-4 shadow-sm border border-neutral-100 animate-slide-up touch-feedback"
                                        style={{ animationDelay: `${index * 30}ms` }}
                                        onClick={() => setSelectedAction(action)}
                                    >
                                        {/* Timeline connector */}
                                        {index < actions.length - 1 && (
                                            <div className="absolute left-7 top-16 bottom-0 w-0.5 bg-neutral-200 -mb-3"></div>
                                        )}

                                        <div className="flex items-start gap-3">
                                            <div className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                                                <span className="text-lg">{config.icon}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-semibold ${config.color}`}>{config.label}</p>
                                                <p className="text-xs text-neutral-500 mt-0.5 truncate">
                                                    {action.action_details?.action || action.action_details?.escola_nome || 'Detalhes...'}
                                                </p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="text-xs text-neutral-400">{formatRelativeTime(action.created_at)}</span>
                                                    {action.ip_address && (
                                                        <span className="text-xs text-neutral-400">• {action.ip_address}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-neutral-400">→</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden animate-slide-up">
                            <div className="overflow-x-auto">
                                <table className="table-excel w-full">
                                    <thead>
                                        <tr>
                                            <th className="text-left">Data/Hora</th>
                                            <th className="text-left">Acção</th>
                                            <th className="text-left">Detalhes</th>
                                            <th className="text-center">IP</th>
                                            <th className="text-right">Ver</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {actions.map((action) => {
                                            const config = getActionConfig(action.action_type)
                                            return (
                                                <tr key={action.id} className="hover:bg-neutral-50 transition-colors">
                                                    <td className="text-left">
                                                        <div className="text-sm text-neutral-800">{formatDate(action.created_at)}</div>
                                                        <div className="text-xs text-neutral-400">{formatRelativeTime(action.created_at)}</div>
                                                    </td>
                                                    <td className="text-left">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center`}>
                                                                <span className="text-sm">{config.icon}</span>
                                                            </span>
                                                            <span className={`font-medium ${config.color}`}>{config.label}</span>
                                                        </div>
                                                    </td>
                                                    <td className="text-left">
                                                        <p className="text-sm text-neutral-600 max-w-xs truncate">
                                                            {action.action_details?.action || action.action_details?.escola_nome || 'N/A'}
                                                        </p>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className="text-xs font-mono text-neutral-500">{action.ip_address || 'N/A'}</span>
                                                    </td>
                                                    <td className="text-right">
                                                        <button
                                                            onClick={() => setSelectedAction(action)}
                                                            className="px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg font-medium transition-colors"
                                                        >
                                                            Detalhes
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {actions.length === 0 && (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 mx-auto mb-4 bg-neutral-100 rounded-full flex items-center justify-center">
                                        <span className="text-3xl">📋</span>
                                    </div>
                                    <p className="text-neutral-700 font-medium">Nenhuma acção registada</p>
                                    <p className="text-neutral-500 text-sm mt-2 max-w-md mx-auto px-4">
                                        As acções do Super Admin (activar/bloquear escolas e direções, licenças, etc.) passam a aparecer aqui após aplicar a migration de auditoria e executar novas operações.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Mobile Empty State */}
                        {actions.length === 0 && !loading && (
                            <div className="md:hidden text-center py-12 bg-white rounded-2xl shadow-sm border border-neutral-100">
                                <div className="w-16 h-16 mx-auto mb-4 bg-neutral-100 rounded-full flex items-center justify-center">
                                    <span className="text-3xl">📋</span>
                                </div>
                                <p className="text-neutral-700 font-medium">Nenhuma acção registada</p>
                                <p className="text-neutral-500 text-sm mt-2 px-6">
                                    Execute uma acção de gestão e actualize esta página.
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Details Modal - Full Screen on Mobile */}
            {selectedAction && (
                <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 animate-fade-in">
                    <div className="bg-white w-full h-full md:h-auto md:max-w-lg md:rounded-2xl md:mx-4 animate-slide-up overflow-y-auto">
                        {/* Mobile header with close */}
                        <div className="sticky top-0 bg-white border-b border-neutral-100 p-4 flex items-center justify-between md:hidden">
                            <h2 className="text-lg font-bold text-neutral-800">Detalhes da Acção</h2>
                            <button
                                onClick={() => setSelectedAction(null)}
                                className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center"
                            >
                                <span className="text-neutral-600">✕</span>
                            </button>
                        </div>

                        <div className="p-6">
                            {/* Desktop close button */}
                            <div className="hidden md:flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-neutral-800">Detalhes da Acção</h2>
                                <button
                                    onClick={() => setSelectedAction(null)}
                                    className="w-8 h-8 text-neutral-400 hover:text-neutral-600 transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Action Type Badge */}
                            {(() => {
                                const config = getActionConfig(selectedAction.action_type)
                                return (
                                    <div className={`inline-flex items-center gap-2 px-4 py-2 ${config.bgColor} ${config.color} rounded-xl font-semibold mb-6`}>
                                        <span className="text-lg">{config.icon}</span>
                                        <span>{config.label}</span>
                                    </div>
                                )
                            })()}

                            <div className="space-y-4">
                                <DetailItem icon="📅" label="Data/Hora" value={formatDate(selectedAction.created_at)} />
                                <DetailItem icon="🌐" label="Endereço IP" value={selectedAction.ip_address || 'N/A'} />
                                <DetailItem icon="💻" label="User Agent" value={selectedAction.user_agent || 'N/A'} multiline />

                                {/* JSON Details */}
                                <div className="bg-neutral-50 rounded-xl p-4">
                                    <p className="text-xs text-neutral-500 font-medium mb-2">📋 Detalhes Completos</p>
                                    <div className="bg-neutral-800 rounded-lg p-4 overflow-x-auto">
                                        <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-words">
                                            {JSON.stringify(selectedAction.action_details, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedAction(null)}
                                className="w-full mt-6 px-4 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-medium hover:bg-neutral-200 transition-all"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Detail Item Component
const DetailItem: React.FC<{ icon: string; label: string; value: string; multiline?: boolean }> = ({ icon, label, value, multiline }) => (
    <div className="flex items-start gap-3 p-3 bg-neutral-50 rounded-xl">
        <span className="text-lg">{icon}</span>
        <div className="flex-1 min-w-0">
            <p className="text-xs text-neutral-500 font-medium">{label}</p>
            <p className={`text-sm text-neutral-800 ${multiline ? 'break-all' : ''}`}>{value}</p>
        </div>
    </div>
)

export default SuperAdminAuditLog
