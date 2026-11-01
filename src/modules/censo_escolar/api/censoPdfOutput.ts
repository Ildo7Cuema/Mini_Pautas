import type { jsPDF } from 'jspdf'

/**
 * Abre uma nova aba em branco (com mensagem de "a preparar") de forma SÍNCRONA.
 * Deve ser chamada logo no início do clique do utilizador, antes de qualquer `await`,
 * para que o navegador não a bloqueie como pop-up.
 */
export function abrirJanelaPreviewPdf(): Window | null {
    try {
        const w = window.open('', '_blank')
        if (w) {
            w.document.title = 'A preparar PDF…'
            w.document.body.style.cssText =
                'margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,sans-serif;color:#475569;background:#f8fafc'
            w.document.body.textContent = 'A preparar o questionário do Censo Escolar…'
        }
        return w
    } catch {
        return null
    }
}

export function fecharJanelaPreviewPdf(w: Window | null | undefined) {
    try {
        if (w && !w.closed) w.close()
    } catch {
        /* ignore */
    }
}

/**
 * Mostra o PDF no navegador (nova aba, visualizador nativo de PDF).
 * Se o navegador bloquear a aba, faz o download como alternativa.
 */
export function mostrarPdfNoNavegador(doc: jsPDF, filename: string, alvo?: Window | null) {
    doc.setProperties({ title: filename.replace(/\.pdf$/i, '') })
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)

    let aberto = false
    try {
        if (alvo && !alvo.closed) {
            alvo.location.href = url
            aberto = true
        } else {
            const w = window.open(url, '_blank')
            aberto = !!w
        }
    } catch {
        aberto = false
    }

    if (!aberto) {
        // Pop-up bloqueado: descarrega o ficheiro
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
    }

    // Libertar memória passado tempo suficiente para o visualizador carregar/guardar
    setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000)
}
