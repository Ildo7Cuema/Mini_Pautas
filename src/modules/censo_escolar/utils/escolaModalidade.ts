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

/** Classes oficiais por subsistema (Templates / mapas). */
export const CLASSES_ENSINO_PRIMARIO = [
    '1ª Classe',
    '2ª Classe',
    '3ª Classe',
    '4ª Classe',
    '5ª Classe',
    '6ª Classe',
] as const

export const CLASSES_ENSINO_SECUNDARIO_I = ['7ª Classe', '8ª Classe', '9ª Classe'] as const

export const CLASSES_ENSINO_SECUNDARIO_II = [
    '10ª Classe',
    '11ª Classe',
    '12ª Classe',
    '13ª Classe',
] as const

export const TIPO_ESCOLA_OPTIONS: Array<{ value: Exclude<TipoEscolaCenso, 'desconhecido'>; label: string }> = [
    { value: 'primario', label: 'Ensino Primário' },
    { value: 'secundario', label: 'Ensino Secundário' },
    { value: 'complexo', label: 'Complexo Escolar (Primário + Secundário)' },
]

/**
 * Quais grupos de classes mostrar nos Templates, conforme o tipo da escola.
 * `desconhecido` → todos (até a escola declarar o tipo).
 */
export function templateClassGroupsForTipo(tipo: TipoEscolaCenso): Array<{
    id: 'primario' | 'secundario_i' | 'secundario_ii'
    title: string
    classes: readonly string[]
}> {
    const primario = {
        id: 'primario' as const,
        title: 'Ensino Primário',
        classes: CLASSES_ENSINO_PRIMARIO,
    }
    const secI = {
        id: 'secundario_i' as const,
        title: 'Ensino Secundário - I Ciclo',
        classes: CLASSES_ENSINO_SECUNDARIO_I,
    }
    const secII = {
        id: 'secundario_ii' as const,
        title: 'Ensino Secundário - II Ciclo',
        classes: CLASSES_ENSINO_SECUNDARIO_II,
    }

    if (tipo === 'primario') return [primario]
    if (tipo === 'secundario') return [secI, secII]
    // complexo ou desconhecido: todos os grupos
    return [primario, secI, secII]
}

export function parseTipoEscolaFromConfig(
    configuracoes?: Record<string, unknown> | null
): Exclude<TipoEscolaCenso, 'desconhecido'> | null {
    const resolved = resolveTipoEscolaCenso({ configuracoes, niveisTurmas: [] })
    if (resolved.tipo === 'desconhecido') return null
    return resolved.tipo
}
