/**
 * @component InstitutionSubscriptionPlans
 * @description SuperAdmin: configurar Trimestral / Semestral / Anual por instituição
 */

import React, { useEffect, useState } from 'react'
import {
    clearInstitutionPrice,
    fetchPrices,
    PLANO_ASSINATURA_LABELS,
    PLANOS_ASSINATURA,
    resolvePricesForInstitution,
    TIPO_INSTITUICAO_LABELS,
    upsertInstitutionPrice,
} from '../utils/license'
import { fetchAllDirecoesMunicipais, fetchAllDirecoesProvinciais, fetchAllEscolas } from '../utils/superadmin'
import type { PlanoAssinaturaResolvido, PlanoLicenca, TipoInstituicaoAssinatura } from '../types'

interface InstitutionOption {
    id: string
    label: string
    subtitle?: string
}

interface InstitutionSubscriptionPlansProps {
    formatCurrency: (value: number) => string
}

export const InstitutionSubscriptionPlans: React.FC<InstitutionSubscriptionPlansProps> = ({ formatCurrency }) => {
    const [tipo, setTipo] = useState<TipoInstituicaoAssinatura>('ESCOLA')
    const [options, setOptions] = useState<InstitutionOption[]>([])
    const [selectedId, setSelectedId] = useState('')
    const [search, setSearch] = useState('')
    const [plans, setPlans] = useState<PlanoAssinaturaResolvido[]>([])
    const [globalFallback, setGlobalFallback] = useState<Record<PlanoLicenca, number>>({
        trimestral: 0,
        semestral: 0,
        anual: 0,
    })
    const [loadingList, setLoadingList] = useState(false)
    const [loadingPlans, setLoadingPlans] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [savingPlano, setSavingPlano] = useState<PlanoLicenca | null>(null)

    const [editPlano, setEditPlano] = useState<PlanoLicenca | null>(null)
    const [editValor, setEditValor] = useState('')
    const [editDesconto, setEditDesconto] = useState('0')
    const [editDescricao, setEditDescricao] = useState('')

    useEffect(() => {
        loadInstitutions()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tipo])

    useEffect(() => {
        if (selectedId) {
            loadPlans(selectedId)
        } else {
            setPlans([])
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId, tipo])

    const loadInstitutions = async () => {
        try {
            setLoadingList(true)
            setError(null)
            setSelectedId('')
            setSearch('')

            if (tipo === 'ESCOLA') {
                const escolas = await fetchAllEscolas()
                setOptions(
                    escolas.map(e => ({
                        id: e.id,
                        label: e.nome,
                        subtitle: `${e.codigo_escola || '—'} · ${e.municipio || e.provincia || ''}`,
                    }))
                )
            } else if (tipo === 'DIRECAO_MUNICIPAL') {
                const list = await fetchAllDirecoesMunicipais()
                setOptions(
                    list.map(d => ({
                        id: d.id,
                        label: d.nome,
                        subtitle: `${d.municipio} · ${d.provincia}`,
                    }))
                )
            } else {
                const list = await fetchAllDirecoesProvinciais()
                setOptions(
                    list.map(d => ({
                        id: d.id,
                        label: d.nome,
                        subtitle: d.provincia,
                    }))
                )
            }

            const globals = await fetchPrices()
            const fallback = { trimestral: 0, semestral: 0, anual: 0 } as Record<PlanoLicenca, number>
            globals.forEach(g => {
                fallback[g.plano] = g.valor
            })
            setGlobalFallback(fallback)
        } catch (err) {
            console.error(err)
            setError('Erro ao carregar instituições')
            setOptions([])
        } finally {
            setLoadingList(false)
        }
    }

    const loadPlans = async (instituicaoId: string) => {
        try {
            setLoadingPlans(true)
            setError(null)
            const resolved = await resolvePricesForInstitution(tipo, instituicaoId)
            setPlans(resolved)
        } catch (err) {
            console.error(err)
            setError('Erro ao carregar planos desta instituição')
            setPlans([])
        } finally {
            setLoadingPlans(false)
        }
    }

    const filteredOptions = options.filter(o => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return o.label.toLowerCase().includes(q) || (o.subtitle || '').toLowerCase().includes(q)
    })

    const openEdit = (plan: PlanoAssinaturaResolvido) => {
        setEditPlano(plan.plano)
        setEditValor(String(plan.valor || globalFallback[plan.plano] || ''))
        setEditDesconto(String(plan.desconto_percentual ?? 0))
        setEditDescricao(plan.descricao || '')
    }

    const handleSave = async () => {
        if (!selectedId || !editPlano) return
        const valorNum = parseFloat(editValor)
        const descontoNum = parseFloat(editDesconto || '0')
        if (isNaN(valorNum) || valorNum <= 0) {
            setError('O valor deve ser maior que 0')
            return
        }
        if (isNaN(descontoNum) || descontoNum < 0 || descontoNum > 100) {
            setError('O desconto deve estar entre 0 e 100')
            return
        }

        try {
            setSavingPlano(editPlano)
            setError(null)
            await upsertInstitutionPrice({
                tipo_instituicao: tipo,
                instituicao_id: selectedId,
                plano: editPlano,
                valor: valorNum,
                desconto_percentual: descontoNum,
                descricao: editDescricao.trim() || undefined,
            })
            setEditPlano(null)
            await loadPlans(selectedId)
        } catch (err) {
            console.error(err)
            setError('Erro ao guardar preço da instituição')
        } finally {
            setSavingPlano(null)
        }
    }

    const handleClear = async (plano: PlanoLicenca) => {
        if (!selectedId) return
        if (!confirm(`Repor ${PLANO_ASSINATURA_LABELS[plano]} para o preço global?`)) return
        try {
            setSavingPlano(plano)
            await clearInstitutionPrice(tipo, selectedId, plano)
            await loadPlans(selectedId)
        } catch (err) {
            console.error(err)
            setError('Erro ao repor preço global')
        } finally {
            setSavingPlano(null)
        }
    }

    const ensurePlanCards = (): PlanoAssinaturaResolvido[] => {
        if (plans.length > 0) return plans
        return PLANOS_ASSINATURA.map(plano => ({
            plano,
            valor: globalFallback[plano] || 0,
            desconto_percentual: 0,
            origem: 'global' as const,
        }))
    }

    return (
        <div className="animate-slide-up" style={{ animationDelay: '120ms' }}>
            <h2 className="text-base md:text-lg font-bold text-neutral-800 mb-1 flex items-center gap-2">
                <span>🏛️</span>
                Assinaturas por Instituição
            </h2>
            <p className="text-sm text-neutral-500 mb-3">
                Configure Trimestral, Semestral e Anual para cada escola ou direção. Sem preço próprio, usa o plano global.
            </p>

            <div className="bg-white rounded-2xl border border-neutral-100 p-4 space-y-4 shadow-sm">
                <div className="flex flex-wrap gap-2">
                    {(Object.keys(TIPO_INSTITUICAO_LABELS) as TipoInstituicaoAssinatura[]).map(key => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTipo(key)}
                            className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                                tipo === key
                                    ? 'bg-emerald-600 text-white shadow'
                                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                            }`}
                        >
                            {TIPO_INSTITUICAO_LABELS[key]}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">Pesquisar</label>
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={`Pesquisar ${TIPO_INSTITUICAO_LABELS[tipo].toLowerCase()}...`}
                            className="w-full px-3 py-2.5 bg-neutral-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">Instituição</label>
                        <select
                            value={selectedId}
                            onChange={e => setSelectedId(e.target.value)}
                            disabled={loadingList}
                            className="w-full px-3 py-2.5 bg-neutral-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="">{loadingList ? 'A carregar...' : 'Seleccione...'}</option>
                            {filteredOptions.map(o => (
                                <option key={o.id} value={o.id}>
                                    {o.label}{o.subtitle ? ` — ${o.subtitle}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {error && (
                    <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {!selectedId ? (
                    <p className="text-sm text-neutral-400 text-center py-6">
                        Seleccione uma instituição para configurar os planos.
                    </p>
                ) : loadingPlans ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-36 rounded-2xl bg-neutral-100 animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {ensurePlanCards().map(plan => (
                            <div
                                key={plan.plano}
                                className="relative rounded-2xl border-2 border-neutral-100 p-4 hover:border-emerald-200 transition-all"
                            >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <h3 className="font-bold text-neutral-800">
                                        {PLANO_ASSINATURA_LABELS[plan.plano]}
                                    </h3>
                                    <span
                                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                            plan.origem === 'instituicao'
                                                ? 'bg-violet-100 text-violet-700'
                                                : 'bg-slate-100 text-slate-600'
                                        }`}
                                    >
                                        {plan.origem === 'instituicao' ? 'Personalizado' : 'Global'}
                                    </span>
                                </div>
                                <p className="text-xl font-extrabold text-emerald-600 truncate">
                                    {formatCurrency(plan.valor)}
                                </p>
                                {plan.desconto_percentual > 0 && (
                                    <span className="inline-block mt-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                                        -{plan.desconto_percentual}%
                                    </span>
                                )}
                                <p className="text-xs text-neutral-500 mt-2 line-clamp-2 min-h-[2rem]">
                                    {plan.descricao || '—'}
                                </p>
                                <div className="flex gap-2 mt-3">
                                    <button
                                        type="button"
                                        onClick={() => openEdit(plan)}
                                        disabled={savingPlano === plan.plano}
                                        className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                        Definir
                                    </button>
                                    {plan.origem === 'instituicao' && (
                                        <button
                                            type="button"
                                            onClick={() => handleClear(plan.plano)}
                                            disabled={savingPlano === plan.plano}
                                            className="px-3 py-2 rounded-xl text-xs font-semibold bg-neutral-100 text-neutral-600 hover:bg-neutral-200 disabled:opacity-50"
                                            title="Usar preço global"
                                        >
                                            Repor
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {editPlano && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
                    <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl p-6 shadow-xl">
                        <div className="w-12 h-1 bg-neutral-300 rounded-full mx-auto mb-4 md:hidden" />
                        <h3 className="text-lg font-bold text-neutral-900 mb-1">
                            {PLANO_ASSINATURA_LABELS[editPlano]}
                        </h3>
                        <p className="text-sm text-neutral-500 mb-4">
                            Preço para esta {TIPO_INSTITUICAO_LABELS[tipo].toLowerCase()}
                        </p>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Valor (AOA)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editValor}
                                    onChange={e => setEditValor(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Desconto (%)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={editDesconto}
                                    onChange={e => setEditDesconto(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Descrição</label>
                                <textarea
                                    rows={2}
                                    value={editDescricao}
                                    onChange={e => setEditDescricao(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                                    placeholder="Opcional"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button
                                type="button"
                                onClick={() => setEditPlano(null)}
                                className="flex-1 px-4 py-3 rounded-xl border border-neutral-200 font-medium"
                                disabled={!!savingPlano}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={!!savingPlano}
                                className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50"
                            >
                                {savingPlano ? 'A guardar...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default InstitutionSubscriptionPlans
