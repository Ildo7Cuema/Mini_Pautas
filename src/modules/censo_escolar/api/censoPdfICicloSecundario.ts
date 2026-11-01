/**
 * Questionário do Censo Escolar — I CICLO DO ENSINO SECUNDÁRIO GERAL
 *
 * Reprodução fiel do modelo oficial do MED/INE (5 páginas, A4 paisagem).
 * Estrutura, ordem das secções, rótulos, colunas e linhas conforme o anexo.
 * Apenas se preenchem os campos de dados e os títulos dinâmicos.
 */
import { mostrarPdfNoNavegador } from './censoPdfOutput'
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

const LOGO_STRIP = '/censo-logos/branding/logo_header_oficial.png'
const TOTAL_PAGES = 5
const L = 43.1
const R = 812.8

const CLASSES = ['7ª Classe', '8ª Classe', '9ª Classe'] as const
const TURNOS = ['manhã', 'tarde', 'noite'] as const
const FAIXAS = [
    'Menos de 12 anos',
    '12 anos',
    '13 anos',
    '14 anos',
    '15 anos',
    '16 anos',
    '17 anos',
    '18 anos',
    '19 anos',
    '20 a 24 anos',
    'Mais de 24 anos',
    'Idade não especificada',
] as const

type Style = 's' | 't' | 'd'

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

function fitSize(doc: jsPDF, s: string, maxW: number, size: number, min = 5): number {
    let sz = size
    doc.setFontSize(sz)
    while (sz > min && doc.getTextWidth(s) > maxW) {
        sz -= 0.25
        doc.setFontSize(sz)
    }
    return sz
}

function sectionBand(doc: jsPDF, title: string, x1: number, x2: number, y1: number, y2: number, baseline: number) {
    fillRect(doc, x1, y1, x2 - x1, y2 - y1, BAND)
    hLine(doc, x1, x2, y1 + 0.3, 'd')
    hLine(doc, x1, x2, y2 - 0.3, 'd')
    vLine(doc, x1 + 0.3, y1, y2, 'd')
    vLine(doc, x2 - 0.3, y1, y2, 'd')
    txt(doc, title, x1 + 3, baseline, { size: 8, bold: true })
}

function num(v: number | null | undefined): string {
    if (v === null || v === undefined) return ''
    return String(v)
}

function sumMF(list: { M: number; F: number }[]): { M: number; F: number } {
    return list.reduce((a, r) => ({ M: a.M + r.M, F: a.F + r.F }), { M: 0, F: 0 })
}

interface Ctx {
    p: CensoQuestionarioPayload
    logo: string | null
    ano: string
}

function drawPageHeader(doc: jsPDF, ctx: Ctx) {
    if (ctx.logo) doc.addImage(ctx.logo, 'PNG', 40, 29, 318, 38)
    vLine(doc, 559.7, 28.8, 66.9, 's')
    vLine(doc, 646, 28.8, 67.5, 's')
    txt(doc, 'QUESTIONÁRIO PARA', 553.5, 42, { size: 7.5, color: BLUE, align: 'right' })
    txt(doc, 'I CICLO DO ENSINO', 553.5, 52, { size: 7.5, bold: true, color: BLUE, align: 'right' })
    txt(doc, 'SECUNDÁRIO GERAL', 553.5, 61.5, { size: 7.5, bold: true, color: BLUE, align: 'right' })
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

function page1(doc: jsPDF, ctx: Ctx) {
    const { p } = ctx
    const infra = p.infraestrutura
    const infraAny = infra as unknown as Record<string, unknown> | undefined
    const infraTemDados =
        !!infra &&
        (!!infraAny?.id ||
            Object.entries(infraAny ?? {}).some(
                ([k, v]) => !k.startsWith('mes_') && typeof v === 'number' && v > 0
            ))

    fillRect(doc, L, 71.5, R - L, 42, BANNER_FILL)
    box(doc, L, 71.5, R, 113.5, 's', BAND)
    const aviso =
        'LEIA ATENTAMENTE O MANUAL DE ORIENTAÇÃO ANTES DO PREENCHIMENTO DO QUESTIONÁRIO. ESTRITAMENTE CONFIDENCIAL.'
    txt(doc, aviso, 428, 98, { size: fitSize(doc, aviso, 705, 9, 6), color: BLUE, align: 'center' })

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

    lab(L, 198.4, 113.5, 131.6, 'CÓDIGO DA ESCOLA')
    val(198.4, 586, 113.5, 131.6, p.cabecalho.codigo_escola_med || '')
    fillRect(doc, 586, 113.5, R - 586, 18.1, BLUE)
    lab(L, 198.4, 131.6, 149.7, 'NOME DA INSTITUIÇÃO')
    val(198.4, 813.1, 131.6, 149.7, p.cabecalho.nome_instituicao || '')
    lab(L, 198.4, 149.7, 174.7, 'ANO LECTIVO')
    val(198.4, 315.3, 149.7, 174.7, ctx.ano)
    lab(315.3, 453.9, 149.7, 174.7, 'MÊS DE INÍCIO')
    val(453.9, 586, 149.7, 174.7, num(infra?.mes_inicio ?? p.cabecalho.mes_inicio))
    lab(586, 693.5, 149.7, 174.7, 'MÊS DE TÉRMINO')
    val(693.5, 813.1, 149.7, 174.7, num(infra?.mes_termino ?? p.cabecalho.mes_termino))

    // 1. Infraestrutura
    sectionBand(doc, '1. INFRAESTRUTURA DE SUPORTE DISPONÍVEL NA ESCOLA', L, 811.9, 180, 198, 193)
    const xs1 = [L, 196.9, 350.6, 504.4, 658.1, 811.9]
    const hY1 = 198
    const hB1 = 235
    const bB1 = 260
    fillRect(doc, L, hY1, 811.9 - L, hB1 - hY1, GRAY)
    const heads1 = [
        ['Total de Salas de aula'],
        ['Número de Salas de aula', '(próprias)'],
        ['Número de Salas de aula', '(emprestadas)'],
        ['Número de Salas de aula', '(arrendadas)'],
        ['Número de Salas de aula', '(próprias) em bom estado'],
    ]
    const vals1 = infraTemDados
        ? [
              infra!.total_salas,
              infra!.salas_proprias,
              infra!.salas_emprestadas,
              infra!.salas_arrendadas,
              infra!.salas_proprias_bom_estado,
          ]
        : []
    heads1.forEach((h, i) => {
        cellText(doc, h, xs1[i], hY1, xs1[i + 1], hB1, { size: 8, bold: true, lineH: 11 })
        if (vals1[i] !== undefined) cellText(doc, [String(vals1[i])], xs1[i], hB1, xs1[i + 1], bB1, { size: 9 })
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
        '2. MOBILIÁRIO DAS SALAS DE AULA (ASSENTOS, MESAS E QUADROS DIDÁCTICOS) DISPONÍVEL NA ESCOLA',
        L,
        812.5,
        268,
        282,
        279
    )
    const xs2 = [L, 139.4, 235.6, 332.2, 428.4, 520.6, 620.6, 713.4, 813.1]
    const hY2 = 282
    const hB2 = 325
    const bB2 = 348
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
    const vals2 = infraTemDados
        ? [
              infra!.total_assentos,
              infra!.assentos_bom_estado,
              infra!.assentos_acessiveis,
              infra!.total_mesas,
              infra!.mesas_bom_estado,
              infra!.mesas_acessiveis,
              infra!.total_quadros,
              infra!.quadros_bom_estado,
          ]
        : []
    heads2.forEach((h, i) => {
        cellText(doc, h, xs2[i], hY2, xs2[i + 1], hB2, { size: 7.5, bold: true, lineH: 10 })
        if (vals2[i] !== undefined) cellText(doc, [String(vals2[i])], xs2[i], hB2, xs2[i + 1], bB2, { size: 9 })
    })
    for (let i = 1; i < xs2.length - 1; i++) {
        vLine(doc, xs2[i], hY2, hB2, 's')
        vLine(doc, xs2[i], hB2, bB2, 'd')
    }
    hLine(doc, L, 813.1, hB2, 's')
    box(doc, L, hY2, 813.1, bB2, 't')

    // 3. Matrículas / turmas por classe e turno
    sectionBand(doc, '3. NÚMERO DE MATRÍCULAS, TURMAS POR CLASSE E TURNO DISPONÍVEIS NA ESCOLA', L, 813.1, 356, 372, 368)

    const mat = new Map<string, { matriculas: number; turmas: number; ar: number }>()
    for (const r of p.matriculas_classe_turno) {
        mat.set(`${r.classe}|${r.turno}`, {
            matriculas: r.matriculas,
            turmas: r.turmas,
            ar: r.turmas_ar_livre,
        })
    }
    const hasMat = p.matriculas_classe_turno.length > 0

    // Colunas: label | 7ª M/T/N | 8ª M/T/N | 9ª M/T/N | TOTAL M/T/N | TOTAL GERAL
    const xLabel = 140
    const groupW = 145
    const shiftW = groupW / 3
    const xGroups = [xLabel, xLabel + groupW, xLabel + 2 * groupW, xLabel + 3 * groupW]
    const xTotalGeral = 730
    const xEnd = 812.5
    const yTop = 372
    const yClass = 390
    const yShift = 415
    const yCheck = 432
    const yMat = 455
    const yTur = 478
    const yAr = 501

    fillRect(doc, L, yTop, xEnd - L, yClass - yTop, GRAY)
    fillRect(doc, L, yClass, xLabel - L, yAr - yClass, GRAY)
    cellText(doc, ['Classe'], L, yTop, xLabel, yClass, { size: 8, bold: true })
    CLASSES.forEach((c, i) => {
        cellText(doc, [c], xGroups[i], yTop, xGroups[i + 1], yClass, { size: 8, bold: true })
    })
    cellText(doc, ['TOTAL'], xGroups[3], yTop, xTotalGeral, yClass, { size: 8, bold: true })
    cellText(doc, ['TOTAL GERAL', '(Manhã + Tarde +', 'Noite)'], xTotalGeral, yTop, xEnd, yClass, {
        size: 7,
        bold: true,
        lineH: 9,
    })

    const shiftLabels = ['Manhã', 'Tarde', 'Noite']
    for (let g = 0; g < 4; g++) {
        const gx1 = xGroups[g]
        const gx2 = g < 3 ? xGroups[g + 1] : xTotalGeral
        shiftLabels.forEach((lab, k) => {
            const sx1 = gx1 + shiftW * k
            const sx2 = gx1 + shiftW * (k + 1)
            cellText(doc, [lab], sx1, yClass, sx2, yShift, { size: 7, bold: true })
            const cx = (sx1 + sx2) / 2
            const cy = (yShift + yCheck) / 2
            setStroke(doc, 's')
            doc.rect(cx - 2.6, cy - 2.6, 5.2, 5.2, 'S')
            if (g < 3) {
                const rec = mat.get(`${CLASSES[g]}|${TURNOS[k]}`)
                if (rec && rec.turmas > 0) {
                    doc.setLineWidth(0.8)
                    doc.line(cx - 1.8, cy - 1.8, cx + 1.8, cy + 1.8)
                    doc.line(cx - 1.8, cy + 1.8, cx + 1.8, cy - 1.8)
                }
                if (hasMat) {
                    cellText(doc, [String(rec?.matriculas ?? 0)], sx1, yCheck, sx2, yMat, { size: 8 })
                    cellText(doc, [String(rec?.turmas ?? 0)], sx1, yMat, sx2, yTur, { size: 8 })
                    cellText(doc, [String(rec?.ar ?? 0)], sx1, yTur, sx2, yAr, { size: 8 })
                }
            } else if (hasMat) {
                let m = 0,
                    t = 0,
                    a = 0
                CLASSES.forEach(c => {
                    const rec = mat.get(`${c}|${TURNOS[k]}`)
                    m += rec?.matriculas ?? 0
                    t += rec?.turmas ?? 0
                    a += rec?.ar ?? 0
                })
                cellText(doc, [String(m)], sx1, yCheck, sx2, yMat, { size: 8 })
                cellText(doc, [String(t)], sx1, yMat, sx2, yTur, { size: 8 })
                cellText(doc, [String(a)], sx1, yTur, sx2, yAr, { size: 8 })
            }
            vLine(doc, sx2, yClass, yAr, 'd')
        })
        vLine(doc, gx2, yTop, yAr, 't')
    }
    if (hasMat) {
        let m = 0,
            t = 0,
            a = 0
        CLASSES.forEach(c =>
            TURNOS.forEach(tr => {
                const rec = mat.get(`${c}|${tr}`)
                m += rec?.matriculas ?? 0
                t += rec?.turmas ?? 0
                a += rec?.ar ?? 0
            })
        )
        cellText(doc, [String(m)], xTotalGeral, yCheck, xEnd, yMat, { size: 8, bold: true })
        cellText(doc, [String(t)], xTotalGeral, yMat, xEnd, yTur, { size: 8, bold: true })
        cellText(doc, [String(a)], xTotalGeral, yTur, xEnd, yAr, { size: 8, bold: true })
    }
    cellText(doc, ['Número de matrículas'], L, yCheck, xLabel, yMat, { size: 7.5, bold: true })
    cellText(doc, ['Total de turmas'], L, yMat, xLabel, yTur, { size: 7.5, bold: true })
    cellText(doc, ['(Das quais) Número de', 'turmas ao ar livre'], L, yTur, xLabel, yAr, {
        size: 7,
        bold: true,
        lineH: 9,
    })
    vLine(doc, xLabel, yTop, yAr, 't')
    vLine(doc, xTotalGeral, yTop, yAr, 't')
    hLine(doc, L, xEnd, yClass, 's')
    hLine(doc, L, xEnd, yShift, 's')
    hLine(doc, L, xEnd, yCheck, 's')
    hLine(doc, L, xEnd, yMat, 's')
    hLine(doc, L, xEnd, yTur, 's')
    box(doc, L, yTop, xEnd, yAr, 't')

    // Legenda
    const ly1 = 508
    const ly2 = 548
    fillRect(doc, L, ly1, 120, 14, GRAY)
    fillRect(doc, 170, ly1, 430, 14, GRAY)
    fillRect(doc, 610, ly1, 202, 14, GRAY)
    box(doc, L, ly1, 160, ly2, 'd')
    box(doc, 170, ly1, 600, ly2, 'd')
    box(doc, 610, ly1, 812.5, ly2, 'd')
    txt(doc, 'TURNOS', 101.5, ly1 + 10, { size: 8, bold: true, align: 'center' })
    txt(doc, 'HORÁRIOS DOS TURNOS: PERÍODO DO DIA DE MAIOR CONCENTRAÇÃO DAS AULAS', 385, ly1 + 10, {
        size: 7,
        bold: true,
        align: 'center',
    })
    txt(doc, 'TURMA', 711, ly1 + 10, { size: 8, bold: true, align: 'center' })
    txt(doc, 'Período de funcionamento', 101.5, 530, { size: 7, align: 'center' })
    txt(doc, 'das turmas.', 101.5, 540, { size: 7, align: 'center' })
    txt(doc, 'Manhã: concentração das 07h00 às 12h30', 385, 528, { size: 7, align: 'center' })
    txt(doc, 'Tarde: concentração das 13h00 às 18h00  ·  Noite: concentração após as 18h00', 385, 540, {
        size: 7,
        align: 'center',
    })
    txt(doc, 'Grupo de alunos ensinados pelo mesmo', 711, 528, { size: 6.5, align: 'center' })
    txt(doc, 'Professor, ao mesmo tempo e na mesma', 711, 537, { size: 6.5, align: 'center' })
    txt(doc, 'classe ou etapa.', 711, 546, { size: 6.5, align: 'center' })
}

function page2(doc: jsPDF, ctx: Ctx) {
    const { p } = ctx
    sectionBand(doc, '4. NÚMERO DE MATRÍCULAS POR IDADE, CLASSE E SEXO', L, 812.5, 72, 88, 84)

    const xClasse = 95
    const xSexo = 120
    const xAges0 = 120
    const xEnd = 812.5
    const nAge = FAIXAS.length
    const ageW = (700 - xAges0) / nAge
    const xsAge: number[] = []
    for (let i = 0; i <= nAge; i++) xsAge.push(xAges0 + ageW * i)
    const xTot = 700

    const yTop = 88
    const yHead = 118
    const rowH = 28
    const labels = [...CLASSES, 'TOTAL']

    fillRect(doc, L, yTop, xEnd - L, yHead - yTop, GRAY)
    cellText(doc, ['Classe'], L, yTop, xClasse, yHead, { size: 8, bold: true })
    cellText(doc, ['Sexo'], xClasse, yTop, xSexo, yHead, { size: 8, bold: true })
    const ageHeads = [
        ['Menos de', '12 anos'],
        ['12 anos'],
        ['13 anos'],
        ['14 anos'],
        ['15 anos'],
        ['16 anos'],
        ['17 anos'],
        ['18 anos'],
        ['19 anos'],
        ['20 a 24', 'anos'],
        ['Mais de', '24 anos'],
        ['Idade não', 'especificada'],
    ]
    ageHeads.forEach((h, i) => cellText(doc, h, xsAge[i], yTop, xsAge[i + 1], yHead, { size: 6.5, bold: true, lineH: 9 }))
    cellText(doc, ['TOTAL'], xTot, yTop, xEnd, yHead, { size: 8, bold: true })

    const idade = new Map<string, { M: number; F: number }>()
    for (const r of p.matriculas_idade) idade.set(`${r.classe}|${r.faixa_etaria}`, { M: r.M, F: r.F })
    const hasIdade = p.matriculas_idade.length > 0
    const colTot = FAIXAS.map(() => ({ M: 0, F: 0 }))
    let grand = { M: 0, F: 0 }

    labels.forEach((label, ri) => {
        const y1 = yHead + rowH * ri
        const y2 = y1 + rowH
        const mid = (y1 + y2) / 2
        fillRect(doc, L, y1, xClasse - L, rowH, GRAY)
        cellText(doc, label === 'TOTAL' ? ['TOTAL'] : [label.replace(' Classe', ''), 'Classe'], L, y1, xClasse, y2, {
            size: 7.5,
            bold: true,
            lineH: 10,
        })
        fillRect(doc, xClasse, y1, xSexo - xClasse, rowH, GRAY)
        txt(doc, 'M', (xClasse + xSexo) / 2, (y1 + mid) / 2 + 2.5, { size: 7.5, bold: true, align: 'center' })
        txt(doc, 'F', (xClasse + xSexo) / 2, (mid + y2) / 2 + 2.5, { size: 7.5, bold: true, align: 'center' })
        let rowM = 0
        let rowF = 0
        FAIXAS.forEach((f, fi) => {
            let v = { M: 0, F: 0 }
            if (label === 'TOTAL') v = colTot[fi]
            else if (hasIdade) {
                v = idade.get(`${label}|${f}`) || { M: 0, F: 0 }
                colTot[fi].M += v.M
                colTot[fi].F += v.F
            }
            rowM += v.M
            rowF += v.F
            if (hasIdade) {
                cellText(doc, [String(v.M)], xsAge[fi], y1, xsAge[fi + 1], mid, { size: 7 })
                cellText(doc, [String(v.F)], xsAge[fi], mid, xsAge[fi + 1], y2, { size: 7 })
            }
        })
        if (hasIdade) {
            cellText(doc, [String(rowM)], xTot, y1, xEnd, mid, { size: 7.5, bold: true })
            cellText(doc, [String(rowF)], xTot, mid, xEnd, y2, { size: 7.5, bold: true })
            if (label === 'TOTAL') grand = { M: rowM, F: rowF }
        }
        hLine(doc, xClasse, xEnd, mid, 'd')
        hLine(doc, L, xEnd, y1, 's')
        xsAge.forEach((x, i) => {
            if (i === 0) return
            vLine(doc, x, yTop, y2, 'd')
        })
        vLine(doc, xClasse, yTop, y2, 's')
        vLine(doc, xSexo, yTop, y2, 's')
        vLine(doc, xTot, yTop, y2, 't')
    })
    const yEndAge = yHead + rowH * labels.length
    box(doc, L, yTop, xEnd, yEndAge, 't')
    fillRect(doc, L, yEndAge, xTot - L, 20, GRAY)
    txt(doc, 'TOTAL GERAL(M+F)', xTot - 5, yEndAge + 13, { size: 7.5, bold: true, align: 'right' })
    box(doc, xTot, yEndAge, xEnd, yEndAge + 20, 't')
    if (hasIdade) cellText(doc, [String(grand.M + grand.F)], xTot, yEndAge, xEnd, yEndAge + 20, { size: 8, bold: true })
    hLine(doc, L, xTot, yEndAge + 20, 'd')

    // 5. Info 7ª classe
    sectionBand(doc, '5. INFORMAÇÕES ESPECÍFICAS SOBRE A 7ª CLASSE', L, 812.5, 278, 294, 290)
    const info = p.info_classe_ingresso
    txt(doc, 'Número de vagas disponibilizadas para a 7ª Classe', L + 3, 310, { size: 8, bold: true })
    box(doc, 420, 298, 520, 320, 's')
    if (info && info.vagas != null) cellText(doc, [String(info.vagas)], 420, 298, 520, 320, { size: 9 })
    txt(doc, 'Número de matriculados pela primeira vez na 7ª Classe', L + 3, 340, { size: 8, bold: true })
    txt(doc, 'M', 450, 340, { size: 8, bold: true })
    box(doc, 458, 328, 520, 350, 's')
    txt(doc, 'F', 545, 340, { size: 8, bold: true })
    box(doc, 553, 328, 615, 350, 's')
    txt(doc, 'TOTAL', 640, 340, { size: 8, bold: true })
    box(doc, 675, 328, 760, 350, 's')
    if (info) {
        cellText(doc, [String(info.primeira_vez.M)], 458, 328, 520, 350, { size: 9 })
        cellText(doc, [String(info.primeira_vez.F)], 553, 328, 615, 350, { size: 9 })
        cellText(doc, [String(info.primeira_vez.M + info.primeira_vez.F)], 675, 328, 760, 350, { size: 9, bold: true })
    }

    // 6. Deficiência (classes em linhas, tipos em colunas)
    sectionBand(doc, '6. NÚMERO DE MATRÍCULAS POR CLASSE, TIPO DE DEFICIÊNCIA E SEXO', L, 812.5, 358, 374, 370)
    const defs = DEFICIENCIAS_CENSO
    const shortLabel = (t: TipoDeficiencia): string[] => {
        if (t === 'espectro_autista') return ['Autista']
        if (t === 'fisica_motora') return ['Física/', 'Motora']
        if (t === 'sindrome_down') return ['Síndrome de', 'Down']
        if (t === 'surdo_cegueira') return ['Surdo-', 'Cegueira']
        if (t === 'altas_habilidades') return ['Altas', 'habilidades']
        return [LABELS_DEFICIENCIA[t]]
    }
    const xD0 = 110
    const xDEnd = 740
    const dw = (xDEnd - xD0) / defs.length
    const xsD = defs.map((_, i) => xD0 + dw * i)
    xsD.push(xDEnd)
    const xDT = 812.5
    const yDTop = 374
    const yDA = 400
    const yDH = 418
    const dRowH = 26

    fillRect(doc, L, yDTop, xDT - L, yDH - yDTop, GRAY)
    cellText(doc, ['Classe'], L, yDTop, xD0, yDH, { size: 8, bold: true })
    cellText(doc, ['Tipos de deficiência/Sexo'], xD0, yDTop, xDEnd, yDA, { size: 8, bold: true })
    defs.forEach((t, i) => cellText(doc, shortLabel(t), xsD[i], yDA, xsD[i + 1], yDH, { size: 6.5, bold: true, lineH: 8 }))
    cellText(doc, ['TOTAL'], xDEnd, yDTop, xDT, yDH, { size: 8, bold: true })

    const defMap = new Map<string, { M: number; F: number }>()
    for (const r of p.matriculas_deficiencia) {
        if (r.tipo_deficiencia === 'nenhuma') continue
        defMap.set(`${r.classe}|${r.tipo_deficiencia}`, { M: r.M, F: r.F })
    }
    const hasDef = p.matriculas_deficiencia.some(r => r.M + r.F > 0)
    const colD = defs.map(() => ({ M: 0, F: 0 }))
    let grandD = 0

    ;[...CLASSES, 'TOTAL'].forEach((label, ri) => {
        const y1 = yDH + dRowH * ri
        const y2 = y1 + dRowH
        const mid = (y1 + y2) / 2
        fillRect(doc, L, y1, xD0 - L, dRowH, GRAY)
        cellText(doc, [label], L, y1, xD0, y2, { size: 7.5, bold: true })
        let rowM = 0
        let rowF = 0
        defs.forEach((t, ti) => {
            let v = { M: 0, F: 0 }
            if (label === 'TOTAL') v = colD[ti]
            else {
                v = defMap.get(`${label}|${t}`) || { M: 0, F: 0 }
                colD[ti].M += v.M
                colD[ti].F += v.F
            }
            rowM += v.M
            rowF += v.F
            cellText(doc, [String(v.M)], xsD[ti], y1, xsD[ti + 1], mid, { size: 6.5 })
            cellText(doc, [String(v.F)], xsD[ti], mid, xsD[ti + 1], y2, { size: 6.5 })
        })
        cellText(doc, [String(rowM)], xDEnd, y1, xDT, mid, { size: 7, bold: true })
        cellText(doc, [String(rowF)], xDEnd, mid, xDT, y2, { size: 7, bold: true })
        if (label === 'TOTAL') grandD = rowM + rowF
        hLine(doc, xD0, xDT, mid, 'd')
        hLine(doc, L, xDT, y1, 's')
    })
    defs.forEach((_t, ti) => {
        const midX = (xsD[ti] + xsD[ti + 1]) / 2
        txt(doc, 'M', (xsD[ti] + midX) / 2, yDH - 3, { size: 6, bold: true, align: 'center' })
        txt(doc, 'F', (midX + xsD[ti + 1]) / 2, yDH - 3, { size: 6, bold: true, align: 'center' })
        vLine(doc, midX, yDH - 10, yDH + dRowH * 4, 'd')
        vLine(doc, xsD[ti + 1], yDA, yDH + dRowH * 4, 'd')
    })
    void hasDef
    const yDEnd = yDH + dRowH * 4
    vLine(doc, xD0, yDTop, yDEnd, 't')
    vLine(doc, xDEnd, yDTop, yDEnd, 't')
    box(doc, L, yDTop, xDT, yDEnd, 't')
    fillRect(doc, L, yDEnd, xDEnd - L, 18, GRAY)
    txt(doc, 'TOTAL GERAL (M+F)', xDEnd - 5, yDEnd + 12, { size: 7.5, bold: true, align: 'right' })
    box(doc, xDEnd, yDEnd, xDT, yDEnd + 18, 't')
    cellText(doc, [String(grandD)], xDEnd, yDEnd, xDT, yDEnd + 18, { size: 8, bold: true })
}

function page3(doc: jsPDF, ctx: Ctx) {
    const { p } = ctx
    sectionBand(doc, '7. NÚMERO DE PROFESSORES FRENTE AO ALUNO POR NÍVEL ACADÉMICO E SEXO', L, 812.5, 72, 90, 85)

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
    const yTop = 90
    const yA = 105
    const yB = 132
    const yC = 148
    const yD = 175
    fillRect(doc, L, yTop, 812.8 - L, yC - yTop, GRAY)
    fillRect(doc, L, yC, 166.9 - L, yD - yC, GRAY)
    cellText(doc, ['Nível académico/Sexo'], 166.9, yTop, 812.8, yA, { size: 8, bold: true })
    heads8.forEach((h, i) => {
        cellText(doc, h, xs8[i], yA, xs8[i + 1], yB, { size: 7.5, bold: true, lineH: 10 })
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
    for (let i = 1; i < xs8.length - 1; i++) {
        vLine(doc, xs8[i], yA, yC, 's')
        vLine(doc, xs8[i], yC, yD, 'd')
    }
    for (let i = 0; i < xs8.length - 1; i++) vLine(doc, (xs8[i] + xs8[i + 1]) / 2, yB, yD, 'd')
    hLine(doc, 166.9, 812.8, yA, 's')
    hLine(doc, 166.9, 812.8, yB, 's')
    hLine(doc, L, 812.8, yC, 's')
    box(doc, L, yTop, 812.8, yD, 't')
    fillRect(doc, L, 180, 646.6 - L, 24, GRAY)
    txt(doc, 'TOTAL GERAL (M+F)', 642, 195, { size: 7.5, bold: true, align: 'right' })
    box(doc, 646.6, 180, 812.8, 204, 't')
    if (hasProf) {
        const total = sumMF(p.professores_nivel_academico)
        cellText(doc, [String(total.M + total.F)], 646.6, 180, 812.8, 204, { size: 8, bold: true })
    }

    sectionBand(
        doc,
        '8. NÚMERO DE PROFESSORES (FRENTE AO ALUNO), POR QUALIFICAÇÃO PEDAGÓGICA, NACIONALIDADE, SEXO & DESENVOLVIMENTO PROFISSIONAL CONTÍNUO',
        L,
        812.5,
        215,
        240,
        232
    )

    const cr = p.professores_cruzamento
    const xsN = [337.2, 415.8, 494.4, 573, 651.6, 732.2, 812.8]
    const natRow = (c: { nacionais: ContagemMF; estrangeiros: ContagemMF } | undefined) => ({
        nacM: c?.nacionais.M ?? 0,
        nacF: c?.nacionais.F ?? 0,
        estM: c?.estrangeiros.M ?? 0,
        estF: c?.estrangeiros.F ?? 0,
    })

    const drawNac = (
        yT: number,
        yA: number,
        yB: number,
        rows: { label: string[]; y1: number; y2: number; data: ReturnType<typeof natRow> | null; align?: 'center' | 'right' }[],
        yEnd: number
    ) => {
        fillRect(doc, L, yT, 812.8 - L, yB - yT, GRAY)
        ;['Nacionais', 'Estrangeiros', 'TOTAL'].forEach((g, i) => {
            cellText(doc, [g], xsN[i * 2], yT, xsN[i * 2 + 2], yA, { size: 8, bold: true })
            cellText(doc, ['M'], xsN[i * 2], yA, xsN[i * 2 + 1], yB, { size: 8, bold: true })
            cellText(doc, ['F'], xsN[i * 2 + 1], yA, xsN[i * 2 + 2], yB, { size: 8, bold: true })
        })
        rows.forEach(r => {
            fillRect(doc, L, r.y1, 337.2 - L, r.y2 - r.y1, GRAY)
            cellText(doc, r.label, L, r.y1, 337.2, r.y2, {
                size: 7.5,
                bold: true,
                align: r.align || 'center',
                lineH: 11,
                pad: 5,
            })
            if (r.data) {
                const d = r.data
                ;[d.nacM, d.nacF, d.estM, d.estF, d.nacM + d.estM, d.nacF + d.estF].forEach((v, i) => {
                    cellText(doc, [String(v)], xsN[i], r.y1, xsN[i + 1], r.y2, { size: 8, bold: i >= 4 })
                })
            }
            hLine(doc, L, 812.8, r.y1, 's')
        })
        ;[0, 2, 4, 6].forEach(i => vLine(doc, xsN[i], yT, yEnd, i === 0 || i === 6 ? 't' : 's'))
        ;[1, 3, 5].forEach(i => vLine(doc, xsN[i], yA, yEnd, 'd'))
        hLine(doc, 337.2, 812.8, yA, 's')
        hLine(doc, L, 812.8, yB, 's')
        box(doc, L, yT, 812.8, yEnd, 't')
    }

    const comN = natRow(cr?.com_formacao_pedagogica)
    const semN = natRow(cr?.sem_formacao_pedagogica)
    const totN = {
        nacM: comN.nacM + semN.nacM,
        nacF: comN.nacF + semN.nacF,
        estM: comN.estM + semN.estM,
        estF: comN.estF + semN.estF,
    }
    drawNac(
        245,
        262,
        276,
        [
            { label: ['Número de Professores com formação pedagógica'], y1: 276, y2: 302, data: cr ? comN : null },
            { label: ['Número de Professores sem formação pedagógica'], y1: 302, y2: 328, data: cr ? semN : null },
            { label: ['TOTAL'], y1: 328, y2: 352, data: cr ? totN : null, align: 'right' },
        ],
        352
    )
    fillRect(doc, L, 355, 651.6 - L, 22, GRAY)
    txt(doc, 'TOTAL GERAL(M+F)', 647, 369, { size: 7.5, bold: true, align: 'right' })
    box(doc, 651.6, 355, 812.8, 377, 't')
    if (cr) {
        cellText(
            doc,
            [String(totN.nacM + totN.nacF + totN.estM + totN.estF)],
            651.6,
            355,
            812.8,
            377,
            { size: 8, bold: true }
        )
    }

    drawNac(
        390,
        408,
        422,
        [
            {
                label: ['(Dos quais) Número de Professores com formação diferenciada', 'em sala de aula'],
                y1: 422,
                y2: 452,
                data: cr ? natRow(cr.formacao_diferenciada) : null,
            },
            {
                label: ['Total de Intérpretes de Língua Gestual Angolana'],
                y1: 452,
                y2: 478,
                data: cr ? natRow(cr.interpretes_lga) : null,
                align: 'right',
            },
            {
                label: [
                    '(Dos quais) Número de Professores que participaram em',
                    'Desenvolvimento Profissional Contínuo (DPC) nos últimos 12 meses',
                ],
                y1: 478,
                y2: 510,
                data: cr ? natRow(cr.dpc_12_meses) : null,
            },
        ],
        510
    )
}

function page4(doc: jsPDF, ctx: Ctx) {
    const { p } = ctx
    const anoAnt = anoAnterior(ctx.ano)
    const barY1 = 72
    const barY2 = 92
    const bar = (x1: number, x2: number, label: string) => {
        fillRect(doc, x1, barY1, x2 - x1, barY2 - barY1, BLUE)
        txt(doc, label, x1 + 4, (barY1 + barY2) / 2 + 3, { size: 9, bold: true, color: WHITE })
    }
    bar(L, 258, 'APROVEITAMENTO ESCOLAR')
    bar(260, 395, 'ANO LECTIVO ANTERIOR')
    box(doc, 397, barY1, 470, barY2, 's')
    cellText(doc, [anoAnt], 397, barY1, 470, barY2, { size: 8.5 })
    bar(472, 555, 'MÊS DE INÍCIO')
    box(doc, 557, barY1, 625, barY2, 's')
    if (p.cabecalho.mes_inicio) cellText(doc, [String(p.cabecalho.mes_inicio)], 557, barY1, 625, barY2, { size: 8.5 })
    bar(627, 735, 'MÊS DE TÉRMINO')
    box(doc, 737, barY1, 812.5, barY2, 's')
    if (p.cabecalho.mes_termino) cellText(doc, [String(p.cabecalho.mes_termino)], 737, barY1, 812.5, barY2, { size: 8.5 })

    const defs = [
        { x1: 43.8, x2: 181, title: 'MATRICULADOS', lines: ['Alunos matriculados no ano', 'lectivo anterior'] },
        { x1: 208, x2: 334, title: 'APROVADOS', lines: ['Alunos que no final do', 'ano lectivo anterior foram', 'aprovados'] },
        { x1: 360, x2: 488, title: 'REPROVADOS', lines: ['Alunos que no final do', 'ano lectivo anterior foram', 'reprovados'] },
        { x1: 515, x2: 642, title: 'DESISTENTES', lines: ['Alunos que no ano lectivo', 'anterior abandonaram a', 'Escola'] },
        {
            x1: 668,
            x2: 812.5,
            title: 'TRANSFERIDOS',
            lines: ['Alunos que no ano lectivo', 'anterior saíram da Escola e', 'ingressaram em outra Escola'],
        },
    ]
    defs.forEach(d => {
        fillRect(doc, d.x1, 100, d.x2 - d.x1, 14, BLUE)
        txt(doc, d.title, (d.x1 + d.x2) / 2, 110, { size: 8, bold: true, color: WHITE, align: 'center' })
        box(doc, d.x1, 100, d.x2, 175, 'd')
        cellText(doc, d.lines, d.x1, 114, d.x2, 175, { size: 8, lineH: 12 })
    })

    sectionBand(doc, '9. APROVEITAMENTO ESCOLAR NO ANO LECTIVO ANTERIOR', L, 812.5, 185, 205, 199)
    const xs = [L, 197.5, 320, 442.8, 565.3, 688, 812.8]
    const yTop = 205
    const yA = 225
    const yB = 245
    const rowH = 40
    fillRect(doc, L, yTop, 812.8 - L, yB - yTop, GRAY)
    cellText(doc, ['Classe'], L, yTop, 197.5, yB, { size: 8, bold: true })
    ;['Matriculados', 'Aprovados', 'Reprovados', 'Desistentes', 'Transferidos'].forEach((g, i) => {
        cellText(doc, [g], xs[i + 1], yTop, xs[i + 2], yA, { size: 8, bold: true })
        cellText(doc, ['M'], xs[i + 1], yA, (xs[i + 1] + xs[i + 2]) / 2, yB, { size: 8, bold: true })
        cellText(doc, ['F'], (xs[i + 1] + xs[i + 2]) / 2, yA, xs[i + 2], yB, { size: 8, bold: true })
    })
    const ap = new Map(p.aproveitamento_ano_anterior.map(r => [r.classe, r]))
    const keys = ['matriculados', 'aprovados', 'reprovados', 'desistentes', 'transferidos'] as const
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
    ;[...CLASSES, 'TOTAL'].forEach((label, ri) => {
        const y1 = yB + rowH * ri
        const y2 = y1 + rowH
        fillRect(doc, L, y1, 197.5 - L, rowH, GRAY)
        cellText(doc, [label], L, y1, 197.5, y2, { size: 8, bold: true })
        keys.forEach((k, ki) => {
            const x1 = xs[ki + 1]
            const x2 = xs[ki + 2]
            const mid = (x1 + x2) / 2
            const row = label === 'TOTAL' ? totals[ki] : ap.get(label)?.[k] || { M: 0, F: 0 }
            if (hasAp) {
                cellText(doc, [String(row.M)], x1, y1, mid, y2, { size: 8, bold: label === 'TOTAL' })
                cellText(doc, [String(row.F)], mid, y1, x2, y2, { size: 8, bold: label === 'TOTAL' })
            }
        })
        hLine(doc, L, 812.8, y1, 's')
    })
    const yEnd = yB + rowH * 4
    xs.slice(1, -1).forEach(x => vLine(doc, x, yTop, yEnd, 't'))
    for (let i = 1; i < xs.length - 1; i++) vLine(doc, (xs[i] + xs[i + 1]) / 2, yA, yEnd, 'd')
    hLine(doc, 197.5, 812.8, yA, 's')
    hLine(doc, L, 812.8, yB, 's')
    box(doc, L, yTop, 812.8, yEnd, 't')
}

function page5(doc: jsPDF, _ctx: Ctx) {
    fillRect(doc, L, 75, 811.3 - L, 16.9, BLUE)
    txt(doc, 'CONTROLO DE PREENCHIMENTO E ENTREGA', L + 4, 86.5, { size: 9, bold: true, color: WHITE })

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
    txt(doc, 'Observações gerais da Escola:', L + 3, 250.3, { size: 8, bold: true })
    ;[cx[1], cx[2], cx[3], cx[4]].forEach(x => {
        vLine(doc, x, 92.4, 128.1, 't')
        vLine(doc, x, 143.8, 237.5, 't')
    })
    hLine(doc, L, 812.5, 128.1, 's')
    hLine(doc, L, 812.5, 143.8, 's')
    hLine(doc, L, 812.5, 190.9, 'd')
    box(doc, L, 92.4, 812.5, 237.5, 't')
    box(doc, L, 237.5, 812.5, 351.5, 't')

    sectionBand(doc, 'ÁREA RESERVADA PARA A DIRECÇÃO/SECRETARIA MUNICIPAL DA EDUCAÇÃO', L, 812.5, 351.3, 366.3, 364.4)
    const ry1 = 366.9
    const ry2 = 408.1
    fillRect(doc, L, ry1, cx[1] - L, ry2 - ry1, GRAY)
    cellText(doc, ['O Responsável pelo recebimento'], L, ry1, cx[1], ry2, { size: 8, bold: true })
    txt(doc, '________________________________________', 278, 400.3, { size: 8.5 })
    txt(doc, '___/____/______', 484, 400.3, { size: 8.5 })
    txt(doc, '_______________________________', 565, 400.3, { size: 8.5 })
    txt(doc, '____ ____ ____', 740, 400.3, { size: 8.5 })
    ;[cx[1], cx[2], cx[3], cx[4]].forEach(x => vLine(doc, x, ry1, ry2, 't'))
    box(doc, L, ry1, 812.5, ry2, 't')
    txt(doc, 'Observações gerais da Direcção/Secretaria:', L + 3, 421.3, { size: 8, bold: true })
    box(doc, L, ry2, 812.5, 530.6, 't')
}

export async function exportCensoICicloSecundarioPdf(
    payload: CensoQuestionarioPayload,
    janela?: Window | null
): Promise<void> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    let logo: string | null = null
    try {
        logo = await imageUrlToBase64(LOGO_STRIP)
    } catch {
        logo = null
    }
    const ctx: Ctx = { p: payload, logo, ano: payload.cabecalho.ano_lectivo }
    const pages = [page1, page2, page3, page4, page5]
    pages.forEach((fn, i) => {
        if (i > 0) doc.addPage()
        drawPageHeader(doc, ctx)
        fn(doc, ctx)
        drawPageFooter(doc, ctx, i + 1)
    })
    const safeAno = ctx.ano.replace(/[\/\\]/g, '-')
    mostrarPdfNoNavegador(doc, `Censo_Escolar_i_ciclo_secundario_geral_${safeAno}.pdf`, janela)
}
