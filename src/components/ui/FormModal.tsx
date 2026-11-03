/*
component-meta:
  name: FormModal
  description: Compact, centered modal shell for registration and edit forms
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import React, { useEffect } from 'react'
import { Icons } from './Icons'

export type FormModalSize = 'sm' | 'md' | 'lg' | 'xl'
export type FormModalAccent = 'indigo' | 'blue' | 'emerald' | 'slate' | 'amber' | 'violet'

export interface FormModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    subtitle?: string
    icon?: React.ReactNode
    children: React.ReactNode
    size?: FormModalSize
    accent?: FormModalAccent
    closeOnBackdrop?: boolean
    /** Prevent close while submitting */
    busy?: boolean
    className?: string
}

/* Use auth-* / arbitrary widths — theme max-w-md/lg are oversized (720/1024). */
const sizeClasses: Record<FormModalSize, string> = {
    sm: 'max-w-auth',     // 26rem ≈ 416px
    md: 'max-w-auth-md',  // 32rem ≈ 512px
    lg: 'max-w-auth-lg',  // 36rem ≈ 576px
    xl: 'max-w-[42rem]',  // ≈ 672px
}

const accentClasses: Record<FormModalAccent, string> = {
    indigo: 'from-indigo-500 to-indigo-600 shadow-indigo-500/20',
    blue: 'from-blue-500 to-blue-600 shadow-blue-500/20',
    emerald: 'from-emerald-500 to-teal-600 shadow-emerald-500/20',
    slate: 'from-slate-600 to-slate-700 shadow-slate-500/20',
    amber: 'from-amber-500 to-orange-600 shadow-amber-500/20',
    violet: 'from-violet-500 to-violet-600 shadow-violet-500/20',
}

export const FormModal: React.FC<FormModalProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    icon,
    children,
    size = 'md',
    accent = 'indigo',
    closeOnBackdrop = true,
    busy = false,
    className = '',
}) => {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !busy) {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
            document.body.style.overflow = 'hidden'
        }

        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.body.style.overflow = ''
        }
    }, [isOpen, onClose, busy])

    if (!isOpen) return null

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget && closeOnBackdrop && !busy) {
            onClose()
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="form-modal-title"
            onClick={handleBackdropClick}
        >
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" aria-hidden="true" />

            <div
                className={`
                    form-modal-panel
                    relative w-full ${sizeClasses[size]}
                    flex flex-col
                    max-h-[min(88vh,42rem)]
                    my-auto
                    bg-white rounded-xl
                    shadow-2xl shadow-slate-900/20
                    border border-slate-200
                    overflow-hidden
                    animate-modal-in
                    ${className}
                `}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex-shrink-0 px-5 pt-4 pb-3.5 border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-white">
                    <div className="flex items-start gap-3">
                        {icon && (
                            <div
                                className={`
                                    w-10 h-10 flex-shrink-0 rounded-lg
                                    bg-gradient-to-br ${accentClasses[accent]}
                                    flex items-center justify-center shadow-md
                                `}
                            >
                                <span className="text-white [&_svg]:w-5 [&_svg]:h-5">{icon}</span>
                            </div>
                        )}
                        <div className="min-w-0 flex-1 pt-0.5">
                            <h3
                                id="form-modal-title"
                                className="text-base font-semibold text-slate-900 leading-snug tracking-tight"
                            >
                                {title}
                            </h3>
                            {subtitle && (
                                <p className="mt-0.5 text-sm text-slate-500 leading-snug">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={busy}
                            aria-label="Fechar"
                            className="
                                w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg
                                text-slate-400 hover:text-slate-600 hover:bg-slate-100
                                transition-colors touch-feedback disabled:opacity-50
                            "
                        >
                            <Icons.X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                    {children}
                </div>
            </div>
        </div>
    )
}

export default FormModal
