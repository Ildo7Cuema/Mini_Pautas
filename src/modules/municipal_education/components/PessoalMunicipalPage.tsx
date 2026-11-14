import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { Icons } from '../../../components/ui/Icons'
import { translateError } from '../../../utils/translations'
import type { DepartamentoMunicipal, PessoalDirecaoMunicipal } from '../../../types'
import {
    DEPARTAMENTO_MUNICIPAL_OPTIONS,
    buildFuncionarioMunicipalInviteLink,
    getDepartamentoMunicipalLabel,
} from '../../../utils/municipalStaffAccess'
import {
    createPessoalMunicipal,
    deletePessoalMunicipal,
    fetchPessoalMunicipal,
    updatePessoalMunicipal,
} from '../api/pessoalMunicipal'
import { TempoServicoReformaInfo } from '../../../components/TempoServicoReformaInfo'
import {
    DmAlert,
    DmBadge,
    DmButton,
    DmConfirmModal,
    DmContent,
    DmEmpty,
    DmFormSection,
    DmHeader,
    DmIconButton,
    DmInput,
    DmLoading,
    DmModal,
    DmModalFooter,
    DmPage,
    DmPanel,
    DmSearch,
    DmSelect,
} from './MunicipalChrome'

const emptyForm = {
    nome: '',
    email: '',
    telefone: '',
    numero_funcionario: '',
    departamento: 'EDUCACAO_ENSINO' as DepartamentoMunicipal,
    cargo: '',
    data_nascimento: '',
    data_admissao: '',
    genero: '' as '' | 'M' | 'F',
    numero_filhos: '',
}

export const PessoalMunicipalPage: React.FC = () => {
    const { direcaoMunicipalProfile, isDirecaoMunicipal, isFuncionarioMunicipal } = useAuth()
    const canManage = isDirecaoMunicipal && !isFuncionarioMunicipal

    const [items, setItems] = useState<PessoalDirecaoMunicipal[]>([])
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
        if (!direcaoMunicipalProfile?.id) {
            setItems([])
            setLoading(false)
            return
        }
        setLoading(true)
        setError(null)
        try {
            const data = await fetchPessoalMunicipal(direcaoMunicipalProfile.id)
            setItems(data)
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao carregar pessoal'))
        } finally {
            setLoading(false)
        }
    }, [direcaoMunicipalProfile?.id])

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
                getDepartamentoMunicipalLabel(p.departamento).toLowerCase().includes(q) ||
                (p.cargo || '').toLowerCase().includes(q),
        )
    }, [items, search])

    const openCreate = () => {
        setEditId(null)
        setForm(emptyForm)
        setShowModal(true)
    }

    const openEdit = (item: PessoalDirecaoMunicipal) => {
        setEditId(item.id)
        setForm({
            nome: item.nome,
            email: item.email,
            telefone: item.telefone || '',
            numero_funcionario: item.numero_funcionario || '',
            departamento: item.departamento as DepartamentoMunicipal,
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

    const handleCopyInvite = (item: PessoalDirecaoMunicipal) => {
        const link = buildFuncionarioMunicipalInviteLink(
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
        if (!direcaoMunicipalProfile?.id || !canManage) return
        setSubmitting(true)
        setError(null)
        try {
            if (!form.nome.trim() || !form.email.trim()) {
                throw new Error('Nome e email são obrigatórios')
            }
            if (editId) {
                await updatePessoalMunicipal(editId, {
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
                await createPessoalMunicipal({
                    direcao_municipal_id: direcaoMunicipalProfile.id,
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
            await deletePessoalMunicipal(deleteId)
            setDeleteId(null)
            setSuccess('Registo eliminado.')
            await load()
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao eliminar'))
        }
    }

    const toggleAtivo = async (item: PessoalDirecaoMunicipal) => {
        if (!canManage) return
        try {
            await updatePessoalMunicipal(item.id, { ativo: !item.ativo })
            await load()
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao actualizar estado'))
        }
    }

    return (
        <DmPage className="pb-24 md:pb-0">
            <DmHeader
                title="Pessoal Municipal"
                subtitle={
                    canManage
                        ? 'Crie contas por secção (Decreto 35/23) e envie o convite de activação'
                        : 'Lista do pessoal da Direção Municipal'
                }
                icon={<Icons.Users className="w-6 h-6" />}
                accent="emerald"
                actions={
                    canManage ? (
                        <DmButton onClick={openCreate} icon={<Icons.Plus className="w-4 h-4" />}>
                            Novo funcionário
                        </DmButton>
                    ) : undefined
                }
            />
            <DmContent>
                {error && <DmAlert tone="error">{error}</DmAlert>}
                {success && <DmAlert tone="success">{success}</DmAlert>}

                <DmSearch
                    value={search}
                    onChange={setSearch}
                    placeholder="Pesquisar por nome, email, secção…"
                />

                {loading ? (
                    <DmLoading />
                ) : filtered.length === 0 ? (
                    <DmEmpty
                        title="Sem pessoal registado"
                        description={
                            canManage
                                ? 'Adicione o primeiro funcionário de uma secção.'
                                : 'Ainda não há registos visíveis.'
                        }
                    />
                ) : (
                    <div className="space-y-3">
                        {filtered.map((item) => (
                            <DmPanel
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
                                        {getDepartamentoMunicipalLabel(item.departamento)}
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
                                        <DmIconButton
                                            label="Copiar convite"
                                            onClick={() => handleCopyInvite(item)}
                                            className="!bg-slate-100 !text-slate-700 !shadow-none"
                                        >
                                            <Icons.Link className="w-4 h-4" />
                                        </DmIconButton>
                                        <DmIconButton
                                            label="Editar"
                                            onClick={() => openEdit(item)}
                                            className="!bg-slate-100 !text-slate-700 !shadow-none"
                                        >
                                            <Icons.Edit className="w-4 h-4" />
                                        </DmIconButton>
                                        <DmIconButton
                                            label={item.ativo ? 'Desactivar' : 'Activar'}
                                            onClick={() => toggleAtivo(item)}
                                            className="!bg-slate-100 !text-slate-700 !shadow-none"
                                        >
                                            {item.ativo ? (
                                                <Icons.X className="w-4 h-4" />
                                            ) : (
                                                <Icons.Check className="w-4 h-4" />
                                            )}
                                        </DmIconButton>
                                        <DmIconButton
                                            label="Eliminar"
                                            onClick={() => setDeleteId(item.id)}
                                            variant="danger"
                                        >
                                            <Icons.Trash className="w-4 h-4" />
                                        </DmIconButton>
                                    </div>
                                )}
                            </DmPanel>
                        ))}
                    </div>
                )}
            </DmContent>

            <DmModal
                isOpen={showModal}
                onClose={() => {
                    if (!submitting) setShowModal(false)
                }}
                title={editId ? 'Editar funcionário' : 'Novo funcionário'}
                subtitle="Associe o colaborador a uma secção da Direção Municipal"
                icon={editId ? <Icons.Edit /> : <Icons.UserPlus />}
                accent="emerald"
                size="lg"
                busy={submitting}
                badge={
                    <DmBadge tone={editId ? 'info' : 'success'}>
                        {editId ? 'Edição' : 'Novo registo'}
                    </DmBadge>
                }
                footer={
                    <DmModalFooter>
                        <DmButton
                            type="button"
                            variant="secondary"
                            onClick={() => setShowModal(false)}
                            disabled={submitting}
                            icon={<Icons.X />}
                            className="sm:min-w-[7.5rem]"
                        >
                            Cancelar
                        </DmButton>
                        <DmButton
                            type="submit"
                            form="dm-pessoal-form"
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
                        </DmButton>
                    </DmModalFooter>
                }
            >
                <form id="dm-pessoal-form" onSubmit={handleSubmit} className="space-y-4">
                    <DmFormSection
                        title="Identificação"
                        description="Dados de contacto usados no convite de activação da conta"
                    >
                        <DmInput
                            label="Nome completo"
                            icon={<Icons.User />}
                            value={form.nome}
                            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                            required
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <DmInput
                                label="Email"
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                required
                            />
                            <DmInput
                                label="Telefone"
                                type="tel"
                                value={form.telefone}
                                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                            />
                        </div>
                    </DmFormSection>
                    <DmFormSection
                        title="Colocação na Direção"
                        description="A secção define o menu e as permissões após o login"
                    >
                        <DmSelect
                            label="Secção"
                            icon={<Icons.Building />}
                            value={form.departamento}
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    departamento: e.target.value as DepartamentoMunicipal,
                                }))
                            }
                            required
                        >
                            {DEPARTAMENTO_MUNICIPAL_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </DmSelect>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <DmInput
                                label="Cargo"
                                icon={<Icons.Briefcase />}
                                value={form.cargo}
                                onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                                placeholder="Ex.: Chefe de Secção"
                            />
                            <DmInput
                                label="N.º de funcionário"
                                icon={<Icons.Hash />}
                                value={form.numero_funcionario}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, numero_funcionario: e.target.value }))
                                }
                            />
                        </div>
                    </DmFormSection>
                    <DmFormSection
                        title="Tempo de serviço e reforma"
                        description="Base legal: Decreto Presidencial n.º 299/20 (Arts. 4.º, 7.º e 9.º)"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <DmInput
                                label="Data de nascimento"
                                type="date"
                                icon={<Icons.Calendar />}
                                value={form.data_nascimento}
                                onChange={(e) => setForm((f) => ({ ...f, data_nascimento: e.target.value }))}
                            />
                            <DmInput
                                label="Data de admissão"
                                type="date"
                                icon={<Icons.Clock />}
                                value={form.data_admissao}
                                onChange={(e) => setForm((f) => ({ ...f, data_admissao: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <DmSelect
                                label="Género"
                                value={form.genero}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, genero: e.target.value as '' | 'M' | 'F' }))
                                }
                            >
                                <option value="">Selecione</option>
                                <option value="M">Masculino</option>
                                <option value="F">Feminino</option>
                            </DmSelect>
                            {form.genero === 'F' && (
                                <DmInput
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
                    </DmFormSection>
                </form>
            </DmModal>

            <DmConfirmModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title="Eliminar funcionário"
                message="Tem a certeza? Esta acção remove o registo e não pode ser anulada."
                confirmText="Eliminar"
                variant="danger"
            />
        </DmPage>
    )
}

export default PessoalMunicipalPage
