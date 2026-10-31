/*
component-meta:
  name: SecretaryRegistration
  description: Premium secretary invite acceptance page
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

export const SecretaryRegistration: React.FC = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        // Get email from URL
        const params = new URLSearchParams(window.location.search)
        const emailParam = params.get('email')
        if (emailParam) {
            setEmail(emailParam)
        }
    }, [])

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
            // 1. Create the auth user
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
            })

            if (signUpError) throw signUpError

            // 2. If signup successful, use RPC function to register secretario
            // This function has SECURITY DEFINER and bypasses RLS
            if (signUpData.user) {
                const { data: rpcResult, error: rpcError } = await supabase.rpc(
                    'register_secretario_account',
                    {
                        p_email: email,
                        p_user_id: signUpData.user.id
                    }
                )

                if (rpcError) {
                    console.error('Erro ao registar secretário:', rpcError)
                } else if (rpcResult && !rpcResult.success) {
                    console.error('Erro RPC:', rpcResult.error)
                } else {
                    console.log('✅ Secretário registado com sucesso:', rpcResult)
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
                        <h2 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">Cadastro Realizado!</h2>
                        <p className="text-slate-600 mb-5 text-sm leading-relaxed">
                            Sua conta foi criada com sucesso. Verifique seu email para confirmar o cadastro ou faça login.
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
                        <Icons.UserPlus className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-1 tracking-tight">Bem-vindo Secretário</h1>
                    <p className="text-slate-500 text-sm font-medium">Finalize seu cadastro para acessar o EduGest</p>
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

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="input-glow rounded-xl">
                                <Input
                                    label="Email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="seu.email@exemplo.com"
                                    required
                                    disabled={true} // Email should be fixed from invite
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
                                {loading ? 'Criando Conta...' : 'Completar Cadastro'}
                            </Button>
                        </form>
                    </CardBody>
                </div>

                {/* Footer */}
                <div className="mt-5 text-center">
                    <p className="text-slate-500 text-xs">
                        © 2026 EduGest Angola
                    </p>
                </div>
        </AuthShell>
    )
}
