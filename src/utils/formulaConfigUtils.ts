/**
 * Utility functions for formula configuration and MT calculation
 */

import { supabase } from '../lib/supabaseClient'
import { safeEvalMath } from './safeMathEval'

export interface FormulaConfig {
    id?: string
    disciplina_id: string
    turma_id: string
    tipo: 'NF' | 'MT'
    formula_expression: string
    pesos_trimestres?: Record<number, number>
    descricao?: string
    ativo?: boolean
}

export type MTCalculationType = 'simples' | 'ponderada' | 'custom'

/**
 * Calculate Média Trimestral based on configuration
 */
export function calculateMT(
    notasFinais: Record<number, number>, // {1: 16.8, 2: 17.2, 3: 15.5}
    config: FormulaConfig
): number | null {
    const trimestres = [1, 2, 3]
    const valores = trimestres.map(t => notasFinais[t]).filter(v => v !== undefined)

    // Need all 3 trimestres
    if (valores.length < 3) {
        return null
    }

    const formula = config.formula_expression.toLowerCase()

    // Simple average: (T1 + T2 + T3) / 3
    if (formula.includes('(t1 + t2 + t3) / 3') || formula === 'simples') {
        return (notasFinais[1] + notasFinais[2] + notasFinais[3]) / 3
    }

    // Weighted average using pesos_trimestres
    if (config.pesos_trimestres) {
        const peso1 = (config.pesos_trimestres[1] || 33.33) / 100
        const peso2 = (config.pesos_trimestres[2] || 33.33) / 100
        const peso3 = (config.pesos_trimestres[3] || 33.34) / 100

        return (notasFinais[1] * peso1) + (notasFinais[2] * peso2) + (notasFinais[3] * peso3)
    }

    // Try to evaluate custom formula
    try {
        const T1 = notasFinais[1]
        const T2 = notasFinais[2]
        const T3 = notasFinais[3]

        const expression = config.formula_expression
            .replace(/T1/gi, T1.toString())
            .replace(/T2/gi, T2.toString())
            .replace(/T3/gi, T3.toString())

        const result = safeEvalMath(expression)
        return typeof result === 'number' ? result : null
    } catch (error) {
        console.error('Error evaluating MT formula:', error)
        return null
    }
}

/**
 * Get default MT configuration
 */
export function getDefaultMTConfig(tipo: MTCalculationType = 'simples'): Partial<FormulaConfig> {
    switch (tipo) {
        case 'simples':
            return {
                tipo: 'MT',
                formula_expression: '(T1 + T2 + T3) / 3',
                pesos_trimestres: { 1: 33.33, 2: 33.33, 3: 33.34 },
                descricao: 'Média Simples'
            }
        case 'ponderada':
            return {
                tipo: 'MT',
                formula_expression: 'T1 * 0.3 + T2 * 0.3 + T3 * 0.4',
                pesos_trimestres: { 1: 30, 2: 30, 3: 40 },
                descricao: 'Média Ponderada (30%, 30%, 40%)'
            }
        case 'custom':
            return {
                tipo: 'MT',
                formula_expression: '',
                pesos_trimestres: { 1: 33.33, 2: 33.33, 3: 33.34 },
                descricao: 'Fórmula Personalizada'
            }
    }
}

/**
 * Save formula configuration
 */
export async function saveFormulaConfig(config: FormulaConfig): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase
            .from('formula_configuracoes')
            .upsert({
                disciplina_id: config.disciplina_id,
                turma_id: config.turma_id,
                tipo: config.tipo,
                formula_expression: config.formula_expression,
                pesos_trimestres: config.pesos_trimestres || { 1: 33.33, 2: 33.33, 3: 33.34 },
                descricao: config.descricao,
                ativo: config.ativo !== undefined ? config.ativo : true
            }, {
                onConflict: 'disciplina_id,turma_id,tipo'
            })

        if (error) throw error
        return { success: true }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao salvar configuração'
        return { success: false, error: message }
    }
}

/**
 * Load formula configuration
 */
export async function loadFormulaConfig(
    disciplinaId: string,
    turmaId: string,
    tipo: 'NF' | 'MT'
): Promise<FormulaConfig | null> {
    try {
        const { data, error } = await supabase
            .from('formula_configuracoes')
            .select('*')
            .eq('disciplina_id', disciplinaId)
            .eq('turma_id', turmaId)
            .eq('tipo', tipo)
            .eq('ativo', true)
            .single()

        if (error) {
            // If not found, return default
            if (error.code === 'PGRST116') {
                return null
            }
            throw error
        }

        return data
    } catch (error) {
        console.error('Error loading formula config:', error)
        return null
    }
}

/**
 * Validate MT formula
 */
export function validateMTFormula(formula: string): { valid: boolean; error?: string } {
    if (!formula || formula.trim() === '') {
        return { valid: false, error: 'Fórmula não pode estar vazia' }
    }

    // Check for required variables
    const hasT1 = /T1/i.test(formula)
    const hasT2 = /T2/i.test(formula)
    const hasT3 = /T3/i.test(formula)

    if (!hasT1 || !hasT2 || !hasT3) {
        return { valid: false, error: 'Fórmula deve incluir T1, T2 e T3' }
    }

    // Check for valid characters
    const validChars = /^[T0-9+\-*/(). ]+$/i
    if (!validChars.test(formula)) {
        return { valid: false, error: 'Fórmula contém caracteres inválidos' }
    }

    // Try to evaluate with test values
    try {
        const testFormula = formula
            .replace(/T1/gi, '15')
            .replace(/T2/gi, '16')
            .replace(/T3/gi, '17')

        const result = safeEvalMath(testFormula)

        if (typeof result !== 'number' || isNaN(result)) {
            return { valid: false, error: 'Fórmula não produz um número válido' }
        }

        return { valid: true }
    } catch (error) {
        return { valid: false, error: 'Erro de sintaxe na fórmula' }
    }
}
