/*
component-meta:
  name: BoletimNotasPreview
  description: Preview do boletim de notas do aluno por trimestre
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import React from 'react'
import { Card, CardHeader, CardBody } from './ui/Card'
import { GradeColorConfig, getGradeColorFromConfig } from '../utils/gradeColorConfigUtils'

export interface BoletimComponenteNota {
    codigo: string
    nome: string
    nota: number | null
    is_calculated?: boolean
}

export interface BoletimDisciplina {
    id: string
    nome: string
    codigo_disciplina: string
    componentes: BoletimComponenteNota[]
    nota_trimestral: number | null
    classificacao: string
    aprovado: boolean
}

export interface BoletimNotasData {
    aluno: {
        numero_processo: string
        nome_completo: string
        data_nascimento?: string
        genero?: string
        nome_encarregado?: string
        telefone_encarregado?: string
    }
    turma: {
        nome: string
        ano_lectivo: number
        codigo_turma: string
        nivel_ensino: string
    }
    trimestre: 1 | 2 | 3
    disciplinas: BoletimDisciplina[]
    estatisticas: {
        media_geral: number
        total_disciplinas: number
        disciplinas_aprovadas: number
        disciplinas_reprovadas: number
        limiar_aprovacao: number
        is_primary: boolean
    }
    escola?: {
        nome: string
        provincia: string
        municipio: string
    }
}

interface BoletimNotasPreviewProps {
    data: BoletimNotasData
    colorConfig?: GradeColorConfig | null
}

const TRIMESTRE_LABELS: Record<1 | 2 | 3, string> = {
    1: '1º Trimestre',
    2: '2º Trimestre',
    3: '3º Trimestre',
}

export const BoletimNotasPreview: React.FC<BoletimNotasPreviewProps> = ({ data, colorConfig }) => {
    const extractClasse = (turmaName: string): string | undefined => {
        const match = turmaName.match(/(\d+[ªº]\s*Classe)/i)
        return match ? match[1] : undefined
    }

    const classe = extractClasse(data.turma.nome)

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

    const componentCodes = (() => {
        const map = new Map<string, BoletimComponenteNota>()
        data.disciplinas.forEach((disciplina) => {
            disciplina.componentes.forEach((comp) => {
                if (!map.has(comp.codigo)) {
                    map.set(comp.codigo, comp)
                }
            })
        })
        return Array.from(map.values())
    })()

    const getNotaComponente = (disciplina: BoletimDisciplina, codigo: string): number | null => {
        const comp = disciplina.componentes.find((c) => c.codigo === codigo)
        return comp?.nota ?? null
    }

    const isCalculatedCode = (codigo: string): boolean => {
        return componentCodes.find((c) => c.codigo === codigo)?.is_calculated === true
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">
                            Boletim de Notas — {TRIMESTRE_LABELS[data.trimestre]}
                        </h3>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                            {data.estatisticas.is_primary ? 'Ensino Primário' : 'Ensino Secundário'}
                            {' · '}Limiar {data.estatisticas.limiar_aprovacao} valores
                        </span>
                    </div>
                </CardHeader>
                <CardBody>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <p className="text-sm text-slate-500">Aluno</p>
                            <p className="font-medium text-slate-900">{data.aluno.nome_completo}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Nº Processo</p>
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
                                <p className="font-medium text-slate-900">
                                    {data.aluno.genero === 'M' ? 'Masculino' : 'Feminino'}
                                </p>
                            </div>
                        )}
                        {data.aluno.nome_encarregado && (
                            <div>
                                <p className="text-sm text-slate-500">Encarregado</p>
                                <p className="font-medium text-slate-900">{data.aluno.nome_encarregado}</p>
                            </div>
                        )}
                        {data.escola && (
                            <div>
                                <p className="text-sm text-slate-500">Escola</p>
                                <p className="font-medium text-slate-900">{data.escola.nome}</p>
                            </div>
                        )}
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <h3 className="text-lg font-semibold text-slate-900">Desempenho Académico</h3>
                </CardHeader>
                <CardBody>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse min-w-[640px]">
                            <thead>
                                <tr className="bg-blue-600 text-white">
                                    <th className="border border-slate-300 px-2 py-1.5 text-center text-sm font-semibold w-10">Nº</th>
                                    <th className="border border-slate-300 px-3 py-1.5 text-left text-sm font-semibold">Disciplina</th>
                                    {componentCodes.map((comp) => (
                                        <th
                                            key={comp.codigo}
                                            className="border border-slate-300 px-2 py-1.5 text-center text-xs font-semibold"
                                            title={comp.nome}
                                        >
                                            {comp.codigo}
                                        </th>
                                    ))}
                                    <th className="border border-slate-300 px-2 py-1.5 text-center text-sm font-semibold">Classificação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.disciplinas.map((disciplina, index) => (
                                    <tr key={disciplina.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                        <td className="border border-slate-300 px-2 py-1.5 text-center text-sm text-slate-700">
                                            {index + 1}
                                        </td>
                                        <td className="border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-900">
                                            {disciplina.nome}
                                        </td>
                                        {componentCodes.map((comp) => {
                                            const nota = getNotaComponente(disciplina, comp.codigo)
                                            return (
                                                <td
                                                    key={`${disciplina.id}-${comp.codigo}`}
                                                    className="border border-slate-300 px-2 py-1.5 text-center text-sm font-semibold"
                                                    style={
                                                        nota !== null
                                                            ? { color: getGradeColor(nota, isCalculatedCode(comp.codigo)) }
                                                            : undefined
                                                    }
                                                >
                                                    {nota !== null ? nota.toFixed(1) : '—'}
                                                </td>
                                            )
                                        })}
                                        <td
                                            className={`border border-slate-300 px-2 py-1.5 text-center text-sm font-semibold ${
                                                disciplina.nota_trimestral === null
                                                    ? 'text-slate-400'
                                                    : disciplina.aprovado
                                                        ? 'text-blue-600'
                                                        : 'text-red-600'
                                            }`}
                                        >
                                            {disciplina.classificacao}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                            <p className="text-xs text-slate-500">Disciplinas</p>
                            <p className="text-xl font-bold text-slate-900">{data.estatisticas.total_disciplinas}</p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                            <p className="text-xs text-emerald-700">Aprovadas</p>
                            <p className="text-xl font-bold text-emerald-700">{data.estatisticas.disciplinas_aprovadas}</p>
                        </div>
                        <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                            <p className="text-xs text-red-700">Reprovadas</p>
                            <p className="text-xl font-bold text-red-700">{data.estatisticas.disciplinas_reprovadas}</p>
                        </div>
                        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
                            <p className="text-xs text-blue-700">Média do Trimestre</p>
                            <p className="text-xl font-bold text-blue-700">
                                {data.estatisticas.media_geral > 0
                                    ? data.estatisticas.media_geral.toFixed(2)
                                    : '—'}
                            </p>
                        </div>
                    </div>
                </CardBody>
            </Card>
        </div>
    )
}
