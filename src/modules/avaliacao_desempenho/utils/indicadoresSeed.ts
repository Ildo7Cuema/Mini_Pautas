/**
 * Labels e períodos alinhados ao DP 28/22 (Art. 13.º, 17.º, 18.º)
 */

import type { InstrumentoCodigo, PeriodoAvaliacao, EstadoAvaliacao, TipoPeriodoCiclo } from '../types'

export const PERIODO_LABELS: Record<PeriodoAvaliacao, string> = {
    TRIM1: '1.º Trimestre',
    TRIM2: '2.º Trimestre',
    TRIM3: '3.º Trimestre',
    ANUAL: 'Anual',
}

export const ESTADO_AVALIACAO_LABELS: Record<EstadoAvaliacao, string> = {
    RASCUNHO: 'Rascunho',
    EM_AVALIACAO: 'Em avaliação',
    DIVULGADA: 'Divulgada',
    ASSINADA: 'Assinada',
    CONCLUIDA: 'Concluída',
}

export const TIPO_PERIODO_LABELS: Record<TipoPeriodoCiclo, string> = {
    ANO_LECTIVO: 'Ano lectivo (docentes)',
    ANO_CIVIL: 'Ano civil (técnico/admin)',
}

export const INSTRUMENTO_LABELS: Record<InstrumentoCodigo, string> = {
    FICHA_DOCENTE: 'Ficha docente (Anexos II/III)',
    FICHA_TECNICO_ADMIN: 'Ficha técnico/admin (Anexo IV)',
}

/** Periodos disponíveis por tipo de ciclo (Art. 13.º + Art. 17.º fichas trimestrais/anuais). */
export function periodosParaCiclo(tipo: TipoPeriodoCiclo): PeriodoAvaliacao[] {
    if (tipo === 'ANO_LECTIVO') {
        return ['TRIM1', 'TRIM2', 'TRIM3', 'ANUAL']
    }
    // Ano civil: trimestral + anual
    return ['TRIM1', 'TRIM2', 'TRIM3', 'ANUAL']
}

export function instrumentoParaAvaliado(tipo: 'PROFESSOR' | 'FUNCIONARIO'): InstrumentoCodigo {
    return tipo === 'PROFESSOR' ? 'FICHA_DOCENTE' : 'FICHA_TECNICO_ADMIN'
}
