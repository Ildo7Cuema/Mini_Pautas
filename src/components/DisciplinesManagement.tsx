/*
component-meta:
  name: DisciplinesManagement
  description: Component for managing disciplines (subjects) within a class
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Card, CardBody } from './ui/Card'
import { Button } from './ui/Button'
import { Icons } from './ui/Icons'
import { translateError } from '../utils/translations'

interface DisciplinesManagementProps {
    turmaId: string
    turmaNome: string
    nivelEnsino?: string
    onClose?: () => void
}

interface Disciplina {
    id: string
    professor_id: string
    turma_id: string
    nome: string
    codigo_disciplina: string
    carga_horaria: number | null
    descricao: string | null
}

interface ComponenteAvaliacao {
    id: string
    disciplina_id: string
    turma_id: string
    nome: string
    codigo_componente: string
    peso_percentual: number
    escala_minima: number
    escala_maxima: number
    obrigatorio: boolean
    ordem: number
    descricao: string | null
    trimestre: number // 1, 2, or 3
    is_calculated?: boolean
    formula_expression?: string | null
    depends_on_components?: string[] | null
    tipo_calculo?: 'trimestral' | 'anual'
}

export const DisciplinesManagement: React.FC<DisciplinesManagementProps> = ({ turmaId, turmaNome, nivelEnsino, onClose }) => {
    const [disciplinas, setDisciplinas] = useState<Disciplina[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    // Component states
    const [expandedDisciplina, setExpandedDisciplina] = useState<string | null>(null)
    const [componentes, setComponentes] = useState<Record<string, ComponenteAvaliacao[]>>({})
    const [loadingComponentes, setLoadingComponentes] = useState<Record<string, boolean>>({})

    // Disciplinas obrigatórias state
    const [disciplinasObrigatorias, setDisciplinasObrigatorias] = useState<Set<string>>(new Set())
    const [loadingObrigatorias, setLoadingObrigatorias] = useState(false)

    // Professors state
    const [professores, setProfessores] = useState<{ id: string, nome_completo: string, especialidade: string | null }[]>([])

    // Auth context
    const { escolaProfile } = useAuth()

    useEffect(() => {
        loadDisciplinas()
        loadDisciplinasObrigatorias()
        if (escolaProfile) {
            loadProfessores()
        }
    }, [turmaId, escolaProfile])

    const loadProfessores = async () => {
        try {
            const { data, error } = await supabase
                .from('professores')
                .select('id, nome_completo, especialidade')
                .eq('escola_id', escolaProfile?.id)
                .eq('ativo', true)
                .order('nome_completo')

            if (error) throw error
            setProfessores(data || [])
        } catch (err) {
            console.error('Erro ao carregar professores:', err)
        }
    }

    const isPluridocencia = nivelEnsino === 'Ensino Secundário'

    const loadDisciplinas = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('disciplinas')
                .select('*')
                .eq('turma_id', turmaId)
                .order('nome')

            if (error) throw error
            setDisciplinas(data || [])
        } catch (err: any) {
            const errorMessage = err?.message || err?.error_description || 'Erro ao carregar disciplinas'
            setError(translateError(errorMessage))
        } finally {
            setLoading(false)
        }
    }

    const loadDisciplinasObrigatorias = async () => {
        try {
            setLoadingObrigatorias(true)
            const { data, error } = await supabase
                .from('disciplinas_obrigatorias')
                .select('disciplina_id')
                .eq('turma_id', turmaId)
                .eq('is_obrigatoria', true)

            if (error) throw error

            const ids = new Set((data || []).map(d => d.disciplina_id))
            setDisciplinasObrigatorias(ids)
        } catch (err: any) {
            console.error('Erro ao carregar disciplinas obrigatórias:', err)
            setDisciplinasObrigatorias(new Set())
        } finally {
            setLoadingObrigatorias(false)
        }
    }

    const toggleDisciplinaObrigatoria = async (disciplinaId: string) => {
        const isCurrentlyObrigatoria = disciplinasObrigatorias.has(disciplinaId)
        const newSet = new Set(disciplinasObrigatorias)

        // Validação: 3-4 disciplinas obrigatórias
        if (!isCurrentlyObrigatoria && newSet.size >= 4) {
            setError('Máximo de 4 disciplinas obrigatórias permitido')
            setTimeout(() => setError(null), 3000)
            return
        }

        if (isCurrentlyObrigatoria && newSet.size <= 3) {
            setError('Mínimo de 3 disciplinas obrigatórias necessário')
            setTimeout(() => setError(null), 3000)
            return
        }

        try {
            if (isCurrentlyObrigatoria) {
                // Remove
                const { error } = await supabase
                    .from('disciplinas_obrigatorias')
                    .delete()
                    .eq('turma_id', turmaId)
                    .eq('disciplina_id', disciplinaId)

                if (error) throw error
                newSet.delete(disciplinaId)
            } else {
                // Add
                const { error } = await supabase
                    .from('disciplinas_obrigatorias')
                    .insert({
                        turma_id: turmaId,
                        disciplina_id: disciplinaId,
                        is_obrigatoria: true
                    })

                if (error) throw error
                newSet.add(disciplinaId)
            }

            setDisciplinasObrigatorias(newSet)
            setSuccess(isCurrentlyObrigatoria ? 'Disciplina desmarcada como obrigatória' : 'Disciplina marcada como obrigatória')
            setTimeout(() => setSuccess(null), 2000)
        } catch (err: any) {
            const errorMessage = err?.message || 'Erro ao atualizar disciplina obrigatória'
            setError(translateError(errorMessage))
        }
    }

    // Única edição de disciplina permitida na turma: trocar o professor responsável.
    // Criar/editar/apagar disciplinas e componentes é feito na página de Templates.
    const handleChangeProfessor = async (disciplinaId: string, professorId: string) => {
        if (!professorId) return
        setError(null)

        try {
            const { data, error: updateError } = await supabase
                .from('disciplinas')
                .update({ professor_id: professorId })
                .eq('id', disciplinaId)
                .select('id')

            if (updateError) throw updateError
            if (!data || data.length === 0) throw new Error('Não foi possível alterar o professor (sem permissão).')

            setDisciplinas(prev => prev.map(d => d.id === disciplinaId ? { ...d, professor_id: professorId } : d))
            setSuccess('Professor actualizado com sucesso!')
            setTimeout(() => setSuccess(null), 2500)
        } catch (err: any) {
            const errorMessage = err?.message || err?.error_description || 'Erro ao actualizar professor'
            setError(translateError(errorMessage))
        }
    }

    const goToTemplates = () => {
        window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'templates' } }))
    }

    // ============================================
    // COMPONENT MANAGEMENT FUNCTIONS
    // ============================================

    const loadComponentes = async (disciplinaId: string) => {
        try {
            setLoadingComponentes({ ...loadingComponentes, [disciplinaId]: true })
            const { data, error } = await supabase
                .from('componentes_avaliacao')
                .select('*')
                .eq('disciplina_id', disciplinaId)
                .order('ordem')

            if (error) throw error
            setComponentes({ ...componentes, [disciplinaId]: data || [] })
        } catch (err: any) {
            const errorMessage = err?.message || err?.error_description || 'Erro ao carregar componentes'
            setError(translateError(errorMessage))
        } finally {
            setLoadingComponentes({ ...loadingComponentes, [disciplinaId]: false })
        }
    }

    const toggleDisciplina = (disciplinaId: string) => {
        if (expandedDisciplina === disciplinaId) {
            setExpandedDisciplina(null)
        } else {
            setExpandedDisciplina(disciplinaId)
            if (!componentes[disciplinaId]) {
                loadComponentes(disciplinaId)
            }
        }
    }

    const calculateTotalWeight = (disciplinaId: string, excludeId?: string): number => {
        const disciplinaComponentes = componentes[disciplinaId] || []
        return disciplinaComponentes
            .filter(c => c.id !== excludeId)
            .reduce((sum, c) => sum + c.peso_percentual, 0)
    }

    return (
        <div className="space-y-5 md:space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xl md:text-2xl font-bold text-slate-900">Gestão de Disciplinas</h3>
                        <p className="text-sm text-slate-500">{turmaNome}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Docência regime badge */}
                    {nivelEnsino && (
                        <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                            isPluridocencia
                                ? 'bg-violet-100 text-violet-700'
                                : 'bg-blue-100 text-blue-700'
                        }`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {isPluridocencia ? 'Pluridocência' : 'Monodocência'}
                        </span>
                    )}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="min-h-touch min-w-touch flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Messages */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center shadow-sm animate-slide-down">
                    <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="flex-1 font-medium">{error}</span>
                    <button onClick={() => setError(null)} className="ml-2 p-1 hover:bg-red-100 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}
            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center shadow-sm animate-slide-down">
                    <Icons.Check />
                    <span className="ml-2 font-medium">{success}</span>
                </div>
            )}

            {/* Pluridocência informational banner for secondary school */}
            {isPluridocencia && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-start gap-3">
                    <div className="w-8 h-8 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-violet-800">Pluridocência — Ensino Secundário (Dec. Pres. 162/23)</p>
                        <p className="text-xs text-violet-600 mt-0.5">
                            Cada disciplina deve ter um professor especialista atribuído. Utilize o campo "Professor" para definir o docente de cada disciplina individualmente.
                        </p>
                    </div>
                </div>
            )}

            {/* Monodocência informational banner for primary school */}
            {nivelEnsino && !isPluridocencia && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-blue-800">Monodocência — Ensino Primário (Dec. Pres. 162/23)</p>
                        <p className="text-xs text-blue-600 mt-0.5">
                            O professor de classe leciona todas as disciplinas. As disciplinas já devem estar atribuídas ao professor responsável definido na criação da turma.
                        </p>
                    </div>
                </div>
            )}

            {/* Gestão centralizada nos Templates */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                    <p className="text-sm font-bold text-indigo-800">Disciplinas e componentes são geridos nos Templates</p>
                    <p className="text-xs text-indigo-600 mt-0.5">
                        Para criar, editar ou remover disciplinas e componentes de avaliação, use a página de Templates.
                        Aqui pode consultar, trocar o professor e marcar as disciplinas obrigatórias.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={goToTemplates}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 transition-all hover:-translate-y-0.5"
                >
                    Gerir nos Templates
                    <span aria-hidden>→</span>
                </button>
            </div>

            {/* Disciplines List */}
            <Card className="border-0 shadow-md shadow-slate-200/50 overflow-hidden">
                <CardBody className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="text-center">
                                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-primary-600"></div>
                                <p className="mt-4 text-slate-500 font-medium">Carregando disciplinas...</p>
                            </div>
                        </div>
                    ) : disciplinas.length === 0 ? (
                        <div className="text-center py-16 px-6">
                            <div className="w-20 h-20 bg-gradient-to-br from-amber-100 to-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-5">
                                <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <h4 className="text-xl font-bold text-slate-800 mb-2">Nenhuma disciplina cadastrada</h4>
                            <p className="text-slate-500 mb-6 max-w-sm mx-auto">As disciplinas desta turma vêm dos Templates. Aplique um template à turma na página de Templates.</p>
                            <Button variant="primary" onClick={goToTemplates}>
                                Ir para Templates
                            </Button>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200">
                            {disciplinas.map((disciplina) => {
                                const isExpanded = expandedDisciplina === disciplina.id
                                const disciplinaComponentes = componentes[disciplina.id] || []
                                const totalWeight = calculateTotalWeight(disciplina.id)
                                const isLoadingComps = loadingComponentes[disciplina.id]

                                return (
                                    <div
                                        key={disciplina.id}
                                        className="transition-colors duration-200"
                                    >
                                        <div className="p-4 md:p-5 hover:bg-slate-50">
                                            {/* Mobile-first stacked layout */}
                                            <div className="flex flex-col gap-3">
                                                {/* Header row: Badge + Name + Expand/Edit/Delete */}
                                                <div className="flex items-start gap-3">
                                                    <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                                                        {disciplina.nome.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-slate-900 text-base leading-tight">
                                                            {disciplina.nome}
                                                        </h4>
                                                        <p className="text-sm text-slate-500 mt-0.5">
                                                            {disciplina.codigo_disciplina}
                                                        </p>
                                                        <div className="mt-2 flex items-center gap-1.5 max-w-xs">
                                                            <Icons.User className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                                                            <select
                                                                value={disciplina.professor_id || ''}
                                                                onChange={(e) => handleChangeProfessor(disciplina.id, e.target.value)}
                                                                aria-label={`Professor de ${disciplina.nome}`}
                                                                title="Alterar professor"
                                                                className="flex-1 min-w-0 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                                                            >
                                                                {!professores.some(p => p.id === disciplina.professor_id) && (
                                                                    <option value={disciplina.professor_id || ''}>
                                                                        {professores.length === 0 ? 'A carregar...' : 'Professor não encontrado'}
                                                                    </option>
                                                                )}
                                                                {professores.map(prof => (
                                                                    <option key={prof.id} value={prof.id}>
                                                                        {prof.nome_completo}{prof.especialidade ? ` — ${prof.especialidade}` : ''}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    {/* Action buttons - always visible */}
                                                    <div className="flex-shrink-0 flex items-center gap-1">
                                                        <button
                                                            onClick={() => toggleDisciplina(disciplina.id)}
                                                            className={`p-2.5 rounded-xl transition-all min-h-touch min-w-[44px] flex items-center justify-center ${isExpanded ? 'bg-primary-100 text-primary-600' : 'text-slate-400 hover:text-primary-600 hover:bg-primary-50'}`}
                                                            title={isExpanded ? "Ocultar" : "Ver componentes"}
                                                        >
                                                            <svg className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Badges row */}
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {disciplinasObrigatorias.has(disciplina.id) && (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-700">
                                                            <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                            </svg>
                                                            Obrigatória
                                                        </span>
                                                    )}
                                                    {disciplina.carga_horaria && (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600">
                                                            {disciplina.carga_horaria}h
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Checkbox for obrigatória - simplified mobile layout */}
                                                <label className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        id={`obrigatoria-${disciplina.id}`}
                                                        checked={disciplinasObrigatorias.has(disciplina.id)}
                                                        onChange={() => toggleDisciplinaObrigatoria(disciplina.id)}
                                                        disabled={loadingObrigatorias}
                                                        className="w-5 h-5 mt-0.5 text-amber-600 bg-white border-slate-300 rounded-md focus:ring-amber-500 focus:ring-2 cursor-pointer disabled:opacity-50 flex-shrink-0"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-sm font-medium text-slate-700 block">
                                                            Disciplina obrigatória
                                                        </span>
                                                        <span className="text-xs text-slate-500">
                                                            Para transição de classe ({disciplinasObrigatorias.size}/3-4)
                                                        </span>
                                                    </div>
                                                </label>

                                                {/* Description if exists */}
                                                {disciplina.descricao && (
                                                    <p className="text-sm text-slate-600 line-clamp-2 pl-1">
                                                        {disciplina.descricao}
                                                    </p>
                                                )}
                                            </div>


                                            {/* Expandable Components Section */}
                                            {isExpanded && (
                                                <div className="mt-5 pt-5 border-t border-slate-200">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                                </svg>
                                                            </div>
                                                            <h5 className="font-bold text-slate-800">Componentes de Avaliação</h5>
                                                        </div>
                                                    </div>

                                                    {isLoadingComps ? (
                                                        <div className="text-center py-6">
                                                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-blue-600"></div>
                                                            <p className="mt-3 text-sm text-slate-500 font-medium">Carregando componentes...</p>
                                                        </div>
                                                    ) : disciplinaComponentes.length === 0 ? (
                                                        <div className="text-center py-8 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                                                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                                                                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                                </svg>
                                                            </div>
                                                            <p className="text-sm font-medium text-slate-600 mb-1">Nenhum componente configurado</p>
                                                            <p className="text-xs text-slate-500">Configure os componentes no template desta disciplina.</p>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="space-y-3 mb-4">
                                                                {disciplinaComponentes.map((comp) => (
                                                                    <div
                                                                        key={comp.id}
                                                                        className="p-4 bg-white border border-slate-200 rounded-xl hover:border-primary-300 hover:shadow-sm transition-all"
                                                                    >
                                                                        {/* Mobile: Stack layout */}
                                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center flex-wrap gap-2 mb-2">
                                                                                    <span className="font-bold text-slate-900">{comp.nome}</span>
                                                                                    <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-lg font-medium">
                                                                                        {comp.codigo_componente}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex flex-wrap gap-2 mb-2">
                                                                                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-lg font-medium">
                                                                                        {comp.trimestre}º Trim
                                                                                    </span>
                                                                                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-lg font-medium">
                                                                                        Peso: {comp.peso_percentual}%
                                                                                    </span>
                                                                                    {comp.obrigatorio && (
                                                                                        <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-lg font-medium">
                                                                                            Obrigatório
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="text-xs text-slate-500">
                                                                                    Escala: {comp.escala_minima}-{comp.escala_maxima} • Ordem: {comp.ordem}
                                                                                </div>
                                                                            </div>

                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {/* Weight Summary */}
                                                            <div className={`p-3 rounded-xl text-sm font-medium flex items-center justify-between ${totalWeight === 100 ? 'bg-green-50 text-green-800 border border-green-200' : totalWeight > 100 ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                                                                <div className="flex items-center gap-2">
                                                                    {totalWeight === 100 ? (
                                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                        </svg>
                                                                    ) : (
                                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                                        </svg>
                                                                    )}
                                                                    <span>Peso Total: <strong>{totalWeight}%</strong></span>
                                                                </div>
                                                                {totalWeight !== 100 && (
                                                                    <span className="text-xs">
                                                                        {totalWeight > 100 ? 'Ultrapassou 100%' : `Faltam ${100 - totalWeight}%`}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardBody>
            </Card>

        </div >
    )
}
