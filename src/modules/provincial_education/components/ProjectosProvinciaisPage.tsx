import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { Icons } from '../../../components/ui/Icons'
import { translateError } from '../../../utils/translations'
import type {
    AreaProjectoProvincial,
    EstadoProcessoProvincial,
    ProjectoProvincial,
} from '../../../types'
import {
    AREA_PROJECTO_LABELS,
    ESTADO_PROCESSO_LABELS,
} from '../../../utils/provincialStaffAccess'
import {
    createProjectoProvincial,
    deleteProjectoProvincial,
    fetchProjectosProvinciais,
    updateProjectoProvincial,
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
    area: 'ciencia' as AreaProjectoProvincial,
    responsavel: '',
    estado: 'rascunho' as EstadoProcessoProvincial,
    data_inicio: '',
    data_fim: '',
    notas: '',
}

export const ProjectosProvinciaisPage: React.FC = () => {
    const { direcaoProvincialProfile } = useAuth()
    const [items, setItems] = useState<ProjectoProvincial[]>([])
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
            setItems(await fetchProjectosProvinciais(direcaoProvincialProfile.id))
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao carregar projectos'))
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
                AREA_PROJECTO_LABELS[p.area].toLowerCase().includes(q) ||
                (p.responsavel || '').toLowerCase().includes(q),
        )
    }, [items, search])

    const openCreate = () => {
        setEditId(null)
        setForm(emptyForm)
        setShowModal(true)
    }

    const openEdit = (item: ProjectoProvincial) => {
        setEditId(item.id)
        setForm({
            titulo: item.titulo,
            descricao: item.descricao || '',
            area: item.area,
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
                area: form.area,
                responsavel: form.responsavel.trim() || null,
                estado: form.estado,
                data_inicio: form.data_inicio || null,
                data_fim: form.data_fim || null,
                notas: form.notas.trim() || null,
            }
            if (editId) {
                await updateProjectoProvincial(editId, payload)
            } else {
                await createProjectoProvincial({
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
            await deleteProjectoProvincial(deleteId)
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
                title="Projectos"
                subtitle="Ciência, tecnologia, inovação e investigação na província"
                icon={<Icons.AcademicCap className="w-6 h-6" />}
                accent="violet"
                actions={
                    <DpButton onClick={openCreate} icon={<Icons.Plus className="w-4 h-4" />}>
                        Novo projecto
                    </DpButton>
                }
            />
            <DpContent>
                {error && <DpAlert tone="error">{error}</DpAlert>}
                <DpSearch value={search} onChange={setSearch} placeholder="Pesquisar projectos…" />
                {loading ? (
                    <DpLoading />
                ) : filtered.length === 0 ? (
                    <DpEmpty
                        title="Sem projectos"
                        description="Registe iniciativas de ciência, tecnologia, inovação ou investigação."
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
                                        <DpBadge tone="info">{AREA_PROJECTO_LABELS[item.area]}</DpBadge>
                                        <DpBadge tone={toneFor(item.estado)}>
                                            {ESTADO_PROCESSO_LABELS[item.estado]}
                                        </DpBadge>
                                    </div>
                                    {item.responsavel && (
                                        <p className="text-sm text-slate-500">
                                            Responsável: {item.responsavel}
                                        </p>
                                    )}
                                    {item.descricao && (
                                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                                            {item.descricao}
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
                title={editId ? 'Editar projecto' : 'Novo projecto'}
                subtitle="Projectos tecnológicos e de inovação (CTI)"
                icon={<Icons.AcademicCap />}
                accent="violet"
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
                            form="dp-projecto-form"
                            disabled={submitting}
                            className="sm:min-w-[8rem]"
                        >
                            {submitting ? 'A guardar…' : 'Guardar projecto'}
                        </DpButton>
                    </DpModalFooter>
                }
            >
                <form id="dp-projecto-form" onSubmit={handleSubmit} className="space-y-4">
                    <DpFormSection
                        title="Identificação"
                        description="Título, área e estado do projecto"
                    >
                        <DpInput
                            label="Título"
                            value={form.titulo}
                            onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                            required
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <DpSelect
                                label="Área"
                                value={form.area}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        area: e.target.value as AreaProjectoProvincial,
                                    }))
                                }
                            >
                                {(Object.keys(AREA_PROJECTO_LABELS) as AreaProjectoProvincial[]).map(
                                    (k) => (
                                        <option key={k} value={k}>
                                            {AREA_PROJECTO_LABELS[k]}
                                        </option>
                                    ),
                                )}
                            </DpSelect>
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
                    <DpFormSection title="Descrição" description="Detalhe e notas de acompanhamento">
                        <DpTextarea
                            label="Descrição"
                            value={form.descricao}
                            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
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
                title="Eliminar projecto"
                message="Tem a certeza que deseja eliminar este projecto? A acção não pode ser anulada."
                confirmText="Eliminar"
                variant="danger"
            />
        </DpPage>
    )
}

export default ProjectosProvinciaisPage
