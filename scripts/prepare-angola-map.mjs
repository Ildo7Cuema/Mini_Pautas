/*
 * Gera o mapa da República de Angola com a Divisão Político-Administrativa
 * de 2024 (21 províncias) a partir do SVG base ADM1 (18 províncias, Simplemaps).
 *
 * As 3 províncias novas são obtidas por divisão aproximada das antigas:
 *   Cuando Cubango -> Cubango (oeste)  + Cuando (leste)
 *   Moxico         -> Moxico (oeste)   + Moxico Leste (leste)
 *   Luanda         -> Luanda (litoral) + Icolo e Bengo (interior)
 *
 * Uso:  node scripts/prepare-angola-map.mjs [--inspect]
 */
import { readFileSync, writeFileSync } from 'fs'

const SRC = 'public/angola-provinces-base18.svg'
const OUT_PUBLIC = 'public/angola-provinces.svg'
const OUT_ASSET = 'src/assets/angola-provinces.svg'

const inspect = process.argv.includes('--inspect')

let svg = readFileSync(SRC, 'utf8')
svg = svg.replace(/viewbox=/i, 'viewBox=')

// ---------- parsing de paths (M/m/L/l/H/h/V/v/Z/z) ----------
function parsePath(d) {
  const tokens = d.match(/[MmLlHhVvZz]|-?\d*\.?\d+(?:e-?\d+)?/g) || []
  const subpaths = []
  let cur = []
  let cmd = null
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  let i = 0
  const num = () => parseFloat(tokens[i++])
  while (i < tokens.length) {
    const t = tokens[i]
    if (/[MmLlHhVvZz]/.test(t)) {
      cmd = t
      i++
      if (cmd === 'Z' || cmd === 'z') {
        if (cur.length) subpaths.push(cur)
        cur = []
        x = startX
        y = startY
        continue
      }
    }
    switch (cmd) {
      case 'M':
        x = num(); y = num(); startX = x; startY = y; cur.push([x, y]); cmd = 'L'; break
      case 'm':
        x += num(); y += num(); startX = x; startY = y; cur.push([x, y]); cmd = 'l'; break
      case 'L':
        x = num(); y = num(); cur.push([x, y]); break
      case 'l':
        x += num(); y += num(); cur.push([x, y]); break
      case 'H':
        x = num(); cur.push([x, y]); break
      case 'h':
        x += num(); cur.push([x, y]); break
      case 'V':
        y = num(); cur.push([x, y]); break
      case 'v':
        y += num(); cur.push([x, y]); break
      default:
        i++
    }
  }
  if (cur.length) subpaths.push(cur)
  return subpaths
}

function polygonArea(pts) {
  let a = 0
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % n]
    a += x1 * y2 - x2 * y1
  }
  return a / 2
}

function polygonCentroid(pts) {
  const a = polygonArea(pts)
  if (Math.abs(a) < 1e-9) {
    const s = pts.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
    return [s[0] / pts.length, s[1] / pts.length]
  }
  let cx = 0
  let cy = 0
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % n]
    const f = x1 * y2 - x2 * y1
    cx += (x1 + x2) * f
    cy += (y1 + y2) * f
  }
  return [cx / (6 * a), cy / (6 * a)]
}

function bbox(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
}

// Recorte de polígono por semi-plano (Sutherland–Hodgman, uma aresta)
// Mantém os pontos em que side(p) >= 0
function clipHalfPlane(pts, a, b) {
  const side = ([px, py]) => (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0])
  const out = []
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % n]
    const sp = side(p)
    const sq = side(q)
    if (sp >= 0) out.push(p)
    if ((sp >= 0) !== (sq >= 0)) {
      const t = sp / (sp - sq)
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t])
    }
  }
  return out
}

function mainRing(subpaths) {
  return subpaths.reduce((best, sp) => (Math.abs(polygonArea(sp)) > Math.abs(polygonArea(best)) ? sp : best), subpaths[0])
}

// ---------- extrair províncias ----------
const pathRe = /<path([^>]*?)\sd="([^"]+)"([^>]*)>\s*<\/path>|<path([^>]*?)\sd="([^"]+)"([^>]*)\/>/g
const provinces = []
let m
while ((m = pathRe.exec(svg)) !== null) {
  const attrs = (m[1] ?? m[4] ?? '') + (m[3] ?? m[6] ?? '')
  const d = m[2] ?? m[5]
  const id = (attrs.match(/\sid="([^"]+)"/) || [])[1]
  const name = (attrs.match(/\sname="([^"]+)"/) || [])[1]
  provinces.push({ id, name, d, subpaths: parsePath(d) })
}

if (inspect) {
  for (const p of provinces) {
    const ring = mainRing(p.subpaths)
    const bb = bbox(ring)
    const c = polygonCentroid(ring)
    console.log(p.id, p.name, 'bbox', bb.minX.toFixed(0), bb.minY.toFixed(0), bb.maxX.toFixed(0), bb.maxY.toFixed(0), 'centroid', c.map((v) => v.toFixed(0)).join(','))
  }
  process.exit(0)
}

// ---------- definição das divisões (coordenadas no viewBox 1000x1000) ----------
// Cada divisão: linha a->b; lado "left" (side<0) e "right" (side>=0) ficam com nomes/ids próprios
const SPLITS = {
  AOCCU: { // Cuando Cubango -> Cubango (oeste) | Cuando (leste)
    a: [660, 960], b: [625, 640],
    neg: { id: 'AOCUB', name: 'Cubango' },
    pos: { id: 'AOCUA', name: 'Cuando' },
  },
  AOMOX: { // Moxico -> Moxico (oeste) | Moxico Leste (leste)
    a: [760, 850], b: [735, 430],
    neg: { id: 'AOMOX', name: 'Moxico' },
    pos: { id: 'AOMXL', name: 'Moxico Leste' },
  },
  AOLUA: { // Luanda -> Luanda (litoral norte) | Icolo e Bengo (interior/sul)
    a: [175, 340], b: [230, 328],
    neg: { id: 'AOLUA', name: 'Luanda' },
    pos: { id: 'AOICB', name: 'Icolo e Bengo' },
  },
}

// Posições manuais de rótulos (províncias pequenas ou de forma irregular).
// pos: posição do texto; anchor: text-anchor; leader: desenha linha até ao centróide
const LABEL_OVERRIDES = {
  AOLUA: { pos: [168, 318], anchor: 'end', leader: true },
  AOICB: { pos: [168, 374], anchor: 'end', leader: true },
  AOBGO: { pos: [248, 292] },
  AOCAB: { pos: [150, 90] },
}

const fills = ['#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb']
const STROKE = '#1e3a8a'

const fmt = (v) => (Math.round(v * 10) / 10).toString()
const ptsToD = (pts) => 'M' + pts.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L') + 'z'

let colorIdx = 0
const regionEls = []
const borderEls = []
const labelEls = []
const names = []

function pushRegion(id, name, d, ringForLabel, opts = {}) {
  const fill = fills[colorIdx++ % fills.length]
  const fillOp = opts.highlight ? 0.55 : 0.42
  regionEls.push(
    `  <path class="angola-province" id="${id}" name="${name}" d="${d}" fill="${fill}" fill-opacity="${fillOp}" stroke="${STROKE}" stroke-opacity="0.85" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
  )
  const centroid = polygonCentroid(ringForLabel)
  const ov = LABEL_OVERRIDES[id]
  const c = ov?.pos ?? centroid
  const anchor = ov?.anchor ?? 'middle'
  const size = opts.small ? 15 : 19
  if (ov?.leader) {
    labelEls.push(
      `  <line class="angola-province-leader" x1="${fmt(c[0] + 4)}" y1="${fmt(c[1])}" x2="${fmt(centroid[0])}" y2="${fmt(centroid[1])}" stroke="#0f172a" stroke-opacity="0.6" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`
    )
  }
  labelEls.push(
    `  <text class="angola-province-label" x="${fmt(c[0])}" y="${fmt(c[1] + size * 0.35)}" font-size="${size}" text-anchor="${anchor}" font-family="Inter, 'Segoe UI', system-ui, sans-serif" font-weight="600" fill="#0f172a" fill-opacity="0.9" stroke="#ffffff" stroke-width="3" stroke-opacity="0.9" paint-order="stroke fill" stroke-linejoin="round">${name}</text>`
  )
  names.push(name)
}

for (const p of provinces) {
  const split = SPLITS[p.id]
  const ring = mainRing(p.subpaths)
  const small = ['AOLUA', 'AOCAB', 'AOICB'].includes(p.id)
  if (!split) {
    pushRegion(p.id, p.name, p.d, ring, { small, highlight: p.id === 'AOCAB' })
    continue
  }
  const { a, b, neg, pos } = split
  // lado positivo
  const posRing = clipHalfPlane(ring, a, b)
  // lado negativo (inverter a linha)
  const negRing = clipHalfPlane(ring, b, a)
  const extraNeg = p.subpaths.filter((sp) => sp !== ring).map(ptsToD).join('')
  pushRegion(neg.id, neg.name, ptsToD(negRing) + extraNeg, negRing, { small: neg.id === 'AOLUA', highlight: neg.id === 'AOLUA' })
  pushRegion(pos.id, pos.name, ptsToD(posRing), posRing, { small: pos.id === 'AOICB' })
  // fronteira nova (tracejada) — recortada à província original
  borderEls.push(
    `  <clipPath id="clip-${p.id}"><path d="${p.d}"/></clipPath>\n` +
      `  <line class="angola-province-newborder" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" clip-path="url(#clip-${p.id})" stroke="${STROKE}" stroke-opacity="0.85" stroke-width="1.6" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>`
  )
}

const out = `<?xml version="1.0"?>
<!-- Base ADM1: Simplemaps.com (Free for Commercial Use, https://simplemaps.com/resources/svg-license).
     Divisão Político-Administrativa de 2024 (21 províncias) aplicada por aproximação. -->
<svg class="angola-provinces-map" role="img" aria-label="Mapa da República de Angola com as 21 províncias" version="1.2" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
 <g id="features" class="angola-provinces">
${regionEls.join('\n')}
 </g>
 <g id="new-borders">
${borderEls.join('\n')}
 </g>
 <g id="labels" class="angola-province-labels">
${labelEls.join('\n')}
 </g>
</svg>
`

writeFileSync(OUT_PUBLIC, out)
writeFileSync(OUT_ASSET, out)
console.log('provinces', names.length)
console.log(names.join(', '))
console.log('bytes', Buffer.byteLength(out))
