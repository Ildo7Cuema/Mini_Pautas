import { supabase } from '../lib/supabaseClient'

/**
 * Grade Color Configuration Types
 */

export interface GradeColorRule {
    id?: string
    config_id?: string
    nivel_ensino?: string | null
    classe_min?: number | null
    classe_max?: number | null
    tipo_componente: 'calculado' | 'regular' | 'todos'
    threshold: number
    operador: '<=' | '<' | '>=' | '>'
    aplicar_cor: boolean
    modo_exibicao?: 'texto' | 'fundo' // Nova propriedade
    ordem: number
}

export interface GradeColorConfig {
    id?: string
    user_id?: string
    turma_id?: string | null
    cor_negativa: string
    cor_positiva: string
    nome: string
    descricao?: string
    regras: GradeColorRule[]
    created_at?: string
    updated_at?: string
}

/**
 * Load grade color configuration for a specific turma or global configuration
 */
export async function loadGradeColorConfig(
    turmaId?: string
): Promise<GradeColorConfig | null> {
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return null

        // maybeSingle: 0 rows → null without HTTP 406 (unlike .single())
        // Try to load turma-specific configuration first
        if (turmaId) {
            const { data: turmaConfig, error: turmaError } = await supabase
                .from('configuracao_cores_notas')
                .select(`
                    *,
                    regras:regras_cores_notas(*)
                `)
                .eq('user_id', user.id)
                .eq('turma_id', turmaId)
                .maybeSingle()

            if (turmaError) throw turmaError

            if (turmaConfig) {
                return {
                    ...turmaConfig,
                    regras: (turmaConfig.regras || []).sort((a: GradeColorRule, b: GradeColorRule) => a.ordem - b.ordem)
                }
            }
        }

        // Fall back to global configuration
        const { data: globalConfig, error: globalError } = await supabase
            .from('configuracao_cores_notas')
            .select(`
                *,
                regras:regras_cores_notas(*)
            `)
            .eq('user_id', user.id)
            .is('turma_id', null)
            .maybeSingle()

        if (globalError) throw globalError

        if (!globalConfig) return null

        return {
            ...globalConfig,
            regras: (globalConfig.regras || []).sort((a: GradeColorRule, b: GradeColorRule) => a.ordem - b.ordem)
        }
    } catch (error) {
        console.error('Error loading grade color config:', error)
        return null
    }
}

/**
 * Save grade color configuration
 */
export async function saveGradeColorConfig(
    config: GradeColorConfig
): Promise<{ success: boolean; error?: string; data?: GradeColorConfig }> {
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { success: false, error: 'User not authenticated' }
        }

        // Upsert configuration
        const { data: savedConfig, error: configError } = await supabase
            .from('configuracao_cores_notas')
            .upsert({
                id: config.id,
                user_id: user.id,
                turma_id: config.turma_id || null,
                cor_negativa: config.cor_negativa,
                cor_positiva: config.cor_positiva,
                nome: config.nome,
                descricao: config.descricao
            }, {
                onConflict: 'user_id,turma_id'
            })
            .select()
            .single()

        if (configError) throw configError

        // Delete existing rules
        if (savedConfig.id) {
            await supabase
                .from('regras_cores_notas')
                .delete()
                .eq('config_id', savedConfig.id)
        }

        // Insert new rules
        if (config.regras && config.regras.length > 0) {
            const rulesToInsert = config.regras.map(rule => ({
                config_id: savedConfig.id,
                nivel_ensino: rule.nivel_ensino || null,
                classe_min: rule.classe_min || null,
                classe_max: rule.classe_max || null,
                tipo_componente: rule.tipo_componente,
                threshold: rule.threshold,
                operador: rule.operador,
                aplicar_cor: rule.aplicar_cor,
                modo_exibicao: rule.modo_exibicao || 'texto',
                ordem: rule.ordem
            }))

            const { error: rulesError } = await supabase
                .from('regras_cores_notas')
                .insert(rulesToInsert)

            if (rulesError) throw rulesError
        }

        // Load the complete configuration with rules
        const completeConfig = await loadGradeColorConfig(config.turma_id || undefined)

        return { success: true, data: completeConfig || undefined }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao salvar configuração'
        return { success: false, error: message }
    }
}

/**
 * Get color for a grade based on configuration
 */
export function getGradeColorFromConfig(
    nota: number,
    nivelEnsino: string | undefined,
    classe: string | undefined,
    isCalculated: boolean,
    config: GradeColorConfig | null
): { color: string; isNegative: boolean; modoExibicao?: 'texto' | 'fundo' } {
    // If no config, use default logic
    if (!config) {
        const result = getDefaultGradeColor(nota, nivelEnsino, classe, isCalculated)
        return { ...result, modoExibicao: 'texto' }
    }

    // Extract class number
    const classeNumber = classe ? parseInt(classe.match(/\d+/)?.[0] || '0') : 0

    // Find matching rule (first match wins due to ordem)
    const matchingRule = config.regras.find(rule => {
        // Check nivel_ensino
        if (rule.nivel_ensino && nivelEnsino) {
            if (!nivelEnsino.toLowerCase().includes(rule.nivel_ensino.toLowerCase())) {
                return false
            }
        }

        // Check classe range
        if (rule.classe_min !== null && rule.classe_min !== undefined) {
            if (classeNumber < rule.classe_min) return false
        }
        if (rule.classe_max !== null && rule.classe_max !== undefined) {
            if (classeNumber > rule.classe_max) return false
        }

        // Check component type
        if (rule.tipo_componente === 'calculado' && !isCalculated) return false
        if (rule.tipo_componente === 'regular' && isCalculated) return false

        return true
    })

    // If no rule matches, use positive color
    if (!matchingRule) {
        return { color: config.cor_positiva, isNegative: false, modoExibicao: 'texto' }
    }

    // If rule says don't apply color, always use positive
    if (!matchingRule.aplicar_cor) {
        return { color: config.cor_positiva, isNegative: false, modoExibicao: matchingRule.modo_exibicao || 'texto' }
    }

    // Apply threshold rule
    let isNegative = false
    switch (matchingRule.operador) {
        case '<=':
            isNegative = nota <= matchingRule.threshold
            break
        case '<':
            isNegative = nota < matchingRule.threshold
            break
        case '>=':
            isNegative = nota >= matchingRule.threshold
            break
        case '>':
            isNegative = nota > matchingRule.threshold
            break
    }

    return {
        color: isNegative ? config.cor_negativa : config.cor_positiva,
        isNegative,
        modoExibicao: matchingRule.modo_exibicao || 'texto'
    }
}

/**
 * Default color logic (fallback when no configuration exists)
 */
function getDefaultGradeColor(
    nota: number,
    nivelEnsino: string | undefined,
    classe: string | undefined,
    isCalculated: boolean
): { color: string; isNegative: boolean } {
    const classeNumber = classe ? parseInt(classe.match(/\d+/)?.[0] || '0') : 0

    // Ensino Primário
    if (nivelEnsino?.toLowerCase().includes('primário') || nivelEnsino?.toLowerCase().includes('primario')) {
        // For 5ª and 6ª Classe
        if (classeNumber >= 5 && classeNumber <= 6) {
            const isNegative = nota <= 4.44
            return { color: isNegative ? '#dc2626' : '#2563eb', isNegative }
        }
        // For classes below 5ª Classe
        else if (classeNumber > 0 && classeNumber < 5) {
            if (isCalculated) {
                const isNegative = nota <= 4.44
                return { color: isNegative ? '#dc2626' : '#2563eb', isNegative }
            }
            return { color: '#2563eb', isNegative: false }
        }
    }

    // Ensino Secundário and others
    if (isCalculated) {
        const isNegative = nota <= 9.44
        return { color: isNegative ? '#dc2626' : '#2563eb', isNegative }
    }

    const isNegative = nota < 10
    return { color: isNegative ? '#dc2626' : '#2563eb', isNegative }
}

/**
 * Convert hex color to RGB array for PDF generation
 */
export function hexToRGB(hex: string): [number, number, number] {
    // Remove # if present
    hex = hex.replace('#', '')

    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)

    return [r, g, b]
}

/**
 * Create default configuration based on educational level
 */
export function createDefaultConfig(
    nivelEnsino: string,
    turmaId?: string
): GradeColorConfig {
    const isPrimary = nivelEnsino.toLowerCase().includes('primário') ||
        nivelEnsino.toLowerCase().includes('primario')

    if (isPrimary) {
        return {
            turma_id: turmaId,
            cor_negativa: '#dc2626',
            cor_positiva: '#2563eb',
            nome: 'Ensino Primário (Padrão)',
            descricao: 'Configuração padrão para Ensino Primário',
            regras: [
                {
                    nivel_ensino: 'Ensino Primário',
                    classe_min: 1,
                    classe_max: 4,
                    tipo_componente: 'calculado',
                    threshold: 4.44,
                    operador: '<=',
                    aplicar_cor: true,
                    modo_exibicao: 'texto',
                    ordem: 1
                },
                {
                    nivel_ensino: 'Ensino Primário',
                    classe_min: 1,
                    classe_max: 4,
                    tipo_componente: 'regular',
                    threshold: 0,
                    operador: '>=',
                    aplicar_cor: false,
                    modo_exibicao: 'texto',
                    ordem: 2
                },
                {
                    nivel_ensino: 'Ensino Primário',
                    classe_min: 5,
                    classe_max: 6,
                    tipo_componente: 'todos',
                    threshold: 4.44,
                    operador: '<=',
                    aplicar_cor: true,
                    modo_exibicao: 'texto',
                    ordem: 3
                }
            ]
        }
    }

    // Ensino Secundário
    return {
        turma_id: turmaId,
        cor_negativa: '#dc2626',
        cor_positiva: '#2563eb',
        nome: 'Ensino Secundário (Padrão)',
        descricao: 'Configuração padrão para Ensino Secundário',
        regras: [
            {
                nivel_ensino: 'Ensino Secundário',
                tipo_componente: 'calculado',
                threshold: 9.44,
                operador: '<=',
                aplicar_cor: true,
                modo_exibicao: 'texto',
                ordem: 1
            },
            {
                nivel_ensino: 'Ensino Secundário',
                tipo_componente: 'regular',
                threshold: 10,
                operador: '<',
                aplicar_cor: true,
                modo_exibicao: 'texto',
                ordem: 2
            }
        ]
    }
}

/**
 * Delete grade color configuration
 */
export async function deleteGradeColorConfig(
    configId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase
            .from('configuracao_cores_notas')
            .delete()
            .eq('id', configId)

        if (error) throw error

        return { success: true }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao deletar configuração'
        return { success: false, error: message }
    }
}
