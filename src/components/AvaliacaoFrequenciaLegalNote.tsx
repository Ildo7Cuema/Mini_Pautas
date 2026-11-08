/*
component-meta:
  name: AvaliacaoFrequenciaLegalNote
  description: Nota e diálogo com decretos focados apenas em avaliação e frequência escolar (RAA / regime do ensino geral).
  responsive: true
*/

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
    AVALIACAO_FREQUENCIA_RESUMO,
    getAvaliacaoFrequenciaDocs,
    MED_NORMATIVOS_URL,
} from '../utils/angolaLegalDocs'

function AvaliacaoFrequenciaDialog({ onClose }: { onClose: () => void }) {
    const closeRef = useRef<HTMLButtonElement>(null)
    const docs = getAvaliacaoFrequenciaDocs()

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
                aria-labelledby="avaliacao-frequencia-legal-title"
                className="flex max-h-[88dvh] w-full max-w-[36rem] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl md:max-h-[85vh] md:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 md:px-6">
                    <span
                        className="mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-primary-50 text-xl"
                        aria-hidden="true"
                    >
                        📜
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2
                            id="avaliacao-frequencia-legal-title"
                            className="text-lg font-bold leading-tight text-slate-900"
                        >
                            Avaliação e frequência escolar
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Leitura focada nos decretos que regem o processo de avaliação e a frequência
                            mínima no Sistema de Ensino de Angola.
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

                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 md:px-6">
                    <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                        <h3 className="text-sm font-semibold text-slate-900">Resumo do processo (aplicado neste sistema)</h3>
                        <ul className="mt-2 space-y-2">
                            {AVALIACAO_FREQUENCIA_RESUMO.map((item) => (
                                <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-slate-600">
                                    <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-primary-500" aria-hidden="true" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-900">Decretos para consulta</h3>
                        {docs.map((doc) => (
                            <article key={doc.id} className="rounded-xl border border-slate-200 bg-white p-4">
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
                                <h4 className="text-sm font-semibold leading-snug text-slate-900">{doc.title}</h4>
                                <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{doc.description}</p>
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-xs text-slate-400">{doc.published}</span>
                                    <a
                                        href={doc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline underline-offset-2"
                                    >
                                        Ler decreto
                                        <span aria-hidden="true">↗</span>
                                    </a>
                                </div>
                            </article>
                        ))}
                    </section>
                </div>

                <div className="flex flex-col gap-1 border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-xs text-slate-500 md:flex-row md:items-center md:justify-between md:px-6">
                    <span>Fonte: Ministério da Educação de Angola. Legislação sujeita a actualização.</span>
                    <a
                        href={MED_NORMATIVOS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary-600 hover:text-primary-700 hover:underline underline-offset-2"
                    >
                        Normativos MED ↗
                    </a>
                </div>
            </div>
        </div>,
        document.body
    )
}

interface AvaliacaoFrequenciaLegalNoteProps {
    className?: string
    /** Variante compacta para cards de estatísticas. */
    compact?: boolean
}

export function AvaliacaoFrequenciaLegalNote({ className = '', compact = false }: AvaliacaoFrequenciaLegalNoteProps) {
    const [open, setOpen] = useState(false)
    const close = useCallback(() => setOpen(false), [])

    return (
        <>
            <div className={className}>
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-haspopup="dialog"
                    className={`group inline-flex w-full items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/90 text-left text-slate-600 shadow-sm transition-all hover:border-primary-200 hover:bg-white hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600 ${
                        compact ? 'px-3 py-2.5' : 'px-3.5 py-3'
                    }`}
                >
                    <span aria-hidden="true" className="mt-0.5 flex-none text-base">
                        📜
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className={`block font-semibold text-slate-800 ${compact ? 'text-xs' : 'text-sm'}`}>
                            Decreto — Avaliação e frequência
                        </span>
                        <span className={`mt-0.5 block text-slate-500 ${compact ? 'text-[11px] leading-snug' : 'text-xs leading-relaxed'}`}>
                            Consulte o RAA e o regime do ensino geral, com prioridade ao processo de avaliação e à
                            frequência mínima (66,67%).
                            <span className="ml-1 font-semibold text-primary-600 group-hover:underline underline-offset-2">
                                Ler diplomas
                            </span>
                        </span>
                    </span>
                </button>
            </div>
            {open && <AvaliacaoFrequenciaDialog onClose={close} />}
        </>
    )
}

export default AvaliacaoFrequenciaLegalNote
