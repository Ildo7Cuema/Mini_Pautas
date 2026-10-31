/**
 * Static catalog for test seed: schools, people names, discipline templates.
 */

import { ANO_LECTIVO, SEED_PASSWORD, seedEmail } from './_shared.mjs'

const COMPONENTES_PADRAO = [
    { nome: 'Média das Avaliações Contínuas', codigo_componente: 'MAC', peso_percentual: 100, ordem: 1 },
    { nome: 'Nota da Prova Trimestral', codigo_componente: 'NPT', peso_percentual: 100, ordem: 2 },
    { nome: 'Média Trimestral', codigo_componente: 'MT', peso_percentual: 100, ordem: 3 },
]

function withComponentes(disciplinas) {
    return disciplinas.map((d) => ({
        ...d,
        componentes: COMPONENTES_PADRAO.map((c) => ({ ...c })),
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

const DISCIPLINAS_SECUNDARIO = withComponentes([
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
]
export const FIRST_NAMES_F = [
    'Maria', 'Ana', 'Isabel', 'Catarina', 'Sofia', 'Beatriz', 'Helena', 'Teresa',
    'Carla', 'Laura', 'Marta', 'Sandra', 'Patrícia', 'Vanessa', 'Cláudia', 'Daniela', 'Érica', 'Neusa',
]
export const LAST_NAMES = [
    'Silva', 'Costa', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Rodrigues', 'Almeida',
    'Monteiro', 'Gonçalves', 'Nascimento', 'Dos Santos', 'Campos', 'Mendes', 'Cardoso', 'Lopes',
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
 *  turmas: Array<{ nome: string, classe: string, nivel_ensino: string, turno: string, teacherIndex: number }>,
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
            { nome: '5ª Classe A', classe: '5ª Classe', nivel_ensino: 'Ensino Primário', turno: 'manhã', teacherIndex: 3 },
            { nome: '6ª Classe A', classe: '6ª Classe', nivel_ensino: 'Ensino Primário', turno: 'tarde', teacherIndex: 4 },
        ],
        teacherSpecialties: [
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
        classesTemplates: ['7ª Classe', '8ª Classe', '9ª Classe', '10ª Classe', '11ª Classe', '12ª Classe'],
        turmas: [
            { nome: '7ª Classe A', classe: '7ª Classe', nivel_ensino: 'Ensino Secundário', turno: 'manhã', teacherIndex: 0 },
            { nome: '8ª Classe A', classe: '8ª Classe', nivel_ensino: 'Ensino Secundário', turno: 'manhã', teacherIndex: 1 },
            { nome: '9ª Classe A', classe: '9ª Classe', nivel_ensino: 'Ensino Secundário', turno: 'tarde', teacherIndex: 2 },
            { nome: '10ª Classe A', classe: '10ª Classe', nivel_ensino: 'Ensino Secundário', turno: 'manhã', teacherIndex: 3 },
            { nome: '11ª Classe A', classe: '11ª Classe', nivel_ensino: 'Ensino Secundário', turno: 'tarde', teacherIndex: 4 },
        ],
        teacherSpecialties: ['Matemática', 'Física', 'Química', 'Língua Portuguesa', 'Biologia'],
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
            '7ª Classe', '8ª Classe', '9ª Classe', '10ª Classe', '11ª Classe', '12ª Classe',
        ],
        turmas: [
            { nome: '4ª Classe B', classe: '4ª Classe', nivel_ensino: 'Ensino Primário', turno: 'manhã', teacherIndex: 0 },
            { nome: '6ª Classe B', classe: '6ª Classe', nivel_ensino: 'Ensino Primário', turno: 'tarde', teacherIndex: 1 },
            { nome: '7ª Classe B', classe: '7ª Classe', nivel_ensino: 'Ensino Secundário', turno: 'manhã', teacherIndex: 2 },
            { nome: '9ª Classe B', classe: '9ª Classe', nivel_ensino: 'Ensino Secundário', turno: 'tarde', teacherIndex: 3 },
            { nome: '12ª Classe B', classe: '12ª Classe', nivel_ensino: 'Ensino Secundário', turno: 'manhã', teacherIndex: 4 },
        ],
        teacherSpecialties: [
            'Ensino Primário',
            'Ensino Primário',
            'Matemática',
            'História / Geografia',
            'Inglês',
        ],
    },
]

export function templatesForSchool(school) {
    const out = []
    for (const classe of school.classesTemplates) {
        const num = parseInt(classe.replace(/\D/g, ''), 10)
        let disciplinas
        if (num >= 1 && num <= 4) disciplinas = DISCIPLINAS_PRIMARIO_1_4
        else if (num >= 5 && num <= 6) disciplinas = DISCIPLINAS_PRIMARIO_5_6
        else disciplinas = DISCIPLINAS_SECUNDARIO
        out.push(...templatesForClasses([classe], disciplinas))
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

export function buildStudentSeed(school, turmaMeta, studentIndexGlobal) {
    const gender = studentIndexGlobal % 2 === 0 ? 'F' : 'M'
    const person = buildPersonName(studentIndexGlobal + 50, gender)
    const encarregadoGender = gender === 'F' ? 'M' : 'F'
    const encarregado = buildPersonName(studentIndexGlobal + 200, encarregadoGender)
    const year = 2010 + (studentIndexGlobal % 8)
    const month = String((studentIndexGlobal % 12) + 1).padStart(2, '0')
    const day = String((studentIndexGlobal % 27) + 1).padStart(2, '0')

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
        observacoes_academicas: 'Aluno criado pela seed de testes EduGest.',
        frequencia_anual: 85 + (studentIndexGlobal % 15),
        ativo: true,
    }
}

export { ANO_LECTIVO, SEED_PASSWORD }
