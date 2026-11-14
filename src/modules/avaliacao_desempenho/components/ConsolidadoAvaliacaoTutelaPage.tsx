import React, { useMemo, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { Icons } from '../../../components/ui/Icons'
import {
    DmPage,
    DmHeader,
    DmContent,
    DmStatCard,
    DmEmpty,
} from '../../municipal_education/components/MunicipalChrome'
import {
    DpPage,
    DpHeader,
    DpContent,
    DpStatCard,
    DpEmpty,
} from '../../provincial_education/components/ProvincialChrome'
import { useConsolidadoTutela } from '../hooks/useConsolidadoTutela'
import { labelMencao, MENCAO_LABELS } from '../utils/classificacao'
import {
    ESTADO_AVALIACAO_LABELS,
    PERIODO_LABELS,
} from '../utils/indicadoresSeed'
import {
    exportConsolidadoAvaliacaoExcel,
    exportConsolidadoAvaliacaoPdf,
    type ConsolidadoExportMeta,
} from '../utils/exportConsolidado'
import { exportMapaGeralPdf, exportMapaGeralExcel } from '../utils/exportMapa'
import type {
    EscolaAvaliacaoResumo,
    MapaGeralLinha,
    MencaoClassificacao,
    MunicipioAvaliacaoResumo,
} from '../types'

export interface ConsolidadoAvaliacaoTutelaPageProps {
    variant: 'municipal' | 'provincial'
}

type FiltroEstado = 'todas' | 'com_ciclo' | 'pendentes' | 'concluidas'
type SortKey =
    | 'escola_nome'
    | 'municipio'
    | 'pct_conclusao'
    | 'media_classificacao'
    | 'total_fichas'
    | 'concluidas'

function pctTone(pct: number): string {
    if (pct >= 80) return 'text-emerald-700 bg-emerald-50'
    if (pct >= 40) return 'text-amber-700 bg-amber-50'
    if (pct > 0) return 'text-rose-700 bg-rose-50'
    return 'text-slate-500 bg-slate-100'
}

function ProgressBar({ value }: { value: number }) {
    const width = Math.max(0, Math.min(100, value))
    const bar =
        width >= 80
            ? 'bg-emerald-500'
            : width >= 40
              ? 'bg-amber-500'
              : width > 0
                ? 'bg-rose-500'
                : 'bg-slate-300'
    return (
        <div className="w-full min-w-[72px] h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-500 ${bar}`}
                style={{ width: `${width}%` }}
            />
        </div>
    )
}

export const ConsolidadoAvaliacaoTutelaPage: React.FC<
    ConsolidadoAvaliacaoTutelaPageProps
> = ({ variant }) => {
    const {
        profile,
        direcaoMunicipalProfile,
        direcaoProvincialProfile,
        pessoalDirecaoMunicipalProfile,
        pessoalDirecaoProvincialProfile,
    } = useAuth()

    const municipio =
        variant === 'municipal'
            ? direcaoMunicipalProfile?.municipio ||
              pessoalDirecaoMunicipalProfile?.direcao_municipal?.municipio ||
              profile?.municipio ||
              null
            : null

    const provincia =
        variant === 'provincial'
            ? direcaoProvincialProfile?.provincia ||
              pessoalDirecaoProvincialProfile?.direcao_provincial?.provincia ||
              profile?.provincia ||
              null
            : direcaoMunicipalProfile?.provincia ||
              pessoalDirecaoMunicipalProfile?.direcao_municipal?.provincia ||
              profile?.provincia ||
              null

    const orgaoNome =
        variant === 'municipal'
            ? direcaoMunicipalProfile?.nome ||
              `Direção Municipal de Educação de ${municipio || '…'}`
            : direcaoProvincialProfile?.nome ||
              `Direção Provincial da Educação — ${provincia || '…'}`

    const {
        anoReferencia,
        setAnoReferencia,
        data,
        loading,
        error,
        mapaEscolaId,
        mapaLinhas,
        mapaLoading,
        openMapaEscola,
        closeMapa,
    } = useConsolidadoTutela({
        municipio: variant === 'municipal' ? municipio : null,
        provincia: variant === 'provincial' ? provincia : null,
        enabled: Boolean(
            variant === 'municipal' ? municipio : provincia,
        ),
    })

    const [search, setSearch] = useState('')
    const [filtro, setFiltro] = useState<FiltroEstado>('todas')
    const [mencaoFiltro, setMencaoFiltro] = useState<MencaoClassificacao | null>(
        null,
    )
    const [sortKey, setSortKey] = useState<SortKey>('escola_nome')
    const [sortAsc, setSortAsc] = useState(true)
    const [exporting, setExporting] = useState<'pdf' | 'excel' | 'mapa' | null>(
        null,
    )
    const [exportErr, setExportErr] = useState<string | null>(null)

    const escolaMapa = useMemo(
        () => data?.por_escola.find(e => e.escola_id === mapaEscolaId) || null,
        [data, mapaEscolaId],
    )

    const territorioLabel =
        variant === 'municipal'
            ? municipio || 'Município'
            : provincia || 'Província'

    const exportMeta: ConsolidadoExportMeta = {
        titulo:
            variant === 'municipal'
                ? `Direção Municipal — ${territorioLabel}`
                : `Direção Provincial — ${territorioLabel}`,
        orgaoNome,
        provincia,
        municipio: variant === 'municipal' ? municipio : null,
        corCabecalho: '#4c1d95',
    }

    const escolasFiltradas = useMemo(() => {
        if (!data) return []
        let rows = [...data.por_escola]

        if (search.trim()) {
            const q = search.trim().toLowerCase()
            rows = rows.filter(
                e =>
                    e.escola_nome.toLowerCase().includes(q) ||
                    e.municipio.toLowerCase().includes(q),
            )
        }

        if (filtro === 'com_ciclo') rows = rows.filter(e => e.ciclo_id)
        if (filtro === 'pendentes') rows = rows.filter(e => e.pendentes > 0)
        if (filtro === 'concluidas') {
            rows = rows.filter(
                e => e.total_fichas > 0 && e.pendentes === 0,
            )
        }

        if (mencaoFiltro) {
            rows = rows.filter(e => e.mencoes[mencaoFiltro] > 0)
        }

        rows.sort((a, b) => {
            const av = a[sortKey]
            const bv = b[sortKey]
            let cmp = 0
            if (typeof av === 'string' && typeof bv === 'string') {
                cmp = av.localeCompare(bv, 'pt')
            } else {
                cmp = Number(av ?? -1) - Number(bv ?? -1)
            }
            return sortAsc ? cmp : -cmp
        })

        return rows
    }, [data, search, filtro, mencaoFiltro, sortKey, sortAsc])

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortAsc(v => !v)
        else {
            setSortKey(key)
            setSortAsc(key === 'escola_nome' || key === 'municipio')
        }
    }

    const handleExportPdf = async () => {
        if (!data) return
        setExporting('pdf')
        setExportErr(null)
        try {
            await exportConsolidadoAvaliacaoPdf(data, exportMeta)
        } catch (e: unknown) {
            setExportErr(
                e instanceof Error ? e.message : 'Erro ao exportar PDF.',
            )
        } finally {
            setExporting(null)
        }
    }

    const handleExportExcel = () => {
        if (!data) return
        setExporting('excel')
        setExportErr(null)
        try {
            exportConsolidadoAvaliacaoExcel(data, exportMeta)
        } catch (e: unknown) {
            setExportErr(
                e instanceof Error ? e.message : 'Erro ao exportar Excel.',
            )
        } finally {
            setExporting(null)
        }
    }

    const handleExportMapaPdf = async () => {
        if (!escolaMapa || !mapaLinhas.length) return
        setExporting('mapa')
        setExportErr(null)
        try {
            await exportMapaGeralPdf(mapaLinhas, {
                escolaNome: escolaMapa.escola_nome,
                anoReferencia:
                    escolaMapa.ano_referencia || anoReferencia || '',
                provincia: escolaMapa.provincia || provincia,
                municipio: escolaMapa.municipio,
                headerConfig: {
                    nome_escola: escolaMapa.escola_nome,
                    mostrar_republica: true,
                    texto_republica: 'REPÚBLICA DE ANGOLA',
                    mostrar_governo_provincial: true,
                    provincia: escolaMapa.provincia || provincia || undefined,
                    mostrar_orgao_educacao: false,
                    municipio: escolaMapa.municipio,
                    cor_cabecalho_mapa: '#4c1d95',
                },
            })
        } catch (e: unknown) {
            setExportErr(
                e instanceof Error
                    ? e.message
                    : 'Erro ao exportar o mapa PDF.',
            )
        } finally {
            setExporting(null)
        }
    }

    const Page = variant === 'municipal' ? DmPage : DpPage
    const Header = variant === 'municipal' ? DmHeader : DpHeader
    const Content = variant === 'municipal' ? DmContent : DpContent
    const StatCard = variant === 'municipal' ? DmStatCard : DpStatCard
    const Empty = variant === 'municipal' ? DmEmpty : DpEmpty

    const territorioOk =
        variant === 'municipal' ? Boolean(municipio) : Boolean(provincia)

    if (!territorioOk) {
        return (
            <Page className="pb-24 md:pb-0">
                <Content>
                    <Empty
                        title="Território não identificado"
                        description="Não foi possível determinar o município ou a província do perfil."
                    />
                </Content>
            </Page>
        )
    }

    const filtros: Array<{ id: FiltroEstado; label: string }> = [
        { id: 'todas', label: 'Todas' },
        { id: 'com_ciclo', label: 'Com ciclo' },
        { id: 'pendentes', label: 'Com pendências' },
        { id: 'concluidas', label: '100% concluídas' },
    ]

    return (
        <Page className="pb-24 md:pb-0">
            <Header
                title="Avaliação RH — Consolidado"
                subtitle={
                    variant === 'municipal'
                        ? `Mapas gerais das escolas de ${territorioLabel} (DP 28/22, Art. 32.º)`
                        : `Consolidado provincial por município e escola — ${territorioLabel}`
                }
                icon={<Icons.ClipboardList className="w-6 h-6" />}
                accent="violet"
                actions={
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={!data || exporting !== null}
                            onClick={() => void handleExportPdf()}
                            className="min-h-[44px] px-4 rounded-xl bg-white text-violet-900 text-sm font-semibold shadow-sm hover:bg-violet-50 disabled:opacity-40 inline-flex items-center gap-2"
                        >
                            <Icons.DocumentText className="w-4 h-4" />
                            {exporting === 'pdf' ? 'A gerar…' : 'Exportar PDF'}
                        </button>
                        <button
                            type="button"
                            disabled={!data || exporting !== null}
                            onClick={handleExportExcel}
                            className="min-h-[44px] px-4 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-medium border border-white/20 disabled:opacity-40 inline-flex items-center gap-2"
                        >
                            <Icons.Download className="w-4 h-4" />
                            {exporting === 'excel' ? 'A gerar…' : 'Excel'}
                        </button>
                    </div>
                }
            />

            <Content>
                <div className="rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-sm p-4 shadow-sm space-y-3">
                    <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
                        <div className="flex-1 max-w-xs">
                            <label className="block text-xs font-medium text-slate-500 mb-1">
                                Ano de referência
                            </label>
                            <select
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm min-h-[44px]"
                                value={anoReferencia}
                                onChange={e => setAnoReferencia(e.target.value)}
                            >
                                {(data?.anos_disponiveis?.length
                                    ? data.anos_disponiveis
                                    : anoReferencia
                                      ? [anoReferencia]
                                      : []
                                ).map(a => (
                                    <option key={a} value={a}>
                                        {a}
                                    </option>
                                ))}
                                {!data?.anos_disponiveis?.length &&
                                    !anoReferencia && (
                                        <option value="">
                                            Sem ciclos nas escolas
                                        </option>
                                    )}
                            </select>
                        </div>

                        <div className="flex-1">
                            <label className="block text-xs font-medium text-slate-500 mb-1">
                                Pesquisar escola
                            </label>
                            <div className="relative">
                                <Icons.Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Nome da escola ou município…"
                                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm min-h-[44px]"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {filtros.map(f => (
                            <button
                                key={f.id}
                                type="button"
                                onClick={() => setFiltro(f.id)}
                                className={`min-h-[36px] px-3 rounded-full text-xs font-semibold border transition ${
                                    filtro === f.id
                                        ? 'bg-violet-600 text-white border-violet-600'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <p className="text-xs text-slate-500">
                        Consolidado automático — só leitura. Clique numa escola
                        para abrir o mapa geral (Art. 32.º).
                    </p>
                </div>

                {(error || exportErr) && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error || exportErr}
                    </div>
                )}

                {loading && !data && (
                    <div className="flex flex-col items-center justify-center gap-3 py-16">
                        <Icons.Spinner className="w-8 h-8 text-violet-600" />
                        <p className="text-sm font-medium text-slate-500">
                            A carregar consolidado…
                        </p>
                    </div>
                )}

                {data && (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                            <StatCard
                                title="Escolas"
                                value={data.total_escolas}
                                icon={<Icons.School className="w-5 h-5" />}
                                iconTone="from-blue-50 to-blue-100 text-blue-600"
                            />
                            <StatCard
                                title="Com ciclo"
                                value={data.escolas_com_ciclo}
                                icon={
                                    <Icons.ClipboardList className="w-5 h-5" />
                                }
                                iconTone="from-violet-50 to-violet-100 text-violet-600"
                            />
                            <StatCard
                                title="% conclusão"
                                value={`${data.pct_conclusao}%`}
                                icon={<Icons.TrendingUp className="w-5 h-5" />}
                                iconTone="from-emerald-50 to-emerald-100 text-emerald-600"
                            />
                            <StatCard
                                title="Média CF"
                                value={
                                    data.media_classificacao != null
                                        ? data.media_classificacao.toFixed(2)
                                        : '—'
                                }
                                icon={
                                    <Icons.AcademicCap className="w-5 h-5" />
                                }
                                iconTone="from-amber-50 to-amber-100 text-amber-600"
                            />
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <p className="text-xs font-medium text-slate-500 mb-2">
                                Menções — clique para filtrar
                            </p>
                            <div className="flex flex-wrap gap-2 text-sm">
                                {(
                                    Object.keys(MENCAO_LABELS) as MencaoClassificacao[]
                                ).map(k => {
                                    const active = mencaoFiltro === k
                                    return (
                                        <button
                                            key={k}
                                            type="button"
                                            onClick={() =>
                                                setMencaoFiltro(
                                                    active ? null : k,
                                                )
                                            }
                                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border transition ${
                                                active
                                                    ? 'bg-violet-600 text-white border-violet-600'
                                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-violet-300'
                                            }`}
                                        >
                                            {MENCAO_LABELS[k]}
                                            <strong className="tabular-nums">
                                                {data.mencoes[k]}
                                            </strong>
                                        </button>
                                    )
                                })}
                                {mencaoFiltro && (
                                    <button
                                        type="button"
                                        onClick={() => setMencaoFiltro(null)}
                                        className="text-xs text-violet-700 underline px-2"
                                    >
                                        Limpar filtro
                                    </button>
                                )}
                            </div>
                        </div>

                        {variant === 'provincial' && data.por_municipio && (
                            <MunicipiosTable rows={data.por_municipio} />
                        )}

                        <EscolasTable
                            rows={escolasFiltradas}
                            showMunicipio={variant === 'provincial'}
                            onOpenMapa={openMapaEscola}
                            activeId={mapaEscolaId}
                            sortKey={sortKey}
                            sortAsc={sortAsc}
                            onSort={toggleSort}
                            totalOriginal={data.por_escola.length}
                        />

                        {mapaEscolaId && (
                            <MapaDrilldown
                                escola={escolaMapa}
                                linhas={mapaLinhas}
                                loading={mapaLoading}
                                exporting={exporting === 'mapa'}
                                onClose={closeMapa}
                                onExportPdf={() => void handleExportMapaPdf()}
                                onExportExcel={() => {
                                    if (!escolaMapa) return
                                    exportMapaGeralExcel(mapaLinhas, {
                                        escolaNome: escolaMapa.escola_nome,
                                        anoReferencia:
                                            escolaMapa.ano_referencia ||
                                            anoReferencia ||
                                            '',
                                    })
                                }}
                            />
                        )}
                    </>
                )}

                {!loading && data && data.total_escolas === 0 && (
                    <Empty
                        title="Sem escolas no território"
                        description="Não há escolas registadas para este município/província."
                    />
                )}
            </Content>
        </Page>
    )
}

function SortTh({
    label,
    active,
    asc,
    onClick,
    className = '',
}: {
    label: string
    active: boolean
    asc: boolean
    onClick: () => void
    className?: string
}) {
    return (
        <th className={`px-3 py-3 font-semibold ${className}`}>
            <button
                type="button"
                onClick={onClick}
                className="inline-flex items-center gap-1 hover:text-white/90"
            >
                {label}
                <span className="text-[10px] opacity-80">
                    {active ? (asc ? '▲' : '▼') : '↕'}
                </span>
            </button>
        </th>
    )
}

function MunicipiosTable({ rows }: { rows: MunicipioAvaliacaoResumo[] }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">
                    Quadro por município
                </h2>
                <span className="text-xs text-slate-400">{rows.length} municípios</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-violet-800 text-white text-left">
                            <th className="px-3 py-3 font-semibold">Município</th>
                            <th className="px-3 py-3 font-semibold text-center">
                                Escolas
                            </th>
                            <th className="px-3 py-3 font-semibold text-center">
                                Com ciclo
                            </th>
                            <th className="px-3 py-3 font-semibold text-center">
                                Fichas
                            </th>
                            <th className="px-3 py-3 font-semibold text-center">
                                % concl.
                            </th>
                            <th className="px-3 py-3 font-semibold text-center">
                                Média CF
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((m, i) => (
                            <tr
                                key={m.municipio}
                                className={`border-b border-slate-100 ${
                                    i % 2 ? 'bg-slate-50/80' : 'bg-white'
                                }`}
                            >
                                <td className="px-3 py-2.5 font-medium text-slate-800">
                                    {m.municipio}
                                </td>
                                <td className="px-3 py-2.5 text-center tabular-nums">
                                    {m.total_escolas}
                                </td>
                                <td className="px-3 py-2.5 text-center tabular-nums">
                                    {m.escolas_com_ciclo}
                                </td>
                                <td className="px-3 py-2.5 text-center tabular-nums">
                                    {m.total_fichas}
                                </td>
                                <td className="px-3 py-2.5">
                                    <div className="flex items-center gap-2 justify-center">
                                        <ProgressBar value={m.pct_conclusao} />
                                        <span
                                            className={`text-xs font-semibold px-1.5 py-0.5 rounded tabular-nums ${pctTone(m.pct_conclusao)}`}
                                        >
                                            {m.pct_conclusao}%
                                        </span>
                                    </div>
                                </td>
                                <td className="px-3 py-2.5 text-center tabular-nums font-medium">
                                    {m.media_classificacao != null
                                        ? m.media_classificacao.toFixed(2)
                                        : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function EscolasTable({
    rows,
    showMunicipio,
    onOpenMapa,
    activeId,
    sortKey,
    sortAsc,
    onSort,
    totalOriginal,
}: {
    rows: EscolaAvaliacaoResumo[]
    showMunicipio: boolean
    onOpenMapa: (escolaId: string, cicloId: string | null) => void
    activeId: string | null
    sortKey: SortKey
    sortAsc: boolean
    onSort: (key: SortKey) => void
    totalOriginal: number
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                <div>
                    <h2 className="text-sm font-semibold text-slate-800">
                        Quadro por escola
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        A mostrar {rows.length} de {totalOriginal} · clique para
                        o mapa
                    </p>
                </div>
            </div>

            <div className="hidden md:block overflow-x-auto max-h-[520px] overflow-y-auto">
                <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-violet-800 text-white text-left shadow-sm">
                            <th className="px-3 py-3 font-semibold w-10">N.º</th>
                            <SortTh
                                label="Escola"
                                active={sortKey === 'escola_nome'}
                                asc={sortAsc}
                                onClick={() => onSort('escola_nome')}
                            />
                            {showMunicipio && (
                                <SortTh
                                    label="Município"
                                    active={sortKey === 'municipio'}
                                    asc={sortAsc}
                                    onClick={() => onSort('municipio')}
                                />
                            )}
                            <th className="px-3 py-3 font-semibold">Ciclo</th>
                            <SortTh
                                label="Fichas"
                                active={sortKey === 'total_fichas'}
                                asc={sortAsc}
                                onClick={() => onSort('total_fichas')}
                                className="text-center"
                            />
                            <SortTh
                                label="Concl."
                                active={sortKey === 'concluidas'}
                                asc={sortAsc}
                                onClick={() => onSort('concluidas')}
                                className="text-center"
                            />
                            <SortTh
                                label="% conclusão"
                                active={sortKey === 'pct_conclusao'}
                                asc={sortAsc}
                                onClick={() => onSort('pct_conclusao')}
                            />
                            <SortTh
                                label="Média CF"
                                active={sortKey === 'media_classificacao'}
                                asc={sortAsc}
                                onClick={() => onSort('media_classificacao')}
                                className="text-center"
                            />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr>
                                <td
                                    colSpan={showMunicipio ? 8 : 7}
                                    className="px-4 py-10 text-center text-slate-400"
                                >
                                    Nenhuma escola corresponde aos filtros.
                                </td>
                            </tr>
                        )}
                        {rows.map((e, i) => (
                            <tr
                                key={e.escola_id}
                                className={`border-b border-slate-100 cursor-pointer transition-colors ${
                                    activeId === e.escola_id
                                        ? 'bg-violet-100/80 ring-1 ring-inset ring-violet-300'
                                        : i % 2
                                          ? 'bg-slate-50/70 hover:bg-violet-50/70'
                                          : 'bg-white hover:bg-violet-50/70'
                                }`}
                                onClick={() =>
                                    onOpenMapa(e.escola_id, e.ciclo_id)
                                }
                            >
                                <td className="px-3 py-2.5 text-slate-400 tabular-nums">
                                    {i + 1}
                                </td>
                                <td className="px-3 py-2.5 font-medium text-slate-800">
                                    {e.escola_nome}
                                </td>
                                {showMunicipio && (
                                    <td className="px-3 py-2.5 text-slate-600">
                                        {e.municipio}
                                    </td>
                                )}
                                <td className="px-3 py-2.5 text-slate-600">
                                    {e.ciclo_id ? (
                                        <span className="inline-flex items-center gap-1.5">
                                            <span
                                                className={`w-1.5 h-1.5 rounded-full ${
                                                    e.ciclo_estado === 'ABERTO'
                                                        ? 'bg-emerald-500'
                                                        : 'bg-slate-400'
                                                }`}
                                            />
                                            {e.ano_referencia} ·{' '}
                                            {e.ciclo_estado}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400">
                                            Sem ciclo
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-2.5 text-center tabular-nums">
                                    {e.total_fichas}
                                </td>
                                <td className="px-3 py-2.5 text-center tabular-nums">
                                    {e.concluidas}
                                </td>
                                <td className="px-3 py-2.5 min-w-[140px]">
                                    <div className="flex items-center gap-2">
                                        <ProgressBar value={e.pct_conclusao} />
                                        <span
                                            className={`text-xs font-semibold px-1.5 py-0.5 rounded tabular-nums shrink-0 ${pctTone(e.pct_conclusao)}`}
                                        >
                                            {e.pct_conclusao}%
                                        </span>
                                    </div>
                                </td>
                                <td className="px-3 py-2.5 text-center tabular-nums font-semibold text-slate-800">
                                    {e.media_classificacao != null
                                        ? e.media_classificacao.toFixed(2)
                                        : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="md:hidden divide-y divide-slate-100">
                {rows.map(e => (
                    <button
                        key={e.escola_id}
                        type="button"
                        className={`w-full text-left px-4 py-4 transition ${
                            activeId === e.escola_id
                                ? 'bg-violet-50'
                                : 'hover:bg-slate-50'
                        }`}
                        onClick={() => onOpenMapa(e.escola_id, e.ciclo_id)}
                    >
                        <p className="font-medium text-slate-900">
                            {e.escola_nome}
                        </p>
                        {showMunicipio && (
                            <p className="text-xs text-slate-500 mt-0.5">
                                {e.municipio}
                            </p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                            <ProgressBar value={e.pct_conclusao} />
                            <span className="text-xs font-semibold tabular-nums text-slate-600">
                                {e.pct_conclusao}%
                            </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">
                            {e.ciclo_id ? e.ano_referencia : 'Sem ciclo'} · CF{' '}
                            {e.media_classificacao != null
                                ? e.media_classificacao.toFixed(2)
                                : '—'}
                        </p>
                    </button>
                ))}
            </div>
        </div>
    )
}

function MapaDrilldown({
    escola,
    linhas,
    loading,
    exporting,
    onClose,
    onExportPdf,
    onExportExcel,
}: {
    escola: EscolaAvaliacaoResumo | null
    linhas: MapaGeralLinha[]
    loading: boolean
    exporting: boolean
    onClose: () => void
    onExportPdf: () => void
    onExportExcel: () => void
}) {
    return (
        <div className="rounded-2xl border border-violet-200 bg-white overflow-hidden shadow-md animate-fade-in">
            <div className="px-4 py-3 border-b border-violet-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-violet-50 to-white">
                <div>
                    <h2 className="text-sm font-semibold text-slate-800">
                        Mapa geral — {escola?.escola_nome || 'Escola'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Art. 32.º · consulta · {linhas.length} agentes
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        disabled={!linhas.length || exporting}
                        onClick={onExportPdf}
                        className="min-h-[40px] px-3 rounded-xl bg-violet-700 text-white text-xs font-semibold hover:bg-violet-800 disabled:opacity-40 inline-flex items-center gap-1.5"
                    >
                        <Icons.DocumentText className="w-3.5 h-3.5" />
                        {exporting ? 'PDF…' : 'PDF mapa'}
                    </button>
                    <button
                        type="button"
                        disabled={!linhas.length}
                        onClick={onExportExcel}
                        className="min-h-[40px] px-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                    >
                        Excel mapa
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="min-h-[40px] px-3 rounded-xl text-sm text-slate-600 hover:bg-slate-100"
                    >
                        Fechar
                    </button>
                </div>
            </div>

            {loading && (
                <p className="px-4 py-8 text-center text-slate-400 text-sm">
                    A carregar mapa…
                </p>
            )}

            {!loading && !escola?.ciclo_id && (
                <p className="px-4 py-8 text-center text-slate-400 text-sm">
                    Esta escola ainda não tem ciclo de avaliação no ano
                    seleccionado.
                </p>
            )}

            {!loading && escola?.ciclo_id && (
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-violet-800 text-white text-left">
                                <th className="px-3 py-2.5 font-semibold">N.º</th>
                                <th className="px-3 py-2.5 font-semibold">Nome</th>
                                <th className="px-3 py-2.5 font-semibold">
                                    Categoria
                                </th>
                                <th className="px-3 py-2.5 font-semibold">
                                    Período
                                </th>
                                <th className="px-3 py-2.5 font-semibold text-center">
                                    CF
                                </th>
                                <th className="px-3 py-2.5 font-semibold">
                                    Menção
                                </th>
                                <th className="px-3 py-2.5 font-semibold">
                                    Estado
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {linhas.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-4 py-8 text-center text-slate-400"
                                    >
                                        Sem avaliações neste ciclo.
                                    </td>
                                </tr>
                            )}
                            {linhas.map((l, i) => (
                                <tr
                                    key={`${l.nome}-${i}`}
                                    className={`border-b border-slate-100 ${
                                        i % 2 ? 'bg-slate-50/80' : 'bg-white'
                                    }`}
                                >
                                    <td className="px-3 py-2 text-slate-500">
                                        {i + 1}
                                    </td>
                                    <td className="px-3 py-2 font-medium text-slate-800">
                                        {l.nome}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">
                                        {l.categoria}
                                    </td>
                                    <td className="px-3 py-2">
                                        {PERIODO_LABELS[l.periodo]}
                                    </td>
                                    <td className="px-3 py-2 text-center tabular-nums font-semibold">
                                        {l.classificacao_final != null
                                            ? l.classificacao_final.toFixed(2)
                                            : '—'}
                                    </td>
                                    <td className="px-3 py-2">
                                        {labelMencao(l.mencao)}
                                    </td>
                                    <td className="px-3 py-2">
                                        <span
                                            className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${
                                                l.estado === 'CONCLUIDA' ||
                                                l.estado === 'ASSINADA'
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : l.estado === 'RASCUNHO'
                                                      ? 'bg-slate-100 text-slate-600'
                                                      : 'bg-amber-50 text-amber-700'
                                            }`}
                                        >
                                            {ESTADO_AVALIACAO_LABELS[l.estado]}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

export default ConsolidadoAvaliacaoTutelaPage
