/*
component-meta:
  name: Dashboard
  description: Main dashboard with stats, recent classes, and quick actions
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Card, CardBody, CardHeader } from './ui/Card'
import { translateError } from '../utils/translations'
import { useAuth } from '../contexts/AuthContext'

interface DashboardStats {
    totalTurmas: number
    totalAlunos: number
    mediaGeral: number
    taxaAprovacao: number
}

interface RecentClass {
    id: string
    nome: string
    total_alunos: number
    media: number
}

interface DashboardProps {
    onNavigate?: (page: string) => void
    searchQuery?: string
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, searchQuery = '' }) => {
    const { user, isEscola, isProfessor, isSecretario, escolaProfile, professorProfile, secretarioProfile, loading: authLoading } = useAuth()
    const [stats, setStats] = useState<DashboardStats>({
        totalTurmas: 0,
        totalAlunos: 0,
        mediaGeral: 0,
        taxaAprovacao: 0,
    })
    const [recentClasses, setRecentClasses] = useState<RecentClass[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showHelpModal, setShowHelpModal] = useState(false)

    useEffect(() => {
        if (!authLoading && user && (escolaProfile || professorProfile || secretarioProfile)) {
            loadDashboardData()
        }
    }, [authLoading, user, escolaProfile, professorProfile, secretarioProfile])

    const loadDashboardData = async () => {
        try {
            setLoading(true)
            setError(null)

            // Debug: Log full profile info
            console.log('Dashboard: Full debug info:', {
                isEscola,
                isProfessor,
                escolaProfile: escolaProfile ? {
                    id: escolaProfile.id,
                    nome: escolaProfile.nome,
                    user_profile: escolaProfile.user_profile
                } : null,
                professorProfile: professorProfile ? {
                    id: professorProfile.id,
                    escola_id: professorProfile.escola_id,
                    user_profile: professorProfile.user_profile
                } : null,
                user: user
            })

            // Determine escola_id based on profile type
            let escolaId: string | null = null

            if (isEscola && escolaProfile) {
                // For escola profile, use escolaProfile.id (which is the escola's ID from escolas table)
                escolaId = escolaProfile.id
                console.log('Dashboard: Using escola profile, escola_id:', escolaId)
            } else if (isProfessor && professorProfile) {
                escolaId = professorProfile.escola_id
                console.log('Dashboard: Using professor profile, escola_id:', escolaId)
            } else if (isSecretario && secretarioProfile) {
                escolaId = secretarioProfile.escola_id
                console.log('Dashboard: Using secretario profile, escola_id:', escolaId)
            }

            if (!escolaId) {
                console.log('Dashboard: No escola_id found')
                setError('Perfil não encontrado. Por favor, faça logout e login novamente.')
                setLoading(false)
                return
            }

            // RLS policies automatically filter by escola_id based on user_profiles
            // We don't need to filter manually - just query and let RLS handle it

            // Get total turmas (RLS will filter automatically)
            console.log('Dashboard: Querying turmas (RLS will filter)...')
            const { count: turmasCount, error: turmasError } = await supabase
                .from('turmas')
                .select('*', { count: 'exact', head: true })

            console.log('Dashboard: Turmas query result:', {
                count: turmasCount,
                error: turmasError,
                errorDetails: turmasError ? {
                    message: turmasError.message,
                    details: turmasError.details,
                    hint: turmasError.hint,
                    code: turmasError.code
                } : null
            })

            if (turmasError) {
                console.error('Dashboard: Error fetching turmas count:', turmasError)
                // Handle empty error message (RLS issue)
                if (!turmasError.message || turmasError.message === '') {
                    throw new Error('Sem permissão para acessar dados. Verifique se seu perfil está configurado corretamente.')
                }
                throw turmasError
            }

            // Get turmas IDs first, then count alunos (RLS will filter)
            const { data: turmasIds, error: turmasIdsError } = await supabase
                .from('turmas')
                .select('id')

            if (turmasIdsError) {
                console.error('Dashboard: Error fetching turmas ids:', turmasIdsError)
                throw turmasIdsError
            }

            // Count alunos for those turmas
            let alunosCount = 0
            const turmaIdList = turmasIds?.map(t => t.id) || []
            if (turmasIds && turmasIds.length > 0) {
                const { count, error: alunosError } = await supabase
                    .from('alunos')
                    .select('*', { count: 'exact', head: true })
                    .in('turma_id', turmaIdList)

                if (alunosError) {
                    console.error('Dashboard: Error fetching alunos count:', alunosError)
                    // Don't throw, just use 0
                } else {
                    alunosCount = count || 0
                }
            }

            // Get recent classes with student count (RLS will filter)
            const { data: turmasData, error: turmasDataError } = await supabase
                .from('turmas')
                .select(`
                    id,
                    nome,
                    alunos(count)
                `)
                .order('created_at', { ascending: false })
                .limit(4)

            if (turmasDataError) {
                console.error('Dashboard: Error fetching turmas data:', turmasDataError)
                throw turmasDataError
            }

            // Calculate mediaGeral and taxaAprovacao from notas
            let mediaGeral = 0
            let taxaAprovacao = 0

            if (turmaIdList.length > 0) {
                // Get all alunos for these turmas
                const { data: alunosData, error: alunosDataError } = await supabase
                    .from('alunos')
                    .select('id, turma_id')
                    .in('turma_id', turmaIdList)

                if (!alunosDataError && alunosData && alunosData.length > 0) {
                    const alunoIds = alunosData.map(a => a.id)

                    // Get componentes_avaliacao that represent final grades (MF = Média Final or NF = Nota Final)
                    const { data: componentesMF, error: componentesMFError } = await supabase
                        .from('componentes_avaliacao')
                        .select('id, disciplina_id, codigo_componente')
                        .in('codigo_componente', ['MF', 'NF', 'MT', 'CF'])

                    if (!componentesMFError && componentesMF && componentesMF.length > 0) {
                        const componenteMFIds = componentesMF.map(c => c.id)

                        // Get notas for final grade components
                        const { data: notasData, error: notasError } = await supabase
                            .from('notas')
                            .select('aluno_id, componente_id, valor')
                            .in('aluno_id', alunoIds)
                            .in('componente_id', componenteMFIds)

                        if (!notasError && notasData && notasData.length > 0) {
                            // Calculate average grade per student (across all disciplines)
                            const notasPorAluno: Record<string, number[]> = {}

                            notasData.forEach(nota => {
                                if (nota.valor !== null && nota.valor !== undefined) {
                                    if (!notasPorAluno[nota.aluno_id]) {
                                        notasPorAluno[nota.aluno_id] = []
                                    }
                                    notasPorAluno[nota.aluno_id].push(nota.valor)
                                }
                            })

                            // Calculate media for each student and overall statistics
                            const mediasAlunos: number[] = []
                            let alunosAprovados = 0
                            let totalAlunosComNotas = 0

                            Object.entries(notasPorAluno).forEach(([, notas]) => {
                                if (notas.length > 0) {
                                    const mediaAluno = notas.reduce((sum, n) => sum + n, 0) / notas.length
                                    mediasAlunos.push(mediaAluno)
                                    totalAlunosComNotas++

                                    // In Angolan system, >= 10 is passing
                                    if (mediaAluno >= 10) {
                                        alunosAprovados++
                                    }
                                }
                            })

                            // Calculate overall average
                            if (mediasAlunos.length > 0) {
                                mediaGeral = mediasAlunos.reduce((sum, m) => sum + m, 0) / mediasAlunos.length
                                taxaAprovacao = (alunosAprovados / totalAlunosComNotas) * 100
                            }

                            console.log('Dashboard: Grade statistics calculated:', {
                                mediasAlunos: mediasAlunos.length,
                                mediaGeral,
                                alunosAprovados,
                                totalAlunosComNotas,
                                taxaAprovacao
                            })
                        }
                    }
                }
            }

            // Calculate media for each recent class
            const classesWithCount = await Promise.all(
                (turmasData || []).map(async (turma) => {
                    let mediaTurma = 0

                    // Get alunos for this turma
                    const { data: alunosTurma } = await supabase
                        .from('alunos')
                        .select('id')
                        .eq('turma_id', turma.id)

                    if (alunosTurma && alunosTurma.length > 0) {
                        const alunoIdsTurma = alunosTurma.map(a => a.id)

                        // Get componentes MF
                        const { data: componentesMF } = await supabase
                            .from('componentes_avaliacao')
                            .select('id')
                            .in('codigo_componente', ['MF', 'NF', 'MT', 'CF'])

                        if (componentesMF && componentesMF.length > 0) {
                            const componenteMFIds = componentesMF.map(c => c.id)

                            // Get notas
                            const { data: notasTurma } = await supabase
                                .from('notas')
                                .select('valor')
                                .in('aluno_id', alunoIdsTurma)
                                .in('componente_id', componenteMFIds)

                            if (notasTurma && notasTurma.length > 0) {
                                const notasValidas = notasTurma.filter(n => n.valor !== null && n.valor !== undefined)
                                if (notasValidas.length > 0) {
                                    mediaTurma = notasValidas.reduce((sum, n) => sum + n.valor, 0) / notasValidas.length
                                }
                            }
                        }
                    }

                    return {
                        id: turma.id,
                        nome: turma.nome,
                        total_alunos: turma.alunos?.[0]?.count || 0,
                        media: mediaTurma,
                    }
                })
            )

            setStats({
                totalTurmas: turmasCount || 0,
                totalAlunos: alunosCount,
                mediaGeral: Math.round(mediaGeral * 10) / 10, // Round to 1 decimal
                taxaAprovacao: Math.round(taxaAprovacao), // Round to whole number
            })

            setRecentClasses(classesWithCount)
            console.log('Dashboard: Data loaded successfully', { turmasCount, alunosCount, classesWithCount, mediaGeral, taxaAprovacao })
        } catch (err) {
            console.error('Dashboard: Caught error:', err)
            const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados'
            setError(translateError(errorMessage))
        } finally {
            setLoading(false)
        }
    }

    const handleQuickAction = (action: string) => {
        if (!onNavigate) return
        switch (action) {
            case 'grades':
                onNavigate('grades')
                break
            case 'reports':
                onNavigate('reports')
                break
        }
    }

    // Get user display name based on profile type
    const getUserDisplayName = () => {
        if (isEscola && escolaProfile) {
            return escolaProfile.nome?.split(' ')[0] || 'Administrador'
        } else if (isProfessor && professorProfile) {
            return professorProfile.nome_completo?.split(' ')[0] || 'Professor'
        } else if (isSecretario && secretarioProfile) {
            return secretarioProfile.nome_completo?.split(' ')[0] || 'Secretário'
        }
        return user?.email?.split('@')[0] || 'Usuário'
    }

    if (loading || authLoading) {
        return (
            <div className="space-y-6 animate-fade-in">
                {/* Stats Grid Skeleton */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="card p-4 md:p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="skeleton w-12 h-12 rounded-2xl"></div>
                                <div className="skeleton h-6 w-12 rounded-lg"></div>
                            </div>
                            <div>
                                <div className="skeleton h-4 w-20 mb-2 rounded"></div>
                                <div className="skeleton h-8 w-16 rounded"></div>
                            </div>
                        </div>
                    ))}
                </div>
                {/* Content Skeleton */}
                <div className="card">
                    <div className="border-b border-slate-100 p-5 md:p-6">
                        <div className="skeleton h-6 w-40 mb-2 rounded"></div>
                        <div className="skeleton h-4 w-56 rounded"></div>
                    </div>
                    <div className="p-4 space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-4">
                                <div className="skeleton w-10 h-10 rounded-xl"></div>
                                <div className="flex-1">
                                    <div className="skeleton h-4 w-32 mb-2 rounded"></div>
                                    <div className="skeleton h-3 w-20 rounded"></div>
                                </div>
                                <div className="skeleton h-6 w-12 rounded-lg"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    // If auth finished but no profile was loaded, show error
    if (!authLoading && user && !escolaProfile && !professorProfile && !secretarioProfile) {
        return (
            <div className="alert alert-error">
                <span>Perfil não encontrado. Por favor, faça logout e login novamente.</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="alert alert-error">
                <span>{error}</span>
            </div>
        )
    }

    const statsData = [
        {
            title: 'Total de Turmas',
            value: stats.totalTurmas.toString(),
            change: '+0',
            changeType: 'positive' as const,
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            ),
        },
        {
            title: 'Total de Alunos',
            value: stats.totalAlunos.toString(),
            change: '+0',
            changeType: 'positive' as const,
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            ),
        },
        {
            title: 'Média Geral',
            value: stats.mediaGeral > 0 ? stats.mediaGeral.toFixed(1) : '--',
            change: '--',
            changeType: 'positive' as const,
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            ),
        },
        {
            title: 'Taxa de Aprovação',
            value: stats.taxaAprovacao > 0 ? `${stats.taxaAprovacao}%` : '--',
            change: '--',
            changeType: 'positive' as const,
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
    ]

    return (
        <div className="space-y-6 md:space-y-8 pb-24 md:pb-8">
            {/* Welcome Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                        Olá, {getUserDisplayName()}! 👋
                    </h2>
                    {isSecretario && secretarioProfile?.escola && (
                        <p className="text-primary-600 font-medium text-sm mt-0.5">
                            {secretarioProfile.escola.nome}
                        </p>
                    )}
                    <p className="text-slate-500 mt-1">Aqui está o resumo das suas atividades hoje.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => loadDashboardData()}
                        className="p-2.5 text-slate-400 hover:text-primary-600 hover:bg-white bg-white/50 border border-slate-200/60 rounded-xl transition-all shadow-sm active:scale-95"
                        title="Atualizar dados"
                    >
                        <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 animate-slide-up">
                {statsData.map((stat, index) => (
                    <Card key={index} className="border-0 shadow-md shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-300/40 transition-all duration-300 group overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/0 to-slate-100/50 rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110" />

                        <CardBody className="p-4 md:p-6 relative z-10">
                            <div className="flex items-start justify-between mb-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/10 ${index === 0 ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white' :
                                    index === 1 ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white' :
                                        index === 2 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' :
                                            'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
                                    }`}>
                                    {stat.icon}
                                </div>
                                {stat.change !== '--' && (
                                    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${stat.changeType === 'positive'
                                        ? 'bg-green-50 text-green-700'
                                        : 'bg-red-50 text-red-700'
                                        }`}>
                                        {stat.changeType === 'positive' ? '↑' : '↓'} {stat.change}
                                    </div>
                                )}
                            </div>

                            <div>
                                <p className="text-sm font-medium text-slate-500 mb-1">{stat.title}</p>
                                <h3 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">{stat.value}</h3>
                            </div>
                        </CardBody>
                    </Card>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Recent Classes */}
                <div className="lg:col-span-2 animate-slide-up" style={{ animationDelay: '100ms' }}>
                    <Card className="h-full border-0 shadow-md shadow-slate-200/50">
                        <CardHeader className="border-b border-slate-100 bg-white/50 backdrop-blur-sm p-5 md:p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Turmas Recentes</h3>
                                    <p className="text-sm text-slate-400">Visão geral das últimas turmas</p>
                                </div>
                                <button
                                    onClick={() => onNavigate?.('classes')}
                                    className="text-sm text-primary-600 hover:text-primary-700 font-semibold hover:bg-primary-50 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    Ver todas
                                </button>
                            </div>
                        </CardHeader>
                        <CardBody className="p-0">
                            {recentClasses.length === 0 ? (
                                <div className="text-center py-16 px-6">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    </div>
                                    <h4 className="text-slate-900 font-semibold mb-1">Nenhuma turma encontrada</h4>
                                    <p className="text-slate-500 text-sm mb-4 max-w-xs mx-auto">Comece criando sua primeira turma para gerenciar alunos e notas.</p>
                                    <button
                                        onClick={() => onNavigate?.('classes')}
                                        className="text-primary-600 hover:text-primary-700 font-medium text-sm hover:underline"
                                    >
                                        Ir para Turmas
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Mobile List View */}
                                    <div className="md:hidden divide-y divide-slate-50">
                                        {recentClasses.map((cls) => (
                                            <div key={cls.id} className="p-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => onNavigate?.('classes')}>
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs shadow-inner">
                                                    {cls.nome.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-800 truncate">{cls.nome}</p>
                                                    <p className="text-xs text-slate-500 font-medium">{cls.total_alunos} alunos</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {cls.media > 0 ? (
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${cls.media >= 14 ? 'bg-green-100 text-green-700' :
                                                            cls.media >= 10 ? 'bg-yellow-100 text-yellow-700' :
                                                                'bg-red-100 text-red-700'
                                                            }`}>
                                                            {cls.media.toFixed(1)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs font-medium bg-slate-50 px-2 py-1 rounded-lg">--</span>
                                                    )}
                                                    <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Desktop Table View */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400 font-semibold bg-slate-50/50">
                                                    <th className="px-6 py-4 pl-8">Turma</th>
                                                    <th className="px-6 py-4">Total Alunos</th>
                                                    <th className="px-6 py-4">Média Geral</th>
                                                    <th className="px-6 py-4 text-right pr-8">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {recentClasses.map((cls) => (
                                                    <tr key={cls.id} className="hover:bg-slate-50/80 transition-colors group">
                                                        <td className="px-6 py-4 pl-8">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                                                    {cls.nome.substring(0, 1)}
                                                                </div>
                                                                <span className="font-semibold text-slate-700">{cls.nome}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                                                {cls.total_alunos}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {cls.media > 0 ? (
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex-1 w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full ${cls.media >= 14 ? 'bg-green-500' : 'bg-yellow-500'
                                                                                }`}
                                                                            style={{ width: `${(cls.media / 20) * 100}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-xs font-bold text-slate-600">{cls.media.toFixed(1)}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 text-sm">--</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right pr-8">
                                                            <button
                                                                onClick={() => onNavigate?.('classes')}
                                                                className="text-slate-400 hover:text-primary-600 hover:bg-primary-50 p-2 rounded-lg transition-all transform hover:scale-110 active:scale-95"
                                                                title="Ver detalhes"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                                                </svg>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </CardBody>
                    </Card>
                </div>

                {/* Quick Actions */}
                <div className="space-y-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
                    <div className="flex items-center justify-between px-1">
                        <h3 className="font-bold text-slate-800">Acesso Rápido</h3>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                        {/* Ocultar Lançar Notas para secretários */}
                        {!isSecretario && (
                            <button
                                onClick={() => handleQuickAction('grades')}
                                className="group p-4 bg-white border-0 shadow-sm hover:shadow-xl hover:shadow-green-500/10 rounded-2xl text-left transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-green-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative z-10">
                                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg shadow-green-500/30 group-hover:scale-110 transition-transform">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                        </svg>
                                    </div>
                                    <h4 className="font-bold text-slate-900 text-sm group-hover:text-green-700 transition-colors">Lançar Notas</h4>
                                    <p className="text-xs text-slate-500 mt-1">Registre as avaliações dos alunos</p>
                                </div>
                            </button>
                        )}

                        {/* Ocultar Relatórios para secretários */}
                        {!isSecretario && (
                            <button
                                onClick={() => handleQuickAction('reports')}
                                className="group p-4 bg-white border-0 shadow-sm hover:shadow-xl hover:shadow-purple-500/10 rounded-2xl text-left transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative z-10">
                                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <h4 className="font-bold text-slate-900 text-sm group-hover:text-purple-700 transition-colors">Relatórios</h4>
                                    <p className="text-xs text-slate-500 mt-1">Gere pautas e estatísticas</p>
                                </div>
                            </button>
                        )}
                    </div>

                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                        <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 bg-black/10 rounded-full blur-2xl" />

                        <div className="relative z-10">
                            <h4 className="font-bold text-lg mb-1">Precisa de ajuda?</h4>
                            <p className="text-indigo-100 text-xs mb-3">Consulte nossos tutoriais ou entre em contato com o suporte.</p>
                            <button
                                onClick={() => setShowHelpModal(true)}
                                className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors w-full text-center backdrop-blur-sm"
                            >
                                Central de Ajuda
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Help Center Modal */}
            {showHelpModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden animate-slide-up shadow-2xl ring-1 ring-black/5">
                        <CardHeader className="border-b border-slate-100 p-5 bg-gradient-to-r from-indigo-500 to-purple-600">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Central de Ajuda</h3>
                                        <p className="text-indigo-100 text-xs">Tutoriais e suporte para você</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowHelpModal(false)}
                                    className="p-1.5 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </CardHeader>
                        <CardBody className="p-0 overflow-y-auto max-h-[calc(90vh-120px)]">
                            {/* Quick Start Section */}
                            <div className="p-5 border-b border-slate-100">
                                <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    Início Rápido
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div
                                        className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl cursor-pointer hover:shadow-md transition-all group"
                                        onClick={() => { setShowHelpModal(false); onNavigate?.('classes'); }}
                                    >
                                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white mb-2 group-hover:scale-110 transition-transform">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        </div>
                                        <h5 className="font-semibold text-slate-800 text-sm">Criar Turma</h5>
                                        <p className="text-xs text-slate-500">Configure turmas e organize seus alunos</p>
                                    </div>
                                    <div
                                        className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl cursor-pointer hover:shadow-md transition-all group"
                                        onClick={() => { setShowHelpModal(false); onNavigate?.('students'); }}
                                    >
                                        <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white mb-2 group-hover:scale-110 transition-transform">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                            </svg>
                                        </div>
                                        <h5 className="font-semibold text-slate-800 text-sm">Adicionar Alunos</h5>
                                        <p className="text-xs text-slate-500">Cadastre alunos com dados completos</p>
                                    </div>
                                    <div
                                        className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl cursor-pointer hover:shadow-md transition-all group"
                                        onClick={() => { setShowHelpModal(false); onNavigate?.('grades'); }}
                                    >
                                        <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white mb-2 group-hover:scale-110 transition-transform">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                            </svg>
                                        </div>
                                        <h5 className="font-semibold text-slate-800 text-sm">Lançar Notas</h5>
                                        <p className="text-xs text-slate-500">Registre avaliações por disciplina</p>
                                    </div>
                                    <div
                                        className="p-4 bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-xl cursor-pointer hover:shadow-md transition-all group"
                                        onClick={() => { setShowHelpModal(false); onNavigate?.('reports'); }}
                                    >
                                        <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-white mb-2 group-hover:scale-110 transition-transform">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <h5 className="font-semibold text-slate-800 text-sm">Gerar Relatórios</h5>
                                        <p className="text-xs text-slate-500">Exporte pautas e boletins em PDF</p>
                                    </div>
                                </div>
                            </div>

                            {/* FAQ Section */}
                            <div className="p-5 border-b border-slate-100">
                                <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Perguntas Frequentes
                                </h4>
                                <div className="space-y-2">
                                    <details className="group bg-slate-50 rounded-xl overflow-hidden">
                                        <summary className="p-3 cursor-pointer font-medium text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-between">
                                            Como criar uma nova turma?
                                            <svg className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </summary>
                                        <div className="px-3 pb-3 text-sm text-slate-600">
                                            Acesse o menu Turmas e clique em "Nova Turma". Preencha o nome, nível de ensino e ano lectivo. A turma será criada automaticamente e estará pronta para receber alunos.
                                        </div>
                                    </details>
                                    <details className="group bg-slate-50 rounded-xl overflow-hidden">
                                        <summary className="p-3 cursor-pointer font-medium text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-between">
                                            Como lançar notas dos alunos?
                                            <svg className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </summary>
                                        <div className="px-3 pb-3 text-sm text-slate-600">
                                            Acesse o menu "Notas", selecione a turma, disciplina e trimestre desejados. Depois, clique em "Lançar Notas" para inserir as notas de cada componente de avaliação. O sistema calcula automaticamente as médias.
                                        </div>
                                    </details>
                                    <details className="group bg-slate-50 rounded-xl overflow-hidden">
                                        <summary className="p-3 cursor-pointer font-medium text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-between">
                                            Como gerar a pauta trimestral?
                                            <svg className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </summary>
                                        <div className="px-3 pb-3 text-sm text-slate-600">
                                            No menu "Relatórios", selecione a turma, o trimestre e o tipo de pauta. Clique em "Gerar Pauta" para visualizar e depois "Exportar PDF" para baixar. Pode ainda configurar o cabeçalho institucional.
                                        </div>
                                    </details>
                                    <details className="group bg-slate-50 rounded-xl overflow-hidden">
                                        <summary className="p-3 cursor-pointer font-medium text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-between">
                                            Como funciona o sistema de avaliação angolano?
                                            <svg className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </summary>
                                        <div className="px-3 pb-3 text-sm text-slate-600">
                                            O sistema usa a escala de 0-20 pontos. A nota mínima de aprovação é 10 valores. As avaliações incluem MAC (Média de Avaliação Contínua), NPP (Nota da Prova do Professor), NPT (Nota da Prova Trimestral) e MT (Média Trimestral).
                                        </div>
                                    </details>
                                </div>
                            </div>

                            {/* Contact Support Section */}
                            <div className="p-5">
                                <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    Precisa de mais ajuda?
                                </h4>
                                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4">
                                    <p className="text-sm text-slate-600 mb-4">Entre em contacto connosco por um dos canais abaixo:</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <a
                                            href="mailto:ildocuema@gmail.com"
                                            className="flex items-center gap-3 p-3 bg-white rounded-lg hover:shadow-md transition-all group"
                                        >
                                            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800 text-sm">Email</p>
                                                <p className="text-xs text-slate-500">ildocuema@gmail.com</p>
                                            </div>
                                        </a>
                                        <a
                                            href="https://wa.me/244921923232"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 p-3 bg-white rounded-lg hover:shadow-md transition-all group"
                                        >
                                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600 group-hover:bg-green-500 group-hover:text-white transition-colors">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800 text-sm">WhatsApp</p>
                                                <p className="text-xs text-slate-500">+244 921 923 232</p>
                                            </div>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </div>
            )}
        </div >
    )
}
