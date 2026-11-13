import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { fetchCiclos } from '../api/ciclos'
import { fetchMapaGeral } from '../api/avaliacoes'
import { labelMencao } from '../utils/classificacao'
import {
    ESTADO_AVALIACAO_LABELS,
    PERIODO_LABELS,
    TIPO_PERIODO_LABELS,
} from '../utils/indicadoresSeed'
import { exportMapaGeralExcel, exportMapaGeralPdf } from '../utils/exportMapa'
import { loadHeaderConfig } from '../../../utils/headerConfigUtils'
import type { AdCiclo, MapaGeralLinha } from '../types'

interface MapaGeralAvaliacaoPageProps {
    onNavigate?: (page: string) => void
}

export const MapaGeralAvaliacaoPage: React.FC<MapaGeralAvaliacaoPageProps> = ({ onNavigate }) => {
    const { escolaProfile } = useAuth()
    const escolaId = escolaProfile?.id
    const [ciclos, setCiclos] = useState<AdCiclo[]>([])
    const [cicloId, setCicloId] = useState('')
    const [linhas, setLinhas] = useState<MapaGeralLinha[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    const ciclo = useMemo(
        () => ciclos.find(c => c.id === cicloId) || ciclos[0],
        [ciclos, cicloId],
    )
    const effectiveId = cicloId || ciclo?.id

    useEffect(() => {
        if (!escolaId) return
        void (async () => {
            try {
                const data = await fetchCiclos(escolaId)
                setCiclos(data)
                if (data[0]) setCicloId(data[0].id)
            } catch (e: unknown) {
                setErr(e instanceof Error ? e.message : 'Erro ao carregar ciclos.')
            }
        })()
    }, [escolaId])

    const loadMapa = useCallback(async () => {
        if (!escolaId || !effectiveId) {
            setLinhas([])
            return
        }
        setIsLoading(true)
        setErr(null)
        try {
            setLinhas(await fetchMapaGeral(escolaId, effectiveId))
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : 'Erro ao carregar mapa.')
        } finally {
            setIsLoading(false)
        }
    }, [escolaId, effectiveId])

    useEffect(() => {
        void loadMapa()
    }, [loadMapa])

    const escolaNome = escolaProfile?.nome || 'Escola'
    const anoRef = ciclo?.ano_referencia || ''

    if (!escolaId) {
        return <div className="p-6 text-sm text-slate-600">Perfil de escola não disponível.</div>
    }

    return (
        <div className="space-y-6 pb-24 md:pb-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <button
                        type="button"
                        onClick={() => onNavigate?.('avaliacao-desempenho')}
                        className="text-sm text-blue-700 hover:underline mb-2"
                    >
                        ← Voltar às fichas
                    </button>
                    <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
                        Mapa Geral de Avaliação
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                        Decreto Presidencial n.º 28/22 — Art. 32.º. Lista alfabética das
                        classificações do ciclo (preferência pela ficha anual).
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        disabled={!linhas.length}
                        onClick={() => {
                            void (async () => {
                                try {
                                    const headerConfig = await loadHeaderConfig(escolaId)
                                    await exportMapaGeralPdf(linhas, {
                                        escolaNome:
                                            headerConfig?.nome_escola || escolaNome,
                                        anoReferencia: anoRef,
                                        provincia:
                                            headerConfig?.provincia ||
                                            escolaProfile?.provincia,
                                        municipio:
                                            headerConfig?.municipio ||
                                            escolaProfile?.municipio,
                                        headerConfig,
                                    })
                                } catch (e: unknown) {
                                    setErr(
                                        e instanceof Error
                                            ? e.message
                                            : 'Erro ao exportar o PDF do mapa.',
                                    )
                                }
                            })()
                        }}
                        className="min-h-[44px] px-4 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
                    >
                        Exportar PDF
                    </button>
                    <button
                        type="button"
                        disabled={!linhas.length}
                        onClick={() =>
                            exportMapaGeralExcel(linhas, {
                                escolaNome,
                                anoReferencia: anoRef,
                            })
                        }
                        className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
                    >
                        Exportar Excel
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <label className="block text-xs font-medium text-slate-500 mb-1">Ciclo</label>
                <select
                    className="w-full md:max-w-md rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[44px]"
                    value={effectiveId || ''}
                    onChange={e => setCicloId(e.target.value)}
                >
                    {ciclos.length === 0 && <option value="">Sem ciclos</option>}
                    {ciclos.map(c => (
                        <option key={c.id} value={c.id}>
                            {c.ano_referencia} — {TIPO_PERIODO_LABELS[c.tipo_periodo]}
                        </option>
                    ))}
                </select>
                {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500 text-left">
                            <tr>
                                <th className="px-4 py-3 font-medium">N.º</th>
                                <th className="px-4 py-3 font-medium">Nome</th>
                                <th className="px-4 py-3 font-medium">Categoria</th>
                                <th className="px-4 py-3 font-medium">Período</th>
                                <th className="px-4 py-3 font-medium">Classificação</th>
                                <th className="px-4 py-3 font-medium">Menção</th>
                                <th className="px-4 py-3 font-medium">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                        A carregar…
                                    </td>
                                </tr>
                            )}
                            {!isLoading && linhas.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                        Sem avaliações neste ciclo.
                                    </td>
                                </tr>
                            )}
                            {linhas.map((l, i) => (
                                <tr key={`${l.nome}-${i}`} className="border-t border-slate-100">
                                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                                    <td className="px-4 py-3 font-medium text-slate-800">{l.nome}</td>
                                    <td className="px-4 py-3 text-slate-600">{l.categoria}</td>
                                    <td className="px-4 py-3">{PERIODO_LABELS[l.periodo]}</td>
                                    <td className="px-4 py-3 tabular-nums">
                                        {l.classificacao_final != null
                                            ? l.classificacao_final.toFixed(2)
                                            : '—'}
                                    </td>
                                    <td className="px-4 py-3">{labelMencao(l.mencao)}</td>
                                    <td className="px-4 py-3">
                                        {ESTADO_AVALIACAO_LABELS[l.estado]}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="md:hidden divide-y divide-slate-100">
                    {!isLoading && linhas.length === 0 && (
                        <p className="px-4 py-8 text-center text-slate-400 text-sm">
                            Sem avaliações neste ciclo.
                        </p>
                    )}
                    {linhas.map((l, i) => (
                        <div key={`${l.nome}-m-${i}`} className="px-4 py-4">
                            <p className="font-medium text-slate-900">
                                {i + 1}. {l.nome}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">{l.categoria}</p>
                            <p className="text-sm text-slate-700 mt-1">
                                {PERIODO_LABELS[l.periodo]} · CF{' '}
                                {l.classificacao_final != null
                                    ? l.classificacao_final.toFixed(2)
                                    : '—'}{' '}
                                · {labelMencao(l.mencao)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
