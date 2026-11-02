/**
 * @component DirecoesMunicipaisManagement
 * @description Gestão de Direções Municipais moderna mobile-first para SUPERADMIN
 * @tokens [--color-primary, --gradient-primary, --shadow-elevation-2]
 * @responsive true
 */

import React, { useEffect, useState } from 'react'
import {
    fetchAllDirecoesMunicipais,
    activateDirecaoMunicipal,
    deactivateDirecaoMunicipal,
    blockDirecaoMunicipal,
    unblockDirecaoMunicipal,
    type DirecaoMunicipal
} from '../utils/superadmin'

interface DirecoesMunicipaisManagementProps {
    onNavigate?: (page: string) => void
    initialFilter?: 'all' | 'active' | 'inactive' | 'blocked' | 'attention'
}

export const DirecoesMunicipaisManagement: React.FC<DirecoesMunicipaisManagementProps> = ({ onNavigate, initialFilter }) => {
    const [direcoes, setDirecoes] = useState<DirecaoMunicipal[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'blocked' | 'attention'>(initialFilter || 'all')
    const [selectedDirecao, setSelectedDirecao] = useState<DirecaoMunicipal | null>(null)
    const [showBlockModal, setShowBlockModal] = useState(false)
    const [blockReason, setBlockReason] = useState('')
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [showDetailsModal, setShowDetailsModal] = useState(false)
    const [detailsDirecao, setDetailsDirecao] = useState<DirecaoMunicipal | null>(null)

    // Custom alert modal state
    const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' }>({
        show: false, title: '', message: '', type: 'error'
    })

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'error') => {
        setAlertModal({ show: true, title, message, type })
    }

    const closeAlert = () => {
        setAlertModal({ show: false, title: '', message: '', type: 'error' })
    }

    useEffect(() => {
        if (initialFilter && initialFilter !== filterStatus) {
            setFilterStatus(initialFilter)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialFilter])

    useEffect(() => {
        loadDirecoes()
    }, [filterStatus])

    const loadDirecoes = async () => {
        try {
            setLoading(true)
            setError(null)

            const filters: any = {}
            if (filterStatus === 'active') {
                filters.ativo = true
                filters.bloqueado = false
            } else if (filterStatus === 'inactive') {
                filters.ativo = false
                filters.bloqueado = false
            } else if (filterStatus === 'blocked') {
                filters.bloqueado = true
            } else if (filterStatus === 'attention') {
                filters.needsAttention = true
            }

            const data = await fetchAllDirecoesMunicipais(filters)
            setDirecoes(data)
        } catch (err) {
            console.error('Error loading direções:', err)
            setError('Erro ao carregar direções municipais')
        } finally {
            setLoading(false)
        }
    }

    const handleActivate = async (id: string) => {
        setActionLoading(id)
        try {
            await activateDirecaoMunicipal(id)
            await loadDirecoes()
        } catch (err) {
            showAlert('Erro', 'Erro ao activar direção municipal', 'error')
        } finally {
            setActionLoading(null)
        }
    }

    const handleDeactivate = async (id: string) => {
        setActionLoading(id)
        try {
            await deactivateDirecaoMunicipal(id)
            await loadDirecoes()
        } catch (err) {
            showAlert('Erro', 'Erro ao desactivar direção municipal', 'error')
        } finally {
            setActionLoading(null)
        }
    }

    const handleBlockClick = (direcao: DirecaoMunicipal) => {
        setSelectedDirecao(direcao)
        setShowBlockModal(true)
        setBlockReason('Irregularidades administrativas detectadas. Acesso bloqueado temporariamente.')
    }

    const handleBlockSubmit = async () => {
        if (!selectedDirecao || !blockReason.trim()) {
            showAlert('Aviso', 'Por favor, forneça um motivo para o bloqueio', 'warning')
            return
        }

        setActionLoading(selectedDirecao.id)
        try {
            await blockDirecaoMunicipal(selectedDirecao.id, blockReason)
            setShowBlockModal(false)
            setSelectedDirecao(null)
            setBlockReason('')
            await loadDirecoes()
        } catch (err) {
            showAlert('Erro', 'Erro ao bloquear direção municipal', 'error')
        } finally {
            setActionLoading(null)
        }
    }

    const handleUnblock = async (id: string) => {
        setActionLoading(id)
        try {
            await unblockDirecaoMunicipal(id)
            await loadDirecoes()
        } catch (err) {
            showAlert('Erro', 'Erro ao desbloquear direção municipal', 'error')
        } finally {
            setActionLoading(null)
        }
    }

    const handleViewDetails = (direcao: DirecaoMunicipal) => {
        setDetailsDirecao(direcao)
        setShowDetailsModal(true)
    }

    const filteredDirecoes = direcoes.filter(direcao => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return (
            direcao.nome.toLowerCase().includes(query) ||
            direcao.municipio.toLowerCase().includes(query) ||
            direcao.provincia.toLowerCase().includes(query) ||
            direcao.email.toLowerCase().includes(query)
        )
    })

    // Stats for cards
    const statsCount = {
        total: direcoes.length,
        active: direcoes.filter(d => d.ativo && !d.bloqueado).length,
        inactive: direcoes.filter(d => !d.ativo && !d.bloqueado).length,
        blocked: direcoes.filter(d => d.bloqueado).length,
        attention: direcoes.filter(d => !d.ativo || d.bloqueado).length
    }

    return (
        <div className="min-h-screen bg-neutral-50 pb-24 md:pb-8">
            {/* Header with Gradient */}
            <div className="bg-gradient-to-r from-purple-700 via-purple-800 to-indigo-900 text-white px-4 py-6 md:px-8 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2"></div>
                </div>

                <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="animate-fade-in">
                        <div className="flex items-center gap-4">
                            {onNavigate && (
                                <button
                                    onClick={() => onNavigate('dashboard')}
                                    className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                                >
                                    ⬅️
                                </button>
                            )}
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                                    <span className="text-3xl">🏛️</span>
                                    Direções Municipais
                                </h1>
                                <p className="text-purple-200 mt-1 text-sm md:text-base">
                                    Gerir todas as Direções Municipais cadastradas
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2 self-start md:self-auto">
                        <button
                            onClick={loadDirecoes}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl font-medium transition-all touch-feedback backdrop-blur-sm"
                        >
                            <span>🔄</span>
                            <span>Actualizar</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="px-4 md:px-8 -mt-4 space-y-4">
                {/* Mini Stats Cards */}
                <div className="grid grid-cols-5 gap-2 md:gap-3">
                    <MiniStatCard label="Total" value={statsCount.total} color="blue" active={filterStatus === 'all'} onClick={() => setFilterStatus('all')} />
                    <MiniStatCard label="Activas" value={statsCount.active} color="green" active={filterStatus === 'active'} onClick={() => setFilterStatus('active')} />
                    <MiniStatCard label="Inactivas" value={statsCount.inactive} color="yellow" active={filterStatus === 'inactive'} onClick={() => setFilterStatus('inactive')} />
                    <MiniStatCard label="Bloqueadas" value={statsCount.blocked} color="red" active={filterStatus === 'blocked'} onClick={() => setFilterStatus('blocked')} />
                    <MiniStatCard label="Atenção" value={statsCount.attention} color="orange" active={filterStatus === 'attention'} onClick={() => setFilterStatus('attention')} />
                </div>

                {/* Search */}
                <div className="bg-white rounded-2xl p-3 shadow-sm border border-neutral-100 animate-slide-up">
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">🔍</span>
                        <input
                            type="text"
                            placeholder="Pesquisar por nome, município, província..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 border-0 bg-neutral-50 rounded-xl focus:ring-2 focus:ring-purple-500 transition-all text-sm"
                        />
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 animate-fade-in">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">⚠️</span>
                            <p className="text-red-800 text-sm flex-1">{error}</p>
                            <button onClick={loadDirecoes} className="text-red-600 font-medium text-sm">Retry</button>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100 animate-pulse">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="h-5 bg-neutral-200 rounded w-3/4 mb-2"></div>
                                        <div className="h-3 bg-neutral-100 rounded w-1/2"></div>
                                    </div>
                                    <div className="h-6 w-16 bg-neutral-200 rounded-full"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-3">
                            {filteredDirecoes.map((direcao, index) => (
                                <div
                                    key={direcao.id}
                                    className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100 animate-slide-up touch-feedback"
                                    style={{ animationDelay: `${index * 30}ms` }}
                                    onClick={() => handleViewDetails(direcao)}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-neutral-800 truncate pr-2">{direcao.nome}</p>
                                            <p className="text-xs text-neutral-500 flex items-center gap-1 mt-1">
                                                <span>📍</span>
                                                {direcao.municipio}, {direcao.provincia}
                                            </p>
                                        </div>
                                        <StatusBadge direcao={direcao} />
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                                        <span className="text-xs text-neutral-500 font-mono truncate max-w-[120px]">{direcao.email}</span>
                                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                            {direcao.bloqueado ? (
                                                <ActionButton
                                                    label="Desbloquear"
                                                    color="green"
                                                    loading={actionLoading === direcao.id}
                                                    onClick={() => handleUnblock(direcao.id)}
                                                />
                                            ) : (
                                                <>
                                                    {direcao.ativo ? (
                                                        <ActionButton
                                                            label="Desactivar"
                                                            color="yellow"
                                                            loading={actionLoading === direcao.id}
                                                            onClick={() => handleDeactivate(direcao.id)}
                                                        />
                                                    ) : (
                                                        <ActionButton
                                                            label="Activar"
                                                            color="green"
                                                            loading={actionLoading === direcao.id}
                                                            onClick={() => handleActivate(direcao.id)}
                                                        />
                                                    )}
                                                    <ActionButton
                                                        label="Bloquear"
                                                        color="red"
                                                        loading={actionLoading === direcao.id}
                                                        onClick={() => handleBlockClick(direcao)}
                                                    />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden animate-slide-up">
                            <div className="overflow-x-auto">
                                <table className="table-excel w-full">
                                    <thead>
                                        <tr>
                                            <th className="text-left">Direção Municipal</th>
                                            <th className="text-left">Responsável</th>
                                            <th className="text-left">Localização</th>
                                            <th className="text-center">Estado</th>
                                            <th className="text-right">Acções</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredDirecoes.map((direcao) => (
                                            <tr key={direcao.id} className="hover:bg-neutral-50 transition-colors">
                                                <td className="text-left">
                                                    <div className="font-medium text-neutral-800">{direcao.nome}</div>
                                                    <div className="text-xs text-neutral-500">{direcao.email}</div>
                                                </td>
                                                <td className="text-left">
                                                    <div className="text-sm text-neutral-800">{direcao.cargo}</div>
                                                    <div className="text-xs text-neutral-500 break-all">{direcao.telefone || 'Sem telefone'}</div>
                                                </td>
                                                <td className="text-left">
                                                    <div className="text-sm text-neutral-800">{direcao.municipio}</div>
                                                    <div className="text-xs text-neutral-500">{direcao.provincia}</div>
                                                </td>
                                                <td className="text-center">
                                                    <StatusBadge direcao={direcao} />
                                                </td>
                                                <td className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <button
                                                            onClick={() => handleViewDetails(direcao)}
                                                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                            title="Ver detalhes"
                                                        >
                                                            👁️
                                                        </button>
                                                        {direcao.bloqueado ? (
                                                            <button
                                                                onClick={() => handleUnblock(direcao.id)}
                                                                disabled={actionLoading === direcao.id}
                                                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                                                title="Desbloquear"
                                                            >
                                                                {actionLoading === direcao.id ? '⏳' : '🔓'}
                                                            </button>
                                                        ) : (
                                                            <>
                                                                {direcao.ativo ? (
                                                                    <button
                                                                        onClick={() => handleDeactivate(direcao.id)}
                                                                        disabled={actionLoading === direcao.id}
                                                                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
                                                                        title="Desactivar"
                                                                    >
                                                                        {actionLoading === direcao.id ? '⏳' : '⏸️'}
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleActivate(direcao.id)}
                                                                        disabled={actionLoading === direcao.id}
                                                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                                                        title="Activar"
                                                                    >
                                                                        {actionLoading === direcao.id ? '⏳' : '▶️'}
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleBlockClick(direcao)}
                                                                    disabled={actionLoading === direcao.id}
                                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                                    title="Bloquear"
                                                                >
                                                                    🚫
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {filteredDirecoes.length === 0 && (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 mx-auto mb-4 bg-neutral-100 rounded-full flex items-center justify-center">
                                        <span className="text-3xl">🏛️</span>
                                    </div>
                                    <p className="text-neutral-500">Nenhuma direção municipal encontrada</p>
                                </div>
                            )}
                        </div>

                        {/* Mobile Empty State */}
                        {filteredDirecoes.length === 0 && !loading && (
                            <div className="md:hidden text-center py-12 bg-white rounded-2xl shadow-sm border border-neutral-100">
                                <div className="w-16 h-16 mx-auto mb-4 bg-neutral-100 rounded-full flex items-center justify-center">
                                    <span className="text-3xl">🏛️</span>
                                </div>
                                <p className="text-neutral-500">Nenhuma direção municipal encontrada</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Block Modal - Bottom Sheet on Mobile */}
            {showBlockModal && selectedDirecao && (
                <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 animate-fade-in">
                    <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-3xl p-6 md:mx-4 animate-slide-up max-h-[90vh] overflow-y-auto">
                        <div className="w-12 h-1 bg-neutral-300 rounded-full mx-auto mb-4 md:hidden" />

                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                                <span className="text-2xl">🚫</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-neutral-800">Bloquear Direção Municipal</h2>
                                <p className="text-sm text-neutral-500">{selectedDirecao.nome}</p>
                            </div>
                        </div>

                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                            <p className="text-sm text-red-800">
                                ⚠️ Esta acção irá impedir o acesso da Direção Municipal ao sistema.
                            </p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-neutral-700 mb-2">
                                Motivo do Bloqueio *
                            </label>
                            <textarea
                                value={blockReason}
                                onChange={(e) => setBlockReason(e.target.value)}
                                rows={3}
                                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                                placeholder="Descreva o motivo do bloqueio..."
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowBlockModal(false)
                                    setSelectedDirecao(null)
                                    setBlockReason('')
                                }}
                                className="flex-1 px-4 py-3 border border-neutral-300 rounded-xl font-medium text-neutral-700 hover:bg-neutral-50 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleBlockSubmit}
                                disabled={actionLoading === selectedDirecao.id || !blockReason.trim()}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold disabled:opacity-50 transition-all touch-feedback"
                            >
                                {actionLoading === selectedDirecao.id ? 'A bloquear...' : 'Confirmar Bloqueio'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {showDetailsModal && detailsDirecao && (
                <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 animate-fade-in">
                    <div className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-3xl p-6 md:mx-4 animate-slide-up max-h-[90vh] overflow-y-auto">
                        <div className="w-12 h-1 bg-neutral-300 rounded-full mx-auto mb-4 md:hidden" />

                        <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center">
                                    <span className="text-3xl">🏛️</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-neutral-800">{detailsDirecao.nome}</h2>
                                    <p className="text-sm text-neutral-500 font-mono">{detailsDirecao.municipio} - {detailsDirecao.provincia}</p>
                                </div>
                            </div>
                            <StatusBadge direcao={detailsDirecao} />
                        </div>

                        <div className="space-y-4">
                            <DetailRow icon="📧" label="Email" value={detailsDirecao.email || 'N/A'} />
                            <DetailRow icon="👤" label="Cargo" value={detailsDirecao.cargo || 'N/A'} />
                            <DetailRow icon="📞" label="Telefone" value={detailsDirecao.telefone || 'N/A'} />
                            <DetailRow icon="🆔" label="Nº Funcionário" value={detailsDirecao.numero_funcionario || 'N/A'} />
                            <DetailRow icon="📅" label="Registado em" value={new Date(detailsDirecao.created_at).toLocaleDateString('pt-AO')} />

                            {detailsDirecao.bloqueado && detailsDirecao.bloqueado_motivo && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                    <p className="text-xs text-red-600 font-medium mb-1">Motivo do Bloqueio</p>
                                    <p className="text-sm text-red-800">{detailsDirecao.bloqueado_motivo}</p>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                setShowDetailsModal(false)
                                setDetailsDirecao(null)
                            }}
                            className="w-full mt-6 px-4 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-medium hover:bg-neutral-200 transition-all"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}

            {/* Custom Alert Modal */}
            {alertModal.show && (
                <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[60] animate-fade-in">
                    <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-3xl p-6 md:mx-4 animate-slide-up">
                        <div className="w-12 h-1 bg-neutral-300 rounded-full mx-auto mb-4 md:hidden" />

                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${alertModal.type === 'success' ? 'bg-emerald-100' :
                                alertModal.type === 'warning' ? 'bg-amber-100' : 'bg-red-100'
                                }`}>
                                <span className="text-2xl">
                                    {alertModal.type === 'success' ? '✅' :
                                        alertModal.type === 'warning' ? '⚠️' : '❌'}
                                </span>
                            </div>
                            <div>
                                <h2 className={`text-xl font-bold ${alertModal.type === 'success' ? 'text-emerald-800' :
                                    alertModal.type === 'warning' ? 'text-amber-800' : 'text-red-800'
                                    }`}>
                                    {alertModal.title}
                                </h2>
                            </div>
                        </div>

                        <div className={`rounded-xl p-4 mb-6 ${alertModal.type === 'success' ? 'bg-emerald-50 border border-emerald-200' :
                            alertModal.type === 'warning' ? 'bg-amber-50 border border-amber-200' :
                                'bg-red-50 border border-red-200'
                            }`}>
                            <p className={`text-sm ${alertModal.type === 'success' ? 'text-emerald-800' :
                                alertModal.type === 'warning' ? 'text-amber-800' : 'text-red-800'
                                }`}>
                                {alertModal.message}
                            </p>
                        </div>

                        <button
                            onClick={closeAlert}
                            className={`w-full px-4 py-3 rounded-xl font-semibold transition-all touch-feedback ${alertModal.type === 'success'
                                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white' :
                                alertModal.type === 'warning'
                                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white' :
                                    'bg-gradient-to-r from-red-500 to-red-600 text-white'
                                }`}
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// Mini Stat Card Component
interface MiniStatCardProps {
    label: string
    value: number
    color: 'blue' | 'green' | 'yellow' | 'red' | 'orange'
    active: boolean
    onClick: () => void
}

const MiniStatCard: React.FC<MiniStatCardProps> = ({ label, value, color, active, onClick }) => {
    const colorMap = {
        blue: { bg: 'bg-blue-500', activeBg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-200' },
        green: { bg: 'bg-emerald-500', activeBg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-200' },
        yellow: { bg: 'bg-amber-500', activeBg: 'bg-amber-600', text: 'text-amber-600', border: 'border-amber-200' },
        red: { bg: 'bg-red-500', activeBg: 'bg-red-600', text: 'text-red-600', border: 'border-red-200' },
        orange: { bg: 'bg-orange-500', activeBg: 'bg-orange-600', text: 'text-orange-600', border: 'border-orange-200' }
    }

    const colors = colorMap[color]

    return (
        <button
            onClick={onClick}
            className={`p-3 rounded-2xl transition-all touch-feedback ${active
                ? `${colors.activeBg} text-white shadow-lg`
                : `bg-white border-2 ${colors.border} hover:shadow-md`
                }`}
        >
            <p className={`text-xl md:text-2xl font-bold ${active ? 'text-white' : colors.text}`}>
                {value}
            </p>
            <p className={`text-xs font-medium ${active ? 'text-white/80' : 'text-neutral-500'}`}>
                {label}
            </p>
        </button>
    )
}

// Status Badge Component
const StatusBadge: React.FC<{ direcao: DirecaoMunicipal }> = ({ direcao }) => {
    if (direcao.bloqueado) {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                <span>🚫</span> Bloqueada
            </span>
        )
    }
    if (direcao.ativo) {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                <span>✅</span> Activa
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
            <span>⏸️</span> Pendente/Inactiva
        </span>
    )
}

// Action Button Component for mobile
interface ActionButtonProps {
    label: string
    color: 'green' | 'yellow' | 'red'
    loading: boolean
    onClick: () => void
}

const ActionButton: React.FC<ActionButtonProps> = ({ label, color, loading, onClick }) => {
    const colorMap = {
        green: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100',
        yellow: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
        red: 'bg-red-50 text-red-600 hover:bg-red-100'
    }

    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors touch-feedback disabled:opacity-50 ${colorMap[color]}`}
        >
            {loading ? '...' : label}
        </button>
    )
}

// Detail Row Component
const DetailRow: React.FC<{ icon: string; label: string; value: string }> = ({ icon, label, value }) => (
    <div className="flex items-start gap-3 p-3 bg-neutral-50 rounded-xl">
        <span className="text-lg">{icon}</span>
        <div className="flex-1 min-w-0">
            <p className="text-xs text-neutral-500 font-medium">{label}</p>
            <p className="text-sm text-neutral-800 break-words">{value}</p>
        </div>
    </div>
)

export default DirecoesMunicipaisManagement
