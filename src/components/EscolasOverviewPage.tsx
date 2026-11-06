import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { fetchEscolasDoMunicipio, fetchEscolaStats, updateEscolaInfo } from '../utils/direcaoMunicipal'
import type { Escola, EscolaStats } from '../types'
import { Icons } from './ui/Icons'
import {
    DmPage,
    DmHeader,
    DmContent,
    DmPanel,
    DmSearch,
    DmBadge,
    DmButton,
    DmEmpty,
    DmStatCard,
} from '../modules/municipal_education/components/MunicipalChrome'

interface EscolasOverviewPageProps {
    onNavigate?: (page: string, params?: Record<string, any>) => void
}

export default function EscolasOverviewPage({ onNavigate }: EscolasOverviewPageProps) {
    const { direcaoMunicipalProfile } = useAuth()
    const [loading, setLoading] = useState(true)
    const [escolas, setEscolas] = useState<Escola[]>([])
    const [escolaStats, setEscolaStats] = useState<Record<string, EscolaStats>>({})
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedEscola, setSelectedEscola] = useState<Escola | null>(null)
    const [showEditModal, setShowEditModal] = useState(false)

    const municipio = direcaoMunicipalProfile?.municipio || ''

    useEffect(() => {
        loadEscolas()
    }, [municipio])

    const loadEscolas = async () => {
        if (!municipio) return

        setLoading(true)
        try {
            const escolasData = await fetchEscolasDoMunicipio(municipio)
            setEscolas(escolasData)

            // Load stats for each escola
            const statsMap: Record<string, EscolaStats> = {}
            for (const escola of escolasData) {
                try {
                    const stats = await fetchEscolaStats(escola.id)
                    statsMap[escola.id] = stats
                } catch (err) {
                    console.error(`Error loading stats for escola ${escola.id}:`, err)
                }
            }
            setEscolaStats(statsMap)
        } catch (error) {
            console.error('Error loading escolas:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleEditEscola = (escola: Escola) => {
        setSelectedEscola(escola)
        setShowEditModal(true)
    }

    const handleSaveEscolaEdit = async (updates: Partial<Escola>) => {
        if (!selectedEscola) return

        try {
            await updateEscolaInfo(selectedEscola.id, updates)
            await loadEscolas()
            setShowEditModal(false)
            setSelectedEscola(null)
        } catch (error) {
            console.error('Error updating escola:', error)
            alert('Erro ao atualizar escola. Por favor, tente novamente.')
        }
    }

    const filteredEscolas = escolas.filter(escola =>
        escola.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        escola.codigo_escola?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <DmPage className="pb-24 md:pb-0">
            <DmHeader
                title="Escolas do Município"
                subtitle={`Gestão e supervisão de ${municipio}`}
                icon={<Icons.School className="w-6 h-6" />}
                accent="blue"
                meta={
                    <button
                        type="button"
                        onClick={() => onNavigate?.('dashboard')}
                        className="text-sm text-white/70 hover:text-white transition-colors inline-flex items-center gap-1"
                    >
                        Dashboard <Icons.ChevronRight className="w-3.5 h-3.5" /> Escolas
                    </button>
                }
            />
            <DmContent>
                <div className="flex flex-col lg:flex-row gap-3.5 lg:items-stretch">
                    <div className="flex-1">
                        <DmSearch
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Pesquisar escola por nome ou código..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3 lg:w-64">
                        <DmStatCard
                            title="Total"
                            value={escolas.length}
                            icon={<Icons.School className="w-5 h-5" />}
                            iconTone="from-blue-50 to-blue-100 text-blue-600"
                        />
                        <DmStatCard
                            title="Activas"
                            value={escolas.filter((e) => e.ativo).length}
                            icon={<Icons.CheckCircle className="w-5 h-5" />}
                            iconTone="from-emerald-50 to-emerald-100 text-emerald-600"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16">
                        <Icons.Spinner className="w-8 h-8 text-blue-600" />
                        <p className="text-sm font-medium text-slate-500">A carregar escolas...</p>
                    </div>
                ) : filteredEscolas.length === 0 ? (
                    <DmEmpty
                        title="Nenhuma escola encontrada"
                        description="Ajuste a pesquisa ou verifique se há escolas no município."
                        icon={<Icons.School className="w-8 h-8" />}
                    />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {filteredEscolas.map((escola) => {
                            const stats = escolaStats[escola.id]
                            return (
                                <DmPanel
                                    key={escola.id}
                                    className={`!p-0 overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                                        escola.bloqueado
                                            ? 'border-red-300 bg-red-50/40'
                                            : !escola.ativo
                                              ? 'opacity-80'
                                              : ''
                                    }`}
                                >
                                    <div className="p-4 border-b border-slate-100">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-slate-900 truncate">{escola.nome}</h3>
                                                <p className="text-sm text-slate-500">
                                                    {escola.codigo_escola || 'Sem código'}
                                                </p>
                                            </div>
                                            {escola.bloqueado ? (
                                                <DmBadge tone="danger">Bloqueada</DmBadge>
                                            ) : !escola.ativo ? (
                                                <DmBadge tone="neutral">Inactiva</DmBadge>
                                            ) : (
                                                <DmBadge tone="success">Activa</DmBadge>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-4 grid grid-cols-3 gap-3 text-center bg-slate-50/60">
                                        <div>
                                            <div className="font-bold text-slate-900">{stats?.total_turmas || 0}</div>
                                            <div className="text-xs text-slate-500">Turmas</div>
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900">{stats?.total_alunos || 0}</div>
                                            <div className="text-xs text-slate-500">Alunos</div>
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900">{stats?.total_professores || 0}</div>
                                            <div className="text-xs text-slate-500">Prof.</div>
                                        </div>
                                    </div>
                                    <div className="px-4 py-3 flex items-center justify-between text-sm border-t border-slate-100">
                                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                                            <Icons.BarChart className="w-4 h-4 text-indigo-500" />
                                            Média:{' '}
                                            <strong className="text-indigo-600">
                                                {stats?.media_geral?.toFixed(1) || '0.0'}
                                            </strong>
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                                            <Icons.CheckCircle className="w-4 h-4 text-emerald-500" />
                                            <strong className="text-emerald-600">{stats?.taxa_aprovacao || 0}%</strong>
                                        </span>
                                    </div>
                                    <div className="px-4 pb-4 flex gap-2">
                                        <DmButton
                                            variant="secondary"
                                            className="flex-1 !bg-indigo-50 !text-indigo-700 !border-indigo-100"
                                            onClick={() => handleEditEscola(escola)}
                                            icon={<Icons.Edit className="w-4 h-4" />}
                                        >
                                            Editar
                                        </DmButton>
                                        <DmButton
                                            variant="ghost"
                                            className="flex-1"
                                            onClick={() => onNavigate?.('escola-detail', { escolaId: escola.id })}
                                            icon={<Icons.EyeOpen className="w-4 h-4" />}
                                        >
                                            Detalhes
                                        </DmButton>
                                    </div>
                                </DmPanel>
                            )
                        })}
                    </div>
                )}

                {showEditModal && selectedEscola && (
                    <EscolaEditModal
                        escola={selectedEscola}
                        onClose={() => {
                            setShowEditModal(false)
                            setSelectedEscola(null)
                        }}
                        onSave={handleSaveEscolaEdit}
                    />
                )}
            </DmContent>
        </DmPage>
    )
}

// Escola Edit Modal Component
function EscolaEditModal({
    escola,
    onClose,
    onSave
}: {
    escola: Escola
    onClose: () => void
    onSave: (updates: Partial<Escola>) => Promise<void>
}) {
    const [formData, setFormData] = useState({
        nome: escola.nome,
        email: escola.email || '',
        telefone: escola.telefone || '',
        endereco: escola.endereco || '',
        codigo_escola: escola.codigo_escola || ''
    })
    const [saving, setSaving] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            await onSave(formData)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">
                        ✏️ Editar Escola
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nome da Escola
                        </label>
                        <input
                            type="text"
                            value={formData.nome}
                            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Código da Escola
                        </label>
                        <input
                            type="text"
                            value={formData.codigo_escola}
                            onChange={(e) => setFormData({ ...formData, codigo_escola: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Telefone
                        </label>
                        <input
                            type="tel"
                            value={formData.telefone}
                            onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Endereço
                        </label>
                        <textarea
                            value={formData.endereco}
                            onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {saving ? 'A guardar...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
