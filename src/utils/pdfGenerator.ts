import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import JSZip from 'jszip'
import {
    HeaderConfig,
    getOrgaoEducacao,
    resolveMapHeaderColor,
    darkenHexColor,
    DEFAULT_MAP_HEADER_COLOR,
    DEFAULT_MAP_HEADER_COLOR_PRIMARY,
    DEFAULT_MAP_HEADER_COLOR_MAPA,
} from './headerConfigUtils'
import { imageUrlToBase64, getImageFormat } from './imageUtils'
import { GradeColorConfig, getGradeColorFromConfig, hexToRGB } from './gradeColorConfigUtils'
import { drawStandardPdfFooter, APP_DOCUMENT_BRAND_LINE } from './pdfFooter'
import {
    formatComponentePautaLabel,
    formatObservacaoPautaLabel,
    buildPautaGeralLegendaTableRows,
} from './pautaGeralFieldUtils'
import {
    DEFAULT_PAUTA_GERAL_EXPORT_CONFIG,
    type PautaGeralExportConfig,
} from './pautaGeralExportUtils'
import { getComponenteDisplayLabel } from './gradeUtils'

interface TrimestreData {
    notas: Record<string, number>
    nota_final?: number
}

interface MiniPautaData {
    turma: {
        nome: string
        ano_lectivo: number
        codigo_turma: string
        nivel_ensino?: string
    }
    disciplina: {
        nome: string
        codigo_disciplina: string
    }
    trimestre: number | 'all'
    nivel_ensino?: string
    classe?: string
    alunos: Array<{
        numero_processo: string
        nome_completo: string
        notas: Record<string, number>
        nota_final?: number
        classificacao: string
        trimestres?: {
            1?: TrimestreData
            2?: TrimestreData
            3?: TrimestreData
        }
    }>
    componentes: Array<{
        id: string  // Component ID for unique identification
        codigo_componente: string
        nome: string
        peso_percentual: number
        trimestre?: number
        is_calculated?: boolean
        disciplina_nome?: string
        disciplina_ordem?: number
    }>
    estatisticas: {
        total_alunos: number
        aprovados: number
        reprovados: number
        taxa_aprovacao: number
        media_turma: number
        nota_minima: number
        nota_maxima: number
    }
    escola?: {
        nome: string
        provincia: string
        municipio: string
    }
}

/**
 * Determines the RGB color for a grade based on configuration
 */
const getGradeColorRGB = (
    nota: number,
    nivelEnsino: string | undefined,
    classe: string | undefined,
    isCalculated: boolean,
    config: GradeColorConfig | null
): [number, number, number] => {
    const result = getGradeColorFromConfig(nota, nivelEnsino, classe, isCalculated, config)
    return hexToRGB(result.color)
}

/** RGB fill for map/table headers from school config (with document-type fallback). */
const getMapHeaderRgb = (
    headerConfig: HeaderConfig | null | undefined,
    fallbackHex: string = DEFAULT_MAP_HEADER_COLOR
): [number, number, number] => hexToRGB(resolveMapHeaderColor(headerConfig, fallbackHex))

const getMapHeaderRgbAlt = (
    headerConfig: HeaderConfig | null | undefined,
    fallbackHex: string = DEFAULT_MAP_HEADER_COLOR,
    darkenFactor = 0.12
): [number, number, number] =>
    hexToRGB(darkenHexColor(resolveMapHeaderColor(headerConfig, fallbackHex), darkenFactor))

/**
 * Renders the PDF header (logo, school info, etc.)
 */
async function renderPDFHeader(
    doc: jsPDF,
    data: MiniPautaData,
    headerConfig: HeaderConfig | null | undefined,
    pageWidth: number
): Promise<number> {
    let currentY = 15

    if (headerConfig) {
        // Logo (if configured)
        if (headerConfig.logo_url) {
            try {
                const base64Image = await imageUrlToBase64(headerConfig.logo_url)
                const imageFormat = getImageFormat(headerConfig.logo_url)

                const maxLogoSize = 30
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

        const fontSize = headerConfig.tamanho_fonte_outros || 10
        doc.setFontSize(fontSize)
        doc.setFont('helvetica', 'normal')

        if (headerConfig.mostrar_republica && headerConfig.texto_republica) {
            doc.text(headerConfig.texto_republica, pageWidth / 2, currentY, { align: 'center' })
            currentY += fontSize * 0.5
        }

        if (headerConfig.mostrar_governo_provincial && headerConfig.provincia) {
            doc.text(`Governo Provincial da ${headerConfig.provincia}`, pageWidth / 2, currentY, { align: 'center' })
            currentY += fontSize * 0.5
        }

        if (headerConfig.mostrar_orgao_educacao && headerConfig.nivel_ensino) {
            const orgaoText = getOrgaoEducacao(
                headerConfig.nivel_ensino,
                headerConfig.provincia,
                headerConfig.municipio
            )
            doc.text(orgaoText, pageWidth / 2, currentY, { align: 'center' })
            currentY += fontSize * 0.5
        }

        doc.text(headerConfig.nome_escola, pageWidth / 2, currentY, { align: 'center' })
        currentY += fontSize * 0.7

        const miniPautaFontSize = headerConfig.tamanho_fonte_mini_pauta || 16
        doc.setFontSize(miniPautaFontSize)
        doc.setFont('helvetica', 'bold')
        doc.text('MINI-PAUTA', pageWidth / 2, currentY, { align: 'center' })
        currentY += miniPautaFontSize * 0.6
    } else {
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text('MINI-PAUTA', pageWidth / 2, currentY, { align: 'center' })
        currentY += 7

        if (data.escola) {
            doc.setFontSize(10)
            doc.setFont('helvetica', 'normal')
            doc.text(data.escola.nome, pageWidth / 2, currentY, { align: 'center' })
            currentY += 5
            doc.text(`${data.escola.provincia} - ${data.escola.municipio}`, pageWidth / 2, currentY, { align: 'center' })
            currentY += 7
        } else {
            currentY += 7
        }
    }

    return currentY
}

/** Reserved bottom space so content never overlaps the standard footer */
const MINI_PAUTA_FOOTER_CLEARANCE_MM = 16
/** Compact stats table approximate height (title row + values) */
const MINI_PAUTA_STATS_BLOCK_MM = 14
/** Signature lines + labels */
const MINI_PAUTA_SIGNATURES_BLOCK_MM = 18

/**
 * Adds footer to PDF page
 */
function addPDFFooter(doc: jsPDF, pageWidth: number, pageHeight: number) {
    const pageCount = (doc as any).internal.getNumberOfPages()
    const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber
    drawStandardPdfFooter(doc, {
        pageWidth,
        pageHeight,
        currentPage,
        pageCount,
        dateOnly: true,
        dateLocale: 'pt-AO',
    })
}

/**
 * Ensures enough vertical room below `y`; otherwise starts a new page with footer.
 * Returns the Y position where the next block may start.
 */
function ensureMiniPautaSpace(
    doc: jsPDF,
    y: number,
    neededMm: number,
    pageWidth: number,
    pageHeight: number
): number {
    if (y + neededMm <= pageHeight - MINI_PAUTA_FOOTER_CLEARANCE_MM) {
        return y
    }
    doc.addPage()
    addPDFFooter(doc, pageWidth, pageHeight)
    return 12
}

/**
 * Draws statistics as a compact table at an absolute Y (no page-break decision).
 */
function drawPDFStatisticsAt(
    doc: jsPDF,
    data: MiniPautaData,
    startY: number,
    pageWidth: number,
    pageHeight: number
): number {
    const tableWidth = Math.min(pageWidth - 28, 240)

    autoTable(doc, {
        startY,
        head: [[
            {
                content: 'ESTATÍSTICAS DA TURMA',
                colSpan: 6,
                styles: {
                    halign: 'left',
                    fillColor: [51, 65, 85],
                    textColor: 255,
                    fontStyle: 'bold',
                    fontSize: 6,
                },
            },
        ]],
        body: [[
            { content: `Total\n${data.estatisticas.total_alunos}`, styles: { halign: 'center' } },
            {
                content: `Aprovados\n${data.estatisticas.aprovados} (${data.estatisticas.taxa_aprovacao.toFixed(1)}%)`,
                styles: { halign: 'center', textColor: [37, 99, 235] },
            },
            {
                content: `Reprovados\n${data.estatisticas.reprovados}`,
                styles: { halign: 'center', textColor: [220, 38, 38] },
            },
            {
                content: `Média\n${data.estatisticas.media_turma.toFixed(2)}`,
                styles: { halign: 'center' },
            },
            {
                content: `Mínima\n${data.estatisticas.nota_minima.toFixed(2)}`,
                styles: { halign: 'center' },
            },
            {
                content: `Máxima\n${data.estatisticas.nota_maxima.toFixed(2)}`,
                styles: { halign: 'center' },
            },
        ]],
        theme: 'grid',
        styles: {
            fontSize: 5.5,
            cellPadding: 0.8,
            lineWidth: 0.1,
            valign: 'middle',
            overflow: 'linebreak',
        },
        margin: { left: 14, right: pageWidth - 14 - tableWidth, bottom: MINI_PAUTA_FOOTER_CLEARANCE_MM },
        tableWidth,
        didDrawPage: () => addPDFFooter(doc, pageWidth, pageHeight),
    })

    return (doc as any).lastAutoTable.finalY + 6
}

/**
 * Draws signature lines at an absolute Y (no page-break decision).
 */
function drawPDFSignaturesAt(
    doc: jsPDF,
    startY: number,
    pageWidth: number
): number {
    const signY = startY + 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(0, 0, 0)

    doc.text('_____________________________', 14, signY)
    doc.text('Professor(a)', 14, signY + 4)

    doc.text('_____________________________', pageWidth / 2 - 20, signY)
    doc.text('Diretor(a) Pedagógico(a)', pageWidth / 2 - 20, signY + 4)

    doc.text('_____________________________', pageWidth - 70, signY)
    doc.text('Diretor(a) da Escola', pageWidth - 70, signY + 4)

    return signY + 8
}

/**
 * Keeps statistics + signatures together so signatures never appear alone on a new page.
 */
function addPDFStatisticsAndSignatures(
    doc: jsPDF,
    data: MiniPautaData,
    finalY: number,
    pageWidth: number,
    pageHeight: number
): void {
    const combinedNeeded = MINI_PAUTA_STATS_BLOCK_MM + MINI_PAUTA_SIGNATURES_BLOCK_MM
    const startY = ensureMiniPautaSpace(
        doc,
        finalY,
        combinedNeeded,
        pageWidth,
        pageHeight
    )
    const afterStats = drawPDFStatisticsAt(doc, data, startY, pageWidth, pageHeight)
    drawPDFSignaturesAt(doc, afterStats, pageWidth)
}

export interface ConselhoNotasSignatureNames {
    coordenador_nome?: string | null
    secretario_nome?: string | null
    membro_2_nome?: string | null
}

/**
 * Adds Conselho de Notas signature section for Pauta-Geral PDF
 * Shows 3 numbered lines for council members on the left
 * And Director signatures on the right
 */
function addConselhoNotasSignatures(
    doc: jsPDF,
    finalY: number,
    pageWidth: number,
    _pageHeight: number,
    members?: ConselhoNotasSignatureNames | null
) {
    const lineSpacing = 8
    // Caller must reserve space with preceding content so signatures are never alone on a page.
    const startY = finalY + 8

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('CONSELHO DE NOTAS:', 10, startY)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)

    const line = (nome?: string | null) =>
        nome?.trim() ? `${nome.trim()}` : '_______________________________________'

    const signatures = [
        `1. ${line(members?.coordenador_nome)}  (Coordenador / Dir. Turma)`,
        `2. ${line(members?.secretario_nome)}  (Secretario)`,
        `3. ${line(members?.membro_2_nome)}  (Membro)`,
    ]

    let currentY = startY + 6
    signatures.forEach((sig) => {
        doc.text(sig, 10, currentY)
        currentY += lineSpacing
    })

    const rightX = pageWidth - 80
    doc.text('_________________________________', rightX, startY + 6)
    doc.text('Subdirector(a) Pedagogico(a)', rightX, startY + 11)

    doc.text('_________________________________', rightX, startY + 22)
    doc.text('Director(a) da Escola', rightX, startY + 27)

    doc.setFontSize(8)
    doc.text('Local e Data: ___________________', 10, currentY + 5)
}

// ============================================================================
// PRIMARY EDUCATION PDF GENERATION
// ============================================================================

interface DisciplineGroup {
    disciplina_nome: string
    ordem?: number
    componentes: Array<{ id: string; codigo_componente: string; nome?: string; is_calculated?: boolean }>
}

function groupComponentsByDiscipline(componentes: MiniPautaData['componentes'], trimestre: number): DisciplineGroup[] {
    const disciplineMap = new Map<string, DisciplineGroup>()

    componentes.forEach(comp => {
        if (comp.trimestre === trimestre || !comp.trimestre) {
            const disciplineName = comp.disciplina_nome || 'Sem Disciplina'

            if (!disciplineMap.has(disciplineName)) {
                disciplineMap.set(disciplineName, {
                    disciplina_nome: disciplineName,
                    ordem: comp.disciplina_ordem,
                    componentes: []
                })
            }

            disciplineMap.get(disciplineName)!.componentes.push({
                id: comp.id,
                codigo_componente: comp.codigo_componente,
                nome: comp.nome,
                is_calculated: comp.is_calculated
            })
        }
    })

    return Array.from(disciplineMap.values()).sort((a, b) => {
        if (a.ordem !== undefined && b.ordem !== undefined) {
            return a.ordem - b.ordem
        }
        return a.disciplina_nome.localeCompare(b.disciplina_nome)
    })
}

/**
 * Generates PDF for Primary Education - All Disciplines format
 * Shows disciplines grouped at the top with their components below
 */
async function generatePrimaryEducationAllDisciplinesPDF(
    data: MiniPautaData,
    headerConfig: HeaderConfig | null | undefined,
    colorConfig: GradeColorConfig | null
): Promise<void> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    // Render header
    let currentY = await renderPDFHeader(doc, data, headerConfig, pageWidth)

    // Class info (no discipline line for all-disciplines mode)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(`Turma: ${data.turma.nome}`, 14, currentY + 5)
    doc.text(`Trimestre: ${data.trimestre}º`, 14, currentY + 11)
    doc.text(`Ano Lectivo: ${data.turma.ano_lectivo}`, pageWidth - 14, currentY + 5, { align: 'right' })

    const tableStartY = currentY + 17

    // Group components by discipline
    const currentTrimestre = (data.trimestre === 'all' ? 1 : data.trimestre) as number
    const disciplineGroups = groupComponentsByDiscipline(data.componentes, currentTrimestre)

    // Build two-row header
    // Row 1: Nº (rowSpan 2), Nome (rowSpan 2), Discipline names (colSpan = num components)
    const headerRow1: any[] = [
        { content: 'Nº', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Nome do Aluno', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
    ]

    disciplineGroups.forEach((group) => {
        headerRow1.push({
            content: group.disciplina_nome,
            colSpan: group.componentes.length,
            styles: {
                halign: 'center',
                valign: 'middle',
                fontStyle: 'bold',
                fillColor: getMapHeaderRgbAlt(headerConfig, DEFAULT_MAP_HEADER_COLOR_PRIMARY)
            }
        })
    })

    // Row 2: Component codes only
    const headerRow2: any[] = []
    disciplineGroups.forEach(group => {
        group.componentes.forEach(comp => {
            headerRow2.push({
                content: getComponenteDisplayLabel(comp),
                styles: { halign: 'center', valign: 'middle' }
            })
        })
    })

    // Build table data
    const tableData = data.alunos.map((aluno, index) => {
        const row: any[] = [
            (index + 1).toString(),
            aluno.nome_completo
        ]

        disciplineGroups.forEach(group => {
            group.componentes.forEach(comp => {
                // Use component id for grade lookup to avoid conflicts
                const nota = aluno.notas[comp.id]
                row.push(nota !== undefined ? nota.toFixed(1) : '-')
            })
        })

        return row
    })

    // Generate table with autoTable
    autoTable(doc, {
        startY: tableStartY,
        head: [headerRow1, headerRow2],
        body: tableData,
        theme: 'grid',
        styles: {
            fontSize: 7,
            cellPadding: 1.5,
            overflow: 'linebreak'
        },
        headStyles: {
            fillColor: getMapHeaderRgb(headerConfig, DEFAULT_MAP_HEADER_COLOR_PRIMARY),
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 8 },
            1: { halign: 'left', cellWidth: 40 }
        },
        didParseCell: (hookData: any) => {
            if (hookData.section === 'body' && hookData.column.index >= 2) {
                hookData.cell.styles.halign = 'center'

                const cellValue = hookData.cell.raw
                if (cellValue && cellValue !== '-') {
                    const nota = parseFloat(cellValue)
                    if (!isNaN(nota)) {
                        const colIndex = hookData.column.index - 2
                        let currentIndex = 0
                        let component: any = null

                        for (const group of disciplineGroups) {
                            for (const comp of group.componentes) {
                                if (currentIndex === colIndex) {
                                    // Use id to find the correct component
                                    component = data.componentes.find(c => c.id === comp.id)
                                    break
                                }
                                currentIndex++
                            }
                            if (component) break
                        }

                        if (component) {
                            const color = getGradeColorRGB(
                                nota,
                                data.nivel_ensino,
                                data.classe,
                                component.is_calculated || false,
                                colorConfig
                            )
                            hookData.cell.styles.textColor = color
                        }
                    }
                }
            }
        },
        didDrawPage: () => addPDFFooter(doc, pageWidth, pageHeight)
    })

    // Statistics + signatures kept together (never orphan signatures alone on a page)
    addPDFStatisticsAndSignatures(
        doc,
        data,
        (doc as any).lastAutoTable.finalY + 6,
        pageWidth,
        pageHeight
    )

    // Save
    const filename = `mini-pauta_${data.turma.codigo_turma}_todas-disciplinas_${data.trimestre}trim.pdf`
    doc.save(filename)
}

/**
 * Generates PDF for Primary Education - Single Discipline format
 */
async function generatePrimaryEducationSingleDisciplinePDF(
    data: MiniPautaData,
    headerConfig: HeaderConfig | null | undefined,
    colorConfig: GradeColorConfig | null
): Promise<void> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    let currentY = await renderPDFHeader(doc, data, headerConfig, pageWidth)

    // Class and subject info
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(`Turma: ${data.turma.nome}`, 14, currentY + 5)
    doc.text(`Disciplina: ${data.disciplina.nome}`, 14, currentY + 11)
    doc.text(`Trimestre: ${data.trimestre}º`, 14, currentY + 17)
    doc.text(`Ano Lectivo: ${data.turma.ano_lectivo}`, pageWidth - 14, currentY + 5, { align: 'right' })

    const tableStartY = currentY + 23

    // Simple headers
    const headers = [
        'Nº',
        'Nome do Aluno',
        ...data.componentes.map(c => `${getComponenteDisplayLabel(c)}\n(${c.peso_percentual}%)`)
    ]

    // Table data
    const tableData = data.alunos.map((aluno, index) => [
        (index + 1).toString(),
        aluno.nome_completo,
        ...data.componentes.map(c => {
            const nota = aluno.notas[c.codigo_componente]
            return nota !== undefined ? nota.toFixed(1) : '-'
        })
    ])

    autoTable(doc, {
        startY: tableStartY,
        head: [headers],
        body: tableData,
        theme: 'grid',
        styles: {
            fontSize: 8,
            cellPadding: 2,
            overflow: 'linebreak'
        },
        headStyles: {
            fillColor: getMapHeaderRgb(headerConfig, DEFAULT_MAP_HEADER_COLOR_PRIMARY),
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { halign: 'left', cellWidth: 60 }
        },
        didParseCell: (hookData: any) => {
            if (hookData.section === 'body' && hookData.column.index >= 2) {
                hookData.cell.styles.halign = 'center'

                const cellValue = hookData.cell.raw
                if (cellValue && cellValue !== '-') {
                    const nota = parseFloat(cellValue)
                    if (!isNaN(nota)) {
                        const componentIndex = hookData.column.index - 2
                        const component = data.componentes[componentIndex]

                        if (component) {
                            const color = getGradeColorRGB(
                                nota,
                                data.nivel_ensino,
                                data.classe,
                                component.is_calculated || false,
                                colorConfig
                            )
                            hookData.cell.styles.textColor = color
                        }
                    }
                }
            }
        },
        didDrawPage: () => addPDFFooter(doc, pageWidth, pageHeight)
    })

    addPDFStatisticsAndSignatures(
        doc,
        data,
        (doc as any).lastAutoTable.finalY + 6,
        pageWidth,
        pageHeight
    )

    const trimestreStr = `${data.trimestre}trim`
    const filename = `mini-pauta_${data.turma.codigo_turma}_${data.disciplina.codigo_disciplina}_${trimestreStr}.pdf`
    doc.save(filename)
}

// ============================================================================
// SECONDARY EDUCATION PDF GENERATION
// ============================================================================

/**
 * Generates PDF for Secondary Education - All Trimesters format
 * Shows trimesters grouped at the top with their components below
 */
async function generateSecondaryEducationAllTrimestersPDF(
    data: MiniPautaData,
    headerConfig: HeaderConfig | null | undefined,
    colorConfig: GradeColorConfig | null
): Promise<void> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    let currentY = await renderPDFHeader(doc, data, headerConfig, pageWidth)

    // Class and subject info
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(`Turma: ${data.turma.nome}`, 14, currentY + 5)
    doc.text(`Disciplina: ${data.disciplina.nome}`, 14, currentY + 11)
    doc.text(`Trimestre: Todos`, 14, currentY + 17)
    doc.text(`Ano Lectivo: ${data.turma.ano_lectivo}`, pageWidth - 14, currentY + 5, { align: 'right' })

    const tableStartY = currentY + 23

    // Get components for each trimestre (stable position by ordem)
    const byTrimestre = (t: number) =>
        data.componentes
            .filter((c: { trimestre?: number; ordem?: number }) => Number(c.trimestre) === t)
            .slice()
            .sort((a: { ordem?: number }, b: { ordem?: number }) =>
                (Number(a.ordem) || 0) - (Number(b.ordem) || 0)
            )
    const componentes1T = byTrimestre(1)
    const componentes2T = byTrimestre(2)
    const componentes3T = byTrimestre(3)

    // Build two-row header
    const headerRow1: any[] = [
        { content: 'Nº', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Nome do Aluno', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
    ]

    if (componentes1T.length > 0) {
        headerRow1.push({
            content: '1º Trimestre',
            colSpan: componentes1T.length,
            styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: getMapHeaderRgb(headerConfig) }
        })
    }
    if (componentes2T.length > 0) {
        headerRow1.push({
            content: '2º Trimestre',
            colSpan: componentes2T.length,
            styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: getMapHeaderRgb(headerConfig) }
        })
    }
    if (componentes3T.length > 0) {
        headerRow1.push({
            content: '3º Trimestre',
            colSpan: componentes3T.length,
            styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: getMapHeaderRgb(headerConfig) }
        })
    }

    // Second row: component codes
    const headerRow2: any[] = [
        ...componentes1T.map(c => ({ content: getComponenteDisplayLabel(c), styles: { halign: 'center' } })),
        ...componentes2T.map(c => ({ content: getComponenteDisplayLabel(c), styles: { halign: 'center' } })),
        ...componentes3T.map(c => ({ content: getComponenteDisplayLabel(c), styles: { halign: 'center' } }))
    ]

    // Build table data
    const tableData = data.alunos.map((aluno, index) => {
        const row: any[] = [
            (index + 1).toString(),
            aluno.nome_completo
        ]

        // 1º Trimestre
        const trimestre1 = aluno.trimestres?.[1]
        componentes1T.forEach(c => {
            const nota = trimestre1?.notas[c.codigo_componente]
            row.push(nota !== undefined ? nota.toFixed(1) : '-')
        })

        // 2º Trimestre
        const trimestre2 = aluno.trimestres?.[2]
        componentes2T.forEach(c => {
            const nota = trimestre2?.notas[c.codigo_componente]
            row.push(nota !== undefined ? nota.toFixed(1) : '-')
        })

        // 3º Trimestre
        const trimestre3 = aluno.trimestres?.[3]
        componentes3T.forEach(c => {
            const nota = trimestre3?.notas[c.codigo_componente]
            row.push(nota !== undefined ? nota.toFixed(1) : '-')
        })

        return row
    })

    autoTable(doc, {
        startY: tableStartY,
        head: [headerRow1, headerRow2],
        body: tableData,
        theme: 'grid',
        styles: {
            fontSize: 7,
            cellPadding: 1.5,
            overflow: 'linebreak'
        },
        headStyles: {
            fillColor: getMapHeaderRgb(headerConfig),
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 8 },
            1: { halign: 'left', cellWidth: 40 }
        },
        didParseCell: (hookData: any) => {
            if (hookData.section === 'body' && hookData.column.index >= 2) {
                hookData.cell.styles.halign = 'center'

                const cellValue = hookData.cell.raw
                if (cellValue && cellValue !== '-') {
                    const nota = parseFloat(cellValue)
                    if (!isNaN(nota)) {
                        const colIndex = hookData.column.index - 2
                        const allComponents = [...componentes1T, ...componentes2T, ...componentes3T]
                        const component = allComponents[colIndex]

                        if (component) {
                            const color = getGradeColorRGB(
                                nota,
                                data.nivel_ensino,
                                data.classe,
                                component.is_calculated || false,
                                colorConfig
                            )
                            hookData.cell.styles.textColor = color
                        }
                    }
                }
            }
        },
        didDrawPage: () => addPDFFooter(doc, pageWidth, pageHeight)
    })

    addPDFStatisticsAndSignatures(
        doc,
        data,
        (doc as any).lastAutoTable.finalY + 6,
        pageWidth,
        pageHeight
    )

    const filename = `mini-pauta_${data.turma.codigo_turma}_${data.disciplina.codigo_disciplina}_todos.pdf`
    doc.save(filename)
}

/**
 * Generates PDF for Secondary Education - Single Trimester format
 */
async function generateSecondaryEducationSingleTrimesterPDF(
    data: MiniPautaData,
    headerConfig: HeaderConfig | null | undefined,
    colorConfig: GradeColorConfig | null
): Promise<void> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    let currentY = await renderPDFHeader(doc, data, headerConfig, pageWidth)

    // Class and subject info
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(`Turma: ${data.turma.nome}`, 14, currentY + 5)
    doc.text(`Disciplina: ${data.disciplina.nome}`, 14, currentY + 11)
    doc.text(`Trimestre: ${data.trimestre}º`, 14, currentY + 17)
    doc.text(`Ano Lectivo: ${data.turma.ano_lectivo}`, pageWidth - 14, currentY + 5, { align: 'right' })

    const tableStartY = currentY + 23

    // Simple headers
    const headers = [
        'Nº',
        'Nome do Aluno',
        ...data.componentes.map(c => `${getComponenteDisplayLabel(c)}\n(${c.peso_percentual}%)`)
    ]

    // Table data
    const tableData = data.alunos.map((aluno, index) => [
        (index + 1).toString(),
        aluno.nome_completo,
        ...data.componentes.map(c => {
            const nota = aluno.notas[c.codigo_componente]
            return nota !== undefined ? nota.toFixed(1) : '-'
        })
    ])

    autoTable(doc, {
        startY: tableStartY,
        head: [headers],
        body: tableData,
        theme: 'grid',
        styles: {
            fontSize: 8,
            cellPadding: 2,
            overflow: 'linebreak'
        },
        headStyles: {
            fillColor: getMapHeaderRgb(headerConfig),
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { halign: 'left', cellWidth: 60 }
        },
        didParseCell: (hookData: any) => {
            if (hookData.section === 'body' && hookData.column.index >= 2) {
                hookData.cell.styles.halign = 'center'

                const cellValue = hookData.cell.raw
                if (cellValue && cellValue !== '-') {
                    const nota = parseFloat(cellValue)
                    if (!isNaN(nota)) {
                        const componentIndex = hookData.column.index - 2
                        const component = data.componentes[componentIndex]

                        if (component) {
                            const color = getGradeColorRGB(
                                nota,
                                data.nivel_ensino,
                                data.classe,
                                component.is_calculated || false,
                                colorConfig
                            )
                            hookData.cell.styles.textColor = color
                        }
                    }
                }
            }
        },
        didDrawPage: () => addPDFFooter(doc, pageWidth, pageHeight)
    })

    addPDFStatisticsAndSignatures(
        doc,
        data,
        (doc as any).lastAutoTable.finalY + 6,
        pageWidth,
        pageHeight
    )

    const trimestreStr = `${data.trimestre}trim`
    const filename = `mini-pauta_${data.turma.codigo_turma}_${data.disciplina.codigo_disciplina}_${trimestreStr}.pdf`
    doc.save(filename)
}

// ============================================================================
// MAIN EXPORT FUNCTION - Routes to appropriate generator
// ============================================================================

/**
 * Main function to generate Mini-Pauta PDF
 * Routes to the appropriate generator based on education level and mode
 */
export async function generateMiniPautaPDF(
    data: MiniPautaData,
    headerConfig?: HeaderConfig | null,
    colorConfig: GradeColorConfig | null = null
): Promise<void> {
    // Check if Primary Education
    const isPrimaryEducation = data.nivel_ensino?.toLowerCase().includes('primário') ||
        data.nivel_ensino?.toLowerCase().includes('primario')

    // Check if all-trimester mode
    const isAllTrimesters = data.trimestre === 'all' && data.alunos[0]?.trimestres

    // Check if all disciplines mode (Primary Education only)
    const isAllDisciplines = data.componentes.length > 0 &&
        data.componentes.some(c => c.disciplina_nome) &&
        new Set(data.componentes.map(c => c.disciplina_nome)).size > 1

    console.log('[PDF] Education level:', isPrimaryEducation ? 'Primary' : 'Secondary')
    console.log('[PDF] Mode:', isAllTrimesters ? 'All Trimesters' : isAllDisciplines ? 'All Disciplines' : 'Single')

    if (isPrimaryEducation) {
        if (isAllDisciplines) {
            console.log('[PDF] Using: generatePrimaryEducationAllDisciplinesPDF')
            await generatePrimaryEducationAllDisciplinesPDF(data, headerConfig, colorConfig)
        } else {
            console.log('[PDF] Using: generatePrimaryEducationSingleDisciplinePDF')
            await generatePrimaryEducationSingleDisciplinePDF(data, headerConfig, colorConfig)
        }
    } else {
        if (isAllTrimesters) {
            console.log('[PDF] Using: generateSecondaryEducationAllTrimestersPDF')
            await generateSecondaryEducationAllTrimestersPDF(data, headerConfig, colorConfig)
        } else {
            console.log('[PDF] Using: generateSecondaryEducationSingleTrimesterPDF')
            await generateSecondaryEducationSingleTrimesterPDF(data, headerConfig, colorConfig)
        }
    }
}

// ============================================================================
// PAUTA-GERAL PDF GENERATION
// ============================================================================

interface ComponenteAvaliacaoPG {
    id: string
    codigo_componente: string
    nome: string
    peso_percentual: number
    trimestre: number
    is_calculated?: boolean
    formula_expression?: string | null
    tipo_calculo?: 'trimestral' | 'anual' | string | null
}

interface DisciplinaComComponentesPG {
    id: string
    nome: string
    codigo_disciplina: string
    ordem: number
    componentes: ComponenteAvaliacaoPG[]
}

interface PautaGeralData {
    turma: {
        nome: string
        ano_lectivo: number
        codigo_turma: string
        nivel_ensino: string
    }
    trimestre: number
    nivel_ensino?: string
    classe?: string
    alunos: Array<{
        numero_processo: string
        nome_completo: string
        genero?: 'M' | 'F'
        frequencia_anual?: number
        notas_por_disciplina: Record<string, Record<string, number>>
        media_geral?: number
        observacao?: 'Transita' | 'Não Transita' | 'Condicional' | 'AguardandoNotas'
        observacao_padronizada?: string
    }>
    disciplinas: DisciplinaComComponentesPG[]
    estatisticas?: {
        por_disciplina: Record<string, any>
        geral: any
    }
    escola?: {
        nome: string
        provincia: string
        municipio: string
    }
}

/**
 * Renders the PDF header specifically for Pauta-Geral
 * Uses title "PAUTA-GERAL" instead of "MINI-PAUTA"
 */
async function renderPautaGeralHeader(
    doc: jsPDF,
    data: PautaGeralData,
    headerConfig: HeaderConfig | null | undefined,
    pageWidth: number,
    documentTitle: string = 'PAUTA-GERAL'
): Promise<number> {
    let currentY = 10

    if (headerConfig) {
        // Logo (if configured)
        if (headerConfig.logo_url) {
            try {
                const base64Image = await imageUrlToBase64(headerConfig.logo_url)
                const imageFormat = getImageFormat(headerConfig.logo_url)

                const maxLogoSize = 25
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
                currentY += logoHeight + 2
            } catch (err) {
                console.error('Error adding logo to PDF:', err)
            }
        }

        const fontSize = headerConfig.tamanho_fonte_outros || 9
        doc.setFontSize(fontSize)
        doc.setFont('helvetica', 'normal')

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

        doc.text(headerConfig.nome_escola, pageWidth / 2, currentY, { align: 'center' })
        currentY += fontSize * 0.6

        const titleFontSize = headerConfig.tamanho_fonte_mini_pauta || 14
        doc.setFontSize(titleFontSize)
        doc.setFont('helvetica', 'bold')
        doc.text(documentTitle, pageWidth / 2, currentY, { align: 'center' })
        currentY += titleFontSize * 0.5
    } else {
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text(documentTitle, pageWidth / 2, currentY, { align: 'center' })
        currentY += 6

        if (data.escola) {
            doc.setFontSize(9)
            doc.setFont('helvetica', 'normal')
            doc.text(data.escola.nome, pageWidth / 2, currentY, { align: 'center' })
            currentY += 4
            doc.text(`${data.escola.provincia} - ${data.escola.municipio}`, pageWidth / 2, currentY, { align: 'center' })
            currentY += 5
        } else {
            currentY += 5
        }
    }

    return currentY
}

/**
 * Abbreviates discipline name if too long
 */
function abbreviateDisciplineName(nome: string, maxLength: number = 12): string {
    if (nome.length <= maxLength) return nome

    // Common abbreviations
    const abbreviations: Record<string, string> = {
        'Língua Portuguesa': 'L.Port.',
        'Português': 'Port.',
        'Matemática': 'Mat.',
        'História': 'Hist.',
        'Geografia': 'Geo.',
        'Ciências Naturais': 'C.Nat.',
        'Ciências da Natureza': 'C.Nat.',
        'Educação Visual': 'Ed.Vis.',
        'Educação Física': 'Ed.Fís.',
        'Educação Moral e Cívica': 'EMC',
        'Educação Manual e Plástica': 'EMP',
        'Educação Laboral': 'Ed.Lab.',
        'Educação Musical': 'Ed.Mus.',
        'Inglês': 'Ing.',
        'Francês': 'Fr.',
        'Física': 'Fís.',
        'Química': 'Quím.',
        'Biologia': 'Bio.',
        'Formação de Atitudes Integradoras': 'FAI'
    }

    if (abbreviations[nome]) return abbreviations[nome]

    // Generic abbreviation: take first letters of each word
    const words = nome.split(' ')
    if (words.length > 1) {
        return words.map(w => w.charAt(0).toUpperCase()).join('.') + '.'
    }

    return nome.substring(0, maxLength - 2) + '..'
}

/**
 * Generates PDF for Pauta-Geral (General Report by Class)
 * Shows all disciplines with their components in a grouped table format
 * Uses A3 landscape format with flexible columns to accommodate all disciplines
 */
export async function generatePautaGeralPDF(
    data: PautaGeralData,
    headerConfig: HeaderConfig | null | undefined,
    colorConfig: GradeColorConfig | null,
    exportConfig: PautaGeralExportConfig = DEFAULT_PAUTA_GERAL_EXPORT_CONFIG,
    metricSourceComponentes: ComponenteAvaliacaoPG[] = [],
    conselhoMembers?: ConselhoNotasSignatureNames | null
): Promise<void> {
    const cfg = { ...DEFAULT_PAUTA_GERAL_EXPORT_CONFIG, ...exportConfig }
    const disciplinas = data.disciplinas.filter((d) => d.componentes.length > 0)

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    let currentY = await renderPautaGeralHeader(doc, data, headerConfig, pageWidth)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(`Turma: ${data.turma.nome}`, 10, currentY + 3)
    doc.text(`Ano Lectivo: ${data.turma.ano_lectivo}`, pageWidth / 2, currentY + 3, { align: 'center' })
    doc.text(`Nível: ${data.turma.nivel_ensino || 'N/D'}`, pageWidth - 10, currentY + 3, { align: 'right' })

    const tableStartY = currentY + 8
    const totalComponentCols = disciplinas.reduce((sum, d) => sum + d.componentes.length, 0)
    const availableWidth = pageWidth - 20

    const numColWidth = cfg.showNumeroProcesso ? 6 : 0
    const nameColWidthBase = cfg.showNomeCompleto ? 32 : 0
    const genColWidth = 6
    const mgColWidth = cfg.showMediaGeral ? 10 : 0
    const obsColWidth = cfg.showObservacao ? 28 : 0
    const fixedColsWidth = numColWidth + nameColWidthBase + genColWidth + mgColWidth + obsColWidth
    const remainingWidth = availableWidth - fixedColsWidth
    const nameColWidth = cfg.showNomeCompleto
        ? Math.max(25, Math.min(40, remainingWidth * 0.2 + nameColWidthBase * 0.3))
        : 0
    const componentAreaWidth = remainingWidth - (cfg.showNomeCompleto ? nameColWidth - nameColWidthBase : 0)
    const componentColWidth = Math.max(8, componentAreaWidth / Math.max(totalComponentCols, 1))

    const headerRow1: any[] = []
    if (cfg.showNumeroProcesso) {
        headerRow1.push({ content: 'Nº', rowSpan: 2, styles: { halign: 'center', valign: 'middle', cellWidth: numColWidth } })
    }
    if (cfg.showNomeCompleto) {
        headerRow1.push({ content: 'Nome do Aluno', rowSpan: 2, styles: { halign: 'center', valign: 'middle', cellWidth: nameColWidth } })
    }
    headerRow1.push({ content: 'GÊN', rowSpan: 2, styles: { halign: 'center', valign: 'middle', cellWidth: genColWidth } })

    const pautaHeaderRgb = getMapHeaderRgb(headerConfig)
    disciplinas.forEach((disciplina) => {
        headerRow1.push({
            content: abbreviateDisciplineName(disciplina.nome, 10),
            colSpan: disciplina.componentes.length,
            styles: {
                halign: 'center',
                valign: 'middle',
                fontStyle: 'bold',
                fillColor: pautaHeaderRgb,
                fontSize: 6
            }
        })
    })

    if (cfg.showMediaGeral) {
        headerRow1.push({
            content: 'MG',
            rowSpan: 2,
            styles: { halign: 'center', valign: 'middle', cellWidth: mgColWidth, fillColor: [22, 163, 74] }
        })
    }
    if (cfg.showObservacao) {
        headerRow1.push({
            content: 'Observação',
            rowSpan: 2,
            styles: { halign: 'center', valign: 'middle', cellWidth: obsColWidth, fillColor: [147, 51, 234], fontSize: 5.5 }
        })
    }

    const headerRow2: any[] = []
    disciplinas.forEach((disciplina) => {
        disciplina.componentes.forEach((comp) => {
            headerRow2.push({
                content: formatComponentePautaLabel(comp),
                styles: { halign: 'center', valign: 'middle', fontSize: 5, cellWidth: componentColWidth }
            })
        })
    })

    const tableData = data.alunos.map((aluno, index) => {
        const row: any[] = []
        if (cfg.showNumeroProcesso) row.push((index + 1).toString())
        if (cfg.showNomeCompleto) row.push(aluno.nome_completo)
        row.push(aluno.genero || '-')

        disciplinas.forEach((disciplina) => {
            const notasDisciplina = aluno.notas_por_disciplina[disciplina.id] || {}
            disciplina.componentes.forEach((comp) => {
                const nota = notasDisciplina[comp.id]
                row.push(nota !== undefined ? nota.toFixed(1) : '-')
            })
        })

        if (cfg.showMediaGeral) {
            row.push(aluno.media_geral !== undefined ? aluno.media_geral.toFixed(1) : '-')
        }
        if (cfg.showObservacao) {
            row.push(formatObservacaoPautaLabel(aluno.observacao))
        }

        return row
    })

    const columnStyles: Record<number, any> = {}
    let colPtr = 0
    if (cfg.showNumeroProcesso) {
        columnStyles[colPtr++] = { halign: 'center', cellWidth: numColWidth }
    }
    if (cfg.showNomeCompleto) {
        columnStyles[colPtr++] = { halign: 'left', cellWidth: nameColWidth, overflow: 'ellipsize' }
    }
    columnStyles[colPtr++] = { halign: 'center', cellWidth: genColWidth }

    const gradesStartIndex = colPtr
    for (let i = 0; i < totalComponentCols; i++) {
        columnStyles[colPtr++] = { halign: 'center', cellWidth: componentColWidth }
    }
    const gradesEndIndex = colPtr

    const mgColIndex = cfg.showMediaGeral ? colPtr++ : -1
    if (cfg.showMediaGeral) {
        columnStyles[mgColIndex] = { halign: 'center', cellWidth: mgColWidth, fontStyle: 'bold' }
    }
    const obsColIndex = cfg.showObservacao ? colPtr++ : -1
    if (cfg.showObservacao) {
        columnStyles[obsColIndex] = { halign: 'center', cellWidth: obsColWidth, fontStyle: 'bold' }
    }

    autoTable(doc, {
        startY: tableStartY,
        head: [headerRow1, headerRow2],
        body: tableData,
        theme: 'grid',
        styles: {
            fontSize: 5.5,
            cellPadding: 1,
            overflow: 'ellipsize',
            lineWidth: 0.1
        },
        headStyles: {
            fillColor: getMapHeaderRgb(headerConfig),
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            fontSize: 6
        },
        columnStyles: columnStyles,
        tableWidth: 'auto',
        margin: { left: 10, right: 10 },
        didParseCell: (hookData: any) => {
            if (hookData.section !== 'body') return
            const colIndex = hookData.column.index

            if (colIndex >= gradesStartIndex && colIndex < gradesEndIndex) {
                hookData.cell.styles.halign = 'center'
                const cellValue = hookData.cell.raw
                if (cellValue && cellValue !== '-') {
                    const nota = parseFloat(cellValue)
                    if (!isNaN(nota)) {
                        const compColIndex = colIndex - gradesStartIndex
                        let currentIndex = 0
                        let component: any = null
                        for (const disciplina of disciplinas) {
                            for (const comp of disciplina.componentes) {
                                if (currentIndex === compColIndex) {
                                    component = comp
                                    break
                                }
                                currentIndex++
                            }
                            if (component) break
                        }
                        if (component) {
                            hookData.cell.styles.textColor = getGradeColorRGB(
                                nota,
                                data.nivel_ensino,
                                data.classe,
                                component.is_calculated || false,
                                colorConfig
                            )
                        }
                    }
                }
            }

            if (colIndex === mgColIndex) {
                const cellValue = hookData.cell.raw
                if (cellValue && cellValue !== '-') {
                    const nota = parseFloat(cellValue)
                    if (!isNaN(nota)) {
                        hookData.cell.styles.textColor = getGradeColorRGB(
                            nota, data.nivel_ensino, data.classe, true, colorConfig
                        )
                        hookData.cell.styles.fontStyle = 'bold'
                    }
                }
            }

            if (colIndex === obsColIndex) {
                const obs = String(hookData.cell.raw || '')
                if (obs === 'Transita') {
                    // Observação Transita: azul (não verde)
                    hookData.cell.styles.textColor = [37, 99, 235]
                    hookData.cell.styles.fontStyle = 'bold'
                } else if (obs === 'Não Transita') {
                    hookData.cell.styles.textColor = [220, 38, 38]
                    hookData.cell.styles.fontStyle = 'bold'
                } else if (obs === 'Condicional') {
                    hookData.cell.styles.textColor = [180, 120, 0]
                    hookData.cell.styles.fontStyle = 'bold'
                } else if (obs === 'Aguardando Notas') {
                    hookData.cell.styles.textColor = [100, 116, 139]
                }
                hookData.cell.styles.fontSize = 5.5
            }
        },
        didDrawPage: () => addPDFFooter(doc, pageWidth, pageHeight)
    })

    let cursorY = (doc as any).lastAutoTable.finalY + 4
    const footerBlockHeight = 55
    if (cursorY + footerBlockHeight > pageHeight - 28) {
        doc.addPage()
        cursorY = 12
        addPDFFooter(doc, pageWidth, pageHeight)
    }

    // Compact statistics table
    if (cfg.showStatistics && data.estatisticas) {
        autoTable(doc, {
            startY: cursorY,
            head: [[
                { content: 'ESTATÍSTICAS GERAIS', colSpan: 4, styles: { halign: 'left', fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 7 } }
            ]],
            body: [[
                { content: `Total\n${data.estatisticas.geral.total_alunos}`, styles: { halign: 'center' } },
                { content: `Aprovados\n${data.estatisticas.geral.aprovados}`, styles: { halign: 'center', textColor: [37, 99, 235] } },
                { content: `Reprovados\n${data.estatisticas.geral.reprovados}`, styles: { halign: 'center', textColor: [220, 38, 38] } },
                { content: `Média\n${data.estatisticas.geral.media_turma?.toFixed(2) || 'N/A'}`, styles: { halign: 'center' } },
            ]],
            theme: 'grid',
            styles: {
                fontSize: 6,
                cellPadding: 1.2,
                lineWidth: 0.1,
                valign: 'middle',
            },
            margin: { left: 10, right: pageWidth - 10 - 120 },
            tableWidth: 120,
            didDrawPage: () => addPDFFooter(doc, pageWidth, pageHeight),
        })
        cursorY = (doc as any).lastAutoTable.finalY + 3
    }

    // Compact legend table (conforme configuração)
    const exposedComponentes = disciplinas.flatMap((d) => d.componentes)
    const legendRows = buildPautaGeralLegendaTableRows(exposedComponentes, {
        nivelEnsino: data.nivel_ensino || data.turma.nivel_ensino,
        classe: data.classe,
        showMediaGeral: cfg.showMediaGeral,
        showObservacao: cfg.showObservacao,
        componenteParaMediaGeral: cfg.componenteParaMediaGeral,
        metricSourceComponentes,
    })

    const legendBody = legendRows.map((r) => [r.item, r.detalhe])
    const legendTableWidth = Math.min(pageWidth - 20, 260)
    const legendApproxHeight = Math.max(18, 10 + legendBody.length * 5)
    const signaturesApproxHeight = 48
    cursorY = ensureMiniPautaSpace(
        doc,
        cursorY,
        legendApproxHeight + signaturesApproxHeight,
        pageWidth,
        pageHeight
    )

    autoTable(doc, {
        startY: cursorY,
        head: [[
            { content: 'LEGENDA — conforme configuração desta pauta', colSpan: 2, styles: { halign: 'left', fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold', fontSize: 6.5 } }
        ]],
        body: legendBody,
        theme: 'grid',
        styles: {
            fontSize: 5.5,
            cellPadding: 1,
            lineWidth: 0.1,
            overflow: 'linebreak',
            valign: 'top',
        },
        columnStyles: {
            0: { cellWidth: 48, fontStyle: 'bold', textColor: [30, 64, 175] },
            1: { cellWidth: legendTableWidth - 48 },
        },
        margin: { left: 10, right: pageWidth - 10 - legendTableWidth },
        tableWidth: legendTableWidth,
        didDrawPage: () => addPDFFooter(doc, pageWidth, pageHeight),
    })

    cursorY = (doc as any).lastAutoTable.finalY + 4
    addConselhoNotasSignatures(doc, cursorY, pageWidth, pageHeight, conselhoMembers)

    const filename = `pauta-geral_${data.turma.codigo_turma}_${data.turma.ano_lectivo}.pdf`
    doc.save(filename)
}

// ============================================================================
// CONSELHO DE NOTAS — RELATÓRIO / ACTA
// ============================================================================

export interface ConselhoNotasRelatorioData {
    escola?: { nome?: string; provincia?: string; municipio?: string }
    turma: { nome: string; ano_lectivo: string | number; codigo_turma: string; nivel_ensino?: string }
    data_reuniao?: string | null
    local_reuniao?: string | null
    coordenador_nome?: string | null
    secretario_nome?: string | null
    membro_2_nome?: string | null
    parecer_geral?: string | null
    resumo: {
        total: number
        transita: number
        nao_transita: number
        condicional: number
        aguardando: number
        media_turma: number
    }
    deliberacoes: Array<{
        numero_processo: string
        nome_completo: string
        media_geral?: number | null
        frequencia_anual?: number | null
        situacao_sistema: string
        situacao_deliberada: string
        motivo?: string | null
        is_caso_critico: boolean
    }>
    propostas?: Array<{
        aluno: string
        disciplina: string
        componente: string
        valor_atual: number
        valor_proposto: number
        motivo: string
        status: string
    }>
}

export async function generateConselhoNotasPDF(
    data: ConselhoNotasRelatorioData,
    headerConfig: HeaderConfig | null | undefined
): Promise<void> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    let currentY = await renderPautaGeralHeader(
        doc,
        {
            turma: {
                nome: data.turma.nome,
                ano_lectivo: Number(data.turma.ano_lectivo) || 0,
                codigo_turma: data.turma.codigo_turma,
                nivel_ensino: data.turma.nivel_ensino || '',
            },
            trimestre: 3,
            alunos: [],
            disciplinas: [],
            escola: data.escola as any,
        },
        headerConfig,
        pageWidth,
        'RELATORIO DO CONSELHO DE NOTAS'
    )

    currentY += 2

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(`Turma: ${data.turma.nome}`, 14, currentY)
    doc.text(`Ano Lectivo: ${data.turma.ano_lectivo}`, pageWidth / 2, currentY, { align: 'center' })
    doc.text(`Nivel: ${data.turma.nivel_ensino || 'N/D'}`, pageWidth - 14, currentY, { align: 'right' })
    currentY += 5
    doc.text(`Data: ${data.data_reuniao || '____/____/________'}`, 14, currentY)
    doc.text(`Local: ${data.local_reuniao || '________________'}`, pageWidth / 2, currentY)

    currentY += 6
    autoTable(doc, {
        startY: currentY,
        head: [[{ content: 'COMPOSICAO DO CONSELHO', colSpan: 2, styles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8 } }]],
        body: [
            ['Coordenador (Dir. de Turma)', data.coordenador_nome || '—'],
            ['Secretario', data.secretario_nome || '—'],
            ['Membro', data.membro_2_nome || '—'],
        ],
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' }, 1: { cellWidth: pageWidth - 28 - 55 } },
        margin: { left: 14, right: 14 },
        didDrawPage: () => addPDFFooter(doc, pageWidth, pageHeight),
    })

    currentY = (doc as any).lastAutoTable.finalY + 4
    autoTable(doc, {
        startY: currentY,
        head: [[{ content: 'RESUMO ESTATISTICO', colSpan: 5, styles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 } }]],
        body: [[
            `Total\n${data.resumo.total}`,
            `Transita\n${data.resumo.transita}`,
            `Nao Transita\n${data.resumo.nao_transita}`,
            `Condicional\n${data.resumo.condicional}`,
            `Media\n${data.resumo.media_turma.toFixed(2)}`,
        ]],
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5, halign: 'center' },
        margin: { left: 14, right: 14 },
        didDrawPage: () => addPDFFooter(doc, pageWidth, pageHeight),
    })

    currentY = (doc as any).lastAutoTable.finalY + 4
    const criticos = data.deliberacoes.filter((d) => d.is_caso_critico)
    const delibRows = (criticos.length ? criticos : data.deliberacoes.slice(0, 0)).map((d) => [
        d.numero_processo,
        d.nome_completo,
        d.media_geral != null ? Number(d.media_geral).toFixed(1) : '—',
        d.frequencia_anual != null ? `${Number(d.frequencia_anual).toFixed(1)}%` : '—',
        d.situacao_sistema,
        d.situacao_deliberada,
        d.motivo || '—',
    ])

    autoTable(doc, {
        startY: currentY,
        head: [[
            { content: criticos.length ? 'CASOS CRITICOS E DELIBERACOES' : 'CASOS CRITICOS E DELIBERACOES (nenhum)', colSpan: 7, styles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8 } }
        ], ['N. Proc.', 'Nome', 'MG', 'Freq.', 'Sistema', 'Deliberado', 'Motivo']],
        body: delibRows.length
            ? delibRows
            : [['—', 'Sem casos criticos a deliberar', '—', '—', '—', '—', '—']],
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 1, overflow: 'linebreak' },
        columnStyles: {
            0: { cellWidth: 18 },
            1: { cellWidth: 42 },
            2: { cellWidth: 12, halign: 'center' },
            3: { cellWidth: 14, halign: 'center' },
            4: { cellWidth: 22 },
            5: { cellWidth: 22 },
            6: { cellWidth: 'auto' as any },
        },
        margin: { left: 14, right: 14 },
        didDrawPage: () => addPDFFooter(doc, pageWidth, pageHeight),
    })

    currentY = (doc as any).lastAutoTable.finalY + 4
    const propostas = data.propostas || []
    if (propostas.length > 0) {
        autoTable(doc, {
            startY: currentY,
            head: [[
                {
                    content: 'PROPOSTAS DE ALTERACAO DE NOTAS',
                    colSpan: 6,
                    styles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 8 },
                },
            ], ['Aluno', 'Disciplina', 'Comp.', 'Actual', 'Proposto', 'Estado']],
            body: propostas.map((p) => [
                p.aluno,
                p.disciplina,
                p.componente,
                Number(p.valor_atual).toFixed(1),
                Number(p.valor_proposto).toFixed(1),
                p.status,
            ]),
            theme: 'grid',
            styles: { fontSize: 6.5, cellPadding: 1, overflow: 'linebreak' },
            margin: { left: 14, right: 14 },
            didDrawPage: () => addPDFFooter(doc, pageWidth, pageHeight),
        })
        currentY = (doc as any).lastAutoTable.finalY + 5
    } else {
        currentY += 1
    }

    const parecer = doc.splitTextToSize(data.parecer_geral?.trim() || 'Sem parecer registado.', pageWidth - 28)
    const parecerBlock = 8 + parecer.length * 4 + 6
    currentY = ensureMiniPautaSpace(
        doc,
        currentY,
        parecerBlock + 48,
        pageWidth,
        pageHeight
    )

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('Parecer geral:', 14, currentY)
    doc.setFont('helvetica', 'normal')
    doc.text(parecer, 14, currentY + 4)
    currentY += parecerBlock

    addConselhoNotasSignatures(doc, currentY, pageWidth, pageHeight, {
        coordenador_nome: data.coordenador_nome,
        secretario_nome: data.secretario_nome,
        membro_2_nome: data.membro_2_nome,
    })

    doc.save(`conselho-notas_${data.turma.codigo_turma}_${data.turma.ano_lectivo}.pdf`)
}


// ============================================================================
// TERMO DE FREQUÊNCIA DO ALUNO PDF GENERATION
// ============================================================================

interface ComponenteNota {
    codigo: string
    nome: string
    nota: number | null
}

interface DisciplinaTermoFrequencia {
    id: string
    nome: string
    codigo_disciplina: string
    notas_trimestrais: {
        1: number | null
        2: number | null
        3: number | null
    }
    // Components separated by trimester - each trimester has its own list
    componentesPorTrimestre: {
        1: ComponenteNota[]
        2: ComponenteNota[]
        3: ComponenteNota[]
    }
    nota_final: number | null
    classificacao: string
    transita: boolean
}

interface TermoFrequenciaData {
    aluno: {
        numero_processo: string
        nome_completo: string
        data_nascimento?: string
        genero?: string
        nacionalidade?: string
        naturalidade?: string
        tipo_documento?: string
        numero_documento?: string
        nome_pai?: string
        nome_mae?: string
        nome_encarregado?: string
        parentesco_encarregado?: string
        telefone_encarregado?: string
        email_encarregado?: string
        profissao_encarregado?: string
        provincia?: string
        municipio?: string
        bairro?: string
        rua?: string
        endereco?: string
        ano_ingresso?: number
        escola_anterior?: string
        classe_anterior?: string
        observacoes_academicas?: string
    }
    turma: {
        nome: string
        ano_lectivo: number
        codigo_turma: string
        nivel_ensino: string
    }
    disciplinas: DisciplinaTermoFrequencia[]
    estatisticas: {
        media_geral: number
        total_disciplinas: number
        disciplinas_aprovadas: number
        disciplinas_reprovadas: number
        transita: boolean
    }
    escola?: {
        nome: string
        provincia: string
        municipio: string
    }
}

/**
 * Renders the PDF header for Termo de Frequência
 * Includes the student process number in red after the title
 */
async function renderTermoFrequenciaHeader(
    doc: jsPDF,
    data: TermoFrequenciaData,
    headerConfig: HeaderConfig | null | undefined,
    pageWidth: number
): Promise<number> {
    let currentY = 10

    if (headerConfig) {
        // Logo (if configured)
        if (headerConfig.logo_url) {
            try {
                const base64Image = await imageUrlToBase64(headerConfig.logo_url)
                const imageFormat = getImageFormat(headerConfig.logo_url)

                const maxLogoSize = 30
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

        const fontSize = headerConfig.tamanho_fonte_outros || 10
        doc.setFontSize(fontSize)
        doc.setFont('helvetica', 'normal')

        if (headerConfig.mostrar_republica && headerConfig.texto_republica) {
            doc.text(headerConfig.texto_republica, pageWidth / 2, currentY, { align: 'center' })
            currentY += fontSize * 0.5
        }

        if (headerConfig.mostrar_governo_provincial && headerConfig.provincia) {
            doc.text(`Governo Provincial da ${headerConfig.provincia}`, pageWidth / 2, currentY, { align: 'center' })
            currentY += fontSize * 0.5
        }

        if (headerConfig.mostrar_orgao_educacao && headerConfig.nivel_ensino) {
            const orgaoText = getOrgaoEducacao(
                headerConfig.nivel_ensino,
                headerConfig.provincia,
                headerConfig.municipio
            )
            doc.text(orgaoText, pageWidth / 2, currentY, { align: 'center' })
            currentY += fontSize * 0.5
        }

        doc.text(headerConfig.nome_escola, pageWidth / 2, currentY, { align: 'center' })
        currentY += fontSize * 0.7

        // Title with process number in red
        const termoFontSize = headerConfig.tamanho_fonte_mini_pauta || 14
        doc.setFontSize(termoFontSize)
        doc.setFont('helvetica', 'bold')

        const titleText = 'TERMO DE FREQUÊNCIA DO ALUNO Nº '
        const titleWidth = doc.getTextWidth(titleText)
        const processNumber = data.aluno.numero_processo
        const processWidth = doc.getTextWidth(processNumber)
        const totalWidth = titleWidth + processWidth
        const startX = (pageWidth - totalWidth) / 2

        doc.setTextColor(0, 0, 0)
        doc.text(titleText, startX, currentY)
        doc.setTextColor(220, 38, 38) // Red color
        doc.text(processNumber, startX + titleWidth, currentY)
        doc.setTextColor(0, 0, 0) // Reset to black

        currentY += termoFontSize * 0.6
    } else {
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')

        const titleText = 'TERMO DE FREQUÊNCIA DO ALUNO Nº '
        const titleWidth = doc.getTextWidth(titleText)
        const processNumber = data.aluno.numero_processo
        const processWidth = doc.getTextWidth(processNumber)
        const totalWidth = titleWidth + processWidth
        const startX = (pageWidth - totalWidth) / 2

        doc.setTextColor(0, 0, 0)
        doc.text(titleText, startX, currentY)
        doc.setTextColor(220, 38, 38) // Red color
        doc.text(processNumber, startX + titleWidth, currentY)
        doc.setTextColor(0, 0, 0) // Reset to black

        currentY += 7

        if (data.escola) {
            doc.setFontSize(10)
            doc.setFont('helvetica', 'normal')
            doc.text(data.escola.nome, pageWidth / 2, currentY, { align: 'center' })
            currentY += 5
            doc.text(`${data.escola.provincia} - ${data.escola.municipio}`, pageWidth / 2, currentY, { align: 'center' })
            currentY += 7
        } else {
            currentY += 7
        }
    }

    return currentY
}

/**
 * Renders student information section in a 4-column layout
 * Displays all student information organized in rows with 4 columns each
 */
function renderStudentInfo(
    doc: jsPDF,
    data: TermoFrequenciaData,
    startY: number,
    pageWidth: number
): number {
    let currentY = startY

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('INFORMAÇÕES DO ALUNO', 14, currentY)
    currentY += 5

    // Helper to format gender
    const formatGender = (g?: string) => {
        if (!g) return ''
        return g === 'M' ? 'Masculino' : 'Feminino'
    }

    // Build address string
    const buildAddress = () => {
        const parts = [
            data.aluno.rua,
            data.aluno.bairro,
            data.aluno.municipio,
            data.aluno.provincia
        ].filter(Boolean)
        return parts.length > 0 ? parts.join(', ') : (data.aluno.endereco || '')
    }

    // Prepare rows for student info table (4 columns per row)
    // Each cell contains label + value
    const createCell = (label: string, value: string | number | undefined | null) => {
        if (value === undefined || value === null || value === '') return null
        return { label, value: String(value) }
    }

    // Row 1: Basic identification
    const row1 = [
        createCell('Nome Completo', data.aluno.nome_completo),
        createCell('Nº Processo', data.aluno.numero_processo),
        createCell('Turma', data.turma.nome),
        createCell('Ano Lectivo', data.turma.ano_lectivo),
    ]

    // Row 2: Personal data
    const row2 = [
        createCell('Data Nascimento', data.aluno.data_nascimento),
        createCell('Género', formatGender(data.aluno.genero)),
        createCell('Nacionalidade', data.aluno.nacionalidade),
        createCell('Naturalidade', data.aluno.naturalidade),
    ]

    // Row 3: Document and parents
    const docInfo = data.aluno.tipo_documento && data.aluno.numero_documento
        ? `${data.aluno.tipo_documento}: ${data.aluno.numero_documento}`
        : data.aluno.numero_documento
    const row3 = [
        createCell('Documento', docInfo),
        createCell('Nome do Pai', data.aluno.nome_pai),
        createCell('Nome da Mãe', data.aluno.nome_mae),
        createCell('Encarregado', data.aluno.nome_encarregado),
    ]

    // Row 4: Guardian details and address
    const row4 = [
        createCell('Parentesco', data.aluno.parentesco_encarregado),
        createCell('Telefone', data.aluno.telefone_encarregado),
        createCell('Profissão Enc.', data.aluno.profissao_encarregado),
        createCell('Morada', buildAddress()),
    ]

    // Render using autoTable for consistent styling
    const colWidth = (pageWidth - 28) / 4
    const tableData: any[][] = []

    const processRow = (row: (ReturnType<typeof createCell>)[]) => {
        const tableRow: any[] = []
        row.forEach(cell => {
            if (cell) {
                tableRow.push({
                    content: `${cell.label}: ${cell.value}`,
                    styles: { fontSize: 8, cellPadding: 2 }
                })
            } else {
                tableRow.push({ content: '', styles: { cellPadding: 2 } })
            }
        })
        return tableRow
    }

    tableData.push(processRow(row1))
    tableData.push(processRow(row2))
    tableData.push(processRow(row3))
    tableData.push(processRow(row4))

    autoTable(doc, {
        startY: currentY,
        body: tableData,
        theme: 'plain',
        styles: {
            fontSize: 8,
            cellPadding: 1,
            lineColor: [230, 230, 230],
            lineWidth: 0.05,
        },
        columnStyles: {
            0: { cellWidth: colWidth },
            1: { cellWidth: colWidth },
            2: { cellWidth: colWidth },
            3: { cellWidth: colWidth },
        },
        margin: { left: 14, right: 14 },
    })

    return (doc as any).lastAutoTable.finalY + 3
}

/**
 * Generates PDF for Termo de Frequência do Aluno
 * Shows student information and academic performance across all disciplines and trimesters
 * Uses landscape orientation to accommodate component columns
 */
export async function generateTermoFrequenciaPDF(
    data: TermoFrequenciaData,
    headerConfig: HeaderConfig | null | undefined,
    colorConfig: GradeColorConfig | null
): Promise<void> {
    // Use landscape orientation for better component display
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    // Render header
    let currentY = await renderTermoFrequenciaHeader(doc, data, headerConfig, pageWidth)

    // Render student information
    currentY = renderStudentInfo(doc, data, currentY + 3, pageWidth)

    // Academic Performance Section
    currentY += 5  // Add space above to separate from previous table
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('DESEMPENHO ACADÉMICO', pageWidth / 2, currentY, { align: 'center' })
    currentY += 3  // Minimal space below to bring table very close

    // Calculate unified component structure across ALL disciplines
    const componentCodesByTrimester: { 1: Map<string, ComponenteNota>; 2: Map<string, ComponenteNota>; 3: Map<string, ComponenteNota> } = {
        1: new Map(),
        2: new Map(),
        3: new Map()
    }

    data.disciplinas.forEach(disciplina => {
        if (disciplina.componentesPorTrimestre) {
            ([1, 2, 3] as const).forEach(t => {
                disciplina.componentesPorTrimestre[t].forEach(comp => {
                    if (!componentCodesByTrimester[t].has(comp.codigo)) {
                        componentCodesByTrimester[t].set(comp.codigo, comp)
                    }
                })
            })
        }
    })

    const componentsT1 = Array.from(componentCodesByTrimester[1].values())
    const componentsT2 = Array.from(componentCodesByTrimester[2].values())
    const componentsT3 = Array.from(componentCodesByTrimester[3].values())

    const hasAnyComponents = componentsT1.length > 0 || componentsT2.length > 0 || componentsT3.length > 0

    // Helper function to get nota for a specific component
    const getNotaForComponent = (disciplina: DisciplinaTermoFrequencia, trimestre: 1 | 2 | 3, codigo: string): string => {
        if (!disciplina.componentesPorTrimestre) return '-'
        const comp = disciplina.componentesPorTrimestre[trimestre].find(c => c.codigo === codigo)
        return comp?.nota !== null && comp?.nota !== undefined ? comp.nota.toFixed(1) : '-'
    }

    if (hasAnyComponents) {
        // Build two-row header for component-based display
        const headerRow1: any[] = [
            { content: 'Nº', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'DISCIPLINAS', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
        ]

        // Add trimester headers with colSpan
        if (componentsT1.length > 0) {
            headerRow1.push({
                content: '1º TRIMESTRE',
                colSpan: componentsT1.length,
                styles: { halign: 'center', valign: 'middle', fillColor: getMapHeaderRgb(headerConfig) }
            })
        }
        if (componentsT2.length > 0) {
            headerRow1.push({
                content: '2º TRIMESTRE',
                colSpan: componentsT2.length,
                styles: { halign: 'center', valign: 'middle', fillColor: getMapHeaderRgb(headerConfig) }
            })
        }
        if (componentsT3.length > 0) {
            headerRow1.push({
                content: '3º TRIMESTRE',
                colSpan: componentsT3.length,
                styles: { halign: 'center', valign: 'middle', fillColor: getMapHeaderRgb(headerConfig) }
            })
        }

        headerRow1.push({ content: 'MÉDIA FINAL', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } })
        headerRow1.push({ content: 'OBSERVAÇÃO', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } })

        // Second row: component codes
        const headerRow2: any[] = []
        componentsT1.forEach(comp => {
            headerRow2.push({ content: comp.codigo, styles: { halign: 'center', valign: 'middle', fontSize: 7 } })
        })
        componentsT2.forEach(comp => {
            headerRow2.push({ content: comp.codigo, styles: { halign: 'center', valign: 'middle', fontSize: 7 } })
        })
        componentsT3.forEach(comp => {
            headerRow2.push({ content: comp.codigo, styles: { halign: 'center', valign: 'middle', fontSize: 7 } })
        })

        // Build table data
        const tableData: any[] = []
        data.disciplinas.forEach((disciplina, index) => {
            const row: any[] = [
                (index + 1).toString(),
                disciplina.nome
            ]

            // Add component values for each trimester
            componentsT1.forEach(comp => {
                row.push(getNotaForComponent(disciplina, 1, comp.codigo))
            })
            componentsT2.forEach(comp => {
                row.push(getNotaForComponent(disciplina, 2, comp.codigo))
            })
            componentsT3.forEach(comp => {
                row.push(getNotaForComponent(disciplina, 3, comp.codigo))
            })

            row.push(disciplina.nota_final !== null ? disciplina.nota_final.toFixed(1) : '-')
            row.push(disciplina.transita ? 'Transita' : 'Não Transita')

            tableData.push(row)
        })

        // Calculate column widths dynamically
        const totalComponents = componentsT1.length + componentsT2.length + componentsT3.length
        const fixedWidth = 10 + 50 + 20 + 28 // Nº + Disciplina + Média Final + Observação
        const availableWidth = pageWidth - 28 - fixedWidth // margins
        const componentColWidth = Math.min(15, availableWidth / totalComponents)

        const columnStyles: any = {
            0: { halign: 'center', cellWidth: 10 },
            1: { halign: 'left', cellWidth: 50 }
        }

        let colIndex = 2
        for (let i = 0; i < totalComponents; i++) {
            columnStyles[colIndex++] = { halign: 'center', cellWidth: componentColWidth }
        }
        columnStyles[colIndex++] = { halign: 'center', cellWidth: 20 }
        columnStyles[colIndex] = { halign: 'center', cellWidth: 28 }

        // Generate table
        autoTable(doc, {
            startY: currentY,
            head: [headerRow1, headerRow2],
            body: tableData,
            theme: 'grid',
            styles: {
                fontSize: 8,
                cellPadding: 1,
                overflow: 'linebreak'
            },
            headStyles: {
                fillColor: getMapHeaderRgb(headerConfig),
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle'
            },
            columnStyles,
            didParseCell: (hookData: any) => {
                if (hookData.section === 'body') {
                    const colIdx = hookData.column.index
                    const totalCols = 2 + totalComponents + 2 // Nº + Disc + components + MF + Obs

                    // Color code grade values (component columns and média final)
                    if (colIdx >= 2 && colIdx < totalCols - 1) {
                        const cellValue = hookData.cell.raw
                        if (cellValue && cellValue !== '-') {
                            const nota = parseFloat(cellValue)
                            if (!isNaN(nota)) {
                                const color = getGradeColorRGB(
                                    nota,
                                    data.turma.nivel_ensino,
                                    undefined,
                                    false,
                                    colorConfig
                                )
                                hookData.cell.styles.textColor = color
                                hookData.cell.styles.fontStyle = 'bold'
                            }
                        }
                    }

                    // Color code observation column (last column)
                    if (colIdx === totalCols - 1 && hookData.cell.raw) {
                        if (hookData.cell.raw.includes('Transita') && !hookData.cell.raw.includes('Não')) {
                            hookData.cell.styles.textColor = [37, 99, 235]  // Blue
                            hookData.cell.styles.fontStyle = 'bold'
                        } else if (hookData.cell.raw.includes('Não')) {
                            hookData.cell.styles.textColor = [239, 68, 68]
                            hookData.cell.styles.fontStyle = 'bold'
                        }
                    }
                }
            },
            didDrawPage: () => addPDFFooter(doc, pageWidth, pageHeight)
        })
    } else {
        // Fallback to simple trimester totals if no components
        const headers = ['Nº', 'Disciplina', '1º Trim', '2º Trim', '3º Trim', 'Média Final', 'Observação']

        const tableData: any[] = data.disciplinas.map((disciplina, index) => [
            (index + 1).toString(),
            disciplina.nome,
            disciplina.notas_trimestrais[1] !== null ? disciplina.notas_trimestrais[1].toFixed(1) : '-',
            disciplina.notas_trimestrais[2] !== null ? disciplina.notas_trimestrais[2].toFixed(1) : '-',
            disciplina.notas_trimestrais[3] !== null ? disciplina.notas_trimestrais[3].toFixed(1) : '-',
            disciplina.nota_final !== null ? disciplina.nota_final.toFixed(1) : '-',
            disciplina.transita ? 'Transita' : 'Não Transita'
        ])

        autoTable(doc, {
            startY: currentY,
            head: [headers],
            body: tableData,
            theme: 'grid',
            styles: {
                fontSize: 9,
                cellPadding: 3,
                overflow: 'linebreak'
            },
            headStyles: {
                fillColor: getMapHeaderRgb(headerConfig),
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10 },
                1: { halign: 'left', cellWidth: 80 },
                2: { halign: 'center', cellWidth: 25 },
                3: { halign: 'center', cellWidth: 25 },
                4: { halign: 'center', cellWidth: 25 },
                5: { halign: 'center', cellWidth: 25 },
                6: { halign: 'center', cellWidth: 35 }
            },
            didParseCell: (hookData: any) => {
                if (hookData.section === 'body' && hookData.column.index >= 2 && hookData.column.index <= 5) {
                    const cellValue = hookData.cell.raw
                    if (cellValue && cellValue !== '-') {
                        const nota = parseFloat(cellValue)
                        if (!isNaN(nota)) {
                            const color = getGradeColorRGB(nota, data.turma.nivel_ensino, undefined, false, colorConfig)
                            hookData.cell.styles.textColor = color
                            hookData.cell.styles.fontStyle = 'bold'
                        }
                    }
                }
                if (hookData.section === 'body' && hookData.column.index === 6 && hookData.cell.raw) {
                    if (hookData.cell.raw.includes('Transita') && !hookData.cell.raw.includes('Não')) {
                        hookData.cell.styles.textColor = [37, 99, 235]  // Blue
                        hookData.cell.styles.fontStyle = 'bold'
                    } else if (hookData.cell.raw.includes('Não')) {
                        hookData.cell.styles.textColor = [239, 68, 68]
                        hookData.cell.styles.fontStyle = 'bold'
                    }
                }
            },
            didDrawPage: () => addPDFFooter(doc, pageWidth, pageHeight)
        })
    }

    // Keep statistics + signatures together (never orphan signatures alone)
    const finalY = ensureMiniPautaSpace(
        doc,
        (doc as any).lastAutoTable.finalY + 8,
        40,
        pageWidth,
        pageHeight
    )

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('ESTATÍSTICAS:', 14, finalY)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const statsText = `Total: ${data.estatisticas.total_disciplinas} | Aprov.: ${data.estatisticas.disciplinas_aprovadas} | Reprov.: ${data.estatisticas.disciplinas_reprovadas} | Média Geral: ${data.estatisticas.media_geral.toFixed(2)}`
    doc.text(statsText, 45, finalY)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    if (data.estatisticas.transita) {
        doc.setTextColor(37, 99, 235)
        doc.text('OBSERVAÇÃO: TRANSITA', pageWidth - 14, finalY, { align: 'right' })
    } else {
        doc.setTextColor(239, 68, 68)
        doc.text('OBSERVAÇÃO: NÃO TRANSITA', pageWidth - 14, finalY, { align: 'right' })
    }
    doc.setTextColor(0, 0, 0)

    const signY = finalY + 25
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')

    const signWidth = (pageWidth - 56) / 3
    const signX1 = 14
    const signX2 = 14 + signWidth + 14
    const signX3 = 14 + (signWidth + 14) * 2

    doc.setDrawColor(100, 100, 100)
    doc.line(signX1, signY, signX1 + signWidth, signY)
    doc.line(signX2, signY, signX2 + signWidth, signY)
    doc.line(signX3, signY, signX3 + signWidth, signY)

    doc.setFontSize(8)
    doc.text('O(A) Director(a) de Turma', signX1 + signWidth / 2, signY + 4, { align: 'center' })
    doc.text('O(A) Director(a) Pedagógico(a)', signX2 + signWidth / 2, signY + 4, { align: 'center' })
    doc.text('O(A) Director(a) Geral', signX3 + signWidth / 2, signY + 4, { align: 'center' })

    const filename = `termo-frequencia_${data.aluno.numero_processo}_${data.turma.ano_lectivo}.pdf`
    doc.save(filename)
}

/**
 * Generates Termo de Frequência PDF as Blob (for batch processing)
 * Same as generateTermoFrequenciaPDF but returns Blob instead of downloading
 * Uses landscape orientation to accommodate component columns
 */
export async function generateTermoFrequenciaPDFBlob(
    data: TermoFrequenciaData,
    headerConfig: HeaderConfig | null | undefined,
    colorConfig: GradeColorConfig | null
): Promise<Blob> {
    // Use landscape orientation for better component display
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    // Render header
    let currentY = await renderTermoFrequenciaHeader(doc, data, headerConfig, pageWidth)

    // Render student information
    currentY = renderStudentInfo(doc, data, currentY + 3, pageWidth)

    currentY += 5  // Add space above to separate from previous table
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('DESEMPENHO ACADÉMICO', pageWidth / 2, currentY, { align: 'center' })
    currentY += 3  // Minimal space below to bring table very close

    // Calculate unified component structure across ALL disciplines
    const componentCodesByTrimester: { 1: Map<string, ComponenteNota>; 2: Map<string, ComponenteNota>; 3: Map<string, ComponenteNota> } = {
        1: new Map(),
        2: new Map(),
        3: new Map()
    }

    data.disciplinas.forEach(disciplina => {
        if (disciplina.componentesPorTrimestre) {
            ([1, 2, 3] as const).forEach(t => {
                disciplina.componentesPorTrimestre[t].forEach(comp => {
                    if (!componentCodesByTrimester[t].has(comp.codigo)) {
                        componentCodesByTrimester[t].set(comp.codigo, comp)
                    }
                })
            })
        }
    })

    const componentsT1 = Array.from(componentCodesByTrimester[1].values())
    const componentsT2 = Array.from(componentCodesByTrimester[2].values())
    const componentsT3 = Array.from(componentCodesByTrimester[3].values())

    const hasAnyComponents = componentsT1.length > 0 || componentsT2.length > 0 || componentsT3.length > 0

    // Helper function to get nota for a specific component
    const getNotaForComponent = (disciplina: DisciplinaTermoFrequencia, trimestre: 1 | 2 | 3, codigo: string): string => {
        if (!disciplina.componentesPorTrimestre) return '-'
        const comp = disciplina.componentesPorTrimestre[trimestre].find(c => c.codigo === codigo)
        return comp?.nota !== null && comp?.nota !== undefined ? comp.nota.toFixed(1) : '-'
    }

    if (hasAnyComponents) {
        // Build two-row header for component-based display
        const headerRow1: any[] = [
            { content: 'Nº', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'DISCIPLINAS', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
        ]

        // Add trimester headers with colSpan
        if (componentsT1.length > 0) {
            headerRow1.push({
                content: '1º TRIMESTRE',
                colSpan: componentsT1.length,
                styles: { halign: 'center', valign: 'middle', fillColor: getMapHeaderRgb(headerConfig) }
            })
        }
        if (componentsT2.length > 0) {
            headerRow1.push({
                content: '2º TRIMESTRE',
                colSpan: componentsT2.length,
                styles: { halign: 'center', valign: 'middle', fillColor: getMapHeaderRgb(headerConfig) }
            })
        }
        if (componentsT3.length > 0) {
            headerRow1.push({
                content: '3º TRIMESTRE',
                colSpan: componentsT3.length,
                styles: { halign: 'center', valign: 'middle', fillColor: getMapHeaderRgb(headerConfig) }
            })
        }

        headerRow1.push({ content: 'MÉDIA FINAL', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } })
        headerRow1.push({ content: 'OBSERVAÇÃO', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } })

        // Second row: component codes
        const headerRow2: any[] = []
        componentsT1.forEach(comp => {
            headerRow2.push({ content: comp.codigo, styles: { halign: 'center', valign: 'middle', fontSize: 7 } })
        })
        componentsT2.forEach(comp => {
            headerRow2.push({ content: comp.codigo, styles: { halign: 'center', valign: 'middle', fontSize: 7 } })
        })
        componentsT3.forEach(comp => {
            headerRow2.push({ content: comp.codigo, styles: { halign: 'center', valign: 'middle', fontSize: 7 } })
        })

        // Build table data
        const tableData: any[] = []
        data.disciplinas.forEach((disciplina, index) => {
            const row: any[] = [
                (index + 1).toString(),
                disciplina.nome
            ]

            // Add component values for each trimester
            componentsT1.forEach(comp => {
                row.push(getNotaForComponent(disciplina, 1, comp.codigo))
            })
            componentsT2.forEach(comp => {
                row.push(getNotaForComponent(disciplina, 2, comp.codigo))
            })
            componentsT3.forEach(comp => {
                row.push(getNotaForComponent(disciplina, 3, comp.codigo))
            })

            row.push(disciplina.nota_final !== null ? disciplina.nota_final.toFixed(1) : '-')
            row.push(disciplina.transita ? 'Transita' : 'Não Transita')

            tableData.push(row)
        })

        // Calculate column widths dynamically
        const totalComponents = componentsT1.length + componentsT2.length + componentsT3.length
        const fixedWidth = 10 + 50 + 20 + 28 // Nº + Disciplina + Média Final + Observação
        const availableWidth = pageWidth - 28 - fixedWidth // margins
        const componentColWidth = Math.min(15, availableWidth / totalComponents)

        const columnStyles: any = {
            0: { halign: 'center', cellWidth: 10 },
            1: { halign: 'left', cellWidth: 50 }
        }

        let colIndex = 2
        for (let i = 0; i < totalComponents; i++) {
            columnStyles[colIndex++] = { halign: 'center', cellWidth: componentColWidth }
        }
        columnStyles[colIndex++] = { halign: 'center', cellWidth: 20 }
        columnStyles[colIndex] = { halign: 'center', cellWidth: 28 }

        // Generate table
        autoTable(doc, {
            startY: currentY,
            head: [headerRow1, headerRow2],
            body: tableData,
            theme: 'grid',
            styles: {
                fontSize: 8,
                cellPadding: 1,
                overflow: 'linebreak'
            },
            headStyles: {
                fillColor: getMapHeaderRgb(headerConfig),
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle'
            },
            columnStyles,
            didParseCell: (hookData: any) => {
                if (hookData.section === 'body') {
                    const colIdx = hookData.column.index
                    const totalCols = 2 + totalComponents + 2 // Nº + Disc + components + MF + Obs

                    // Color code grade values (component columns and média final)
                    if (colIdx >= 2 && colIdx < totalCols - 1) {
                        const cellValue = hookData.cell.raw
                        if (cellValue && cellValue !== '-') {
                            const nota = parseFloat(cellValue)
                            if (!isNaN(nota)) {
                                const color = getGradeColorRGB(
                                    nota,
                                    data.turma.nivel_ensino,
                                    undefined,
                                    false,
                                    colorConfig
                                )
                                hookData.cell.styles.textColor = color
                                hookData.cell.styles.fontStyle = 'bold'
                            }
                        }
                    }

                    // Color code observation column (last column)
                    if (colIdx === totalCols - 1 && hookData.cell.raw) {
                        if (hookData.cell.raw.includes('Transita') && !hookData.cell.raw.includes('Não')) {
                            hookData.cell.styles.textColor = [37, 99, 235]  // Blue
                            hookData.cell.styles.fontStyle = 'bold'
                        } else if (hookData.cell.raw.includes('Não')) {
                            hookData.cell.styles.textColor = [239, 68, 68]
                            hookData.cell.styles.fontStyle = 'bold'
                        }
                    }
                }
            },
            didDrawPage: () => addPDFFooter(doc, pageWidth, pageHeight)
        })
    } else {
        // Fallback to simple trimester totals if no components
        const headers = ['Nº', 'Disciplina', '1º Trim', '2º Trim', '3º Trim', 'Média Final', 'Observação']

        const tableData: any[] = data.disciplinas.map((disciplina, index) => [
            (index + 1).toString(),
            disciplina.nome,
            disciplina.notas_trimestrais[1] !== null ? disciplina.notas_trimestrais[1].toFixed(1) : '-',
            disciplina.notas_trimestrais[2] !== null ? disciplina.notas_trimestrais[2].toFixed(1) : '-',
            disciplina.notas_trimestrais[3] !== null ? disciplina.notas_trimestrais[3].toFixed(1) : '-',
            disciplina.nota_final !== null ? disciplina.nota_final.toFixed(1) : '-',
            disciplina.transita ? 'Transita' : 'Não Transita'
        ])

        autoTable(doc, {
            startY: currentY,
            head: [headers],
            body: tableData,
            theme: 'grid',
            styles: {
                fontSize: 9,
                cellPadding: 3,
                overflow: 'linebreak'
            },
            headStyles: {
                fillColor: getMapHeaderRgb(headerConfig),
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10 },
                1: { halign: 'left', cellWidth: 80 },
                2: { halign: 'center', cellWidth: 25 },
                3: { halign: 'center', cellWidth: 25 },
                4: { halign: 'center', cellWidth: 25 },
                5: { halign: 'center', cellWidth: 25 },
                6: { halign: 'center', cellWidth: 35 }
            },
            didParseCell: (hookData: any) => {
                if (hookData.section === 'body' && hookData.column.index >= 2 && hookData.column.index <= 5) {
                    const cellValue = hookData.cell.raw
                    if (cellValue && cellValue !== '-') {
                        const nota = parseFloat(cellValue)
                        if (!isNaN(nota)) {
                            const color = getGradeColorRGB(nota, data.turma.nivel_ensino, undefined, false, colorConfig)
                            hookData.cell.styles.textColor = color
                            hookData.cell.styles.fontStyle = 'bold'
                        }
                    }
                }
                if (hookData.section === 'body' && hookData.column.index === 6 && hookData.cell.raw) {
                    if (hookData.cell.raw.includes('Transita') && !hookData.cell.raw.includes('Não')) {
                        hookData.cell.styles.textColor = [37, 99, 235]  // Blue
                        hookData.cell.styles.fontStyle = 'bold'
                    } else if (hookData.cell.raw.includes('Não')) {
                        hookData.cell.styles.textColor = [239, 68, 68]
                        hookData.cell.styles.fontStyle = 'bold'
                    }
                }
            },
            didDrawPage: () => addPDFFooter(doc, pageWidth, pageHeight)
        })
    }

    const finalY = ensureMiniPautaSpace(
        doc,
        (doc as any).lastAutoTable.finalY + 8,
        40,
        pageWidth,
        pageHeight
    )

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('ESTATÍSTICAS:', 14, finalY)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const statsText = `Total: ${data.estatisticas.total_disciplinas} | Aprov.: ${data.estatisticas.disciplinas_aprovadas} | Reprov.: ${data.estatisticas.disciplinas_reprovadas} | Média Geral: ${data.estatisticas.media_geral.toFixed(2)}`
    doc.text(statsText, 45, finalY)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    if (data.estatisticas.transita) {
        doc.setTextColor(37, 99, 235)
        doc.text('OBSERVAÇÃO: TRANSITA', pageWidth - 14, finalY, { align: 'right' })
    } else {
        doc.setTextColor(239, 68, 68)
        doc.text('OBSERVAÇÃO: NÃO TRANSITA', pageWidth - 14, finalY, { align: 'right' })
    }
    doc.setTextColor(0, 0, 0)

    const signY = finalY + 25
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')

    const signWidth = (pageWidth - 56) / 3
    const signX1 = 14
    const signX2 = 14 + signWidth + 14
    const signX3 = 14 + (signWidth + 14) * 2

    doc.setDrawColor(100, 100, 100)
    doc.line(signX1, signY, signX1 + signWidth, signY)
    doc.line(signX2, signY, signX2 + signWidth, signY)
    doc.line(signX3, signY, signX3 + signWidth, signY)

    doc.setFontSize(8)
    doc.text('O(A) Director(a) de Turma', signX1 + signWidth / 2, signY + 4, { align: 'center' })
    doc.text('O(A) Director(a) Pedagógico(a)', signX2 + signWidth / 2, signY + 4, { align: 'center' })
    doc.text('O(A) Director(a) Geral', signX3 + signWidth / 2, signY + 4, { align: 'center' })

    return doc.output('blob')
}

/**
 * Generates batch Termos de Frequência and creates a ZIP file
 */
export async function generateBatchTermosFrequenciaZip(
    termosData: TermoFrequenciaData[],
    turmaInfo: { codigo: string; ano: number },
    headerConfig: HeaderConfig | null | undefined,
    colorConfig: GradeColorConfig | null,
    onProgress?: (current: number, total: number, alunoNome: string) => void
): Promise<{ blob: Blob; filename: string; errors: Array<{ aluno: string; error: string }> }> {
    const zip = new JSZip()
    const errors: Array<{ aluno: string; error: string }> = []
    const total = termosData.length

    for (let i = 0; i < termosData.length; i++) {
        const termoData = termosData[i]

        try {
            // Update progress
            if (onProgress) {
                onProgress(i + 1, total, termoData.aluno.nome_completo)
            }

            // Generate PDF as Blob
            const pdfBlob = await generateTermoFrequenciaPDFBlob(termoData, headerConfig, colorConfig)

            // Create filename: termo_[numero_processo]_[nome].pdf
            const nomeFormatado = termoData.aluno.nome_completo
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Remove accents
                .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
                .replace(/\s+/g, '_') // Replace spaces with underscore
                .substring(0, 50) // Limit length

            const filename = `termo_${termoData.aluno.numero_processo}_${nomeFormatado}.pdf`

            // Add to ZIP
            zip.file(filename, pdfBlob)

        } catch (error) {
            console.error(`Error generating PDF for ${termoData.aluno.nome_completo}:`, error)
            errors.push({
                aluno: termoData.aluno.nome_completo,
                error: error instanceof Error ? error.message : 'Erro desconhecido'
            })
        }
    }

    // Generate ZIP blob
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const zipFilename = `termos_frequencia_${turmaInfo.codigo}_${turmaInfo.ano}.zip`

    return {
        blob: zipBlob,
        filename: zipFilename,
        errors
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAPA DE APROVEITAMENTO
// ─────────────────────────────────────────────────────────────────────────────

export interface MapaAproveitamentoDisciplinaData {
    id: string
    nome: string
    inscritos_m: number
    inscritos_f: number
    frequentaram_m: number
    frequentaram_f: number
    aprovados_m: number
    aprovados_f: number
    reprovados_m: number
    reprovados_f: number
    desistentes_m: number
    desistentes_f: number
    transferidos_m: number
    transferidos_f: number
    media_turma: number | null
}

export interface MapaAproveitamentoTurmaDataPDF {
    turma_id: string
    turma_nome: string
    turma_codigo: string
    classe: string
    nivel_ensino: string
    disciplinas: MapaAproveitamentoDisciplinaData[]
}

export interface MapaAproveitamentoPDFData {
    escola: {
        nome: string
        provincia: string
        municipio: string
        codigo_escola?: string
    }
    ano_lectivo: number
    trimestre: number | 'anual'
    turmas: MapaAproveitamentoTurmaDataPDF[]
}

/**
 * Generate Mapa de Aproveitamento PDF (Angola MED format)
 * Landscape orientation, one section per turma, columnar breakdown by M/F/T
 */
export async function generateMapaAproveitamentoPDF(
    data: MapaAproveitamentoPDFData,
    headerConfig?: HeaderConfig | null
): Promise<void> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    const trimLabel = data.trimestre === 'anual' ? 'Anual' : `${data.trimestre}º Trimestre`
    const escola = headerConfig?.nome_escola || data.escola.nome
    const provincia = headerConfig?.provincia || data.escola.provincia
    const municipio = headerConfig?.municipio || data.escola.municipio
    const dataImpressao = new Date().toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    })

    for (let ti = 0; ti < data.turmas.length; ti++) {
        const turma = data.turmas[ti]
        if (ti > 0) doc.addPage()

        let y = 10

        // ── Header ──────────────────────────────────────────────────────────
        if (headerConfig?.logo_url) {
            try {
                const base64Image = await imageUrlToBase64(headerConfig.logo_url)
                const imageFormat = getImageFormat(headerConfig.logo_url)
                const lw = 18, lh = 18
                doc.addImage(base64Image, imageFormat, (pageWidth - lw) / 2, y, lw, lh)
                y += lh + 2
            } catch (_) { /* skip logo on error */ }
        }

        const fSm = headerConfig?.tamanho_fonte_outros || 9
        doc.setFontSize(fSm)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(0, 0, 0)

        if (headerConfig?.mostrar_republica && headerConfig?.texto_republica) {
            doc.text(headerConfig.texto_republica, pageWidth / 2, y, { align: 'center' })
            y += fSm * 0.45
        }
        if (headerConfig?.mostrar_governo_provincial) {
            doc.text(`Governo Provincial da ${provincia}`, pageWidth / 2, y, { align: 'center' })
            y += fSm * 0.45
        }
        if (headerConfig?.mostrar_orgao_educacao && headerConfig?.nivel_ensino) {
            const orgaoText = getOrgaoEducacao(headerConfig.nivel_ensino, provincia, municipio)
            doc.text(orgaoText, pageWidth / 2, y, { align: 'center' })
            y += fSm * 0.45
        }

        doc.setFontSize(fSm + 1)
        doc.setFont('helvetica', 'bold')
        doc.text(escola, pageWidth / 2, y, { align: 'center' })
        y += (fSm + 1) * 0.55

        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('MAPA DE APROVEITAMENTO', pageWidth / 2, y, { align: 'center' })
        y += 6

        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.text(
            `Ano Lectivo: ${data.ano_lectivo}   |   Período: ${trimLabel}   |   Município: ${municipio}`,
            pageWidth / 2, y, { align: 'center' }
        )
        y += 5

        // ── Turma info ───────────────────────────────────────────────────────
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text(
            `Turma: ${turma.turma_codigo}   |   Classe: ${turma.classe}   |   Nível: ${turma.nivel_ensino}`,
            14, y
        )
        y += 5

        // ── Table ────────────────────────────────────────────────────────────
        const colGroups = ['Inscritos', 'Frequentaram', 'Aprovados', 'Reprovados', 'Desistentes', 'Transferidos']
        const subHeaders = ['M', 'F', 'T']

        // Build header arrays for autoTable
        const head: any[][] = [
            [
                { content: 'Disciplinas', rowSpan: 2, styles: { valign: 'middle', halign: 'left', fontStyle: 'bold', fillColor: getMapHeaderRgb(headerConfig, DEFAULT_MAP_HEADER_COLOR_MAPA), textColor: 255 } },
                ...colGroups.map(g => ({
                    content: g,
                    colSpan: 3,
                    styles: { halign: 'center', fontStyle: 'bold', fillColor: getMapHeaderRgb(headerConfig, DEFAULT_MAP_HEADER_COLOR_MAPA), textColor: 255 }
                })),
                { content: 'Média', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold', fillColor: getMapHeaderRgb(headerConfig, DEFAULT_MAP_HEADER_COLOR_MAPA), textColor: 255 } }
            ],
            [
                ...Array(6).fill(null).flatMap(() =>
                    subHeaders.map(s => ({
                        content: s,
                        styles: { halign: 'center', fontStyle: 'bold', fillColor: getMapHeaderRgbAlt(headerConfig, DEFAULT_MAP_HEADER_COLOR_MAPA), textColor: 255 }
                    }))
                )
            ]
        ]

        // Build body rows
        const body: any[][] = turma.disciplinas.map((disc, idx) => {
            const insT = disc.inscritos_m + disc.inscritos_f
            const freqT = disc.frequentaram_m + disc.frequentaram_f
            const aprvT = disc.aprovados_m + disc.aprovados_f
            const repT = disc.reprovados_m + disc.reprovados_f
            const desT = disc.desistentes_m + disc.desistentes_f
            const transT = disc.transferidos_m + disc.transferidos_f
            const bg = idx % 2 === 0 ? [255, 255, 255] : [245, 247, 250]
            const cellStyle = { fillColor: bg }

            return [
                { content: disc.nome, styles: { ...cellStyle, fontStyle: 'bold', halign: 'left' } },
                // Inscritos
                { content: disc.inscritos_m || '—', styles: cellStyle },
                { content: disc.inscritos_f || '—', styles: cellStyle },
                { content: insT || '—', styles: { ...cellStyle, fontStyle: 'bold' } },
                // Frequentaram
                { content: disc.frequentaram_m || '—', styles: cellStyle },
                { content: disc.frequentaram_f || '—', styles: cellStyle },
                { content: freqT || '—', styles: { ...cellStyle, fontStyle: 'bold' } },
                // Aprovados
                { content: disc.aprovados_m || '—', styles: { ...cellStyle, textColor: [22, 101, 52] } },
                { content: disc.aprovados_f || '—', styles: { ...cellStyle, textColor: [22, 101, 52] } },
                { content: aprvT || '—', styles: { ...cellStyle, fontStyle: 'bold', textColor: [22, 101, 52] } },
                // Reprovados
                { content: disc.reprovados_m || '—', styles: { ...cellStyle, textColor: [185, 28, 28] } },
                { content: disc.reprovados_f || '—', styles: { ...cellStyle, textColor: [185, 28, 28] } },
                { content: repT || '—', styles: { ...cellStyle, fontStyle: 'bold', textColor: [185, 28, 28] } },
                // Desistentes
                { content: disc.desistentes_m || '—', styles: { ...cellStyle, textColor: [180, 83, 9] } },
                { content: disc.desistentes_f || '—', styles: { ...cellStyle, textColor: [180, 83, 9] } },
                { content: desT || '—', styles: { ...cellStyle, fontStyle: 'bold', textColor: [180, 83, 9] } },
                // Transferidos
                { content: disc.transferidos_m || '—', styles: { ...cellStyle, textColor: [29, 78, 216] } },
                { content: disc.transferidos_f || '—', styles: { ...cellStyle, textColor: [29, 78, 216] } },
                { content: transT || '—', styles: { ...cellStyle, fontStyle: 'bold', textColor: [29, 78, 216] } },
                // Média
                { content: disc.media_turma !== null && disc.media_turma !== undefined ? disc.media_turma.toFixed(1) : '—', styles: { ...cellStyle, fontStyle: 'bold', halign: 'center' } }
            ]
        })

        // Totals row
        const totInsM = turma.disciplinas.reduce((s, d) => s + d.inscritos_m, 0)
        const totInsF = turma.disciplinas.reduce((s, d) => s + d.inscritos_f, 0)
        const totFreqM = turma.disciplinas.reduce((s, d) => s + d.frequentaram_m, 0)
        const totFreqF = turma.disciplinas.reduce((s, d) => s + d.frequentaram_f, 0)
        const totAprvM = turma.disciplinas.reduce((s, d) => s + d.aprovados_m, 0)
        const totAprvF = turma.disciplinas.reduce((s, d) => s + d.aprovados_f, 0)
        const totRepM = turma.disciplinas.reduce((s, d) => s + d.reprovados_m, 0)
        const totRepF = turma.disciplinas.reduce((s, d) => s + d.reprovados_f, 0)
        const totDesM = turma.disciplinas.reduce((s, d) => s + d.desistentes_m, 0)
        const totDesF = turma.disciplinas.reduce((s, d) => s + d.desistentes_f, 0)
        const totTransM = turma.disciplinas.reduce((s, d) => s + d.transferidos_m, 0)
        const totTransF = turma.disciplinas.reduce((s, d) => s + d.transferidos_f, 0)

        const totalFreq = totFreqM + totFreqF
        const totalAprv = totAprvM + totAprvF
        const taxa = totalFreq > 0 ? (totalAprv / totalFreq * 100).toFixed(1) : '0.0'

        const totStyle = { fillColor: [219, 234, 254], fontStyle: 'bold' as const }
        body.push([
            { content: 'TOTAL', styles: { ...totStyle, halign: 'left', textColor: [15, 40, 100] } },
            { content: totInsM, styles: totStyle },
            { content: totInsF, styles: totStyle },
            { content: totInsM + totInsF, styles: { ...totStyle, textColor: [15, 40, 100] } },
            { content: totFreqM, styles: totStyle },
            { content: totFreqF, styles: totStyle },
            { content: totFreqM + totFreqF, styles: { ...totStyle, textColor: [15, 40, 100] } },
            { content: totAprvM, styles: { ...totStyle, textColor: [22, 101, 52] } },
            { content: totAprvF, styles: { ...totStyle, textColor: [22, 101, 52] } },
            { content: totalAprv, styles: { ...totStyle, textColor: [22, 101, 52] } },
            { content: totRepM, styles: { ...totStyle, textColor: [185, 28, 28] } },
            { content: totRepF, styles: { ...totStyle, textColor: [185, 28, 28] } },
            { content: totRepM + totRepF, styles: { ...totStyle, textColor: [185, 28, 28] } },
            { content: totDesM, styles: { ...totStyle, textColor: [180, 83, 9] } },
            { content: totDesF, styles: { ...totStyle, textColor: [180, 83, 9] } },
            { content: totDesM + totDesF, styles: { ...totStyle, textColor: [180, 83, 9] } },
            { content: totTransM, styles: { ...totStyle, textColor: [29, 78, 216] } },
            { content: totTransF, styles: { ...totStyle, textColor: [29, 78, 216] } },
            { content: totTransM + totTransF, styles: { ...totStyle, textColor: [29, 78, 216] } },
            { content: `${taxa}%`, styles: { ...totStyle, textColor: [15, 40, 100] } }
        ])

        autoTable(doc, {
            head,
            body,
            startY: y,
            margin: { left: 8, right: 8 },
            tableWidth: pageWidth - 16,
            styles: {
                fontSize: 7.5,
                cellPadding: 1.5,
                halign: 'center',
                valign: 'middle',
                lineWidth: 0.3,
                lineColor: [180, 180, 180]
            },
            columnStyles: {
                0: { halign: 'left', cellWidth: 42 },
                3: { fontStyle: 'bold' }, 6: { fontStyle: 'bold' },
                9: { fontStyle: 'bold' }, 12: { fontStyle: 'bold' },
                15: { fontStyle: 'bold' }, 18: { fontStyle: 'bold' },
                19: { halign: 'center', fontStyle: 'bold', cellWidth: 14 }
            },
            didDrawPage: () => {
                // Footer on each page
                doc.setFontSize(7)
                doc.setFont('helvetica', 'normal')
                doc.setTextColor(120, 120, 120)
                doc.text(
                    `M=Masculino  F=Feminino  T=Total  |  Data de impressão: ${dataImpressao}`,
                    pageWidth / 2, pageHeight - 9, { align: 'center' }
                )
                const pg = (doc as any).internal.getCurrentPageInfo().pageNumber
                const total = (doc as any).internal.getNumberOfPages()
                doc.text(`Pág. ${pg}/${total}`, pageWidth - 14, pageHeight - 9, { align: 'right' })
                doc.text(APP_DOCUMENT_BRAND_LINE, pageWidth / 2, pageHeight - 4.5, { align: 'center' })
                doc.setTextColor(0, 0, 0)
            }
        })
    }

    // ── Signature block (last page) ──────────────────────────────────────────
    // Line first, then labels BELOW with enough gap so text never overlaps the line
    const signatureLabels = [
        'O(A) Director(a) da Escola',
        'O(A) Responsável Pedagógico(a)',
        'O(A) Director(a) Municipal'
    ]
    const signWidth = (pageWidth - 56) / 3
    const signGap = 14
    const signX = [14, 14 + signWidth + signGap, 14 + (signWidth + signGap) * 2]
    const neededSpace = 36 // date + gap + line + label + footer margin

    let finalY = (doc as any).lastAutoTable?.finalY || pageHeight - 50
    if (finalY + neededSpace > pageHeight - 12) {
        doc.addPage()
        finalY = 20
    }

    // Print date (visible on the document body, not only in footer)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    doc.text(`Data de impressão: ${dataImpressao}`, 14, finalY + 8)

    const sigY = finalY + 22
    doc.setDrawColor(80, 80, 80)
    doc.setLineWidth(0.3)
    signX.forEach((x) => {
        doc.line(x, sigY, x + signWidth, sigY)
    })

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    signatureLabels.forEach((label, i) => {
        doc.text(label, signX[i] + signWidth / 2, sigY + 6, { align: 'center' })
    })

    const filename = `mapa_aproveitamento_${data.ano_lectivo}_${data.trimestre === 'anual' ? 'anual' : `T${data.trimestre}`}.pdf`
    doc.save(filename)
}

// ── Boletim de Notas do Aluno (por trimestre) ────────────────────────────────

interface BoletimComponenteNotaPdf {
    codigo: string
    nome: string
    nota: number | null
    is_calculated?: boolean
}

interface BoletimDisciplinaPdf {
    id: string
    nome: string
    codigo_disciplina: string
    componentes: BoletimComponenteNotaPdf[]
    nota_trimestral: number | null
    classificacao: string
    aprovado: boolean
}

export interface BoletimNotasPdfData {
    aluno: {
        numero_processo: string
        nome_completo: string
        data_nascimento?: string
        genero?: string
        nome_encarregado?: string
        telefone_encarregado?: string
    }
    turma: {
        nome: string
        ano_lectivo: number
        codigo_turma: string
        nivel_ensino: string
    }
    trimestre: 1 | 2 | 3
    disciplinas: BoletimDisciplinaPdf[]
    estatisticas: {
        media_geral: number
        total_disciplinas: number
        disciplinas_aprovadas: number
        disciplinas_reprovadas: number
        limiar_aprovacao: number
        is_primary: boolean
    }
    escola?: {
        nome: string
        provincia: string
        municipio: string
    }
}

const BOLETIM_TRIMESTRE_LABELS: Record<1 | 2 | 3, string> = {
    1: '1º Trimestre',
    2: '2º Trimestre',
    3: '3º Trimestre',
}

async function renderBoletimHeader(
    doc: jsPDF,
    data: BoletimNotasPdfData,
    headerConfig: HeaderConfig | null | undefined,
    pageWidth: number
): Promise<number> {
    let currentY = 10

    if (headerConfig) {
        if (headerConfig.logo_url) {
            try {
                const base64Image = await imageUrlToBase64(headerConfig.logo_url)
                const imageFormat = getImageFormat(headerConfig.logo_url)
                const maxLogoSize = 28
                let logoWidth = (headerConfig.logo_width || 50) * 0.26
                let logoHeight = (headerConfig.logo_height || 50) * 0.26
                if (logoWidth > maxLogoSize || logoHeight > maxLogoSize) {
                    const scale = Math.min(maxLogoSize / logoWidth, maxLogoSize / logoHeight)
                    logoWidth *= scale
                    logoHeight *= scale
                }
                doc.addImage(base64Image, imageFormat, (pageWidth - logoWidth) / 2, currentY, logoWidth, logoHeight)
                currentY += logoHeight + 3
            } catch (err) {
                console.error('Error adding logo to boletim PDF:', err)
            }
        }

        const fontSize = headerConfig.tamanho_fonte_outros || 9
        doc.setFontSize(fontSize)
        doc.setFont('helvetica', 'normal')

        if (headerConfig.mostrar_republica && headerConfig.texto_republica) {
            doc.text(headerConfig.texto_republica, pageWidth / 2, currentY, { align: 'center' })
            currentY += fontSize * 0.5
        }
        if (headerConfig.mostrar_governo_provincial && headerConfig.provincia) {
            doc.text(`Governo Provincial da ${headerConfig.provincia}`, pageWidth / 2, currentY, { align: 'center' })
            currentY += fontSize * 0.5
        }
        if (headerConfig.mostrar_orgao_educacao && headerConfig.nivel_ensino) {
            doc.text(
                getOrgaoEducacao(headerConfig.nivel_ensino, headerConfig.provincia, headerConfig.municipio),
                pageWidth / 2,
                currentY,
                { align: 'center' }
            )
            currentY += fontSize * 0.5
        }

        doc.setFont('helvetica', 'bold')
        doc.text(headerConfig.nome_escola, pageWidth / 2, currentY, { align: 'center' })
        currentY += fontSize * 0.7
    } else if (data.escola) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text(data.escola.nome, pageWidth / 2, currentY, { align: 'center' })
        currentY += 5
        doc.setFont('helvetica', 'normal')
        doc.text(`${data.escola.provincia} — ${data.escola.municipio}`, pageWidth / 2, currentY, { align: 'center' })
        currentY += 6
    }

    const titleSize = headerConfig?.tamanho_fonte_mini_pauta || 13
    doc.setFontSize(titleSize)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text(
        `BOLETIM DE NOTAS DO ALUNO — ${BOLETIM_TRIMESTRE_LABELS[data.trimestre].toUpperCase()}`,
        pageWidth / 2,
        currentY,
        { align: 'center' }
    )
    currentY += titleSize * 0.55

    doc.setFontSize(10)
    doc.setTextColor(220, 38, 38)
    doc.text(`Nº Processo: ${data.aluno.numero_processo}`, pageWidth / 2, currentY, { align: 'center' })
    doc.setTextColor(0, 0, 0)
    currentY += 6

    return currentY
}

/**
 * Generates printable Boletim de Notas PDF for a single trimester.
 * Adapts pass threshold by education level (Primário: 5, Secundário: 10).
 */
export async function generateBoletimNotasPDF(
    data: BoletimNotasPdfData,
    headerConfig: HeaderConfig | null | undefined,
    colorConfig: GradeColorConfig | null
): Promise<void> {
    const blob = await generateBoletimNotasPDFBlob(data, headerConfig, colorConfig)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `boletim_notas_${data.aluno.numero_processo}_T${data.trimestre}_${data.turma.ano_lectivo}.pdf`
    link.click()
    URL.revokeObjectURL(url)
}

export async function generateBoletimNotasPDFBlob(
    data: BoletimNotasPdfData,
    headerConfig: HeaderConfig | null | undefined,
    colorConfig: GradeColorConfig | null
): Promise<Blob> {
    const componentCount = (() => {
        const codes = new Set<string>()
        data.disciplinas.forEach((d) => d.componentes.forEach((c) => codes.add(c.codigo)))
        return codes.size
    })()

    const orientation = componentCount > 5 ? 'landscape' : 'portrait'
    const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    let currentY = await renderBoletimHeader(doc, data, headerConfig, pageWidth)

    // Student info
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('DADOS DO ALUNO', 14, currentY)
    currentY += 4

    const generoLabel = data.aluno.genero === 'M' ? 'Masculino' : data.aluno.genero === 'F' ? 'Feminino' : ''
    const infoRows = [
        [
            `Nome: ${data.aluno.nome_completo}`,
            `Turma: ${data.turma.nome}`,
            `Ano Lectivo: ${data.turma.ano_lectivo}`,
        ],
        [
            generoLabel ? `Género: ${generoLabel}` : '',
            data.aluno.data_nascimento ? `Nascimento: ${data.aluno.data_nascimento}` : '',
            `Nível: ${data.turma.nivel_ensino}`,
        ].filter(Boolean),
    ]
    if (data.aluno.nome_encarregado) {
        infoRows.push([
            `Encarregado: ${data.aluno.nome_encarregado}`,
            data.aluno.telefone_encarregado ? `Tel.: ${data.aluno.telefone_encarregado}` : '',
            `Limiar: ${data.estatisticas.limiar_aprovacao} valores`,
        ].filter(Boolean))
    }

    autoTable(doc, {
        startY: currentY,
        body: infoRows.map((row) => row.map((cell) => ({ content: cell, styles: { fontSize: 8, cellPadding: 1.5 } }))),
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1.5, lineColor: [230, 230, 230], lineWidth: 0.05 },
        margin: { left: 14, right: 14 },
    })
    currentY = (doc as any).lastAutoTable.finalY + 6

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('DESEMPENHO ACADÉMICO', pageWidth / 2, currentY, { align: 'center' })
    currentY += 3

    const componentCodesMap = new Map<string, BoletimComponenteNotaPdf>()
    data.disciplinas.forEach((disciplina) => {
        disciplina.componentes.forEach((comp) => {
            if (!componentCodesMap.has(comp.codigo)) {
                componentCodesMap.set(comp.codigo, comp)
            }
        })
    })
    const componentCodes = Array.from(componentCodesMap.values())

    const head = [
        'Nº',
        'Disciplina',
        ...componentCodes.map((c) => c.codigo),
        'Classificação',
    ]

    const body = data.disciplinas.map((disciplina, index) => {
        const row: string[] = [
            String(index + 1),
            disciplina.nome,
        ]
        componentCodes.forEach((comp) => {
            const found = disciplina.componentes.find((c) => c.codigo === comp.codigo)
            row.push(found?.nota !== null && found?.nota !== undefined ? found.nota.toFixed(1) : '—')
        })
        row.push(disciplina.classificacao)
        return row
    })

    const classeMatch = data.turma.nome.match(/(\d+[ªº]\s*Classe)/i)
    const classe = classeMatch ? classeMatch[1] : undefined
    const notaColStart = 2
    const notaColEnd = 1 + componentCodes.length
    const classifCol = notaColEnd + 1

    autoTable(doc, {
        startY: currentY,
        head: [head],
        body,
        theme: 'grid',
        styles: {
            fontSize: componentCount > 6 ? 7 : 8,
            cellPadding: 1.5,
            overflow: 'linebreak',
            halign: 'center',
        },
        headStyles: {
            fillColor: getMapHeaderRgb(headerConfig),
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { halign: 'left', cellWidth: orientation === 'landscape' ? 45 : 38 },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (hookData: any) => {
            if (hookData.section !== 'body') return
            const col = hookData.column.index
            const raw = hookData.cell.raw
            if (col >= notaColStart && col <= notaColEnd && raw && raw !== '—') {
                const nota = parseFloat(raw)
                if (!isNaN(nota)) {
                    const isCalc = componentCodes[col - notaColStart]?.is_calculated === true
                    hookData.cell.styles.textColor = getGradeColorRGB(
                        nota,
                        data.turma.nivel_ensino,
                        classe,
                        isCalc,
                        colorConfig
                    )
                    hookData.cell.styles.fontStyle = 'bold'
                }
            }
            if (col === classifCol && typeof raw === 'string') {
                if (raw === 'Aprovado' || raw === 'Excelente' || raw === 'Bom' || raw === 'Suficiente') {
                    hookData.cell.styles.textColor = [37, 99, 235]
                    hookData.cell.styles.fontStyle = 'bold'
                } else if (raw === 'Reprovado' || raw === 'Insuficiente') {
                    hookData.cell.styles.textColor = [220, 38, 38]
                    hookData.cell.styles.fontStyle = 'bold'
                }
            }
        },
        didDrawPage: () => addPDFFooter(doc, pageWidth, pageHeight),
    })

    // Keep summary + signatures together (never orphan signatures alone on a page)
    let finalY = ensureMiniPautaSpace(
        doc,
        (doc as any).lastAutoTable.finalY + 8,
        48,
        pageWidth,
        pageHeight
    )
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('RESUMO DO TRIMESTRE', 14, finalY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const statsLine = `Disciplinas: ${data.estatisticas.total_disciplinas}  |  Aprovadas: ${data.estatisticas.disciplinas_aprovadas}  |  Reprovadas: ${data.estatisticas.disciplinas_reprovadas}  |  Média: ${data.estatisticas.media_geral > 0 ? data.estatisticas.media_geral.toFixed(2) : '—'}  |  Limiar: ${data.estatisticas.limiar_aprovacao}`
    doc.text(statsLine, 14, finalY + 5)

    const nivelLabel = data.estatisticas.is_primary ? 'Ensino Primário' : 'Ensino Secundário'
    doc.text(`Escala de aproveitamento conforme ${nivelLabel}.`, 14, finalY + 10)

    const signY = finalY + 28
    const signWidth = (pageWidth - 56) / 3
    const signXs = [14, 14 + signWidth + 14, 14 + (signWidth + 14) * 2]
    const signLabels = [
        'O(A) Encarregado de Educação',
        'O(A) Director(a) de Turma',
        'O(A) Director(a) Pedagógico(a)',
    ]

    doc.setDrawColor(100, 100, 100)
    doc.setLineWidth(0.3)
    signXs.forEach((x) => doc.line(x, signY, x + signWidth, signY))
    doc.setFontSize(8)
    signLabels.forEach((label, i) => {
        doc.text(label, signXs[i] + signWidth / 2, signY + 5, { align: 'center' })
    })

    doc.setFontSize(7)
    doc.setTextColor(100, 100, 100)
    doc.text(
        `Emitido em ${new Date().toLocaleDateString('pt-AO')} — ${BOLETIM_TRIMESTRE_LABELS[data.trimestre]} / ${data.turma.ano_lectivo}`,
        pageWidth / 2,
        signY + 14,
        { align: 'center' }
    )
    doc.setTextColor(0, 0, 0)

    return doc.output('blob')
}

/**
 * Batch-generate boletins for multiple students as a ZIP archive.
 */
export async function generateBatchBoletinsZip(
    boletins: BoletimNotasPdfData[],
    headerConfig: HeaderConfig | null | undefined,
    colorConfig: GradeColorConfig | null,
    onProgress?: (current: number, total: number, alunoNome: string) => void
): Promise<void> {
    const zip = new JSZip()
    const total = boletins.length

    for (let i = 0; i < boletins.length; i++) {
        const boletim = boletins[i]
        onProgress?.(i + 1, total, boletim.aluno.nome_completo)
        const blob = await generateBoletimNotasPDFBlob(boletim, headerConfig, colorConfig)
        const safeName = boletim.aluno.nome_completo.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')
        zip.file(
            `boletim_T${boletim.trimestre}_${boletim.aluno.numero_processo}_${safeName}.pdf`,
            blob
        )
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const link = document.createElement('a')
    link.href = url
    const first = boletins[0]
    link.download = `boletins_T${first?.trimestre ?? 1}_${first?.turma.ano_lectivo ?? ''}.zip`
    link.click()
    URL.revokeObjectURL(url)
}

/** Dados do Quadro de Honra / Prémio de Mérito para PDF */
export interface QuadroHonraPDFEntry {
    posicao: number
    aluno_id?: string
    numero_processo: string
    nome_completo: string
    nota: number
    nota_arredondada: number
    classificacao: string
    medalha: string | null
    foto_url?: string | null
}

export interface QuadroHonraPDFData {
    escola: {
        nome: string
        provincia: string
        municipio: string
        codigo_escola?: string
    }
    turma: {
        id: string
        nome: string
        codigo_turma: string
        ano_lectivo: string | number
        nivel_ensino: string
        classe?: string
    }
    trimestre: 1 | 2 | 3 | 'anual'
    mode: 'disciplina' | 'global'
    disciplinas: Array<{
        disciplina_id: string
        disciplina_nome: string
        disciplina_codigo?: string
        entries: QuadroHonraPDFEntry[]
    }>
    globalEntries?: QuadroHonraPDFEntry[]
}

async function drawQuadroHonraCards(
    doc: jsPDF,
    entries: QuadroHonraPDFEntry[],
    startY: number,
    pageWidth: number,
    pageHeight: number
): Promise<number> {
    const marginX = 12
    const gap = 4
    const cols = 3
    const cardW = (pageWidth - marginX * 2 - gap * (cols - 1)) / cols
    const cardH = 52
    const photoW = 18
    const photoH = 24
    let y = startY
    let col = 0

    for (const entry of entries) {
        if (y + cardH > pageHeight - 14) {
            doc.addPage()
            y = 14
            col = 0
        }

        const x = marginX + col * (cardW + gap)

        doc.setDrawColor(212, 175, 55)
        doc.setFillColor(255, 252, 245)
        doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD')

        // Accent bar by medal
        if (entry.medalha === 'Ouro') doc.setFillColor(245, 158, 11)
        else if (entry.medalha === 'Prata') doc.setFillColor(148, 163, 184)
        else if (entry.medalha === 'Bronze') doc.setFillColor(194, 105, 42)
        else doc.setFillColor(180, 120, 20)
        doc.rect(x, y, cardW, 2.2, 'F')

        // Position badge
        doc.setFillColor(30, 41, 59)
        doc.circle(x + 5, y + 7, 3.2, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')
        doc.text(`${entry.posicao}º`, x + 5, y + 8.1, { align: 'center' })

        // Passport photo
        const photoX = x + 6
        const photoY = y + 12
        doc.setDrawColor(203, 213, 225)
        doc.setFillColor(241, 245, 249)
        doc.roundedRect(photoX, photoY, photoW, photoH, 1, 1, 'FD')

        if (entry.foto_url) {
            try {
                const base64 = await imageUrlToBase64(entry.foto_url)
                const fmt = getImageFormat(entry.foto_url)
                doc.addImage(base64, fmt, photoX + 0.4, photoY + 0.4, photoW - 0.8, photoH - 0.8)
            } catch (_) {
                doc.setTextColor(100, 116, 139)
                doc.setFontSize(6)
                doc.setFont('helvetica', 'normal')
                doc.text('Sem foto', photoX + photoW / 2, photoY + photoH / 2, { align: 'center' })
            }
        } else {
            doc.setTextColor(100, 116, 139)
            doc.setFontSize(6)
            doc.setFont('helvetica', 'normal')
            doc.text('Sem foto', photoX + photoW / 2, photoY + photoH / 2, { align: 'center' })
        }

        const textX = photoX + photoW + 3
        const textMaxW = cardW - photoW - 12

        doc.setTextColor(15, 23, 42)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        const nomeLines = doc.splitTextToSize(entry.nome_completo, textMaxW)
        doc.text(nomeLines.slice(0, 2), textX, y + 16)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.5)
        doc.setTextColor(100, 116, 139)
        doc.text(`N.º ${entry.numero_processo}`, textX, y + 26)

        doc.setTextColor(146, 64, 14)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text(entry.nota.toFixed(1), textX, y + 34)

        doc.setFontSize(6.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(71, 85, 105)
        doc.text(`${entry.classificacao} · arred. ${entry.nota_arredondada}`, textX, y + 39)

        if (entry.medalha) {
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(7)
            doc.setTextColor(120, 53, 15)
            doc.text(entry.medalha.toUpperCase(), textX, y + 45)
        }

        col += 1
        if (col >= cols) {
            col = 0
            y += cardH + gap
        }
    }

    if (col !== 0) y += cardH + gap
    return y
}

/**
 * PDF do Quadro de Honra (anual) / Prémio de Mérito (trimestral) — Dec. Ext. 76/24
 * Layout em cartões com fotografia tipo passe.
 */
export async function generateQuadroHonraPDF(
    data: QuadroHonraPDFData,
    headerConfig?: HeaderConfig | null
): Promise<void> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const trimLabel = data.trimestre === 'anual' ? 'Anual' : `${data.trimestre}º Trimestre`
    const distincao = data.trimestre === 'anual' ? 'QUADRO DE HONRA' : 'PRÉMIO DE MÉRITO'
    const escola = headerConfig?.nome_escola || data.escola.nome
    const provincia = headerConfig?.provincia || data.escola.provincia
    const municipio = headerConfig?.municipio || data.escola.municipio

    let y = 12

    if (headerConfig?.logo_url) {
        try {
            const base64Image = await imageUrlToBase64(headerConfig.logo_url)
            const imageFormat = getImageFormat(headerConfig.logo_url)
            const lw = 16, lh = 16
            doc.addImage(base64Image, imageFormat, (pageWidth - lw) / 2, y, lw, lh)
            y += lh + 2
        } catch (_) { /* skip */ }
    }

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    if (headerConfig?.mostrar_republica && headerConfig?.texto_republica) {
        doc.text(headerConfig.texto_republica, pageWidth / 2, y, { align: 'center' })
        y += 4
    }
    if (headerConfig?.mostrar_governo_provincial) {
        doc.text(`Governo Provincial da ${provincia}`, pageWidth / 2, y, { align: 'center' })
        y += 4
    }
    if (headerConfig?.mostrar_orgao_educacao && headerConfig?.nivel_ensino) {
        doc.text(getOrgaoEducacao(headerConfig.nivel_ensino, provincia, municipio), pageWidth / 2, y, { align: 'center' })
        y += 4
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(escola, pageWidth / 2, y, { align: 'center' })
    y += 6

    doc.setFontSize(14)
    doc.setTextColor(180, 83, 9)
    doc.text(distincao, pageWidth / 2, y, { align: 'center' })
    y += 5

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text(
        `Decreto Executivo n.º 76/24 — MED  |  ${trimLabel}  |  Ano Lectivo ${data.turma.ano_lectivo}`,
        pageWidth / 2, y, { align: 'center' }
    )
    y += 4
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(
        `Turma: ${data.turma.codigo_turma} — ${data.turma.nome}${data.turma.classe ? ` · ${data.turma.classe}` : ''}`,
        pageWidth / 2, y, { align: 'center' }
    )
    y += 8

    if (data.mode === 'global' && data.globalEntries) {
        y = await drawQuadroHonraCards(doc, data.globalEntries, y, pageWidth, pageHeight)
    } else {
        for (let i = 0; i < data.disciplinas.length; i++) {
            const disc = data.disciplinas[i]
            if (y > pageHeight - 70) {
                doc.addPage()
                y = 14
            }

            doc.setFontSize(11)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(15, 23, 42)
            doc.text(
                `${disc.disciplina_nome}${disc.disciplina_codigo ? ` (${disc.disciplina_codigo})` : ''}`,
                12, y
            )
            y += 4

            if (disc.entries.length === 0) {
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(8)
                doc.setTextColor(100, 116, 139)
                doc.text('Nenhum aluno elegível nesta disciplina.', 12, y + 4)
                y += 10
            } else {
                y = await drawQuadroHonraCards(doc, disc.entries, y, pageWidth, pageHeight)
                y += 4
            }
        }
    }

    const filenamePeriodo = data.trimestre === 'anual' ? 'anual' : `T${data.trimestre}`
    const filenameTipo = data.trimestre === 'anual' ? 'quadro_honra' : 'premio_merito'
    doc.save(`${filenameTipo}_${data.turma.codigo_turma}_${filenamePeriodo}.pdf`)
}

