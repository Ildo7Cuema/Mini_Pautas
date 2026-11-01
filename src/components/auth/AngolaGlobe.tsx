/*
component-meta:
  name: AngolaGlobe
  description: Globo com graticula animada (meridianos a "rodar") e o mapa de Angola (21 províncias) à frente. Usado como fundo (desktop/tablet) e em formato compacto (telemóvel).
  responsive: true
*/

import angolaProvincesSvg from '../../assets/angola-provinces.svg?raw'

const MERIDIANS = [0, 1, 2, 3, 4, 5, 6, 7]
const PARALLELS = [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75]

interface AngolaGlobeProps {
    /** `compact`: globo pequeno, em fluxo normal (telemóvel), sem posicionamento fixo. */
    variant?: 'background' | 'compact'
}

export function AngolaGlobe({ variant = 'background' }: AngolaGlobeProps) {
    return (
        <div className={`angola-globe ${variant === 'compact' ? 'angola-globe--compact' : ''}`} aria-hidden="true">
            <div className="angola-globe__shadow" />
            <div className="angola-globe__sphere">
                <svg className="angola-globe__graticule" viewBox="-100 -100 200 200" preserveAspectRatio="xMidYMid meet">
                    {PARALLELS.map((p) => {
                        const y = p * 100
                        const half = Math.sqrt(Math.max(0, 100 * 100 - y * y))
                        return <line key={p} x1={-half} y1={y} x2={half} y2={y} />
                    })}
                    {MERIDIANS.map((i) => (
                        <circle
                            key={i}
                            className="angola-globe__meridian"
                            cx="0"
                            cy="0"
                            r="99"
                            style={{ animationDelay: `${(-i * 44) / MERIDIANS.length}s` }}
                        />
                    ))}
                    <circle cx="0" cy="0" r="99" className="angola-globe__rim" />
                </svg>

                <div className="angola-globe__map">
                    <div className="angola-map-svg" dangerouslySetInnerHTML={{ __html: angolaProvincesSvg }} />
                </div>

                <div className="angola-globe__shade" />
                <div className="angola-globe__gloss" />
            </div>
        </div>
    )
}

export default AngolaGlobe
