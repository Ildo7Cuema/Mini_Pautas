import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { applyStandardPdfFooters } from '../../../utils/pdfFooter'
import { renderOfficialSchoolHeader } from '../../../utils/receiptGenerator'
import {
    type HeaderConfig,
    resolveMapHeaderColor,
} from '../../../utils/headerConfigUtils'
import { labelMencao } from './classificacao'
import { PERIODO_LABELS, ESTADO_AVALIACAO_LABELS } from './indicadoresSeed'
import type { MapaGeralLinha } from '../types'

function hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace('#', '')
    if (clean.length !== 6) return [30, 64, 175]
    return [
        parseInt(clean.slice(0, 2), 16),
        parseInt(clean.slice(2, 4), 16),
        parseInt(clean.slice(4, 6), 16),
    ]
}

export interface MapaPdfMeta {
    escolaNome: string
    anoReferencia: string
    provincia?: string | null
    municipio?: string | null
    headerConfig?: HeaderConfig | null
}

/** Art. 32.º — mapa geral por ordem alfabética (cabeçalho das Configurações). */
export async function exportMapaGeralPdf(
    linhas: MapaGeralLinha[],
    meta: MapaPdfMeta,
): Promise<void> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 14

    const escolaFallback = {
        nome: meta.escolaNome,
        provincia: meta.provincia || meta.headerConfig?.provincia || '',
        municipio: meta.municipio || meta.headerConfig?.municipio || '',
    }

    let y = await renderOfficialSchoolHeader(
        doc,
        meta.headerConfig,
        escolaFallback,
        pageWidth,
        margin,
    )

    doc.setTextColor(20, 20, 20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('Mapa Geral de Avaliação de Desempenho', pageWidth / 2, y, {
        align: 'center',
    })
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('Decreto Presidencial n.º 28/22 — Art. 32.º', pageWidth / 2, y, {
        align: 'center',
    })
    y += 4
    doc.setFontSize(8)
    doc.text(`Ano de referência: ${meta.anoReferencia}`, pageWidth / 2, y, {
        align: 'center',
    })
    y += 4

    const headRgb = hexToRgb(resolveMapHeaderColor(meta.headerConfig))

    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['N.º', 'Nome', 'Categoria', 'Período', 'Classificação', 'Menção', 'Estado']],
        body: linhas.map((l, i) => [
            String(i + 1),
            l.nome,
            l.categoria,
            PERIODO_LABELS[l.periodo],
            l.classificacao_final != null ? String(l.classificacao_final) : '—',
            labelMencao(l.mencao),
            ESTADO_AVALIACAO_LABELS[l.estado],
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: headRgb, textColor: [255, 255, 255] },
    })

    applyStandardPdfFooters(doc, { dateLocale: 'pt-AO' })

    const filename = `mapa-geral-avaliacao_${meta.anoReferencia.replace(/\//g, '-')}.pdf`
    doc.save(filename)
}

export function exportMapaGeralExcel(
    linhas: MapaGeralLinha[],
    meta: { escolaNome: string; anoReferencia: string },
) {
    const rows = linhas.map((l, i) => ({
        'N.º': i + 1,
        Nome: l.nome,
        Categoria: l.categoria,
        Tipo: l.avaliado_tipo,
        Período: PERIODO_LABELS[l.periodo],
        'Classificação final': l.classificacao_final ?? '',
        Menção: labelMencao(l.mencao),
        Estado: ESTADO_AVALIACAO_LABELS[l.estado],
        'Ano de referência': l.ano_referencia || meta.anoReferencia,
        Escola: meta.escolaNome,
        Diploma: 'Decreto Presidencial n.º 28/22 — Art. 32.º',
    }))

    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, sheet, 'Mapa Geral')
    const filename = `mapa-geral-avaliacao_${meta.anoReferencia.replace(/\//g, '-')}.xlsx`
    XLSX.writeFile(workbook, filename)
}
