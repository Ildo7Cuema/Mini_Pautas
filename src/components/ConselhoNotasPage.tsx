/*
component-meta:
  name: ConselhoNotasPage
  description: Conselho de Notas por turma (MED) — convites, casos críticos com propostas e aprovação
*/

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardHeader, CardBody } from './ui/Card'
import { Button } from './ui/Button'
import { translateError } from '../utils/translations'
import { HeaderConfig, loadHeaderConfig } from '../utils/headerConfigUtils'
import { generateConselhoNotasPDF } from '../utils/pdfGenerator'
import {
    aprovarConselhoComPropostas,
    convidarMembroConselho,
    loadCandidatosConselho,
    loadConselhoTurmaSnapshot,
    loadMembrosConselho,
    loadPropostasConselho,
    notifyGestoresRascunhoConselho,
    notifyMembrosConselhoAprovado,
    upsertPropostaNota,
    type ConselhoCandidatoMembro,
    type ConselhoTurmaSnapshot,
    CONSELHO_INVITE_STORAGE_KEY,
} from '../utils/conselhoNotasData'
import type {
    ConselhoMembroPapel,
    ConselhoNotas,
    ConselhoNotasDeliberacao,
    ConselhoNotasMembro,
    ConselhoNotasProposta,
    ConselhoNotasStatus,
    StatusTransicao,
} from '../types'

interface TurmaOption {
    id: string
    nome: string
    ano_lectivo: string | number
    codigo_turma: string
    nivel_ensino: string
}

interface DelibDraft {
    aluno_id: string
    numero_processo: string
    nome_completo: string
    situacao_sistema: StatusTransicao
    situacao_deliberada: StatusTransicao
    motivo: string
    is_caso_critico: boolean
    media_geral: number
    frequencia_anual?: number
}

interface ConselhoNotasPageProps {
    initialTurmaId?: string
}

const STATUS_OPTIONS: StatusTransicao[] = ['Transita', 'Não Transita', 'Condicional', 'AguardandoNotas']
const PAPEIS: ConselhoMembroPapel[] = ['coordenador', 'secretario', 'membro']
const PAPEL_LABEL: Record<ConselhoMembroPapel, string> = {
    coordenador: 'Coordenador (Dir. de Turma)',
    secretario: 'Secretário',
    membro: 'Membro',
}

export const ConselhoNotasPage: React.FC<ConselhoNotasPageProps> = ({ initialTurmaId }) => {
    const { user, escolaProfile, secretarioProfile } = useAuth()
    const [turmas, setTurmas] = useState<TurmaOption[]>([])
    const [selectedTurma, setSelectedTurma] = useState(initialTurmaId || '')
    const [snapshot, setSnapshot] = useState<ConselhoTurmaSnapshot | null>(null)
    const [conselho, setConselho] = useState<ConselhoNotas | null>(null)
    const [delibs, setDelibs] = useState<DelibDraft[]>([])
    const [membros, setMembros] = useState<ConselhoNotasMembro[]>([])
    const [propostas, setPropostas] = useState<ConselhoNotasProposta[]>([])
    const [candidatos, setCandidatos] = useState<ConselhoCandidatoMembro[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [savePhase, setSavePhase] = useState<'idle' | 'saving' | 'approving' | 'reopening'>('idle')
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [headerConfig, setHeaderConfig] = useState<HeaderConfig | null>(null)
    const [expandedAlunoId, setExpandedAlunoId] = useState<string | null>(null)
    const actionFeedbackRef = useRef<HTMLDivElement | null>(null)

    const [dataReuniao, setDataReuniao] = useState('')
    const [localReuniao, setLocalReuniao] = useState('')
    const [parecer, setParecer] = useState('')

    // Invite form — um prazo e um botão para toda a composição
    const [inviteUserId, setInviteUserId] = useState<Record<ConselhoMembroPapel, string>>({
        coordenador: '',
        secretario: '',
        membro: '',
    })
    const [invitePrazoDias, setInvitePrazoDias] = useState('')
    const [inviteBusy, setInviteBusy] = useState(false)

    // Draft proposals in expanded row: componenteId -> { valor, motivo }
    const [proposalDrafts, setProposalDrafts] = useState<
        Record<string, { valor: string; motivo: string }>
    >({})

    const escolaId = escolaProfile?.id || secretarioProfile?.escola_id
    const canManage =
        Boolean(escolaProfile) ||
        (secretarioProfile?.cargo || '').toUpperCase() === 'DIRECTOR_PEDAGOGICO'

    const isLocked = conselho?.status === 'aprovado'

    const isActiveMember = useMemo(() => {
        if (!user?.id) return false
        const now = Date.now()
        return membros.some(
            (m) =>
                m.user_id === user.id &&
                m.status === 'aceite' &&
                new Date(m.expires_at).getTime() > now
        )
    }, [membros, user?.id])

    const canEdit = !isLocked && (canManage || isActiveMember)
    const propostasAplicadas = propostas.filter((p) => p.status === 'aplicada').length

    useEffect(() => {
        loadTurmas()
        if (escolaId) {
            loadHeaderConfig(escolaId).then(setHeaderConfig).catch(() => setHeaderConfig(null))
            loadCandidatosConselho(escolaId).then(setCandidatos).catch(() => setCandidatos([]))
        }
    }, [escolaId])

    useEffect(() => {
        let pendingToken: string | undefined
        try {
            const raw = sessionStorage.getItem(CONSELHO_INVITE_STORAGE_KEY)
            if (raw) {
                const parsed = JSON.parse(raw) as { turmaId?: string; token?: string }
                if (parsed.turmaId) setSelectedTurma(parsed.turmaId)
                pendingToken = parsed.token
                sessionStorage.removeItem(CONSELHO_INVITE_STORAGE_KEY)
            }
        } catch {
            /* ignore */
        }

        if (!pendingToken) return

        ;(async () => {
            try {
                const { data, error } = await supabase.rpc('aceitar_conselho_convite', {
                    p_token: pendingToken,
                })
                if (error) throw error
                const result = data as { turma_id?: string }
                const turmaId = result?.turma_id
                if (turmaId) {
                    setSelectedTurma(turmaId)
                    // Recarrega após aceitar para actualizar estado do membro
                    setTimeout(() => {
                        void loadSession(turmaId)
                    }, 300)
                }
                setSuccess('Convite aceite. Já pode deliberar nesta sala do Conselho.')
                setTimeout(() => setSuccess(null), 3500)
            } catch (err) {
                // Já aceite / expirado: ainda assim abrimos a sala; não bloquear
                console.warn('Aceitar convite via notificação:', err)
            }
        })()
        // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot deep-link from notification
    }, [])

    useEffect(() => {
        if (initialTurmaId) setSelectedTurma(initialTurmaId)
    }, [initialTurmaId])

    const loadTurmas = async () => {
        if (!escolaId) return
        const { data, error: err } = await supabase
            .from('turmas')
            .select('id, nome, ano_lectivo, codigo_turma, nivel_ensino')
            .eq('escola_id', escolaId)
            .order('nome')
        if (err) {
            setError(translateError(err.message))
            return
        }
        setTurmas(data || [])
    }

    const loadSession = async (turmaId: string) => {
        try {
            setLoading(true)
            setError(null)
            setSuccess(null)
            setExpandedAlunoId(null)

            const snap = await loadConselhoTurmaSnapshot(turmaId)
            setSnapshot(snap)

            const ano = String(snap.turma.ano_lectivo)
            const { data: existing, error: cErr } = await supabase
                .from('conselho_notas')
                .select('*')
                .eq('turma_id', turmaId)
                .eq('ano_lectivo', ano)
                .maybeSingle()

            if (cErr) throw cErr

            let conselhoRow = existing as ConselhoNotas | null
            if (!conselhoRow) {
                const { data: created, error: insErr } = await supabase
                    .from('conselho_notas')
                    .insert({
                        escola_id: snap.turma.escola_id,
                        turma_id: turmaId,
                        ano_lectivo: ano,
                        status: 'rascunho',
                        data_reuniao: new Date().toISOString().slice(0, 10),
                    })
                    .select('*')
                    .single()
                if (insErr) throw insErr
                conselhoRow = created as ConselhoNotas
            }

            setConselho(conselhoRow)
            setDataReuniao(conselhoRow.data_reuniao || '')
            setLocalReuniao(conselhoRow.local_reuniao || '')
            setParecer(conselhoRow.parecer_geral || '')

            const { data: savedDelibs } = await supabase
                .from('conselho_notas_deliberacoes')
                .select('*')
                .eq('conselho_id', conselhoRow.id)

            let membrosData: ConselhoNotasMembro[] = []
            let propostasData: ConselhoNotasProposta[] = []
            let schemaMissing = false
            try {
                membrosData = await loadMembrosConselho(conselhoRow.id)
            } catch (mErr) {
                schemaMissing = true
                console.warn('Membros do conselho indisponíveis (aplique a migration):', mErr)
            }
            try {
                propostasData = await loadPropostasConselho(conselhoRow.id)
            } catch (pErr) {
                schemaMissing = true
                console.warn('Propostas do conselho indisponíveis (aplique a migration):', pErr)
            }
            if (schemaMissing) {
                setError(
                    'Aplique a migration 20261107_conselho_membros_propostas.sql (ou npm run db:apply-conselho-membros com DATABASE_URL) para activar convites e propostas de nota.'
                )
            }

            setMembros(membrosData)
            setPropostas(propostasData)

            const byAluno = new Map(
                ((savedDelibs as ConselhoNotasDeliberacao[]) || []).map((d) => [d.aluno_id, d])
            )

            const drafts: DelibDraft[] = snap.alunos.map((a) => {
                const saved = byAluno.get(a.aluno_id)
                return {
                    aluno_id: a.aluno_id,
                    numero_processo: a.numero_processo,
                    nome_completo: a.nome_completo,
                    situacao_sistema: a.observacao,
                    situacao_deliberada: (saved?.situacao_deliberada as StatusTransicao) || a.observacao,
                    motivo: saved?.motivo || '',
                    is_caso_critico: a.is_caso_critico,
                    media_geral: a.media_geral,
                    frequencia_anual: a.frequencia_anual,
                }
            })
            setDelibs(drafts)

            // Prefill invite selects from existing members
            const nextUsers = { ...inviteUserId }
            membrosData.forEach((m) => {
                nextUsers[m.papel] = m.user_id
            })
            setInviteUserId(nextUsers)
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao carregar Conselho'))
            setSnapshot(null)
            setConselho(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (selectedTurma) loadSession(selectedTurma)
        else {
            setSnapshot(null)
            setConselho(null)
            setDelibs([])
            setMembros([])
            setPropostas([])
        }
    }, [selectedTurma])

    const persistDeliberacoes = async (conselhoId: string) => {
        const rows = delibs.map((d) => ({
            conselho_id: conselhoId,
            aluno_id: d.aluno_id,
            situacao_sistema: d.situacao_sistema,
            situacao_deliberada: d.situacao_deliberada,
            motivo: d.motivo || null,
            is_caso_critico: d.is_caso_critico,
            media_geral: d.media_geral,
            frequencia_anual: d.frequencia_anual ?? null,
        }))

        const { error: delErr } = await supabase
            .from('conselho_notas_deliberacoes')
            .delete()
            .eq('conselho_id', conselhoId)
        if (delErr) throw delErr

        if (rows.length) {
            const { error: insErr } = await supabase.from('conselho_notas_deliberacoes').insert(rows)
            if (insErr) throw insErr
        }
    }

    const syncNomesFromMembros = () => {
        const nome = (papel: ConselhoMembroPapel) =>
            membros.find((m) => m.papel === papel)?.nome_exibicao ||
            candidatos.find((c) => c.user_id === inviteUserId[papel])?.nome_completo ||
            ''
        return {
            coordenador_nome: nome('coordenador') || null,
            secretario_nome: nome('secretario') || null,
            membro_2_nome: nome('membro') || null,
        }
    }

    const showFeedback = (kind: 'success' | 'error', message: string, clearMs = 4000) => {
        if (kind === 'success') {
            setError(null)
            setSuccess(message)
            setTimeout(() => setSuccess(null), clearMs)
        } else {
            setSuccess(null)
            setError(message)
        }
        requestAnimationFrame(() => {
            actionFeedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        })
    }

    const handleSave = async () => {
        if (!conselho) return
        try {
            setSaving(true)
            setSavePhase('saving')
            setError(null)
            setSuccess(null)
            const names = syncNomesFromMembros()
            const { data, error: updErr } = await supabase
                .from('conselho_notas')
                .update({
                    ...names,
                    data_reuniao: dataReuniao || null,
                    local_reuniao: localReuniao || null,
                    parecer_geral: parecer || null,
                })
                .eq('id', conselho.id)
                .select('*')
                .single()
            if (updErr) throw updErr
            await persistDeliberacoes(conselho.id)
            setConselho(data as ConselhoNotas)

            // Membros a guardar → notificar administrador / Subdir. Pedagógico
            if (isActiveMember && user?.id) {
                const membroActual = membros.find((m) => m.user_id === user.id)
                void notifyGestoresRascunhoConselho({
                    conselhoId: conselho.id,
                    actorNome: membroActual?.nome_exibicao || undefined,
                })
            }

            showFeedback('success', 'Rascunho guardado com sucesso. As deliberações ficaram registadas.')
        } catch (err) {
            showFeedback(
                'error',
                translateError(err instanceof Error ? err.message : 'Erro ao guardar o rascunho')
            )
        } finally {
            setSaving(false)
            setSavePhase('idle')
        }
    }

    const handleInviteAll = async () => {
        if (!conselho || !user?.id) return
        const prazoRaw = invitePrazoDias.trim()
        if (!prazoRaw || Number(prazoRaw) < 1) {
            setError('Indique o prazo em dias (mínimo 1) — sem valor por defeito.')
            return
        }
        for (const papel of PAPEIS) {
            if (!inviteUserId[papel]) {
                setError(`Seleccione o utilizador para ${PAPEL_LABEL[papel]}.`)
                return
            }
        }
        const uniqueUsers = new Set(PAPEIS.map((p) => inviteUserId[p]))
        if (uniqueUsers.size < PAPEIS.length) {
            setError('Cada papel deve ter um utilizador diferente.')
            return
        }

        try {
            setInviteBusy(true)
            setError(null)
            const links: string[] = []
            const novosMembros: ConselhoNotasMembro[] = []
            const nameUpdates: Partial<ConselhoNotas> = {}

            for (const papel of PAPEIS) {
                const cand = candidatos.find((c) => c.user_id === inviteUserId[papel])
                if (!cand) throw new Error(`Utilizador inválido para ${PAPEL_LABEL[papel]}`)
                const { membro, link } = await convidarMembroConselho({
                    conselhoId: conselho.id,
                    userId: cand.user_id,
                    papel,
                    nomeExibicao: cand.nome_completo,
                    prazoDias: Number(prazoRaw),
                    convidadoPor: user.id,
                })
                novosMembros.push(membro)
                links.push(`${PAPEL_LABEL[papel]}: ${link}`)
                if (papel === 'coordenador') nameUpdates.coordenador_nome = cand.nome_completo
                if (papel === 'secretario') nameUpdates.secretario_nome = cand.nome_completo
                if (papel === 'membro') nameUpdates.membro_2_nome = cand.nome_completo
            }

            setMembros((prev) => {
                const rest = prev.filter((m) => !PAPEIS.includes(m.papel))
                return [...rest, ...novosMembros]
            })
            setConselho((prev) => (prev ? { ...prev, ...nameUpdates } : prev))
            setInvitePrazoDias('')

            const clipboardText = links.join('\n')
            try {
                await navigator.clipboard.writeText(clipboardText)
                setSuccess(
                    `Convites enviados aos 3 membros (${prazoRaw} dias). Links copiados para a área de transferência.`
                )
            } catch {
                setSuccess(`Convites enviados. Links:\n${clipboardText}`)
            }
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao convidar'))
        } finally {
            setInviteBusy(false)
        }
    }

    const handleApprove = async () => {
        if (!conselho) return
        const names = syncNomesFromMembros()
        if (!names.coordenador_nome?.trim() || !names.secretario_nome?.trim() || !names.membro_2_nome?.trim()) {
            setError('Convide Coordenador, Secretário e Membro antes de aprovar.')
            return
        }
        const invalid = delibs.filter(
            (d) => d.is_caso_critico && d.situacao_deliberada !== d.situacao_sistema && !d.motivo.trim()
        )
        if (invalid.length) {
            setError('Casos com deliberação diferente do sistema exigem motivo.')
            return
        }

        try {
            setSaving(true)
            setSavePhase('approving')
            setError(null)
            setSuccess(null)
            await supabase
                .from('conselho_notas')
                .update({
                    ...names,
                    data_reuniao: dataReuniao || new Date().toISOString().slice(0, 10),
                    local_reuniao: localReuniao || null,
                    parecer_geral: parecer || null,
                })
                .eq('id', conselho.id)
            await persistDeliberacoes(conselho.id)

            const result = await aprovarConselhoComPropostas(conselho.id)
            const { data } = await supabase.from('conselho_notas').select('*').eq('id', conselho.id).single()
            setConselho(data as ConselhoNotas)
            const refreshed = await loadPropostasConselho(conselho.id)
            setPropostas(refreshed)

            if (user?.id) {
                void notifyMembrosConselhoAprovado({ conselhoId: conselho.id })
            }

            showFeedback(
                'success',
                `Conselho aprovado. ${result.propostas_aplicadas} proposta(s) de nota aplicada(s). Já pode exportar a Pauta-Geral.`,
                6000
            )
        } catch (err) {
            showFeedback('error', translateError(err instanceof Error ? err.message : 'Erro ao aprovar'))
        } finally {
            setSaving(false)
            setSavePhase('idle')
        }
    }

    const handleReopen = async () => {
        if (!conselho) return
        try {
            setSaving(true)
            setSavePhase('reopening')
            const { data, error: updErr } = await supabase
                .from('conselho_notas')
                .update({
                    status: 'rascunho' as ConselhoNotasStatus,
                    aprovado_em: null,
                    aprovado_por: null,
                })
                .eq('id', conselho.id)
                .select('*')
                .single()
            if (updErr) throw updErr
            setConselho(data as ConselhoNotas)
            showFeedback(
                'success',
                propostasAplicadas > 0
                    ? 'Conselho reaberto. Notas já aplicadas pelas propostas anteriores não são revertidas automaticamente.'
                    : 'Conselho reaberto para edição.'
            )
        } catch (err) {
            showFeedback('error', translateError(err instanceof Error ? err.message : 'Erro ao reabrir'))
        } finally {
            setSaving(false)
            setSavePhase('idle')
        }
    }

    const handlePrint = async () => {
        if (!conselho || !snapshot) return
        try {
            await generateConselhoNotasPDF(
                {
                    turma: snapshot.turma,
                    data_reuniao: dataReuniao,
                    local_reuniao: localReuniao,
                    coordenador_nome: conselho.coordenador_nome,
                    secretario_nome: conselho.secretario_nome,
                    membro_2_nome: conselho.membro_2_nome,
                    parecer_geral: parecer,
                    resumo: snapshot.resumo,
                    deliberacoes: delibs.map((d) => ({
                        numero_processo: d.numero_processo,
                        nome_completo: d.nome_completo,
                        media_geral: d.media_geral,
                        frequencia_anual: d.frequencia_anual,
                        situacao_sistema: d.situacao_sistema,
                        situacao_deliberada: d.situacao_deliberada,
                        motivo: d.motivo,
                        is_caso_critico: d.is_caso_critico,
                    })),
                    propostas: propostas.map((p) => {
                        const aluno = snapshot.alunos.find((a) => a.aluno_id === p.aluno_id)
                        const disc = aluno?.disciplinas_risco_detalhe.find(
                            (d) => d.componente_id === p.componente_id
                        )
                        return {
                            aluno: aluno?.nome_completo || p.aluno_id,
                            disciplina: disc?.nome || p.disciplina_id,
                            componente: disc?.componente_label || disc?.componente_codigo || '',
                            valor_atual: p.valor_atual,
                            valor_proposto: p.valor_proposto,
                            motivo: p.motivo,
                            status: p.status,
                        }
                    }),
                    escola: headerConfig
                        ? {
                              nome: headerConfig.nome_escola,
                              provincia: headerConfig.provincia,
                              municipio: headerConfig.municipio,
                          }
                        : undefined,
                },
                headerConfig
            )
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao gerar PDF'))
        }
    }

    const openExpand = (alunoId: string) => {
        setExpandedAlunoId((prev) => (prev === alunoId ? null : alunoId))
        const aluno = snapshot?.alunos.find((a) => a.aluno_id === alunoId)
        if (!aluno) return
        const drafts: Record<string, { valor: string; motivo: string }> = {}
        aluno.disciplinas_risco_detalhe.forEach((d) => {
            const existing = propostas.find(
                (p) =>
                    p.aluno_id === alunoId &&
                    p.componente_id === d.componente_id &&
                    p.status === 'pendente'
            )
            drafts[d.componente_id] = {
                valor: existing ? String(existing.valor_proposto) : d.valor != null ? String(d.valor) : '',
                motivo: existing?.motivo || '',
            }
        })
        setProposalDrafts(drafts)
    }

    const handleSaveProposta = async (
        alunoId: string,
        disc: { disciplina_id: string; componente_id: string; valor: number | null }
    ) => {
        if (!conselho || !user?.id) return
        const draft = proposalDrafts[disc.componente_id]
        if (!draft) return
        const valorProposto = Number(draft.valor.replace(',', '.'))
        try {
            setSaving(true)
            setError(null)
            const saved = await upsertPropostaNota({
                conselhoId: conselho.id,
                alunoId,
                disciplinaId: disc.disciplina_id,
                componenteId: disc.componente_id,
                valorAtual: disc.valor ?? 0,
                valorProposto,
                motivo: draft.motivo,
                propostoPor: user.id,
            })
            setPropostas((prev) => {
                const rest = prev.filter(
                    (p) => !(p.aluno_id === alunoId && p.componente_id === disc.componente_id)
                )
                return [...rest, saved]
            })
            setSuccess('Proposta guardada (aplica-se só na aprovação do Conselho).')
            setTimeout(() => setSuccess(null), 2500)
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao guardar proposta'))
        } finally {
            setSaving(false)
        }
    }

    const casosCriticos = delibs.filter((d) => d.is_caso_critico)
    const statusBadge =
        conselho?.status === 'aprovado'
            ? 'bg-blue-100 text-blue-800'
            : conselho?.status === 'anulado'
                ? 'bg-red-100 text-red-800'
                : 'bg-amber-100 text-amber-800'

    const membroPorPapel = (papel: ConselhoMembroPapel) => membros.find((m) => m.papel === papel)

    return (
        <div className="space-y-5 md:space-y-6 animate-fade-in pb-6">
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-700 via-slate-800 to-blue-900 p-5 md:p-6 shadow-lg">
                <div className="relative">
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Conselho de Notas</h2>
                    <p className="text-sm text-slate-200/90 max-w-2xl">
                        Convites com prazo, deliberação de casos críticos com visão das notas e propostas de ajuste
                        aplicadas apenas na aprovação.
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm">{error}</div>
            )}
            {success && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-xl text-sm">{success}</div>
            )}

            <Card className="border-0 shadow-lg">
                <CardHeader>
                    <h3 className="text-base font-semibold text-slate-800">Seleccionar Turma</h3>
                </CardHeader>
                <CardBody className="p-4 md:p-5">
                    <select
                        className="w-full max-w-md px-4 py-3 border border-slate-200 rounded-xl bg-white"
                        value={selectedTurma}
                        onChange={(e) => setSelectedTurma(e.target.value)}
                    >
                        <option value="">Seleccione uma turma</option>
                        {turmas.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.nome} — {t.ano_lectivo}
                            </option>
                        ))}
                    </select>
                </CardBody>
            </Card>

            {loading && <div className="text-center text-slate-500 py-8">A carregar dados do conselho…</div>}

            {!loading && snapshot && conselho && (
                <>
                    <div className="flex flex-wrap items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${statusBadge}`}>
                            {conselho.status}
                        </span>
                        <span className="text-sm text-slate-600">
                            {snapshot.turma.nome} · {snapshot.resumo.total} alunos · MG turma{' '}
                            {snapshot.resumo.media_turma.toFixed(2)}
                        </span>
                        {propostasAplicadas > 0 && (
                            <span className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-700">
                                {propostasAplicadas} proposta(s) já aplicada(s) às notas
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            ['Transita', snapshot.resumo.transita, 'text-blue-700 bg-blue-50'],
                            ['Não Transita', snapshot.resumo.nao_transita, 'text-red-700 bg-red-50'],
                            ['Condicional', snapshot.resumo.condicional, 'text-amber-700 bg-amber-50'],
                            ['Casos críticos', casosCriticos.length, 'text-slate-700 bg-slate-50'],
                        ].map(([label, value, cls]) => (
                            <div key={String(label)} className={`rounded-xl border border-slate-100 p-3 ${cls}`}>
                                <p className="text-xs font-medium opacity-80">{label}</p>
                                <p className="text-xl font-bold">{value}</p>
                            </div>
                        ))}
                    </div>

                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <h3 className="text-base font-semibold text-slate-800">Composição e convites</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Seleccione os 3 membros, indique um prazo único em dias e envie os convites de uma vez.
                            </p>
                        </CardHeader>
                        <CardBody className="p-4 md:p-5 space-y-4">
                            {!canManage && (
                                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                    Apenas o administrador da escola ou o Subdirector Pedagógico pode enviar convites.
                                    Membros aceites podem deliberar e propor ajustes até ao fim do prazo.
                                </p>
                            )}
                            {PAPEIS.map((papel) => {
                                const m = membroPorPapel(papel)
                                const expired = m && new Date(m.expires_at).getTime() <= Date.now()
                                return (
                                    <div
                                        key={papel}
                                        className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end border border-slate-100 rounded-xl p-3"
                                    >
                                        <div>
                                            <p className="text-sm font-medium text-slate-800">{PAPEL_LABEL[papel]}</p>
                                            {m && (
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {m.nome_exibicao || '—'} · {m.status}
                                                    {m.expires_at
                                                        ? ` · até ${new Date(m.expires_at).toLocaleDateString('pt-PT')}`
                                                        : ''}
                                                    {expired ? ' (expirado)' : ''}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                                Utilizador
                                            </label>
                                            <select
                                                disabled={!canManage || isLocked}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50"
                                                value={inviteUserId[papel]}
                                                onChange={(e) =>
                                                    setInviteUserId((prev) => ({ ...prev, [papel]: e.target.value }))
                                                }
                                            >
                                                <option value="">Seleccione…</option>
                                                {candidatos.map((c) => (
                                                    <option key={c.user_id} value={c.user_id}>
                                                        {c.nome_completo} ({c.origem})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )
                            })}

                            {canManage && !isLocked && (
                                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end border border-blue-100 bg-blue-50/40 rounded-xl p-3">
                                    <label className="block text-sm flex-1">
                                        <span className="font-medium text-slate-700">Prazo do Conselho (dias)</span>
                                        <input
                                            type="number"
                                            min={1}
                                            step={1}
                                            placeholder="Obrigatório — ex.: 7"
                                            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                                            value={invitePrazoDias}
                                            onChange={(e) => setInvitePrazoDias(e.target.value)}
                                        />
                                    </label>
                                    <Button
                                        variant="primary"
                                        disabled={inviteBusy}
                                        onClick={handleInviteAll}
                                        className="sm:min-w-[200px]"
                                    >
                                        {inviteBusy
                                            ? 'A enviar…'
                                            : membros.length >= 3
                                              ? 'Reenviar convites'
                                              : 'Enviar convites'}
                                    </Button>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                <label className="block text-sm">
                                    <span className="font-medium text-slate-700">Data da reunião</span>
                                    <input
                                        type="date"
                                        disabled={!canEdit}
                                        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50"
                                        value={dataReuniao}
                                        onChange={(e) => setDataReuniao(e.target.value)}
                                    />
                                </label>
                                <label className="block text-sm">
                                    <span className="font-medium text-slate-700">Local</span>
                                    <input
                                        disabled={!canEdit}
                                        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50"
                                        value={localReuniao}
                                        onChange={(e) => setLocalReuniao(e.target.value)}
                                        placeholder="Ex.: Sala de professores"
                                    />
                                </label>
                            </div>
                        </CardBody>
                    </Card>

                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <h3 className="text-base font-semibold text-slate-800">Casos críticos</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Expanda cada aluno para ver as disciplinas em causa. As propostas alteram apenas
                                componentes de lançamento (MAC, NPT, …) — a MF é resultado de cálculo e aparece só como
                                referência. Aplicam-se na aprovação do Conselho.
                            </p>
                        </CardHeader>
                        <CardBody className="p-0">
                            {casosCriticos.length === 0 ? (
                                <p className="p-4 text-sm text-slate-500">Nenhum caso crítico nesta turma.</p>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {casosCriticos.map((d) => {
                                        const alunoSnap = snapshot.alunos.find((a) => a.aluno_id === d.aluno_id)
                                        const open = expandedAlunoId === d.aluno_id
                                        return (
                                            <li key={d.aluno_id} className="p-3 md:p-4">
                                                <button
                                                    type="button"
                                                    className="w-full flex flex-wrap items-center gap-3 text-left"
                                                    onClick={() => openExpand(d.aluno_id)}
                                                >
                                                    <div className="flex-1 min-w-[140px]">
                                                        <div className="font-medium text-slate-800">{d.nome_completo}</div>
                                                        <div className="text-xs text-slate-500">{d.numero_processo}</div>
                                                    </div>
                                                    <div className="text-sm">
                                                        MG <strong>{d.media_geral.toFixed(1)}</strong>
                                                    </div>
                                                    <div className="text-sm text-slate-600">
                                                        {d.frequencia_anual != null
                                                            ? `${d.frequencia_anual.toFixed(1)}%`
                                                            : 'Freq. —'}
                                                    </div>
                                                    <div className="text-xs px-2 py-1 rounded bg-slate-100">
                                                        {d.situacao_sistema}
                                                    </div>
                                                    <span className="text-xs text-blue-700">
                                                        {open ? 'Ocultar' : 'Ver notas'}
                                                    </span>
                                                </button>

                                                {open && alunoSnap && (
                                                    <div className="mt-3 space-y-3 pl-0 md:pl-2">
                                                        {alunoSnap.motivos.length > 0 && (
                                                            <p className="text-xs text-slate-600">
                                                                {alunoSnap.motivos.join(' · ')}
                                                            </p>
                                                        )}

                                                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                                                            <table className="min-w-full text-sm">
                                                                <thead className="bg-slate-50 text-slate-600">
                                                                    <tr>
                                                                        <th className="px-3 py-2 text-left">Disciplina</th>
                                                                        <th className="px-3 py-2 text-center">MF (ref.)</th>
                                                                        <th className="px-3 py-2 text-center">Lançamento</th>
                                                                        <th className="px-3 py-2 text-center">Actual</th>
                                                                        <th className="px-3 py-2 text-center">Proposta</th>
                                                                        <th className="px-3 py-2 text-left">Motivo</th>
                                                                        <th className="px-3 py-2" />
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {alunoSnap.disciplinas_risco_detalhe.length === 0 ? (
                                                                        <tr>
                                                                            <td
                                                                                colSpan={7}
                                                                                className="px-3 py-3 text-slate-500"
                                                                            >
                                                                                Sem componentes de lançamento nas
                                                                                disciplinas em risco.
                                                                            </td>
                                                                        </tr>
                                                                    ) : (
                                                                        alunoSnap.disciplinas_risco_detalhe.map((disc) => {
                                                                            const draft = proposalDrafts[disc.componente_id] || {
                                                                                valor: '',
                                                                                motivo: '',
                                                                            }
                                                                            const pending = propostas.find(
                                                                                (p) =>
                                                                                    p.aluno_id === d.aluno_id &&
                                                                                    p.componente_id ===
                                                                                        disc.componente_id &&
                                                                                    p.status === 'pendente'
                                                                            )
                                                                            return (
                                                                                <tr
                                                                                    key={disc.componente_id}
                                                                                    className="border-t border-slate-100"
                                                                                >
                                                                                    <td className="px-3 py-2">{disc.nome}</td>
                                                                                    <td className="px-3 py-2 text-center text-slate-500">
                                                                                        {disc.media_referencia != null
                                                                                            ? disc.media_referencia.toFixed(1)
                                                                                            : '—'}
                                                                                    </td>
                                                                                    <td className="px-3 py-2 text-center">
                                                                                        {disc.componente_label ||
                                                                                            disc.componente_codigo}
                                                                                    </td>
                                                                                    <td className="px-3 py-2 text-center font-medium">
                                                                                        {disc.valor != null
                                                                                            ? disc.valor.toFixed(1)
                                                                                            : '—'}
                                                                                    </td>
                                                                                    <td className="px-3 py-2">
                                                                                        <input
                                                                                            disabled={!canEdit}
                                                                                            type="number"
                                                                                            step="0.1"
                                                                                            className="w-20 mx-auto block border border-slate-200 rounded-lg px-2 py-1 text-center disabled:bg-slate-50"
                                                                                            value={draft.valor}
                                                                                            onChange={(e) =>
                                                                                                setProposalDrafts((prev) => ({
                                                                                                    ...prev,
                                                                                                    [disc.componente_id]: {
                                                                                                        ...draft,
                                                                                                        valor: e.target.value,
                                                                                                    },
                                                                                                }))
                                                                                            }
                                                                                        />
                                                                                    </td>
                                                                                    <td className="px-3 py-2 min-w-[140px]">
                                                                                        <input
                                                                                            disabled={!canEdit}
                                                                                            className="w-full border border-slate-200 rounded-lg px-2 py-1 disabled:bg-slate-50"
                                                                                            value={draft.motivo}
                                                                                            onChange={(e) =>
                                                                                                setProposalDrafts((prev) => ({
                                                                                                    ...prev,
                                                                                                    [disc.componente_id]: {
                                                                                                        ...draft,
                                                                                                        motivo: e.target.value,
                                                                                                    },
                                                                                                }))
                                                                                            }
                                                                                            placeholder="Motivo da proposta"
                                                                                        />
                                                                                    </td>
                                                                                    <td className="px-3 py-2 whitespace-nowrap">
                                                                                        {canEdit && (
                                                                                            <button
                                                                                                type="button"
                                                                                                className="text-xs font-medium text-blue-700 hover:underline"
                                                                                                onClick={() =>
                                                                                                    handleSaveProposta(
                                                                                                        d.aluno_id,
                                                                                                        disc
                                                                                                    )
                                                                                                }
                                                                                            >
                                                                                                {pending ? 'Actualizar' : 'Propor'}
                                                                                            </button>
                                                                                        )}
                                                                                        {pending && (
                                                                                            <span className="ml-2 text-[10px] text-amber-700">
                                                                                                pendente
                                                                                            </span>
                                                                                        )}
                                                                                    </td>
                                                                                </tr>
                                                                            )
                                                                        })
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            <label className="block text-sm">
                                                                <span className="font-medium text-slate-700">
                                                                    Deliberado
                                                                </span>
                                                                <select
                                                                    disabled={!canEdit}
                                                                    className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-50"
                                                                    value={d.situacao_deliberada}
                                                                    onChange={(e) => {
                                                                        const v = e.target.value as StatusTransicao
                                                                        setDelibs((prev) =>
                                                                            prev.map((x) =>
                                                                                x.aluno_id === d.aluno_id
                                                                                    ? { ...x, situacao_deliberada: v }
                                                                                    : x
                                                                            )
                                                                        )
                                                                    }}
                                                                >
                                                                    {STATUS_OPTIONS.map((s) => (
                                                                        <option key={s} value={s}>
                                                                            {s}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </label>
                                                            <label className="block text-sm">
                                                                <span className="font-medium text-slate-700">
                                                                    Motivo da deliberação
                                                                </span>
                                                                <input
                                                                    disabled={!canEdit}
                                                                    className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-50"
                                                                    value={d.motivo}
                                                                    onChange={(e) => {
                                                                        const v = e.target.value
                                                                        setDelibs((prev) =>
                                                                            prev.map((x) =>
                                                                                x.aluno_id === d.aluno_id
                                                                                    ? { ...x, motivo: v }
                                                                                    : x
                                                                            )
                                                                        )
                                                                    }}
                                                                    placeholder="Obrigatório se alterar a situação"
                                                                />
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </CardBody>
                    </Card>

                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <h3 className="text-base font-semibold text-slate-800">Parecer geral</h3>
                        </CardHeader>
                        <CardBody className="p-4 md:p-5">
                            <textarea
                                disabled={!canEdit}
                                className="w-full min-h-[90px] px-3 py-2 border border-slate-200 rounded-xl disabled:bg-slate-50"
                                value={parecer}
                                onChange={(e) => setParecer(e.target.value)}
                                placeholder="Síntese do Conselho (opcional)…"
                            />
                        </CardBody>
                    </Card>

                    <div ref={actionFeedbackRef} className="space-y-3">
                        {saving && (
                            <div className="bg-slate-50 border border-slate-200 text-slate-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                                <svg className="animate-spin w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                {savePhase === 'approving'
                                    ? 'A aprovar o Conselho e a aplicar propostas…'
                                    : savePhase === 'reopening'
                                      ? 'A reabrir o Conselho…'
                                      : 'A guardar o rascunho…'}
                            </div>
                        )}
                        {!saving && success && (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-xl text-sm font-medium">
                                {success}
                            </div>
                        )}
                        {!saving && error && (
                            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm">
                                {error}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-3">
                            {canEdit && (
                                <>
                                    <Button
                                        onClick={handleSave}
                                        loading={savePhase === 'saving'}
                                        disabled={saving}
                                        variant="secondary"
                                    >
                                        {savePhase === 'saving' ? 'A guardar…' : 'Guardar rascunho'}
                                    </Button>
                                    {canManage && (
                                        <Button
                                            onClick={handleApprove}
                                            loading={savePhase === 'approving'}
                                            disabled={saving}
                                        >
                                            {savePhase === 'approving' ? 'A aprovar…' : 'Aprovar Conselho'}
                                        </Button>
                                    )}
                                </>
                            )}
                            {isLocked && (
                                <>
                                    <Button onClick={handlePrint} disabled={saving}>
                                        Imprimir relatório
                                    </Button>
                                    {canManage && (
                                        <Button onClick={handleReopen} disabled={saving} variant="secondary">
                                            Reabrir (editar)
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
