/*
component-meta:
  name: DirecaoMunicipalRegistration
  description: Formulário de registo auto-serviço para Direções Municipais com aprovação pendente
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
import { AuthShell } from './auth/AuthShell'

interface DirecaoMunicipalRegistrationForm {
    nome: string
    provincia: string
    municipio: string
    email: string
    telefone: string
    cargo: string
    senha: string
    confirmar_senha: string
}

const PROVINCIAS_ANGOLA = [
    'Bengo', 'Benguela', 'Bié', 'Cabinda', 'Cuando Cubango',
    'Cuanza Norte', 'Cuanza Sul', 'Cunene', 'Huambo', 'Huíla',
    'Luanda', 'Lunda Norte', 'Lunda Sul', 'Malanje', 'Moxico',
    'Namibe', 'Uíge', 'Zaire'
]

// Municípios por província (simplificado - principais)
const MUNICIPIOS_POR_PROVINCIA: Record<string, string[]> = {
    'Luanda': ['Belas', 'Cacuaco', 'Cazenga', 'Icolo e Bengo', 'Luanda', 'Kilamba Kiaxi', 'Quissama', 'Talatona', 'Viana'],
    'Benguela': ['Benguela', 'Balombo', 'Baía Farta', 'Bocoio', 'Caimbambo', 'Catumbela', 'Chongoroi', 'Cubal', 'Ganda', 'Lobito'],
    'Huambo': ['Huambo', 'Bailundo', 'Cachiungo', 'Caála', 'Chicala Choloanga', 'Chinjenje', 'Ecunha', 'Londuimbali', 'Longonjo', 'Mungo', 'Ucuma'],
    'Huíla': ['Lubango', 'Caconda', 'Cacula', 'Caluquembe', 'Chibia', 'Chicomba', 'Chipindo', 'Cuvango', 'Gambos', 'Humpata', 'Jamba', 'Matala', 'Quilengues', 'Quipungo'],
    // Adicionar mais conforme necessário - os utilizadores podem digitar manualmente
}

interface DirecaoMunicipalRegistrationProps {
    onSuccess?: () => void
    onCancel?: () => void
}

export function DirecaoMunicipalRegistration({ onSuccess, onCancel }: DirecaoMunicipalRegistrationProps) {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [countdown, setCountdown] = useState(10)
    const [adminAlert, setAdminAlert] = useState<AdminAlertState>('pending')
    const [adminMessage, setAdminMessage] = useState('')
    const [waOpened, setWaOpened] = useState(false)
    // O redirecionamento só começa depois de o utilizador usar o botão de WhatsApp
    const holdRedirect = !waOpened
    const [formData, setFormData] = useState<DirecaoMunicipalRegistrationForm>({
        nome: '',
        provincia: '',
        municipio: '',
        email: '',
        telefone: '',
        cargo: 'Director Municipal de Educação',
        senha: '',
        confirmar_senha: ''
    })

    // Countdown para redirecionar após sucesso
    useEffect(() => {
        if (holdRedirect) return
        if (success && countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
            return () => clearTimeout(timer)
        } else if (success && countdown === 0) {
            handleGoToLogin()
        }
    }, [success, countdown, holdRedirect])

    const handleGoToLogin = () => {
        if (onSuccess) {
            onSuccess()
        } else {
            window.location.href = '/'
        }
    }

    const handleChange = (field: keyof DirecaoMunicipalRegistrationForm, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        setError(null)
    }

    const municipiosDisponiveis = formData.provincia
        ? (MUNICIPIOS_POR_PROVINCIA[formData.provincia] || [])
        : []

    const validateStep1 = (): boolean => {
        if (!formData.nome.trim()) {
            setError('Por favor, informe o nome completo')
            return false
        }
        if (!formData.provincia) {
            setError('Por favor, seleccione a província')
            return false
        }
        if (!formData.municipio.trim()) {
            setError('Por favor, informe o município')
            return false
        }
        return true
    }

    const validateStep2 = (): boolean => {
        if (!formData.email.trim()) {
            setError('Por favor, informe o email')
            return false
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            setError('Por favor, informe um email válido')
            return false
        }
        if (!formData.senha) {
            setError('Por favor, informe a senha')
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
        if (step === 1 && validateStep1()) {
            setStep(2)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validateStep2()) return

        setLoading(true)
        setError(null)

        try {
            // 1. Criar conta de utilizador
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.senha,
                options: {
                    data: {
                        full_name: formData.nome,
                        role: 'DIRECAO_MUNICIPAL'
                    }
                }
            })

            if (authError) throw authError
            if (!authData.user) throw new Error('Erro ao criar conta de utilizador')

            // 2. Criar registo de Direção Municipal via RPC
            const { error: rpcError } = await supabase
                .rpc('register_direcao_municipal', {
                    p_user_id: authData.user.id,
                    p_nome: formData.nome,
                    p_provincia: formData.provincia,
                    p_municipio: formData.municipio,
                    p_email: formData.email,
                    p_telefone: formData.telefone || null,
                    p_cargo: formData.cargo
                })

            if (rpcError) {
                console.error('Error creating direção municipal:', rpcError)
                throw new Error(rpcError.message || 'Erro ao criar registo. Por favor, contacte o suporte.')
            }

            // Alerta o administrador (WhatsApp + perfil) - não bloqueia o registo
            setAdminMessage(buildRegistrationMessage('DIRECAO_MUNICIPAL', {
                nome: formData.nome,
                provincia: formData.provincia,
                municipio: formData.municipio,
                cargo: formData.cargo,
                telefone: formData.telefone,
                email: formData.email,
            }))
            notifyAdminNewRegistration('DIRECAO_MUNICIPAL', authData.user.id).then(r => setAdminAlert(r))

            // 3. Fazer logout (conta pendente de aprovação)
            await supabase.auth.signOut()

            // 4. Mostrar sucesso
            setSuccess(true)

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro'
            setError(translateError(errorMessage))
        } finally {
            setLoading(false)
        }
    }

    // Tela de sucesso
    if (success) {
        return (
            <AuthShell maxWidth="sm">
                <Card className="w-full auth-card rounded-xl">
                    <CardBody className="p-6 text-center">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">⏳</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-2">
                            Registo Submetido!
                        </h2>
                        <p className="text-slate-600 mb-4">
                            O seu pedido de registo foi submetido com sucesso.
                        </p>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                            <p className="text-amber-800 text-sm">
                                <strong>⚠️ Aprovação Pendente</strong><br />
                                O seu acesso será activado após aprovação pelo administrador do sistema.
                                Receberá uma notificação quando o seu registo for aprovado.
                            </p>
                        </div>
                        <AdminWhatsAppAlert
                            status={adminAlert}
                            message={adminMessage}
                            onOpen={() => setWaOpened(true)}
                        />
                        {!holdRedirect && (
                            <p className="text-slate-500 text-sm mb-4">
                                Redirecionando em <span className="font-bold text-primary-600">{countdown}</span> segundos...
                            </p>
                        )}
                        {waOpened && (
                            <Button
                                onClick={handleGoToLogin}
                                variant="primary"
                                fullWidth
                            >
                                Voltar ao Login
                            </Button>
                        )}
                    </CardBody>
                </Card>
            </AuthShell>
        )
    }

    return (
        <AuthShell maxWidth="sm">
                {/* Header */}
                <div className="text-center mb-5 animate-fade-in">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-white/95 rounded-xl shadow-md mb-3 ring-1 ring-slate-200/60">
                        <span className="text-2xl">🏛️</span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1">
                        Registo de Direção Municipal
                    </h1>
                    <p className="text-slate-500 text-sm">
                        Sistema de Gestão Escolar - EduGest Angola
                    </p>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-4 mb-6">
                    <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary-600' : 'text-slate-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-primary-600 text-white' : 'bg-slate-200'}`}>
                            1
                        </div>
                        <span className="hidden sm:inline text-sm font-medium">Dados</span>
                    </div>
                    <div className={`w-12 h-0.5 ${step >= 2 ? 'bg-primary-600' : 'bg-slate-200'}`} />
                    <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary-600' : 'text-slate-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-primary-600 text-white' : 'bg-slate-200'}`}>
                            2
                        </div>
                        <span className="hidden sm:inline text-sm font-medium">Acesso</span>
                    </div>
                </div>

                {/* Form Card */}
                <Card className="auth-card rounded-xl animate-slide-up">
                    <CardBody className="p-5 sm:p-6">
                        {error && (
                            <div className="flex items-start gap-3 p-4 mb-5 bg-red-50 border border-red-100 rounded-xl" role="alert">
                                <div className="flex-shrink-0 w-5 h-5 mt-0.5 text-red-500">
                                    <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <p className="text-sm text-red-700 font-medium">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            {/* Step 1: Dados Básicos */}
                            {step === 1 && (
                                <div className="space-y-4">
                                    <h2 className="text-lg font-bold text-slate-900 mb-4">
                                        Dados da Direção Municipal
                                    </h2>

                                    <Input
                                        label="Nome Completo do Responsável"
                                        type="text"
                                        value={formData.nome}
                                        onChange={(e) => handleChange('nome', e.target.value)}
                                        placeholder="Ex: João Manuel da Silva"
                                        required
                                        icon={<Icons.User />}
                                    />

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Província
                                        </label>
                                        <select
                                            value={formData.provincia}
                                            onChange={(e) => {
                                                handleChange('provincia', e.target.value)
                                                handleChange('municipio', '') // Reset município
                                            }}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                            required
                                        >
                                            <option value="">Seleccione a província</option>
                                            {PROVINCIAS_ANGOLA.map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Município
                                        </label>
                                        {municipiosDisponiveis.length > 0 ? (
                                            <select
                                                value={formData.municipio}
                                                onChange={(e) => handleChange('municipio', e.target.value)}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                                required
                                            >
                                                <option value="">Seleccione o município</option>
                                                {municipiosDisponiveis.map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <Input
                                                type="text"
                                                value={formData.municipio}
                                                onChange={(e) => handleChange('municipio', e.target.value)}
                                                placeholder="Digite o nome do município"
                                                required
                                            />
                                        )}
                                    </div>

                                    <Input
                                        label="Cargo"
                                        type="text"
                                        value={formData.cargo}
                                        onChange={(e) => handleChange('cargo', e.target.value)}
                                        placeholder="Ex: Director Municipal de Educação"
                                    />

                                    <Input
                                        label="Telefone (opcional)"
                                        type="tel"
                                        value={formData.telefone}
                                        onChange={(e) => handleChange('telefone', e.target.value)}
                                        placeholder="Ex: 923 456 789"
                                        icon={<Icons.Phone />}
                                    />

                                    <div className="flex gap-3 pt-4">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={onCancel || (() => window.location.href = '/')}
                                            fullWidth
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="primary"
                                            onClick={handleNextStep}
                                            fullWidth
                                        >
                                            Continuar
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Credenciais de Acesso */}
                            {step === 2 && (
                                <div className="space-y-4">
                                    <h2 className="text-lg font-bold text-slate-900 mb-4">
                                        Credenciais de Acesso
                                    </h2>

                                    <Input
                                        label="Email"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => handleChange('email', e.target.value)}
                                        placeholder="seu.email@exemplo.com"
                                        required
                                        icon={<Icons.Email />}
                                    />

                                    <Input
                                        label="Senha"
                                        type="password"
                                        value={formData.senha}
                                        onChange={(e) => handleChange('senha', e.target.value)}
                                        placeholder="Mínimo 6 caracteres"
                                        required
                                        icon={<Icons.Lock />}
                                    />

                                    <Input
                                        label="Confirmar Senha"
                                        type="password"
                                        value={formData.confirmar_senha}
                                        onChange={(e) => handleChange('confirmar_senha', e.target.value)}
                                        placeholder="Repita a senha"
                                        required
                                        icon={<Icons.Lock />}
                                    />

                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
                                        <p className="text-blue-800 text-sm">
                                            <strong>ℹ️ Nota:</strong> Após o registo, o seu acesso ficará pendente de aprovação pelo administrador do sistema.
                                        </p>
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => setStep(1)}
                                            fullWidth
                                        >
                                            Voltar
                                        </Button>
                                        <Button
                                            type="submit"
                                            variant="primary"
                                            loading={loading}
                                            fullWidth
                                            className="btn-premium"
                                        >
                                            {loading ? 'A registar...' : 'Concluir Registo'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </form>
                    </CardBody>
                </Card>

                {/* Footer */}
                <div className="mt-5 text-center">
                    <p className="text-slate-500 text-sm">
                        Já tem conta?{' '}
                        <a
                            href="/"
                            onClick={(e) => {
                                if (onCancel) {
                                    e.preventDefault()
                                    onCancel()
                                }
                            }}
                            className="text-primary-600 hover:text-primary-700 font-semibold"
                        >
                            Faça login
                        </a>
                    </p>
                </div>
        </AuthShell>
    )
}
