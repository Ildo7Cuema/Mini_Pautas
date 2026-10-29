/*
component-meta:
  name: ComponenteSelectorModal
  description: Modal to select or create a component from the catalog to add to a discipline
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
*/

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Icons } from './ui/Icons'
import { translateError } from '../utils/translations'

interface ComponenteCatalogo {
    id: string
    codigo_componente: string
    nome: string
    peso_padrao: number
    is_calculated: boolean
    formula_expression?: string | null
    tipo_calculo: string
}

export interface ComponenteSelectorModalProps {
    escolaId: string
    disciplinaId?: string // Optional for templates
    trimestre: number
    turmaId?: string // Optional for templates
    onSelect: (data: {
        disciplina_componente_id?: string
        componente_catalogo_id: string
        is_new: boolean
        componente: ComponenteCatalogo
    }) => void
    onClose: () => void
    existingCodes?: string[]
    onTrimestreChange?: (trimestre: number) => void
    disableAssociation?: boolean // If true, only returns the catalog component without associating
}

export function ComponenteSelectorModal({
    escolaId,
    disciplinaId,
    trimestre,
    turmaId,
    onSelect,
    onClose,
    existingCodes = [],
    onTrimestreChange,
    disableAssociation = false
}: ComponenteSelectorModalProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [catalogComponents, setCatalogComponents] = useState<ComponenteCatalogo[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [mode, setMode] = useState<'select' | 'create' | 'edit'>('select')

    // Edit / delete (correção de erros de cadastro)
    const [editing, setEditing] = useState<ComponenteCatalogo | null>(null)
    const [editForm, setEditForm] = useState({
        nome: '',
        peso_padrao: '100',
        is_calculated: false,
        formula_expression: '',
        tipo_calculo: 'trimestral' as 'trimestral' | 'anual'
    })
    const [deleteTarget, setDeleteTarget] = useState<ComponenteCatalogo | null>(null)
    const [busy, setBusy] = useState(false)


    // Form for new component
    const [newComponent, setNewComponent] = useState({
        codigo_componente: '',
        nome: '',
        peso_percentual: '100',
        is_calculated: false,
        formula_expression: '',
        tipo_calculo: 'trimestral' as 'trimestral' | 'anual'
    })

    useEffect(() => {
        loadCatalog()
    }, [escolaId])

    const loadCatalog = async () => {
        try {
            setLoading(true)
            console.log('Loading catalog for escola:', escolaId)

            const { data, error } = await supabase.rpc('get_componentes_catalogo_for_escola', {
                p_escola_id: escolaId
            })

            console.log('Catalog response:', { data, error })

            if (error) throw error
            setCatalogComponents(data || [])
        } catch (err: any) {
            console.error('Erro ao carregar catálogo:', err)
            setError(translateError(err?.message || 'Erro ao carregar catálogo'))
        } finally {
            setLoading(false)
        }
    }

    const handleSelectFromCatalog = async (componente: ComponenteCatalogo) => {
        try {
            setError(null)

            if (disableAssociation) {
                // Return just the component data
                onSelect({
                    componente_catalogo_id: componente.id,
                    is_new: false,
                    componente
                })
                return
            }

            if (!disciplinaId) {
                throw new Error('Disciplina ID is required for association')
            }

            // Associate component to discipline
            const { data, error } = await supabase.rpc('associate_componente_to_disciplina', {
                p_disciplina_id: disciplinaId,
                p_componente_catalogo_id: componente.id,
                p_trimestre: trimestre,
                p_peso_percentual: componente.peso_padrao,
                p_ordem: 1, // Default order
                p_obrigatorio: true // Default
            })

            if (error) throw error

            // Also add to componentes_avaliacao for backwards compatibility if needed
            if (turmaId) {
                // Try to insert; if the record already exists (ON CONFLICT) do nothing —
                // the targeted update below guarantees the calculated fields are always correct.
                await supabase.from('componentes_avaliacao').insert({
                    disciplina_id: disciplinaId,
                    turma_id: turmaId,
                    nome: componente.nome,
                    codigo_componente: componente.codigo_componente,
                    peso_percentual: componente.peso_padrao,
                    trimestre: trimestre,
                    is_calculated: componente.is_calculated,
                    formula_expression: componente.formula_expression ?? null,
                    tipo_calculo: componente.tipo_calculo || 'trimestral'
                }).onConflict('disciplina_id, codigo_componente, trimestre').doNothing()

                // Always sync the calculated fields from the catalog in case the record
                // already existed with stale data (e.g. is_calculated = false by DEFAULT).
                if (componente.is_calculated) {
                    await supabase.from('componentes_avaliacao')
                        .update({
                            is_calculated: true,
                            formula_expression: componente.formula_expression ?? null,
                            tipo_calculo: componente.tipo_calculo || 'trimestral'
                        })
                        .eq('disciplina_id', disciplinaId)
                        .eq('codigo_componente', componente.codigo_componente)
                        .eq('trimestre', trimestre)
                        .eq('turma_id', turmaId)
                }
            }

            onSelect({
                disciplina_componente_id: data, // associate_componente_to_disciplina returns UUID directly
                componente_catalogo_id: componente.id,
                is_new: false,
                componente
            })

        } catch (err: any) {
            console.error('Erro ao associar componente:', err)
            setError(translateError(err?.message || 'Erro ao associar componente'))
        }
    }

    const handleCreateNew = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        // Um componente calculado precisa de fórmula (exigido por check_calculated_has_formula)
        if (newComponent.is_calculated && !newComponent.formula_expression.trim()) {
            setError('Indique a fórmula do componente calculado ou desmarque "Componente Calculado".')
            return
        }

        try {
            const peso = parseFloat(newComponent.peso_percentual)

            if (disableAssociation) {
                // Create in catalog ONLY
                const { data: componenteId, error } = await supabase.rpc('get_or_create_componente_catalogo', {
                    p_escola_id: escolaId,
                    p_codigo_componente: newComponent.codigo_componente.toUpperCase().trim(),
                    p_nome: newComponent.nome,
                    p_peso_padrao: peso,
                    p_is_calculated: newComponent.is_calculated,
                    p_formula_expression: newComponent.is_calculated ? newComponent.formula_expression : null,
                    p_tipo_calculo: newComponent.is_calculated ? newComponent.tipo_calculo : 'trimestral'
                })

                if (error) throw error

                // Se o código já existia no catálogo mas tinha sido retirado (ativo = false)
                // ao apagar o componente, volta a ativá-lo com os dados agora informados:
                // o utilizador está a recriá-lo (o RPC não actualiza registos existentes).
                await supabase
                    .from('componentes_catalogo')
                    .update({
                        ativo: true,
                        nome: newComponent.nome,
                        peso_padrao: peso,
                        is_calculated: newComponent.is_calculated,
                        formula_expression: newComponent.is_calculated ? newComponent.formula_expression.trim() : null,
                        tipo_calculo: newComponent.is_calculated ? newComponent.tipo_calculo : 'trimestral'
                    })
                    .eq('id', componenteId)
                    .eq('ativo', false)

                // Construct component object to return
                const newCompObj: ComponenteCatalogo = {
                    id: componenteId,
                    codigo_componente: newComponent.codigo_componente.toUpperCase().trim(),
                    nome: newComponent.nome,
                    peso_padrao: peso,
                    is_calculated: newComponent.is_calculated,
                    formula_expression: newComponent.is_calculated ? newComponent.formula_expression.trim() : null,
                    tipo_calculo: newComponent.is_calculated ? newComponent.tipo_calculo : 'trimestral'
                }

                onSelect({
                    componente_catalogo_id: componenteId,
                    is_new: true,
                    componente: newCompObj
                })
                return
            }

            if (!disciplinaId) throw new Error('Disciplina ID required')

            // Add component to discipline (will create in catalog if needed)
            const { data, error } = await supabase.rpc('add_componente_to_disciplina', {
                p_disciplina_id: disciplinaId,
                p_codigo_componente: newComponent.codigo_componente.toUpperCase().trim(),
                p_nome: newComponent.nome,
                p_trimestre: trimestre,
                p_peso_percentual: peso,
                p_is_calculated: newComponent.is_calculated,
                p_formula_expression: newComponent.is_calculated ? newComponent.formula_expression : null,
                p_tipo_calculo: newComponent.is_calculated ? newComponent.tipo_calculo : 'trimestral'
            })

            if (error) throw error

            // Also add to componentes_avaliacao for backwards compatibility
            if (turmaId) {
                const codigoNorm = newComponent.codigo_componente.toUpperCase().trim()
                await supabase.from('componentes_avaliacao').insert({
                    disciplina_id: disciplinaId,
                    turma_id: turmaId,
                    nome: newComponent.nome,
                    codigo_componente: codigoNorm,
                    peso_percentual: peso,
                    trimestre: trimestre,
                    is_calculated: newComponent.is_calculated,
                    formula_expression: newComponent.is_calculated ? newComponent.formula_expression : null,
                    tipo_calculo: newComponent.is_calculated ? newComponent.tipo_calculo : 'trimestral'
                }).onConflict('disciplina_id, codigo_componente, trimestre').doNothing()

                // Always sync calculated fields in case record already existed with stale data.
                if (newComponent.is_calculated) {
                    await supabase.from('componentes_avaliacao')
                        .update({
                            is_calculated: true,
                            formula_expression: newComponent.formula_expression || null,
                            tipo_calculo: newComponent.tipo_calculo || 'trimestral'
                        })
                        .eq('disciplina_id', disciplinaId)
                        .eq('codigo_componente', codigoNorm)
                        .eq('trimestre', trimestre)
                        .eq('turma_id', turmaId)
                }
            }

            if (data && data.length > 0) {
                const createdComp: ComponenteCatalogo = {
                    id: data[0].componente_catalogo_id,
                    codigo_componente: newComponent.codigo_componente.toUpperCase().trim(),
                    nome: newComponent.nome,
                    peso_padrao: peso,
                    is_calculated: newComponent.is_calculated,
                    formula_expression: newComponent.is_calculated ? newComponent.formula_expression.trim() : null,
                    tipo_calculo: newComponent.is_calculated ? newComponent.tipo_calculo : 'trimestral'
                }

                onSelect({
                    disciplina_componente_id: data[0].disciplina_componente_id,
                    componente_catalogo_id: data[0].componente_catalogo_id,
                    is_new: data[0].is_new_component,
                    componente: createdComp
                })
            }
        } catch (err: any) {
            console.error('Erro ao criar componente:', err)
            setError(translateError(err?.message || 'Erro ao criar componente'))
        }
    }

    // ---- Editar componente do catálogo (corrigir erros de cadastro) ----
    const openEdit = (comp: ComponenteCatalogo) => {
        setError(null)
        setEditing(comp)
        setEditForm({
            nome: comp.nome,
            peso_padrao: String(comp.peso_padrao ?? 100),
            is_calculated: comp.is_calculated,
            formula_expression: comp.formula_expression || '',
            tipo_calculo: comp.tipo_calculo === 'anual' ? 'anual' : 'trimestral'
        })
        setMode('edit')
    }

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editing) return
        setError(null)

        const peso = parseFloat(editForm.peso_padrao)
        if (!editForm.nome.trim()) {
            setError('Indique o nome do componente.')
            return
        }
        if (isNaN(peso) || peso < 0 || peso > 100) {
            setError('O peso deve estar entre 0 e 100%.')
            return
        }
        if (editForm.is_calculated && !editForm.formula_expression.trim()) {
            setError('Indique a fórmula do componente calculado ou desmarque "Componente Calculado".')
            return
        }

        try {
            setBusy(true)
            const { data, error } = await supabase
                .from('componentes_catalogo')
                .update({
                    nome: editForm.nome.trim(),
                    peso_padrao: peso,
                    is_calculated: editForm.is_calculated,
                    formula_expression: editForm.is_calculated ? editForm.formula_expression.trim() : null,
                    tipo_calculo: editForm.is_calculated ? editForm.tipo_calculo : 'trimestral'
                })
                .eq('id', editing.id)
                .select('id')

            if (error) throw error
            if (!data || data.length === 0) throw new Error('Não foi possível actualizar o componente (sem permissão).')

            setEditing(null)
            setMode('select')
            await loadCatalog()
        } catch (err: any) {
            console.error('Erro ao editar componente:', err)
            setError(translateError(err?.message || 'Erro ao editar componente'))
        } finally {
            setBusy(false)
        }
    }

    // ---- Eliminar componente do catálogo ----

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        setError(null)

        try {
            setBusy(true)
            const { data, error } = await supabase
                .from('componentes_catalogo')
                .delete()
                .eq('id', deleteTarget.id)
                .select('id')

            if (error) {
                // 23503 = ainda referenciado por outros registos (ex.: associações antigas a disciplinas):
                // não se pode apagar, por isso apenas retira do catálogo (deixa de aparecer na lista)
                if (error.code === '23503') {
                    const { data: soft, error: softError } = await supabase
                        .from('componentes_catalogo')
                        .update({ ativo: false })
                        .eq('id', deleteTarget.id)
                        .select('id')
                    if (softError) throw softError
                    if (!soft || soft.length === 0) throw new Error('Não foi possível eliminar o componente (sem permissão).')
                } else {
                    throw error
                }
            } else if (!data || data.length === 0) {
                throw new Error('Não foi possível eliminar o componente (sem permissão).')
            }

            setDeleteTarget(null)
            await loadCatalog()
        } catch (err: any) {
            console.error('Erro ao eliminar componente:', err)
            setError(translateError(err?.message || 'Erro ao eliminar componente'))
            setDeleteTarget(null)
        } finally {
            setBusy(false)
        }
    }

    const renderActions = (comp: ComponenteCatalogo) => (
        <div className="flex items-center gap-1 flex-shrink-0">
            <button
                type="button"
                onClick={() => openEdit(comp)}
                title="Editar componente"
                aria-label={`Editar ${comp.codigo_componente}`}
                className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
                <Icons.Edit className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => { setError(null); setDeleteTarget(comp) }}
                title="Eliminar componente"
                aria-label={`Eliminar ${comp.codigo_componente}`}
                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
                <Icons.Trash className="w-4 h-4" />
            </button>
        </div>
    )

    // Filter components: search term and not already added
    const filteredComponents = catalogComponents.filter(c =>
        !existingCodes.includes(c.codigo_componente) &&
        (c.codigo_componente.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.nome.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    // Group by type
    const regularComponents = filteredComponents.filter(c => !c.is_calculated)
    const calculatedComponents = filteredComponents.filter(c => c.is_calculated)

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">
                            {mode === 'select' ? 'Selecionar Componente' : mode === 'edit' ? 'Editar Componente' : 'Criar Novo Componente'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-slate-500">Trimestre:</span>
                            <select
                                value={trimestre}
                                onChange={(e) => onTrimestreChange && onTrimestreChange(parseInt(e.target.value))}
                                className="text-sm border-slate-300 rounded-lg py-1 pl-2 pr-8 focus:ring-primary-500 focus:border-primary-500"
                                disabled={!onTrimestreChange}
                            >
                                <option value={1}>1º Trimestre</option>
                                <option value={2}>2º Trimestre</option>
                                <option value="3">3º Trimestre</option>
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                    >
                        <Icons.X className="w-5 h-5" />
                    </button>
                </div>

                {/* Mode Tabs */}
                <div className="px-6 pt-4 flex gap-2">
                    <button
                        onClick={() => setMode('select')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${mode === 'select'
                            ? 'bg-primary-100 text-primary-700'
                            : 'text-slate-600 hover:bg-slate-100'
                            }`}
                    >
                        Selecionar do Catálogo
                    </button>
                    <button
                        onClick={() => setMode('create')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${mode === 'create'
                            ? 'bg-primary-100 text-primary-700'
                            : 'text-slate-600 hover:bg-slate-100'
                            }`}
                    >
                        Criar Novo
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center">
                        <Icons.AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                        <span className="flex-1">{error}</span>
                        <button onClick={() => setError(null)}>
                            <Icons.X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {mode === 'select' ? (
                        <>
                            {/* Search */}
                            <div className="relative mb-4">
                                <Input
                                    type="text"
                                    placeholder="Pesquisar componentes..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                                <Icons.Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-primary-600"></div>
                                </div>
                            ) : filteredComponents.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <Icons.List className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <p className="text-slate-500">
                                        {searchTerm ? 'Nenhum componente encontrado' : 'Catálogo vazio'}
                                    </p>
                                    <Button
                                        variant="ghost"
                                        className="mt-3"
                                        onClick={() => setMode('create')}
                                    >
                                        <Icons.Plus className="w-4 h-4 mr-2" />
                                        Criar novo componente
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Regular Components */}
                                    {regularComponents.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-2">
                                                <Icons.Edit className="w-4 h-4" />
                                                Componentes de Lançamento
                                            </h4>
                                            <div className="grid gap-2">
                                                {regularComponents.map(comp => (
                                                    <div
                                                        key={comp.id}
                                                        className="flex items-center gap-2 w-full p-3 bg-slate-50 hover:bg-primary-50 border border-slate-200 hover:border-primary-300 rounded-xl transition-all group"
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSelectFromCatalog(comp)}
                                                            className="flex-1 min-w-0 text-left"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm">
                                                                    {comp.codigo_componente.substring(0, 2)}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-semibold text-slate-900 group-hover:text-primary-700">
                                                                        {comp.codigo_componente}
                                                                    </div>
                                                                    <div className="text-sm text-slate-500 truncate">{comp.nome}</div>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-1">
                                                                    <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        Adicionar
                                                                    </span>
                                                                    <Icons.Plus className="w-5 h-5 text-slate-400 group-hover:text-primary-600" />
                                                                </div>
                                                            </div>
                                                        </button>
                                                        {renderActions(comp)}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Calculated Components */}
                                    {calculatedComponents.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-2">
                                                <Icons.Calculator className="w-4 h-4" />
                                                Componentes Calculados
                                            </h4>
                                            <div className="grid gap-2">
                                                {calculatedComponents.map(comp => (
                                                    <div
                                                        key={comp.id}
                                                        className="flex items-center gap-2 w-full p-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 hover:border-amber-300 rounded-xl transition-all group"
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSelectFromCatalog(comp)}
                                                            className="flex-1 min-w-0 text-left"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center font-bold text-amber-700 text-sm">
                                                                    {comp.codigo_componente.substring(0, 2)}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-semibold text-slate-900 group-hover:text-amber-700">
                                                                        {comp.codigo_componente}
                                                                    </div>
                                                                    <div className="text-sm text-slate-500 truncate">{comp.nome}</div>
                                                                </div>
                                                                <span className="text-xs px-2 py-1 rounded-full bg-amber-200 text-amber-800">
                                                                    {comp.tipo_calculo === 'anual' ? 'Anual' : 'Trimestral'}
                                                                </span>
                                                                <div className="flex flex-col items-end gap-1">
                                                                    <span className="text-xs font-semibold text-amber-600 bg-amber-100/50 px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        Adicionar
                                                                    </span>
                                                                    <Icons.Plus className="w-5 h-5 text-slate-400 group-hover:text-amber-600" />
                                                                </div>
                                                            </div>
                                                        </button>
                                                        {renderActions(comp)}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : mode === 'edit' && editing ? (
                        <form onSubmit={handleSaveEdit} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Código</label>
                                    <Input type="text" value={editing.codigo_componente} disabled readOnly />
                                    <p className="text-xs text-slate-400 mt-1">
                                        O código não pode ser alterado. Para corrigi-lo, elimine e crie de novo.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Peso (%)</label>
                                    <Input
                                        type="number"
                                        value={editForm.peso_padrao}
                                        onChange={(e) => setEditForm({ ...editForm, peso_padrao: e.target.value })}
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
                                    value={editForm.nome}
                                    onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={editForm.is_calculated}
                                        onChange={(e) => setEditForm({ ...editForm, is_calculated: e.target.checked })}
                                        className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                    />
                                    <div>
                                        <span className="font-medium text-slate-900">Componente Calculado</span>
                                        <p className="text-xs text-slate-500">Valor é calculado automaticamente</p>
                                    </div>
                                </label>
                            </div>

                            {editForm.is_calculated && (
                                <div className="space-y-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Fórmula</label>
                                        <Input
                                            type="text"
                                            value={editForm.formula_expression}
                                            onChange={(e) => setEditForm({ ...editForm, formula_expression: e.target.value })}
                                            placeholder="Ex: (PP + PT) / 2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de Cálculo</label>
                                        <select
                                            value={editForm.tipo_calculo}
                                            onChange={(e) => setEditForm({ ...editForm, tipo_calculo: e.target.value as 'trimestral' | 'anual' })}
                                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                        >
                                            <option value="trimestral">Trimestral (MT)</option>
                                            <option value="anual">Anual (MF)</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="flex-1"
                                    onClick={() => { setEditing(null); setMode('select'); setError(null) }}
                                >
                                    Cancelar
                                </Button>
                                <Button type="submit" variant="primary" className="flex-1" disabled={busy}>
                                    {busy ? 'A guardar...' : 'Guardar alterações'}
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleCreateNew} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Código <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        type="text"
                                        value={newComponent.codigo_componente}
                                        onChange={(e) => setNewComponent({ ...newComponent, codigo_componente: e.target.value.toUpperCase() })}
                                        placeholder="Ex: MAC, PP, PT"
                                        required
                                        maxLength={10}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Peso (%)
                                    </label>
                                    <Input
                                        type="number"
                                        value={newComponent.peso_percentual}
                                        onChange={(e) => setNewComponent({ ...newComponent, peso_percentual: e.target.value })}
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
                                    value={newComponent.nome}
                                    onChange={(e) => setNewComponent({ ...newComponent, nome: e.target.value })}
                                    placeholder="Ex: Média de Avaliação Contínua"
                                    required
                                />
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newComponent.is_calculated}
                                        onChange={(e) => setNewComponent({ ...newComponent, is_calculated: e.target.checked })}
                                        className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                    />
                                    <div>
                                        <span className="font-medium text-slate-900">Componente Calculado</span>
                                        <p className="text-xs text-slate-500">Valor é calculado automaticamente</p>
                                    </div>
                                </label>
                            </div>

                            {newComponent.is_calculated && (
                                <div className="space-y-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Fórmula
                                        </label>
                                        <Input
                                            type="text"
                                            value={newComponent.formula_expression}
                                            onChange={(e) => setNewComponent({ ...newComponent, formula_expression: e.target.value })}
                                            placeholder="Ex: (PP + PT) / 2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Tipo de Cálculo
                                        </label>
                                        <select
                                            value={newComponent.tipo_calculo}
                                            onChange={(e) => setNewComponent({ ...newComponent, tipo_calculo: e.target.value as 'trimestral' | 'anual' })}
                                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                        >
                                            <option value="trimestral">Trimestral (MT)</option>
                                            <option value="anual">Anual (MF)</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
                                    Cancelar
                                </Button>
                                <Button type="submit" variant="primary" className="flex-1">
                                    Criar e Adicionar
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            {/* Confirmação de eliminação */}
            {deleteTarget && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[60]">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Eliminar componente?</h3>
                            <p className="text-slate-600 text-center">
                                Tem a certeza que deseja eliminar <strong>{deleteTarget.codigo_componente}</strong> ({deleteTarget.nome})
                                do catálogo?
                            </p>
                            <div className="flex gap-3 mt-6">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="flex-1"
                                    onClick={() => setDeleteTarget(null)}
                                    disabled={busy}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="button"
                                    variant="danger"
                                    className="flex-1"
                                    onClick={handleConfirmDelete}
                                    disabled={busy}
                                >
                                    {busy ? 'A eliminar...' : 'Eliminar'}
                                </Button>
                            </div>
                    </div>
                </div>
            )}
        </div>
    )
}
