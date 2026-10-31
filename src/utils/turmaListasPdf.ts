import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { HeaderConfig, getOrgaoEducacao } from './headerConfigUtils'
import { imageUrlToBase64, getImageFormat } from './imageUtils'
import { applyStandardPdfFooters } from './pdfFooter'

export interface TurmaListaAluno {
    nome_completo: string
    genero?: string | null
    numero_processo?: string | null
}

export interface TurmaListaGroup {
    id: string
    nome: string
    ano_lectivo?: string
    alunos: TurmaListaAluno[]
}

function formatGenero(genero?: string | null): string {
    if (!genero) return '—'
    const g = genero.toUpperCase()
    if (g === 'M' || g.startsWith('MASC')) return 'M'
    if (g === 'F' || g.startsWith('FEM')) return 'F'
    return genero
}

function countByGenero(alunos: TurmaListaAluno[]) {
    let masculino = 0
    let feminino = 0
    let semGenero = 0
    for (const aluno of alunos) {
        const g = (aluno.genero || '').toUpperCase()
        if (g === 'M' || g.startsWith('MASC')) masculino++
        else if (g === 'F' || g.startsWith('FEM')) feminino++
        else semGenero++
    }
    return { total: alunos.length, masculino, feminino, semGenero }
}

async function renderHeader(
    doc: jsPDF,
    headerConfig: HeaderConfig | null | undefined,
    escolaNomeFallback: string | undefined,
    pageWidth: number
): Promise<number> {
    const centerX = pageWidth / 2
    let y = 10

    if (headerConfig) {
        if (headerConfig.logo_url) {
            try {
                const logoBase64 = await imageUrlToBase64(headerConfig.logo_url)
                const imageFormat = getImageFormat(headerConfig.logo_url)
                const logoW = Math.min(headerConfig.logo_width || 14, 16)
                const logoH = Math.min(headerConfig.logo_height || 14, 16)
                doc.addImage(logoBase64, imageFormat, centerX - logoW / 2, 6, logoW, logoH)
                y = 6 + logoH + 2
            } catch {
                // ignore logo failures
            }
        }

        if (headerConfig.mostrar_republica && headerConfig.texto_republica) {
            doc.setFontSize(8)
            doc.setFont('helvetica', 'bold')
            doc.text(headerConfig.texto_republica.toUpperCase(), centerX, y, { align: 'center' })
            y += 3.5
        }

        if (headerConfig.mostrar_governo_provincial && headerConfig.provincia) {
            doc.setFontSize(7)
            doc.setFont('helvetica', 'normal')
            doc.text(`Governo Provincial da ${headerConfig.provincia}`, centerX, y, { align: 'center' })
            y += 3.2
        }

        if (headerConfig.mostrar_orgao_educacao && headerConfig.nivel_ensino) {
            doc.setFontSize(7)
            doc.setFont('helvetica', 'normal')
            doc.text(
                getOrgaoEducacao(headerConfig.nivel_ensino, headerConfig.provincia, headerConfig.municipio),
                centerX,
                y,
                { align: 'center' }
            )
            y += 3.2
        }

        if (headerConfig.nome_escola) {
            doc.setFontSize(9)
            doc.setFont('helvetica', 'bold')
            doc.text(headerConfig.nome_escola, centerX, y, { align: 'center' })
            y += 4
        }
    } else if (escolaNomeFallback) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text(escolaNomeFallback.toUpperCase(), centerX, y, { align: 'center' })
        y += 5
    }

    doc.setDrawColor(80, 80, 80)
    doc.setLineWidth(0.3)
    doc.line(12, y, pageWidth - 12, y)
    return y + 4
}

/**
 * Gera PDF com uma lista compacta (estilo planilha) por turma:
 * Nº | Nome Completo | Género | Nº Processo + estatística por género.
 */
export async function generateTurmasListasPDF(options: {
    turmas: TurmaListaGroup[]
    headerConfig?: HeaderConfig | null
    escolaNomeFallback?: string
    filename?: string
}): Promise<{ turmasComAlunos: number; totalAlunos: number }> {
    const { turmas, headerConfig = null, escolaNomeFallback, filename } = options
    const turmasComAlunos = turmas
        .map((t) => ({
            ...t,
            alunos: [...t.alunos].sort((a, b) =>
                a.nome_completo.localeCompare(b.nome_completo, 'pt')
            ),
        }))
        .filter((t) => t.alunos.length > 0)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))

    if (turmasComAlunos.length === 0) {
        throw new Error('Nenhuma turma com alunos para imprimir')
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    let totalAlunos = 0
    let isFirstPage = true

    for (const turma of turmasComAlunos) {
        if (!isFirstPage) doc.addPage()
        isFirstPage = false
        totalAlunos += turma.alunos.length

        const startY = await renderHeader(doc, headerConfig, escolaNomeFallback, pageWidth)
        let y = startY

        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text('LISTA DE ALUNOS', pageWidth / 2, y, { align: 'center' })
        y += 5

        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.text(`Turma: ${turma.nome}`, 12, y)
        if (turma.ano_lectivo) {
            doc.setFont('helvetica', 'normal')
            doc.text(`Ano Lectivo: ${turma.ano_lectivo}`, pageWidth - 12, y, { align: 'right' })
        }
        y += 4

        const stats = countByGenero(turma.alunos)
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'normal')
        doc.setFillColor(245, 245, 245)
        doc.rect(12, y - 2.2, pageWidth - 24, 5.5, 'F')
        doc.setDrawColor(180, 180, 180)
        doc.setLineWidth(0.15)
        doc.rect(12, y - 2.2, pageWidth - 24, 5.5, 'S')
        const statsLine = [
            `Total matriculados: ${stats.total}`,
            `Masculino (M): ${stats.masculino}`,
            `Feminino (F): ${stats.feminino}`,
            stats.semGenero > 0 ? `Sem género: ${stats.semGenero}` : null,
        ]
            .filter(Boolean)
            .join('   ·   ')
        doc.text(statsLine, pageWidth / 2, y + 1.2, { align: 'center' })
        y += 6

        const tableData = turma.alunos.map((aluno, index) => [
            String(index + 1),
            aluno.nome_completo,
            formatGenero(aluno.genero),
            aluno.numero_processo || '—',
        ])

        autoTable(doc, {
            startY: y,
            head: [['Nº', 'Nome Completo', 'Género', 'Nº Processo']],
            body: tableData,
            theme: 'grid',
            margin: { left: 12, right: 12 },
            tableWidth: 'auto',
            styles: {
                font: 'helvetica',
                fontSize: 7.5,
                cellPadding: { top: 0.7, right: 1, bottom: 0.7, left: 1 },
                lineColor: [160, 160, 160],
                lineWidth: 0.15,
                textColor: [20, 20, 20],
                valign: 'middle',
                overflow: 'linebreak',
            },
            headStyles: {
                fillColor: [217, 217, 217],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                fontSize: 7.5,
                halign: 'center',
                cellPadding: { top: 0.9, right: 1, bottom: 0.9, left: 1 },
            },
            alternateRowStyles: {
                fillColor: [248, 248, 248],
            },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' },
                1: { cellWidth: 'auto', halign: 'left' },
                2: { cellWidth: 16, halign: 'center' },
                3: { cellWidth: 32, halign: 'center' },
            },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 1) {
                    data.cell.styles.halign = 'left'
                }
            },
        })
    }

    applyStandardPdfFooters(doc)

    const date = new Date().toISOString().split('T')[0]
    doc.save(filename || `listas-turmas_${date}.pdf`)

    return { turmasComAlunos: turmasComAlunos.length, totalAlunos }
}
