/*
component-meta:
  name: AuthCarousel
  description: Photo carousel used as auth background — right side on desktop (>= 1280px), faint full-bleed background on tablet/mobile
  responsive: true
*/

import { useCallback, useEffect, useRef, useState } from 'react'

interface Slide {
    src: string
    alt: string
    role: string
    title: string
    text: string
}

export const SLIDES: Slide[] = [
    {
        src: '/auth-carousel/auth-carousel-professor-laptop.jpg',
        alt: 'Professor a usar o EduGest Angola num laptop na sala de aula',
        role: 'Professores',
        title: 'Pautas e turmas num só lugar',
        text: 'Lance notas, registe faltas e acompanhe as suas turmas em minutos.',
    },
    {
        src: '/auth-carousel/auth-carousel-professora-telemovel.jpg',
        alt: 'Professora a consultar o EduGest Angola no telemóvel',
        role: 'Professoras',
        title: 'Sempre à distância de um toque',
        text: 'Consulte pautas e comunique com a escola, onde quer que esteja.',
    },
    {
        src: '/auth-carousel/auth-carousel-alunos.jpg',
        alt: 'Alunos com farda a ver as suas notas num tablet e telemóvel',
        role: 'Alunos',
        title: 'O seu percurso escolar, claro',
        text: 'Veja as suas notas, médias e resultados de cada trimestre.',
    },
    {
        src: '/auth-carousel/auth-carousel-encarregados.jpg',
        alt: 'Pais encarregados de educação a ver o boletim do educando no telemóvel',
        role: 'Encarregados de Educação',
        title: 'Acompanhe quem mais importa',
        text: 'Siga o desempenho do seu educando e fique sempre informado.',
    },
]

/** Intervalo do autoplay (os pontos só saltam manualmente; a troca continua sozinha). */
export const INTERVAL_MS = 4000
const INTERVAL_REDUCED_MS = 7000

function isDesktopCarousel() {
    return window.matchMedia('(min-width: 1280px)').matches
}

function canHoverPause() {
    return (
        isDesktopCarousel() &&
        window.matchMedia('(hover: hover) and (pointer: fine)').matches
    )
}

/** Estado partilhado do carrossel: índice, rotação automática e imagens já carregadas. */
export function useCarouselState() {
    const [index, setIndexState] = useState(0)
    const [reduceMotion, setReduceMotion] = useState(false)
    const [seen, setSeen] = useState<number[]>(() => SLIDES.map((_, i) => i))
    const [timerEpoch, setTimerEpoch] = useState(0)

    const hoverPausedRef = useRef(false)
    const reduceMotionRef = useRef(false)

    useEffect(() => {
        setSeen((prev) => {
            const wanted = [index, (index + 1) % SLIDES.length]
            const merged = Array.from(new Set([...prev, ...wanted]))
            return merged.length === prev.length ? prev : merged
        })
    }, [index])

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
        const apply = () => {
            reduceMotionRef.current = mq.matches
            setReduceMotion(mq.matches)
        }
        apply()
        mq.addEventListener('change', apply)
        return () => mq.removeEventListener('change', apply)
    }, [])

    const bumpTimer = useCallback(() => setTimerEpoch((n) => n + 1), [])

    /** Navegação manual (pontos / swipe) — não desliga o autoplay, só reinicia o contador. */
    const setIndex = useCallback(
        (next: number | ((i: number) => number)) => {
            setIndexState(next)
            bumpTimer()
        },
        [bumpTimer],
    )

    const setPaused = useCallback(
        (value: boolean) => {
            if (value && !canHoverPause()) return
            hoverPausedRef.current = value
            if (!value) bumpTimer()
        },
        [bumpTimer],
    )

    // Autoplay contínuo: não depende de toques nos pontos
    useEffect(() => {
        let timeoutId = 0
        let cancelled = false

        const delayMs = () => (reduceMotionRef.current ? INTERVAL_REDUCED_MS : INTERVAL_MS)

        const tick = () => {
            timeoutId = window.setTimeout(() => {
                if (cancelled) return
                if (!document.hidden && !hoverPausedRef.current) {
                    setIndexState((i) => (i + 1) % SLIDES.length)
                }
                if (!cancelled) tick()
            }, delayMs())
        }

        const onVisibility = () => {
            window.clearTimeout(timeoutId)
            if (!document.hidden && !cancelled) tick()
        }

        tick()
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
            cancelled = true
            window.clearTimeout(timeoutId)
            document.removeEventListener('visibilitychange', onVisibility)
        }
    }, [timerEpoch])

    return { index, setIndex, setPaused, seen, reduceMotion }
}

export function AuthCarousel() {
    const { index, setIndex, setPaused, seen, reduceMotion } = useCarouselState()

    return (
        <aside
            className="auth-carousel"
            aria-roledescription="carousel"
            aria-label="Quem usa o EduGest Angola"
            // Pausa por hover só no desktop; em mobile o autoplay nunca para por interacção
            onPointerEnter={(e) => e.pointerType === 'mouse' && setPaused(true)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setPaused(false)}
        >
            <div className="auth-carousel__frame">
                {SLIDES.map((s, i) => {
                    const active = i === index
                    return (
                        <figure
                            key={s.src}
                            className={`auth-carousel__slide ${active ? 'is-active' : ''}`}
                            aria-hidden={!active}
                            aria-roledescription="slide"
                            aria-label={`${i + 1} de ${SLIDES.length}`}
                        >
                            {seen.includes(i) && (
                                <img
                                    key={active ? `active-${index}` : s.src}
                                    src={s.src}
                                    alt={s.alt}
                                    className="auth-carousel__img"
                                    decoding="async"
                                    draggable={false}
                                />
                            )}
                        </figure>
                    )
                })}
            </div>

            <div key={index} className="auth-carousel__caption" aria-live="off">
                <span className="auth-carousel__role">{SLIDES[index].role}</span>
                <strong className="auth-carousel__title">{SLIDES[index].title}</strong>
                <span className="auth-carousel__text">{SLIDES[index].text}</span>
            </div>

            <div className="auth-carousel__dots pointer-events-auto" role="tablist" aria-label="Escolher imagem">
                {SLIDES.map((s, i) => (
                    <button
                        key={s.role}
                        type="button"
                        role="tab"
                        aria-selected={i === index}
                        aria-label={`Mostrar: ${s.role}`}
                        className={`auth-carousel__dot ${i === index ? 'is-active' : ''}`}
                        onClick={() => setIndex(i)}
                    >
                        {i === index && !reduceMotion && (
                            <span
                                key={`progress-${index}`}
                                className="auth-carousel__dot-progress"
                                style={{ animationDuration: `${INTERVAL_MS}ms` }}
                            />
                        )}
                    </button>
                ))}
            </div>
        </aside>
    )
}

export default AuthCarousel
