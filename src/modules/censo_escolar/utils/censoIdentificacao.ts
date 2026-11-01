import { supabase } from '../../../lib/supabaseClient'
import { CensoIdentificacaoMed, ModalidadeCensoCodigo } from '../types'

/**
 * Identificação do Censo (código da escola dado pela Direcção Municipal e ID do questionário).
 * Guardada em `escolas.configuracoes.censo`:
 *   {
 *     codigo_escola_med: "…",
 *     ids_questionario: { "2025/2026|ensino_primario_geral": "…" }
 *   }
 */

interface CensoConfig {
    codigo_escola_med?: string
    ids_questionario?: Record<string, string>
}

function chaveQuestionario(anoLectivo: string, modalidade: ModalidadeCensoCodigo): string {
    return `${anoLectivo.trim()}|${modalidade}`
}

function lerCensoConfig(configuracoes: unknown): CensoConfig {
    const cfg = (configuracoes && typeof configuracoes === 'object' ? configuracoes : {}) as Record<string, unknown>
    const censo = cfg.censo
    return censo && typeof censo === 'object' ? (censo as CensoConfig) : {}
}

export function lerIdentificacaoCenso(
    configuracoes: unknown,
    anoLectivo: string,
    modalidade: ModalidadeCensoCodigo
): CensoIdentificacaoMed {
    const censo = lerCensoConfig(configuracoes)
    return {
        codigo_escola_med: censo.codigo_escola_med || '',
        id_questionario: censo.ids_questionario?.[chaveQuestionario(anoLectivo, modalidade)] || '',
    }
}

export async function guardarIdentificacaoCenso(params: {
    escolaId: string
    configuracoesActuais: unknown
    anoLectivo: string
    modalidade: ModalidadeCensoCodigo
    identificacao: CensoIdentificacaoMed
}): Promise<Record<string, unknown>> {
    const base = (
        params.configuracoesActuais && typeof params.configuracoesActuais === 'object'
            ? params.configuracoesActuais
            : {}
    ) as Record<string, unknown>
    const censoAtual = lerCensoConfig(base)
    const chave = chaveQuestionario(params.anoLectivo, params.modalidade)
    const ids = { ...(censoAtual.ids_questionario || {}) }
    const idNovo = params.identificacao.id_questionario.trim()
    if (idNovo) ids[chave] = idNovo
    else delete ids[chave]

    const novaConfig: Record<string, unknown> = {
        ...base,
        censo: {
            ...censoAtual,
            codigo_escola_med: params.identificacao.codigo_escola_med.trim(),
            ids_questionario: ids,
        },
    }

    const { data, error } = await supabase
        .from('escolas')
        .update({ configuracoes: novaConfig })
        .eq('id', params.escolaId)
        .select('id')
    if (error) throw error
    if (!data || data.length === 0) {
        throw new Error('Sem permissão para guardar a identificação da escola.')
    }
    return novaConfig
}
