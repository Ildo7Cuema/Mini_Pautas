/*
component-meta:
  name: AuthShell
  description: Shared layout for login/registration. AuthBackdrop keeps the rotating Angola globe (top-left) mounted across page changes; AuthShell standardises card width and the page enter animation.
  responsive: true
*/

import { ReactNode, createContext, useContext } from 'react'
import { AngolaGlobe } from './AngolaGlobe'
import { AuthCarousel } from './AuthCarousel'
import { AuthLegalBasis } from './AuthLegalBasis'
import { PublicBrandMark } from './PublicBrandMark'

type AuthWidth = 'sm' | 'md' | 'lg'

interface AuthShellProps {
    children: ReactNode
    /** Mantido por compatibilidade: todas as páginas de autenticação usam a mesma largura. */
    maxWidth?: AuthWidth
    className?: string
    contentClassName?: string
}

/** Largura única para todos os cartões de autenticação (login, registos, reset). */
export const AUTH_CARD_WIDTH = 'max-w-[28rem]'

function BackdropLayers() {
    return (
        <div className="auth-map-layer pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-sky-50/70 to-blue-100/80" />

            <div
                className="absolute inset-0 opacity-[0.025]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230f172a' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
            />

            <div className="blob blob-1 w-[420px] h-[420px] -top-28 -right-28 opacity-15" />
            <div className="blob blob-2 w-[360px] h-[360px] -bottom-24 -left-20 opacity-10" />

            {/* Globo + carrossel sempre em background (também em telemóvel) */}
            <AngolaGlobe />
            <AuthCarousel />
        </div>
    )
}

const BackdropContext = createContext(false)

interface AuthBackdropProps {
    children: ReactNode
    className?: string
}

/**
 * Fundo persistente (globo + gradiente) e coluna central/direita com largura única.
 * Ao envolver várias páginas de autenticação, o globo mantém-se montado e a
 * mudança de página fica suave (sem "piscar" do fundo).
 */
export function AuthBackdrop({ children, className = '' }: AuthBackdropProps) {
    return (
        <BackdropContext.Provider value={true}>
            <div
                className={`auth-shell min-h-screen flex items-center justify-center p-4 sm:p-5 relative overflow-x-hidden ${className}`}
                // dvh: altura real em browsers móveis (barra de endereço dinâmica); ignorado onde não suportado
                style={{ minHeight: '100dvh' }}
            >
                <BackdropLayers />
                <PublicBrandMark />
                <div className={`w-full ${AUTH_CARD_WIDTH} relative z-10 py-2 sm:py-3`}>
                    {children}
                    <AuthLegalBasis />
                </div>
            </div>
        </BackdropContext.Provider>
    )
}

export const AuthShell: React.FC<AuthShellProps> = ({ children, className = '', contentClassName = '' }) => {
    const insideBackdrop = useContext(BackdropContext)

    if (insideBackdrop) {
        return <div className={`${className} ${contentClassName}`.trim()}>{children}</div>
    }

    return (
        <AuthBackdrop className={className}>
            <div className={`auth-page-enter ${contentClassName}`.trim()}>{children}</div>
        </AuthBackdrop>
    )
}

export default AuthShell
