import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { Icons } from '../../../components/ui/Icons'
import { translateError } from '../../../utils/translations'
import type { EstadoProcessoProvincial, PlanoProvincial } from '../../../types'
import { ESTADO_PROCESSO_LABELS } from '../../../utils/provincialStaffAccess'
import {
    createPlanoProvincial,
    deletePlanoProvincial,
    fetchPlanosProvinciais,
    updatePlanoProvincial,
} from '../api/processosProvinciais'
import {
    DpAlert,
    DpBadge,
    DpButton,
    DpConfirmModal,
    DpContent,
    DpEmpty,
    DpFormSection,
    DpHeader,
    DpIconButton,
    DpInput,
    DpLoading,
    DpModal,
    DpModalFooter,
    DpPage,
    DpPanel,
    DpSearch,
    DpSelect,
    DpTextarea,
} from './ProvincialChrome'

const emptyForm = {
    titulo: '',
    descricao: '',
    periodo: '',
    objectivos: '',
    metas: '',
    responsavel: '',
    estado: 'rascunho' as EstadoProcessoProvincial,
    data_inicio: '',
    data_fim: '',
    notas: '',
}

export const PlaneamentoProvinciaisPage: React.FC = () => {
    const { direcaoProvincialProfile } = useAuth()
    const [items, setItems] = useState<PlanoProvincial[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editId, setEditId] = useState<string | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [submitting, setSubmitting] = useState(false)
    const [deleteId, setDeleteId] = useState<string | null>(null)

    const load = useCallback(async () => {
        if (!direcaoProvincialProfile?.id) {
            setItems([])
            setLoading(false)
            return
        }
        setLoading(true)
        setError(null)
        try {
            setItems(await fetchPlanosProvinciais(direcaoProvincialProfile.id))
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao carregar planos'))
        } finally {
            setLoading(false)
        }
    }, [direcaoProvincialProfile?.id])

    useEffect(() => {
        load()
    }, [load])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return items
        return items.filter(
            (p) =>
                p.titulo.toLowerCase().includes(q) ||
                (p.periodo || '').toLowerCase().includes(q) ||
                (p.responsavel || '').toLowerCase().includes(q),
        )
    }, [items, search])

    const openCreate = () => {
        setEditId(null)
        setForm(emptyForm)
        setShowModal(true)
    }

    const openEdit = (item: PlanoProvincial) => {
        setEditId(item.id)
        setForm({
            titulo: item.titulo,
            descricao: item.descricao || '',
            periodo: item.periodo || '',
            objectivos: item.objectivos || '',
            metas: item.metas || '',
            responsavel: item.responsavel || '',
            estado: item.estado,
            data_inicio: item.data_inicio || '',
            data_fim: item.data_fim || '',
            notas: item.notas || '',
        })
        setShowModal(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!direcaoProvincialProfile?.id) return
        setSubmitting(true)
        setError(null)
        try {
            if (!form.titulo.trim()) throw new Error('Título é obrigatório')
            const payload = {
                titulo: form.titulo.trim(),
                descricao: form.descricao.trim() || null,
                periodo: form.periodo.trim() || null,
                objectivos: form.objectivos.trim() || null,
                metas: form.metas.trim() || null,
                responsavel: form.responsavel.trim() || null,
                estado: form.estado,
                data_inicio: form.data_inicio || null,
                data_fim: form.data_fim || null,
                notas: form.notas.trim() || null,
            }
            if (editId) {
                await updatePlanoProvincial(editId, payload)
            } else {
                await createPlanoProvincial({
                    direcao_provincial_id: direcaoProvincialProfile.id,
                    ...payload,
                })
            }
            setShowModal(false)
            await load()
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao guardar'))
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async () => {
        if (!deleteId) return
        try {
            await deletePlanoProvincial(deleteId)
            setDeleteId(null)
            await load()
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao eliminar'))
        }
    }

    const toneFor = (estado: EstadoProcessoProvincial) => {
        if (estado === 'concluido') return 'success' as const
        if (estado === 'em_curso') return 'info' as const
        if (estado === 'suspenso') return 'warning' as const
        return 'neutral' as const
    }

    return (
        <DpPage className="pb-24 md:pb-0">
            <DpHeader
                title="Planeamento"
                subtitle="Planos anuais e trimestrais do sector da educação na província"
                icon={<Icons.ClipboardList className="w-6 h-6" />}
                accent="blue"
                actions={
                    <DpButton onClick={openCreate} icon={<Icons.Plus className="w-4 h-4" />}>
                        Novo plano
                    </DpButton>
                }
            />
            <DpContent>
                {error && <DpAlert tone="error">{error}</DpAlert>}
                <DpSearch value={search} onChange={setSearch} placeholder="Pesquisar planos…" />
                {loading ? (
                    <DpLoading />
                ) : filtered.length === 0 ? (
                    <DpEmpty
                        title="Sem planos"
                        description="Crie o primeiro plano de actividades do sector."
                    />
                ) : (
                    <div className="space-y-3">
                        {filtered.map((item) => (
                            <DpPanel
                                key={item.id}
                                className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold text-slate-900">{item.titulo}</p>
                                        <DpBadge tone={toneFor(item.estado)}>
                                            {ESTADO_PROCESSO_LABELS[item.estado]}
                                        </DpBadge>
                                    </div>
                                    {item.periodo && (
                                        <p className="text-sm text-slate-500">Período: {item.periodo}</p>
                                    )}
                                    {item.responsavel && (
                                        <p className="text-sm text-slate-500">
                                            Responsável: {item.responsavel}
                                        </p>
                                    )}
                                    {item.objectivos && (
                                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                                            {item.objectivos}
                                        </p>
                                    )}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <DpIconButton
                                        label="Editar"
                                        onClick={() => openEdit(item)}
                                        className="!bg-slate-100 !text-slate-700 !shadow-none"
                                    >
                                        <Icons.Edit className="w-4 h-4" />
                                    </DpIconButton>
                                    <DpIconButton
                                        label="Eliminar"
                                        onClick={() => setDeleteId(item.id)}
                                        variant="danger"
                                    >
                                        <Icons.Trash className="w-4 h-4" />
                                    </DpIconButton>
                                </div>
                            </DpPanel>
                        ))}
                    </div>
                )}
            </DpContent>

            <DpModal
                isOpen={showModal}
                onClose={() => {
                    if (!submitting) setShowModal(false)
                }}
                title={editId ? 'Editar plano' : 'Novo plano'}
                subtitle="Planeamento de actividades do sector da educação"
                icon={<Icons.ClipboardList />}
                accent="blue"
                size="lg"
                busy={submitting}
                badge={
                    <DpBadge tone={editId ? 'info' : 'success'}>
                        {editId ? 'Edição' : 'Novo'}
                    </DpBadge>
                }
                footer={
                    <DpModalFooter>
                        <DpButton
                            type="button"
                            variant="secondary"
                            onClick={() => setShowModal(false)}
                            disabled={submitting}
                            className="sm:min-w-[7.5rem]"
                        >
                            Cancelar
                        </DpButton>
                        <DpButton
                            type="submit"
                            form="dp-plano-form"
                            disabled={submitting}
                            className="sm:min-w-[8rem]"
                        >
                            {submitting ? 'A guardar…' : 'Guardar plano'}
                        </DpButton>
                    </DpModalFooter>
                }
            >
                <form id="dp-plano-form" onSubmit={handleSubmit} className="space-y-4">
                    <DpFormSection title="Identificação" description="Título, período e estado do plano">
                        <DpInput
                            label="Título"
                            value={form.titulo}
                            onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                            required
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <DpInput
                                label="Período"
                                value={form.periodo}
                                onChange={(e) => setForm((f) => ({ ...f, periodo: e.target.value }))}
                                placeholder="Ex.: 2026 / 1.º trimestre"
                            />
                            <DpSelect
                                label="Estado"
                                value={form.estado}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        estado: e.target.value as EstadoProcessoProvincial,
                                    }))
                                }
                            >
                                {(Object.keys(ESTADO_PROCESSO_LABELS) as EstadoProcessoProvincial[]).map(
                                    (k) => (
                                        <option key={k} value={k}>
                                            {ESTADO_PROCESSO_LABELS[k]}
                                        </option>
                                    ),
                                )}
                            </DpSelect>
                        </div>
                        <DpInput
                            label="Responsável"
                            value={form.responsavel}
                            onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <DpInput
                                label="Data início"
                                type="date"
                                value={form.data_inicio}
                                onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))}
                            />
                            <DpInput
                                label="Data fim"
                                type="date"
                                value={form.data_fim}
                                onChange={(e) => setForm((f) => ({ ...f, data_fim: e.target.value }))}
                            />
                        </div>
                    </DpFormSection>
                    <DpFormSection title="Conteúdo" description="Objectivos, metas e notas de acompanhamento">
                        <DpTextarea
                            label="Objectivos"
                            value={form.objectivos}
                            onChange={(e) => setForm((f) => ({ ...f, objectivos: e.target.value }))}
                        />
                        <DpTextarea
                            label="Metas"
                            value={form.metas}
                            onChange={(e) => setForm((f) => ({ ...f, metas: e.target.value }))}
                        />
                        <DpTextarea
                            label="Notas"
                            value={form.notas}
                            onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                        />
                    </DpFormSection>
                </form>
            </DpModal>

            <DpConfirmModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title="Eliminar plano"
                message="Tem a certeza que deseja eliminar este plano? A acção não pode ser anulada."
                confirmText="Eliminar"
                variant="danger"
            />
        </DpPage>
    )
}

export default PlaneamentoProvinciaisPage
