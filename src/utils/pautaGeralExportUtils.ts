/**
 * Shared helpers so Pauta-Geral preview/export respect the user's field configuration.
 */

import { classifyStudent, type DisciplinaGrade } from './studentClassification'
import {
    formatObservacaoPautaLabel,
    normalizeComponenteCode,
    type ObservacaoPauta,
} from './pautaGeralFieldUtils'

export interface PautaGeralExportConfig {
    showNumeroProcesso: boolean
    showNomeCompleto: boolean
    showMediaGeral: boolean
    showObservacao: boolean
    showStatistics: boolean
    /** Component code used for MG and classification (e.g. MF, MT, MFD). */
    componenteParaMediaGeral: string
}

export const DEFAULT_PAUTA_GERAL_EXPORT_CONFIG: PautaGeralExportConfig = {
    showNumeroProcesso: true,
    showNomeCompleto: true,
    showMediaGeral: true,
    showObservacao: true,
    showStatistics: true,
    componenteParaMediaGeral: 'MF',
}

export interface PautaGeralMetricComponente {
    id: string
    codigo_componente: string
    trimestre?: number | null
    is_calculated?: boolean | null
    tipo_calculo?: string | null
    nome?: string | null
}

export interface PautaGeralMetricDisciplina {
    id: string
    nome: string
    componentes: PautaGeralMetricComponente[]
}

export interface PautaGeralAlunoMetrics {
    media_geral: number
    observacao: ObservacaoPauta
    motivos: string[]
    disciplinas_em_risco: string[]
}

/**
 * Pick the grade source component for MG/classification from the user's configured code.
 * Prefer highest trimestre when several MT (etc.) are present among selected columns.
 */
export function pickComponenteParaMediaGeral(
    componentes: PautaGeralMetricComponente[],
    codeWanted: string
): PautaGeralMetricComponente | undefined {
    const wanted = normalizeComponenteCode(codeWanted)
    return [...componentes]
        .filter((c) => normalizeComponenteCode(c.codigo_componente) === wanted)
        .sort((a, b) => (Number(b.trimestre) || 0) - (Number(a.trimestre) || 0))[0]
}

/**
 * Recalculate MG + classification from the disciplinas/colunas currently configured.
 */
export function computePautaGeralAlunoMetrics(
    aluno: {
        notas_por_disciplina: Record<string, Record<string, number>>
        frequencia_anual?: number
    },
    disciplinas: PautaGeralMetricDisciplina[],
    opts: {
        componenteParaMediaGeral: string
        nivelEnsino?: string | null
        classe?: string | null
        disciplinasObrigatorias?: string[]
    }
): PautaGeralAlunoMetrics {
    const notasFinais: number[] = []
    const disciplinaGrades: DisciplinaGrade[] = []

    disciplinas.forEach((disc) => {
        const notasDisciplina = aluno.notas_por_disciplina[disc.id] || {}
        const componente = pickComponenteParaMediaGeral(
            disc.componentes,
            opts.componenteParaMediaGeral
        )
        if (!componente) return

        const nota = notasDisciplina[componente.id]
        if (nota === undefined) return

        // Align with preview: cap at 10 for classification scale used in rules
        const notaFinal = nota > 10 ? 10 : nota
        notasFinais.push(notaFinal)
        disciplinaGrades.push({ id: disc.id, nome: disc.nome, nota: notaFinal })
    })

    let mediaGeral = 0
    if (notasFinais.length > 0) {
        mediaGeral = notasFinais.reduce((s, n) => s + n, 0) / notasFinais.length
        mediaGeral = Math.round(mediaGeral * 100) / 100
    }

    const classification = classifyStudent(
        disciplinaGrades,
        opts.nivelEnsino || undefined,
        opts.classe || undefined,
        opts.disciplinasObrigatorias,
        aluno.frequencia_anual
    )

    return {
        media_geral: mediaGeral,
        observacao: classification.status,
        motivos: classification.motivos,
        disciplinas_em_risco: classification.disciplinas_em_risco,
    }
}

export function applyExportMetricsToAlunos<
    T extends {
        notas_por_disciplina: Record<string, Record<string, number>>
        frequencia_anual?: number
        media_geral?: number
        observacao?: ObservacaoPauta
    },
>(
    alunos: T[],
    disciplinas: PautaGeralMetricDisciplina[],
    opts: {
        componenteParaMediaGeral: string
        nivelEnsino?: string | null
        classe?: string | null
        disciplinasObrigatorias?: string[]
    }
): Array<T & { media_geral: number; observacao: ObservacaoPauta }> {
    return alunos.map((aluno) => {
        const metrics = computePautaGeralAlunoMetrics(aluno, disciplinas, opts)
        return {
            ...aluno,
            media_geral: metrics.media_geral,
            observacao: metrics.observacao,
        }
    })
}

export { formatObservacaoPautaLabel }
