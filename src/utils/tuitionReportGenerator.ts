import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { HeaderConfig } from './headerConfigUtils'
import { applyStandardPdfFooters } from './pdfFooter'
import { renderOfficialSchoolHeader } from './receiptGenerator'
import { formatarValor, getNomeMes } from './tuitionPayments'
import type { Aluno, EscolaProfile, PagamentoPropina } from '../types'

const COLORS = {
    ink: [15, 23, 42] as [number, number, number],
    muted: [100, 116, 139] as [number, number, number],
    line: [203, 213, 225] as [number, number, number],
    headerBg: [30, 64, 175] as [number, number, number],
    headerText: [255, 255, 255] as [number, number, number],
    rowAlt: [248, 250, 252] as [number, number, number],
    softBand: [241, 245, 249] as [number, number, number],
    paidBg: [236, 253, 245] as [number, number, number],
    paidInk: [6, 95, 70] as [number, number, number],
    partialBg: [255, 251, 235] as [number, number, number],
    partialInk: [146, 64, 14] as [number, number, number],
    pendingBg: [254, 242, 242] as [number, number, number],
    pendingInk: [153, 27, 27] as [number, number, number],
    totalBg: [239, 246, 255] as [number, number, number],
    grid: [148, 163, 184] as [number, number, number],
}

export type TuitionReportRowStatus = 'Pago' | 'Parcial' | 'Pendente'

export interface TuitionReportStudent {
    id: string
    numero_processo: string
    nome_completo: string
    turma_id?: string
    turma_nome?: string
}

export interface GenerateTuitionPaymentsReportParams {
    alunos: TuitionReportStudent[]
    pagamentos: PagamentoPropina[]
    mes: number
    ano: number
    valorMensalidade: number
    headerConfig: HeaderConfig | null
    escola?: EscolaProfile | null
    turmaFiltroNome?: string
}

function resolveStatus(valorPago: number, valorMensalidade: number): TuitionReportRowStatus {
    if (valorPago <= 0) return 'Pendente'
    if (valorPago >= valorMensalidade) return 'Pago'
    return 'Parcial'
}

function statusColors(status: TuitionReportRowStatus) {
    if (status === 'Pago') return { bg: COLORS.paidBg, ink: COLORS.paidInk }
    if (status === 'Parcial') return { bg: COLORS.partialBg, ink: COLORS.partialInk }
    return { bg: COLORS.pendingBg, ink: COLORS.pendingInk }
}

/**
 * Personalized Excel-style tuition payments report (PDF)
 */
export async function generateTuitionPaymentsReportPDF(
    params: GenerateTuitionPaymentsReportParams
): Promise<void> {
    const {
        alunos,
        pagamentos,
        mes,
        ano,
        valorMensalidade,
        headerConfig,
        escola,
        turmaFiltroNome,
    } = params

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 12
    const contentWidth = pageWidth - margin * 2

    const escolaData = escola
        ? {
            nome: escola.nome,
            provincia: escola.provincia,
            municipio: escola.municipio,
        }
        : undefined

    let currentY = await renderOfficialSchoolHeader(doc, headerConfig, escolaData, pageWidth, margin)

    // Title band
    doc.setFillColor(...COLORS.softBand)
    doc.rect(margin, currentY, contentWidth, 12, 'F')
    doc.setDrawColor(...COLORS.line)
    doc.setLineWidth(0.3)
    doc.rect(margin, currentY, contentWidth, 12, 'S')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...COLORS.ink)
    doc.text('RELATÓRIO DE PAGAMENTO DE PROPINAS', pageWidth / 2, currentY + 5, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.muted)
    doc.text('Mapa mensal de cobrança · formato planilha', pageWidth / 2, currentY + 9.5, { align: 'center' })
    currentY += 16

    // Meta strip (filter context)
    const metaH = 10
    doc.setDrawColor(...COLORS.line)
    doc.setFillColor(255, 255, 255)
    doc.rect(margin, currentY, contentWidth, metaH, 'FD')

    const colW = contentWidth / 4
    const metaItems = [
        { label: 'Período', value: `${getNomeMes(mes)} ${ano}` },
        { label: 'Turma', value: turmaFiltroNome || 'Todas as turmas' },
        { label: 'Mensalidade', value: formatarValor(valorMensalidade) },
        { label: 'Alunos', value: String(alunos.length) },
    ]

    metaItems.forEach((item, i) => {
        const x = margin + i * colW
        if (i > 0) {
            doc.setDrawColor(...COLORS.line)
            doc.line(x, currentY + 1.5, x, currentY + metaH - 1.5)
        }
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.5)
        doc.setTextColor(...COLORS.muted)
        doc.text(item.label.toUpperCase(), x + 3, currentY + 3.5)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.setTextColor(...COLORS.ink)
        doc.text(item.value, x + 3, currentY + 8)
    })
    currentY += metaH + 5

    // Build spreadsheet rows
    const sorted = [...alunos].sort((a, b) => {
        const t = (a.turma_nome || '').localeCompare(b.turma_nome || '', 'pt')
        if (t !== 0) return t
        return a.nome_completo.localeCompare(b.nome_completo, 'pt')
    })

    let totalEsperado = 0
    let totalPago = 0
    let countPago = 0
    let countParcial = 0
    let countPendente = 0

    const tableBody = sorted.map((student, index) => {
        const paymentsForMonth = pagamentos.filter(
            (p) =>
                p.aluno_id === student.id &&
                p.mes_referencia === mes &&
                p.ano_referencia === ano &&
                p.estado === 'valido'
        )
        const valorPago = paymentsForMonth.reduce((sum, p) => sum + p.valor, 0)
        const esperado = valorMensalidade
        const emFalta = Math.max(0, esperado - valorPago)
        const status = resolveStatus(valorPago, esperado)
        const lastPayment = paymentsForMonth
            .slice()
            .sort((a, b) => new Date(b.data_pagamento).getTime() - new Date(a.data_pagamento).getTime())[0]

        totalEsperado += esperado
        totalPago += valorPago
        if (status === 'Pago') countPago += 1
        else if (status === 'Parcial') countParcial += 1
        else countPendente += 1

        return [
            String(index + 1),
            student.numero_processo || '—',
            student.nome_completo,
            student.turma_nome || '—',
            formatarValor(esperado),
            valorPago > 0 ? formatarValor(valorPago) : '—',
            emFalta > 0 ? formatarValor(emFalta) : '—',
            status,
            lastPayment
                ? new Date(lastPayment.data_pagamento).toLocaleDateString('pt-AO')
                : '—',
        ]
    })

    const totalEmFalta = Math.max(0, totalEsperado - totalPago)
    const taxa = totalEsperado > 0 ? (totalPago / totalEsperado) * 100 : 0

    autoTable(doc, {
        startY: currentY,
        head: [[
            'Nº',
            'Nº Processo',
            'Nome Completo',
            'Turma',
            'Esperado',
            'Pago',
            'Em Falta',
            'Estado',
            'Data Pag.',
        ]],
        body: tableBody,
        foot: [[
            '',
            '',
            `TOTAIS (${sorted.length} alunos)`,
            '',
            formatarValor(totalEsperado),
            formatarValor(totalPago),
            formatarValor(totalEmFalta),
            `${taxa.toFixed(1)}%`,
            '',
        ]],
        theme: 'grid',
        margin: { left: margin, right: margin, bottom: 22 },
        styles: {
            font: 'helvetica',
            fontSize: 7.5,
            cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
            textColor: COLORS.ink,
            lineColor: COLORS.grid,
            lineWidth: 0.2,
            valign: 'middle',
            overflow: 'linebreak',
        },
        headStyles: {
            fillColor: COLORS.headerBg,
            textColor: COLORS.headerText,
            fontStyle: 'bold',
            fontSize: 7.5,
            halign: 'center',
            valign: 'middle',
            lineColor: [37, 99, 235],
            lineWidth: 0.25,
        },
        bodyStyles: {
            fillColor: [255, 255, 255],
        },
        alternateRowStyles: {
            fillColor: COLORS.rowAlt,
        },
        footStyles: {
            fillColor: COLORS.totalBg,
            textColor: COLORS.ink,
            fontStyle: 'bold',
            fontSize: 7.5,
            lineColor: COLORS.grid,
            lineWidth: 0.25,
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 26, halign: 'center' },
            2: { cellWidth: 'auto', halign: 'left' },
            3: { cellWidth: 32, halign: 'left' },
            4: { cellWidth: 28, halign: 'right' },
            5: { cellWidth: 28, halign: 'right' },
            6: { cellWidth: 28, halign: 'right' },
            7: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
            8: { cellWidth: 24, halign: 'center' },
        },
        didParseCell: (data) => {
            if (data.section !== 'body') return
            // Status column coloring (Excel conditional formatting feel)
            if (data.column.index === 7) {
                const status = String(data.cell.raw || '') as TuitionReportRowStatus
                const c = statusColors(status)
                data.cell.styles.fillColor = c.bg
                data.cell.styles.textColor = c.ink
            }
            // Em falta highlight when > 0
            if (data.column.index === 6 && String(data.cell.raw) !== '—') {
                data.cell.styles.textColor = COLORS.pendingInk
            }
            // Pago column green when has value
            if (data.column.index === 5 && String(data.cell.raw) !== '—') {
                data.cell.styles.textColor = COLORS.paidInk
            }
        },
        didDrawPage: (data) => {
            // Spreadsheet top rule under header on continued pages
            if (data.pageNumber > 1) {
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(9)
                doc.setTextColor(...COLORS.ink)
                doc.text(
                    `Relatório de Propinas · ${getNomeMes(mes)} ${ano}`,
                    margin,
                    10
                )
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(7)
                doc.setTextColor(...COLORS.muted)
                doc.text(turmaFiltroNome || 'Todas as turmas', pageWidth - margin, 10, { align: 'right' })
            }
        },
    })

    const finalY = (doc as any).lastAutoTable?.finalY || currentY + 20
    let summaryY = finalY + 6

    // Summary cards row (dashboard strip under the sheet)
    if (summaryY + 28 > pageHeight - 18) {
        doc.addPage()
        summaryY = 16
    }

    const cardGap = 3
    const cardW = (contentWidth - cardGap * 3) / 4
    const cardH = 16
    const cards = [
        { title: 'Pagos', value: String(countPago), tone: COLORS.paidInk, bg: COLORS.paidBg },
        { title: 'Parciais', value: String(countParcial), tone: COLORS.partialInk, bg: COLORS.partialBg },
        { title: 'Pendentes', value: String(countPendente), tone: COLORS.pendingInk, bg: COLORS.pendingBg },
        { title: 'Taxa de cobrança', value: `${taxa.toFixed(1)}%`, tone: COLORS.headerBg, bg: COLORS.totalBg },
    ]

    cards.forEach((card, i) => {
        const x = margin + i * (cardW + cardGap)
        doc.setFillColor(...card.bg)
        doc.setDrawColor(...COLORS.line)
        doc.setLineWidth(0.3)
        doc.roundedRect(x, summaryY, cardW, cardH, 1.5, 1.5, 'FD')

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.5)
        doc.setTextColor(...COLORS.muted)
        doc.text(card.title.toUpperCase(), x + 3, summaryY + 5)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(...card.tone)
        doc.text(card.value, x + 3, summaryY + 12)
    })

    summaryY += cardH + 8

    // Signature lines
    if (summaryY + 22 > pageHeight - 16) {
        doc.addPage()
        summaryY = 16
    }

    const sigW = (contentWidth - 20) / 2
    doc.setDrawColor(...COLORS.muted)
    doc.setLineWidth(0.4)
    doc.line(margin + 8, summaryY + 12, margin + sigW - 8, summaryY + 12)
    doc.line(margin + sigW + 28, summaryY + 12, pageWidth - margin - 8, summaryY + 12)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...COLORS.muted)
    doc.text('Tesouraria / Secretaria', margin + sigW / 2, summaryY + 16, { align: 'center' })
    doc.text('Direcção da Escola', margin + sigW + 20 + sigW / 2, summaryY + 16, { align: 'center' })

    applyStandardPdfFooters(doc, { dateLocale: 'pt-AO' })

    const turmaSlug = (turmaFiltroNome || 'todas-turmas')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')

    doc.save(`Relatorio_Propinas_${getNomeMes(mes)}_${ano}_${turmaSlug}.pdf`)
}

/**
 * Helper to map page alunos + turmas into report rows
 */
export function mapAlunosToReportRows(
    alunos: Array<Aluno & { turma?: { nome?: string }; turmas?: { nome?: string } }>,
    turmas: Array<{ id: string; nome: string }>
): TuitionReportStudent[] {
    return alunos.map((a) => {
        const nested = (a as any).turma?.nome || (a as any).turmas?.nome
        const fromList = turmas.find((t) => t.id === a.turma_id)?.nome
        return {
            id: a.id,
            numero_processo: a.numero_processo,
            nome_completo: a.nome_completo,
            turma_id: a.turma_id,
            turma_nome: nested || fromList || undefined,
        }
    })
}
