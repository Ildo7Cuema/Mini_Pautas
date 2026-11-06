import { useState, useEffect, type ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
    fetchMunicipioStats,
    fetchSolicitacoes,
    fetchSolicitacaoStats,
    updateSolicitacaoStatus
} from '../utils/direcaoMunicipal'
import { getEstadoLabel, formatDataSolicitacao } from '../utils/solicitacoes'
import { generatePDF, defaultTemplate, fetchEmployeeDataForDocument, type DocumentData } from '../utils/documentGenerator'
import type { MunicipioStats, SolicitacaoDocumento, SolicitacaoStats, EstadoSolicitacao } from '../types'
import { supabase } from '../lib/supabaseClient'
import { Icons } from './ui/Icons'
import {
    DmPage,
    DmHeader,
    DmContent,
    DmPanel,
    DmStatCard,
    DmEmpty,
    DmButton,
    DmBadge,
    DmIconButton,
} from '../modules/municipal_education/components/MunicipalChrome'

interface DirecaoMunicipalDashboardProps {
    onNavigate?: (page: string, params?: Record<string, any>) => void
}

export default function DirecaoMunicipalDashboard({ onNavigate }: DirecaoMunicipalDashboardProps) {
    const { direcaoMunicipalProfile, profile } = useAuth()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<MunicipioStats | null>(null)
    const [solicitacoes, setSolicitacoes] = useState<SolicitacaoDocumento[]>([])
    const [solicitacaoStats, setSolicitacaoStats] = useState<SolicitacaoStats | null>(null)
    const [processingId, setProcessingId] = useState<string | null>(null)

    const municipio = direcaoMunicipalProfile?.municipio || ''
    const provincia = direcaoMunicipalProfile?.provincia || ''

    useEffect(() => {
        loadData()
    }, [municipio])

    const loadData = async () => {
        if (!municipio) return

        setLoading(true)
        try {
            const [statsData, solicitacoesData, solStatsData] = await Promise.all([
                fetchMunicipioStats(municipio),
                fetchSolicitacoes({ limit: 10 }),
                fetchSolicitacaoStats()
            ])

            setStats(statsData)
            setSolicitacoes(solicitacoesData)
            setSolicitacaoStats(solStatsData)
        } catch (error) {
            console.error('Error loading dashboard data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleQuickAction = async (solicitacaoId: string, action: 'approve' | 'analyze') => {
        setProcessingId(solicitacaoId)
        try {
            const estado: EstadoSolicitacao = action === 'approve' ? 'concluido' : 'em_analise'
            let resposta = undefined

            if (action === 'approve') {
                // Get the full request data
                const solicitacaoFull = solicitacoes.find(s => s.id === solicitacaoId)

                if (solicitacaoFull) {
                    // Fetch complete employee data from database
                    const employeeData = await fetchEmployeeDataForDocument(
                        solicitacaoFull.solicitante_user_id,
                        solicitacaoFull.solicitante_tipo as 'PROFESSOR' | 'SECRETARIO' | 'ESCOLA',
                        solicitacaoFull.escola_id
                    )

                    if (employeeData) {
                        // Build the complete document data object
                        const docData: DocumentData = {
                            funcionario: employeeData,
                            documento: {
                                tipo: solicitacaoFull.tipo_documento?.nome || solicitacaoFull.assunto,
                                assunto: solicitacaoFull.assunto,
                                data_solicitacao: solicitacaoFull.created_at,
                                numero_protocolo: solicitacaoFull.id.slice(0, 8).toUpperCase()
                            },
                            direcao: {
                                municipio: municipio,
                                provincia: provincia,
                                director_nome: direcaoMunicipalProfile?.nome || "Director Municipal"
                            }
                        }

                        // Try to fetch custom template for this document type
                        let templateToUse = defaultTemplate
                        if (solicitacaoFull.tipo_documento_id) {
                            const { data: customTemplate } = await supabase
                                .from('modelos_documento')
                                .select('*')
                                .eq('municipio', municipio)
                                .eq('tipo_documento_id', solicitacaoFull.tipo_documento_id)
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
                        a.download = `${solicitacaoFull.tipo_documento?.nome || 'Documento'}_${employeeData.nome}.pdf`
                        document.body.appendChild(a)
                        a.click()
                        document.body.removeChild(a)
                        URL.revokeObjectURL(url)

                        resposta = "Documento gerado com sucesso e emitido."
                    } else {
                        throw new Error('Não foi possível obter os dados do funcionário.')
                    }
                }
            }

            await updateSolicitacaoStatus(solicitacaoId, estado, resposta)
            await loadData()
        } catch (error) {
            console.error('Error updating solicitação:', error)
            alert("Erro ao processar solicitação: " + (error instanceof Error ? error.message : 'Erro desconhecido'))
        } finally {
            setProcessingId(null)
        }
    }

    if (!direcaoMunicipalProfile) {
        return (
            <DmPage className="pb-24 md:pb-0">
                <DmContent>
                    <DmEmpty
                        title="Perfil de Direção Municipal não encontrado"
                        description="Por favor, contacte o administrador do sistema."
                        icon={<Icons.Building className="w-8 h-8" />}
                    />
                </DmContent>
            </DmPage>
        )
    }

    return (
        <DmPage className="pb-24 md:pb-0">
            <DmHeader
                title="Direção Municipal de Educação"
                subtitle={`${municipio}, ${provincia}`}
                icon={<Icons.Building className="w-6 h-6" />}
                accent="emerald"
                meta={
                    <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-sm">
                            <Icons.User className="w-3.5 h-3.5" />
                            {direcaoMunicipalProfile.nome}
                        </span>
                        {direcaoMunicipalProfile.cargo && (
                            <span className="hidden sm:inline text-white/70">{direcaoMunicipalProfile.cargo}</span>
                        )}
                    </div>
                }
            />
            <DmContent>
            {
                loading ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16">
                        <Icons.Spinner className="w-8 h-8 text-emerald-600" />
                        <p className="text-sm font-medium text-slate-500">A carregar painel municipal...</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
                            <DmStatCard
                                title="Escolas"
                                value={stats?.total_escolas || 0}
                                subtitle={`${stats?.escolas_ativas || 0} activas`}
                                icon={<Icons.School className="w-5 h-5" />}
                                iconTone="from-blue-50 to-blue-100 text-blue-600"
                            />
                            <DmStatCard
                                title="Alunos"
                                value={stats?.total_alunos || 0}
                                subtitle={`M ${stats?.alunos_masculino || 0} · F ${stats?.alunos_feminino || 0}`}
                                icon={<Icons.AcademicCap className="w-5 h-5" />}
                                iconTone="from-emerald-50 to-emerald-100 text-emerald-600"
                            />
                            <DmStatCard
                                title="Professores"
                                value={stats?.total_professores || 0}
                                subtitle={`M ${stats?.professores_masculino || 0} · F ${stats?.professores_feminino || 0}`}
                                icon={<Icons.Users className="w-5 h-5" />}
                                iconTone="from-violet-50 to-violet-100 text-violet-600"
                            />
                            <DmStatCard
                                title="Funcionários"
                                value={stats?.total_funcionarios || 0}
                                subtitle={`M ${stats?.funcionarios_masculino || 0} · F ${stats?.funcionarios_feminino || 0}`}
                                icon={<Icons.Briefcase className="w-5 h-5" />}
                                iconTone="from-slate-50 to-slate-100 text-slate-600"
                            />
                            <DmStatCard
                                title="Solicitações"
                                value={solicitacaoStats?.pendentes || 0}
                                subtitle="Pendentes"
                                icon={<Icons.ClipboardList className="w-5 h-5" />}
                                iconTone={(solicitacaoStats?.pendentes || 0) > 0
                                    ? 'from-amber-50 to-amber-100 text-amber-600'
                                    : 'from-slate-50 to-slate-100 text-slate-600'}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                            <DmPanel className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm text-slate-600 font-medium">Total de Turmas</p>
                                    <p className="text-3xl font-bold text-slate-900 tracking-tight mt-1">
                                        {stats?.total_turmas || 0}
                                    </p>
                                </div>
                                <div className="w-11 h-11 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center">
                                    <Icons.ClipboardList className="w-5 h-5" />
                                </div>
                            </DmPanel>
                            <DmPanel className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm text-slate-600 font-medium">Média Geral</p>
                                    <p className="text-3xl font-bold text-slate-900 tracking-tight mt-1">
                                        {stats?.media_geral?.toFixed(1) || '0.0'}
                                    </p>
                                </div>
                                <div className="w-11 h-11 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center">
                                    <Icons.BarChart className="w-5 h-5" />
                                </div>
                            </DmPanel>
                            <DmPanel className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm text-slate-600 font-medium">Taxa de Aprovação</p>
                                    <p className="text-3xl font-bold text-slate-900 tracking-tight mt-1">
                                        {stats?.taxa_aprovacao || 0}%
                                    </p>
                                </div>
                                <div className="w-11 h-11 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center">
                                    <Icons.CheckCircle className="w-5 h-5" />
                                </div>
                            </DmPanel>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <DmPanel className="!p-0 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                                    <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                                        <span className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center">
                                            <Icons.ClipboardList className="w-4 h-4" />
                                        </span>
                                        Solicitações Recentes
                                    </h2>
                                    <DmButton
                                        variant="ghost"
                                        onClick={() => onNavigate?.('solicitacoes')}
                                        iconRight={<Icons.ChevronRight className="w-4 h-4" />}
                                        className="!min-h-0 !py-1.5 !px-2.5 !text-xs"
                                    >
                                        Ver todas
                                    </DmButton>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {solicitacoes.length === 0 ? (
                                        <div className="p-6">
                                            <DmEmpty
                                                title="Nenhuma solicitação"
                                                description="Não há pedidos recentes neste município."
                                                icon={<Icons.ClipboardList className="w-6 h-6" />}
                                            />
                                        </div>
                                    ) : (
                                        solicitacoes.slice(0, 5).map((sol) => {
                                            const estadoInfo = getEstadoLabel(sol.estado)
                                            return (
                                                <div key={sol.id} className="p-4 hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                {sol.urgente && (
                                                                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                                                )}
                                                                <span className="font-medium text-slate-900 truncate">
                                                                    {sol.assunto}
                                                                </span>
                                                            </div>
                                                            <div className="text-sm text-slate-500 truncate">
                                                                {sol.solicitante_nome} · {sol.escola?.nome}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <DmBadge tone="info">{estadoInfo.label}</DmBadge>
                                                                <span className="text-xs text-slate-400">
                                                                    {formatDataSolicitacao(sol.created_at)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {sol.estado === 'pendente' && (
                                                            <div className="flex gap-1">
                                                                <DmIconButton
                                                                    label="Marcar em análise"
                                                                    onClick={() => handleQuickAction(sol.id, 'analyze')}
                                                                    disabled={processingId === sol.id}
                                                                    className="!bg-blue-50 !text-blue-700 !shadow-none"
                                                                >
                                                                    <Icons.Search className="w-4 h-4" />
                                                                </DmIconButton>
                                                                <DmIconButton
                                                                    label="Aprovar"
                                                                    onClick={() => handleQuickAction(sol.id, 'approve')}
                                                                    disabled={processingId === sol.id}
                                                                    className="!bg-emerald-50 !text-emerald-700 !shadow-none"
                                                                >
                                                                    <Icons.Check className="w-4 h-4" />
                                                                </DmIconButton>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </DmPanel>

                            <div className="space-y-5">
                                <DmPanel>
                                    <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                        <span className="w-8 h-8 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center">
                                            <Icons.Target className="w-4 h-4" />
                                        </span>
                                        Acesso Rápido
                                    </h2>
                                    <div className="grid grid-cols-2 gap-3">
                                        <QuickNav icon={<Icons.School className="w-5 h-5" />} label="Escolas" onClick={() => onNavigate?.('escolas')} />
                                        <QuickNav icon={<Icons.ClipboardList className="w-5 h-5" />} label="Solicitações" onClick={() => onNavigate?.('solicitacoes')} badge={solicitacaoStats?.pendentes} />
                                        <QuickNav icon={<Icons.BarChart className="w-5 h-5" />} label="Supervisão" onClick={() => onNavigate?.('supervisao-pedagogica')} />
                                        <QuickNav icon={<Icons.Users className="w-5 h-5" />} label="Funcionários" onClick={() => onNavigate?.('funcionarios')} />
                                        <QuickNav icon={<Icons.DocumentText className="w-5 h-5" />} label="Circulares" onClick={() => onNavigate?.('circulares')} />
                                        <QuickNav icon={<Icons.TrendingUp className="w-5 h-5" />} label="Relatórios" onClick={() => onNavigate?.('relatorios-municipais')} />
                                        <QuickNav icon={<Icons.Edit className="w-5 h-5" />} label="Config. Documentos" onClick={() => onNavigate?.('config-documentos')} />
                                    </div>
                                </DmPanel>

                                <DmPanel className="!p-0 overflow-hidden">
                                    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                                        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                                            <span className="w-8 h-8 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center">
                                                <Icons.Award className="w-4 h-4" />
                                            </span>
                                            Top Escolas
                                        </h2>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {stats?.estatisticas_por_escola
                                            .sort((a, b) => b.media_geral - a.media_geral)
                                            .slice(0, 5)
                                            .map((escola, index) => (
                                                <div key={escola.escola_id} className="p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-amber-100 text-amber-800' :
                                                        index === 1 ? 'bg-slate-200 text-slate-600' :
                                                            index === 2 ? 'bg-orange-100 text-orange-700' :
                                                                'bg-slate-100 text-slate-500'
                                                        }`}>
                                                        {index + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-slate-900 truncate text-sm">
                                                            {escola.escola_nome}
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            {escola.total_alunos} alunos
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-lg font-bold text-indigo-600">
                                                            {escola.media_geral.toFixed(1)}
                                                        </div>
                                                        <div className="text-xs text-emerald-600 font-medium">
                                                            {escola.taxa_aprovacao}%
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        {!stats?.estatisticas_por_escola?.length && (
                                            <div className="p-6">
                                                <DmEmpty
                                                    title="Nenhuma escola"
                                                    description="Ainda não há estatísticas por escola."
                                                    icon={<Icons.School className="w-6 h-6" />}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </DmPanel>
                            </div>
                        </div>
                    </>
                )
            }
            </DmContent>
        </DmPage>
    )
}

function QuickNav({
    icon,
    label,
    onClick,
    badge,
}: {
    icon: ReactNode
    label: string
    onClick: () => void
    badge?: number
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="relative p-3.5 bg-slate-50 hover:bg-white rounded-xl border border-slate-200 hover:border-emerald-300 shadow-sm hover:shadow-md transition-all text-left group"
        >
            <div className="w-9 h-9 bg-white group-hover:bg-emerald-50 text-slate-600 group-hover:text-emerald-700 rounded-lg flex items-center justify-center mb-2.5 border border-slate-100 transition-colors">
                {icon}
            </div>
            <div className="font-semibold text-sm text-slate-800 group-hover:text-emerald-800 transition-colors">{label}</div>
            {badge !== undefined && badge > 0 && (
                <span className="absolute top-2.5 right-2.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 shadow">
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
        </button>
    )
}
