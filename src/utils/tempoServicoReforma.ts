/**
 * Tempo de serviço e previsão de reforma — Decreto Presidencial n.º 299/20
 * (Regime Jurídico sobre a Protecção Social na Velhice).
 *
 * Regras aplicadas (Arts. 4.º, 7.º e 9.º):
 * - Reforma por velhice: 60 anos de idade OU 420 meses (35 anos) de contribuições
 * - Mães trabalhadoras: redução de 1 ano de idade por filho (máx. 5 anos) — Art. 4.º n.º 2
 * - Prazo de garantia: 180 meses (15 anos) de contribuições — Art. 7.º n.º 1
 * - Ano de serviço = 12 meses consecutivos ou interpolados — Art. 9.º n.º 1
 *
 * Nota: a previsão é indicativa para gestão de RH; a concessão formal cabe à
 * Entidade Gestora da Protecção Social Obrigatória (INSS).
 */

export const REFORMA_IDADE_PADRAO = 60
export const REFORMA_MESES_CONTRIBUTIVOS = 420 // 35 anos
export const REFORMA_PRAZO_GARANTIA_MESES = 180 // 15 anos
export const REFORMA_REDUCAO_MAX_FILHOS = 5

export const REFORMA_BASE_LEGAL =
    'Decreto Presidencial n.º 299/20 — Protecção Social na Velhice (Arts. 4.º, 7.º e 9.º)'

export interface TempoServicoInput {
    dataNascimento?: string | null
    dataInicioServico?: string | null
    genero?: string | null
    /** Filhos a que a mãe deu à luz (Art. 4.º n.º 2). Ignorado se não for feminino. */
    numeroFilhos?: number | null
    /** Data de referência do cálculo (default: hoje). */
    referencia?: Date
}

export interface TempoServicoDuracao {
    totalMeses: number
    anos: number
    mesesRestantes: number
    label: string
}

export type CriterioReforma = 'idade' | 'contribuicoes' | 'elegivel'

export interface PrevisaoReforma {
    elegivelAgora: boolean
    criterio: CriterioReforma | null
    idadeReformaAnos: number
    reducaoIdadeAnos: number
    dataPorIdade: Date | null
    dataPorContribuicoes: Date | null
    /** Data em que se prevê o direito (a mais próxima entre idade e 420 meses). */
    dataPrevista: Date | null
    tempoRestante: TempoServicoDuracao | null
    tempoRestanteLabel: string
    avisoGarantia: string | null
    baseLegal: string
}

export interface TempoServicoReformaResult {
    idadeActual: TempoServicoDuracao | null
    tempoServico: TempoServicoDuracao | null
    previsao: PrevisaoReforma
    incompleto: boolean
    camposEmFalta: string[]
}

function parseDateOnly(value?: string | null): Date | null {
    if (!value) return null
    const raw = String(value).trim()
    if (!raw) return null
    // Prefer YYYY-MM-DD to avoid timezone shifts
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
    if (m) {
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
        return Number.isNaN(d.getTime()) ? null : d
    }
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? null : d
}

function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Diferença em meses completos entre duas datas (calendário). */
export function diffMonths(from: Date, to: Date): number {
    const a = startOfDay(from)
    const b = startOfDay(to)
    let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
    if (b.getDate() < a.getDate()) months -= 1
    return Math.max(0, months)
}

export function addMonths(date: Date, months: number): Date {
    const d = startOfDay(date)
    const day = d.getDate()
    const result = new Date(d.getFullYear(), d.getMonth() + months, 1)
    const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()
    result.setDate(Math.min(day, lastDay))
    return result
}

export function addYears(date: Date, years: number): Date {
    const d = startOfDay(date)
    const result = new Date(d.getFullYear() + years, d.getMonth(), d.getDate())
    // Handle Feb 29 → Feb 28 in non-leap years
    if (result.getMonth() !== d.getMonth()) {
        result.setDate(0)
    }
    return result
}

export function formatDuracao(totalMeses: number): TempoServicoDuracao {
    const safe = Math.max(0, Math.floor(totalMeses))
    const anos = Math.floor(safe / 12)
    const mesesRestantes = safe % 12
    let label = ''
    const mesesLabel = mesesRestantes === 1 ? '1 mês' : `${mesesRestantes} meses`
    if (anos > 0 && mesesRestantes > 0) {
        label = `${anos} ano${anos === 1 ? '' : 's'} e ${mesesLabel}`
    } else if (anos > 0) {
        label = `${anos} ano${anos === 1 ? '' : 's'}`
    } else if (mesesRestantes > 0) {
        label = mesesLabel
    } else {
        label = '0 meses'
    }
    return { totalMeses: safe, anos, mesesRestantes, label }
}

export function formatDatePt(date: Date | null): string {
    if (!date) return '—'
    const dd = String(date.getDate()).padStart(2, '0')
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const yyyy = date.getFullYear()
    return `${dd}/${mm}/${yyyy}`
}

function isFeminino(genero?: string | null): boolean {
    const g = String(genero || '').trim().toUpperCase()
    return g === 'F' || g === 'FEMININO' || g === 'FEMININA'
}

/** Idade de reforma efectiva (Art. 4.º), com redução para mães trabalhadoras. */
export function idadeReformaEfectiva(genero?: string | null, numeroFilhos?: number | null): {
    idade: number
    reducao: number
} {
    let reducao = 0
    if (isFeminino(genero)) {
        const filhos = Math.max(0, Math.floor(Number(numeroFilhos) || 0))
        reducao = Math.min(REFORMA_REDUCAO_MAX_FILHOS, filhos)
    }
    return {
        idade: Math.max(REFORMA_IDADE_PADRAO - reducao, REFORMA_IDADE_PADRAO - REFORMA_REDUCAO_MAX_FILHOS),
        reducao,
    }
}

export function calcularTempoServicoReforma(input: TempoServicoInput): TempoServicoReformaResult {
    const referencia = startOfDay(input.referencia || new Date())
    const nascimento = parseDateOnly(input.dataNascimento)
    const inicio = parseDateOnly(input.dataInicioServico)
    const { idade: idadeReformaAnos, reducao: reducaoIdadeAnos } = idadeReformaEfectiva(
        input.genero,
        input.numeroFilhos,
    )

    const camposEmFalta: string[] = []
    if (!nascimento) camposEmFalta.push('data de nascimento')
    if (!inicio) camposEmFalta.push('data de início de funções / admissão')

    const idadeActual = nascimento ? formatDuracao(diffMonths(nascimento, referencia)) : null
    const tempoServico = inicio ? formatDuracao(diffMonths(inicio, referencia)) : null

    const dataPorIdade = nascimento ? addYears(nascimento, idadeReformaAnos) : null
    const dataPorContribuicoes = inicio ? addMonths(inicio, REFORMA_MESES_CONTRIBUTIVOS) : null

    let dataPrevista: Date | null = null
    if (dataPorIdade && dataPorContribuicoes) {
        dataPrevista = dataPorIdade.getTime() <= dataPorContribuicoes.getTime() ? dataPorIdade : dataPorContribuicoes
    } else {
        dataPrevista = dataPorIdade || dataPorContribuicoes
    }

    const mesesServico = tempoServico?.totalMeses ?? 0
    const mesesIdade = idadeActual?.totalMeses ?? 0
    const mesesIdadeReforma = idadeReformaAnos * 12

    const elegivelPorIdade = !!nascimento && mesesIdade >= mesesIdadeReforma
    const elegivelPorContribuicoes = !!inicio && mesesServico >= REFORMA_MESES_CONTRIBUTIVOS
    const elegivelAgora = elegivelPorIdade || elegivelPorContribuicoes

    let criterio: CriterioReforma | null = null
    if (elegivelAgora) {
        criterio = 'elegivel'
    } else if (dataPrevista && dataPorIdade && dataPrevista.getTime() === dataPorIdade.getTime()) {
        criterio = 'idade'
    } else if (dataPrevista && dataPorContribuicoes && dataPrevista.getTime() === dataPorContribuicoes.getTime()) {
        criterio = 'contribuicoes'
    }

    const tempoRestante =
        dataPrevista && dataPrevista.getTime() > referencia.getTime()
            ? formatDuracao(diffMonths(referencia, dataPrevista))
            : elegivelAgora
                ? formatDuracao(0)
                : null

    let tempoRestanteLabel = 'Dados insuficientes'
    if (elegivelAgora) {
        tempoRestanteLabel = 'Já reúne condições legais de reforma por velhice'
    } else if (tempoRestante) {
        tempoRestanteLabel = `${tempoRestante.label} até à previsão de reforma`
    }

    let avisoGarantia: string | null = null
    if (inicio && mesesServico < REFORMA_PRAZO_GARANTIA_MESES) {
        const falta = formatDuracao(REFORMA_PRAZO_GARANTIA_MESES - mesesServico)
        avisoGarantia = `Prazo de garantia (Art. 7.º): faltam ${falta.label} de contribuições (mín. 15 anos) para pensão de reforma.`
    }

    return {
        idadeActual,
        tempoServico,
        previsao: {
            elegivelAgora,
            criterio,
            idadeReformaAnos,
            reducaoIdadeAnos,
            dataPorIdade,
            dataPorContribuicoes,
            dataPrevista,
            tempoRestante,
            tempoRestanteLabel,
            avisoGarantia,
            baseLegal: REFORMA_BASE_LEGAL,
        },
        incompleto: camposEmFalta.length > 0,
        camposEmFalta,
    }
}
