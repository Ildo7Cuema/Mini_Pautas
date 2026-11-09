/**
 * @component SuperAdminNotifications
 * @description Envio de notificações pelo SUPERADMIN (broadcast ou particulares)
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
    broadcastSuperAdminNotification,
    fetchSuperAdminNotificationTargets,
    type SuperAdminNotifAudience,
    type SuperAdminNotifTarget,
    type SuperAdminNotifTargets,
} from '../utils/superadmin'

type SendMode = 'broadcast' | 'particular'

const AUDIENCE_OPTIONS: Array<{
    id: SuperAdminNotifAudience
    label: string
    description: string
    icon: string
    color: string
}> = [
    {
        id: 'escolas',
        label: 'Escolas',
        description: 'Administradores de escolas activas',
        icon: '🏫',
        color: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    },
    {
        id: 'direcoes_municipais',
        label: 'Direções Municipais',
        description: 'Contas activas das DMs',
        icon: '🏛️',
        color: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    },
    {
        id: 'direcoes_provinciais',
        label: 'Direções Provinciais',
        description: 'Contas activas das DPs',
        icon: '🗺️',
        color: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    },
]

function matchesQuery(target: SuperAdminNotifTarget, q: string): boolean {
    if (!q) return true
    const hay = `${target.nome} ${target.subtitle}`.toLowerCase()
    return hay.includes(q)
}

export const SuperAdminNotifications: React.FC = () => {
    const [mode, setMode] = useState<SendMode>('broadcast')
    const [audiencias, setAudiencias] = useState<SuperAdminNotifAudience[]>(['escolas'])
    const [titulo, setTitulo] = useState('')
    const [mensagem, setMensagem] = useState('')
    const [link, setLink] = useState('')
    const [targets, setTargets] = useState<SuperAdminNotifTargets | null>(null)
    const [loadingTargets, setLoadingTargets] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedEscolas, setSelectedEscolas] = useState<string[]>([])
    const [selectedDMs, setSelectedDMs] = useState<string[]>([])
    const [selectedDPs, setSelectedDPs] = useState<string[]>([])
    const [pickerAudience, setPickerAudience] = useState<SuperAdminNotifAudience>('escolas')
    const [sending, setSending] = useState(false)
    const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

    const loadTargets = async () => {
        try {
            setLoadingTargets(true)
            const data = await fetchSuperAdminNotificationTargets()
            setTargets(data)
        } catch (err) {
            console.error('Erro ao carregar destinatários:', err)
            setTargets({ escolas: [], direcoes_municipais: [], direcoes_provinciais: [] })
        } finally {
            setLoadingTargets(false)
        }
    }

    useEffect(() => {
        loadTargets()
    }, [])

    const counts = useMemo(
        () => ({
            escolas: targets?.escolas.length ?? 0,
            direcoes_municipais: targets?.direcoes_municipais.length ?? 0,
            direcoes_provinciais: targets?.direcoes_provinciais.length ?? 0,
        }),
        [targets],
    )

    const estimatedRecipients = useMemo(() => {
        if (mode === 'broadcast') {
            return audiencias.reduce((sum, key) => sum + (counts[key] || 0), 0)
        }
        return selectedEscolas.length + selectedDMs.length + selectedDPs.length
    }, [mode, audiencias, counts, selectedEscolas, selectedDMs, selectedDPs])

    const pickerList = useMemo(() => {
        const list = targets?.[pickerAudience] || []
        const q = search.trim().toLowerCase()
        return list.filter((t) => matchesQuery(t, q))
    }, [targets, pickerAudience, search])

    const selectedForPicker =
        pickerAudience === 'escolas'
            ? selectedEscolas
            : pickerAudience === 'direcoes_municipais'
              ? selectedDMs
              : selectedDPs

    const setSelectedForPicker = (ids: string[]) => {
        if (pickerAudience === 'escolas') setSelectedEscolas(ids)
        else if (pickerAudience === 'direcoes_municipais') setSelectedDMs(ids)
        else setSelectedDPs(ids)
    }

    const toggleAudience = (id: SuperAdminNotifAudience) => {
        setAudiencias((prev) =>
            prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
        )
        setFeedback(null)
    }

    const toggleTarget = (id: string) => {
        const current = selectedForPicker
        setSelectedForPicker(
            current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
        )
        setFeedback(null)
    }

    const selectAllVisible = () => {
        const ids = new Set([...selectedForPicker, ...pickerList.map((t) => t.id)])
        setSelectedForPicker([...ids])
    }

    const clearPickerSelection = () => {
        setSelectedForPicker([])
    }

    const canSubmit =
        mode === 'broadcast'
            ? audiencias.length > 0
            : selectedEscolas.length + selectedDMs.length + selectedDPs.length > 0

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setFeedback(null)
        setSending(true)
        try {
            const result = await broadcastSuperAdminNotification({
                titulo,
                mensagem,
                audiencias: mode === 'broadcast' ? audiencias : [],
                tipo: 'sistema',
                link: link.trim() || undefined,
                escolaIds: mode === 'particular' ? selectedEscolas : undefined,
                direcaoMunicipalIds: mode === 'particular' ? selectedDMs : undefined,
                direcaoProvincialIds: mode === 'particular' ? selectedDPs : undefined,
            })

            if (!result.success) {
                setFeedback({ type: 'err', text: result.error || 'Falha ao enviar.' })
                return
            }

            setFeedback({
                type: 'ok',
                text:
                    result.message ||
                    `Notificação enviada a ${result.enviadas} destinatário(s).`,
            })
            setTitulo('')
            setMensagem('')
            setLink('')
            if (mode === 'particular') {
                setSelectedEscolas([])
                setSelectedDMs([])
                setSelectedDPs([])
            }
            await loadTargets()
        } catch (err) {
            console.error(err)
            setFeedback({ type: 'err', text: 'Erro inesperado ao enviar notificações.' })
        } finally {
            setSending(false)
        }
    }

    return (
        <div
            className="min-h-screen pb-28 md:pb-8"
            style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' }}
        >
            <div className="px-4 py-5 md:px-8 relative overflow-hidden">
                <div
                    className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-20 pointer-events-none"
                    style={{
                        background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
                        filter: 'blur(40px)',
                    }}
                />
                <div className="relative">
                    <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Super Admin</p>
                    <h1 className="text-2xl md:text-3xl font-bold text-white">Notificações</h1>
                    <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                        Envie avisos in-app a todos os tipos ou a escolas / direções específicas.
                        Contas seed de teste são excluídas automaticamente.
                    </p>
                </div>
            </div>

            <form
                onSubmit={handleSubmit}
                className="px-4 md:px-8 space-y-4"
            >
                <div
                    className="rounded-3xl p-4 md:p-6 space-y-4"
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                    }}
                >
                    <div
                        className="p-1 rounded-2xl grid grid-cols-2 gap-1 w-full"
                        style={{ background: 'rgba(255,255,255,0.08)' }}
                    >
                        <button
                            type="button"
                            onClick={() => {
                                setMode('broadcast')
                                setFeedback(null)
                            }}
                            className="w-full py-2.5 px-3 rounded-xl font-medium text-sm transition-all"
                            style={{
                                background: mode === 'broadcast' ? 'rgba(255,255,255,0.14)' : 'transparent',
                                color: mode === 'broadcast' ? '#fff' : 'rgba(255,255,255,0.5)',
                            }}
                        >
                            Todos do tipo
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setMode('particular')
                                setFeedback(null)
                            }}
                            className="w-full py-2.5 px-3 rounded-xl font-medium text-sm transition-all"
                            style={{
                                background: mode === 'particular' ? 'rgba(255,255,255,0.14)' : 'transparent',
                                color: mode === 'particular' ? '#fff' : 'rgba(255,255,255,0.5)',
                            }}
                        >
                            Particulares
                        </button>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold text-white">Destinatários</h2>
                        <span className="text-xs text-slate-400">
                            {loadingTargets
                                ? 'A calcular…'
                                : `${estimatedRecipients} destinatário${estimatedRecipients === 1 ? '' : 's'}`}
                        </span>
                    </div>

                    {mode === 'broadcast' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {AUDIENCE_OPTIONS.map((opt) => {
                                const selected = audiencias.includes(opt.id)
                                const count = counts[opt.id] ?? 0
                                return (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => toggleAudience(opt.id)}
                                        className="w-full rounded-2xl p-4 flex flex-col gap-3 text-left transition-all active:scale-[0.99] h-full"
                                        style={{
                                            background: selected
                                                ? 'rgba(59,130,246,0.15)'
                                                : 'rgba(255,255,255,0.04)',
                                            border: selected
                                                ? '1px solid rgba(59,130,246,0.45)'
                                                : '1px solid rgba(255,255,255,0.08)',
                                        }}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div
                                                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: opt.color }}
                                            >
                                                <span className="text-lg">{opt.icon}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xl font-bold text-white tabular-nums leading-none">
                                                    {loadingTargets ? '—' : count}
                                                </p>
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    {selected ? 'Seleccionado' : 'Toque'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-white">{opt.label}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">{opt.description}</p>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                                {AUDIENCE_OPTIONS.map((opt) => {
                                    const active = pickerAudience === opt.id
                                    const selectedCount =
                                        opt.id === 'escolas'
                                            ? selectedEscolas.length
                                            : opt.id === 'direcoes_municipais'
                                              ? selectedDMs.length
                                              : selectedDPs.length
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => {
                                                setPickerAudience(opt.id)
                                                setSearch('')
                                            }}
                                            className="rounded-xl px-3 py-2 text-xs font-medium transition-all"
                                            style={{
                                                background: active
                                                    ? 'rgba(59,130,246,0.2)'
                                                    : 'rgba(255,255,255,0.06)',
                                                border: active
                                                    ? '1px solid rgba(59,130,246,0.45)'
                                                    : '1px solid rgba(255,255,255,0.08)',
                                                color: active ? '#dbeafe' : '#94a3b8',
                                            }}
                                        >
                                            {opt.icon} {opt.label}
                                            {selectedCount > 0 ? ` (${selectedCount})` : ''}
                                        </button>
                                    )
                                })}
                            </div>

                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Pesquisar por nome, município, código…"
                                className="w-full rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none"
                                style={{
                                    background: 'rgba(15,23,42,0.6)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                }}
                            />

                            <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] text-slate-500">
                                    {pickerList.length} resultado{pickerList.length === 1 ? '' : 's'}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={selectAllVisible}
                                        className="text-[11px] text-blue-300 hover:text-blue-200"
                                    >
                                        Seleccionar visíveis
                                    </button>
                                    <button
                                        type="button"
                                        onClick={clearPickerSelection}
                                        className="text-[11px] text-slate-400 hover:text-slate-200"
                                    >
                                        Limpar
                                    </button>
                                </div>
                            </div>

                            <div
                                className="max-h-72 overflow-y-auto rounded-2xl"
                                style={{
                                    background: 'rgba(15,23,42,0.45)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                }}
                            >
                                {loadingTargets ? (
                                    <p className="p-4 text-sm text-slate-400">A carregar…</p>
                                ) : pickerList.length === 0 ? (
                                    <p className="p-4 text-sm text-slate-400">Nenhum resultado.</p>
                                ) : (
                                    pickerList.map((t) => {
                                        const checked = selectedForPicker.includes(t.id)
                                        return (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => toggleTarget(t.id)}
                                                className="w-full px-3 py-3 flex items-start gap-3 text-left hover:bg-white/5 transition-colors"
                                                style={{
                                                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                                                }}
                                            >
                                                <span
                                                    className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[11px]"
                                                    style={{
                                                        background: checked
                                                            ? 'rgba(59,130,246,0.9)'
                                                            : 'rgba(255,255,255,0.08)',
                                                        border: checked
                                                            ? 'none'
                                                            : '1px solid rgba(255,255,255,0.15)',
                                                        color: '#fff',
                                                    }}
                                                >
                                                    {checked ? '✓' : ''}
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block text-sm font-medium text-white truncate">
                                                        {t.nome}
                                                    </span>
                                                    <span className="block text-[11px] text-slate-400 truncate">
                                                        {t.subtitle}
                                                    </span>
                                                </span>
                                            </button>
                                        )
                                    })
                                )}
                            </div>

                            {(selectedEscolas.length > 0 ||
                                selectedDMs.length > 0 ||
                                selectedDPs.length > 0) && (
                                <p className="text-xs text-slate-400">
                                    Selecção: {selectedEscolas.length} escola
                                    {selectedEscolas.length === 1 ? '' : 's'}
                                    {' · '}
                                    {selectedDMs.length} DM
                                    {' · '}
                                    {selectedDPs.length} DP
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div
                    className="rounded-3xl p-4 md:p-6 space-y-4"
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                    }}
                >
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                            Título
                        </label>
                        <input
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                            maxLength={120}
                            placeholder="Ex.: Manutenção programada"
                            className="w-full rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none"
                            style={{
                                background: 'rgba(15,23,42,0.6)',
                                border: '1px solid rgba(255,255,255,0.1)',
                            }}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                            Mensagem
                        </label>
                        <textarea
                            value={mensagem}
                            onChange={(e) => setMensagem(e.target.value)}
                            maxLength={2000}
                            rows={5}
                            placeholder="Escreva a mensagem que os destinatários vão ver no painel de notificações…"
                            className="w-full rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none resize-y min-h-[120px]"
                            style={{
                                background: 'rgba(15,23,42,0.6)',
                                border: '1px solid rgba(255,255,255,0.1)',
                            }}
                            required
                        />
                        <p className="text-[11px] text-slate-500 mt-1 text-right">
                            {mensagem.length}/2000
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                            Ligação interna (opcional)
                        </label>
                        <input
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
                            placeholder="Ex.: dashboard ou settings"
                            className="w-full rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none"
                            style={{
                                background: 'rgba(15,23,42,0.6)',
                                border: '1px solid rgba(255,255,255,0.1)',
                            }}
                        />
                    </div>
                </div>

                {feedback && (
                    <div
                        className="rounded-2xl px-4 py-3 text-sm"
                        style={{
                            background:
                                feedback.type === 'ok'
                                    ? 'rgba(16,185,129,0.15)'
                                    : 'rgba(239,68,68,0.15)',
                            border:
                                feedback.type === 'ok'
                                    ? '1px solid rgba(16,185,129,0.35)'
                                    : '1px solid rgba(239,68,68,0.35)',
                            color: feedback.type === 'ok' ? '#a7f3d0' : '#fecaca',
                        }}
                    >
                        {feedback.text}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={sending || !canSubmit}
                    className="w-full py-4 rounded-2xl font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        boxShadow: '0 8px 32px rgba(59,130,246,0.3)',
                    }}
                >
                    {sending
                        ? 'A enviar…'
                        : `Enviar notificação${estimatedRecipients ? ` (${estimatedRecipients})` : ''}`}
                </button>
            </form>
        </div>
    )
}

export default SuperAdminNotifications
