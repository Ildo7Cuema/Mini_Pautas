import type jsPDF from 'jspdf'

/** Brand shown on exported document footers */
export const APP_DOCUMENT_BRAND = 'EduGest Angola'
export const APP_DOCUMENT_BRAND_LINE = 'EduGest Angola — Sistema de Gestão Escolar'

/**
 * Applies the standard page footer to every page:
 * Página X de Y · Gerado em · nome do sistema
 */
export function applyStandardPdfFooters(
    doc: jsPDF,
    options?: {
        dateLocale?: string
        /** Use toLocaleDateString instead of toLocaleString */
        dateOnly?: boolean
    }
): void {
    const pageCount = doc.getNumberOfPages()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const locale = options?.dateLocale || 'pt-AO'
    const geradoEm = options?.dateOnly
        ? new Date().toLocaleDateString(locale)
        : new Date().toLocaleString(locale)

    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        drawStandardPdfFooter(doc, {
            pageWidth,
            pageHeight,
            currentPage: i,
            pageCount,
            geradoEm,
        })
    }
}

/**
 * Draws footer on the current page (for didDrawPage callbacks).
 */
export function drawStandardPdfFooter(
    doc: jsPDF,
    options: {
        pageWidth: number
        pageHeight: number
        currentPage: number
        pageCount: number
        geradoEm?: string
        dateLocale?: string
        dateOnly?: boolean
    }
): void {
    const {
        pageWidth,
        pageHeight,
        currentPage,
        pageCount,
    } = options
    const locale = options.dateLocale || 'pt-AO'
    const geradoEm =
        options.geradoEm ||
        (options.dateOnly
            ? new Date().toLocaleDateString(locale)
            : new Date().toLocaleString(locale))

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(`Página ${currentPage} de ${pageCount}`, pageWidth / 2, pageHeight - 11, { align: 'center' })
    doc.text(`Gerado em: ${geradoEm}`, pageWidth / 2, pageHeight - 7.5, { align: 'center' })
    doc.text(APP_DOCUMENT_BRAND_LINE, pageWidth / 2, pageHeight - 4, { align: 'center' })
    doc.setTextColor(0, 0, 0)
}
