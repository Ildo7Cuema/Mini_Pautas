/**
 * @component SuperAdminUsageStats
 * @description Observabilidade de utilização do sistema para SUPERADMIN
 * (professores, alunos, notas e acessos por escola)
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { fetchSuperAdminUsageStats } from '../utils/superadmin'
import type {
    EscolaUsoEstado,
    SuperAdminEscolaUso,
    SuperAdminUsageStats as SuperAdminUsageStatsData,
} from '../types'

type FiltroEstado = 'todos' | EscolaUsoEstado
type ChartMetric = 'notas' | 'acessos' | 'alunos' | 'professores'

const ESTADO_META: Record<
    EscolaUsoEstado,
    { label: string; color: string; bg: string; border: string }
> = {
    activo: {
        label: 'A usar',
        color: '#34d399',
        bg: 'rgba(16,185,129,0.15)',
        border: 'rgba(16,185,129,0.35)',
    },
    parcial: {
        label: 'Parcial',
        color: '#fbbf24',
        bg: 'rgba(245,158,11,0.15)',
        border: 'rgba(245,158,11,0.35)',
    },
    inactivo: {
        label: 'Sem uso',
        color: '#f87171',
        bg: 'rgba(239,68,68,0.15)',
        border: 'rgba(239,68,68,0.35)',
    },
}

function formatRelative(dateString?: string | null): string {
    if (!dateString) return '—'
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return '—'
    const diff = Date.now() - date.getTime()
    if (diff < 3600000) {
        const minutes = Math.max(1, Math.floor(diff / 60000))
        return `Há ${minutes} min`
    }
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000)
        return `Há ${hours}h`
    }
    if (diff < 7 * 86400000) {
        const days = Math.floor(diff / 86400000)
        return `Há ${days}d`
    }
    return date.toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' })
}

function formatDayLabel(isoDay: string): string {
    const d = new Date(isoDay)
    if (Number.isNaN(d.getTime())) return isoDay
    return d.toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' })
}

const UsageStatCard: React.FC<{
    icon: string
    title: string
    value: number | string
    subtitle?: string
    gradient: string
    delay?: number
}> = ({ icon, title, value, subtitle, gradient, delay = 0 }) => (
    <div
        className="rounded-3xl p-4 relative overflow-hidden animate-slide-up"
        style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            animationDelay: `${delay}ms`,
        }}
    >
        <div
            className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-30"
            style={{ background: gradient, filter: 'blur(28px)' }}
        />
        <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: gradient }}
        >
            <span className="text-lg">{icon}</span>
        </div>
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        <p className="text-xs text-slate-300 mt-1">{title}</p>
        {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
)

export const SuperAdminUsageStats: React.FC = () => {
    const [stats, setStats] = useState<SuperAdminUsageStatsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
    const [chartMetric, setChartMetric] = useState<ChartMetric>('notas')

    const navigateTo = (page: string) => {
        window.dispatchEvent(new CustomEvent('navigate', { detail: { page } }))
    }

    const loadStats = async () => {
        try {
            setLoading(true)
            setError(null)
            const data = await fetchSuperAdminUsageStats({ diasActividade: 14, limiteEscolas: 200 })
            setStats(data)
        } catch (err) {
            console.error('Error loading usage stats:', err)
            setError('Erro ao carregar estatísticas de utilização. Confirme se a migração foi aplicada.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadStats()
    }, [])

    const escolasFiltradas = useMemo(() => {
        const list = stats?.escolas || []
        const q = search.trim().toLowerCase()
        return list.filter((e) => {
            if (filtroEstado !== 'todos' && e.estado_uso !== filtroEstado) return false
            if (!q) return true
            return (
                e.nome?.toLowerCase().includes(q) ||
                e.codigo_escola?.toLowerCase().includes(q) ||
                e.provincia?.toLowerCase().includes(q) ||
                e.municipio?.toLowerCase().includes(q)
            )
        })
    }, [stats, search, filtroEstado])

    const chartData = useMemo(
        () =>
            (stats?.actividade_diaria || []).map((p) => ({
                ...p,
                label: formatDayLabel(p.dia),
            })),
        [stats],
    )

    const metricMeta: Record<ChartMetric, { label: string; color: string; key: ChartMetric }> = {
        notas: { label: 'Notas', color: '#34d399', key: 'notas' },
        acessos: { label: 'Acessos', color: '#60a5fa', key: 'acessos' },
        alunos: { label: 'Alunos', color: '#fbbf24', key: 'alunos' },
        professores: { label: 'Professores', color: '#a78bfa', key: 'professores' },
    }

    if (loading) {
        return (
            <div
                className="min-h-screen pb-24 md:pb-8 animate-fade-in"
                style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' }}
            >
                <div className="px-4 py-6 md:px-8">
                    <div className="skeleton h-8 w-56 mb-2 bg-white/10 rounded-2xl" />
                    <div className="skeleton h-4 w-64 bg-white/5 rounded-xl" />
                </div>
                <div className="px-4 md:px-8 space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="rounded-3xl p-4" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                <div className="skeleton w-11 h-11 rounded-2xl bg-white/10 mb-3" />
                                <div className="skeleton h-7 w-14 rounded-xl bg-white/10 mb-2" />
                                <div className="skeleton h-3 w-20 rounded bg-white/5" />
                            </div>
                        ))}
                    </div>
                    <div className="rounded-3xl p-5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="skeleton h-[240px] w-full rounded-2xl bg-white/5" />
                    </div>
                </div>
            </div>
        )
    }

    if (error || !stats) {
        return (
            <div
                className="min-h-screen p-4 md:p-8 flex items-center justify-center"
                style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' }}
            >
                <div
                    className="max-w-md w-full rounded-3xl p-8 text-center"
                    style={{
                        background: 'rgba(255,255,255,0.08)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                    }}
                >
                    <div
                        className="w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
                    >
                        <span className="text-4xl">⚠️</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Erro ao Carregar</h3>
                    <p className="text-slate-400 text-sm mb-6">
                        {error || 'Não foi possível carregar as estatísticas de utilização.'}
                    </p>
                    <button
                        onClick={loadStats}
                        className="w-full py-4 rounded-2xl font-semibold text-white transition-all active:scale-[0.98]"
                        style={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            boxShadow: '0 8px 32px rgba(59,130,246,0.3)',
                        }}
                    >
                        Tentar Novamente
                    </button>
                </div>
            </div>
        )
    }

    const { resumo } = stats

    return (
        <div
            className="min-h-screen pb-28 md:pb-8"
            style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' }}
        >
            <div className="px-4 py-5 md:px-8 relative overflow-hidden">
                <div
                    className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20"
                    style={{
                        background: 'radial-gradient(circle, #10b981 0%, transparent 70%)',
                        filter: 'blur(60px)',
                    }}
                />
                <div className="relative flex items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                            >
                                <span className="text-lg">📊</span>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white">Uso do Sistema</h1>
                                <p className="text-slate-400 text-xs">
                                    Professores · Alunos · Notas · Acessos por escola
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigateTo('superadmin-acessos')}
                            className="hidden sm:flex h-11 px-3 rounded-2xl items-center text-xs font-medium text-slate-200 transition-all active:scale-95"
                            style={{
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.1)',
                            }}
                        >
                            Ver acessos
                        </button>
                        <button
                            onClick={loadStats}
                            className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-95"
                            style={{
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.1)',
                            }}
                            aria-label="Actualizar estatísticas"
                        >
                            <span className="text-lg">🔄</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="px-4 md:px-8 space-y-5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <UsageStatCard
                        icon="🏫"
                        title="Escolas activas (7d)"
                        value={resumo.escolas_activas_7d}
                        subtitle={`${resumo.total_escolas} no total`}
                        gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
                        delay={0}
                    />
                    <UsageStatCard
                        icon="👨‍🏫"
                        title="Professores"
                        value={resumo.total_professores}
                        subtitle={`+${resumo.professores_7d} nos últimos 7 dias`}
                        gradient="linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)"
                        delay={40}
                    />
                    <UsageStatCard
                        icon="🎓"
                        title="Alunos"
                        value={resumo.total_alunos}
                        subtitle={`+${resumo.alunos_7d} nos últimos 7 dias`}
                        gradient="linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
                        delay={80}
                    />
                    <UsageStatCard
                        icon="📝"
                        title="Notas lançadas"
                        value={resumo.total_notas}
                        subtitle={`+${resumo.notas_7d} nos últimos 7 dias`}
                        gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                        delay={120}
                    />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div
                        className="rounded-2xl p-3 text-center"
                        style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)' }}
                    >
                        <p className="text-lg font-bold text-blue-300 tabular-nums">{resumo.acessos_hoje}</p>
                        <p className="text-[10px] text-blue-200/70">Acessos hoje</p>
                    </div>
                    <div
                        className="rounded-2xl p-3 text-center"
                        style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)' }}
                    >
                        <p className="text-lg font-bold text-sky-300 tabular-nums">{resumo.acessos_7d}</p>
                        <p className="text-[10px] text-sky-200/70">Acessos 7 dias</p>
                    </div>
                    <div
                        className="rounded-2xl p-3 text-center"
                        style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}
                    >
                        <p className="text-lg font-bold text-emerald-300 tabular-nums">
                            {resumo.escolas_com_notas}
                        </p>
                        <p className="text-[10px] text-emerald-200/70">Escolas c/ notas</p>
                    </div>
                    <div
                        className="rounded-2xl p-3 text-center"
                        style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
                    >
                        <p className="text-lg font-bold text-red-300 tabular-nums">{resumo.escolas_sem_uso}</p>
                        <p className="text-[10px] text-red-200/70">Escolas sem uso</p>
                    </div>
                </div>

                <div
                    className="rounded-3xl p-4 md:p-5"
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                    }}
                >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-sm font-semibold text-white">Actividade recente</h2>
                            <p className="text-[11px] text-slate-400">Últimos 14 dias no sistema</p>
                        </div>
                        <div
                            className="p-1 rounded-2xl flex gap-1 overflow-x-auto"
                            style={{ background: 'rgba(255,255,255,0.06)' }}
                        >
                            {(Object.keys(metricMeta) as ChartMetric[]).map((key) => (
                                <button
                                    key={key}
                                    onClick={() => setChartMetric(key)}
                                    className="px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all"
                                    style={{
                                        background:
                                            chartMetric === key ? 'rgba(255,255,255,0.12)' : 'transparent',
                                        color: chartMetric === key ? '#fff' : 'rgba(255,255,255,0.5)',
                                    }}
                                >
                                    {metricMeta[key].label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-[240px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop
                                            offset="0%"
                                            stopColor={metricMeta[chartMetric].color}
                                            stopOpacity={0.35}
                                        />
                                        <stop
                                            offset="100%"
                                            stopColor={metricMeta[chartMetric].color}
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    minTickGap={24}
                                />
                                <YAxis
                                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={36}
                                    allowDecimals={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: '#0f172a',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: 12,
                                        color: '#fff',
                                        fontSize: 12,
                                    }}
                                    labelStyle={{ color: '#94a3b8' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey={chartMetric}
                                    stroke={metricMeta[chartMetric].color}
                                    fill="url(#usageFill)"
                                    strokeWidth={2}
                                    name={metricMeta[chartMetric].label}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div
                    className="rounded-3xl p-4 md:p-5 space-y-4"
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                    }}
                >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-semibold text-white">Utilização por escola</h2>
                            <p className="text-[11px] text-slate-400">
                                {escolasFiltradas.length} escola{escolasFiltradas.length === 1 ? '' : 's'} ·
                                quem cadastrou professores/alunos e lançou notas
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Pesquisar escola, município…"
                                className="w-full sm:w-56 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none"
                                style={{
                                    background: 'rgba(15,23,42,0.6)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                }}
                            />
                            <div
                                className="p-1 rounded-xl flex gap-1 overflow-x-auto"
                                style={{ background: 'rgba(255,255,255,0.06)' }}
                            >
                                {(
                                    [
                                        { key: 'todos', label: 'Todas' },
                                        { key: 'activo', label: 'A usar' },
                                        { key: 'parcial', label: 'Parcial' },
                                        { key: 'inactivo', label: 'Sem uso' },
                                    ] as const
                                ).map((tab) => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setFiltroEstado(tab.key)}
                                        className="px-2.5 py-2 rounded-lg text-[11px] font-medium whitespace-nowrap"
                                        style={{
                                            background:
                                                filtroEstado === tab.key
                                                    ? 'rgba(255,255,255,0.12)'
                                                    : 'transparent',
                                            color:
                                                filtroEstado === tab.key
                                                    ? '#fff'
                                                    : 'rgba(255,255,255,0.5)',
                                        }}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {escolasFiltradas.length === 0 ? (
                        <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(0,0,0,0.2)' }}>
                            <p className="text-slate-400 text-sm">Nenhuma escola corresponde ao filtro.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {escolasFiltradas.map((escola) => (
                                <EscolaUsoRow key={escola.escola_id} escola={escola} />
                            ))}
                        </div>
                    )}
                </div>

                <p className="text-[11px] text-slate-500 text-center pb-2">
                    Activo = acessos ou notas nos últimos 7 dias · Parcial = tem professores e alunos sem
                    actividade recente · Sem uso = ainda sem utilização concreta
                </p>
            </div>
        </div>
    )
}

const EscolaUsoRow: React.FC<{ escola: SuperAdminEscolaUso }> = ({ escola }) => {
    const meta = ESTADO_META[escola.estado_uso] || ESTADO_META.inactivo

    return (
        <div
            className="rounded-2xl p-3.5 md:p-4"
            style={{
                background: 'rgba(15,23,42,0.45)',
                border: '1px solid rgba(255,255,255,0.06)',
            }}
        >
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-white truncate">{escola.nome}</h3>
                        <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
                        >
                            {meta.label}
                        </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {[escola.codigo_escola, escola.municipio, escola.provincia]
                            .filter(Boolean)
                            .join(' · ')}
                    </p>
                </div>
                <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-slate-500">Última actividade</p>
                    <p className="text-xs text-slate-300">{formatRelative(escola.ultima_actividade)}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <MetricChip label="Professores" value={escola.professores} delta={escola.professores_7d} />
                <MetricChip label="Alunos" value={escola.alunos} delta={escola.alunos_7d} />
                <MetricChip label="Turmas" value={escola.turmas} />
                <MetricChip label="Notas" value={escola.notas} delta={escola.notas_7d} />
                <MetricChip label="Acessos 7d" value={escola.acessos_7d} />
            </div>
        </div>
    )
}

const MetricChip: React.FC<{ label: string; value: number; delta?: number }> = ({
    label,
    value,
    delta,
}) => (
    <div className="rounded-xl px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <p className="text-[10px] text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-white tabular-nums">
            {value}
            {typeof delta === 'number' && delta > 0 && (
                <span className="text-[10px] text-emerald-400 font-medium ml-1">(+{delta})</span>
            )}
        </p>
    </div>
)

export default SuperAdminUsageStats
