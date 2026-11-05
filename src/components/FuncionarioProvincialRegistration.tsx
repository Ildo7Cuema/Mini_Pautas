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

    const describeRegisterError = (err: {
        message?: string
        code?: string
        details?: string
        hint?: string
    }) => {
        const message = err.message || ''
        const details = err.details || ''
        const code = err.code || ''
        const blob = `${code} ${message} ${details}`.toLowerCase()

        if (blob.includes('user_profiles_escola_check')) {
            return 'Não foi possível activar a conta: o perfil de funcionário provincial ainda não está permitido na base de dados (escola_id). Peça ao administrador para aplicar a migração 20261105_fix_user_profiles_escola_check_funcionario_dp.sql e tente novamente.'
        }
        if (blob.includes('user_profiles_tipo_perfil_check')) {
            return 'Não foi possível activar a conta: o tipo FUNCIONARIO_PROVINCIAL ainda não está permitido na base de dados. Peça ao administrador para aplicar a migração de pessoal provincial e tente novamente.'
        }
        if (blob.includes('funcionário provincial não encontrado')) {
            return 'Não existe convite activo para este email. Peça à Direção Provincial para criar o funcionário e gerar um novo link.'
        }
        if (blob.includes('já está associado ao perfil')) {
            return message
        }
        if (code === '23514' || blob.includes('check constraint')) {
            return 'A activação foi bloqueada por uma regra da base de dados. Contacte o suporte com o código 23514.'
        }
        if (code === '23505' || blob.includes('duplicate')) {
            return 'Este email ou conta já está ligado a outro registo. Use outro email ou faça login.'
        }
        if (code === '42501' || blob.includes('permission') || blob.includes('row-level security')) {
            return 'Sem permissão para activar esta conta. Confirme que o link de convite é válido.'
        }

        return translateError(message || 'Não foi possível activar a conta provincial.')
    }

    const linkProvincialAccount = async (userId: string) => {
        const { data: rpcResult, error: rpcError } = await supabase.rpc(
            'register_funcionario_provincial_account',
            {
                p_email: email,
                p_user_id: userId,
            },
        )
        if (rpcError) {
            console.error('Erro ao registar funcionário provincial:', rpcError)
            throw new Error(describeRegisterError(rpcError))
        }
        if (rpcResult && !rpcResult.success) {
            throw new Error(
                describeRegisterError({
                    message: rpcResult.error || 'Falha no registo',
                }),
            )
        }
    }

    const isAlreadyRegisteredError = (err: {
        message?: string
        code?: string
        status?: number
    }) => {
        const msg = (err.message || '').toLowerCase()
        const code = (err.code || '').toLowerCase()
        return (
            code === 'user_already_exists' ||
            code === 'email_exists' ||
            msg.includes('already registered') ||
            msg.includes('already been registered') ||
            msg.includes('user already exists') ||
            msg.includes('email address already')
        )
    }

    const activateWithExistingAuthUser = async () => {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (signInError || !signInData.user) {
            const signInMsg = (signInError?.message || '').toLowerCase()
            if (signInMsg.includes('email not confirmed')) {
                throw new Error(
                    'Este email já foi registado mas ainda não está confirmado. Verifique a caixa de entrada (e o spam) ou peça ao administrador para confirmar a conta.',
                )
            }
            throw new Error(
                'Este email já tem conta Auth. Use a palavra-passe correcta desta conta, ou reponha a senha no login.',
            )
        }

        const { data: existingProfile } = await supabase
            .from('user_profiles')
            .select('tipo_perfil')
            .eq('user_id', signInData.user.id)
            .maybeSingle()

        if (
            existingProfile?.tipo_perfil &&
            existingProfile.tipo_perfil !== 'FUNCIONARIO_PROVINCIAL'
        ) {
            await supabase.auth.signOut()
            throw new Error(
                `Este email já está associado ao perfil ${existingProfile.tipo_perfil}. Use outro email no convite.`,
            )
        }

        await linkProvincialAccount(signInData.user.id)
        await supabase.auth.signOut()
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
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        tipo_perfil: 'FUNCIONARIO_PROVINCIAL',
                    },
                },
            })

            if (signUpError) {
                console.error('Signup funcionário DP falhou:', {
                    message: signUpError.message,
                    status: signUpError.status,
                    code: (signUpError as { code?: string }).code,
                })

                if (isAlreadyRegisteredError(signUpError)) {
                    await activateWithExistingAuthUser()
                    setSuccess(true)
                    return
                }

                throw signUpError
            }

            const user = signUpData.user
            // Com confirmação de email activa, signup de email já existente pode
            // devolver um user ofuscado sem identities — tratar como já registado.
            if (user && Array.isArray(user.identities) && user.identities.length === 0) {
                await activateWithExistingAuthUser()
                setSuccess(true)
                return
            }

            if (user) {
                await linkProvincialAccount(user.id)
                if (signUpData.session) {
                    await supabase.auth.signOut()
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
