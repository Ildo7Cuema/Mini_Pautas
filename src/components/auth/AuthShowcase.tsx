/*
component-meta:
  name: AuthShowcase
  description: Faixa compacta (globo de Angola + carrossel de fotos) mostrada em fluxo normal no topo das páginas de autenticação em telemóvel, onde o fundo decorativo ficaria demasiado pequeno/discreto.
  responsive: true
*/

import { useState } from 'react'
import { AngolaGlobe } from './AngolaGlobe'
import { INTERVAL_MS, SLIDES, useCarouselState } from './AuthCarousel'

export function AuthShowcase() {
    const { index, setIndex, setPaused, seen, reduceMotion } = useCarouselState()
    const slide = SLIDES[index]
    const [touchX, setTouchX] = useState<number | null>(null)

    // Deslizar para o lado muda de foto
    const onTouchEnd = (clientX: number) => {
        if (touchX === null) return
        const dx = clientX - touchX
        setTouchX(null)
        if (Math.abs(dx) < 40) return
        setIndex((i) => (dx < 0 ? (i + 1) % SLIDES.length : (i - 1 + SLIDES.length) % SLIDES.length))
    }

    return (
        <section className="auth-showcase" aria-label="EduGest Angola">
            <AngolaGlobe variant="compact" />

            <div
                className="auth-showcase__carousel"
                aria-roledescription="carousel"
                aria-label="Quem usa o EduGest Angola"
                onPointerEnter={(e) => e.pointerType === 'mouse' && setPaused(true)}
                onPointerLeave={(e) => e.pointerType === 'mouse' && setPaused(false)}
                onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
                onTouchEnd={(e) => onTouchEnd(e.changedTouches[0].clientX)}
            >
                {SLIDES.map((s, i) => (
                    <figure
                        key={s.src}
                        className={`auth-showcase__slide ${i === index ? 'is-active' : ''}`}
                        aria-hidden={i !== index}
                        aria-roledescription="slide"
                        aria-label={`${i + 1} de ${SLIDES.length}`}
                    >
                        {seen.includes(i) && (
                            <img
                                key={i === index ? `active-${index}` : s.src}
                                src={s.src}
                                alt={s.alt}
                                className="auth-showcase__img"
                                decoding="async"
                                draggable={false}
                            />
                        )}
                    </figure>
                ))}

                <div className="auth-showcase__shade" />

                <div key={index} className="auth-showcase__caption" aria-live="off">
                    <span className="auth-showcase__role">{slide.role}</span>
                    <strong className="auth-showcase__title">{slide.title}</strong>
                </div>

                <div className="auth-showcase__dots" role="tablist" aria-label="Escolher imagem">
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
            </div>
        </section>
    )
}

export default AuthShowcase
