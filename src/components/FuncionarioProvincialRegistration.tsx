import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { CardBody } from './ui/Card'
import { translateError } from '../utils/translations'
import { AuthShell } from './auth/AuthShell'
import {
    getDepartamentoProvincialLabel,
    normalizeDepartamentoProvincial,
    provincialStaffAllowedPages,
    type DepartamentoProvincial,
} from '../utils/provincialStaffAccess'

export const FuncionarioProvincialRegistration: React.FC = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [resolving, setResolving] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [departamento, setDepartamento] = useState<DepartamentoProvincial | null>(null)

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const emailParam = params.get('email')
        const depParam = params.get('departamento')
        const fromUrl = normalizeDepartamentoProvincial(depParam)
        if (fromUrl) setDepartamento(fromUrl)

        if (!emailParam) {
            setResolving(false)
            return
        }
        setEmail(emailParam)

        ;(async () => {
            try {
                if (!fromUrl) {
                    const { data } = await supabase.rpc('lookup_funcionario_dp_invite_departamento', {
                        p_email: emailParam,
                    })
                    const resolved = normalizeDepartamentoProvincial(
                        typeof data === 'string' ? data : null,
                    )
                    if (resolved) setDepartamento(resolved)
                }
            } catch (err) {
                console.warn('Não foi possível resolver o departamento do convite.', err)
            } finally {
                setResolving(false)
            }
        })()
    }, [])

    const depLabel = getDepartamentoProvincialLabel(departamento)
    const modulesHint = departamento
        ? provincialStaffAllowedPages(departamento)
              .filter((p) => p !== 'dashboard')
              .slice(0, 5)
              .join(', ')
        : ''

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
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
            })
            if (signUpError) throw signUpError

            if (signUpData.user) {
                const { data: rpcResult, error: rpcError } = await supabase.rpc(
                    'register_funcionario_provincial_account',
                    {
                        p_email: email,
                        p_user_id: signUpData.user.id,
                    },
                )
                if (rpcError) {
                    console.error('Erro ao registar funcionário provincial:', rpcError)
                    throw new Error(rpcError.message)
                }
                if (rpcResult && !rpcResult.success) {
                    throw new Error(rpcResult.error || 'Falha no registo')
                }
            }

            setSuccess(true)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Erro ao registrar'
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
                            <svg
                                className="success-checkmark w-8 h-8 text-green-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">
                            Cadastro realizado!
                        </h2>
                        <p className="text-slate-600 mb-5 text-sm leading-relaxed">
                            Conta de funcionário provincial criada
                            {departamento ? (
                                <>
                                    {' '}
                                    para <strong>{depLabel}</strong>
                                </>
                            ) : null}
                            . Após o login acede aos módulos do seu departamento.
                        </p>
                        <Button
                            variant="primary"
                            className="btn-premium"
                            onClick={() => {
                                window.location.href = '/'
                            }}
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
            <div className="auth-card w-full rounded-xl animate-fade-in">
                <CardBody className="p-6">
                    <h1 className="text-xl font-bold text-slate-900 mb-1">
                        Activar conta provincial
                    </h1>
                    <p className="text-sm text-slate-600 mb-5">
                        {resolving
                            ? 'A carregar dados do convite…'
                            : departamento
                              ? `Departamento: ${depLabel}${modulesHint ? ` · ${modulesHint}` : ''}`
                              : 'Defina a palavra-passe para activar o acesso.'}
                    </p>

                    {error && (
                        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-3.5">
                        <Input
                            label="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled
                        />
                        <Input
                            label="Palavra-passe"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <Input
                            label="Confirmar palavra-passe"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                        <Button
                            type="submit"
                            variant="primary"
                            fullWidth
                            disabled={loading || resolving || !email}
                            className="btn-premium"
                        >
                            {loading ? 'A criar conta…' : 'Activar conta'}
                        </Button>
                    </form>
                </CardBody>
            </div>
        </AuthShell>
    )
}

export default FuncionarioProvincialRegistration
