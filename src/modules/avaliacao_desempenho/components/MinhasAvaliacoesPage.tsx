import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { fetchMinhasAvaliacoesProfessor } from '../api/minhasAvaliacoes'
import { AvaliacaoFichaModal } from './AvaliacaoFichaModal'
import { labelMencao } from '../utils/classificacao'
import { ESTADO_AVALIACAO_LABELS, PERIODO_LABELS } from '../utils/indicadoresSeed'
import type { AdAvaliacao } from '../types'

/**
 * Vista do professor (Art. 25.º): consultar fichas divulgadas e registar Concorda / Não concorda.
 */
export const MinhasAvaliacoesPage: React.FC = () => {
    const { professorProfile } = useAuth()
    const [avaliacoes, setAvaliacoes] = useState<AdAvaliacao[]>([])
    const [loading, setLoading] = useState(true)
    const [err, setErr] = useState<string | null>(null)
    const [fichaId, setFichaId] = useState<string | null>(null)

    const load = useCallback(async () => {
        if (!professorProfile?.id) {
            setAvaliacoes([])
            setLoading(false)
            return
        }
        setLoading(true)
        setErr(null)
        try {
            const data = await fetchMinhasAvaliacoesProfessor(professorProfile.id)
            setAvaliacoes(data)
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : 'Erro ao carregar as suas avaliações.')
        } finally {
            setLoading(false)
        }
    }, [professorProfile?.id])

    useEffect(() => {
        void load()
    }, [load])

    const podeAssinarFicha = (a: AdAvaliacao) =>
        a.concordancia_avaliado == null &&
        (a.estado === 'DIVULGADA' ||
            a.estado === 'EM_AVALIACAO' ||
            a.estado === 'CONCLUIDA')

    const pendentes = avaliacoes.filter(podeAssinarFicha)

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in">
            <div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">Minha avaliação</h2>
                <p className="text-sm md:text-base text-slate-600 mt-1">
                    Consulte as fichas de avaliação de desempenho e, após divulgação pela escola,
                    registe se concorda ou não (Art. 25.º do DP 28/22).
                </p>
            </div>

            {err && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {err}
                </div>
            )}

            {!professorProfile && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Perfil de professor não encontrado. Contacte a administração da escola.
                </div>
            )}

            {pendentes.length > 0 && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    Tem <strong>{pendentes.length}</strong> ficha(s) aguardando a sua
                    concordância. Abra a ficha e escolha Concorda ou Não concorda.
                </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="border-b border-slate-100 px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-800">As suas fichas</h3>
                </div>

                {loading ? (
                    <div className="p-6 space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="skeleton h-14 w-full rounded-lg" />
                        ))}
                    </div>
                ) : avaliacoes.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-slate-500">
                        Ainda não há fichas de avaliação associadas ao seu perfil.
                        <br />
                        Quando a escola divulgar a avaliação, aparece aqui.
                    </div>
                ) : (
                    <>
                        {/* Desktop */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Ano / ciclo</th>
                                        <th className="px-4 py-3 font-semibold">Período</th>
                                        <th className="px-4 py-3 font-semibold">Classificação</th>
                                        <th className="px-4 py-3 font-semibold">Menção</th>
                                        <th className="px-4 py-3 font-semibold">Estado</th>
                                        <th className="px-4 py-3 font-semibold">Concordância</th>
                                        <th className="px-4 py-3 font-semibold" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {avaliacoes.map(a => (
                                        <tr key={a.id} className="hover:bg-slate-50/80">
                                            <td className="px-4 py-3 text-slate-800">
                                                {a.ciclo?.ano_referencia || '—'}
                                            </td>
                                            <td className="px-4 py-3">{PERIODO_LABELS[a.periodo]}</td>
                                            <td className="px-4 py-3 font-semibold text-slate-900">
                                                {a.classificacao_final != null
                                                    ? a.classificacao_final.toFixed(1)
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-3">{labelMencao(a.mencao)}</td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                                    {ESTADO_AVALIACAO_LABELS[a.estado]}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {a.concordancia_avaliado === true ? (
                                                    <span className="text-emerald-700 text-xs font-medium">
                                                        Concorda
                                                    </span>
                                                ) : a.concordancia_avaliado === false ? (
                                                    <span className="text-amber-800 text-xs font-medium">
                                                        Não concorda
                                                    </span>
                                                ) : podeAssinarFicha(a) ? (
                                                    <span className="text-amber-700 text-xs font-medium">
                                                        Pendente
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => setFichaId(a.id)}
                                                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                                                >
                                                    {podeAssinarFicha(a)
                                                        ? 'Abrir e assinar'
                                                        : 'Ver ficha'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile */}
                        <ul className="md:hidden divide-y divide-slate-100">
                            {avaliacoes.map(a => (
                                <li key={a.id} className="p-4 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="font-semibold text-slate-900">
                                                {PERIODO_LABELS[a.periodo]}
                                                {a.ciclo?.ano_referencia
                                                    ? ` · ${a.ciclo.ano_referencia}`
                                                    : ''}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {ESTADO_AVALIACAO_LABELS[a.estado]}
                                                {a.classificacao_final != null
                                                    ? ` · CF ${a.classificacao_final.toFixed(1)}`
                                                    : ''}
                                                {a.mencao ? ` · ${labelMencao(a.mencao)}` : ''}
                                            </p>
                                        </div>
                                        {podeAssinarFicha(a) ? (
                                            <span className="shrink-0 text-[11px] font-semibold text-amber-700">
                                                Pendente
                                            </span>
                                        ) : null}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFichaId(a.id)}
                                        className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white"
                                    >
                                        {podeAssinarFicha(a) ? 'Abrir e assinar' : 'Ver ficha'}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>

            {fichaId && (
                <AvaliacaoFichaModal
                    avaliacaoId={fichaId}
                    escolaId={
                        avaliacoes.find(a => a.id === fichaId)?.escola_id ||
                        professorProfile?.escola_id ||
                        ''
                    }
                    onClose={() => {
                        setFichaId(null)
                        void load()
                    }}
                    onSaved={() => void load()}
                />
            )}
        </div>
    )
}
