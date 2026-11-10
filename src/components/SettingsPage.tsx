/**
 * @component SettingsPage
 * @description Página de configurações moderna mobile-first para todos os perfis
 * @tokens [--color-primary, --fs-md, min-h-touch]
 * @responsive true
 * @tested-on [375x667, 768x1024, 1440x900]
 */

import { useState, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { translateError } from '../utils/translations'
import { useAuth } from '../contexts/AuthContext'
import { isSuperAdmin } from '../utils/permissions'
import { HeaderConfig, loadHeaderConfig } from '../utils/headerConfigUtils'
import { ConfiguracaoCabecalhoModal } from './ConfiguracaoCabecalhoModal'
import {
    ESCOLA_NATUREZA_OPTIONS,
    EscolaNatureza,
    getEscolaNaturezaFromConfig,
} from '../utils/angolaGradeScale'
import {
    TIPO_ESCOLA_OPTIONS,
    parseTipoEscolaFromConfig,
    type TipoEscolaCenso,
} from '../modules/censo_escolar/utils/escolaModalidade'
import { applyMedCurriculumTemplates } from '../utils/applyMedCurriculumTemplates'
import { Alert } from './ui/Alert'
import { Icons } from './ui/Icons'

type TipoEscolaConfig = Exclude<TipoEscolaCenso, 'desconhecido'>

/** Controlo compacto — evita o min-h 48px dos inputs globais nesta página */
const fieldClass =
    'w-full h-10 px-3 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg ' +
    'placeholder:text-slate-400 ' +
    'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 ' +
    'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed ' +
    'transition-colors duration-150'

const selectClass = `${fieldClass} appearance-none bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat pr-9`

const selectChevron =
    "bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 24 24%22 stroke=%22%2394a3b8%22%3E%3Cpath stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%222%22 d=%22M19 9l-7 7-7-7%22/%3E%3C/svg%3E')]"

const labelClass = 'block text-[13px] font-medium text-slate-700 mb-1.5'
const helpClass = 'mt-1.5 text-xs text-slate-500 leading-relaxed'

const btnBase =
    'inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium rounded-lg ' +
    'transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed'

const SectionCard = ({
    icon,
    tone,
    title,
    subtitle,
    children,
    className = '',
}: {
    icon: ReactNode
    tone: string
    title: string
    subtitle: string
    children: ReactNode
    className?: string
}) => (
    <section
        className={`bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden ${className}`}
    >
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
                {icon}
            </div>
            <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 leading-tight">{title}</h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>
            </div>
        </div>
        <div className="p-5">{children}</div>
    </section>
)

export const SettingsPage: React.FC = () => {
    const { profile, signOut, escolaProfile, professorProfile, secretarioProfile, isEscola, isProfessor, isSecretario, refreshProfile } = useAuth()
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [showHeaderConfigModal, setShowHeaderConfigModal] = useState(false)
    const [headerConfig, setHeaderConfig] = useState<HeaderConfig | null>(null)
    const [natureza, setNatureza] = useState<EscolaNatureza | ''>('')
    const [tipoEscola, setTipoEscola] = useState<TipoEscolaConfig | ''>('')
    const [savingNatureza, setSavingNatureza] = useState(false)

    const isSuperAdminUser = profile ? isSuperAdmin(profile) : false
    const escolaId = escolaProfile?.id || professorProfile?.escola_id || secretarioProfile?.escola_id || ''
    const canConfigureDocumentHeader = !!escolaId && (isEscola || isProfessor || isSecretario)
    const canEditEscolaNatureza = isEscola && !!escolaProfile?.id

    const pageSubtitle = isSuperAdminUser
        ? 'Perfil e segurança do SUPERADMIN'
        : canEditEscolaNatureza
            ? 'Perfil, segurança e preferências da instituição'
            : 'Gerencie o seu perfil e preferências'

    const roleLabel = isSuperAdminUser
        ? 'SUPERADMIN'
        : isEscola
            ? 'Administrador'
            : isProfessor
                ? 'Professor'
                : isSecretario
                    ? 'Secretário'
                    : 'Utilizador'

    useEffect(() => {
        loadUserData()
    }, [])

    useEffect(() => {
        const cfg = escolaProfile?.configuracoes as Record<string, unknown>
        setNatureza(getEscolaNaturezaFromConfig(cfg) || '')
        setTipoEscola(parseTipoEscolaFromConfig(cfg) || '')
    }, [escolaProfile?.id, escolaProfile?.configuracoes])

    useEffect(() => {
        if (!canEditEscolaNatureza || !escolaProfile?.id) return
        let cancelled = false
        ;(async () => {
            const { data } = await supabase
                .from('escolas')
                .select('configuracoes')
                .eq('id', escolaProfile.id)
                .maybeSingle()
            if (cancelled) return
            const cfg = data?.configuracoes as Record<string, unknown>
            const fromDbNatureza = getEscolaNaturezaFromConfig(cfg)
            const fromDbTipo = parseTipoEscolaFromConfig(cfg)
            if (fromDbNatureza) setNatureza(fromDbNatureza)
            if (fromDbTipo) setTipoEscola(fromDbTipo)
        })()
        return () => { cancelled = true }
    }, [canEditEscolaNatureza, escolaProfile?.id])

    useEffect(() => {
        if (!canConfigureDocumentHeader) {
            setHeaderConfig(null)
            return
        }
        let cancelled = false
        ;(async () => {
            const config = await loadHeaderConfig(escolaId)
            if (!cancelled) setHeaderConfig(config)
        })()
        return () => { cancelled = true }
    }, [canConfigureDocumentHeader, escolaId])

    const handleSaveNatureza = async () => {
        if (!escolaProfile?.id) return
        if (!natureza) {
            setError('Seleccione a natureza da instituição')
            return
        }
        if (!tipoEscola) {
            setError('Seleccione o tipo / subsistema de ensino da escola')
            return
        }

        setSavingNatureza(true)
        setError(null)
        setSuccess(null)

        try {
            const updatedConfig = {
                ...(escolaProfile.configuracoes || {}),
                natureza,
                tipo_escola: tipoEscola,
            }
            const { error: updateError } = await supabase
                .from('escolas')
                .update({ configuracoes: updatedConfig })
                .eq('id', escolaProfile.id)

            if (updateError) throw updateError

            let curriculumMsg = ''
            try {
                const result = await applyMedCurriculumTemplates({
                    supabase,
                    escolaId: escolaProfile.id,
                    tipoEscola,
                    natureza,
                    mode: 'fill_missing',
                })
                if (result.createdDisciplinas > 0) {
                    curriculumMsg = ` ${result.message}`
                }
            } catch (seedErr) {
                console.warn('Currículo MED não aplicado:', seedErr)
            }

            await refreshProfile()
            setSuccess(`Perfil institucional actualizado.${curriculumMsg}`)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao actualizar perfil institucional'
            setError(translateError(errorMessage))
        } finally {
            setSavingNatureza(false)
        }
    }

    const loadUserData = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            setFullName(user.user_metadata?.full_name || '')
            setEmail(user.email || '')
        }
    }

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                data: { full_name: fullName }
            })

            if (updateError) throw updateError

            setSuccess('Perfil actualizado com sucesso!')
            loadUserData()
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao actualizar perfil'
            setError(translateError(errorMessage))
        } finally {
            setLoading(false)
        }
    }

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            if (newPassword !== confirmPassword) {
                throw new Error('As palavras-passe não coincidem')
            }

            if (newPassword.length < 6) {
                throw new Error('A palavra-passe deve ter pelo menos 6 caracteres')
            }

            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            })

            if (updateError) throw updateError

            setSuccess('Palavra-passe alterada com sucesso!')
            setNewPassword('')
            setConfirmPassword('')
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao alterar palavra-passe'
            setError(translateError(errorMessage))
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = () => {
        signOut()
    }

    const initials = (fullName || email || 'U')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || '')
        .join('') || 'U'

    return (
        <div className="pb-24 md:pb-8 animate-fade-in -mx-4 md:-mx-8">
            {/* Hero profissional full-bleed */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-4 md:px-8 pt-8 pb-16 md:pt-10 md:pb-20">
                <div className="pointer-events-none absolute inset-0 opacity-[0.15]">
                    <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full bg-primary-400 blur-3xl" />
                    <div className="absolute -bottom-28 -left-10 w-72 h-72 rounded-full bg-sky-400 blur-3xl" />
                    <div
                        className="absolute inset-0 opacity-30"
                        style={{
                            backgroundImage:
                                'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.35) 1px, transparent 0)',
                            backgroundSize: '22px 22px',
                        }}
                    />
                </div>

                <div className="relative max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6">
                    <div className="w-16 h-16 md:w-[4.5rem] md:h-[4.5rem] rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur-sm flex items-center justify-center shadow-xl shadow-black/20 shrink-0">
                        <span className="text-xl md:text-2xl font-semibold tracking-wide !text-white" style={{ color: '#ffffff' }}>
                            {initials}
                        </span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <div
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 ring-1 ring-white/30 text-[11px] font-medium mb-2.5 !text-white"
                            style={{ color: '#ffffff' }}
                        >
                            <Icons.Settings className="w-3.5 h-3.5 !text-white" />
                            Conta · {roleLabel}
                        </div>
                        <h2
                            className="text-2xl md:text-3xl font-bold tracking-tight !text-white"
                            style={{ color: '#ffffff' }}
                        >
                            Configurações
                        </h2>
                        <p
                            className="text-sm md:text-[15px] mt-1.5 max-w-xl leading-relaxed !text-slate-100"
                            style={{ color: '#f1f5f9' }}
                        >
                            {pageSubtitle}
                        </p>
                        {email && (
                            <p
                                className="text-xs mt-2 truncate !text-slate-200"
                                style={{ color: '#e2e8f0' }}
                            >
                                {email}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Conteúdo centrado, sobreposto ao hero */}
            <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 -mt-10 md:-mt-12 space-y-4 md:space-y-5">
                {error && (
                    <Alert type="error" message={error} onClose={() => setError(null)} className="animate-slide-up shadow-sm" />
                )}
                {success && (
                    <Alert type="success" message={success} onClose={() => setSuccess(null)} className="animate-slide-up shadow-sm" />
                )}

                {/* Perfil + palavra-passe em grelha no desktop */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
                    <SectionCard
                        tone="bg-primary-50 text-primary-600"
                        icon={<Icons.User className="w-4 h-4" />}
                        title="Informações do Perfil"
                        subtitle="Dados pessoais da conta"
                    >
                        <form onSubmit={handleUpdateProfile} className="space-y-3.5">
                            <div>
                                <label htmlFor="settings-fullname" className={labelClass}>
                                    Nome Completo <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="settings-fullname"
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Seu nome completo"
                                    required
                                    className={fieldClass}
                                />
                            </div>
                            <div>
                                <label htmlFor="settings-email" className={labelClass}>Email</label>
                                <input
                                    id="settings-email"
                                    type="email"
                                    value={email}
                                    disabled
                                    className={fieldClass}
                                />
                                <p className={helpClass}>O email não pode ser alterado</p>
                            </div>
                            <div className="flex justify-end pt-1">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`${btnBase} bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 shadow-sm shadow-primary-600/20`}
                                >
                                    {loading ? 'A guardar…' : 'Guardar alterações'}
                                </button>
                            </div>
                        </form>
                    </SectionCard>

                    <SectionCard
                        tone="bg-amber-50 text-amber-600"
                        icon={<Icons.Lock className="w-4 h-4" />}
                        title="Alterar Palavra-passe"
                        subtitle="Segurança da conta"
                    >
                        <form onSubmit={handleChangePassword} className="space-y-3.5">
                            <div>
                                <label htmlFor="settings-new-password" className={labelClass}>
                                    Nova palavra-passe <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="settings-new-password"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className={fieldClass}
                                />
                                <p className={helpClass}>Mínimo de 6 caracteres</p>
                            </div>
                            <div>
                                <label htmlFor="settings-confirm-password" className={labelClass}>
                                    Confirmar palavra-passe <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="settings-confirm-password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className={fieldClass}
                                />
                            </div>
                            <div className="flex justify-end pt-1">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`${btnBase} bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500 shadow-sm shadow-amber-600/20`}
                                >
                                    {loading ? 'A alterar…' : 'Alterar palavra-passe'}
                                </button>
                            </div>
                        </form>
                    </SectionCard>
                </div>

                {/* Natureza da instituição */}
                {canEditEscolaNatureza && (
                    <SectionCard
                        tone="bg-emerald-50 text-emerald-600"
                        icon={<Icons.School className="w-4 h-4" />}
                        title="Perfil Institucional"
                        subtitle="Natureza e subsistema de ensino (RAA / Templates)"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label htmlFor="settings-natureza" className={labelClass}>
                                    Natureza <span className="text-red-500">*</span>
                                </label>
                                <select
                                    id="settings-natureza"
                                    value={natureza}
                                    onChange={(e) => setNatureza(e.target.value as EscolaNatureza | '')}
                                    className={`${selectClass} ${selectChevron}`}
                                >
                                    <option value="">Seleccione…</option>
                                    {ESCOLA_NATUREZA_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                                <p className={helpClass}>
                                    Pública / Público-privada: Primário 1–10, Secundário 0–20.
                                </p>
                            </div>
                            <div>
                                <label htmlFor="settings-tipo-escola" className={labelClass}>
                                    Tipo / Subsistema <span className="text-red-500">*</span>
                                </label>
                                <select
                                    id="settings-tipo-escola"
                                    value={tipoEscola}
                                    onChange={(e) => setTipoEscola(e.target.value as TipoEscolaConfig | '')}
                                    className={`${selectClass} ${selectChevron}`}
                                >
                                    <option value="">Seleccione…</option>
                                    {TIPO_ESCOLA_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                                <p className={helpClass}>
                                    Ao guardar, o sistema completa as disciplinas oficiais MED/INADE
                                    em falta (sem alterar as que já editou).
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end pt-4">
                            <button
                                type="button"
                                onClick={handleSaveNatureza}
                                disabled={savingNatureza || !natureza || !tipoEscola}
                                className={`${btnBase} bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500 shadow-sm shadow-emerald-600/20`}
                            >
                                {savingNatureza ? 'A guardar…' : 'Guardar perfil institucional'}
                            </button>
                        </div>
                    </SectionCard>
                )}

                {/* Cabeçalho + Preferências / Sessão */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
                    {canConfigureDocumentHeader && (
                        <SectionCard
                            tone="bg-indigo-50 text-indigo-600"
                            icon={<Icons.DocumentText className="w-4 h-4" />}
                            title="Cabeçalho dos Documentos"
                            subtitle="Logo e identificação nos PDFs"
                        >
                            {headerConfig?.nome_escola ? (
                                <div className="flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3.5 py-2.5 mb-4">
                                    <Icons.CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-emerald-800">Configurado</p>
                                        <p className="text-xs text-emerald-700 mt-0.5 truncate">{headerConfig.nome_escola}</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                                    Ainda não há cabeçalho guardado. Configure uma vez — aplica-se a pautas, listas e recibos.
                                </p>
                            )}
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowHeaderConfigModal(true)}
                                    className={`${btnBase} bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 shadow-sm shadow-indigo-600/20`}
                                >
                                    {headerConfig ? 'Editar cabeçalho' : 'Configurar cabeçalho'}
                                </button>
                            </div>
                        </SectionCard>
                    )}

                    {!isSuperAdminUser && (
                        <SectionCard
                            tone="bg-sky-50 text-sky-600"
                            icon={<Icons.Adjustments className="w-4 h-4" />}
                            title="Preferências do Sistema"
                            subtitle="Configurações académicas"
                            className={!canConfigureDocumentHeader ? 'lg:col-span-2' : ''}
                        >
                            <div className="divide-y divide-slate-100 -mx-5 -my-5">
                                <div className="flex items-center justify-between px-5 py-3.5 gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-800">Escala de Notas (RAA)</p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Primário 1–10 · Secundário 0–20
                                            {natureza === 'privada' ? ' · Privada: livre' : ''}
                                        </p>
                                    </div>
                                    <span className="px-2 py-0.5 bg-primary-50 text-primary-700 text-[11px] font-semibold rounded-md ring-1 ring-inset ring-primary-100 flex-shrink-0">
                                        Oficial
                                    </span>
                                </div>
                                <div className="flex items-center justify-between px-5 py-3.5 gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-800">Ano Lectivo Actual</p>
                                        <p className="text-xs text-slate-500 mt-0.5">2025</p>
                                    </div>
                                    <button type="button" className={`${btnBase} !h-8 !px-3 text-primary-600 hover:bg-primary-50`}>
                                        Editar
                                    </button>
                                </div>
                                <div className="flex items-center justify-between px-5 py-3.5 gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-800">Trimestre Actual</p>
                                        <p className="text-xs text-slate-500 mt-0.5">1º Trimestre</p>
                                    </div>
                                    <button type="button" className={`${btnBase} !h-8 !px-3 text-primary-600 hover:bg-primary-50`}>
                                        Editar
                                    </button>
                                </div>
                            </div>
                        </SectionCard>
                    )}

                    {isSuperAdminUser && (
                        <SectionCard
                            tone="bg-violet-50 text-violet-600"
                            icon={<Icons.Shield className="w-4 h-4" />}
                            title="Segurança da Sessão"
                            subtitle="Gestão de sessões activas"
                            className={!canConfigureDocumentHeader ? 'lg:col-span-2' : ''}
                        >
                            <div className="bg-violet-50/80 border border-violet-100 rounded-xl p-3.5 mb-3">
                                <div className="flex items-start gap-2.5">
                                    <Icons.Info className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-violet-900 text-sm">Sessão actual</p>
                                        <p className="text-xs text-violet-700 mt-1">
                                            Ligado desde {new Date().toLocaleDateString('pt-AO')} às{' '}
                                            {new Date().toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500">
                                Por motivos de segurança, considere terminar a sessão ao finalizar o trabalho.
                            </p>
                        </SectionCard>
                    )}
                </div>

                {/* Conta + info da app */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
                    <SectionCard
                        tone="bg-red-50 text-red-600"
                        icon={<Icons.Logout className="w-4 h-4" />}
                        title="Acções da Conta"
                        subtitle="Terminar sessão neste dispositivo"
                    >
                        <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                            Vai sair da conta actual. Poderá voltar a entrar a qualquer momento.
                        </p>
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={handleLogout}
                                className={`${btnBase} bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm shadow-red-600/20`}
                            >
                                <Icons.Logout className="w-4 h-4" />
                                Sair da conta
                            </button>
                        </div>
                    </SectionCard>

                    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-5 py-6 flex flex-col items-center justify-center text-center">
                        <div className="w-11 h-11 mb-3 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-md shadow-primary-500/20">
                            <Icons.BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <p className="text-sm font-semibold text-slate-900">EduGest Angola</p>
                        <p className="text-xs text-slate-500 mt-1">Versão 1.0.0</p>
                        <p className="text-[11px] text-slate-400 mt-2.5 max-w-[16rem] leading-relaxed">
                            Sistema de Gestão Escolar para Angola · © 2025
                        </p>
                    </section>
                </div>
            </div>

            {canConfigureDocumentHeader && (
                <ConfiguracaoCabecalhoModal
                    isOpen={showHeaderConfigModal}
                    onClose={() => setShowHeaderConfigModal(false)}
                    onSave={async () => {
                        const config = await loadHeaderConfig(escolaId)
                        setHeaderConfig(config)
                        setShowHeaderConfigModal(false)
                    }}
                    escolaId={escolaId}
                />
            )}
        </div>
    )
}

export default SettingsPage
