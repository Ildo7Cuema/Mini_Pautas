/*
component-meta:
  name: PautaGeralPreview
  description: Preview component for Pauta-Geral data with mobile-first responsive design
  tokens: [--color-primary, --fs-sm]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import { useState } from 'react'
import { Card, CardBody } from './ui/Card'
import { GradeColorConfig, getGradeColorFromConfig } from '../utils/gradeColorConfigUtils'
import { formatComponentePautaLabel } from '../utils/pautaGeralFieldUtils'
import { computePautaGeralAlunoMetrics } from '../utils/pautaGeralExportUtils'

interface ComponenteAvaliacao {
    id: string
    codigo_componente: string
    nome: string
    peso_percentual: number
    trimestre: number
    is_calculated?: boolean
    tipo_calculo?: 'trimestral' | 'anual'
}

interface DisciplinaComComponentes {
    id: string
    nome: string
    codigo_disciplina: string
    ordem: number
    componentes: ComponenteAvaliacao[]
}

interface PautaGeralData {
    turma: {
        nome: string
        ano_lectivo: number
        codigo_turma: string
        nivel_ensino: string
    }
    trimestre: number
    nivel_ensino?: string
    classe?: string
    alunos: Array<{
        numero_processo: string
        nome_completo: string
        genero?: 'M' | 'F'
        frequencia_anual?: number
        notas_por_disciplina: Record<string, Record<string, number>>
        media_geral: number
        observacao: 'Transita' | 'Não Transita' | 'Condicional' | 'AguardandoNotas'
        motivos: string[]
        disciplinas_em_risco: string[]
        acoes_recomendadas: string[]
        observacao_padronizada: string
        motivo_retencao?: string
        matricula_condicional: boolean
    }>
    disciplinas: DisciplinaComComponentes[]
    estatisticas?: {
        por_disciplina: Record<string, any>
        geral: any
    }
}

interface FieldSelection {
    disciplinas: string[]
    includeAllDisciplinas: boolean
    componentes: string[]
    includeAllComponentes: boolean
    includeLancamentoComponentes?: boolean
    showStatistics: boolean
    showNumeroProcesso: boolean
    showNomeCompleto: boolean
    showMediaGeral: boolean
    showObservacao: boolean
    componenteParaMediaGeral: string
}

interface Props {
    data: PautaGeralData
    loading: boolean
    colorConfig: GradeColorConfig | null
    fieldSelection: FieldSelection
    disciplinasObrigatorias?: string[]
    /** Full disciplinas (all components) for MG/OBS — respects componenteParaMediaGeral even if column hidden. */
    disciplinasMetricas?: DisciplinaComComponentes[]
}

export const PautaGeralPreview: React.FC<Props> = ({
    data,
    loading,
    colorConfig,
    fieldSelection,
    disciplinasObrigatorias,
    disciplinasMetricas,
}) => {
    const [expandedStudent, setExpandedStudent] = useState<string | null>(null)

    if (loading) {
        return (
            <Card className="overflow-hidden border-0 shadow-lg">
                <CardBody className="p-6">
                    {/* Skeleton Loader */}
                    <div className="space-y-4 animate-pulse">
                        <div className="h-6 bg-slate-200 rounded-lg w-1/3"></div>
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex gap-4 items-center">
                                    <div className="h-4 bg-slate-200 rounded w-12"></div>
                                    <div className="h-4 bg-slate-200 rounded flex-1"></div>
                                    <div className="h-4 bg-slate-200 rounded w-16"></div>
                                    <div className="h-4 bg-slate-200 rounded w-20"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardBody>
            </Card>
        )
    }

    const getGradeColor = (nota: number, isCalculated: boolean = false): string => {
        const result = getGradeColorFromConfig(
            nota,
            data.nivel_ensino,
            data.classe,
            isCalculated,
            colorConfig
        )
        return result.color
    }

    // Filter to show only selected disciplines (columns already filtered in data)
    const visibleDisciplinas = data.disciplinas.filter(d =>
        fieldSelection.includeAllDisciplinas || fieldSelection.disciplinas.includes(d.id)
    )

    // MG/OBS follow user config: selected disciplines + componenteParaMediaGeral (from full template if provided)
    const calculateClassificationForSelectedDisciplinas = (aluno: any) => {
        const metricDisciplinas = visibleDisciplinas.map((d) => {
            const full = disciplinasMetricas?.find((x) => x.id === d.id)
            return {
                id: d.id,
                nome: d.nome,
                componentes: full?.componentes ?? d.componentes,
            }
        })

        const metrics = computePautaGeralAlunoMetrics(aluno, metricDisciplinas, {
            componenteParaMediaGeral: fieldSelection.componenteParaMediaGeral,
            nivelEnsino: data.nivel_ensino || data.turma.nivel_ensino,
            classe: data.classe,
            disciplinasObrigatorias,
        })

        return {
            media: metrics.media_geral,
            observacao: metrics.observacao as 'Transita' | 'Não Transita' | 'Condicional' | 'AguardandoNotas',
            motivos: metrics.motivos,
            disciplinas_em_risco: metrics.disciplinas_em_risco,
            acoes_recomendadas: [] as string[],
        }
    }

    // Status badge component
    const StatusBadge = ({ observacao, matriculaCondicional }: { observacao: string; matriculaCondicional: boolean }) => (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${observacao === 'Transita' ? 'bg-blue-100 text-blue-700' :
                observacao === 'Condicional' ? 'bg-amber-100 text-amber-700' :
                    observacao === 'AguardandoNotas' ? 'bg-slate-100 text-slate-600' :
                        'bg-red-100 text-red-700'
                }`}>
                {observacao === 'Transita' && (
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                )}
                {observacao}
            </span>
            {matriculaCondicional && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                    📝 Cond.
                </span>
            )}
        </div>
    )

    // Mobile Student Card Component
    const StudentCard = ({ aluno, index }: { aluno: any; index: number }) => {
        const { media: mediaGeralDinamica, observacao: observacaoDinamica } = calculateClassificationForSelectedDisciplinas(aluno)
        const isExpanded = expandedStudent === aluno.numero_processo

        return (
            <div
                className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden ${isExpanded ? 'shadow-lg border-blue-200' : 'shadow-sm border-slate-200 hover:shadow-md'
                    }`}
                style={{ animationDelay: `${index * 50}ms` }}
            >
                {/* Card Header - Always Visible */}
                <button
                    onClick={() => setExpandedStudent(isExpanded ? null : aluno.numero_processo)}
                    className="w-full p-4 flex items-center gap-3 text-left"
                >
                    {/* Student Number */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-sm font-bold text-blue-700">{index + 1}</span>
                    </div>

                    {/* Name & Info */}
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{aluno.nome_completo}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            {aluno.genero && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${aluno.genero === 'M' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'
                                    }`}>
                                    {aluno.genero}
                                </span>
                            )}
                            <span className="text-xs text-slate-500">Proc: {aluno.numero_processo}</span>
                        </div>
                    </div>

                    {/* Average & Status */}
                    <div className="flex-shrink-0 text-right">
                        <div className="text-lg font-bold text-slate-900">{mediaGeralDinamica.toFixed(1)}</div>
                        <StatusBadge observacao={observacaoDinamica} matriculaCondicional={aluno.matricula_condicional} />
                    </div>

                    {/* Expand Arrow */}
                    <svg
                        className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {/* Expanded Content - Grades by Discipline */}
                {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-3 animate-slide-up">
                        {/* Frequency */}
                        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white border border-slate-200">
                            <span className="text-sm font-medium text-slate-600">Frequência Anual</span>
                            <span className={`text-sm font-bold ${aluno.frequencia_anual !== undefined && aluno.frequencia_anual < 66.67
                                ? 'text-red-600'
                                : 'text-green-600'
                                }`}>
                                {aluno.frequencia_anual !== undefined ? `${aluno.frequencia_anual.toFixed(1)}%` : 'N/A'}
                            </span>
                        </div>

                        {/* Grades by Discipline */}
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Notas por Disciplina</p>
                            {visibleDisciplinas.map(disciplina => {
                                const notasDisciplina = aluno.notas_por_disciplina[disciplina.id] || {}
                                const visibleComponentes = disciplina.componentes.filter(c =>
                                    fieldSelection.componentes.includes(c.id)
                                )

                                if (visibleComponentes.length === 0) return null

                                return (
                                    <div key={disciplina.id} className="bg-white rounded-lg border border-slate-200 p-3">
                                        <p className="text-sm font-semibold text-blue-700 mb-2">{disciplina.nome}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {visibleComponentes.map(componente => {
                                                const nota = notasDisciplina[componente.id]
                                                const hasNota = nota !== undefined && nota !== null
                                                const color = hasNota ? getGradeColor(nota, componente.is_calculated || false) : '#64748b'
                                                const isFinal = ['MF', 'MFD', 'MEC'].includes(componente.codigo_componente)

                                                return (
                                                    <div
                                                        key={componente.id}
                                                        className={`flex flex-col items-center px-2.5 py-1.5 rounded-lg ${isFinal ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'
                                                            }`}
                                                    >
                                                        <span className="text-[10px] text-slate-500 font-medium">
                                                            {formatComponentePautaLabel(componente)}
                                                        </span>
                                                        <span
                                                            className="text-sm font-bold"
                                                            style={{ color }}
                                                        >
                                                            {hasNota ? nota.toFixed(1) : '-'}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        )
    }


    return (
        <Card className="overflow-hidden border-0 shadow-lg bg-white">
            <CardBody className="p-0">
                {/* Mobile View - Cards */}
                <div className="md:hidden p-4 space-y-3">
                    {/* Summary Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                        <div>
                            <p className="text-sm font-semibold text-slate-700">{data.turma.nome}</p>
                            <p className="text-xs text-slate-500">{data.alunos.length} alunos</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-500">Ano Lectivo</p>
                            <p className="text-sm font-semibold text-slate-700">{data.turma.ano_lectivo}</p>
                        </div>
                    </div>

                    {/* Student Cards */}
                    <div className="space-y-2">
                        {data.alunos.map((aluno, index) => (
                            <StudentCard key={aluno.numero_processo} aluno={aluno} index={index} />
                        ))}
                    </div>
                </div>

                {/* Desktop View - Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                        <thead>
                            {/* First row: Discipline headers */}
                            <tr className="bg-gradient-to-r from-slate-50 to-slate-100">
                                {fieldSelection.showNumeroProcesso && (
                                    <th rowSpan={2} className="border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-50 sticky left-0 z-10">
                                        Nº
                                    </th>
                                )}
                                {fieldSelection.showNomeCompleto && (
                                    <th rowSpan={2} className="border border-slate-200 px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-50 sticky left-12 z-10 min-w-[200px]">
                                        Nome do Aluno
                                    </th>
                                )}
                                <th rowSpan={2} className="border border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-50">
                                    GÊN
                                </th>
                                {visibleDisciplinas.map((disciplina) => {
                                    const visibleComponentes = disciplina.componentes.filter(c =>
                                        fieldSelection.componentes.includes(c.id)
                                    )
                                    if (visibleComponentes.length === 0) return null

                                    return (
                                        <th
                                            key={disciplina.id}
                                            colSpan={visibleComponentes.length}
                                            className="border border-slate-200 px-2 py-2 text-center text-xs font-bold text-white uppercase tracking-wider bg-gradient-to-r from-blue-600 to-blue-700"
                                        >
                                            {disciplina.nome}
                                        </th>
                                    )
                                })}
                                {fieldSelection.showMediaGeral && (
                                    <th rowSpan={2} className="border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-amber-700 uppercase tracking-wider bg-amber-50">
                                        Média Geral
                                    </th>
                                )}
                                <th rowSpan={2} className="border border-slate-200 px-2 py-2 text-center text-xs font-semibold text-green-700 uppercase tracking-wider bg-green-50">
                                    Freq. %
                                </th>
                                {fieldSelection.showObservacao && (
                                    <th rowSpan={2} className="border border-slate-200 px-4 py-2 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-50">
                                        Observação
                                    </th>
                                )}
                            </tr>
                            {/* Second row: Component codes */}
                            <tr className="bg-slate-100">
                                {visibleDisciplinas.map((disciplina) => {
                                    const visibleComponentes = disciplina.componentes.filter(c =>
                                        fieldSelection.componentes.includes(c.id)
                                    )
                                    return visibleComponentes.map((componente) => (
                                        <th
                                            key={componente.id}
                                            className={`border border-slate-200 px-2 py-1.5 text-center text-xs font-semibold ${['MF', 'MFD', 'MEC'].includes(componente.codigo_componente)
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-slate-100 text-slate-600'
                                                }`}
                                        >
                                            {formatComponentePautaLabel(componente)}
                                        </th>
                                    ))
                                })}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {data.alunos.map((aluno, index) => {
                                // Calculate classification dynamically for selected disciplines
                                const {
                                    media: mediaGeralDinamica,
                                    observacao: observacaoDinamica
                                } = calculateClassificationForSelectedDisciplinas(aluno)

                                return (
                                    <tr
                                        key={index}
                                        className="hover:bg-blue-50/50 transition-colors"
                                    >
                                        {fieldSelection.showNumeroProcesso && (
                                            <td className="border border-slate-200 px-3 py-2 whitespace-nowrap text-sm text-slate-700 font-medium bg-white sticky left-0">
                                                {index + 1}
                                            </td>
                                        )}
                                        {fieldSelection.showNomeCompleto && (
                                            <td className="border border-slate-200 px-4 py-2 whitespace-nowrap text-sm text-slate-900 font-medium bg-white sticky left-12">
                                                {aluno.nome_completo}
                                            </td>
                                        )}
                                        <td className="border border-slate-200 px-2 py-2 whitespace-nowrap text-center text-sm text-slate-600 bg-white">
                                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${aluno.genero === 'M' ? 'bg-blue-100 text-blue-700' :
                                                aluno.genero === 'F' ? 'bg-pink-100 text-pink-700' :
                                                    'bg-slate-100 text-slate-500'
                                                }`}>
                                                {aluno.genero || '-'}
                                            </span>
                                        </td>
                                        {visibleDisciplinas.map((disciplina) => {
                                            const notasDisciplina = aluno.notas_por_disciplina[disciplina.id] || {}
                                            const visibleComponentes = disciplina.componentes.filter(c =>
                                                fieldSelection.componentes.includes(c.id)
                                            )

                                            return visibleComponentes.map((componente) => {
                                                const nota = notasDisciplina[componente.id]
                                                const hasNota = nota !== undefined && nota !== null
                                                const color = hasNota ? getGradeColor(nota, componente.is_calculated || false) : '#94a3b8'
                                                const isFinal = ['MF', 'MFD', 'MEC'].includes(componente.codigo_componente)

                                                return (
                                                    <td
                                                        key={componente.id}
                                                        className={`border border-slate-200 px-2 py-2 whitespace-nowrap text-center text-sm font-semibold ${isFinal ? 'bg-amber-50/50' : ''
                                                            }`}
                                                        style={{ color }}
                                                    >
                                                        {hasNota ? nota.toFixed(1) : '-'}
                                                    </td>
                                                )
                                            })
                                        })}
                                        {fieldSelection.showMediaGeral && (
                                            <td className="border border-slate-200 px-3 py-2 whitespace-nowrap text-center text-sm font-bold bg-amber-50 text-amber-800">
                                                {mediaGeralDinamica.toFixed(2)}
                                            </td>
                                        )}
                                        {/* Frequência */}
                                        <td className={`border border-slate-200 px-2 py-2 whitespace-nowrap text-center text-sm font-semibold ${aluno.frequencia_anual !== undefined && aluno.frequencia_anual !== null && aluno.frequencia_anual < 66.67
                                            ? 'bg-red-50 text-red-700'
                                            : 'bg-green-50 text-green-700'
                                            }`}>
                                            {aluno.frequencia_anual !== undefined && aluno.frequencia_anual !== null
                                                ? `${aluno.frequencia_anual.toFixed(1)}%`
                                                : 'N/A'
                                            }
                                        </td>
                                        {fieldSelection.showObservacao && (
                                            <td className="border border-slate-200 px-4 py-2">
                                                <StatusBadge observacao={observacaoDinamica} matriculaCondicional={aluno.matricula_condicional} />
                                            </td>
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Statistics */}
                {fieldSelection.showStatistics && data.estatisticas && (
                    <div className="p-5 border-t border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h4 className="text-sm font-semibold text-slate-800">Estatísticas Gerais</h4>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            {/* Total Students */}
                            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <p className="text-xs text-slate-500 font-medium">Total</p>
                                </div>
                                <p className="text-2xl font-bold text-slate-800">{data.estatisticas.geral.total_alunos}</p>
                            </div>

                            {/* Approved */}
                            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-xs text-emerald-600 font-medium">Aprovados</p>
                                </div>
                                <p className="text-2xl font-bold text-emerald-700">{data.estatisticas.geral.aprovados}</p>
                            </div>

                            {/* Failed */}
                            <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-4 border border-red-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-xs text-red-600 font-medium">Reprovados</p>
                                </div>
                                <p className="text-2xl font-bold text-red-700">{data.estatisticas.geral.reprovados}</p>
                            </div>

                            {/* Average */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    <p className="text-xs text-blue-600 font-medium">Média</p>
                                </div>
                                <p className="text-2xl font-bold text-blue-700">{data.estatisticas.geral.media_turma?.toFixed(2) || 'N/A'}</p>
                            </div>

                            {/* Min */}
                            <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-4 border border-purple-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                    </svg>
                                    <p className="text-xs text-purple-600 font-medium">Mínima</p>
                                </div>
                                <p className="text-2xl font-bold text-purple-700">{data.estatisticas.geral.nota_minima?.toFixed(2) || 'N/A'}</p>
                            </div>

                            {/* Max */}
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                    </svg>
                                    <p className="text-xs text-amber-600 font-medium">Máxima</p>
                                </div>
                                <p className="text-2xl font-bold text-amber-700">{data.estatisticas.geral.nota_maxima?.toFixed(2) || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                )}
            </CardBody>
        </Card>
    )
}
