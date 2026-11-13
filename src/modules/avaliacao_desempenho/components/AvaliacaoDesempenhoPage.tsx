import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { FormModal } from '../../../components/ui/FormModal'
import { Icons } from '../../../components/ui/Icons'
import { createCiclo, fetchCiclos, updateCicloEstado } from '../api/ciclos'
import { fetchAvaliacoes, gerarAvaliacoesParaPeriodo } from '../api/avaliacoes'
import { AvaliacaoFichaModal } from './AvaliacaoFichaModal'
import { labelMencao } from '../utils/classificacao'
import {
    ESTADO_AVALIACAO_LABELS,
    PERIODO_LABELS,
    TIPO_PERIODO_LABELS,
    periodosParaCiclo,
} from '../utils/indicadoresSeed'
import type {
    AdAvaliacao,
    AdCiclo,
    AvaliadoTipo,
    PeriodoAvaliacao,
    TipoPeriodoCiclo,
} from '../types'

interface AvaliacaoDesempenhoPageProps {
    onNavigate?: (page: string) => void
    searchQuery?: string
}

export const AvaliacaoDesempenhoPage: React.FC<AvaliacaoDesempenhoPageProps> = ({
    onNavigate,
    searchQuery = '',
}) => {
    const { escolaProfile, user } = useAuth()
    const escolaId = escolaProfile?.id

    const [ciclos, setCiclos] = useState<AdCiclo[]>([])
    const [avaliacoes, setAvaliacoes] = useState<AdAvaliacao[]>([])
    const [loadingCiclos, setLoadingCiclos] = useState(false)
    const [loadingAval, setLoadingAval] = useState(false)
    const [busy, setBusy] = useState(false)

    const [cicloId, setCicloId] = useState<string>('')
    const [periodo, setPeriodo] = useState<PeriodoAvaliacao | ''>('')
    const [showNovoCiclo, setShowNovoCiclo] = useState(false)
    const [anoRef, setAnoRef] = useState('')
    const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodoCiclo>('ANO_LECTIVO')
    const [fichaId, setFichaId] = useState<string | null>(null)
    const [msg, setMsg] = useState<string | null>(null)
    const [err, setErr] = useState<string | null>(null)

    const loadCiclos = useCallback(async () => {
        if (!escolaId) return
        setLoadingCiclos(true)
        try {
            const data = await fetchCiclos(escolaId)
            setCiclos(data)
            if (!cicloId && data[0]) setCicloId(data[0].id)
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : 'Erro ao carregar ciclos.')
        } finally {
            setLoadingCiclos(false)
        }
    }, [escolaId, cicloId])

    const cicloActivo = useMemo(
        () => ciclos.find(c => c.id === cicloId) || ciclos[0],
        [ciclos, cicloId],
    )
    const effectiveCicloId = cicloId || cicloActivo?.id

    const loadAvaliacoes = useCallback(async () => {
        if (!escolaId || !effectiveCicloId) {
            setAvaliacoes([])
            return
        }
        setLoadingAval(true)
        try {
            const data = await fetchAvaliacoes(escolaId, {
                cicloId: effectiveCicloId,
                periodo: periodo || undefined,
            })
            setAvaliacoes(data)
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : 'Erro ao carregar fichas.')
        } finally {
            setLoadingAval(false)
        }
    }, [escolaId, effectiveCicloId, periodo])

    useEffect(() => {
        void loadCiclos()
    }, [escolaId]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        void loadAvaliacoes()
    }, [loadAvaliacoes])

    const filtered = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        if (!q) return avaliacoes
        return avaliacoes.filter(a => {
            const nome =
                a.avaliado_tipo === 'PROFESSOR'
                    ? a.professor?.nome_completo
                    : a.funcionario?.nome_completo
            return (nome || '').toLowerCase().includes(q)
        })
    }, [avaliacoes, searchQuery])

    const periodos = cicloActivo ? periodosParaCiclo(cicloActivo.tipo_periodo) : []

    const handleCreateCiclo = async () => {
        setErr(null)
        if (!escolaId) return
        if (!anoRef.trim()) {
            setErr('Indique o ano de referência (ex.: 2025/2026 ou 2026).')
            return
        }
        setBusy(true)
        try {
            const c = await createCiclo({
                escola_id: escolaId,
                ano_referencia: anoRef.trim(),
                tipo_periodo: tipoPeriodo,
            })
            setCicloId(c.id)
            setShowNovoCiclo(false)
            setAnoRef('')
            setMsg('Ciclo criado.')
            await loadCiclos()
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : 'Erro ao criar ciclo.')
        } finally {
            setBusy(false)
        }
    }

    const handleGerar = async (tipo: AvaliadoTipo) => {
        if (!escolaId || !effectiveCicloId || !periodo || !user?.id) {
            setErr('Seleccione o ciclo e o período antes de gerar fichas.')
            return
        }
        setErr(null)
        setMsg(null)
        setBusy(true)
        try {
            const r = await gerarAvaliacoesParaPeriodo({
                cicloId: effectiveCicloId,
                escolaId,
                periodo,
                avaliadoTipo: tipo,
                avaliadorUserId: user.id,
            })
            setMsg(
                `Geração (${tipo === 'PROFESSOR' ? 'docentes' : 'funcionários'}): ${r.created} novas, ${r.skipped} já existentes.`,
            )
            await loadAvaliacoes()
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : 'Erro ao gerar fichas.')
        } finally {
            setBusy(false)
        }
    }

    if (!escolaId) {
        return (
            <div className="p-6 text-slate-600 text-sm">
                Perfil de escola não disponível.
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-24 md:pb-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
                        Avaliação de Desempenho
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                        Regime Jurídico dos Agentes de Educação — Decreto Presidencial n.º 28/22.
                        Fichas trimestrais/anuais (Anexos II–IV) e mapa geral (Art. 32.º).
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setErr(null)
                            setAnoRef('')
                            setTipoPeriodo('ANO_LECTIVO')
                            setShowNovoCiclo(true)
                        }}
                        className="min-h-[44px] px-4 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                    >
                        Novo ciclo
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate?.('avaliacao-desempenho-mapa')}
                        className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
                    >
                        Mapa geral
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Ciclo</label>
                        <select
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[44px]"
                            value={effectiveCicloId || ''}
                            onChange={e => setCicloId(e.target.value)}
                            disabled={loadingCiclos}
                        >
                            {ciclos.length === 0 && <option value="">Sem ciclos</option>}
                            {ciclos.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.ano_referencia} — {TIPO_PERIODO_LABELS[c.tipo_periodo]} (
                                    {c.estado})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                            Período
                        </label>
                        <select
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[44px]"
                            value={periodo}
                            onChange={e => setPeriodo(e.target.value as PeriodoAvaliacao | '')}
                        >
                            <option value="">Todos</option>
                            {periodos.map(p => (
                                <option key={p} value={p}>
                                    {PERIODO_LABELS[p]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-end gap-2">
                        {cicloActivo?.estado === 'ABERTO' && (
                            <button
                                type="button"
                                className="min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
                                disabled={busy || !cicloActivo}
                                onClick={async () => {
                                    if (!cicloActivo) return
                                    setBusy(true)
                                    try {
                                        await updateCicloEstado(cicloActivo.id, 'ENCERRADO')
                                        await loadCiclos()
                                    } finally {
                                        setBusy(false)
                                    }
                                }}
                            >
                                Encerrar ciclo
                            </button>
                        )}
                        {cicloActivo?.estado === 'ENCERRADO' && (
                            <button
                                type="button"
                                className="min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
                                disabled={busy || !cicloActivo}
                                onClick={async () => {
                                    if (!cicloActivo) return
                                    setBusy(true)
                                    try {
                                        await updateCicloEstado(cicloActivo.id, 'ABERTO')
                                        await loadCiclos()
                                    } finally {
                                        setBusy(false)
                                    }
                                }}
                            >
                                Reabrir ciclo
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-1">
                    <button
                        type="button"
                        disabled={busy || !periodo || cicloActivo?.tipo_periodo !== 'ANO_LECTIVO'}
                        onClick={() => handleGerar('PROFESSOR')}
                        className="min-h-[44px] px-4 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
                        title="Requer ciclo ANO_LECTIVO e período seleccionado"
                    >
                        Gerar fichas docentes
                    </button>
                    <button
                        type="button"
                        disabled={busy || !periodo || cicloActivo?.tipo_periodo !== 'ANO_CIVIL'}
                        onClick={() => handleGerar('FUNCIONARIO')}
                        className="min-h-[44px] px-4 rounded-xl bg-teal-700 text-white text-sm font-medium hover:bg-teal-800 disabled:opacity-40"
                        title="Requer ciclo ANO_CIVIL e período seleccionado"
                    >
                        Gerar fichas funcionários
                    </button>
                </div>

                {msg && (
                    <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{msg}</p>
                )}
                {err && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>
                )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-800">
                        Fichas ({filtered.length})
                    </h2>
                </div>

                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500 text-left">
                            <tr>
                                <th className="px-4 py-3 font-medium">Avaliado</th>
                                <th className="px-4 py-3 font-medium">Tipo</th>
                                <th className="px-4 py-3 font-medium">Período</th>
                                <th className="px-4 py-3 font-medium">CF</th>
                                <th className="px-4 py-3 font-medium">Menção</th>
                                <th className="px-4 py-3 font-medium">Estado</th>
                                <th className="px-4 py-3 font-medium" />
                            </tr>
                        </thead>
                        <tbody>
                            {loadingAval && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                        A carregar…
                                    </td>
                                </tr>
                            )}
                            {!loadingAval && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                        Sem fichas. Crie um ciclo, escolha o período e gere as fichas.
                                    </td>
                                </tr>
                            )}
                            {filtered.map(a => {
                                const nome =
                                    a.avaliado_tipo === 'PROFESSOR'
                                        ? a.professor?.nome_completo
                                        : a.funcionario?.nome_completo
                                return (
                                    <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                                        <td className="px-4 py-3 font-medium text-slate-800">
                                            {nome || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {a.avaliado_tipo === 'PROFESSOR'
                                                ? 'Docente'
                                                : 'Funcionário'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {PERIODO_LABELS[a.periodo]}
                                        </td>
                                        <td className="px-4 py-3 tabular-nums">
                                            {a.classificacao_final != null
                                                ? a.classificacao_final.toFixed(2)
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3">{labelMencao(a.mencao)}</td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                                                {ESTADO_AVALIACAO_LABELS[a.estado]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => setFichaId(a.id)}
                                                className="text-blue-700 hover:underline font-medium min-h-[44px] px-2"
                                            >
                                                Abrir ficha
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="md:hidden divide-y divide-slate-100">
                    {!loadingAval && filtered.length === 0 && (
                        <p className="px-4 py-8 text-center text-slate-400 text-sm">
                            Sem fichas neste ciclo.
                        </p>
                    )}
                    {filtered.map(a => {
                        const nome =
                            a.avaliado_tipo === 'PROFESSOR'
                                ? a.professor?.nome_completo
                                : a.funcionario?.nome_completo
                        return (
                            <button
                                key={a.id}
                                type="button"
                                onClick={() => setFichaId(a.id)}
                                className="w-full text-left px-4 py-4 hover:bg-slate-50 active:bg-slate-100"
                            >
                                <p className="font-medium text-slate-900">{nome || '—'}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {a.avaliado_tipo === 'PROFESSOR' ? 'Docente' : 'Funcionário'} ·{' '}
                                    {PERIODO_LABELS[a.periodo]} · {ESTADO_AVALIACAO_LABELS[a.estado]}
                                </p>
                                <p className="text-sm text-slate-700 mt-1">
                                    CF:{' '}
                                    {a.classificacao_final != null
                                        ? a.classificacao_final.toFixed(2)
                                        : '—'}{' '}
                                    · {labelMencao(a.mencao)}
                                </p>
                            </button>
                        )
                    })}
                </div>
            </div>

            <FormModal
                isOpen={showNovoCiclo}
                onClose={() => !busy && setShowNovoCiclo(false)}
                title="Novo ciclo de avaliação"
                subtitle="Defina o período oficial em que as fichas serão lançadas"
                size="md"
                accent="blue"
                busy={busy}
                icon={<Icons.ClipboardList />}
            >
                <div className="flex flex-col">
                    <div className="px-5 py-4 space-y-5">
                        <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-slate-50 px-3.5 py-3">
                            <p className="text-xs font-medium text-blue-900 tracking-wide">
                                Decreto Presidencial n.º 28/22 · Art. 13.º
                            </p>
                            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                                Docentes e educadores avaliam-se no <strong>ano lectivo</strong>;
                                técnicos pedagógicos e administrativos no <strong>ano civil</strong>.
                            </p>
                        </div>

                        <div>
                            <label
                                htmlFor="ad-ciclo-ano"
                                className="block text-sm font-semibold text-slate-800 mb-1.5"
                            >
                                Ano de referência
                            </label>
                            <input
                                id="ad-ciclo-ano"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 min-h-[44px] shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition-shadow"
                                placeholder={
                                    tipoPeriodo === 'ANO_LECTIVO' ? 'Ex.: 2025/2026' : 'Ex.: 2026'
                                }
                                value={anoRef}
                                onChange={e => setAnoRef(e.target.value)}
                                disabled={busy}
                                autoFocus
                            />
                            <p className="mt-1.5 text-xs text-slate-500">
                                {tipoPeriodo === 'ANO_LECTIVO'
                                    ? 'Use o formato lectivo completo (ex.: 2025/2026).'
                                    : 'Use o ano civil correspondente (ex.: 2026).'}
                            </p>
                        </div>

                        <div>
                            <p className="block text-sm font-semibold text-slate-800 mb-2">
                                Tipo de período
                            </p>
                            <div className="grid grid-cols-1 gap-2.5" role="radiogroup" aria-label="Tipo de período">
                                {(
                                    [
                                        {
                                            value: 'ANO_LECTIVO' as TipoPeriodoCiclo,
                                            title: 'Ano lectivo',
                                            desc: 'Professores e educadores de infância',
                                            badge: 'Anexos II / III',
                                        },
                                        {
                                            value: 'ANO_CIVIL' as TipoPeriodoCiclo,
                                            title: 'Ano civil',
                                            desc: 'Técnicos e funcionários administrativos',
                                            badge: 'Anexo IV',
                                        },
                                    ] as const
                                ).map(opt => {
                                    const selected = tipoPeriodo === opt.value
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            role="radio"
                                            aria-checked={selected}
                                            disabled={busy}
                                            onClick={() => setTipoPeriodo(opt.value)}
                                            className={`
                                                text-left rounded-xl border px-3.5 py-3 min-h-[44px] transition-all
                                                ${selected
                                                    ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-500/20 shadow-sm'
                                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                                }
                                                disabled:opacity-50
                                            `}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span
                                                    className={`
                                                        mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                                                        ${selected ? 'border-blue-600' : 'border-slate-300'}
                                                    `}
                                                    aria-hidden
                                                >
                                                    {selected && (
                                                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                                                    )}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-center justify-between gap-2">
                                                        <span className="text-sm font-semibold text-slate-900">
                                                            {opt.title}
                                                        </span>
                                                        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                                            {opt.badge}
                                                        </span>
                                                    </span>
                                                    <span className="mt-0.5 block text-xs text-slate-500 leading-snug">
                                                        {opt.desc}
                                                    </span>
                                                </span>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {err && showNovoCiclo && (
                            <div
                                role="alert"
                                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
                            >
                                {err}
                            </div>
                        )}
                    </div>

                    <div className="flex-shrink-0 px-5 py-3.5 border-t border-slate-100 bg-slate-50/80 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => setShowNovoCiclo(false)}
                            className="min-h-[44px] px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            disabled={busy || !anoRef.trim()}
                            onClick={handleCreateCiclo}
                            className="min-h-[44px] px-5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm shadow-blue-600/20 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                        >
                            {busy ? (
                                <>
                                    <Icons.Spinner className="w-4 h-4" />
                                    A criar…
                                </>
                            ) : (
                                'Criar ciclo'
                            )}
                        </button>
                    </div>
                </div>
            </FormModal>

            <AvaliacaoFichaModal
                avaliacaoId={fichaId}
                escolaId={escolaId}
                onClose={() => setFichaId(null)}
                onSaved={() => void loadAvaliacoes()}
            />
        </div>
    )
}
