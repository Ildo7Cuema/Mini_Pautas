/**
 * Formula Utilities
 * Handles validation, parsing, and evaluation of component formulas
 */

export interface FormulaValidationResult {
    valid: boolean;
    error?: string;
}

export interface FormulaComponentLike {
    id?: string;
    codigo_componente: string;
    trimestre?: number | null;
}

/** Grades keyed by component code within a trimester (e.g. { MAC: 12, MT: 14 }). */
export type GradesByCode = Record<string, number>;

/** Grades for trimesters 1–3 keyed by component code. */
export type GradesByTrimestre = Record<number, GradesByCode>;

/**
 * Split codes like MT1 / MAC2 into base + trimester.
 * Pure aliases T1/T2/T3 return base "T" (resolved specially as trimester average / MT).
 */
export function splitCodeAndTrimestre(
    code: string
): { base: string; trimestre: number | null } {
    const normalized = code.trim().toUpperCase();
    const alias = /^T([1-3])$/.exec(normalized);
    if (alias) {
        return { base: 'T', trimestre: Number(alias[1]) };
    }
    const suffixed = /^([A-Z][A-Z0-9_]*?)([1-3])$/.exec(normalized);
    if (suffixed) {
        return { base: suffixed[1], trimestre: Number(suffixed[2]) };
    }
    return { base: normalized, trimestre: null };
}

function lookupCodeInMap(grades: GradesByCode | undefined, code: string): number | undefined {
    if (!grades) return undefined;
    if (grades[code] !== undefined) return grades[code];
    const upper = code.toUpperCase();
    const match = Object.keys(grades).find((k) => k.toUpperCase() === upper);
    return match !== undefined ? grades[match] : undefined;
}

/**
 * Resolve one formula variable against per-trimester grade maps.
 * Supports MT1/MT2/MT3, MAC1…, bare MT/MAC, and T1/T2/T3 as aliases of MT in that trimester.
 * Does NOT invent averages — only resolves codes present in the configured formula context.
 */
export function resolveFormulaCodeValue(
    code: string,
    gradesByTrimestre: GradesByTrimestre,
    preferredTrimestre?: number
): number | undefined {
    const { base, trimestre } = splitCodeAndTrimestre(code);

    // T1/T2/T3 → MT of that trimester (common alias in user formulas)
    if (base === 'T' && trimestre !== null) {
        return lookupCodeInMap(gradesByTrimestre[trimestre], 'MT');
    }

    if (trimestre !== null) {
        return lookupCodeInMap(gradesByTrimestre[trimestre], base);
    }

    if (preferredTrimestre != null) {
        const preferred = lookupCodeInMap(gradesByTrimestre[preferredTrimestre], base);
        if (preferred !== undefined) return preferred;
    }

    for (let t = 1; t <= 3; t++) {
        const value = lookupCodeInMap(gradesByTrimestre[t], base);
        if (value !== undefined) return value;
    }
    return undefined;
}

export interface ConfiguredComponentForEval {
    is_calculated?: boolean | null;
    formula_expression?: string | null;
    tipo_calculo?: 'trimestral' | 'anual' | string | null;
    depends_on_components?: string[] | null;
}

/**
 * Single entry-point: evaluate a calculated component strictly from user configuration
 * (`tipo_calculo` + `formula_expression`). Returns null when not calculable / no formula.
 * Never applies a hardcoded MT/MF average.
 */
export function evaluateConfiguredComponent(
    component: ConfiguredComponentForEval,
    context: {
        gradesByCode?: GradesByCode;
        gradesByTrimestre?: GradesByTrimestre;
        components?: FormulaComponentLike[];
        trimestre?: number | null;
    }
): number | null {
    if (!component.is_calculated) return null;
    const expression = component.formula_expression?.trim();
    if (!expression) return null;

    const tipo = component.tipo_calculo === 'anual' ? 'anual' : 'trimestral';

    try {
        let dependencyValues: Record<string, number>;
        if (tipo === 'anual') {
            const gradesByTrimestre = context.gradesByTrimestre || {
                1: {},
                2: {},
                3: {},
            };
            dependencyValues = buildAnnualFormulaValues(expression, gradesByTrimestre, {
                dependsOnIds: component.depends_on_components,
                components: context.components,
            });
        } else {
            dependencyValues = buildTrimestralFormulaValues(
                expression,
                context.gradesByCode || {},
                {
                    dependsOnIds: component.depends_on_components,
                    components: context.components,
                    trimestre: context.trimestre,
                }
            );
        }

        if (Object.keys(dependencyValues).length === 0) return null;
        return roundGradeValue(evaluateFormula(expression, dependencyValues));
    } catch (error) {
        console.error('Erro ao avaliar componente configurado:', error);
        return null;
    }
}

/**
 * Build the values object for evaluateFormula for annual components (MF, MFD, …).
 * Always keys variables exactly as they appear in the formula (MT1, T2, …).
 * Also injects bare + suffixed codes from known components so mixed formulas work.
 */
export function buildAnnualFormulaValues(
    expression: string,
    gradesByTrimestre: GradesByTrimestre,
    options?: {
        dependsOnIds?: string[] | null;
        components?: FormulaComponentLike[];
        defaultMissingToZero?: boolean;
    }
): Record<string, number> {
    const dependencyValues: Record<string, number> = {};
    const defaultMissing = options?.defaultMissingToZero !== false;
    const components = options?.components || [];
    const dependsOnIds = options?.dependsOnIds;

    const assignResolved = (key: string, value: number | undefined) => {
        if (value !== undefined) {
            dependencyValues[key] = value;
        } else if (defaultMissing) {
            dependencyValues[key] = 0;
        }
    };

    // Prefer explicit dependency IDs when present; still expose suffixed aliases.
    if (dependsOnIds && dependsOnIds.length > 0 && components.length > 0) {
        dependsOnIds.forEach((depId) => {
            const dep =
                components.find((c) => c.id === depId) ||
                components.find(
                    (c) => c.codigo_componente?.toUpperCase() === String(depId).toUpperCase()
                );
            if (!dep) return;
            const code = dep.codigo_componente;
            const t = Number(dep.trimestre) || undefined;
            const value =
                t != null
                    ? lookupCodeInMap(gradesByTrimestre[t], code)
                    : resolveFormulaCodeValue(code, gradesByTrimestre);
            assignResolved(code, value);
            if (t != null) {
                assignResolved(`${code}${t}`, value);
                // Common UI alias for "média do trimestre"
                if (code.toUpperCase() === 'MT') {
                    assignResolved(`T${t}`, value);
                }
            }
        });
    }

    // Always resolve codes referenced by the formula (covers empty depends_on and MT1/T1 aliases).
    parseFormula(expression).forEach((code) => {
        if (dependencyValues[code] !== undefined) return;
        assignResolved(code, resolveFormulaCodeValue(code, gradesByTrimestre));
    });

    // Enrich with full trimester context so formulas mixing bare + suffixed codes still evaluate.
    for (let t = 1; t <= 3; t++) {
        const map = gradesByTrimestre[t] || {};
        Object.entries(map).forEach(([code, value]) => {
            if (dependencyValues[code] === undefined) dependencyValues[code] = value;
            const suffixed = `${code}${t}`;
            if (dependencyValues[suffixed] === undefined) dependencyValues[suffixed] = value;
            if (code.toUpperCase() === 'MT' && dependencyValues[`T${t}`] === undefined) {
                dependencyValues[`T${t}`] = value;
            }
        });
    }

    return dependencyValues;
}

/**
 * Build values for a trimestral formula (e.g. MT = (MAC + NPT) / 2).
 * Falls back to parsing the formula when depends_on is empty.
 */
export function buildTrimestralFormulaValues(
    expression: string,
    gradesByCode: GradesByCode,
    options?: {
        dependsOnIds?: string[] | null;
        components?: FormulaComponentLike[];
        trimestre?: number | null;
        defaultMissingToZero?: boolean;
    }
): Record<string, number> {
    const dependencyValues: Record<string, number> = {};
    const defaultMissing = options?.defaultMissingToZero !== false;
    const components = options?.components || [];
    const dependsOnIds = options?.dependsOnIds;
    const trimestre = options?.trimestre != null ? Number(options.trimestre) : null;

    const setValue = (key: string, value: number | undefined) => {
        if (value !== undefined) dependencyValues[key] = value;
        else if (defaultMissing) dependencyValues[key] = 0;
    };

    if (dependsOnIds && dependsOnIds.length > 0 && components.length > 0) {
        dependsOnIds.forEach((depId) => {
            const dep =
                components.find((c) => c.id === depId) ||
                components.find(
                    (c) => c.codigo_componente?.toUpperCase() === String(depId).toUpperCase()
                );
            if (!dep) return;
            const code = dep.codigo_componente;
            const value = lookupCodeInMap(gradesByCode, code);
            setValue(code, value);
            if (trimestre != null) setValue(`${code}${trimestre}`, value);
        });
    }

    parseFormula(expression).forEach((code) => {
        if (dependencyValues[code] !== undefined) return;
        const { base, trimestre: suffixT } = splitCodeAndTrimestre(code);
        if (suffixT != null && (trimestre == null || suffixT === trimestre)) {
            setValue(code, lookupCodeInMap(gradesByCode, base));
            return;
        }
        setValue(code, lookupCodeInMap(gradesByCode, code) ?? lookupCodeInMap(gradesByCode, base));
    });

    // Provide full same-trimester context (robust when depends_on is incomplete).
    Object.entries(gradesByCode).forEach(([code, value]) => {
        if (dependencyValues[code] === undefined) dependencyValues[code] = value;
        if (trimestre != null) {
            const suffixed = `${code}${trimestre}`;
            if (dependencyValues[suffixed] === undefined) dependencyValues[suffixed] = value;
        }
    });

    return dependencyValues;
}

export function roundGradeValue(value: number): number {
    return Math.round(value * 100) / 100;
}

/**
 * Infer dependency component IDs from a formula against a sibling component list.
 * MT1/T1 → all MT rows (or matching trimester); MAC → MAC rows in scope.
 */
export function inferDependsOnComponentIds(
    expression: string,
    components: FormulaComponentLike[],
    options?: { tipoCalculo?: 'trimestral' | 'anual' | string | null; trimestre?: number | null }
): string[] {
    const codes = parseFormula(expression);
    const ids = new Set<string>();
    const tipo = options?.tipoCalculo || 'trimestral';
    const scopeTrimestre = options?.trimestre != null ? Number(options.trimestre) : null;

    codes.forEach((code) => {
        const { base, trimestre } = splitCodeAndTrimestre(code);
        const targetBase = base === 'T' ? 'MT' : base;
        components.forEach((c) => {
            if (!c.id) return;
            if (c.codigo_componente?.toUpperCase() !== targetBase) return;
            const cTrimestre = Number(c.trimestre) || null;
            if (trimestre != null) {
                if (cTrimestre === trimestre) ids.add(c.id);
                return;
            }
            if (tipo === 'anual') {
                ids.add(c.id);
                return;
            }
            if (scopeTrimestre == null || cTrimestre === scopeTrimestre) {
                ids.add(c.id);
            }
        });
    });

    return [...ids];
}

/**
 * Validates a formula expression
 * @param expression - The formula expression (e.g., "MAC * 0.4 + EXAME * 0.6")
 * @param componentCodes - Array of valid component codes that can be used in the formula
 * @returns Validation result with error message if invalid
 */
export function validateFormula(
    expression: string,
    componentCodes: string[]
): FormulaValidationResult {
    if (!expression || expression.trim() === '') {
        return { valid: false, error: 'Fórmula não pode estar vazia' };
    }

    // Remove whitespace for easier parsing
    const cleanExpression = expression.replace(/\s+/g, '');

    // Check for valid characters (alphanumeric, operators, parentheses, decimal point)
    const validCharsRegex = /^[A-Za-z0-9+\-*/().]+$/;
    if (!validCharsRegex.test(cleanExpression)) {
        return { valid: false, error: 'Fórmula contém caracteres inválidos' };
    }

    // Check for balanced parentheses
    let parenthesesCount = 0;
    for (const char of cleanExpression) {
        if (char === '(') parenthesesCount++;
        if (char === ')') parenthesesCount--;
        if (parenthesesCount < 0) {
            return { valid: false, error: 'Parênteses desbalanceados' };
        }
    }
    if (parenthesesCount !== 0) {
        return { valid: false, error: 'Parênteses desbalanceados' };
    }

    // Extract component codes from formula
    const usedCodes = parseFormula(expression);

    // Check if all used codes are valid
    for (const code of usedCodes) {
        if (!componentCodes.includes(code)) {
            return {
                valid: false,
                error: `Componente "${code}" não existe ou não está disponível`,
            };
        }
    }

    // Check for consecutive operators
    if (/[+\-*/]{2,}/.test(cleanExpression.replace(/[+\-]\d/g, ''))) {
        return { valid: false, error: 'Operadores consecutivos detectados' };
    }

    return { valid: true };
}

/**
 * Extracts component codes from a formula expression
 * @param expression - The formula expression
 * @returns Array of unique component codes found in the formula
 */
export function parseFormula(expression: string): string[] {
    // Match sequences of uppercase letters and numbers (component codes)
    const codeRegex = /[A-Z][A-Z0-9_]*/g;
    const matches = expression.match(codeRegex) || [];

    // Filter out numbers that might be matched (e.g., "0.4" -> "E" from scientific notation)
    const codes = matches.filter(match => {
        // Must start with a letter and contain at least one letter
        return /^[A-Z]/.test(match) && /[A-Z]/.test(match);
    });

    // Return unique codes
    return [...new Set(codes)];
}

/**
 * Evaluates a formula with given component values
 * @param expression - The formula expression
 * @param values - Object mapping component codes to their numeric values
 * @returns The calculated result
 * @throws Error if evaluation fails
 */
export function evaluateFormula(
    expression: string,
    values: Record<string, number>
): number {
    try {
        // Replace component codes with their values
        let evaluableExpression = expression;

        // Sort codes by length (descending) to avoid partial replacements
        const codes = Object.keys(values).sort((a, b) => b.length - a.length);

        for (const code of codes) {
            const value = values[code];
            // Allow 0 as a valid value, only reject undefined, null, or NaN
            if (value === undefined || value === null || isNaN(value)) {
                throw new Error(`Valor inválido para componente ${code}`);
            }
            // Use word boundary to ensure we replace whole codes only
            const regex = new RegExp(`\\b${code}\\b`, 'g');
            evaluableExpression = evaluableExpression.replace(regex, value.toString());
        }

        // Evaluate the expression safely
        // Note: In production, consider using a safer expression evaluator library
        // eslint-disable-next-line no-eval
        const result = eval(evaluableExpression);

        if (typeof result !== 'number' || isNaN(result)) {
            throw new Error('Resultado da fórmula não é um número válido');
        }

        return result;
    } catch (error) {
        throw new Error(
            `Erro ao avaliar fórmula: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
        );
    }
}

/**
 * Formats a formula for user-friendly display
 * @param expression - The formula expression
 * @returns Formatted formula with proper spacing
 */
export function formatFormulaForDisplay(expression: string): string {
    return expression
        .replace(/\*/g, ' × ')
        .replace(/\//g, ' ÷ ')
        .replace(/\+/g, ' + ')
        .replace(/\-/g, ' - ')
        .replace(/\(/g, '( ')
        .replace(/\)/g, ' )')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Generates example formulas for user guidance
 * @param componentCodes - Available component codes
 * @returns Array of example formulas
 */
export function getFormulaExamples(componentCodes: string[]): string[] {
    const examples: string[] = [];

    if (componentCodes.length >= 2) {
        const [code1, code2] = componentCodes;
        examples.push(
            `${code1} * 0.4 + ${code2} * 0.6`,
            `(${code1} + ${code2}) / 2`,
            `${code1} * 0.3 + ${code2} * 0.7`
        );
    } else if (componentCodes.length === 1) {
        const code = componentCodes[0];
        examples.push(`${code} * 1.0`, `${code} / 2`);
    }

    return examples;
}
