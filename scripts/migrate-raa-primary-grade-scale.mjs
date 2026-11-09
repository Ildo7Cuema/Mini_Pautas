#!/usr/bin/env node
/**
 * Migração RAA via Supabase JS (service role):
 * - Primário (não privado): escala 1–10
 * - Notas > 10 no primário: clamp(round(valor/2), 1, 10)
 * - Preenche natureza=publica onde em falta
 */
import { createServiceClient, loadEnv, log, sleep } from './seed/_shared.mjs'

loadEnv()
const supabase = createServiceClient()

function isPrimaryClasse(classe) {
    const n = parseInt(String(classe || '').match(/(\d+)/)?.[1] || '0', 10)
    return n >= 1 && n <= 6
}

function isPrimaryTurma(turma) {
    const nivel = String(turma.nivel_ensino || '').toLowerCase()
    if (nivel.includes('secund')) return false
    if (nivel.includes('primar')) return true
    return isPrimaryClasse(turma.nome)
}

function isPrivateSchool(config) {
    return config && typeof config === 'object' && config.natureza === 'privada'
}

function normalizePrimary(valor) {
    const n = Number(valor)
    if (Number.isNaN(n)) return 1
    return Math.min(10, Math.max(1, Math.round(n / 2)))
}

async function updateEscalasByIds(table, ids) {
    let updated = 0
    for (let i = 0; i < ids.length; i += 80) {
        const chunk = ids.slice(i, i + 80)
        const { data, error } = await supabase
            .from(table)
            .update({ escala_minima: 1, escala_maxima: 10 })
            .in('id', chunk)
            .or('escala_maxima.neq.10,escala_minima.neq.1')
            .select('id')
        if (error) {
            // fallback one-by-one for this chunk
            for (const id of chunk) {
                const { error: uErr } = await supabase
                    .from(table)
                    .update({ escala_minima: 1, escala_maxima: 10 })
                    .eq('id', id)
                if (!uErr) updated += 1
            }
        } else {
            updated += data?.length || 0
        }
        await sleep(30)
    }
    return updated
}

async function main() {
    log('raa', '=== Migração escalas RAA primário ===')

    const { data: escolas, error: eErr } = await supabase
        .from('escolas')
        .select('id, nome, configuracoes')
    if (eErr) throw new Error(eErr.message)

    let naturezaFilled = 0
    for (const escola of escolas || []) {
        const cfg = escola.configuracoes || {}
        if (!cfg.natureza) {
            const next = { ...cfg, natureza: 'publica' }
            const { error } = await supabase
                .from('escolas')
                .update({ configuracoes: next })
                .eq('id', escola.id)
            if (error) throw new Error(`natureza ${escola.nome}: ${error.message}`)
            naturezaFilled += 1
            escola.configuracoes = next
        }
    }
    log('raa', `Natureza preenchida: ${naturezaFilled}`)

    const escolaById = new Map((escolas || []).map((e) => [e.id, e]))

    const { data: templates, error: tErr } = await supabase
        .from('disciplinas_template')
        .select('id, classe, escola_id')
    if (tErr) throw new Error(tErr.message)

    const primaryTemplateIds = (templates || [])
        .filter((t) => {
            const escola = escolaById.get(t.escola_id)
            if (isPrivateSchool(escola?.configuracoes)) return false
            return isPrimaryClasse(t.classe)
        })
        .map((t) => t.id)

    const templateCompIds = []
    for (let i = 0; i < primaryTemplateIds.length; i += 40) {
        const chunk = primaryTemplateIds.slice(i, i + 40)
        const { data, error } = await supabase
            .from('componentes_template')
            .select('id, escala_minima, escala_maxima')
            .in('disciplina_template_id', chunk)
        if (error) throw new Error(`list template comps: ${error.message}`)
        for (const c of data || []) {
            if (c.escala_minima !== 1 || c.escala_maxima !== 10) templateCompIds.push(c.id)
        }
    }
    const templatesUpdated = await updateEscalasByIds('componentes_template', templateCompIds)
    log('raa', `componentes_template a actualizar: ${templateCompIds.length}, actualizados: ${templatesUpdated}`)

    const { data: turmas, error: turErr } = await supabase
        .from('turmas')
        .select('id, nome, nivel_ensino, escola_id')
    if (turErr) throw new Error(turErr.message)

    const primaryTurmaIds = (turmas || [])
        .filter((t) => {
            const escola = escolaById.get(t.escola_id)
            if (isPrivateSchool(escola?.configuracoes)) return false
            return isPrimaryTurma(t)
        })
        .map((t) => t.id)

    log('raa', `Turmas primárias (não privadas): ${primaryTurmaIds.length}`)

    const primaryCompIds = []
    const compsNeedingScale = []
    for (let i = 0; i < primaryTurmaIds.length; i += 40) {
        const chunk = primaryTurmaIds.slice(i, i + 40)
        const { data: comps, error } = await supabase
            .from('componentes_avaliacao')
            .select('id, escala_minima, escala_maxima')
            .in('turma_id', chunk)
        if (error) throw new Error(`list comps: ${error.message}`)
        for (const c of comps || []) {
            primaryCompIds.push(c.id)
            if (c.escala_minima !== 1 || c.escala_maxima !== 10) compsNeedingScale.push(c.id)
        }
    }
    const compsUpdated = await updateEscalasByIds('componentes_avaliacao', compsNeedingScale)
    log('raa', `componentes_avaliacao actualizados: ${compsUpdated}`)

    // Notas: buscar por turma (indexado) em vez de milhares de componente_ids
    let notasUpdated = 0
    for (const turmaId of primaryTurmaIds) {
        const { data: notas, error } = await supabase
            .from('notas')
            .select('id, valor')
            .eq('turma_id', turmaId)
            .gt('valor', 10)
            .limit(2000)
        if (error) {
            log('raa', `aviso notas turma ${turmaId}: ${error.message}`)
            continue
        }
        const updates = (notas || []).map((n) => ({
            id: n.id,
            valor: normalizePrimary(n.valor),
        }))
        for (let i = 0; i < updates.length; i += 50) {
            const chunk = updates.slice(i, i + 50)
            await Promise.all(
                chunk.map(async (row) => {
                    const { error: uErr } = await supabase
                        .from('notas')
                        .update({ valor: row.valor })
                        .eq('id', row.id)
                    if (!uErr) notasUpdated += 1
                })
            )
            await sleep(40)
        }
    }
    log('raa', `notas normalizadas: ${notasUpdated}`)

    let finaisUpdated = 0
    for (const turmaId of primaryTurmaIds) {
        const { data: finais, error } = await supabase
            .from('notas_finais')
            .select('id, nota_final')
            .eq('turma_id', turmaId)
            .gt('nota_final', 10)
            .limit(2000)
        if (error) continue
        for (const row of finais || []) {
            const { error: uErr } = await supabase
                .from('notas_finais')
                .update({ nota_final: normalizePrimary(row.nota_final) })
                .eq('id', row.id)
            if (!uErr) finaisUpdated += 1
        }
        await sleep(20)
    }
    log('raa', `notas_finais normalizadas: ${finaisUpdated}`)
    log('raa', '=== Concluído ===')
}

main().catch((err) => {
    console.error('❌', err.message || err)
    process.exit(1)
})
