import { InputHTMLAttributes, forwardRef, ReactNode, useState } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
    helpText?: string
    icon?: ReactNode
    iconPosition?: 'left' | 'right'
    inputSize?: 'sm' | 'md' | 'lg'
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, helpText, icon, iconPosition = 'left', inputSize = 'md', className = '', id, type, ...props }, ref) => {
        const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`
        const [showPassword, setShowPassword] = useState(false)
        const [isFocused, setIsFocused] = useState(false)
        const isPassword = type === 'password'
        const inputType = isPassword && showPassword ? 'text' : type

        const sizeClasses = {
            sm: 'min-h-[40px] text-sm py-2 leading-normal',
            md: 'min-h-[48px] text-sm py-3 leading-normal',
            lg: 'min-h-[52px] text-base py-3.5 leading-normal',
        }

        return (
            <div className="w-full">
                {label && (
                    <label htmlFor={inputId} className="form-label mb-2 block text-sm font-medium text-slate-700">
                        {label}
                        {props.required && <span className="text-error ml-1">*</span>}
                    </label>
                )}
                <div className="relative">
                    {icon && iconPosition === 'left' && (
                        <div className={`absolute left-4 top-1/2 transform -translate-y-1/2 transition-colors duration-200 ${isFocused ? 'text-primary-500' : 'text-neutral-400'}`}>
                            {icon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        id={inputId}
                        type={inputType}
                        onFocus={(e) => {
                            setIsFocused(true)
                            props.onFocus?.(e)
                        }}
                        onBlur={(e) => {
                            setIsFocused(false)
                            props.onBlur?.(e)
                        }}
                        className={`
                            w-full px-3.5 border rounded-sm text-slate-900
                            ${sizeClasses[inputSize]}
                            ${error
                                ? 'border-error ring-2 ring-error/20'
                                : isFocused
                                    ? 'border-primary-500 ring-2 ring-primary-500/20'
                                    : 'border-neutral-300'
                            }
                            focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20
                            transition-colors duration-150 ease-out
                            disabled:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60
                            placeholder:text-neutral-400
                            ${icon && iconPosition === 'left' ? 'pl-11' : ''}
                            ${isPassword ? 'pr-11' : icon && iconPosition === 'right' ? 'pr-11' : ''}
                            ${className}
                        `}
                        aria-invalid={error ? 'true' : 'false'}
                        aria-describedby={error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined}
                        {...props}
                    />
                    {isPassword && (
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors p-1 touch-feedback min-w-touch min-h-touch flex items-center justify-center -mr-1"
                            tabIndex={-1}
                        >
                            {showPassword ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            )}
                        </button>
                    )}
                    {!isPassword && icon && iconPosition === 'right' && (
                        <div className={`absolute right-4 top-1/2 transform -translate-y-1/2 transition-colors duration-200 ${isFocused ? 'text-primary-500' : 'text-neutral-400'}`}>
                            {icon}
                        </div>
                    )}
                </div>
                {error && (
                    <p id={`${inputId}-error`} className="mt-2 text-sm text-error flex items-center gap-1" role="alert">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                    </p>
                )}
                {helpText && !error && (
                    <p id={`${inputId}-help`} className="mt-2 text-sm text-neutral-500">
                        {helpText}
                    </p>
                )}
            </div>
        )
    }
)

Input.displayName = 'Input'

