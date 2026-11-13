import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { FormModal } from '../../../components/ui/FormModal'
import { Icons } from '../../../components/ui/Icons'
import {
    fetchAvaliacaoDetalhe,
    fetchIndicadores,
    registarConcordancia,
    saveAvaliacao,
    updateEstadoAvaliacao,
} from '../api/avaliacoes'
import {
    GRADUACOES_VALIDAS,
    MENCAO_RANGES,
    calcularClassificacaoFinal,
    labelMencao,
    mencaoFromClassificacao,
} from '../utils/classificacao'
import {
    ESTADO_AVALIACAO_LABELS,
    INSTRUMENTO_LABELS,
    PERIODO_LABELS,
} from '../utils/indicadoresSeed'
import {
    exportFichaAvaliacaoPdf,
    resolveAnexoOficial,
} from '../utils/exportFichaPdf'
import { loadHeaderConfig } from '../../../utils/headerConfigUtils'
import type {
    AdAvaliacao,
    AdIndicador,
    GraduacaoIndicador,
    EstadoAvaliacao,
    MencaoClassificacao,
} from '../types'

interface AvaliacaoFichaModalProps {
    avaliacaoId: string | null
    escolaId: string
    onClose: () => void
    onSaved?: () => void
}

const ESTADO_BADGE: Record<EstadoAvaliacao, string> = {
    RASCUNHO: 'bg-slate-100 text-slate-700',
    EM_AVALIACAO: 'bg-amber-50 text-amber-800 border border-amber-200',
    DIVULGADA: 'bg-blue-50 text-blue-800 border border-blue-200',
    ASSINADA: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    CONCLUIDA: 'bg-slate-800 text-white',
}

const MENCAO_TONE: Record<MencaoClassificacao, string> = {
    MUITO_BOM: 'text-emerald-700',
    BOM: 'text-blue-700',
    SUFICIENTE: 'text-amber-700',
    MAU: 'text-red-700',
}

export const AvaliacaoFichaModal: React.FC<AvaliacaoFichaModalProps> = ({
    avaliacaoId,
    escolaId: _escolaId,
    onClose,
    onSaved,
}) => {
    const { user, professorProfile, isEscola, isSecretario, escolaProfile } = useAuth()
    const [avaliacao, setAvaliacao] = useState<AdAvaliacao | null>(null)
    const [indicadores, setIndicadores] = useState<AdIndicador[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [busy, setBusy] = useState(false)
    const [objectivos, setObjectivos] = useState('')
    const [observacoes, setObservacoes] = useState('')
    const [graduacoes, setGraduacoes] = useState<Record<string, GraduacaoIndicador | ''>>({})
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        if (!avaliacaoId) return
        setIsLoading(true)
        setError(null)
        try {
            const det = await fetchAvaliacaoDetalhe(avaliacaoId)
            setAvaliacao(det)
            if (!det) return
            const inds = await fetchIndicadores(det.instrumento_codigo)
            setIndicadores(inds)
            setObjectivos(det.objectivos_texto || '')
            setObservacoes(det.observacoes || '')
            const map: Record<string, GraduacaoIndicador | ''> = {}
            for (const ind of inds) {
                const score = det.scores?.find(s => s.indicador_id === ind.id)
                map[ind.id] = (score?.graduacao as GraduacaoIndicador) || ''
            }
            setGraduacoes(map)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erro ao carregar ficha.')
        } finally {
            setIsLoading(false)
        }
    }, [avaliacaoId])

    useEffect(() => {
        if (avaliacaoId) void load()
        else {
            setAvaliacao(null)
            setIndicadores([])
        }
    }, [avaliacaoId, load])

    const preview = useMemo(() => {
        const scores = indicadores
            .filter(i => graduacoes[i.id])
            .map(i => ({
                graduacao: Number(graduacoes[i.id]),
                coeficiente: Number(i.coeficiente_ponderacao),
            }))
        const cf = calcularClassificacaoFinal(scores)
        return { cf, mencao: mencaoFromClassificacao(cf) }
    }, [indicadores, graduacoes])

    const preenchidos = useMemo(
        () => indicadores.filter(i => graduacoes[i.id]).length,
        [indicadores, graduacoes],
    )

    const nomeAvaliado =
        avaliacao?.avaliado_tipo === 'PROFESSOR'
            ? avaliacao.professor?.nome_completo
            : avaliacao?.funcionario?.nome_completo

    const categoriaAvaliado =
        avaliacao?.avaliado_tipo === 'PROFESSOR'
            ? 'Professor / Educador'
            : [avaliacao?.funcionario?.categoria, avaliacao?.funcionario?.cargo || avaliacao?.funcionario?.subcategoria]
                  .filter(Boolean)
                  .join(' — ') || 'Funcionário'

    /** Só o próprio avaliado (Art. 25.º) — nunca a direcção/admin em nome de outrem. */
    const isProprioAvaliado = useMemo(() => {
        if (!avaliacao || !user?.id) return false
        if (avaliacao.avaliado_tipo === 'PROFESSOR') {
            if (professorProfile?.id && professorProfile.id === avaliacao.professor_id) return true
            return avaliacao.professor?.user_id === user.id
        }
        return avaliacao.funcionario?.user_id === user.id
    }, [avaliacao, user?.id, professorProfile?.id])

    const isAvaliadorGestao = isEscola || isSecretario
    const readOnly =
        avaliacao?.estado === 'CONCLUIDA' || (isProprioAvaliado && !isAvaliadorGestao)
    /** Art. 25.º — pendente enquanto o avaliado ainda não registou concordância. */
    const podeAssinar =
        isProprioAvaliado &&
        !!avaliacao &&
        avaliacao.concordancia_avaliado == null &&
        (avaliacao.estado === 'DIVULGADA' ||
            avaliacao.estado === 'EM_AVALIACAO' ||
            // Se a escola concluiu sem aguardar a assinatura, o avaliado ainda pode responder
            avaliacao.estado === 'CONCLUIDA')
    const podeGerirFicha = isAvaliadorGestao && !isProprioAvaliado && !readOnly

    const buildScores = () =>
        indicadores
            .filter(i => graduacoes[i.id])
            .map(i => ({
                indicador_id: i.id,
                graduacao: graduacoes[i.id] as GraduacaoIndicador,
            }))

    const handleSave = async (nextEstado?: EstadoAvaliacao) => {
        if (!avaliacaoId || !avaliacao) return
        setError(null)
        const scores = buildScores()
        if (scores.length !== indicadores.length) {
            setError('Preencha a graduação de todos os indicadores (5, 10, 15 ou 20).')
            return
        }
        setBusy(true)
        try {
            await saveAvaliacao(avaliacaoId, {
                objectivos_texto: objectivos,
                observacoes,
                estado:
                    nextEstado ||
                    (avaliacao.estado === 'RASCUNHO' ? 'EM_AVALIACAO' : avaliacao.estado),
                scores,
            })
            onSaved?.()
            if (!nextEstado) onClose()
            else await load()
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erro ao guardar a ficha.')
        } finally {
            setBusy(false)
        }
    }

    const handleDivulgar = async () => {
        await handleSave('DIVULGADA')
        onClose()
    }

    const handleAssinar = async (concorda: boolean) => {
        if (!avaliacaoId || !isProprioAvaliado) {
            setError('Apenas o próprio avaliado pode registar a concordância (Art. 25.º).')
            return
        }
        setError(null)
        setBusy(true)
        try {
            await registarConcordancia(avaliacaoId, concorda)
            onSaved?.()
            await load()
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erro ao registar assinatura.')
        } finally {
            setBusy(false)
        }
    }

    const handleConcluir = async () => {
        if (!avaliacaoId) return
        setBusy(true)
        try {
            await updateEstadoAvaliacao(avaliacaoId, 'CONCLUIDA')
            onSaved?.()
            onClose()
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erro ao concluir.')
        } finally {
            setBusy(false)
        }
    }

    const handleImprimirPdf = async () => {
        if (!avaliacao) return
        setBusy(true)
        setError(null)
        try {
            const escola = escolaProfile || professorProfile?.escola
            const escolaId =
                avaliacao.escola_id ||
                escolaProfile?.id ||
                professorProfile?.escola_id ||
                ''
            const headerConfig = escolaId ? await loadHeaderConfig(escolaId) : null
            await exportFichaAvaliacaoPdf(avaliacao, {
                escolaNome: headerConfig?.nome_escola || escola?.nome || 'Escola',
                escolaCodigo: escola?.codigo_escola,
                provincia: headerConfig?.provincia || escola?.provincia,
                municipio: headerConfig?.municipio || escola?.municipio,
                headerConfig,
            })
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erro ao gerar o PDF da ficha.')
        } finally {
            setBusy(false)
        }
    }

    const anexoInfo = avaliacao ? resolveAnexoOficial(avaliacao) : null

    return (
        <FormModal
            isOpen={!!avaliacaoId}
            onClose={() => !busy && onClose()}
            title="Ficha de avaliação de desempenho"
            subtitle={
                avaliacao && anexoInfo
                    ? `${PERIODO_LABELS[avaliacao.periodo]} · ${anexoInfo.tituloAnexo} · ${INSTRUMENTO_LABELS[avaliacao.instrumento_codigo]}`
                    : 'A carregar ficha…'
            }
            size="xl"
            accent="blue"
            busy={busy}
            icon={<Icons.ClipboardList />}
        >
            {isLoading || !avaliacao ? (
                <div className="px-5 py-12 flex flex-col items-center gap-3 text-slate-500">
                    <Icons.Spinner className="w-6 h-6 text-blue-600" />
                    <p className="text-sm">A carregar ficha…</p>
                </div>
            ) : (
                <div className="flex flex-col">
                    <div className="px-5 py-4 space-y-5">
                        {/* Identidade do avaliado */}
                        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-3.5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                                        Avaliado
                                    </p>
                                    <p className="mt-0.5 text-base font-semibold text-slate-900 truncate">
                                        {nomeAvaliado || '—'}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-500">{categoriaAvaliado}</p>
                                </div>
                                <span
                                    className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${ESTADO_BADGE[avaliacao.estado]}`}
                                >
                                    {ESTADO_AVALIACAO_LABELS[avaliacao.estado]}
                                </span>
                            </div>
                            {avaliacao.concordancia_avaliado != null && (
                                <p className="mt-2.5 text-xs text-slate-600 border-t border-slate-100 pt-2">
                                    Concordância do avaliado:{' '}
                                    <strong className={avaliacao.concordancia_avaliado ? 'text-emerald-700' : 'text-amber-700'}>
                                        {avaliacao.concordancia_avaliado ? 'Concorda' : 'Não concorda'}
                                    </strong>
                                </p>
                            )}
                        </div>

                        <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-slate-50 px-3.5 py-3">
                            <p className="text-xs font-medium text-blue-900">
                                Decreto Presidencial n.º 28/22 · Anexos I–IV
                            </p>
                            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                                Graduação em <strong>5 / 10 / 15 / 20</strong>. Classificação final
                                ponderada (Art. 19.º) e menção (Art. 20.º).
                            </p>
                        </div>

                        {/* Objectivos */}
                        <div>
                            <label
                                htmlFor="ad-ficha-objectivos"
                                className="block text-sm font-semibold text-slate-800 mb-1.5"
                            >
                                Objectivos do período{' '}
                                <span className="font-normal text-slate-400">(Art. 22.º)</span>
                            </label>
                            <textarea
                                id="ad-ficha-objectivos"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 min-h-[80px] shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition-shadow disabled:bg-slate-50 disabled:text-slate-500"
                                value={objectivos}
                                onChange={e => setObjectivos(e.target.value)}
                                disabled={readOnly || busy}
                                placeholder="Objectivos acordados com o avaliado no início do período…"
                            />
                        </div>

                        {/* Indicadores */}
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-2.5">
                                <h3 className="text-sm font-semibold text-slate-800">Indicadores</h3>
                                <span className="text-xs text-slate-500 tabular-nums">
                                    {preenchidos}/{indicadores.length} graduados
                                </span>
                            </div>
                            <div className="space-y-2.5">
                                {indicadores.map((ind, idx) => {
                                    const selected = graduacoes[ind.id]
                                    return (
                                        <div
                                            key={ind.id}
                                            className={`rounded-xl border px-3.5 py-3 transition-colors ${
                                                selected
                                                    ? 'border-blue-200 bg-blue-50/40'
                                                    : 'border-slate-200 bg-white'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3 mb-2.5">
                                                <span className="mt-0.5 w-6 h-6 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                                                    {idx + 1}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium text-slate-900 leading-snug">
                                                        {ind.nome}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-slate-500">
                                                        Coeficiente de ponderação:{' '}
                                                        <strong className="text-slate-700">
                                                            {ind.coeficiente_ponderacao}
                                                        </strong>
                                                    </p>
                                                </div>
                                            </div>
                                            <div
                                                className="grid grid-cols-4 gap-1.5"
                                                role="group"
                                                aria-label={`Graduação — ${ind.nome}`}
                                            >
                                                {GRADUACOES_VALIDAS.map(g => {
                                                    const active = selected === g
                                                    return (
                                                        <button
                                                            key={g}
                                                            type="button"
                                                            disabled={readOnly || busy}
                                                            aria-pressed={active}
                                                            onClick={() =>
                                                                setGraduacoes(prev => ({
                                                                    ...prev,
                                                                    [ind.id]: g,
                                                                }))
                                                            }
                                                            className={`
                                                                min-h-[40px] rounded-lg text-sm font-semibold tabular-nums transition-all
                                                                ${active
                                                                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
                                                                    : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                                                                }
                                                                disabled:opacity-50
                                                            `}
                                                        >
                                                            {g}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Classificação */}
                        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                            <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-blue-50/50 border-b border-slate-100">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                                    Classificação final · Art. 19.º / 20.º
                                </p>
                            </div>
                            <div className="px-4 py-4 flex flex-wrap items-end justify-between gap-3">
                                <div>
                                    <p className="text-3xl font-semibold tabular-nums text-slate-900 tracking-tight">
                                        {preview.cf != null ? preview.cf.toFixed(2) : '—'}
                                    </p>
                                    <p
                                        className={`mt-1 text-sm font-semibold ${
                                            preview.mencao
                                                ? MENCAO_TONE[preview.mencao]
                                                : 'text-slate-400'
                                        }`}
                                    >
                                        {labelMencao(preview.mencao)}
                                        {preview.mencao ? (
                                            <span className="font-normal text-slate-400">
                                                {' '}({MENCAO_RANGES[preview.mencao]})
                                            </span>
                                        ) : null}
                                    </p>
                                </div>
                                <p className="text-xs text-slate-500 max-w-[14rem] leading-relaxed text-right">
                                    Muito Bom 18–20 · Bom 14–17 · Suficiente 10–13 · Mau 0–9
                                </p>
                            </div>
                        </div>

                        {/* Observações */}
                        <div>
                            <label
                                htmlFor="ad-ficha-obs"
                                className="block text-sm font-semibold text-slate-800 mb-1.5"
                            >
                                Observações
                            </label>
                            <textarea
                                id="ad-ficha-obs"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 min-h-[72px] shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition-shadow disabled:bg-slate-50"
                                value={observacoes}
                                onChange={e => setObservacoes(e.target.value)}
                                disabled={readOnly || busy}
                                placeholder="Notas do avaliador, evidências ou recomendações…"
                            />
                        </div>

                        {error && (
                            <div
                                role="alert"
                                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
                            >
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Footer acções */}
                    <div className="flex-shrink-0 px-5 py-3.5 border-t border-slate-100 bg-slate-50/90 space-y-2.5">
                        {/* PDF oficial — disponível a escola e ao avaliado */}
                        <div className="flex flex-wrap gap-2 items-center justify-between">
                            <p className="text-[11px] text-slate-500">
                                {anexoInfo
                                    ? `Modelo oficial: ${anexoInfo.tituloAnexo} (${anexoInfo.natureza})`
                                    : null}
                            </p>
                            <button
                                type="button"
                                disabled={busy || !avaliacao}
                                onClick={handleImprimirPdf}
                                className="min-h-[40px] px-3.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-2"
                            >
                                <Icons.Download className="w-4 h-4" />
                                Imprimir PDF
                            </button>
                        </div>

                        {podeGerirFicha && (
                            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={onClose}
                                    className="min-h-[44px] px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Fechar
                                </button>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleSave()}
                                    className="min-h-[44px] px-5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm shadow-blue-600/20 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                                >
                                    {busy ? (
                                        <>
                                            <Icons.Spinner className="w-4 h-4" />
                                            A guardar…
                                        </>
                                    ) : (
                                        'Guardar'
                                    )}
                                </button>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={handleDivulgar}
                                    className="min-h-[44px] px-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 text-sm font-semibold hover:bg-blue-100 disabled:opacity-50"
                                >
                                    Divulgar
                                </button>
                                {avaliacao.estado === 'ASSINADA' && (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={handleConcluir}
                                        className="min-h-[44px] px-4 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 disabled:opacity-50"
                                    >
                                        Concluir
                                    </button>
                                )}
                                {avaliacao.estado === 'DIVULGADA' &&
                                    avaliacao.concordancia_avaliado == null && (
                                    <p className="text-xs text-amber-800 self-center max-w-[14rem]">
                                        Aguarde a concordância do avaliado antes de concluir.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Aviso à direcção: não assina em nome do avaliado */}
                        {isAvaliadorGestao &&
                            !isProprioAvaliado &&
                            avaliacao.concordancia_avaliado == null &&
                            (avaliacao.estado === 'DIVULGADA' ||
                                avaliacao.estado === 'EM_AVALIACAO') && (
                                <p className="text-xs text-slate-500 leading-relaxed rounded-lg bg-white border border-slate-200 px-3 py-2">
                                    A concordância (Art. 25.º) só pode ser registada pelo próprio
                                    avaliado na sua conta — a direcção não assina em nome de outrem.
                                </p>
                            )}

                        {/* Só o avaliado vê Concorda / Não concorda */}
                        {podeAssinar && (
                            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-1 border-t border-slate-200/80">
                                <p className="text-xs text-slate-500 sm:mr-auto self-center">
                                    A sua assinatura (Art. 25.º)
                                </p>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleAssinar(true)}
                                    className="min-h-[44px] px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-medium hover:bg-emerald-100 disabled:opacity-50"
                                >
                                    Concorda
                                </button>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleAssinar(false)}
                                    className="min-h-[44px] px-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm font-medium hover:bg-amber-100 disabled:opacity-50"
                                >
                                    Não concorda
                                </button>
                            </div>
                        )}

                        {!podeGerirFicha && !podeAssinar && (
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="min-h-[44px] px-5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
                                >
                                    Fechar
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </FormModal>
    )
}
