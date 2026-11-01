import { MODALIDADES_MVP } from '../catalog'
import { ModalidadeCensoCodigo, ModalidadeCensoDef } from '../types'

/** Tipo de estabelecimento relevante para o Censo (MVP). */
export type TipoEscolaCenso = 'primario' | 'secundario' | 'complexo' | 'desconhecido'

export const LABELS_TIPO_ESCOLA: Record<TipoEscolaCenso, string> = {
    primario: 'Ensino Primário',
    secundario: 'Ensino Secundário',
    complexo: 'Complexo Escolar',
    desconhecido: 'Não identificado',
}

const MODALIDADES_POR_TIPO: Record<Exclude<TipoEscolaCenso, 'desconhecido'>, ModalidadeCensoCodigo[]> = {
    primario: ['ensino_primario_geral'],
    secundario: ['i_ciclo_secundario_geral', 'ii_ciclo_secundario_geral'],
    complexo: ['ensino_primario_geral', 'i_ciclo_secundario_geral', 'ii_ciclo_secundario_geral'],
}

function normalizeToken(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
}

function tipoFromConfigValue(raw: unknown): TipoEscolaCenso | null {
    if (raw == null) return null
    const t = normalizeToken(String(raw))
    if (!t) return null
    if (
        t.includes('complexo') ||
        t === 'misto' ||
        t.includes('primario_secundario') ||
        t.includes('secundario_primario')
    ) {
        return 'complexo'
    }
    if (t.includes('primar') || t === 'ep' || t === 'ensino_primario') return 'primario'
    if (t.includes('secund') || t === 'es' || t === 'ensino_secundario') return 'secundario'
    return null
}

function hasNivel(niveis: string[], needle: 'primario' | 'secundario'): boolean {
    return niveis.some(n => {
        const x = normalizeToken(n)
        return needle === 'primario' ? x.includes('primar') : x.includes('secund')
    })
}

/**
 * Resolve o tipo da escola a partir do cadastro (`configuracoes`) e/ou
 * dos níveis das turmas existentes.
 */
export function resolveTipoEscolaCenso(input: {
    configuracoes?: Record<string, unknown> | null
    niveisTurmas?: string[] | null
}): { tipo: TipoEscolaCenso; fonte: string } {
    const cfg = input.configuracoes || {}
    const fromCfg =
        tipoFromConfigValue(cfg.tipo_escola) ||
        tipoFromConfigValue(cfg.tipo_escola_seed) ||
        tipoFromConfigValue(cfg.tipo_estabelecimento) ||
        tipoFromConfigValue(cfg.modalidade_ensino) ||
        tipoFromConfigValue(cfg.nivel_ensino)

    if (fromCfg) {
        return { tipo: fromCfg, fonte: 'cadastro da escola' }
    }

    const niveis = (input.niveisTurmas || []).filter(Boolean)
    const temPrim = hasNivel(niveis, 'primario')
    const temSec = hasNivel(niveis, 'secundario')

    if (temPrim && temSec) return { tipo: 'complexo', fonte: 'turmas (primário + secundário)' }
    if (temPrim) return { tipo: 'primario', fonte: 'turmas (ensino primário)' }
    if (temSec) return { tipo: 'secundario', fonte: 'turmas (ensino secundário)' }

    return { tipo: 'desconhecido', fonte: 'sem indicação no cadastro nem nas turmas' }
}

export function modalidadesParaTipoEscola(tipo: TipoEscolaCenso): ModalidadeCensoDef[] {
    if (tipo === 'desconhecido') {
        // Sem perfil: mostrar todas, mas a UI deve avisar
        return [...MODALIDADES_MVP]
    }
    const codes = new Set(MODALIDADES_POR_TIPO[tipo])
    return MODALIDADES_MVP.filter(m => codes.has(m.codigo))
}

export function defaultModalidadeForTipo(tipo: TipoEscolaCenso): ModalidadeCensoCodigo {
    const list = modalidadesParaTipoEscola(tipo)
    return list[0]?.codigo || 'ensino_primario_geral'
}
