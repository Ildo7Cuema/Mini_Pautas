import React, { useState, useEffect } from 'react'
import { FormulaConfig, MTCalculationType, getDefaultMTConfig, saveFormulaConfig, validateMTFormula } from '../utils/formulaConfigUtils'
import { safeEvalMath } from '../utils/safeMathEval'

interface ConfiguracaoFormulasModalProps {
    isOpen: boolean
    onClose: () => void
    disciplinaId: string
    turmaId: string
    currentConfig: FormulaConfig | null
    onSave: () => void
}

export const ConfiguracaoFormulasModal: React.FC<ConfiguracaoFormulasModalProps> = ({
    isOpen,
    onClose,
    disciplinaId,
    turmaId,
    currentConfig,
    onSave
}) => {
    const [tipo, setTipo] = useState<MTCalculationType>('simples')
    const [customFormula, setCustomFormula] = useState('')
    const [peso1, setPeso1] = useState(33.33)
    const [peso2, setPeso2] = useState(33.33)
    const [peso3, setPeso3] = useState(33.34)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (currentConfig) {
            // Load existing config
            const formula = currentConfig.formula_expression.toLowerCase()
            if (formula.includes('(t1 + t2 + t3) / 3')) {
                setTipo('simples')
            } else if (currentConfig.pesos_trimestres) {
                setTipo('ponderada')
                setPeso1(currentConfig.pesos_trimestres[1] || 33.33)
                setPeso2(currentConfig.pesos_trimestres[2] || 33.33)
                setPeso3(currentConfig.pesos_trimestres[3] || 33.34)
            } else {
                setTipo('custom')
                setCustomFormula(currentConfig.formula_expression)
            }
        }
    }, [currentConfig])

    const handleSave = async () => {
        try {
            setSaving(true)
            setError(null)

            let config: Partial<FormulaConfig>

            if (tipo === 'simples') {
                config = getDefaultMTConfig('simples')
            } else if (tipo === 'ponderada') {
                // Validate weights sum to 100
                const total = peso1 + peso2 + peso3
                if (Math.abs(total - 100) > 0.1) {
                    setError('Os pesos devem somar 100%')
                    return
                }
                config = {
                    tipo: 'MT',
                    formula_expression: `T1 * ${peso1 / 100} + T2 * ${peso2 / 100} + T3 * ${peso3 / 100}`,
                    pesos_trimestres: { 1: peso1, 2: peso2, 3: peso3 },
                    descricao: `Média Ponderada (${peso1}%, ${peso2}%, ${peso3}%)`
                }
            } else {
                // Custom formula
                const validation = validateMTFormula(customFormula)
                if (!validation.valid) {
                    setError(validation.error || 'Fórmula inválida')
                    return
                }
                config = {
                    tipo: 'MT',
                    formula_expression: customFormula,
                    descricao: 'Fórmula Personalizada'
                }
            }

            const result = await saveFormulaConfig({
                disciplina_id: disciplinaId,
                turma_id: turmaId,
                ...config
            } as FormulaConfig)

            if (!result.success) {
                setError(result.error || 'Erro ao salvar configuração')
                return
            }

            onSave()
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar')
        } finally {
            setSaving(false)
        }
    }

    if (!isOpen) return null

    // Calculate preview
    const T1 = 15, T2 = 16, T3 = 17
    let preview = 0
    if (tipo === 'simples') {
        preview = (T1 + T2 + T3) / 3
    } else if (tipo === 'ponderada') {
        preview = (T1 * peso1 / 100) + (T2 * peso2 / 100) + (T3 * peso3 / 100)
    } else if (customFormula) {
        try {
            const expr = customFormula.replace(/T1/gi, T1.toString()).replace(/T2/gi, T2.toString()).replace(/T3/gi, T3.toString())
            preview = safeEvalMath(expr)
        } catch {
            preview = 0
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4 z-50 animate-fade-in">
            <div className="bg-white w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl rounded-b-none md:rounded-b-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
                {/* Drag Handle - Mobile Only */}
                <div className="md:hidden flex justify-center pt-3 pb-1 sticky top-0 bg-white z-10">
                    <div className="w-10 h-1 bg-slate-300 rounded-full" />
                </div>

                {/* Header */}
                <div className="px-4 md:px-6 pt-4 md:pt-6 pb-4 border-b border-slate-100 sticky top-0 md:top-0 bg-white z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h2 className="text-lg md:text-xl font-bold text-slate-900">Configuração de Fórmulas</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors touch-feedback"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 md:p-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    <div className="space-y-4">
                        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            Média Trimestral (MT)
                        </h3>

                        {/* Simple Average */}
                        <label className={`flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 touch-feedback min-h-touch ${tipo === 'simples' ? 'border-purple-300 bg-purple-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                            <input
                                type="radio"
                                name="tipo"
                                value="simples"
                                checked={tipo === 'simples'}
                                onChange={() => setTipo('simples')}
                                className="mt-1 mr-3 w-5 h-5 text-purple-600"
                            />
                            <div className="flex-1">
                                <div className={`font-semibold ${tipo === 'simples' ? 'text-purple-700' : 'text-slate-900'}`}>Média Simples</div>
                                <code className="inline-block bg-slate-100 px-2 py-1 rounded text-sm mt-1">(T1 + T2 + T3) / 3</code>
                            </div>
                        </label>

                        {/* Weighted Average */}
                        <label className={`flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 touch-feedback ${tipo === 'ponderada' ? 'border-purple-300 bg-purple-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                            <input
                                type="radio"
                                name="tipo"
                                value="ponderada"
                                checked={tipo === 'ponderada'}
                                onChange={() => setTipo('ponderada')}
                                className="mt-1 mr-3 w-5 h-5 text-purple-600"
                            />
                            <div className="flex-1">
                                <div className={`font-semibold ${tipo === 'ponderada' ? 'text-purple-700' : 'text-slate-900'}`}>Média Ponderada</div>
                                {tipo === 'ponderada' && (
                                    <div className="mt-3 space-y-3">
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="block text-xs text-slate-600 mb-1">1º Tri (%)</label>
                                                <input
                                                    type="number"
                                                    value={peso1}
                                                    onChange={(e) => setPeso1(parseFloat(e.target.value) || 0)}
                                                    className="w-full px-3 py-2 border-2 rounded-lg focus:border-purple-400 focus:ring-2 focus:ring-purple-200 transition-all text-center"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-600 mb-1">2º Tri (%)</label>
                                                <input
                                                    type="number"
                                                    value={peso2}
                                                    onChange={(e) => setPeso2(parseFloat(e.target.value) || 0)}
                                                    className="w-full px-3 py-2 border-2 rounded-lg focus:border-purple-400 focus:ring-2 focus:ring-purple-200 transition-all text-center"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-600 mb-1">3º Tri (%)</label>
                                                <input
                                                    type="number"
                                                    value={peso3}
                                                    onChange={(e) => setPeso3(parseFloat(e.target.value) || 0)}
                                                    className="w-full px-3 py-2 border-2 rounded-lg focus:border-purple-400 focus:ring-2 focus:ring-purple-200 transition-all text-center"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                />
                                            </div>
                                        </div>
                                        <div className="text-sm text-slate-600">
                                            Total: <span className={`font-bold ${Math.abs(peso1 + peso2 + peso3 - 100) < 0.1 ? 'text-green-600' : 'text-red-600'}`}>
                                                {(peso1 + peso2 + peso3).toFixed(2)}%
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </label>

                        {/* Custom Formula */}
                        <label className={`flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 touch-feedback ${tipo === 'custom' ? 'border-purple-300 bg-purple-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                            <input
                                type="radio"
                                name="tipo"
                                value="custom"
                                checked={tipo === 'custom'}
                                onChange={() => setTipo('custom')}
                                className="mt-1 mr-3 w-5 h-5 text-purple-600"
                            />
                            <div className="flex-1">
                                <div className={`font-semibold ${tipo === 'custom' ? 'text-purple-700' : 'text-slate-900'}`}>Fórmula Personalizada</div>
                                {tipo === 'custom' && (
                                    <div className="mt-3">
                                        <input
                                            type="text"
                                            value={customFormula}
                                            onChange={(e) => setCustomFormula(e.target.value)}
                                            placeholder="Ex: T1 * 0.3 + T2 * 0.3 + T3 * 0.4"
                                            className="w-full px-3 py-2 border-2 rounded-lg font-mono text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-200 transition-all"
                                        />
                                        <div className="text-xs text-slate-500 mt-2">
                                            Use T1, T2, T3 para representar as notas de cada trimestre.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </label>

                        {/* Preview */}
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-blue-900 mb-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Preview do Cálculo
                            </div>
                            <div className="text-sm text-blue-800">
                                T1 = 15, T2 = 16, T3 = 17 → <span className="font-bold text-blue-900">MT = {preview.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="px-4 md:px-6 py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-3 sticky bottom-0 bg-white">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-all duration-200 touch-feedback min-h-touch disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium rounded-xl transition-all duration-200 shadow-md shadow-purple-500/25 touch-feedback min-h-touch disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                A guardar...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Salvar Configuração
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
