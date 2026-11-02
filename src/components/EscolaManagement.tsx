/**
 * @component EscolaManagement
 * @description Gestão de escolas moderna mobile-first para SUPERADMIN
 * @tokens [--color-primary, --gradient-primary, --shadow-elevation-2]
 * @responsive true
 * @tested-on [375x667, 768x1024, 1440x900]
 */

import React, { useEffect, useState } from 'react'
import { fetchAllEscolas, activateEscola, deactivateEscola, blockEscola, unblockEscola, deleteEscola, fetchEscolaBackups, restoreEscola } from '../utils/superadmin'
import type { Escola, EscolaBackup } from '../types'

interface EscolaManagementProps {
    initialFilter?: 'all' | 'active' | 'inactive' | 'blocked' | 'attention'
}

export const EscolaManagement: React.FC<EscolaManagementProps> = ({ initialFilter }) => {
    const [escolas, setEscolas] = useState<Escola[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'blocked' | 'attention'>(initialFilter || 'all')
    const [selectedEscola, setSelectedEscola] = useState<Escola | null>(null)
    const [showBlockModal, setShowBlockModal] = useState(false)
    const [blockReason, setBlockReason] = useState('')
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [showDetailsModal, setShowDetailsModal] = useState(false)
    const [detailsEscola, setDetailsEscola] = useState<Escola | null>(null)
    // Delete functionality state
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deleteReason, setDeleteReason] = useState('')
    const [createBackup, setCreateBackup] = useState(true)
    // Backups section state
    const [showBackupsSection, setShowBackupsSection] = useState(false)
    const [backups, setBackups] = useState<EscolaBackup[]>([])
    const [backupsLoading, setBackupsLoading] = useState(false)
    // Custom alert modal state
    const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' }>({
        show: false, title: '', message: '', type: 'error'
    })
    // Restore confirmation modal state
    const [showRestoreModal, setShowRestoreModal] = useState(false)
    const [restoreBackupId, setRestoreBackupId] = useState<string | null>(null)
    const [restoreBackupData, setRestoreBackupData] = useState<EscolaBackup | null>(null)

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'error') => {
        setAlertModal({ show: true, title, message, type })
    }

    const closeAlert = () => {
        setAlertModal({ show: false, title: '', message: '', type: 'error' })
    }

    useEffect(() => {
        loadEscolas()
    }, [filterStatus])

    const loadEscolas = async () => {
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
                // Attention filter: fetch all and filter client-side for inactive OR blocked
                filters.needsAttention = true
            }

            const data = await fetchAllEscolas(filters)
            setEscolas(data)
        } catch (err) {
            console.error('Error loading escolas:', err)
            setError('Erro ao carregar escolas')
        } finally {
            setLoading(false)
        }
    }

    const handleActivate = async (escolaId: string) => {
        setActionLoading(escolaId)
        try {
            await activateEscola(escolaId)
            await loadEscolas()
        } catch (err) {
            showAlert('Erro', 'Erro ao activar escola', 'error')
        } finally {
            setActionLoading(null)
        }
    }

    const handleDeactivate = async (escolaId: string) => {
        setActionLoading(escolaId)
        try {
            await deactivateEscola(escolaId)
            await loadEscolas()
        } catch (err) {
            showAlert('Erro', 'Erro ao desactivar escola', 'error')
        } finally {
            setActionLoading(null)
        }
    }

    const handleBlockClick = (escola: Escola) => {
        setSelectedEscola(escola)
        setShowBlockModal(true)
        setBlockReason('Irregularidades administrativas detectadas. A escola foi temporariamente bloqueada para verificação e regularização da situação.')
    }

    const handleBlockSubmit = async () => {
        if (!selectedEscola || !blockReason.trim()) {
            showAlert('Aviso', 'Por favor, forneça um motivo para o bloqueio', 'warning')
            return
        }

        setActionLoading(selectedEscola.id)
        try {
            await blockEscola(selectedEscola.id, blockReason)
            setShowBlockModal(false)
            setSelectedEscola(null)
            setBlockReason('')
            await loadEscolas()
            showAlert('Sucesso', 'Escola bloqueada com sucesso', 'success')
        } catch (err: any) {
            console.error('❌ Erro ao bloquear escola:', err)
            const errorMessage = err?.message || err?.error?.message || 'Erro desconhecido ao bloquear escola'
            showAlert('Erro ao Bloquear', errorMessage, 'error')
        } finally {
            setActionLoading(null)
        }
    }

    const handleUnblock = async (escolaId: string) => {
        setActionLoading(escolaId)
        try {
            await unblockEscola(escolaId)
            await loadEscolas()
            showAlert('Sucesso', 'Escola desbloqueada com sucesso', 'success')
        } catch (err: any) {
            console.error('❌ Erro ao desbloquear escola:', err)
            const errorMessage = err?.message || err?.error?.message || 'Erro desconhecido ao desbloquear escola'
            showAlert('Erro ao Desbloquear', errorMessage, 'error')
        } finally {
            setActionLoading(null)
        }
    }

    const handleViewDetails = (escola: Escola) => {
        setDetailsEscola(escola)
        setShowDetailsModal(true)
    }

    const handleDeleteClick = (escola: Escola) => {
        setSelectedEscola(escola)
        setShowDeleteModal(true)
        setDeleteReason('Escola encerrada definitivamente por decisão administrativa. Todos os dados serão arquivados conforme política de retenção.')
        setCreateBackup(true)
    }

    const handleDeleteSubmit = async () => {
        if (!selectedEscola || !deleteReason.trim()) {
            showAlert('Aviso', 'Por favor, forneça um motivo para a eliminação', 'warning')
            return
        }

        setActionLoading(selectedEscola.id)
        try {
            const result = await deleteEscola(selectedEscola.id, deleteReason, createBackup)
            if (result.success) {
                setShowDeleteModal(false)
                setSelectedEscola(null)
                setDeleteReason('')
                await loadEscolas()
                showAlert('Sucesso', result.message || 'Escola eliminada com sucesso', 'success')
            } else {
                showAlert('Erro', result.error || 'Erro ao eliminar escola', 'error')
            }
        } catch (err: any) {
            const errorMessage = err?.message || 'Erro ao eliminar escola'
            showAlert('Erro ao Eliminar', errorMessage, 'error')
        } finally {
            setActionLoading(null)
        }
    }

    const loadBackups = async () => {
        setBackupsLoading(true)
        try {
            const data = await fetchEscolaBackups({ limit: 50, includeRestored: false })
            setBackups(data)
        } catch (err) {
            console.error('Error loading backups:', err)
            showAlert('Erro', 'Erro ao carregar backups', 'error')
        } finally {
            setBackupsLoading(false)
        }
    }

    const handleRestoreClick = (backup: EscolaBackup) => {
        setRestoreBackupId(backup.id)
        setRestoreBackupData(backup)
        setShowRestoreModal(true)
    }

    const handleRestoreConfirm = async () => {
        if (!restoreBackupId) return

        setActionLoading(restoreBackupId)
        setShowRestoreModal(false)
        try {
            const result = await restoreEscola(restoreBackupId)
            if (result.success) {
                await loadBackups()
                await loadEscolas()
                showAlert('Sucesso', result.message || 'Escola restaurada com sucesso', 'success')
            } else {
                showAlert('Erro', result.error || 'Erro ao restaurar escola', 'error')
            }
        } catch (err) {
            showAlert('Erro', 'Erro ao restaurar escola', 'error')
        } finally {
            setActionLoading(null)
            setRestoreBackupId(null)
            setRestoreBackupData(null)
        }
    }

    const handleRestoreCancel = () => {
        setShowRestoreModal(false)
        setRestoreBackupId(null)
        setRestoreBackupData(null)
    }

    const toggleBackupsSection = () => {
        const newValue = !showBackupsSection
        setShowBackupsSection(newValue)
        if (newValue && backups.length === 0) {
            loadBackups()
        }
    }

    const filteredEscolas = escolas.filter(escola => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return (
            escola.nome.toLowerCase().includes(query) ||
            escola.codigo_escola.toLowerCase().includes(query) ||
            escola.provincia?.toLowerCase().includes(query) ||
            escola.municipio?.toLowerCase().includes(query)
        )
    })

    // Stats for cards
    const statsCount = {
        total: escolas.length,
        active: escolas.filter(e => e.ativo && !e.bloqueado).length,
        inactive: escolas.filter(e => !e.ativo && !e.bloqueado).length,
        blocked: escolas.filter(e => e.bloqueado).length,
        attention: escolas.filter(e => !e.ativo || e.bloqueado).length
    }

    return (
        <div className="min-h-screen bg-neutral-50 pb-24 md:pb-8">
            {/* Header with Gradient */}
            <div className="bg-gradient-to-r from-primary-700 via-primary-800 to-primary-900 text-white px-4 py-6 md:px-8 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2"></div>
                </div>

                <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="animate-fade-in">
                        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                            <span className="text-3xl">🏫</span>
                            Gestão de Escolas
                        </h1>
                        <p className="text-primary-200 mt-1 text-sm md:text-base">
                            Gerir todas as escolas cadastradas no sistema
                        </p>
                    </div>
                    <div className="flex gap-2 self-start md:self-auto">
                        <button
                            onClick={toggleBackupsSection}
                            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 ${showBackupsSection ? 'bg-white text-primary-800' : 'bg-white/20 hover:bg-white/30 text-white'} rounded-xl font-medium transition-all touch-feedback backdrop-blur-sm`}
                        >
                            <span>📦</span>
                            <span className="hidden md:inline">Backups</span>
                        </button>
                        <button
                            onClick={loadEscolas}
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
                            placeholder="Pesquisar escola..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 border-0 bg-neutral-50 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                        />
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 animate-fade-in">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">⚠️</span>
                            <p className="text-red-800 text-sm flex-1">{error}</p>
                            <button onClick={loadEscolas} className="text-red-600 font-medium text-sm">Retry</button>
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
                            {filteredEscolas.map((escola, index) => (
                                <div
                                    key={escola.id}
                                    className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100 animate-slide-up touch-feedback"
                                    style={{ animationDelay: `${index * 30}ms` }}
                                    onClick={() => handleViewDetails(escola)}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-neutral-800 truncate pr-2">{escola.nome}</p>
                                            <p className="text-xs text-neutral-500 flex items-center gap-1 mt-1">
                                                <span>📍</span>
                                                {escola.provincia}, {escola.municipio}
                                            </p>
                                        </div>
                                        <StatusBadge escola={escola} />
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                                        <span className="text-xs text-neutral-500 font-mono">{escola.codigo_escola}</span>
                                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                            {escola.bloqueado ? (
                                                <>
                                                    <ActionButton
                                                        label="Desbloquear"
                                                        color="green"
                                                        loading={actionLoading === escola.id}
                                                        onClick={() => handleUnblock(escola.id)}
                                                    />
                                                    <ActionButton
                                                        label="Eliminar"
                                                        color="red"
                                                        loading={actionLoading === escola.id}
                                                        onClick={() => handleDeleteClick(escola)}
                                                    />
                                                </>
                                            ) : (
                                                <>
                                                    {escola.ativo ? (
                                                        <ActionButton
                                                            label="Desactivar"
                                                            color="yellow"
                                                            loading={actionLoading === escola.id}
                                                            onClick={() => handleDeactivate(escola.id)}
                                                        />
                                                    ) : (
                                                        <ActionButton
                                                            label="Activar"
                                                            color="green"
                                                            loading={actionLoading === escola.id}
                                                            onClick={() => handleActivate(escola.id)}
                                                        />
                                                    )}
                                                    <ActionButton
                                                        label="Bloquear"
                                                        color="red"
                                                        loading={actionLoading === escola.id}
                                                        onClick={() => handleBlockClick(escola)}
                                                    />
                                                    <ActionButton
                                                        label="Eliminar"
                                                        color="red"
                                                        loading={actionLoading === escola.id}
                                                        onClick={() => handleDeleteClick(escola)}
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
                                            <th className="text-left">Escola</th>
                                            <th className="text-center">Código</th>
                                            <th className="text-left">Localização</th>
                                            <th className="text-center">Estado</th>
                                            <th className="text-right">Acções</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredEscolas.map((escola) => (
                                            <tr key={escola.id} className="hover:bg-neutral-50 transition-colors">
                                                <td className="text-left">
                                                    <div className="font-medium text-neutral-800">{escola.nome}</div>
                                                    <div className="text-xs text-neutral-500">{escola.email}</div>
                                                </td>
                                                <td className="text-center">
                                                    <span className="font-mono text-sm text-neutral-600">{escola.codigo_escola}</span>
                                                </td>
                                                <td className="text-left">
                                                    <div className="text-sm text-neutral-800">{escola.provincia}</div>
                                                    <div className="text-xs text-neutral-500">{escola.municipio}</div>
                                                </td>
                                                <td className="text-center">
                                                    <StatusBadge escola={escola} />
                                                </td>
                                                <td className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <button
                                                            onClick={() => handleViewDetails(escola)}
                                                            className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                                            title="Ver detalhes"
                                                        >
                                                            👁️
                                                        </button>
                                                        {escola.bloqueado ? (
                                                            <>
                                                                <button
                                                                    onClick={() => handleUnblock(escola.id)}
                                                                    disabled={actionLoading === escola.id}
                                                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                                                    title="Desbloquear"
                                                                >
                                                                    {actionLoading === escola.id ? '⏳' : '🔓'}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteClick(escola)}
                                                                    disabled={actionLoading === escola.id}
                                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                                    title="Eliminar"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                {escola.ativo ? (
                                                                    <button
                                                                        onClick={() => handleDeactivate(escola.id)}
                                                                        disabled={actionLoading === escola.id}
                                                                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
                                                                        title="Desactivar"
                                                                    >
                                                                        {actionLoading === escola.id ? '⏳' : '⏸️'}
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleActivate(escola.id)}
                                                                        disabled={actionLoading === escola.id}
                                                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                                                        title="Activar"
                                                                    >
                                                                        {actionLoading === escola.id ? '⏳' : '▶️'}
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleBlockClick(escola)}
                                                                    disabled={actionLoading === escola.id}
                                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                                    title="Bloquear"
                                                                >
                                                                    🚫
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteClick(escola)}
                                                                    disabled={actionLoading === escola.id}
                                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                                    title="Eliminar"
                                                                >
                                                                    🗑️
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
                            {filteredEscolas.length === 0 && (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 mx-auto mb-4 bg-neutral-100 rounded-full flex items-center justify-center">
                                        <span className="text-3xl">🏫</span>
                                    </div>
                                    <p className="text-neutral-500">Nenhuma escola encontrada</p>
                                </div>
                            )}
                        </div>

                        {/* Mobile Empty State */}
                        {filteredEscolas.length === 0 && !loading && (
                            <div className="md:hidden text-center py-12 bg-white rounded-2xl shadow-sm border border-neutral-100">
                                <div className="w-16 h-16 mx-auto mb-4 bg-neutral-100 rounded-full flex items-center justify-center">
                                    <span className="text-3xl">🏫</span>
                                </div>
                                <p className="text-neutral-500">Nenhuma escola encontrada</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Block Modal - Bottom Sheet on Mobile */}
            {showBlockModal && selectedEscola && (
                <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 animate-fade-in">
                    <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-3xl p-6 md:mx-4 animate-slide-up max-h-[90vh] overflow-y-auto">
                        <div className="w-12 h-1 bg-neutral-300 rounded-full mx-auto mb-4 md:hidden" />

                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                                <span className="text-2xl">🚫</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-neutral-800">Bloquear Escola</h2>
                                <p className="text-sm text-neutral-500">{selectedEscola.nome}</p>
                            </div>
                        </div>

                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                            <p className="text-sm text-red-800">
                                ⚠️ Esta acção irá impedir o acesso de todos os utilizadores desta escola ao sistema.
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
                                    setSelectedEscola(null)
                                    setBlockReason('')
                                }}
                                className="flex-1 px-4 py-3 border border-neutral-300 rounded-xl font-medium text-neutral-700 hover:bg-neutral-50 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleBlockSubmit}
                                disabled={actionLoading === selectedEscola.id || !blockReason.trim()}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold disabled:opacity-50 transition-all touch-feedback"
                            >
                                {actionLoading === selectedEscola.id ? 'A bloquear...' : 'Confirmar Bloqueio'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {showDetailsModal && detailsEscola && (
                <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 animate-fade-in">
                    <div className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-3xl p-6 md:mx-4 animate-slide-up max-h-[90vh] overflow-y-auto">
                        <div className="w-12 h-1 bg-neutral-300 rounded-full mx-auto mb-4 md:hidden" />

                        <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center">
                                    <span className="text-3xl">🏫</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-neutral-800">{detailsEscola.nome}</h2>
                                    <p className="text-sm text-neutral-500 font-mono">{detailsEscola.codigo_escola}</p>
                                </div>
                            </div>
                            <StatusBadge escola={detailsEscola} />
                        </div>

                        <div className="space-y-4">
                            <DetailRow icon="📧" label="Email" value={detailsEscola.email || 'N/A'} />
                            <DetailRow icon="📍" label="Localização" value={`${detailsEscola.provincia}, ${detailsEscola.municipio}`} />
                            <DetailRow icon="📞" label="Telefone" value={detailsEscola.telefone || 'N/A'} />
                            <DetailRow icon="🏠" label="Endereço" value={detailsEscola.endereco || 'N/A'} />
                            {detailsEscola.bloqueado && detailsEscola.bloqueado_motivo && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                    <p className="text-xs text-red-600 font-medium mb-1">Motivo do Bloqueio</p>
                                    <p className="text-sm text-red-800">{detailsEscola.bloqueado_motivo}</p>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                setShowDetailsModal(false)
                                setDetailsEscola(null)
                            }}
                            className="w-full mt-6 px-4 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-medium hover:bg-neutral-200 transition-all"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {showDeleteModal && selectedEscola && (
                <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 animate-fade-in">
                    <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-3xl p-6 md:mx-4 animate-slide-up max-h-[90vh] overflow-y-auto">
                        <div className="w-12 h-1 bg-neutral-300 rounded-full mx-auto mb-4 md:hidden" />

                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                                <span className="text-2xl">🗑️</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-neutral-800">Eliminar Escola</h2>
                                <p className="text-sm text-neutral-500">{selectedEscola.nome}</p>
                            </div>
                        </div>

                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                            <p className="text-sm text-red-800 font-medium mb-2">
                                ⚠️ ATENÇÃO: Esta acção é irreversível!
                            </p>
                            <p className="text-xs text-red-700">
                                Serão eliminados permanentemente: a conta do responsável da escola, professores, secretários e demais utilizadores exclusivos desta escola, bem como turmas, alunos, notas, licenças e todos os dados relacionados.
                            </p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-neutral-700 mb-2">
                                Motivo da Eliminação *
                            </label>
                            <textarea
                                value={deleteReason}
                                onChange={(e) => setDeleteReason(e.target.value)}
                                rows={3}
                                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                                placeholder="Descreva o motivo da eliminação..."
                            />
                        </div>

                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={createBackup}
                                    onChange={(e) => setCreateBackup(e.target.checked)}
                                    className="w-5 h-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                    <p className="text-sm font-medium text-blue-800">📦 Criar backup antes de eliminar</p>
                                    <p className="text-xs text-blue-600">Permite restaurar a escola mais tarde se necessário</p>
                                </div>
                            </label>
                        </div>

                        {!createBackup && (
                            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                <p className="text-sm text-amber-800">
                                    ⚠️ Sem backup, não será possível recuperar os dados após a eliminação!
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false)
                                    setSelectedEscola(null)
                                    setDeleteReason('')
                                }}
                                className="flex-1 px-4 py-3 border border-neutral-300 rounded-xl font-medium text-neutral-700 hover:bg-neutral-50 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteSubmit}
                                disabled={actionLoading === selectedEscola.id || !deleteReason.trim()}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold disabled:opacity-50 transition-all touch-feedback"
                            >
                                {actionLoading === selectedEscola.id ? 'A eliminar...' : '🗑️ Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Backups Section */}
            {showBackupsSection && (
                <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 animate-fade-in">
                    <div className="bg-white w-full md:max-w-2xl md:rounded-2xl rounded-t-3xl p-6 md:mx-4 animate-slide-up max-h-[90vh] overflow-y-auto">
                        <div className="w-12 h-1 bg-neutral-300 rounded-full mx-auto mb-4 md:hidden" />

                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                    <span className="text-2xl">📦</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-neutral-800">Backups de Escolas</h2>
                                    <p className="text-sm text-neutral-500">Escolas eliminadas que podem ser restauradas</p>
                                </div>
                            </div>
                            <button
                                onClick={loadBackups}
                                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                            >
                                🔄
                            </button>
                        </div>

                        {backupsLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="bg-neutral-50 rounded-xl p-4 animate-pulse">
                                        <div className="h-5 bg-neutral-200 rounded w-3/4 mb-2"></div>
                                        <div className="h-3 bg-neutral-100 rounded w-1/2"></div>
                                    </div>
                                ))}
                            </div>
                        ) : backups.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 mx-auto mb-4 bg-neutral-100 rounded-full flex items-center justify-center">
                                    <span className="text-3xl">📦</span>
                                </div>
                                <p className="text-neutral-500">Nenhum backup disponível</p>
                                <p className="text-sm text-neutral-400 mt-1">Os backups aparecem quando escolas são eliminadas</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {backups.map((backup) => (
                                    <div key={backup.id} className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="font-semibold text-neutral-800">
                                                    {backup.escola_data.nome}
                                                </p>
                                                <p className="text-xs text-neutral-500 font-mono">
                                                    {backup.escola_data.codigo_escola}
                                                </p>
                                            </div>
                                            <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">
                                                Eliminada
                                            </span>
                                        </div>
                                        <div className="text-sm text-neutral-600 mb-3">
                                            <p><span className="font-medium">Eliminada em:</span> {new Date(backup.deleted_at).toLocaleString('pt-AO')}</p>
                                            <p><span className="font-medium">Motivo:</span> {backup.motivo}</p>
                                            <p className="text-xs text-neutral-400 mt-1">
                                                {backup.related_data.professores?.length || 0} professores, {backup.related_data.turmas?.length || 0} turmas, {backup.related_data.alunos?.length || 0} alunos
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleRestoreClick(backup)}
                                            disabled={actionLoading === backup.id}
                                            className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-medium text-sm disabled:opacity-50 transition-all"
                                        >
                                            {actionLoading === backup.id ? 'A restaurar...' : '♻️ Restaurar Escola'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={() => setShowBackupsSection(false)}
                            className="w-full mt-6 px-4 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-medium hover:bg-neutral-200 transition-all"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}

            {/* Restore Confirmation Modal */}
            {showRestoreModal && restoreBackupData && (
                <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 animate-fade-in">
                    <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-3xl p-6 md:mx-4 animate-slide-up max-h-[90vh] overflow-y-auto">
                        <div className="w-12 h-1 bg-neutral-300 rounded-full mx-auto mb-4 md:hidden" />

                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                                <span className="text-2xl">♻️</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-neutral-800">Restaurar Escola</h2>
                                <p className="text-sm text-neutral-500">{restoreBackupData.escola_data.nome}</p>
                            </div>
                        </div>

                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                            <p className="text-sm text-emerald-800 font-medium mb-2">
                                ♻️ Esta acção irá restaurar a escola e todos os seus dados.
                            </p>
                            <p className="text-xs text-emerald-700">
                                Serão recuperados: {restoreBackupData.related_data.professores?.length || 0} professores, {restoreBackupData.related_data.turmas?.length || 0} turmas e {restoreBackupData.related_data.alunos?.length || 0} alunos.
                            </p>
                        </div>

                        <div className="bg-neutral-50 rounded-xl p-3 mb-4">
                            <p className="text-xs text-neutral-500 mb-1">Código da escola</p>
                            <p className="text-sm font-mono text-neutral-700">{restoreBackupData.escola_data.codigo_escola}</p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleRestoreCancel}
                                className="flex-1 px-4 py-3 border border-neutral-300 rounded-xl font-medium text-neutral-700 hover:bg-neutral-50 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleRestoreConfirm}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold transition-all touch-feedback"
                            >
                                ♻️ Confirmar Restauração
                            </button>
                        </div>
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
const StatusBadge: React.FC<{ escola: Escola }> = ({ escola }) => {
    if (escola.bloqueado) {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                <span>🚫</span> Bloqueada
            </span>
        )
    }
    if (escola.ativo) {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                <span>✅</span> Activa
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
            <span>⏸️</span> Inactiva
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

export default EscolaManagement
