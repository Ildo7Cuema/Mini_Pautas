#!/usr/bin/env node
/**
 * Seed de testes EduGest Angola
 *
 * Cria 3 escolas (primária, secundária, complexo) com administradores,
 * professores autenticáveis, templates, turmas, disciplinas,
 * ≥12 alunos por turma/classe/curso, notas nos 3 trimestres + MF,
 * mais Direções Municipais e Provinciais com circulares, histórico e solicitações.
 *
 * Uso:
 *   npm run seed:test
 *   node scripts/seed-test-data.mjs
 *   node scripts/seed-test-data.mjs --force   # apaga seed anterior e recria
 *   node scripts/seed-test-data.mjs --resume  # completa escolas/notas/direções em falta (sem limpar)
 *   node scripts/seed-test-data.mjs --notas-only  # só (re)lança notas nas escolas seed
 *   node scripts/seed-test-data.mjs --direcoes-only  # só direções (escolas seed já existentes)
 */
import {
    ANO_LECTIVO,
    SEED_MARKER,
    SEED_PASSWORD,
    createAuthUser,
    createServiceClient,
    generateProcesso,
    listSeedDirecoesMunicipais,
    listSeedDirecoesProvinciais,
    listSeedEscolas,
    log,
    sleep,
    withRetry,
} from './seed/_shared.mjs'
import {
    SCHOOLS,
    STUDENTS_PER_TURMA,
    buildAdminPlan,
    buildStudentSeed,
    buildTeacherPlan,
    templatesForSchool,
} from './seed/catalog.mjs'
import { seedDirecoes } from './seed/seed-direcoes.mjs'
import { seedNotasForEscola } from './seed/seed-notas.mjs'

const force = process.argv.includes('--force')
const resume = process.argv.includes('--resume')
const notasOnly = process.argv.includes('--notas-only')
const direcoesOnly = process.argv.includes('--direcoes-only')
const skipNotas = process.argv.includes('--skip-notas')

async function assertNoExistingSeed(supabase) {
    if (resume || notasOnly) return

    const existing = await listSeedEscolas(supabase)
    const dms = await listSeedDirecoesMunicipais(supabase)
    const dps = await listSeedDirecoesProvinciais(supabase)

    if (direcoesOnly) {
        if (dms.length === 0 && dps.length === 0) return
        if (!force) {
            console.error('\nJá existem direções seed:')
            for (const d of dps) console.error(`  - DP ${d.provincia} · ${d.email}`)
            for (const d of dms) console.error(`  - DM ${d.municipio} · ${d.email}`)
            console.error('\nExecute: node scripts/seed-test-data.mjs --direcoes-only --force\n')
            process.exit(1)
        }
        log('force', 'A limpar apenas direções seed (escolas preservadas)...')
        const { unseedDirecoesOnly } = await import('./unseed-test-data.mjs')
        await unseedDirecoesOnly({ silent: false })
        return
    }

    const hasAny = existing.length > 0 || dms.length > 0 || dps.length > 0
    if (!hasAny) return

    if (!force) {
        console.error('\nJá existe seed de teste:')
        for (const e of existing) console.error(`  - escola ${e.codigo_escola} · ${e.nome}`)
        for (const d of dps) console.error(`  - DP ${d.provincia} · ${d.email}`)
        for (const d of dms) console.error(`  - DM ${d.municipio} · ${d.email}`)
        console.error('\nExecute: npm run seed:test:clean')
        console.error('Ou:      npm run seed:test -- --force')
        console.error('Ou retomar: npm run seed:test -- --resume\n')
        process.exit(1)
    }
    log('force', 'A limpar seed existente antes de recriar...')
    const { default: unseed } = await import('./unseed-test-data.mjs')
    await unseed({ silent: false, asModule: true })
}

async function createLicense(supabase, escolaId) {
    const start = new Date()
    const end = new Date(start)
    end.setFullYear(end.getFullYear() + 1)

    const { error } = await supabase.from('licencas').insert({
        escola_id: escolaId,
        plano: 'anual',
        data_inicio: start.toISOString().slice(0, 10),
        data_fim: end.toISOString().slice(0, 10),
        estado: 'ativa',
        valor: 48000,
        data_ultimo_pagamento: start.toISOString(),
    })
    if (error) throw new Error(`licencas: ${error.message}`)
}

async function createTemplates(supabase, escolaId, school) {
    const templates = templatesForSchool(school)
    let created = 0

    for (const t of templates) {
        const { data: disc, error } = await supabase
            .from('disciplinas_template')
            .insert({
                escola_id: escolaId,
                classe: t.classe,
                nome: t.nome,
                codigo_disciplina: t.codigo_disciplina,
                carga_horaria: t.carga_horaria,
                ordem: t.ordem,
                is_obrigatoria: t.is_obrigatoria,
                descricao: `Template seed · ${t.classe}`,
            })
            .select('id')
            .single()

        if (error) throw new Error(`disciplinas_template(${t.classe}/${t.codigo_disciplina}): ${error.message}`)

        const componentesRows = []
        for (const c of t.componentes) {
            const trimestres = Array.isArray(c.trimestres) && c.trimestres.length
                ? c.trimestres
                : [1, 2, 3]
            const isCalculated = c.is_calculated === true
            // RAA: Ensino Primário 1–10; Secundário 0–20
            const classeNum = parseInt(String(t.classe).match(/(\d+)/)?.[1] || '0', 10)
            const isPrimary = classeNum >= 1 && classeNum <= 6
            const escalaMin = isPrimary ? 1 : 0
            const escalaMax = isPrimary ? 10 : 20

            for (const trimestre of trimestres) {
                componentesRows.push({
                    disciplina_template_id: disc.id,
                    nome: c.nome,
                    codigo_componente: c.codigo_componente,
                    peso_percentual: c.peso_percentual,
                    escala_minima: escalaMin,
                    escala_maxima: escalaMax,
                    obrigatorio: true,
                    ordem: c.ordem,
                    trimestre,
                    is_calculated: isCalculated,
                    formula_expression: isCalculated ? (c.formula_expression || null) : null,
                    // UUIDs de depends_on são ligados depois em seed-notas (ensureComponentesAvaliacao).
                    depends_on_components: [],
                    tipo_calculo: c.tipo_calculo || 'trimestral',
                    descricao:
                        c.tipo_calculo === 'anual'
                            ? `${c.codigo_componente} · Anual`
                            : `${c.codigo_componente} · ${trimestre}º Trimestre`,
                })
            }
        }

        const { error: cErr } = await supabase.from('componentes_template').insert(componentesRows)
        if (cErr) throw new Error(`componentes_template(${t.classe}/${t.codigo_disciplina}): ${cErr.message}`)
        created += 1
    }

    return created
}

async function redistributeDisciplinas(supabase, turmaId, teacherIds) {
    const { data: disciplinas, error } = await supabase
        .from('disciplinas')
        .select('id, codigo_disciplina, professor_id')
        .eq('turma_id', turmaId)
        .order('ordem', { ascending: true })

    if (error) throw new Error(`list disciplinas: ${error.message}`)
    if (!disciplinas?.length || teacherIds.length === 0) return

    for (let i = 0; i < disciplinas.length; i++) {
        const professorId = teacherIds[i % teacherIds.length]
        if (disciplinas[i].professor_id === professorId) continue

        const { error: uErr } = await supabase
            .from('disciplinas')
            .update({ professor_id: professorId })
            .eq('id', disciplinas[i].id)

        if (uErr) {
            // Fallback: keep original professor if update fails (e.g. trigger constraints)
            console.warn(`  ! não redistribuiu ${disciplinas[i].codigo_disciplina}: ${uErr.message}`)
            continue
        }

        await supabase.from('turma_professores').upsert(
            {
                turma_id: turmaId,
                professor_id: professorId,
                disciplina_id: disciplinas[i].id,
            },
            { onConflict: 'turma_id,professor_id,disciplina_id' }
        )
    }
}

async function seedSchool(supabase, school) {
    log(school.key, `=== ${school.nome} ===`)

    const admin = buildAdminPlan(school)
    const adminUser = await createAuthUser(supabase, {
        email: admin.email,
        password: admin.password,
        fullName: admin.nome,
        role: 'ESCOLA',
    })
    log(school.key, `Admin auth: ${admin.email}`)

    const { data: escola, error: eErr } = await supabase
        .from('escolas')
        .insert({
            nome: school.nome,
            codigo_escola: school.codigo_escola,
            provincia: school.provincia,
            municipio: school.municipio,
            endereco: school.endereco,
            telefone: school.telefone,
            email: admin.email,
            user_id: adminUser.id,
            ativo: true,
            bloqueado: false,
            configuracoes: {
                seed: true,
                seed_marker: SEED_MARKER,
                perfil_configurado: true,
                data_configuracao: new Date().toISOString(),
                tipo_escola_seed: school.kind,
                tipo_escola: school.kind,
                natureza: 'publica',
            },
        })
            .select('id, codigo_escola, nome, user_id')
            .single()

    if (eErr) throw new Error(`escolas insert: ${eErr.message}`)
    log(school.key, `Escola criada: ${escola.codigo_escola}`)

    await createLicense(supabase, escola.id)
    log(school.key, 'Licença anual activa')

    const templateCount = await createTemplates(supabase, escola.id, school)
    log(school.key, `Templates: ${templateCount} disciplinas-template`)

    const teachersPlan = buildTeacherPlan(school)
    const teachers = []

    for (const t of teachersPlan) {
        const user = await createAuthUser(supabase, {
            email: t.email,
            password: t.password,
            fullName: t.nome_completo,
            role: 'PROFESSOR',
        })
        await sleep(120)

        const { data: professor, error: pErr } = await supabase
            .from('professores')
            .insert({
                escola_id: escola.id,
                user_id: user.id,
                nome_completo: t.nome_completo,
                email: t.email,
                telefone: t.telefone,
                numero_agente: t.numero_agente,
                especialidade: t.especialidade,
                funcoes: ['Docente'],
                ativo: true,
                genero: t.genero,
                data_nascimento: t.data_nascimento,
                nacionalidade: t.nacionalidade,
                estado_civil: t.estado_civil,
                categoria_docente: t.categoria_docente,
                grau_academico: t.grau_academico,
                area_formacao: t.area_formacao,
                categoria_laboral: t.categoria_laboral,
                data_inicio_funcoes: t.data_inicio_funcoes,
                provincia_residencia: t.provincia_residencia,
                municipio_residencia: t.municipio_residencia,
                bairro_residencia: t.bairro_residencia,
                endereco_completo: t.endereco_completo,
                nome_pai: 'Pai Seed Teste',
                nome_mae: 'Mãe Seed Teste',
                numero_bi: `${t.numero_agente.replace(/[^A-Z0-9]/gi, '')}BI`,
                naturalidade: school.municipio,
            })
            .select('id, email, nome_completo')
            .single()

        if (pErr) throw new Error(`professores(${t.email}): ${pErr.message}`)
        teachers.push({ ...professor, plan: t })
    }
    log(school.key, `Professores: ${teachers.length}`)

    const turmas = []
    for (const turmaDef of school.turmas) {
        const responsible = teachers[turmaDef.teacherIndex]
        const codigo = `${school.codigo_escola}-${turmaDef.nome.replace(/\s+/g, '').slice(0, 12)}-${ANO_LECTIVO}-T1`

        const turma = await withRetry(`turmas(${turmaDef.nome})`, async () => {
            const { data, error: tErr } = await supabase
                .from('turmas')
                .insert({
                    escola_id: escola.id,
                    professor_id: responsible.id,
                    nome: turmaDef.nome,
                    codigo_turma: codigo,
                    ano_lectivo: ANO_LECTIVO,
                    trimestre: 1,
                    nivel_ensino: turmaDef.nivel_ensino,
                    turno: turmaDef.turno,
                    capacidade_maxima: 40,
                    sala: turmaDef.teacherIndex + 1,
                })
                .select('id, nome, codigo_turma')
                .single()
            if (tErr) throw new Error(tErr.message)
            return data
        })

        const applied = await withRetry(`apply_templates(${turmaDef.nome})`, async () => {
            const { data, error: aErr } = await supabase.rpc('apply_all_class_templates_to_turma', {
                p_turma_id: turma.id,
                p_classe: turmaDef.classe,
                p_professor_id: responsible.id,
            })
            if (aErr) throw new Error(aErr.message)
            return data
        })

        if (school.kind !== 'primario' || turmaDef.classe.startsWith('5') || turmaDef.classe.startsWith('6')) {
            await redistributeDisciplinas(
                supabase,
                turma.id,
                teachers.map((t) => t.id)
            )
        }

        turmas.push({
            ...turma,
            classe: turmaDef.classe,
            nivel_ensino: turmaDef.nivel_ensino,
            curso: turmaDef.curso || null,
            turmaDef,
        })
        log(school.key, `Turma ${turma.nome} · templates aplicados: ${applied ?? '?'}`)
    }

    // ≥12 alunos por cada turma / classe / curso (batch insert, números determinísticos)
    const baseIndex = school.key === 'primaria' ? 0 : school.key === 'secundaria' ? 500 : 1500
    let studentCount = 0
    const schoolPrefix = school.key === 'primaria' ? '1' : school.key === 'secundaria' ? '2' : '3'

    for (let tIdx = 0; tIdx < turmas.length; tIdx++) {
        const turma = turmas[tIdx]
        const alunosRows = []
        for (let n = 0; n < STUDENTS_PER_TURMA; n++) {
            const globalIndex = baseIndex + tIdx * STUDENTS_PER_TURMA + n
            const seedStudent = buildStudentSeed(school, turma.turmaDef || turma, globalIndex)
            // 5 dígitos únicos: [escola 1-3][turma 0-9][aluno 00-99] → ex. 10105
            const numero = `${schoolPrefix}${tIdx}${String(n).padStart(3, '0')}`
            alunosRows.push({
                turma_id: turma.id,
                numero_processo: numero,
                ...seedStudent,
            })
        }

        await withRetry(`alunos(${turma.nome})`, async () => {
            const { error: alErr } = await supabase.from('alunos').insert(alunosRows)
            if (alErr) throw new Error(alErr.message)
        })
        studentCount += alunosRows.length
        log(school.key, `Alunos ${turma.nome}: ${STUDENTS_PER_TURMA}`)
        await sleep(80)
    }

    log(school.key, `Alunos total: ${studentCount}`)

    let notasSummary = { notas: 0, notasFinais: 0, turmas: 0 }
    if (!skipNotas) {
        notasSummary = await seedNotasForEscola(supabase, escola.id, school.key)
        log(
            school.key,
            `Notas: ${notasSummary.notas} lançamentos · ${notasSummary.notasFinais} notas finais`
        )
    } else {
        log(school.key, 'Notas: ignoradas (--skip-notas)')
    }

    return {
        escola,
        admin,
        teachers: teachers.map((t) => ({
            email: t.email,
            nome: t.nome_completo,
            especialidade: t.plan.especialidade,
        })),
        turmas: turmas.map((t) => ({
            nome: t.nome,
            classe: t.classe,
            nivel: t.nivel_ensino,
            curso: t.curso,
            alunos: STUDENTS_PER_TURMA,
        })),
        alunos: studentCount,
        templates: templateCount,
        notas: notasSummary.notas,
        notasFinais: notasSummary.notasFinais,
    }
}

/** Completa alunos em falta nas turmas de uma escola seed já existente. */
async function ensureStudentsForSchool(supabase, school, escolaId) {
    const { data: turmas, error } = await withRetry(`turmas(${school.key})`, async () => {
        const res = await supabase
            .from('turmas')
            .select('id, nome')
            .eq('escola_id', escolaId)
            .order('nome')
        if (res.error) throw new Error(res.error.message)
        return res
    })
    if (error) throw new Error(error.message)

    const baseIndex = school.key === 'primaria' ? 0 : school.key === 'secundaria' ? 500 : 1500
    const schoolPrefix = school.key === 'primaria' ? '1' : school.key === 'secundaria' ? '2' : '3'
    let added = 0

    for (let tIdx = 0; tIdx < (turmas || []).length; tIdx++) {
        const turma = turmas[tIdx]
        const turmaDef =
            school.turmas.find((t) => t.nome === turma.nome) ||
            school.turmas[tIdx] ||
            { nome: turma.nome, classe: turma.nome, curso: null }

        const { data: existingAlunos, error: aErr } = await withRetry(
            `count-alunos(${turma.nome})`,
            async () => {
                const res = await supabase
                    .from('alunos')
                    .select('id, numero_processo')
                    .eq('turma_id', turma.id)
                    .eq('ativo', true)
                if (res.error) throw new Error(res.error.message)
                return res
            }
        )
        if (aErr) throw new Error(aErr.message)

        const have = existingAlunos?.length || 0
        if (have >= STUDENTS_PER_TURMA) continue

        const usedNums = new Set((existingAlunos || []).map((a) => a.numero_processo))
        const toAdd = []
        for (let n = have; n < STUDENTS_PER_TURMA; n++) {
            const globalIndex = baseIndex + tIdx * STUDENTS_PER_TURMA + n
            let numero = `${schoolPrefix}${tIdx}${String(n).padStart(3, '0')}`
            // Evitar colisão se o número já existir noutro sítio
            let suffix = 0
            while (usedNums.has(numero)) {
                suffix += 1
                numero = `${schoolPrefix}${tIdx}${String((n + suffix) % 1000).padStart(3, '0')}`
            }
            usedNums.add(numero)
            toAdd.push({
                turma_id: turma.id,
                numero_processo: numero,
                ...buildStudentSeed(school, turmaDef, globalIndex),
            })
        }

        if (!toAdd.length) continue

        await withRetry(`fill-alunos(${turma.nome})`, async () => {
            const { error: iErr } = await supabase.from('alunos').insert(toAdd)
            if (iErr) throw new Error(iErr.message)
        })
        added += toAdd.length
        log(school.key, `Alunos em falta em ${turma.nome}: +${toAdd.length} (agora ${have + toAdd.length})`)
        await sleep(80)
    }

    return added
}

async function resumeSeed(supabase) {
    log('resume', 'A completar seed sem limpar dados existentes…')
    const existing = await listSeedEscolas(supabase)
    const byCodigo = new Map(existing.map((e) => [e.codigo_escola, e]))
    const summary = []

    for (const school of SCHOOLS) {
        const found = byCodigo.get(school.codigo_escola)
        if (!found) {
            log('resume', `Escola em falta → criar ${school.codigo_escola}`)
            summary.push(await seedSchool(supabase, school))
            await sleep(300)
            continue
        }

        log('resume', `Escola já existe → completar alunos/notas ${school.codigo_escola}`)
        const alunosAdded = await ensureStudentsForSchool(supabase, school, found.id)
        let notasSummary = { notas: 0, notasFinais: 0 }
        if (!skipNotas) {
            notasSummary = await seedNotasForEscola(supabase, found.id, school.key)
        }
        const admin = buildAdminPlan(school)
        summary.push({
            escola: found,
            admin,
            teachers: [],
            turmas: [],
            alunos: alunosAdded ? `+${alunosAdded}` : '—',
            templates: '—',
            notas: notasSummary.notas,
            notasFinais: notasSummary.notasFinais,
            resumed: true,
        })
        await sleep(300)
    }

    return summary
}

async function seedNotasOnly(supabase) {
    log('notas', 'Modo --notas-only: a (re)lançar notas nas escolas seed')
    const existing = await listSeedEscolas(supabase)
    if (!existing.length) {
        throw new Error('Nenhuma escola seed encontrada. Execute npm run seed:test primeiro.')
    }
    const summary = []
    for (const escola of existing) {
        const key =
            SCHOOLS.find((s) => s.codigo_escola === escola.codigo_escola)?.key || escola.codigo_escola
        const notasSummary = await seedNotasForEscola(supabase, escola.id, key)
        summary.push({
            escola,
            admin: { email: escola.email || '—' },
            teachers: [],
            turmas: [],
            alunos: '—',
            templates: '—',
            notas: notasSummary.notas,
            notasFinais: notasSummary.notasFinais,
            resumed: true,
        })
        await sleep(300)
    }
    return summary
}

async function main() {
    console.log('\n🌱 EduGest — Seed de testes\n')
    const supabase = createServiceClient()
    await assertNoExistingSeed(supabase)

    const summary = []
    if (notasOnly) {
        summary.push(...(await seedNotasOnly(supabase)))
    } else if (resume) {
        summary.push(...(await resumeSeed(supabase)))
    } else if (!direcoesOnly) {
        for (const school of SCHOOLS) {
            summary.push(await seedSchool(supabase, school))
            await sleep(200)
        }
    } else {
        log('mode', '--direcoes-only: a reutilizar escolas seed existentes')
    }

    const escolasForDirecoes =
        summary.length > 0
            ? summary.map((s) => ({
                  id: s.escola.id,
                  codigo_escola: s.escola.codigo_escola,
                  user_id: s.escola.user_id || null,
              }))
            : undefined

    let direcoesSummary = { provincials: [], municipals: [], counts: { circularesProvinciais: 0, circularesMunicipais: 0, solicitacoes: 0 } }
    if (!notasOnly) {
        const dms = await listSeedDirecoesMunicipais(supabase)
        const dps = await listSeedDirecoesProvinciais(supabase)
        if (resume && (dms.length > 0 || dps.length > 0) && !force) {
            log('resume', `Direções seed já existem (${dps.length} DP · ${dms.length} DM) — a saltar`)
            direcoesSummary = {
                provincials: dps.map((d) => ({ provincia: d.provincia, email: d.email, ativo: d.ativo })),
                municipals: dms.map((d) => ({
                    municipio: d.municipio,
                    provincia: d.provincia,
                    email: d.email,
                    ativo: d.ativo,
                    bloqueado: d.bloqueado,
                })),
                counts: { circularesProvinciais: 0, circularesMunicipais: 0, solicitacoes: 0 },
            }
        } else {
            direcoesSummary = await seedDirecoes(supabase, { escolas: escolasForDirecoes })
        }
    }

    console.log('\n✅ Seed concluída\n')
    console.log(`Palavra-passe comum: ${SEED_PASSWORD}`)
    console.log('Documento de credenciais: docs/SEED_TEST_CREDENTIALS.md\n')

    for (const s of summary) {
        console.log(`• ${s.escola.nome} (${s.escola.codigo_escola})${s.resumed ? ' [resume]' : ''}`)
        console.log(`  Admin: ${s.admin.email}`)
        console.log(
            `  Professores: ${s.teachers.length || '—'} · Turmas: ${s.turmas.length || '—'} · Alunos: ${s.alunos}` +
                ` · Templates: ${s.templates}` +
                ` · Notas: ${s.notas || 0} · Finais: ${s.notasFinais || 0}`
        )
        for (const t of s.turmas || []) {
            const curso = t.curso ? ` · ${t.curso}` : ''
            console.log(`    – ${t.nome}${curso}`)
        }
    }

    if (!notasOnly) {
        console.log('\n• Direções Provinciais')
        for (const p of direcoesSummary.provincials) {
            console.log(`  ${p.provincia}: ${p.email}${p.ativo ? '' : ' (pendente)'}`)
        }
        console.log('• Direções Municipais')
        for (const m of direcoesSummary.municipals) {
            const flags = [m.ativo ? null : 'pendente', m.bloqueado ? 'bloqueada' : null].filter(Boolean)
            console.log(`  ${m.municipio}/${m.provincia}: ${m.email}${flags.length ? ` (${flags.join(', ')})` : ''}`)
        }
        console.log(
            `\n  Dados extra: ${direcoesSummary.counts.circularesProvinciais} circ. prov. · ` +
                `${direcoesSummary.counts.circularesMunicipais} circ. mun. · ` +
                `${direcoesSummary.counts.solicitacoes} solicitações\n`
        )
    }
}

const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('seed-test-data.mjs')

if (isDirectRun) {
    main().catch((err) => {
        console.error('\n❌ Seed falhou:', err.message || err)
        process.exit(1)
    })
}
