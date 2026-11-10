/*
component-meta:
  name: MiniPautaPreviewPrimario
  description: Preview component for Primary Education Mini-Pauta with mobile-first responsive design
  tokens: [--color-primary, --fs-sm]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import React, { useState } from 'react'
import { Card, CardBody } from './ui/Card'
import { GradeColorConfig, getGradeColorFromConfig } from '../utils/gradeColorConfigUtils'
import { getComponenteDisplayLabel, getComponenteTooltipLabel } from '../utils/gradeUtils'
import { darkenHexColor } from '../utils/headerConfigUtils'

interface MiniPautaPreviewPrimarioProps {
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
        }>
        componentes: Array<{
            id: string
            codigo_componente: string
            nome: string
            peso_percentual: number
            trimestre?: number
            is_calculated?: boolean
            disciplina_nome?: string
            disciplina_ordem?: number
        }>
        showMT?: boolean
    }
    loading?: boolean
    colorConfig?: GradeColorConfig | null
    mapHeaderColor?: string
}

/**
 * Groups components by discipline name for Primary Education format
 */
interface DisciplineGroup {
    disciplina_nome: string
    ordem?: number
    componentes: Array<{ id: string; codigo_componente: string; nome?: string; is_calculated?: boolean }>
}

const groupComponentsByDiscipline = (componentes: MiniPautaPreviewPrimarioProps['data']['componentes']): DisciplineGroup[] => {
    const disciplineMap = new Map<string, DisciplineGroup>()

    componentes.forEach(comp => {
        const disciplineName = comp.disciplina_nome || 'Sem Disciplina'

        if (!disciplineMap.has(disciplineName)) {
            disciplineMap.set(disciplineName, {
                disciplina_nome: disciplineName,
                ordem: comp.disciplina_ordem,
                componentes: []
            })
        }

        const group = disciplineMap.get(disciplineName)!
        group.componentes.push({
            id: comp.id,
            codigo_componente: comp.codigo_componente,
            nome: comp.nome,
            is_calculated: comp.is_calculated
        })
    })

    // Sort by ordem if available, otherwise fall back to alphabetical sorting
    return Array.from(disciplineMap.values()).sort((a, b) => {
        if (a.ordem !== undefined && b.ordem !== undefined) {
            return a.ordem - b.ordem
        }
        return a.disciplina_nome.localeCompare(b.disciplina_nome)
    })
}

/**
 * MiniPautaPreviewPrimario - Preview component for Primary Education
 * 
 * Features:
 * - Mobile-first responsive design with expandable student cards
 * - Desktop table view with sticky headers
 * - Skeleton loading state
 * - Color-coded grades
 * - Groups by discipline for multi-discipline mode
 */
export const MiniPautaPreviewPrimario: React.FC<MiniPautaPreviewPrimarioProps> = ({
    data,
    loading,
    colorConfig,
    mapHeaderColor
}) => {
    const [expandedStudent, setExpandedStudent] = useState<string | null>(null)
    const headerBg = mapHeaderColor || '#16a34a'
    const headerBgAlt = darkenHexColor(headerBg, 0.12)

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
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-green-100 flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

    // Check if this is all disciplines mode
    const isAllDisciplines = data.componentes.length > 0 &&
        data.componentes.some(c => c.disciplina_nome) &&
        new Set(data.componentes.map(c => c.disciplina_nome)).size > 1

    const disciplineGroups = isAllDisciplines ? groupComponentsByDiscipline(data.componentes) : []

    // Mobile Student Card Component
    const StudentCard = ({ aluno, index }: { aluno: any; index: number }) => {
        const isExpanded = expandedStudent === aluno.numero_processo
        const finalGrade = aluno.nota_final ?? aluno.media_trimestral ?? null

        return (
            <div
                className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden ${isExpanded ? 'shadow-lg border-green-200' : 'shadow-sm border-slate-200 hover:shadow-md'
                    }`}
            >
                {/* Card Header - Always Visible */}
                <button
                    onClick={() => setExpandedStudent(isExpanded ? null : aluno.numero_processo)}
                    className="w-full p-4 flex items-center gap-3 text-left"
                >
                    {/* Student Number */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <span className="text-sm font-bold text-green-700">{index + 1}</span>
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
                        {isAllDisciplines ? (
                            // All Disciplines Mode
                            <div className="space-y-2">
                                {disciplineGroups.map(group => (
                                    <div key={group.disciplina_nome} className="bg-white rounded-lg border border-slate-200 p-3">
                                        <p className="text-sm font-semibold text-green-700 mb-2">{group.disciplina_nome}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {group.componentes.map(comp => {
                                                const nota = aluno.notas[comp.id]
                                                const hasNota = nota !== undefined && nota !== null
                                                const isFinal = comp.is_calculated

                                                return (
                                                    <div
                                                        key={comp.id}
                                                        className={`flex flex-col items-center px-2.5 py-1.5 rounded-lg ${isFinal ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'
                                                            }`}
                                                    >
                                                        <span className="text-[10px] text-slate-500 font-medium max-w-[7rem] truncate" title={getComponenteTooltipLabel(comp)}>
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
                                ))}
                            </div>
                        ) : (
                            // Single Discipline Mode
                            <div className="bg-white rounded-lg border border-slate-200 p-3">
                                <p className="text-sm font-semibold text-green-700 mb-2">{data.disciplina.nome}</p>
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
                                                <span className="text-[10px] text-slate-500 font-medium max-w-[7rem] truncate" title={getComponenteTooltipLabel(comp)}>
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
                            <p className="text-sm font-semibold text-slate-700">
                                {isAllDisciplines ? 'Todas as Disciplinas' : data.disciplina.nome}
                            </p>
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
                            {isAllDisciplines ? (
                                // All Disciplines Header
                                <>
                                    <tr className="text-white" style={{ backgroundColor: headerBg }}>
                                        <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-left text-xs font-semibold sticky left-0 z-10" style={{ backgroundColor: headerBg }}>Nº</th>
                                        <th rowSpan={2} className="border border-slate-300 px-4 py-2 text-left text-xs font-semibold sticky left-12 z-10 min-w-[200px]" style={{ backgroundColor: headerBg }}>Nome do Aluno</th>
                                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 text-center text-xs font-semibold">GÊN</th>
                                        {disciplineGroups.map((group) => (
                                            <th
                                                key={group.disciplina_nome}
                                                colSpan={group.componentes.length}
                                                className="border border-slate-300 px-2 py-2 text-center text-xs font-semibold" style={{ backgroundColor: headerBgAlt }}
                                            >
                                                {group.disciplina_nome}
                                            </th>
                                        ))}
                                    </tr>
                                    <tr className="bg-slate-100">
                                        {disciplineGroups.flatMap((group) =>
                                            group.componentes.map((comp) => (
                                                <th
                                                    key={comp.id}
                                                    className={`border border-slate-200 px-2 py-1.5 text-center text-xs font-semibold ${comp.is_calculated ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-center gap-1 max-w-[8rem] mx-auto" title={getComponenteTooltipLabel(comp)}>
                                                        <span className="truncate">{getComponenteDisplayLabel(comp)}</span>
                                                        {comp.is_calculated && (
                                                            <span className="text-amber-500 shrink-0" title="Calculado">✦</span>
                                                        )}
                                                    </div>
                                                </th>
                                            ))
                                        )}
                                    </tr>
                                </>
                            ) : (
                                // Single Discipline Header
                                <tr className="text-white" style={{ backgroundColor: headerBg }}>
                                    <th className="border border-slate-300 px-3 py-2 text-left text-xs font-semibold sticky left-0 z-10" style={{ backgroundColor: headerBg }}>Nº</th>
                                    <th className="border border-slate-300 px-4 py-2 text-left text-xs font-semibold sticky left-12 z-10 min-w-[200px]" style={{ backgroundColor: headerBg }}>Nome do Aluno</th>
                                    <th className="border border-slate-300 px-2 py-2 text-center text-xs font-semibold">GÊN</th>
                                    {data.componentes.map((comp) => (
                                        <th
                                            key={comp.id}
                                            className={`border border-slate-300 px-2 py-2 text-center text-xs font-semibold ${comp.is_calculated ? 'bg-green-500' : ''
                                                }`}
                                        >
                                            <div className="flex items-center justify-center gap-1 max-w-[8rem] mx-auto" title={getComponenteTooltipLabel(comp)}>
                                                <span className="truncate">{getComponenteDisplayLabel(comp)}</span>
                                                {comp.is_calculated && (
                                                    <span className="text-amber-300 shrink-0" title="Calculado">✦</span>
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
                                <tr key={aluno.numero_processo} className="hover:bg-green-50/50 transition-colors">
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

                                    {isAllDisciplines ? (
                                        // All Disciplines Data
                                        disciplineGroups.flatMap((group) =>
                                            group.componentes.map((comp) => {
                                                const nota = aluno.notas[comp.id]
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
                                        )
                                    ) : (
                                        // Single Discipline Data
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
