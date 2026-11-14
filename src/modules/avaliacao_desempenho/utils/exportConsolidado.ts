/**
 * Export Excel / PDF do consolidado de avaliação (tutela DME / Provincial).
 * PDF: cabeçalho oficial + tabelas estilo Excel (autoTable).
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { applyStandardPdfFooters } from '../../../utils/pdfFooter'
import { renderOfficialSchoolHeader } from '../../../utils/receiptGenerator'
import {
    type HeaderConfig,
    resolveMapHeaderColor,
} from '../../../utils/headerConfigUtils'
import { MENCAO_LABELS } from './classificacao'
import type { ConsolidadoAvaliacaoTutela } from '../types'

function hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace('#', '')
    if (clean.length !== 6) return [76, 29, 149]
    return [
        parseInt(clean.slice(0, 2), 16),
        parseInt(clean.slice(2, 4), 16),
        parseInt(clean.slice(4, 6), 16),
    ]
}

export interface ConsolidadoExportMeta {
    titulo: string
    orgaoNome: string
    provincia?: string | null
    municipio?: string | null
    /** Cor do cabeçalho das tabelas (#RRGGBB). */
    corCabecalho?: string | null
}

function buildTutelaHeaderConfig(meta: ConsolidadoExportMeta): HeaderConfig {
    return {
        nome_escola: meta.orgaoNome,
        mostrar_republica: true,
        texto_republica: 'REPÚBLICA DE ANGOLA',
        mostrar_governo_provincial: Boolean(meta.provincia),
        provincia: meta.provincia || undefined,
        mostrar_orgao_educacao: false,
        municipio: meta.municipio || undefined,
        cor_cabecalho_mapa: meta.corCabecalho || '#4c1d95',
        tamanho_fonte_outros: 9,
    }
}

function fileSafe(value: string): string {
    return value.replace(/[^\w\-]+/g, '_').replace(/_+/g, '_')
}

export function exportConsolidadoAvaliacaoExcel(
    data: ConsolidadoAvaliacaoTutela,
    meta: ConsolidadoExportMeta,
): void {
    const workbook = XLSX.utils.book_new()

    const resumo = [
        ['REPÚBLICA DE ANGOLA'],
        [meta.orgaoNome],
        [meta.titulo],
        [`Âmbito: ${data.territorio}`],
        [`Ano de referência: ${data.ano_referencia || '—'}`],
        [`Diploma: Decreto Presidencial n.º 28/22 — Art. 32.º`],
        [],
        ['Indicador', 'Valor'],
        ['Escolas', data.total_escolas],
        ['Escolas com ciclo', data.escolas_com_ciclo],
        ['Total fichas (mapa)', data.total_fichas],
        ['Concluídas / assinadas', data.concluidas],
        ['Pendentes', data.pendentes],
        ['% conclusão', data.pct_conclusao],
        ['Média classificação', data.media_classificacao ?? '—'],
        [MENCAO_LABELS.MUITO_BOM, data.mencoes.MUITO_BOM],
        [MENCAO_LABELS.BOM, data.mencoes.BOM],
        [MENCAO_LABELS.SUFICIENTE, data.mencoes.SUFICIENTE],
        [MENCAO_LABELS.MAU, data.mencoes.MAU],
    ]
    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(resumo),
        'Resumo',
    )

    if (data.por_municipio?.length) {
        const munRows = data.por_municipio.map((m, i) => ({
            'N.º': i + 1,
            Município: m.municipio,
            Escolas: m.total_escolas,
            'Com ciclo': m.escolas_com_ciclo,
            Fichas: m.total_fichas,
            Concluídas: m.concluidas,
            '% conclusão': m.pct_conclusao,
            'Média CF': m.media_classificacao ?? '',
        }))
        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.json_to_sheet(munRows),
            'Por município',
        )
    }

    const escolaRows = data.por_escola.map((e, i) => ({
        'N.º': i + 1,
        Escola: e.escola_nome,
        Município: e.municipio,
        Província: e.provincia,
        'Ano ref.': e.ano_referencia ?? '',
        'Estado ciclo': e.ciclo_estado ?? 'Sem ciclo',
        Fichas: e.total_fichas,
        Concluídas: e.concluidas,
        Pendentes: e.pendentes,
        '% conclusão': e.pct_conclusao,
        'Média CF': e.media_classificacao ?? '',
        [MENCAO_LABELS.MUITO_BOM]: e.mencoes.MUITO_BOM,
        [MENCAO_LABELS.BOM]: e.mencoes.BOM,
        [MENCAO_LABELS.SUFICIENTE]: e.mencoes.SUFICIENTE,
        [MENCAO_LABELS.MAU]: e.mencoes.MAU,
    }))
    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(escolaRows),
        'Por escola',
    )

    const safeTerr = fileSafe(data.territorio)
    const safeAno = fileSafe(data.ano_referencia || 'sem-ano').replace(/\//g, '-')
    XLSX.writeFile(
        workbook,
        `consolidado-avaliacao_${safeTerr}_${safeAno}.xlsx`,
    )
}

/** PDF consolidado — cabeçalho oficial + tabelas Excel-like. */
export async function exportConsolidadoAvaliacaoPdf(
    data: ConsolidadoAvaliacaoTutela,
    meta: ConsolidadoExportMeta,
): Promise<void> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 12
    const headerConfig = buildTutelaHeaderConfig(meta)
    const headRgb = hexToRgb(resolveMapHeaderColor(headerConfig, '#4c1d95'))

    let y = await renderOfficialSchoolHeader(
        doc,
        headerConfig,
        {
            nome: meta.orgaoNome,
            provincia: meta.provincia || '',
            municipio: meta.municipio || data.territorio,
        },
        pageWidth,
        margin,
    )

    doc.setTextColor(20, 20, 20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('Consolidado de Avaliação de Desempenho', pageWidth / 2, y, {
        align: 'center',
    })
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('Decreto Presidencial n.º 28/22 — Art. 32.º (Mapa Geral)', pageWidth / 2, y, {
        align: 'center',
    })
    y += 4
    doc.setFontSize(8)
    doc.setTextColor(80, 80, 80)
    doc.text(
        [
            meta.titulo,
            `Ano de referência: ${data.ano_referencia || '—'}`,
            `Gerado em: ${new Date().toLocaleDateString('pt-AO')}`,
        ].join('  ·  '),
        pageWidth / 2,
        y,
        { align: 'center' },
    )
    y += 6

    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Indicador', 'Valor', 'Indicador', 'Valor']],
        body: [
            ['Escolas', String(data.total_escolas), 'Com ciclo', String(data.escolas_com_ciclo)],
            [
                'Fichas (mapa)',
                String(data.total_fichas),
                'Concluídas / assinadas',
                String(data.concluidas),
            ],
            ['Pendentes', String(data.pendentes), '% conclusão', `${data.pct_conclusao}%`],
            [
                'Média CF',
                data.media_classificacao != null
                    ? data.media_classificacao.toFixed(2)
                    : '—',
                MENCAO_LABELS.MUITO_BOM,
                String(data.mencoes.MUITO_BOM),
            ],
            [
                MENCAO_LABELS.BOM,
                String(data.mencoes.BOM),
                MENCAO_LABELS.SUFICIENTE,
                String(data.mencoes.SUFICIENTE),
            ],
            [MENCAO_LABELS.MAU, String(data.mencoes.MAU), '', ''],
        ],
        styles: {
            fontSize: 8,
            cellPadding: 2.2,
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
        },
        headStyles: {
            fillColor: headRgb,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
        },
        columnStyles: {
            0: { fontStyle: 'bold', fillColor: [248, 250, 252] },
            1: { halign: 'center' },
            2: { fontStyle: 'bold', fillColor: [248, 250, 252] },
            3: { halign: 'center' },
        },
        theme: 'grid',
    })

    y =
        ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
            ?.finalY || y) + 6

    if (data.por_municipio?.length) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(30, 30, 30)
        doc.text('Quadro I — Consolidado por município', margin, y)
        y += 2

        autoTable(doc, {
            startY: y + 2,
            margin: { left: margin, right: margin },
            head: [[
                'N.º',
                'Município',
                'Escolas',
                'Com ciclo',
                'Fichas',
                'Concl.',
                '% concl.',
                'Média CF',
            ]],
            body: data.por_municipio.map((m, i) => [
                String(i + 1),
                m.municipio,
                String(m.total_escolas),
                String(m.escolas_com_ciclo),
                String(m.total_fichas),
                String(m.concluidas),
                `${m.pct_conclusao}%`,
                m.media_classificacao != null
                    ? m.media_classificacao.toFixed(2)
                    : '—',
            ]),
            styles: {
                fontSize: 8,
                cellPadding: 2,
                lineColor: [226, 232, 240],
                lineWidth: 0.15,
            },
            headStyles: {
                fillColor: headRgb,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { halign: 'center', cellWidth: 12 },
                2: { halign: 'center' },
                3: { halign: 'center' },
                4: { halign: 'center' },
                5: { halign: 'center' },
                6: { halign: 'center' },
                7: { halign: 'center' },
            },
            theme: 'grid',
        })

        y =
            ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
                ?.finalY || y) + 7
    }

    if (y > pageHeight - 40) {
        doc.addPage()
        y = 16
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(30, 30, 30)
    doc.text(
        data.por_municipio?.length
            ? 'Quadro II — Consolidado por escola'
            : 'Quadro I — Consolidado por escola',
        margin,
        y,
    )

    autoTable(doc, {
        startY: y + 2,
        margin: { left: margin, right: margin },
        head: [[
            'N.º',
            'Escola',
            'Município',
            'Ciclo',
            'Fichas',
            'Concl.',
            'Pend.',
            '%',
            'Média',
            'MB',
            'B',
            'S',
            'M',
        ]],
        body: data.por_escola.map((e, i) => [
            String(i + 1),
            e.escola_nome,
            e.municipio,
            e.ciclo_id
                ? `${e.ano_referencia || ''} (${e.ciclo_estado || ''})`
                : 'Sem ciclo',
            String(e.total_fichas),
            String(e.concluidas),
            String(e.pendentes),
            `${e.pct_conclusao}%`,
            e.media_classificacao != null
                ? e.media_classificacao.toFixed(2)
                : '—',
            String(e.mencoes.MUITO_BOM),
            String(e.mencoes.BOM),
            String(e.mencoes.SUFICIENTE),
            String(e.mencoes.MAU),
        ]),
        styles: {
            fontSize: 7.5,
            cellPadding: 1.8,
            lineColor: [226, 232, 240],
            lineWidth: 0.15,
            overflow: 'linebreak',
        },
        headStyles: {
            fillColor: headRgb,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 7,
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { cellWidth: 52 },
            2: { cellWidth: 28 },
            3: { cellWidth: 28, fontSize: 7 },
            4: { halign: 'center', cellWidth: 14 },
            5: { halign: 'center', cellWidth: 14 },
            6: { halign: 'center', cellWidth: 14 },
            7: { halign: 'center', cellWidth: 14 },
            8: { halign: 'center', cellWidth: 14 },
            9: { halign: 'center', cellWidth: 10 },
            10: { halign: 'center', cellWidth: 10 },
            11: { halign: 'center', cellWidth: 10 },
            12: { halign: 'center', cellWidth: 10 },
        },
        theme: 'grid',
        didParseCell: dataCell => {
            if (dataCell.section === 'body' && dataCell.column.index === 7) {
                const raw = String(dataCell.cell.raw || '').replace('%', '')
                const pct = Number(raw)
                if (!Number.isNaN(pct)) {
                    if (pct >= 80) dataCell.cell.styles.textColor = [5, 122, 85]
                    else if (pct >= 40) dataCell.cell.styles.textColor = [180, 83, 9]
                    else if (pct > 0) dataCell.cell.styles.textColor = [185, 28, 28]
                }
            }
        },
    })

    const finalY =
        ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
            ?.finalY || 0) + 5
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(
        `Legenda menções: MB = ${MENCAO_LABELS.MUITO_BOM} · B = ${MENCAO_LABELS.BOM} · S = ${MENCAO_LABELS.SUFICIENTE} · M = ${MENCAO_LABELS.MAU}`,
        margin,
        Math.min(finalY, pageHeight - 12),
    )

    applyStandardPdfFooters(doc, { dateLocale: 'pt-AO' })

    const safeTerr = fileSafe(data.territorio)
    const safeAno = fileSafe(data.ano_referencia || 'sem-ano').replace(/\//g, '-')
    doc.save(`consolidado-avaliacao_${safeTerr}_${safeAno}.pdf`)
}
