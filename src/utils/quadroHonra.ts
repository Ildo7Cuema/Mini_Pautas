/**
 * Quadro de Mérito / Honra — Decreto Executivo n.º 76/24 (MED Angola).
 *
 * Periodicidade oficial:
 * - Prémio de Mérito → trimestral
 * - Quadro de Honra → anual
 *
 * Critérios académicos (Art. 9.º):
 * - Primário: média ≥ 8 e nenhuma classificação < 6 (escala 1–10)
 * - Secundário: média ≥ 16 e nenhuma classificação < 12 (escala 0–20), arredondadas às unidades
 * - Décimas: apenas para escalonamento / desempate (Art. 9.º e)
 *
 * Medalhas (Art. 12.º):
 * - Primário: Ouro=10 | Prata=8–9 | Bronze=6–7
 * - Secundário: Ouro=20 | Prata=18–19 | Bronze=14–17
 */

import {
    getQualitativeClassification,
    resolveEducationSubsystem,
} from './angolaGradeScale'

export type QuadroHonraPeriodo = 1 | 2 | 3 | 'anual'
export type MedalhaHonra = 'Ouro' | 'Prata' | 'Bronze'
export type DistincaoTipo = 'premio_merito' | 'quadro_honra'

export interface QuadroHonraThresholds {
    mediaMinima: number
    notaMinimaPorDisciplina: number
    escalaMax: number
    subsystem: 'primario' | 'secundario' | 'desconhecido'
}

export interface QuadroHonraAlunoInput {
    aluno_id: string
    numero_processo: string
    nome_completo: string
    genero?: string | null
    foto_url?: string | null
    /** Nota da disciplina (ou média geral no modo global) */
    nota: number
    /** Notas de todas as disciplinas — obrigatório para elegibilidade global */
    notas_disciplinas?: number[]
}

export interface QuadroHonraEntry {
    posicao: number
    aluno_id: string
    numero_processo: string
    nome_completo: string
    genero?: string | null
    foto_url?: string | null
    nota: number
    nota_arredondada: number
    classificacao: string
    medalha: MedalhaHonra | null
    elegivel: boolean
}

export function getDistincaoTipo(periodo: QuadroHonraPeriodo): DistincaoTipo {
    return periodo === 'anual' ? 'quadro_honra' : 'premio_merito'
}

export function getDistincaoLabel(periodo: QuadroHonraPeriodo): string {
    return periodo === 'anual' ? 'Quadro de Honra' : 'Prémio de Mérito'
}

export function getQuadroHonraThresholds(nivelEnsino?: string | null): QuadroHonraThresholds {
    const subsystem = resolveEducationSubsystem(nivelEnsino)
    if (subsystem === 'primario') {
        return {
            mediaMinima: 8,
            notaMinimaPorDisciplina: 6,
            escalaMax: 10,
            subsystem,
        }
    }
    return {
        mediaMinima: 16,
        notaMinimaPorDisciplina: 12,
        escalaMax: 20,
        subsystem: subsystem === 'secundario' ? 'secundario' : 'desconhecido',
    }
}

/** Arredondamento às unidades (Art. 9.º d / e). */
export function roundToUnit(nota: number): number {
    return Math.round(nota)
}

/**
 * Elegibilidade por disciplina (adaptação do limiar de média do Art. 9.º
 * para ranking trimestral/anual por disciplina).
 */
export function isEligibleForDisciplinaHonra(
    nota: number,
    nivelEnsino?: string | null
): boolean {
    const t = getQuadroHonraThresholds(nivelEnsino)
    return roundToUnit(nota) >= t.mediaMinima
}

/**
 * Elegibilidade global (Art. 9.º): média ≥ limiar e nenhuma disciplina abaixo do mínimo.
 */
export function evaluateOverallEligibility(
    notasPorDisciplina: number[],
    nivelEnsino?: string | null
): { eligible: boolean; media: number; motivo?: string } {
    const t = getQuadroHonraThresholds(nivelEnsino)
    if (notasPorDisciplina.length === 0) {
        return { eligible: false, media: 0, motivo: 'Sem notas' }
    }

    const media = notasPorDisciplina.reduce((a, b) => a + b, 0) / notasPorDisciplina.length
    const mediaArred = roundToUnit(media)
    const belowMin = notasPorDisciplina.filter(
        (n) => roundToUnit(n) < t.notaMinimaPorDisciplina
    )

    if (mediaArred < t.mediaMinima) {
        return {
            eligible: false,
            media,
            motivo: `Média ${mediaArred} inferior ao mínimo de ${t.mediaMinima}`,
        }
    }
    if (belowMin.length > 0) {
        return {
            eligible: false,
            media,
            motivo: `Há classificação(ões) inferior(es) a ${t.notaMinimaPorDisciplina}`,
        }
    }
    return { eligible: true, media }
}

/** Medalha simbólica (Art. 12.º). */
export function getMedalhaHonra(
    nota: number,
    nivelEnsino?: string | null
): MedalhaHonra | null {
    const subsystem = resolveEducationSubsystem(nivelEnsino)
    const rounded = roundToUnit(nota)

    if (subsystem === 'primario') {
        if (rounded >= 10) return 'Ouro'
        if (rounded >= 8) return 'Prata'
        if (rounded >= 6) return 'Bronze'
        return null
    }

    if (rounded >= 20) return 'Ouro'
    if (rounded >= 18) return 'Prata'
    if (rounded >= 14) return 'Bronze'
    return null
}

export function getCriteriaDescription(nivelEnsino?: string | null): string {
    const t = getQuadroHonraThresholds(nivelEnsino)
    if (t.subsystem === 'primario') {
        return `Ensino Primário (Dec. Ext. 76/24): média ≥ ${t.mediaMinima} e nenhuma nota < ${t.notaMinimaPorDisciplina} (escala 1–${t.escalaMax}). Por disciplina: nota ≥ ${t.mediaMinima}.`
    }
    return `Ensino Secundário (Dec. Ext. 76/24): média ≥ ${t.mediaMinima} e nenhuma nota < ${t.notaMinimaPorDisciplina} (escala 0–${t.escalaMax}). Por disciplina: nota ≥ ${t.mediaMinima}. Décimas só para desempate.`
}

export type QuadroHonraMode = 'disciplina' | 'global'

/**
 * Classifica e ordena alunos para o quadro.
 * - modo disciplina: elegível se nota da disciplina ≥ limiar de média
 * - modo global: elegível se média geral e mínimo por disciplina (Art. 9.º)
 * Ordenação: nota descendente; décimas desempata; depois nome.
 */
export function classifyQuadroHonra(
    alunos: QuadroHonraAlunoInput[],
    opts: {
        nivelEnsino?: string | null
        mode?: QuadroHonraMode
        /** Se false, inclui não elegíveis no fim da lista */
        onlyEligible?: boolean
    } = {}
): QuadroHonraEntry[] {
    const mode = opts.mode ?? 'disciplina'
    const onlyEligible = opts.onlyEligible ?? true
    const nivel = opts.nivelEnsino

    const mapped: QuadroHonraEntry[] = alunos.map((a) => {
        let elegivel = false
        let notaRef = a.nota

        if (mode === 'global') {
            const evalResult = evaluateOverallEligibility(
                a.notas_disciplinas ?? [a.nota],
                nivel
            )
            elegivel = evalResult.eligible
            notaRef = evalResult.media
        } else {
            elegivel = isEligibleForDisciplinaHonra(a.nota, nivel)
            notaRef = a.nota
        }

        return {
            posicao: 0,
            aluno_id: a.aluno_id,
            numero_processo: a.numero_processo,
            nome_completo: a.nome_completo,
            genero: a.genero,
            foto_url: a.foto_url ?? null,
            nota: notaRef,
            nota_arredondada: roundToUnit(notaRef),
            classificacao: getQualitativeClassification(notaRef, nivel),
            medalha: elegivel ? getMedalhaHonra(notaRef, nivel) : null,
            elegivel,
        }
    })

    const filtered = onlyEligible ? mapped.filter((e) => e.elegivel) : mapped

    filtered.sort((a, b) => {
        if (b.nota !== a.nota) return b.nota - a.nota
        return a.nome_completo.localeCompare(b.nome_completo, 'pt')
    })

    // Posições com empate real (mesma nota exacta partilha posição)
    let pos = 0
    let lastNota: number | null = null
    for (let i = 0; i < filtered.length; i++) {
        if (lastNota === null || filtered[i].nota !== lastNota) {
            pos = i + 1
            lastNota = filtered[i].nota
        }
        filtered[i].posicao = pos
    }

    return filtered
}
