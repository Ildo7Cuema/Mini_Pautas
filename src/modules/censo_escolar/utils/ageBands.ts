import { ModalidadeCensoCodigo } from '../types'

/** Idade em anos completos na data de referência. */
export function calcIdade(dataNascimento: string | null | undefined, dataReferencia: Date): number | null {
    if (!dataNascimento) return null
    const nasc = new Date(dataNascimento)
    if (Number.isNaN(nasc.getTime())) return null
    let idade = dataReferencia.getFullYear() - nasc.getFullYear()
    const m = dataReferencia.getMonth() - nasc.getMonth()
    if (m < 0 || (m === 0 && dataReferencia.getDate() < nasc.getDate())) idade--
    return idade < 0 ? null : idade
}

export function faixaEtariaFor(
    modalidade: ModalidadeCensoCodigo,
    idade: number | null
): string {
    if (idade === null || idade === undefined) return 'Idade não especificada'

    if (modalidade === 'ensino_primario_geral') {
        if (idade < 6) return 'Menos de 6 anos'
        if (idade <= 12) return `${idade} anos`
        if (idade === 13) return '13 anos'
        if (idade === 14) return '14 anos'
        if (idade >= 15 && idade <= 19) return '15 a 19 anos'
        if (idade >= 20 && idade <= 24) return '20 a 24 anos'
        if (idade > 24) return 'Mais de 24 anos'
        return 'Idade não especificada'
    }

    if (modalidade === 'i_ciclo_secundario_geral') {
        if (idade < 12) return 'Menos de 12 anos'
        if (idade <= 19) return `${idade} anos`
        if (idade >= 20 && idade <= 24) return '20 a 24 anos'
        if (idade > 24) return 'Mais de 24 anos'
        return 'Idade não especificada'
    }

    // II ciclo
    if (idade < 15) return 'Menos de 15 anos'
    if (idade <= 24) return `${idade} anos`
    if (idade >= 25 && idade <= 29) return '25 a 29 anos'
    if (idade >= 30 && idade <= 34) return '30 a 34 anos'
    if (idade >= 35 && idade <= 39) return '35 a 39 anos'
    if (idade >= 40 && idade <= 44) return '40 a 44 anos'
    if (idade >= 45 && idade <= 49) return '45 a 49 anos'
    if (idade > 49) return 'Mais de 49 anos'
    return 'Idade não especificada'
}

/**
 * Sugere o ano lectivo actual no formato do Censo (ex.: 2025/2026).
 * Em Angola o ano lectivo costuma cruzar dois anos civis; a partir de Setembro
 * usa Y/(Y+1), antes disso (Y-1)/Y.
 */
export function suggestAnoLectivoCenso(date: Date = new Date()): string {
    const y = date.getFullYear()
    const m = date.getMonth() + 1
    if (m >= 9) return `${y}/${y + 1}`
    return `${y - 1}/${y}`
}

/** Normaliza texto do ano lectivo (espaços, barras). */
export function normalizeAnoLectivoInput(value: string): string {
    return value.trim().replace(/\s+/g, '').replace(/-/g, '/')
}

/** Data de referência padrão: 31 de Março do ano final do ano lectivo (prática comum de censo). */
export function defaultDataReferenciaIdade(anoLectivo: string): Date {
    const parts = anoLectivo.split(/[\/\-]/).map(p => p.trim()).filter(Boolean)
    let year = new Date().getFullYear()
    if (parts.length >= 2) {
        const y = parseInt(parts[1], 10)
        if (!Number.isNaN(y)) year = y < 100 ? 2000 + y : y
    } else if (parts.length === 1) {
        const y = parseInt(parts[0], 10)
        if (!Number.isNaN(y)) year = y < 100 ? 2000 + y : y
    }
    return new Date(year, 2, 31) // 31 Março
}
