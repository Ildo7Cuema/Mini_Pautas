/*
component-meta:
  name: AuthCarousel
  description: Photo carousel (right side of auth pages, >= xl) showing teachers, students and guardians using EduGest Angola
  responsive: hidden below 1280px
*/

import { useCallback, useEffect, useState } from 'react'

interface Slide {
    src: string
    alt: string
    role: string
    title: string
    text: string
}

const SLIDES: Slide[] = [
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

const INTERVAL_MS = 5500

export function AuthCarousel() {
    const [index, setIndex] = useState(0)
    const [paused, setPaused] = useState(false)
    const [reduceMotion, setReduceMotion] = useState(false)

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
        setReduceMotion(mq.matches)
        const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches)
        mq.addEventListener('change', onChange)
        return () => mq.removeEventListener('change', onChange)
    }, [])

    const next = useCallback(() => setIndex((i) => (i + 1) % SLIDES.length), [])

    useEffect(() => {
        if (paused || reduceMotion) return
        const id = window.setInterval(() => {
            if (!document.hidden) next()
        }, INTERVAL_MS)
        return () => window.clearInterval(id)
    }, [paused, reduceMotion, next, index])

    return (
        <aside
            className="auth-carousel hidden xl:block"
            aria-roledescription="carousel"
            aria-label="Quem usa o EduGest Angola"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
        >
            {/* Imagens em background: sem moldura, dissolvem-se no fundo (máscara no CSS) */}
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
                            <img
                                src={s.src}
                                alt={s.alt}
                                className="auth-carousel__img"
                                loading={i === 0 ? 'eager' : 'lazy'}
                                decoding="async"
                                draggable={false}
                            />
                        </figure>
                    )
                })}
            </div>

            {/* Legenda da imagem activa (fora da máscara para não desvanecer) */}
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
                    />
                ))}
            </div>
        </aside>
    )
}

export default AuthCarousel
