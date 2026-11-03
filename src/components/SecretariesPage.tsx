/*
component-meta:
  name: SecretariesPage
  description: Page for managing secretaries (secretarios)
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Card, CardBody } from './ui/Card'
import { Input } from './ui/Input'
import { Icons } from './ui/Icons'
import { translateError } from '../utils/translations'
import { ConfirmModal } from './ui/ConfirmModal'
import { FormModal } from './ui/FormModal'
import { useAuth } from '../contexts/AuthContext'
import { buildStaffInviteLink } from '../utils/staffAccess'

interface Secretario {
    id: string
    user_id?: string | null
    nome_completo: string
    email: string
    telefone: string
    numero_funcionario: string
    cargo?: string | null
    ativo: boolean
}

interface SecretariesPageProps {
    onNavigate?: (page: string) => void
    searchQuery?: string
}

export const SecretariesPage: React.FC<SecretariesPageProps> = ({ onNavigate: _onNavigate, searchQuery = '' }) => {
    const { escolaProfile } = useAuth()
    const [secretarios, setSecretarios] = useState<Secretario[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showConfirmDelete, setShowConfirmDelete] = useState(false)
    const [editMode, setEditMode] = useState(false)
    const [selectedSecretarioId, setSelectedSecretarioId] = useState<string | null>(null)
    const [secretarioToDelete, setSecretarioToDelete] = useState<string | null>(null)

    // Form data
    const [formData, setFormData] = useState({
        nome_completo: '',
        email: '',
        telefone: '',
        numero_funcionario: '',
    })

    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (escolaProfile) {
            loadSecretarios()
        }
    }, [escolaProfile])

    const handleCopyInvite = (secretario: Secretario) => {
        const inviteLink = buildStaffInviteLink(window.location.origin, secretario.email, secretario.cargo)

        navigator.clipboard.writeText(inviteLink).then(() => {
            setSuccess('Link de convite copiado para a área de transferência!')
            setTimeout(() => setSuccess(null), 3000)
        }).catch(() => {
            setError('Erro ao copiar link. Tente manualmente.')
        })
    }

    const loadSecretarios = async () => {
        if (!escolaProfile) return

        try {
            setLoading(true)
            setError(null)

            const { data, error } = await supabase
                .from('secretarios')
                .select('*')
                .eq('escola_id', escolaProfile.id)
                .order('nome_completo', { ascending: true })

            if (error) throw error

            setSecretarios(data || [])
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar secretários'
            setError(translateError(errorMessage))
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!escolaProfile) return

        setError(null)
        setSuccess(null)
        setSubmitting(true)

        try {
            // Validate required fields
            if (!formData.nome_completo || !formData.email) {
                throw new Error('Nome e Email são obrigatórios')
            }

            if (editMode && selectedSecretarioId) {
                // Update existing secretario
                const { error: updateError } = await supabase
                    .from('secretarios')
                    .update({
                        nome_completo: formData.nome_completo,
                        email: formData.email,
                        telefone: formData.telefone,
                        numero_funcionario: formData.numero_funcionario,
                    })
                    .eq('id', selectedSecretarioId)

                if (updateError) throw updateError
                setSuccess('Secretário atualizado com sucesso!')
            } else {
                // Create new secretario
                const { error: insertError } = await supabase
                    .from('secretarios')
                    .insert({
                        escola_id: escolaProfile.id,
                        nome_completo: formData.nome_completo,
                        email: formData.email,
                        telefone: formData.telefone,
                        numero_funcionario: formData.numero_funcionario,
                        ativo: true,
                    })

                if (insertError) throw insertError
                setSuccess('Secretário cadastrado com sucesso!')
            }

            setShowModal(false)
            resetForm()
            loadSecretarios()
        } catch (err) {
            console.error('Erro ao salvar secretário:', err)
            const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar secretário'
            setError(translateError(errorMessage))
        } finally {
            setSubmitting(false)
        }
    }

    const resetForm = () => {
        setEditMode(false)
        setSelectedSecretarioId(null)
        setFormData({
            nome_completo: '',
            email: '',
            telefone: '',
            numero_funcionario: '',
        })
    }

    const handleEdit = (secretario: Secretario) => {
        setEditMode(true)
        setSelectedSecretarioId(secretario.id)
        setFormData({
            nome_completo: secretario.nome_completo,
            email: secretario.email,
            telefone: secretario.telefone || '',
            numero_funcionario: secretario.numero_funcionario || '',
        })
        setShowModal(true)
    }

    const handleDeleteClick = (id: string) => {
        setSecretarioToDelete(id)
        setShowConfirmDelete(true)
    }

    const handleConfirmDelete = async () => {
        if (!secretarioToDelete) return

        try {
            const { error } = await supabase
                .from('secretarios')
                .delete()
                .eq('id', secretarioToDelete)

            if (error) throw error

            setSuccess('Secretário removido com sucesso!')
            setShowConfirmDelete(false)
            setSecretarioToDelete(null)
            loadSecretarios()
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao remover secretário'
            setError(translateError(errorMessage))
            setShowConfirmDelete(false)
            setSecretarioToDelete(null)
        }
    }

    // Filter secretarios based on search query
    const filteredSecretarios = secretarios.filter(sec =>
        sec.nome_completo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sec.email.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (loading) {
        return (
            <div className="space-y-6 animate-fade-in pb-24 md:pb-6">
                {/* Header Skeleton */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="skeleton w-12 h-12 rounded-xl"></div>
                        <div>
                            <div className="skeleton h-7 w-32 mb-2 rounded-lg"></div>
                            <div className="skeleton h-4 w-48 rounded"></div>
                        </div>
                    </div>
                    <div className="skeleton h-10 w-36 rounded-xl"></div>
                </div>
                {/* Grid Skeleton */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="card p-4">
                            <div className="flex items-start gap-3 mb-4">
                                <div className="skeleton w-12 h-12 rounded-xl"></div>
                                <div className="flex-1">
                                    <div className="skeleton h-5 w-32 mb-2 rounded"></div>
                                    <div className="skeleton h-3 w-40 rounded"></div>
                                </div>
                            </div>
                            <div className="space-y-2 mb-4">
                                <div className="skeleton h-10 w-full rounded-lg"></div>
                            </div>
                            <div className="flex gap-2">
                                <div className="skeleton h-10 flex-1 rounded-xl"></div>
                                <div className="skeleton h-10 w-10 rounded-xl"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4 md:space-y-6 pb-24 md:pb-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                        <Icons.User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-slate-900">Secretários</h2>
                        <p className="text-sm text-slate-500">Gerencie os secretários da escola</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        resetForm()
                        setShowModal(true)
                    }}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-medium rounded-xl transition-all duration-200 shadow-md shadow-emerald-500/25 min-h-touch touch-feedback w-full sm:w-auto"
                >
                    <Icons.UserPlus className="w-5 h-5" />
                    <span>Novo Secretário</span>
                </button>
            </div>

            {/* Messages */}
            {success && (
                <div className="alert alert-success animate-slide-down">
                    <Icons.Check />
                    <span className="ml-2 text-sm">{success}</span>
                </div>
            )}

            {error && (
                <div className="alert alert-error animate-slide-down">
                    <span className="ml-2 text-sm">{error}</span>
                </div>
            )}

            {/* Empty State */}
            {!loading && filteredSecretarios.length === 0 && !error ? (
                <Card>
                    <CardBody className="text-center py-12 md:py-16 px-6">
                        <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <Icons.User className="w-10 h-10 text-slate-400" />
                        </div>
                        <h3 className="text-lg md:text-xl font-semibold text-slate-900 mb-2">
                            {searchQuery ? 'Nenhum secretário encontrado' : 'Nenhum secretário cadastrado'}
                        </h3>
                        <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                            {searchQuery ? 'Tente pesquisar com outros termos' : 'Cadastre secretários para ajudar na gestão de alunos e pagamentos'}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={() => setShowModal(true)}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-medium rounded-xl transition-all duration-200 shadow-md shadow-emerald-500/25 min-h-touch touch-feedback"
                            >
                                <Icons.UserPlus className="w-5 h-5" />
                                Cadastrar Secretário
                            </button>
                        )}
                    </CardBody>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                    {filteredSecretarios.map((sec) => (
                        <Card key={sec.id} className="hover:shadow-lg transition-all duration-300 touch-feedback">
                            <CardBody className="p-4">
                                {/* Header with Avatar and Status */}
                                <div className="flex items-start gap-3 mb-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-teal-200 rounded-xl flex items-center justify-center text-lg font-bold text-emerald-700 flex-shrink-0">
                                        {sec.nome_completo.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-base font-semibold text-slate-900 truncate">{sec.nome_completo}</h3>
                                        <p className="text-xs text-slate-500 truncate">{sec.email}</p>
                                        <div className="flex items-center gap-1.5 mt-1.5">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${sec.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {sec.ativo ? 'Ativo' : 'Inativo'}
                                            </span>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${sec.user_id ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {sec.user_id ? 'Registado' : 'Pendente'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="space-y-2 mb-4">
                                    {sec.telefone && (
                                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                                            <Icons.Phone className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                            <span className="text-sm text-slate-700">{sec.telefone}</span>
                                        </div>
                                    )}
                                    {sec.numero_funcionario && (
                                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                                            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                                            </svg>
                                            <span className="text-sm text-slate-700">Nº {sec.numero_funcionario}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 pt-3 border-t border-slate-100">
                                    <button
                                        onClick={() => handleEdit(sec)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-all duration-200 touch-feedback min-h-touch"
                                    >
                                        <Icons.Edit className="w-4 h-4" />
                                        <span>Editar</span>
                                    </button>

                                    {!sec.user_id && (
                                        <button
                                            onClick={() => handleCopyInvite(sec)}
                                            className="flex items-center justify-center px-3 py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl transition-all duration-200 touch-feedback min-h-touch"
                                            title="Copiar link de convite"
                                        >
                                            <Icons.Link className="w-4 h-4" />
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handleDeleteClick(sec.id)}
                                        className="flex items-center justify-center px-3 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl transition-all duration-200 touch-feedback min-h-touch"
                                    >
                                        <Icons.Trash className="w-4 h-4" />
                                    </button>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}

            <FormModal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false)
                    resetForm()
                }}
                title={editMode ? 'Editar Secretário' : 'Novo Secretário'}
                subtitle={editMode ? 'Actualize os dados do secretário' : 'Preencha os dados para cadastrar'}
                icon={editMode ? <Icons.Edit /> : <Icons.UserPlus />}
                accent="emerald"
                size="md"
                busy={submitting}
            >
                            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3.5">
                                <Input
                                    label="Nome Completo"
                                    type="text"
                                    value={formData.nome_completo}
                                    onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                                    placeholder="Ex: Maria da Silva"
                                    required
                                />

                                <Input
                                    label="Email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="secretario@exemplo.com"
                                    required
                                />

                                <Input
                                    label="Telefone"
                                    type="tel"
                                    value={formData.telefone}
                                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                                    placeholder="+244 9..."
                                />

                                <Input
                                    label="Número de Funcionário"
                                    type="text"
                                    value={formData.numero_funcionario}
                                    onChange={(e) => setFormData({ ...formData, numero_funcionario: e.target.value })}
                                    placeholder="Número de identificação"
                                />

                                <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowModal(false)
                                            resetForm()
                                        }}
                                        className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-all duration-200 touch-feedback min-h-touch"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-medium rounded-xl transition-all duration-200 shadow-md shadow-emerald-500/25 disabled:opacity-50 touch-feedback min-h-touch"
                                    >
                                        {submitting ? (
                                            <>
                                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                A guardar...
                                            </>
                                        ) : (
                                            editMode ? 'Salvar' : 'Cadastrar'
                                        )}
                                    </button>
                                </div>
                            </form>
            </FormModal>

            {/* Confirm Delete Modal */}
            <ConfirmModal
                isOpen={showConfirmDelete}
                onClose={() => {
                    setShowConfirmDelete(false)
                    setSecretarioToDelete(null)
                }}
                onConfirm={handleConfirmDelete}
                title="Remover Secretário?"
                message="Tem certeza que deseja remover este secretário? Esta ação não pode ser desfeita."
                confirmText="Sim, Remover"
                cancelText="Cancelar"
                variant="danger"
            />
        </div>
    )
}
