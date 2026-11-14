/*
component-meta:
  name: StaffPage
  description: Page for managing school staff (directors, secretariat technicians, support)
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
import { FuncionarioEscola } from '../types'
import { TempoServicoReformaInfo } from './TempoServicoReformaInfo'
import {
    buildStaffInviteLink,
    formatStaffAccessSummary,
    getStaffAreaLabel,
    getStaffAreaModules,
    getStaffCargoLabel,
    normalizeStaffCargo,
    type StaffLoginCargo,
} from '../utils/staffAccess'

interface StaffPageProps {
    onNavigate?: (page: string) => void
    searchQuery?: string
}

/** Perfis com acesso de login (role SECRETARIO) vs registo organizacional */
type TipoPerfilStaff =
    | 'DIRECTOR_PEDAGOGICO'
    | 'DIRECTOR_ADMINISTRATIVO'
    | 'TECNICO_SECRETARIA'
    | 'OUTRO'

type StaffSource = 'funcionario' | 'secretario'

interface UnifiedStaffItem {
    id: string
    source: StaffSource
    nome_completo: string
    email: string
    telefone: string
    numero_funcionario: string
    categoria: string
    subcategoria: string
    cargo: string
    departamento: string
    genero?: 'M' | 'F' | ''
    data_nascimento?: string
    nif?: string
    data_admissao?: string
    numero_filhos?: number | null
    ativo: boolean
    user_id?: string | null
    perfilLabel: string
    funcionarioId?: string
    secretarioId?: string
}

const PERFIL_OPTIONS: { value: TipoPerfilStaff; label: string; area?: string; modules?: string[]; hint: string }[] = [
    {
        value: 'DIRECTOR_PEDAGOGICO',
        label: getStaffCargoLabel('DIRECTOR_PEDAGOGICO'),
        area: getStaffAreaLabel('DIRECTOR_PEDAGOGICO'),
        modules: getStaffAreaModules('DIRECTOR_PEDAGOGICO'),
        hint: formatStaffAccessSummary('DIRECTOR_PEDAGOGICO'),
    },
    {
        value: 'DIRECTOR_ADMINISTRATIVO',
        label: getStaffCargoLabel('DIRECTOR_ADMINISTRATIVO'),
        area: getStaffAreaLabel('DIRECTOR_ADMINISTRATIVO'),
        modules: getStaffAreaModules('DIRECTOR_ADMINISTRATIVO'),
        hint: formatStaffAccessSummary('DIRECTOR_ADMINISTRATIVO'),
    },
    {
        value: 'TECNICO_SECRETARIA',
        label: getStaffCargoLabel('TECNICO_SECRETARIA'),
        area: getStaffAreaLabel('TECNICO_SECRETARIA'),
        modules: getStaffAreaModules('TECNICO_SECRETARIA'),
        hint: formatStaffAccessSummary('TECNICO_SECRETARIA'),
    },
    {
        value: 'OUTRO',
        label: 'Outro funcionário',
        hint: 'Coordenação, administrativo auxiliar ou apoio (limpeza, segurança, etc.). Sem login.',
    },
]

const SUBCATEGORIAS_POR_CATEGORIA: Record<string, { value: string; label: string }[]> = {
    DIRECAO: [
        { value: 'DIRECTOR_PEDAGOGICO', label: 'Subdirector Pedagógico' },
        { value: 'DIRECTOR_ADMINISTRATIVO', label: 'Subdirector Administrativo' },
        { value: 'DIRECTOR_GERAL', label: 'Subdirector Geral' },
    ],
    COORDENACAO: [
        { value: 'COORDENADOR_CLASSE', label: 'Coordenador de Classe' },
        { value: 'COORDENADOR_DISCIPLINA', label: 'Coordenador de Disciplina' },
        { value: 'COORDENADOR_PEDAGOGICO', label: 'Coordenador Pedagógico' },
        { value: 'COORDENADOR_TURNO', label: 'Coordenador de Turno' },
    ],
    ADMINISTRATIVO: [
        { value: 'TECNICO_SECRETARIA', label: 'Técnico de Secretaria' },
        { value: 'AUXILIAR_ADMINISTRATIVO', label: 'Auxiliar Administrativo' },
        { value: 'RECEPCIONISTA', label: 'Recepcionista' },
        { value: 'TESOUREIRO', label: 'Tesoureiro' },
    ],
    APOIO: [
        { value: 'AUXILIAR_LIMPEZA', label: 'Auxiliar de Limpeza' },
        { value: 'SEGURANCA', label: 'Segurança' },
        { value: 'MOTORISTA', label: 'Motorista' },
        { value: 'CONTINUO', label: 'Contínuo' },
        { value: 'JARDINEIRO', label: 'Jardineiro' },
    ],
}

function perfilFromSubcategoria(subcategoria: string, _source?: StaffSource): string {
    const map: Record<string, string> = {
        DIRECTOR_PEDAGOGICO: 'Subdirector Pedagógico',
        DIRECTOR_ADMINISTRATIVO: 'Subdirector Administrativo',
        DIRECTOR_GERAL: 'Subdirector Geral',
        TECNICO_SECRETARIA: 'Técnico de Secretaria',
        SECRETARIO: 'Técnico de Secretaria',
    }
    return map[subcategoria] || subcategoria
}

/** Um único titular activo por escola para estes cargos de direcção */
const UNIQUE_DIRECTOR_ROLES = ['DIRECTOR_PEDAGOGICO', 'DIRECTOR_ADMINISTRATIVO'] as const
type UniqueDirectorRole = (typeof UNIQUE_DIRECTOR_ROLES)[number]

function isUniqueDirectorRole(role?: string | null): role is UniqueDirectorRole {
    return UNIQUE_DIRECTOR_ROLES.includes(role as UniqueDirectorRole)
}

const LEGACY_DIRECTOR_CARGO_LABELS: Record<UniqueDirectorRole, string[]> = {
    DIRECTOR_PEDAGOGICO: ['Director Pedagógico', 'Diretor Pedagógico'],
    DIRECTOR_ADMINISTRATIVO: ['Director Administrativo', 'Diretor Administrativo'],
}

function itemHoldsDirectorRole(item: UnifiedStaffItem, role: UniqueDirectorRole): boolean {
    if (!item.ativo) return false
    if (item.subcategoria === role) return true
    // secretarios.cargo / labels espelhados (actual + legado Director)
    if (
        item.cargo === role ||
        item.cargo === getStaffCargoLabel(role) ||
        LEGACY_DIRECTOR_CARGO_LABELS[role].includes(item.cargo)
    ) {
        return true
    }
    return false
}

function resolvePerfilConfig(tipo: TipoPerfilStaff): {
    categoria: FuncionarioEscola['categoria']
    subcategoria: string
    cargoLabel: string
    cargoCode: string
    hasLoginAccess: boolean
    departamentoDefault: string
} {
    switch (tipo) {
        case 'DIRECTOR_PEDAGOGICO':
            return {
                categoria: 'DIRECAO',
                subcategoria: 'DIRECTOR_PEDAGOGICO',
                cargoLabel: 'Subdirector Pedagógico',
                cargoCode: 'DIRECTOR_PEDAGOGICO',
                hasLoginAccess: true,
                departamentoDefault: 'Direcção Pedagógica',
            }
        case 'DIRECTOR_ADMINISTRATIVO':
            return {
                categoria: 'DIRECAO',
                subcategoria: 'DIRECTOR_ADMINISTRATIVO',
                cargoLabel: 'Subdirector Administrativo',
                cargoCode: 'DIRECTOR_ADMINISTRATIVO',
                hasLoginAccess: true,
                departamentoDefault: 'Direcção Administrativa',
            }
        case 'TECNICO_SECRETARIA':
            return {
                categoria: 'ADMINISTRATIVO',
                subcategoria: 'TECNICO_SECRETARIA',
                cargoLabel: 'Técnico de Secretaria',
                cargoCode: 'TECNICO_SECRETARIA',
                hasLoginAccess: true,
                departamentoDefault: 'Secretaria',
            }
        default:
            return {
                categoria: 'APOIO',
                subcategoria: '',
                cargoLabel: '',
                cargoCode: '',
                hasLoginAccess: false,
                departamentoDefault: '',
            }
    }
}

export const StaffPage: React.FC<StaffPageProps> = ({ onNavigate: _onNavigate, searchQuery = '' }) => {
    const { escolaProfile } = useAuth()
    const [staff, setStaff] = useState<UnifiedStaffItem[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showConfirmDelete, setShowConfirmDelete] = useState(false)
    const [editMode, setEditMode] = useState(false)
    const [selectedItem, setSelectedItem] = useState<UnifiedStaffItem | null>(null)
    const [itemToDelete, setItemToDelete] = useState<UnifiedStaffItem | null>(null)
    const [activeTab, setActiveTab] = useState<'pessoal' | 'profissional'>('pessoal')
    const [tipoPerfil, setTipoPerfil] = useState<TipoPerfilStaff>('TECNICO_SECRETARIA')

    const [formData, setFormData] = useState({
        nome_completo: '',
        email: '',
        telefone: '',
        genero: '' as '' | 'M' | 'F',
        data_nascimento: '',
        nif: '',
        numero_funcionario: '',
        categoria: '' as FuncionarioEscola['categoria'] | '',
        subcategoria: '',
        cargo: '',
        departamento: '',
        data_admissao: '',
        numero_filhos: '',
    })

    const parseNumeroFilhos = (value: string) =>
        value === '' ? 0 : Math.max(0, Math.min(20, parseInt(value, 10) || 0))

    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (escolaProfile) {
            loadStaff()
        }
    }, [escolaProfile])

    const loadStaff = async () => {
        if (!escolaProfile) return

        try {
            setLoading(true)
            setError(null)

            const [funcRes, secRes] = await Promise.all([
                supabase
                    .from('funcionarios_escola')
                    .select('*')
                    .eq('escola_id', escolaProfile.id)
                    .order('nome_completo', { ascending: true }),
                supabase
                    .from('secretarios')
                    .select('*')
                    .eq('escola_id', escolaProfile.id)
                    .order('nome_completo', { ascending: true }),
            ])

            if (funcRes.error) throw funcRes.error
            if (secRes.error) throw secRes.error

            const secByEmail = new Map(
                (secRes.data || [])
                    .filter((s) => s.email)
                    .map((s) => [String(s.email).toLowerCase(), s])
            )

            const funcionarios: UnifiedStaffItem[] = (funcRes.data || []).map((func) => {
                const linkedSec = func.email ? secByEmail.get(String(func.email).toLowerCase()) : undefined
                const subFromSec = linkedSec?.cargo as string | undefined
                const subcategoria =
                    func.subcategoria === 'SECRETARIO'
                        ? 'TECNICO_SECRETARIA'
                        : (func.subcategoria || subFromSec || 'TECNICO_SECRETARIA')
                return {
                    id: linkedSec?.id || func.id,
                    source: (linkedSec ? 'secretario' : 'funcionario') as StaffSource,
                    nome_completo: func.nome_completo,
                    email: func.email || linkedSec?.email || '',
                    telefone: func.telefone || linkedSec?.telefone || '',
                    numero_funcionario: func.numero_funcionario || linkedSec?.numero_funcionario || '',
                    categoria: func.categoria,
                    subcategoria,
                    cargo: func.cargo || perfilFromSubcategoria(subcategoria, linkedSec ? 'secretario' : 'funcionario'),
                    departamento: func.departamento || '',
                    genero: func.genero || '',
                    data_nascimento: func.data_nascimento || '',
                    nif: func.nif || '',
                    data_admissao: func.data_admissao || '',
                    numero_filhos: func.numero_filhos ?? 0,
                    ativo: linkedSec?.ativo ?? func.ativo,
                    user_id: linkedSec?.user_id ?? func.user_id,
                    perfilLabel: perfilFromSubcategoria(subcategoria, linkedSec ? 'secretario' : 'funcionario'),
                    funcionarioId: func.id,
                    secretarioId: linkedSec?.id,
                }
            })

            const emailsCovered = new Set(
                funcionarios.map((f) => f.email.toLowerCase()).filter(Boolean)
            )

            const secretariosOnly: UnifiedStaffItem[] = (secRes.data || [])
                .filter((sec) => !sec.email || !emailsCovered.has(sec.email.toLowerCase()))
                .map((sec) => {
                    const sub =
                        sec.cargo === 'DIRECTOR_PEDAGOGICO' ||
                        sec.cargo === 'DIRECTOR_ADMINISTRATIVO' ||
                        sec.cargo === 'TECNICO_SECRETARIA'
                            ? sec.cargo
                            : 'TECNICO_SECRETARIA'
                    return {
                        id: sec.id,
                        source: 'secretario' as const,
                        nome_completo: sec.nome_completo,
                        email: sec.email || '',
                        telefone: sec.telefone || '',
                        numero_funcionario: sec.numero_funcionario || '',
                        categoria: sub === 'TECNICO_SECRETARIA' ? 'ADMINISTRATIVO' : 'DIRECAO',
                        subcategoria: sub,
                        cargo: perfilFromSubcategoria(sub, 'secretario'),
                        departamento: '',
                        ativo: sec.ativo,
                        user_id: sec.user_id,
                        perfilLabel: perfilFromSubcategoria(sub, 'secretario'),
                        secretarioId: sec.id,
                    }
                })

            const merged = [...funcionarios, ...secretariosOnly].sort((a, b) =>
                a.nome_completo.localeCompare(b.nome_completo, 'pt')
            )
            setStaff(merged)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar funcionários'
            setError(translateError(errorMessage))
        } finally {
            setLoading(false)
        }
    }

    const applyTipoPerfilToForm = (tipo: TipoPerfilStaff) => {
        setTipoPerfil(tipo)
        if (tipo === 'OUTRO') return
        const cfg = resolvePerfilConfig(tipo)
        setFormData((prev) => ({
            ...prev,
            categoria: cfg.categoria,
            subcategoria: cfg.subcategoria,
            cargo: cfg.cargoLabel,
            departamento: cfg.departamentoDefault || prev.departamento,
        }))
    }

    /** True se já existe outro titular activo deste cargo (exclui o registo em edição). */
    const isDirectorRoleTaken = (role: UniqueDirectorRole, excludeItem?: UnifiedStaffItem | null): boolean => {
        return staff.some((item) => {
            if (!itemHoldsDirectorRole(item, role)) return false
            if (!excludeItem) return true
            if (item.id === excludeItem.id) return false
            if (excludeItem.funcionarioId && (item.id === excludeItem.funcionarioId || item.funcionarioId === excludeItem.funcionarioId)) {
                return false
            }
            if (excludeItem.secretarioId && (item.id === excludeItem.secretarioId || item.secretarioId === excludeItem.secretarioId)) {
                return false
            }
            return true
        })
    }

    const assertUniqueDirectorAvailable = async (
        role: string,
        excludeItem?: UnifiedStaffItem | null,
    ) => {
        if (!escolaProfile || !isUniqueDirectorRole(role)) return

        const label = getStaffCargoLabel(role)

        if (isDirectorRoleTaken(role, excludeItem)) {
            throw new Error(
                `Já existe um ${label} activo nesta escola. Não é permitido cadastro duplicado deste cargo.`,
            )
        }

        // Confirmação na BD (lista local pode estar desactualizada)
        const excludeFuncId = excludeItem?.funcionarioId || (excludeItem?.source === 'funcionario' ? excludeItem.id : null)
        const excludeSecId = excludeItem?.secretarioId || (excludeItem?.source === 'secretario' ? excludeItem.id : null)

        const { data: funcs, error: funcErr } = await supabase
            .from('funcionarios_escola')
            .select('id, nome_completo')
            .eq('escola_id', escolaProfile.id)
            .eq('subcategoria', role)
            .eq('ativo', true)
            .limit(10)
        if (funcErr) throw funcErr
        const conflictingFunc = (funcs || []).find((f) => f.id !== excludeFuncId)
        if (conflictingFunc) {
            throw new Error(
                `Já existe um ${label} activo nesta escola (${conflictingFunc.nome_completo}). Não é permitido cadastro duplicado deste cargo.`,
            )
        }

        const { data: secs, error: secErr } = await supabase
            .from('secretarios')
            .select('id, nome_completo, cargo')
            .eq('escola_id', escolaProfile.id)
            .eq('ativo', true)
            .limit(20)
        // Se a coluna cargo ainda não existir, ignora esta verificação extra
        if (!secErr) {
            const conflictingSec = (secs || []).find(
                (s) => s.cargo === role && s.id !== excludeSecId,
            )
            if (conflictingSec) {
                throw new Error(
                    `Já existe um ${label} activo nesta escola (${conflictingSec.nome_completo}). Não é permitido cadastro duplicado deste cargo.`,
                )
            }
        } else if (!/cargo/i.test(secErr.message)) {
            throw secErr
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!escolaProfile) return

        setError(null)
        setSuccess(null)
        setSubmitting(true)

        try {
            const cfg = resolvePerfilConfig(tipoPerfil)
            const isLoginStaff =
                (editMode && (
                    selectedItem?.source === 'secretario' ||
                    selectedItem?.subcategoria === 'DIRECTOR_PEDAGOGICO' ||
                    selectedItem?.subcategoria === 'DIRECTOR_ADMINISTRATIVO' ||
                    selectedItem?.subcategoria === 'TECNICO_SECRETARIA' ||
                    selectedItem?.subcategoria === 'SECRETARIO'
                )) ||
                (!editMode && cfg.hasLoginAccess)

            const categoria = tipoPerfil === 'OUTRO' ? formData.categoria : cfg.categoria
            const subcategoria = tipoPerfil === 'OUTRO' ? formData.subcategoria : cfg.subcategoria
            const cargoLabel = formData.cargo || (tipoPerfil === 'OUTRO' ? '' : cfg.cargoLabel)
            const cargoCode = cfg.cargoCode || (
                subcategoria === 'DIRECTOR_PEDAGOGICO' ||
                subcategoria === 'DIRECTOR_ADMINISTRATIVO' ||
                subcategoria === 'TECNICO_SECRETARIA'
                    ? subcategoria
                    : 'TECNICO_SECRETARIA'
            )

            if (!formData.nome_completo) {
                throw new Error('Nome completo é obrigatório')
            }

            // Unicidade: Director Pedagógico / Administrativo — um por escola
            const roleToGuard = isUniqueDirectorRole(subcategoria)
                ? subcategoria
                : isUniqueDirectorRole(cargoCode)
                    ? cargoCode
                    : null
            if (roleToGuard) {
                await assertUniqueDirectorAvailable(roleToGuard, editMode ? selectedItem : null)
            }

            if (isLoginStaff) {
                if (!formData.email) {
                    throw new Error('Email é obrigatório para perfis com acesso de login')
                }

                const secretarioPayloadBase = {
                    nome_completo: formData.nome_completo,
                    email: formData.email,
                    telefone: formData.telefone,
                    numero_funcionario: formData.numero_funcionario,
                }
                // cargo column may exist after migration; try with, fallback without
                const secretarioPayloadWithCargo = { ...secretarioPayloadBase, cargo: cargoCode }

                const funcionarioPayload = {
                    nome_completo: formData.nome_completo,
                    email: formData.email,
                    telefone: formData.telefone,
                    numero_funcionario: formData.numero_funcionario || null,
                    categoria: categoria || cfg.categoria,
                    subcategoria: subcategoria || cfg.subcategoria,
                    cargo: cargoLabel || cfg.cargoLabel,
                    departamento: formData.departamento || cfg.departamentoDefault || null,
                    genero: formData.genero || null,
                    data_nascimento: formData.data_nascimento || null,
                    nif: formData.nif || null,
                    data_admissao: formData.data_admissao || null,
                    numero_filhos: parseNumeroFilhos(formData.numero_filhos),
                }

                const upsertSecretario = async (secId: string | null) => {
                    if (secId) {
                        let { error: updateError } = await supabase
                            .from('secretarios')
                            .update(secretarioPayloadWithCargo)
                            .eq('id', secId)
                        if (updateError && /cargo/i.test(updateError.message)) {
                            const retry = await supabase
                                .from('secretarios')
                                .update(secretarioPayloadBase)
                                .eq('id', secId)
                            updateError = retry.error
                        }
                        if (updateError) throw updateError
                    } else {
                        let { error: insertError } = await supabase.from('secretarios').insert({
                            escola_id: escolaProfile.id,
                            ativo: true,
                            ...secretarioPayloadWithCargo,
                        })
                        if (insertError && /cargo/i.test(insertError.message)) {
                            const retry = await supabase.from('secretarios').insert({
                                escola_id: escolaProfile.id,
                                ativo: true,
                                ...secretarioPayloadBase,
                            })
                            insertError = retry.error
                        }
                        if (insertError) throw insertError
                    }
                }

                if (editMode && selectedItem) {
                    const secId = selectedItem.secretarioId || (selectedItem.source === 'secretario' ? selectedItem.id : null)
                    const funcId = selectedItem.funcionarioId || (selectedItem.source === 'funcionario' ? selectedItem.id : null)

                    await upsertSecretario(secId)

                    if (funcId) {
                        const { error: updateError } = await supabase
                            .from('funcionarios_escola')
                            .update(funcionarioPayload)
                            .eq('id', funcId)
                        if (updateError) throw updateError
                    } else if (!secId) {
                        // created new secretario above without HR mirror on edit of orphan
                    } else if (!funcId) {
                        const { error: insertFuncError } = await supabase.from('funcionarios_escola').insert({
                            escola_id: escolaProfile.id,
                            ativo: true,
                            ...funcionarioPayload,
                        })
                        if (insertFuncError) throw insertFuncError
                    }

                    setSuccess(`${cargoLabel || 'Funcionário'} atualizado com sucesso!`)
                } else {
                    await upsertSecretario(null)

                    const { error: insertFuncError } = await supabase.from('funcionarios_escola').insert({
                        escola_id: escolaProfile.id,
                        ativo: true,
                        ...funcionarioPayload,
                    })
                    if (insertFuncError) throw insertFuncError

                    setSuccess(`${cargoLabel || 'Funcionário'} cadastrado! Copie o link de convite para criar a conta de acesso.`)
                }
            } else {
                if (!categoria || !subcategoria) {
                    throw new Error('Categoria e subcategoria / perfil são obrigatórios')
                }

                const funcionarioData = {
                    nome_completo: formData.nome_completo,
                    email: formData.email || null,
                    telefone: formData.telefone || null,
                    genero: formData.genero || null,
                    data_nascimento: formData.data_nascimento || null,
                    nif: formData.nif || null,
                    numero_funcionario: formData.numero_funcionario || null,
                    categoria,
                    subcategoria,
                    cargo: formData.cargo || null,
                    departamento: formData.departamento || null,
                    data_admissao: formData.data_admissao || null,
                    numero_filhos: parseNumeroFilhos(formData.numero_filhos),
                }

                if (editMode && selectedItem) {
                    const funcId = selectedItem.funcionarioId || selectedItem.id
                    if (selectedItem.source === 'secretario' && !selectedItem.funcionarioId) {
                        throw new Error('Este registo tem acesso de secretaria. Edite-o como Técnico de Secretaria.')
                    }
                    const { error: updateError } = await supabase
                        .from('funcionarios_escola')
                        .update(funcionarioData)
                        .eq('id', funcId)
                    if (updateError) throw updateError
                    setSuccess('Funcionário atualizado com sucesso!')
                } else {
                    const { error: insertError } = await supabase.from('funcionarios_escola').insert({
                        escola_id: escolaProfile.id,
                        ativo: true,
                        ...funcionarioData,
                    })
                    if (insertError) throw insertError
                    setSuccess('Funcionário cadastrado com sucesso!')
                }
            }

            setShowModal(false)
            resetForm()
            loadStaff()
        } catch (err) {
            console.error('Erro ao salvar funcionário:', err)
            const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar funcionário'
            setError(translateError(errorMessage))
        } finally {
            setSubmitting(false)
        }
    }

    const resetForm = () => {
        setEditMode(false)
        setSelectedItem(null)
        setActiveTab('pessoal')
        setTipoPerfil('TECNICO_SECRETARIA')
        setFormData({
            nome_completo: '',
            email: '',
            telefone: '',
            genero: '',
            data_nascimento: '',
            nif: '',
            numero_funcionario: '',
            categoria: 'ADMINISTRATIVO',
            subcategoria: 'TECNICO_SECRETARIA',
            cargo: 'Técnico de Secretaria',
            departamento: 'Secretaria',
            data_admissao: '',
            numero_filhos: '',
        })
    }

    const detectTipoPerfil = (item: UnifiedStaffItem): TipoPerfilStaff => {
        if (item.subcategoria === 'DIRECTOR_PEDAGOGICO') return 'DIRECTOR_PEDAGOGICO'
        if (item.subcategoria === 'DIRECTOR_ADMINISTRATIVO') return 'DIRECTOR_ADMINISTRATIVO'
        if (item.subcategoria === 'TECNICO_SECRETARIA' || item.subcategoria === 'SECRETARIO') {
            return 'TECNICO_SECRETARIA'
        }
        const fromCargo = normalizeStaffCargo(
            item.cargo === 'DIRECTOR_PEDAGOGICO' ||
                item.cargo === 'DIRECTOR_ADMINISTRATIVO' ||
                item.cargo === 'TECNICO_SECRETARIA'
                ? item.cargo
                : null,
        )
        const isPedLabel =
            item.cargo === getStaffCargoLabel('DIRECTOR_PEDAGOGICO') ||
            LEGACY_DIRECTOR_CARGO_LABELS.DIRECTOR_PEDAGOGICO.includes(item.cargo)
        const isAdmLabel =
            item.cargo === getStaffCargoLabel('DIRECTOR_ADMINISTRATIVO') ||
            LEGACY_DIRECTOR_CARGO_LABELS.DIRECTOR_ADMINISTRATIVO.includes(item.cargo)
        if (
            item.source === 'secretario' ||
            isPedLabel ||
            isAdmLabel ||
            item.cargo === getStaffCargoLabel('TECNICO_SECRETARIA')
        ) {
            if (isPedLabel || fromCargo === 'DIRECTOR_PEDAGOGICO') {
                return 'DIRECTOR_PEDAGOGICO'
            }
            if (isAdmLabel || fromCargo === 'DIRECTOR_ADMINISTRATIVO') {
                return 'DIRECTOR_ADMINISTRATIVO'
            }
            return 'TECNICO_SECRETARIA'
        }
        return 'OUTRO'
    }

    const handleEdit = (item: UnifiedStaffItem) => {
        setEditMode(true)
        setSelectedItem(item)
        const tipo = detectTipoPerfil(item)
        setTipoPerfil(tipo)
        setFormData({
            nome_completo: item.nome_completo,
            email: item.email || '',
            telefone: item.telefone || '',
            genero: (item.genero as '' | 'M' | 'F') || '',
            data_nascimento: item.data_nascimento || '',
            nif: item.nif || '',
            numero_funcionario: item.numero_funcionario || '',
            categoria: (item.categoria as FuncionarioEscola['categoria']) || '',
            subcategoria: item.subcategoria,
            cargo: item.cargo || '',
            departamento: item.departamento || '',
            data_admissao: item.data_admissao || '',
            numero_filhos: item.numero_filhos != null ? String(item.numero_filhos) : '',
        })
        setShowModal(true)
    }

    const ensureLoginAccountAndCopyInvite = async (item: UnifiedStaffItem) => {
        if (!escolaProfile) return
        if (!item.email) {
            setError('Este funcionário não tem email para gerar o convite.')
            return
        }

        try {
            if (!item.secretarioId && item.source !== 'secretario') {
                const cargoCode =
                    item.subcategoria === 'DIRECTOR_PEDAGOGICO' ||
                    item.subcategoria === 'DIRECTOR_ADMINISTRATIVO' ||
                    item.subcategoria === 'TECNICO_SECRETARIA'
                        ? item.subcategoria
                        : 'TECNICO_SECRETARIA'
                const payload = {
                    escola_id: escolaProfile.id,
                    ativo: true,
                    nome_completo: item.nome_completo,
                    email: item.email,
                    telefone: item.telefone || null,
                    numero_funcionario: item.numero_funcionario || null,
                    cargo: cargoCode,
                }
                let { error: insertError } = await supabase.from('secretarios').insert(payload)
                if (insertError && /cargo/i.test(insertError.message)) {
                    const { cargo: _c, ...withoutCargo } = payload
                    const retry = await supabase.from('secretarios').insert(withoutCargo)
                    insertError = retry.error
                }
                if (insertError) throw insertError
                await loadStaff()
            }

            const cargoForInvite =
                item.subcategoria === 'DIRECTOR_PEDAGOGICO' ||
                item.subcategoria === 'DIRECTOR_ADMINISTRATIVO' ||
                item.subcategoria === 'TECNICO_SECRETARIA' ||
                item.subcategoria === 'SECRETARIO'
                    ? (item.subcategoria === 'SECRETARIO' ? 'TECNICO_SECRETARIA' : item.subcategoria)
                    : normalizeStaffCargo(
                        item.cargo === 'DIRECTOR_PEDAGOGICO' ||
                            item.cargo === 'DIRECTOR_ADMINISTRATIVO' ||
                            item.cargo === 'TECNICO_SECRETARIA'
                            ? item.cargo
                            : null,
                    )
            const inviteLink = buildStaffInviteLink(window.location.origin, item.email, cargoForInvite)
            await navigator.clipboard.writeText(inviteLink)
            setSuccess('Link de convite copiado para a área de transferência!')
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao preparar convite'
            setError(translateError(errorMessage))
        }
    }

    const handleDeleteClick = (item: UnifiedStaffItem) => {
        setItemToDelete(item)
        setShowConfirmDelete(true)
    }

    const handleConfirmDelete = async () => {
        if (!itemToDelete || !escolaProfile) return

        try {
            const secId = itemToDelete.secretarioId || (itemToDelete.source === 'secretario' ? itemToDelete.id : null)
            const funcId = itemToDelete.funcionarioId || (itemToDelete.source === 'funcionario' ? itemToDelete.id : null)

            if (secId) {
                const { error: delSec } = await supabase.from('secretarios').delete().eq('id', secId)
                if (delSec) throw delSec
            } else if (itemToDelete.email) {
                await supabase
                    .from('secretarios')
                    .delete()
                    .eq('escola_id', escolaProfile.id)
                    .eq('email', itemToDelete.email)
            }

            if (funcId) {
                const { error: delFunc } = await supabase.from('funcionarios_escola').delete().eq('id', funcId)
                if (delFunc) throw delFunc
            } else if (itemToDelete.email) {
                await supabase
                    .from('funcionarios_escola')
                    .delete()
                    .eq('escola_id', escolaProfile.id)
                    .eq('email', itemToDelete.email)
                    .in('subcategoria', [
                        'TECNICO_SECRETARIA',
                        'SECRETARIO',
                        'DIRECTOR_PEDAGOGICO',
                        'DIRECTOR_ADMINISTRATIVO',
                    ])
            }

            setSuccess('Funcionário removido com sucesso!')
            setShowConfirmDelete(false)
            setItemToDelete(null)
            loadStaff()
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao remover funcionário'
            setError(translateError(errorMessage))
            setShowConfirmDelete(false)
            setItemToDelete(null)
        }
    }

    const filteredStaff = staff.filter((item) => {
        const q = searchQuery.toLowerCase()
        return (
            item.nome_completo.toLowerCase().includes(q) ||
            item.cargo?.toLowerCase().includes(q) ||
            item.perfilLabel.toLowerCase().includes(q) ||
            item.email?.toLowerCase().includes(q) ||
            item.subcategoria.toLowerCase().includes(q)
        )
    })

    const isLoginForm =
        tipoPerfil === 'TECNICO_SECRETARIA' ||
        tipoPerfil === 'DIRECTOR_PEDAGOGICO' ||
        tipoPerfil === 'DIRECTOR_ADMINISTRATIVO' ||
        (editMode && selectedItem?.source === 'secretario')

    const subcategoriaOptions =
        formData.categoria && SUBCATEGORIAS_POR_CATEGORIA[formData.categoria]
            ? SUBCATEGORIAS_POR_CATEGORIA[formData.categoria]
            : []

    const perfilOptionDisabled = (optValue: TipoPerfilStaff): boolean => {
        if (!isUniqueDirectorRole(optValue)) return false
        // Em edição do próprio titular, o perfil continua seleccionado
        if (editMode && selectedItem && itemHoldsDirectorRole(selectedItem, optValue)) return false
        return isDirectorRoleTaken(optValue, editMode ? selectedItem : null)
    }

    const subcategoriaOptionDisabled = (value: string): boolean => {
        if (!isUniqueDirectorRole(value)) return false
        if (editMode && selectedItem && itemHoldsDirectorRole(selectedItem, value)) return false
        return isDirectorRoleTaken(value, editMode ? selectedItem : null)
    }

    if (loading) {
        return (
            <div className="space-y-6 animate-fade-in pb-24 md:pb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="skeleton w-12 h-12 rounded-xl"></div>
                        <div>
                            <div className="skeleton h-7 w-32 mb-2 rounded-lg"></div>
                            <div className="skeleton h-4 w-48 rounded"></div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4 md:space-y-6 pb-24 md:pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
                        <Icons.Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-slate-900">Funcionários</h2>
                        <p className="text-sm text-slate-500">
                            Direcção Pedagógica/Administrativa e Secretaria — com acesso de login por área
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        resetForm()
                        setShowModal(true)
                    }}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-medium rounded-xl transition-all duration-200 shadow-md shadow-indigo-500/25 min-h-touch touch-feedback w-full sm:w-auto"
                >
                    <Icons.UserPlus className="w-5 h-5" />
                    <span>Novo Funcionário</span>
                </button>
            </div>

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

            {!loading && filteredStaff.length === 0 && !error ? (
                <Card>
                    <CardBody className="text-center py-12 md:py-16 px-6">
                        <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <Icons.Users className="w-10 h-10 text-slate-400" />
                        </div>
                        <h3 className="text-lg md:text-xl font-semibold text-slate-900 mb-2">
                            {searchQuery ? 'Nenhum funcionário encontrado' : 'Nenhum funcionário cadastrado'}
                        </h3>
                        <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                            Cadastre Subdirectores Pedagógicos/Administrativos, Técnicos de Secretaria e outros funcionários.
                        </p>
                    </CardBody>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                    {filteredStaff.map((item) => {
                        const isLoginProfile =
                            item.subcategoria === 'TECNICO_SECRETARIA' ||
                            item.subcategoria === 'SECRETARIO' ||
                            item.subcategoria === 'DIRECTOR_PEDAGOGICO' ||
                            item.subcategoria === 'DIRECTOR_ADMINISTRATIVO'
                        const hasSystemAccess = item.source === 'secretario' || !!item.secretarioId
                        return (
                            <Card key={`${item.source}-${item.id}`} className="hover:shadow-lg transition-all duration-300 touch-feedback">
                                <CardBody className="p-4">
                                    <div className="flex items-start gap-3 mb-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0 ${
                                            hasSystemAccess
                                                ? 'bg-gradient-to-br from-emerald-100 to-teal-200 text-emerald-700'
                                                : 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600'
                                        }`}>
                                            {item.nome_completo.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-base font-semibold text-slate-900 truncate">{item.nome_completo}</h3>
                                            <p className="text-xs text-slate-500 truncate">{item.perfilLabel}</p>
                                            {isLoginProfile && (
                                                <p className="text-[11px] text-indigo-600 font-medium truncate mt-0.5">
                                                    {getStaffAreaLabel(normalizeStaffCargo(item.subcategoria))}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                                                    {item.categoria}
                                                </span>
                                                {isLoginProfile && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                                        Login
                                                    </span>
                                                )}
                                                {hasSystemAccess && (
                                                    <>
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${item.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {item.ativo ? 'Ativo' : 'Inativo'}
                                                        </span>
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${item.user_id ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {item.user_id ? 'Registado' : 'Pendente'}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mb-4">
                                        {item.email && (
                                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                                                <Icons.Email className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                                <span className="text-sm text-slate-700 truncate">{item.email}</span>
                                            </div>
                                        )}
                                        {item.telefone && (
                                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                                                <Icons.Phone className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                                <span className="text-sm text-slate-700">{item.telefone}</span>
                                            </div>
                                        )}
                                        {item.numero_funcionario && (
                                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                                                <Icons.Briefcase className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                                <span className="text-sm text-slate-700">Nº {item.numero_funcionario}</span>
                                            </div>
                                        )}
                                        <TempoServicoReformaInfo
                                            dataNascimento={item.data_nascimento}
                                            dataInicioServico={item.data_admissao}
                                            genero={item.genero}
                                            numeroFilhos={item.numero_filhos}
                                            variant="compact"
                                        />
                                    </div>

                                    <div className="flex gap-2 pt-3 border-t border-slate-100">
                                        <button
                                            onClick={() => handleEdit(item)}
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-all duration-200 touch-feedback min-h-touch"
                                        >
                                            <Icons.Edit className="w-4 h-4" />
                                            <span>Editar</span>
                                        </button>
                                        {isLoginProfile && !item.user_id && item.email && (
                                            <button
                                                onClick={() => ensureLoginAccountAndCopyInvite(item)}
                                                className="flex items-center justify-center px-3 py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl transition-all duration-200 touch-feedback min-h-touch"
                                                title="Copiar link de convite"
                                            >
                                                <Icons.Link className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteClick(item)}
                                            className="flex items-center justify-center px-3 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl transition-all duration-200 touch-feedback min-h-touch"
                                        >
                                            <Icons.Trash className="w-4 h-4" />
                                        </button>
                                    </div>
                                </CardBody>
                            </Card>
                        )
                    })}
                </div>
            )}

            <FormModal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false)
                    resetForm()
                }}
                title={editMode ? 'Editar Funcionário' : 'Novo Funcionário'}
                subtitle={editMode ? 'Actualize os dados do colaborador' : 'Preencha os dados para cadastrar'}
                icon={editMode ? <Icons.Edit /> : <Icons.UserPlus />}
                accent="indigo"
                size="lg"
                busy={submitting}
            >
                            <div className="px-4 sm:px-5 pt-3">
                                <label className="form-label">Perfil *</label>
                                <select
                                    value={tipoPerfil}
                                    onChange={(e) => applyTipoPerfilToForm(e.target.value as TipoPerfilStaff)}
                                    className="form-input min-h-touch"
                                    disabled={editMode && selectedItem?.source === 'secretario'}
                                >
                                    {PERFIL_OPTIONS.map((opt) => {
                                        const taken = perfilOptionDisabled(opt.value)
                                        return (
                                            <option key={opt.value} value={opt.value} disabled={taken}>
                                                {opt.area ? `${opt.label} — ${opt.area}` : opt.label}
                                                {taken ? ' (já cadastrado)' : ''}
                                            </option>
                                        )
                                    })}
                                </select>
                                {(tipoPerfil === 'DIRECTOR_PEDAGOGICO' || tipoPerfil === 'DIRECTOR_ADMINISTRATIVO') &&
                                    perfilOptionDisabled(tipoPerfil) && (
                                    <p className="mt-1.5 text-xs text-amber-700">
                                        Já existe um {getStaffCargoLabel(tipoPerfil)} activo. Escolha outro perfil ou edite o registo existente.
                                    </p>
                                )}
                                {(() => {
                                    const opt = PERFIL_OPTIONS.find((o) => o.value === tipoPerfil)
                                    if (!opt) return null
                                    if (opt.area && opt.modules) {
                                        return (
                                            <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2.5">
                                                <p className="text-xs font-semibold text-indigo-800">
                                                    Ao iniciar sessão acede à {opt.area}
                                                </p>
                                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                    {opt.modules.map((mod) => (
                                                        <span
                                                            key={mod}
                                                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white text-indigo-700 ring-1 ring-indigo-100"
                                                        >
                                                            {mod}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    }
                                    return <p className="mt-1.5 text-xs text-slate-500">{opt.hint}</p>
                                })()}
                            </div>

                            <div className="flex border-b border-slate-100 mt-4 px-1">
                                <button
                                    type="button"
                                    className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'pessoal' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                    onClick={() => setActiveTab('pessoal')}
                                >
                                    Pessoal
                                </button>
                                <button
                                    type="button"
                                    className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'profissional' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                    onClick={() => setActiveTab('profissional')}
                                >
                                    Profissional
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3.5">
                                {activeTab === 'pessoal' && (
                                    <div className="space-y-4 animate-fade-in">
                                        <Input
                                            label="Nome Completo *"
                                            type="text"
                                            value={formData.nome_completo}
                                            onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                                            placeholder="Ex: Maria José"
                                            required
                                        />

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <Input
                                                label="Data de Nascimento"
                                                type="date"
                                                value={formData.data_nascimento}
                                                onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                                            />
                                            <div>
                                                <label className="form-label">Género</label>
                                                <select
                                                    value={formData.genero}
                                                    onChange={(e) => setFormData({ ...formData, genero: e.target.value as '' | 'M' | 'F' })}
                                                    className="form-input min-h-touch"
                                                >
                                                    <option value="">Selecione</option>
                                                    <option value="M">Masculino</option>
                                                    <option value="F">Feminino</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <Input
                                                label={isLoginForm ? 'Email *' : 'Email'}
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                placeholder="email@escola.com"
                                                required={isLoginForm}
                                            />
                                            <Input
                                                label="Telefone"
                                                type="tel"
                                                value={formData.telefone}
                                                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                                                placeholder="+244 9..."
                                            />
                                        </div>

                                        <Input
                                            label="NIF"
                                            type="text"
                                            value={formData.nif}
                                            onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                                            placeholder="Nº Identificação Fiscal"
                                        />

                                        {formData.genero === 'F' && (
                                            <Input
                                                label="N.º de filhos (redução idade reforma — DP 299/20)"
                                                type="number"
                                                min={0}
                                                max={20}
                                                value={formData.numero_filhos}
                                                onChange={(e) => setFormData({ ...formData, numero_filhos: e.target.value })}
                                                placeholder="0"
                                            />
                                        )}

                                        <TempoServicoReformaInfo
                                            dataNascimento={formData.data_nascimento}
                                            dataInicioServico={formData.data_admissao}
                                            genero={formData.genero}
                                            numeroFilhos={parseNumeroFilhos(formData.numero_filhos)}
                                            variant="detail"
                                        />
                                    </div>
                                )}

                                {activeTab === 'profissional' && (
                                    <div className="space-y-4 animate-fade-in">
                                        {tipoPerfil === 'OUTRO' ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="form-label">Categoria *</label>
                                                    <select
                                                        value={formData.categoria}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            categoria: e.target.value as FuncionarioEscola['categoria'],
                                                            subcategoria: '',
                                                        })}
                                                        className="form-input min-h-touch"
                                                        required
                                                    >
                                                        <option value="">Selecione</option>
                                                        <option value="DIRECAO">Direção</option>
                                                        <option value="COORDENACAO">Coordenação</option>
                                                        <option value="ADMINISTRATIVO">Administrativo</option>
                                                        <option value="APOIO">Apoio (Limpeza/Segurança)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="form-label">Subcategoria *</label>
                                                    <select
                                                        value={formData.subcategoria}
                                                        onChange={(e) => setFormData({ ...formData, subcategoria: e.target.value })}
                                                        className="form-input min-h-touch"
                                                        required
                                                    >
                                                        <option value="">Selecione</option>
                                                        {subcategoriaOptions.map((opt) => {
                                                            const taken = subcategoriaOptionDisabled(opt.value)
                                                            return (
                                                                <option key={opt.value} value={opt.value} disabled={taken}>
                                                                    {opt.label}{taken ? ' (já cadastrado)' : ''}
                                                                </option>
                                                            )
                                                        })}
                                                    </select>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="px-3 py-2.5 bg-slate-50 rounded-xl text-sm text-slate-700">
                                                <span className="font-medium">{PERFIL_OPTIONS.find((o) => o.value === tipoPerfil)?.label}</span>
                                                <span className="text-slate-400"> · </span>
                                                <span>{formData.categoria} / {formData.subcategoria}</span>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <Input
                                                label="Cargo"
                                                type="text"
                                                value={formData.cargo}
                                                onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                                                placeholder="Ex: Subdirector Pedagógico"
                                            />
                                            <Input
                                                label="Departamento"
                                                type="text"
                                                value={formData.departamento}
                                                onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                                                placeholder="Ex: Direcção Pedagógica"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <Input
                                                label="Nº Funcionário"
                                                type="text"
                                                value={formData.numero_funcionario}
                                                onChange={(e) => setFormData({ ...formData, numero_funcionario: e.target.value })}
                                            />
                                            <Input
                                                label="Data Admissão"
                                                type="date"
                                                value={formData.data_admissao}
                                                onChange={(e) => setFormData({ ...formData, data_admissao: e.target.value })}
                                            />
                                        </div>

                                        {isLoginForm && tipoPerfil !== 'OUTRO' && (
                                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 space-y-1.5">
                                                <p>
                                                    Este perfil recebe <strong>acesso de login</strong> à{' '}
                                                    <strong>{getStaffAreaLabel(tipoPerfil as StaffLoginCargo)}</strong>.
                                                </p>
                                                <p className="text-emerald-700">
                                                    Módulos: {getStaffAreaModules(tipoPerfil as StaffLoginCargo).join(' · ')}
                                                </p>
                                                <p className="text-emerald-700/90">
                                                    Após cadastrar, use o botão de convite no cartão para criar a conta.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex gap-2.5 pt-4 border-t border-slate-100 mt-2 sticky bottom-0 bg-white pb-0.5">
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
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-medium rounded-xl transition-all duration-200 shadow-md shadow-indigo-500/25 disabled:opacity-50 touch-feedback min-h-touch"
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

            <ConfirmModal
                isOpen={showConfirmDelete}
                onClose={() => {
                    setShowConfirmDelete(false)
                    setItemToDelete(null)
                }}
                onConfirm={handleConfirmDelete}
                title="Remover Funcionário?"
                message="Tem certeza que deseja remover este funcionário? Esta ação não pode ser desfeita."
                confirmText="Sim, Remover"
                cancelText="Cancelar"
                variant="danger"
            />
        </div>
    )
}
