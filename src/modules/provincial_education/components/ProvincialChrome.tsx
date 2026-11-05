/**
 * Shared visual chrome for Direção Provincial pages.
 * Presentation-only — no business logic.
 */

import React from 'react'
import { Icons } from '../../../components/ui/Icons'

/* -------------------------------------------------------------------------- */
/* Page shell                                                                  */
/* -------------------------------------------------------------------------- */

export const DpPage: React.FC<{
    children: React.ReactNode
    className?: string
}> = ({ children, className = '' }) => (
    <div
        className={`
            -mx-4 md:-mx-8 -mt-4 md:-mt-8
            min-h-[calc(100vh-4rem)] animate-fade-in
            bg-gradient-to-b from-slate-100 via-slate-50 to-white
            ${className}
        `}
    >
        {children}
    </div>
)

export const DpContent: React.FC<{
    children: React.ReactNode
    className?: string
}> = ({ children, className = '' }) => (
    <div className={`px-4 sm:px-6 md:px-8 pb-10 pt-5 space-y-5 ${className}`}>{children}</div>
)

/* -------------------------------------------------------------------------- */
/* Header                                                                      */
/* -------------------------------------------------------------------------- */

type HeaderAccent = 'indigo' | 'blue' | 'emerald' | 'amber' | 'violet' | 'slate' | 'pink'

const headerAccent: Record<HeaderAccent, string> = {
    indigo: 'from-indigo-500 to-indigo-600 shadow-indigo-500/30',
    blue: 'from-blue-500 to-blue-600 shadow-blue-500/30',
    emerald: 'from-emerald-500 to-teal-600 shadow-emerald-500/30',
    amber: 'from-amber-500 to-orange-600 shadow-amber-500/30',
    violet: 'from-violet-500 to-violet-600 shadow-violet-500/30',
    slate: 'from-slate-500 to-slate-700 shadow-slate-500/30',
    pink: 'from-pink-500 to-rose-600 shadow-pink-500/30',
}

const heroAccent: Record<HeaderAccent, string> = {
    indigo: 'from-slate-900 via-indigo-950 to-indigo-800',
    blue: 'from-slate-900 via-blue-950 to-blue-800',
    emerald: 'from-slate-900 via-emerald-950 to-teal-800',
    amber: 'from-slate-900 via-amber-950 to-orange-800',
    violet: 'from-slate-900 via-violet-950 to-violet-800',
    slate: 'from-slate-950 via-slate-900 to-slate-800',
    pink: 'from-slate-900 via-rose-950 to-pink-800',
}

export const DpHeader: React.FC<{
    title: string
    subtitle?: string
    icon?: React.ReactNode
    accent?: HeaderAccent
    meta?: React.ReactNode
    actions?: React.ReactNode
}> = ({ title, subtitle, icon, accent = 'indigo', meta, actions }) => (
    <div
        className={`
            relative overflow-hidden
            bg-gradient-to-br ${heroAccent[accent]}
            px-4 sm:px-6 md:px-8 pt-6 pb-7 sm:pt-8 sm:pb-9
            text-white shadow-lg shadow-slate-900/10
        `}
    >
        {/* Pattern overlay */}
        <div
            className="absolute inset-0 opacity-[0.12] pointer-events-none"
            style={{
                backgroundImage:
                    'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                backgroundSize: '22px 22px',
            }}
            aria-hidden
        />
        <div
            className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-white/10 blur-2xl pointer-events-none"
            aria-hidden
        />
        <div
            className="absolute -left-10 -bottom-20 w-48 h-48 rounded-full bg-primary-400/20 blur-2xl pointer-events-none"
            aria-hidden
        />

        <div className="relative z-10 flex items-start justify-between gap-3 sm:gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
                {icon && (
                    <div
                        className={`
                            flex flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14
                            rounded-2xl bg-gradient-to-br ${headerAccent[accent]}
                            items-center justify-center shadow-lg
                            text-white [&_svg]:w-6 [&_svg]:h-6 sm:[&_svg]:w-7 sm:[&_svg]:h-7
                            ring-2 ring-white/20
                        `}
                    >
                        {icon}
                    </div>
                )}
                <div className="min-w-0 pt-0.5">
                    <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.16em] text-white/70 mb-1">
                        Direção Provincial
                    </p>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight text-white drop-shadow-sm">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="mt-1.5 text-sm sm:text-base text-white/85 leading-snug max-w-2xl">
                            {subtitle}
                        </p>
                    )}
                    {meta && (
                        <div className="mt-3 text-white/80 [&_span]:text-white/80 [&_svg]:text-white/70">
                            {meta}
                        </div>
                    )}
                </div>
            </div>
            {actions && (
                <div className="flex flex-shrink-0 items-center gap-2 [&_button]:ring-1 [&_button]:ring-white/25">
                    {actions}
                </div>
            )}
        </div>
    </div>
)

/* -------------------------------------------------------------------------- */
/* Buttons                                                                     */
/* -------------------------------------------------------------------------- */

export const DpIconButton: React.FC<{
    onClick?: () => void
    disabled?: boolean
    label: string
    children: React.ReactNode
    variant?: 'primary' | 'ghost' | 'danger'
    className?: string
}> = ({ onClick, disabled, label, children, variant = 'primary', className = '' }) => {
    const styles = {
        primary:
            'bg-white text-slate-900 shadow-md shadow-black/10 hover:bg-slate-100',
        ghost:
            'bg-white/15 text-white border border-white/25 hover:bg-white/25 backdrop-blur-sm',
        danger:
            'bg-red-500 text-white shadow-sm hover:bg-red-600',
    }
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            title={label}
            className={`
                flex items-center justify-center
                min-w-[44px] min-h-[44px] p-2.5 rounded-xl
                transition-all duration-200 active:scale-95
                disabled:opacity-50 disabled:pointer-events-none
                ${styles[variant]} ${className}
            `}
        >
            {children}
        </button>
    )
}

export const DpButton: React.FC<{
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    type?: 'button' | 'submit'
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning'
    fullWidth?: boolean
    icon?: React.ReactNode
    className?: string
}> = ({
    children,
    onClick,
    disabled,
    type = 'button',
    variant = 'primary',
    fullWidth,
    icon,
    className = '',
}) => {
    const styles = {
        primary:
            'bg-primary-600 text-white shadow-sm shadow-primary-600/20 hover:bg-primary-700',
        secondary:
            'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300',
        ghost: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
        danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
        success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700',
        warning: 'bg-amber-600 text-white shadow-sm hover:bg-amber-700',
    }
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`
                inline-flex items-center justify-center gap-2
                px-4 py-2.5 min-h-[44px] rounded-xl
                text-sm font-semibold tracking-tight
                transition-all duration-200 active:scale-[0.98]
                disabled:opacity-50 disabled:pointer-events-none
                ${fullWidth ? 'w-full' : ''}
                ${styles[variant]} ${className}
            `}
        >
            {icon}
            {children}
        </button>
    )
}

/* -------------------------------------------------------------------------- */
/* Panels / cards                                                              */
/* -------------------------------------------------------------------------- */

export const DpPanel: React.FC<{
    children: React.ReactNode
    className?: string
    padding?: boolean
}> = ({ children, className = '', padding = true }) => (
    <div
        className={`
            bg-white
            rounded-2xl border border-slate-200/80
            shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.06)]
            overflow-hidden
            ${padding ? 'p-4 sm:p-5' : ''}
            ${className}
        `}
    >
        {children}
    </div>
)

export const DpStatCard: React.FC<{
    title: string
    value: number | string
    icon: React.ReactNode
    iconTone?: string
    subtitle?: string
    onClick?: () => void
}> = ({ title, value, icon, iconTone = 'from-indigo-50 to-indigo-100 text-indigo-600', subtitle, onClick }) => {
    const body = (
        <div className="flex items-center gap-3">
            <div
                className={`
                    flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl
                    bg-gradient-to-br ${iconTone}
                    flex items-center justify-center
                `}
            >
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-none tabular-nums">
                    {value}
                </p>
                <p className="text-sm text-slate-500 font-medium mt-1 truncate">{title}</p>
                {subtitle && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
                )}
            </div>
            {onClick && (
                <Icons.ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
            )}
        </div>
    )

    const shell = `
        w-full text-left
        bg-white rounded-2xl p-4 sm:p-5
        border border-slate-200/80
        shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_20px_rgba(15,23,42,0.05)]
        ring-1 ring-slate-900/[0.02]
        transition-all duration-200
        ${onClick
            ? 'cursor-pointer hover:shadow-lg hover:border-primary-200 hover:-translate-y-0.5 active:scale-[0.98]'
            : ''
        }
    `

    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={shell}>
                {body}
            </button>
        )
    }

    return <div className={shell}>{body}</div>
}

export const DpMetricPill: React.FC<{
    label: string
    value: number | string
    tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
}> = ({ label, value, tone = 'neutral' }) => {
    const tones = {
        neutral: 'bg-slate-100/90 text-slate-700',
        success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
        warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
        danger: 'bg-red-50 text-red-700 ring-1 ring-red-100',
        info: 'bg-blue-50 text-blue-700 ring-1 ring-blue-100',
    }
    return (
        <div
            className={`
                flex-shrink-0 rounded-xl px-4 py-3 min-w-[96px] sm:min-w-0
                ${tones[tone]}
            `}
        >
            <p className="text-xl sm:text-2xl font-bold tabular-nums leading-none">{value}</p>
            <p className="text-xs font-medium opacity-70 mt-1.5">{label}</p>
        </div>
    )
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                               */
/* -------------------------------------------------------------------------- */

export const DpSearch: React.FC<{
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
}> = ({ value, onChange, placeholder = 'Pesquisar...', className = '' }) => (
    <div className={`relative ${className}`}>
        <Icons.Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
        <input
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="
                w-full pl-11 pr-4 py-3 min-h-[48px]
                bg-white border border-slate-200/80 rounded-xl
                text-base text-slate-900 placeholder:text-slate-400
                shadow-sm shadow-slate-900/[0.02]
                focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
                transition-all duration-200
            "
        />
    </div>
)

export const DpChip: React.FC<{
    label: string
    active?: boolean
    onClick?: () => void
}> = ({ label, active, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`
            px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap
            min-h-[36px] transition-all duration-200
            ${active
                ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/25'
                : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
            }
        `}
    >
        {label}
    </button>
)

export const DpLabel: React.FC<{
    children: React.ReactNode
    htmlFor?: string
    required?: boolean
}> = ({ children, htmlFor, required }) => (
    <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-700 mb-1.5"
    >
        {children}
        {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
)

const fieldClass =
    'w-full px-4 py-3 min-h-[48px] bg-white border border-slate-200/80 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 shadow-sm shadow-slate-900/[0.02] focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all duration-200'

export const DpInput: React.FC<
    React.InputHTMLAttributes<HTMLInputElement> & { label?: string }
> = ({ label, className = '', id, required, ...props }) => (
    <div className="w-full">
        {label && (
            <DpLabel htmlFor={id} required={required}>
                {label}
            </DpLabel>
        )}
        <input id={id} required={required} className={`${fieldClass} ${className}`} {...props} />
    </div>
)

export const DpTextarea: React.FC<
    React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }
> = ({ label, className = '', id, required, ...props }) => (
    <div className="w-full">
        {label && (
            <DpLabel htmlFor={id} required={required}>
                {label}
            </DpLabel>
        )}
        <textarea
            id={id}
            required={required}
            className={`${fieldClass} min-h-[96px] resize-y ${className}`}
            {...props}
        />
    </div>
)

export const DpSelect: React.FC<
    React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }
> = ({ label, className = '', id, required, children, ...props }) => (
    <div className="w-full">
        {label && (
            <DpLabel htmlFor={id} required={required}>
                {label}
            </DpLabel>
        )}
        <select id={id} required={required} className={`${fieldClass} ${className}`} {...props}>
            {children}
        </select>
    </div>
)

/* -------------------------------------------------------------------------- */
/* Status / empty / loading                                                    */
/* -------------------------------------------------------------------------- */

export const DpBadge: React.FC<{
    children: React.ReactNode
    tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'info'
}> = ({ children, tone = 'neutral' }) => {
    const tones = {
        success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80',
        warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/80',
        danger: 'bg-red-50 text-red-700 ring-1 ring-red-200/80',
        neutral: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80',
        info: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/80',
    }
    return (
        <span
            className={`
                inline-flex items-center px-2.5 py-1 rounded-full
                text-xs font-semibold tracking-tight ${tones[tone]}
            `}
        >
            {children}
        </span>
    )
}

export const DpEmpty: React.FC<{
    icon?: React.ReactNode
    title: string
    description?: string
    action?: React.ReactNode
}> = ({ icon, title, description, action }) => (
    <DpPanel className="text-center py-12 sm:py-16">
        <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 [&_svg]:w-7 [&_svg]:h-7 sm:[&_svg]:w-8 sm:[&_svg]:h-8">
            {icon || <Icons.DocumentText />}
        </div>
        <h3 className="text-base sm:text-lg font-semibold text-slate-700">{title}</h3>
        {description && (
            <p className="mt-1.5 text-sm text-slate-500 max-w-sm mx-auto">
                {description}
            </p>
        )}
        {action && <div className="mt-5 flex justify-center">{action}</div>}
    </DpPanel>
)

export const DpLoading: React.FC<{ label?: string }> = ({ label = 'A carregar...' }) => (
    <DpPage className="flex flex-col items-center justify-center gap-3">
        <div className="relative">
            <div className="h-11 w-11 rounded-full border-2 border-primary-100" />
            <div className="absolute inset-0 h-11 w-11 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        </div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
    </DpPage>
)

export const DpAlert: React.FC<{
    children: React.ReactNode
    tone?: 'error' | 'warning' | 'success' | 'info'
}> = ({ children, tone = 'error' }) => {
    const tones = {
        error: 'bg-red-50 border-red-200/80 text-red-700',
        warning: 'bg-amber-50 border-amber-200/80 text-amber-800',
        success: 'bg-emerald-50 border-emerald-200/80 text-emerald-700',
        info: 'bg-blue-50 border-blue-200/80 text-blue-700',
    }
    return (
        <div
            className={`
                flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium
                ${tones[tone]}
            `}
            role="alert"
        >
            <Icons.ExclamationCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">{children}</div>
        </div>
    )
}

/* -------------------------------------------------------------------------- */
/* Modal — profissional, moderno, interativo (perfil Direção Provincial)       */
/* -------------------------------------------------------------------------- */

const modalAccentBar: Record<HeaderAccent, string> = {
    indigo: 'from-indigo-500 via-indigo-400 to-violet-400',
    blue: 'from-blue-500 via-sky-400 to-cyan-400',
    emerald: 'from-emerald-500 via-teal-400 to-cyan-400',
    amber: 'from-amber-500 via-orange-400 to-rose-400',
    violet: 'from-violet-500 via-fuchsia-400 to-pink-400',
    slate: 'from-slate-600 via-slate-500 to-indigo-400',
    pink: 'from-pink-500 via-rose-400 to-orange-400',
}

const modalAccentGlow: Record<HeaderAccent, string> = {
    indigo: 'shadow-indigo-500/40',
    blue: 'shadow-blue-500/40',
    emerald: 'shadow-emerald-500/40',
    amber: 'shadow-amber-500/40',
    violet: 'shadow-violet-500/40',
    slate: 'shadow-slate-500/40',
    pink: 'shadow-pink-500/40',
}

export const DpFormSection: React.FC<{
    title: string
    description?: string
    children: React.ReactNode
    className?: string
}> = ({ title, description, children, className = '' }) => (
    <section
        className={`
            relative rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80
            p-4 sm:p-5 space-y-3.5
            shadow-[0_1px_2px_rgba(15,23,42,0.04)]
            transition-shadow duration-300 hover:shadow-md hover:border-slate-300/80
            ${className}
        `}
    >
        <div className="flex items-start gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary-500 shadow-sm shadow-primary-500/50" />
            <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h3>
                {description && (
                    <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{description}</p>
                )}
            </div>
        </div>
        <div className="space-y-3.5">{children}</div>
    </section>
)

export const DpModalFooter: React.FC<{
    children: React.ReactNode
    className?: string
}> = ({ children, className = '' }) => (
    <div
        className={`
            flex-shrink-0 px-4 sm:px-5 py-3.5 sm:py-4
            border-t border-slate-200/80
            bg-gradient-to-t from-slate-100/90 via-slate-50/80 to-white/95
            backdrop-blur-sm
            flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end
            ${className}
        `}
    >
        {children}
    </div>
)

export const DpModal: React.FC<{
    isOpen: boolean
    onClose: () => void
    title: string
    subtitle?: string
    icon?: React.ReactNode
    accent?: HeaderAccent
    children: React.ReactNode
    footer?: React.ReactNode
    badge?: React.ReactNode
    busy?: boolean
    size?: 'md' | 'lg' | 'xl'
    /** Padding no corpo; false quando o conteúdo já tem padding próprio */
    padded?: boolean
}> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    icon,
    accent = 'indigo',
    children,
    footer,
    badge,
    busy = false,
    size = 'md',
    padded = true,
}) => {
    React.useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !busy) onClose()
        }
        document.addEventListener('keydown', onKey)
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = ''
        }
    }, [isOpen, onClose, busy])

    if (!isOpen) return null

    const width =
        size === 'xl' ? 'md:max-w-3xl' : size === 'lg' ? 'md:max-w-2xl' : 'md:max-w-xl'

    return (
        <div
            className="fixed inset-0 z-50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dp-modal-title"
        >
            <div
                className="
                    absolute inset-0 animate-fade-in
                    bg-slate-950/55 backdrop-blur-[3px]
                    bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.18),transparent_55%)]
                "
                onClick={() => {
                    if (!busy) onClose()
                }}
                aria-hidden="true"
            />
            <div
                className={`
                    absolute inset-x-0 bottom-0 top-8 md:inset-auto
                    md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
                    ${width} md:w-full md:mx-4 md:max-h-[min(92vh,52rem)]
                    bg-white
                    rounded-t-[1.35rem] md:rounded-2xl
                    shadow-[0_-8px_40px_rgba(15,23,42,0.18),0_25px_50px_-12px_rgba(15,23,42,0.35)]
                    border border-slate-200/60
                    flex flex-col
                    animate-slide-up md:animate-scale-in
                    overflow-hidden
                `}
            >
                {/* Mobile drag affordance */}
                <div className="md:hidden flex justify-center pt-2.5 pb-0.5" aria-hidden="true">
                    <span className="h-1 w-10 rounded-full bg-slate-300/90" />
                </div>

                {/* Accent ribbon */}
                <div
                    className={`h-1 w-full bg-gradient-to-r ${modalAccentBar[accent]} flex-shrink-0`}
                    aria-hidden="true"
                />

                <div className="flex-shrink-0 relative px-4 sm:px-5 pt-3.5 sm:pt-4 pb-3.5 border-b border-slate-100/90 bg-gradient-to-br from-white via-slate-50/40 to-white">
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.35]"
                        style={{
                            backgroundImage:
                                'radial-gradient(circle at 12% 20%, rgba(148,163,184,0.18), transparent 42%)',
                        }}
                        aria-hidden="true"
                    />
                    <div className="relative flex items-start gap-3">
                        {icon && (
                            <div
                                className={`
                                    relative w-11 h-11 sm:w-12 sm:h-12 flex-shrink-0 rounded-2xl
                                    bg-gradient-to-br ${headerAccent[accent]}
                                    flex items-center justify-center
                                    shadow-lg ${modalAccentGlow[accent]}
                                    text-white [&_svg]:w-5 [&_svg]:h-5 sm:[&_svg]:w-[1.35rem] sm:[&_svg]:h-[1.35rem]
                                    ring-2 ring-white/40
                                    transition-transform duration-300 hover:scale-105
                                `}
                            >
                                {icon}
                            </div>
                        )}
                        <div className="min-w-0 flex-1 pt-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2
                                    id="dp-modal-title"
                                    className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight leading-snug"
                                >
                                    {title}
                                </h2>
                                {badge}
                            </div>
                            {subtitle && (
                                <p className="mt-1 text-sm text-slate-500 leading-relaxed">{subtitle}</p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={busy}
                            aria-label="Fechar"
                            className="
                                group w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl
                                text-slate-400 bg-slate-100/60
                                hover:text-slate-700 hover:bg-slate-200/80 hover:rotate-90
                                active:scale-95
                                transition-all duration-200
                                disabled:opacity-50 disabled:pointer-events-none
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40
                            "
                        >
                            <Icons.X className="w-5 h-5 transition-transform duration-200" />
                        </button>
                    </div>
                </div>

                <div
                    className={`
                        flex-1 min-h-0 overflow-y-auto overscroll-contain
                        scrollbar-thin
                        ${padded ? 'p-4 sm:p-5 md:p-6' : ''}
                    `}
                >
                    {children}
                </div>

                {footer}
            </div>
        </div>
    )
}

export const DpConfirmModal: React.FC<{
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    variant?: 'danger' | 'warning' | 'info' | 'success'
    loading?: boolean
}> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'danger',
    loading = false,
}) => {
    const tones = {
        danger: {
            bar: 'from-red-500 via-rose-400 to-orange-400',
            iconBg: 'from-red-500 to-red-600 shadow-red-500/35',
            btn: 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-red-500/25',
            ring: 'ring-red-100',
        },
        warning: {
            bar: 'from-amber-500 via-orange-400 to-yellow-400',
            iconBg: 'from-amber-500 to-orange-600 shadow-amber-500/35',
            btn: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-amber-500/25',
            ring: 'ring-amber-100',
        },
        info: {
            bar: 'from-blue-500 via-sky-400 to-cyan-400',
            iconBg: 'from-blue-500 to-blue-600 shadow-blue-500/35',
            btn: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25',
            ring: 'ring-blue-100',
        },
        success: {
            bar: 'from-emerald-500 via-teal-400 to-cyan-400',
            iconBg: 'from-emerald-500 to-teal-600 shadow-emerald-500/35',
            btn: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/25',
            ring: 'ring-emerald-100',
        },
    }[variant]

    React.useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !loading) onClose()
        }
        document.addEventListener('keydown', onKey)
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = ''
        }
    }, [isOpen, onClose, loading])

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dp-confirm-title"
            onClick={(e) => {
                if (e.target === e.currentTarget && !loading) onClose()
            }}
        >
            <div
                className="absolute inset-0 bg-slate-950/55 backdrop-blur-[3px]"
                aria-hidden="true"
            />
            <div
                className="
                    relative w-full sm:max-w-md
                    bg-white rounded-t-2xl sm:rounded-2xl
                    shadow-2xl shadow-slate-900/25
                    border border-slate-200/70
                    overflow-hidden
                    animate-slide-up sm:animate-scale-in
                "
            >
                <div className={`h-1 w-full bg-gradient-to-r ${tones.bar}`} aria-hidden="true" />
                <div className="px-5 pt-6 pb-2 flex justify-center">
                    <div
                        className={`
                            w-14 h-14 rounded-2xl bg-gradient-to-br ${tones.iconBg}
                            flex items-center justify-center text-white shadow-lg
                            ring-4 ${tones.ring}
                            animate-bounce-subtle
                        `}
                    >
                        {variant === 'success' ? (
                            <Icons.CheckCircle className="w-7 h-7" />
                        ) : variant === 'info' ? (
                            <Icons.Info className="w-7 h-7" />
                        ) : (
                            <Icons.ExclamationCircle className="w-7 h-7" />
                        )}
                    </div>
                </div>
                <div className="px-5 py-2 text-center">
                    <h3
                        id="dp-confirm-title"
                        className="text-lg font-semibold text-slate-900 tracking-tight"
                    >
                        {title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">{message}</p>
                </div>
                <div className="px-5 pb-5 pt-4 flex flex-col-reverse sm:flex-row gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="
                            flex-1 px-4 py-2.5 min-h-[44px] rounded-xl
                            bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm
                            transition-all duration-200 active:scale-[0.98]
                            disabled:opacity-50
                        "
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (!loading) onConfirm()
                        }}
                        disabled={loading}
                        className={`
                            flex-1 inline-flex items-center justify-center gap-2
                            px-4 py-2.5 min-h-[44px] rounded-xl
                            text-white font-semibold text-sm shadow-md
                            transition-all duration-200 active:scale-[0.98]
                            disabled:opacity-50 ${tones.btn}
                        `}
                    >
                        {loading ? (
                            <>
                                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                A processar…
                            </>
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

export const DpSectionTitle: React.FC<{
    children: React.ReactNode
    action?: React.ReactNode
    icon?: React.ReactNode
}> = ({ children, action, icon }) => (
    <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            {icon && <span className="text-primary-600 [&_svg]:w-5 [&_svg]:h-5">{icon}</span>}
            {children}
        </h2>
        {action}
    </div>
)

export const DpQuickAction: React.FC<{
    label: string
    icon: React.ReactNode
    iconTone?: string
    onClick: () => void
}> = ({ label, icon, iconTone = 'from-blue-50 to-blue-100 text-blue-600', onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="
            flex flex-col items-center gap-2.5 p-4
            bg-white rounded-2xl
            border border-slate-200/80
            shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_20px_rgba(15,23,42,0.05)]
            transition-all duration-200
            hover:shadow-lg hover:border-primary-200 hover:-translate-y-0.5
            active:scale-[0.96]
            min-h-[108px] min-w-[88px]
        "
    >
        <div
            className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${iconTone} flex items-center justify-center shadow-sm`}
        >
            {icon}
        </div>
        <span className="text-xs font-bold text-slate-800 text-center leading-tight">
            {label}
        </span>
    </button>
)
