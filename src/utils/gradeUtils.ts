/**
 * Utility functions for grade management
 */

import { Aluno } from '../types'
import {
    getApprovalThreshold,
    getQualitativeBands,
    getQualitativeClassification,
    isGradePassing,
} from './angolaGradeScale'

/**
 * Column header for Mini-Pauta / PDF / Excel.
 * Uses the Templates field "Código do Componente" (MAC, MT, MFD…),
 * the same value from Editar / Criar Novo Componente.
 */
export function getComponenteDisplayLabel(comp: {
    nome?: string | null
    codigo_componente?: string | null
}): string {
    const codigo = (comp.codigo_componente || '').trim()
    if (codigo) return codigo
    const nome = (comp.nome || '').trim()
    return nome || '—'
}

/**
 * Hover label: full descriptive nome from Templates when it differs from the código.
 */
export function getComponenteTooltipLabel(comp: {
    nome?: string | null
    codigo_componente?: string | null
}): string {
    const codigo = (comp.codigo_componente || '').trim()
    const nome = (comp.nome || '').trim()
    if (nome && codigo && nome.toUpperCase() !== codigo.toUpperCase()) {
        return `${codigo} — ${nome}`
    }
    return nome || codigo || '—'
}

/**
 * Codes that represent auto-calculated results in the Angolan evaluation model.
 * Used as a safety net when is_calculated / formula flags were not synced.
 */
const AUTO_RESULT_COMPONENT_CODES = new Set([
    'MT', 'MF', 'CF', 'NF', 'MFD', 'MEC',
])

/**
 * Whether a component should appear in the manual grade-entry dropdown.
 * Calculated components receive their value from a formula, so they must not
 * be offered for direct lançamento — for every class / turma.
 */
export function isManualGradeEntryComponent(component: {
    is_calculated?: boolean | null
    formula_expression?: string | null
    depends_on_components?: string[] | null
    codigo_componente?: string | null
}): boolean {
    if (component.is_calculated === true) return false

    const formula = component.formula_expression?.trim()
    if (formula) return false

    if (Array.isArray(component.depends_on_components) && component.depends_on_components.length > 0) {
        return false
    }

    const code = (component.codigo_componente || '').trim().toUpperCase()
    if (code && AUTO_RESULT_COMPONENT_CODES.has(code)) return false

    return true
}

export interface GradeStats {
    total: number
    filled: number
    pending: number
    average: number
    min: number
    max: number
    approved: number
    failed: number
    approvalRate: number
    distribution: {
        excellent: number
        good: number
        sufficient: number
        insufficient: number
    }
}

export interface GradeData {
    alunoId: string
    alunoNome: string
    numeroProcesso: string
    valor: number
}

export interface ImportResult {
    success: boolean
    imported: number
    errors: ImportError[]
    data?: GradeData[]
}

export interface ImportError {
    row: number
    field: string
    message: string
}

/**
 * Calculate statistics from grades (limiar e faixas RAA por subsistema de ensino)
 */
export const calculateGradeStats = (
    notas: Record<string, number>,
    alunos: Aluno[],
    nivelEnsino?: string | null
): GradeStats => {
    const valores = Object.values(notas).filter(v => v !== undefined && v !== null && !isNaN(v))
    const total = alunos.length
    const filled = valores.length
    const pending = total - filled
    const approvalThreshold = getApprovalThreshold(nivelEnsino)
    const bands = getQualitativeBands(nivelEnsino)

    if (valores.length === 0) {
        return {
            total,
            filled: 0,
            pending: total,
            average: 0,
            min: 0,
            max: 0,
            approved: 0,
            failed: 0,
            approvalRate: 0,
            distribution: {
                excellent: 0,
                good: 0,
                sufficient: 0,
                insufficient: 0
            }
        }
    }

    const sum = valores.reduce((a, b) => a + b, 0)
    const average = sum / valores.length
    const min = Math.min(...valores)
    const max = Math.max(...valores)
    const approved = valores.filter(v => v >= approvalThreshold).length
    const failed = valores.filter(v => v < approvalThreshold).length
    const approvalRate = (approved / valores.length) * 100

    // Distribuição qualitativa RAA por subsistema
    const distribution = {
        excellent: valores.filter(v => v >= bands.excellent).length,
        good: valores.filter(v => v >= bands.good && v < bands.excellent).length,
        sufficient: valores.filter(v => v >= bands.sufficient && v < bands.good).length,
        insufficient: valores.filter(v => v < bands.sufficient).length
    }

    return {
        total,
        filled,
        pending,
        average: parseFloat(average.toFixed(2)),
        min: parseFloat(min.toFixed(2)),
        max: parseFloat(max.toFixed(2)),
        approved,
        failed,
        approvalRate: parseFloat(approvalRate.toFixed(1)),
        distribution
    }
}

/**
 * Validate a grade value against an effective min/max scale.
 */
export const validateGradeValue = (
    value: number,
    minScale: number,
    maxScale: number,
    options?: { enforcedLabel?: string }
): { valid: boolean; message?: string } => {
    if (isNaN(value)) {
        return { valid: false, message: 'Valor inválido' }
    }

    if (value < minScale || value > maxScale) {
        if (options?.enforcedLabel) {
            return { valid: false, message: options.enforcedLabel }
        }
        if (value < minScale) {
            return { valid: false, message: `Mínimo: ${minScale}` }
        }
        return { valid: false, message: `Máximo: ${maxScale}` }
    }

    return { valid: true }
}

/**
 * Export grades to CSV format
 */
export const exportGradesToCSV = (
    alunos: Aluno[],
    notas: Record<string, number>,
    componenteNome: string,
    turmaNome: string
): string => {
    const headers = ['Número', 'Nome Completo', 'Número de Processo', 'Nota']
    const rows = alunos.map((aluno, index) => {
        const nota = notas[aluno.id] !== undefined ? notas[aluno.id].toString() : ''
        return [
            (index + 1).toString(),
            aluno.nome_completo,
            aluno.numero_processo,
            nota
        ]
    })

    const csvContent = [
        `# ${turmaNome} - ${componenteNome}`,
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    return csvContent
}

/**
 * Download CSV file
 */
export const downloadCSV = (content: string, filename: string): void => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}

/**
 * Parse CSV content and validate
 */
export const parseGradesFromCSV = (
    csvContent: string,
    alunos: Aluno[],
    minScale: number,
    maxScale: number
): ImportResult => {
    const errors: ImportError[] = []
    const data: GradeData[] = []

    try {
        const lines = csvContent.split('\n').filter(line => line.trim() && !line.startsWith('#'))

        if (lines.length < 2) {
            return {
                success: false,
                imported: 0,
                errors: [{ row: 0, field: 'file', message: 'Arquivo CSV vazio ou inválido' }]
            }
        }

        // Skip header
        const dataLines = lines.slice(1)

        dataLines.forEach((line, index) => {
            const rowNumber = index + 2 // +2 because we skip header and arrays are 0-indexed

            // Parse CSV line (handle quoted values)
            const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '')) || []

            if (values.length < 4) {
                errors.push({
                    row: rowNumber,
                    field: 'format',
                    message: 'Formato inválido - esperado: Número, Nome, Nº Processo, Nota'
                })
                return
            }

            const [, , numeroProcesso, notaStr] = values

            // Find student by numero_processo
            const aluno = alunos.find(a => a.numero_processo === numeroProcesso)

            if (!aluno) {
                errors.push({
                    row: rowNumber,
                    field: 'numeroProcesso',
                    message: `Aluno não encontrado: ${numeroProcesso}`
                })
                return
            }

            // Validate grade
            if (notaStr && notaStr.trim()) {
                const nota = parseFloat(notaStr)

                if (isNaN(nota)) {
                    errors.push({
                        row: rowNumber,
                        field: 'nota',
                        message: `Nota inválida: ${notaStr}`
                    })
                    return
                }

                const validation = validateGradeValue(nota, minScale, maxScale)
                if (!validation.valid) {
                    errors.push({
                        row: rowNumber,
                        field: 'nota',
                        message: `${validation.message} (valor: ${nota})`
                    })
                    return
                }

                data.push({
                    alunoId: aluno.id,
                    alunoNome: aluno.nome_completo,
                    numeroProcesso: aluno.numero_processo,
                    valor: nota
                })
            }
        })

        return {
            success: errors.length === 0,
            imported: data.length,
            errors,
            data
        }
    } catch (error) {
        return {
            success: false,
            imported: 0,
            errors: [{ row: 0, field: 'file', message: 'Erro ao processar arquivo CSV' }]
        }
    }
}

/**
 * Get classification based on grade and education subsystem (RAA)
 */
export const getClassification = (grade: number, nivelEnsino?: string | null): string => {
    return getQualitativeClassification(grade, nivelEnsino)
}

/**
 * Get color for grade (faixas RAA por subsistema)
 */
export const getGradeColor = (grade: number, nivelEnsino?: string | null): string => {
    const bands = getQualitativeBands(nivelEnsino)
    if (grade >= bands.excellent) return 'text-green-600'
    if (grade >= bands.good) return 'text-blue-600'
    if (grade >= bands.sufficient) return 'text-yellow-600'
    return 'text-red-600'
}

/**
 * Get background color for grade (faixas RAA por subsistema)
 */
export const getGradeBgColor = (grade: number, nivelEnsino?: string | null): string => {
    const bands = getQualitativeBands(nivelEnsino)
    if (grade >= bands.excellent) return 'bg-green-50 border-green-200'
    if (grade >= bands.good) return 'bg-blue-50 border-blue-200'
    if (grade >= bands.sufficient) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
}

/** Re-export for callers that only need pass/fail against RAA limiar */
export { isGradePassing, getApprovalThreshold }

/**
 * Generate CSV template
 */
export const generateCSVTemplate = (alunos: Aluno[], componenteNome: string, turmaNome: string): string => {
    const headers = ['Número', 'Nome Completo', 'Número de Processo', 'Nota']
    const rows = alunos.map((aluno, index) => [
        (index + 1).toString(),
        aluno.nome_completo,
        aluno.numero_processo,
        '' // Empty grade field
    ])

    const csvContent = [
        `# Template de Importação - ${turmaNome} - ${componenteNome}`,
        `# Preencha a coluna "Nota" e importe o arquivo`,
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    return csvContent
}
