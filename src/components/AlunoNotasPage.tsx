/*
component-meta:
  name: AlunoNotasPage
  description: Modern, mobile-first student grades page with app-native experience
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { getApprovalThreshold, getQualitativeBands } from '../utils/angolaGradeScale'
import type { Disciplina, Nota, NotaFinal, ComponenteAvaliacao } from '../types'

interface DisciplinaWithGrades extends Disciplina {
    notas: Nota[]
    notaFinal: NotaFinal | null
    componentes: ComponenteAvaliacao[]
}

type TabType = 'notas' | 'resumo' | 'perfil'

export const AlunoNotasPage: React.FC = () => {
    const { alunoProfile, isAluno } = useAuth()
    const [disciplinas, setDisciplinas] = useState<DisciplinaWithGrades[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedTrimestre, setSelectedTrimestre] = useState<1 | 2 | 3>(1)
    const [activeTab, setActiveTab] = useState<TabType>('notas')
    const [expandedDisciplina, setExpandedDisciplina] = useState<string | null>(null)
    const [nivelEnsino, setNivelEnsino] = useState<string | null>(null)

    useEffect(() => {
        if (isAluno && alunoProfile) {
            loadGrades()
        }
    }, [isAluno, alunoProfile, selectedTrimestre])

    const loadGrades = async () => {
        if (!alunoProfile) return

        setLoading(true)
        setError(null)

        try {
            const turmaId = alunoProfile.turma_id

            const { data: turmaData } = await supabase
                .from('turmas')
                .select('nivel_ensino, nome')
                .eq('id', turmaId)
                .maybeSingle()
            setNivelEnsino(turmaData?.nivel_ensino || turmaData?.nome || null)

            const { data: disciplinasData, error: disciplinasError } = await supabase
                .from('disciplinas')
                .select('*')
                .eq('turma_id', turmaId)
                .order('ordem', { ascending: true })

            if (disciplinasError) throw disciplinasError

            const disciplinasWithGrades: DisciplinaWithGrades[] = []

            for (const disciplina of disciplinasData || []) {
                const { data: componentesData } = await supabase
                    .from('componentes_avaliacao')
                    .select('*')
                    .eq('disciplina_id', disciplina.id)
                    .eq('turma_id', turmaId)
                    .order('ordem', { ascending: true })

                const { data: notasData } = await supabase
                    .from('notas')
                    .select('*')
                    .eq('aluno_id', alunoProfile.id)
                    .eq('turma_id', turmaId)
                    .eq('trimestre', selectedTrimestre)
                    .in('componente_id', (componentesData || []).map(c => c.id))

                const { data: notaFinalData } = await supabase
                    .from('notas_finais')
                    .select('*')
                    .eq('aluno_id', alunoProfile.id)
                    .eq('turma_id', turmaId)
                    .eq('disciplina_id', disciplina.id)
                    .eq('trimestre', selectedTrimestre)
                    .maybeSingle()

                disciplinasWithGrades.push({
                    ...disciplina,
                    componentes: componentesData || [],
                    notas: notasData || [],
                    notaFinal: notaFinalData
                })
            }

            setDisciplinas(disciplinasWithGrades)
        } catch (err) {
            console.error('Error loading grades:', err)
            setError('Erro ao carregar notas. Tente novamente.')
        } finally {
            setLoading(false)
        }
    }

    const getClassificationColor = (classificacao: string): string => {
        switch (classificacao) {
            case 'Excelente': return 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
            case 'Bom': return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
            case 'Suficiente': return 'bg-gradient-to-r from-amber-500 to-amber-600 text-white'
            case 'Insuficiente': return 'bg-gradient-to-r from-red-500 to-red-600 text-white'
            default: return 'bg-slate-200 text-slate-600'
        }
    }

    const getGradeColor = (nota: number): string => {
        const bands = getQualitativeBands(nivelEnsino)
        if (nota >= bands.excellent) return 'text-emerald-600'
        if (nota >= bands.good) return 'text-blue-600'
        if (nota >= bands.sufficient) return 'text-amber-600'
        return 'text-red-600'
    }

    const getGradeBgColor = (nota: number): string => {
        const bands = getQualitativeBands(nivelEnsino)
        if (nota >= bands.excellent) return 'bg-emerald-50 border-emerald-200'
        if (nota >= bands.good) return 'bg-blue-50 border-blue-200'
        if (nota >= bands.sufficient) return 'bg-amber-50 border-amber-200'
        return 'bg-red-50 border-red-200'
    }

    const limiar = getApprovalThreshold(nivelEnsino)
    const disciplinasWithFinal = disciplinas.filter(d => d.notaFinal)
    const mediaGeral = disciplinasWithFinal.length > 0
        ? disciplinasWithFinal.reduce((acc, d) => acc + (d.notaFinal?.nota_final || 0), 0) / disciplinasWithFinal.length
        : null
    const aprovadas = disciplinas.filter(d => d.notaFinal && d.notaFinal.nota_final >= limiar).length
    const reprovadas = disciplinas.filter(d => d.notaFinal && d.notaFinal.nota_final < limiar).length

    if (!isAluno || !alunoProfile) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center p-4">
                <div className="text-center max-w-sm">
                    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center shadow-lg">
                        <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-3">Acesso Restrito</h2>
                    <p className="text-slate-600 leading-relaxed">Esta área é exclusiva para alunos do sistema EduGest Angola.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 pb-24 md:pb-6">
            {/* Mobile Header - Fixed */}
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm md:relative md:bg-transparent md:border-0 md:shadow-none">
                <div className="px-4 py-4 md:p-6">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary-500/30">
                                {alunoProfile.nome_completo.split(' ').slice(0, 2).map(n => n[0]).join('')}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </div>

                        <div className="flex-1 min-w-0">
                            <h1 className="font-bold text-lg md:text-xl text-slate-900 truncate">
                                {alunoProfile.nome_completo}
                            </h1>
                            <p className="text-sm text-slate-500 flex items-center gap-2 flex-wrap">
                                <span className="truncate">{alunoProfile.turma?.nome || 'Turma'}</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-primary-600 font-medium">Nº {alunoProfile.numero_processo}</span>
                            </p>
                            {alunoProfile.escola?.nome && (
                                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 truncate">
                                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    <span className="truncate">{alunoProfile.escola.nome}</span>
                                </p>
                            )}
                        </div>

                        <div className="hidden md:flex items-center gap-3">
                            <div className={`px-4 py-2 rounded-xl ${mediaGeral ? getGradeBgColor(mediaGeral) : 'bg-slate-100'} border`}>
                                <p className="text-xs text-slate-500 mb-0.5">Média</p>
                                <p className={`text-xl font-bold ${mediaGeral ? getGradeColor(mediaGeral) : 'text-slate-400'}`}>
                                    {mediaGeral ? mediaGeral.toFixed(1) : '--'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-4 pb-3 md:pb-0 overflow-x-auto scrollbar-hide">
                    <div className="flex gap-2 min-w-max">
                        {[1, 2, 3].map((t) => (
                            <button
                                key={t}
                                onClick={() => setSelectedTrimestre(t as 1 | 2 | 3)}
                                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 whitespace-nowrap ${selectedTrimestre === t
                                    ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-500/30 scale-105'
                                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                                    }`}
                            >
                                {t}º Trimestre
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="px-4 md:px-6 pt-4">
                {/* Quick Stats - Mobile Only */}
                <div className="grid grid-cols-3 gap-3 mb-5 md:hidden">
                    <div className={`p-3 rounded-2xl ${mediaGeral ? getGradeBgColor(mediaGeral) : 'bg-slate-100'} border text-center`}>
                        <p className={`text-2xl font-bold ${mediaGeral ? getGradeColor(mediaGeral) : 'text-slate-400'}`}>
                            {mediaGeral ? mediaGeral.toFixed(1) : '--'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Média</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                        <p className="text-2xl font-bold text-emerald-600">{aprovadas}</p>
                        <p className="text-xs text-slate-500 mt-1">Aprovado</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-center">
                        <p className="text-2xl font-bold text-red-600">{reprovadas}</p>
                        <p className="text-xs text-slate-500 mt-1">Reprovado</p>
                    </div>
                </div>

                {loading && (
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-full border-4 border-slate-200"></div>
                            <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-primary-600 border-t-transparent animate-spin"></div>
                        </div>
                        <p className="text-slate-600 mt-4 font-medium">Carregando notas...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-2xl p-5 mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-200 rounded-xl flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold text-red-800">Erro ao carregar</p>
                                <p className="text-sm text-red-600">{error}</p>
                            </div>
                        </div>
                        <button onClick={loadGrades} className="mt-4 w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors">
                            Tentar Novamente
                        </button>
                    </div>
                )}

                {!loading && !error && (
                    <div className="space-y-4">
                        {disciplinas.map((disciplina) => {
                            const isExpanded = expandedDisciplina === disciplina.id
                            // Filter components to only those with grades in this trimester
                            const componentesComNotas = disciplina.componentes.filter(
                                comp => disciplina.notas.some(n => n.componente_id === comp.id)
                            )

                            return (
                                <div
                                    key={disciplina.id}
                                    className={`bg-white rounded-2xl shadow-sm border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-primary-300 shadow-lg shadow-primary-500/10' : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    <button
                                        onClick={() => setExpandedDisciplina(isExpanded ? null : disciplina.id)}
                                        className="w-full p-4 flex items-center gap-4 text-left"
                                    >
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${disciplina.notaFinal
                                            ? getGradeBgColor(disciplina.notaFinal.nota_final) + ' border'
                                            : 'bg-slate-100 border border-slate-200'
                                            }`}>
                                            <span className={`text-xl font-bold ${disciplina.notaFinal ? getGradeColor(disciplina.notaFinal.nota_final) : 'text-slate-400'
                                                }`}>
                                                {disciplina.notaFinal ? Math.round(disciplina.notaFinal.nota_final) : '--'}
                                            </span>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-900 truncate">{disciplina.nome}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-slate-500">{disciplina.codigo_disciplina}</span>
                                                {disciplina.notaFinal?.classificacao && (
                                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getClassificationColor(disciplina.notaFinal.classificacao)}`}>
                                                        {disciplina.notaFinal.classificacao}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className={`w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-primary-100' : ''}`}>
                                            <svg className={`w-5 h-5 ${isExpanded ? 'text-primary-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50 to-white">
                                            <div className="p-4 space-y-3">
                                                {componentesComNotas.length > 0 ? (
                                                    componentesComNotas.map((componente) => {
                                                        const nota = disciplina.notas.find(n => n.componente_id === componente.id)
                                                        return (
                                                            <div key={componente.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                                                                <div className="flex-1 min-w-0 pr-4">
                                                                    <p className="font-medium text-slate-800 truncate">{componente.nome}</p>
                                                                    <p className="text-xs text-slate-500">{componente.codigo_componente}</p>
                                                                </div>
                                                                <div className={`w-16 h-10 rounded-xl flex items-center justify-center ${nota ? getGradeBgColor(nota.valor) + ' border' : 'bg-slate-100'
                                                                    }`}>
                                                                    <span className={`text-lg font-bold ${nota ? getGradeColor(nota.valor) : 'text-slate-400'}`}>
                                                                        {nota ? nota.valor.toFixed(1) : '--'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )
                                                    })
                                                ) : (
                                                    <p className="text-center text-slate-400 py-6">Sem avaliações neste trimestre</p>
                                                )}
                                            </div>

                                            {disciplina.notaFinal && (
                                                <div className="p-4 bg-gradient-to-r from-slate-100 to-slate-50 border-t border-slate-200">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-semibold text-slate-600">Nota Final do Trimestre</span>
                                                        <span className={`text-2xl font-bold ${getGradeColor(disciplina.notaFinal.nota_final)}`}>
                                                            {disciplina.notaFinal.nota_final.toFixed(1)}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {disciplinas.length === 0 && (
                            <div className="text-center py-16">
                                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center">
                                    <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Sem disciplinas</h3>
                                <p className="text-slate-600 max-w-xs mx-auto">Não foram encontradas disciplinas para o {selectedTrimestre}º trimestre.</p>
                            </div>
                        )}
                    </div>
                )}

                {!loading && !error && disciplinas.length > 0 && (
                    <div className="hidden md:block mt-6 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            Resumo do {selectedTrimestre}º Trimestre
                        </h3>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-200">
                                <p className="text-3xl font-bold text-slate-800">{disciplinas.length}</p>
                                <p className="text-sm text-slate-500 mt-1">Disciplinas</p>
                            </div>
                            <div className={`rounded-xl p-4 text-center border ${mediaGeral ? getGradeBgColor(mediaGeral) : 'bg-slate-50 border-slate-200'}`}>
                                <p className={`text-3xl font-bold ${mediaGeral ? getGradeColor(mediaGeral) : 'text-slate-400'}`}>
                                    {mediaGeral ? mediaGeral.toFixed(1) : '--'}
                                </p>
                                <p className="text-sm text-slate-500 mt-1">Média Geral</p>
                            </div>
                            <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-200">
                                <p className="text-3xl font-bold text-emerald-600">{aprovadas}</p>
                                <p className="text-sm text-slate-500 mt-1">Aprovado</p>
                            </div>
                            <div className="bg-red-50 rounded-xl p-4 text-center border border-red-200">
                                <p className="text-3xl font-bold text-red-600">{reprovadas}</p>
                                <p className="text-sm text-slate-500 mt-1">Reprovado</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Bottom Navigation */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-6 py-3 md:hidden z-40">
                <div className="flex items-center justify-around">
                    <button
                        onClick={() => setActiveTab('notas')}
                        className={`flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-colors ${activeTab === 'notas' ? 'text-primary-600' : 'text-slate-400'}`}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span className="text-xs font-medium">Notas</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('resumo')}
                        className={`flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-colors ${activeTab === 'resumo' ? 'text-primary-600' : 'text-slate-400'}`}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span className="text-xs font-medium">Resumo</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('perfil')}
                        className={`flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-colors ${activeTab === 'perfil' ? 'text-primary-600' : 'text-slate-400'}`}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-xs font-medium">Perfil</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
