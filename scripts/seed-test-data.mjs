#!/usr/bin/env node
/**
 * Seed de testes EduGest Angola
 *
 * Cria 3 escolas (primária, secundária, complexo) com administradores,
 * professores autenticáveis, templates, turmas, disciplinas e ≥20 alunos cada.
 *
 * Uso:
 *   npm run seed:test
 *   node scripts/seed-test-data.mjs
 *   node scripts/seed-test-data.mjs --force   # apaga seed anterior e recria
 */
import {
    ANO_LECTIVO,
    SEED_MARKER,
    SEED_PASSWORD,
    createAuthUser,
    createServiceClient,
    generateProcesso,
    listSeedEscolas,
    log,
    sleep,
} from './seed/_shared.mjs'
import {
    SCHOOLS,
    buildAdminPlan,
    buildStudentSeed,
    buildTeacherPlan,
    templatesForSchool,
} from './seed/catalog.mjs'

const force = process.argv.includes('--force')
const STUDENTS_PER_SCHOOL = 20

async function assertNoExistingSeed(supabase) {
    const existing = await listSeedEscolas(supabase)
    if (existing.length === 0) return
    if (!force) {
        console.error('\nJá existe seed de teste:')
        for (const e of existing) console.error(`  - ${e.codigo_escola} · ${e.nome}`)
        console.error('\nExecute: npm run seed:test:clean')
        console.error('Ou:      npm run seed:test -- --force\n')
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
        for (const trimestre of [1, 2, 3]) {
            for (const c of t.componentes) {
                componentesRows.push({
                    disciplina_template_id: disc.id,
                    nome: c.nome,
                    codigo_componente: c.codigo_componente,
                    peso_percentual: c.peso_percentual,
                    escala_minima: 0,
                    escala_maxima: 20,
                    obrigatorio: true,
                    ordem: c.ordem,
                    trimestre,
                    is_calculated: false,
                    tipo_calculo: 'trimestral',
                    descricao: `${c.codigo_componente} · ${trimestre}º Trimestre`,
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
            },
        })
        .select('id, codigo_escola, nome')
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

        const { data: turma, error: tErr } = await supabase
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

        if (tErr) throw new Error(`turmas(${turmaDef.nome}): ${tErr.message}`)

        const { data: applied, error: aErr } = await supabase.rpc('apply_all_class_templates_to_turma', {
            p_turma_id: turma.id,
            p_classe: turmaDef.classe,
            p_professor_id: responsible.id,
        })

        if (aErr) throw new Error(`apply_templates(${turmaDef.nome}): ${aErr.message}`)

        if (school.kind !== 'primario' || turmaDef.classe.startsWith('5') || turmaDef.classe.startsWith('6')) {
            await redistributeDisciplinas(
                supabase,
                turma.id,
                teachers.map((t) => t.id)
            )
        }

        turmas.push({ ...turma, classe: turmaDef.classe, nivel_ensino: turmaDef.nivel_ensino })
        log(school.key, `Turma ${turma.nome} · templates aplicados: ${applied ?? '?'}`)
    }

    // ≥20 alunos distribuídos pelas turmas (4 por turma nas 5 turmas = 20)
    const baseIndex = school.key === 'primaria' ? 0 : school.key === 'secundaria' ? 100 : 200
    let studentCount = 0

    for (let n = 0; n < STUDENTS_PER_SCHOOL; n++) {
        const turma = turmas[n % turmas.length]
        const seedStudent = buildStudentSeed(school, turma, baseIndex + n)
        const numero = await generateProcesso(supabase, turma.id)

        const { error: alErr } = await supabase.from('alunos').insert({
            turma_id: turma.id,
            numero_processo: numero,
            ...seedStudent,
        })

        if (alErr) throw new Error(`alunos(${seedStudent.nome_completo}): ${alErr.message}`)
        studentCount += 1
    }

    log(school.key, `Alunos: ${studentCount}`)

    return {
        escola,
        admin,
        teachers: teachers.map((t) => ({
            email: t.email,
            nome: t.nome_completo,
            especialidade: t.plan.especialidade,
        })),
        turmas: turmas.map((t) => ({ nome: t.nome, classe: t.classe, nivel: t.nivel_ensino })),
        alunos: studentCount,
        templates: templateCount,
    }
}

async function main() {
    console.log('\n🌱 EduGest — Seed de testes\n')
    const supabase = createServiceClient()
    await assertNoExistingSeed(supabase)

    const summary = []
    for (const school of SCHOOLS) {
        summary.push(await seedSchool(supabase, school))
        await sleep(200)
    }

    console.log('\n✅ Seed concluída\n')
    console.log(`Palavra-passe comum: ${SEED_PASSWORD}`)
    console.log('Documento de credenciais: docs/SEED_TEST_CREDENTIALS.md\n')

    for (const s of summary) {
        console.log(`• ${s.escola.nome} (${s.escola.codigo_escola})`)
        console.log(`  Admin: ${s.admin.email}`)
        console.log(`  Professores: ${s.teachers.length} · Turmas: ${s.turmas.length} · Alunos: ${s.alunos} · Templates: ${s.templates}`)
    }
    console.log('')
}

const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('seed-test-data.mjs')

if (isDirectRun) {
    main().catch((err) => {
        console.error('\n❌ Seed falhou:', err.message || err)
        process.exit(1)
    })
}
