/**
 * Sanitização HTML básica para templates de documentos / rich text.
 * Remove scripts, handlers on*, javascript: e tags perigosas.
 * Não é um substituto completo de DOMPurify, mas cobre o risco XSS stored típico.
 */

const DANGEROUS_TAGS = /<\/?(?:script|iframe|object|embed|link|meta|base|form|input|button|textarea|select|svg|math|style)\b[^>]*>/gi

const EVENT_HANDLER_ATTR = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi

const JS_URI = /\s+(href|src|xlink:href|action)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|\s*javascript:[^\s>]+)/gi

const DATA_HTML_URI =
    /\s+(href|src)\s*=\s*(?:"\s*data:text\/html[^"]*"|'\s*data:text\/html[^']*'|\s*data:text\/html[^\s>]+)/gi

export function sanitizeHtml(html: string): string {
    if (!html) return ''
    let out = String(html)
    // repetir para remnants aninhados simples
    for (let i = 0; i < 3; i++) {
        out = out
            .replace(DANGEROUS_TAGS, '')
            .replace(EVENT_HANDLER_ATTR, '')
            .replace(JS_URI, '')
            .replace(DATA_HTML_URI, '')
    }
    return out
}
