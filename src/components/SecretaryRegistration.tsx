/*
component-meta:
  name: SecretaryRegistration
  description: Premium staff invite acceptance page (Director / Técnico de Secretaria)
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
import {
    getStaffAreaLabel,
    getStaffAreaModules,
    getStaffCargoLabel,
    resolveStaffCargoFromInvite,
    type StaffLoginCargo,
} from '../utils/staffAccess'

export const SecretaryRegistration: React.FC = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [resolvingCargo, setResolvingCargo] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [cargo, setCargo] = useState<StaffLoginCargo>('TECNICO_SECRETARIA')

    const perfilLabel = getStaffCargoLabel(cargo)
    const areaLabel = getStaffAreaLabel(cargo)
    const areaModules = getStaffAreaModules(cargo)

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const emailParam = params.get('email')
        const cargoParam = params.get('cargo')

        // Prefer cargo from invite link (reliable without authenticated RLS)
        const fromUrl = resolveStaffCargoFromInvite(cargoParam)
        if (cargoParam) {
            setCargo(fromUrl)
        }

        if (!emailParam) {
            setResolvingCargo(false)
            return
        }

        setEmail(emailParam)

        ;(async () => {
            try {
                // If URL already carries a director cargo, keep it; still try DB to refine
                const { data: func } = await supabase
                    .from('funcionarios_escola')
                    .select('subcategoria, cargo')
                    .ilike('email', emailParam)
                    .maybeSingle()

                let resolved = resolveStaffCargoFromInvite(
                    cargoParam,
                    func?.subcategoria,
                    func?.cargo,
                )

                if (
                    !cargoParam &&
                    (!func?.subcategoria ||
                        !['DIRECTOR_PEDAGOGICO', 'DIRECTOR_ADMINISTRATIVO', 'TECNICO_SECRETARIA', 'SECRETARIO'].includes(
                            String(func.subcategoria).toUpperCase(),
                        ))
                ) {
                    const { data: sec } = await supabase
                        .from('secretarios')
                        .select('cargo')
                        .ilike('email', emailParam)
                        .maybeSingle()
                    resolved = resolveStaffCargoFromInvite(cargoParam, null, sec?.cargo)
                }

                // Public RPC fallback for anonymous invite (migration optional)
                if (!cargoParam && resolved === 'TECNICO_SECRETARIA') {
                    const { data: rpcCargo } = await supabase.rpc('lookup_staff_invite_cargo', {
                        p_email: emailParam,
                    })
                    if (typeof rpcCargo === 'string' && rpcCargo) {
                        resolved = resolveStaffCargoFromInvite(rpcCargo)
                    }
                }

                setCargo(resolved)
            } catch (err) {
                console.warn('Não foi possível resolver o perfil do convite; a usar o parâmetro da URL.', err)
                if (cargoParam) setCargo(fromUrl)
            } finally {
                setResolvingCargo(false)
            }
        })()
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
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
            })

            if (signUpError) throw signUpError

            if (signUpData.user) {
                const { data: rpcResult, error: rpcError } = await supabase.rpc(
                    'register_secretario_account',
                    {
                        p_email: email,
                        p_user_id: signUpData.user.id,
                    },
                )

                if (rpcError) {
                    console.error('Erro ao registar secretário:', rpcError)
                } else if (rpcResult && !rpcResult.success) {
                    console.error('Erro RPC:', rpcResult.error)
                } else {
                    console.log('✅ Conta de staff registada com sucesso:', rpcResult)
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
                            Conta de <strong>{perfilLabel}</strong> criada. Após o login acede à{' '}
                            <strong>{areaLabel}</strong> ({areaModules.join(', ')}).
                        </p>
                        <Button
                            variant="primary"
                            className="btn-premium"
                            onClick={() => { window.location.href = '/' }}
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
                    <h1 className="text-2xl font-bold text-slate-800 mb-1 tracking-tight">
                        {resolvingCargo ? 'A preparar o convite…' : `Bem-vindo, ${perfilLabel}`}
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">
                        {resolvingCargo
                            ? 'A identificar o perfil de acesso'
                            : <>Finalize o cadastro para aceder à <span className="font-semibold text-slate-700">{areaLabel}</span></>}
                    </p>
                </div>

                <div className="auth-card rounded-xl animate-slide-up">
                    <CardBody className="p-5 sm:p-6">
                        {!resolvingCargo && (
                            <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-3">
                                <p className="text-xs font-semibold text-emerald-800 mb-1.5">
                                    Módulos da {areaLabel}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {areaModules.map((mod) => (
                                        <span
                                            key={mod}
                                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white text-emerald-700 ring-1 ring-emerald-100"
                                        >
                                            {mod}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
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
                                loading={loading || resolvingCargo}
                                disabled={resolvingCargo || !email}
                                fullWidth
                                className="btn-premium mt-4"
                                icon={<Icons.Login />}
                            >
                                {loading ? 'Criando Conta...' : 'Completar Cadastro'}
                            </Button>
                        </form>
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
