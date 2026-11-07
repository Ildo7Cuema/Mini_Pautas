/**
 * Helpers for Pauta-Geral field selection.
 * Aligned with typical MED Angola maps/pautas: show trimestral/final averages
 * (MT, MF/MFD…), not raw lançamento components (MAC, NPT), unless the user opts in.
 */

/** Codes that represent result columns on official-style Pauta-Geral. */
export const PAUTA_RESULT_CODES = new Set([
    'MT', 'MF', 'MFD', 'NF', 'CF', 'MEC', 'MEDIA', 'MÉDIA',
])

/** Codes typically used only for grade entry (not default on Pauta-Geral). */
export const PAUTA_LANCAMENTO_CODES = new Set([
    'MAC', 'NPT', 'PP', 'PT', 'AC', 'P1', 'P2', 'P3',
])

export interface PautaComponenteLike {
    id: string
    codigo_componente: string
    nome: string
    trimestre?: number | null
    is_calculated?: boolean | null
    tipo_calculo?: string | null
    ordem?: number | null
}

export function normalizeComponenteCode(code: string | null | undefined): string {
    return (code || '').trim().toUpperCase()
}

/** Result / average column suitable for Pauta-Geral by default. */
export function isPautaResultComponent(c: PautaComponenteLike): boolean {
    const code = normalizeComponenteCode(c.codigo_componente)
    if (PAUTA_RESULT_CODES.has(code)) return true
    if (c.is_calculated === true && !PAUTA_LANCAMENTO_CODES.has(code)) return true
    return false
}

/** Manual lançamento component (optional on Pauta-Geral). */
export function isPautaLancamentoComponent(c: PautaComponenteLike): boolean {
    const code = normalizeComponenteCode(c.codigo_componente)
    if (PAUTA_LANCAMENTO_CODES.has(code)) return true
    if (c.is_calculated === true) return false
    return !isPautaResultComponent(c)
}

export function componenteTrimestreLabel(trimestre?: number | null, tipoCalculo?: string | null): string {
    if (tipoCalculo === 'anual') return 'Anual'
    if (trimestre === 1) return '1º T'
    if (trimestre === 2) return '2º T'
    if (trimestre === 3) return '3º T'
    return ''
}

/**
 * Compact export/UI label: MT-1º, MT-2º, MF-Anual, MAC-1º…
 * Matches the usual reading of official maps/pautas.
 */
export function formatComponentePautaLabel(c: PautaComponenteLike): string {
    const code = normalizeComponenteCode(c.codigo_componente) || c.codigo_componente
    if (c.tipo_calculo === 'anual') return `${code}-Anual`
    const t = Number(c.trimestre)
    if (t === 1 || t === 2 || t === 3) return `${code}-${t}º`
    return code
}

export type ObservacaoPauta =
    | 'Transita'
    | 'Não Transita'
    | 'Condicional'
    | 'AguardandoNotas'
    | string
    | null
    | undefined

/** Full observation text for exports (never T / NT). */
export function formatObservacaoPautaLabel(obs: ObservacaoPauta): string {
    if (!obs) return '-'
    switch (obs) {
        case 'Transita':
            return 'Transita'
        case 'Não Transita':
            return 'Não Transita'
        case 'Condicional':
            return 'Condicional'
        case 'AguardandoNotas':
            return 'Aguardando Notas'
        default:
            return String(obs)
    }
}

export interface PautaLegendaComponente {
    codigo_componente: string
    nome?: string
    formula_expression?: string | null
    is_calculated?: boolean | null
    tipo_calculo?: string | null
    trimestre?: number | null
}

export interface PautaGeralLegendaOptions {
    nivelEnsino?: string | null
    classe?: string | null
    /** Only document columns actually on the pauta. */
    showMediaGeral?: boolean
    showObservacao?: boolean
    /** Code configured for MG / classification (e.g. MF, MT). */
    componenteParaMediaGeral?: string | null
    /**
     * Extra components (e.g. MF used for MG but not shown as a column)
     * so the legend can still document their formula when MG/OBS are on.
     */
    metricSourceComponentes?: PautaLegendaComponente[]
}

export interface PautaGeralLegendaRow {
    item: string
    detalhe: string
}

function describeComponenteFormulaLine(c: PautaLegendaComponente): PautaGeralLegendaRow {
    const code = normalizeComponenteCode(c.codigo_componente)
    const nome = c.nome?.trim()
    const isAnual = c.tipo_calculo === 'anual' || code === 'MF' || code === 'MFD'
    const legendCode = isAnual
        ? (code === 'MF' || code === 'MFD' ? `${code}-Anual` : formatComponentePautaLabel(c))
        : code
    const hasTrimestre = Number(c.trimestre) === 1 || Number(c.trimestre) === 2 || Number(c.trimestre) === 3
    const scopeHint =
        !isAnual && hasTrimestre
            ? ` por trimestre (ex.: ${code}-1º, ${code}-2º, ${code}-3º)`
            : ''

    let formula = c.formula_expression?.trim() || ''
    if (!formula && (code === 'MF' || code === 'MFD')) {
        formula = '(MT1 + MT2 + MT3) / 3'
    }
    if (!formula && code === 'MT') {
        formula = '(MAC + NPT) / 2'
    }

    const label = `${legendCode}${nome ? ` — ${nome}` : ''}${scopeHint}`
    if (formula) return { item: label, detalhe: formula }
    if (isPautaLancamentoComponent(c)) {
        return { item: label, detalhe: 'Componente de lançamento (nota introduzida)' }
    }
    return { item: label, detalhe: '-' }
}

function collectLegendComponentMap(componentes: PautaLegendaComponente[]) {
    const unique = new Map<string, PautaLegendaComponente>()
    for (const c of componentes) {
        const code = normalizeComponenteCode(c.codigo_componente)
        const key = `${code}|${c.tipo_calculo || ''}|${Number(c.trimestre) || 0}|${c.formula_expression || ''}`
        if (!unique.has(key)) unique.set(key, c)
    }

    const byCodeFormula = new Map<string, PautaLegendaComponente>()
    for (const c of unique.values()) {
        const code = normalizeComponenteCode(c.codigo_componente)
        const fk = `${code}|${(c.formula_expression || '').trim()}`
        if (!byCodeFormula.has(fk)) byCodeFormula.set(fk, c)
    }
    return byCodeFormula
}

/**
 * Structured legend rows for compact export tables (PDF/Excel).
 * Uses ASCII-safe operators (>=) for Helvetica/PDF compatibility.
 */
export function buildPautaGeralLegendaTableRows(
    componentes: PautaLegendaComponente[],
    opts?: PautaGeralLegendaOptions
): PautaGeralLegendaRow[] {
    const showMediaGeral = opts?.showMediaGeral !== false
    const showObservacao = opts?.showObservacao !== false
    const mediaCode = normalizeComponenteCode(opts?.componenteParaMediaGeral || 'MF') || 'MF'
    const byCodeFormula = collectLegendComponentMap(componentes)
    const rows: PautaGeralLegendaRow[] = []

    for (const c of byCodeFormula.values()) {
        rows.push(describeComponenteFormulaLine(c))
    }

    if (showMediaGeral) {
        rows.push({
            item: 'MG (Média Geral)',
            detalhe: `Média aritmética do componente "${mediaCode}" nas disciplinas incluídas na pauta (config. do utilizador).`,
        })

        const mediaAlreadyDocumented = [...byCodeFormula.values()].some(
            (c) => normalizeComponenteCode(c.codigo_componente) === mediaCode
        )
        if (!mediaAlreadyDocumented && opts?.metricSourceComponentes?.length) {
            const metricComp = opts.metricSourceComponentes.find(
                (c) => normalizeComponenteCode(c.codigo_componente) === mediaCode
            )
            if (metricComp) {
                const src = describeComponenteFormulaLine(metricComp)
                rows.push({
                    item: `Fonte MG (${mediaCode})`,
                    detalhe: `${src.item}: ${src.detalhe}`,
                })
            }
        }
    }

    if (showObservacao) {
        const isPrimary =
            (opts?.nivelEnsino || '').toLowerCase().includes('primár') ||
            (opts?.nivelEnsino || '').toLowerCase().includes('primar')

        if (isPrimary) {
            rows.push({
                item: 'Classificação (Observação)',
                detalhe: `Transita se todas as notas de "${mediaCode}" >= 5 valores e frequência >= 66,67%; caso contrário Não Transita.`,
            })
        } else {
            rows.push({
                item: 'Classificação (Observação)',
                detalhe: `Baseada em "${mediaCode}": frequência >= 66,67%; regra geral >= 10; 7ª/8ª/10ª/11ª podem ter Condicional (até 2 disciplinas entre 7 e 9, sem Português e Matemática em simultâneo); 9ª/12ª exigem todas >= 10.`,
            })
        }

        rows.push({
            item: 'Valores de Observação',
            detalhe: 'Transita | Não Transita | Condicional | Aguardando Notas',
        })
    }

    if (rows.length === 0) {
        rows.push({
            item: 'Configuração',
            detalhe: 'Nenhuma coluna de resultado adicional configurada.',
        })
    }

    return rows
}

/**
 * Legend lines for exported Pauta-Geral — only what the user configured to show.
 */
export function buildPautaGeralLegendaLines(
    componentes: PautaLegendaComponente[],
    opts?: PautaGeralLegendaOptions
): string[] {
    const rows = buildPautaGeralLegendaTableRows(componentes, opts)
    return [
        'LEGENDA — conforme configuração desta pauta',
        ...rows.map((r) => `${r.item}: ${r.detalhe}`),
    ]
}

/**
 * Deduplicate components that share the same code + trimester
 * (keeps first by ordem). Prevents repeated MT/MF rows in the selector.
 */
export function dedupeComponentesForPauta<T extends PautaComponenteLike>(componentes: T[]): T[] {
    const seen = new Set<string>()
    const sorted = [...componentes].sort((a, b) => {
        const ta = Number(a.trimestre) || 0
        const tb = Number(b.trimestre) || 0
        if (ta !== tb) return ta - tb
        return (a.ordem ?? 0) - (b.ordem ?? 0)
    })

    const out: T[] = []
    for (const c of sorted) {
        const key = `${normalizeComponenteCode(c.codigo_componente)}|${Number(c.trimestre) || 0}|${c.tipo_calculo || ''}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push(c)
    }
    return out
}

export function getSelectableComponentesForPauta<T extends PautaComponenteLike>(
    componentes: T[],
    includeLancamento: boolean
): T[] {
    const unique = dedupeComponentesForPauta(componentes)
    if (includeLancamento) return unique
    return unique.filter(isPautaResultComponent)
}

/** Default IDs for a MED-style Pauta-Geral (result columns only). */
export function getDefaultPautaComponenteIds(
    disciplinas: Array<{ componentes: PautaComponenteLike[] }>
): string[] {
    return disciplinas.flatMap((d) =>
        getSelectableComponentesForPauta(d.componentes, false).map((c) => c.id)
    )
}
