import { supabase } from '../../../lib/supabaseClient'
import {
    CensoDadosComplementares,
    CensoPraeerEtapa,
    CensoPraeerTurno,
    ModalidadeCensoCodigo,
} from '../types'

export function chaveComplementares(anoLectivo: string, modalidade: ModalidadeCensoCodigo): string {
    return `${anoLectivo.trim()}|${modalidade}`
}

export function chaveManual(grupo: string, beneficiario: string, classe: string): string {
    return `${grupo}|${beneficiario}|${classe}`
}

function emptyTurno(): CensoPraeerTurno {
    return { matriculas: 0, turmas: 0, turmas_ar_livre: 0 }
}

export function emptyPraeerEtapa(): CensoPraeerEtapa {
    return { manhã: emptyTurno(), tarde: emptyTurno() }
}

export function emptyDadosComplementares(): CensoDadosComplementares {
    return {
        vagas_1a_classe: null,
        manuais: {},
        turmas_ar_livre: {},
        praeer: {
            '1': emptyPraeerEtapa(),
            '2': emptyPraeerEtapa(),
            '3': emptyPraeerEtapa(),
        },
    }
}

function lerCensoConfig(configuracoes: unknown): Record<string, unknown> {
    const cfg = (configuracoes && typeof configuracoes === 'object' ? configuracoes : {}) as Record<string, unknown>
    const censo = cfg.censo
    return censo && typeof censo === 'object' ? (censo as Record<string, unknown>) : {}
}

export function lerDadosComplementares(
    configuracoes: unknown,
    anoLectivo: string,
    modalidade: ModalidadeCensoCodigo
): CensoDadosComplementares {
    const censo = lerCensoConfig(configuracoes)
    const mapa = censo.complementares
    const raw =
        mapa && typeof mapa === 'object'
            ? (mapa as Record<string, CensoDadosComplementares>)[chaveComplementares(anoLectivo, modalidade)]
            : undefined
    const base = emptyDadosComplementares()
    if (!raw || typeof raw !== 'object') return base
    return {
        vagas_1a_classe: typeof raw.vagas_1a_classe === 'number' ? raw.vagas_1a_classe : null,
        manuais: raw.manuais && typeof raw.manuais === 'object' ? raw.manuais : {},
        turmas_ar_livre: raw.turmas_ar_livre && typeof raw.turmas_ar_livre === 'object' ? raw.turmas_ar_livre : {},
        praeer: {
            '1': { ...emptyPraeerEtapa(), ...(raw.praeer?.['1'] || {}) },
            '2': { ...emptyPraeerEtapa(), ...(raw.praeer?.['2'] || {}) },
            '3': { ...emptyPraeerEtapa(), ...(raw.praeer?.['3'] || {}) },
        },
    }
}

export async function guardarDadosComplementares(params: {
    escolaId: string
    configuracoesActuais: unknown
    anoLectivo: string
    modalidade: ModalidadeCensoCodigo
    dados: CensoDadosComplementares
}): Promise<Record<string, unknown>> {
    const base = (
        params.configuracoesActuais && typeof params.configuracoesActuais === 'object'
            ? params.configuracoesActuais
            : {}
    ) as Record<string, unknown>
    const censoAtual = lerCensoConfig(base)
    const mapa = {
        ...((censoAtual.complementares && typeof censoAtual.complementares === 'object'
            ? censoAtual.complementares
            : {}) as Record<string, unknown>),
        [chaveComplementares(params.anoLectivo, params.modalidade)]: params.dados,
    }
    const novaConfig: Record<string, unknown> = {
        ...base,
        censo: {
            ...censoAtual,
            complementares: mapa,
        },
    }
    const { data, error } = await supabase
        .from('escolas')
        .update({ configuracoes: novaConfig })
        .eq('id', params.escolaId)
        .select('id')
    if (error) throw error
    if (!data || data.length === 0) {
        throw new Error('Sem permissão para guardar os dados complementares do censo.')
    }
    return novaConfig
}
