/**
 * Utility functions for managing student enrollments (matrículas)
 * 
 * This module handles:
 * - Generating pending enrollments at end of academic year
 * - Confirming enrollments for promoted students
 * - Confirming repeating for non-promoted students
 * - Managing extraordinary exams for conditional students
 */

import { supabase } from '../lib/supabaseClient'
import {
    Matricula,
    Aluno,
    Turma,
    AnoLectivo,
    EstadoCicloMatriculas,
    ProntidaoPautasFinais
} from '../types'
import { classifyStudent, DisciplinaGrade, ClassificationResult } from './studentClassification'

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Determine the next class level based on current class
 * @param classeAtual - Current class (e.g., "7ª Classe")
 * @returns Next class (e.g., "8ª Classe")
 */
export function determinarProximaClasse(classeAtual: string): string {
    const match = classeAtual.match(/(\d+)[ªº]\s*Classe/i)
    if (!match) return classeAtual

    const numeroAtual = parseInt(match[1], 10)
    const proximoNumero = numeroAtual + 1

    // Maximum is 12ª Classe
    if (proximoNumero > 12) return classeAtual

    return `${proximoNumero}ª Classe`
}

/**
 * Extract class from turma name (e.g., "10ª Classe A" -> "10ª Classe")
 */
export function extrairClasse(turmaNome: string): string | undefined {
    const match = turmaNome.match(/(\d+[ªº]\s*Classe)/i)
    return match ? match[1] : undefined
}

/** Número da classe a partir de "7ª Classe", "7a Classe", "7ª", etc. */
export function numeroDaClasse(classe?: string | null): number | null {
    if (!classe) return null
    const match = classe.match(/(\d+)/)
    return match ? parseInt(match[1], 10) : null
}

/**
 * Verifica se o nome da turma corresponde à classe esperada
 * (ex.: turma "8ª Classe B" ↔ classe "8ª Classe")
 */
export function turmaPertenceAClasse(turmaNome: string, classeEsperada?: string | null): boolean {
    if (!classeEsperada) return false
    const nTurma = numeroDaClasse(extrairClasse(turmaNome) || turmaNome)
    const nEsperada = numeroDaClasse(classeEsperada)
    if (nTurma !== null && nEsperada !== null) return nTurma === nEsperada
    return turmaNome.toLowerCase().includes(classeEsperada.toLowerCase().trim())
}

/**
 * Resolve a classe de confirmação a partir da observação da Pauta Final
 * (status_transicao / observacao_padronizada):
 * - Transita → classe seguinte
 * - Não Transita → mesma classe
 */
export function resolverDestinoPorObservacaoPauta(matricula: {
    status_transicao: string
    observacao_padronizada?: string | null
    classe_origem?: string | null
    classe_destino?: string | null
}): {
    observacao: 'Transita' | 'Não Transita' | null
    promove: boolean
    classeEsperada: string | null
    mensagem: string
} {
    const raw = (matricula.status_transicao || matricula.observacao_padronizada || '').trim()
    const observacao: 'Transita' | 'Não Transita' | null =
        raw === 'Transita' || /^transita$/i.test(raw)
            ? 'Transita'
            : raw === 'Não Transita' || /^n[aã]o\s*transita$/i.test(raw)
                ? 'Não Transita'
                : null

    if (observacao === 'Transita') {
        const classeEsperada = matricula.classe_destino
            || (matricula.classe_origem ? determinarProximaClasse(matricula.classe_origem) : null)
        return {
            observacao,
            promove: true,
            classeEsperada,
            mensagem: 'Observação da Pauta Final: Transita — matrícula confirmada na classe seguinte.'
        }
    }

    if (observacao === 'Não Transita') {
        const classeEsperada = matricula.classe_origem || null
        return {
            observacao,
            promove: false,
            classeEsperada,
            mensagem: 'Observação da Pauta Final: Não Transita — matrícula confirmada na mesma classe.'
        }
    }

    return {
        observacao: null,
        promove: false,
        classeEsperada: null,
        mensagem: 'Só é possível confirmar matrícula com observação definitiva da Pauta Final (Transita ou Não Transita).'
    }
}

/**
 * Calculate next academic year
 * @param anoAtual - Current year (e.g., "2025" or "2025/2026")
 */
export function calcularProximoAnoLectivo(anoAtual: string): string {
    // Handle format "2025" or "2025/2026"
    const match = anoAtual.match(/(\d{4})/)
    if (!match) return anoAtual

    const ano = parseInt(match[1], 10)
    return `${ano + 1}`
}

// ============================================
// MATRICULA OPERATIONS
// ============================================

export interface MatriculaComAluno extends Matricula {
    aluno: Aluno & {
        turma?: Turma
    }
    turma_origem?: Turma
}

/**
 * Load all pending enrollments for a school/year
 */
export async function carregarMatriculasPendentes(
    escolaId: string,
    anoLectivoOrigem?: string
): Promise<MatriculaComAluno[]> {
    let query = supabase
        .from('matriculas')
        .select(`
            *,
            aluno:alunos!aluno_id (
                id,
                nome_completo,
                numero_processo,
                genero,
                frequencia_anual,
                turma:turmas!turma_id (
                    id,
                    nome,
                    nivel_ensino,
                    ano_lectivo
                )
            ),
            turma_origem:turmas!turma_origem_id (
                id,
                nome,
                nivel_ensino,
                ano_lectivo
            ),
            turma_destino:turmas!turma_destino_id (
                id,
                nome,
                nivel_ensino,
                ano_lectivo
            )
        `)
        .eq('escola_id', escolaId)
        .order('created_at', { ascending: false })

    if (anoLectivoOrigem) {
        query = query.eq('ano_lectivo_origem', anoLectivoOrigem)
    }

    const { data, error } = await query

    if (error) throw error
    return (data || []) as MatriculaComAluno[]
}

/**
 * Generate pending enrollments for all students in a class
 * This calls the database function gerar_matriculas_pendentes
 */
export async function gerarMatriculasPendentes(
    turmaId: string,
    anoLectivoDestino: string
): Promise<number> {
    const { data, error } = await supabase
        .rpc('gerar_matriculas_pendentes', {
            p_turma_id: turmaId,
            p_ano_lectivo_destino: anoLectivoDestino
        })

    if (error) throw error
    return data as number
}

/**
 * Update matricula with classification data from frontend calculation
 */
export async function atualizarClassificacaoMatricula(
    matriculaId: string,
    classification: ClassificationResult,
    mediaGeral: number,
    classeOrigem?: string
): Promise<void> {
    const { error } = await supabase
        .from('matriculas')
        .update({
            status_transicao: classification.status,
            disciplinas_em_risco: classification.disciplinas_em_risco,
            observacao_padronizada: classification.observacao_padronizada,
            motivo_retencao: classification.motivo_retencao,
            matricula_condicional: classification.matricula_condicional,
            media_geral: mediaGeral,
            classe_origem: classeOrigem,
            classe_destino: classification.status === 'Transita' || classification.status === 'Condicional'
                ? (classeOrigem ? determinarProximaClasse(classeOrigem) : null)
                : classeOrigem, // Non-promoted stays in same class
            // Condicional → exame; AguardandoNotas permanece pendente mas bloqueado na confirmação
            estado_matricula: classification.status === 'Condicional'
                ? 'aguardando_exame'
                : 'pendente',
            updated_at: new Date().toISOString()
        })
        .eq('id', matriculaId)

    if (error) throw error
}

// ============================================
// CICLO DO ANO LECTIVO
// ============================================

export async function listarAnosLectivos(escolaId: string): Promise<AnoLectivo[]> {
    const { data, error } = await supabase
        .from('anos_lectivos')
        .select('*')
        .eq('escola_id', escolaId)
        .order('ano', { ascending: false })

    if (error) throw error
    return (data || []) as AnoLectivo[]
}

/**
 * Anos disponíveis a partir das turmas (mesmo que ainda não exista registo em anos_lectivos)
 */
export async function listarAnosLectivosDasTurmas(escolaId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('turmas')
        .select('ano_lectivo')
        .eq('escola_id', escolaId)

    if (error) throw error

    const anos = Array.from(
        new Set((data || []).map(t => String(t.ano_lectivo)).filter(Boolean))
    ).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))

    return anos
}

function throwRpcError(error: { message: string; code?: string; details?: string; hint?: string }): never {
    const err = new Error(error.message) as Error & { code?: string; details?: string; hint?: string }
    err.code = error.code
    err.details = error.details
    err.hint = error.hint
    throw err
}

export async function verificarProntidaoPautasFinais(
    escolaId: string,
    anoLectivo: string
): Promise<ProntidaoPautasFinais> {
    const { data, error } = await supabase.rpc('verificar_prontidao_pautas_finais', {
        p_escola_id: escolaId,
        p_ano_lectivo: anoLectivo
    })

    if (error) throwRpcError(error)
    return data as ProntidaoPautasFinais
}

export async function obterEstadoCicloMatriculas(
    escolaId: string,
    anoOrigem: string,
    anoDestino: string
): Promise<EstadoCicloMatriculas> {
    const { data, error } = await supabase.rpc('obter_estado_ciclo_matriculas', {
        p_escola_id: escolaId,
        p_ano_origem: anoOrigem,
        p_ano_destino: anoDestino
    })

    if (error) throwRpcError(error)
    return data as EstadoCicloMatriculas
}

export async function abrirAnoLectivo(
    escolaId: string,
    ano: string,
    observacao?: string
): Promise<AnoLectivo> {
    const { data, error } = await supabase.rpc('abrir_ano_lectivo', {
        p_escola_id: escolaId,
        p_ano: ano,
        p_observacao: observacao || null
    })

    if (error) throwRpcError(error)
    return data as AnoLectivo
}

export async function encerrarAnoLectivo(
    escolaId: string,
    ano: string
): Promise<AnoLectivo> {
    const { data, error } = await supabase.rpc('encerrar_ano_lectivo', {
        p_escola_id: escolaId,
        p_ano: ano,
        p_forcar: false
    })

    if (error) throwRpcError(error)
    return data as AnoLectivo
}

export async function gerarMatriculasAnoLectivo(
    escolaId: string,
    anoOrigem: string,
    anoDestino: string
): Promise<{ turmas_processadas: number; matriculas_geradas: number; detalhes: Array<{ turma_id: string; turma_nome: string; matriculas_geradas: number }> }> {
    const { data, error } = await supabase.rpc('gerar_matriculas_ano_lectivo', {
        p_escola_id: escolaId,
        p_ano_origem: anoOrigem,
        p_ano_destino: anoDestino
    })

    if (error) throwRpcError(error)
    return data as {
        turmas_processadas: number
        matriculas_geradas: number
        detalhes: Array<{ turma_id: string; turma_nome: string; matriculas_geradas: number }>
    }
}

/**
 * Classifica e actualiza todas as matrículas geradas para um ano de origem
 */
export async function classificarMatriculasDoAno(
    escolaId: string,
    anoOrigem: string,
    turmas: Array<{ id: string; nome: string; nivel_ensino: string }>
): Promise<number> {
    const matriculas = await carregarMatriculasPendentes(escolaId, anoOrigem)
    let actualizadas = 0

    for (const turma of turmas) {
        const classe = extrairClasse(turma.nome) || ''
        const { data: discObrig } = await supabase
            .from('disciplinas_obrigatorias')
            .select('disciplina_id')
            .eq('turma_id', turma.id)
            .eq('is_obrigatoria', true)

        const discObrigIds = (discObrig || []).map(d => d.disciplina_id)
        const classificacoes = await calcularClassificacaoTurma(
            turma.id,
            turma.nivel_ensino,
            classe,
            discObrigIds
        )

        const turmaMatriculas = matriculas.filter(m => m.turma_origem_id === turma.id)
        for (const matricula of turmaMatriculas) {
            const classificacao = classificacoes.find(c => c.aluno.id === matricula.aluno_id)
            if (classificacao) {
                await atualizarClassificacaoMatricula(
                    matricula.id,
                    classificacao.classification,
                    classificacao.mediaGeral,
                    classe
                )
                actualizadas++
            }
        }
    }

    return actualizadas
}

/**
 * Confirm enrollment according to Pauta Final observation:
 * Transita → next class; Não Transita → same class.
 */
export async function confirmarMatricula(
    matriculaId: string,
    turmaDestinoId: string,
    classeDestino?: string
): Promise<void> {
    const { error } = await supabase
        .rpc('confirmar_matricula', {
            p_matricula_id: matriculaId,
            p_turma_destino_id: turmaDestinoId,
            p_classe_destino: classeDestino
        })

    if (error) throwRpcError(error)
}

/**
 * Confirm repeating for a non-promoted student (Não Transita → mesma classe)
 */
export async function confirmarRepetencia(
    matriculaId: string,
    turmaDestinoId: string,
    classeOrigem?: string
): Promise<void> {
    const { error } = await supabase
        .rpc('confirmar_matricula', {
            p_matricula_id: matriculaId,
            p_turma_destino_id: turmaDestinoId,
            p_classe_destino: classeOrigem || null
        })

    if (error) throwRpcError(error)
}

/**
 * Confirma matrícula respeitando a observação da Pauta Final e a turma escolhida.
 */
export async function confirmarMatriculaPorObservacaoPauta(
    matricula: MatriculaComAluno,
    turmaDestino: Turma
): Promise<void> {
    const destino = resolverDestinoPorObservacaoPauta(matricula)
    if (!destino.observacao || !destino.classeEsperada) {
        throw new Error(destino.mensagem)
    }

    if (!turmaPertenceAClasse(turmaDestino.nome, destino.classeEsperada)) {
        throw new Error(
            destino.promove
                ? `Com observação «Transita», a turma de destino deve ser da classe seguinte (${destino.classeEsperada}).`
                : `Com observação «Não Transita», a turma de destino deve ser da mesma classe (${destino.classeEsperada}).`
        )
    }

    if (destino.promove) {
        await confirmarMatricula(matricula.id, turmaDestino.id, destino.classeEsperada)
    } else {
        await confirmarRepetencia(matricula.id, turmaDestino.id, destino.classeEsperada)
    }
}

/**
 * Register extraordinary exam result for conditional student
 */
export async function registrarResultadoExame(
    matriculaId: string,
    resultado: 'aprovado' | 'reprovado',
    nota: number,
    dataExame?: Date,
    observacao?: string
): Promise<void> {
    const { error } = await supabase
        .rpc('registrar_resultado_exame', {
            p_matricula_id: matriculaId,
            p_resultado: resultado,
            p_nota: nota,
            p_data_exame: dataExame?.toISOString().split('T')[0],
            p_observacao: observacao
        })

    if (error) throw error
}

/**
 * Confirma várias matrículas na mesma turma de destino,
 * validando a observação da Pauta Final (Transita / Não Transita) em cada uma.
 */
export async function confirmarMatriculasEmLote(
    matriculas: MatriculaComAluno[],
    turmaDestino: Turma
): Promise<{ success: number; errors: Array<{ id: string; error: string }> }> {
    const results = {
        success: 0,
        errors: [] as Array<{ id: string; error: string }>
    }

    for (const matricula of matriculas) {
        try {
            await confirmarMatriculaPorObservacaoPauta(matricula, turmaDestino)
            results.success++
        } catch (err) {
            results.errors.push({
                id: matricula.id,
                error: err instanceof Error ? err.message : 'Erro desconhecido'
            })
        }
    }

    return results
}

/**
 * Get available destination classes for enrollment
 * Returns classes for the next academic year
 */
export async function carregarTurmasDestino(
    escolaId: string,
    anoLectivoDestino: string,
    nivelEnsino?: string
): Promise<Turma[]> {
    let query = supabase
        .from('turmas')
        .select('*')
        .eq('escola_id', escolaId)
        .eq('ano_lectivo', anoLectivoDestino)
        .order('nome')

    if (nivelEnsino) {
        query = query.eq('nivel_ensino', nivelEnsino)
    }

    const { data, error } = await query

    if (error) throw error
    return (data || []) as Turma[]
}

/**
 * Cancel a pending enrollment
 */
export async function cancelarMatricula(matriculaId: string): Promise<void> {
    const { error } = await supabase
        .from('matriculas')
        .update({
            estado_matricula: 'cancelada',
            updated_at: new Date().toISOString()
        })
        .eq('id', matriculaId)
        .eq('estado_matricula', 'pendente') // Can only cancel pending

    if (error) throw error
}

/**
 * Get enrollment statistics for a school/year
 */
export async function carregarResumoMatriculas(
    escolaId: string,
    anoLectivoOrigem: string
): Promise<{
    total: number
    transitados: number
    naoTransitados: number
    condicionais: number
    pendentes: number
    confirmadas: number
    aguardandoExame: number
}> {
    const { data, error } = await supabase
        .from('matriculas')
        .select('status_transicao, estado_matricula')
        .eq('escola_id', escolaId)
        .eq('ano_lectivo_origem', anoLectivoOrigem)

    if (error) throw error

    const matriculas = data || []

    return {
        total: matriculas.length,
        transitados: matriculas.filter(m => m.status_transicao === 'Transita').length,
        naoTransitados: matriculas.filter(m => m.status_transicao === 'Não Transita').length,
        condicionais: matriculas.filter(m => m.status_transicao === 'Condicional').length,
        pendentes: matriculas.filter(m => m.estado_matricula === 'pendente').length,
        confirmadas: matriculas.filter(m => m.estado_matricula === 'confirmada').length,
        aguardandoExame: matriculas.filter(m => m.estado_matricula === 'aguardando_exame').length
    }
}

// ============================================
// GRADE CALCULATION HELPERS
// ============================================

/**
 * Calculate classification for all students in a class
 * This integrates with the existing studentClassification.ts
 */
export interface AlunoComClassificacao {
    aluno: Aluno
    disciplinaGrades: DisciplinaGrade[]
    classification: ClassificationResult
    mediaGeral: number
}

export async function calcularClassificacaoTurma(
    turmaId: string,
    nivelEnsino: string,
    classe: string,
    disciplinasObrigatorias: string[]
): Promise<AlunoComClassificacao[]> {
    // Load students
    const { data: alunos, error: alunosError } = await supabase
        .from('alunos')
        .select('*')
        .eq('turma_id', turmaId)
        .eq('ativo', true)
        .order('nome_completo')

    if (alunosError) throw alunosError

    // Load disciplines
    const { data: disciplinas, error: discError } = await supabase
        .from('disciplinas')
        .select('id, nome')
        .eq('turma_id', turmaId)

    if (discError) throw discError

    // Load components (MF or MFD)
    const { data: componentes, error: compError } = await supabase
        .from('componentes_avaliacao')
        .select('id, disciplina_id, codigo_componente')
        .eq('turma_id', turmaId)
        .in('codigo_componente', ['MF', 'MFD'])

    if (compError) throw compError

    // Map component to discipline
    const componenteDisciplinaMap = new Map<string, { disciplinaId: string; disciplinaNome: string }>()
    componentes?.forEach(comp => {
        const disc = disciplinas?.find(d => d.id === comp.disciplina_id)
        if (disc) {
            componenteDisciplinaMap.set(comp.id, { disciplinaId: disc.id, disciplinaNome: disc.nome })
        }
    })

    // Load grades for these components
    const componenteIds = componentes?.map(c => c.id) || []
    const { data: notas, error: notasError } = await supabase
        .from('notas')
        .select('aluno_id, componente_id, valor')
        .eq('turma_id', turmaId)
        .in('componente_id', componenteIds)

    if (notasError) throw notasError

    // Calculate for each student
    const results: AlunoComClassificacao[] = []

    for (const aluno of alunos || []) {
        const alunoNotas = notas?.filter(n => n.aluno_id === aluno.id) || []

        // Build discipline grades
        const disciplinaGrades: DisciplinaGrade[] = []
        const notasFinais: number[] = []

        alunoNotas.forEach(nota => {
            const discInfo = componenteDisciplinaMap.get(nota.componente_id)
            if (discInfo) {
                disciplinaGrades.push({
                    id: discInfo.disciplinaId,
                    nome: discInfo.disciplinaNome,
                    nota: nota.valor
                })
                notasFinais.push(nota.valor)
            }
        })

        // Calculate classification
        const classification = classifyStudent(
            disciplinaGrades,
            nivelEnsino,
            classe,
            disciplinasObrigatorias,
            aluno.frequencia_anual
        )

        // Calculate average
        const mediaGeral = notasFinais.length > 0
            ? Math.round((notasFinais.reduce((a, b) => a + b, 0) / notasFinais.length) * 100) / 100
            : 0

        results.push({
            aluno,
            disciplinaGrades,
            classification,
            mediaGeral
        })
    }

    return results
}
