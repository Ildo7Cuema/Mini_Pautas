/*
component-meta:
  name: ConfirmModal
  description: Reusable confirmation modal with modern design
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import { useEffect } from 'react'

export type ConfirmModalVariant = 'danger' | 'warning' | 'info'

interface ConfirmModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    variant?: ConfirmModalVariant
    loading?: boolean
}

const variantStyles = {
    danger: {
        icon: (
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        ),
        iconBgGradient: 'from-red-500 to-red-600',
        buttonGradient: 'from-red-600 to-red-700 hover:from-red-700 hover:to-red-800',
        shadowColor: 'shadow-red-500/25',
    },
    warning: {
        icon: (
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        ),
        iconBgGradient: 'from-amber-500 to-amber-600',
        buttonGradient: 'from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800',
        shadowColor: 'shadow-amber-500/25',
    },
    info: {
        icon: (
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        iconBgGradient: 'from-blue-500 to-blue-600',
        buttonGradient: 'from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
        shadowColor: 'shadow-blue-500/25',
    },
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
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
    const styles = variantStyles[variant]

    // Handle ESC key to close modal
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !loading) {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden'
        }

        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.body.style.overflow = 'unset'
        }
    }, [isOpen, onClose, loading])

    if (!isOpen) return null

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget && !loading) {
            onClose()
        }
    }

    const handleConfirm = () => {
        if (!loading) {
            onConfirm()
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
        >
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" aria-hidden="true" />
            <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl shadow-slate-900/15 border border-slate-200/80 overflow-hidden animate-modal-in">
                <div className="px-5 pt-5 pb-3 flex justify-center">
                    <div className={`bg-gradient-to-br ${styles.iconBgGradient} rounded-xl p-3 shadow-lg ${styles.shadowColor}`}>
                        <span className="[&_svg]:w-6 [&_svg]:h-6 block">{styles.icon}</span>
                    </div>
                </div>

                <div className="px-5 py-2 text-center">
                    <h3 id="confirm-modal-title" className="text-lg font-semibold text-slate-900 mb-1.5 tracking-tight">
                        {title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                        {message}
                    </p>
                </div>

                <div className="px-5 pb-5 pt-4 flex flex-col-reverse sm:flex-row gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-all duration-200 touch-feedback min-h-touch disabled:opacity-50"
                        autoFocus
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={loading}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r ${styles.buttonGradient} text-white font-medium rounded-xl transition-all duration-200 shadow-md ${styles.shadowColor} touch-feedback min-h-touch disabled:opacity-50`}
                    >
                        {loading ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Processando...</span>
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
