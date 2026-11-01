import { supabase } from '../../../lib/supabaseClient'
import {
    CensoEscolaPerfil,
    CensoGeracaoResultado,
    CensoInfraestrutura,
    EstadoQuestionarioCenso,
    ModalidadeCensoCodigo,
} from '../types'

export async function loadCensoInfraestrutura(
    escolaId: string,
    anoLectivo: string,
    modalidade: ModalidadeCensoCodigo
): Promise<CensoInfraestrutura | null> {
    const { data, error } = await supabase
        .from('censo_infraestrutura')
        .select('*')
        .eq('escola_id', escolaId)
        .eq('ano_lectivo', anoLectivo)
        .eq('modalidade_codigo', modalidade)
        .maybeSingle()

    if (error) {
        if (error.message?.includes('censo_infraestrutura') || error.code === '42P01') return null
        throw error
    }
    return data as CensoInfraestrutura | null
}

export async function saveCensoInfraestrutura(infra: CensoInfraestrutura): Promise<CensoInfraestrutura> {
    const { data, error } = await supabase
        .from('censo_infraestrutura')
        .upsert(
            {
                ...infra,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'escola_id,ano_lectivo,modalidade_codigo' }
        )
        .select('*')
        .single()

    if (error) throw error
    return data as CensoInfraestrutura
}

export async function loadCensoEscolaPerfil(escolaId: string): Promise<CensoEscolaPerfil | null> {
    const { data, error } = await supabase
        .from('censo_escola_perfil')
        .select('*')
        .eq('escola_id', escolaId)
        .maybeSingle()

    if (error) {
        if (error.message?.includes('censo_escola_perfil') || error.code === '42P01') return null
        throw error
    }
    return data as CensoEscolaPerfil | null
}

export async function saveCensoEscolaPerfil(perfil: CensoEscolaPerfil): Promise<CensoEscolaPerfil> {
    const { data, error } = await supabase
        .from('censo_escola_perfil')
        .upsert(
            { ...perfil, updated_at: new Date().toISOString() },
            { onConflict: 'escola_id' }
        )
        .select('*')
        .single()

    if (error) throw error
    return data as CensoEscolaPerfil
}

export async function saveCensoQuestionario(params: {
    escolaId: string
    anoLectivo: string
    modalidade: ModalidadeCensoCodigo
    dataReferenciaIdade: string
    resultado: CensoGeracaoResultado
    estado?: EstadoQuestionarioCenso
    userId?: string | null
}): Promise<string> {
    const { data, error } = await supabase
        .from('censo_questionarios')
        .insert({
            escola_id: params.escolaId,
            ano_lectivo: params.anoLectivo,
            modalidade_codigo: params.modalidade,
            data_referencia_idade: params.dataReferenciaIdade,
            estado: params.estado || 'gerado',
            payload: params.resultado.payload,
            lacunas: params.resultado.lacunas,
            gerado_por: params.userId || null,
            gerado_em: new Date().toISOString(),
        })
        .select('id')
        .single()

    if (error) throw error
    return data.id
}

export function emptyInfraestrutura(
    escolaId: string,
    anoLectivo: string,
    modalidade: ModalidadeCensoCodigo
): CensoInfraestrutura {
    return {
        escola_id: escolaId,
        ano_lectivo: anoLectivo,
        modalidade_codigo: modalidade,
        mes_inicio: 2,
        mes_termino: 12,
        total_salas: 0,
        salas_proprias: 0,
        salas_emprestadas: 0,
        salas_arrendadas: 0,
        salas_proprias_bom_estado: 0,
        total_assentos: 0,
        assentos_bom_estado: 0,
        assentos_acessiveis: 0,
        total_mesas: 0,
        mesas_bom_estado: 0,
        mesas_acessiveis: 0,
        total_quadros: 0,
        quadros_bom_estado: 0,
    }
}
