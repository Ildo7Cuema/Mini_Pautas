/*
component-meta:
  name: MiniPautaPreviewSecundario
  description: Preview component for Secondary Education Mini-Pauta with mobile-first responsive design
  tokens: [--color-primary, --fs-sm]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import React, { useState } from 'react'
import { Card, CardBody } from './ui/Card'
import { GradeColorConfig, getGradeColorFromConfig } from '../utils/gradeColorConfigUtils'
import { getComponenteDisplayLabel, getComponenteTooltipLabel } from '../utils/gradeUtils'

interface TrimestreData {
    notas: Record<string, number>
    nota_final: number
}

interface MiniPautaPreviewSecundarioProps {
    data: {
        turma: {
            nome: string
            codigo_turma: string
            ano_lectivo: number
        }
        disciplina: {
            nome: string
            codigo_disciplina: string
        }
        trimestre: number | 'all'
        nivel_ensino?: string
        classe?: string
        alunos: Array<{
            numero_processo: string
            nome_completo: string
            genero?: 'M' | 'F'
            notas: Record<string, number>
            nota_final?: number
            media_trimestral?: number | null
            classificacao: string
            aprovado: boolean
            trimestres?: {
                1?: TrimestreData
                2?: TrimestreData
                3?: TrimestreData
            }
        }>
        componentes: Array<{
            id: string
            codigo_componente: string
            nome: string
            peso_percentual: number
            trimestre?: number
            ordem?: number
            is_calculated?: boolean
        }>
        showMT?: boolean
    }
    loading?: boolean
    colorConfig?: GradeColorConfig | null
}

/**
 * MiniPautaPreviewSecundario - Preview component for Secondary Education
 * 
 * Features:
 * - Mobile-first responsive design with expandable student cards
 * - Desktop table view with sticky headers
 * - Skeleton loading state
 * - Color-coded grades
 */
export const MiniPautaPreviewSecundario: React.FC<MiniPautaPreviewSecundarioProps> = ({
    data,
    loading,
    colorConfig
}) => {
    const [expandedStudent, setExpandedStudent] = useState<string | null>(null)

    // Loading state with skeleton
    if (loading) {
        return (
            <Card className="overflow-hidden border-0 shadow-lg">
                <CardBody className="p-6">
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

    // Empty state
    if (!data.alunos || data.alunos.length === 0) {
        return (
            <Card className="overflow-hidden border-0 shadow-lg">
                <CardBody className="p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-1">Nenhum dado disponível</h3>
                    <p className="text-sm text-slate-500">Selecione uma turma e disciplina para visualizar a mini-pauta</p>
                </CardBody>
            </Card>
        )
    }

    // Helper function to get grade style/color
    const getGradeStyle = (nota: number, isCalculated: boolean = false): React.CSSProperties => {
        const result = getGradeColorFromConfig(nota, data.nivel_ensino, data.classe, isCalculated, colorConfig || null)

        if (result.modoExibicao === 'fundo') {
            return {
                backgroundColor: result.color,
                color: '#ffffff',
                padding: '2px 6px',
                borderRadius: '4px',
                display: 'inline-block',
                lineHeight: '1.2'
            }
        }
        return { color: result.color }
    }

    // Check if this is all-trimester mode
    const isAllTrimesters = data.trimestre === 'all' && data.alunos[0]?.trimestres

    // Group by trimester and keep template position (ordem). Coerce trimestre so
    // string values from JSON/"3" still land in the correct column group.
    const byTrimestre = (t: number) =>
        data.componentes
            .filter((c) => Number(c.trimestre) === t)
            .slice()
            .sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0))

    const componentes1T = byTrimestre(1)
    const componentes2T = byTrimestre(2)
    const componentes3T = byTrimestre(3)

    // Calculate final grade for a student
    const getStudentFinalGrade = (aluno: any): number | null => {
        if (isAllTrimesters) {
            // Average of trimester finals - include zeros, only exclude undefined/null
            const finals = [1, 2, 3]
                .map(t => aluno.trimestres?.[t]?.nota_final)
                .filter((n): n is number => n !== undefined && n !== null)
            if (finals.length === 0) return null
            return finals.reduce((a, b) => a + b, 0) / finals.length
        } else {
            return aluno.nota_final ?? aluno.media_trimestral ?? null
        }
    }


    // Mobile Student Card Component
    const StudentCard = ({ aluno, index }: { aluno: any; index: number }) => {
        const isExpanded = expandedStudent === aluno.numero_processo
        const finalGrade = getStudentFinalGrade(aluno)

        return (
            <div
                className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden ${isExpanded ? 'shadow-lg border-blue-200' : 'shadow-sm border-slate-200 hover:shadow-md'
                    }`}
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

                    {/* Final Grade */}
                    <div className="flex-shrink-0 text-right">
                        {finalGrade !== null && (
                            <div
                                className="text-lg font-bold"
                                style={getGradeStyle(finalGrade, true)}
                            >
                                {finalGrade.toFixed(1)}
                            </div>
                        )}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${aluno.aprovado ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>
                            {aluno.aprovado ? 'Transita' : 'Não Transita'}
                        </span>
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

                {/* Expanded Content */}
                {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-3 animate-slide-up">
                        {isAllTrimesters ? (
                            // All Trimesters Mode
                            <div className="space-y-3">
                                {[1, 2, 3].map(trimestre => {
                                    const trimestreData = aluno.trimestres?.[trimestre]
                                    const componentesTrimestre = trimestre === 1 ? componentes1T : trimestre === 2 ? componentes2T : componentes3T

                                    if (componentesTrimestre.length === 0) return null

                                    return (
                                        <div key={trimestre} className="bg-white rounded-lg border border-slate-200 p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-sm font-semibold text-blue-700">{trimestre}º Trimestre</p>
                                                {trimestreData?.nota_final && (
                                                    <span
                                                        className="text-sm font-bold"
                                                        style={getGradeStyle(trimestreData.nota_final, true)}
                                                    >
                                                        Média: {trimestreData.nota_final.toFixed(1)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {componentesTrimestre.map(comp => {
                                                    const nota = trimestreData?.notas[comp.codigo_componente]
                                                    const hasNota = nota !== undefined && nota !== null
                                                    const isFinal = comp.is_calculated

                                                    return (
                                                        <div
                                                            key={comp.id}
                                                            className={`flex flex-col items-center px-2.5 py-1.5 rounded-lg ${isFinal ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'
                                                                }`}
                                                        >
                                                            <span className="text-[10px] text-slate-500 font-medium" title={getComponenteTooltipLabel(comp)}>
                                                                {getComponenteDisplayLabel(comp)}
                                                            </span>
                                                            <span
                                                                className="text-sm font-bold"
                                                                style={hasNota ? getGradeStyle(nota, isFinal || false) : { color: '#94a3b8' }}
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
                        ) : (
                            // Single Trimester Mode
                            <div className="bg-white rounded-lg border border-slate-200 p-3">
                                <p className="text-sm font-semibold text-blue-700 mb-2">{data.trimestre}º Trimestre</p>
                                <div className="flex flex-wrap gap-2">
                                    {data.componentes.map(comp => {
                                        const nota = aluno.notas[comp.codigo_componente]
                                        const hasNota = nota !== undefined && nota !== null
                                        const isFinal = comp.is_calculated

                                        return (
                                            <div
                                                key={comp.id}
                                                className={`flex flex-col items-center px-2.5 py-1.5 rounded-lg ${isFinal ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'
                                                    }`}
                                            >
                                                <span className="text-[10px] text-slate-500 font-medium" title={getComponenteTooltipLabel(comp)}>
                                                    {getComponenteDisplayLabel(comp)}
                                                </span>
                                                <span
                                                    className="text-sm font-bold"
                                                    style={hasNota ? getGradeStyle(nota, isFinal || false) : { color: '#94a3b8' }}
                                                >
                                                    {hasNota ? nota.toFixed(1) : '-'}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    // Render grade with color for table
    const renderGradeWithColor = (nota: number | undefined, isCalculated: boolean) => {
        if (nota === undefined || nota === null) {
            return <span className="text-slate-400">-</span>
        }
        const style = getGradeStyle(nota, isCalculated)
        return <span className="font-semibold" style={style}>{nota.toFixed(1)}</span>
    }

    return (
        <Card className="overflow-hidden border-0 shadow-lg bg-white">
            <CardBody className="p-0">
                {/* Mobile View - Cards */}
                <div className="md:hidden p-4 space-y-3">
                    {/* Summary Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                        <div>
                            <p className="text-sm font-semibold text-slate-700">{data.disciplina.nome}</p>
                            <p className="text-xs text-slate-500">{data.alunos.length} alunos</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-500">Trimestre</p>
                            <p className="text-sm font-semibold text-slate-700">
                                {data.trimestre === 'all' ? 'Todos' : `${data.trimestre}º`}
                            </p>
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
                            {isAllTrimesters ? (
                                // All Trimesters Header
                                <>
                                    <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                                        <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-left text-xs font-semibold sticky left-0 bg-blue-600 z-10">Nº</th>
                                        <th rowSpan={2} className="border border-slate-300 px-4 py-2 text-left text-xs font-semibold sticky left-12 bg-blue-600 z-10 min-w-[200px]">Nome do Aluno</th>
                                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 text-center text-xs font-semibold">GÊN</th>
                                        {componentes1T.length > 0 && (
                                            <th colSpan={componentes1T.length} className="border border-slate-300 px-2 py-2 text-center text-xs font-semibold bg-blue-700">
                                                1º Trimestre
                                            </th>
                                        )}
                                        {componentes2T.length > 0 && (
                                            <th colSpan={componentes2T.length} className="border border-slate-300 px-2 py-2 text-center text-xs font-semibold bg-blue-700">
                                                2º Trimestre
                                            </th>
                                        )}
                                        {componentes3T.length > 0 && (
                                            <th colSpan={componentes3T.length} className="border border-slate-300 px-2 py-2 text-center text-xs font-semibold bg-blue-700">
                                                3º Trimestre
                                            </th>
                                        )}
                                    </tr>
                                    <tr className="bg-slate-100">
                                        {[componentes1T, componentes2T, componentes3T].flatMap((componentes, tIndex) =>
                                            componentes.map((comp) => (
                                                <th
                                                    key={`${tIndex + 1}-${comp.id}`}
                                                    className={`border border-slate-200 px-2 py-1.5 text-center text-xs font-semibold ${comp.is_calculated ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-center gap-1" title={getComponenteTooltipLabel(comp)}>
                                                        {getComponenteDisplayLabel(comp)}
                                                        {comp.is_calculated && (
                                                            <span className="text-amber-500" title="Calculado">✦</span>
                                                        )}
                                                    </div>
                                                </th>
                                            ))
                                        )}
                                    </tr>
                                </>
                            ) : (
                                // Single Trimester Header
                                <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                                    <th className="border border-slate-300 px-3 py-2 text-left text-xs font-semibold sticky left-0 bg-blue-600 z-10">Nº</th>
                                    <th className="border border-slate-300 px-4 py-2 text-left text-xs font-semibold sticky left-12 bg-blue-600 z-10 min-w-[200px]">Nome do Aluno</th>
                                    <th className="border border-slate-300 px-2 py-2 text-center text-xs font-semibold">GÊN</th>
                                    {data.componentes.map((comp) => (
                                        <th
                                            key={comp.id}
                                            className={`border border-slate-300 px-2 py-2 text-center text-xs font-semibold ${comp.is_calculated ? 'bg-blue-500' : ''
                                                }`}
                                        >
                                            <div className="flex items-center justify-center gap-1" title={getComponenteTooltipLabel(comp)}>
                                                {getComponenteDisplayLabel(comp)}
                                                {comp.is_calculated && (
                                                    <span className="text-amber-300" title="Calculado">✦</span>
                                                )}
                                            </div>
                                            <div className="text-[10px] font-normal opacity-80">({comp.peso_percentual}%)</div>
                                        </th>
                                    ))}
                                </tr>
                            )}
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {data.alunos.map((aluno, index) => (
                                <tr key={aluno.numero_processo} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="border border-slate-200 px-3 py-2 text-sm text-slate-700 font-medium bg-white sticky left-0">{index + 1}</td>
                                    <td className="border border-slate-200 px-4 py-2 text-sm text-slate-900 font-medium bg-white sticky left-12">{aluno.nome_completo}</td>
                                    <td className="border border-slate-200 px-2 py-2 text-center">
                                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${aluno.genero === 'M' ? 'bg-blue-100 text-blue-700' :
                                            aluno.genero === 'F' ? 'bg-pink-100 text-pink-700' :
                                                'bg-slate-100 text-slate-500'
                                            }`}>
                                            {aluno.genero || '-'}
                                        </span>
                                    </td>

                                    {isAllTrimesters ? (
                                        // All Trimesters Data
                                        [1, 2, 3].flatMap(trimestre => {
                                            const componentesTrimestre = trimestre === 1 ? componentes1T : trimestre === 2 ? componentes2T : componentes3T
                                            return componentesTrimestre.map((comp) => {
                                                const nota = aluno.trimestres?.[trimestre as 1 | 2 | 3]?.notas[comp.codigo_componente]
                                                return (
                                                    <td
                                                        key={`${trimestre}-${comp.id}`}
                                                        className={`border border-slate-200 px-2 py-2 text-center text-sm ${comp.is_calculated ? 'bg-amber-50/50' : ''
                                                            }`}
                                                    >
                                                        {renderGradeWithColor(nota, comp.is_calculated || false)}
                                                    </td>
                                                )
                                            })
                                        })
                                    ) : (
                                        // Single Trimester Data
                                        data.componentes.map((comp) => {
                                            const nota = aluno.notas[comp.codigo_componente]
                                            return (
                                                <td
                                                    key={comp.id}
                                                    className={`border border-slate-200 px-2 py-2 text-center text-sm ${comp.is_calculated ? 'bg-amber-50/50' : ''
                                                        }`}
                                                >
                                                    {renderGradeWithColor(nota, comp.is_calculated || false)}
                                                </td>
                                            )
                                        })
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardBody>
        </Card>
    )
}
