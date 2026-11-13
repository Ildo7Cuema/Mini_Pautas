import { supabase } from '../../../lib/supabaseClient'
import {
    calcularClassificacaoFinal,
    mencaoFromClassificacao,
    valorIndicador,
} from '../utils/classificacao'
import { instrumentoParaAvaliado } from '../utils/indicadoresSeed'
import type {
    AdAvaliacao,
    AdIndicador,
    AvaliadoTipo,
    MapaGeralLinha,
    PeriodoAvaliacao,
    SaveAvaliacaoInput,
} from '../types'

export async function fetchIndicadores(instrumentoCodigo: string): Promise<AdIndicador[]> {
    const { data, error } = await supabase
        .from('ad_indicadores_catalogo')
        .select('*')
        .eq('instrumento_codigo', instrumentoCodigo)
        .eq('ativo', true)
        .order('ordem')

    if (error) throw error
    return (data || []) as AdIndicador[]
}

export async function fetchAvaliacoes(
    escolaId: string,
    filters?: { cicloId?: string; periodo?: PeriodoAvaliacao; estado?: string },
): Promise<AdAvaliacao[]> {
    let q = supabase
        .from('ad_avaliacoes')
        .select(`
            *,
            professor:professores(id, nome_completo, email, user_id, numero_agente, especialidade, funcoes),
            funcionario:funcionarios_escola(id, nome_completo, categoria, cargo, subcategoria, user_id, numero_funcionario),
            ciclo:ad_ciclos(id, ano_referencia, tipo_periodo, estado)
        `)
        .eq('escola_id', escolaId)
        .order('updated_at', { ascending: false })

    if (filters?.cicloId) q = q.eq('ciclo_id', filters.cicloId)
    if (filters?.periodo) q = q.eq('periodo', filters.periodo)
    if (filters?.estado) q = q.eq('estado', filters.estado)

    const { data, error } = await q
    if (error) throw error
    return (data || []) as AdAvaliacao[]
}

export async function fetchAvaliacaoDetalhe(avaliacaoId: string): Promise<AdAvaliacao | null> {
    const { data, error } = await supabase
        .from('ad_avaliacoes')
        .select(`
            *,
            professor:professores(id, nome_completo, email, user_id, numero_agente, especialidade, funcoes),
            funcionario:funcionarios_escola(id, nome_completo, categoria, cargo, subcategoria, user_id, numero_funcionario),
            ciclo:ad_ciclos(id, ano_referencia, tipo_periodo, estado),
            scores:ad_avaliacao_scores(
                id, avaliacao_id, indicador_id, graduacao, valor,
                indicador:ad_indicadores_catalogo(id, codigo, nome, coeficiente_ponderacao, ordem, instrumento_codigo, ativo)
            )
        `)
        .eq('id', avaliacaoId)
        .maybeSingle()

    if (error) throw error
    if (!data) return null

    const scores = (data.scores || []).slice().sort((a: { indicador?: { ordem?: number } }, b: { indicador?: { ordem?: number } }) =>
        (a.indicador?.ordem || 0) - (b.indicador?.ordem || 0),
    )

    return { ...data, scores } as AdAvaliacao
}

/**
 * Gera fichas em falta para todos os professores/funcionários activos
 * do tipo correspondente ao ciclo (docente ↔ ANO_LECTIVO; técnico ↔ ANO_CIVIL).
 */
export async function gerarAvaliacoesParaPeriodo(params: {
    cicloId: string
    escolaId: string
    periodo: PeriodoAvaliacao
    avaliadoTipo: AvaliadoTipo
    avaliadorUserId: string
}): Promise<{ created: number; skipped: number }> {
    const instrumento = instrumentoParaAvaliado(params.avaliadoTipo)

    let existentesQuery = supabase
        .from('ad_avaliacoes')
        .select('professor_id, funcionario_id')
        .eq('ciclo_id', params.cicloId)
        .eq('periodo', params.periodo)
        .eq('avaliado_tipo', params.avaliadoTipo)

    const { data: existentes, error: existErr } = await existentesQuery
    if (existErr) throw existErr

    const existingProf = new Set((existentes || []).map(e => e.professor_id).filter(Boolean))
    const existingFunc = new Set((existentes || []).map(e => e.funcionario_id).filter(Boolean))

    const rows: Record<string, unknown>[] = []

    if (params.avaliadoTipo === 'PROFESSOR') {
        const { data: professores, error } = await supabase
            .from('professores')
            .select('id')
            .eq('escola_id', params.escolaId)
            .eq('ativo', true)
        if (error) throw error
        for (const p of professores || []) {
            if (existingProf.has(p.id)) continue
            rows.push({
                ciclo_id: params.cicloId,
                escola_id: params.escolaId,
                avaliado_tipo: 'PROFESSOR',
                professor_id: p.id,
                funcionario_id: null,
                avaliador_user_id: params.avaliadorUserId,
                instrumento_codigo: instrumento,
                periodo: params.periodo,
                estado: 'RASCUNHO',
            })
        }
    } else {
        const { data: funcs, error } = await supabase
            .from('funcionarios_escola')
            .select('id')
            .eq('escola_id', params.escolaId)
            .eq('ativo', true)
        if (error) throw error
        for (const f of funcs || []) {
            if (existingFunc.has(f.id)) continue
            rows.push({
                ciclo_id: params.cicloId,
                escola_id: params.escolaId,
                avaliado_tipo: 'FUNCIONARIO',
                professor_id: null,
                funcionario_id: f.id,
                avaliador_user_id: params.avaliadorUserId,
                instrumento_codigo: instrumento,
                periodo: params.periodo,
                estado: 'RASCUNHO',
            })
        }
    }

    if (!rows.length) return { created: 0, skipped: (existentes || []).length }

    const { error: insertErr } = await supabase.from('ad_avaliacoes').insert(rows)
    if (insertErr) throw insertErr

    return { created: rows.length, skipped: (existentes || []).length }
}

export async function saveAvaliacao(
    avaliacaoId: string,
    input: SaveAvaliacaoInput,
): Promise<AdAvaliacao> {
    const { data: aval, error: avalErr } = await supabase
        .from('ad_avaliacoes')
        .select('id, instrumento_codigo')
        .eq('id', avaliacaoId)
        .single()
    if (avalErr) throw avalErr

    const indicadores = await fetchIndicadores(aval.instrumento_codigo)
    const byId = new Map(indicadores.map(i => [i.id, i]))

    const scoreRows = input.scores.map(s => {
        const ind = byId.get(s.indicador_id)
        if (!ind) throw new Error(`Indicador inválido: ${s.indicador_id}`)
        return {
            avaliacao_id: avaliacaoId,
            indicador_id: s.indicador_id,
            graduacao: s.graduacao,
            valor: valorIndicador(s.graduacao, Number(ind.coeficiente_ponderacao)),
        }
    })

    const cf = calcularClassificacaoFinal(
        scoreRows.map(s => {
            const ind = byId.get(s.indicador_id)!
            return { graduacao: s.graduacao, coeficiente: Number(ind.coeficiente_ponderacao) }
        }),
    )
    const mencao = mencaoFromClassificacao(cf)

    // Replace scores
    const { error: delErr } = await supabase
        .from('ad_avaliacao_scores')
        .delete()
        .eq('avaliacao_id', avaliacaoId)
    if (delErr) throw delErr

    if (scoreRows.length) {
        const { error: insErr } = await supabase.from('ad_avaliacao_scores').insert(scoreRows)
        if (insErr) throw insErr
    }

    const patch: Record<string, unknown> = {
        objectivos_texto: input.objectivos_texto ?? null,
        observacoes: input.observacoes ?? null,
        classificacao_final: cf,
        mencao,
    }

    if (input.estado) patch.estado = input.estado

    // Concordância NÃO é gravada aqui — só via registarConcordancia() / RPC
    // (Art. 25.º: exclusivo do próprio avaliado).

    const { error: updErr } = await supabase
        .from('ad_avaliacoes')
        .update(patch)
        .eq('id', avaliacaoId)
    if (updErr) throw updErr

    const detalhe = await fetchAvaliacaoDetalhe(avaliacaoId)
    if (!detalhe) throw new Error('Avaliação não encontrada após gravação')
    return detalhe
}

export async function updateEstadoAvaliacao(
    avaliacaoId: string,
    estado: AdAvaliacao['estado'],
): Promise<void> {
    const { error } = await supabase
        .from('ad_avaliacoes')
        .update({ estado })
        .eq('id', avaliacaoId)
    if (error) throw error
}

/**
 * Art. 25.º — só o próprio avaliado pode registar concordância.
 * Executado via RPC SECURITY DEFINER (não permite direcção assinar em nome de outrem).
 */
export async function registarConcordancia(
    avaliacaoId: string,
    concorda: boolean,
): Promise<AdAvaliacao> {
    const { error } = await supabase.rpc('ad_registar_concordancia', {
        p_avaliacao_id: avaliacaoId,
        p_concorda: concorda,
    })
    if (error) throw error
    const detalhe = await fetchAvaliacaoDetalhe(avaliacaoId)
    if (!detalhe) throw new Error('Avaliação não encontrada após assinatura')
    return detalhe
}

/** Mapa geral Art. 32.º — ordem alfabética, preferindo ficha ANUAL quando existir. */
export async function fetchMapaGeral(escolaId: string, cicloId: string): Promise<MapaGeralLinha[]> {
    const avaliacoes = await fetchAvaliacoes(escolaId, { cicloId })

    // Prefer ANUAL per person; fallback to latest concluded/signed
    const byPerson = new Map<string, AdAvaliacao>()

    const rank = (a: AdAvaliacao) => {
        if (a.periodo === 'ANUAL') return 4
        if (a.periodo === 'TRIM3') return 3
        if (a.periodo === 'TRIM2') return 2
        return 1
    }

    for (const a of avaliacoes) {
        const key =
            a.avaliado_tipo === 'PROFESSOR'
                ? `P:${a.professor_id}`
                : `F:${a.funcionario_id}`
        const prev = byPerson.get(key)
        if (!prev || rank(a) > rank(prev)) {
            byPerson.set(key, a)
        }
    }

    const linhas: MapaGeralLinha[] = []
    for (const a of byPerson.values()) {
        const nome =
            a.avaliado_tipo === 'PROFESSOR'
                ? a.professor?.nome_completo || '—'
                : a.funcionario?.nome_completo || '—'
        const categoria =
            a.avaliado_tipo === 'PROFESSOR'
                ? 'Professor / Educador'
                : [a.funcionario?.categoria, a.funcionario?.cargo || a.funcionario?.subcategoria]
                      .filter(Boolean)
                      .join(' — ') || 'Funcionário'

        linhas.push({
            nome,
            categoria,
            avaliado_tipo: a.avaliado_tipo,
            periodo: a.periodo,
            classificacao_final: a.classificacao_final,
            mencao: a.mencao,
            estado: a.estado,
            ano_referencia: a.ciclo?.ano_referencia || '',
        })
    }

    linhas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
    return linhas
}
