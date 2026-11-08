/**
 * Load turma classification snapshot for Conselho de Notas.
 * Reuses the same MF/classification rules as Pauta-Geral.
 */

import { supabase } from '../lib/supabaseClient'
import {
    evaluateConfiguredComponent,
    type GradesByTrimestre,
} from './formulaUtils'
import {
    computePautaGeralAlunoMetrics,
    pickComponenteParaMediaGeral,
    type PautaGeralMetricDisciplina,
} from './pautaGeralExportUtils'
import { isPautaLancamentoComponent, formatComponentePautaLabel } from './pautaGeralFieldUtils'
import type {
    ConselhoMembroPapel,
    ConselhoNotasMembro,
    ConselhoNotasProposta,
    StatusTransicao,
} from '../types'

/** Componente lançável (não calculado) numa disciplina em risco — alvo de proposta no Conselho. */
export interface ConselhoDisciplinaRisco {
    disciplina_id: string
    nome: string
    componente_id: string
    componente_codigo: string
    componente_label: string
    trimestre?: number | null
    valor: number | null
    /** MF/MFD de referência (só leitura — resultado de cálculo). */
    media_referencia: number | null
}

export interface ConselhoAlunoSnapshot {
    aluno_id: string
    numero_processo: string
    nome_completo: string
    genero?: 'M' | 'F'
    frequencia_anual?: number
    media_geral: number
    observacao: StatusTransicao
    is_caso_critico: boolean
    motivos: string[]
    disciplinas_em_risco: string[]
    disciplinas_risco_detalhe: ConselhoDisciplinaRisco[]
}

export interface ConselhoTurmaSnapshot {
    turma: {
        id: string
        nome: string
        ano_lectivo: string | number
        codigo_turma: string
        nivel_ensino: string
        escola_id: string
    }
    classe?: string
    componente_media_codigo: string
    alunos: ConselhoAlunoSnapshot[]
    resumo: {
        total: number
        transita: number
        nao_transita: number
        condicional: number
        aguardando: number
        media_turma: number
    }
}

export interface ConselhoCandidatoMembro {
    user_id: string
    nome_completo: string
    email: string
    origem: 'professor' | 'funcionario'
}

function extractClasse(turmaName: string): string | undefined {
    const match = turmaName.match(/(\d+[ªº]\s*Classe)/i)
    return match ? match[1] : undefined
}

function isCasoCritico(obs: StatusTransicao, frequencia?: number): boolean {
    if (obs === 'Não Transita' || obs === 'Condicional' || obs === 'AguardandoNotas') return true
    if (frequencia !== undefined && frequencia !== null && frequencia < 66.67) return true
    return false
}

function mediaReferenciaDisciplina(
    disc: PautaGeralMetricDisciplina,
    alunoNotas: Record<string, Record<string, number>>,
    componenteMediaCode: string
): number | null {
    const mediaComp = pickComponenteParaMediaGeral(disc.componentes, componenteMediaCode)
    if (!mediaComp) return null
    const v = alunoNotas[disc.id]?.[mediaComp.id]
    return v === undefined ? null : v
}

/** Expande disciplinas em risco para componentes de lançamento (MAC, NPT, …) — nunca MF/calculados. */
function buildDisciplinasRiscoDetalhe(
    riscoNomes: string[],
    alunoNotas: Record<string, Record<string, number>>,
    disciplinas: PautaGeralMetricDisciplina[],
    componenteMediaCode: string,
    opts?: { limiarMedia?: number }
): ConselhoDisciplinaRisco[] {
    const nomeSet = new Set(riscoNomes.map((n) => n.trim().toLowerCase()))
    const out: ConselhoDisciplinaRisco[] = []

    disciplinas.forEach((disc) => {
        const mediaRef = mediaReferenciaDisciplina(disc, alunoNotas, componenteMediaCode)
        const isNamed = nomeSet.has(disc.nome.trim().toLowerCase())
        const byLimiar =
            opts?.limiarMedia != null && mediaRef != null && mediaRef < opts.limiarMedia
        if (riscoNomes.length > 0 && !isNamed) return
        if (riscoNomes.length === 0 && !byLimiar) return

        const editaveis = disc.componentes.filter((c) =>
            isPautaLancamentoComponent({
                id: c.id,
                codigo_componente: c.codigo_componente,
                nome: c.nome || c.codigo_componente,
                trimestre: c.trimestre,
                is_calculated: c.is_calculated,
                tipo_calculo: c.tipo_calculo,
            })
        )

        if (editaveis.length === 0) return

        editaveis
            .slice()
            .sort((a, b) => (Number(a.trimestre) || 0) - (Number(b.trimestre) || 0))
            .forEach((componente) => {
                out.push({
                    disciplina_id: disc.id,
                    nome: disc.nome,
                    componente_id: componente.id,
                    componente_codigo: componente.codigo_componente,
                    componente_label: formatComponentePautaLabel({
                        id: componente.id,
                        codigo_componente: componente.codigo_componente,
                        nome: componente.codigo_componente,
                        trimestre: componente.trimestre,
                    }),
                    trimestre: componente.trimestre,
                    valor: alunoNotas[disc.id]?.[componente.id] ?? null,
                    media_referencia: mediaRef,
                })
            })
    })

    return out
}

export async function loadConselhoTurmaSnapshot(turmaId: string): Promise<ConselhoTurmaSnapshot> {
    const { data: turmaData, error: turmaError } = await supabase
        .from('turmas')
        .select('id, nome, ano_lectivo, codigo_turma, nivel_ensino, escola_id')
        .eq('id', turmaId)
        .single()

    if (turmaError) throw turmaError

    const classe = extractClasse(turmaData.nome)

    const { data: disciplinasData, error: disciplinasError } = await supabase
        .from('disciplinas')
        .select('id, nome, codigo_disciplina, ordem')
        .eq('turma_id', turmaId)
        .order('ordem')

    if (disciplinasError) throw disciplinasError
    if (!disciplinasData?.length) {
        throw new Error('Nenhuma disciplina encontrada para esta turma')
    }

    const { data: componentesData, error: componentesError } = await supabase
        .from('componentes_avaliacao')
        .select('id, codigo_componente, nome, peso_percentual, trimestre, disciplina_id, is_calculated, formula_expression, depends_on_components, tipo_calculo')
        .eq('turma_id', turmaId)
        .order('trimestre')
        .order('ordem')

    if (componentesError) throw componentesError

    const disciplinas: PautaGeralMetricDisciplina[] = disciplinasData.map((disc) => ({
        id: disc.id,
        nome: disc.nome,
        componentes: (componentesData || [])
            .filter((c) => c.disciplina_id === disc.id)
            .map((c) => ({
                id: c.id,
                codigo_componente: c.codigo_componente,
                trimestre: c.trimestre,
                is_calculated: c.is_calculated,
                tipo_calculo: c.tipo_calculo,
                nome: c.nome,
            })),
    }))

    const { data: obrigatoriasData } = await supabase
        .from('disciplinas')
        .select('id')
        .eq('turma_id', turmaId)
        .eq('is_obrigatoria', true)

    const disciplinasObrigatorias = (obrigatoriasData || []).map((d) => d.id)

    const { data: alunosData, error: alunosError } = await supabase
        .from('alunos')
        .select('id, numero_processo, nome_completo, genero, frequencia_anual')
        .eq('turma_id', turmaId)
        .eq('ativo', true)
        .order('nome_completo')

    if (alunosError) throw alunosError
    if (!alunosData?.length) {
        throw new Error('Nenhum aluno encontrado nesta turma')
    }

    const allComponentIds = (componentesData || []).map((c) => c.id)
    const { data: notasData, error: notasError } = await supabase
        .from('notas')
        .select('aluno_id, componente_id, valor, trimestre')
        .eq('turma_id', turmaId)
        .in('componente_id', allComponentIds)

    if (notasError) throw notasError

    const alunosRaw = alunosData.map((aluno) => {
        const notasAluno = (notasData || []).filter((n) => n.aluno_id === aluno.id)
        const notas_por_disciplina: Record<string, Record<string, number>> = {}

        disciplinas.forEach((disc) => {
            const comps = (componentesData || []).filter((c) => c.disciplina_id === disc.id)
            const notasMap: Record<string, number> = {}

            notasAluno.forEach((nota) => {
                const componente = comps.find((c) => c.id === nota.componente_id)
                if (componente) notasMap[componente.id] = nota.valor
            })

            comps.forEach((componente) => {
                if (
                    !(
                        componente.is_calculated &&
                        componente.formula_expression &&
                        (componente.tipo_calculo === 'trimestral' || !componente.tipo_calculo)
                    )
                ) {
                    return
                }
                const gradesByCode: Record<string, number> = {}
                comps.forEach((dep) => {
                    if (dep.trimestre === componente.trimestre) {
                        gradesByCode[dep.codigo_componente] = notasMap[dep.id] || 0
                    }
                })
                const v = evaluateConfiguredComponent(componente, {
                    gradesByCode,
                    components: comps.filter((c) => c.trimestre === componente.trimestre),
                    trimestre: componente.trimestre,
                })
                if (v !== null) notasMap[componente.id] = v
            })

            const gradesByTrimestre: GradesByTrimestre = { 1: {}, 2: {}, 3: {} }
            comps.forEach((dep) => {
                const t = Number(dep.trimestre) || 0
                if (t < 1 || t > 3) return
                const value = notasMap[dep.id]
                if (value === undefined) return
                gradesByTrimestre[t][dep.codigo_componente] = value
            })

            comps.forEach((componente) => {
                if (
                    !(
                        componente.is_calculated &&
                        componente.formula_expression &&
                        componente.tipo_calculo === 'anual'
                    )
                ) {
                    return
                }
                const v = evaluateConfiguredComponent(componente, {
                    gradesByTrimestre,
                    components: comps,
                })
                if (v !== null) notasMap[componente.id] = v
            })

            notas_por_disciplina[disc.id] = notasMap
        })

        return {
            aluno_id: aluno.id,
            numero_processo: aluno.numero_processo,
            nome_completo: aluno.nome_completo,
            genero: aluno.genero as 'M' | 'F' | undefined,
            frequencia_anual: aluno.frequencia_anual ?? undefined,
            notas_por_disciplina,
        }
    })

    const metricOptsMf = {
        componenteParaMediaGeral: 'MF',
        nivelEnsino: turmaData.nivel_ensino,
        classe,
        disciplinasObrigatorias,
    }

    let metrics = alunosRaw.map((a) => computePautaGeralAlunoMetrics(a, disciplinas, metricOptsMf))
    let componenteMedia = 'MF'
    if (metrics.every((m) => m.media_geral === 0)) {
        componenteMedia = 'MFD'
        metrics = alunosRaw.map((a) =>
            computePautaGeralAlunoMetrics(a, disciplinas, {
                ...metricOptsMf,
                componenteParaMediaGeral: 'MFD',
            })
        )
    }

    const alunos: ConselhoAlunoSnapshot[] = alunosRaw.map((raw, i) => {
        const m = metrics[i]
        const obs = m.observacao as StatusTransicao
        const critico = isCasoCritico(obs, raw.frequencia_anual)
        let riscoNomes = [...m.disciplinas_em_risco]
        const limiar = (turmaData.nivel_ensino || '').toLowerCase().includes('prim') ? 5 : 10
        let detalhe = buildDisciplinasRiscoDetalhe(
            riscoNomes,
            raw.notas_por_disciplina,
            disciplinas,
            componenteMedia
        )

        // Frequência crítica (ou sem nomes): componentes lançáveis das disciplinas com média abaixo do limiar
        if (critico && detalhe.length === 0) {
            detalhe = buildDisciplinasRiscoDetalhe(
                [],
                raw.notas_por_disciplina,
                disciplinas,
                componenteMedia,
                { limiarMedia: limiar }
            )
            riscoNomes = [...new Set(detalhe.map((d) => d.nome))]
        }

        return {
            aluno_id: raw.aluno_id,
            numero_processo: raw.numero_processo,
            nome_completo: raw.nome_completo,
            genero: raw.genero,
            frequencia_anual: raw.frequencia_anual,
            media_geral: m.media_geral,
            observacao: obs,
            is_caso_critico: critico,
            motivos: m.motivos,
            disciplinas_em_risco: riscoNomes,
            disciplinas_risco_detalhe: detalhe,
        }
    })

    const medias = alunos.map((a) => a.media_geral).filter((n) => n > 0)
    const resumo = {
        total: alunos.length,
        transita: alunos.filter((a) => a.observacao === 'Transita').length,
        nao_transita: alunos.filter((a) => a.observacao === 'Não Transita').length,
        condicional: alunos.filter((a) => a.observacao === 'Condicional').length,
        aguardando: alunos.filter((a) => a.observacao === 'AguardandoNotas').length,
        media_turma: medias.length ? medias.reduce((s, n) => s + n, 0) / medias.length : 0,
    }

    return {
        turma: {
            id: turmaData.id,
            nome: turmaData.nome,
            ano_lectivo: turmaData.ano_lectivo,
            codigo_turma: turmaData.codigo_turma,
            nivel_ensino: turmaData.nivel_ensino,
            escola_id: turmaData.escola_id,
        },
        classe,
        componente_media_codigo: componenteMedia,
        alunos,
        resumo,
    }
}

export async function getConselhoNotasStatus(
    turmaId: string,
    anoLectivo: string
): Promise<{ id: string; status: string; coordenador_nome?: string | null; secretario_nome?: string | null; membro_2_nome?: string | null } | null> {
    const { data, error } = await supabase
        .from('conselho_notas')
        .select('id, status, coordenador_nome, secretario_nome, membro_2_nome')
        .eq('turma_id', turmaId)
        .eq('ano_lectivo', String(anoLectivo))
        .maybeSingle()

    if (error) throw error
    return data
}

export async function loadCandidatosConselho(escolaId: string): Promise<ConselhoCandidatoMembro[]> {
    const [{ data: professores, error: pErr }, { data: funcionarios, error: fErr }, { data: secretarios, error: sErr }] =
        await Promise.all([
            supabase
                .from('professores')
                .select('user_id, nome_completo, email, ativo')
                .eq('escola_id', escolaId)
                .eq('ativo', true)
                .not('user_id', 'is', null)
                .order('nome_completo'),
            supabase
                .from('funcionarios_escola')
                .select('user_id, nome_completo, email, ativo')
                .eq('escola_id', escolaId)
                .eq('ativo', true)
                .not('user_id', 'is', null)
                .order('nome_completo'),
            supabase
                .from('secretarios')
                .select('user_id, nome_completo, email, ativo')
                .eq('escola_id', escolaId)
                .eq('ativo', true)
                .not('user_id', 'is', null)
                .order('nome_completo'),
        ])

    if (pErr) throw pErr
    if (fErr) throw fErr
    if (sErr) throw sErr

    const map = new Map<string, ConselhoCandidatoMembro>()
    ;(professores || []).forEach((p) => {
        if (!p.user_id) return
        map.set(p.user_id, {
            user_id: p.user_id,
            nome_completo: p.nome_completo,
            email: p.email || '',
            origem: 'professor',
        })
    })
    ;[...(funcionarios || []), ...(secretarios || [])].forEach((f) => {
        if (!f.user_id) return
        if (map.has(f.user_id)) return
        map.set(f.user_id, {
            user_id: f.user_id,
            nome_completo: f.nome_completo,
            email: f.email || '',
            origem: 'funcionario',
        })
    })

    return Array.from(map.values()).sort((a, b) =>
        a.nome_completo.localeCompare(b.nome_completo, 'pt')
    )
}

export function buildConselhoConviteLink(origin: string, token: string): string {
    return `${origin}/conselho-convite?token=${encodeURIComponent(token)}`
}

export async function convidarMembroConselho(params: {
    conselhoId: string
    userId: string
    papel: ConselhoMembroPapel
    nomeExibicao: string
    prazoDias: number
    convidadoPor: string
}): Promise<{ membro: ConselhoNotasMembro; link: string }> {
    if (!Number.isFinite(params.prazoDias) || params.prazoDias < 1) {
        throw new Error('Indique o prazo em dias (mínimo 1).')
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + Math.floor(params.prazoDias))

    const { data: existing } = await supabase
        .from('conselho_notas_membros')
        .select('id')
        .eq('conselho_id', params.conselhoId)
        .eq('papel', params.papel)
        .maybeSingle()

    let membro: ConselhoNotasMembro
    if (existing?.id) {
        const { data, error } = await supabase
            .from('conselho_notas_membros')
            .update({
                user_id: params.userId,
                status: 'pendente',
                token: crypto.randomUUID(),
                prazo_dias: Math.floor(params.prazoDias),
                expires_at: expiresAt.toISOString(),
                convidado_por: params.convidadoPor,
                convidado_em: new Date().toISOString(),
                aceite_em: null,
                nome_exibicao: params.nomeExibicao,
            })
            .eq('id', existing.id)
            .select('*')
            .single()
        if (error) throw error
        membro = data as ConselhoNotasMembro
    } else {
        const { data, error } = await supabase
            .from('conselho_notas_membros')
            .insert({
                conselho_id: params.conselhoId,
                user_id: params.userId,
                papel: params.papel,
                status: 'pendente',
                prazo_dias: Math.floor(params.prazoDias),
                expires_at: expiresAt.toISOString(),
                convidado_por: params.convidadoPor,
                nome_exibicao: params.nomeExibicao,
            })
            .select('*')
            .single()
        if (error) throw error
        membro = data as ConselhoNotasMembro
    }

    const nomeField =
        params.papel === 'coordenador'
            ? 'coordenador_nome'
            : params.papel === 'secretario'
                ? 'secretario_nome'
                : 'membro_2_nome'

    await supabase
        .from('conselho_notas')
        .update({ [nomeField]: params.nomeExibicao })
        .eq('id', params.conselhoId)

    const { data: conselhoMeta } = await supabase
        .from('conselho_notas')
        .select('turma_id, ano_lectivo')
        .eq('id', params.conselhoId)
        .maybeSingle()

    const link = buildConselhoConviteLink(window.location.origin, membro.token)
    const papelLabel =
        params.papel === 'coordenador'
            ? 'Coordenador'
            : params.papel === 'secretario'
                ? 'Secretário'
                : 'Membro'

    try {
        await supabase.from('notificacoes').insert({
            destinatario_id: params.userId,
            tipo: 'conselho_notas_convite',
            titulo: 'Convite para Conselho de Notas',
            mensagem: `Foi convidado(a) como ${papelLabel} do Conselho de Notas. Tem ${params.prazoDias} dia(s) para participar. Clique em «Ver Detalhes» para abrir a sala do Conselho.`,
            link: 'reports',
            lida: false,
            dados_adicionais: {
                conselho_id: params.conselhoId,
                turma_id: conselhoMeta?.turma_id || null,
                ano_lectivo: conselhoMeta?.ano_lectivo || null,
                token: membro.token,
                papel: params.papel,
                prazo_dias: Math.floor(params.prazoDias),
                expires_at: membro.expires_at,
            },
        })
    } catch {
        /* notificação não bloqueia */
    }

    return { membro, link }
}

export async function loadMembrosConselho(conselhoId: string): Promise<ConselhoNotasMembro[]> {
    const { data, error } = await supabase
        .from('conselho_notas_membros')
        .select('*')
        .eq('conselho_id', conselhoId)
        .order('papel')
    if (error) throw error
    return (data || []) as ConselhoNotasMembro[]
}

export async function loadPropostasConselho(conselhoId: string): Promise<ConselhoNotasProposta[]> {
    const { data, error } = await supabase
        .from('conselho_notas_propostas')
        .select('*')
        .eq('conselho_id', conselhoId)
        .order('created_at')
    if (error) throw error
    return (data || []) as ConselhoNotasProposta[]
}

export async function upsertPropostaNota(params: {
    conselhoId: string
    alunoId: string
    disciplinaId: string
    componenteId: string
    valorAtual: number
    valorProposto: number
    motivo: string
    propostoPor: string
}): Promise<ConselhoNotasProposta> {
    if (!params.motivo.trim()) {
        throw new Error('Indique o motivo da proposta de alteração.')
    }
    if (!Number.isFinite(params.valorProposto)) {
        throw new Error('Valor proposto inválido.')
    }

    const { data: existing } = await supabase
        .from('conselho_notas_propostas')
        .select('id')
        .eq('conselho_id', params.conselhoId)
        .eq('aluno_id', params.alunoId)
        .eq('componente_id', params.componenteId)
        .maybeSingle()

    if (existing?.id) {
        const { data, error } = await supabase
            .from('conselho_notas_propostas')
            .update({
                disciplina_id: params.disciplinaId,
                valor_atual: params.valorAtual,
                valor_proposto: params.valorProposto,
                motivo: params.motivo.trim(),
                proposto_por: params.propostoPor,
                status: 'pendente',
                aplicada_em: null,
            })
            .eq('id', existing.id)
            .select('*')
            .single()
        if (error) throw error
        return data as ConselhoNotasProposta
    }

    const { data, error } = await supabase
        .from('conselho_notas_propostas')
        .insert({
            conselho_id: params.conselhoId,
            aluno_id: params.alunoId,
            disciplina_id: params.disciplinaId,
            componente_id: params.componenteId,
            valor_atual: params.valorAtual,
            valor_proposto: params.valorProposto,
            motivo: params.motivo.trim(),
            proposto_por: params.propostoPor,
            status: 'pendente',
        })
        .select('*')
        .single()
    if (error) throw error
    return data as ConselhoNotasProposta
}

export async function aprovarConselhoComPropostas(conselhoId: string): Promise<{ propostas_aplicadas: number }> {
    const { data, error } = await supabase.rpc('aprovar_conselho_notas', {
        p_conselho_id: conselhoId,
    })
    if (error) throw error
    const result = data as { propostas_aplicadas?: number }
    return { propostas_aplicadas: result?.propostas_aplicadas ?? 0 }
}

/**
 * Quando um membro guarda o rascunho, notifica o administrador (e Subdir. Pedagógico).
 * Usa RPC SECURITY DEFINER (contorna RLS de notificacoes).
 */
export async function notifyGestoresRascunhoConselho(params: {
    conselhoId: string
    actorNome?: string
}): Promise<void> {
    try {
        const { error } = await supabase.rpc('notificar_conselho_evento', {
            p_conselho_id: params.conselhoId,
            p_evento: 'rascunho_guardado',
            p_actor_nome: params.actorNome || null,
        })
        if (error) console.warn('Notificação rascunho Conselho:', error.message)
    } catch (err) {
        console.warn('Notificação rascunho Conselho:', err)
    }
}

/**
 * Quando o administrador aprova, notifica os membros convidados do Conselho.
 */
export async function notifyMembrosConselhoAprovado(params: {
    conselhoId: string
}): Promise<void> {
    try {
        const { error } = await supabase.rpc('notificar_conselho_evento', {
            p_conselho_id: params.conselhoId,
            p_evento: 'aprovado',
            p_actor_nome: null,
        })
        if (error) console.warn('Notificação aprovação Conselho:', error.message)
    } catch (err) {
        console.warn('Notificação aprovação Conselho:', err)
    }
}

export const CONSELHO_INVITE_STORAGE_KEY = 'conselho_invite_pending'
