/**
 * Aplica o catálogo normativo MED às tabelas disciplinas_template /
 * componentes_template / componentes_catalogo da escola.
 *
 * Comportamento:
 * - Idempotente: não duplica (escola_id, classe, codigo_disciplina)
 * - Não altera templates nem componentes já existentes (preserva edições do utilizador)
 * - Preenche apenas o que falta (disciplinas e componentes NEE/NEO/MEC quando aplicável)
 * - Insere em lote para performance
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { EscolaNatureza } from './angolaGradeScale'
import { isPrivateInstitution } from './angolaGradeScale'
import {
    getAllMedComponenteDefs,
    getMedComponentesForDisciplina,
    getMedCurriculumForTipo,
    MED_CURRICULUM_SOURCE_LABEL,
    type MedComponenteDef,
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

function buildComponenteRows(
    disciplinaTemplateId: string,
    componentes: MedComponenteDef[],
    scale: { escala_minima: number; escala_maxima: number },
    existingKeys?: Set<string>
): Array<Record<string, unknown>> {
    const rows: Array<Record<string, unknown>> = []
    for (const c of componentes) {
        for (const trimestre of c.trimestres) {
            const key = `${String(c.codigo_componente).toUpperCase()}::${trimestre}`
            if (existingKeys?.has(key)) continue
            rows.push({
                disciplina_template_id: disciplinaTemplateId,
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
            existingKeys?.add(key)
        }
    }
    return rows
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

    const defaultScale = { escala_minima: 0, escala_maxima: 20 }
    const defs = getAllMedComponenteDefs().filter((c) => {
        if (existingCodes.has(c.codigo_componente.toUpperCase())) return false
        // NEE/NEO/MEC/MFD de exame combinado: só escolas não privadas
        if (
            isPrivateInstitution(natureza) &&
            ['NEE', 'NEO', 'MEC', 'MFD'].includes(c.codigo_componente.toUpperCase())
        ) {
            return false
        }
        return true
    })

    const toInsert = defs.map((c) => ({
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

async function insertComponenteBatches(
    supabase: SupabaseClient,
    rows: Array<Record<string, unknown>>
): Promise<void> {
    const batchSize = 80
    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        const { error } = await supabase.from('componentes_template').insert(batch)
        if (error) throw error
    }
}

/**
 * Completa NEE/NEO/MEC/MFD em templates de língua já existentes (classes 9ª/12ª/13ª).
 */
async function fillMissingExamComponents(opts: {
    supabase: SupabaseClient
    escolaId: string
    natureza?: EscolaNatureza | null
}): Promise<{ created: number; touchedIds: string[] }> {
    const { supabase, escolaId, natureza } = opts
    if (isPrivateInstitution(natureza)) {
        return { created: 0, touchedIds: [] }
    }

    const { data: templates, error } = await supabase
        .from('disciplinas_template')
        .select('id, classe, codigo_disciplina')
        .eq('escola_id', escolaId)

    if (error) throw error
    if (!templates?.length) return { created: 0, touchedIds: [] }

    const eligible = templates.filter((t) => {
        const comps = getMedComponentesForDisciplina({
            classe: t.classe,
            codigoDisciplina: t.codigo_disciplina,
            natureza,
        })
        return comps.some((c) => ['NEE', 'NEO', 'MEC', 'MFD'].includes(c.codigo_componente))
    })

    if (eligible.length === 0) return { created: 0, touchedIds: [] }

    const eligibleIds = eligible.map((t) => t.id as string)
    const { data: existingComps, error: cErr } = await supabase
        .from('componentes_template')
        .select('disciplina_template_id, codigo_componente, trimestre')
        .in('disciplina_template_id', eligibleIds)

    if (cErr) throw cErr

    const existingByDisc = new Map<string, Set<string>>()
    for (const c of existingComps || []) {
        const discId = c.disciplina_template_id as string
        if (!existingByDisc.has(discId)) existingByDisc.set(discId, new Set())
        existingByDisc
            .get(discId)!
            .add(`${String(c.codigo_componente).toUpperCase()}::${Number(c.trimestre) || 0}`)
    }

    const rows: Array<Record<string, unknown>> = []
    const touchedIds: string[] = []

    for (const t of eligible) {
        const scale = scaleForClasse(t.classe, natureza)
        const defs = getMedComponentesForDisciplina({
            classe: t.classe,
            codigoDisciplina: t.codigo_disciplina,
            natureza,
        }).filter((c) => ['NEE', 'NEO', 'MEC', 'MFD'].includes(c.codigo_componente))

        const existingKeys = existingByDisc.get(t.id) || new Set<string>()
        const before = existingKeys.size
        const newRows = buildComponenteRows(t.id, defs, scale, existingKeys)
        if (newRows.length > 0 || existingKeys.size !== before) {
            if (newRows.length > 0) {
                rows.push(...newRows)
                touchedIds.push(t.id)
            }
        }
    }

    if (rows.length > 0) {
        await insertComponenteBatches(supabase, rows)
        await linkDependsOnForTemplates(supabase, [...new Set(touchedIds)])
    }

    return { created: rows.length, touchedIds }
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

    let createdDisciplinas = 0
    let createdComponentes = 0
    const newTemplateIds: string[] = []

    if (disciplinasToInsert.length > 0) {
        const { data: insertedDiscs, error: discError } = await supabase
            .from('disciplinas_template')
            .insert(disciplinasToInsert)
            .select('id, classe, codigo_disciplina')

        if (discError) throw discError

        const componenteRows: Array<Record<string, unknown>> = []
        for (const disc of insertedDiscs || []) {
            const scale = scaleForClasse(disc.classe, natureza)
            const defs = getMedComponentesForDisciplina({
                classe: disc.classe,
                codigoDisciplina: disc.codigo_disciplina,
                natureza,
            })
            componenteRows.push(...buildComponenteRows(disc.id, defs, scale))
            newTemplateIds.push(disc.id)
        }

        await insertComponenteBatches(supabase, componenteRows)
        await linkDependsOnForTemplates(supabase, newTemplateIds)

        createdDisciplinas = newTemplateIds.length
        createdComponentes += componenteRows.length
    }

    // Completar NEE/NEO/MEC/MFD em línguas já cadastradas (9ª/12ª/13ª)
    const examFill = await fillMissingExamComponents({ supabase, escolaId, natureza })
    createdComponentes += examFill.created

    const parts: string[] = []
    if (createdDisciplinas > 0) {
        parts.push(`${createdDisciplinas} disciplina(s)`)
    }
    if (createdComponentes > 0) {
        parts.push(`${createdComponentes} componente(s)`)
    }

    const message =
        parts.length > 0
            ? `Currículo MED aplicado: ${parts.join(' e ')} pré-cadastrados (inclui NEE/NEO/MEC nas línguas das classes de exame, quando aplicável). Pode editar, apagar ou adicionar livremente.`
            : skippedDisciplinas > 0
              ? 'Todas as disciplinas e componentes normativos aplicáveis já estavam cadastrados. Nenhuma alteração foi feita.'
              : 'Nenhuma disciplina normativa aplicável para este tipo de escola.'

    return {
        createdDisciplinas,
        skippedDisciplinas,
        createdComponentes,
        catalogSeeded,
        message,
    }
}
