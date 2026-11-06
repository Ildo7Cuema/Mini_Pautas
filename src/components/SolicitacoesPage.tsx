import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { fetchSolicitacoes, fetchSolicitacaoStats, updateSolicitacaoStatus } from '../utils/direcaoMunicipal'
import { getEstadoLabel, formatDataSolicitacao } from '../utils/solicitacoes'
import { generatePDF, defaultTemplate, fetchEmployeeDataForDocument, type DocumentData } from '../utils/documentGenerator'
import { createNotification } from '../utils/notificationApi'
import { supabase } from '../lib/supabaseClient'
import type { SolicitacaoDocumento, SolicitacaoStats, EstadoSolicitacao } from '../types'
import { Icons } from './ui/Icons'
import {
    DmPage,
    DmHeader,
    DmContent,
} from '../modules/municipal_education/components/MunicipalChrome'

interface SolicitacoesPageProps {
    onNavigate?: (page: string, params?: Record<string, any>) => void
}

export default function SolicitacoesPage({ onNavigate }: SolicitacoesPageProps) {
    const { direcaoMunicipalProfile } = useAuth()
    const [loading, setLoading] = useState(true)
    const [solicitacoes, setSolicitacoes] = useState<SolicitacaoDocumento[]>([])
    const [stats, setStats] = useState<SolicitacaoStats | null>(null)
    const [selectedSolicitacao, setSelectedSolicitacao] = useState<SolicitacaoDocumento | null>(null)
    const [showDetailModal, setShowDetailModal] = useState(false)

    // Filters
    const [filterEstado, setFilterEstado] = useState<EstadoSolicitacao | 'all'>('all')
    const [filterUrgente, setFilterUrgente] = useState<boolean | 'all'>('all')
    const [searchQuery, setSearchQuery] = useState('')

    const municipio = direcaoMunicipalProfile?.municipio || ''

    useEffect(() => {
        loadData()
    }, [municipio])

    const loadData = async () => {
        if (!municipio) return

        setLoading(true)
        try {
            const [solData, statsData] = await Promise.all([
                fetchSolicitacoes(),
                fetchSolicitacaoStats()
            ])

            setSolicitacoes(solData)
            setStats(statsData)
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleOpenDetail = (sol: SolicitacaoDocumento) => {
        setSelectedSolicitacao(sol)
        setShowDetailModal(true)
    }

    const handleUpdateStatus = async (solicitacaoId: string, estado: EstadoSolicitacao, resposta?: string) => {
        try {
            let finalEstado = estado
            let finalResposta = resposta

            // If approving, generate document and mark as concluded
            if (estado === 'aprovado') {
                const solicitacao = solicitacoes.find(s => s.id === solicitacaoId)

                if (solicitacao) {
                    // Fetch complete employee data from database
                    const employeeData = await fetchEmployeeDataForDocument(
                        solicitacao.solicitante_user_id,
                        solicitacao.solicitante_tipo as 'PROFESSOR' | 'SECRETARIO' | 'ESCOLA',
                        solicitacao.escola_id
                    )

                    if (employeeData) {
                        // Build the complete document data object
                        const docData: DocumentData = {
                            funcionario: employeeData,
                            documento: {
                                tipo: solicitacao.tipo_documento?.nome || solicitacao.assunto,
                                assunto: solicitacao.assunto,
                                data_solicitacao: solicitacao.created_at,
                                numero_protocolo: solicitacao.id.slice(0, 8).toUpperCase()
                            },
                            direcao: {
                                municipio: municipio,
                                provincia: direcaoMunicipalProfile?.provincia || '',
                                director_nome: direcaoMunicipalProfile?.nome || "Director Municipal"
                            }
                        }

                        // Try to fetch custom template for this document type
                        let templateToUse = defaultTemplate
                        if (solicitacao.tipo_documento_id) {
                            const { data: customTemplate } = await supabase
                                .from('modelos_documento')
                                .select('*')
                                .eq('municipio', municipio)
                                .eq('tipo_documento_id', solicitacao.tipo_documento_id)
                                .eq('ativo', true)
                                .single()

                            if (customTemplate) {
                                templateToUse = {
                                    conteudo_html: customTemplate.conteudo_html,
                                    cabecalho: customTemplate.cabecalho_config,
                                    rodape: customTemplate.rodape_config
                                }
                            }
                        }

                        // Generate the PDF
                        const pdfBlob = await generatePDF(docData, templateToUse)

                        // Download the generated PDF
                        const url = URL.createObjectURL(pdfBlob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `${solicitacao.tipo_documento?.nome || 'Documento'}_${employeeData.nome}.pdf`
                        document.body.appendChild(a)
                        a.click()
                        document.body.removeChild(a)
                        URL.revokeObjectURL(url)

                        // Mark as concluded since document was generated
                        finalEstado = 'concluido'
                        finalResposta = resposta ? `${resposta}\n\nDocumento gerado com sucesso.` : "Documento gerado com sucesso e emitido."
                    } else {
                        throw new Error('Não foi possível obter os dados do funcionário.')
                    }
                }
            }

            await updateSolicitacaoStatus(solicitacaoId, finalEstado, finalResposta)

            // Send notification to the employee who requested the document
            const solicitacao = solicitacoes.find(s => s.id === solicitacaoId)
            if (solicitacao?.solicitante_user_id) {
                const estadoLabels: Record<string, { emoji: string; titulo: string; mensagem: string }> = {
                    'em_analise': {
                        emoji: '🔍',
                        titulo: 'Solicitação em Análise',
                        mensagem: `A sua solicitação de "${solicitacao.tipo_documento?.nome || solicitacao.assunto}" está a ser analisada pela Direcção Municipal.`
                    },
                    'pendente_info': {
                        emoji: '⚠️',
                        titulo: 'Informação Adicional Necessária',
                        mensagem: `A Direcção Municipal precisa de informações adicionais sobre a sua solicitação de "${solicitacao.tipo_documento?.nome || solicitacao.assunto}".`
                    },
                    'aprovado': {
                        emoji: '✅',
                        titulo: 'Solicitação Aprovada',
                        mensagem: `A sua solicitação de "${solicitacao.tipo_documento?.nome || solicitacao.assunto}" foi aprovada!`
                    },
                    'concluido': {
                        emoji: '📄',
                        titulo: 'Documento Emitido',
                        mensagem: `O seu documento "${solicitacao.tipo_documento?.nome || solicitacao.assunto}" foi gerado e está pronto!`
                    },
                    'rejeitado': {
                        emoji: '❌',
                        titulo: 'Solicitação Rejeitada',
                        mensagem: `Lamentamos, a sua solicitação de "${solicitacao.tipo_documento?.nome || solicitacao.assunto}" foi rejeitada.${finalResposta ? ` Motivo: ${finalResposta}` : ''}`
                    }
                }

                const notifConfig = estadoLabels[finalEstado]
                if (notifConfig) {
                    await createNotification(
                        solicitacao.solicitante_user_id,
                        'documento_status',
                        `${notifConfig.emoji} ${notifConfig.titulo}`,
                        notifConfig.mensagem
                    )
                }
            }

            await loadData()
            setShowDetailModal(false)
            setSelectedSolicitacao(null)
        } catch (error) {
            console.error('Error updating status:', error)
            alert('Erro ao atualizar solicitação: ' + (error instanceof Error ? error.message : 'Erro desconhecido'))
        }
    }

    // State for printing
    const [printingId, setPrintingId] = useState<string | null>(null)

    // Handle Print Document - generates and opens PDF for printing
    const handlePrintDocument = async (sol: SolicitacaoDocumento) => {
        setPrintingId(sol.id)
        try {
            // Fetch complete employee data from database
            const employeeData = await fetchEmployeeDataForDocument(
                sol.solicitante_user_id,
                sol.solicitante_tipo as 'PROFESSOR' | 'SECRETARIO' | 'ESCOLA',
                sol.escola_id
            )

            if (!employeeData) {
                alert('Não foi possível obter os dados do funcionário.')
                return
            }

            // Build the complete document data object
            const docData: DocumentData = {
                funcionario: employeeData,
                documento: {
                    tipo: sol.tipo_documento?.nome || sol.assunto,
                    assunto: sol.assunto,
                    data_solicitacao: sol.created_at,
                    numero_protocolo: sol.id.slice(0, 8).toUpperCase()
                },
                direcao: {
                    municipio: municipio,
                    provincia: direcaoMunicipalProfile?.provincia || '',
                    director_nome: direcaoMunicipalProfile?.nome || "Director Municipal"
                }
            }

            // Try to fetch custom template for this document type
            let templateToUse = defaultTemplate
            if (sol.tipo_documento_id) {
                const { data: customTemplate } = await supabase
                    .from('modelos_documento')
                    .select('*')
                    .eq('municipio', municipio)
                    .eq('tipo_documento_id', sol.tipo_documento_id)
                    .eq('ativo', true)
                    .single()

                if (customTemplate) {
                    templateToUse = {
                        conteudo_html: customTemplate.conteudo_html,
                        cabecalho: customTemplate.cabecalho_config,
                        rodape: customTemplate.rodape_config
                    }
                }
            }

            // Generate the PDF
            const pdfBlob = await generatePDF(docData, templateToUse)

            // Open PDF in a new window for printing
            const pdfUrl = URL.createObjectURL(pdfBlob)
            const printWindow = window.open(pdfUrl, '_blank')

            if (printWindow) {
                printWindow.onload = () => {
                    printWindow.focus()
                    // Small delay to ensure PDF is fully loaded
                    setTimeout(() => {
                        printWindow.print()
                    }, 500)
                }
            } else {
                // Fallback: download the PDF if popup is blocked
                const a = document.createElement('a')
                a.href = pdfUrl
                a.download = `${sol.tipo_documento?.nome || 'Documento'}_${employeeData.nome}.pdf`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
            }

            // Clean up URL after a delay
            setTimeout(() => URL.revokeObjectURL(pdfUrl), 10000)
        } catch (error) {
            console.error('Error printing document:', error)
            alert('Erro ao gerar documento para impressão: ' + (error instanceof Error ? error.message : 'Erro desconhecido'))
        } finally {
            setPrintingId(null)
        }
    }

    // Filter solicitações
    const filteredSolicitacoes = solicitacoes.filter(sol => {
        if (filterEstado !== 'all' && sol.estado !== filterEstado) return false
        if (filterUrgente !== 'all' && sol.urgente !== filterUrgente) return false
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            return (
                sol.assunto.toLowerCase().includes(query) ||
                sol.solicitante_nome?.toLowerCase().includes(query) ||
                sol.escola?.nome?.toLowerCase().includes(query)
            )
        }
        return true
    })

    return (
        <DmPage className="pb-24 md:pb-0">
            <DmHeader
                title="Solicitações de Documentos"
                subtitle="Gestão de pedidos de funcionários e professores"
                icon={<Icons.ClipboardList className="w-6 h-6" />}
                accent="amber"
                meta={
                    <button
                        type="button"
                        onClick={() => onNavigate?.('dashboard')}
                        className="text-sm text-white/70 hover:text-white transition-colors inline-flex items-center gap-1"
                    >
                        Dashboard <Icons.ChevronRight className="w-3.5 h-3.5" /> Solicitações
                    </button>
                }
            />
            <DmContent className="space-y-5">
            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
                    <StatBadge
                        label="Total"
                        value={stats.total}
                        color="gray"
                        active={filterEstado === 'all'}
                        onClick={() => setFilterEstado('all')}
                    />
                    <StatBadge
                        label="Pendentes"
                        value={stats.pendentes}
                        color="yellow"
                        active={filterEstado === 'pendente'}
                        onClick={() => setFilterEstado('pendente')}
                    />
                    <StatBadge
                        label="Em Análise"
                        value={stats.em_analise}
                        color="blue"
                        active={filterEstado === 'em_analise'}
                        onClick={() => setFilterEstado('em_analise')}
                    />
                    <StatBadge
                        label="Aprovadas"
                        value={stats.aprovadas}
                        color="green"
                        active={filterEstado === 'aprovado'}
                        onClick={() => setFilterEstado('aprovado')}
                    />
                    <StatBadge
                        label="Rejeitadas"
                        value={stats.rejeitadas}
                        color="red"
                        active={filterEstado === 'rejeitado'}
                        onClick={() => setFilterEstado('rejeitado')}
                    />
                    <StatBadge
                        label="Concluídas"
                        value={stats.concluidas}
                        color="purple"
                        active={filterEstado === 'concluido'}
                        onClick={() => setFilterEstado('concluido')}
                    />
                </div>
            )}

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Pesquisar por assunto, solicitante ou escola..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-shadow hover:shadow-md"
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                            🔍
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => setFilterUrgente(filterUrgente === true ? 'all' : true)}
                    className={`px-5 py-3 rounded-xl border-2 font-medium transition-all duration-200 flex items-center gap-2 ${filterUrgente === true
                        ? 'bg-red-100 border-red-400 text-red-700 shadow-md'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-red-300 hover:bg-red-50'
                        }`}
                >
                    <span className={`w-2 h-2 rounded-full ${filterUrgente === true ? 'bg-red-500 animate-pulse' : 'bg-red-400'}`}></span>
                    Urgentes
                </button>
                <button
                    onClick={() => loadData()}
                    className="px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2"
                    title="Actualizar lista"
                >
                    🔄
                </button>
                <button
                    onClick={() => onNavigate?.('config-documentos')}
                    className="px-5 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2 shadow-sm"
                >
                    ⚙️ Configurar Modelos
                </button>
            </div>

            {/* Solicitações List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : filteredSolicitacoes.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                    <span className="text-6xl block mb-4">📋</span>
                    <p>Nenhuma solicitação encontrada</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                                        Solicitação
                                    </th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                                        Solicitante
                                    </th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                                        Escola
                                    </th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                                        Estado
                                    </th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                                        Data
                                    </th>
                                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                                        Acções
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredSolicitacoes.map((sol) => {
                                    const estadoInfo = getEstadoLabel(sol.estado)
                                    return (
                                        <tr key={sol.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-2">
                                                    {sol.urgente && (
                                                        <span className="text-red-500">🔴</span>
                                                    )}
                                                    <div>
                                                        <div className="font-medium text-gray-900">
                                                            {sol.assunto}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {sol.tipo_documento?.nome}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm">
                                                    <div className="font-medium text-gray-900">
                                                        {sol.solicitante_nome}
                                                    </div>
                                                    <div className="text-gray-500">
                                                        {sol.solicitante_tipo}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-gray-600">
                                                {sol.escola?.nome || '-'}
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`text-xs px-2 py-1 rounded-full ${estadoInfo.bgColor} ${estadoInfo.color}`}>
                                                    {estadoInfo.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-gray-500">
                                                {formatDataSolicitacao(sol.created_at)}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {/* Print button - only for approved or concluded requests */}
                                                    {(sol.estado === 'aprovado' || sol.estado === 'concluido') && (
                                                        <button
                                                            onClick={() => handlePrintDocument(sol)}
                                                            disabled={printingId === sol.id}
                                                            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
                                                            title="Imprimir Documento"
                                                        >
                                                            {printingId === sol.id ? (
                                                                <>
                                                                    <span className="animate-spin">⏳</span>
                                                                    A gerar...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    🖨️ Imprimir
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleOpenDetail(sol)}
                                                        className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                                                    >
                                                        Ver Detalhes
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetailModal && selectedSolicitacao && (
                <SolicitacaoDetailModal
                    solicitacao={selectedSolicitacao}
                    onClose={() => {
                        setShowDetailModal(false)
                        setSelectedSolicitacao(null)
                    }}
                    onUpdateStatus={handleUpdateStatus}
                />
            )}
            </DmContent>
        </DmPage>
    )
}

// Stat Badge Component - Modern Design
function StatBadge({
    label,
    value,
    color,
    active,
    onClick
}: {
    label: string
    value: number
    color: 'gray' | 'yellow' | 'blue' | 'green' | 'red' | 'purple'
    active: boolean
    onClick: () => void
}) {
    const activeColors = {
        gray: 'bg-gradient-to-br from-slate-500 to-slate-600 text-white shadow-lg',
        yellow: 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-lg',
        blue: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg',
        green: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg',
        red: 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg',
        purple: 'bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg'
    }

    const inactiveColors = {
        gray: 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300',
        yellow: 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-300',
        blue: 'bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-300',
        green: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300',
        red: 'bg-red-50 text-red-700 border-red-200 hover:border-red-300',
        purple: 'bg-purple-50 text-purple-700 border-purple-200 hover:border-purple-300'
    }

    return (
        <button
            onClick={onClick}
            className={`p-3 rounded-xl border-2 text-center transition-all duration-200 transform hover:scale-105 ${active
                ? activeColors[color]
                : `${inactiveColors[color]} bg-white`
                }`}
        >
            <div className="text-xl md:text-2xl font-bold">{value}</div>
            <div className="text-xs font-medium opacity-80">{label}</div>
        </button>
    )
}

// Solicitação Detail Modal
function SolicitacaoDetailModal({
    solicitacao,
    onClose,
    onUpdateStatus
}: {
    solicitacao: SolicitacaoDocumento
    onClose: () => void
    onUpdateStatus: (id: string, estado: EstadoSolicitacao, resposta?: string) => Promise<void>
}) {
    const [resposta, setResposta] = useState(solicitacao.resposta_direcao || '')
    const [processing, setProcessing] = useState(false)
    const estadoInfo = getEstadoLabel(solicitacao.estado)

    const handleAction = async (estado: EstadoSolicitacao) => {
        setProcessing(true)
        try {
            await onUpdateStatus(solicitacao.id, estado, resposta)
        } finally {
            setProcessing(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
                {/* Loading Overlay */}
                {processing && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-2xl">
                        <div className="flex flex-col items-center gap-3">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                            <p className="text-sm text-gray-600 font-medium">A processar...</p>
                        </div>
                    </div>
                )}
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
                    <div className="flex items-center gap-3">
                        {solicitacao.urgente && <span className="text-red-500">🔴</span>}
                        <h2 className="text-lg font-semibold text-gray-900">
                            {solicitacao.assunto}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Status */}
                    <div className="flex items-center gap-3">
                        <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${estadoInfo.bgColor} ${estadoInfo.color}`}>
                            {estadoInfo.label}
                        </span>
                        <span className="text-sm text-gray-500">
                            Criado em {formatDataSolicitacao(solicitacao.created_at)}
                        </span>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Tipo de Documento</div>
                            <div className="font-medium text-gray-900">
                                {solicitacao.tipo_documento?.nome || '-'}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Solicitante</div>
                            <div className="font-medium text-gray-900">
                                {solicitacao.solicitante_nome}
                                <span className="text-sm text-gray-500 ml-2">
                                    ({solicitacao.solicitante_tipo})
                                </span>
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Escola</div>
                            <div className="font-medium text-gray-900">
                                {solicitacao.escola?.nome || '-'}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Prazo Estimado</div>
                            <div className="font-medium text-gray-900">
                                {solicitacao.tipo_documento?.prazo_dias || 5} dias
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    {solicitacao.descricao && (
                        <div>
                            <div className="text-sm text-gray-500 mb-2">Descrição</div>
                            <div className="bg-gray-50 rounded-lg p-4 text-gray-700">
                                {solicitacao.descricao}
                            </div>
                        </div>
                    )}

                    {/* Response */}
                    <div>
                        <div className="text-sm text-gray-500 mb-2">Resposta da Direção</div>
                        <textarea
                            value={resposta}
                            onChange={(e) => setResposta(e.target.value)}
                            placeholder="Escreva uma resposta ou observação..."
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                    </div>

                    {/* Actions */}
                    {solicitacao.estado !== 'concluido' && solicitacao.estado !== 'rejeitado' && (
                        <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                            {solicitacao.estado === 'pendente' && (
                                <button
                                    onClick={() => handleAction('em_analise')}
                                    disabled={processing}
                                    className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium disabled:opacity-50"
                                >
                                    🔍 Marcar Em Análise
                                </button>
                            )}
                            {(solicitacao.estado === 'pendente' || solicitacao.estado === 'em_analise') && (
                                <>
                                    <button
                                        onClick={() => handleAction('pendente_info')}
                                        disabled={processing}
                                        className="px-4 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors font-medium disabled:opacity-50"
                                    >
                                        ⚠️ Pedir Info
                                    </button>
                                    <button
                                        onClick={() => handleAction('aprovado')}
                                        disabled={processing}
                                        className="px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium disabled:opacity-50"
                                    >
                                        ✅ Aprovar
                                    </button>
                                    <button
                                        onClick={() => handleAction('rejeitado')}
                                        disabled={processing}
                                        className="px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors font-medium disabled:opacity-50"
                                    >
                                        ❌ Rejeitar
                                    </button>
                                </>
                            )}
                            {solicitacao.estado === 'aprovado' && (
                                <button
                                    onClick={() => handleAction('concluido')}
                                    disabled={processing}
                                    className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors font-medium disabled:opacity-50"
                                >
                                    ✔️ Marcar Concluído
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
