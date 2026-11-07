/*
component-meta:
  name: PautaGeralFieldSelector
  description: Field selector for customizing Pauta-Geral output (MED-aligned component autonomy)
  tokens: [--color-primary, --fs-sm]
  responsive: true
*/

import { useMemo, useState } from 'react'
import { Card, CardHeader, CardBody } from './ui/Card'
import {
    formatComponentePautaLabel,
    getSelectableComponentesForPauta,
    isPautaResultComponent,
} from '../utils/pautaGeralFieldUtils'

interface ComponenteAvaliacao {
    id: string
    codigo_componente: string
    nome: string
    peso_percentual: number
    trimestre: number
    is_calculated?: boolean
    tipo_calculo?: 'trimestral' | 'anual'
    ordem?: number
}

interface DisciplinaComComponentes {
    id: string
    nome: string
    codigo_disciplina: string
    ordem: number
    componentes: ComponenteAvaliacao[]
}

interface PautaGeralData {
    disciplinas: DisciplinaComComponentes[]
    [key: string]: any
}

interface FieldSelection {
    disciplinas: string[]
    includeAllDisciplinas: boolean
    componentes: string[]
    includeAllComponentes: boolean
    /** When true, MAC/NPT and other lançamento columns can also be selected. */
    includeLancamentoComponentes: boolean
    showStatistics: boolean
    showNumeroProcesso: boolean
    showNomeCompleto: boolean
    showMediaGeral: boolean
    showObservacao: boolean
    componenteParaMediaGeral: string
}

interface Props {
    data: PautaGeralData
    selection: FieldSelection
    onChange: (selection: FieldSelection) => void
    onReorder?: (newDisciplinas: DisciplinaComComponentes[]) => void
}

export const PautaGeralFieldSelector: React.FC<Props> = ({ data, selection, onChange, onReorder }) => {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({})
    const [showAdvanced, setShowAdvanced] = useState(false)

    const disciplinasComSelecionaveis = useMemo(
        () =>
            data.disciplinas.map((d) => ({
                ...d,
                selecionaveis: getSelectableComponentesForPauta(
                    d.componentes,
                    selection.includeLancamentoComponentes
                ),
            })),
        [data.disciplinas, selection.includeLancamentoComponentes]
    )

    const allSelectableIds = useMemo(
        () => disciplinasComSelecionaveis.flatMap((d) => d.selecionaveis.map((c) => c.id)),
        [disciplinasComSelecionaveis]
    )

    const selectedSelectableCount = selection.componentes.filter((id) =>
        allSelectableIds.includes(id)
    ).length

    const toggleDisciplinaExpand = (disciplinaId: string) => {
        setExpanded((prev) => ({
            ...prev,
            [disciplinaId]: !prev[disciplinaId],
        }))
    }

    const handleMoveUp = (index: number, e: React.MouseEvent) => {
        e.stopPropagation()
        if (index > 0 && onReorder) {
            const newDisciplinas = [...data.disciplinas]
            const temp = newDisciplinas[index]
            newDisciplinas[index] = newDisciplinas[index - 1]
            newDisciplinas[index - 1] = temp
            onReorder(newDisciplinas)
        }
    }

    const handleMoveDown = (index: number, e: React.MouseEvent) => {
        e.stopPropagation()
        if (index < data.disciplinas.length - 1 && onReorder) {
            const newDisciplinas = [...data.disciplinas]
            const temp = newDisciplinas[index]
            newDisciplinas[index] = newDisciplinas[index + 1]
            newDisciplinas[index + 1] = temp
            onReorder(newDisciplinas)
        }
    }

    const handleToggleAllDisciplinas = () => {
        if (selection.includeAllDisciplinas) {
            onChange({
                ...selection,
                includeAllDisciplinas: false,
                disciplinas: [],
            })
        } else {
            onChange({
                ...selection,
                includeAllDisciplinas: true,
                disciplinas: data.disciplinas.map((d) => d.id),
            })
        }
    }

    const handleToggleDisciplina = (disciplinaId: string) => {
        const isSelected = selection.disciplinas.includes(disciplinaId)
        const disc = disciplinasComSelecionaveis.find((d) => d.id === disciplinaId)
        const discCompIds = disc?.selecionaveis.map((c) => c.id) || []

        if (isSelected) {
            const newDisciplinas = selection.disciplinas.filter((id) => id !== disciplinaId)
            // Remove components of deselected discipline from selection
            const newComponentes = selection.componentes.filter((id) => !discCompIds.includes(id))
            onChange({
                ...selection,
                disciplinas: newDisciplinas,
                includeAllDisciplinas: newDisciplinas.length === data.disciplinas.length,
                componentes: newComponentes,
                includeAllComponentes:
                    newComponentes.length > 0 &&
                    newComponentes.length === allSelectableIds.filter((id) => !discCompIds.includes(id)).length,
            })
        } else {
            const newDisciplinas = [...selection.disciplinas, disciplinaId]
            // Auto-add default result components for this discipline when enabling it
            const toAdd = discCompIds.filter((id) => !selection.componentes.includes(id))
            const newComponentes = [...selection.componentes, ...toAdd]
            onChange({
                ...selection,
                disciplinas: newDisciplinas,
                includeAllDisciplinas: newDisciplinas.length === data.disciplinas.length,
                componentes: newComponentes,
                includeAllComponentes: newComponentes.length === allSelectableIds.length,
            })
        }
    }

    const handleToggleAllComponentes = () => {
        if (selection.includeAllComponentes || selectedSelectableCount === allSelectableIds.length) {
            onChange({
                ...selection,
                includeAllComponentes: false,
                componentes: [],
            })
        } else {
            onChange({
                ...selection,
                includeAllComponentes: true,
                componentes: [...allSelectableIds],
            })
        }
    }

    const handleToggleComponente = (componenteId: string) => {
        const isSelected = selection.componentes.includes(componenteId)

        if (isSelected) {
            const newComponentes = selection.componentes.filter((id) => id !== componenteId)
            onChange({
                ...selection,
                componentes: newComponentes,
                includeAllComponentes: false,
            })
        } else {
            const newComponentes = [...selection.componentes, componenteId]
            onChange({
                ...selection,
                componentes: newComponentes,
                includeAllComponentes: newComponentes.length === allSelectableIds.length,
            })
        }
    }

    const handleToggleLancamento = (checked: boolean) => {
        if (!checked) {
            // Keep only result components when turning off lançamento
            const resultIds = disciplinasComSelecionaveis.flatMap((d) =>
                getSelectableComponentesForPauta(d.componentes, false).map((c) => c.id)
            )
            const kept = selection.componentes.filter((id) => resultIds.includes(id))
            onChange({
                ...selection,
                includeLancamentoComponentes: false,
                componentes: kept,
                includeAllComponentes: kept.length === resultIds.length && resultIds.length > 0,
            })
        } else {
            onChange({
                ...selection,
                includeLancamentoComponentes: true,
                includeAllComponentes: false,
            })
        }
    }

    const isDisciplinaSelected = (disciplinaId: string) =>
        selection.disciplinas.includes(disciplinaId)

    const isComponenteSelected = (componenteId: string) =>
        selection.componentes.includes(componenteId)

    const ToggleSwitch = ({
        checked,
        onChange: onToggle,
        label,
        description,
    }: {
        checked: boolean
        onChange: (checked: boolean) => void
        label: string
        description?: string
    }) => (
        <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onToggle(e.target.checked)}
                    className="sr-only"
                />
                <div
                    className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                        checked ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                >
                    <div
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                            checked ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                </div>
            </div>
            <div className="flex-1">
                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                    {label}
                </span>
                {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
            </div>
        </label>
    )

    return (
        <Card className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200/50">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-base md:text-lg font-semibold text-slate-800">Personalizar Campos</h3>
                            <p className="text-xs text-slate-500 hidden sm:block">
                                Escolha disciplinas e colunas da pauta (médias trimestrais / finais)
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleToggleAllDisciplinas}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            selection.includeAllDisciplinas
                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        {selection.includeAllDisciplinas ? '✓ Todas Selecionadas' : 'Selecionar Todas'}
                    </button>
                </div>
            </CardHeader>
            <CardBody className="p-4 md:p-5">
                <div className="space-y-5">
                    <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2.5 text-xs text-sky-900">
                        Por omissão a Pauta-Geral mostra colunas de resultado (ex.: <strong>MT</strong> por trimestre e{' '}
                        <strong>MF</strong>), conforme o uso habitual em mapas e pautas. Pode acrescentar ou remover
                        colunas por disciplina. Active «componentes de lançamento» se precisar de MAC/NPT na pauta.
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                <span className="text-sm font-semibold text-slate-700">Disciplinas</span>
                                <span className="text-xs text-slate-500">
                                    ({selection.disciplinas.length}/{data.disciplinas.length})
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleToggleAllComponentes}
                                className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                {selectedSelectableCount === allSelectableIds.length && allSelectableIds.length > 0
                                    ? 'Desmarcar colunas'
                                    : 'Todas as colunas'}
                            </button>
                        </div>

                        <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={selection.includeLancamentoComponentes}
                                onChange={(e) => handleToggleLancamento(e.target.checked)}
                                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span className="text-xs text-slate-600">
                                Incluir componentes de lançamento (MAC, NPT, etc.) na lista
                            </span>
                        </label>

                        <div className="space-y-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                            {disciplinasComSelecionaveis.map((disciplina, index) => (
                                <div
                                    key={disciplina.id}
                                    className={`rounded-xl border transition-all overflow-hidden ${
                                        isDisciplinaSelected(disciplina.id)
                                            ? 'border-blue-200 bg-white shadow-sm'
                                            : 'border-transparent bg-white/60 hover:bg-white hover:border-slate-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 p-3">
                                        <label className="relative flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isDisciplinaSelected(disciplina.id)}
                                                onChange={() => handleToggleDisciplina(disciplina.id)}
                                                className="sr-only"
                                            />
                                            <div
                                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                                    isDisciplinaSelected(disciplina.id)
                                                        ? 'bg-blue-600 border-blue-600'
                                                        : 'border-slate-300 bg-white hover:border-blue-400'
                                                }`}
                                            >
                                                {isDisciplinaSelected(disciplina.id) && (
                                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                        </label>

                                        <span
                                            className={`flex-1 text-sm font-medium ${
                                                isDisciplinaSelected(disciplina.id) ? 'text-slate-900' : 'text-slate-600'
                                            }`}
                                        >
                                            {disciplina.nome}
                                        </span>

                                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                            {
                                                disciplina.selecionaveis.filter((c) =>
                                                    selection.componentes.includes(c.id)
                                                ).length
                                            }
                                            /{disciplina.selecionaveis.length} col.
                                        </span>

                                        <div className="flex flex-col gap-0.5">
                                            <button
                                                type="button"
                                                onClick={(e) => handleMoveUp(index, e)}
                                                disabled={index === 0}
                                                className={`p-0.5 rounded hover:bg-slate-100 ${
                                                    index === 0 ? 'text-slate-300' : 'text-slate-500 hover:text-slate-800'
                                                }`}
                                                title="Mover para cima"
                                            >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => handleMoveDown(index, e)}
                                                disabled={index === data.disciplinas.length - 1}
                                                className={`p-0.5 rounded hover:bg-slate-100 ${
                                                    index === data.disciplinas.length - 1
                                                        ? 'text-slate-300'
                                                        : 'text-slate-500 hover:text-slate-800'
                                                }`}
                                                title="Mover para baixo"
                                            >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => toggleDisciplinaExpand(disciplina.id)}
                                            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                            aria-expanded={!!expanded[disciplina.id]}
                                            aria-label="Expandir componentes"
                                        >
                                            <svg
                                                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                                                    expanded[disciplina.id] ? 'rotate-180' : ''
                                                }`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </div>

                                    {expanded[disciplina.id] && (
                                        <div className="px-3 pb-3 pt-1 border-t border-slate-100 bg-slate-50/50">
                                            {disciplina.selecionaveis.length === 0 ? (
                                                <p className="text-xs text-slate-500 pl-8 py-1">
                                                    Sem colunas seleccionáveis
                                                    {!selection.includeLancamentoComponentes
                                                        ? ' (active lançamento ou configure MT/MF nos templates).'
                                                        : '.'}
                                                </p>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8">
                                                    {disciplina.selecionaveis.map((componente) => {
                                                        const isResult = isPautaResultComponent(componente)
                                                        return (
                                                            <label
                                                                key={componente.id}
                                                                className="flex items-center gap-2 group cursor-pointer"
                                                            >
                                                                <div className="relative">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isComponenteSelected(componente.id)}
                                                                        onChange={() =>
                                                                            handleToggleComponente(componente.id)
                                                                        }
                                                                        className="sr-only"
                                                                    />
                                                                    <div
                                                                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                                                                            isComponenteSelected(componente.id)
                                                                                ? 'bg-purple-600 border-purple-600'
                                                                                : 'border-slate-300 bg-white group-hover:border-purple-400'
                                                                        }`}
                                                                    >
                                                                        {isComponenteSelected(componente.id) && (
                                                                            <svg
                                                                                className="w-2.5 h-2.5 text-white"
                                                                                fill="none"
                                                                                stroke="currentColor"
                                                                                viewBox="0 0 24 24"
                                                                            >
                                                                                <path
                                                                                    strokeLinecap="round"
                                                                                    strokeLinejoin="round"
                                                                                    strokeWidth={3}
                                                                                    d="M5 13l4 4L19 7"
                                                                                />
                                                                            </svg>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <span className="text-xs text-slate-600 group-hover:text-slate-900">
                                                                    <span className="font-medium">
                                                                        {formatComponentePautaLabel(componente)}
                                                                    </span>
                                                                    <span className="text-slate-400">
                                                                        {' '}
                                                                        — {componente.nome}
                                                                    </span>
                                                                </span>
                                                                {isResult ? (
                                                                    <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">
                                                                        Resultado
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">
                                                                        Lançamento
                                                                    </span>
                                                                )}
                                                            </label>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="w-full flex items-center justify-center gap-2 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                    >
                        <svg
                            className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        {showAdvanced ? 'Ocultar opções avançadas' : 'Mostrar opções avançadas'}
                    </button>

                    {showAdvanced && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200 animate-slide-up">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-slate-700">Informações do Aluno</span>
                                </div>
                                <div className="space-y-3 pl-6">
                                    <ToggleSwitch
                                        checked={selection.showNumeroProcesso}
                                        onChange={(checked) =>
                                            onChange({ ...selection, showNumeroProcesso: checked })
                                        }
                                        label="Número de Processo"
                                    />
                                    <ToggleSwitch
                                        checked={selection.showNomeCompleto}
                                        onChange={(checked) =>
                                            onChange({ ...selection, showNomeCompleto: checked })
                                        }
                                        label="Nome Completo"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-slate-700">Opções de Visualização</span>
                                </div>
                                <div className="space-y-3 pl-6">
                                    <ToggleSwitch
                                        checked={selection.showStatistics}
                                        onChange={(checked) =>
                                            onChange({ ...selection, showStatistics: checked })
                                        }
                                        label="Mostrar Estatísticas"
                                        description="Exibe resumo estatístico no fim"
                                    />
                                    <ToggleSwitch
                                        checked={selection.showMediaGeral}
                                        onChange={(checked) =>
                                            onChange({ ...selection, showMediaGeral: checked })
                                        }
                                        label="Mostrar Média Geral"
                                        description="Coluna com média geral do aluno"
                                    />
                                    <ToggleSwitch
                                        checked={selection.showObservacao}
                                        onChange={(checked) =>
                                            onChange({ ...selection, showObservacao: checked })
                                        }
                                        label="Mostrar Observação"
                                        description="Status: Transita / Não Transita"
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-sm font-semibold text-slate-700">
                                        Componente para Média Geral
                                    </span>
                                </div>
                                <div className="relative pl-6">
                                    <select
                                        value={selection.componenteParaMediaGeral}
                                        onChange={(e) =>
                                            onChange({
                                                ...selection,
                                                componenteParaMediaGeral: e.target.value,
                                            })
                                        }
                                        className="w-full md:w-64 px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm appearance-none cursor-pointer"
                                    >
                                        <option value="MF">MF — Média Final</option>
                                        <option value="MFD">MFD — Média Final da Disciplina</option>
                                        <option value="MT">MT — Média Trimestral (último disponível)</option>
                                    </select>
                                </div>
                                <p className="text-xs text-slate-500 mt-2 pl-6">
                                    Usado para classificação (Transita / Não Transita) e coluna de média geral.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-200">
                        <span className="text-xs text-slate-500">Seleccionado:</span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            {selection.disciplinas.length} disciplina(s)
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                            {selectedSelectableCount} coluna(s)
                        </span>
                    </div>
                </div>
            </CardBody>
        </Card>
    )
}
