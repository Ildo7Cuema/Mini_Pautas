/**
 * Consolidado de Avaliação de Desempenho para tutela (DME / Provincial).
 * Leitura agregada por escola — sem escrita nas fichas.
 */

import { supabase } from '../../../lib/supabaseClient'
import { fetchMapaGeral } from './avaliacoes'
import type {
    AdAvaliacao,
    AdCiclo,
    ConsolidadoAvaliacaoTutela,
    EscolaAvaliacaoResumo,
    MapaGeralLinha,
    MencaoClassificacao,
    MunicipioAvaliacaoResumo,
} from '../types'

const ESTADOS_CONCLUIDOS = new Set(['CONCLUIDA', 'ASSINADA'])

function emptyMencoes(): Record<MencaoClassificacao, number> {
    return { MUITO_BOM: 0, BOM: 0, SUFICIENTE: 0, MAU: 0 }
}

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
}

async function fetchEscolasAmbito(params: {
    municipio?: string
    provincia?: string
}): Promise<Array<{ id: string; nome: string; municipio: string; provincia: string }>> {
    let q = supabase.from('escolas').select('id, nome, municipio, provincia').order('nome')
    if (params.municipio) q = q.eq('municipio', params.municipio)
    if (params.provincia) q = q.eq('provincia', params.provincia)
    const { data, error } = await q
    if (error) throw error
    return (data || []).map(e => ({
        id: e.id,
        nome: e.nome,
        municipio: e.municipio || '',
        provincia: e.provincia || '',
    }))
}

async function fetchCiclosForEscolas(
    escolaIds: string[],
    anoReferencia?: string | null,
): Promise<AdCiclo[]> {
    if (!escolaIds.length) return []
    const all: AdCiclo[] = []
    for (const ids of chunk(escolaIds, 80)) {
        let q = supabase
            .from('ad_ciclos')
            .select('*')
            .in('escola_id', ids)
            .order('ano_referencia', { ascending: false })
        if (anoReferencia) q = q.eq('ano_referencia', anoReferencia)
        const { data, error } = await q
        if (error) throw error
        all.push(...((data || []) as AdCiclo[]))
    }
    return all
}

async function fetchAvaliacoesForCiclos(cicloIds: string[]): Promise<AdAvaliacao[]> {
    if (!cicloIds.length) return []
    const all: AdAvaliacao[] = []
    for (const ids of chunk(cicloIds, 80)) {
        const { data, error } = await supabase
            .from('ad_avaliacoes')
            .select('id, ciclo_id, escola_id, periodo, classificacao_final, mencao, estado, avaliado_tipo, professor_id, funcionario_id')
            .in('ciclo_id', ids)
        if (error) throw error
        all.push(...((data || []) as AdAvaliacao[]))
    }
    return all
}

/** Preferência ANUAL por pessoa (mesma lógica do mapa Art. 32.º). */
function pickMapaPorPessoa(avaliacoes: AdAvaliacao[]): AdAvaliacao[] {
    const rank = (a: AdAvaliacao) => {
        if (a.periodo === 'ANUAL') return 4
        if (a.periodo === 'TRIM3') return 3
        if (a.periodo === 'TRIM2') return 2
        return 1
    }
    const byPerson = new Map<string, AdAvaliacao>()
    for (const a of avaliacoes) {
        const key =
            a.avaliado_tipo === 'PROFESSOR' ? `P:${a.professor_id}` : `F:${a.funcionario_id}`
        const prev = byPerson.get(key)
        if (!prev || rank(a) > rank(prev)) byPerson.set(key, a)
    }
    return [...byPerson.values()]
}

function buildEscolaResumo(
    escola: { id: string; nome: string; municipio: string; provincia: string },
    ciclo: AdCiclo | null,
    avaliacoes: AdAvaliacao[],
): EscolaAvaliacaoResumo {
    const mapa = pickMapaPorPessoa(avaliacoes)
    const mencoes = emptyMencoes()
    let somaCf = 0
    let nCf = 0
    let concluidas = 0

    for (const a of mapa) {
        if (ESTADOS_CONCLUIDOS.has(a.estado)) concluidas += 1
        if (a.mencao) mencoes[a.mencao] += 1
        if (a.classificacao_final != null) {
            somaCf += a.classificacao_final
            nCf += 1
        }
    }

    const total = mapa.length
    return {
        escola_id: escola.id,
        escola_nome: escola.nome,
        municipio: escola.municipio,
        provincia: escola.provincia,
        ano_referencia: ciclo?.ano_referencia ?? null,
        ciclo_id: ciclo?.id ?? null,
        ciclo_estado: ciclo?.estado ?? null,
        total_fichas: total,
        concluidas,
        pendentes: Math.max(0, total - concluidas),
        pct_conclusao: total ? Math.round((concluidas / total) * 1000) / 10 : 0,
        media_classificacao: nCf ? Math.round((somaCf / nCf) * 100) / 100 : null,
        mencoes,
    }
}

function aggregateMencoes(
    rows: EscolaAvaliacaoResumo[],
): Record<MencaoClassificacao, number> {
    const m = emptyMencoes()
    for (const r of rows) {
        m.MUITO_BOM += r.mencoes.MUITO_BOM
        m.BOM += r.mencoes.BOM
        m.SUFICIENTE += r.mencoes.SUFICIENTE
        m.MAU += r.mencoes.MAU
    }
    return m
}

function buildMunicipioResumos(porEscola: EscolaAvaliacaoResumo[]): MunicipioAvaliacaoResumo[] {
    const map = new Map<string, EscolaAvaliacaoResumo[]>()
    for (const e of porEscola) {
        const key = e.municipio || '—'
        const list = map.get(key) || []
        list.push(e)
        map.set(key, list)
    }
    const out: MunicipioAvaliacaoResumo[] = []
    for (const [municipio, escolas] of map) {
        const comCiclo = escolas.filter(e => e.ciclo_id).length
        const totalFichas = escolas.reduce((s, e) => s + e.total_fichas, 0)
        const concluidas = escolas.reduce((s, e) => s + e.concluidas, 0)
        let soma = 0
        let n = 0
        for (const e of escolas) {
            if (e.media_classificacao != null && e.total_fichas > 0) {
                soma += e.media_classificacao * e.total_fichas
                n += e.total_fichas
            }
        }
        out.push({
            municipio,
            total_escolas: escolas.length,
            escolas_com_ciclo: comCiclo,
            total_fichas: totalFichas,
            concluidas,
            pct_conclusao: totalFichas
                ? Math.round((concluidas / totalFichas) * 1000) / 10
                : 0,
            media_classificacao: n ? Math.round((soma / n) * 100) / 100 : null,
        })
    }
    out.sort((a, b) => a.municipio.localeCompare(b.municipio, 'pt'))
    return out
}

export async function listAnosReferenciaTutela(params: {
    municipio?: string
    provincia?: string
}): Promise<string[]> {
    const escolas = await fetchEscolasAmbito(params)
    if (!escolas.length) return []
    const ciclos = await fetchCiclosForEscolas(escolas.map(e => e.id))
    const anos = [...new Set(ciclos.map(c => c.ano_referencia).filter(Boolean))]
    anos.sort((a, b) => b.localeCompare(a, 'pt'))
    return anos
}

export async function fetchConsolidadoAvaliacaoTutela(params: {
    municipio?: string
    provincia?: string
    anoReferencia?: string | null
}): Promise<ConsolidadoAvaliacaoTutela> {
    if (!params.municipio && !params.provincia) {
        throw new Error('Indique município ou província para o consolidado.')
    }

    const escolas = await fetchEscolasAmbito(params)
    const anosDisponiveis = await listAnosReferenciaTutela(params)
    const ano =
        params.anoReferencia ||
        anosDisponiveis[0] ||
        null

    const ciclos = await fetchCiclosForEscolas(
        escolas.map(e => e.id),
        ano,
    )

    // Um ciclo por escola: preferir ANO_LECTIVO se houver dois no mesmo ano
    const cicloByEscola = new Map<string, AdCiclo>()
    for (const c of ciclos) {
        const prev = cicloByEscola.get(c.escola_id)
        if (!prev) {
            cicloByEscola.set(c.escola_id, c)
            continue
        }
        if (prev.tipo_periodo !== 'ANO_LECTIVO' && c.tipo_periodo === 'ANO_LECTIVO') {
            cicloByEscola.set(c.escola_id, c)
        }
    }

    const cicloIds = [...cicloByEscola.values()].map(c => c.id)
    const avaliacoes = await fetchAvaliacoesForCiclos(cicloIds)
    const avByCiclo = new Map<string, AdAvaliacao[]>()
    for (const a of avaliacoes) {
        const list = avByCiclo.get(a.ciclo_id) || []
        list.push(a)
        avByCiclo.set(a.ciclo_id, list)
    }

    const porEscola = escolas.map(escola => {
        const ciclo = cicloByEscola.get(escola.id) || null
        const avs = ciclo ? avByCiclo.get(ciclo.id) || [] : []
        return buildEscolaResumo(escola, ciclo, avs)
    })

    const totalFichas = porEscola.reduce((s, e) => s + e.total_fichas, 0)
    const concluidas = porEscola.reduce((s, e) => s + e.concluidas, 0)
    let soma = 0
    let n = 0
    for (const e of porEscola) {
        if (e.media_classificacao != null && e.total_fichas > 0) {
            soma += e.media_classificacao * e.total_fichas
            n += e.total_fichas
        }
    }

    const ambito = params.municipio ? 'municipio' : 'provincia'
    const territorio = params.municipio || params.provincia || ''

    const result: ConsolidadoAvaliacaoTutela = {
        ambito,
        territorio,
        ano_referencia: ano,
        anos_disponiveis: anosDisponiveis,
        total_escolas: escolas.length,
        escolas_com_ciclo: porEscola.filter(e => e.ciclo_id).length,
        total_fichas: totalFichas,
        concluidas,
        pendentes: Math.max(0, totalFichas - concluidas),
        pct_conclusao: totalFichas
            ? Math.round((concluidas / totalFichas) * 1000) / 10
            : 0,
        media_classificacao: n ? Math.round((soma / n) * 100) / 100 : null,
        mencoes: aggregateMencoes(porEscola),
        por_escola: porEscola,
    }

    if (ambito === 'provincia') {
        result.por_municipio = buildMunicipioResumos(porEscola)
    }

    return result
}

/** Mapa Art. 32.º de uma escola (drill-down na tutela). */
export async function fetchMapaGeralTutela(
    escolaId: string,
    cicloId: string,
): Promise<MapaGeralLinha[]> {
    return fetchMapaGeral(escolaId, cicloId)
}
