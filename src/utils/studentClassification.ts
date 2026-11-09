/**
 * Student Classification Utility
 * 
 * Determines if a student transitions (Transita) or not (Não Transita) based on
 * Angolan education system rules for Ensino Primário, Ensino Secundário I Ciclo (7ª-9ª)
 * and Ensino Secundário II Ciclo (10ª-12ª).
 * 
 * Rules:
 * - 7ª, 8ª, 10ª, 11ª: Allow conditional transition (up to 2 disciplines 7-9, except mandatory)
 * - 9ª, 12ª: Terminal classes, no conditional allowed
 */

import { getApprovalThreshold, resolveEducationSubsystem } from './angolaGradeScale'

export interface DisciplinaGrade {
    id: string
    nome: string
    nota: number // Grade from MF or MFD component
}

export interface ClassificationResult {
    status: 'Transita' | 'Não Transita' | 'Condicional' | 'AguardandoNotas'
    motivos: string[]
    disciplinas_em_risco: string[]
    acoes_recomendadas: string[]
    observacao_padronizada: string
    motivo_retencao?: string
    matricula_condicional: boolean
}

/**
 * Extract class number from class string (e.g., "7ª Classe" -> 7)
 */
function extractClassNumber(classe?: string): number | null {
    if (!classe) return null
    const match = classe.match(/(\d+)[ªº]/)
    return match ? parseInt(match[1], 10) : null
}

/**
 * Round grade to nearest integer if needed
 * IMPORTANT: This rounding is applied BEFORE making transition decisions
 */
function roundGrade(grade: number): number {
    return Math.round(grade)
}

/** Frequência anual mínima oficial (2/3 ≈ 66,67%). */
export const FREQUENCIA_MINIMA_PERCENT = 66.67

/**
 * Normaliza a frequência a 2 casas decimais antes de comparar com o mínimo oficial.
 * Evita falsos negativos com valores como 66.666...% (exactamente 2/3).
 */
export function normalizeFrequenciaPercent(frequencia: number): number {
    return Math.round(frequencia * 100) / 100
}

/**
 * Check if attendance is sufficient (>= 66.67%)
 */
export function isAttendanceSufficient(frequencia?: number | null): boolean {
    if (frequencia === undefined || frequencia === null) return true // If not set, don't block
    return normalizeFrequenciaPercent(frequencia) >= FREQUENCIA_MINIMA_PERCENT
}

/**
 * Défice percentual face ao mínimo oficial (0 se já suficiente).
 * Ex.: 48% → 18,67 p.p. em falta para atingir 66,67%.
 */
export function frequenciaDeficitPercent(frequencia: number): number {
    const normalizada = normalizeFrequenciaPercent(frequencia)
    if (normalizada >= FREQUENCIA_MINIMA_PERCENT) return 0
    return normalizeFrequenciaPercent(FREQUENCIA_MINIMA_PERCENT - normalizada)
}

/**
 * Observação de retenção por frequência, reconhecendo o resultado académico quando positivo.
 */
function buildObservacaoFrequenciaInsuficiente(
    frequencia: number,
    resultadoAcademico: 'Transita' | 'Condicional' | 'Não Transita' | 'AguardandoNotas',
    limiarNota: number
): { observacao: string; motivo: string } {
    const freqText = normalizeFrequenciaPercent(frequencia).toFixed(2)
    const deficitText = frequenciaDeficitPercent(frequencia).toFixed(2)
    const motivo = `Frequência insuficiente (${freqText}%, mínimo 66,67% — défice de ${deficitText} p.p.)`

    if (resultadoAcademico === 'Transita' || resultadoAcademico === 'Condicional') {
        const academicoTxt = resultadoAcademico === 'Condicional'
            ? 'resultado académico condicional'
            : `classificação positiva em todas as disciplinas (>= ${limiarNota} valores)`
        return {
            observacao:
                `Apesar de ${academicoTxt}, não transitou por frequência insuficiente ` +
                `(${freqText}%, inferior ao mínimo de 66,67% — défice de ${deficitText} p.p.).`,
            motivo,
        }
    }

    return {
        observacao: `Não transitou por frequência insuficiente (${freqText}%, inferior ao mínimo de 66,67% — défice de ${deficitText} p.p.).`,
        motivo,
    }
}

/**
 * Generate standardized observation based on classification result
 */
function generateObservacao(
    status: 'Transita' | 'Não Transita' | 'Condicional',
    nivelEnsino?: string,
    _classe?: string,
    disciplinasEmRisco?: string[],
    frequencia?: number,
    _limiar?: number
): string {
    const limiarNota = getApprovalThreshold(nivelEnsino)

    // Nota: retenção por frequência é tratada fora desta função (buildObservacaoFrequenciaInsuficiente),
    // para não misturar resultado académico com a decisão final.

    if (status === 'Transita') {
        const freqText = frequencia !== null && frequencia !== undefined
            ? normalizeFrequenciaPercent(frequencia).toFixed(2)
            : 'N/A'
        return `Transitou por ter obtido classificação igual ou superior a ${limiarNota} valores em todas as disciplinas e frequência de ${freqText}%.`
    }

    if (status === 'Condicional') {
        const numDisciplinas = disciplinasEmRisco?.length || 0
        const disciplinasTexto = disciplinasEmRisco?.join(', ') || ''
        return `Transitou condicionalmente com ${numDisciplinas} disciplina(s) entre 7 e 9 valores: ${disciplinasTexto}. Deve realizar Exame Extraordinário conforme calendário oficial.`
    }

    if (status === 'Não Transita') {
        if (disciplinasEmRisco && disciplinasEmRisco.length > 0) {
            const numDisciplinas = disciplinasEmRisco.length
            const disciplinasTexto = disciplinasEmRisco.join(', ')
            return `Não transitou por ter obtido classificação inferior a ${limiarNota} valores em ${numDisciplinas} disciplina(s): ${disciplinasTexto}.`
        }
        return `Não transitou por não atingir os critérios mínimos de aprovação.`
    }

    return 'Aguardando notas para determinar transição.'
}

/**
 * Check if a discipline is in the list of mandatory disciplines
 */
function isMandatoryDiscipline(disciplinaId: string, disciplinaNome: string, mandatoryDisciplineIds?: string[]): boolean {
    // If no mandatory disciplines configured, fall back to Português and Matemática
    if (!mandatoryDisciplineIds || mandatoryDisciplineIds.length === 0) {
        const normalized = disciplinaNome.toLowerCase().trim()
        return normalized.includes('português') ||
            normalized.includes('portugues') ||
            normalized.includes('matemática') ||
            normalized.includes('matematica')
    }

    // Check if discipline ID is in the mandatory list
    return mandatoryDisciplineIds.includes(disciplinaId)
}

/**
 * Classify student for Ensino Primário
 * Rule: Transita if ALL disciplines >= 5, Não Transita if ANY discipline < 5
 * IMPORTANT: Frequência < 66.67% automatically results in Não Transita
 */
function classifyEnsinoPrimario(
    disciplinas: DisciplinaGrade[],
    frequencia?: number
): ClassificationResult {
    if (disciplinas.length === 0) {
        return {
            status: 'AguardandoNotas',
            motivos: ['Nenhuma nota disponível'],
            disciplinas_em_risco: [],
            acoes_recomendadas: ['Aguardar lançamento de notas'],
            observacao_padronizada: 'Aguardando notas para determinar transição.',
            matricula_condicional: false
        }
    }

    // 1) Resultado académico (notas) — independente da frequência
    const disciplinasAbaixo5: string[] = []
    disciplinas.forEach(disc => {
        const notaArredondada = roundGrade(disc.nota)
        if (notaArredondada < 5) {
            disciplinasAbaixo5.push(disc.nome)
        }
    })

    const academico: ClassificationResult = disciplinasAbaixo5.length === 0
        ? {
            status: 'Transita',
            motivos: ['Todas as disciplinas com nota >= 5'],
            disciplinas_em_risco: [],
            acoes_recomendadas: [],
            observacao_padronizada: generateObservacao('Transita', 'Ensino Primário', undefined, [], frequencia, 5),
            matricula_condicional: false
        }
        : {
            status: 'Não Transita',
            motivos: [`${disciplinasAbaixo5.length} disciplina(s) com nota < 5`],
            disciplinas_em_risco: disciplinasAbaixo5,
            acoes_recomendadas: ['Reforço nas disciplinas em risco', 'Acompanhamento pedagógico'],
            observacao_padronizada: generateObservacao('Não Transita', 'Ensino Primário', undefined, disciplinasAbaixo5, frequencia, 5),
            motivo_retencao: `${disciplinasAbaixo5.length} disciplina(s) com nota inferior a 5 valores: ${disciplinasAbaixo5.join(', ')}`,
            matricula_condicional: false
        }

    // 2) Frequência insuficiente bloqueia a transição, mas preserva o contexto académico
    if (!isAttendanceSufficient(frequencia) && frequencia !== undefined && frequencia !== null) {
        const freqText = normalizeFrequenciaPercent(frequencia).toFixed(2)
        const { observacao, motivo } = buildObservacaoFrequenciaInsuficiente(
            frequencia,
            academico.status,
            5
        )
        return {
            status: 'Não Transita',
            motivos: [
                `Frequência insuficiente (${freqText}%)`,
                ...academico.motivos.map(m => `Académico: ${m}`),
            ],
            disciplinas_em_risco: academico.disciplinas_em_risco,
            acoes_recomendadas: ['Melhorar assiduidade', ...academico.acoes_recomendadas],
            observacao_padronizada: observacao,
            motivo_retencao: motivo,
            matricula_condicional: false
        }
    }

    return academico
}

/**
 * Classify student for Ensino Secundário I e II Ciclo (7ª-12ª classes)
 * IMPORTANT: Frequência < 66.67% automatically results in Não Transita
 */
function classifyEnsinoSecundario(
    disciplinas: DisciplinaGrade[],
    classe?: string,
    mandatoryDisciplineIds?: string[],
    frequencia?: number
): ClassificationResult {
    if (disciplinas.length === 0) {
        return {
            status: 'AguardandoNotas',
            motivos: ['Nenhuma nota disponível'],
            disciplinas_em_risco: [],
            acoes_recomendadas: ['Aguardar lançamento de notas'],
            observacao_padronizada: 'Aguardando notas para determinar transição.',
            matricula_condicional: false
        }
    }

    // 1) Resultado académico (notas) — independente da frequência
    const academico = (() => {
        const classNumber = extractClassNumber(classe)
        const disciplinasAbaixo7: string[] = []
        const disciplinasEntre7e9: string[] = []
        const disciplinasAbaixo10: string[] = []

        disciplinas.forEach(disc => {
            const notaArredondada = roundGrade(disc.nota)

            if (notaArredondada < 7) {
                disciplinasAbaixo7.push(disc.nome)
            } else if (notaArredondada >= 7 && notaArredondada < 10) {
                disciplinasEntre7e9.push(disc.nome)
            } else if (notaArredondada < 10) {
                disciplinasAbaixo10.push(disc.nome)
            }
        })

        // Rule: Não Transita if ANY discipline < 7
        if (disciplinasAbaixo7.length > 0) {
            return {
                status: 'Não Transita' as const,
                motivos: [`${disciplinasAbaixo7.length} disciplina(s) com nota < 7`],
                disciplinas_em_risco: disciplinasAbaixo7,
                acoes_recomendadas: ['Reforço urgente nas disciplinas em risco', 'Acompanhamento pedagógico intensivo'],
                observacao_padronizada: generateObservacao('Não Transita', 'Ensino Secundário', classe, disciplinasAbaixo7, frequencia, 7),
                motivo_retencao: `${disciplinasAbaixo7.length} disciplina(s) com nota inferior a 7 valores: ${disciplinasAbaixo7.join(', ')}`,
                matricula_condicional: false
            }
        }

        // 9ª and 12ª Classes (Terminal): Apply general rule (all >= 10) - NO conditional allowed
        const isTerminalClass = classNumber === 9 || classNumber === 12
        if (isTerminalClass) {
            if (disciplinasEntre7e9.length > 0 || disciplinasAbaixo10.length > 0) {
                const todasEmRisco = [...disciplinasEntre7e9, ...disciplinasAbaixo10]
                const classeLabel = classNumber === 9 ? '9ª Classe' : '12ª Classe'
                return {
                    status: 'Não Transita' as const,
                    motivos: [`${classeLabel} (terminal) requer todas as disciplinas >= 10`],
                    disciplinas_em_risco: todasEmRisco,
                    acoes_recomendadas: ['Reforço nas disciplinas abaixo de 10', 'Preparação para exames'],
                    observacao_padronizada: generateObservacao('Não Transita', 'Ensino Secundário', classeLabel, todasEmRisco, frequencia, 10),
                    motivo_retencao: `${classeLabel} (terminal) requer todas as disciplinas com nota >= 10 valores. Disciplinas em risco: ${todasEmRisco.join(', ')}`,
                    matricula_condicional: false
                }
            } else {
                const classeLabel = classNumber === 9 ? '9ª Classe' : '12ª Classe'
                return {
                    status: 'Transita' as const,
                    motivos: ['Todas as disciplinas >= 10'],
                    disciplinas_em_risco: [],
                    acoes_recomendadas: [],
                    observacao_padronizada: generateObservacao('Transita', 'Ensino Secundário', classeLabel, [], frequencia, 10),
                    matricula_condicional: false
                }
            }
        }

        // 7ª, 8ª, 10ª and 11ª Classes: Exception allows up to 2 disciplines between 7-9
        // BUT NOT if two are mandatory disciplines simultaneously (Português and Matemática or configured by admin)
        const allowsConditional = classNumber === 7 || classNumber === 8 || classNumber === 10 || classNumber === 11
        if (allowsConditional) {
            if (disciplinasEntre7e9.length === 0) {
                return {
                    status: 'Transita' as const,
                    motivos: ['Todas as disciplinas >= 10'],
                    disciplinas_em_risco: [],
                    acoes_recomendadas: [],
                    observacao_padronizada: generateObservacao('Transita', 'Ensino Secundário', classe, [], frequencia, 10),
                    matricula_condicional: false
                }
            } else if (disciplinasEntre7e9.length <= 2) {
                const mandatoryCount = disciplinasEntre7e9.filter(nome => {
                    const disc = disciplinas.find(d => d.nome === nome)
                    return disc ? isMandatoryDiscipline(disc.id, disc.nome, mandatoryDisciplineIds) : false
                }).length

                if (disciplinasEntre7e9.length === 2 && mandatoryCount === 2) {
                    return {
                        status: 'Não Transita' as const,
                        motivos: ['Não permitido ter 2 disciplinas obrigatórias simultaneamente entre 7-9'],
                        disciplinas_em_risco: disciplinasEntre7e9,
                        acoes_recomendadas: ['Reforço urgente nas disciplinas obrigatórias'],
                        observacao_padronizada: 'Não transitou por ter obtido classificação inferior a 10 valores simultaneamente em Língua Portuguesa e Matemática.',
                        motivo_retencao: 'Não permitido ter Língua Portuguesa e Matemática simultaneamente com notas entre 7-9 valores',
                        matricula_condicional: false
                    }
                } else {
                    return {
                        status: 'Condicional' as const,
                        motivos: [`Permitido até 2 disciplinas entre 7-9 (${disciplinasEntre7e9.length} encontrada(s))`],
                        disciplinas_em_risco: disciplinasEntre7e9,
                        acoes_recomendadas: disciplinasEntre7e9.length > 0
                            ? ['Reforço nas disciplinas entre 7-9 para melhorar desempenho', 'Preparação para Exame Extraordinário']
                            : [],
                        observacao_padronizada: generateObservacao('Condicional', 'Ensino Secundário', classe, disciplinasEntre7e9, frequencia, 10),
                        matricula_condicional: true
                    }
                }
            } else {
                return {
                    status: 'Não Transita' as const,
                    motivos: [`Mais de 2 disciplinas entre 7-9 (${disciplinasEntre7e9.length} encontradas)`],
                    disciplinas_em_risco: disciplinasEntre7e9,
                    acoes_recomendadas: ['Reforço nas disciplinas entre 7-9'],
                    observacao_padronizada: generateObservacao('Não Transita', 'Ensino Secundário', classe, disciplinasEntre7e9, frequencia, 10),
                    motivo_retencao: `Mais de 2 disciplinas com notas entre 7-9 valores (${disciplinasEntre7e9.length} encontradas): ${disciplinasEntre7e9.join(', ')}`,
                    matricula_condicional: false
                }
            }
        }

        // Default for other secondary classes
        if (disciplinasEntre7e9.length > 0 || disciplinasAbaixo10.length > 0) {
            const todasEmRisco = [...disciplinasEntre7e9, ...disciplinasAbaixo10]
            return {
                status: 'Não Transita' as const,
                motivos: ['Regra geral: todas as disciplinas devem ter >= 10'],
                disciplinas_em_risco: todasEmRisco,
                acoes_recomendadas: ['Reforço nas disciplinas abaixo de 10'],
                observacao_padronizada: generateObservacao('Não Transita', 'Ensino Secundário', classe, todasEmRisco, frequencia, 10),
                motivo_retencao: `Disciplinas com nota inferior a 10 valores: ${todasEmRisco.join(', ')}`,
                matricula_condicional: false
            }
        }

        return {
            status: 'Transita' as const,
            motivos: ['Todas as disciplinas >= 10'],
            disciplinas_em_risco: [],
            acoes_recomendadas: [],
            observacao_padronizada: generateObservacao('Transita', 'Ensino Secundário', classe, [], frequencia, 10),
            matricula_condicional: false
        }
    })()

    // 2) Frequência insuficiente bloqueia a transição, mas preserva o contexto académico
    if (!isAttendanceSufficient(frequencia) && frequencia !== undefined && frequencia !== null) {
        const freqText = normalizeFrequenciaPercent(frequencia).toFixed(2)
        const { observacao, motivo } = buildObservacaoFrequenciaInsuficiente(
            frequencia,
            academico.status,
            10
        )
        return {
            status: 'Não Transita',
            motivos: [
                `Frequência insuficiente (${freqText}%)`,
                ...academico.motivos.map(m => `Académico: ${m}`),
            ],
            disciplinas_em_risco: academico.disciplinas_em_risco,
            acoes_recomendadas: ['Melhorar assiduidade', ...academico.acoes_recomendadas],
            observacao_padronizada: observacao,
            motivo_retencao: motivo,
            matricula_condicional: false
        }
    }

    return academico
}

/**
 * Main classification function
 * 
 * @param disciplinas - Array of disciplines with grades from MF or MFD component
 * @param nivelEnsino - Education level (e.g., "Ensino Primário", "Ensino Secundário I Ciclo")
 * @param classe - Class level (e.g., "7ª Classe", "8ª Classe", "9ª Classe")
 * @param mandatoryDisciplineIds - IDs of mandatory disciplines (Português and Matemática)
 * @param frequencia - Annual attendance percentage (0-100)
 * @returns Classification result with status, reasons, at-risk disciplines, recommended actions, and standardized observation
 */
export function classifyStudent(
    disciplinas: DisciplinaGrade[],
    nivelEnsino?: string,
    classe?: string,
    mandatoryDisciplineIds?: string[],
    frequencia?: number
): ClassificationResult {
    // Determine if Primary or Secondary education (RAA)
    if (resolveEducationSubsystem(nivelEnsino) === 'primario') {
        return classifyEnsinoPrimario(disciplinas, frequencia)
    } else {
        // Assume Secondary (Ensino Secundário I e II Ciclo)
        return classifyEnsinoSecundario(disciplinas, classe, mandatoryDisciplineIds, frequencia)
    }
}
