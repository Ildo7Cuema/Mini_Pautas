import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Turma, Disciplina, ComponenteAvaliacao, Aluno, Nota } from '../types'
import { validateGrade } from '../utils/formulaParser'
import { evaluateConfiguredComponent, type GradesByTrimestre } from '../utils/formulaUtils'
import { isManualGradeEntryComponent } from '../utils/gradeUtils'
import { useAuth } from '../contexts/AuthContext'
import {
    EscolaNatureza,
    getApprovalThreshold,
    getEffectiveGradeScale,
    getEscolaNaturezaFromConfig,
    validateGradeAgainstPolicy,
} from '../utils/angolaGradeScale'

interface GradeEntryProps {
    turma: Turma
    disciplina: Disciplina
}

export const GradeEntry: React.FC<GradeEntryProps> = ({ turma, disciplina }) => {
    const { escolaProfile, professorProfile, secretarioProfile } = useAuth()
    const [componentes, setComponentes] = useState<ComponenteAvaliacao[]>([])
    const [selectedComponente, setSelectedComponente] = useState<ComponenteAvaliacao | null>(null)
    const [alunos, setAlunos] = useState<Aluno[]>([])
    const [notas, setNotas] = useState<Record<string, number>>({})
    const [existingNotas, setExistingNotas] = useState<Record<string, Nota>>({})
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(false)
    const [trimestre, setTrimestre] = useState<1 | 2 | 3>(turma.trimestre)
    const [escolaNatureza, setEscolaNatureza] = useState<EscolaNatureza | null>(
        () => getEscolaNaturezaFromConfig(escolaProfile?.configuracoes as Record<string, unknown>)
    )

    useEffect(() => {
        const loadNatureza = async () => {
            const fromProfile = getEscolaNaturezaFromConfig(escolaProfile?.configuracoes as Record<string, unknown>)
            if (fromProfile) {
                setEscolaNatureza(fromProfile)
                return
            }
            const escolaId =
                escolaProfile?.id || professorProfile?.escola_id || secretarioProfile?.escola_id
            if (!escolaId) return
            const { data } = await supabase
                .from('escolas')
                .select('configuracoes')
                .eq('id', escolaId)
                .maybeSingle()
            setEscolaNatureza(getEscolaNaturezaFromConfig(data?.configuracoes as Record<string, unknown>))
        }
        loadNatureza()
    }, [escolaProfile, professorProfile?.escola_id, secretarioProfile?.escola_id])

    const nivelEnsino = turma.nivel_ensino || turma.nome
    const activeScale = getEffectiveGradeScale({
        natureza: escolaNatureza,
        nivelEnsino,
        componenteMin: selectedComponente?.escala_minima,
        componenteMax: selectedComponente?.escala_maxima,
    })

    useEffect(() => {
        loadComponentes()
        loadAlunos()
    }, [disciplina.id])

    useEffect(() => {
        if (selectedComponente) {
            loadExistingNotas()
        }
    }, [selectedComponente, trimestre])

    // Auto-calculate grades for calculated components
    useEffect(() => {
        if (selectedComponente?.is_calculated) {
            calculateGradesForCalculatedComponent()
        }
    }, [selectedComponente, componentes, trimestre])

    const loadComponentes = async () => {
        try {
            const { data, error } = await supabase
                .from('componentes_avaliacao')
                .select('*')
                .eq('disciplina_id', disciplina.id)
                .order('ordem')

            if (error) throw error

            const entryComponents = (data || []).filter(isManualGradeEntryComponent)
            console.log('Loaded components for grade entry:', entryComponents)

            setComponentes(entryComponents)
            if (entryComponents.length > 0) {
                setSelectedComponente(entryComponents[0])
            }
        } catch (error) {
            console.error('Error loading components:', error)
        }
    }

    const loadAlunos = async () => {
        try {
            const { data, error } = await supabase
                .from('alunos')
                .select('*')
                .eq('turma_id', turma.id)
                .eq('ativo', true)
                .order('nome_completo')

            if (error) throw error
            setAlunos(data || [])
        } catch (error) {
            console.error('Error loading students:', error)
        }
    }

    const loadExistingNotas = async () => {
        if (!selectedComponente) return

        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('notas')
                .select('*')
                .eq('componente_id', selectedComponente.id)
                .eq('turma_id', turma.id)
                .eq('trimestre', trimestre)

            if (error) throw error

            const notasMap: Record<string, Nota> = {}
            const valoresMap: Record<string, number> = {}

            data?.forEach((nota) => {
                notasMap[nota.aluno_id] = nota
                valoresMap[nota.aluno_id] = nota.valor
            })

            setExistingNotas(notasMap)
            setNotas(valoresMap)
        } catch (error) {
            console.error('Error loading grades:', error)
        } finally {
            setLoading(false)
        }
    }

    // Calculate grades strictly from tipo_calculo + formula_expression of the selected component
    const calculateGradesForCalculatedComponent = async () => {
        if (!selectedComponente?.is_calculated || !selectedComponente.formula_expression) return

        try {
            const isAnnual = selectedComponente.tipo_calculo === 'anual'
            const relatedIds = componentes
                .filter((c) => c.id !== selectedComponente.id)
                .map((c) => c.id)

            if (relatedIds.length === 0) return

            let gradesQuery = supabase
                .from('notas')
                .select('aluno_id, componente_id, valor, trimestre')
                .eq('turma_id', turma.id)
                .in('componente_id', relatedIds)

            if (!isAnnual) {
                gradesQuery = gradesQuery.eq('trimestre', trimestre)
            }

            const { data: dependentGrades, error } = await gradesQuery
            if (error) throw error

            const gradesByStudent: Record<string, { byId: Record<string, number>; byTrimestre: GradesByTrimestre }> = {}
            dependentGrades?.forEach((grade) => {
                if (!gradesByStudent[grade.aluno_id]) {
                    gradesByStudent[grade.aluno_id] = {
                        byId: {},
                        byTrimestre: { 1: {}, 2: {}, 3: {} },
                    }
                }
                const bucket = gradesByStudent[grade.aluno_id]
                bucket.byId[grade.componente_id] = grade.valor
                const comp = componentes.find((c) => c.id === grade.componente_id)
                if (comp) {
                    const t = Number(comp.trimestre) || Number(grade.trimestre) || 1
                    if (!bucket.byTrimestre[t]) bucket.byTrimestre[t] = {}
                    bucket.byTrimestre[t][comp.codigo_componente] = grade.valor
                }
            })

            const calculatedGrades: Record<string, number> = {}
            alunos.forEach((aluno) => {
                const student = gradesByStudent[aluno.id]
                if (!student) return

                let result: number | null = null
                if (isAnnual) {
                    // Recalculate trimestral deps first so annual formulas see configured MT values
                    ;[1, 2, 3].forEach((t) => {
                        const compsT = componentes.filter(
                            (c) =>
                                Number(c.trimestre) === t &&
                                (c.tipo_calculo === 'trimestral' || !c.tipo_calculo)
                        )
                        compsT.forEach((depComp) => {
                            if (!(depComp.is_calculated && depComp.formula_expression)) return
                            const map = student.byTrimestre[t] || {}
                            const mt = evaluateConfiguredComponent(depComp, {
                                gradesByCode: map,
                                components: compsT,
                                trimestre: t,
                            })
                            if (mt !== null) student.byTrimestre[t][depComp.codigo_componente] = mt
                        })
                    })
                    result = evaluateConfiguredComponent(selectedComponente, {
                        gradesByTrimestre: student.byTrimestre,
                        components: componentes,
                    })
                } else {
                    const gradesByCode: Record<string, number> = {}
                    const compsT = componentes.filter((c) => Number(c.trimestre) === Number(trimestre))
                    compsT.forEach((c) => {
                        if (student.byId[c.id] !== undefined) {
                            gradesByCode[c.codigo_componente] = student.byId[c.id]
                        }
                    })
                    result = evaluateConfiguredComponent(selectedComponente, {
                        gradesByCode,
                        components: compsT,
                        trimestre,
                    })
                }

                if (result !== null) {
                    calculatedGrades[aluno.id] = result
                }
            })

            setNotas(calculatedGrades)
        } catch (error) {
            console.error('Error calculating grades:', error)
        }
    }

    const handleGradeChange = (alunoId: string, valor: string) => {
        const numericValue = parseFloat(valor)

        if (valor === '' || isNaN(numericValue)) {
            const newNotas = { ...notas }
            delete newNotas[alunoId]
            setNotas(newNotas)

            const newErrors = { ...errors }
            delete newErrors[alunoId]
            setErrors(newErrors)
            return
        }

        if (!selectedComponente) return

        const policy = validateGradeAgainstPolicy(numericValue, {
            natureza: escolaNatureza,
            nivelEnsino,
            componenteMin: selectedComponente.escala_minima,
            componenteMax: selectedComponente.escala_maxima,
        })

        const validation = validateGrade(
            numericValue,
            policy.min,
            policy.max,
            policy.message
        )

        if (!validation.valida) {
            setErrors({ ...errors, [alunoId]: validation.mensagem })
        } else {
            const newErrors = { ...errors }
            delete newErrors[alunoId]
            setErrors(newErrors)
        }

        setNotas({ ...notas, [alunoId]: numericValue })
    }

    const handleSave = async () => {
        if (!selectedComponente) return
        if (Object.keys(errors).length > 0) {
            alert('Por favor, corrija os erros antes de salvar.')
            return
        }

        setSaving(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not authenticated')

            const { data: professor } = await supabase
                .from('professores')
                .select('id')
                .eq('user_id', user.id)
                .single()

            if (!professor) throw new Error('Professor not found')

            // Prepare upsert data
            const notasToSave = Object.entries(notas).map(([alunoId, valor]) => ({
                aluno_id: alunoId,
                componente_id: selectedComponente.id,
                turma_id: turma.id,
                trimestre,
                valor,
                lancado_por: professor.id,
                data_lancamento: new Date().toISOString(),
            }))

            // Diagnostic logging
            console.log('=== GRADE ENTRY SAVE DEBUG ===')
            console.log('Number of grades to save:', notasToSave.length)
            console.log('Sample grade data:', notasToSave[0])
            console.log('Trimestre:', trimestre)
            console.log('Componente:', selectedComponente.codigo_componente, selectedComponente.id)
            console.log('Turma:', turma.nome, turma.id)

            const { data: upsertData, error } = await supabase
                .from('notas')
                .upsert(notasToSave, {
                    onConflict: 'aluno_id,componente_id,trimestre',
                    ignoreDuplicates: false
                })
                .select()

            console.log('Upsert response data:', upsertData)
            console.log('Upsert error:', error)

            if (error) {
                console.error('UPSERT ERROR DETAILS:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                })
                throw error
            }

            console.log('✅ Grades saved successfully')
            alert('Notas salvas com sucesso!')
            loadExistingNotas()
        } catch (error) {
            console.error('❌ SAVE GRADES ERROR:', error)
            alert('Erro ao salvar notas')
        } finally {
            setSaving(false)
        }
    }

    const calculateStats = () => {
        const valores = Object.values(notas).filter(v => !isNaN(v))
        if (valores.length === 0) return null

        const limiar = getApprovalThreshold(nivelEnsino)
        const sum = valores.reduce((a, b) => a + b, 0)
        const avg = sum / valores.length
        const min = Math.min(...valores)
        const max = Math.max(...valores)
        const aprovados = valores.filter(v => v >= limiar).length

        return {
            total: valores.length,
            media: avg.toFixed(2),
            minima: min.toFixed(2),
            maxima: max.toFixed(2),
            aprovados,
            taxa: ((aprovados / valores.length) * 100).toFixed(1),
        }
    }

    const stats = calculateStats()

    if (componentes.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <svg className="w-20 h-20 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    Nenhum componente de avaliação configurado
                </h3>
                <p className="text-gray-500">
                    Configure os componentes de avaliação antes de lançar notas
                </p>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-lg shadow-md">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Lançamento de Notas</h2>
                <p className="text-gray-600">
                    {turma.nome} - {disciplina.nome}
                </p>
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Trimestre
                    </label>
                    <select
                        value={trimestre}
                        onChange={(e) => setTrimestre(parseInt(e.target.value) as 1 | 2 | 3)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value={1}>1º Trimestre</option>
                        <option value={2}>2º Trimestre</option>
                        <option value={3}>3º Trimestre</option>
                    </select>
                </div>
            </div>

            {/* Component Selector */}
            <div className="p-6 border-b border-gray-200 bg-gray-50">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Componente de Avaliação
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {componentes.map((comp) => (
                        <button
                            key={comp.id}
                            onClick={() => setSelectedComponente(comp)}
                            className={`p-3 rounded-lg border-2 transition ${selectedComponente?.id === comp.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}
                        >
                            <div className="font-semibold text-gray-900 flex items-center gap-2">
                                {comp.nome}
                                {comp.is_calculated && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                        📊 Calculado
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                                {comp.peso_percentual}% • {activeScale.min}-{activeScale.max}
                                {selectedComponente?.id === comp.id && activeScale.enforced ? ' (RAA)' : ''}
                            </div>
                            {comp.is_calculated && comp.formula_expression && (
                                <div className="text-xs text-purple-600 mt-1 font-mono">
                                    {comp.formula_expression}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Statistics */}
            {stats && (
                <div className="p-6 border-b border-gray-200 bg-blue-50">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                        <div>
                            <div className="text-xs text-blue-600 font-medium">Total</div>
                            <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
                        </div>
                        <div>
                            <div className="text-xs text-blue-600 font-medium">Média</div>
                            <div className="text-2xl font-bold text-blue-900">{stats.media}</div>
                        </div>
                        <div>
                            <div className="text-xs text-blue-600 font-medium">Mínima</div>
                            <div className="text-2xl font-bold text-blue-900">{stats.minima}</div>
                        </div>
                        <div>
                            <div className="text-xs text-blue-600 font-medium">Máxima</div>
                            <div className="text-2xl font-bold text-blue-900">{stats.maxima}</div>
                        </div>
                        <div>
                            <div className="text-xs text-blue-600 font-medium">Aprovados</div>
                            <div className="text-2xl font-bold text-blue-900">{stats.aprovados}</div>
                        </div>
                        <div>
                            <div className="text-xs text-blue-600 font-medium">Taxa</div>
                            <div className="text-2xl font-bold text-blue-900">{stats.taxa}%</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Grade Entry Table */}
            <div className="p-6">
                {loading ? (
                    <div className="text-center py-12 text-gray-500">Carregando notas...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Nº</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Nome do Aluno</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Nº Processo</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Nota</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alunos.map((aluno, index) => {
                                    const hasError = errors[aluno.id]
                                    const hasExisting = existingNotas[aluno.id]

                                    return (
                                        <tr key={aluno.id} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="py-3 px-4 text-gray-600">{index + 1}</td>
                                            <td className="py-3 px-4 font-medium text-gray-900">
                                                {aluno.nome_completo}
                                            </td>
                                            <td className="py-3 px-4 text-gray-600">{aluno.numero_processo}</td>
                                            <td className="py-3 px-4">
                                                {selectedComponente?.is_calculated ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-purple-900 font-mono w-24 text-center">
                                                            {notas[aluno.id]?.toFixed(2) ?? '—'}
                                                        </div>
                                                        <span className="text-xs text-purple-600">Auto</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min={activeScale.min}
                                                            max={activeScale.max}
                                                            value={notas[aluno.id] ?? ''}
                                                            onChange={(e) => handleGradeChange(aluno.id, e.target.value)}
                                                            className={`w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${hasError ? 'border-red-500' : 'border-gray-300'}`}
                                                            placeholder="0.00"
                                                        />
                                                        {hasError && (
                                                            <span className="text-xs text-red-600">{hasError}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                {hasExisting ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        Salva
                                                    </span>
                                                ) : notas[aluno.id] !== undefined ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                        Pendente
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                                        Vazio
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                    {Object.keys(notas).length} de {alunos.length} notas preenchidas
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            setNotas({})
                            setErrors({})
                        }}
                        className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition"
                    >
                        Limpar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || Object.keys(errors).length > 0}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Salvando...' : 'Salvar Notas'}
                    </button>
                </div>
            </div>
        </div>
    )
}
