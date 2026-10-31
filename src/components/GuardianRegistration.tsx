/*
component-meta:
  name: GuardianRegistration
  description: Premium guardian/encarregado invite acceptance page
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
*/

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { CardBody } from './ui/Card'
import { Icons } from './ui/Icons'
import { translateError } from '../utils/translations'
import { AuthShell } from './auth/AuthShell'

export const GuardianRegistration: React.FC = () => {
    const [email, setEmail] = useState('')
    const [alunoId, setAlunoId] = useState<string | null>(null)
    const [studentName, setStudentName] = useState<string | null>(null)
    const [guardianName, setGuardianName] = useState<string | null>(null)
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [validating, setValidating] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        // Get params from URL
        const params = new URLSearchParams(window.location.search)
        const emailParam = params.get('email')
        const alunoIdParam = params.get('aluno_id')

        if (emailParam) setEmail(emailParam)
        if (alunoIdParam) setAlunoId(alunoIdParam)

        // Validate that aluno exists
        if (alunoIdParam) {
            validateAluno(alunoIdParam, emailParam || '')
        } else {
            setValidating(false)
            setError('Link de convite inválido. Por favor, solicite um novo convite.')
        }
    }, [])

    const validateAluno = async (id: string, expectedEmail: string) => {
        try {
            const { data, error } = await supabase
                .from('alunos')
                .select('id, nome_completo, nome_encarregado, email_encarregado, encarregado_user_id')
                .eq('id', id)
                .maybeSingle()

            if (error) throw error

            if (!data) {
                setError('Aluno não encontrado. O link pode estar expirado.')
                return
            }

            if (data.encarregado_user_id) {
                setError('Já existe uma conta de encarregado registada para este aluno. Faça login.')
                return
            }

            // Check email matches
            if (data.email_encarregado && expectedEmail &&
                data.email_encarregado.toLowerCase() !== expectedEmail.toLowerCase()) {
                setError('O email não corresponde ao registado. Contacte a escola.')
                return
            }

            setStudentName(data.nome_completo)
            setGuardianName(data.nome_encarregado)
        } catch (err) {
            console.error('Error validating aluno:', err)
            setError('Erro ao validar convite. Por favor, tente novamente.')
        } finally {
            setValidating(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        if (password !== confirmPassword) {
            setError('As senhas não coincidem')
            setLoading(false)
            return
        }

        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres')
            setLoading(false)
            return
        }

        try {
            // Try to create auth user
            const { data: authData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        tipo_perfil: 'ENCARREGADO',
                        nome: guardianName || 'Encarregado',
                    }
                }
            })

            // Handle case where user already exists
            if (signUpError) {
                // Check if it's a "user already exists" error
                if (signUpError.message.includes('already registered') ||
                    signUpError.message.includes('already exists') ||
                    signUpError.message.includes('User already registered')) {

                    // Try to sign in with the provided credentials
                    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                        email,
                        password
                    })

                    if (signInError) {
                        // If sign in fails, the password is wrong
                        setError('Este email já está registado. Por favor faça login com a senha existente ou use outro email.')
                        setLoading(false)
                        return
                    }

                    // User signed in successfully - link as encarregado
                    if (signInData.user && alunoId) {
                        const { data: rpcResult, error: rpcError } = await supabase
                            .rpc('link_existing_user_as_guardian', {
                                p_aluno_id: alunoId,
                                p_user_id: signInData.user.id
                            })

                        if (rpcError) {
                            console.error('Error linking existing user as guardian:', rpcError)
                        } else if (rpcResult && !rpcResult.success) {
                            console.error('RPC returned error:', rpcResult.error)
                        } else {
                            console.log('Successfully linked existing user as guardian:', rpcResult)
                        }
                    }

                    setSuccess(true)
                    return
                }

                throw signUpError
            }

            // New user created - use RPC function to link and create profile
            if (authData.user && alunoId) {
                const { data: rpcResult, error: rpcError } = await supabase
                    .rpc('register_guardian_account', {
                        p_aluno_id: alunoId,
                        p_user_id: authData.user.id,
                        p_email: email
                    })

                if (rpcError) {
                    console.error('Error in register_guardian_account RPC:', rpcError)
                } else if (rpcResult && !rpcResult.success) {
                    console.error('RPC returned error:', rpcResult.error)
                } else {
                    console.log('Successfully linked guardian account:', rpcResult)
                }
            }

            setSuccess(true)
        } catch (err: any) {
            const msg = err.message || 'Erro ao registrar'
            setError(translateError(msg))
        } finally {
            setLoading(false)
        }
    }

    if (validating) {
        return (
            <AuthShell maxWidth="sm">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600"></div>
                    <p className="mt-4 text-slate-600 text-sm">Validando convite...</p>
                </div>
            </AuthShell>
        )
    }

    if (success) {
        return (
            <AuthShell maxWidth="sm">
                <div className="auth-card w-full rounded-xl animate-fade-in">
                    <CardBody className="p-6 text-center">
                        <div className="success-ring inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                            <svg className="success-checkmark w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">Conta Criada!</h2>
                        <p className="text-slate-600 mb-5 text-sm leading-relaxed">
                            Sua conta de encarregado foi criada com sucesso. Agora pode fazer login para acompanhar as notas do seu educando.
                        </p>
                        <Button
                            variant="primary"
                            className="btn-premium"
                            onClick={() => window.location.href = '/'}
                            fullWidth
                        >
                            Ir para Login
                        </Button>
                    </CardBody>
                </div>
            </AuthShell>
        )
    }

    return (
        <AuthShell maxWidth="sm">
                <div className="text-center mb-5 animate-fade-in">
                    <div className="logo-container inline-flex items-center justify-center w-12 h-12 bg-white/95 rounded-xl shadow-md mb-3 ring-1 ring-slate-200/60">
                        <Icons.Users className="w-6 h-6 text-amber-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-1 tracking-tight">Bem-vindo Encarregado</h1>
                    {guardianName && (
                        <p className="text-amber-600 font-semibold text-base mb-1">{guardianName}</p>
                    )}
                    {studentName && (
                        <p className="text-slate-500 text-sm">Educando: {studentName}</p>
                    )}
                    <p className="text-slate-500 text-sm font-medium mt-1">Crie sua conta para acompanhar as notas</p>
                </div>

                <div className="auth-card rounded-xl animate-slide-up">
                    <CardBody className="p-5 sm:p-6">
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

                        {!error && (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="input-glow rounded-xl">
                                    <Input
                                        label="Email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="seu.email@exemplo.com"
                                        required
                                        disabled={true}
                                        icon={<Icons.Email />}
                                        className="bg-slate-50 text-slate-500"
                                        inputSize="md"
                                    />
                                </div>

                                <div className="input-glow rounded-xl">
                                    <Input
                                        label="Crie sua Senha"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
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
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        icon={<Icons.Check />}
                                        inputSize="md"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    variant="primary"
                                    loading={loading}
                                    fullWidth
                                    className="btn-premium mt-4"
                                    icon={<Icons.Login />}
                                >
                                    {loading ? 'Criando Conta...' : 'Criar Minha Conta'}
                                </Button>
                            </form>
                        )}

                        {error && (
                            <Button
                                variant="ghost"
                                onClick={() => window.location.href = '/'}
                                fullWidth
                                className="mt-4"
                            >
                                Voltar para Login
                            </Button>
                        )}
                    </CardBody>
                </div>

                <div className="mt-5 text-center">
                    <p className="text-slate-500 text-xs">
                        © 2026 EduGest Angola
                    </p>
                </div>
        </AuthShell>
    )
}
