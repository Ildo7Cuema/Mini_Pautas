/*
component-meta:
  name: TemplatesManagement
  description: Component for managing discipline templates organized by class
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Card, CardBody, CardHeader } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Icons } from './ui/Icons'
import { translateError } from '../utils/translations'
import type { DisciplinaTemplate, ComponenteTemplate } from '../types'
import { ComponenteSelectorModal } from './ComponenteSelectorModal'

// Available classes in the Angolan education system
const CLASSES_PRIMARIO = ['1ª Classe', '2ª Classe', '3ª Classe', '4ª Classe', '5ª Classe', '6ª Classe']
const CLASSES_SECUNDARIO_I = ['7ª Classe', '8ª Classe', '9ª Classe']
const CLASSES_SECUNDARIO_II = ['10ª Classe', '11ª Classe', '12ª Classe', '13ª Classe']
const ALL_CLASSES = [...CLASSES_PRIMARIO, ...CLASSES_SECUNDARIO_I, ...CLASSES_SECUNDARIO_II]

interface TemplatesManagementProps {
    onClose?: () => void
}

export const TemplatesManagement: React.FC<TemplatesManagementProps> = ({ onClose }) => {
    const { escolaProfile } = useAuth()

    // State
    const [selectedClasse, setSelectedClasse] = useState<string | null>(null)
    const [templates, setTemplates] = useState<DisciplinaTemplate[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [selectedTemplate, setSelectedTemplate] = useState<DisciplinaTemplate | null>(null)
    const [applyError, setApplyError] = useState<string | null>(null)
    const [applySuccess, setApplySuccess] = useState<string | null>(null)

    // Expanded template for viewing/editing components
    const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null)
    const [componentes, setComponentes] = useState<Record<string, ComponenteTemplate[]>>({})
    const [loadingComponentes, setLoadingComponentes] = useState<Record<string, boolean>>({})

    // Component modal states
    const [showAddComponenteModal, setShowAddComponenteModal] = useState(false)
    const [showEditComponenteModal, setShowEditComponenteModal] = useState(false)
    const [showDeleteComponenteModal, setShowDeleteComponenteModal] = useState(false)
    const [selectedComponente, setSelectedComponente] = useState<ComponenteTemplate | null>(null)
    const [submittingComponente, setSubmittingComponente] = useState(false)

    // Form data
    const [formData, setFormData] = useState({
        nome: '',
        codigo_disciplina: '',
        carga_horaria: '',
        descricao: '',
        ordem: '1',
        is_obrigatoria: false
    })

    const [componenteFormData, setComponenteFormData] = useState({
        nome: '',
        codigo_componente: '',
        peso_percentual: '',
        escala_minima: '0',
        escala_maxima: '20',
        obrigatorio: true,
        ordem: '1',
        descricao: '',
        trimestre: '1',
        is_calculated: false,
        formula_expression: '',
        tipo_calculo: 'trimestral' as 'trimestral' | 'anual'
    })

    // Classes with templates count
    const [classesWithTemplates, setClassesWithTemplates] = useState<Record<string, number>>({})

    // Apply to turma modal states
    const [showApplyModal, setShowApplyModal] = useState(false)
    const [turmasDisponiveis, setTurmasDisponiveis] = useState<{ id: string; nome: string; codigo_turma: string }[]>([])
    const [professoresDisponiveis, setProfessoresDisponiveis] = useState<{ id: string; nome_completo: string }[]>([])
    const [selectedTurmaId, setSelectedTurmaId] = useState('')
    const [selectedProfessorId, setSelectedProfessorId] = useState('')
    const [applyingTemplate, setApplyingTemplate] = useState(false)

    useEffect(() => {
        if (escolaProfile?.id) {
            loadClassesWithTemplates()
        }
    }, [escolaProfile?.id])

    useEffect(() => {
        if (selectedClasse && escolaProfile?.id) {
            loadTemplates()
        }
    }, [selectedClasse, escolaProfile?.id])

    const loadClassesWithTemplates = async () => {
        if (!escolaProfile?.id) return

        try {
            const { data, error } = await supabase
                .rpc('get_available_template_classes', { p_escola_id: escolaProfile.id })

            if (error) throw error

            const counts: Record<string, number> = {}
            data?.forEach((item: { classe: string, templates_count: number }) => {
                counts[item.classe] = item.templates_count
            })
            setClassesWithTemplates(counts)
        } catch (err) {
            console.error('Erro ao carregar classes:', err)
        }
    }

    const loadTemplates = async () => {
        if (!escolaProfile?.id || !selectedClasse) return

        setLoading(true)
        setError(null)

        try {
            const { data, error } = await supabase
                .from('disciplinas_template')
                .select(`
                    *,
                    componentes_template (count),
                    turma_template_link (count)
                `)
                .eq('escola_id', escolaProfile.id)
                .eq('classe', selectedClasse)
                .order('ordem')

            if (error) throw error

            // Transform data to include counts
            const templatesWithCounts = (data || []).map(t => ({
                ...t,
                componentes_count: t.componentes_template?.[0]?.count || 0,
                turmas_count: t.turma_template_link?.[0]?.count || 0
            }))

            setTemplates(templatesWithCounts)
        } catch (err: any) {
            setError(translateError(err?.message || 'Erro ao carregar templates'))
        } finally {
            setLoading(false)
        }
    }

    const loadComponentes = async (templateId: string) => {
        setLoadingComponentes(prev => ({ ...prev, [templateId]: true }))

        try {
            const { data, error } = await supabase
                .from('componentes_template')
                .select('*')
                .eq('disciplina_template_id', templateId)
                .order('trimestre')
                .order('ordem')

            if (error) throw error
            setComponentes(prev => ({ ...prev, [templateId]: data || [] }))
        } catch (err: any) {
            setError(translateError(err?.message || 'Erro ao carregar componentes'))
        } finally {
            setLoadingComponentes(prev => ({ ...prev, [templateId]: false }))
        }
    }

    const toggleTemplate = (templateId: string) => {
        if (expandedTemplate === templateId) {
            setExpandedTemplate(null)
        } else {
            setExpandedTemplate(templateId)
            if (!componentes[templateId]) {
                loadComponentes(templateId)
            }
        }
    }

    // Generate discipline code from name
    const generateCodigoFromNome = (nome: string): string => {
        if (!nome || nome.trim().length === 0) return ''

        const cleanName = nome
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z\s]/g, '')
            .trim()

        const prefix = cleanName.substring(0, 3).toUpperCase()
        if (prefix.length < 2) return ''

        const existingWithPrefix = templates.filter(t =>
            t.codigo_disciplina.toUpperCase().startsWith(prefix)
        ).length

        const sequentialNumber = String(existingWithPrefix + 1).padStart(3, '0')
        return `${prefix}${sequentialNumber}`
    }

    const handleNomeChange = (nome: string) => {
        const currentCode = formData.codigo_disciplina
        const wasAutoGenerated = currentCode === '' ||
            (currentCode.length >= 5 && /^[A-Z]{2,3}\d{3}$/.test(currentCode))

        setFormData(prev => ({
            ...prev,
            nome,
            codigo_disciplina: wasAutoGenerated ? generateCodigoFromNome(nome) : prev.codigo_disciplina
        }))
    }

    // Template CRUD operations
    const handleAddTemplate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!escolaProfile?.id || !selectedClasse) return

        setError(null)
        setSuccess(null)

        try {
            const { error } = await supabase
                .from('disciplinas_template')
                .insert({
                    escola_id: escolaProfile.id,
                    classe: selectedClasse,
                    nome: formData.nome,
                    codigo_disciplina: formData.codigo_disciplina,
                    carga_horaria: formData.carga_horaria ? parseInt(formData.carga_horaria) : null,
                    descricao: formData.descricao || null,
                    ordem: parseInt(formData.ordem) || 1,
                    is_obrigatoria: formData.is_obrigatoria
                })

            if (error) throw error

            setSuccess('Template criado com sucesso!')
            setShowAddModal(false)
            resetForm()
            loadTemplates()
            loadClassesWithTemplates()
            setTimeout(() => setSuccess(null), 3000)
        } catch (err: any) {
            setError(translateError(err?.message || 'Erro ao criar template'))
        }
    }

    const handleEditTemplate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedTemplate) return

        setError(null)
        setSuccess(null)

        try {
            const { error } = await supabase
                .from('disciplinas_template')
                .update({
                    nome: formData.nome,
                    codigo_disciplina: formData.codigo_disciplina,
                    carga_horaria: formData.carga_horaria ? parseInt(formData.carga_horaria) : null,
                    descricao: formData.descricao || null,
                    ordem: parseInt(formData.ordem) || 1,
                    is_obrigatoria: formData.is_obrigatoria
                })
                .eq('id', selectedTemplate.id)

            if (error) throw error

            const turmasCount = selectedTemplate.turmas_count || 0
            setSuccess(`Template actualizado! ${turmasCount > 0 ? `${turmasCount} turma(s) sincronizada(s).` : ''}`)
            setShowEditModal(false)
            setSelectedTemplate(null)
            resetForm()
            loadTemplates()
            setTimeout(() => setSuccess(null), 3000)
        } catch (err: any) {
            setError(translateError(err?.message || 'Erro ao actualizar template'))
        }
    }

    const handleDeleteTemplate = async () => {
        if (!selectedTemplate) return

        setError(null)
        setSuccess(null)

        try {
            const { error } = await supabase
                .from('disciplinas_template')
                .delete()
                .eq('id', selectedTemplate.id)

            if (error) throw error

            setSuccess('Template eliminado com sucesso!')
            setShowDeleteModal(false)
            setSelectedTemplate(null)
            loadTemplates()
            loadClassesWithTemplates()
            setTimeout(() => setSuccess(null), 3000)
        } catch (err: any) {
            setError(translateError(err?.message || 'Erro ao eliminar template'))
        }
    }

    const openEditModal = (template: DisciplinaTemplate) => {
        setSelectedTemplate(template)
        setFormData({
            nome: template.nome,
            codigo_disciplina: template.codigo_disciplina,
            carga_horaria: template.carga_horaria?.toString() || '',
            descricao: template.descricao || '',
            ordem: template.ordem.toString(),
            is_obrigatoria: template.is_obrigatoria
        })
        setShowEditModal(true)
    }

    const openDeleteModal = (template: DisciplinaTemplate) => {
        setSelectedTemplate(template)
        setShowDeleteModal(true)
    }

    const resetForm = () => {
        setFormData({
            nome: '',
            codigo_disciplina: '',
            carga_horaria: '',
            descricao: '',
            ordem: '1',
            is_obrigatoria: false
        })
    }

    // Component CRUD operations
    const handleAddComponente = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedTemplate) return

        setError(null)
        setSuccess(null)
        setSubmittingComponente(true)

        try {
            const pesoPercentual = parseFloat(componenteFormData.peso_percentual)

            if (pesoPercentual <= 0 || pesoPercentual > 100) {
                setError('O peso deve estar entre 0 e 100%.')
                setSubmittingComponente(false)
                return
            }

            console.log('Adicionando componente template:', {
                disciplina_template_id: selectedTemplate.id,
                nome: componenteFormData.nome,
                codigo_componente: componenteFormData.codigo_componente,
                peso_percentual: pesoPercentual,
                trimestre: parseInt(componenteFormData.trimestre)
            })

            const { data, error } = await supabase
                .from('componentes_template')
                .insert({
                    disciplina_template_id: selectedTemplate.id,
                    nome: componenteFormData.nome,
                    codigo_componente: componenteFormData.codigo_componente,
                    peso_percentual: pesoPercentual,
                    escala_minima: parseFloat(componenteFormData.escala_minima),
                    escala_maxima: parseFloat(componenteFormData.escala_maxima),
                    obrigatorio: componenteFormData.obrigatorio,
                    ordem: parseInt(componenteFormData.ordem),
                    descricao: componenteFormData.descricao || null,
                    trimestre: parseInt(componenteFormData.trimestre),
                    is_calculated: componenteFormData.is_calculated,
                    formula_expression: componenteFormData.is_calculated ? componenteFormData.formula_expression : null,
                    tipo_calculo: componenteFormData.tipo_calculo
                })
                .select()

            console.log('Resultado insert componente:', { data, error })

            if (error) throw error

            const turmasCount = selectedTemplate.turmas_count || 0
            setSuccess(`Componente adicionado! ${turmasCount > 0 ? `Sincronizado em ${turmasCount} turma(s).` : ''}`)
            setShowAddComponenteModal(false)
            resetComponenteForm()
            loadComponentes(selectedTemplate.id)
            loadTemplates()
            setTimeout(() => setSuccess(null), 3000)
        } catch (err: any) {
            console.error('Erro ao adicionar componente:', err)
            setError(translateError(err?.message || 'Erro ao adicionar componente'))
        } finally {
            setSubmittingComponente(false)
        }
    }

    const handleEditComponente = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedComponente || !selectedTemplate) return

        setError(null)
        setSuccess(null)
        setSubmittingComponente(true)

        try {
            const pesoPercentual = parseFloat(componenteFormData.peso_percentual)

            if (pesoPercentual <= 0 || pesoPercentual > 100) {
                setError('O peso deve estar entre 0 e 100%.')
                return
            }

            const { error } = await supabase
                .from('componentes_template')
                .update({
                    nome: componenteFormData.nome,
                    codigo_componente: componenteFormData.codigo_componente,
                    peso_percentual: pesoPercentual,
                    escala_minima: parseFloat(componenteFormData.escala_minima),
                    escala_maxima: parseFloat(componenteFormData.escala_maxima),
                    obrigatorio: componenteFormData.obrigatorio,
                    ordem: parseInt(componenteFormData.ordem),
                    descricao: componenteFormData.descricao || null,
                    trimestre: parseInt(componenteFormData.trimestre),
                    is_calculated: componenteFormData.is_calculated,
                    formula_expression: componenteFormData.is_calculated ? componenteFormData.formula_expression : null,
                    tipo_calculo: componenteFormData.tipo_calculo
                })
                .eq('id', selectedComponente.id)

            if (error) throw error

            const turmasCount = selectedTemplate.turmas_count || 0
            setSuccess(`Componente actualizado! ${turmasCount > 0 ? `Sincronizado em ${turmasCount} turma(s).` : ''}`)
            setShowEditComponenteModal(false)
            setSelectedComponente(null)
            resetComponenteForm()
            loadComponentes(selectedTemplate.id)
            setTimeout(() => setSuccess(null), 3000)
        } catch (err: any) {
            setError(translateError(err?.message || 'Erro ao actualizar componente'))
        } finally {
            setSubmittingComponente(false)
        }
    }

    /**
     * Depois de apagar um componente de um template, retira-o do catálogo
     * (ativo = false) para que deixe de aparecer no modal "Selecionar Componente".
     *
     * Só é desativado quando já não existe noutros componentes de templates da escola
     * (outro trimestre/disciplina), para nunca esconder um componente que ainda se usa.
     * A gestão de disciplinas/componentes é feita nos Templates, por isso associações
     * antigas em disciplina_componentes já não impedem a remoção do catálogo.
     * Best effort: uma falha aqui não impede a eliminação do componente.
     */
    const hideDeletedComponenteFromCatalog = async (codigo: string) => {
        const escolaId = escolaProfile?.id
        if (!escolaId || !codigo) return

        try {
            const { data: stillInTemplates } = await supabase
                .from('componentes_template')
                .select('id, disciplinas_template!inner(escola_id)')
                .eq('codigo_componente', codigo)
                .eq('disciplinas_template.escola_id', escolaId)
                .limit(1)

            if (stillInTemplates && stillInTemplates.length > 0) return

            const { data: catalogo } = await supabase
                .from('componentes_catalogo')
                .select('id')
                .eq('escola_id', escolaId)
                .eq('codigo_componente', codigo)
                .eq('ativo', true)
                .maybeSingle()

            if (!catalogo) return

            await supabase
                .from('componentes_catalogo')
                .update({ ativo: false })
                .eq('id', catalogo.id)
        } catch (err) {
            console.warn('Não foi possível retirar o componente do catálogo:', err)
        }
    }

    const handleDeleteComponente = async () => {
        if (!selectedComponente || !selectedTemplate) return

        setError(null)
        setSuccess(null)

        try {
            const codigoApagado = selectedComponente.codigo_componente

            const { error } = await supabase
                .from('componentes_template')
                .delete()
                .eq('id', selectedComponente.id)

            if (error) throw error

            await hideDeletedComponenteFromCatalog(codigoApagado)

            setSuccess('Componente eliminado!')
            setShowDeleteComponenteModal(false)
            setSelectedComponente(null)
            loadComponentes(selectedTemplate.id)
            loadTemplates()
            setTimeout(() => setSuccess(null), 3000)
        } catch (err: any) {
            setError(translateError(err?.message || 'Erro ao eliminar componente'))
        }
    }

    const openAddComponenteModal = (template: DisciplinaTemplate) => {
        setSelectedTemplate(template)
        resetComponenteForm()
        setShowAddComponenteModal(true)
    }

    const openEditComponenteModal = (componente: ComponenteTemplate, template: DisciplinaTemplate) => {
        setSelectedTemplate(template)
        setSelectedComponente(componente)
        setComponenteFormData({
            nome: componente.nome,
            codigo_componente: componente.codigo_componente,
            peso_percentual: componente.peso_percentual.toString(),
            escala_minima: componente.escala_minima.toString(),
            escala_maxima: componente.escala_maxima.toString(),
            obrigatorio: componente.obrigatorio,
            ordem: componente.ordem.toString(),
            descricao: componente.descricao || '',
            trimestre: componente.trimestre.toString(),
            is_calculated: componente.is_calculated,
            formula_expression: componente.formula_expression || '',
            tipo_calculo: componente.tipo_calculo
        })
        setShowEditComponenteModal(true)
    }

    const openDeleteComponenteModal = (componente: ComponenteTemplate, template: DisciplinaTemplate) => {
        setSelectedTemplate(template)
        setSelectedComponente(componente)
        setShowDeleteComponenteModal(true)
    }

    const resetComponenteForm = () => {
        setComponenteFormData({
            nome: '',
            codigo_componente: '',
            peso_percentual: '',
            escala_minima: '0',
            escala_maxima: '20',
            obrigatorio: true,
            ordem: '1',
            descricao: '',
            trimestre: '1',
            is_calculated: false,
            formula_expression: '',
            tipo_calculo: 'trimestral'
        })
    }

    const closeModals = () => {
        setShowAddModal(false)
        setShowEditModal(false)
        setShowDeleteModal(false)
        setShowAddComponenteModal(false)
        setShowEditComponenteModal(false)
        setShowDeleteComponenteModal(false)
        setSelectedTemplate(null)
        setSelectedComponente(null)
        resetForm()
        resetComponenteForm()
    }

    // Group componentes by trimestre
    const groupByTrimestre = (comps: ComponenteTemplate[]) => {
        const grouped: Record<number, ComponenteTemplate[]> = { 1: [], 2: [], 3: [] }
        comps.forEach(c => {
            if (grouped[c.trimestre]) {
                grouped[c.trimestre].push(c)
            }
        })
        return grouped
    }

    // Apply template to turma functions
    const openApplyModal = async (template: DisciplinaTemplate) => {
        setSelectedTemplate(template)
        setSelectedTurmaId('')
        setSelectedProfessorId('')
        setApplyError(null)
        setApplySuccess(null)
        setShowApplyModal(true)

        // Load turmas and professors
        try {
            // Load turmas that don't have this template yet
            const { data: allTurmas, error: turmasError } = await supabase
                .from('turmas')
                .select('id, nome, codigo_turma')
                .order('nome')

            if (turmasError) throw turmasError

            // Get turmas that already have this template
            const { data: linkedTurmas, error: linkError } = await supabase
                .from('turma_template_link')
                .select('turma_id')
                .eq('disciplina_template_id', template.id)

            if (linkError) throw linkError

            const linkedIds = new Set(linkedTurmas?.map(t => t.turma_id) || [])
            const availableTurmas = (allTurmas || []).filter(t => !linkedIds.has(t.id))
            setTurmasDisponiveis(availableTurmas)

            // Load professors - only from this school
            const { data: profs, error: profsError } = await supabase
                .from('professores')
                .select('id, nome_completo')
                .eq('escola_id', escolaProfile?.id)
                .order('nome_completo')

            if (profsError) throw profsError
            setProfessoresDisponiveis(profs || [])

        } catch (err: any) {
            setError(translateError(err?.message || 'Erro ao carregar dados'))
        }
    }

    const handleComponenteSelected = async (data: { componente: any, componente_catalogo_id: string }) => {
        if (!selectedTemplate) {
            console.error('Nenhum template selecionado')
            return
        }

        try {
            console.log('Componente selecionado do catálogo:', data)
            console.log('Template destino:', selectedTemplate.id)
            const trimestre = parseInt(componenteFormData.trimestre)
            console.log('Trimestre alvo:', trimestre)

            const payload = {
                disciplina_template_id: selectedTemplate.id,
                nome: data.componente.nome,
                codigo_componente: data.componente.codigo_componente,
                peso_percentual: data.componente.peso_padrao || 0,
                trimestre: trimestre,
                is_calculated: data.componente.is_calculated,
                tipo_calculo: data.componente.tipo_calculo,
                formula_expression: data.componente.formula_expression,
                escala_minima: 0,
                escala_maxima: 20,
                obrigatorio: true,
                ordem: 1,
                descricao: data.componente.descricao
            }
            console.log('Payload para insert:', payload)

            const { data: inserted, error } = await supabase
                .from('componentes_template')
                .insert(payload)
                .select()

            if (error) {
                console.error('Erro Supabase Insert:', error)
                throw error
            }

            console.log('Componente inserido com sucesso:', inserted)

            const turmasCount = selectedTemplate.turmas_count || 0
            setSuccess(`Componente adicionado! ${turmasCount > 0 ? `Sincronizado em ${turmasCount} turma(s).` : ''}`)
            setShowAddComponenteModal(false)
            resetComponenteForm()

            console.log('Recarregando componentes...')
            await loadComponentes(selectedTemplate.id)
            loadTemplates()
            setTimeout(() => setSuccess(null), 3000)
        } catch (err: any) {
            console.error('Erro ao adicionar componente do catálogo:', err)
            setShowAddComponenteModal(false) // Close modal to ensure error is visible
            setError(translateError(err?.message || 'Erro ao adicionar componente'))
        }
    }

    const handleApplyToTurma = async () => {
        if (!selectedTemplate || !selectedTurmaId || !selectedProfessorId) {
            setApplyError('Seleccione uma turma e um professor.')
            return
        }

        setApplyError(null)
        setApplySuccess(null)
        setApplyingTemplate(true)

        try {
            console.log('📊 Aplicando template:', {
                turma_id: selectedTurmaId,
                template_id: selectedTemplate.id,
                professor_id: selectedProfessorId
            })

            const { data, error } = await supabase.rpc('apply_template_to_turma', {
                p_turma_id: selectedTurmaId,
                p_template_id: selectedTemplate.id,
                p_professor_id: selectedProfessorId
            })

            console.log('📊 Resultado apply_template_to_turma:', { data, error })

            if (error) throw error

            setApplySuccess(`Template "${selectedTemplate.nome}" aplicado com sucesso! Disciplina e componentes criados.`)
            loadTemplates() // Refresh to update turmas_count

            setTimeout(() => {
                setShowApplyModal(false)
                setApplySuccess(null)
            }, 2000)
        } catch (err: any) {
            console.error('❌ Erro ao aplicar template:', err)
            let errorMsg = err?.message || 'Erro ao aplicar template'
            if (errorMsg.includes('Template already applied')) {
                errorMsg = 'Este template já foi aplicado a esta turma.'
            }
            setApplyError(translateError(errorMsg))
        } finally {
            setApplyingTemplate(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/20">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-slate-900">Templates de Disciplinas</h2>
                        <p className="text-sm text-slate-500">Configure disciplinas padrão por classe</p>
                    </div>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="min-h-touch min-w-touch flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Messages */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center shadow-sm animate-slide-down">
                    <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="flex-1 font-medium">{error}</span>
                    <button onClick={() => setError(null)} className="ml-2 p-1 hover:bg-red-100 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}
            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center shadow-sm animate-slide-down">
                    <Icons.Check />
                    <span className="ml-2 font-medium">{success}</span>
                </div>
            )}

            {/* Class Selection */}
            <Card>
                <CardHeader>
                    <h3 className="text-lg font-semibold text-slate-900">Seleccione a Classe</h3>
                </CardHeader>
                <CardBody>
                    <div className="space-y-4">
                        {/* Ensino Primário */}
                        <div>
                            <h4 className="text-sm font-medium text-slate-600 mb-2">Ensino Primário</h4>
                            <div className="flex flex-wrap gap-2">
                                {CLASSES_PRIMARIO.map(classe => (
                                    <button
                                        key={classe}
                                        onClick={() => setSelectedClasse(classe)}
                                        className={`px-4 py-2 rounded-xl font-medium transition-all ${selectedClasse === classe
                                            ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        {classe}
                                        {classesWithTemplates[classe] && (
                                            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-white/20">
                                                {classesWithTemplates[classe]}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Ensino Secundário I Ciclo */}
                        <div>
                            <h4 className="text-sm font-medium text-slate-600 mb-2">Ensino Secundário - I Ciclo</h4>
                            <div className="flex flex-wrap gap-2">
                                {CLASSES_SECUNDARIO_I.map(classe => (
                                    <button
                                        key={classe}
                                        onClick={() => setSelectedClasse(classe)}
                                        className={`px-4 py-2 rounded-xl font-medium transition-all ${selectedClasse === classe
                                            ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        {classe}
                                        {classesWithTemplates[classe] && (
                                            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-white/20">
                                                {classesWithTemplates[classe]}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Ensino Secundário II Ciclo */}
                        <div>
                            <h4 className="text-sm font-medium text-slate-600 mb-2">Ensino Secundário - II Ciclo</h4>
                            <div className="flex flex-wrap gap-2">
                                {CLASSES_SECUNDARIO_II.map(classe => (
                                    <button
                                        key={classe}
                                        onClick={() => setSelectedClasse(classe)}
                                        className={`px-4 py-2 rounded-xl font-medium transition-all ${selectedClasse === classe
                                            ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        {classe}
                                        {classesWithTemplates[classe] && (
                                            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-white/20">
                                                {classesWithTemplates[classe]}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Templates List */}
            {selectedClasse && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-900">
                                Templates para {selectedClasse}
                            </h3>
                            <Button onClick={() => setShowAddModal(true)}>
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Adicionar Disciplina
                            </Button>
                        </div>
                    </CardHeader>
                    <CardBody>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
                            </div>
                        ) : templates.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                </div>
                                <h4 className="text-lg font-semibold text-slate-700 mb-2">Nenhum template definido</h4>
                                <p className="text-slate-500 mb-4">Comece por adicionar as disciplinas padrão para a {selectedClasse}</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {templates.map(template => (
                                    <div key={template.id} className="border border-slate-200 rounded-xl overflow-hidden">
                                        {/* Template Header */}
                                        <div
                                            className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                                            onClick={() => toggleTemplate(template.id)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${template.is_obrigatoria
                                                    ? 'bg-amber-100 text-amber-600'
                                                    : 'bg-primary-100 text-primary-600'
                                                    }`}>
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                                                        {template.nome}
                                                        {template.is_obrigatoria && (
                                                            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                                                                Obrigatória
                                                            </span>
                                                        )}
                                                    </h4>
                                                    <p className="text-sm text-slate-500">
                                                        {template.codigo_disciplina} • {template.componentes_count || 0} componentes • {template.turmas_count || 0} turmas
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openApplyModal(template); }}
                                                    className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                                                    title="Aplicar template a uma turma"
                                                >
                                                    Aplicar a Turma
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openEditModal(template); }}
                                                    className="p-2 text-slate-400 hover:text-primary-600 hover:bg-white rounded-lg transition-colors"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openDeleteModal(template); }}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                                <svg
                                                    className={`w-5 h-5 text-slate-400 transition-transform ${expandedTemplate === template.id ? 'rotate-180' : ''}`}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>

                                        {/* Expanded Components */}
                                        {expandedTemplate === template.id && (
                                            <div className="p-4 border-t border-slate-200 bg-white">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h5 className="font-medium text-slate-700">Componentes de Avaliação</h5>
                                                    <button
                                                        onClick={() => openAddComponenteModal(template)}
                                                        className="px-3 py-1.5 text-sm bg-primary-50 text-primary-600 font-medium rounded-lg hover:bg-primary-100 transition-colors"
                                                    >
                                                        + Adicionar Componente
                                                    </button>
                                                </div>

                                                {loadingComponentes[template.id] ? (
                                                    <div className="flex items-center justify-center py-8">
                                                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
                                                    </div>
                                                ) : !componentes[template.id] || componentes[template.id].length === 0 ? (
                                                    <p className="text-center text-slate-500 py-8">Nenhum componente definido</p>
                                                ) : (
                                                    <div className="space-y-4">
                                                        {[1, 2, 3].map(trimestre => {
                                                            const trimestreComps = componentes[template.id]?.filter(c => c.trimestre === trimestre) || []
                                                            if (trimestreComps.length === 0) return null

                                                            return (
                                                                <div key={trimestre}>
                                                                    <h6 className="text-sm font-medium text-slate-500 mb-2">{trimestre}º Trimestre</h6>
                                                                    <div className="space-y-2">
                                                                        {trimestreComps.map(comp => (
                                                                            <div
                                                                                key={comp.id}
                                                                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                                                                            >
                                                                                <div>
                                                                                    <span className="font-medium text-slate-800">{comp.nome}</span>
                                                                                    <span className="ml-2 text-slate-500">({comp.codigo_componente})</span>
                                                                                    <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
                                                                                        {comp.peso_percentual}%
                                                                                    </span>
                                                                                    {comp.is_calculated && (
                                                                                        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-violet-100 text-violet-700 rounded-full">
                                                                                            Calculado
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="flex items-center gap-1">
                                                                                    <button
                                                                                        onClick={() => openEditComponenteModal(comp, template)}
                                                                                        className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-white rounded transition-colors"
                                                                                    >
                                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                                        </svg>
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => openDeleteComponenteModal(comp, template)}
                                                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded transition-colors"
                                                                                    >
                                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                                        </svg>
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardBody>
                </Card>
            )}

            {/* Add/Edit Template Modal */}
            {(showAddModal || showEditModal) && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200">
                            <h3 className="text-xl font-bold text-slate-900">
                                {showAddModal ? 'Adicionar Template' : 'Editar Template'}
                            </h3>
                        </div>
                        <form onSubmit={showAddModal ? handleAddTemplate : handleEditTemplate}>
                            <div className="p-6 space-y-4">
                                <Input
                                    label="Nome da Disciplina"
                                    value={formData.nome}
                                    onChange={(e) => handleNomeChange(e.target.value)}
                                    placeholder="Ex: Matemática"
                                    required
                                />
                                <Input
                                    label="Código"
                                    value={formData.codigo_disciplina}
                                    onChange={(e) => setFormData({ ...formData, codigo_disciplina: e.target.value })}
                                    placeholder="Ex: MAT001"
                                    required
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="Carga Horária (h)"
                                        type="number"
                                        value={formData.carga_horaria}
                                        onChange={(e) => setFormData({ ...formData, carga_horaria: e.target.value })}
                                        placeholder="Ex: 120"
                                    />
                                    <Input
                                        label="Ordem"
                                        type="number"
                                        value={formData.ordem}
                                        onChange={(e) => setFormData({ ...formData, ordem: e.target.value })}
                                        min="1"
                                    />
                                </div>
                                <Input
                                    label="Descrição"
                                    value={formData.descricao}
                                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                                    placeholder="Descrição opcional"
                                />
                                <label className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_obrigatoria}
                                        onChange={(e) => setFormData({ ...formData, is_obrigatoria: e.target.checked })}
                                        className="w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                                    />
                                    <div>
                                        <span className="font-medium text-amber-800">Disciplina Obrigatória</span>
                                        <p className="text-sm text-amber-600">Usada nas regras de transição (ex: LP e Matemática)</p>
                                    </div>
                                </label>

                                {showEditModal && selectedTemplate && (selectedTemplate.turmas_count || 0) > 0 && (
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                        <p className="text-sm text-blue-700">
                                            <strong>Nota:</strong> Esta alteração será sincronizada automaticamente em {selectedTemplate.turmas_count} turma(s).
                                        </p>
                                    </div>
                                )}
                            </div>
                            <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
                                <Button type="button" variant="secondary" onClick={closeModals}>
                                    Cancelar
                                </Button>
                                <Button type="submit">
                                    {showAddModal ? 'Criar Template' : 'Guardar Alterações'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Template Modal */}
            {showDeleteModal && selectedTemplate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
                        <div className="p-6">
                            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Eliminar Template?</h3>
                            <p className="text-slate-600 text-center mb-4">
                                Tem certeza que deseja eliminar o template <strong>{selectedTemplate.nome}</strong>?
                            </p>
                            {(selectedTemplate.turmas_count || 0) > 0 && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                                    <p className="text-sm text-amber-700 text-center">
                                        <strong>Atenção:</strong> {selectedTemplate.turmas_count} turma(s) usam este template.
                                        As disciplinas existentes não serão eliminadas, mas deixarão de ser sincronizadas.
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
                            <Button variant="secondary" onClick={closeModals}>
                                Cancelar
                            </Button>
                            <Button variant="danger" onClick={handleDeleteTemplate}>
                                Eliminar
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Component Modal - Using Catalog */}
            {showAddComponenteModal && selectedTemplate && (
                <ComponenteSelectorModal
                    escolaId={escolaProfile?.id || ''}
                    trimestre={parseInt(componenteFormData.trimestre)}
                    onTrimestreChange={(t) => setComponenteFormData({ ...componenteFormData, trimestre: t.toString() })}
                    onSelect={handleComponenteSelected}
                    onClose={closeModals}
                    disableAssociation={true}
                    existingCodes={componentes[selectedTemplate.id]
                        ?.filter(c => c.trimestre === parseInt(componenteFormData.trimestre))
                        .map(c => c.codigo_componente) || []}
                />
            )}

            {/* Edit Component Modal - Only used for editing now */}
            {showEditComponenteModal && selectedTemplate && (
                <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center md:p-4 z-50 animate-fade-in">
                    <Card className="w-full md:max-w-lg md:rounded-lg rounded-t-2xl rounded-b-none md:rounded-b-lg animate-slide-up max-h-[90vh] overflow-y-auto">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900">
                                        Editar Componente
                                    </h3>
                                    <p className="text-sm text-slate-600 mt-0.5">{selectedTemplate.nome}</p>
                                </div>
                                <button
                                    onClick={closeModals}
                                    className="text-slate-400 hover:text-slate-600 min-h-touch min-w-touch flex items-center justify-center -mr-2"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </CardHeader>
                        <CardBody>
                            <form onSubmit={handleEditComponente} className="space-y-4">
                                <Input
                                    label="Nome do Componente"
                                    type="text"
                                    value={componenteFormData.nome}
                                    onChange={(e) => setComponenteFormData({ ...componenteFormData, nome: e.target.value })}
                                    placeholder="Ex: MAC - Média das Avaliações Contínuas"
                                    required
                                />

                                <Input
                                    label="Código do Componente"
                                    type="text"
                                    value={componenteFormData.codigo_componente}
                                    onChange={(e) => setComponenteFormData({ ...componenteFormData, codigo_componente: e.target.value })}
                                    placeholder="Ex: MAC"
                                    required
                                />

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Trimestre <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={componenteFormData.trimestre}
                                        onChange={(e) => setComponenteFormData({ ...componenteFormData, trimestre: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        required
                                    >
                                        <option value="1">1º Trimestre</option>
                                        <option value="2">2º Trimestre</option>
                                        <option value="3">3º Trimestre</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        label="Peso Percentual (%)"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        value={componenteFormData.peso_percentual}
                                        onChange={(e) => setComponenteFormData({ ...componenteFormData, peso_percentual: e.target.value })}
                                        placeholder="Ex: 30"
                                        required
                                    />

                                    <Input
                                        label="Ordem"
                                        type="number"
                                        min="1"
                                        value={componenteFormData.ordem}
                                        onChange={(e) => setComponenteFormData({ ...componenteFormData, ordem: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        label="Escala Mínima"
                                        type="number"
                                        step="0.01"
                                        value={componenteFormData.escala_minima}
                                        onChange={(e) => setComponenteFormData({ ...componenteFormData, escala_minima: e.target.value })}
                                        required
                                    />

                                    <Input
                                        label="Escala Máxima"
                                        type="number"
                                        step="0.01"
                                        value={componenteFormData.escala_maxima}
                                        onChange={(e) => setComponenteFormData({ ...componenteFormData, escala_maxima: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="obrigatorio-template"
                                        checked={componenteFormData.obrigatorio}
                                        onChange={(e) => setComponenteFormData({ ...componenteFormData, obrigatorio: e.target.checked })}
                                        className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                                    />
                                    <label htmlFor="obrigatorio-template" className="text-sm text-slate-700">
                                        Componente obrigatório
                                    </label>
                                </div>

                                {/* Calculated Field Toggle */}
                                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <input
                                        type="checkbox"
                                        id="is_calculated_template"
                                        checked={componenteFormData.is_calculated}
                                        onChange={(e) => setComponenteFormData({ ...componenteFormData, is_calculated: e.target.checked, formula_expression: '' })}
                                        className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                                    />
                                    <label htmlFor="is_calculated_template" className="text-sm text-slate-700 flex-1">
                                        <strong>Campo Calculável</strong>
                                        <span className="block text-xs text-slate-600 mt-0.5">
                                            Este componente será calculado automaticamente usando uma fórmula
                                        </span>
                                    </label>
                                </div>

                                {/* Formula Builder - Only show when calculated is enabled */}
                                {componenteFormData.is_calculated && (
                                    <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                        {/* Calculation Type */}
                                        <div className="space-y-2">
                                            <label className="form-label text-sm">Tipo de Cálculo</label>
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        value="trimestral"
                                                        checked={componenteFormData.tipo_calculo === 'trimestral'}
                                                        onChange={(e) => setComponenteFormData({ ...componenteFormData, tipo_calculo: e.target.value as 'trimestral' | 'anual' })}
                                                        className="w-4 h-4 text-primary-600"
                                                    />
                                                    <span className="text-sm text-slate-700">Trimestral (MT)</span>
                                                </label>
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        value="anual"
                                                        checked={componenteFormData.tipo_calculo === 'anual'}
                                                        onChange={(e) => setComponenteFormData({ ...componenteFormData, tipo_calculo: e.target.value as 'trimestral' | 'anual' })}
                                                        className="w-4 h-4 text-primary-600"
                                                    />
                                                    <span className="text-sm text-slate-700">Anual (MF)</span>
                                                </label>
                                            </div>
                                            <p className="text-xs text-slate-600">
                                                {componenteFormData.tipo_calculo === 'trimestral'
                                                    ? 'Calcula usando componentes do mesmo trimestre (ex: MAC * 0.4 + EXAME * 0.6)'
                                                    : 'Calcula usando médias dos 3 trimestres (ex: (T1 + T2 + T3) / 3)'}
                                            </p>
                                        </div>

                                        {/* Formula Input */}
                                        <div>
                                            <label className="form-label text-sm">Fórmula de Cálculo</label>
                                            <input
                                                type="text"
                                                value={componenteFormData.formula_expression}
                                                onChange={(e) => setComponenteFormData({ ...componenteFormData, formula_expression: e.target.value })}
                                                placeholder="Ex: MAC * 0.4 + EXAME * 0.6"
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm font-mono"
                                            />
                                            <p className="text-xs text-slate-500 mt-1">
                                                Use os códigos dos componentes e operadores: + - * / ( )
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Descrição (opcional)</label>
                                    <textarea
                                        value={componenteFormData.descricao}
                                        onChange={(e) => setComponenteFormData({ ...componenteFormData, descricao: e.target.value })}
                                        placeholder="Breve descrição do componente..."
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[60px] resize-none"
                                        rows={2}
                                    />
                                </div>

                                {selectedTemplate && (selectedTemplate.turmas_count || 0) > 0 && (
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                        <p className="text-sm text-blue-700">
                                            <strong>Nota:</strong> Esta alteração será sincronizada em {selectedTemplate.turmas_count} turma(s).
                                        </p>
                                    </div>
                                )}

                                <div className="flex gap-3 pt-4">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={closeModals}
                                        className="flex-1"
                                        disabled={submittingComponente}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        className="flex-1"
                                        disabled={submittingComponente}
                                    >
                                        {submittingComponente ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                {showAddComponenteModal ? 'A adicionar...' : 'A guardar...'}
                                            </span>
                                        ) : (
                                            'Guardar Alterações'
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </CardBody>
                    </Card>
                </div>
            )}

            {/* Delete Component Modal */}
            {showDeleteComponenteModal && selectedComponente && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Eliminar Componente?</h3>
                            <p className="text-slate-600 text-center">
                                Tem certeza que deseja eliminar <strong>{selectedComponente.nome}</strong>?
                            </p>
                            {selectedTemplate && (selectedTemplate.turmas_count || 0) > 0 && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mt-4">
                                    <p className="text-sm text-amber-700 text-center">
                                        Este componente será removido de {selectedTemplate.turmas_count} turma(s) vinculadas
                                        (apenas se não tiver notas lançadas).
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
                            <Button variant="secondary" onClick={closeModals}>
                                Cancelar
                            </Button>
                            <Button variant="danger" onClick={handleDeleteComponente}>
                                Eliminar
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Apply Template to Turma Modal */}
            {showApplyModal && selectedTemplate && (
                <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center md:p-4 z-50">
                    <div className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
                        <div className="p-6 border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">Aplicar Template a Turma</h3>
                                    <p className="text-sm text-slate-500">{selectedTemplate.nome}</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            {applyError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center shadow-sm animate-slide-down">
                                    <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="flex-1 font-medium">{applyError}</span>
                                </div>
                            )}
                            {applySuccess && (
                                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center shadow-sm animate-slide-down">
                                    <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="flex-1 font-medium">{applySuccess}</span>
                                </div>
                            )}
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <div className="flex gap-2">
                                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-sm text-blue-800">
                                        Esta acção irá criar uma disciplina "{selectedTemplate.nome}" na turma seleccionada,
                                        juntamente com {selectedTemplate.componentes_count || 0} componentes de avaliação.
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="form-label">Turma *</label>
                                <select
                                    value={selectedTurmaId}
                                    onChange={(e) => setSelectedTurmaId(e.target.value)}
                                    className="form-input"
                                    required
                                >
                                    <option value="">Seleccione uma turma</option>
                                    {turmasDisponiveis.map(turma => (
                                        <option key={turma.id} value={turma.id}>
                                            {turma.nome} ({turma.codigo_turma})
                                        </option>
                                    ))}
                                </select>
                                {turmasDisponiveis.length === 0 && (
                                    <p className="text-sm text-amber-600 mt-1">
                                        Este template já foi aplicado a todas as turmas ou não existem turmas cadastradas.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="form-label">Professor Responsável *</label>
                                <select
                                    value={selectedProfessorId}
                                    onChange={(e) => setSelectedProfessorId(e.target.value)}
                                    className="form-input"
                                    required
                                >
                                    <option value="">Seleccione um professor</option>
                                    {professoresDisponiveis.map(prof => (
                                        <option key={prof.id} value={prof.id}>
                                            {prof.nome_completo}
                                        </option>
                                    ))}
                                </select>
                                {professoresDisponiveis.length === 0 && (
                                    <p className="text-sm text-amber-600 mt-1">
                                        Nenhum professor cadastrado. Cadastre professores primeiro.
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
                            <Button
                                variant="secondary"
                                onClick={() => setShowApplyModal(false)}
                                disabled={applyingTemplate}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleApplyToTurma}
                                disabled={!selectedTurmaId || !selectedProfessorId || applyingTemplate}
                            >
                                {applyingTemplate ? (
                                    <>
                                        <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></span>
                                        A aplicar...
                                    </>
                                ) : (
                                    'Aplicar Template'
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default TemplatesManagement
