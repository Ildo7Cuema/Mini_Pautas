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
    vagas_classe_ingresso?: Record<string, number>
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
    const chave = chaveQuestionario(anoLectivo, modalidade)
    const vagas = censo.vagas_classe_ingresso?.[chave]
    return {
        codigo_escola_med: censo.codigo_escola_med || '',
        id_questionario: censo.ids_questionario?.[chave] || '',
        vagas_classe_ingresso: typeof vagas === 'number' ? vagas : null,
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

    const vagasMap = { ...(censoAtual.vagas_classe_ingresso || {}) }
    const vagas = params.identificacao.vagas_classe_ingresso
    if (typeof vagas === 'number' && vagas >= 0) vagasMap[chave] = vagas
    else delete vagasMap[chave]

    const novaConfig: Record<string, unknown> = {
        ...base,
        censo: {
            ...censoAtual,
            codigo_escola_med: params.identificacao.codigo_escola_med.trim(),
            ids_questionario: ids,
            vagas_classe_ingresso: vagasMap,
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
