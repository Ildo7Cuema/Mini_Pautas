/**
 * Lança notas completas (MAC/NPT/MT nos 3 trimestres + MF anual)
 * e preenche notas_finais para Mini-Pauta / supervisão.
 */
import {
    OBS_ACADEMICAS,
    buildGradeObservation,
    buildGradeValue,
    classificacaoFromNota,
    studentPerformanceProfile,
} from './catalog.mjs'
import { log, sleep, withRetry } from './_shared.mjs'

/** Lotes pequenos — upserts grandes de notas falham com frequência (fetch failed). */
const BATCH = 80
const BATCH_FALLBACK = 20

function chunk(arr, size) {
    const out = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
}

/**
 * Liga depends_on_components por código da fórmula (MT→MAC/NPT, MF→MT×3).
 * Os relatórios também resolvem por código; isto mantém GradeEntry/Pauta alinhados.
 */
async function linkDependsOnComponents(supabase, turmaId) {
    const { data: comps, error } = await withRetry(`deps-comps(${turmaId})`, async () => {
        const res = await supabase
            .from('componentes_avaliacao')
            .select('id, disciplina_id, codigo_componente, trimestre, formula_expression, is_calculated, tipo_calculo, depends_on_components')
            .eq('turma_id', turmaId)
        if (res.error) throw new Error(res.error.message)
        return res
    })
    if (error || !comps?.length) return

    const byDisc = new Map()
    for (const c of comps) {
        if (!byDisc.has(c.disciplina_id)) byDisc.set(c.disciplina_id, [])
        byDisc.get(c.disciplina_id).push(c)
    }

    const updates = []
    for (const group of byDisc.values()) {
        for (const comp of group) {
            if (!comp.is_calculated || !comp.formula_expression) continue
            const formula = String(comp.formula_expression).toUpperCase()
            const codes = [...new Set((formula.match(/[A-Z][A-Z0-9_]*/g) || []))]
            const depIds = new Set()

            for (const raw of codes) {
                const alias = /^T([1-3])$/.exec(raw)
                const suffixed = /^([A-Z][A-Z0-9_]*?)([1-3])$/.exec(raw)
                let base = raw
                let trim = null
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
            const prev = Array.isArray(comp.depends_on_components) ? comp.depends_on_components : []
            const same =
                next.length === prev.length && next.every((id) => prev.includes(id))
            if (!same && next.length > 0) {
                updates.push({ id: comp.id, depends_on_components: next })
            }
        }
    }

    for (const part of chunk(updates, 40)) {
        for (const row of part) {
            await withRetry(`deps-upd(${row.id})`, async () => {
                const { error: uErr } = await supabase
                    .from('componentes_avaliacao')
                    .update({ depends_on_components: row.depends_on_components })
                    .eq('id', row.id)
                if (uErr) throw new Error(uErr.message)
            })
        }
        await sleep(20)
    }
}

/**
 * Garante componentes_avaliacao para todos os trimestres do template
 * (apply_template_to_turma só cria o 1.º código por disciplina).
 * Depois liga depends_on a partir da fórmula (MAC/NPT/MT1…).
 */
export async function ensureComponentesAvaliacao(supabase, turmaId) {
    const { data: links, error: lErr } = await withRetry(`links(${turmaId})`, async () => {
        const res = await supabase
            .from('turma_template_link')
            .select('disciplina_id, disciplina_template_id')
            .eq('turma_id', turmaId)
        if (res.error) throw new Error(res.error.message)
        return res
    })

    if (!links?.length) return { created: 0 }

    const templateIds = [...new Set(links.map((l) => l.disciplina_template_id))]
    const { data: templateComps, error: tErr } = await withRetry(`tpl-comps(${turmaId})`, async () => {
        const res = await supabase
            .from('componentes_template')
            .select('*')
            .in('disciplina_template_id', templateIds)
            .order('trimestre', { ascending: true })
            .order('ordem', { ascending: true })
        if (res.error) throw new Error(res.error.message)
        return res
    })

    const compsByTemplate = new Map()
    for (const tc of templateComps || []) {
        if (!compsByTemplate.has(tc.disciplina_template_id)) {
            compsByTemplate.set(tc.disciplina_template_id, [])
        }
        compsByTemplate.get(tc.disciplina_template_id).push(tc)
    }

    const { data: existing, error: eErr } = await withRetry(`exist-comps(${turmaId})`, async () => {
        const res = await supabase
            .from('componentes_avaliacao')
            .select('id, disciplina_id, codigo_componente, trimestre')
            .eq('turma_id', turmaId)
        if (res.error) throw new Error(res.error.message)
        return res
    })

    const existingKeys = new Set(
        (existing || []).map(
            (c) => `${c.disciplina_id}|${c.codigo_componente}|${Number(c.trimestre) || 1}`
        )
    )

    const toInsert = []
    for (const link of links) {
        const tcs = compsByTemplate.get(link.disciplina_template_id) || []
        for (const tc of tcs) {
            const key = `${link.disciplina_id}|${tc.codigo_componente}|${Number(tc.trimestre) || 1}`
            if (existingKeys.has(key)) continue
            toInsert.push({
                disciplina_id: link.disciplina_id,
                turma_id: turmaId,
                nome: tc.nome,
                codigo_componente: tc.codigo_componente,
                peso_percentual: tc.peso_percentual,
                escala_minima: tc.escala_minima ?? 0,
                escala_maxima: tc.escala_maxima ?? 20,
                obrigatorio: tc.obrigatorio ?? true,
                ordem: tc.ordem,
                descricao: tc.descricao,
                trimestre: tc.trimestre,
                is_calculated: tc.is_calculated === true,
                formula_expression: tc.formula_expression || null,
                depends_on_components: [],
                tipo_calculo: tc.tipo_calculo || 'trimestral',
            })
            existingKeys.add(key)
        }
    }

    let created = 0
    for (const part of chunk(toInsert, 80)) {
        try {
            await withRetry(`insert-comps(${turmaId})`, async () => {
                const { error } = await supabase.from('componentes_avaliacao').insert(part)
                if (error) throw new Error(error.message)
            })
            created += part.length
        } catch {
            for (const row of part) {
                const { error } = await supabase.from('componentes_avaliacao').insert(row)
                if (!error) created += 1
            }
        }
        await sleep(40)
    }

    await linkDependsOnComponents(supabase, turmaId)

    return { created }
}

async function upsertChunk(supabase, table, part, onConflict) {
    await withRetry(`${table} upsert(${part.length})`, async () => {
        const { error } = await supabase.from(table).upsert(part, {
            onConflict,
            ignoreDuplicates: false,
        })
        if (error) throw new Error(error.message)
    })
}

async function insertBatches(supabase, table, rows, onConflict) {
    let inserted = 0
    for (const part of chunk(rows, BATCH)) {
        try {
            await upsertChunk(supabase, table, part, onConflict)
            inserted += part.length
        } catch (err) {
            console.warn(`  ! lote ${part.length} falhou em ${table}; a dividir… (${err.message || err})`)
            for (const small of chunk(part, BATCH_FALLBACK)) {
                try {
                    await upsertChunk(supabase, table, small, onConflict)
                    inserted += small.length
                } catch (err2) {
                    console.warn(`  ! sub-lote ${small.length} falhou; linha a linha…`)
                    for (const row of small) {
                        await withRetry(`${table} row`, async () => {
                            const { error } = await supabase.from(table).upsert(row, {
                                onConflict,
                                ignoreDuplicates: false,
                            })
                            if (error) throw new Error(error.message)
                        })
                        inserted += 1
                        await sleep(30)
                    }
                }
                await sleep(120)
            }
        }
        await sleep(150)
    }
    return inserted
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id: string, nome: string }} turma
 * @param {Array<{ id: string }>} alunos
 * @param {string} defaultProfessorId
 */
export async function seedNotasForTurma(supabase, turma, alunos, defaultProfessorId) {
    await ensureComponentesAvaliacao(supabase, turma.id)

    const { data: disciplinas, error: dErr } = await withRetry(`disciplinas(${turma.nome})`, async () => {
        const res = await supabase
            .from('disciplinas')
            .select('id, nome, codigo_disciplina, ordem, professor_id')
            .eq('turma_id', turma.id)
            .order('ordem', { ascending: true })
        if (res.error) throw new Error(res.error.message)
        return res
    })

    if (dErr) throw new Error(`disciplinas: ${dErr.message}`)
    if (!disciplinas?.length || !alunos?.length) {
        return { notas: 0, notasFinais: 0, disciplinas: 0 }
    }

    const { data: componentes, error: cErr } = await withRetry(`comps(${turma.nome})`, async () => {
        const res = await supabase
            .from('componentes_avaliacao')
            .select('id, disciplina_id, codigo_componente, trimestre, is_calculated, tipo_calculo')
            .eq('turma_id', turma.id)
        if (res.error) throw new Error(res.error.message)
        return res
    })

    if (cErr) throw new Error(`componentes_avaliacao: ${cErr.message}`)

    const compsByDisc = new Map()
    for (const c of componentes || []) {
        if (!compsByDisc.has(c.disciplina_id)) compsByDisc.set(c.disciplina_id, [])
        compsByDisc.get(c.disciplina_id).push(c)
    }

    const notasRows = []
    const finaisRows = []
    const now = new Date().toISOString()
    const nivel = String(turma.nivel_ensino || turma.nome || '').toLowerCase()
    const isPrimary =
        nivel.includes('primar') ||
        /[1-6]\s*[ªºa]/i.test(String(turma.nome || ''))
    const maxScale = isPrimary ? 10 : 20

    disciplinas.forEach((disc, discIndex) => {
        const comps = compsByDisc.get(disc.id) || []
        const lancadoPor = disc.professor_id || defaultProfessorId

        for (let alunoIndex = 0; alunoIndex < alunos.length; alunoIndex++) {
            const aluno = alunos[alunoIndex]
            const mtByAluno = {}

            for (const trim of [1, 2, 3]) {
                const mac =
                    comps.find((c) => c.codigo_componente === 'MAC' && Number(c.trimestre) === trim) ||
                    comps.find((c) => c.codigo_componente === 'MAC')
                const npt =
                    comps.find((c) => c.codigo_componente === 'NPT' && Number(c.trimestre) === trim) ||
                    comps.find((c) => c.codigo_componente === 'NPT')
                const mt =
                    comps.find((c) => c.codigo_componente === 'MT' && Number(c.trimestre) === trim) ||
                    comps.find((c) => c.codigo_componente === 'MT')

                if (!mac || !npt) continue

                const macVal = buildGradeValue(alunoIndex, discIndex, trim, 1, maxScale)
                const nptVal = buildGradeValue(alunoIndex, discIndex, trim, 2, maxScale)
                const mtVal = Math.round(((macVal + nptVal) / 2) * 10) / 10
                mtByAluno[trim] = mtVal

                const macObs = buildGradeObservation(macVal, alunoIndex, discIndex, trim, 'MAC')
                const nptObs = buildGradeObservation(nptVal, alunoIndex, discIndex, trim, 'NPT')

                notasRows.push({
                    aluno_id: aluno.id,
                    componente_id: mac.id,
                    turma_id: turma.id,
                    trimestre: trim,
                    valor: macVal,
                    lancado_por: lancadoPor,
                    data_lancamento: now,
                    observacao: macObs,
                })
                notasRows.push({
                    aluno_id: aluno.id,
                    componente_id: npt.id,
                    turma_id: turma.id,
                    trimestre: trim,
                    valor: nptVal,
                    lancado_por: lancadoPor,
                    data_lancamento: now,
                    observacao: nptObs,
                })

                if (mt) {
                    notasRows.push({
                        aluno_id: aluno.id,
                        componente_id: mt.id,
                        turma_id: turma.id,
                        trimestre: trim,
                        valor: mtVal,
                        lancado_por: lancadoPor,
                        data_lancamento: now,
                        observacao: null,
                    })
                }

                finaisRows.push({
                    aluno_id: aluno.id,
                    turma_id: turma.id,
                    disciplina_id: disc.id,
                    trimestre: trim,
                    nota_final: mtVal,
                    classificacao: classificacaoFromNota(mtVal),
                    calculo_detalhado: {
                        MAC: macVal,
                        NPT: nptVal,
                        MT: mtVal,
                        formula: '(MAC + NPT) / 2',
                        seed: true,
                    },
                    data_calculo: now,
                })
            }

            const mfComp =
                comps.find((c) => c.codigo_componente === 'MF' && Number(c.trimestre) === 3) ||
                comps.find((c) => c.codigo_componente === 'MF') ||
                comps.find((c) => c.codigo_componente === 'MFD')

            if (mfComp && mtByAluno[1] != null && mtByAluno[2] != null && mtByAluno[3] != null) {
                const mfVal =
                    Math.round(((mtByAluno[1] + mtByAluno[2] + mtByAluno[3]) / 3) * 10) / 10
                notasRows.push({
                    aluno_id: aluno.id,
                    componente_id: mfComp.id,
                    turma_id: turma.id,
                    trimestre: 3,
                    valor: mfVal,
                    lancado_por: lancadoPor,
                    data_lancamento: now,
                    observacao: buildGradeObservation(mfVal, alunoIndex, discIndex, 3, 'MF'),
                })
            }
        }
    })

    const notasCount = await insertBatches(
        supabase,
        'notas',
        notasRows,
        'aluno_id,componente_id,trimestre'
    )
    const finaisCount = await insertBatches(
        supabase,
        'notas_finais',
        finaisRows,
        'aluno_id,turma_id,disciplina_id,trimestre'
    )

    return {
        notas: notasCount,
        notasFinais: finaisCount,
        disciplinas: disciplinas.length,
    }
}

/**
 * Seed de notas para todas as turmas de uma escola.
 */
export async function seedNotasForEscola(supabase, escolaId, schoolKey = 'escola') {
    const { data: turmas, error: tErr } = await withRetry(`turmas-escola(${schoolKey})`, async () => {
        const res = await supabase
            .from('turmas')
            .select('id, nome, professor_id')
            .eq('escola_id', escolaId)
            .order('nome')
        if (res.error) throw new Error(res.error.message)
        return res
    })

    if (tErr) throw new Error(`turmas: ${tErr.message}`)

    let totalNotas = 0
    let totalFinais = 0

    for (const turma of turmas || []) {
        const { data: alunos, error: aErr } = await withRetry(`alunos(${turma.nome})`, async () => {
            const res = await supabase
                .from('alunos')
                .select('id')
                .eq('turma_id', turma.id)
                .eq('ativo', true)
                .order('numero_processo')
            if (res.error) throw new Error(res.error.message)
            return res
        })

        if (aErr) throw new Error(`alunos(${turma.nome}): ${aErr.message}`)

        // Actualiza observações académicas / frequência com perfis mistos (em paralelo por turma)
        await Promise.all(
            (alunos || []).map(async (aluno, i) => {
                const perfil = studentPerformanceProfile(i)
                const freqByPerfil = {
                    fraco: 48 + (i % 22),
                    irregular: 62 + (i % 20),
                    medio: 75 + (i % 15),
                    bom: 85 + (i % 10),
                    excelente: 92 + (i % 8),
                }
                const { error } = await supabase
                    .from('alunos')
                    .update({
                        observacoes_academicas: OBS_ACADEMICAS[i % OBS_ACADEMICAS.length],
                        frequencia_anual: Math.min(100, freqByPerfil[perfil]),
                    })
                    .eq('id', aluno.id)
                if (error) console.warn(`  ! obs aluno ${i}: ${error.message}`)
            })
        )

        const result = await seedNotasForTurma(
            supabase,
            turma,
            alunos || [],
            turma.professor_id
        )
        totalNotas += result.notas
        totalFinais += result.notasFinais
        log(
            schoolKey,
            `Notas ${turma.nome}: ${result.notas} lançamentos · ${result.notasFinais} finais · ${result.disciplinas} disc.`
        )
        await sleep(250)
    }

    return { notas: totalNotas, notasFinais: totalFinais, turmas: turmas?.length || 0 }
}
