/**
 * Aplica o catálogo normativo MED às tabelas disciplinas_template /
 * componentes_template / componentes_catalogo da escola.
 *
 * Comportamento:
 * - Idempotente: não duplica (escola_id, classe, codigo_disciplina)
 * - Não altera templates nem componentes já existentes (preserva edições do utilizador)
 * - Preenche apenas o que falta
 * - Insere em lote para performance
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { EscolaNatureza } from './angolaGradeScale'
import { isPrivateInstitution } from './angolaGradeScale'
import {
    getMedCurriculumForTipo,
    MED_COMPONENTES_AVALIACAO,
    MED_CURRICULUM_SOURCE_LABEL,
} from './medCurriculumCatalog'
import type { TipoEscolaCenso } from '../modules/censo_escolar/utils/escolaModalidade'

export type ApplyMedCurriculumMode = 'fill_missing' | 'only_if_empty'

export interface ApplyMedCurriculumResult {
    createdDisciplinas: number
    skippedDisciplinas: number
    createdComponentes: number
    catalogSeeded: boolean
    message: string
}

function scaleForClasse(
    classe: string,
    natureza?: EscolaNatureza | null
): { escala_minima: number; escala_maxima: number } {
    if (isPrivateInstitution(natureza)) {
        return { escala_minima: 0, escala_maxima: 20 }
    }
    const num = parseInt(String(classe).match(/(\d+)/)?.[1] || '0', 10)
    if (num >= 1 && num <= 6) return { escala_minima: 1, escala_maxima: 10 }
    return { escala_minima: 0, escala_maxima: 20 }
}

async function ensureComponentesCatalogo(
    supabase: SupabaseClient,
    escolaId: string,
    natureza?: EscolaNatureza | null
): Promise<boolean> {
    const { data: existing, error } = await supabase
        .from('componentes_catalogo')
        .select('codigo_componente')
        .eq('escola_id', escolaId)

    if (error) throw error

    const existingCodes = new Set(
        (existing || []).map((r) => String(r.codigo_componente).toUpperCase())
    )

    const defaultScale = isPrivateInstitution(natureza)
        ? { escala_minima: 0, escala_maxima: 20 }
        : { escala_minima: 0, escala_maxima: 20 }

    const toInsert = MED_COMPONENTES_AVALIACAO.filter(
        (c) => !existingCodes.has(c.codigo_componente.toUpperCase())
    ).map((c) => ({
        escola_id: escolaId,
        codigo_componente: c.codigo_componente,
        nome: c.nome,
        peso_padrao: c.peso_percentual,
        escala_minima: defaultScale.escala_minima,
        escala_maxima: defaultScale.escala_maxima,
        is_calculated: c.is_calculated,
        formula_expression: c.formula_expression || null,
        depends_on_codes: c.depends_on_codes || [],
        tipo_calculo: c.tipo_calculo,
        descricao: MED_CURRICULUM_SOURCE_LABEL,
        ativo: true,
    }))

    if (toInsert.length === 0) return false

    const { error: insertError } = await supabase.from('componentes_catalogo').insert(toInsert)
    if (insertError) throw insertError
    return true
}

async function linkDependsOnForTemplates(
    supabase: SupabaseClient,
    disciplinaTemplateIds: string[]
): Promise<void> {
    if (disciplinaTemplateIds.length === 0) return

    const { data: comps, error } = await supabase
        .from('componentes_template')
        .select(
            'id, disciplina_template_id, codigo_componente, trimestre, formula_expression, is_calculated, tipo_calculo, depends_on_components'
        )
        .in('disciplina_template_id', disciplinaTemplateIds)

    if (error) throw error
    if (!comps?.length) return

    const byDisc = new Map<string, typeof comps>()
    for (const c of comps) {
        const key = c.disciplina_template_id as string
        if (!byDisc.has(key)) byDisc.set(key, [])
        byDisc.get(key)!.push(c)
    }

    const updates: { id: string; depends_on_components: string[] }[] = []

    for (const group of byDisc.values()) {
        for (const comp of group) {
            if (!comp.is_calculated || !comp.formula_expression) continue

            const formula = String(comp.formula_expression).toUpperCase()
            const codes = [...new Set(formula.match(/[A-Z][A-Z0-9_]*/g) || [])]
            const depIds = new Set<string>()

            for (const raw of codes) {
                const alias = /^T([1-3])$/.exec(raw)
                const suffixed = /^([A-Z][A-Z0-9_]*?)([1-3])$/.exec(raw)
                let base = raw
                let trim: number | null = null
                if (alias) {
                    base = 'MT'
                    trim = Number(alias[1])
                } else if (suffixed) {
                    base = suffixed[1]
                    trim = Number(suffixed[2])
                }

                for (const other of group) {
                    if (other.id === comp.id) continue
                    if (String(other.codigo_componente).toUpperCase() !== base) continue
                    const otherT = Number(other.trimestre) || null
                    if (trim != null) {
                        if (otherT === trim) depIds.add(other.id)
                    } else if (comp.tipo_calculo === 'anual') {
                        depIds.add(other.id)
                    } else if (otherT === (Number(comp.trimestre) || null)) {
                        depIds.add(other.id)
                    }
                }
            }

            const next = [...depIds]
            if (next.length === 0) continue

            const prev = Array.isArray(comp.depends_on_components) ? comp.depends_on_components : []
            const same = next.length === prev.length && next.every((id) => prev.includes(id))
            if (!same) {
                updates.push({ id: comp.id, depends_on_components: next })
            }
        }
    }

    // Updates em paralelo limitado (evita demasiados round-trips sequenciais)
    const chunkSize = 20
    for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize)
        await Promise.all(
            chunk.map(async (row) => {
                const { error: uErr } = await supabase
                    .from('componentes_template')
                    .update({ depends_on_components: row.depends_on_components })
                    .eq('id', row.id)
                if (uErr) throw uErr
            })
        )
    }
}

export async function applyMedCurriculumTemplates(opts: {
    supabase: SupabaseClient
    escolaId: string
    tipoEscola: Exclude<TipoEscolaCenso, 'desconhecido'>
    natureza?: EscolaNatureza | null
    mode?: ApplyMedCurriculumMode
}): Promise<ApplyMedCurriculumResult> {
    const { supabase, escolaId, tipoEscola, natureza = null, mode = 'fill_missing' } = opts

    const { count, error: countError } = await supabase
        .from('disciplinas_template')
        .select('id', { count: 'exact', head: true })
        .eq('escola_id', escolaId)

    if (countError) throw countError

    if (mode === 'only_if_empty' && (count || 0) > 0) {
        return {
            createdDisciplinas: 0,
            skippedDisciplinas: count || 0,
            createdComponentes: 0,
            catalogSeeded: false,
            message: 'A escola já tem templates. Nenhuma alteração foi feita.',
        }
    }

    const catalogSeeded = await ensureComponentesCatalogo(supabase, escolaId, natureza)

    const { data: existingRows, error: existingError } = await supabase
        .from('disciplinas_template')
        .select('id, classe, codigo_disciplina')
        .eq('escola_id', escolaId)

    if (existingError) throw existingError

    const existingKeys = new Set(
        (existingRows || []).map(
            (r) => `${r.classe}::${String(r.codigo_disciplina).toUpperCase()}`
        )
    )

    const curriculum = getMedCurriculumForTipo(tipoEscola)
    const disciplinasToInsert: Array<{
        escola_id: string
        classe: string
        nome: string
        codigo_disciplina: string
        carga_horaria: number
        ordem: number
        is_obrigatoria: boolean
        descricao: string
    }> = []
    let skippedDisciplinas = 0

    for (const bloco of curriculum) {
        for (const disc of bloco.disciplinas) {
            const key = `${bloco.classe}::${disc.codigo_disciplina.toUpperCase()}`
            if (existingKeys.has(key)) {
                skippedDisciplinas += 1
                continue
            }
            existingKeys.add(key)
            disciplinasToInsert.push({
                escola_id: escolaId,
                classe: bloco.classe,
                nome: disc.nome,
                codigo_disciplina: disc.codigo_disciplina,
                carga_horaria: disc.carga_horaria,
                ordem: disc.ordem,
                is_obrigatoria: disc.is_obrigatoria,
                descricao: MED_CURRICULUM_SOURCE_LABEL,
            })
        }
    }

    if (disciplinasToInsert.length === 0) {
        return {
            createdDisciplinas: 0,
            skippedDisciplinas,
            createdComponentes: 0,
            catalogSeeded,
            message: 'Todas as disciplinas normativas já estavam cadastradas. Nenhuma alteração foi feita.',
        }
    }

    const { data: insertedDiscs, error: discError } = await supabase
        .from('disciplinas_template')
        .insert(disciplinasToInsert)
        .select('id, classe, codigo_disciplina')

    if (discError) throw discError

    const createdIds = (insertedDiscs || []).map((d) => d.id as string)
    const componenteRows: Array<Record<string, unknown>> = []

    for (const disc of insertedDiscs || []) {
        const scale = scaleForClasse(disc.classe, natureza)
        for (const c of MED_COMPONENTES_AVALIACAO) {
            for (const trimestre of c.trimestres) {
                componenteRows.push({
                    disciplina_template_id: disc.id,
                    nome: c.nome,
                    codigo_componente: c.codigo_componente,
                    peso_percentual: c.peso_percentual,
                    escala_minima: scale.escala_minima,
                    escala_maxima: scale.escala_maxima,
                    obrigatorio: true,
                    ordem: c.ordem,
                    trimestre,
                    is_calculated: c.is_calculated,
                    formula_expression: c.is_calculated ? c.formula_expression || null : null,
                    depends_on_components: [],
                    tipo_calculo: c.tipo_calculo,
                    descricao:
                        c.tipo_calculo === 'anual'
                            ? `${c.codigo_componente} · Anual · ${MED_CURRICULUM_SOURCE_LABEL}`
                            : `${c.codigo_componente} · ${trimestre}º Trimestre · ${MED_CURRICULUM_SOURCE_LABEL}`,
                })
            }
        }
    }

    // Inserir componentes em lotes (PostgREST tem limite de payload)
    const batchSize = 80
    for (let i = 0; i < componenteRows.length; i += batchSize) {
        const batch = componenteRows.slice(i, i + batchSize)
        const { error: compError } = await supabase.from('componentes_template').insert(batch)
        if (compError) throw compError
    }

    await linkDependsOnForTemplates(supabase, createdIds)

    const createdDisciplinas = createdIds.length
    const createdComponentes = componenteRows.length

    return {
        createdDisciplinas,
        skippedDisciplinas,
        createdComponentes,
        catalogSeeded,
        message: `Currículo MED aplicado: ${createdDisciplinas} disciplina(s) e ${createdComponentes} componente(s) pré-cadastrados. Pode editar, apagar ou adicionar livremente.`,
    }
}
