/*
component-meta:
  name: LoginScreen
  description: Premium login screen with modern UI, mobile-first design, and native-like experience
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
  tested-on: [360x800, 375x812, 768x1024, 1440x900]
*/

import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Card, CardBody } from './ui/Card'
import { Icons } from './ui/Icons'
import { translateError } from '../utils/translations'
import { SchoolRegistration } from './SchoolRegistration'
import { BlockedSchoolMessage } from './BlockedSchoolMessage'
import { logSystemVisit } from '../utils/superadmin'
import { sendSuggestionToSuperAdmin } from '../utils/notificationApi'
import { AuthBackdrop } from './auth/AuthShell'

type AuthMode = 'login' | 'signup' | 'school-registration' | 'direcao-municipal' | 'direcao-provincial'

// Páginas de registo institucional carregadas sob demanda (transição suave, sem recarregar a página)
const loadDirecaoMunicipal = () => import('./DirecaoMunicipalRegistration')
const loadDirecaoProvincial = () => import('./DirecaoProvincialRegistration')
const DirecaoMunicipalRegistration = lazy(() =>
    loadDirecaoMunicipal().then((m) => ({ default: m.DirecaoMunicipalRegistration }))
)
const DirecaoProvincialRegistration = lazy(() =>
    loadDirecaoProvincial().then((m) => ({ default: m.DirecaoProvincialRegistration }))
)

const MODE_PATHS: Partial<Record<AuthMode, string>> = {
    login: '/',
    'direcao-municipal': '/register-direcao-municipal',
    'direcao-provincial': '/register-direcao-provincial',
}

const PAGE_LEAVE_MS = 180

function AuthPageFallback() {
    return (
        <div className="auth-card rounded-xl p-6 space-y-4" aria-busy="true" aria-live="polite">
            <div className="h-5 w-40 rounded-md bg-slate-200/80 animate-pulse" />
            <div className="h-11 w-full rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-11 w-full rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-11 w-full rounded-xl bg-slate-200/80 animate-pulse" />
        </div>
    )
}

interface AuthOptionCardProps {
    title: string
    subtitle: string
    tone: 'primary' | 'emerald' | 'sky'
    icon: React.ReactNode
    onClick: () => void
    onPrefetch?: () => void
}

const OPTION_TONES: Record<AuthOptionCardProps['tone'], { icon: string; hover: string; title: string }> = {
    primary: {
        icon: 'from-primary-500 to-blue-600',
        hover: 'hover:border-primary-300 hover:bg-primary-50/60 focus-visible:ring-primary-400',
        title: 'group-hover:text-primary-700',
    },
    emerald: {
        icon: 'from-emerald-400 to-teal-500',
        hover: 'hover:border-emerald-300 hover:bg-emerald-50/60 focus-visible:ring-emerald-400',
        title: 'group-hover:text-emerald-700',
    },
    sky: {
        icon: 'from-sky-500 to-blue-600',
        hover: 'hover:border-sky-300 hover:bg-sky-50/60 focus-visible:ring-sky-400',
        title: 'group-hover:text-sky-700',
    },
}

/** Cartão de acesso rápido — todos com exactamente o mesmo tamanho. */
function AuthOptionCard({ title, subtitle, tone, icon, onClick, onPrefetch }: AuthOptionCardProps) {
    const t = OPTION_TONES[tone]
    return (
        <button
            type="button"
            onClick={onClick}
            onMouseEnter={onPrefetch}
            onFocus={onPrefetch}
            onTouchStart={onPrefetch}
            className={`auth-option group flex h-[104px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/80 px-2 text-center outline-none transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 ${t.hover}`}
        >
            <span
                className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${t.icon} text-white shadow-sm transition-transform duration-300 group-hover:scale-110`}
            >
                {icon}
            </span>
            <span className="min-w-0">
                <span className={`block text-xs font-semibold leading-tight text-slate-800 transition-colors ${t.title}`}>
                    {title}
                </span>
                <span className="mt-0.5 block text-[10px] leading-tight text-slate-400">{subtitle}</span>
            </span>
        </button>
    )
}

export const LoginScreen: React.FC = () => {
    const [mode, setModeState] = useState<AuthMode>('login')
    const [leaving, setLeaving] = useState(false)
    const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    /** Troca de página com saída suave (fade) e entrada animada; actualiza o URL sem recarregar. */
    const goTo = useCallback((next: AuthMode) => {
        if (leaveTimer.current) clearTimeout(leaveTimer.current)
        setLeaving(true)
        leaveTimer.current = setTimeout(() => {
            setModeState(next)
            setLeaving(false)
            const path = MODE_PATHS[next]
            if (path && window.location.pathname !== path) {
                window.history.pushState({ authMode: next }, '', path)
            }
            window.scrollTo({ top: 0 })
        }, PAGE_LEAVE_MS)
    }, [])

    // Botão "voltar" do browser dentro das páginas de registo
    useEffect(() => {
        const onPop = () => {
            const p = window.location.pathname
            setModeState(
                p === '/register-direcao-municipal' ? 'direcao-municipal' : p === '/register-direcao-provincial' ? 'direcao-provincial' : 'login'
            )
        }
        window.addEventListener('popstate', onPop)
        return () => {
            window.removeEventListener('popstate', onPop)
            if (leaveTimer.current) clearTimeout(leaveTimer.current)
        }
    }, [])

    const setMode = goTo
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false)
    const [resetEmail, setResetEmail] = useState('')
    const [resetLoading, setResetLoading] = useState(false)
    const [resetSuccess, setResetSuccess] = useState(false)
    // School status modal state
    const [showSchoolStatusModal, setShowSchoolStatusModal] = useState(false)
    const [schoolStatusType, setSchoolStatusType] = useState<'blocked' | 'inactive' | 'deleted'>('deleted')
    const [schoolStatusReason, setSchoolStatusReason] = useState<string | undefined>(undefined)
    const [schoolInfo, setSchoolInfo] = useState<{ nome?: string; codigo?: string }>({})
    const [entityType, setEntityType] = useState<'escola' | 'direcao_municipal'>('escola')
    // Suggestion modal state
    const [showSuggestionModal, setShowSuggestionModal] = useState(false)
    const [suggestionName, setSuggestionName] = useState('')
    const [suggestionEmail, setSuggestionEmail] = useState('')
    const [suggestionMessage, setSuggestionMessage] = useState('')
    const [suggestionLoading, setSuggestionLoading] = useState(false)
    const [suggestionSuccess, setSuggestionSuccess] = useState(false)
    const [suggestionError, setSuggestionError] = useState<string | null>(null)


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (signInError) throw signInError

            // After successful authentication, check user profile and escola status
            if (signInData.user) {
                const userId = signInData.user.id

                // Check user_profiles table
                const { data: profileData } = await supabase
                    .from('user_profiles')
                    .select('*, escolas(*)')
                    .eq('user_id', userId)
                    .eq('ativo', true)
                    .maybeSingle()

                // If no profile found, check if user is SUPERADMIN (which doesn't need escola)
                if (!profileData) {
                    // Check for SUPERADMIN profile
                    const { data: superadminProfile } = await supabase
                        .from('user_profiles')
                        .select('*')
                        .eq('user_id', userId)
                        .eq('tipo_perfil', 'SUPERADMIN')
                        .maybeSingle()

                    if (superadminProfile) {
                        // SUPERADMIN can proceed - log visit
                        logSystemVisit(undefined, 'SUPERADMIN')
                        return
                    }

                    // Check for DIRECAO_MUNICIPAL profile (may be pending)
                    const { data: direcaoProfile } = await supabase
                        .from('user_profiles')
                        .select('*')
                        .eq('user_id', userId)
                        .eq('tipo_perfil', 'DIRECAO_MUNICIPAL')
                        .maybeSingle()

                    if (direcaoProfile) {
                        if (!direcaoProfile.ativo) {
                            // Pending approval
                            await supabase.auth.signOut()
                            setSchoolStatusType('inactive')
                            setSchoolStatusReason('O seu registo como Direção Municipal está pendente de aprovação. Será notificado quando o acesso for activado.')
                            setEntityType('direcao_municipal')
                            setShowSchoolStatusModal(true)
                            return
                        }
                        // Active DIRECAO_MUNICIPAL - let AuthContext handle
                        logSystemVisit(undefined, 'DIRECAO_MUNICIPAL')
                        return
                    }

                    // Check for DIRECAO_PROVINCIAL profile (may be pending)
                    const { data: direcaoProvincialProfile } = await supabase
                        .from('user_profiles')
                        .select('*')
                        .eq('user_id', userId)
                        .eq('tipo_perfil', 'DIRECAO_PROVINCIAL')
                        .maybeSingle()

                    if (direcaoProvincialProfile) {
                        if (!direcaoProvincialProfile.ativo) {
                            // Pending approval
                            await supabase.auth.signOut()
                            setSchoolStatusType('inactive')
                            setSchoolStatusReason('O seu registo como Direção Provincial está pendente de aprovação. Será notificado quando o acesso for activado.')
                            setEntityType('direcao_municipal') // Reuse existing modal style
                            setShowSchoolStatusModal(true)
                            return
                        }
                        // Active DIRECAO_PROVINCIAL - let AuthContext handle
                        logSystemVisit(undefined, 'DIRECAO_PROVINCIAL')
                        return
                    }

                    // Check if this might be a professor/aluno/encarregado direct record
                    const { data: professorData } = await supabase
                        .from('professores')
                        .select('escola_id, escolas(*)')
                        .eq('user_id', userId)
                        .eq('ativo', true)
                        .maybeSingle()

                    if (professorData) {
                        const escola = professorData.escolas as any
                        if (!escola) {
                            // Escola was deleted
                            await supabase.auth.signOut()
                            setSchoolStatusType('deleted')
                            setSchoolStatusReason('A escola associada à sua conta foi eliminada do sistema. Os seus dados de acesso já não são válidos.')
                            setShowSchoolStatusModal(true)
                            return
                        }
                        if (escola.bloqueado) {
                            await supabase.auth.signOut()
                            setSchoolStatusType('blocked')
                            setSchoolStatusReason(escola.bloqueado_motivo || undefined)
                            setSchoolInfo({ nome: escola.nome, codigo: escola.codigo_escola })
                            setShowSchoolStatusModal(true)
                            return
                        }
                        if (!escola.ativo) {
                            await supabase.auth.signOut()
                            setSchoolStatusType('inactive')
                            setSchoolInfo({ nome: escola.nome, codigo: escola.codigo_escola })
                            setShowSchoolStatusModal(true)
                            return
                        }
                        // Professor with valid escola - let AuthContext handle
                        logSystemVisit(professorData.escola_id, 'PROFESSOR')
                        return
                    }

                    // Check for aluno
                    const { data: alunoData } = await supabase
                        .from('alunos')
                        .select('turma_id, turmas(escola_id, escolas(*))')
                        .eq('user_id', userId)
                        .eq('ativo', true)
                        .maybeSingle()

                    if (alunoData) {
                        const turma = alunoData.turmas as any
                        const escola = turma?.escolas as any
                        if (!escola) {
                            await supabase.auth.signOut()
                            setSchoolStatusType('deleted')
                            setSchoolStatusReason('A escola associada à sua conta de aluno foi eliminada do sistema.')
                            setShowSchoolStatusModal(true)
                            return
                        }
                        if (escola.bloqueado) {
                            await supabase.auth.signOut()
                            setSchoolStatusType('blocked')
                            setSchoolStatusReason(escola.bloqueado_motivo || undefined)
                            setSchoolInfo({ nome: escola.nome, codigo: escola.codigo_escola })
                            setShowSchoolStatusModal(true)
                            return
                        }
                        if (!escola.ativo) {
                            await supabase.auth.signOut()
                            setSchoolStatusType('inactive')
                            setSchoolInfo({ nome: escola.nome, codigo: escola.codigo_escola })
                            setShowSchoolStatusModal(true)
                            return
                        }
                        // Aluno with valid escola - let AuthContext handle
                        logSystemVisit(escola.id, 'ALUNO')
                        return
                    }
                    // Check for direcao_municipal directly in direcoes_municipais table
                    const { data: direcaoMunicipalData } = await supabase
                        .from('direcoes_municipais')
                        .select('*')
                        .eq('user_id', userId)
                        .maybeSingle()

                    if (direcaoMunicipalData) {
                        if (!direcaoMunicipalData.ativo) {
                            // Pending approval
                            await supabase.auth.signOut()
                            setSchoolStatusType('inactive')
                            setSchoolStatusReason('O seu registo como Direção Municipal está pendente de aprovação. Será notificado quando o acesso for activado.')
                            setEntityType('direcao_municipal')
                            setShowSchoolStatusModal(true)
                            return
                        }
                        // Active DIRECAO_MUNICIPAL - let AuthContext handle
                        logSystemVisit(undefined, 'DIRECAO_MUNICIPAL')
                        return
                    }

                    // Check for direcao_provincial directly in direcoes_provinciais table
                    const { data: direcaoProvincialData } = await supabase
                        .from('direcoes_provinciais')
                        .select('*')
                        .eq('user_id', userId)
                        .maybeSingle()

                    if (direcaoProvincialData) {
                        if (!direcaoProvincialData.ativo) {
                            // Pending approval
                            await supabase.auth.signOut()
                            setSchoolStatusType('inactive')
                            setSchoolStatusReason('O seu registo como Direção Provincial está pendente de aprovação. Será notificado quando o acesso for activado.')
                            setEntityType('direcao_municipal') // Reuse existing modal style
                            setShowSchoolStatusModal(true)
                            return
                        }
                        // Active DIRECAO_PROVINCIAL - let AuthContext handle
                        logSystemVisit(undefined, 'DIRECAO_PROVINCIAL')
                        return
                    }

                    // No profile at all - escola was probably deleted
                    await supabase.auth.signOut()
                    setSchoolStatusType('deleted')
                    setSchoolStatusReason('A sua conta de utilizador não está associada a nenhuma instituição activa no sistema. A escola pode ter sido eliminada. Contacte o suporte para mais informações.')
                    setShowSchoolStatusModal(true)
                    return
                }

                // User has profile - check escola status
                const escola = profileData.escolas as any

                // DIRECAO_MUNICIPAL doesn't need escola
                if (profileData.tipo_perfil === 'DIRECAO_MUNICIPAL') {
                    if (!profileData.ativo) {
                        await supabase.auth.signOut()
                        setSchoolStatusType('inactive')
                        setSchoolStatusReason('O seu registo como Direção Municipal está pendente de aprovação.')
                        setEntityType('direcao_municipal')
                        setShowSchoolStatusModal(true)
                        return
                    }
                    // Active - let AuthContext handle
                    logSystemVisit(undefined, 'DIRECAO_MUNICIPAL')
                    return
                }

                // DIRECAO_PROVINCIAL doesn't need escola
                if (profileData.tipo_perfil === 'DIRECAO_PROVINCIAL') {
                    if (!profileData.ativo) {
                        await supabase.auth.signOut()
                        setSchoolStatusType('inactive')
                        setSchoolStatusReason('O seu registo como Direção Provincial está pendente de aprovação.')
                        setEntityType('direcao_municipal') // Reuse existing modal style
                        setShowSchoolStatusModal(true)
                        return
                    }
                    // Active - let AuthContext handle
                    logSystemVisit(undefined, 'DIRECAO_PROVINCIAL')
                    return
                }

                if (profileData.tipo_perfil !== 'SUPERADMIN' && !escola) {
                    // Escola was deleted
                    await supabase.auth.signOut()
                    setSchoolStatusType('deleted')
                    setSchoolStatusReason('A escola associada à sua conta foi eliminada do sistema. Os seus dados de acesso já não são válidos.')
                    setShowSchoolStatusModal(true)
                    return
                }

                // Check if escola is blocked or inactive
                if (escola) {
                    if (escola.bloqueado) {
                        await supabase.auth.signOut()
                        setSchoolStatusType('blocked')
                        setSchoolStatusReason(escola.bloqueado_motivo || undefined)
                        setSchoolInfo({ nome: escola.nome, codigo: escola.codigo_escola })
                        setShowSchoolStatusModal(true)
                        return
                    }
                    if (!escola.ativo) {
                        await supabase.auth.signOut()
                        setSchoolStatusType('inactive')
                        setSchoolInfo({ nome: escola.nome, codigo: escola.codigo_escola })
                        setShowSchoolStatusModal(true)
                        return
                    }
                }

                // All good - let AuthContext handle the rest of the login flow
                // Log the visit with escola and profile type
                const escolaId = escola?.id || profileData.escola_id
                logSystemVisit(escolaId, profileData.tipo_perfil)
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro'
            setError(translateError(errorMessage))
        } finally {
            setLoading(false)
        }
    }

    const handleSuggestionSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSuggestionLoading(true)
        setSuggestionError(null)

        try {
            const { success, error } = await sendSuggestionToSuperAdmin(
                suggestionName,
                suggestionEmail,
                suggestionMessage
            )

            if (!success) {
                throw new Error(error || 'Ocorreu um erro ao enviar a sugestão.')
            }

            setSuggestionSuccess(true)
            setTimeout(() => {
                setShowSuggestionModal(false)
                setSuggestionSuccess(false)
                setSuggestionName('')
                setSuggestionEmail('')
                setSuggestionMessage('')
            }, 3000)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro'
            setSuggestionError(errorMessage)
        } finally {
            setSuggestionLoading(false)
        }
    }

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setResetLoading(true)
        setError(null)

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: `${window.location.origin}/reset-password`,
            })

            if (resetError) throw resetError

            setResetSuccess(true)
            setTimeout(() => {
                setShowForgotPasswordModal(false)
                setResetSuccess(false)
                setResetEmail('')
            }, 3000)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro'
            setError(translateError(errorMessage))
        } finally {
            setResetLoading(false)
        }
    }

    // Páginas de registo: mesmo fundo (globo) + transição suave
    if (mode === 'school-registration' || mode === 'direcao-municipal' || mode === 'direcao-provincial') {
        const back = () => setMode('login')
        return (
            <AuthBackdrop>
                <div key={mode} className={leaving ? 'auth-page-leave' : 'auth-page-enter'}>
                    {mode === 'school-registration' && <SchoolRegistration onSuccess={back} onCancel={back} />}
                    <Suspense fallback={<AuthPageFallback />}>
                        {mode === 'direcao-municipal' && <DirecaoMunicipalRegistration onSuccess={back} onCancel={back} />}
                        {mode === 'direcao-provincial' && <DirecaoProvincialRegistration onSuccess={back} onCancel={back} />}
                    </Suspense>
                </div>
            </AuthBackdrop>
        )
    }

    return (
        <AuthBackdrop>
            <div key={mode} className={leaving ? 'auth-page-leave' : 'auth-page-enter'}>
                {/* Logo and Title */}
                <div className="text-center mb-4 animate-fade-in">
                    <div className="logo-container inline-flex items-center justify-center w-12 h-12 bg-white/95 rounded-xl shadow-md mb-2 ring-1 ring-slate-200/60">
                        <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-0.5 tracking-tight">
                        EduGest Angola
                    </h1>
                    <p className="text-slate-500 text-xs sm:text-sm font-medium">
                        Sistema de Gestão Escolar
                    </p>
                </div>

                {/* Auth Card */}
                <div className="auth-card rounded-xl animate-slide-up">
                    <CardBody className="p-5 sm:p-6">
                        {/* Welcome Text */}
                        <div className="mb-4">
                            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-0.5">
                                Bem-vindo de volta!
                            </h2>
                            <p className="text-slate-500 text-xs sm:text-sm">
                                Entre com as suas credenciais para continuar
                            </p>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div
                                className="flex items-start gap-2.5 p-3 mb-4 bg-red-50 border border-red-100 rounded-lg animate-slide-down form-error-shake"
                                role="alert"
                            >
                                <div className="flex-shrink-0 w-5 h-5 mt-0.5 text-red-500">
                                    <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <p className="text-sm text-red-700 font-medium">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-3">
                            {/* Email */}
                            <div className="input-glow rounded-lg">
                                <Input
                                    label="Email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="seu.email@exemplo.com"
                                    required
                                    autoComplete="email"
                                    icon={<Icons.Email />}
                                    inputSize="sm"
                                />
                            </div>

                            {/* Password */}
                            <div className="input-glow rounded-lg">
                                <Input
                                    label="Senha"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                    icon={<Icons.Lock />}
                                    inputSize="sm"
                                />
                            </div>

                            {/* Forgot Password Link */}
                            <div className="flex justify-end -mt-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowForgotPasswordModal(true)
                                        setError(null)
                                        setResetSuccess(false)
                                    }}
                                    className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors hover:underline underline-offset-2"
                                >
                                    Esqueceu a senha?
                                </button>
                            </div>

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                variant="primary"
                                size="md"
                                loading={loading}
                                fullWidth
                                className="btn-premium mt-1 font-semibold"
                                icon={<Icons.Login />}
                            >
                                {loading ? 'Processando...' : 'Entrar'}
                            </Button>
                        </form>

                        {/* Divider */}
                        <div className="auth-divider my-4">
                            <span>Novo por aqui?</span>
                        </div>

                        {/* Registration Options — três cartões idênticos */}
                        <div className="grid grid-cols-3 gap-2.5">
                            <AuthOptionCard
                                title="Cadastrar Escola"
                                subtitle="Estabelecimento"
                                tone="primary"
                                onClick={() => setMode('school-registration')}
                                icon={
                                    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                }
                            />
                            <AuthOptionCard
                                title="Dir. Municipal"
                                subtitle="Órgão municipal"
                                tone="emerald"
                                onClick={() => setMode('direcao-municipal')}
                                onPrefetch={() => void loadDirecaoMunicipal()}
                                icon={
                                    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                                    </svg>
                                }
                            />
                            <AuthOptionCard
                                title="Dir. Provincial"
                                subtitle="Órgão provincial"
                                tone="sky"
                                onClick={() => setMode('direcao-provincial')}
                                onPrefetch={() => void loadDirecaoProvincial()}
                                icon={
                                    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                }
                            />
                        </div>
                    </CardBody>
                </div>

                {/* Footer */}
                <div className="mt-3 text-center space-y-2">
                    {/* Action Links */}
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {/* Tutorials Link */}
                        <a
                            href="/tutoriais"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/70 hover:bg-white rounded-lg text-xs font-medium text-primary-600 hover:text-primary-700 shadow-sm hover:shadow transition-all"
                        >
                            <span aria-hidden="true">📹</span>
                            Ver Tutoriais
                        </a>

                        {/* Suggestions Button */}
                        <button
                            type="button"
                            onClick={() => {
                                setShowSuggestionModal(true)
                                setSuggestionError(null)
                                setSuggestionSuccess(false)
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/70 hover:bg-white rounded-lg text-xs font-medium text-amber-600 hover:text-amber-700 shadow-sm hover:shadow transition-all"
                        >
                            <span aria-hidden="true">💡</span>
                            Enviar Sugestão
                        </button>
                    </div>

                    <p className="text-slate-500 text-xs">
                        © 2026 EduGest Angola · Sistema de Gestão Escolar
                    </p>
                </div>

            {/* Forgot Password Modal */}
            {showForgotPasswordModal && (
                <div className="modal-mobile-fullscreen">
                    <div className="modal-overlay" onClick={() => {
                        setShowForgotPasswordModal(false)
                        setError(null)
                        setResetEmail('')
                    }}>
                        <div
                            className="modal-content"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Card className="rounded-2xl shadow-2xl">
                                <CardBody className="p-6 sm:p-8">
                                    {resetSuccess ? (
                                        <div className="text-center py-4">
                                            <div className="success-ring inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-5">
                                                <svg className="success-checkmark w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3">
                                                Email Enviado!
                                            </h3>
                                            <p className="text-slate-600 text-sm sm:text-base mb-2">
                                                Enviamos um link de recuperação para
                                            </p>
                                            <p className="text-primary-600 font-semibold mb-4">
                                                {resetEmail}
                                            </p>
                                            <p className="text-slate-400 text-sm">
                                                Verifique sua caixa de entrada e spam.
                                            </p>
                                            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
                                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                                Fechando automaticamente...
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Modal Header */}
                                            <div className="flex items-center justify-between mb-6">
                                                <div>
                                                    <h3 className="text-xl font-bold text-slate-900">
                                                        Recuperar Senha
                                                    </h3>
                                                    <p className="text-slate-500 text-sm mt-1">
                                                        Enviaremos um link para redefinir sua senha
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setShowForgotPasswordModal(false)
                                                        setError(null)
                                                        setResetEmail('')
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all touch-feedback"
                                                    aria-label="Fechar"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>

                                            {/* Error in Modal */}
                                            {error && (
                                                <div
                                                    className="flex items-start gap-3 p-4 mb-5 bg-red-50 border border-red-100 rounded-xl animate-slide-down"
                                                    role="alert"
                                                >
                                                    <div className="flex-shrink-0 w-5 h-5 mt-0.5 text-red-500">
                                                        <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                    <p className="text-sm text-red-700 font-medium">{error}</p>
                                                </div>
                                            )}

                                            <form onSubmit={handleForgotPassword} className="space-y-5">
                                                <div className="input-glow rounded-xl">
                                                    <Input
                                                        label="Email"
                                                        type="email"
                                                        value={resetEmail}
                                                        onChange={(e) => setResetEmail(e.target.value)}
                                                        placeholder="seu.email@exemplo.com"
                                                        required
                                                        autoComplete="email"
                                                        icon={<Icons.Email />}
                                                        inputSize="md"
                                                    />
                                                </div>

                                                <div className="flex gap-3 pt-2">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="lg"
                                                        onClick={() => {
                                                            setShowForgotPasswordModal(false)
                                                            setError(null)
                                                            setResetEmail('')
                                                        }}
                                                        fullWidth
                                                        className="!py-3"
                                                    >
                                                        Cancelar
                                                    </Button>
                                                    <Button
                                                        type="submit"
                                                        variant="primary"
                                                        size="lg"
                                                        loading={resetLoading}
                                                        fullWidth
                                                        className="btn-premium !py-3"
                                                        icon={<Icons.Send />}
                                                    >
                                                        {resetLoading ? 'Enviando...' : 'Enviar Link'}
                                                    </Button>
                                                </div>
                                            </form>
                                        </>
                                    )}
                                </CardBody>
                            </Card>
                        </div>
                    </div>
                </div>
            )}

            {/* Suggestion Modal */}
            {showSuggestionModal && (
                <div className="modal-mobile-fullscreen">
                    <div className="modal-overlay" onClick={() => {
                        setShowSuggestionModal(false)
                        setSuggestionError(null)
                        setSuggestionName('')
                        setSuggestionEmail('')
                        setSuggestionMessage('')
                    }}>
                        <div
                            className="modal-content"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Card className="rounded-2xl shadow-2xl">
                                <CardBody className="p-6 sm:p-8">
                                    {suggestionSuccess ? (
                                        <div className="text-center py-4">
                                            <div className="success-ring inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-5">
                                                <svg className="success-checkmark w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3">
                                                Sugestão Enviada!
                                            </h3>
                                            <p className="text-slate-600 text-sm sm:text-base mb-2">
                                                A sua sugestão foi enviada com sucesso.
                                            </p>
                                            <p className="text-slate-400 text-sm">
                                                Obrigado pela sua contribuição!
                                            </p>
                                            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
                                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                                Fechando automaticamente...
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Modal Header */}
                                            <div className="flex items-center justify-between mb-6">
                                                <div>
                                                    <h3 className="text-xl font-bold text-slate-900">
                                                        💡 Enviar Sugestão
                                                    </h3>
                                                    <p className="text-slate-500 text-sm mt-1">
                                                        Partilhe as suas ideias para melhorar o sistema
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setShowSuggestionModal(false)
                                                        setSuggestionError(null)
                                                        setSuggestionName('')
                                                        setSuggestionEmail('')
                                                        setSuggestionMessage('')
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all touch-feedback"
                                                    aria-label="Fechar"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>

                                            {/* Error in Modal */}
                                            {suggestionError && (
                                                <div
                                                    className="flex items-start gap-3 p-4 mb-5 bg-red-50 border border-red-100 rounded-xl animate-slide-down"
                                                    role="alert"
                                                >
                                                    <div className="flex-shrink-0 w-5 h-5 mt-0.5 text-red-500">
                                                        <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                    <p className="text-sm text-red-700 font-medium">{suggestionError}</p>
                                                </div>
                                            )}

                                            <form onSubmit={handleSuggestionSubmit} className="space-y-5">
                                                <div className="input-glow rounded-xl">
                                                    <Input
                                                        label="Nome"
                                                        type="text"
                                                        value={suggestionName}
                                                        onChange={(e) => setSuggestionName(e.target.value)}
                                                        placeholder="O seu nome"
                                                        required
                                                        icon={<Icons.User />}
                                                        inputSize="md"
                                                    />
                                                </div>

                                                <div className="input-glow rounded-xl">
                                                    <Input
                                                        label="Email de Contacto"
                                                        type="email"
                                                        value={suggestionEmail}
                                                        onChange={(e) => setSuggestionEmail(e.target.value)}
                                                        placeholder="seu.email@exemplo.com"
                                                        required
                                                        icon={<Icons.Email />}
                                                        inputSize="md"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                                        Sugestão
                                                    </label>
                                                    <textarea
                                                        value={suggestionMessage}
                                                        onChange={(e) => setSuggestionMessage(e.target.value)}
                                                        placeholder="Descreva a sua sugestão, ideia ou feedback..."
                                                        required
                                                        rows={4}
                                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                                                    />
                                                </div>

                                                <div className="flex gap-3 pt-2">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="lg"
                                                        onClick={() => {
                                                            setShowSuggestionModal(false)
                                                            setSuggestionError(null)
                                                            setSuggestionName('')
                                                            setSuggestionEmail('')
                                                            setSuggestionMessage('')
                                                        }}
                                                        fullWidth
                                                        className="!py-3"
                                                    >
                                                        Cancelar
                                                    </Button>
                                                    <Button
                                                        type="submit"
                                                        variant="primary"
                                                        size="lg"
                                                        loading={suggestionLoading}
                                                        fullWidth
                                                        className="btn-premium !py-3"
                                                        icon={<Icons.Send />}
                                                    >
                                                        {suggestionLoading ? 'Enviando...' : 'Enviar Sugestão'}
                                                    </Button>
                                                </div>
                                            </form>
                                        </>
                                    )}
                                </CardBody>
                            </Card>
                        </div>
                    </div>
                </div>
            )}

            {/* School Status Modal (Deleted/Blocked/Inactive) */}
            {showSchoolStatusModal && (
                <BlockedSchoolMessage
                    type={schoolStatusType}
                    reason={schoolStatusReason}
                    escolaNome={schoolInfo.nome}
                    escolaCodigo={schoolInfo.codigo}
                    entityType={entityType}
                    onClose={() => {
                        setShowSchoolStatusModal(false)
                        setSchoolStatusReason(undefined)
                        setSchoolInfo({})
                        setEntityType('escola')
                    }}
                />
            )}
            </div>
        </AuthBackdrop>
    )
}
