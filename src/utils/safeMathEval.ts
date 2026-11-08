/**
 * Avalia expressões matemáticas aritméticas de forma segura (sem eval/Function).
 * Suporta: números, + - * / % , parênteses e unário +/-.
 */

type Tok =
    | { type: 'num'; value: number }
    | { type: 'op'; value: '+' | '-' | '*' | '/' | '%' }
    | { type: 'lp' }
    | { type: 'rp' }

function tokenize(expr: string): Tok[] {
    const tokens: Tok[] = []
    let i = 0
    const s = expr.replace(/\s+/g, '')

    while (i < s.length) {
        const ch = s[i]

        if ((ch >= '0' && ch <= '9') || ch === '.') {
            let j = i + 1
            while (j < s.length && ((s[j] >= '0' && s[j] <= '9') || s[j] === '.')) j++
            const raw = s.slice(i, j)
            if (!/^\d+(\.\d+)?$|^\.\d+$/.test(raw)) {
                throw new Error(`Número inválido: ${raw}`)
            }
            tokens.push({ type: 'num', value: Number(raw) })
            i = j
            continue
        }

        if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%') {
            tokens.push({ type: 'op', value: ch })
            i++
            continue
        }

        if (ch === '(') {
            tokens.push({ type: 'lp' })
            i++
            continue
        }

        if (ch === ')') {
            tokens.push({ type: 'rp' })
            i++
            continue
        }

        throw new Error(`Carácter inválido na fórmula: ${ch}`)
    }

    return tokens
}

function parseExpression(tokens: Tok[], index: { i: number }): number {
    let value = parseTerm(tokens, index)

    while (index.i < tokens.length) {
        const t = tokens[index.i]
        if (t.type !== 'op' || (t.value !== '+' && t.value !== '-')) break
        index.i++
        const right = parseTerm(tokens, index)
        value = t.value === '+' ? value + right : value - right
    }

    return value
}

function parseTerm(tokens: Tok[], index: { i: number }): number {
    let value = parseUnary(tokens, index)

    while (index.i < tokens.length) {
        const t = tokens[index.i]
        if (t.type !== 'op' || (t.value !== '*' && t.value !== '/' && t.value !== '%')) break
        index.i++
        const right = parseUnary(tokens, index)
        if (t.value === '*') value *= right
        else if (t.value === '/') {
            if (right === 0) throw new Error('Divisão por zero')
            value /= right
        } else {
            if (right === 0) throw new Error('Módulo por zero')
            value %= right
        }
    }

    return value
}

function parseUnary(tokens: Tok[], index: { i: number }): number {
    const t = tokens[index.i]
    if (t?.type === 'op' && (t.value === '+' || t.value === '-')) {
        index.i++
        const value = parseUnary(tokens, index)
        return t.value === '-' ? -value : value
    }
    return parsePrimary(tokens, index)
}

function parsePrimary(tokens: Tok[], index: { i: number }): number {
    const t = tokens[index.i]
    if (!t) throw new Error('Expressão incompleta')

    if (t.type === 'num') {
        index.i++
        return t.value
    }

    if (t.type === 'lp') {
        index.i++
        const value = parseExpression(tokens, index)
        const close = tokens[index.i]
        if (!close || close.type !== 'rp') throw new Error('Parêntese não fechado')
        index.i++
        return value
    }

    throw new Error('Expressão inválida')
}

/**
 * Avalia uma expressão matemática pura (já com valores numéricos substituídos).
 */
export function safeEvalMath(expression: string): number {
    const trimmed = expression.trim()
    if (!trimmed) throw new Error('Expressão vazia')
    if (!/^[\d\s+\-*/%().]+$/.test(trimmed)) {
        throw new Error('Expressão contém símbolos não permitidos')
    }

    const tokens = tokenize(trimmed)
    const index = { i: 0 }
    const result = parseExpression(tokens, index)
    if (index.i !== tokens.length) throw new Error('Expressão malformada')
    if (typeof result !== 'number' || !Number.isFinite(result)) {
        throw new Error('Resultado inválido')
    }
    return result
}
