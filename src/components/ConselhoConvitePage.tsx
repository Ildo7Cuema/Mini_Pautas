/*
component-meta:
  name: ConselhoConvitePage
  description: Aceitar convite do Conselho de Notas via token e redireccionar para a turma
*/

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { CONSELHO_INVITE_STORAGE_KEY } from '../utils/conselhoNotasData'
import { translateError } from '../utils/translations'

export const ConselhoConvitePage: React.FC = () => {
    const { user, loading: authLoading } = useAuth()
    const [status, setStatus] = useState<'idle' | 'working' | 'ok' | 'error'>('idle')
    const [message, setMessage] = useState('A validar o convite…')

    useEffect(() => {
        if (authLoading) return

        const params = new URLSearchParams(window.location.search)
        const token = params.get('token')
        if (!token) {
            setStatus('error')
            setMessage('Link de convite inválido (token em falta).')
            return
        }

        if (!user) {
            setStatus('error')
            setMessage(
                'Inicie sessão com a conta convidada e volte a abrir este link para aceitar o convite do Conselho de Notas.'
            )
            return
        }

        let cancelled = false
        ;(async () => {
            try {
                setStatus('working')
                setMessage('A aceitar o convite…')
                const { data, error } = await supabase.rpc('aceitar_conselho_convite', {
                    p_token: token,
                })
                if (error) throw error
                if (cancelled) return

                const result = data as { turma_id?: string; conselho_id?: string; papel?: string }
                sessionStorage.setItem(
                    CONSELHO_INVITE_STORAGE_KEY,
                    JSON.stringify({
                        turmaId: result.turma_id,
                        conselhoId: result.conselho_id,
                        papel: result.papel,
                    })
                )
                setStatus('ok')
                setMessage('Convite aceite. A redireccionar para o Conselho de Notas…')
                setTimeout(() => {
                    window.location.href = '/?open=reports&tab=conselho-notas'
                }, 900)
            } catch (err) {
                if (cancelled) return
                setStatus('error')
                setMessage(
                    translateError(err instanceof Error ? err.message : 'Não foi possível aceitar o convite')
                )
            }
        })()

        return () => {
            cancelled = true
        }
    }, [user, authLoading])

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 max-w-md w-full p-6 text-center space-y-3">
                <h1 className="text-lg font-semibold text-slate-900">Convite — Conselho de Notas</h1>
                <p
                    className={`text-sm ${
                        status === 'error' ? 'text-red-700' : status === 'ok' ? 'text-blue-700' : 'text-slate-600'
                    }`}
                >
                    {message}
                </p>
                {status === 'error' && !user && (
                    <a
                        href="/"
                        className="inline-flex mt-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium"
                    >
                        Ir para o início de sessão
                    </a>
                )}
                {status === 'error' && user && (
                    <a
                        href="/"
                        className="inline-flex mt-2 px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-medium"
                    >
                        Voltar à aplicação
                    </a>
                )}
            </div>
        </div>
    )
}
