/**
 * Escalas oficiais de classificação (RAA — Decreto Executivo n.º 106/26).
 *
 * Primário: 1–10 | Secundário: 0–20
 * Instituições privadas: escala livre (configurável no componente).
 */

export type EscolaNatureza = 'publica' | 'publico_privada' | 'privada'

export type EducationSubsystem = 'primario' | 'secundario' | 'desconhecido'

export interface OfficialGradeScale {
    min: number
    max: number
    /** true = escala oficial obrigatória (escola não privada) */
    enforced: boolean
    subsystem: EducationSubsystem
    label: string
}

export const ESCOLA_NATUREZA_OPTIONS: Array<{ value: EscolaNatureza; label: string }> = [
    { value: 'publica', label: 'Pública' },
    { value: 'publico_privada', label: 'Público-privada' },
    { value: 'privada', label: 'Privada' },
]

export const PRIMARY_OFFICIAL_SCALE = { min: 1, max: 10 } as const
export const SECONDARY_OFFICIAL_SCALE = { min: 0, max: 20 } as const

export function parseEscolaNatureza(value: unknown): EscolaNatureza | null {
    if (value === 'publica' || value === 'publico_privada' || value === 'privada') {
        return value
    }
    return null
}

export function getEscolaNaturezaFromConfig(
    configuracoes?: Record<string, unknown> | null
): EscolaNatureza | null {
    if (!configuracoes) return null
    return parseEscolaNatureza(configuracoes.natureza)
}

export function isPrivateInstitution(natureza?: EscolaNatureza | null): boolean {
    return natureza === 'privada'
}

export function resolveEducationSubsystem(nivelEnsino?: string | null): EducationSubsystem {
    if (!nivelEnsino) return 'desconhecido'
    const n = nivelEnsino.toLowerCase()
    if (n.includes('primár') || n.includes('primar')) return 'primario'
    if (n.includes('secund')) return 'secundario'
    // Classes 1ª–6ª sem texto de nível explícito
    const classeMatch = n.match(/(\d+)\s*[ªºa]/)
    if (classeMatch) {
        const num = parseInt(classeMatch[1], 10)
        if (num >= 1 && num <= 6) return 'primario'
        if (num >= 7 && num <= 12) return 'secundario'
    }
    return 'desconhecido'
}

export function getOfficialGradeScale(opts: {
    natureza?: EscolaNatureza | null
    nivelEnsino?: string | null
}): OfficialGradeScale {
    const subsystem = resolveEducationSubsystem(opts.nivelEnsino)
    const privateSchool = isPrivateInstitution(opts.natureza)

    if (privateSchool) {
        return {
            min: SECONDARY_OFFICIAL_SCALE.min,
            max: SECONDARY_OFFICIAL_SCALE.max,
            enforced: false,
            subsystem,
            label: 'Escala livre (instituição privada)',
        }
    }

    if (subsystem === 'primario') {
        return {
            min: PRIMARY_OFFICIAL_SCALE.min,
            max: PRIMARY_OFFICIAL_SCALE.max,
            enforced: true,
            subsystem,
            label: 'Escala oficial RAA — Ensino Primário (1–10)',
        }
    }

    if (subsystem === 'secundario') {
        return {
            min: SECONDARY_OFFICIAL_SCALE.min,
            max: SECONDARY_OFFICIAL_SCALE.max,
            enforced: true,
            subsystem,
            label: 'Escala oficial RAA — Ensino Secundário (0–20)',
        }
    }

    // Nível desconhecido em escola não privada: aplicar 0–20 como fallback seguro
    return {
        min: SECONDARY_OFFICIAL_SCALE.min,
        max: SECONDARY_OFFICIAL_SCALE.max,
        enforced: true,
        subsystem: 'desconhecido',
        label: 'Escala oficial RAA (0–20)',
    }
}

/**
 * Escala efectiva para validação / inputs.
 * Privada → escala do componente; demais → oficial se enforced.
 */
export function getEffectiveGradeScale(opts: {
    natureza?: EscolaNatureza | null
    nivelEnsino?: string | null
    componenteMin?: number | null
    componenteMax?: number | null
}): { min: number; max: number; enforced: boolean; label: string; subsystem: EducationSubsystem } {
    const official = getOfficialGradeScale(opts)

    if (!official.enforced) {
        const min = opts.componenteMin ?? SECONDARY_OFFICIAL_SCALE.min
        const max = opts.componenteMax ?? SECONDARY_OFFICIAL_SCALE.max
        return {
            min,
            max,
            enforced: false,
            label: `Escala do componente (${min}–${max})`,
            subsystem: official.subsystem,
        }
    }

    return {
        min: official.min,
        max: official.max,
        enforced: true,
        label: official.label,
        subsystem: official.subsystem,
    }
}

export function validateGradeAgainstPolicy(
    valor: number,
    opts: {
        natureza?: EscolaNatureza | null
        nivelEnsino?: string | null
        componenteMin?: number | null
        componenteMax?: number | null
    }
): { valid: boolean; message?: string; min: number; max: number } {
    const scale = getEffectiveGradeScale(opts)

    if (Number.isNaN(valor)) {
        return { valid: false, message: 'Valor inválido', min: scale.min, max: scale.max }
    }

    if (valor < scale.min || valor > scale.max) {
        if (scale.enforced) {
            const nivelLabel =
                scale.subsystem === 'primario'
                    ? 'Ensino Primário'
                    : scale.subsystem === 'secundario'
                      ? 'Ensino Secundário'
                      : 'o subsistema'
            return {
                valid: false,
                message: `Nota fora da escala oficial do ${nivelLabel} (${scale.min}–${scale.max})`,
                min: scale.min,
                max: scale.max,
            }
        }
        return {
            valid: false,
            message: `Nota deve estar entre ${scale.min} e ${scale.max}`,
            min: scale.min,
            max: scale.max,
        }
    }

    return { valid: true, min: scale.min, max: scale.max }
}

/**
 * Converte nota de escala 0–20 para 1–10 (migração primário).
 * 10 → 5 (aprovação), 20 → 10.
 */
export function normalizePrimaryGradeFrom020(valor: number): number {
    if (Number.isNaN(valor)) return PRIMARY_OFFICIAL_SCALE.min
    const converted = Math.round(valor / 2)
    return Math.min(PRIMARY_OFFICIAL_SCALE.max, Math.max(PRIMARY_OFFICIAL_SCALE.min, converted))
}

export function defaultScaleForNewComponent(opts: {
    natureza?: EscolaNatureza | null
    nivelEnsino?: string | null
}): { escala_minima: number; escala_maxima: number } {
    const scale = getOfficialGradeScale(opts)
    if (scale.enforced) {
        return { escala_minima: scale.min, escala_maxima: scale.max }
    }
    // Privada: default sugerido 0–20 (editável)
    return {
        escala_minima: SECONDARY_OFFICIAL_SCALE.min,
        escala_maxima: SECONDARY_OFFICIAL_SCALE.max,
    }
}

/**
 * Limiar de aprovação / transição académica por subsistema (RAA).
 * Primário (1–10): ≥ 5 | Secundário (0–20): ≥ 10
 */
export function getApprovalThreshold(nivelEnsino?: string | null): number {
    return resolveEducationSubsystem(nivelEnsino) === 'primario' ? 5 : 10
}

export function isGradePassing(nota: number, nivelEnsino?: string | null): boolean {
    return !Number.isNaN(nota) && nota >= getApprovalThreshold(nivelEnsino)
}

export interface QualitativeBands {
    excellent: number
    good: number
    sufficient: number
    labels: {
        excellent: string
        good: string
        sufficient: string
        insufficient: string
    }
}

/** Faixas qualitativas oficiais (espelho da escala 0–20 reduzida a 1–10 no Primário). */
export const PRIMARY_QUALITATIVE_BANDS: QualitativeBands = {
    excellent: 9,
    good: 7,
    sufficient: 5,
    labels: {
        excellent: 'Excelente (9-10)',
        good: 'Bom (7-8)',
        sufficient: 'Suficiente (5-6)',
        insufficient: 'Insuficiente (1-4)',
    },
}

export const SECONDARY_QUALITATIVE_BANDS: QualitativeBands = {
    excellent: 17,
    good: 14,
    sufficient: 10,
    labels: {
        excellent: 'Excelente (17-20)',
        good: 'Bom (14-16)',
        sufficient: 'Suficiente (10-13)',
        insufficient: 'Insuficiente (0-9)',
    },
}

export function getQualitativeBands(nivelEnsino?: string | null): QualitativeBands {
    return resolveEducationSubsystem(nivelEnsino) === 'primario'
        ? PRIMARY_QUALITATIVE_BANDS
        : SECONDARY_QUALITATIVE_BANDS
}

/**
 * Classificação qualitativa RAA por subsistema:
 * Primário: Excelente ≥9, Bom ≥7, Suficiente ≥5
 * Secundário: Excelente ≥17, Bom ≥14, Suficiente ≥10
 */
export function getQualitativeClassification(
    nota: number,
    nivelEnsino?: string | null
): 'Excelente' | 'Bom' | 'Suficiente' | 'Insuficiente' {
    const bands = getQualitativeBands(nivelEnsino)
    if (nota >= bands.excellent) return 'Excelente'
    if (nota >= bands.good) return 'Bom'
    if (nota >= bands.sufficient) return 'Suficiente'
    return 'Insuficiente'
}
