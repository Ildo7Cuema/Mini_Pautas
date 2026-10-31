/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Primary - Azul
                primary: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                    DEFAULT: '#2563eb',
                },
                // Secondary - Verde
                secondary: {
                    50: '#f0fdf4',
                    100: '#dcfce7',
                    200: '#bbf7d0',
                    300: '#86efac',
                    400: '#4ade80',
                    500: '#22c55e',
                    600: '#16a34a',
                    700: '#15803d',
                    800: '#166534',
                    900: '#14532d',
                    DEFAULT: '#16a34a',
                },
                // Semantic
                success: '#16a34a',
                warning: '#f59e0b',
                error: '#ef4444',
                info: '#2563eb',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['Fira Code', 'Courier New', 'monospace'],
            },
            fontSize: {
                'xs': ['0.75rem', { lineHeight: '1.25' }],
                'sm': ['0.875rem', { lineHeight: '1.5' }],
                'base': ['1rem', { lineHeight: '1.5' }],
                'lg': ['1.125rem', { lineHeight: '1.75' }],
                'xl': ['1.25rem', { lineHeight: '1.75' }],
                '2xl': ['1.5rem', { lineHeight: '1.5' }],
                '3xl': ['1.875rem', { lineHeight: '1.25' }],
                '4xl': ['2.25rem', { lineHeight: '1.25' }],
                '5xl': ['3rem', { lineHeight: '1' }],
            },
            spacing: {
                '0': '0',
                '1': '0.25rem',
                '2': '0.5rem',
                '3': '0.75rem',
                '4': '1rem',
                '5': '1.25rem',
                '6': '1.5rem',
                '8': '2rem',
                '10': '2.5rem',
                '12': '3rem',
                '16': '4rem',
                '20': '5rem',
                '24': '6rem',
            },
            borderRadius: {
                'none': '0',
                'sm': '0.25rem',
                'DEFAULT': '0.5rem',
                'md': '0.75rem',
                'lg': '1rem',
                'xl': '1.5rem',
                'full': '9999px',
            },
            boxShadow: {
                'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                'sm': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
                'DEFAULT': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
                'md': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
                'lg': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                'xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            },
            transitionDuration: {
                'fast': '100ms',
                'DEFAULT': '200ms',
                'slow': '300ms',
            },
            transitionTimingFunction: {
                'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
                'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
                'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
            },
            screens: {
                'xs': '320px',
                'sm': '375px',
                'md': '768px',
                'lg': '1024px',
                'xl': '1280px',
            },
            maxWidth: {
                'container': '1280px',
                'md': '720px',
                'lg': '1024px',
                'xl': '1280px',
                /* Auth surfaces: compact cards on desktop (global max-w-md stays 720px for app modals) */
                'auth': '26rem',
                'auth-md': '32rem',
                'auth-lg': '36rem',
            },
            minWidth: {
                'touch': '2.75rem', /* 44px */
                'touch-lg': '3rem', /* 48px */
            },
            minHeight: {
                'touch': '2.75rem', /* 44px */
                'touch-lg': '3rem', /* 48px */
            },
            gridTemplateColumns: {
                'mobile': 'repeat(4, minmax(0, 1fr))',
                'tablet': 'repeat(8, minmax(0, 1fr))',
                'desktop': 'repeat(12, minmax(0, 1fr))',
            },
        },
    },
    plugins: [],
}
