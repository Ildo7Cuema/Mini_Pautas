/*
component-meta:
  name: PublicBrandMark
  description: Marca "A" (Angola) no canto superior direito das páginas públicas, com PNG de fundo transparente.
  responsive: true
*/

/** Logótipo decorativo fixo — topo direito; não intercepta cliques. */
export function PublicBrandMark() {
    return (
        <img
            src="/angola-letter-a-logo.png"
            alt=""
            aria-hidden="true"
            className="public-brand-mark"
            decoding="async"
            draggable={false}
        />
    )
}

export default PublicBrandMark
