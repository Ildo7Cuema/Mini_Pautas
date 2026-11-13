/**
 * Classificação final e menções — Decreto Presidencial n.º 28/22
 * Art. 19.º (perequação) + Art. 20.º (menções)
 *
 * CF = Σ(graduação_i × coeficiente_i) / Σ(coeficiente_i)
 * Graduação Anexo I: 5 | 10 | 15 | 20
 */

import type { GraduacaoIndicador, MencaoClassificacao } from '../types'

export const GRADUACOES_VALIDAS: GraduacaoIndicador[] = [5, 10, 15, 20]

export const MENCAO_LABELS: Record<MencaoClassificacao, string> = {
    MUITO_BOM: 'Muito Bom',
    BOM: 'Bom',
    SUFICIENTE: 'Suficiente',
    MAU: 'Mau',
}

export const MENCAO_RANGES: Record<MencaoClassificacao, string> = {
    MUITO_BOM: '18 a 20',
    BOM: '14 a 17',
    SUFICIENTE: '10 a 13',
    MAU: '0 a 9',
}

export interface ScoreInput {
    graduacao: number
    coeficiente: number
}

/** Art. 19.º — classificação final ponderada na escala da graduação (0–20). */
export function calcularClassificacaoFinal(scores: ScoreInput[]): number | null {
    if (!scores.length) return null
    let somaPonderada = 0
    let somaCoef = 0
    for (const s of scores) {
        const coef = Number(s.coeficiente) || 0
        const grad = Number(s.graduacao) || 0
        if (coef <= 0) continue
        somaPonderada += grad * coef
        somaCoef += coef
    }
    if (somaCoef <= 0) return null
    return Math.round((somaPonderada / somaCoef) * 100) / 100
}

/** Art. 20.º */
export function mencaoFromClassificacao(cf: number | null | undefined): MencaoClassificacao | null {
    if (cf == null || Number.isNaN(cf)) return null
    if (cf >= 18) return 'MUITO_BOM'
    if (cf >= 14) return 'BOM'
    if (cf >= 10) return 'SUFICIENTE'
    return 'MAU'
}

export function labelMencao(mencao: MencaoClassificacao | null | undefined): string {
    if (!mencao) return '—'
    return MENCAO_LABELS[mencao]
}

export function valorIndicador(graduacao: number, coeficiente: number): number {
    return Math.round(graduacao * coeficiente * 10000) / 10000
}

export function isGraduacaoValida(v: number): v is GraduacaoIndicador {
    return GRADUACOES_VALIDAS.includes(v as GraduacaoIndicador)
}
