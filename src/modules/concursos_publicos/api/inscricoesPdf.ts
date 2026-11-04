/**
 * PDF export for municipal contest inscriptions with configurable header
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { imageUrlToBase64, getImageFormat } from '../../../utils/imageUtils'
import { applyStandardPdfFooters } from '../../../utils/pdfFooter'
import type { CabecalhoConcursoPdf, ConcursoInscricao, OrdenacaoInscricoes } from '../types'
import { LABELS_ESTADO_INSCRICAO } from '../types'

function calcAge(dataNascimento: string): number | null {
    if (!dataNascimento) return null
    const d = new Date(dataNascimento)
    if (Number.isNaN(d.getTime())) return null
    const today = new Date()
    let age = today.getFullYear() - d.getFullYear()
    const m = today.getMonth() - d.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--
    return age
}

async function renderHeader(
    doc: jsPDF,
    cabecalho: CabecalhoConcursoPdf | null | undefined,
    pageWidth: number
): Promise<number> {
    const centerX = pageWidth / 2
    let y = 10
    const cfg = cabecalho || {}

    if (cfg.logo_url) {
        try {
            const logoBase64 = await imageUrlToBase64(cfg.logo_url)
            const imageFormat = getImageFormat(cfg.logo_url)
            const logoW = Math.min(cfg.logo_width || 14, 18)
            const logoH = Math.min(cfg.logo_height || 14, 18)
            doc.addImage(logoBase64, imageFormat, centerX - logoW / 2, 6, logoW, logoH)
            y = 6 + logoH + 2
        } catch {
            // ignore logo failures
        }
    }

    if (cfg.mostrar_republica !== false && (cfg.texto_republica || 'REPÚBLICA DE ANGOLA')) {
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.text((cfg.texto_republica || 'REPÚBLICA DE ANGOLA').toUpperCase(), centerX, y, { align: 'center' })
        y += 3.5
    }

    if (cfg.mostrar_governo_provincial && cfg.provincia) {
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.text(`Governo Provincial de ${cfg.provincia}`, centerX, y, { align: 'center' })
        y += 3.2
    }

    if (cfg.mostrar_orgao_educacao) {
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        const orgao = cfg.municipio
            ? `Direção Municipal da Educação — ${cfg.municipio}`
            : 'Direção Municipal da Educação'
        doc.text(orgao, centerX, y, { align: 'center' })
        y += 3.2
    }

    if (cfg.nome_instituicao) {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.text(cfg.nome_instituicao, centerX, y, { align: 'center' })
        y += 4
    }

    return y + 2
}

function sortInscricoes(rows: ConcursoInscricao[], ordenacao: OrdenacaoInscricoes): ConcursoInscricao[] {
    const copy = [...rows]
    switch (ordenacao) {
        case 'idade':
            return copy.sort((a, b) => (a.idade ?? 999) - (b.idade ?? 999) || a.nome_completo.localeCompare(b.nome_completo, 'pt'))
        case 'categoria':
            return copy.sort((a, b) =>
                (a.categoria?.nome || '').localeCompare(b.categoria?.nome || '', 'pt') ||
                a.nome_completo.localeCompare(b.nome_completo, 'pt')
            )
        case 'municipio':
            return copy.sort((a, b) =>
                a.municipio.localeCompare(b.municipio, 'pt') ||
                a.nome_completo.localeCompare(b.nome_completo, 'pt')
            )
        case 'data':
            return copy.sort((a, b) => b.created_at.localeCompare(a.created_at))
        default:
            return copy.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, 'pt'))
    }
}

const ORDENACAO_LABEL: Record<OrdenacaoInscricoes, string> = {
    alfabetica: 'Ordem alfabética',
    idade: 'Por idade',
    categoria: 'Por categoria',
    municipio: 'Por município',
    data: 'Por data de inscrição',
}

export async function exportInscricoesConcursoPdf(params: {
    tituloConcurso: string
    municipio: string
    inscricoes: ConcursoInscricao[]
    cabecalho?: CabecalhoConcursoPdf | null
    ordenacao?: OrdenacaoInscricoes
    agruparPorCategoria?: boolean
}): Promise<void> {
    const ordenacao = params.ordenacao || 'alfabetica'
    const rows = sortInscricoes(params.inscricoes, ordenacao)
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()

    let y = await renderHeader(doc, params.cabecalho, pageWidth)

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Lista de Inscrições — Concurso Público', pageWidth / 2, y, { align: 'center' })
    y += 5

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(params.tituloConcurso, pageWidth / 2, y, { align: 'center' })
    y += 4

    doc.setFontSize(8)
    doc.setTextColor(80)
    doc.text(
        `Município: ${params.municipio}  ·  Ordenação: ${ORDENACAO_LABEL[ordenacao]}  ·  Total: ${rows.length}`,
        pageWidth / 2,
        y,
        { align: 'center' }
    )
    doc.setTextColor(0)
    y += 4

    const buildBody = (list: ConcursoInscricao[]) =>
        list.map((ins, idx) => [
            String(idx + 1),
            ins.nome_completo,
            ins.categoria?.nome || '—',
            String(ins.idade ?? calcAge(ins.data_nascimento) ?? '—'),
            ins.genero || '—',
            ins.municipio || '—',
            ins.bilhete_identidade || '—',
            ins.telefone || '—',
            LABELS_ESTADO_INSCRICAO[ins.estado] || ins.estado,
            new Date(ins.created_at).toLocaleDateString('pt-AO'),
        ])

    const head = [[
        '#', 'Nome', 'Categoria', 'Idade', 'Género', 'Município', 'BI', 'Telefone', 'Estado', 'Data'
    ]]

    if (params.agruparPorCategoria || ordenacao === 'categoria') {
        const groups = new Map<string, ConcursoInscricao[]>()
        for (const ins of rows) {
            const key = ins.categoria?.nome || 'Sem categoria'
            if (!groups.has(key)) groups.set(key, [])
            groups.get(key)!.push(ins)
        }

        let startY = y
        for (const [categoria, list] of groups) {
            autoTable(doc, {
                startY,
                head: [[{ content: `Categoria: ${categoria} (${list.length})`, colSpan: 10 }]],
                body: buildBody(list),
                theme: 'grid',
                styles: { fontSize: 7, cellPadding: 1.5 },
                headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
                margin: { left: 10, right: 10 },
            })
            startY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || startY) + 6
        }
    } else {
        autoTable(doc, {
            startY: y,
            head,
            body: buildBody(rows),
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1.5 },
            headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
            margin: { left: 10, right: 10 },
        })
    }

    applyStandardPdfFooters(doc)

    const safeName = params.tituloConcurso.replace(/[^\w\-]+/g, '_').slice(0, 40)
    doc.save(`inscricoes_${safeName}_${params.municipio}.pdf`)
}
