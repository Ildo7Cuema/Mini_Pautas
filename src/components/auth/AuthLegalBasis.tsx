/*
component-meta:
  name: AuthLegalBasis
  description: Nota discreta nas páginas iniciais (login/registos) a informar que o sistema se baseia nos decretos do Ministério da Educação de Angola, com diálogo que lista os diplomas e ligações para as fontes.
  responsive: true
*/

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface LegalDoc {
    id: string
    tag: string
    title: string
    description: string
    published: string
    url: string
    /** Destaque: diploma de avaliação actualmente em vigor. */
    current?: boolean
}

/**
 * Diplomas que sustentam o sistema. Para actualizar quando o Ministério da Educação
 * publicar nova legislação, basta editar esta lista.
 */
const LEGAL_DOCS: LegalDoc[] = [
    {
        id: 'raa',
        tag: 'Avaliação das Aprendizagens',
        title: 'Decreto Executivo n.º 106/26 — Regulamento da Avaliação das Aprendizagens (RAA)',
        description:
            'Ministério da Educação. Escalas de classificação, arredondamento das notas e regras de avaliação no Ensino Primário e Secundário Geral (revoga o Decreto Executivo n.º 424/25).',
        published: 'Publicado a 27 de Abril de 2026',
        url: 'https://www.angolex.com/paginas/decreto-executivo/regulamento-da-avaliacao-das-aprendizagens-dos-subsistemas-da-educacao-pre-escolar-ensino-geral-e-educacao-de-adultos-raa-106a-26a.html',
        current: true,
    },
    {
        id: 'regime-ensino-geral',
        tag: 'Sistema de Ensino',
        title: 'Decreto Presidencial n.º 162/23 — Regime Jurídico do Ensino Primário e Secundário',
        description:
            'Organização, gestão escolar e curricular das instituições do Subsistema de Ensino Geral, incluindo a avaliação das aprendizagens e os Exames Nacionais.',
        published: 'Publicado a 1 de Agosto de 2023',
        url: 'https://lex.ao/docs/presidente-da-republica/2023/decreto-presidencial-n-o-162-23-de-01-de-agosto/',
    },
    {
        id: 'lei-bases',
        tag: 'Lei de Bases',
        title: 'Lei n.º 17/16, alterada e republicada pela Lei n.º 32/20 — Lei de Bases do Sistema de Educação e Ensino',
        description: 'Princípios, objectivos e estrutura do Sistema de Educação e Ensino de Angola.',
        published: 'Lei n.º 32/20, de 12 de Agosto de 2020',
        url: 'https://lex.ao/docs/assembleia-nacional/2020/lei-n-o-32-20-de-12-de-agosto/',
    },
]

const MED_NORMATIVOS_URL = 'https://xilonga.med.gov.ao/normativos'

function LegalDialog({ onClose }: { onClose: () => void }) {
    const closeRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        const previouslyFocused = document.activeElement as HTMLElement | null
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        closeRef.current?.focus()

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = previousOverflow
            previouslyFocused?.focus?.()
        }
    }, [onClose])

    return createPortal(
        <div
            className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-900/50 backdrop-blur-sm md:items-center md:p-5"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="legal-basis-title"
                className="auth-legal-dialog flex max-h-[88dvh] w-full max-w-[36rem] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl md:max-h-[85vh] md:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 md:px-6">
                    <span
                        className="mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-primary-50 text-xl"
                        aria-hidden="true"
                    >
                        ⚖️
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 id="legal-basis-title" className="text-lg font-bold leading-tight text-slate-900">
                            Base legal do sistema
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            O EduGest Angola foi desenvolvido com base nos decretos do Sistema de Ensino e de Avaliação definidos
                            pelo Ministério da Educação de Angola.
                        </p>
                    </div>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Fechar"
                        className="-mr-1 flex h-9 w-9 flex-none items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                    </button>
                </div>

                <ul className="flex-1 space-y-3 overflow-y-auto px-5 py-4 md:px-6">
                    {LEGAL_DOCS.map((doc) => (
                        <li key={doc.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-semibold text-primary-700">
                                    {doc.tag}
                                </span>
                                {doc.current && (
                                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                                        Em vigor
                                    </span>
                                )}
                            </div>
                            <h3 className="text-sm font-semibold leading-snug text-slate-900">{doc.title}</h3>
                            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{doc.description}</p>
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs text-slate-400">{doc.published}</span>
                                <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline underline-offset-2"
                                >
                                    Consultar diploma
                                    <span aria-hidden="true">↗</span>
                                </a>
                            </div>
                        </li>
                    ))}
                </ul>

                <div className="flex flex-col gap-1 border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-xs text-slate-500 md:flex-row md:items-center md:justify-between md:px-6">
                    <span>A legislação pode ser actualizada pelo Ministério da Educação.</span>
                    <a
                        href={MED_NORMATIVOS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary-600 hover:text-primary-700 hover:underline underline-offset-2"
                    >
                        Normativos do Ministério da Educação ↗
                    </a>
                </div>
            </div>
        </div>,
        document.body
    )
}

export function AuthLegalBasis() {
    const [open, setOpen] = useState(false)
    const close = useCallback(() => setOpen(false), [])

    return (
        <>
            <div className="auth-legal mt-3 flex items-center justify-center">
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-haspopup="dialog"
                    className="group inline-flex max-w-full items-center gap-2 rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-left text-[11px] leading-snug text-slate-600 shadow-sm backdrop-blur transition-all hover:bg-white hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600 sm:text-xs"
                >
                    <span aria-hidden="true" className="flex-none text-sm">
                        ⚖️
                    </span>
                    <span className="min-w-0">
                        Baseado nos decretos do <strong className="font-semibold text-slate-700">Sistema de Ensino e de Avaliação</strong>{' '}
                        do Ministério da Educação de Angola
                        <span className="ml-1 font-semibold text-primary-600 group-hover:underline underline-offset-2">Ver diplomas</span>
                    </span>
                </button>
            </div>
            {open && <LegalDialog onClose={close} />}
        </>
    )
}

export default AuthLegalBasis
