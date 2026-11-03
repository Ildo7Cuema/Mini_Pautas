import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { HeaderConfig, getOrgaoEducacao } from './headerConfigUtils'
import { imageUrlToBase64, getImageFormat } from './imageUtils'
import { PagamentoPropina, EscolaProfile } from '../types'
import { formatarValor, getNomeMes, getMetodoPagamentoLabel } from './tuitionPayments'

const COLORS = {
    ink: [15, 23, 42] as [number, number, number],
    muted: [100, 116, 139] as [number, number, number],
    line: [203, 213, 225] as [number, number, number],
    headerBg: [30, 64, 175] as [number, number, number], // primary-ish blue
    rowAlt: [248, 250, 252] as [number, number, number],
    totalBg: [236, 253, 245] as [number, number, number],
    totalInk: [6, 95, 70] as [number, number, number],
    annulBg: [254, 226, 226] as [number, number, number],
    annulInk: [185, 28, 28] as [number, number, number],
    softBand: [241, 245, 249] as [number, number, number],
}

/**
 * Official school header for the receipt
 */
async function renderReceiptHeader(
    doc: jsPDF,
    headerConfig: HeaderConfig | null | undefined,
    escola: { nome: string; provincia: string; municipio: string } | undefined,
    pageWidth: number,
    margin: number
): Promise<number> {
    let currentY = 14

    if (headerConfig) {
        if (headerConfig.logo_url) {
            try {
                const base64Image = await imageUrlToBase64(headerConfig.logo_url)
                const imageFormat = getImageFormat(headerConfig.logo_url)

                const maxLogoSize = 22
                const logoWidthPx = headerConfig.logo_width || 50
                const logoHeightPx = headerConfig.logo_height || 50

                let logoWidth = logoWidthPx * 0.26
                let logoHeight = logoHeightPx * 0.26

                if (logoWidth > maxLogoSize || logoHeight > maxLogoSize) {
                    const scale = Math.min(maxLogoSize / logoWidth, maxLogoSize / logoHeight)
                    logoWidth *= scale
                    logoHeight *= scale
                }

                const logoX = (pageWidth - logoWidth) / 2
                doc.addImage(base64Image, imageFormat, logoX, currentY, logoWidth, logoHeight)
                currentY += logoHeight + 3
            } catch (err) {
                console.error('Error adding logo to PDF:', err)
            }
        }

        const fontSize = Math.min(headerConfig.tamanho_fonte_outros || 9, 10)
        doc.setFontSize(fontSize)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...COLORS.ink)

        if (headerConfig.mostrar_republica && headerConfig.texto_republica) {
            doc.text(headerConfig.texto_republica, pageWidth / 2, currentY, { align: 'center' })
            currentY += fontSize * 0.45
        }

        if (headerConfig.mostrar_governo_provincial && headerConfig.provincia) {
            doc.text(`Governo Provincial da ${headerConfig.provincia}`, pageWidth / 2, currentY, { align: 'center' })
            currentY += fontSize * 0.45
        }

        if (headerConfig.mostrar_orgao_educacao && headerConfig.nivel_ensino) {
            const orgaoText = getOrgaoEducacao(
                headerConfig.nivel_ensino,
                headerConfig.provincia,
                headerConfig.municipio
            )
            doc.text(orgaoText, pageWidth / 2, currentY, { align: 'center' })
            currentY += fontSize * 0.45
        }

        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text(headerConfig.nome_escola, pageWidth / 2, currentY, { align: 'center' })
        currentY += 5

        if (headerConfig.municipio || headerConfig.provincia) {
            doc.setFontSize(8)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(...COLORS.muted)
            const local = [headerConfig.municipio, headerConfig.provincia].filter(Boolean).join(' · ')
            doc.text(local, pageWidth / 2, currentY, { align: 'center' })
            currentY += 4
        }
    } else if (escola) {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...COLORS.ink)
        doc.text('REPÚBLICA DE ANGOLA', pageWidth / 2, currentY, { align: 'center' })
        currentY += 4.5
        doc.text(`GOVERNO PROVINCIAL DE ${escola.provincia.toUpperCase()}`, pageWidth / 2, currentY, { align: 'center' })
        currentY += 5

        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text(escola.nome.toUpperCase(), pageWidth / 2, currentY, { align: 'center' })
        currentY += 4

        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...COLORS.muted)
        doc.text(`${escola.municipio} · ${escola.provincia}`, pageWidth / 2, currentY, { align: 'center' })
        currentY += 4
    }

    // Double rule under header (Excel-like document feel)
    doc.setDrawColor(...COLORS.headerBg)
    doc.setLineWidth(1.1)
    doc.line(margin, currentY, pageWidth - margin, currentY)
    doc.setLineWidth(0.3)
    doc.line(margin, currentY + 1.6, pageWidth - margin, currentY + 1.6)
    currentY += 8

    return currentY
}

/**
 * Generate a personalized, Excel-style tuition receipt PDF
 */
export async function generateReceiptPDF(
    pagamento: PagamentoPropina,
    headerConfig: HeaderConfig | null,
    escola: EscolaProfile | undefined
): Promise<void> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 16
    const contentWidth = pageWidth - margin * 2

    const escolaData = escola
        ? {
            nome: escola.nome,
            provincia: escola.provincia,
            municipio: escola.municipio
        }
        : undefined

    let currentY = await renderReceiptHeader(doc, headerConfig, escolaData, pageWidth, margin)

    // Watermark for annulled receipts
    if (pagamento.estado === 'anulado') {
        doc.saveGraphicsState()
        doc.setTextColor(255, 210, 210)
        doc.setFontSize(48)
        doc.setFont('helvetica', 'bold')
        doc.text('ANULADO', pageWidth / 2, pageHeight / 2, {
            angle: 45,
            align: 'center',
            renderingMode: 'fill'
        })
        doc.restoreGraphicsState()
    }

    // Title band (compact)
    doc.setFillColor(...COLORS.softBand)
    doc.rect(margin, currentY, contentWidth, 12, 'F')
    doc.setDrawColor(...COLORS.line)
    doc.setLineWidth(0.3)
    doc.rect(margin, currentY, contentWidth, 12, 'S')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...COLORS.ink)
    doc.text('RECIBO DE PAGAMENTO DE PROPINA', pageWidth / 2, currentY + 5, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...COLORS.muted)
    doc.text('Comprovativo oficial de recebimento', pageWidth / 2, currentY + 9.5, { align: 'center' })
    currentY += 15

    // Meta strip: recibo + estado
    const metaH = 9
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...COLORS.line)
    doc.rect(margin, currentY, contentWidth * 0.62, metaH, 'S')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...COLORS.muted)
    doc.text('N.º DO RECIBO', margin + 3, currentY + 3.2)
    doc.setFont('courier', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.headerBg)
    doc.text(pagamento.numero_recibo, margin + 3, currentY + 7.2)

    const estadoW = contentWidth * 0.38
    const estadoX = margin + contentWidth * 0.62
    const isAnulado = pagamento.estado === 'anulado'
    doc.setFillColor(...(isAnulado ? COLORS.annulBg : COLORS.totalBg))
    doc.rect(estadoX, currentY, estadoW, metaH, 'F')
    doc.setDrawColor(...(isAnulado ? COLORS.annulInk : COLORS.totalInk))
    doc.rect(estadoX, currentY, estadoW, metaH, 'S')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...(isAnulado ? COLORS.annulInk : COLORS.totalInk))
    doc.text(isAnulado ? 'ESTADO: ANULADO' : 'ESTADO: VÁLIDO', estadoX + estadoW / 2, currentY + 5.8, { align: 'center' })
    currentY += metaH + 5

    // Resolve student / class labels
    const alunoNome = pagamento.aluno?.nome_completo || '—'
    const processo = pagamento.aluno?.numero_processo || '—'
    const turmaInfo =
        (pagamento.aluno as any)?.turmas ||
        (pagamento.aluno as any)?.turma ||
        null
    const turmaNome = turmaInfo
        ? [turmaInfo.nome, turmaInfo.codigo_turma ? `(${turmaInfo.codigo_turma})` : null]
            .filter(Boolean)
            .join(' ')
        : '—'
    const dataPagamento = new Date(pagamento.data_pagamento)
    const dataFmt = dataPagamento.toLocaleDateString('pt-AO', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    })
    const horaFmt = dataPagamento.toLocaleTimeString('pt-AO', {
        hour: '2-digit',
        minute: '2-digit'
    })
    const periodo = `${getNomeMes(pagamento.mes_referencia)} / ${pagamento.ano_referencia}`
    const metodo = getMetodoPagamentoLabel(pagamento.metodo_pagamento)
    const escolaNome = headerConfig?.nome_escola || escola?.nome || 'Escola'

    // Compact row padding — frees space for a clear legal signature area
    const tablePad = { top: 1.15, bottom: 1.15, left: 2.5, right: 2.5 }
    const sectionGap = 4.5

    // Section: Identificação do aluno
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.headerBg)
    doc.text('1. IDENTIFICAÇÃO DO ALUNO', margin, currentY)
    currentY += 1.5

    autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        theme: 'grid',
        styles: {
            font: 'helvetica',
            fontSize: 8.5,
            cellPadding: tablePad,
            lineColor: COLORS.line,
            lineWidth: 0.25,
            textColor: COLORS.ink,
            valign: 'middle',
            minCellHeight: 5.2
        },
        columnStyles: {
            0: { cellWidth: contentWidth * 0.32, fillColor: COLORS.rowAlt, fontStyle: 'bold', textColor: COLORS.muted, fontSize: 7.5 },
            1: { cellWidth: contentWidth * 0.68, fontStyle: 'bold' }
        },
        body: [
            ['Nome completo', alunoNome],
            ['N.º de processo', processo],
            ['Turma', turmaNome],
            ['Escola', escolaNome]
        ],
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 0) {
                data.cell.styles.fontStyle = 'bold'
                data.cell.styles.textColor = COLORS.muted
                data.cell.styles.fillColor = COLORS.rowAlt
            }
        }
    })

    currentY = ((doc as any).lastAutoTable?.finalY || currentY) + sectionGap

    // Section: Detalhes do pagamento
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.headerBg)
    doc.text('2. DETALHES DO PAGAMENTO', margin, currentY)
    currentY += 1.5

    autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        theme: 'grid',
        styles: {
            font: 'helvetica',
            fontSize: 8.5,
            cellPadding: tablePad,
            lineColor: COLORS.line,
            lineWidth: 0.25,
            textColor: COLORS.ink,
            valign: 'middle',
            minCellHeight: 5.2
        },
        columnStyles: {
            0: { cellWidth: contentWidth * 0.32, fillColor: COLORS.rowAlt, fontStyle: 'bold', textColor: COLORS.muted, fontSize: 7.5 },
            1: { cellWidth: contentWidth * 0.68, fontStyle: 'bold' }
        },
        body: [
            ['Período / mês referente', periodo],
            ['Método de pagamento', metodo],
            ['Data do pagamento', `${dataFmt} · ${horaFmt}`],
            ['Tipo de documento', pagamento.tipo_documento || 'RG — Recibo'],
            ['Observação', pagamento.observacao?.trim() || '—']
        ],
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 0) {
                data.cell.styles.fontStyle = 'bold'
                data.cell.styles.textColor = COLORS.muted
                data.cell.styles.fillColor = COLORS.rowAlt
            }
        }
    })

    currentY = ((doc as any).lastAutoTable?.finalY || currentY) + sectionGap

    // Section: Resumo financeiro
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.headerBg)
    doc.text('3. RESUMO FINANCEIRO', margin, currentY)
    currentY += 1.5

    autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        theme: 'grid',
        styles: {
            font: 'helvetica',
            fontSize: 8.5,
            cellPadding: { top: 1.3, bottom: 1.3, left: 2.5, right: 2.5 },
            lineColor: COLORS.line,
            lineWidth: 0.25,
            textColor: COLORS.ink,
            valign: 'middle',
            minCellHeight: 5.4
        },
        head: [['Descrição', 'Qtd.', 'Valor (Kz)']],
        headStyles: {
            fillColor: COLORS.headerBg,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7.5,
            halign: 'center',
            cellPadding: { top: 1.2, bottom: 1.2, left: 2, right: 2 },
            minCellHeight: 5
        },
        columnStyles: {
            0: { cellWidth: contentWidth * 0.54, halign: 'left' },
            1: { cellWidth: contentWidth * 0.14, halign: 'center' },
            2: { cellWidth: contentWidth * 0.32, halign: 'right', fontStyle: 'bold' }
        },
        body: [
            [
                `Propina — ${periodo}`,
                '1',
                formatarValor(pagamento.valor)
            ]
        ],
        foot: [[
            { content: 'TOTAL RECEBIDO', styles: { fontStyle: 'bold', fillColor: COLORS.totalBg, textColor: COLORS.totalInk, cellPadding: { top: 1.4, bottom: 1.4, left: 2.5, right: 2.5 } } },
            { content: '', styles: { fillColor: COLORS.totalBg } },
            {
                content: formatarValor(pagamento.valor),
                styles: {
                    fontStyle: 'bold',
                    fillColor: COLORS.totalBg,
                    textColor: COLORS.totalInk,
                    halign: 'right',
                    fontSize: 9.5,
                    cellPadding: { top: 1.4, bottom: 1.4, left: 2.5, right: 2.5 }
                }
            }
        ]],
        footStyles: {
            fillColor: COLORS.totalBg,
            textColor: COLORS.totalInk,
            fontStyle: 'bold'
        }
    })

    currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 3.5

    // Compact reference strip
    doc.setFillColor(...COLORS.softBand)
    doc.setDrawColor(...COLORS.line)
    doc.roundedRect(margin, currentY, contentWidth, 7, 1, 1, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...COLORS.muted)
    doc.text('Referência:', margin + 2.5, currentY + 4.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.ink)
    doc.text(`${formatarValor(pagamento.valor)} — Propina ${periodo}`, margin + 22, currentY + 4.5)
    currentY += 10

    // Annulment block
    if (isAnulado && pagamento.motivo_anulacao) {
        doc.setFillColor(...COLORS.annulBg)
        doc.setDrawColor(...COLORS.annulInk)
        doc.roundedRect(margin, currentY, contentWidth, 14, 1.2, 1.2, 'FD')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(...COLORS.annulInk)
        doc.text('DETALHES DA ANULAÇÃO', margin + 2.5, currentY + 4)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...COLORS.ink)
        const motivoLines = doc.splitTextToSize(`Motivo: ${pagamento.motivo_anulacao}`, contentWidth - 5)
        doc.setFontSize(7.5)
        doc.text(motivoLines, margin + 2.5, currentY + 8)
        currentY += 16
    }

    // Signatures: ALWAYS below content (never pulled upward over tables)
    const footerReserve = 36
    const signatureBlockHeight = 40
    const footerTop = pageHeight - footerReserve
    const minGapAfterContent = 8

    let sigY = currentY + minGapAfterContent
    // If signatures would collide with footer, keep them after content —
    // the compacted tables should leave enough room on a normal receipt.
    const signaturesEnd = sigY + signatureBlockHeight
    if (signaturesEnd > footerTop - 4) {
        // Soft clamp only when there is still clear space after the tables
        const roomAfterContent = footerTop - 4 - signatureBlockHeight
        if (roomAfterContent > currentY + 3) {
            sigY = roomAfterContent
        }
        // else: leave sigY after content; footer may sit closer but won't cover tables
    }

    // Modern signature zone label
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.headerBg)
    doc.text('4. ASSINATURAS', margin, sigY)
    sigY += 4

    doc.setDrawColor(...COLORS.line)
    doc.setLineWidth(0.25)
    doc.line(margin, sigY, pageWidth - margin, sigY)
    sigY += 5

    const sigWidth = (contentWidth - 14) / 2
    const leftSigCenter = margin + sigWidth / 2
    const rightSigCenter = margin + sigWidth + 14 + sigWidth / 2
    const lineY = sigY + 18

    // Light boxes for a clean legal signature area
    doc.setDrawColor(...COLORS.line)
    doc.setFillColor(255, 255, 255)
    doc.setLineWidth(0.3)
    doc.roundedRect(margin, sigY, sigWidth, 28, 1.2, 1.2, 'S')
    doc.roundedRect(margin + sigWidth + 14, sigY, sigWidth, 28, 1.2, 1.2, 'S')

    doc.setDrawColor(...COLORS.muted)
    doc.setLineWidth(0.35)
    doc.line(margin + 8, lineY, margin + sigWidth - 8, lineY)
    doc.line(margin + sigWidth + 22, lineY, pageWidth - margin - 8, lineY)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...COLORS.muted)
    doc.text('O(A) Encarregado / Pagador', leftSigCenter, lineY + 5, { align: 'center' })
    doc.text('A Direcção / Tesouraria', rightSigCenter, lineY + 5, { align: 'center' })
    doc.setFontSize(6.5)
    doc.text(escolaNome, rightSigCenter, lineY + 9, { align: 'center' })

    // AGT / technical footer — reserved bottom band
    const hashText = pagamento.hash || '—'
    doc.setFont('courier', 'normal')
    doc.setFontSize(6)
    const hashLines: string[] = doc.splitTextToSize(`Hash: ${hashText}`, contentWidth - 36)
    const hashBlockH = Math.max(hashLines.length, 1) * 2.9
    const footerY = footerTop + 5

    doc.setDrawColor(...COLORS.line)
    doc.setLineWidth(0.35)
    doc.setLineDashPattern([1.2, 1.2], 0)
    doc.line(margin, footerTop, pageWidth - margin, footerTop)
    doc.setLineDashPattern([], 0)

    doc.setTextColor(...COLORS.muted)
    doc.text(hashLines, margin, footerY)

    if (pagamento.hash_control) {
        doc.setFont('courier', 'bold')
        doc.text(`Ctrl: ${pagamento.hash_control}`, pageWidth - margin, footerY, { align: 'right' })
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...COLORS.muted)
    const certText = pagamento.sistema_certificado || 'Processado por programa válido n31.1/AGT20'
    const certY = footerY + hashBlockH + 2.5
    doc.text(certText, pageWidth / 2, certY, { align: 'center' })
    doc.text(
        `Emitido em ${new Date().toLocaleString('pt-AO')} · Original · ${escolaNome}`,
        pageWidth / 2,
        certY + 4,
        { align: 'center' }
    )

    doc.save(`Recibo_${pagamento.numero_recibo}.pdf`)
}
