/*
component-meta:
  name: TermoFrequenciaPreview
  description: Preview component for Termo de Frequência do Aluno
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import React, { useState } from 'react'
import { Card, CardHeader, CardBody } from './ui/Card'
import { GradeColorConfig, getGradeColorFromConfig } from '../utils/gradeColorConfigUtils'
import { DEFAULT_MAP_HEADER_COLOR, darkenHexColor } from '../utils/headerConfigUtils'
import {
    FREQUENCIA_MINIMA_PERCENT,
    frequenciaDeficitPercent,
    isAttendanceSufficient,
    normalizeFrequenciaPercent,
} from '../utils/studentClassification'
import { AvaliacaoFrequenciaLegalNote } from './AvaliacaoFrequenciaLegalNote'

interface ComponenteNota {
    codigo: string
    nome: string
    nota: number | null
    is_calculated?: boolean
}

interface DisciplinaTermoFrequencia {
    id: string
    nome: string
    codigo_disciplina: string
    notas_trimestrais: {
        1: number | null
        2: number | null
        3: number | null
    }
    componentesPorTrimestre: {
        1: ComponenteNota[]
        2: ComponenteNota[]
        3: ComponenteNota[]
    }
    nota_final: number | null
    classificacao: string
    transita: boolean
}

interface TermoFrequenciaData {
    aluno: {
        numero_processo: string
        nome_completo: string
        data_nascimento?: string
        genero?: string
        nacionalidade?: string
        naturalidade?: string
        tipo_documento?: string
        numero_documento?: string
        nome_pai?: string
        nome_mae?: string
        nome_encarregado?: string
        parentesco_encarregado?: string
        telefone_encarregado?: string
        email_encarregado?: string
        profissao_encarregado?: string
        provincia?: string
        municipio?: string
        bairro?: string
        rua?: string
        endereco?: string
        ano_ingresso?: number
        escola_anterior?: string
        classe_anterior?: string
        observacoes_academicas?: string
        frequencia_anual?: number
        tipo_exame?: 'Nacional' | 'Extraordinário' | 'Recurso'
    }
    turma: {
        nome: string
        ano_lectivo: number
        codigo_turma: string
        nivel_ensino: string
    }
    disciplinas: DisciplinaTermoFrequencia[]
    estatisticas: {
        media_geral: number
        total_disciplinas: number
        disciplinas_aprovadas: number
        disciplinas_reprovadas: number
        transita: boolean
        observacao_padronizada?: string
        motivo_retencao?: string
        matricula_condicional?: boolean
    }
    escola?: {
        nome: string
        provincia: string
        municipio: string
    }
}

interface TermoFrequenciaPreviewProps {
    data: TermoFrequenciaData
    colorConfig?: GradeColorConfig | null
    componentAlignment?: 'left' | 'center' | 'right'
    componentOrder?: string[] // Custom order of component codes
    mapHeaderColor?: string
}


export const TermoFrequenciaPreview: React.FC<TermoFrequenciaPreviewProps> = ({ data, colorConfig, componentAlignment = 'center', componentOrder, mapHeaderColor }) => {
    const [isStudentInfoExpanded, setIsStudentInfoExpanded] = useState(false)
    const headerBg = mapHeaderColor || DEFAULT_MAP_HEADER_COLOR
    const headerBgAlt = darkenHexColor(headerBg, 0.12)
    // Extract classe from turma name (e.g., "4ª Classe A" -> "4ª Classe")
    const extractClasse = (turmaName: string): string | undefined => {
        const match = turmaName.match(/(\d+[ªº]\s*Classe)/i)
        return match ? match[1] : undefined
    }

    const classe = extractClasse(data.turma.nome)

    // Helper function to get grade color
    const getGradeColor = (nota: number, isCalculated: boolean = false): string => {
        const result = getGradeColorFromConfig(
            nota,
            data.turma.nivel_ensino,
            classe,
            isCalculated,
            colorConfig || null
        )
        return result.color
    }

    // Get alignment class based on prop
    const getAlignmentClass = () => {
        switch (componentAlignment) {
            case 'left': return 'text-left'
            case 'right': return 'text-right'
            default: return 'text-center'
        }
    }
    return (
        <div className="space-y-6">
            {/* Student Information Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-900">Informações do Aluno</h3>
                        <button
                            onClick={() => setIsStudentInfoExpanded(!isStudentInfoExpanded)}
                            className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <svg
                                className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${isStudentInfoExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                </CardHeader>
                {isStudentInfoExpanded && (
                    <CardBody>
                        {/* Dados Básicos */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                            <div>
                                <p className="text-sm text-slate-500">Nome Completo</p>
                                <p className="font-medium text-slate-900">{data.aluno.nome_completo}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Número de Processo</p>
                                <p className="font-medium text-slate-900">{data.aluno.numero_processo}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Turma</p>
                                <p className="font-medium text-slate-900">{data.turma.nome}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Ano Lectivo</p>
                                <p className="font-medium text-slate-900">{data.turma.ano_lectivo}</p>
                            </div>
                            {data.aluno.data_nascimento && (
                                <div>
                                    <p className="text-sm text-slate-500">Data de Nascimento</p>
                                    <p className="font-medium text-slate-900">{data.aluno.data_nascimento}</p>
                                </div>
                            )}
                            {data.aluno.genero && (
                                <div>
                                    <p className="text-sm text-slate-500">Género</p>
                                    <p className="font-medium text-slate-900">{data.aluno.genero === 'M' ? 'Masculino' : 'Feminino'}</p>
                                </div>
                            )}
                            {data.aluno.nacionalidade && (
                                <div>
                                    <p className="text-sm text-slate-500">Nacionalidade</p>
                                    <p className="font-medium text-slate-900">{data.aluno.nacionalidade}</p>
                                </div>
                            )}
                            {data.aluno.naturalidade && (
                                <div>
                                    <p className="text-sm text-slate-500">Naturalidade</p>
                                    <p className="font-medium text-slate-900">{data.aluno.naturalidade}</p>
                                </div>
                            )}
                            {data.aluno.tipo_documento && data.aluno.numero_documento && (
                                <div>
                                    <p className="text-sm text-slate-500">{data.aluno.tipo_documento}</p>
                                    <p className="font-medium text-slate-900">{data.aluno.numero_documento}</p>
                                </div>
                            )}
                            {data.aluno.frequencia_anual !== undefined && data.aluno.frequencia_anual !== null && (
                                <div>
                                    <p className="text-sm text-slate-500">Frequência Anual</p>
                                    <p className={`font-bold text-lg ${isAttendanceSufficient(data.aluno.frequencia_anual) ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                        {normalizeFrequenciaPercent(data.aluno.frequencia_anual).toFixed(1)}%
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Mínimo oficial: {FREQUENCIA_MINIMA_PERCENT.toFixed(2).replace('.', ',')}%
                                    </p>
                                </div>
                            )}
                            {data.aluno.tipo_exame && (
                                <div>
                                    <p className="text-sm text-slate-500">Tipo de Exame</p>
                                    <p className="font-medium text-orange-600">{data.aluno.tipo_exame}</p>
                                </div>
                            )}
                        </div>

                        {/* Filiação */}
                        {(data.aluno.nome_pai || data.aluno.nome_mae) && (
                            <div className="border-t border-slate-200 pt-4 mb-4">
                                <h4 className="text-sm font-semibold text-slate-700 mb-3">Filiação</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {data.aluno.nome_pai && (
                                        <div>
                                            <p className="text-sm text-slate-500">Nome do Pai</p>
                                            <p className="font-medium text-slate-900">{data.aluno.nome_pai}</p>
                                        </div>
                                    )}
                                    {data.aluno.nome_mae && (
                                        <div>
                                            <p className="text-sm text-slate-500">Nome da Mãe</p>
                                            <p className="font-medium text-slate-900">{data.aluno.nome_mae}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Encarregado */}
                        {data.aluno.nome_encarregado && (
                            <div className="border-t border-slate-200 pt-4 mb-4">
                                <h4 className="text-sm font-semibold text-slate-700 mb-3">Encarregado de Educação</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-sm text-slate-500">Nome</p>
                                        <p className="font-medium text-slate-900">{data.aluno.nome_encarregado}</p>
                                    </div>
                                    {data.aluno.parentesco_encarregado && (
                                        <div>
                                            <p className="text-sm text-slate-500">Parentesco</p>
                                            <p className="font-medium text-slate-900">{data.aluno.parentesco_encarregado}</p>
                                        </div>
                                    )}
                                    {data.aluno.telefone_encarregado && (
                                        <div>
                                            <p className="text-sm text-slate-500">Telefone</p>
                                            <p className="font-medium text-slate-900">{data.aluno.telefone_encarregado}</p>
                                        </div>
                                    )}
                                    {data.aluno.profissao_encarregado && (
                                        <div>
                                            <p className="text-sm text-slate-500">Profissão</p>
                                            <p className="font-medium text-slate-900">{data.aluno.profissao_encarregado}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Endereço */}
                        {(data.aluno.provincia || data.aluno.municipio || data.aluno.bairro) && (
                            <div className="border-t border-slate-200 pt-4">
                                <h4 className="text-sm font-semibold text-slate-700 mb-3">Endereço</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {data.aluno.provincia && (
                                        <div>
                                            <p className="text-sm text-slate-500">Província</p>
                                            <p className="font-medium text-slate-900">{data.aluno.provincia}</p>
                                        </div>
                                    )}
                                    {data.aluno.municipio && (
                                        <div>
                                            <p className="text-sm text-slate-500">Município</p>
                                            <p className="font-medium text-slate-900">{data.aluno.municipio}</p>
                                        </div>
                                    )}
                                    {data.aluno.bairro && (
                                        <div>
                                            <p className="text-sm text-slate-500">Bairro</p>
                                            <p className="font-medium text-slate-900">{data.aluno.bairro}</p>
                                        </div>
                                    )}
                                    {data.aluno.rua && (
                                        <div>
                                            <p className="text-sm text-slate-500">Rua</p>
                                            <p className="font-medium text-slate-900">{data.aluno.rua}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardBody>
                )}
            </Card>

            {/* Academic Performance Card */}
            <Card>
                <CardHeader>
                    <h3 className="text-lg font-semibold text-slate-900">Desempenho Académico</h3>
                </CardHeader>
                <CardBody>
                    <div className="overflow-x-auto">
                        {(() => {
                            // Calculate unified header structure based on ALL disciplines
                            // Find max components per trimester across all disciplines
                            const maxComponentsPerTrimester: { 1: ComponenteNota[]; 2: ComponenteNota[]; 3: ComponenteNota[] } = {
                                1: [],
                                2: [],
                                3: []
                            }

                            // Collect unique component codes for each trimester
                            const componentCodesByTrimester: { 1: Map<string, ComponenteNota>; 2: Map<string, ComponenteNota>; 3: Map<string, ComponenteNota> } = {
                                1: new Map(),
                                2: new Map(),
                                3: new Map()
                            }

                            data.disciplinas.forEach(disciplina => {
                                if (disciplina.componentesPorTrimestre) {
                                    ([1, 2, 3] as const).forEach(t => {
                                        disciplina.componentesPorTrimestre[t].forEach(comp => {
                                            if (!componentCodesByTrimester[t].has(comp.codigo)) {
                                                componentCodesByTrimester[t].set(comp.codigo, comp)
                                            }
                                        })
                                    })
                                }
                            })

                            // Convert maps to arrays and sort by custom order if provided
                            const sortByOrder = (components: ComponenteNota[]): ComponenteNota[] => {
                                if (!componentOrder || componentOrder.length === 0) {
                                    return components
                                }
                                return [...components].sort((a, b) => {
                                    const indexA = componentOrder.indexOf(a.codigo)
                                    const indexB = componentOrder.indexOf(b.codigo)
                                    // If not in order array, put at end
                                    const posA = indexA === -1 ? 999 : indexA
                                    const posB = indexB === -1 ? 999 : indexB
                                    return posA - posB
                                })
                            }

                            maxComponentsPerTrimester[1] = sortByOrder(Array.from(componentCodesByTrimester[1].values()))
                            maxComponentsPerTrimester[2] = sortByOrder(Array.from(componentCodesByTrimester[2].values()))
                            maxComponentsPerTrimester[3] = sortByOrder(Array.from(componentCodesByTrimester[3].values()))

                            const hasAnyComponents =
                                maxComponentsPerTrimester[1].length > 0 ||
                                maxComponentsPerTrimester[2].length > 0 ||
                                maxComponentsPerTrimester[3].length > 0

                            return (
                                <table className="w-full border-collapse">
                                    <thead>
                                        {/* Check if we have components to show in any trimester */}
                                        {data.disciplinas.length > 0 && hasAnyComponents ? (
                                            <>
                                                {/* First header row - Main columns with colSpan */}
                                                <tr className="text-white" style={{ backgroundColor: headerBg }}>
                                                    <th rowSpan={2} className="border border-slate-300 px-2 py-0.5 text-center text-sm font-semibold" style={{ backgroundColor: headerBg }}>Nº</th>
                                                    <th rowSpan={2} className="border border-slate-300 px-3 py-0.5 text-left text-sm font-semibold" style={{ backgroundColor: headerBg }}>DISCIPLINAS</th>
                                                    {maxComponentsPerTrimester[1].length > 0 && (
                                                        <th colSpan={maxComponentsPerTrimester[1].length} className="border border-slate-300 px-2 py-0.5 text-center text-sm font-semibold" style={{ backgroundColor: headerBg }}>1º TRIMESTRE</th>
                                                    )}
                                                    {maxComponentsPerTrimester[2].length > 0 && (
                                                        <th colSpan={maxComponentsPerTrimester[2].length} className="border border-slate-300 px-2 py-0.5 text-center text-sm font-semibold" style={{ backgroundColor: headerBg }}>2º TRIMESTRE</th>
                                                    )}
                                                    {maxComponentsPerTrimester[3].length > 0 && (
                                                        <th colSpan={maxComponentsPerTrimester[3].length} className="border border-slate-300 px-2 py-0.5 text-center text-sm font-semibold" style={{ backgroundColor: headerBg }}>3º TRIMESTRE</th>
                                                    )}
                                                    <th rowSpan={2} className="border border-slate-300 px-2 py-0.5 text-center text-sm font-semibold" style={{ backgroundColor: headerBg }}>OBSERVAÇÃO</th>
                                                </tr>

                                                {/* Second header row - Component columns for each trimester */}
                                                <tr className="text-white" style={{ backgroundColor: headerBgAlt }}>
                                                    {/* Components for 1st trimester */}
                                                    {maxComponentsPerTrimester[1].map((comp: ComponenteNota, idx: number) => (
                                                        <th key={`t1-${idx}`} className="border border-slate-300 px-2 py-0.5 text-center text-xs font-semibold" style={{ backgroundColor: headerBgAlt }}>
                                                            {comp.codigo}
                                                        </th>
                                                    ))}

                                                    {/* Components for 2nd trimester */}
                                                    {maxComponentsPerTrimester[2].map((comp: ComponenteNota, idx: number) => (
                                                        <th key={`t2-${idx}`} className="border border-slate-300 px-2 py-0.5 text-center text-xs font-semibold" style={{ backgroundColor: headerBgAlt }}>
                                                            {comp.codigo}
                                                        </th>
                                                    ))}

                                                    {/* Components for 3rd trimester */}
                                                    {maxComponentsPerTrimester[3].map((comp: ComponenteNota, idx: number) => (
                                                        <th key={`t3-${idx}`} className="border border-slate-300 px-2 py-0.5 text-center text-xs font-semibold" style={{ backgroundColor: headerBgAlt }}>
                                                            {comp.codigo}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </>
                                        ) : (
                                            /* Fallback header when no components */
                                            <tr className="text-white" style={{ backgroundColor: headerBg }}>
                                                <th className="border border-slate-300 px-2 py-0.5 text-center text-sm font-semibold" style={{ backgroundColor: headerBg }}>Nº</th>
                                                <th className="border border-slate-300 px-3 py-0.5 text-left text-sm font-semibold" style={{ backgroundColor: headerBg }}>DISCIPLINAS</th>
                                                <th className="border border-slate-300 px-2 py-0.5 text-center text-sm font-semibold" style={{ backgroundColor: headerBg }}>1º TRIM</th>
                                                <th className="border border-slate-300 px-2 py-0.5 text-center text-sm font-semibold" style={{ backgroundColor: headerBg }}>2º TRIM</th>
                                                <th className="border border-slate-300 px-2 py-0.5 text-center text-sm font-semibold" style={{ backgroundColor: headerBg }}>3º TRIM</th>
                                                <th className="border border-slate-300 px-2 py-0.5 text-center text-sm font-semibold" style={{ backgroundColor: headerBg }}>OBSERVAÇÃO</th>
                                            </tr>
                                        )}
                                    </thead>
                                    <tbody>
                                        {data.disciplinas.map((disciplina, index) => {
                                            // For each discipline, map components to the unified header structure
                                            const getNotaForComponent = (trimestre: 1 | 2 | 3, codigo: string): number | null => {
                                                if (!disciplina.componentesPorTrimestre) return null
                                                const comp = disciplina.componentesPorTrimestre[trimestre].find(c => c.codigo === codigo)
                                                return comp?.nota ?? null
                                            }

                                            return (
                                                <tr key={disciplina.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                    <td className="border border-slate-300 px-2 py-0.5 text-center text-sm">
                                                        {index + 1}
                                                    </td>
                                                    <td className="border border-slate-300 px-3 py-0.5 font-medium text-sm">
                                                        {disciplina.nome}
                                                    </td>

                                                    {/* Show components matching header structure, or trimester totals if no components */}
                                                    {hasAnyComponents ? (
                                                        <>
                                                            {/* 1st Trimester components - match header structure */}
                                                            {maxComponentsPerTrimester[1].map((headerComp: ComponenteNota, idx: number) => {
                                                                const isCalculated = headerComp.is_calculated || false
                                                                // If calculated (e.g. MT1), use the trimester average, otherwise lookup component grade
                                                                const nota = isCalculated
                                                                    ? disciplina.notas_trimestrais[1]
                                                                    : getNotaForComponent(1, headerComp.codigo)

                                                                const color = nota !== null ? getGradeColor(nota, isCalculated) : '#000000'
                                                                return (
                                                                    <td key={`${disciplina.id}-t1-${idx}`} className={`border border-slate-300 px-2 py-0.5 ${getAlignmentClass()} text-sm`} style={{ color }}>
                                                                        {nota !== null ? nota.toFixed(1) : '-'}
                                                                    </td>
                                                                )
                                                            })}

                                                            {/* 2nd Trimestre components - match header structure */}
                                                            {maxComponentsPerTrimester[2].map((headerComp: ComponenteNota, idx: number) => {
                                                                const isCalculated = headerComp.is_calculated || false
                                                                const nota = isCalculated
                                                                    ? disciplina.notas_trimestrais[2]
                                                                    : getNotaForComponent(2, headerComp.codigo)

                                                                return (
                                                                    <td key={`${disciplina.id}-t2-${idx}`} className={`border border-slate-300 px-2 py-0.5 ${getAlignmentClass()} text-sm`} style={{ color: nota !== null ? getGradeColor(nota, isCalculated) : '#000000' }}>
                                                                        {nota !== null ? nota.toFixed(1) : '-'}
                                                                    </td>
                                                                )
                                                            })}

                                                            {/* 3rd Trimestre components - match header structure */}
                                                            {maxComponentsPerTrimester[3].map((headerComp: ComponenteNota, idx: number) => {
                                                                const isCalculated = headerComp.is_calculated || false
                                                                const nota = isCalculated
                                                                    ? disciplina.notas_trimestrais[3]
                                                                    : getNotaForComponent(3, headerComp.codigo)

                                                                return (
                                                                    <td key={`${disciplina.id}-t3-${idx}`} className={`border border-slate-300 px-2 py-0.5 ${getAlignmentClass()} text-sm`} style={{ color: nota !== null ? getGradeColor(nota, isCalculated) : '#000000' }}>
                                                                        {nota !== null ? nota.toFixed(1) : '-'}
                                                                    </td>
                                                                )
                                                            })}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="border border-slate-300 px-2 py-0.5 text-center font-semibold text-sm" style={{ color: disciplina.notas_trimestrais[1] !== null ? getGradeColor(disciplina.notas_trimestrais[1], false) : '#000000' }}>
                                                                {disciplina.notas_trimestrais[1] !== null ? disciplina.notas_trimestrais[1].toFixed(1) : '-'}
                                                            </td>
                                                            <td className="border border-slate-300 px-2 py-0.5 text-center font-semibold text-sm" style={{ color: disciplina.notas_trimestrais[2] !== null ? getGradeColor(disciplina.notas_trimestrais[2], false) : '#000000' }}>
                                                                {disciplina.notas_trimestrais[2] !== null ? disciplina.notas_trimestrais[2].toFixed(1) : '-'}
                                                            </td>
                                                            <td className="border border-slate-300 px-2 py-0.5 text-center font-semibold text-sm" style={{ color: disciplina.notas_trimestrais[3] !== null ? getGradeColor(disciplina.notas_trimestrais[3], false) : '#000000' }}>
                                                                {disciplina.notas_trimestrais[3] !== null ? disciplina.notas_trimestrais[3].toFixed(1) : '-'}
                                                            </td>
                                                        </>
                                                    )}

                                                    <td className={`border border-slate-300 px-2 py-0.5 text-center font-bold text-sm ${disciplina.transita ? 'text-blue-600' : 'text-red-600'}`}>
                                                        {disciplina.transita ? 'Transita' : 'Não Transita'}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            )
                        })()}
                    </div>
                </CardBody>
            </Card>

            {/* Overall Statistics Card */}
            <Card>
                <CardHeader>
                    <h3 className="text-lg font-semibold text-slate-900">Estatísticas Gerais</h3>
                </CardHeader>
                <CardBody>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-slate-900">{data.estatisticas.total_disciplinas}</p>
                            <p className="text-sm text-slate-500">Total de Disciplinas</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">{data.estatisticas.disciplinas_aprovadas}</p>
                            <p className="text-sm text-slate-500">Aprovadas</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-red-600">{data.estatisticas.disciplinas_reprovadas}</p>
                            <p className="text-sm text-slate-500">Reprovadas</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-blue-600">{data.estatisticas.media_geral.toFixed(2)}</p>
                            <p className="text-sm text-slate-500">Média Geral</p>
                        </div>
                    </div>

                    {(() => {
                        const resultadoAcademicoOk =
                            data.disciplinas.length > 0 &&
                            data.disciplinas.every(d => d.transita) &&
                            data.estatisticas.disciplinas_reprovadas === 0
                        const frequencia = data.aluno.frequencia_anual
                        const frequenciaOk = isAttendanceSufficient(frequencia)
                        const frequenciaTexto = frequencia !== undefined && frequencia !== null
                            ? `${normalizeFrequenciaPercent(frequencia).toFixed(2)}%`
                            : 'Não registada'
                        const deficit = frequencia !== undefined && frequencia !== null && !frequenciaOk
                            ? frequenciaDeficitPercent(frequencia)
                            : 0

                        return (
                            <>
                                {/* Estratégia: separar académico, frequência e decisão oficial */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                    <div className={`p-3 rounded-lg border ${resultadoAcademicoOk ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resultado académico</p>
                                        <p className={`text-base font-bold mt-1 ${resultadoAcademicoOk ? 'text-emerald-700' : 'text-amber-700'}`}>
                                            {resultadoAcademicoOk ? 'Apto (notas positivas)' : 'Não apto (há reprovações)'}
                                        </p>
                                        <p className="text-xs text-slate-600 mt-1">
                                            {data.estatisticas.disciplinas_aprovadas}/{data.estatisticas.total_disciplinas} disciplinas · média {data.estatisticas.media_geral.toFixed(2)}
                                        </p>
                                    </div>
                                    <div className={`p-3 rounded-lg border ${frequenciaOk ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Frequência anual</p>
                                        <p className={`text-base font-bold mt-1 ${frequenciaOk ? 'text-emerald-700' : 'text-red-700'}`}>
                                            {frequenciaTexto} {frequenciaOk ? '· Suficiente' : '· Insuficiente'}
                                        </p>
                                        <p className="text-xs text-slate-600 mt-1">
                                            Mínimo {FREQUENCIA_MINIMA_PERCENT.toFixed(2).replace('.', ',')}%
                                            {!frequenciaOk && deficit > 0
                                                ? ` · défice ${deficit.toFixed(2)} p.p.`
                                                : ''}
                                        </p>
                                    </div>
                                    <div className={`p-3 rounded-lg border ${data.estatisticas.transita ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Decisão final</p>
                                        <p className={`text-base font-bold mt-1 ${data.estatisticas.transita ? 'text-blue-700' : 'text-red-700'}`}>
                                            {data.estatisticas.transita ? 'TRANSITA' : 'NÃO TRANSITA'}
                                        </p>
                                        <p className="text-xs text-slate-600 mt-1">
                                            Exige notas + frequência ≥ {FREQUENCIA_MINIMA_PERCENT.toFixed(2).replace('.', ',')}%
                                        </p>
                                    </div>
                                </div>

                                {/* Final Observation */}
                                <div className={`p-4 rounded-lg ${data.estatisticas.transita
                                    ? 'bg-blue-50 border-2 border-blue-500'
                                    : 'bg-red-50 border-2 border-red-500'
                                    }`}>
                                    <div className="text-center mb-3">
                                        <p className={`text-xl font-bold ${data.estatisticas.transita ? 'text-blue-700' : 'text-red-700'}`}>
                                            OBSERVAÇÃO FINAL: {data.estatisticas.transita ? 'TRANSITA' : 'NÃO TRANSITA'}
                                        </p>
                                        {resultadoAcademicoOk && !frequenciaOk && (
                                            <p className="mt-2 text-sm text-slate-700">
                                                Academicamente apta, mas retida exclusivamente por frequência insuficiente.
                                            </p>
                                        )}
                                        {data.estatisticas.matricula_condicional && (
                                            <span className="inline-block mt-2 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-semibold">
                                                📝 Matrícula Condicional - Exame Extraordinário Obrigatório
                                            </span>
                                        )}
                                    </div>

                                    {data.estatisticas.observacao_padronizada && (
                                        <div className="mt-3 p-3 bg-white rounded border border-slate-200">
                                            <p className="text-sm text-slate-700 italic">
                                                {data.estatisticas.observacao_padronizada}
                                            </p>
                                        </div>
                                    )}

                                    {data.estatisticas.motivo_retencao && (
                                        <div className="mt-3 p-3 bg-red-50 rounded border border-red-200">
                                            <p className="text-sm text-red-700 font-medium">
                                                ⚠️ {data.estatisticas.motivo_retencao}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <AvaliacaoFrequenciaLegalNote compact className="mt-4" />
                            </>
                        )
                    })()}
                </CardBody>
            </Card>
        </div>
    )
}
