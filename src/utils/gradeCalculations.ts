/**
 * Utility functions for calculating final grades and classifications
 */

import {
    getApprovalThreshold,
    getQualitativeClassification,
    isGradePassing,
} from './angolaGradeScale'

interface ComponenteAvaliacao {
    id: string
    codigo_componente: string
    peso_percentual: number
}

interface Nota {
    componente_id: string
    valor: number
}

export interface NotaFinalCalculada {
    nota_final: number
    classificacao: string
    aprovado: boolean
    detalhes: Record<string, {
        valor: number
        peso: number
        contribuicao: number
    }>
}

/**
 * Calculate final grade based on component grades and weights
 * Missing grades are treated as zero and all component weights are used in the calculation
 */
export function calculateNotaFinal(
    notas: Nota[],
    componentes: ComponenteAvaliacao[],
    nivelEnsino?: string | null
): NotaFinalCalculada {
    const notasMap = new Map(notas.map(n => [n.componente_id, n.valor]))
    const detalhes: Record<string, any> = {}

    let somaContribuicoes = 0
    let somaPesos = 0

    componentes.forEach(comp => {
        // Get the grade value, treating missing grades as zero
        const valor = notasMap.get(comp.id) ?? 0
        const peso = comp.peso_percentual / 100
        const contribuicao = valor * peso

        detalhes[comp.codigo_componente] = {
            valor,
            peso: comp.peso_percentual,
            contribuicao
        }

        somaContribuicoes += contribuicao
        somaPesos += comp.peso_percentual
    })

    // Calculate final grade using all component weights
    const nota_final = somaPesos > 0 ? (somaContribuicoes / somaPesos) * 100 : 0

    const classificacao = getClassificacao(nota_final, nivelEnsino)
    const aprovado = isGradePassing(nota_final, nivelEnsino)

    return {
        nota_final,
        classificacao,
        aprovado,
        detalhes
    }
}


/**
 * Get classification based on grade and education subsystem (RAA)
 */
export function getClassificacao(nota: number, nivelEnsino?: string | null): string {
    return getQualitativeClassification(nota, nivelEnsino)
}

/**
 * Calculate statistics for a class
 */
export interface TurmaStatistics {
    total_alunos: number
    aprovados: number
    reprovados: number
    taxa_aprovacao: number
    media_turma: number
    nota_minima: number
    nota_maxima: number
    distribuicao: Record<string, number>
}

export function calculateStatistics(
    notasFinais: number[],
    nivelEnsino?: string | null
): TurmaStatistics {
    if (notasFinais.length === 0) {
        return {
            total_alunos: 0,
            aprovados: 0,
            reprovados: 0,
            taxa_aprovacao: 0,
            media_turma: 0,
            nota_minima: 0,
            nota_maxima: 0,
            distribuicao: {}
        }
    }

    const limiar = getApprovalThreshold(nivelEnsino)
    const total_alunos = notasFinais.length
    const aprovados = notasFinais.filter(n => n >= limiar).length
    const reprovados = total_alunos - aprovados
    const taxa_aprovacao = (aprovados / total_alunos) * 100

    const soma = notasFinais.reduce((acc, n) => acc + n, 0)
    const media_turma = soma / total_alunos

    const nota_minima = Math.min(...notasFinais)
    const nota_maxima = Math.max(...notasFinais)

    const distribuicao: Record<string, number> = {
        'Excelente': 0,
        'Bom': 0,
        'Suficiente': 0,
        'Insuficiente': 0
    }

    notasFinais.forEach(nota => {
        const classificacao = getClassificacao(nota, nivelEnsino)
        distribuicao[classificacao]++
    })

    return {
        total_alunos,
        aprovados,
        reprovados,
        taxa_aprovacao,
        media_turma,
        nota_minima,
        nota_maxima,
        distribuicao
    }
}
