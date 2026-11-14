import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { Icons } from '../../../components/ui/Icons'
import { translateError } from '../../../utils/translations'
import type { DepartamentoProvincial, PessoalDirecaoProvincial } from '../../../types'
import {
    DEPARTAMENTO_PROVINCIAL_OPTIONS,
    buildFuncionarioProvincialInviteLink,
    getDepartamentoProvincialLabel,
} from '../../../utils/provincialStaffAccess'
import {
    createPessoalProvincial,
    deletePessoalProvincial,
    fetchPessoalProvincial,
    updatePessoalProvincial,
} from '../api/pessoalProvincial'
import { TempoServicoReformaInfo } from '../../../components/TempoServicoReformaInfo'
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
} from './ProvincialChrome'

const emptyForm = {
    nome: '',
    email: '',
    telefone: '',
    numero_funcionario: '',
    departamento: 'EDUCACAO_ENSINO' as DepartamentoProvincial,
    cargo: '',
    data_nascimento: '',
    data_admissao: '',
    genero: '' as '' | 'M' | 'F',
    numero_filhos: '',
}

export const PessoalProvincialPage: React.FC = () => {
    const { direcaoProvincialProfile, isDirecaoProvincial, isFuncionarioProvincial } = useAuth()
    const canManage = isDirecaoProvincial && !isFuncionarioProvincial

    const [items, setItems] = useState<PessoalDirecaoProvincial[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
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
            const data = await fetchPessoalProvincial(direcaoProvincialProfile.id)
            setItems(data)
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao carregar pessoal'))
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
                p.nome.toLowerCase().includes(q) ||
                p.email.toLowerCase().includes(q) ||
                getDepartamentoProvincialLabel(p.departamento).toLowerCase().includes(q) ||
                (p.cargo || '').toLowerCase().includes(q),
        )
    }, [items, search])

    const openCreate = () => {
        setEditId(null)
        setForm(emptyForm)
        setShowModal(true)
    }

    const openEdit = (item: PessoalDirecaoProvincial) => {
        setEditId(item.id)
        setForm({
            nome: item.nome,
            email: item.email,
            telefone: item.telefone || '',
            numero_funcionario: item.numero_funcionario || '',
            departamento: item.departamento as DepartamentoProvincial,
            cargo: item.cargo || '',
            data_nascimento: item.data_nascimento || '',
            data_admissao: item.data_admissao || '',
            genero: (item.genero as '' | 'M' | 'F') || '',
            numero_filhos: item.numero_filhos != null ? String(item.numero_filhos) : '',
        })
        setShowModal(true)
    }

    const parseNumeroFilhos = (value: string) =>
        value === '' ? 0 : Math.max(0, Math.min(20, parseInt(value, 10) || 0))

    const handleCopyInvite = (item: PessoalDirecaoProvincial) => {
        const link = buildFuncionarioProvincialInviteLink(
            window.location.origin,
            item.email,
            item.departamento,
        )
        navigator.clipboard.writeText(link).then(
            () => {
                setSuccess('Link de convite copiado.')
                setTimeout(() => setSuccess(null), 3000)
            },
            () => setError('Não foi possível copiar o link.'),
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!direcaoProvincialProfile?.id || !canManage) return
        setSubmitting(true)
        setError(null)
        try {
            if (!form.nome.trim() || !form.email.trim()) {
                throw new Error('Nome e email são obrigatórios')
            }
            if (editId) {
                await updatePessoalProvincial(editId, {
                    nome: form.nome.trim(),
                    email: form.email.trim(),
                    telefone: form.telefone.trim() || null,
                    numero_funcionario: form.numero_funcionario.trim() || null,
                    departamento: form.departamento,
                    cargo: form.cargo.trim() || null,
                    data_nascimento: form.data_nascimento || null,
                    data_admissao: form.data_admissao || null,
                    genero: form.genero || null,
                    numero_filhos: parseNumeroFilhos(form.numero_filhos),
                })
                setSuccess('Funcionário actualizado.')
            } else {
                await createPessoalProvincial({
                    direcao_provincial_id: direcaoProvincialProfile.id,
                    nome: form.nome.trim(),
                    email: form.email.trim(),
                    telefone: form.telefone.trim() || null,
                    numero_funcionario: form.numero_funcionario.trim() || null,
                    departamento: form.departamento,
                    cargo: form.cargo.trim() || null,
                    ativo: true,
                    data_nascimento: form.data_nascimento || null,
                    data_admissao: form.data_admissao || null,
                    genero: form.genero || null,
                    numero_filhos: parseNumeroFilhos(form.numero_filhos),
                })
                setSuccess('Funcionário criado. Copie o link de convite para activar a conta.')
            }
            setShowModal(false)
            await load()
            setTimeout(() => setSuccess(null), 4000)
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao guardar'))
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async () => {
        if (!deleteId || !canManage) return
        try {
            await deletePessoalProvincial(deleteId)
            setDeleteId(null)
            setSuccess('Registo eliminado.')
            await load()
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao eliminar'))
        }
    }

    const toggleAtivo = async (item: PessoalDirecaoProvincial) => {
        if (!canManage) return
        try {
            await updatePessoalProvincial(item.id, { ativo: !item.ativo })
            await load()
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao actualizar estado'))
        }
    }

    return (
        <DpPage className="pb-24 md:pb-0">
            <DpHeader
                title="Pessoal Provincial"
                subtitle={
                    canManage
                        ? 'Crie contas por departamento e envie o convite de activação'
                        : 'Lista do pessoal da Direção Provincial'
                }
                icon={<Icons.Users className="w-6 h-6" />}
                accent="slate"
                actions={
                    canManage ? (
                        <DpButton onClick={openCreate} icon={<Icons.Plus className="w-4 h-4" />}>
                            Novo funcionário
                        </DpButton>
                    ) : undefined
                }
            />
            <DpContent>
                {error && <DpAlert tone="error">{error}</DpAlert>}
                {success && <DpAlert tone="success">{success}</DpAlert>}

                <DpSearch
                    value={search}
                    onChange={setSearch}
                    placeholder="Pesquisar por nome, email, departamento…"
                />

                {loading ? (
                    <DpLoading />
                ) : filtered.length === 0 ? (
                    <DpEmpty
                        title="Sem pessoal registado"
                        description={
                            canManage
                                ? 'Adicione o primeiro funcionário de um departamento.'
                                : 'Ainda não há registos visíveis.'
                        }
                    />
                ) : (
                    <div className="space-y-3">
                        {filtered.map((item) => (
                            <DpPanel
                                key={item.id}
                                className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold text-slate-900 truncate">{item.nome}</p>
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full ${
                                                item.ativo
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-slate-200 text-slate-600'
                                            }`}
                                        >
                                            {item.ativo ? 'Activo' : 'Inactivo'}
                                        </span>
                                        {item.user_id ? (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                                                Conta activa
                                            </span>
                                        ) : (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                                Aguarda convite
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-600 truncate">{item.email}</p>
                                    <p className="text-sm text-slate-500">
                                        {getDepartamentoProvincialLabel(item.departamento)}
                                        {item.cargo ? ` · ${item.cargo}` : ''}
                                    </p>
                                    <div className="mt-2 max-w-md">
                                        <TempoServicoReformaInfo
                                            dataNascimento={item.data_nascimento}
                                            dataInicioServico={item.data_admissao}
                                            genero={item.genero}
                                            numeroFilhos={item.numero_filhos}
                                            variant="compact"
                                        />
                                    </div>
                                </div>
                                {canManage && (
                                    <div className="flex items-center gap-1 shrink-0">
                                        <DpIconButton
                                            label="Copiar convite"
                                            onClick={() => handleCopyInvite(item)}
                                            className="!bg-slate-100 !text-slate-700 !shadow-none"
                                        >
                                            <Icons.Link className="w-4 h-4" />
                                        </DpIconButton>
                                        <DpIconButton
                                            label="Editar"
                                            onClick={() => openEdit(item)}
                                            className="!bg-slate-100 !text-slate-700 !shadow-none"
                                        >
                                            <Icons.Edit className="w-4 h-4" />
                                        </DpIconButton>
                                        <DpIconButton
                                            label={item.ativo ? 'Desactivar' : 'Activar'}
                                            onClick={() => toggleAtivo(item)}
                                            className="!bg-slate-100 !text-slate-700 !shadow-none"
                                        >
                                            {item.ativo ? (
                                                <Icons.X className="w-4 h-4" />
                                            ) : (
                                                <Icons.Check className="w-4 h-4" />
                                            )}
                                        </DpIconButton>
                                        <DpIconButton
                                            label="Eliminar"
                                            onClick={() => setDeleteId(item.id)}
                                            variant="danger"
                                        >
                                            <Icons.Trash className="w-4 h-4" />
                                        </DpIconButton>
                                    </div>
                                )}
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
                title={editId ? 'Editar funcionário' : 'Novo funcionário'}
                subtitle="Associe o colaborador a um departamento do Gabinete Provincial"
                icon={editId ? <Icons.Edit /> : <Icons.UserPlus />}
                accent="slate"
                size="lg"
                busy={submitting}
                badge={
                    <DpBadge tone={editId ? 'info' : 'success'}>
                        {editId ? 'Edição' : 'Novo registo'}
                    </DpBadge>
                }
                footer={
                    <DpModalFooter>
                        <DpButton
                            type="button"
                            variant="secondary"
                            onClick={() => setShowModal(false)}
                            disabled={submitting}
                            icon={<Icons.X />}
                            className="sm:min-w-[7.5rem]"
                        >
                            Cancelar
                        </DpButton>
                        <DpButton
                            type="submit"
                            form="dp-pessoal-form"
                            disabled={submitting}
                            icon={
                                submitting ? (
                                    <Icons.Spinner />
                                ) : editId ? (
                                    <Icons.Check />
                                ) : (
                                    <Icons.Send />
                                )
                            }
                            className="sm:min-w-[8.5rem]"
                        >
                            {submitting ? 'A guardar…' : editId ? 'Guardar alterações' : 'Criar e convidar'}
                        </DpButton>
                    </DpModalFooter>
                }
            >
                <form id="dp-pessoal-form" onSubmit={handleSubmit} className="space-y-4">
                    <DpFormSection
                        title="Identificação"
                        description="Dados de contacto usados no convite de activação da conta"
                    >
                        <DpInput
                            label="Nome completo"
                            icon={<Icons.User />}
                            value={form.nome}
                            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                            required
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <DpInput
                                label="Email"
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                required
                            />
                            <DpInput
                                label="Telefone"
                                type="tel"
                                value={form.telefone}
                                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                            />
                        </div>
                    </DpFormSection>
                    <DpFormSection
                        title="Colocação no Gabinete"
                        description="O departamento define o menu e as permissões após o login"
                    >
                        <DpSelect
                            label="Departamento"
                            icon={<Icons.Building />}
                            value={form.departamento}
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    departamento: e.target.value as DepartamentoProvincial,
                                }))
                            }
                            required
                        >
                            {DEPARTAMENTO_PROVINCIAL_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </DpSelect>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <DpInput
                                label="Cargo"
                                icon={<Icons.Briefcase />}
                                value={form.cargo}
                                onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                                placeholder="Ex.: Chefe de Departamento"
                            />
                            <DpInput
                                label="N.º de funcionário"
                                icon={<Icons.Hash />}
                                value={form.numero_funcionario}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, numero_funcionario: e.target.value }))
                                }
                            />
                        </div>
                    </DpFormSection>
                    <DpFormSection
                        title="Tempo de serviço e reforma"
                        description="Base legal: Decreto Presidencial n.º 299/20 (Arts. 4.º, 7.º e 9.º)"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <DpInput
                                label="Data de nascimento"
                                type="date"
                                icon={<Icons.Calendar />}
                                value={form.data_nascimento}
                                onChange={(e) => setForm((f) => ({ ...f, data_nascimento: e.target.value }))}
                            />
                            <DpInput
                                label="Data de admissão"
                                type="date"
                                icon={<Icons.Clock />}
                                value={form.data_admissao}
                                onChange={(e) => setForm((f) => ({ ...f, data_admissao: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <DpSelect
                                label="Género"
                                value={form.genero}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, genero: e.target.value as '' | 'M' | 'F' }))
                                }
                            >
                                <option value="">Selecione</option>
                                <option value="M">Masculino</option>
                                <option value="F">Feminino</option>
                            </DpSelect>
                            {form.genero === 'F' && (
                                <DpInput
                                    label="N.º de filhos (redução idade reforma)"
                                    type="number"
                                    min={0}
                                    max={20}
                                    value={form.numero_filhos}
                                    onChange={(e) => setForm((f) => ({ ...f, numero_filhos: e.target.value }))}
                                    placeholder="0"
                                />
                            )}
                        </div>
                        <TempoServicoReformaInfo
                            dataNascimento={form.data_nascimento}
                            dataInicioServico={form.data_admissao}
                            genero={form.genero}
                            numeroFilhos={parseNumeroFilhos(form.numero_filhos)}
                            variant="detail"
                        />
                    </DpFormSection>
                </form>
            </DpModal>

            <DpConfirmModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title="Eliminar funcionário"
                message="Tem a certeza? Esta acção remove o registo e não pode ser anulada."
                confirmText="Eliminar"
                variant="danger"
            />
        </DpPage>
    )
}

export default PessoalProvincialPage
