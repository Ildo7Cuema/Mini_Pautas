import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { imageUrlToBase64 } from '../../../utils/imageUtils'
import { LABELS_DEFICIENCIA, CensoQuestionarioPayload } from '../types'
import { exportCensoPrimarioGeralPdf } from './censoPdfPrimarioGeral'

const BLUE: [number, number, number] = [0, 112, 192]
const BLUE_LIGHT: [number, number, number] = [217, 226, 243]
const ORANGE: [number, number, number] = [237, 125, 49]
const GRAY_BORDER: [number, number, number] = [89, 89, 89]

const LOGO_STRIP = '/censo-logos/branding/logo_strip.png'

function mf(m: number, f: number) {
    return `${m}/${f}`
}

async function loadLogoStrip(): Promise<string | null> {
    try {
        return await imageUrlToBase64(LOGO_STRIP)
    } catch {
        return null
    }
}

function drawConfidentialBanner(doc: jsPDF, y: number, pageWidth: number): number {
    const margin = 10
    const w = pageWidth - margin * 2
    doc.setFillColor(...BLUE_LIGHT)
    doc.setDrawColor(...BLUE)
    doc.rect(margin, y, w, 8, 'FD')
    doc.setFontSize(7)
    doc.setTextColor(...BLUE)
    doc.setFont('helvetica', 'bold')
    doc.text(
        'LEIA ATENTAMENTE O MANUAL DE ORIENTAÇÃO ANTES DO PREENCHIMENTO DO QUESTIONÁRIO. ESTRITAMENTE CONFIDENCIAL.',
        pageWidth / 2,
        y + 5.2,
        { align: 'center' }
    )
    doc.setTextColor(0, 0, 0)
    return y + 11
}

function drawSectionTitle(doc: jsPDF, title: string, y: number, pageWidth: number): number {
    const margin = 10
    doc.setFillColor(...BLUE)
    doc.rect(margin, y, pageWidth - margin * 2, 7, 'F')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.text(title, margin + 2, y + 4.8)
    doc.setTextColor(0, 0, 0)
    return y + 9
}

function drawIdFields(doc: jsPDF, payload: CensoQuestionarioPayload, y: number, _pageWidth: number): number {
    const margin = 10
    const infra = payload.infraestrutura
    const rowH = 8
    const gap = 1.5
    const cols = [
        { label: 'CÓDIGO DA ESCOLA', value: payload.cabecalho.codigo_escola_med || '', w: 38 },
        { label: 'NOME DA INSTITUIÇÃO', value: payload.cabecalho.nome_instituicao, w: 95 },
        { label: 'ANO LECTIVO', value: payload.cabecalho.ano_lectivo, w: 28 },
        { label: 'MÊS DE INÍCIO', value: String(infra?.mes_inicio ?? payload.cabecalho.mes_inicio ?? ''), w: 28 },
        { label: 'MÊS DE TÉRMINO', value: String(infra?.mes_termino ?? payload.cabecalho.mes_termino ?? ''), w: 28 },
    ]
    let x = margin
    for (const col of cols) {
        doc.setFillColor(...BLUE)
        doc.rect(x, y, col.w, 5, 'F')
        doc.setFontSize(5.5)
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.text(col.label, x + 1.2, y + 3.5)
        doc.setDrawColor(...GRAY_BORDER)
        doc.setFillColor(255, 255, 255)
        doc.rect(x, y + 5, col.w, rowH, 'FD')
        doc.setTextColor(0, 0, 0)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.text(String(col.value || ''), x + 1.5, y + 5 + 5.2, { maxWidth: col.w - 3 })
        x += col.w + gap
    }
    return y + 5 + rowH + 4
}

function ensureSpace(doc: jsPDF, y: number, need: number, pageHeight: number, drawHeader: () => number): number {
    if (y + need > pageHeight - 12) {
        doc.addPage()
        return drawHeader()
    }
    return y
}

function footer(doc: jsPDF, pageWidth: number, pageHeight: number, page: number, totalHint: string) {
    doc.setFontSize(7)
    doc.setTextColor(80, 80, 80)
    doc.text(`Página ${page} ${totalHint}`, pageWidth - 10, pageHeight - 6, { align: 'right' })
    doc.setTextColor(0, 0, 0)
}

/**
 * Gera PDF do questionário do Censo Escolar no formato dos modelos MED/INE.
 */
export async function exportCensoQuestionarioPdf(payload: CensoQuestionarioPayload): Promise<void> {
    // Ensino Primário Geral: reprodução fiel do modelo oficial do MED (7 páginas)
    if (payload.cabecalho.modalidade_codigo === 'ensino_primario_geral') {
        await exportCensoPrimarioGeralPdf(payload)
        return
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 10

    const logoStrip = await loadLogoStrip()
    const anoLectivoLabel = payload.cabecalho.ano_lectivo

    const drawPageHeader = (): number => {
        let y = 6
        // Logomarcas oficiais (sem ano fixo) + títulos dinâmicos
        if (logoStrip) {
            const logoW = 118
            const logoH = 14
            doc.addImage(logoStrip, 'PNG', margin, y, logoW, logoH)
            const textX = margin + logoW + 4
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(10)
            doc.setTextColor(...BLUE)
            doc.text(
                `QUESTIONÁRIO PARA ${payload.cabecalho.modalidade_nome.toUpperCase()}`,
                textX,
                y + 5.5,
                { maxWidth: pageWidth - textX - 42 }
            )
            doc.setTextColor(...ORANGE)
            doc.setFontSize(11)
            doc.text(`CENSO ESCOLAR ${anoLectivoLabel}`, textX, y + 12)
            doc.setTextColor(0, 0, 0)
            doc.setFontSize(6.5)
            doc.setFont('helvetica', 'bold')
            doc.text('ID DO QUESTIONÁRIO', pageWidth - margin - 38, y + 4)
            doc.setDrawColor(...GRAY_BORDER)
            doc.rect(pageWidth - margin - 38, y + 5.5, 38, 7)
            if (payload.cabecalho.id_questionario) {
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(8)
                doc.text(payload.cabecalho.id_questionario, pageWidth - margin - 36, y + 10.4, { maxWidth: 34 })
            }
            y += 16
        } else {
            doc.setFontSize(11)
            doc.setTextColor(...BLUE)
            doc.setFont('helvetica', 'bold')
            doc.text(`QUESTIONÁRIO PARA ${payload.cabecalho.modalidade_nome.toUpperCase()}`, margin, y + 5)
            doc.setTextColor(...ORANGE)
            doc.text(`CENSO ESCOLAR ${anoLectivoLabel}`, margin, y + 11)
            doc.setTextColor(0, 0, 0)
            y += 16
        }
        y = drawConfidentialBanner(doc, y, pageWidth)
        return y
    }

    let y = drawPageHeader()
    y = drawIdFields(doc, payload, y, pageWidth)

    // --- 1. Infraestrutura ---
    y = drawSectionTitle(doc, '1. INFRAESTRUTURA DE SUPORTE DISPONÍVEL NA ESCOLA', y, pageWidth)
    const infra = payload.infraestrutura
    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: BLUE_LIGHT, textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6.5 },
        head: [[
            'Total de Salas de aula',
            'Número de Salas de aula (próprias)',
            'Número de Salas de aula (emprestadas)',
            'Número de Salas de aula (arrendadas)',
            'Número de Salas de aula (próprias) em bom estado',
        ]],
        body: [[
            infra?.total_salas ?? '',
            infra?.salas_proprias ?? '',
            infra?.salas_emprestadas ?? '',
            infra?.salas_arrendadas ?? '',
            infra?.salas_proprias_bom_estado ?? '',
        ]],
    })
    y = (doc as any).lastAutoTable.finalY + 4

    // --- 2. Mobiliário ---
    y = ensureSpace(doc, y, 28, pageHeight, drawPageHeader)
    y = drawSectionTitle(doc, '2. MOBILIÁRIO DAS SALAS DE AULA (ASSENTOS, MESAS E QUADROS DIDÁCTICOS) DISPONÍVEL NA ESCOLA', y, pageWidth)
    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 1.3, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: BLUE_LIGHT, textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6 },
        head: [[
            'Total de assentos',
            'Assentos em bom estado',
            'Assentos acessíveis e reguláveis',
            'Total de mesas',
            'Mesas em bom estado',
            'Mesas acessíveis e reguláveis',
            'Total de quadros didácticos',
            'Quadros em bom estado',
        ]],
        body: [[
            infra?.total_assentos ?? '',
            infra?.assentos_bom_estado ?? '',
            infra?.assentos_acessiveis ?? '',
            infra?.total_mesas ?? '',
            infra?.mesas_bom_estado ?? '',
            infra?.mesas_acessiveis ?? '',
            infra?.total_quadros ?? '',
            infra?.quadros_bom_estado ?? '',
        ]],
    })
    y = (doc as any).lastAutoTable.finalY + 4

    // --- Matrículas por classe/turno ---
    doc.addPage()
    y = drawPageHeader()
    y = drawSectionTitle(doc, '3. NÚMERO DE MATRÍCULAS, TURMAS POR CLASSE/ETAPA E TURNO', y, pageWidth)

    const turnos = Array.from(new Set(payload.matriculas_classe_turno.map(r => r.turno)))
    const classes = Array.from(new Set(payload.matriculas_classe_turno.map(r => r.classe)))
    const headTurno = ['Classe / Indicador', ...turnos.map(t => t.toUpperCase()), 'TOTAL']
    const bodyMat: (string | number)[][] = []
    for (const classe of classes) {
        const rows = payload.matriculas_classe_turno.filter(r => r.classe === classe)
        const mats = turnos.map(t => rows.find(r => r.turno === t)?.matriculas ?? 0)
        const turmas = turnos.map(t => rows.find(r => r.turno === t)?.turmas ?? 0)
        bodyMat.push([`${classe} — Matrículas`, ...mats, mats.reduce((a, b) => a + b, 0)])
        bodyMat.push([`${classe} — Turmas`, ...turmas, turmas.reduce((a, b) => a + b, 0)])
    }
    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.4, halign: 'center' },
        headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 0: { halign: 'left', cellWidth: 55 } },
        head: [headTurno],
        body: bodyMat,
    })
    y = (doc as any).lastAutoTable.finalY + 3
    doc.setFontSize(6.5)
    doc.setTextColor(60, 60, 60)
    doc.text(
        `Totais: ${payload.totais.alunos} alunos · ${payload.totais.turmas} turmas · Referência de idade: ${payload.cabecalho.data_referencia_idade}`,
        margin,
        y + 2
    )

    // --- Idade × sexo ---
    doc.addPage()
    y = drawPageHeader()
    y = drawSectionTitle(doc, '4. NÚMERO DE MATRÍCULAS POR CLASSE/ETAPA, IDADE E SEXO', y, pageWidth)
    const idadeRows = payload.matriculas_idade.filter(r => r.M + r.F > 0)
    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 1.2, halign: 'center' },
        headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
        head: [['Classe', 'Faixa etária', 'M', 'F', 'Total']],
        body: (idadeRows.length ? idadeRows : [{ classe: '—', faixa_etaria: 'Sem dados', M: 0, F: 0 }]).map(r => [
            r.classe,
            r.faixa_etaria,
            r.M,
            r.F,
            r.M + r.F,
        ]),
    })

    // --- Deficiências ---
    doc.addPage()
    y = drawPageHeader()
    y = drawSectionTitle(doc, '5. NÚMERO DE MATRÍCULAS POR CLASSE/ETAPA, TIPO DE DEFICIÊNCIA E SEXO', y, pageWidth)
    const defRows = payload.matriculas_deficiencia.filter(r => r.M + r.F > 0)
    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 1.2, halign: 'center' },
        headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold' },
        head: [['Classe', 'Tipo de deficiência', 'M', 'F', 'Total']],
        body: (defRows.length
            ? defRows
            : [{ classe: '—', tipo_deficiencia: 'nenhuma' as const, M: 0, F: 0 }]
        ).map(r => [
            r.classe,
            LABELS_DEFICIENCIA[r.tipo_deficiencia] || r.tipo_deficiencia,
            r.M,
            r.F,
            r.M + r.F,
        ]),
    })

    // --- Professores ---
    doc.addPage()
    y = drawPageHeader()
    y = drawSectionTitle(doc, '6. NÚMERO DE PROFESSORES FRENTE AO ALUNO POR NÍVEL ACADÉMICO E SEXO', y, pageWidth)
    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.4, halign: 'center' },
        headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold' },
        head: [['Nível académico', 'M', 'F', 'Total']],
        body: payload.professores_nivel_academico.map(r => [r.nivel_academico, r.M, r.F, r.M + r.F]),
    })
    y = (doc as any).lastAutoTable.finalY + 5
    y = drawSectionTitle(doc, '7. PROFESSORES POR QUALIFICAÇÃO PEDAGÓGICA, NACIONALIDADE E SEXO', y, pageWidth)
    const q = payload.professores_qualificacao
    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.4, halign: 'center' },
        headStyles: { fillColor: BLUE_LIGHT, textColor: [0, 0, 0], fontStyle: 'bold' },
        head: [['Indicador', 'M', 'F', 'Total']],
        body: [
            ['Com formação pedagógica', q.com_formacao_pedagogica.M, q.com_formacao_pedagogica.F, q.com_formacao_pedagogica.total],
            ['Sem formação pedagógica', q.sem_formacao_pedagogica.M, q.sem_formacao_pedagogica.F, q.sem_formacao_pedagogica.total],
            ['Nacionais', q.nacionais.M, q.nacionais.F, q.nacionais.total],
            ['Estrangeiros', q.estrangeiros.M, q.estrangeiros.F, q.estrangeiros.total],
            ['Formação diferenciada em sala', q.formacao_diferenciada.M, q.formacao_diferenciada.F, q.formacao_diferenciada.total],
            ['Intérpretes de Língua Gestual Angolana', q.interpretes_lga.M, q.interpretes_lga.F, q.interpretes_lga.total],
        ],
    })

    // --- Aproveitamento ---
    doc.addPage()
    y = drawPageHeader()
    y = drawSectionTitle(doc, '8. APROVEITAMENTO ESCOLAR NO ANO LECTIVO ANTERIOR', y, pageWidth)
    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.4, halign: 'center' },
        headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5 },
        head: [[
            'Classe/Etapa',
            'Matriculados M/F',
            'Aprovados M/F',
            'Reprovados M/F',
            'Desistentes M/F',
            'Transferidos M/F',
        ]],
        body: payload.aproveitamento_ano_anterior.map(r => [
            r.classe,
            mf(r.matriculados.M, r.matriculados.F),
            mf(r.aprovados.M, r.aprovados.F),
            mf(r.reprovados.M, r.reprovados.F),
            mf(r.desistentes.M, r.desistentes.F),
            mf(r.transferidos.M, r.transferidos.F),
        ]),
    })

    // --- Controlo ---
    y = (doc as any).lastAutoTable.finalY + 8
    y = ensureSpace(doc, y, 40, pageHeight, drawPageHeader)
    y = drawSectionTitle(doc, 'CONTROLO DE PREENCHIMENTO E ENTREGA', y, pageWidth)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('ÁREA RESERVADA PARA A ESCOLA', margin, y + 4)
    doc.setFont('helvetica', 'normal')
    doc.text('O Responsável pelo preenchimento: _________________________________  Data: ___/___/______  Assinatura: ____________________', margin, y + 12)
    doc.text('Visto do Director: ________________________________________________  Data: ___/___/______  Assinatura: ____________________', margin, y + 20)
    doc.setFont('helvetica', 'bold')
    doc.text('ÁREA RESERVADA PARA A DIRECÇÃO/SECRETARIA MUNICIPAL DA EDUCAÇÃO', margin, y + 30)
    doc.setFont('helvetica', 'normal')
    doc.text('O Responsável pelo recebimento: ___________________________________  Data: ___/___/______  Assinatura: ____________________', margin, y + 38)

    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        footer(doc, pageWidth, pageHeight, i, `de ${totalPages}`)
    }

    const safeMod = payload.cabecalho.modalidade_codigo
    const safeAno = payload.cabecalho.ano_lectivo.replace(/[\/\\]/g, '-')
    doc.save(`Censo_Escolar_${safeMod}_${safeAno}.pdf`)
}
