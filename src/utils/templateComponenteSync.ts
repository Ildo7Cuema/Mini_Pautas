/**
 * Keep Templates component changes aligned with Mini-Pauta / Pauta / Mapa
 * across class variants of the same education subsystem
 * (ex.: "10ª Classe" ↔ "10ª Classe Ciências").
 *
 * Primário and secundário stay isolated because classe families never overlap.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DisciplinaTemplate } from '../types'

/** "12ª Classe Ciências" and "12ª Classe Humanidades" share the grade "12ª Classe". */
export function classeGradeKey(classe: string | null | undefined): string | null {
    const match = (classe || '').trim().match(/^(\d+ª\s+Classe)/i)
    return match ? match[1].toLowerCase() : null
}

export function turmaClasseMatchesTemplate(
    turmaClasse: string | null | undefined,
    templateClasse: string | null | undefined,
): boolean {
    const turma = (turmaClasse || '').trim()
    const tpl = (templateClasse || '').trim()
    if (!turma || !tpl) return false
    if (turma === tpl || turma.startsWith(`${tpl} `) || tpl.startsWith(`${turma} `)) return true
    const turmaGrade = classeGradeKey(turma)
    const templateGrade = classeGradeKey(tpl)
    return Boolean(turmaGrade && templateGrade && turmaGrade === templateGrade)
}

export function relatedClasseTemplates(
    templates: Array<{ id: string; classe?: string | null }>,
    selected: { id: string; classe?: string | null },
): string[] {
    return templates
        .filter(
            (t) =>
                t.id === selected.id ||
                turmaClasseMatchesTemplate(t.classe, selected.classe) ||
                turmaClasseMatchesTemplate(selected.classe, t.classe),
        )
        .map((t) => t.id)
}

/** Next display position within a trimestre (ordem is per-trimestre, not global). */
export function nextOrdemForTrimestre(
    components: Array<{ ordem?: number | null; trimestre?: number | null }>,
    trimestre: number | null | undefined,
): number {
    const target =
        trimestre === null || trimestre === undefined ? null : Number(trimestre)
    const sameTrimestre = components.filter((c) => {
        const t =
            c.trimestre === null || c.trimestre === undefined
                ? null
                : Number(c.trimestre)
        return t === target
    })
    if (sameTrimestre.length === 0) return 1
    return Math.max(0, ...sameTrimestre.map((c) => Number(c.ordem) || 0)) + 1
}

/**
 * Match a component slot within the same trimestre by código only.
 * Never match by ordem alone — shared ordem (e.g. all defaulting to 1)
 * would corrupt sibling components across the mapa / mini-pauta.
 */
export function matchesComponenteSlot(
    c: {
        codigo_componente?: string | null
        ordem?: number | null
        trimestre?: number | null
    },
    opts: {
        oldCodigo: string
        newCodigo?: string | null
        oldOrdem: number
        oldTrimestre: number | null | undefined
    },
): boolean {
    const sameTrimestre =
        opts.oldTrimestre === null || opts.oldTrimestre === undefined
            ? c.trimestre === null || c.trimestre === undefined
            : Number(c.trimestre) === Number(opts.oldTrimestre)
    if (!sameTrimestre) return false
    if (c.codigo_componente === opts.oldCodigo) return true
    if (opts.newCodigo && opts.newCodigo !== opts.oldCodigo && c.codigo_componente === opts.newCodigo) {
        return true
    }
    return false
}

export async function findRelatedTemplateIds(
    supabase: SupabaseClient,
    escolaId: string,
    template: Pick<DisciplinaTemplate, 'id' | 'nome' | 'classe'>,
): Promise<string[]> {
    const { data } = await supabase
        .from('disciplinas_template')
        .select('id, classe')
        .eq('escola_id', escolaId)
        .eq('nome', template.nome)

    const ids = relatedClasseTemplates(data || [], template)
    return ids.length ? ids : [template.id]
}

export async function countLinkedTurmas(
    supabase: SupabaseClient,
    templateIds: string[],
): Promise<number> {
    if (!templateIds.length) return 0
    const { data } = await supabase
        .from('turma_template_link')
        .select('turma_id')
        .in('disciplina_template_id', templateIds)
    return new Set((data || []).map((l) => l.turma_id).filter(Boolean)).size
}

async function fetchTemplateComponentsByTrimestre(
    supabase: SupabaseClient,
    siblingIds: string[],
    trimestre: number | null | undefined,
) {
    const base = supabase
        .from('componentes_template')
        .select('id, codigo_componente, ordem, trimestre, disciplina_template_id')
        .in('disciplina_template_id', siblingIds)

    if (trimestre === null || trimestre === undefined) {
        return base.is('trimestre', null)
    }
    return base.eq('trimestre', Number(trimestre))
}

async function fetchAvaliacaoByTrimestre(
    supabase: SupabaseClient,
    disciplinaIds: string[],
    trimestre: number | null | undefined,
) {
    const base = supabase
        .from('componentes_avaliacao')
        .select('id, codigo_componente, ordem, trimestre')
        .in('disciplina_id', disciplinaIds)

    if (trimestre === null || trimestre === undefined) {
        return base.is('trimestre', null)
    }
    return base.eq('trimestre', Number(trimestre))
}

/** Insert component into sibling class templates (DB trigger fills componentes_avaliacao). */
export async function fanOutNewComponenteToSiblings(
    supabase: SupabaseClient,
    opts: {
        escolaId: string
        template: DisciplinaTemplate
        payload: Record<string, unknown>
    },
): Promise<number> {
    const relatedIds = await findRelatedTemplateIds(supabase, opts.escolaId, opts.template)
    const siblingIds = relatedIds.filter((id) => id !== opts.template.id)
    if (siblingIds.length === 0) {
        return countLinkedTurmas(supabase, relatedIds)
    }

    const codigo = String(opts.payload.codigo_componente || '')
    const trimestre = opts.payload.trimestre as number | null | undefined
    const { data: existingRows } = await fetchTemplateComponentsByTrimestre(
        supabase,
        siblingIds,
        trimestre,
    )
    const already = new Set(
        (existingRows || [])
            .filter((c) => c.codigo_componente === codigo)
            .map((c) => c.disciplina_template_id),
    )
    const toInsert = siblingIds
        .filter((id) => !already.has(id))
        .map((id) => {
            const existing = (existingRows || []).filter((c) => c.disciplina_template_id === id)
            return {
                ...opts.payload,
                disciplina_template_id: id,
                // Avoid unique (template, trimestre, ordem) collisions when siblings differ
                ordem: nextOrdemForTrimestre(existing, trimestre),
            }
        })

    if (toInsert.length > 0) {
        const { error } = await supabase.from('componentes_template').insert(toInsert)
        if (error) console.warn('Falha ao propagar componente para templates irmãos:', error)
    }

    return countLinkedTurmas(supabase, relatedIds)
}

/** Propagate edit to sibling templates + componentes_avaliacao (mapas / mini-pauta / pauta). */
export async function fanOutEditComponenteToRelated(
    supabase: SupabaseClient,
    opts: {
        escolaId: string
        template: DisciplinaTemplate
        oldCodigo: string
        oldOrdem: number
        oldTrimestre: number | null | undefined
        payload: Record<string, unknown>
    },
): Promise<number> {
    const relatedIds = await findRelatedTemplateIds(supabase, opts.escolaId, opts.template)
    const siblingIds = relatedIds.filter((id) => id !== opts.template.id)
    const slotOpts = {
        oldCodigo: opts.oldCodigo,
        newCodigo: String(opts.payload.codigo_componente || ''),
        oldOrdem: opts.oldOrdem,
        oldTrimestre: opts.oldTrimestre,
    }

    if (siblingIds.length > 0) {
        const { data: siblingComps, error: siblingFetchError } = await fetchTemplateComponentsByTrimestre(
            supabase,
            siblingIds,
            opts.oldTrimestre,
        )
        if (siblingFetchError) {
            console.warn('Falha ao ler templates irmãos:', siblingFetchError)
        } else {
            const siblingTargetIds = (siblingComps || [])
                .filter((c) => matchesComponenteSlot(c, slotOpts))
                .map((c) => c.id)
            if (siblingTargetIds.length > 0) {
                const { error } = await supabase
                    .from('componentes_template')
                    .update(opts.payload)
                    .in('id', siblingTargetIds)
                if (error) console.warn('Falha ao sincronizar templates irmãos:', error)
            }

            // Sibling variants (Ciências/Humanidades) may lack the slot entirely
            // after a rename/add on the base class — create it so mini-pauta stays aligned.
            const newCodigo = String(opts.payload.codigo_componente || '')
            const newTrimestre = opts.payload.trimestre as number | null | undefined
            const covered = new Set<string>()
            for (const c of siblingComps || []) {
                if (matchesComponenteSlot(c, slotOpts) || c.codigo_componente === newCodigo) {
                    if (c.disciplina_template_id) covered.add(c.disciplina_template_id)
                }
            }
            const missingSiblingIds = siblingIds.filter((id) => !covered.has(id))
            if (missingSiblingIds.length > 0) {
                // Load full sibling trimester sets for automatic position
                const { data: allSiblingTrim } = await fetchTemplateComponentsByTrimestre(
                    supabase,
                    missingSiblingIds,
                    newTrimestre ?? opts.oldTrimestre,
                )
                const toInsert = missingSiblingIds.map((id) => {
                    const existing = (allSiblingTrim || []).filter(
                        (c) => c.disciplina_template_id === id,
                    )
                    return {
                        ...opts.payload,
                        disciplina_template_id: id,
                        ordem: nextOrdemForTrimestre(existing, newTrimestre ?? opts.oldTrimestre),
                    }
                })
                const { error } = await supabase.from('componentes_template').insert(toInsert)
                if (error) console.warn('Falha ao criar componente em templates irmãos:', error)
            }
        }
    }

    const { data: relatedLinks } = await supabase
        .from('turma_template_link')
        .select('disciplina_id, turma_id')
        .in('disciplina_template_id', relatedIds)

    const disciplinaIds = [
        ...new Set((relatedLinks || []).map((l) => l.disciplina_id).filter(Boolean)),
    ] as string[]
    const turmaIds = [...new Set((relatedLinks || []).map((l) => l.turma_id).filter(Boolean))]

    let syncedTurmas = 0
    if (disciplinaIds.length > 0) {
        const { data: avaliacaoComps, error: avaliacaoFetchError } = await fetchAvaliacaoByTrimestre(
            supabase,
            disciplinaIds,
            opts.oldTrimestre,
        )
        if (avaliacaoFetchError) {
            console.warn('Falha ao ler componentes_avaliacao:', avaliacaoFetchError)
        } else {
            const avaliacaoTargetIds = (avaliacaoComps || [])
                .filter((c) => matchesComponenteSlot(c, slotOpts))
                .map((c) => c.id)
            if (avaliacaoTargetIds.length > 0) {
                const rawFormula = opts.payload.formula_expression
                const safeFormula =
                    typeof rawFormula === 'string' && rawFormula.trim()
                        ? rawFormula.trim()
                        : null
                const wantsCalculated = Boolean(opts.payload.is_calculated)
                // Mirror check_calculated_has_formula on the DB
                const safeIsCalculated = wantsCalculated && Boolean(safeFormula)

                const { data: updatedRows, error } = await supabase
                    .from('componentes_avaliacao')
                    .update({
                        nome: opts.payload.nome,
                        codigo_componente: opts.payload.codigo_componente,
                        peso_percentual: opts.payload.peso_percentual,
                        escala_minima: opts.payload.escala_minima,
                        escala_maxima: opts.payload.escala_maxima,
                        obrigatorio: opts.payload.obrigatorio,
                        ordem: opts.payload.ordem,
                        descricao: opts.payload.descricao,
                        trimestre: opts.payload.trimestre,
                        is_calculated: safeIsCalculated,
                        formula_expression: safeFormula,
                        depends_on_components: opts.payload.depends_on_components,
                        tipo_calculo: opts.payload.tipo_calculo,
                    })
                    .in('id', avaliacaoTargetIds)
                    .select('id')
                if (error) console.warn('Falha ao sincronizar componentes_avaliacao:', error)
                else if (updatedRows?.length) syncedTurmas = turmaIds.length
            }
        }
    }

    await supabase
        .from('turma_template_link')
        .update({ sincronizado_em: new Date().toISOString() })
        .in('disciplina_template_id', relatedIds)

    return syncedTurmas || turmaIds.length
}

/** Delete matching component from sibling templates (DB trigger cleans mapas when safe). */
export async function fanOutDeleteComponenteToSiblings(
    supabase: SupabaseClient,
    opts: {
        escolaId: string
        template: DisciplinaTemplate
        codigo: string
        ordem: number
        trimestre: number | null | undefined
    },
): Promise<number> {
    const relatedIds = await findRelatedTemplateIds(supabase, opts.escolaId, opts.template)
    const siblingIds = relatedIds.filter((id) => id !== opts.template.id)
    const slotOpts = {
        oldCodigo: opts.codigo,
        newCodigo: opts.codigo,
        oldOrdem: opts.ordem,
        oldTrimestre: opts.trimestre,
    }

    if (siblingIds.length > 0) {
        const { data: siblingComps } = await fetchTemplateComponentsByTrimestre(
            supabase,
            siblingIds,
            opts.trimestre,
        )
        const ids = (siblingComps || [])
            .filter((c) => matchesComponenteSlot(c, slotOpts))
            .map((c) => c.id)
        if (ids.length > 0) {
            const { error } = await supabase.from('componentes_template').delete().in('id', ids)
            if (error) console.warn('Falha ao eliminar componente em templates irmãos:', error)
        }
    }

    const { data: relatedLinks } = await supabase
        .from('turma_template_link')
        .select('disciplina_id, turma_id')
        .in('disciplina_template_id', relatedIds)

    const disciplinaIds = [
        ...new Set((relatedLinks || []).map((l) => l.disciplina_id).filter(Boolean)),
    ] as string[]
    const turmaIds = [...new Set((relatedLinks || []).map((l) => l.turma_id).filter(Boolean))]

    if (disciplinaIds.length > 0) {
        const { data: avaliacaoComps } = await fetchAvaliacaoByTrimestre(
            supabase,
            disciplinaIds,
            opts.trimestre,
        )
        const targetIds = (avaliacaoComps || [])
            .filter((c) => matchesComponenteSlot(c, slotOpts))
            .map((c) => c.id)

        if (targetIds.length > 0) {
            const { error } = await supabase.from('componentes_avaliacao').delete().in('id', targetIds)
            if (error) console.warn('Falha ao remover componente dos mapas:', error)
        }
    }

    await supabase
        .from('turma_template_link')
        .update({ sincronizado_em: new Date().toISOString() })
        .in('disciplina_template_id', relatedIds)

    return turmaIds.length
}

/**
 * Sync catalog labels without renaming a shared code still used elsewhere
 * (ex.: MF no primário vs MFD no secundário II na mesma escola).
 */
export async function syncComponenteCatalogSafely(
    supabase: SupabaseClient,
    opts: {
        escolaId: string
        oldCodigo: string
        newCodigo: string
        newNome: string
    },
): Promise<void> {
    const { escolaId, oldCodigo, newCodigo, newNome } = opts
    if (!escolaId || !oldCodigo) return

    if (!newCodigo || newCodigo === oldCodigo) {
        const { error } = await supabase
            .from('componentes_catalogo')
            .update({ nome: newNome })
            .eq('escola_id', escolaId)
            .eq('codigo_componente', oldCodigo)
        if (error) console.warn('Falha ao sincronizar catálogo:', error)
        return
    }

    const { data: existingNew } = await supabase
        .from('componentes_catalogo')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('codigo_componente', newCodigo)
        .maybeSingle()

    if (existingNew?.id) {
        await supabase
            .from('componentes_catalogo')
            .update({ nome: newNome, ativo: true })
            .eq('id', existingNew.id)
    } else {
        const { data: oldRow } = await supabase
            .from('componentes_catalogo')
            .select(
                'peso_padrao, escala_minima, escala_maxima, is_calculated, formula_expression, depends_on_codes, tipo_calculo, descricao',
            )
            .eq('escola_id', escolaId)
            .eq('codigo_componente', oldCodigo)
            .maybeSingle()

        await supabase.from('componentes_catalogo').insert({
            escola_id: escolaId,
            codigo_componente: newCodigo,
            nome: newNome,
            ativo: true,
            peso_padrao: oldRow?.peso_padrao ?? 100,
            escala_minima: oldRow?.escala_minima ?? 0,
            escala_maxima: oldRow?.escala_maxima ?? 20,
            is_calculated: oldRow?.is_calculated ?? false,
            formula_expression: oldRow?.formula_expression ?? null,
            depends_on_codes: oldRow?.depends_on_codes ?? null,
            tipo_calculo: oldRow?.tipo_calculo ?? 'trimestral',
            descricao: oldRow?.descricao ?? null,
        })
    }

    const { data: stillUsed } = await supabase
        .from('componentes_template')
        .select('id, disciplinas_template!inner(escola_id)')
        .eq('codigo_componente', oldCodigo)
        .eq('disciplinas_template.escola_id', escolaId)
        .limit(1)

    if (!stillUsed?.length) {
        await supabase
            .from('componentes_catalogo')
            .update({ ativo: false })
            .eq('escola_id', escolaId)
            .eq('codigo_componente', oldCodigo)
    }
}
