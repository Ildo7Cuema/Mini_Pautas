/*
component-meta:
  name: ComponentesCatalogoManager
  description: Component to manage the school's evaluation components catalog
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Card, CardBody, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Icons } from './ui/Icons'
import { translateError } from '../utils/translations'
import { useAuth } from '../contexts/AuthContext'
import {
    SECONDARY_OFFICIAL_SCALE,
    getEscolaNaturezaFromConfig,
    isPrivateInstitution,
} from '../utils/angolaGradeScale'

interface ComponenteCatalogo {
    id: string
    codigo_componente: string
    nome: string
    peso_padrao: number
    escala_minima: number
    escala_maxima: number
    is_calculated: boolean
    formula_expression: string | null
    depends_on_codes: string[] | null
    tipo_calculo: 'trimestral' | 'anual'
    descricao: string | null
    usage_count: number
}

interface ComponentesCatalogoManagerProps {
    escolaId: string
    onClose?: () => void
}

export function ComponentesCatalogoManager({ escolaId, onClose }: ComponentesCatalogoManagerProps) {
    const { escolaProfile } = useAuth()
    const escolaNatureza = getEscolaNaturezaFromConfig(escolaProfile?.configuracoes as Record<string, unknown>)
    const scaleLocked = !isPrivateInstitution(escolaNatureza)
    const catalogDefaultMin = String(SECONDARY_OFFICIAL_SCALE.min)
    const catalogDefaultMax = String(SECONDARY_OFFICIAL_SCALE.max)

    const [componentes, setComponentes] = useState<ComponenteCatalogo[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [selectedComponente, setSelectedComponente] = useState<ComponenteCatalogo | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        codigo_componente: '',
        nome: '',
        peso_padrao: '100',
        escala_minima: catalogDefaultMin,
        escala_maxima: catalogDefaultMax,
        is_calculated: false,
        formula_expression: '',
        depends_on_codes: [] as string[],
        tipo_calculo: 'trimestral' as 'trimestral' | 'anual',
        descricao: ''
    })

    const resolveCatalogEscalas = () => {
        if (scaleLocked) {
            return {
                escala_minima: SECONDARY_OFFICIAL_SCALE.min,
                escala_maxima: SECONDARY_OFFICIAL_SCALE.max,
            }
        }
        return {
            escala_minima: parseFloat(formData.escala_minima),
            escala_maxima: parseFloat(formData.escala_maxima),
        }
    }

    useEffect(() => {
        loadComponentes()
    }, [escolaId])

    const loadComponentes = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase.rpc('get_componentes_catalogo_for_escola', {
                p_escola_id: escolaId
            })

            if (error) throw error
            setComponentes(data || [])
        } catch (err: any) {
            console.error('Erro ao carregar catálogo:', err)
            setError(translateError(err?.message || 'Erro ao carregar catálogo de componentes'))
        } finally {
            setLoading(false)
        }
    }

    const handleAddComponente = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(null)

        try {
            const escalas = resolveCatalogEscalas()
            const { error: insertError } = await supabase
                .from('componentes_catalogo')
                .insert({
                    escola_id: escolaId,
                    codigo_componente: formData.codigo_componente.toUpperCase().trim(),
                    nome: formData.nome,
                    peso_padrao: parseFloat(formData.peso_padrao),
                    escala_minima: escalas.escala_minima,
                    escala_maxima: escalas.escala_maxima,
                    is_calculated: formData.is_calculated,
                    formula_expression: formData.is_calculated ? formData.formula_expression : null,
                    depends_on_codes: formData.is_calculated ? formData.depends_on_codes : [],
                    tipo_calculo: formData.is_calculated ? formData.tipo_calculo : 'trimestral',
                    descricao: formData.descricao || null
                })

            if (insertError) throw insertError

            setSuccess('Componente adicionado ao catálogo com sucesso!')
            setShowAddModal(false)
            resetForm()
            loadComponentes()
            setTimeout(() => setSuccess(null), 3000)
        } catch (err: any) {
            console.error('Erro ao adicionar componente:', err)
            setError(translateError(err?.message || 'Erro ao adicionar componente'))
        }
    }

    const handleEditComponente = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedComponente) return

        setError(null)
        setSuccess(null)

        try {
            const escalas = resolveCatalogEscalas()
            const { error: updateError } = await supabase
                .from('componentes_catalogo')
                .update({
                    nome: formData.nome,
                    peso_padrao: parseFloat(formData.peso_padrao),
                    escala_minima: escalas.escala_minima,
                    escala_maxima: escalas.escala_maxima,
                    is_calculated: formData.is_calculated,
                    formula_expression: formData.is_calculated ? formData.formula_expression : null,
                    depends_on_codes: formData.is_calculated ? formData.depends_on_codes : [],
                    tipo_calculo: formData.is_calculated ? formData.tipo_calculo : 'trimestral',
                    descricao: formData.descricao || null
                })
                .eq('id', selectedComponente.id)

            if (updateError) throw updateError

            setSuccess('Componente atualizado com sucesso!')
            setShowEditModal(false)
            setSelectedComponente(null)
            resetForm()
            loadComponentes()
            setTimeout(() => setSuccess(null), 3000)
        } catch (err: any) {
            console.error('Erro ao atualizar componente:', err)
            setError(translateError(err?.message || 'Erro ao atualizar componente'))
        }
    }

    const handleDeleteComponente = async () => {
        if (!selectedComponente) return

        setError(null)
        setSuccess(null)

        try {
            // Check if component is in use
            if (selectedComponente.usage_count > 0) {
                setError(`Este componente está sendo usado em ${selectedComponente.usage_count} disciplina(s). Remova-o das disciplinas primeiro.`)
                setShowDeleteModal(false)
                return
            }

            const { error: deleteError } = await supabase
                .from('componentes_catalogo')
                .delete()
                .eq('id', selectedComponente.id)

            if (deleteError) throw deleteError

            setSuccess('Componente removido do catálogo com sucesso!')
            setShowDeleteModal(false)
            setSelectedComponente(null)
            loadComponentes()
            setTimeout(() => setSuccess(null), 3000)
        } catch (err: any) {
            console.error('Erro ao remover componente:', err)
            setError(translateError(err?.message || 'Erro ao remover componente'))
        }
    }

    const openEditModal = (componente: ComponenteCatalogo) => {
        setSelectedComponente(componente)
        setFormData({
            codigo_componente: componente.codigo_componente,
            nome: componente.nome,
            peso_padrao: componente.peso_padrao.toString(),
            escala_minima: scaleLocked ? catalogDefaultMin : componente.escala_minima.toString(),
            escala_maxima: scaleLocked ? catalogDefaultMax : componente.escala_maxima.toString(),
            is_calculated: componente.is_calculated,
            formula_expression: componente.formula_expression || '',
            depends_on_codes: componente.depends_on_codes || [],
            tipo_calculo: componente.tipo_calculo || 'trimestral',
            descricao: componente.descricao || ''
        })
        setShowEditModal(true)
    }

    const resetForm = () => {
        setFormData({
            codigo_componente: '',
            nome: '',
            peso_padrao: '100',
            escala_minima: catalogDefaultMin,
            escala_maxima: catalogDefaultMax,
            is_calculated: false,
            formula_expression: '',
            depends_on_codes: [],
            tipo_calculo: 'trimestral',
            descricao: ''
        })
    }

    const filteredComponentes = componentes.filter(c =>
        c.codigo_componente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.nome.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Group components by type
    const regularComponents = filteredComponentes.filter(c => !c.is_calculated)
    const calculatedComponents = filteredComponentes.filter(c => c.is_calculated)

    return (
        <div className="space-y-5 md:space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/20">
                        <Icons.List />
                    </div>
                    <div>
                        <h3 className="text-xl md:text-2xl font-bold text-slate-900">Catálogo de Componentes</h3>
                        <p className="text-sm text-slate-500">Gerencie os componentes de avaliação da escola</p>
                    </div>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="min-h-touch min-w-touch flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                    >
                        <Icons.X className="w-6 h-6" />
                    </button>
                )}
            </div>

            {/* Messages */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center shadow-sm animate-slide-down">
                    <Icons.AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                    <span className="flex-1 font-medium">{error}</span>
                    <button onClick={() => setError(null)} className="ml-2 p-1 hover:bg-red-100 rounded-lg transition-colors">
                        <Icons.X className="w-4 h-4" />
                    </button>
                </div>
            )}
            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center shadow-sm animate-slide-down">
                    <Icons.Check />
                    <span className="ml-2 font-medium">{success}</span>
                </div>
            )}

            {/* Info Banner */}
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                        <Icons.Info className="w-4 h-4 text-violet-600" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-violet-900">Como funciona o catálogo</h4>
                        <p className="text-sm text-violet-700 mt-1">
                            Os componentes definidos aqui ficam disponíveis para todas as disciplinas da escola.
                            Cada componente é criado uma única vez e pode ser reutilizado em várias disciplinas.
                        </p>
                    </div>
                </div>
            </div>

            {/* Search and Add */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                    <Input
                        type="text"
                        placeholder="Pesquisar componentes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                    <Icons.Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
                <Button
                    variant="primary"
                    onClick={() => {
                        resetForm()
                        setShowAddModal(true)
                    }}
                    className="whitespace-nowrap"
                >
                    <Icons.Plus className="w-5 h-5 mr-2" />
                    Novo Componente
                </Button>
            </div>

            {/* Components List */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-primary-600"></div>
                        <p className="mt-4 text-slate-500 font-medium">Carregando catálogo...</p>
                    </div>
                </div>
            ) : componentes.length === 0 ? (
                <Card className="border-0 shadow-md">
                    <CardBody className="text-center py-16 px-6">
                        <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-5">
                            <Icons.List className="w-10 h-10 text-violet-500" />
                        </div>
                        <h4 className="text-xl font-bold text-slate-800 mb-2">Catálogo vazio</h4>
                        <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                            Adicione os componentes de avaliação que serão usados nas disciplinas da escola
                        </p>
                        <Button variant="primary" onClick={() => setShowAddModal(true)}>
                            <Icons.Plus className="w-5 h-5 mr-2" />
                            Adicionar Primeiro Componente
                        </Button>
                    </CardBody>
                </Card>
            ) : (
                <div className="space-y-6">
                    {/* Regular Components */}
                    {regularComponents.length > 0 && (
                        <Card className="border-0 shadow-md overflow-hidden">
                            <CardHeader className="bg-slate-50 border-b border-slate-200">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                                        <Icons.Edit className="w-4 h-4 text-blue-600" />
                                    </div>
                                    Componentes de Lançamento
                                    <span className="text-sm font-normal text-slate-500">({regularComponents.length})</span>
                                </CardTitle>
                            </CardHeader>
                            <CardBody className="p-0">
                                <div className="divide-y divide-slate-200">
                                    {regularComponents.map(componente => (
                                        <ComponenteRow
                                            key={componente.id}
                                            componente={componente}
                                            onEdit={() => openEditModal(componente)}
                                            onDelete={() => {
                                                setSelectedComponente(componente)
                                                setShowDeleteModal(true)
                                            }}
                                        />
                                    ))}
                                </div>
                            </CardBody>
                        </Card>
                    )}

                    {/* Calculated Components */}
                    {calculatedComponents.length > 0 && (
                        <Card className="border-0 shadow-md overflow-hidden">
                            <CardHeader className="bg-slate-50 border-b border-slate-200">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                                        <Icons.Calculator className="w-4 h-4 text-amber-600" />
                                    </div>
                                    Componentes Calculados
                                    <span className="text-sm font-normal text-slate-500">({calculatedComponents.length})</span>
                                </CardTitle>
                            </CardHeader>
                            <CardBody className="p-0">
                                <div className="divide-y divide-slate-200">
                                    {calculatedComponents.map(componente => (
                                        <ComponenteRow
                                            key={componente.id}
                                            componente={componente}
                                            onEdit={() => openEditModal(componente)}
                                            onDelete={() => {
                                                setSelectedComponente(componente)
                                                setShowDeleteModal(true)
                                            }}
                                        />
                                    ))}
                                </div>
                            </CardBody>
                        </Card>
                    )}
                </div>
            )}

            {/* Add Modal */}
            {showAddModal && (
                <ComponenteFormModal
                    title="Adicionar Componente ao Catálogo"
                    formData={formData}
                    setFormData={setFormData}
                    onSubmit={handleAddComponente}
                    onClose={() => {
                        setShowAddModal(false)
                        resetForm()
                    }}
                    isEdit={false}
                    availableCodes={componentes.map(c => c.codigo_componente)}
                />
            )}

            {/* Edit Modal */}
            {showEditModal && selectedComponente && (
                <ComponenteFormModal
                    title="Editar Componente"
                    formData={formData}
                    setFormData={setFormData}
                    onSubmit={handleEditComponente}
                    onClose={() => {
                        setShowEditModal(false)
                        setSelectedComponente(null)
                        resetForm()
                    }}
                    isEdit={true}
                    availableCodes={componentes.filter(c => c.id !== selectedComponente.id).map(c => c.codigo_componente)}
                />
            )}

            {/* Delete Modal */}
            {showDeleteModal && selectedComponente && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scale-in">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                                <Icons.Trash className="w-8 h-8 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Remover Componente</h3>
                            <p className="text-slate-600">
                                Deseja remover o componente <strong>{selectedComponente.codigo_componente}</strong> do catálogo?
                            </p>
                            {selectedComponente.usage_count > 0 && (
                                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-sm text-amber-800">
                                        ⚠️ Este componente está sendo usado em {selectedComponente.usage_count} disciplina(s).
                                        Remova-o das disciplinas primeiro.
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <Button
                                variant="ghost"
                                className="flex-1"
                                onClick={() => {
                                    setShowDeleteModal(false)
                                    setSelectedComponente(null)
                                }}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="danger"
                                className="flex-1"
                                onClick={handleDeleteComponente}
                                disabled={selectedComponente.usage_count > 0}
                            >
                                Remover
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Component Row
function ComponenteRow({
    componente,
    onEdit,
    onDelete
}: {
    componente: ComponenteCatalogo
    onEdit: () => void
    onDelete: () => void
}) {
    return (
        <div className="p-4 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shadow-md ${componente.is_calculated
                        ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white'
                        : 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white'
                    }`}>
                    {componente.codigo_componente.substring(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900">{componente.codigo_componente}</h4>
                        {componente.is_calculated && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                Calculado
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-slate-500 truncate">{componente.nome}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span>Peso: {componente.peso_padrao}%</span>
                        <span>•</span>
                        <span>Escala: {componente.escala_minima}-{componente.escala_maxima}</span>
                        <span>•</span>
                        <span>{componente.usage_count} uso(s)</span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onEdit}
                        className="p-2.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all min-h-touch min-w-[44px] flex items-center justify-center"
                        title="Editar"
                    >
                        <Icons.Edit className="w-5 h-5" />
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all min-h-touch min-w-[44px] flex items-center justify-center"
                        title="Remover"
                    >
                        <Icons.Trash className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    )
}

// Form Modal
function ComponenteFormModal({
    title,
    formData,
    setFormData,
    onSubmit,
    onClose,
    isEdit,
    availableCodes
}: {
    title: string
    formData: any
    setFormData: (data: any) => void
    onSubmit: (e: React.FormEvent) => void
    onClose: () => void
    isEdit: boolean
    availableCodes: string[]
}) {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
                <div className="p-6 border-b border-slate-200">
                    <h3 className="text-xl font-bold text-slate-900">{title}</h3>
                </div>
                <form onSubmit={onSubmit} className="p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Código <span className="text-red-500">*</span>
                            </label>
                            <Input
                                type="text"
                                value={formData.codigo_componente}
                                onChange={(e) => setFormData({ ...formData, codigo_componente: e.target.value.toUpperCase() })}
                                placeholder="Ex: MAC, PP, PT"
                                required
                                disabled={isEdit}
                                maxLength={10}
                            />
                            {!isEdit && (
                                <p className="text-xs text-slate-500 mt-1">Não pode ser alterado depois</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Peso Padrão (%)
                            </label>
                            <Input
                                type="number"
                                value={formData.peso_padrao}
                                onChange={(e) => setFormData({ ...formData, peso_padrao: e.target.value })}
                                min="0"
                                max="100"
                                step="0.01"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Nome <span className="text-red-500">*</span>
                        </label>
                        <Input
                            type="text"
                            value={formData.nome}
                            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                            placeholder="Ex: Média de Avaliação Contínua"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Escala Mínima
                            </label>
                            <Input
                                type="number"
                                value={formData.escala_minima}
                                onChange={(e) => setFormData({ ...formData, escala_minima: e.target.value })}
                                min="0"
                                readOnly={scaleLocked}
                                disabled={scaleLocked}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Escala Máxima
                            </label>
                            <Input
                                type="number"
                                value={formData.escala_maxima}
                                onChange={(e) => setFormData({ ...formData, escala_maxima: e.target.value })}
                                min="0"
                                readOnly={scaleLocked}
                                disabled={scaleLocked}
                            />
                        </div>
                    </div>
                    {scaleLocked && (
                        <p className="text-xs text-slate-500 -mt-2">
                            Escala oficial RAA no catálogo (0–20). Nos templates do Ensino Primário a escala é forçada para 1–10.
                        </p>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Descrição</label>
                        <textarea
                            value={formData.descricao}
                            onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            rows={2}
                            placeholder="Descrição opcional do componente"
                        />
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.is_calculated}
                                onChange={(e) => setFormData({ ...formData, is_calculated: e.target.checked })}
                                className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                            />
                            <div>
                                <span className="font-medium text-slate-900">Componente Calculado</span>
                                <p className="text-xs text-slate-500">Valor é calculado automaticamente usando fórmula</p>
                            </div>
                        </label>
                    </div>

                    {formData.is_calculated && (
                        <div className="space-y-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Fórmula
                                </label>
                                <Input
                                    type="text"
                                    value={formData.formula_expression}
                                    onChange={(e) => setFormData({ ...formData, formula_expression: e.target.value })}
                                    placeholder="Ex: (PP + PT) / 2"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Use os códigos dos componentes: {availableCodes.slice(0, 5).join(', ')}{availableCodes.length > 5 ? '...' : ''}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Tipo de Cálculo
                                </label>
                                <select
                                    value={formData.tipo_calculo}
                                    onChange={(e) => setFormData({ ...formData, tipo_calculo: e.target.value })}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                >
                                    <option value="trimestral">Trimestral (MT - dentro do trimestre)</option>
                                    <option value="anual">Anual (MF - entre trimestres)</option>
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" variant="primary" className="flex-1">
                            {isEdit ? 'Salvar Alterações' : 'Adicionar ao Catálogo'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
