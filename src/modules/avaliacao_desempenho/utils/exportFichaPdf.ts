/**
 * PDF das fichas de avaliação — modelos do Ministério (DP 28/22 Anexos II–IV).
 * Natureza do avaliado determina o anexo:
 *   Educador de Infância → Anexo II
 *   Professor            → Anexo III
 *   Técnico / Admin      → Anexo IV
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { applyStandardPdfFooters } from '../../../utils/pdfFooter'
import { renderOfficialSchoolHeader } from '../../../utils/receiptGenerator'
import type { HeaderConfig } from '../../../utils/headerConfigUtils'
import { labelMencao, MENCAO_RANGES } from './classificacao'
import { PERIODO_LABELS } from './indicadoresSeed'
import type { AdAvaliacao, InstrumentoCodigo, PeriodoAvaliacao } from '../types'

export interface FichaPdfMeta {
    escolaNome: string
    escolaCodigo?: string | null
    provincia?: string | null
    municipio?: string | null
    /** Cabeçalho das Configurações da escola — obrigatório quando existir. */
    headerConfig?: HeaderConfig | null
}

export interface AnexoOficialInfo {
    codigo: 'II' | 'III' | 'IV'
    tituloAnexo: string
    natureza: string
    instrumento: InstrumentoCodigo
}

function isEducadorInfancia(avaliacao: AdAvaliacao): boolean {
    const esp = avaliacao.professor?.especialidade
    const funcoes = avaliacao.professor?.funcoes
    const blob = `${esp || ''} ${(funcoes || []).join(' ')}`.toLowerCase()
    return /educador|inf[aâ]ncia|jardim/.test(blob)
}

/** Resolve o anexo oficial conforme a natureza do avaliado. */
export function resolveAnexoOficial(avaliacao: AdAvaliacao): AnexoOficialInfo {
    if (avaliacao.instrumento_codigo === 'FICHA_TECNICO_ADMIN') {
        return {
            codigo: 'IV',
            tituloAnexo: 'Anexo IV',
            natureza: 'Técnico Pedagógico / Especialista da Administração da Educação',
            instrumento: 'FICHA_TECNICO_ADMIN',
        }
    }
    if (isEducadorInfancia(avaliacao)) {
        return {
            codigo: 'II',
            tituloAnexo: 'Anexo II',
            natureza: 'Educador de Infância',
            instrumento: 'FICHA_DOCENTE',
        }
    }
    return {
        codigo: 'III',
        tituloAnexo: 'Anexo III',
        natureza: 'Professor / Educador',
        instrumento: 'FICHA_DOCENTE',
    }
}

function tipoFichaLabel(periodo: PeriodoAvaliacao): string {
    return periodo === 'ANUAL' ? 'ANUAL' : 'TRIMESTRAL'
}

function drawFieldRow(
    doc: jsPDF,
    x: number,
    y: number,
    label: string,
    value: string,
    labelW: number,
    valueW: number,
    h: number,
) {
    doc.setDrawColor(40, 40, 40)
    doc.setLineWidth(0.2)
    doc.rect(x, y, labelW + valueW, h)
    doc.line(x + labelW, y, x + labelW, y + h)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(label, x + 1.5, y + h / 2 + 1.1)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const lines = doc.splitTextToSize(value || '—', valueW - 3)
    doc.text(lines, x + labelW + 1.5, y + h / 2 + 1.1)
}

/**
 * Gera e descarrega o PDF da ficha no modelo do anexo correspondente à natureza.
 * Cabeçalho: usa a configuração da página Configurações (logo, República, órgão, escola).
 */
export async function exportFichaAvaliacaoPdf(
    avaliacao: AdAvaliacao,
    meta: FichaPdfMeta,
): Promise<void> {
    const anexo = resolveAnexoOficial(avaliacao)
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 14
    const contentW = pageWidth - margin * 2

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

    // —— Título do instrumento ——
    const tipo = tipoFichaLabel(avaliacao.periodo)
    doc.setTextColor(20, 20, 20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(`FICHA DE AVALIAÇÃO DE DESEMPENHO ${tipo}`, pageWidth / 2, y, {
        align: 'center',
    })
    y += 5
    doc.setFontSize(9)
    doc.text(
        `${anexo.tituloAnexo} — Decreto Presidencial n.º 28/22`,
        pageWidth / 2,
        y,
        { align: 'center' },
    )
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`Natureza: ${anexo.natureza}`, pageWidth / 2, y, { align: 'center' })
    if (meta.escolaCodigo) {
        y += 3.5
        doc.text(`Código da escola: ${meta.escolaCodigo}`, pageWidth / 2, y, {
            align: 'center',
        })
    }
    y += 6

    // —— Identificação ——
    const nome =
        avaliacao.avaliado_tipo === 'PROFESSOR'
            ? avaliacao.professor?.nome_completo
            : avaliacao.funcionario?.nome_completo
    const categoria =
        avaliacao.avaliado_tipo === 'PROFESSOR'
            ? anexo.natureza
            : [avaliacao.funcionario?.categoria, avaliacao.funcionario?.cargo]
                  .filter(Boolean)
                  .join(' — ') || anexo.natureza
    const numeroAgente =
        avaliacao.professor?.numero_agente ||
        avaliacao.funcionario?.numero_funcionario ||
        '—'
    const anoRef = avaliacao.ciclo?.ano_referencia || '—'
    const periodoLabel = PERIODO_LABELS[avaliacao.periodo]

    const labelW = 42
    const valueW = contentW - labelW
    const rowH = 7

    drawFieldRow(doc, margin, y, 'Nome do avaliado', nome || '—', labelW, valueW, rowH)
    y += rowH
    drawFieldRow(doc, margin, y, 'Categoria / Natureza', categoria, labelW, valueW, rowH)
    y += rowH
    drawFieldRow(doc, margin, y, 'N.º de agente', String(numeroAgente), labelW, valueW, rowH)
    y += rowH
    drawFieldRow(
        doc,
        margin,
        y,
        'Período / Ano',
        `${periodoLabel}  ·  ${anoRef}`,
        labelW,
        valueW,
        rowH,
    )
    y += rowH + 5

    // —— Tabela de indicadores (Anexo I graduação 5/10/15/20) ——
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('INDICADORES DE DESEMPENHO (Graduação Anexo I: 5 | 10 | 15 | 20)', margin, y)
    y += 2

    const scores = (avaliacao.scores || [])
        .slice()
        .sort(
            (a, b) =>
                (a.indicador?.ordem || 0) - (b.indicador?.ordem || 0),
        )

    const body = scores.map((s, i) => {
        const ind = s.indicador
        const coef = ind?.coeficiente_ponderacao != null ? Number(ind.coeficiente_ponderacao) : ''
        const g = s.graduacao
        const mark = (v: number) => (g === v ? '●' : '')
        return [
            String(i + 1),
            ind?.nome || '—',
            String(coef),
            mark(5),
            mark(10),
            mark(15),
            mark(20),
            s.valor != null ? String(s.valor) : '—',
        ]
    })

    if (body.length === 0) {
        body.push(['—', 'Sem indicadores registados', '—', '', '', '', '', '—'])
    }

    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [
            [
                'N.º',
                'Indicador',
                'CR',
                '5',
                '10',
                '15',
                '20',
                'Valor\n(G×CR)',
            ],
        ],
        body,
        styles: {
            fontSize: 8,
            cellPadding: 1.6,
            lineColor: [40, 40, 40],
            lineWidth: 0.2,
            textColor: [20, 20, 20],
            valign: 'middle',
        },
        headStyles: {
            fillColor: [245, 245, 245],
            textColor: [20, 20, 20],
            fontStyle: 'bold',
            halign: 'center',
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 14, halign: 'center' },
            3: { cellWidth: 10, halign: 'center' },
            4: { cellWidth: 10, halign: 'center' },
            5: { cellWidth: 10, halign: 'center' },
            6: { cellWidth: 10, halign: 'center' },
            7: { cellWidth: 18, halign: 'center' },
        },
        theme: 'grid',
    })

    const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    y = (lastTable?.finalY ?? y) + 6

    // —— Classificação final (Art. 19.º / 20.º) ——
    const cf =
        avaliacao.classificacao_final != null
            ? Number(avaliacao.classificacao_final).toFixed(2)
            : '—'
    const mencao = labelMencao(avaliacao.mencao)
    const faixa = avaliacao.mencao ? MENCAO_RANGES[avaliacao.mencao] : ''

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('CLASSIFICAÇÃO FINAL (Art. 19.º) E MENÇÃO (Art. 20.º)', margin, y)
    y += 3

    const boxH = 14
    const half = contentW / 2 - 2
    doc.setDrawColor(40, 40, 40)
    doc.setLineWidth(0.3)
    doc.rect(margin, y, half, boxH)
    doc.rect(margin + half + 4, y, half, boxH)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('Classificação final (CF)', margin + 2, y + 5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(cf, margin + 2, y + 11)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('Menção qualitativa', margin + half + 6, y + 5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(
        faixa ? `${mencao} (${faixa})` : mencao,
        margin + half + 6,
        y + 11,
    )
    y += boxH + 6

    // —— Objectivos e observações ——
    const ensureSpace = (need: number) => {
        const pageH = doc.internal.pageSize.getHeight()
        if (y + need > pageH - 28) {
            doc.addPage()
            y = 16
        }
    }

    ensureSpace(28)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('OBJECTIVOS DO PERÍODO (Art. 22.º)', margin, y)
    y += 2
    doc.setDrawColor(40, 40, 40)
    doc.setLineWidth(0.2)
    const objText = avaliacao.objectivos_texto?.trim() || '—'
    const objLines = doc.splitTextToSize(objText, contentW - 4)
    const objH = Math.max(16, objLines.length * 4 + 4)
    doc.rect(margin, y, contentW, objH)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(objLines, margin + 2, y + 4)
    y += objH + 5

    ensureSpace(28)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('OBSERVAÇÕES DO AVALIADOR', margin, y)
    y += 2
    const obsText = avaliacao.observacoes?.trim() || '—'
    const obsLines = doc.splitTextToSize(obsText, contentW - 4)
    const obsH = Math.max(16, obsLines.length * 4 + 4)
    doc.rect(margin, y, contentW, obsH)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(obsLines, margin + 2, y + 4)
    y += obsH + 8

    // —— Assinaturas (Art. 25.º) ——
    ensureSpace(42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('ASSINATURAS', margin, y)
    y += 5

    const sigW = contentW / 2 - 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('O Avaliador', margin, y)
    doc.text('O Avaliado (Art. 25.º)', margin + sigW + 8, y)
    y += 12
    doc.line(margin, y, margin + sigW - 8, y)
    doc.line(margin + sigW + 8, y, margin + contentW, y)
    y += 4
    doc.setFontSize(7)
    doc.text('Nome / data', margin, y)
    doc.text('Nome / data', margin + sigW + 8, y)
    y += 6

    const conc =
        avaliacao.concordancia_avaliado == null
            ? 'Concordância:  [  ] Concorda    [  ] Não concorda'
            : avaliacao.concordancia_avaliado
              ? 'Concordância:  [X] Concorda    [  ] Não concorda'
              : 'Concordância:  [  ] Concorda    [X] Não concorda'
    doc.setFontSize(8)
    doc.text(conc, margin + sigW + 8, y)
    if (avaliacao.assinado_em) {
        y += 4
        doc.setFontSize(7)
        doc.text(
            `Assinado em: ${new Date(avaliacao.assinado_em).toLocaleString('pt-AO')}`,
            margin + sigW + 8,
            y,
        )
    }

    y += 8
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7)
    doc.setTextColor(80, 80, 80)
    doc.text(
        'Documento gerado nos termos do Decreto Presidencial n.º 28/22 — Regime Jurídico da Avaliação de Desempenho dos Agentes de Educação.',
        pageWidth / 2,
        y,
        { align: 'center', maxWidth: contentW },
    )
    doc.setTextColor(0, 0, 0)

    applyStandardPdfFooters(doc, { dateLocale: 'pt-AO' })

    const safeNome = (nome || 'avaliado')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .slice(0, 40)
    const filename = `ficha_anexo-${anexo.codigo}_${periodoLabel.replace(/\./g, '')}_${safeNome}.pdf`
    doc.save(filename)
}
