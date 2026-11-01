/**
 * Questionário do Censo Escolar — ENSINO PRIMÁRIO GERAL
 *
 * Reprodução fiel do modelo oficial do MED/INE (7 páginas, A4 paisagem),
 * sem alterar a estrutura, ordem das secções, rótulos, colunas ou linhas.
 * Apenas são preenchidos os campos de dados (e os títulos dinâmicos:
 * ano lectivo, código/nome da escola, nome da instituição no rodapé).
 *
 * Coordenadas em pontos (pt), medidas directamente do PDF oficial.
 */
import jsPDF from 'jspdf'
import { imageUrlToBase64 } from '../../../utils/imageUtils'
import {
    CensoQuestionarioPayload,
    ContagemMF,
    DEFICIENCIAS_CENSO,
    LABELS_DEFICIENCIA,
    TipoDeficiencia,
} from '../types'
import { anoAnterior } from './censoAggregation'

type RGB = [number, number, number]

const BLUE: RGB = [51, 153, 255]
const ORANGE: RGB = [232, 96, 48]
const BAND: RGB = [193, 228, 245]
const GRAY: RGB = [242, 242, 242]
const BLACK: RGB = [0, 0, 0]
const WHITE: RGB = [255, 255, 255]
const BANNER_FILL: RGB = [240, 248, 253]
const DOT: RGB = [70, 70, 70]

/** Logomarcas oficiais (INE, Governo de Angola, MED, PATII, Banco Mundial) recortadas do modelo do MED. */
const LOGO_STRIP = '/censo-logos/branding/logo_header_oficial.png'
const TOTAL_PAGES = 7

const L = 43.1 // margem esquerda do conteúdo
const R = 812.8 // margem direita do conteúdo

const CLASSES = ['1ª Classe', '2ª Classe', '3ª Classe', '4ª Classe', '5ª Classe', '6ª Classe']
const PRAEER_ROWS = ['PRAEER ETAPA 1', 'PRAEER ETAPA 2', 'PRAEER ETAPA 3']
const PRAEER_APROV = ['PRAEER - Etapa 1', 'PRAEER - Etapa 2', 'PRAEER - Etapa 3']

type Style = 's' | 't' | 'd' // sólida fina | grossa | tracejada (pontilhada)

/* ------------------------------------------------------------------ */
/* Primitivas de desenho                                               */
/* ------------------------------------------------------------------ */

function fillRect(doc: jsPDF, x: number, y: number, w: number, h: number, color: RGB) {
    doc.setFillColor(...color)
    doc.rect(x, y, w, h, 'F')
}

function setStroke(doc: jsPDF, style: Style, color: RGB = BLACK) {
    doc.setDrawColor(...color)
    if (style === 'd') {
        doc.setLineWidth(0.5)
        doc.setDrawColor(...DOT)
        doc.setLineDashPattern([0.7, 1.4], 0)
    } else {
        doc.setLineWidth(style === 't' ? 1.1 : 0.6)
        doc.setLineDashPattern([], 0)
    }
}

function hLine(doc: jsPDF, x1: number, x2: number, y: number, style: Style = 's', color: RGB = BLACK) {
    setStroke(doc, style, color)
    doc.line(x1, y, x2, y)
    doc.setLineDashPattern([], 0)
}

function vLine(doc: jsPDF, x: number, y1: number, y2: number, style: Style = 's', color: RGB = BLACK) {
    setStroke(doc, style, color)
    doc.line(x, y1, x, y2)
    doc.setLineDashPattern([], 0)
}

function box(doc: jsPDF, x1: number, y1: number, x2: number, y2: number, style: Style = 't', color: RGB = BLACK) {
    setStroke(doc, style, color)
    doc.rect(x1, y1, x2 - x1, y2 - y1, 'S')
    doc.setLineDashPattern([], 0)
}

interface TxtOpts {
    size?: number
    bold?: boolean
    italic?: boolean
    color?: RGB
    align?: 'left' | 'center' | 'right'
    angle?: number
}

function setFont(doc: jsPDF, o: TxtOpts) {
    const style = o.bold && o.italic ? 'bolditalic' : o.bold ? 'bold' : o.italic ? 'italic' : 'normal'
    doc.setFont('helvetica', style)
    doc.setFontSize(o.size ?? 8)
    doc.setTextColor(...(o.color ?? BLACK))
}

function txt(doc: jsPDF, s: string, x: number, y: number, o: TxtOpts = {}) {
    setFont(doc, o)
    doc.text(s, x, y, { align: o.align ?? 'left', angle: o.angle })
    doc.setTextColor(0, 0, 0)
}

/** Texto (uma ou várias linhas) centrado verticalmente numa célula. */
function cellText(
    doc: jsPDF,
    lines: string[],
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    o: TxtOpts & { lineH?: number; dy?: number; pad?: number } = {}
) {
    const size = o.size ?? 8
    const lh = o.lineH ?? size * 1.4
    const align = o.align ?? 'center'
    const pad = o.pad ?? 4
    const cy = (y1 + y2) / 2 + (o.dy ?? 0)
    const x = align === 'center' ? (x1 + x2) / 2 : align === 'left' ? x1 + pad : x2 - pad
    const first = cy - ((lines.length - 1) * lh) / 2 + size * 0.34
    lines.forEach((ln, i) => txt(doc, ln, x, first + i * lh, { ...o, size, align }))
}

/** Texto rodado 90° (de baixo para cima) centrado numa célula. */
function cellTextVertical(doc: jsPDF, s: string, x1: number, y1: number, x2: number, y2: number, o: TxtOpts = {}) {
    const size = o.size ?? 7.5
    setFont(doc, { ...o, size })
    const w = doc.getTextWidth(s)
    const cx = (x1 + x2) / 2 + size * 0.34
    const cy = (y1 + y2) / 2 + w / 2
    doc.text(s, cx, cy, { angle: 90 })
    doc.setTextColor(0, 0, 0)
}

/** Reduz o tamanho da letra até o texto caber em maxW. */
function fitSize(doc: jsPDF, s: string, maxW: number, size: number, min = 5): number {
    let sz = size
    doc.setFontSize(sz)
    while (sz > min && doc.getTextWidth(s) > maxW) {
        sz -= 0.25
        doc.setFontSize(sz)
    }
    return sz
}

/** Desenha segmentos com estilos diferentes numa linha (alinhado à direita ou ao centro). */
function segments(
    doc: jsPDF,
    segs: { t: string; bold?: boolean; italic?: boolean }[],
    anchorX: number,
    y: number,
    size: number,
    align: 'center' | 'right' | 'left'
) {
    let total = 0
    for (const s of segs) {
        setFont(doc, { size, bold: s.bold, italic: s.italic })
        total += doc.getTextWidth(s.t)
    }
    let x = align === 'center' ? anchorX - total / 2 : align === 'right' ? anchorX - total : anchorX
    for (const s of segs) {
        setFont(doc, { size, bold: s.bold, italic: s.italic })
        doc.text(s.t, x, y)
        x += doc.getTextWidth(s.t)
    }
    doc.setTextColor(0, 0, 0)
}

/** Faixa de título de secção (azul claro, texto negro a negrito). */
function sectionBand(doc: jsPDF, title: string, x1: number, x2: number, y1: number, y2: number, baseline: number) {
    fillRect(doc, x1, y1, x2 - x1, y2 - y1, BAND)
    hLine(doc, x1, x2, y1 + 0.3, 'd')
    hLine(doc, x1, x2, y2 - 0.3, 'd')
    vLine(doc, x1 + 0.3, y1, y2, 'd')
    vLine(doc, x2 - 0.3, y1, y2, 'd')
    txt(doc, title, x1 + 3, baseline, { size: 8, bold: true })
}

function num(v: number | null | undefined, blankIfUndefined = true): string {
    if (v === null || v === undefined) return blankIfUndefined ? '' : '0'
    return String(v)
}

function sumMF(list: { M: number; F: number }[]): { M: number; F: number } {
    return list.reduce((a, r) => ({ M: a.M + r.M, F: a.F + r.F }), { M: 0, F: 0 })
}

/* ------------------------------------------------------------------ */
/* Cabeçalho, banner e rodapé comuns                                   */
/* ------------------------------------------------------------------ */

interface Ctx {
    p: CensoQuestionarioPayload
    logo: string | null
    modalidadeNome: string
    ano: string
}

function drawPageHeader(doc: jsPDF, ctx: Ctx) {
    if (ctx.logo) doc.addImage(ctx.logo, 'PNG', 40, 29, 318, 38)

    // Divisórias verticais
    vLine(doc, 559.7, 28.8, 66.9, 's')
    vLine(doc, 646, 28.8, 67.5, 's')

    txt(doc, 'QUESTIONÁRIO PARA', 553.5, 46.3, { size: 8.5, color: BLUE, align: 'right' })
    txt(doc, ctx.modalidadeNome.toUpperCase(), 553.5, 58.3, { size: 8.5, bold: true, color: BLUE, align: 'right' })
    txt(doc, 'CENSO ESCOLAR', 640.5, 46.3, { size: 8.5, bold: true, color: ORANGE, align: 'right' })
    txt(doc, ctx.ano, 640.5, 58.3, { size: 8.5, bold: true, color: ORANGE, align: 'right' })

    txt(doc, 'ID DO QUESTIONÁRIO', 651, 37, { size: 6.5, bold: true })
    box(doc, 658.8, 44.4, 811.9, 61.3, 's')
    const idq = ctx.p.cabecalho.id_questionario || ''
    if (idq) {
        const sz = fitSize(doc, idq, 811.9 - 658.8 - 8, 9, 6)
        txt(doc, idq, 663.8, 55.6, { size: sz })
    }
}

function drawPageFooter(doc: jsPDF, ctx: Ctx, page: number) {
    txt(doc, 'Nome da Instituição:', L, 559.3, { size: 9, bold: true })
    hLine(doc, 157, 590, 560.4, 'd')
    const nome = ctx.p.cabecalho.nome_instituicao || ''
    if (nome) {
        const sz = fitSize(doc, nome, 425, 8)
        txt(doc, nome, 160, 558.4, { size: sz })
    }
    txt(doc, `Página ${page} de ${TOTAL_PAGES}`, R, 559.3, { size: 9, align: 'right' })
}

/* ------------------------------------------------------------------ */
/* Página 1 — Identificação, 1. Infraestrutura, 2. Mobiliário          */
/* ------------------------------------------------------------------ */

function page1(doc: jsPDF, ctx: Ctx) {
    const { p } = ctx
    const infra = p.infraestrutura
    const infraAny = infra as unknown as Record<string, unknown> | undefined
    const infraTemDados =
        !!infra &&
        (!!infraAny?.id ||
            Object.entries(infraAny ?? {}).some(([k, v]) => !k.startsWith('mes_') && typeof v === 'number' && v > 0))

    // Aviso
    fillRect(doc, L, 71.5, R - L, 65.8, BANNER_FILL)
    box(doc, L, 71.5, R, 137.3, 's', BAND)
    const aviso =
        'LEIA ATENTAMENTE O MANUAL DE ORIENTAÇÃO ANTES DO PREENCHIMENTO DO QUESTIONÁRIO. ESTRITAMENTE CONFIDENCIAL.'
    const avisoSize = fitSize(doc, aviso, 705, 10.6, 6)
    txt(doc, aviso, 428, 112.3, { size: avisoSize, color: BLUE, align: 'center' })

    // Identificação
    const lab = (x1: number, x2: number, y1: number, y2: number, label: string) => {
        fillRect(doc, x1, y1, x2 - x1, y2 - y1, BLUE)
        txt(doc, label, x2 - 6, (y1 + y2) / 2 + 3.1, { size: 9, bold: true, color: WHITE, align: 'right' })
    }
    const val = (x1: number, x2: number, y1: number, y2: number, value: string) => {
        fillRect(doc, x1, y1, x2 - x1, y2 - y1, WHITE)
        box(doc, x1, y1, x2, y2, 's')
        if (value) {
            const sz = fitSize(doc, value, x2 - x1 - 8, 9, 6)
            txt(doc, value, x1 + 4, (y1 + y2) / 2 + 3.1, { size: sz })
        }
    }

    lab(L, 198.4, 139.4, 157.5, 'CÓDIGO DA ESCOLA')
    val(198.4, 586, 139.4, 157.5, p.cabecalho.codigo_escola_med || '')
    fillRect(doc, 586, 139.4, R - 586, 18.1, BLUE)

    lab(L, 198.4, 157.5, 176.3, 'NOME DA INSTITUIÇÃO')
    val(198.4, 813.1, 157.5, 176.3, p.cabecalho.nome_instituicao || '')

    lab(L, 198.4, 176.3, 201.3, 'ANO LECTIVO')
    val(198.4, 315.3, 176.3, 201.3, ctx.ano)
    lab(315.3, 453.9, 176.3, 201.3, 'MÊS DE INÍCIO')
    val(453.9, 586, 176.3, 201.3, num(infra?.mes_inicio ?? p.cabecalho.mes_inicio))
    lab(586, 693.5, 176.3, 201.3, 'MÊS DE TÉRMINO')
    val(693.5, 813.1, 176.3, 201.3, num(infra?.mes_termino ?? p.cabecalho.mes_termino))

    // 1. Infraestrutura
    sectionBand(doc, '1. INFRAESTRUTURA DE SUPORTE DISPONÍVEL NA ESCOLA', L, 811.9, 210.6, 228.4, 223.3)
    const xs1 = [L, 196.9, 350.6, 504.4, 658.1, 811.9]
    const hY1 = 228.8
    const hB1 = 271.3
    const bB1 = 303.1
    fillRect(doc, L, hY1, 811.9 - L, hB1 - hY1, GRAY)
    const heads1 = [
        ['Total de Salas de aula'],
        ['Número de Salas de aula', '(próprias)'],
        ['Número de Salas de aula', '(emprestadas)'],
        ['Número de Salas de aula', '(arrendadas)'],
        ['Número de Salas de aula', '(próprias) em bom estado'],
    ]
    const vals1 = infra && infraTemDados
        ? [
              infra.total_salas,
              infra.salas_proprias,
              infra.salas_emprestadas,
              infra.salas_arrendadas,
              infra.salas_proprias_bom_estado,
          ]
        : []
    heads1.forEach((h, i) => {
        cellText(doc, h, xs1[i], hY1, xs1[i + 1], hB1, { size: 8, bold: true, lineH: 12 })
        if (vals1[i] !== undefined) {
            cellText(doc, [String(vals1[i])], xs1[i], hB1, xs1[i + 1], bB1, { size: 9 })
        }
    })
    for (let i = 1; i < xs1.length - 1; i++) {
        vLine(doc, xs1[i], hY1, hB1, 's')
        vLine(doc, xs1[i], hB1, bB1, 'd')
    }
    hLine(doc, L, 811.9, hB1, 's')
    box(doc, L, hY1, 811.9, bB1, 't')

    // 2. Mobiliário
    sectionBand(
        doc,
        '2. MOBILIÁRIO DAS SALAS DE AULA (ASSENTOS, MESAS E QUADROS DIDÁCTICOS)  DISPONÍVEL NA ESCOLA',
        L,
        812.5,
        313.8,
        328,
        324.9
    )
    const xs2 = [L, 139.4, 235.6, 332.2, 428.4, 520.6, 620.6, 713.4, 813.1]
    const hY2 = 327.8
    const hB2 = 383.8
    const bB2 = 418.2
    fillRect(doc, L, hY2, 813.1 - L, hB2 - hY2, GRAY)
    const heads2 = [
        ['Total de assentos'],
        ['Número de', 'assentos em bom', 'estado'],
        ['Número de', 'assentos', 'acessíveis e', 'reguláveis'],
        ['Total de mesas'],
        ['Número de mesas', 'em bom estado'],
        ['Número de mesas', 'acessíveis e', 'reguláveis'],
        ['Total de quadros', 'didácticos'],
        ['Número de quadros', 'didácticos em bom', 'estado'],
    ]
    const vals2 = infra && infraTemDados
        ? [
              infra.total_assentos,
              infra.assentos_bom_estado,
              infra.assentos_acessiveis,
              infra.total_mesas,
              infra.mesas_bom_estado,
              infra.mesas_acessiveis,
              infra.total_quadros,
              infra.quadros_bom_estado,
          ]
        : []
    heads2.forEach((h, i) => {
        cellText(doc, h, xs2[i], hY2, xs2[i + 1], hB2, { size: 8, bold: true, lineH: 11 })
        if (vals2[i] !== undefined) {
            cellText(doc, [String(vals2[i])], xs2[i], hB2, xs2[i + 1], bB2, { size: 9 })
        }
    })
    for (let i = 1; i < xs2.length - 1; i++) {
        vLine(doc, xs2[i], hY2, hB2, 's')
        vLine(doc, xs2[i], hB2, bB2, 'd')
    }
    hLine(doc, L, 813.1, hB2, 's')
    box(doc, L, hY2, 813.1, bB2, 't')
}

/* ------------------------------------------------------------------ */
/* Página 2 — 3. Manuais, 4. Matrículas/turmas por turno               */
/* ------------------------------------------------------------------ */

function page2(doc: jsPDF, ctx: Ctx) {
    const { p } = ctx

    /* 3. Manuais (sem fonte de dados no sistema: campos em branco) */
    sectionBand(
        doc,
        '3. NÚMERO DE MANUAIS PARA PROFESSORES E ALUNOS POR  CLASSE/ETAPA E DISCIPLINA DISPONÍVEIS NA ESCOLA',
        L,
        812.5,
        71.9,
        85.6,
        82.4
    )
    const cw = (744.65 - 198.8) / 9
    const xs3: number[] = [L, 128.2, 198.8]
    for (let i = 1; i <= 9; i++) xs3.push(198.8 + cw * i)
    xs3.push(812.8)
    const top3 = 86.3
    const hA3 = 103.1
    const hB3 = 141.6
    const rows3 = [141.6, 158.8, 175.9, 192.8, 209.7, 229.0, 248.8, 266.0, 283.1]
    const x744 = xs3[11]

    fillRect(doc, L, top3, 198.8 - L, rows3[8] - top3, GRAY)
    fillRect(doc, 198.8, top3, 812.8 - 198.8, hB3 - top3, GRAY)

    cellText(doc, ['Manuais'], L, top3, 128.2, hB3, { size: 8, bold: true })
    cellText(doc, ['Beneficiário'], 128.2, top3, 198.8, hB3, { size: 8, bold: true })
    cellText(doc, ['Classes/Etapas'], 198.8, top3, x744, hA3, { size: 8, bold: true })
    const classHeads = [
        ['1ª', 'Classe'],
        ['2ª', 'Classe'],
        ['3ª', 'Classe'],
        ['4ª', 'Classe'],
        ['5ª', 'Classe'],
        ['6ª', 'Classe'],
        ['PRAEER -', 'Etapa 1'],
        ['PRAEER -', 'Etapa 2'],
        ['PRAEER -', 'Etapa 3'],
    ]
    classHeads.forEach((h, i) => {
        cellText(doc, h, xs3[2 + i], hA3, xs3[3 + i], hB3, { size: 8, bold: true, lineH: 12 })
    })
    cellText(doc, ['TOTAL'], x744, top3, 812.8, hB3, { size: 9, bold: true })

    const grupos = [
        { nome: ['Matemática'], y1: rows3[0], y2: rows3[2], mid: rows3[1] },
        { nome: ['Língua', 'portuguesa'], y1: rows3[2], y2: rows3[4], mid: rows3[3] },
        { nome: ['Manuais', 'transcritos em', 'braille'], y1: rows3[4], y2: rows3[6], mid: rows3[5] },
        { nome: ['Outros'], y1: rows3[6], y2: rows3[8], mid: rows3[7] },
    ]
    grupos.forEach(g => {
        cellText(doc, g.nome, L, g.y1, 128.2, g.y2, { size: 8, bold: true, lineH: 11 })
        cellText(doc, ['Professor'], 128.2, g.y1, 198.8, g.mid, { size: 8, bold: true })
        cellText(doc, ['Aluno'], 128.2, g.mid, 198.8, g.y2, { size: 8, bold: true })
        hLine(doc, 128.2, 812.8, g.mid, 'd')
    })

    // linhas verticais
    vLine(doc, 128.2, top3, rows3[8], 't')
    vLine(doc, 198.8, top3, rows3[8], 't')
    vLine(doc, x744, top3, rows3[8], 't')
    for (let i = 3; i <= 10; i++) {
        vLine(doc, xs3[i], hA3, hB3, 's')
        vLine(doc, xs3[i], hB3, rows3[8], 'd')
    }
    hLine(doc, 198.8, x744, hA3, 's')
    hLine(doc, L, 812.8, hB3, 's')
    ;[rows3[2], rows3[4], rows3[6]].forEach(y => hLine(doc, L, 812.8, y, 's'))
    box(doc, L, top3, 812.8, rows3[8], 't')

    /* 4. Matrículas e turmas por classe/etapa e turno */
    sectionBand(doc, '4. NÚMERO DE MATRÍCULAS, TURMAS POR CLASSE/ETAPA E TURNO', L, 813.1, 290, 305.6, 301.5)
    const g4 = [141.9, 208.0, 274.0, 340.2, 405.8, 472.0, 537.8, 603.8, 669.7, 733.8]
    const xT = 813.5
    const y4 = [305.6, 345.4, 380.8, 393.8, 420.9, 447.8, 473.1]

    fillRect(doc, L, y4[0], 141.9 - L, y4[6] - y4[0], GRAY)
    fillRect(doc, 141.9, y4[0], xT - 141.9, y4[1] - y4[0], GRAY)

    cellText(doc, ['Classes/Etapas'], L, y4[0], 141.9, y4[1], { size: 8, bold: true })
    cellText(doc, ['Turno'], L, y4[1], 141.9, y4[3], { size: 8, bold: true })
    cellText(doc, ['Número de', 'matrículas'], L, y4[3], 141.9, y4[4], { size: 8, bold: true, lineH: 11 })
    cellText(doc, ['Total de', 'turmas'], L, y4[4], 141.9, y4[5], { size: 8, bold: true, lineH: 11 })
    cellText(doc, ['(Das quais) Número de', 'turmas ao ar livre'], L, y4[5], 141.9, y4[6], {
        size: 7.5,
        bold: true,
        lineH: 10.5,
    })

    const mat = new Map<string, { matriculas: number; turmas: number; ar: number }>()
    for (const r of p.matriculas_classe_turno) {
        mat.set(`${r.classe}|${r.turno}`, {
            matriculas: r.matriculas,
            turmas: r.turmas,
            ar: r.turmas_ar_livre,
        })
    }
    const hasMat = p.matriculas_classe_turno.length > 0
    const totTurno = {
        manhã: { matriculas: 0, turmas: 0, ar: 0 },
        tarde: { matriculas: 0, turmas: 0, ar: 0 },
    }

    const turnos: ('manhã' | 'tarde')[] = ['manhã', 'tarde']
    for (let g = 0; g < 9; g++) {
        const gx1 = g4[g]
        const gx2 = g4[g + 1]
        const mid = (gx1 + gx2) / 2
        const classe = g < 6 ? CLASSES[g] : null
        cellText(
            doc,
            g < 6 ? [`${g + 1}ª`, 'Classe'] : ['PRAEER -', `Etapa ${g - 5}`],
            gx1,
            y4[0],
            gx2,
            y4[1],
            { size: 8, bold: true, lineH: 12 }
        )
        turnos.forEach((t, k) => {
            const sx1 = k === 0 ? gx1 : mid
            const sx2 = k === 0 ? mid : gx2
            cellTextVertical(doc, t === 'manhã' ? 'Manhã' : 'Tarde', sx1, y4[1], sx2, y4[2], { size: 7.5, bold: true })
            // caixa de selecção do turno
            const cx = (sx1 + sx2) / 2
            const cy = (y4[2] + y4[3]) / 2
            const rec = classe ? mat.get(`${classe}|${t}`) : undefined
            setStroke(doc, 's')
            doc.rect(cx - 2.6, cy - 2.6, 5.2, 5.2, 'S')
            if (rec && rec.turmas > 0) {
                doc.setLineWidth(0.8)
                doc.line(cx - 1.8, cy - 1.8, cx + 1.8, cy + 1.8)
                doc.line(cx - 1.8, cy + 1.8, cx + 1.8, cy - 1.8)
            }
            if (rec) {
                cellText(doc, [String(rec.matriculas)], sx1, y4[3], sx2, y4[4], { size: 8 })
                cellText(doc, [String(rec.turmas)], sx1, y4[4], sx2, y4[5], { size: 8 })
                cellText(doc, [String(rec.ar)], sx1, y4[5], sx2, y4[6], { size: 8 })
                totTurno[t].matriculas += rec.matriculas
                totTurno[t].turmas += rec.turmas
                totTurno[t].ar += rec.ar
            } else if (classe && hasMat) {
                cellText(doc, ['0'], sx1, y4[3], sx2, y4[4], { size: 8 })
                cellText(doc, ['0'], sx1, y4[4], sx2, y4[5], { size: 8 })
                cellText(doc, ['0'], sx1, y4[5], sx2, y4[6], { size: 8 })
            }
            vLine(doc, mid, y4[1], y4[6], 'd')
        })
    }
    // TOTAL
    {
        const mid = (g4[9] + xT) / 2
        cellText(doc, ['TOTAL'], g4[9], y4[0], xT, y4[1], { size: 8, bold: true })
        turnos.forEach((t, k) => {
            const sx1 = k === 0 ? g4[9] : mid
            const sx2 = k === 0 ? mid : xT
            cellTextVertical(doc, t === 'manhã' ? 'Manhã' : 'Tarde', sx1, y4[1], sx2, y4[3], { size: 7.5 })
            if (hasMat) {
                cellText(doc, [String(totTurno[t].matriculas)], sx1, y4[3], sx2, y4[4], { size: 8 })
                cellText(doc, [String(totTurno[t].turmas)], sx1, y4[4], sx2, y4[5], { size: 8 })
                cellText(doc, [String(totTurno[t].ar)], sx1, y4[5], sx2, y4[6], { size: 8 })
            }
        })
        vLine(doc, mid, y4[1], y4[6], 'd')
    }

    // grelha da tabela 4
    const allX4 = [141.9, ...g4.slice(1), xT]
    allX4.forEach((x, i) => {
        if (i === 0) return
        vLine(doc, x, y4[0], y4[1], 's')
        vLine(doc, x, y4[1], y4[6], i === 1 || i === allX4.length - 1 ? 's' : 'd')
    })
    vLine(doc, 141.9, y4[0], y4[6], 't')
    vLine(doc, g4[9], y4[0], y4[6], 't')
    hLine(doc, L, xT, y4[1], 's')
    hLine(doc, L, g4[9], y4[2], 'd')
    hLine(doc, L, g4[9], y4[3], 't')
    hLine(doc, L, xT, y4[4], 's')
    hLine(doc, L, xT, y4[5], 's')
    box(doc, L, y4[0], xT, y4[6], 't')

    // Legenda: TURNOS / HORÁRIOS DOS TURNOS / TURMA
    const legendY1 = 481.5
    const legendHead = 14
    const legendY2 = 538
    const boxes: [number, number, string][] = [
        [L, 162.5, 'TURNOS'],
        [182.5, 614.3, 'HORÁRIOS DOS TURNOS'],
        [634.5, 812.8, 'TURMA'],
    ]
    boxes.forEach(([x1, x2, title]) => {
        fillRect(doc, x1, legendY1, x2 - x1, legendHead, GRAY)
        box(doc, x1, legendY1, x2, legendY2, 'd')
        hLine(doc, x1, x2, legendY1 + legendHead, 'd')
        txt(doc, title, (x1 + x2) / 2, legendY1 + 10, { size: 8, bold: true, align: 'center' })
    })
    const midTurnos = (L + 162.5) / 2
    txt(doc, 'Período de funcionamento', midTurnos, 514.3, { size: 7.5, align: 'center' })
    txt(doc, 'das turmas.', midTurnos, 526.3, { size: 7.5, align: 'center' })

    const midHor = (182.5 + 614.3) / 2
    segments(
        doc,
        [
            { t: 'Manhã', bold: true },
            { t: ': aulas com maior concentração no período da manhã (das ' },
            { t: '08h00', bold: true },
            { t: ' às ' },
            { t: '12h00', bold: true },
            { t: ')' },
        ],
        midHor,
        514.3,
        7.5,
        'center'
    )
    segments(
        doc,
        [
            { t: 'Tarde', bold: true },
            { t: ': aulas com maior concentração no período da tarde (das ' },
            { t: '13h00', bold: true },
            { t: ' às ' },
            { t: '18h00', bold: true },
            { t: ')' },
        ],
        midHor,
        526.3,
        7.5,
        'center'
    )

    const midTurma = (634.5 + 812.8) / 2
    txt(doc, 'Grupo de alunos ensinados pelo mesmo', midTurma, 508.3, { size: 7.5, align: 'center' })
    txt(doc, 'Professor, ao mesmo tempo e na mesma', midTurma, 520.3, { size: 7.5, align: 'center' })
    txt(doc, 'classe ou etapa.', midTurma, 532.3, { size: 7.5, align: 'center' })
}

/* ------------------------------------------------------------------ */
/* Página 3 — 5. Matrículas por classe/etapa, idade e sexo             */
/* ------------------------------------------------------------------ */

function page3(doc: jsPDF, ctx: Ctx) {
    const { p } = ctx
    sectionBand(doc, '5. NÚMERO DE MATRÍCULAS POR CLASSE/ETAPA, IDADE E SEXO', L, 813.1, 72.5, 86, 85.4)

    const idade = new Map<string, { M: number; F: number }>()
    for (const r of p.matriculas_idade) {
        idade.set(`${r.classe}|${r.faixa_etaria}`, { M: r.M, F: r.F })
    }
    const hasIdade = p.matriculas_idade.length > 0

    const part1 = [
        'Menos de 6 anos',
        '6 anos',
        '7 anos',
        '8 anos',
        '9 anos',
        '10 anos',
        '11 anos',
        '12 anos',
    ]
    const part2 = ['13 anos', '14 anos', '15 a 19 anos', '20 a 24 anos', 'Mais de 24 anos', 'Idade não especificada']
    const part2Label = [
        ['13 anos'],
        ['14 anos'],
        ['15 a 19 anos'],
        ['20 a 24 anos'],
        ['Mais de 24', 'anos'],
        ['Idade não', 'especificada'],
    ]

    const rowLabels = [...CLASSES, ...PRAEER_ROWS, 'TOTAL']
    const rowH = 16.25
    const colTotals: Record<string, { M: number; F: number }> = {}
    const rowTotals: { M: number; F: number }[] = CLASSES.map(() => ({ M: 0, F: 0 }))

    const cellVal = (classe: string, faixa: string) => idade.get(`${classe}|${faixa}`) || { M: 0, F: 0 }

    // Pré-cálculo de totais por classe e por coluna
    CLASSES.forEach((c, ci) => {
        ;[...part1, ...part2].forEach(f => {
            const v = cellVal(c, f)
            rowTotals[ci].M += v.M
            rowTotals[ci].F += v.F
            const k = f
            colTotals[k] = colTotals[k] || { M: 0, F: 0 }
            colTotals[k].M += v.M
            colTotals[k].F += v.F
        })
    })
    const grandTotal = sumMF(rowTotals)

    const drawPart = (
        faixas: string[],
        headLabels: string[][] | null,
        partLabel: string,
        xs: number[],
        yTop: number,
        yA: number,
        yB: number,
        withTotal: boolean
    ) => {
        const yRows = yB
        const yEnd = yRows + rowH * rowLabels.length
        // cabeçalho
        fillRect(doc, L, yTop, xs[xs.length - 1] - L, yB - yTop, GRAY)
        txt(doc, `(${partLabel})`, (L + xs[0]) / 2, yTop + 19, { size: 6.5, italic: true, align: 'center' })
        txt(doc, 'Classe', (L + xs[0]) / 2, yTop + 31, { size: 8, bold: true, align: 'center' })

        faixas.forEach((f, i) => {
            const x1 = xs[i]
            const x2 = xs[i + 1]
            const lines = headLabels ? headLabels[i] : [f]
            cellText(doc, lines, x1, yTop, x2, yA, { size: 8, bold: true, lineH: 12 })
            cellText(doc, ['M'], x1, yA, (x1 + x2) / 2, yB, { size: 8, bold: true })
            cellText(doc, ['F'], (x1 + x2) / 2, yA, x2, yB, { size: 8, bold: true })
        })
        if (withTotal) {
            const x1 = xs[faixas.length]
            const x2 = xs[faixas.length + 1]
            const x3 = xs[faixas.length + 2]
            cellText(doc, ['TOTAL', '(1ª + 2ª) Parte'], x1, yTop, x3, yA, { size: 8, bold: true, lineH: 11 })
            cellText(doc, ['M'], x1, yA, x2, yB, { size: 8, bold: true })
            cellText(doc, ['F'], x2, yA, x3, yB, { size: 8, bold: true })
        }

        // linhas
        rowLabels.forEach((label, r) => {
            const y1 = yRows + rowH * r
            const y2 = y1 + rowH
            cellText(doc, [label], L, y1, xs[0], y2, { size: 6.8, bold: true })
            const isTotal = label === 'TOTAL'
            const ci = r < 6 ? r : -1
            faixas.forEach((f, i) => {
                const x1 = xs[i]
                const x2 = xs[i + 1]
                const mid = (x1 + x2) / 2
                if (!hasIdade) return
                if (isTotal) {
                    const v = colTotals[f] || { M: 0, F: 0 }
                    cellText(doc, [String(v.M)], x1, y1, mid, y2, { size: 7.5, bold: true })
                    cellText(doc, [String(v.F)], mid, y1, x2, y2, { size: 7.5, bold: true })
                } else if (ci >= 0) {
                    const v = cellVal(CLASSES[ci], f)
                    cellText(doc, [String(v.M)], x1, y1, mid, y2, { size: 7.5 })
                    cellText(doc, [String(v.F)], mid, y1, x2, y2, { size: 7.5 })
                }
            })
            if (withTotal && hasIdade) {
                const x1 = xs[faixas.length]
                const x2 = xs[faixas.length + 1]
                const x3 = xs[faixas.length + 2]
                if (isTotal) {
                    cellText(doc, [String(grandTotal.M)], x1, y1, x2, y2, { size: 7.5, bold: true })
                    cellText(doc, [String(grandTotal.F)], x2, y1, x3, y2, { size: 7.5, bold: true })
                } else if (ci >= 0) {
                    cellText(doc, [String(rowTotals[ci].M)], x1, y1, x2, y2, { size: 7.5 })
                    cellText(doc, [String(rowTotals[ci].F)], x2, y1, x3, y2, { size: 7.5 })
                }
            }
            // separador de linha
            hLine(doc, L, xs[xs.length - 1], y1, 's')
        })
        hLine(doc, xs[0], xs[xs.length - 1], yA, 's', BLACK)
        // verticais
        const last = xs[xs.length - 1]
        vLine(doc, xs[0], yTop, yEnd, 't')
        xs.forEach((x, i) => {
            if (i === 0 || i === xs.length - 1) return
            const isGroupEdge = i <= faixas.length
            if (!(withTotal && i === faixas.length + 1)) vLine(doc, x, yTop, yA, 's')
            vLine(doc, x, yA, yEnd, isGroupEdge ? 's' : 'd')
        })
        // divisórias M|F
        faixas.forEach((_f, i) => {
            const mid = (xs[i] + xs[i + 1]) / 2
            vLine(doc, mid, yA, yEnd, 'd')
        })
        box(doc, L, yTop, last, yEnd, 't')
        return yEnd
    }

    // Parte 1
    const xs1: number[] = [135.3, 220.5, 304.7, 389.4, 473.7, 558.8, 643.4, 728.4, 813.1]
    drawPart(part1, null, '1ª. Parte', xs1, 87.5, 110.4, 127.5, false)

    // Faixa cinzenta entre partes
    fillRect(doc, L, 290.6, 813.1 - L, 11.3, GRAY)
    hLine(doc, L, 813.1, 290.9, 'd')
    hLine(doc, L, 813.1, 301.6, 'd')

    // Parte 2
    const xs2: number[] = [135.3, 220.5, 304.7, 389.4, 473.7, 558.8, 642.8, 727.8, 813.1]
    // 6 grupos de idade + coluna TOTAL (M | F)
    drawPart(part2, part2Label, '2ª. Parte', xs2, 301.9, 330, 347.5, true)

    // TOTAL GERAL
    const yg1 = 518.1
    const yg2 = 537
    fillRect(doc, L, yg1, 726.3 - L, yg2 - yg1, GRAY)
    segments(
        doc,
        [
            { t: 'TOTAL GERAL ', bold: true },
            { t: '(1ª. + 2ª.)', italic: true },
            { t: ' Parte (M+F)', bold: true },
        ],
        722,
        yg1 + 11.6,
        7.5,
        'right'
    )
    box(doc, 726.3, yg1, 813.1, yg2, 't')
    if (hasIdade) cellText(doc, [String(grandTotal.M + grandTotal.F)], 726.3, yg1, 813.1, yg2, { size: 8, bold: true })
    hLine(doc, L, 726.3, yg1, 's')
    hLine(doc, L, 726.3, yg2, 's')
    vLine(doc, L, yg1, yg2, 'd')
}

/* ------------------------------------------------------------------ */
/* Página 4 — 6. Informações 1ª Classe, 7. Deficiência                 */
/* ------------------------------------------------------------------ */

function page4(doc: jsPDF, ctx: Ctx) {
    const { p } = ctx
    const RX = 806.3

    sectionBand(doc, '6. INFORMAÇÕES ESPECÍFICAS SOBRE A 1ª CLASSE', L, RX, 74.4, 89.4, 87.6)

    // Linhas de informação (campos para preenchimento manual: sem fonte de dados no sistema)
    const rowsInfo = [
        { y1: 90.6, y2: 105.6, label: 'Total de vagas disponibilizadas para a 1ª Classe', mf: false },
        { y1: 105.6, y2: 120.9, label: 'Total de alunos matriculados pela primeira vez na 1ª classe', mf: true },
        {
            y1: 120.9,
            y2: 136.9,
            label: '(Dos quais) Número de alunos matriculados pela primeira vez e que frequentaram o Ensino Pré-Escolar?',
            mf: true,
        },
    ]
    rowsInfo.forEach(r => {
        txt(doc, r.label, L + 3, (r.y1 + r.y2) / 2 + 2.6, { size: 7.5, bold: true })
        hLine(doc, L, 523.8, r.y2, 'd')
        if (!r.mf) {
            box(doc, 523.8, r.y1, 647.5, r.y2, 's')
            fillRect(doc, 647.5, r.y1 + 0.3, RX - 647.5, r.y2 - r.y1 - 0.6, GRAY)
        } else {
            txt(doc, 'M', 569, (r.y1 + r.y2) / 2 + 2.8, { size: 7.5, bold: true, align: 'right' })
            box(doc, 571.6, r.y1, 646.2, r.y2, 's')
            txt(doc, 'F', 676.5, (r.y1 + r.y2) / 2 + 2.8, { size: 7.5, bold: true, align: 'right' })
            box(doc, 679.1, r.y1, 752.2, r.y2, 's')
        }
    })

    sectionBand(doc, '7. NÚMERO DE MATRÍCULAS POR CLASSE/ETAPA, TIPO DE DEFICIÊNCIA E SEXO', L, RX, 136.9, 153.8, 151.3)

    const xs = [184.4, 246.3, 308.4, 370.3, 432.2, 494.1, 556, 618.1, 682.2, 739.7, 807.2]
    const typeX2 = 155.9
    const yTop = 153.8
    const yA = 166.3
    const yH = 203.8
    const rowH = (493.8 - 204.4) / 11

    fillRect(doc, L, yTop, 807.2 - L, yH - yTop, GRAY)
    cellText(doc, ['Tipos de deficiência/Sexo'], L, yTop, 184.4, yH, { size: 8, bold: true })
    cellText(doc, ['Classe/Etapa'], 184.4, yTop, 739.7, yA, { size: 8, bold: true })
    const heads = [
        ['1ª', 'Classe'],
        ['2ª', 'Classe'],
        ['3ª', 'Classe'],
        ['4ª', 'Classe'],
        ['5ª', 'Classe'],
        ['6ª', 'Classe'],
        ['PRAEER', 'Etapa 1'],
        ['PRAEER', 'Etapa 2'],
        ['PRAEER', 'Etapa 3'],
    ]
    heads.forEach((h, i) => cellText(doc, h, xs[i], yA, xs[i + 1], yH, { size: 8, bold: true, lineH: 12 }))
    cellText(doc, ['TOTAL'], 739.7, yTop, 807.2, yH, { size: 8, bold: true })

    // dados
    const def = new Map<string, { M: number; F: number }>()
    for (const r of p.matriculas_deficiencia) {
        if (r.tipo_deficiencia === 'nenhuma') continue
        def.set(`${r.classe}|${r.tipo_deficiencia}`, { M: r.M, F: r.F })
    }
    const hasDef = p.matriculas_deficiencia.length > 0
    const types: TipoDeficiencia[] = DEFICIENCIAS_CENSO
    const colTot = CLASSES.map(() => ({ M: 0, F: 0 }))
    let grand = 0

    const drawRowLabel = (label: string, y1: number, y2: number) => {
        fillRect(doc, L, y1, typeX2 - L, y2 - y1, GRAY)
        cellText(doc, [label], L, y1, typeX2, y2, { size: 8, bold: true })
        fillRect(doc, typeX2, y1, 184.4 - typeX2, y2 - y1, GRAY)
        const mid = (y1 + y2) / 2
        txt(doc, 'M', 170.2, (y1 + mid) / 2 + 2.6, { size: 7.5, bold: true, align: 'center' })
        txt(doc, 'F', 170.2, (mid + y2) / 2 + 2.6, { size: 7.5, bold: true, align: 'center' })
    }

    const rowsList: (TipoDeficiencia | 'TOTAL')[] = [...types, 'TOTAL']
    rowsList.forEach((t, r) => {
        const y1 = 204.4 + rowH * r
        const y2 = y1 + rowH
        const mid = (y1 + y2) / 2
        drawRowLabel(t === 'TOTAL' ? 'TOTAL' : LABELS_DEFICIENCIA[t], y1, y2)
        let rowM = 0
        let rowF = 0
        CLASSES.forEach((c, ci) => {
            const x1 = xs[ci]
            const x2 = xs[ci + 1]
            if (!hasDef) return
            let v: { M: number; F: number }
            if (t === 'TOTAL') v = colTot[ci]
            else {
                v = def.get(`${c}|${t}`) || { M: 0, F: 0 }
                colTot[ci].M += v.M
                colTot[ci].F += v.F
            }
            rowM += v.M
            rowF += v.F
            cellText(doc, [String(v.M)], x1, y1, x2, mid, { size: 7.5, bold: t === 'TOTAL' })
            cellText(doc, [String(v.F)], x1, mid, x2, y2, { size: 7.5, bold: t === 'TOTAL' })
        })
        if (hasDef) {
            cellText(doc, [String(rowM)], 739.7, y1, 807.2, mid, { size: 7.5, bold: true })
            cellText(doc, [String(rowF)], 739.7, mid, 807.2, y2, { size: 7.5, bold: true })
            if (t === 'TOTAL') grand = rowM + rowF
        }
        hLine(doc, typeX2, 807.2, mid, 'd')
        hLine(doc, L, 807.2, y1, r === 0 ? 's' : 's')
    })
    const yEnd = 204.4 + rowH * rowsList.length // 494.4 aprox.

    // verticais
    vLine(doc, typeX2, yH, yEnd, 's')
    vLine(doc, 184.4, yTop, yEnd, 't')
    xs.forEach((x, i) => {
        if (i === 0 || i === xs.length - 1) return
        vLine(doc, x, yA, yH, 's')
        vLine(doc, x, yH, yEnd, 'd')
    })
    vLine(doc, 739.7, yTop, yEnd, 't')
    hLine(doc, 184.4, 739.7, yA, 's')
    hLine(doc, L, 807.2, yH, 's')
    box(doc, L, yTop, 807.2, yEnd, 't')

    // TOTAL GERAL (M+F)
    const yg1 = yEnd
    const yg2 = 518.1
    fillRect(doc, L, yg1, 739.7 - L, yg2 - yg1, GRAY)
    txt(doc, 'TOTAL  GERAL (M+F)', 735, yg1 + 12.6, { size: 7.5, bold: true, align: 'right' })
    box(doc, 739.7, yg1, 807.2, yg2, 't')
    if (hasDef) cellText(doc, [String(grand)], 739.7, yg1, 807.2, yg2, { size: 8, bold: true })
    hLine(doc, L, 739.7, yg2, 'd')
    vLine(doc, L, yg1, yg2, 'd')
}

/* ------------------------------------------------------------------ */
/* Página 5 — 8. Professores por nível académico, 9. Qualificação      */
/* ------------------------------------------------------------------ */

function page5(doc: jsPDF, ctx: Ctx) {
    const { p } = ctx

    sectionBand(doc, '8. NÚMERO DE PROFESSORES FRENTE AO ALUNO POR NÍVEL ACADÉMICO E SEXO', L, 812.5, 81.3, 95, 91.5)

    const xs8 = [166.9, 247.2, 327.2, 407.2, 487.2, 567.2, 646.9, 727, 812.8]
    const heads8: string[][] = [
        ['< I Ciclo Ens.', 'Secundário'],
        ['I Ciclo Ens.', 'Secundário'],
        ['II Ciclo Ens.', 'Secundário'],
        ['Bacharelato'],
        ['Licenciatura'],
        ['Mestrado'],
        ['Doutoramento'],
        ['TOTAL'],
    ]
    const niveis = [
        '< I Ciclo Ens. Secundário',
        'I Ciclo Ens. Secundário',
        'II Ciclo Ens. Secundário',
        'Bacharelato',
        'Licenciatura',
        'Mestrado',
        'Doutoramento',
    ]
    const yTop = 95
    const yA = 110
    const yB = 140
    const yC = 157.9
    const yD = 186

    fillRect(doc, L, yTop, 812.8 - L, yC - yTop, GRAY)
    fillRect(doc, L, yC, 166.9 - L, yD - yC, GRAY)
    cellText(doc, ['Nível académico/Sexo'], 166.9, yTop, 812.8, yA, { size: 8, bold: true })
    heads8.forEach((h, i) => {
        cellText(doc, h, xs8[i], yA, xs8[i + 1], yB, { size: 8, bold: true, lineH: 10.5 })
        const mid = (xs8[i] + xs8[i + 1]) / 2
        cellText(doc, ['M'], xs8[i], yB, mid, yC, { size: 8, bold: true })
        cellText(doc, ['F'], mid, yB, xs8[i + 1], yC, { size: 8, bold: true })
    })
    cellText(doc, ['Número de Professores'], L, yC, 166.9, yD, { size: 8, bold: true, lineH: 11 })

    const nivMap = new Map(p.professores_nivel_academico.map(r => [r.nivel_academico, r]))
    const hasProf = p.professores_nivel_academico.length > 0
    if (hasProf) {
        const total = sumMF(p.professores_nivel_academico)
        niveis.forEach((n, i) => {
            const v = nivMap.get(n) || { M: 0, F: 0 }
            const mid = (xs8[i] + xs8[i + 1]) / 2
            cellText(doc, [String(v.M)], xs8[i], yC, mid, yD, { size: 8 })
            cellText(doc, [String(v.F)], mid, yC, xs8[i + 1], yD, { size: 8 })
        })
        const mid = (xs8[7] + xs8[8]) / 2
        cellText(doc, [String(total.M)], xs8[7], yC, mid, yD, { size: 8, bold: true })
        cellText(doc, [String(total.F)], mid, yC, xs8[8], yD, { size: 8, bold: true })
    }

    for (let i = 0; i < xs8.length; i++) {
        const x = xs8[i]
        if (i === 0) {
            vLine(doc, x, yTop, yD, 't')
            continue
        }
        if (i === xs8.length - 1) continue
        vLine(doc, x, yA, yC, 's')
        vLine(doc, x, yC, yD, 'd')
    }
    for (let i = 0; i < xs8.length - 1; i++) {
        const mid = (xs8[i] + xs8[i + 1]) / 2
        vLine(doc, mid, yB, yD, 'd')
    }
    hLine(doc, 166.9, 812.8, yA, 's')
    hLine(doc, 166.9, 812.8, yB, 's')
    hLine(doc, L, 812.8, yC, 's')
    box(doc, L, yTop, 812.8, yD, 't')

    // TOTAL GERAL (M+F)
    const g1 = 194.8
    const g2 = 222.5
    fillRect(doc, L, g1, 646.6 - L, g2 - g1, GRAY)
    txt(doc, 'TOTAL GERAL (M+F)', 642, (g1 + g2) / 2 + 2.8, { size: 7.5, bold: true, align: 'right' })
    box(doc, 646.6, g1, 812.8, g2, 't')
    if (hasProf) {
        const total = sumMF(p.professores_nivel_academico)
        cellText(doc, [String(total.M + total.F)], 646.6, g1, 812.8, g2, { size: 8, bold: true })
    }
    hLine(doc, L, 646.6, g1, 'd')
    hLine(doc, L, 646.6, g2, 'd')
    vLine(doc, L, g1, g2, 'd')

    /* 9. Qualificação pedagógica × nacionalidade × sexo */
    sectionBand(
        doc,
        '9. NÚMERO DE PROFESSORES (FRENTE AO ALUNO) POR QUALIFICAÇÃO PEDAGÓGICA, NACIONALIDADE E SEXO',
        L,
        812.5,
        233.1,
        251.3,
        247.4
    )
    const cr = p.professores_cruzamento
    const hasCr = !!cr

    const xsN = [337.2, 415.8, 494.4, 573, 651.6, 732.2, 812.8]
    const drawNacTable = (
        yTop: number,
        yA: number,
        yB: number,
        rows: { label: string[]; align: 'center' | 'right'; y1: number; y2: number; data: (null | ReturnType<typeof natRow>) }[],
        yEnd: number
    ) => {
        fillRect(doc, L, yTop, 812.8 - L, yB - yTop, GRAY)
        const groups = ['Nacionais', 'Estrangeiros', 'TOTAL']
        groups.forEach((g, i) => {
            const x1 = xsN[i * 2]
            const x2 = xsN[i * 2 + 2]
            cellText(doc, [g], x1, yTop, x2, yA, { size: 8, bold: true })
            cellText(doc, ['M'], xsN[i * 2], yA, xsN[i * 2 + 1], yB, { size: 8, bold: true })
            cellText(doc, ['F'], xsN[i * 2 + 1], yA, xsN[i * 2 + 2], yB, { size: 8, bold: true })
        })
        rows.forEach(r => {
            fillRect(doc, L, r.y1, 337.2 - L, r.y2 - r.y1, GRAY)
            cellText(doc, r.label, L, r.y1, 337.2, r.y2, {
                size: 7.8,
                bold: true,
                align: r.align,
                lineH: 11,
                pad: 5,
            })
            if (r.data) {
                const d = r.data
                const vals = [d.nacM, d.nacF, d.estM, d.estF, d.nacM + d.estM, d.nacF + d.estF]
                vals.forEach((v, i) => {
                    cellText(doc, [String(v)], xsN[i], r.y1, xsN[i + 1], r.y2, { size: 8, bold: i >= 4 })
                })
            }
            hLine(doc, L, 812.8, r.y1, 's')
        })
        for (let i = 0; i < xsN.length; i++) {
            const x = xsN[i]
            if (i === 0 || i === 2 || i === 4 || i === 6) {
                vLine(doc, x, yTop, yEnd, i === 0 || i === 6 ? 't' : 's')
            } else {
                vLine(doc, x, yA, yEnd, 'd')
            }
        }
        hLine(doc, 337.2, 812.8, yA, 's')
        hLine(doc, L, 812.8, yB, 's')
        box(doc, L, yTop, 812.8, yEnd, 't')
    }
    function natRow(c: { nacionais: ContagemMF; estrangeiros: ContagemMF } | undefined) {
        return {
            nacM: c?.nacionais.M ?? 0,
            nacF: c?.nacionais.F ?? 0,
            estM: c?.estrangeiros.M ?? 0,
            estF: c?.estrangeiros.F ?? 0,
        }
    }

    const comN = natRow(cr?.com_formacao_pedagogica)
    const semN = natRow(cr?.sem_formacao_pedagogica)
    const totN = {
        nacM: comN.nacM + semN.nacM,
        nacF: comN.nacF + semN.nacF,
        estM: comN.estM + semN.estM,
        estF: comN.estF + semN.estF,
    }

    drawNacTable(
        251.9,
        270,
        283.8,
        [
            {
                label: ['Número de Professores com formação pedagógica'],
                align: 'center',
                y1: 283.8,
                y2: 312.5,
                data: hasCr ? comN : null,
            },
            {
                label: ['Número  de Professores sem formação pedagógica'],
                align: 'center',
                y1: 312.5,
                y2: 341,
                data: hasCr ? semN : null,
            },
            { label: ['TOTAL'], align: 'right', y1: 341, y2: 369.1, data: hasCr ? totN : null },
        ],
        369.1
    )

    // TOTAL GERAL (M+F) da secção 9
    fillRect(doc, L, 369.4, 651.6 - L, 25, GRAY)
    txt(doc, 'TOTAL  GERAL (M+F)', 647, 369.4 + 15, { size: 7.5, bold: true, align: 'right' })
    box(doc, 651.6, 369.4, 812.8, 394.4, 't')
    if (hasCr) {
        const t = totN.nacM + totN.nacF + totN.estM + totN.estF
        cellText(doc, [String(t)], 651.6, 369.4, 812.8, 394.4, { size: 8, bold: true })
    }
    hLine(doc, L, 651.6, 394.4, 'd')
    vLine(doc, L, 369.4, 394.4, 'd')

    // Faixa cinzenta de separação
    fillRect(doc, L, 395, 812.8 - L, 15.6, GRAY)
    hLine(doc, L, 812.8, 395.2, 'd')

    drawNacTable(
        410.6,
        431.9,
        446.3,
        [
            {
                label: ['(Dos quais) Número de Professores com formação diferenciada em', 'sala de aula'],
                align: 'center',
                y1: 446.3,
                y2: 474.4,
                data: hasCr ? natRow(cr?.formacao_diferenciada) : null,
            },
            {
                label: ['Total de Intérpretes de Língua Gestual Angolana'],
                align: 'right',
                y1: 474.4,
                y2: 499.4,
                data: hasCr ? natRow(cr?.interpretes_lga) : null,
            },
        ],
        499.4
    )
}

/* ------------------------------------------------------------------ */
/* Página 6 — Aproveitamento escolar (ano lectivo anterior)            */
/* ------------------------------------------------------------------ */

function page6(doc: jsPDF, ctx: Ctx) {
    const { p } = ctx
    const anoAnt = anoAnterior(ctx.ano)

    // Barra superior
    const barY1 = 70.4
    const barY2 = 90.6
    const bar = (x1: number, x2: number, label: string, left: boolean) => {
        fillRect(doc, x1, barY1, x2 - x1, barY2 - barY1, BLUE)
        txt(doc, label, left ? x1 + 3 : (x1 + x2) / 2, (barY1 + barY2) / 2 + 3.2, {
            size: 9,
            bold: true,
            color: WHITE,
            align: left ? 'left' : 'center',
        })
    }
    bar(L, 258.1, 'APROVEITAMENTO ESCOLAR', true)
    bar(259.4, 394.4, 'ANO LECTIVO ANTERIOR', true)
    box(doc, 395.6, barY1, 467.5, barY2, 's')
    cellText(doc, [anoAnt], 395.6, barY1, 467.5, barY2, { size: 8.5 })
    bar(468.1, 553.1, 'MÊS DE INÍCIO', true)
    box(doc, 554, barY1, 626.3, barY2, 's')
    bar(626.3, 733.8, 'MÊS DE TÉRMINO', true)
    box(doc, 734.4, barY1, 812.5, barY2, 's')

    // Definições
    const defs: { x1: number; x2: number; title: string; lines: string[] }[] = [
        { x1: 43.8, x2: 181.3, title: 'MATRICULADOS', lines: ['Alunos matriculados no ano', 'lectivo anterior'] },
        {
            x1: 208.1,
            x2: 333.8,
            title: 'APROVADOS',
            lines: ['Alunos que no final do', 'ano lectivo anterior foram', 'aprovados'],
        },
        {
            x1: 360.6,
            x2: 488.1,
            title: 'REPROVADOS',
            lines: ['Alunos que no final do', 'ano lectivo anterior foram', 'reprovados'],
        },
        {
            x1: 515,
            x2: 641.9,
            title: 'DESISTENTES',
            lines: ['Alunos que no ano lectivo', 'anterior abandonaram a', 'Escola'],
        },
        {
            x1: 668.8,
            x2: 812.5,
            title: 'TRANSFERIDOS',
            lines: ['Alunos que no ano lectivo', 'anterior saíram da Escola e', 'ingressaram em outra', 'Escola'],
        },
    ]
    const dY1 = 96.9
    const dHead = 14.4
    const dY2 = 177.5
    defs.forEach(d => {
        fillRect(doc, d.x1, dY1, d.x2 - d.x1, dHead, BLUE)
        txt(doc, d.title, (d.x1 + d.x2) / 2, dY1 + 10.2, { size: 8.5, bold: true, color: WHITE, align: 'center' })
        box(doc, d.x1, dY1, d.x2, dY2, 'd')
        cellText(doc, d.lines, d.x1, dY1 + dHead, d.x2, dY2, { size: 8, lineH: 12 })
    })

    sectionBand(doc, '10. APROVEITAMENTO ESCOLAR NO ANO LECTIVO ANTERIOR', L, 812.5, 185, 205, 199.5)

    const xs = [L, 197.5, 320.0, 442.8, 565.3, 688, 812.8]
    const yTop = 205.4
    const yA = 227
    const yB = 246.6
    const rowH = (530.3 - yB) / 10

    fillRect(doc, L, yTop, 812.8 - L, yB - yTop, GRAY)
    cellText(doc, ['Classe/Etapa'], L, yTop, 197.5, yB, { size: 8, bold: true })
    const groups = ['Matriculados', 'Aprovados', 'Reprovados', 'Desistentes', 'Transferidos']
    groups.forEach((g, i) => {
        const x1 = xs[i + 1]
        const x2 = xs[i + 2]
        cellText(doc, [g], x1, yTop, x2, yA, { size: 8, bold: true })
        cellText(doc, ['M'], x1, yA, (x1 + x2) / 2, yB, { size: 8, bold: true })
        cellText(doc, ['F'], (x1 + x2) / 2, yA, x2, yB, { size: 8, bold: true })
    })

    const ap = new Map(p.aproveitamento_ano_anterior.map(r => [r.classe, r]))
    const labels = [...CLASSES, ...PRAEER_APROV, 'TOTAL']
    const keys: ('matriculados' | 'aprovados' | 'reprovados' | 'desistentes' | 'transferidos')[] = [
        'matriculados',
        'aprovados',
        'reprovados',
        'desistentes',
        'transferidos',
    ]
    const totals = keys.map(() => ({ M: 0, F: 0 }))
    const hasAp = p.aproveitamento_ano_anterior.length > 0
    if (hasAp) {
        CLASSES.forEach(c => {
            const r = ap.get(c)
            keys.forEach((k, ki) => {
                totals[ki].M += r?.[k].M ?? 0
                totals[ki].F += r?.[k].F ?? 0
            })
        })
    }

    labels.forEach((label, r) => {
        const y1 = yB + rowH * r
        const y2 = y1 + rowH
        fillRect(doc, L, y1, 197.5 - L, y2 - y1, GRAY)
        cellText(doc, [label], L, y1, 197.5, y2, { size: 7.5, bold: true })
        const isTotal = label === 'TOTAL'
        const cls = r < 6 ? CLASSES[r] : null
        if (hasAp) {
            keys.forEach((k, ki) => {
                const x1 = xs[ki + 1]
                const x2 = xs[ki + 2]
                const mid = (x1 + x2) / 2
                let m: number | null = null
                let f: number | null = null
                if (isTotal) {
                    m = totals[ki].M
                    f = totals[ki].F
                } else if (cls) {
                    const row = ap.get(cls)
                    m = row?.[k].M ?? 0
                    f = row?.[k].F ?? 0
                }
                if (m !== null && f !== null) {
                    cellText(doc, [String(m)], x1, y1, mid, y2, { size: 8, bold: isTotal })
                    cellText(doc, [String(f)], mid, y1, x2, y2, { size: 8, bold: isTotal })
                }
            })
        }
        hLine(doc, L, 812.8, y1, 's')
    })
    const yEnd = yB + rowH * labels.length
    xs.forEach((x, i) => {
        if (i === 0 || i === xs.length - 1) return
        vLine(doc, x, yTop, yEnd, 't')
    })
    for (let i = 1; i < xs.length - 1; i++) {
        const mid = (xs[i] + xs[i + 1]) / 2
        vLine(doc, mid, yA, yEnd, 'd')
    }
    hLine(doc, 197.5, 812.8, yA, 's')
    hLine(doc, L, 812.8, yB, 's')
    box(doc, L, yTop, 812.8, yEnd, 't')
}

/* ------------------------------------------------------------------ */
/* Página 7 — Controlo de preenchimento e entrega                      */
/* ------------------------------------------------------------------ */

function page7(doc: jsPDF, _ctx: Ctx) {
    // Barra
    fillRect(doc, L, 75, 811.3 - L, 16.9, BLUE)
    txt(doc, 'CONTROLO DE PREENCHIMENTO E ENTREGA', L + 3, 87.4, { size: 8, bold: true, color: WHITE })

    // Cabeçalho da tabela
    const cx = [L, 263.8, 475.3, 559.4, 725.9, 812.5]
    fillRect(doc, L, 92.4, 812.5 - L, 35.7, GRAY)
    cellText(doc, ['Nome'], cx[1], 92.4, cx[2], 128.1, { size: 8, bold: true })
    cellText(doc, ['Data (dd/mm/', 'aaaa)'], cx[2], 92.4, cx[3], 128.1, { size: 8, bold: true, lineH: 12 })
    cellText(doc, ['Assinatura'], cx[3], 92.4, cx[4], 128.1, { size: 8, bold: true })
    cellText(doc, ['Contacto/', 'Telefone'], cx[4], 92.4, cx[5], 128.1, { size: 8, bold: true, lineH: 12 })

    sectionBand(doc, 'ÁREA RESERVADA PARA A ESCOLA', L, 812.5, 128.1, 143.1, 140.4)

    const writeRow = (y1: number, y2: number, label: string, baseline: number) => {
        fillRect(doc, L, y1, cx[1] - L, y2 - y1, GRAY)
        cellText(doc, [label], L, y1, cx[1], y2, { size: 8, bold: true })
        txt(doc, '________________________________________', 270, baseline, { size: 8.5 })
        txt(doc, '___/____/______', 484, baseline, { size: 8.5 })
        txt(doc, '______________________________', 574, baseline, { size: 8.5 })
        txt(doc, '____ ____ ____', 740, baseline, { size: 8.5 })
    }
    writeRow(143.8, 190.9, 'O Responsável pelo preenchimento', 184.3)
    writeRow(190.9, 237.5, 'Visto do Director', 232.3)

    // Observações da Escola
    txt(doc, 'Observações gerais da Escola:', L + 3, 250.3, { size: 8, bold: true })

    // verticais da tabela (cabeçalho e linhas de assinatura)
    ;[cx[1], cx[2], cx[3], cx[4]].forEach(x => {
        vLine(doc, x, 92.4, 128.1, 't')
        vLine(doc, x, 143.8, 237.5, 't')
    })
    hLine(doc, L, 812.5, 128.1, 's')
    hLine(doc, L, 812.5, 143.8, 's')
    hLine(doc, L, 812.5, 190.9, 'd')
    box(doc, L, 92.4, 812.5, 237.5, 't')
    box(doc, L, 237.5, 812.5, 351.5, 't')

    sectionBand(
        doc,
        'ÁREA RESERVADA PARA A DIRECÇÃO/SECRETARIA MUNICIPAL DA EDUCAÇÃO',
        L,
        812.5,
        351.3,
        366.3,
        364.4
    )
    // Recebimento
    const ry1 = 366.9
    const ry2 = 408.1
    fillRect(doc, L, ry1, cx[1] - L, ry2 - ry1, GRAY)
    cellText(doc, ['O Responsável pelo recebimento'], L, ry1, cx[1], ry2, { size: 8, bold: true })
    txt(doc, '________________________________________', 278, 400.3, { size: 9 })
    txt(doc, '___/____/______', 484, 400.3, { size: 9 })
    txt(doc, '_______________________________', 565, 400.3, { size: 9 })
    txt(doc, '____ ____ ____', 740, 400.3, { size: 9 })
    ;[cx[1], cx[2], cx[3], cx[4]].forEach(x => vLine(doc, x, ry1, ry2, 't'))
    box(doc, L, ry1, 812.5, ry2, 't')

    txt(doc, 'Observações gerais da Direcção/Secretaria:', L + 3, 421.3, { size: 8, bold: true })
    box(doc, L, ry2, 812.5, 530.6, 't')
}

/* ------------------------------------------------------------------ */
/* Entrada                                                             */
/* ------------------------------------------------------------------ */

export async function exportCensoPrimarioGeralPdf(payload: CensoQuestionarioPayload): Promise<void> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })

    let logo: string | null = null
    try {
        logo = await imageUrlToBase64(LOGO_STRIP)
    } catch {
        logo = null
    }

    const ctx: Ctx = {
        p: payload,
        logo,
        modalidadeNome: payload.cabecalho.modalidade_nome || 'Ensino Primário Geral',
        ano: payload.cabecalho.ano_lectivo,
    }

    const pages = [page1, page2, page3, page4, page5, page6, page7]
    pages.forEach((fn, i) => {
        if (i > 0) doc.addPage()
        drawPageHeader(doc, ctx)
        fn(doc, ctx)
        drawPageFooter(doc, ctx, i + 1)
    })

    const safeAno = ctx.ano.replace(/[\/\\]/g, '-')
    doc.save(`Censo_Escolar_${payload.cabecalho.modalidade_codigo}_${safeAno}.pdf`)
}
