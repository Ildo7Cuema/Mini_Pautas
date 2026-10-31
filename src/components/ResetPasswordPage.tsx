/*
component-meta:
  name: ResetPasswordPage
  description: Premium password reset page with native-like mobile experience
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { CardBody } from './ui/Card'
import { Icons } from './ui/Icons'
import { translateError } from '../utils/translations'
import { AuthShell } from './auth/AuthShell'

export const ResetPasswordPage: React.FC = () => {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        // Check if we have a valid session from the reset link
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                setError('Link de recuperação inválido ou expirado. Por favor, solicite um novo link.')
            }
        })
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        // Validate passwords
        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres')
            setLoading(false)
            return
        }

        if (password !== confirmPassword) {
            setError('As senhas não coincidem')
            setLoading(false)
            return
        }

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password
            })

            if (updateError) throw updateError

            setSuccess(true)

            // Redirect to login after 3 seconds
            setTimeout(() => {
                window.location.href = '/'
            }, 3000)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro'
            setError(translateError(errorMessage))
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <AuthShell maxWidth="sm">
                <div className="auth-card rounded-xl animate-fade-in">
                    <CardBody className="p-6 text-center">
                        <div className="success-ring inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                            <svg className="success-checkmark w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">Senha Atualizada!</h2>
                        <p className="text-slate-600 mb-5 text-sm leading-relaxed">
                            Sua senha foi atualizada com sucesso. Você será redirecionado para a página de login em instantes.
                        </p>
                        <div className="flex flex-col items-center gap-3">
                            <div className="spinner-gradient w-8 h-8 rounded-full mask-linear"></div>
                            <span className="text-xs text-slate-400 font-medium animate-pulse">Redirecionando...</span>
                        </div>
                    </CardBody>
                </div>
            </AuthShell>
        )
    }

    return (
        <AuthShell maxWidth="sm">
            <div className="text-center mb-5 animate-fade-in">
                <div className="logo-container inline-flex items-center justify-center w-12 h-12 bg-white/95 rounded-xl shadow-md mb-3 ring-1 ring-slate-200/60">
                    <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-slate-800 mb-1 tracking-tight">EduGest Angola</h1>
                <p className="text-slate-500 text-sm font-medium">Redefinição de Segurança</p>
            </div>

            <div className="auth-card rounded-xl animate-slide-up">
                <CardBody className="p-5 sm:p-6">
                    <div className="mb-4">
                        <h2 className="text-lg font-bold text-slate-900 mb-0.5">
                            Criar Nova Senha
                        </h2>
                        <p className="text-slate-500 text-sm">
                            Escolha uma senha forte para proteger sua conta
                        </p>
                    </div>

                    {error && (
                        <div className="flex items-start gap-3 p-3 mb-4 bg-red-50 border border-red-100 rounded-lg animate-slide-down form-error-shake" role="alert">
                            <div className="flex-shrink-0 w-5 h-5 mt-0.5 text-red-500">
                                <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <p className="text-sm text-red-700 font-medium">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-3.5">
                        <div className="input-glow rounded-lg">
                            <Input
                                label="Nova Senha"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                autoComplete="new-password"
                                icon={<Icons.Lock />}
                                helpText="Mínimo de 6 caracteres"
                                inputSize="sm"
                            />
                        </div>

                        <div className="input-glow rounded-lg">
                            <Input
                                label="Confirmar Senha"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                autoComplete="new-password"
                                icon={<Icons.Check />}
                                inputSize="sm"
                            />
                        </div>

                        <Button
                            type="submit"
                            variant="primary"
                            size="md"
                            loading={loading}
                            fullWidth
                            className="btn-premium mt-1 font-semibold"
                            icon={<Icons.Check />}
                        >
                            {loading ? 'Atualizando...' : 'Definir Nova Senha'}
                        </Button>
                    </form>

                    <div className="mt-5 pt-4 border-t border-slate-200 text-center">
                        <a
                            href="/"
                            className="inline-flex items-center text-sm text-slate-500 hover:text-primary-600 font-medium transition-colors group"
                        >
                            <svg className="w-4 h-4 mr-1 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Voltar para o login
                        </a>
                    </div>
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
