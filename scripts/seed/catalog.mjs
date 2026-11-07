/**
 * Static catalog for test seed: schools, people names, discipline templates.
 */

import { ANO_LECTIVO, SEED_PASSWORD, seedEmail } from './_shared.mjs'

/** Alunos por turma — mínimo pedido para demos (≥10). */
export const STUDENTS_PER_TURMA = 12

const COMPONENTES_TRIMESTRAIS = [
    {
        nome: 'Média das Avaliações Contínuas',
        codigo_componente: 'MAC',
        peso_percentual: 100,
        ordem: 1,
        is_calculated: false,
        trimestres: [1, 2, 3],
    },
    {
        nome: 'Nota da Prova Trimestral',
        codigo_componente: 'NPT',
        peso_percentual: 100,
        ordem: 2,
        is_calculated: false,
        trimestres: [1, 2, 3],
    },
    {
        nome: 'Média Trimestral',
        codigo_componente: 'MT',
        peso_percentual: 100,
        ordem: 3,
        is_calculated: true,
        formula_expression: '(MAC + NPT) / 2',
        depends_on_codes: ['MAC', 'NPT'],
        tipo_calculo: 'trimestral',
        trimestres: [1, 2, 3],
    },
    {
        nome: 'Média Final Anual',
        codigo_componente: 'MF',
        peso_percentual: 100,
        ordem: 4,
        is_calculated: true,
        formula_expression: '(MT1 + MT2 + MT3) / 3',
        depends_on_codes: ['MT'],
        tipo_calculo: 'anual',
        // Só no 3.º trimestre — permite Termos / Boletim anual / Pauta final
        trimestres: [3],
    },
]

function withComponentes(disciplinas) {
    return disciplinas.map((d) => ({
        ...d,
        componentes: COMPONENTES_TRIMESTRAIS.map((c) => ({ ...c, depends_on_codes: c.depends_on_codes ? [...c.depends_on_codes] : [] })),
    }))
}

const DISCIPLINAS_PRIMARIO_1_4 = withComponentes([
    { nome: 'Língua Portuguesa', codigo_disciplina: 'LP', carga_horaria: 6, ordem: 1, is_obrigatoria: true },
    { nome: 'Matemática', codigo_disciplina: 'MAT', carga_horaria: 6, ordem: 2, is_obrigatoria: true },
    { nome: 'Estudo do Meio', codigo_disciplina: 'EM', carga_horaria: 4, ordem: 3, is_obrigatoria: true },
    { nome: 'Educação Manual Plástica', codigo_disciplina: 'EMP', carga_horaria: 2, ordem: 4, is_obrigatoria: false },
    { nome: 'Educação Física', codigo_disciplina: 'EF', carga_horaria: 2, ordem: 5, is_obrigatoria: false },
])

const DISCIPLINAS_PRIMARIO_5_6 = withComponentes([
    { nome: 'Língua Portuguesa', codigo_disciplina: 'LP', carga_horaria: 5, ordem: 1, is_obrigatoria: true },
    { nome: 'Matemática', codigo_disciplina: 'MAT', carga_horaria: 5, ordem: 2, is_obrigatoria: true },
    { nome: 'Ciências da Natureza', codigo_disciplina: 'CN', carga_horaria: 3, ordem: 3, is_obrigatoria: true },
    { nome: 'História', codigo_disciplina: 'HIS', carga_horaria: 2, ordem: 4, is_obrigatoria: true },
    { nome: 'Geografia', codigo_disciplina: 'GEO', carga_horaria: 2, ordem: 5, is_obrigatoria: true },
    { nome: 'Inglês', codigo_disciplina: 'ING', carga_horaria: 3, ordem: 6, is_obrigatoria: false },
    { nome: 'Educação Física', codigo_disciplina: 'EF', carga_horaria: 2, ordem: 7, is_obrigatoria: false },
])

const DISCIPLINAS_SECUNDARIO_GERAL = withComponentes([
    { nome: 'Língua Portuguesa', codigo_disciplina: 'LP', carga_horaria: 4, ordem: 1, is_obrigatoria: true },
    { nome: 'Matemática', codigo_disciplina: 'MAT', carga_horaria: 5, ordem: 2, is_obrigatoria: true },
    { nome: 'Física', codigo_disciplina: 'FIS', carga_horaria: 3, ordem: 3, is_obrigatoria: true },
    { nome: 'Química', codigo_disciplina: 'QUI', carga_horaria: 3, ordem: 4, is_obrigatoria: true },
    { nome: 'Biologia', codigo_disciplina: 'BIO', carga_horaria: 3, ordem: 5, is_obrigatoria: true },
    { nome: 'História', codigo_disciplina: 'HIS', carga_horaria: 2, ordem: 6, is_obrigatoria: true },
    { nome: 'Geografia', codigo_disciplina: 'GEO', carga_horaria: 2, ordem: 7, is_obrigatoria: true },
    { nome: 'Inglês', codigo_disciplina: 'ING', carga_horaria: 3, ordem: 8, is_obrigatoria: false },
    { nome: 'Educação Física', codigo_disciplina: 'EF', carga_horaria: 2, ordem: 9, is_obrigatoria: false },
])

/** II ciclo — área Ciências */
const DISCIPLINAS_SECUNDARIO_CIENCIAS = withComponentes([
    { nome: 'Língua Portuguesa', codigo_disciplina: 'LP', carga_horaria: 3, ordem: 1, is_obrigatoria: true },
    { nome: 'Matemática', codigo_disciplina: 'MAT', carga_horaria: 5, ordem: 2, is_obrigatoria: true },
    { nome: 'Física', codigo_disciplina: 'FIS', carga_horaria: 4, ordem: 3, is_obrigatoria: true },
    { nome: 'Química', codigo_disciplina: 'QUI', carga_horaria: 4, ordem: 4, is_obrigatoria: true },
    { nome: 'Biologia', codigo_disciplina: 'BIO', carga_horaria: 4, ordem: 5, is_obrigatoria: true },
    { nome: 'Inglês', codigo_disciplina: 'ING', carga_horaria: 3, ordem: 6, is_obrigatoria: false },
    { nome: 'Educação Física', codigo_disciplina: 'EF', carga_horaria: 2, ordem: 7, is_obrigatoria: false },
])

/** II ciclo — área Humanidades */
const DISCIPLINAS_SECUNDARIO_HUMANIDADES = withComponentes([
    { nome: 'Língua Portuguesa', codigo_disciplina: 'LP', carga_horaria: 5, ordem: 1, is_obrigatoria: true },
    { nome: 'História', codigo_disciplina: 'HIS', carga_horaria: 4, ordem: 2, is_obrigatoria: true },
    { nome: 'Geografia', codigo_disciplina: 'GEO', carga_horaria: 4, ordem: 3, is_obrigatoria: true },
    { nome: 'Filosofia', codigo_disciplina: 'FIL', carga_horaria: 3, ordem: 4, is_obrigatoria: true },
    { nome: 'Inglês', codigo_disciplina: 'ING', carga_horaria: 4, ordem: 5, is_obrigatoria: true },
    { nome: 'Francês', codigo_disciplina: 'FRA', carga_horaria: 3, ordem: 6, is_obrigatoria: false },
    { nome: 'Educação Física', codigo_disciplina: 'EF', carga_horaria: 2, ordem: 7, is_obrigatoria: false },
])

function templatesForClasses(classes, disciplinas) {
    const out = []
    for (const classe of classes) {
        for (const d of disciplinas) {
            out.push({ classe, ...d })
        }
    }
    return out
}

export const FIRST_NAMES_M = [
    'João', 'Carlos', 'Pedro', 'Miguel', 'António', 'Francisco', 'Domingos', 'Manuel',
    'José', 'Paulo', 'André', 'Rui', 'Hélder', 'Sérgio', 'Bruno', 'Edgar', 'Mateus', 'Nelson',
    'Lucas', 'Daniel', 'Simão', 'Tomás', 'Gilberto', 'Valentim', 'Óscar', 'Dário',
]
export const FIRST_NAMES_F = [
    'Maria', 'Ana', 'Isabel', 'Catarina', 'Sofia', 'Beatriz', 'Helena', 'Teresa',
    'Carla', 'Laura', 'Marta', 'Sandra', 'Patrícia', 'Vanessa', 'Cláudia', 'Daniela', 'Érica', 'Neusa',
    'Joana', 'Lúcia', 'Fernanda', 'Cristina', 'Vera', 'Alice', 'Inês', 'Raquel',
]
export const LAST_NAMES = [
    'Silva', 'Costa', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Rodrigues', 'Almeida',
    'Monteiro', 'Gonçalves', 'Nascimento', 'Dos Santos', 'Campos', 'Mendes', 'Cardoso', 'Lopes',
    'Barbosa', 'Figueiredo', 'Ribeiro', 'Teixeira', 'Pinto', 'Morais', 'Vieira', 'Cruz',
]

export function buildPersonName(index, gender = index % 2 === 0 ? 'M' : 'F') {
    const first = gender === 'M'
        ? FIRST_NAMES_M[index % FIRST_NAMES_M.length]
        : FIRST_NAMES_F[index % FIRST_NAMES_F.length]
    const last1 = LAST_NAMES[index % LAST_NAMES.length]
    const last2 = LAST_NAMES[(index * 3 + 1) % LAST_NAMES.length]
    return { nome: `${first} ${last1} ${last2}`, genero: gender, first, last1 }
}

/** @typedef {'primario'|'secundario'|'complexo'} SchoolKind */

/**
 * @type {Array<{
 *  key: string,
 *  kind: SchoolKind,
 *  nome: string,
 *  codigo_escola: string,
 *  provincia: string,
 *  municipio: string,
 *  endereco: string,
 *  telefone: string,
 *  adminLocal: string,
 *  adminNome: string,
 *  classesTemplates: string[],
 *  turmas: Array<{
 *    nome: string,
 *    classe: string,
 *    nivel_ensino: string,
 *    turno: string,
 *    teacherIndex: number,
 *    curso?: string | null,
 *    areaCurricular?: 'geral'|'ciencias'|'humanidades',
 *  }>,
 *  teacherSpecialties: string[],
 * }>}
 */
export const SCHOOLS = [
    {
        key: 'primaria',
        kind: 'primario',
        nome: 'Escola Primária Seed Luanda',
        codigo_escola: 'SEED-PRI-2026',
        provincia: 'Luanda',
        municipio: 'Belas',
        endereco: 'Rua das Acácias, Bairro do Golf, Belas',
        telefone: '+244923000001',
        adminLocal: 'admin.primaria',
        adminNome: 'Administrador Escola Primária Seed',
        classesTemplates: ['1ª Classe', '2ª Classe', '3ª Classe', '4ª Classe', '5ª Classe', '6ª Classe'],
        turmas: [
            { nome: '1ª Classe A', classe: '1ª Classe', nivel_ensino: 'Ensino Primário', turno: 'manhã', teacherIndex: 0 },
            { nome: '2ª Classe A', classe: '2ª Classe', nivel_ensino: 'Ensino Primário', turno: 'manhã', teacherIndex: 1 },
            { nome: '3ª Classe A', classe: '3ª Classe', nivel_ensino: 'Ensino Primário', turno: 'tarde', teacherIndex: 2 },
            { nome: '4ª Classe A', classe: '4ª Classe', nivel_ensino: 'Ensino Primário', turno: 'manhã', teacherIndex: 3 },
            { nome: '5ª Classe A', classe: '5ª Classe', nivel_ensino: 'Ensino Primário', turno: 'manhã', teacherIndex: 4 },
            { nome: '6ª Classe A', classe: '6ª Classe', nivel_ensino: 'Ensino Primário', turno: 'tarde', teacherIndex: 5 },
        ],
        teacherSpecialties: [
            'Ensino Primário',
            'Ensino Primário',
            'Ensino Primário',
            'Ensino Primário',
            'Matemática / Ciências',
            'Língua Portuguesa',
        ],
    },
    {
        key: 'secundaria',
        kind: 'secundario',
        nome: 'Escola Secundária Seed Benguela',
        codigo_escola: 'SEED-SEC-2026',
        provincia: 'Benguela',
        municipio: 'Benguela',
        endereco: 'Avenida 14 de Abril, Centro, Benguela',
        telefone: '+244923000002',
        adminLocal: 'admin.secundaria',
        adminNome: 'Administrador Escola Secundária Seed',
        classesTemplates: [
            '7ª Classe', '8ª Classe', '9ª Classe',
            '10ª Classe', '11ª Classe', '12ª Classe',
            '10ª Classe Ciências', '11ª Classe Ciências', '12ª Classe Ciências',
            '10ª Classe Humanidades', '11ª Classe Humanidades', '12ª Classe Humanidades',
        ],
        turmas: [
            { nome: '7ª Classe A', classe: '7ª Classe', nivel_ensino: 'Ensino Secundário', turno: 'manhã', teacherIndex: 0, areaCurricular: 'geral' },
            { nome: '8ª Classe A', classe: '8ª Classe', nivel_ensino: 'Ensino Secundário', turno: 'manhã', teacherIndex: 1, areaCurricular: 'geral' },
            { nome: '9ª Classe A', classe: '9ª Classe', nivel_ensino: 'Ensino Secundário', turno: 'tarde', teacherIndex: 2, areaCurricular: 'geral' },
            {
                nome: '10ª Classe Ciências A',
                classe: '10ª Classe Ciências',
                nivel_ensino: 'Ensino Secundário',
                turno: 'manhã',
                teacherIndex: 3,
                curso: 'Ciências',
                areaCurricular: 'ciencias',
            },
            {
                nome: '11ª Classe Ciências A',
                classe: '11ª Classe Ciências',
                nivel_ensino: 'Ensino Secundário',
                turno: 'manhã',
                teacherIndex: 4,
                curso: 'Ciências',
                areaCurricular: 'ciencias',
            },
            {
                nome: '12ª Classe Humanidades A',
                classe: '12ª Classe Humanidades',
                nivel_ensino: 'Ensino Secundário',
                turno: 'tarde',
                teacherIndex: 5,
                curso: 'Humanidades',
                areaCurricular: 'humanidades',
            },
        ],
        teacherSpecialties: [
            'Matemática',
            'Física',
            'Química',
            'Língua Portuguesa',
            'Biologia',
            'História / Geografia',
        ],
    },
    {
        key: 'complexo',
        kind: 'complexo',
        nome: 'Complexo Escolar Seed Huambo',
        codigo_escola: 'SEED-CMP-2026',
        provincia: 'Huambo',
        municipio: 'Huambo',
        endereco: 'Rua Comandante Dangereux, Huambo',
        telefone: '+244923000003',
        adminLocal: 'admin.complexo',
        adminNome: 'Administrador Complexo Escolar Seed',
        classesTemplates: [
            '1ª Classe', '2ª Classe', '3ª Classe', '4ª Classe', '5ª Classe', '6ª Classe',
            '7ª Classe', '8ª Classe', '9ª Classe',
            '10ª Classe', '11ª Classe', '12ª Classe',
            '10ª Classe Ciências', '12ª Classe Humanidades',
        ],
        turmas: [
            { nome: '2ª Classe B', classe: '2ª Classe', nivel_ensino: 'Ensino Primário', turno: 'manhã', teacherIndex: 0 },
            { nome: '4ª Classe B', classe: '4ª Classe', nivel_ensino: 'Ensino Primário', turno: 'tarde', teacherIndex: 1 },
            { nome: '6ª Classe B', classe: '6ª Classe', nivel_ensino: 'Ensino Primário', turno: 'manhã', teacherIndex: 2 },
            { nome: '8ª Classe B', classe: '8ª Classe', nivel_ensino: 'Ensino Secundário', turno: 'manhã', teacherIndex: 3, areaCurricular: 'geral' },
            {
                nome: '10ª Classe Ciências B',
                classe: '10ª Classe Ciências',
                nivel_ensino: 'Ensino Secundário',
                turno: 'tarde',
                teacherIndex: 4,
                curso: 'Ciências',
                areaCurricular: 'ciencias',
            },
            {
                nome: '12ª Classe Humanidades B',
                classe: '12ª Classe Humanidades',
                nivel_ensino: 'Ensino Secundário',
                turno: 'manhã',
                teacherIndex: 5,
                curso: 'Humanidades',
                areaCurricular: 'humanidades',
            },
        ],
        teacherSpecialties: [
            'Ensino Primário',
            'Ensino Primário',
            'Ensino Primário',
            'Matemática',
            'Física / Química',
            'História / Inglês',
        ],
    },
]

function disciplinasForClasse(classe) {
    const normalized = String(classe || '')
    const num = parseInt(normalized.replace(/\D/g, ''), 10)
    const lower = normalized.toLowerCase()

    if (lower.includes('ciências') || lower.includes('ciencias')) {
        return DISCIPLINAS_SECUNDARIO_CIENCIAS
    }
    if (lower.includes('humanidades')) {
        return DISCIPLINAS_SECUNDARIO_HUMANIDADES
    }
    if (num >= 1 && num <= 4) return DISCIPLINAS_PRIMARIO_1_4
    if (num >= 5 && num <= 6) return DISCIPLINAS_PRIMARIO_5_6
    return DISCIPLINAS_SECUNDARIO_GERAL
}

export function templatesForSchool(school) {
    const out = []
    for (const classe of school.classesTemplates) {
        out.push(...templatesForClasses([classe], disciplinasForClasse(classe)))
    }
    return out
}

export function buildTeacherPlan(school) {
    return school.teacherSpecialties.map((especialidade, index) => {
        const person = buildPersonName(index + 10, index % 2 === 0 ? 'M' : 'F')
        const local = `prof.${school.key}.${index + 1}`
        return {
            index,
            email: seedEmail(local),
            password: SEED_PASSWORD,
            nome_completo: `Prof. ${person.nome}`,
            genero: person.genero,
            especialidade,
            numero_agente: `SEED-${school.key.toUpperCase()}-P${String(index + 1).padStart(2, '0')}`,
            telefone: `+2449${String(23010000 + index + school.key.length * 100).padStart(8, '0')}`,
            categoria_docente: index % 2 === 0 ? 'PROFESSOR_TITULAR' : 'PROFESSOR_AUXILIAR',
            grau_academico: index % 2 === 0 ? 'LICENCIATURA' : 'MESTRADO',
            area_formacao: especialidade,
            categoria_laboral: 'Quadro Definitivo',
            nacionalidade: 'Angolana',
            estado_civil: index % 2 === 0 ? 'Casado' : 'Solteiro',
            provincia_residencia: school.provincia,
            municipio_residencia: school.municipio,
            bairro_residencia: 'Centro',
            endereco_completo: school.endereco,
            data_nascimento: `19${70 + (index % 20)}-0${(index % 8) + 1}-15`,
            data_inicio_funcoes: '2018-02-01',
        }
    })
}

export function buildAdminPlan(school) {
    return {
        email: seedEmail(school.adminLocal),
        password: SEED_PASSWORD,
        nome: school.adminNome,
    }
}

export const OBS_ACADEMICAS = [
    'Aluno com dificuldades de aprendizagem; necessita acompanhamento.',
    'Faltas frequentes; rendimento irregular ao longo do ano.',
    'Participa pouco nas aulas; recomenda-se reforço pedagógico.',
    'Aluno irregular: bom em algumas disciplinas, fraco noutras.',
    'Progresso lento, mas mostra esforço quando acompanhado.',
    'Rendimento satisfatório; pode melhorar a organização do estudo.',
    'Bom desempenho geral; mantém ritmo estável.',
    'Aluno aplicado e responsável; participa activamente.',
    'Excelente aproveitamento; candidato a quadro de honra.',
    'Atenção dispersa em sala; notas abaixo do esperado.',
    'Transferido de outra escola; ainda a adaptar-se ao ritmo da turma.',
    'Problemas familiares reportados pelo encarregado; impacto no aproveitamento.',
]

/**
 * Perfil de desempenho do aluno (determinístico, estável entre re-seeds).
 * Distribuição aproximada: 18% fraco · 18% irregular · 34% médio · 20% bom · 10% excelente
 * → cerca de 25–35% de médias insuficientes na turma (realista para demo).
 */
export function studentPerformanceProfile(studentIndex) {
    const bucket = ((studentIndex * 37) + 11) % 100
    if (bucket < 18) return 'fraco'
    if (bucket < 36) return 'irregular'
    if (bucket < 70) return 'medio'
    if (bucket < 90) return 'bom'
    return 'excelente'
}

export function buildStudentSeed(school, turmaMeta, studentIndexGlobal) {
    const gender = studentIndexGlobal % 2 === 0 ? 'F' : 'M'
    const person = buildPersonName(studentIndexGlobal + 50, gender)
    const encarregadoGender = gender === 'F' ? 'M' : 'F'
    const encarregado = buildPersonName(studentIndexGlobal + 200, encarregadoGender)
    const year = 2010 + (studentIndexGlobal % 8)
    const month = String((studentIndexGlobal % 12) + 1).padStart(2, '0')
    const day = String((studentIndexGlobal % 27) + 1).padStart(2, '0')
    const perfil = studentPerformanceProfile(studentIndexGlobal)
    const cursoLabel = turmaMeta.curso ? ` Curso ${turmaMeta.curso}.` : ''

    const freqByPerfil = {
        fraco: 48 + (studentIndexGlobal % 22),
        irregular: 62 + (studentIndexGlobal % 20),
        medio: 75 + (studentIndexGlobal % 15),
        bom: 85 + (studentIndexGlobal % 10),
        excelente: 92 + (studentIndexGlobal % 8),
    }

    return {
        nome_completo: person.nome,
        genero: gender,
        data_nascimento: `${year}-${month}-${day}`,
        nacionalidade: 'Angolana',
        naturalidade: school.municipio,
        tipo_documento: 'BI',
        numero_documento: `SEED${school.key.slice(0, 3).toUpperCase()}${String(studentIndexGlobal).padStart(6, '0')}LA${String(40 + (studentIndexGlobal % 50)).padStart(3, '0')}`,
        nome_pai: `Sr. ${buildPersonName(studentIndexGlobal + 300, 'M').nome}`,
        nome_mae: `Sra. ${buildPersonName(studentIndexGlobal + 400, 'F').nome}`,
        nome_encarregado: encarregado.nome,
        parentesco_encarregado: encarregadoGender === 'M' ? 'Pai' : 'Mãe',
        telefone_encarregado: `+2449${String(24000000 + studentIndexGlobal).padStart(8, '0')}`,
        email_encarregado: seedEmail(`enc.${school.key}.${studentIndexGlobal + 1}`),
        profissao_encarregado: studentIndexGlobal % 3 === 0 ? 'Comerciante' : studentIndexGlobal % 3 === 1 ? 'Professor' : 'Funcionário Público',
        endereco: school.endereco,
        provincia: school.provincia,
        municipio: school.municipio,
        bairro: 'Seed Teste',
        rua: `Rua Seed ${studentIndexGlobal + 1}`,
        ano_ingresso: Number(ANO_LECTIVO) - (studentIndexGlobal % 3),
        escola_anterior: studentIndexGlobal % 4 === 0 ? 'Escola Municipal Anterior' : null,
        classe_anterior: turmaMeta.classe,
        observacoes_academicas: `${OBS_ACADEMICAS[studentIndexGlobal % OBS_ACADEMICAS.length]}${cursoLabel}`,
        frequencia_anual: Math.min(100, freqByPerfil[perfil]),
        ativo: true,
    }
}

const GRADE_RANGES = {
    fraco: { min: 3, max: 9.8 },
    irregular: { min: 6, max: 15 },
    medio: { min: 9.5, max: 15.5 },
    bom: { min: 12.5, max: 17.5 },
    excelente: { min: 15.5, max: 20 },
}

/**
 * Nota (0–20) com perfil por aluno + variação por disciplina/trimestre.
 * Mistura realista: ~25–35% insuficientes, não só positivas.
 */
export function buildGradeValue(studentIndex, disciplinaOrdem, trimestre, componentSalt = 0) {
    const perfil = studentPerformanceProfile(studentIndex)
    const range = GRADE_RANGES[perfil]
    const noise =
        ((studentIndex * 19 + disciplinaOrdem * 29 + trimestre * 11 + componentSalt * 41) % 1000) / 1000

    let valor = range.min + noise * (range.max - range.min)

    // Irregular: em ~30% das disciplinas cai para insuficiente
    if (perfil === 'irregular') {
        const flip = (studentIndex * 7 + disciplinaOrdem * 5 + trimestre) % 100
        if (flip < 30) valor = 4 + noise * 5.5
    }

    // Médio: ocasionalmente chumbo numa disciplina (12%)
    if (perfil === 'medio') {
        const flip = (studentIndex * 13 + disciplinaOrdem * 3 + componentSalt) % 100
        if (flip < 12) valor = 5 + noise * 4.5
    }

    // Fraco: ocasionalmente sobe ao suficiente justo (18%)
    if (perfil === 'fraco') {
        const flip = (studentIndex * 11 + disciplinaOrdem + trimestre * 2) % 100
        if (flip < 18) valor = 10 + noise * 2.5
    }

    // Variação MAC vs NPT: prova trimestral pode ser pior/melhor
    if (componentSalt === 2) {
        valor += ((studentIndex + disciplinaOrdem) % 2 === 0 ? -0.8 : 0.6)
    }

    return round1(valor)
}

const OBS_NOTA_NEG = [
    'Não alcançou os objectivos mínimos.',
    'Faltou a várias avaliações contínuas.',
    'Dificuldades graves na matéria.',
    'Não entregou trabalhos pedidos.',
    'Desinteresse manifesto nas aulas.',
    'Precisa de recuperação urgente.',
]
const OBS_NOTA_NEUTRA = [
    'Cumpriu o mínimo exigido.',
    'Resultado irregular neste trimestre.',
    'Pode melhorar com mais estudo.',
    'Participação aceitável.',
    null, // muitas notas sem observação
    null,
]
const OBS_NOTA_POS = [
    'Bom domínio dos conteúdos.',
    'Participação activa e consistente.',
    'Excelente desempenho na prova.',
    'Evolução positiva face ao trimestre anterior.',
    null,
    null,
]

/** Observação de lançamento alinhada com a nota (pode ser null). */
export function buildGradeObservation(valor, studentIndex, disciplinaOrdem, trimestre, codigo) {
    const roll = (studentIndex * 23 + disciplinaOrdem * 17 + trimestre * 9 + (codigo?.length || 0)) % 100
    // ~40% das notas sem observação
    if (roll < 40) return null

    let pool
    if (valor < 10) pool = OBS_NOTA_NEG
    else if (valor < 14) pool = OBS_NOTA_NEUTRA
    else pool = OBS_NOTA_POS

    const pick = pool[(studentIndex + disciplinaOrdem + trimestre + roll) % pool.length]
    return pick || null
}

function round1(n) {
    return Math.min(20, Math.max(0, Math.round(n * 10) / 10))
}

export function classificacaoFromNota(nota) {
    if (nota >= 17) return 'Excelente'
    if (nota >= 14) return 'Bom'
    if (nota >= 10) return 'Suficiente'
    return 'Insuficiente'
}

export { ANO_LECTIVO, SEED_PASSWORD }
