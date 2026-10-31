/*
component-meta:
  name: AuthShell
  description: Shared layout for login/registration. AuthBackdrop keeps the rotating Angola globe (top-left) mounted across page changes; AuthShell standardises card width and the page enter animation.
  responsive: true
*/

import { ReactNode, createContext, useContext } from 'react'
import angolaProvincesSvg from '../../assets/angola-provinces.svg?raw'
import { AuthCarousel } from './AuthCarousel'

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

const MERIDIANS = [0, 1, 2, 3, 4, 5, 6, 7]
const PARALLELS = [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75]

/** Globo com graticula animada (meridianos a "rodar") e o mapa de Angola fixo à frente. */
function AngolaGlobe() {
    return (
        <div className="angola-globe" aria-hidden="true">
            <div className="angola-globe__shadow" />
            <div className="angola-globe__sphere">
                <svg className="angola-globe__graticule" viewBox="-100 -100 200 200" preserveAspectRatio="xMidYMid meet">
                    {PARALLELS.map((p) => {
                        const y = p * 100
                        const half = Math.sqrt(Math.max(0, 100 * 100 - y * y))
                        return <line key={p} x1={-half} y1={y} x2={half} y2={y} />
                    })}
                    {MERIDIANS.map((i) => (
                        <circle
                            key={i}
                            className="angola-globe__meridian"
                            cx="0"
                            cy="0"
                            r="99"
                            style={{ animationDelay: `${(-i * 44) / MERIDIANS.length}s` }}
                        />
                    ))}
                    <circle cx="0" cy="0" r="99" className="angola-globe__rim" />
                </svg>

                <div className="angola-globe__map">
                    <div className="angola-map-svg" dangerouslySetInnerHTML={{ __html: angolaProvincesSvg }} />
                </div>

                <div className="angola-globe__shade" />
                <div className="angola-globe__gloss" />
            </div>
        </div>
    )
}

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

            <AngolaGlobe />

            {/* Carrossel à direita (≥ 1280px): professores, alunos e encarregados */}
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
            >
                <BackdropLayers />
                <div className={`w-full ${AUTH_CARD_WIDTH} relative z-10 py-2 sm:py-3`}>{children}</div>
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
