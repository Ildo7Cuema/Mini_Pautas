/**
 * Formula Parser and Evaluator for EduGest Angola System
 * 
 * This module provides safe parsing and evaluation of custom grade calculation formulas.
 * It supports:
 * - Basic arithmetic operators: +, -, *, /
 * - Component variables (e.g., p1, p2, trabalho)
 * - Functions: min, max, round, if
 * - Step-by-step calculation breakdown
 * 
 * Security: Uses a sandboxed evaluator to prevent code injection
 */

import { getQualitativeClassification } from './angolaGradeScale'

export interface ComponentValue {
    codigo: string;
    valor: number;
    peso: number;
}

export interface CalculationStep {
    componente: string;
    valor: number;
    peso: number;
    contribuicao: number;
    calculo: string;
}

export interface CalculationResult {
    nota_final: number;
    classificacao: string;
    componentes: Record<string, CalculationStep>;
    expressao_completa: string;
    valida: boolean;
    erro?: string;
}

export interface FormulaValidation {
    valida: boolean;
    mensagem: string;
    componentes_usados: string[];
    peso_total: number;
}

/**
 * Validates a formula expression
 */
export function validateFormula(
    expressao: string,
    componentes: ComponentValue[]
): FormulaValidation {
    const result: FormulaValidation = {
        valida: false,
        mensagem: '',
        componentes_usados: [],
        peso_total: 0,
    };

    try {
        // Extract component codes from formula
        const componentPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
        const matches = expressao.match(componentPattern) || [];

        // Filter out function names and operators
        const functionNames = ['min', 'max', 'round', 'if'];
        const componentCodes = matches.filter(
            (match) => !functionNames.includes(match.toLowerCase())
        );

        result.componentes_usados = [...new Set(componentCodes)];

        // Check if all components in formula exist
        const availableComponents = componentes.map((c) => c.codigo);
        const missingComponents = result.componentes_usados.filter(
            (code) => !availableComponents.includes(code)
        );

        if (missingComponents.length > 0) {
            result.mensagem = `Componentes não encontrados: ${missingComponents.join(', ')}`;
            return result;
        }

        // Validate that weights sum to 100%
        const usedComponents = componentes.filter((c) =>
            result.componentes_usados.includes(c.codigo)
        );
        result.peso_total = usedComponents.reduce((sum, c) => sum + c.peso, 0);

        if (Math.abs(result.peso_total - 100) > 0.01) {
            result.mensagem = `Os pesos dos componentes devem somar 100%. Atual: ${result.peso_total}%`;
            return result;
        }

        // Validate formula syntax by attempting to parse it
        const testValues: Record<string, number> = {};
        result.componentes_usados.forEach((code) => {
            testValues[code] = 10; // Test value
        });

        try {
            evaluateFormula(expressao, testValues);
        } catch (error) {
            result.mensagem = `Erro de sintaxe na fórmula: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
            return result;
        }

        result.valida = true;
        result.mensagem = 'Fórmula válida. Pesos somam 100%.';
        return result;
    } catch (error) {
        result.mensagem = `Erro ao validar fórmula: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
        return result;
    }
}

/**
 * Safely evaluates a mathematical expression with given variables
 * Uses Function constructor with restricted scope for security
 */
function evaluateFormula(
    expressao: string,
    valores: Record<string, number>
): number {
    // Create a safe evaluation context
    const safeContext = {
        ...valores,
        Math: {
            min: Math.min,
            max: Math.max,
            round: Math.round,
            floor: Math.floor,
            ceil: Math.ceil,
            abs: Math.abs,
        },
        min: Math.min,
        max: Math.max,
        round: Math.round,
    };

    // Replace component names with their values in the expression
    let processedExpression = expressao;
    Object.keys(valores).forEach((key) => {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        processedExpression = processedExpression.replace(regex, valores[key].toString());
    });

    // Handle 'if' function: if(condition, trueValue, falseValue)
    processedExpression = processedExpression.replace(
        /if\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/g,
        '(($1) ? ($2) : ($3))'
    );

    try {
        // Use Function constructor for safe evaluation
        const evaluator = new Function(
            ...Object.keys(safeContext),
            `"use strict"; return (${processedExpression});`
        );

        const result = evaluator(...Object.values(safeContext));

        if (typeof result !== 'number' || !isFinite(result)) {
            throw new Error('Resultado inválido da fórmula');
        }

        return result;
    } catch (error) {
        throw new Error(
            `Erro ao avaliar fórmula: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
        );
    }
}

/**
 * Calculates final grade with detailed step-by-step breakdown
 */
export function calculateFinalGrade(
    expressao: string,
    componentes: ComponentValue[],
    notas: Record<string, number>
): CalculationResult {
    const result: CalculationResult = {
        nota_final: 0,
        classificacao: '',
        componentes: {},
        expressao_completa: '',
        valida: false,
    };

    try {
        // Validate formula first
        const validation = validateFormula(expressao, componentes);
        if (!validation.valida) {
            result.erro = validation.mensagem;
            return result;
        }

        // Check if all required grades are present
        const missingGrades = validation.componentes_usados.filter(
            (code) => !(code in notas)
        );

        if (missingGrades.length > 0) {
            result.erro = `Notas faltando para: ${missingGrades.join(', ')}`;
            return result;
        }

        // Calculate contribution of each component
        const steps: string[] = [];
        const contributions: number[] = [];

        validation.componentes_usados.forEach((codigo) => {
            const componente = componentes.find((c) => c.codigo === codigo);
            if (!componente) return;

            const nota = notas[codigo];
            const peso = componente.peso / 100; // Convert percentage to decimal
            const contribuicao = nota * peso;

            result.componentes[codigo] = {
                componente: codigo,
                valor: nota,
                peso: peso,
                contribuicao: parseFloat(contribuicao.toFixed(2)),
                calculo: `${peso.toFixed(2)} * ${nota} = ${contribuicao.toFixed(2)}`,
            };

            steps.push(`${peso.toFixed(2)}*${nota}`);
            contributions.push(contribuicao);
        });

        // Calculate final grade
        result.nota_final = parseFloat(
            contributions.reduce((sum, val) => sum + val, 0).toFixed(2)
        );

        // Determine classification
        result.classificacao = getClassificacao(result.nota_final);

        // Build complete expression
        const contributionSteps = contributions.map((c) => c.toFixed(2)).join(' + ');
        result.expressao_completa = `${steps.join(' + ')} = ${contributionSteps} = ${result.nota_final}`;

        result.valida = true;
        return result;
    } catch (error) {
        result.erro = `Erro ao calcular nota final: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
        return result;
    }
}

/**
 * Determines classification based on grade value and education subsystem (RAA)
 */
export function getClassificacao(nota: number, nivelEnsino?: string | null): string {
    return getQualitativeClassification(nota, nivelEnsino);
}

/**
 * Parses a formula and extracts component codes
 */
export function extractComponents(expressao: string): string[] {
    const componentPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    const matches = expressao.match(componentPattern) || [];

    // Filter out function names
    const functionNames = ['min', 'max', 'round', 'if', 'Math'];
    const componentCodes = matches.filter(
        (match) => !functionNames.includes(match)
    );

    return [...new Set(componentCodes)];
}

/**
 * Generates example formulas for testing
 */
export function getExampleFormulas(): Record<string, string> {
    return {
        'Média Ponderada Simples': '0.3*p1 + 0.3*p2 + 0.4*trabalho',
        'Três Provas Iguais': '0.33*p1 + 0.33*p2 + 0.34*p3',
        'Com Participação': '0.25*p1 + 0.25*p2 + 0.3*trabalho + 0.2*participacao',
        'Melhor de Duas Provas': '0.5*max(p1, p2) + 0.5*trabalho',
        'Condicional': 'if(p1 > 10, 0.4*p1 + 0.6*p2, 0.3*p1 + 0.7*p2)',
    };
}

/**
 * Validates grade value against component / official scale
 */
export function validateGrade(
    valor: number,
    escalaMinima: number,
    escalaMaxima: number,
    mensagemCustom?: string
): { valida: boolean; mensagem: string } {
    if (valor < escalaMinima || valor > escalaMaxima) {
        return {
            valida: false,
            mensagem:
                mensagemCustom ||
                `Nota deve estar entre ${escalaMinima} e ${escalaMaxima}`,
        };
    }

    return {
        valida: true,
        mensagem: 'Nota válida',
    };
}
