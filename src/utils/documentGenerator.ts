import jsPDF from 'jspdf'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { supabase } from '../lib/supabaseClient'

// Extended interface to include ALL employee fields
export interface DocumentData {
    funcionario: {
        nome: string
        cargo: string
        escola: string
        categoria?: string
        numero_funcionario?: string
        genero?: 'M' | 'F'
        // Extended fields
        data_nascimento?: string
        numero_bi?: string
        nacionalidade?: string
        naturalidade?: string
        estado_civil?: string
        nome_pai?: string
        nome_mae?: string
        provincia_residencia?: string
        municipio_residencia?: string
        bairro_residencia?: string
        endereco_completo?: string
        iban?: string
        banco?: string
        numero_seguranca_social?: string
        data_inicio_funcoes?: string
        categoria_laboral?: string
        grau_academico?: string
        area_formacao?: string
        categoria_docente?: string
        numero_diploma?: string
        instituicao_formacao?: string
        ano_conclusao?: number
        telefone?: string
        email?: string
    }
    documento: {
        tipo: string
        assunto: string
        data_solicitacao: string
        numero_protocolo: string
    }
    direcao: {
        municipio: string
        provincia: string
        director_nome: string
    }
}

export interface TemplateConfig {
    conteudo_html: string
    cabecalho: {
        mostrar: boolean
        texto: string
        logo_url?: string
        alinhamento: 'left' | 'center' | 'right'
    }
    rodape: {
        mostrar: boolean
        texto: string
        alinhamento: 'left' | 'center' | 'right'
    }
}

// Official Angola Republic Emblem - stored locally in /public folder
export const ANGOLA_EMBLEM_URL = '/angola-emblem.jpg'

// Keep old placeholder for backwards compatibility
export const ANGOLA_EMBLEM_PLACEHOLDER = ANGOLA_EMBLEM_URL
export const ANGOLA_EMBLEM_DATA_URI = ANGOLA_EMBLEM_URL

export const defaultTemplate: TemplateConfig = {
    cabecalho: {
        mostrar: true,
        texto: "REPÚBLICA DE ANGOLA\nGOVERNO DA PROVÍNCIA DE {{PROVINCIA}}\nADMINISTRAÇÃO MUNICIPAL DE {{MUNICIPIO}}\nDIRECÇÃO MUNICIPAL DA EDUCAÇÃO",
        logo_url: ANGOLA_EMBLEM_URL,
        alinhamento: 'center'
    },
    rodape: {
        mostrar: true,
        texto: "Direcção Municipal da Educação de {{MUNICIPIO}}",
        alinhamento: 'center'
    },
    conteudo_html: `
    <div style="font-family: Cambria, Georgia, serif; line-height: 1.6; font-size: 13.5pt;">
        <h2 style="text-align: center; text-transform: uppercase; margin-bottom: 24px; font-size: 14pt;">{{TIPO_DOCUMENTO}}</h2>
        
        <p style="text-align: justify; margin-bottom: 12px; text-indent: 35px;">
            Para os devidos efeitos, declara-se que <strong>{{NOME_FUNCIONARIO}}</strong>, 
            de nacionalidade {{NACIONALIDADE}}, natural de {{NATURALIDADE}}, 
            portador{{ARTIGO_A}} do Bilhete de Identidade n.º <strong>{{NUMERO_BI}}</strong>, 
            residente em {{ENDERECO_COMPLETO}}, {{ESTADO_CIVIL}}, 
            filho{{ARTIGO_A}} de {{NOME_PAI}} e de {{NOME_MAE}}.
        </p>

        <p style="text-align: justify; margin-bottom: 12px; text-indent: 35px;">
            É funcionário{{ARTIGO_A}} desta Direcção Municipal da Educação, exercendo as funções de 
            <strong>{{CARGO}}</strong>, Categoria <strong>{{CATEGORIA_DOCENTE}}</strong>, 
            colocado{{ARTIGO_A}} na escola <strong>{{ESCOLA}}</strong>, 
            com o número de agente <strong>{{NUMERO_FUNCIONARIO}}</strong>, 
            desde {{DATA_INICIO_FUNCOES}}.
        </p>

        <p style="text-align: justify; margin-bottom: 12px; text-indent: 35px;">
            Possui formação em <strong>{{AREA_FORMACAO}}</strong>, com grau académico de 
            <strong>{{GRAU_ACADEMICO}}</strong>, obtido na <strong>{{INSTITUICAO_FORMACAO}}</strong>, 
            no ano de {{ANO_CONCLUSAO}}.
        </p>

        <p style="text-align: justify; margin-bottom: 12px; text-indent: 35px;">
            Por ser verdade e me ter sido solicitado, mandei passar a presente declaração que vai por mim assinada 
            e autenticada com o carimbo a óleo em uso nesta Direcção.
        </p>

        <p style="text-align: center; margin-top: 40px;">
            {{MUNICIPIO}}, aos {{DATA_ATUAL}}
        </p>

        <div style="text-align: center; margin-top: 50px;">
            <p style="margin-bottom: 25px;">O Director Municipal da Educação</p>
            <strong>{{NOME_DIRECTOR}}</strong>
        </div>
    </div>
    `
}

/**
 * Fetches complete employee data for document generation
 */
export async function fetchEmployeeDataForDocument(
    solicitanteUserId: string,
    solicitanteTipo: 'PROFESSOR' | 'SECRETARIO' | 'ESCOLA',
    escolaId: string
): Promise<DocumentData['funcionario'] | null> {
    try {
        if (solicitanteTipo === 'PROFESSOR') {
            const { data: professor, error } = await supabase
                .from('professores')
                .select(`
                    *,
                    escola:escolas(nome, provincia, municipio)
                `)
                .eq('user_id', solicitanteUserId)
                .single()

            if (error || !professor) {
                console.error('Error fetching professor:', error)
                return null
            }

            return {
                nome: professor.nome_completo,
                cargo: professor.categoria_docente || 'Professor',
                escola: professor.escola?.nome || 'N/A',
                categoria: professor.categoria_laboral,
                numero_funcionario: professor.numero_agente || 'N/A',
                genero: professor.genero as 'M' | 'F',
                // Extended fields
                data_nascimento: professor.data_nascimento ? format(new Date(professor.data_nascimento), 'dd/MM/yyyy') : 'N/A',
                numero_bi: professor.numero_bi || 'N/A',
                nacionalidade: professor.nacionalidade || 'Angolana',
                naturalidade: professor.naturalidade || 'N/A',
                estado_civil: professor.estado_civil || 'N/A',
                nome_pai: professor.nome_pai || 'N/A',
                nome_mae: professor.nome_mae || 'N/A',
                provincia_residencia: professor.provincia_residencia || 'N/A',
                municipio_residencia: professor.municipio_residencia || 'N/A',
                bairro_residencia: professor.bairro_residencia || 'N/A',
                endereco_completo: professor.endereco_completo || `${professor.bairro_residencia || ''}, ${professor.municipio_residencia || ''}, ${professor.provincia_residencia || ''}`.trim() || 'N/A',
                iban: professor.iban || 'N/A',
                banco: professor.banco || 'N/A',
                numero_seguranca_social: professor.numero_seguranca_social || 'N/A',
                data_inicio_funcoes: professor.data_inicio_funcoes ? format(new Date(professor.data_inicio_funcoes), 'dd/MM/yyyy') : 'N/A',
                categoria_laboral: professor.categoria_laboral || 'N/A',
                grau_academico: professor.grau_academico || 'N/A',
                area_formacao: professor.area_formacao || 'Educação',
                categoria_docente: professor.categoria_docente || 'N/A',
                numero_diploma: professor.numero_diploma || 'N/A',
                instituicao_formacao: professor.instituicao_formacao || 'N/A',
                ano_conclusao: professor.ano_conclusao || undefined,
                telefone: professor.telefone || 'N/A',
                email: professor.email || 'N/A'
            }
        } else if (solicitanteTipo === 'SECRETARIO') {
            const { data: secretario, error } = await supabase
                .from('secretarios')
                .select(`
                    *,
                    escola:escolas(nome, provincia, municipio)
                `)
                .eq('user_id', solicitanteUserId)
                .single()

            if (error || !secretario) {
                console.error('Error fetching secretario:', error)
                return null
            }

            return {
                nome: secretario.nome_completo,
                cargo: secretario.cargo || 'Secretário(a) Escolar',
                escola: secretario.escola?.nome || 'N/A',
                numero_funcionario: secretario.numero_funcionario || 'N/A',
                telefone: secretario.telefone || 'N/A',
                email: secretario.email || 'N/A'
            }
        } else {
            // ESCOLA - fetch escola data
            const { data: escola, error } = await supabase
                .from('escolas')
                .select('*')
                .eq('id', escolaId)
                .single()

            if (error || !escola) return null

            return {
                nome: escola.nome,
                cargo: 'Direcção da Escola',
                escola: escola.nome,
                numero_funcionario: escola.codigo_escola || 'N/A'
            }
        }
    } catch (error) {
        console.error('Error fetching employee data:', error)
        return null
    }
}

/**
 * Replaces variables in the template text/HTML with actual data
 */
const processTemplate = (text: string, data: DocumentData): string => {
    const today = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: pt })
    const func = data.funcionario

    // Gender-based suffixes
    const artigoA = func.genero === 'F' ? 'a' : ''
    const artigo = func.genero === 'F' ? 'A' : 'O'

    let processed = text
        // Basic fields
        .replace(/{{NOME_FUNCIONARIO}}/g, func.nome)
        .replace(/{{CARGO}}/g, func.cargo)
        .replace(/{{ESCOLA}}/g, func.escola)
        .replace(/{{NUMERO_FUNCIONARIO}}/g, func.numero_funcionario || 'N/A')
        .replace(/{{TIPO_DOCUMENTO}}/g, data.documento.tipo)
        .replace(/{{MUNICIPIO}}/g, data.direcao.municipio)
        .replace(/{{PROVINCIA}}/g, data.direcao.provincia)
        .replace(/{{NOME_DIRECTOR}}/g, data.direcao.director_nome)
        .replace(/{{DATA_ATUAL}}/g, today)
        // Extended employee fields
        .replace(/{{DATA_NASCIMENTO}}/g, func.data_nascimento || 'N/A')
        .replace(/{{NUMERO_BI}}/g, func.numero_bi || 'N/A')
        .replace(/{{NACIONALIDADE}}/g, func.nacionalidade || 'Angolana')
        .replace(/{{NATURALIDADE}}/g, func.naturalidade || 'N/A')
        .replace(/{{ESTADO_CIVIL}}/g, func.estado_civil || 'N/A')
        .replace(/{{NOME_PAI}}/g, func.nome_pai || 'N/A')
        .replace(/{{NOME_MAE}}/g, func.nome_mae || 'N/A')
        .replace(/{{PROVINCIA_RESIDENCIA}}/g, func.provincia_residencia || 'N/A')
        .replace(/{{MUNICIPIO_RESIDENCIA}}/g, func.municipio_residencia || 'N/A')
        .replace(/{{BAIRRO_RESIDENCIA}}/g, func.bairro_residencia || 'N/A')
        .replace(/{{ENDERECO_COMPLETO}}/g, func.endereco_completo || 'N/A')
        .replace(/{{IBAN}}/g, func.iban || 'N/A')
        .replace(/{{BANCO}}/g, func.banco || 'N/A')
        .replace(/{{NUMERO_SEGURANCA_SOCIAL}}/g, func.numero_seguranca_social || 'N/A')
        .replace(/{{DATA_INICIO_FUNCOES}}/g, func.data_inicio_funcoes || 'N/A')
        .replace(/{{CATEGORIA_LABORAL}}/g, func.categoria_laboral || 'N/A')
        .replace(/{{GRAU_ACADEMICO}}/g, func.grau_academico || 'N/A')
        .replace(/{{AREA_FORMACAO}}/g, func.area_formacao || 'N/A')
        .replace(/{{CATEGORIA_DOCENTE}}/g, func.categoria_docente || 'N/A')
        .replace(/{{NUMERO_DIPLOMA}}/g, func.numero_diploma || 'N/A')
        .replace(/{{INSTITUICAO_FORMACAO}}/g, func.instituicao_formacao || 'N/A')
        .replace(/{{ANO_CONCLUSAO}}/g, func.ano_conclusao?.toString() || 'N/A')
        .replace(/{{TELEFONE}}/g, func.telefone || 'N/A')
        .replace(/{{EMAIL}}/g, func.email || 'N/A')
        // Gender suffixes
        .replace(/{{ARTIGO_DEFINIDO}}/g, artigo)
        .replace(/{{ARTIGO_A}}/g, artigoA)

    return processed
}

/**
 * Generates a PDF document based on configuration and data
 */
export const generatePDF = async (
    data: DocumentData,
    config: TemplateConfig = defaultTemplate
): Promise<Blob> => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    // Margins in mm: 2.5cm left = 25mm, 1.5cm right = 15mm
    const marginLeft = 25
    const marginRight = 15
    const contentWidth = pageWidth - marginLeft - marginRight  // ~170mm for A4

    // === HEADER WITH LOGO ===
    let headerEndY = 18  // Default start position

    // Helper function to load image as base64
    const loadImageAsBase64 = (url: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => {
                const canvas = document.createElement('canvas')
                canvas.width = img.width
                canvas.height = img.height
                const ctx = canvas.getContext('2d')
                ctx?.drawImage(img, 0, 0)
                resolve(canvas.toDataURL('image/png'))
            }
            img.onerror = reject
            img.src = url
        })
    }

    // Render logo if present
    if (config.cabecalho.logo_url) {
        try {
            const logoBase64 = await loadImageAsBase64(config.cabecalho.logo_url)
            const logoHeight = 18  // ~18mm height
            const logoWidth = 18   // Keep aspect ratio square for emblem
            const logoX = (pageWidth - logoWidth) / 2  // Center the logo
            doc.addImage(logoBase64, 'PNG', logoX, 8, logoWidth, logoHeight)
            headerEndY = 8 + logoHeight + 3  // Position after logo + small gap
        } catch (error) {
            console.warn('Could not load logo:', error)
            headerEndY = 18  // Fallback to default position
        }
    }

    // Render header text
    if (config.cabecalho.mostrar) {
        let currentY = headerEndY

        // Use Helvetica as fallback for Cambria (jsPDF doesn't have Cambria built-in)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)

        const headerLines = processTemplate(config.cabecalho.texto, data).split('\n')
        headerLines.forEach(line => {
            doc.text(line, pageWidth / 2, currentY, { align: 'center' })
            currentY += 5.5
        })

        // Draw shorter, centered line separator with 0.6 spacing from header text
        const lineY = currentY + 2  // 0.6 equivalent spacing
        const lineWidth = 100  // Shorter, centered line
        const lineStart = (pageWidth - lineWidth) / 2
        doc.setLineWidth(0.3)
        doc.line(lineStart, lineY, lineStart + lineWidth, lineY)

        headerEndY = lineY + 5  // Update for body positioning
    }

    // === BODY ===
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = processTemplate(config.conteudo_html, data)

    // Content width in mm for CSS (170mm for A4 with our margins)
    const contentWidthMm = 170
    tempDiv.style.width = `${contentWidthMm}mm`
    tempDiv.style.fontFamily = 'Cambria, Georgia, serif'
    tempDiv.style.fontSize = '13.5pt'
    tempDiv.style.lineHeight = '1.6'
    tempDiv.style.textAlign = 'justify'
    tempDiv.style.padding = '0'

    document.body.appendChild(tempDiv)

    // Calculate proper PDF positioning
    // jsPDF uses mm by default, so x position is marginLeft in mm
    // The width for doc.html should be in the same scale as windowWidth
    // windowWidth is the virtual browser width, and width is how wide to render
    // A ratio of windowWidth:width determines scaling

    return new Promise((resolve) => {
        doc.html(tempDiv, {
            callback: (pdf) => {
                document.body.removeChild(tempDiv)

                // === FOOTER ===
                if (config.rodape.mostrar) {
                    const pageCount = pdf.getNumberOfPages()
                    pdf.setFont('times', 'italic')
                    pdf.setFontSize(9)

                    for (let i = 1; i <= pageCount; i++) {
                        pdf.setPage(i)
                        const footerText = processTemplate(config.rodape.texto, data)
                        pdf.text(footerText, pageWidth / 2, pageHeight - 15, { align: 'center' })
                        pdf.text(`Página ${i} de ${pageCount}`, pageWidth - marginRight, pageHeight - 15, { align: 'right' })
                        pdf.setFontSize(7)
                        pdf.setFont('times', 'normal')
                        pdf.text('EduGest Angola — Sistema de Gestão Escolar', pageWidth / 2, pageHeight - 8, { align: 'center' })
                        pdf.setFont('times', 'italic')
                        pdf.setFontSize(9)
                    }
                }

                resolve(pdf.output('blob'))
            },
            x: marginLeft,  // 2.5cm = 25mm from left edge
            y: 55,
            width: contentWidth,  // This scales the rendered content to fit this width in mm
            windowWidth: 650  // Reduced windowWidth to make content fill the available width better
        })
    })
}
