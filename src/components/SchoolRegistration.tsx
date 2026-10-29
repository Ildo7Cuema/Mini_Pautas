/*
component-meta:
  name: SchoolRegistration
  description: Premium school registration form with multi-step capability and mobile-first design
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Card, CardBody } from './ui/Card'
import { Icons } from './ui/Icons'
import { translateError } from '../utils/translations'
import { notifyAdminNewRegistration, buildRegistrationMessage } from '../utils/registrationNotifications'
import { AdminWhatsAppAlert, AdminAlertState } from './AdminWhatsAppAlert'
import { generateUniqueSchoolCode } from '../utils/schoolCodeGenerator'

interface SchoolRegistrationForm {
    // Dados da Escola
    nome_escola: string
    codigo_escola: string
    provincia: string
    municipio: string
    endereco: string
    telefone: string
    email_escola: string

    // Dados do Responsável/Administrador
    nome_responsavel: string
    email_responsavel: string
    senha: string
    confirmar_senha: string
}

const PROVINCIAS_ANGOLA = [
    'Bengo', 'Benguela', 'Bié', 'Cabinda', 'Cuando Cubango',
    'Cuanza Norte', 'Cuanza Sul', 'Cunene', 'Huambo', 'Huíla',
    'Luanda', 'Lunda Norte', 'Lunda Sul', 'Malanje', 'Moxico',
    'Namibe', 'Uíge', 'Zaire'
]

const PROVINCE_CODES: Record<string, string> = {
    'Bengo': 'BGO',
    'Benguela': 'BGU',
    'Bié': 'BIE',
    'Cabinda': 'CAB',
    'Cuando Cubango': 'CCU',
    'Cuanza Norte': 'CNO',
    'Cuanza Sul': 'CSU',
    'Cunene': 'CNN',
    'Huambo': 'HUA',
    'Huíla': 'HUI',
    'Luanda': 'LUA',
    'Lunda Norte': 'LNO',
    'Lunda Sul': 'LSU',
    'Malanje': 'MAL',
    'Moxico': 'MOX',
    'Namibe': 'NAM',
    'Uíge': 'UIG',
    'Zaire': 'ZAI'
}

interface SchoolRegistrationProps {
    onSuccess?: () => void
    onCancel?: () => void
}

export const SchoolRegistration: React.FC<SchoolRegistrationProps> = ({ onSuccess, onCancel }) => {
    const [formData, setFormData] = useState<SchoolRegistrationForm>({
        nome_escola: '',
        codigo_escola: '',
        provincia: '',
        municipio: '',
        endereco: '',
        telefone: '',
        email_escola: '',
        nome_responsavel: '',
        email_responsavel: '',
        senha: '',
        confirmar_senha: ''
    })

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [step, setStep] = useState(1) // 1: Dados da Escola, 2: Dados do Responsável
    const [generatingCode, setGeneratingCode] = useState(false)
    const [countdown, setCountdown] = useState(10) // Contagem regressiva de 10 segundos
    const [adminAlert, setAdminAlert] = useState<AdminAlertState>('pending')
    const [adminMessage, setAdminMessage] = useState('')
    const [waOpened, setWaOpened] = useState(false)
    // O redirecionamento só começa depois de o utilizador usar o botão de WhatsApp
    const holdRedirect = !waOpened

    // Efeito para contagem regressiva e redirecionamento automático
    useEffect(() => {
        if (!success || holdRedirect) return

        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer)
                    handleGoToLogin()
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [success, holdRedirect])

    // Função para redirecionar para login
    const handleGoToLogin = () => {
        if (onSuccess) {
            onSuccess()
        } else {
            // Fallback: redirecionar para a página de login via navegação
            window.location.href = '/'
        }
    }

    const handleChange = async (field: keyof SchoolRegistrationForm, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        setError(null)

        // Auto-generate school code when province is selected
        if (field === 'provincia' && value) {
            await generateCode(value)
        }
    }

    const generateCode = async (provincia: string) => {
        if (!provincia) return

        setGeneratingCode(true)
        setError(null)

        try {
            const code = await generateUniqueSchoolCode(provincia)
            setFormData(prev => ({ ...prev, codigo_escola: code }))
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao gerar código'
            setError(errorMessage)
        } finally {
            setGeneratingCode(false)
        }
    }

    const handleRegenerateCode = async () => {
        if (!formData.provincia) {
            setError('Por favor, selecione uma província primeiro')
            return
        }
        await generateCode(formData.provincia)
    }

    const validateStep1 = (): boolean => {
        if (!formData.nome_escola.trim()) {
            setError('Nome da escola é obrigatório')
            return false
        }
        if (!formData.codigo_escola.trim()) {
            setError('Código da escola não foi gerado. Por favor, selecione uma província.')
            return false
        }
        if (!formData.provincia) {
            setError('Província é obrigatória')
            return false
        }
        if (!formData.municipio.trim()) {
            setError('Município é obrigatório')
            return false
        }
        return true
    }

    const validateStep2 = (): boolean => {
        if (!formData.nome_responsavel.trim()) {
            setError('Nome do responsável é obrigatório')
            return false
        }
        if (!formData.email_responsavel.trim()) {
            setError('Email do responsável é obrigatório')
            return false
        }
        if (!formData.email_responsavel.includes('@')) {
            setError('Email inválido')
            return false
        }
        if (formData.senha.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres')
            return false
        }
        if (formData.senha !== formData.confirmar_senha) {
            setError('As senhas não coincidem')
            return false
        }
        return true
    }

    const handleNextStep = () => {
        if (validateStep1()) {
            setStep(2)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validateStep2()) return

        setLoading(true)
        setError(null)

        try {
            // 1. Create user account
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email_responsavel,
                password: formData.senha,
                options: {
                    data: {
                        full_name: formData.nome_responsavel,
                        role: 'ESCOLA'
                    }
                }
            })

            if (authError) throw authError
            if (!authData.user) throw new Error('Erro ao criar conta de utilizador')

            // 2. Create escola record using RPC function (bypasses RLS)
            const { error: escolaError } = await supabase
                .rpc('register_escola', {
                    p_user_id: authData.user.id,
                    p_nome: formData.nome_escola,
                    p_codigo_escola: formData.codigo_escola,
                    p_provincia: formData.provincia,
                    p_municipio: formData.municipio,
                    p_endereco: formData.endereco || null,
                    p_telefone: formData.telefone || null,
                    p_email: formData.email_escola || formData.email_responsavel,
                    p_configuracoes: {}
                })

            if (escolaError) {
                // If escola creation fails, log the error
                console.error('Error creating escola:', escolaError)
                throw new Error(escolaError.message || 'Erro ao criar registro da escola. Por favor, contacte o suporte.')
            }

            // Alerta o administrador (WhatsApp) - não bloqueia o registo
            setAdminMessage(buildRegistrationMessage('ESCOLA', {
                nome: formData.nome_escola,
                codigo: formData.codigo_escola,
                provincia: formData.provincia,
                municipio: formData.municipio,
                responsavel: formData.nome_responsavel,
                telefone: formData.telefone,
                email: formData.email_escola || formData.email_responsavel,
            }))
            notifyAdminNewRegistration('ESCOLA', authData.user.id).then(r => setAdminAlert(r))

            // 3. Sign out the user so they can log in properly
            await supabase.auth.signOut()

            // 4. Show success message
            setSuccess(true)
            // A contagem regressiva é gerenciada pelo useEffect

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro'
            setError(translateError(errorMessage))
        } finally {
            setLoading(false)
        }
    }

    // Success screen
    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/80 to-indigo-100 flex items-center justify-center p-4">
                {/* Animated Background Blobs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="blob blob-1 w-[500px] h-[500px] -top-32 -right-32" />
                    <div className="blob blob-2 w-[400px] h-[400px] -bottom-24 -left-24" />
                </div>

                <div className="auth-card w-full max-w-md rounded-2xl animate-fade-in shadow-xl bg-white/95">
                    <CardBody className="p-8 text-center">
                        <div className="success-ring inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                            <svg className="success-checkmark w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">Cadastro Realizado!</h2>
                        <p className="text-slate-600 mb-6 leading-relaxed">
                            A escola <strong>{formData.nome_escola}</strong> foi registada com sucesso.
                            Verifique seu email para confirmar a conta.
                        </p>
                        <AdminWhatsAppAlert
                            status={adminAlert}
                            message={adminMessage}
                            onOpen={() => setWaOpened(true)}
                        />
                        {!holdRedirect && (
                            <div className="flex flex-col items-center gap-3">
                                <div className="flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full">
                                    <span className="text-xl font-bold text-primary-600">{countdown}</span>
                                </div>
                                <span className="text-sm text-slate-500 font-medium">
                                    Redirecionando para login em <strong className="text-primary-600">{countdown}</strong> segundos...
                                </span>
                            </div>
                        )}
                        {waOpened && (
                            <Button
                                variant="primary"
                                className="btn-premium mt-6"
                                onClick={handleGoToLogin}
                                fullWidth
                            >
                                Ir para Login agora
                            </Button>
                        )}
                    </CardBody>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/80 to-indigo-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
            {/* Animated Background Blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="blob blob-1 w-[600px] h-[600px] -top-40 -right-40 opacity-30" />
                <div className="blob blob-2 w-[500px] h-[500px] -bottom-32 -left-32 opacity-30" />
                <div className="blob blob-3 w-[400px] h-[400px] top-1/2 left-1/2 opacity-20" />
            </div>

            <div className="w-full max-w-2xl relative z-10">
                {/* Header */}
                <div className="text-center mb-8 animate-fade-in">
                    <div className="logo-container inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
                        <Icons.School className="w-8 h-8 text-primary-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800 mb-2 tracking-tight">Cadastro de Escola</h1>
                    <p className="text-slate-500 font-medium">Junte-se à plataforma EduGest Angola</p>
                </div>

                {/* Progress Stepper */}
                <div className="mb-8 max-w-sm mx-auto">
                    <div className="relative flex items-center justify-between">
                        {/* Connecting Line */}
                        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-slate-200 rounded-full -z-10"></div>
                        <div
                            className={`absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-primary-500 rounded-full transition-all duration-300 ease-out -z-10`}
                            style={{ width: step === 1 ? '0%' : '100%' }}
                        ></div>

                        {/* Step 1 */}
                        <button
                            onClick={() => setStep(1)}
                            className={`group flex flex-col items-center gap-2 relative ${step >= 1 ? 'text-primary-600' : 'text-slate-400'}`}
                        >
                            <div className={`
                                w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300
                                ${step >= 1
                                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30 scale-110'
                                    : 'bg-white border-2 border-slate-300 text-slate-500 hover:border-slate-400'}
                            `}>
                                1
                            </div>
                            <span className="absolute top-12 text-xs font-semibold whitespace-nowrap bg-white/80 px-2 rounded-full backdrop-blur-sm">
                                Escola
                            </span>
                        </button>

                        {/* Step 2 */}
                        <button
                            className={`group flex flex-col items-center gap-2 relative ${step >= 2 ? 'text-primary-600' : 'text-slate-400'}`}
                            disabled={step < 2}
                        >
                            <div className={`
                                w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300
                                ${step >= 2
                                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30 scale-110'
                                    : step === 1
                                        ? 'bg-white border-2 border-slate-300 text-slate-500' // Inactive but next
                                        : 'bg-white border-2 border-slate-300 text-slate-500'}
                            `}>
                                2
                            </div>
                            <span className="absolute top-12 text-xs font-semibold whitespace-nowrap bg-white/80 px-2 rounded-full backdrop-blur-sm">
                                Responsável
                            </span>
                        </button>
                    </div>
                </div>

                <div className="auth-card rounded-2xl animate-slide-up shadow-xl overflow-hidden">
                    <CardBody className="p-6 sm:p-8">
                        {/* Error Message */}
                        {error && (
                            <div className="flex items-start gap-3 p-4 mb-6 bg-red-50 border border-red-100 rounded-xl animate-slide-down form-error-shake" role="alert">
                                <div className="flex-shrink-0 w-5 h-5 mt-0.5 text-red-500">
                                    <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <p className="text-sm text-red-700 font-medium">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            {/* Step 1: Dados da Escola */}
                            {step === 1 && (
                                <div className="space-y-5 animate-slide-in-right">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-xl font-bold text-slate-900">Informações da Escola</h2>
                                        <span className="text-xs font-medium px-2 py-1 bg-primary-50 text-primary-700 rounded-lg border border-primary-100">Passo 1 de 2</span>
                                    </div>

                                    <div className="input-glow rounded-xl">
                                        <Input
                                            label="Nome da Escola"
                                            type="text"
                                            value={formData.nome_escola}
                                            onChange={(e) => handleChange('nome_escola', e.target.value)}
                                            placeholder="Ex: Escola Secundária do 1º Ciclo"
                                            required
                                            inputSize="md"
                                        />
                                    </div>

                                    <div className="input-glow rounded-xl">
                                        <label className="form-label mb-2 block text-sm font-medium text-slate-700">
                                            Código da Escola (Gerado Automaticamente) <span className="text-error ml-1">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={formData.codigo_escola}
                                                readOnly
                                                placeholder="Selecione uma província para gerar"
                                                className="w-full px-4 py-3 pr-12 border border-neutral-300 rounded-xl bg-slate-50 text-base font-mono text-slate-700 cursor-not-allowed focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={handleRegenerateCode}
                                                disabled={!formData.provincia || generatingCode}
                                                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                                title="Gerar novo código"
                                            >
                                                {generatingCode ? (
                                                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1.5">
                                            Formato: {formData.provincia ? PROVINCE_CODES[formData.provincia] || 'XXX' : 'XXX'}AAAA#### (Província + Ano + Aleatório)
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="input-glow rounded-xl group focus-within:ring-2 focus-within:ring-primary-500/10">
                                            <label className="form-label mb-2 block text-sm font-medium text-slate-700 cursor-pointer group-focus-within:text-primary-600 transition-colors">
                                                Província <span className="text-error ml-1">*</span>
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={formData.provincia}
                                                    onChange={(e) => handleChange('provincia', e.target.value)}
                                                    className="w-full px-4 py-3 border border-neutral-300 rounded-xl bg-white text-base focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 appearance-none disabled:bg-neutral-100 disabled:cursor-not-allowed"
                                                    required
                                                >
                                                    <option value="">Selecione a província</option>
                                                    {PROVINCIAS_ANGOLA.map(prov => (
                                                        <option key={prov} value={prov}>{prov}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-400">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="input-glow rounded-xl">
                                            <Input
                                                label="Município"
                                                type="text"
                                                value={formData.municipio}
                                                onChange={(e) => handleChange('municipio', e.target.value)}
                                                placeholder="Ex: Luanda"
                                                required
                                                inputSize="md"
                                            />
                                        </div>
                                    </div>

                                    <div className="input-glow rounded-xl">
                                        <Input
                                            label="Endereço"
                                            type="text"
                                            value={formData.endereco}
                                            onChange={(e) => handleChange('endereco', e.target.value)}
                                            placeholder="Rua, Bairro, Número"
                                            icon={<Icons.Home />}
                                            inputSize="md"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="input-glow rounded-xl">
                                            <Input
                                                label="Telefone"
                                                type="tel"
                                                value={formData.telefone}
                                                onChange={(e) => handleChange('telefone', e.target.value)}
                                                placeholder="923 000 000"
                                                icon={<Icons.Phone />}
                                                inputSize="md"
                                            />
                                        </div>

                                        <div className="input-glow rounded-xl">
                                            <Input
                                                label="Email Institucional"
                                                type="email"
                                                value={formData.email_escola}
                                                onChange={(e) => handleChange('email_escola', e.target.value)}
                                                placeholder="escola@exemplo.ao"
                                                icon={<Icons.Email />}
                                                inputSize="md"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-4">
                                        {onCancel && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="lg"
                                                onClick={onCancel}
                                                className="!text-slate-500 hover:!text-slate-700"
                                            >
                                                Cancelar
                                            </Button>
                                        )}
                                        <Button
                                            type="button"
                                            variant="primary"
                                            size="lg"
                                            onClick={handleNextStep}
                                            className={`${onCancel ? '' : 'col-span-2'} btn-premium`}
                                            icon={<Icons.UserPlus />}
                                            iconPosition="right"
                                        >
                                            Continuar
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Dados do Responsável */}
                            {step === 2 && (
                                <div className="space-y-5 animate-slide-in-right">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-xl font-bold text-slate-900">Dados do Responsável</h2>
                                        <span className="text-xs font-medium px-2 py-1 bg-primary-50 text-primary-700 rounded-lg border border-primary-100">Passo 2 de 2</span>
                                    </div>

                                    <div className="input-glow rounded-xl">
                                        <Input
                                            label="Nome Completo"
                                            type="text"
                                            value={formData.nome_responsavel}
                                            onChange={(e) => handleChange('nome_responsavel', e.target.value)}
                                            placeholder="Responsável legal da escola"
                                            required
                                            icon={<Icons.User />}
                                            inputSize="md"
                                        />
                                    </div>

                                    <div className="input-glow rounded-xl">
                                        <Input
                                            label="Email Profissional"
                                            type="email"
                                            value={formData.email_responsavel}
                                            onChange={(e) => handleChange('email_responsavel', e.target.value)}
                                            placeholder="seu.email@escola.ao"
                                            required
                                            helpText="Este email será usado para fazer login no sistema"
                                            icon={<Icons.Email />}
                                            inputSize="md"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="input-glow rounded-xl">
                                            <Input
                                                label="Senha"
                                                type="password"
                                                value={formData.senha}
                                                onChange={(e) => handleChange('senha', e.target.value)}
                                                placeholder="••••••••"
                                                required
                                                helpText="Mínimo de 6 caracteres"
                                                icon={<Icons.Lock />}
                                                inputSize="md"
                                            />
                                        </div>

                                        <div className="input-glow rounded-xl">
                                            <Input
                                                label="Confirmar Senha"
                                                type="password"
                                                value={formData.confirmar_senha}
                                                onChange={(e) => handleChange('confirmar_senha', e.target.value)}
                                                placeholder="••••••••"
                                                required
                                                icon={<Icons.Check />}
                                                inputSize="md"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-4">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="lg"
                                            onClick={() => setStep(1)}
                                            className="bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        >
                                            Voltar
                                        </Button>
                                        <Button
                                            type="submit"
                                            variant="primary"
                                            size="lg"
                                            loading={loading}
                                            className="btn-premium"
                                            icon={<Icons.Check />}
                                        >
                                            {loading ? 'Processando...' : 'Finalizar Cadastro'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </form>
                    </CardBody>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center">
                    <p className="text-slate-500 text-xs">
                        Ao criar uma conta, você concorda com os <a href="#" className="text-primary-600 hover:underline">Termos de Uso</a> e <a href="#" className="text-primary-600 hover:underline">Política de Privacidade</a>
                    </p>
                </div>
            </div>
        </div>
    )
}
