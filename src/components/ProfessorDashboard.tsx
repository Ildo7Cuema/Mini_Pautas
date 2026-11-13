/*
component-meta:
  name: ProfessorDashboard
  description: Dashboard específico para professores com estatísticas
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Card, CardBody, CardHeader } from './ui/Card'
import { useAuth } from '../contexts/AuthContext'
import { translateError } from '../utils/translations'

interface DisciplinaStats {
    id: string
    nome: string
    turma_nome: string
    turma_id: string
    total_alunos: number
}

interface ProfessorStats {
    totalTurmas: number
    totalDisciplinas: number
    totalAlunos: number
    disciplinas: DisciplinaStats[]
}

export const ProfessorDashboard: React.FC = () => {
    const { professorProfile } = useAuth()
    const [stats, setStats] = useState<ProfessorStats>({
        totalTurmas: 0,
        totalDisciplinas: 0,
        totalAlunos: 0,
        disciplinas: []
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (professorProfile) {
            loadStats()
        } else {
            // If no professor profile, stop loading and show error
            setLoading(false)
            setError('Perfil de professor não encontrado. Entre em contato com a administração.')
        }
    }, [professorProfile])

    const loadStats = async () => {
        if (!professorProfile) return

        try {
            setLoading(true)
            setError(null)

            console.log('📊 ProfessorDashboard: Loading stats for professor:', professorProfile.id)

            // Try NEW MODEL first: Get disciplinas via turma_professores
            const { data: turmaProfsData, error: turmaProfsError } = await supabase
                .from('turma_professores')
                .select(`
                    disciplina_id,
                    disciplinas!inner (
                        id,
                        nome,
                        turma_id,
                        turmas!inner (
                            id,
                            nome,
                            alunos (count)
                        )
                    )
                `)
                .eq('professor_id', professorProfile.id)

            console.log('📊 ProfessorDashboard: Turma_professores query result:', {
                count: turmaProfsData?.length || 0,
                error: turmaProfsError
            })

            let disciplinas: any[] = []

            if (!turmaProfsError && turmaProfsData && turmaProfsData.length > 0) {
                // NEW MODEL: Use turma_professores data
                console.log('✅ ProfessorDashboard: Using NEW model (turma_professores)')
                disciplinas = turmaProfsData.map((tp: any) => tp.disciplinas)
            } else {
                // OLD MODEL fallback: Query disciplinas directly by professor_id
                console.log('⚠️ ProfessorDashboard: Falling back to OLD model (disciplinas.professor_id)')

                const { data: discData, error: discError } = await supabase
                    .from('disciplinas')
                    .select(`
                        id,
                        nome,
                        turma_id,
                        turmas!inner (
                            id,
                            nome,
                            alunos (count)
                        )
                    `)
                    .eq('professor_id', professorProfile.id)

                if (discError) throw discError
                disciplinas = discData || []

                console.log('📊 ProfessorDashboard: Old model query result:', {
                    count: disciplinas.length
                })
            }

            // Processar dados
            const disciplinasStats: DisciplinaStats[] = disciplinas?.map((disc: any) => ({
                id: disc.id,
                nome: disc.nome,
                turma_nome: disc.turmas.nome,
                turma_id: disc.turmas.id,
                total_alunos: disc.turmas.alunos?.[0]?.count || 0
            })) || []

            console.log('📊 ProfessorDashboard: Processed disciplinas:', disciplinasStats.length)

            // Calcular estatísticas agregadas
            const turmasUnicas = new Set(disciplinasStats.map(d => d.turma_id))

            // Contar alunos únicos por turma
            const alunosPorTurma = new Map<string, number>()
            disciplinasStats.forEach(d => {
                if (!alunosPorTurma.has(d.turma_id)) {
                    alunosPorTurma.set(d.turma_id, d.total_alunos)
                }
            })
            const totalAlunosUnicos = Array.from(alunosPorTurma.values()).reduce((sum, count) => sum + count, 0)

            setStats({
                totalTurmas: turmasUnicas.size,
                totalDisciplinas: disciplinasStats.length,
                totalAlunos: totalAlunosUnicos,
                disciplinas: disciplinasStats
            })

            console.log('✅ ProfessorDashboard: Stats loaded successfully:', {
                turmas: turmasUnicas.size,
                disciplinas: disciplinasStats.length,
                alunos: totalAlunosUnicos
            })
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar estatísticas'
            console.error('❌ ProfessorDashboard: Error loading stats:', err)
            setError(translateError(errorMessage))
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="space-y-6 animate-fade-in">
                {/* Header Skeleton */}
                <div>
                    <div className="skeleton h-8 w-64 mb-2 rounded-lg"></div>
                    <div className="skeleton h-4 w-48 rounded"></div>
                </div>
                {/* Stats Cards Skeleton */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="card p-4 md:p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="skeleton h-4 w-20 mb-2 rounded"></div>
                                    <div className="skeleton h-8 w-12 rounded"></div>
                                </div>
                                <div className="skeleton w-12 h-12 rounded-full"></div>
                            </div>
                        </div>
                    ))}
                </div>
                {/* Disciplinas List Skeleton */}
                <div className="card">
                    <div className="border-b border-slate-100 p-4">
                        <div className="skeleton h-6 w-40 rounded"></div>
                    </div>
                    <div className="p-4 space-y-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                <div className="flex-1">
                                    <div className="skeleton h-5 w-32 mb-2 rounded"></div>
                                    <div className="skeleton h-3 w-24 rounded"></div>
                                </div>
                                <div className="skeleton h-5 w-20 rounded"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                    Bem-vindo, {professorProfile?.nome_completo || 'Professor'}
                </h2>
                <p className="text-sm md:text-base text-slate-600 mt-1">
                    Resumo das suas turmas e disciplinas
                </p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="alert alert-error animate-slide-down">
                    <span className="text-sm">{error}</span>
                </div>
            )}

            {/* Atalho avaliação de desempenho (Art. 25.º) */}
            <button
                type="button"
                onClick={() =>
                    window.dispatchEvent(
                        new CustomEvent('navigate', { detail: { page: 'minhas-avaliacoes' } }),
                    )
                }
                className="w-full text-left rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm hover:border-slate-300 hover:shadow transition-shadow"
            >
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">Minha avaliação de desempenho</p>
                        <p className="text-sm text-slate-600 mt-0.5">
                            Ver fichas divulgadas pela escola e registar Concorda / Não concorda
                        </p>
                    </div>
                    <span className="text-slate-400 shrink-0" aria-hidden>
                        →
                    </span>
                </div>
            </button>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                {/* Total Turmas */}
                <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
                    <CardBody className="p-4 md:p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-600">Turmas</p>
                                <p className="text-2xl md:text-3xl font-bold text-blue-600 mt-1">
                                    {stats.totalTurmas}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                {/* Total Disciplinas */}
                <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
                    <CardBody className="p-4 md:p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-600">Disciplinas</p>
                                <p className="text-2xl md:text-3xl font-bold text-green-600 mt-1">
                                    {stats.totalDisciplinas}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                {/* Total Alunos */}
                <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
                    <CardBody className="p-4 md:p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-600">Alunos</p>
                                <p className="text-2xl md:text-3xl font-bold text-purple-600 mt-1">
                                    {stats.totalAlunos}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </div>

            {/* Disciplinas List */}
            <Card>
                <CardHeader>
                    <h3 className="text-lg font-semibold text-slate-900">Minhas Disciplinas</h3>
                </CardHeader>
                <CardBody>
                    {stats.disciplinas.length === 0 ? (
                        <div className="text-center py-8">
                            <svg className="w-12 h-12 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            <p className="text-slate-600">Nenhuma disciplina atribuída</p>
                            <p className="text-sm text-slate-500 mt-1">Entre em contato com a administração da escola</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {stats.disciplinas.map((disc) => (
                                <div
                                    key={disc.id}
                                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-primary-300 hover:shadow-sm transition-all"
                                >
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-slate-900">{disc.nome}</h4>
                                        <p className="text-sm text-slate-600 mt-0.5">{disc.turma_nome}</p>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                        <span className="text-sm font-medium">{disc.total_alunos} alunos</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardBody>
            </Card>
        </div>
    )
}
