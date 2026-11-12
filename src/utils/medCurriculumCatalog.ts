/**
 * Catálogo normativo de disciplinas e componentes de avaliação
 * conforme o sistema de ensino geral angolano (MED / INADE / RAA).
 *
 * Fontes de referência:
 * - Plano curricular do Ensino Primário (INADE) — classes 1ª–6ª
 * - Plano curricular do Iº Ciclo do Ensino Secundário Geral — 7ª–9ª
 * - Estrutura do IIº Ciclo do Ensino Secundário Geral — 10ª–13ª
 * - Avaliação: MAC / NPT / MT / MF (prática RAA usada no sistema)
 * - Exame combinado (NEE / NEO / MEC): Decreto Executivo n.º 276/20,
 *   Calendário Escolar MED e Decreto Executivo n.º 424/25 —
 *   Língua Portuguesa e línguas estrangeiras no I/II Ciclo (classes de exame)
 *
 * Os templates gerados são editáveis: a escola pode adicionar, alterar ou apagar.
 */

import type { EscolaNatureza } from './angolaGradeScale'
import { isPrivateInstitution } from './angolaGradeScale'
import {
    CLASSES_ENSINO_PRIMARIO,
    CLASSES_ENSINO_SECUNDARIO_I,
    CLASSES_ENSINO_SECUNDARIO_II,
    type TipoEscolaCenso,
} from '../modules/censo_escolar/utils/escolaModalidade'

export interface MedDisciplinaDef {
    nome: string
    codigo_disciplina: string
    carga_horaria: number
    ordem: number
    is_obrigatoria: boolean
}

export interface MedComponenteDef {
    nome: string
    codigo_componente: string
    peso_percentual: number
    ordem: number
    is_calculated: boolean
    formula_expression?: string
    depends_on_codes?: string[]
    tipo_calculo: 'trimestral' | 'anual'
    /** Trimestres em que o componente existe (default 1–3). */
    trimestres: number[]
}

export interface MedClasseCurriculum {
    classe: string
    nivel: 'primario' | 'secundario_i' | 'secundario_ii'
    disciplinas: MedDisciplinaDef[]
}

/** Componentes de avaliação padronizados (por disciplina). */
export const MED_COMPONENTES_AVALIACAO: MedComponenteDef[] = [
    {
        nome: 'Média das Avaliações Contínuas',
        codigo_componente: 'MAC',
        peso_percentual: 100,
        ordem: 1,
        is_calculated: false,
        tipo_calculo: 'trimestral',
        trimestres: [1, 2, 3],
    },
    {
        nome: 'Nota da Prova Trimestral',
        codigo_componente: 'NPT',
        peso_percentual: 100,
        ordem: 2,
        is_calculated: false,
        tipo_calculo: 'trimestral',
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
        trimestres: [3],
    },
]

/**
 * Exame combinado escrito + oral (instituições públicas / público-privadas).
 * Decreto 276/20 art. 12.º e Calendário Escolar MED:
 * MEC = (NEE + NEO) / 2
 * MFD = 0,6 × MAC(A) + 0,4 × MEC
 *
 * Aplica-se a Língua Portuguesa e línguas estrangeiras nas classes de exame
 * do Iº e IIº Ciclo (9ª, 12ª e 13ª).
 */
export const MED_COMPONENTES_EXAME_COMBINADO: MedComponenteDef[] = [
    {
        nome: 'Nota do Exame Escrito',
        codigo_componente: 'NEE',
        peso_percentual: 100,
        ordem: 5,
        is_calculated: false,
        tipo_calculo: 'anual',
        trimestres: [3],
    },
    {
        nome: 'Nota do Exame Oral',
        codigo_componente: 'NEO',
        peso_percentual: 100,
        ordem: 6,
        is_calculated: false,
        tipo_calculo: 'anual',
        trimestres: [3],
    },
    {
        nome: 'Média do Exame Combinado',
        codigo_componente: 'MEC',
        peso_percentual: 100,
        ordem: 7,
        is_calculated: true,
        formula_expression: '(NEE + NEO) / 2',
        depends_on_codes: ['NEE', 'NEO'],
        tipo_calculo: 'anual',
        trimestres: [3],
    },
    {
        nome: 'Média Final da Disciplina (com exame combinado)',
        codigo_componente: 'MFD',
        peso_percentual: 100,
        ordem: 8,
        is_calculated: true,
        // MAC(A) = média anual das avaliações contínuas trimestrais
        formula_expression: '0.6 * ((MAC1 + MAC2 + MAC3) / 3) + 0.4 * MEC',
        depends_on_codes: ['MAC', 'MEC'],
        tipo_calculo: 'anual',
        trimestres: [3],
    },
]

/** Códigos de disciplinas de língua com exame combinado (escrito + oral). */
export const MED_LINGUAS_EXAME_COMBINADO = new Set(['LP', 'ING', 'FRA', 'FR', 'LE'])

/** Classes de exame do Iº/IIº Ciclo onde o exame combinado se enquadra. */
export const MED_CLASSES_EXAME_COMBINADO = new Set([9, 12, 13])

export function isLinguaComExameCombinado(codigoDisciplina: string): boolean {
    return MED_LINGUAS_EXAME_COMBINADO.has(String(codigoDisciplina || '').trim().toUpperCase())
}

export function classeTemExameCombinado(classe: string): boolean {
    const num = parseInt(String(classe).match(/(\d+)/)?.[1] || '0', 10)
    return MED_CLASSES_EXAME_COMBINADO.has(num)
}

/**
 * Componentes a pré-cadastrar para uma disciplina/classe.
 * NEE/NEO/MEC/MFD só em escolas não privadas, línguas, classes 9ª/12ª/13ª.
 */
export function getMedComponentesForDisciplina(opts: {
    classe: string
    codigoDisciplina: string
    natureza?: EscolaNatureza | null
}): MedComponenteDef[] {
    const base = MED_COMPONENTES_AVALIACAO.map((c) => ({
        ...c,
        depends_on_codes: c.depends_on_codes ? [...c.depends_on_codes] : undefined,
        trimestres: [...c.trimestres],
    }))

    if (isPrivateInstitution(opts.natureza)) return base
    if (!classeTemExameCombinado(opts.classe)) return base
    if (!isLinguaComExameCombinado(opts.codigoDisciplina)) return base

    return [
        ...base,
        ...MED_COMPONENTES_EXAME_COMBINADO.map((c) => ({
            ...c,
            depends_on_codes: c.depends_on_codes ? [...c.depends_on_codes] : undefined,
            trimestres: [...c.trimestres],
        })),
    ]
}

/** Todos os códigos de componentes do catálogo normativo (base + exame combinado). */
export function getAllMedComponenteDefs(): MedComponenteDef[] {
    const byCode = new Map<string, MedComponenteDef>()
    for (const c of [...MED_COMPONENTES_AVALIACAO, ...MED_COMPONENTES_EXAME_COMBINADO]) {
        byCode.set(c.codigo_componente.toUpperCase(), c)
    }
    return [...byCode.values()]
}

/** 1ª–4ª Classe — Ensino Primário (INADE). */
const PRIMARIO_1_4: MedDisciplinaDef[] = [
    { nome: 'Língua Portuguesa', codigo_disciplina: 'LP', carga_horaria: 9, ordem: 1, is_obrigatoria: true },
    { nome: 'Matemática', codigo_disciplina: 'MAT', carga_horaria: 7, ordem: 2, is_obrigatoria: true },
    { nome: 'Estudo do Meio', codigo_disciplina: 'EM', carga_horaria: 3, ordem: 3, is_obrigatoria: true },
    { nome: 'Educação Manual e Plástica', codigo_disciplina: 'EMP', carga_horaria: 2, ordem: 4, is_obrigatoria: false },
    { nome: 'Educação Musical', codigo_disciplina: 'EMUS', carga_horaria: 1, ordem: 5, is_obrigatoria: false },
    { nome: 'Educação Física', codigo_disciplina: 'EF', carga_horaria: 2, ordem: 6, is_obrigatoria: false },
]

/** 5ª–6ª Classe — Ensino Primário / III ciclo (INADE + Decreto Presidencial 162/25). */
const PRIMARIO_5_6: MedDisciplinaDef[] = [
    { nome: 'Língua Portuguesa', codigo_disciplina: 'LP', carga_horaria: 8, ordem: 1, is_obrigatoria: true },
    { nome: 'Matemática', codigo_disciplina: 'MAT', carga_horaria: 6, ordem: 2, is_obrigatoria: true },
    { nome: 'Ciências da Natureza', codigo_disciplina: 'CN', carga_horaria: 4, ordem: 3, is_obrigatoria: true },
    { nome: 'História', codigo_disciplina: 'HIS', carga_horaria: 2, ordem: 4, is_obrigatoria: true },
    { nome: 'Geografia', codigo_disciplina: 'GEO', carga_horaria: 2, ordem: 5, is_obrigatoria: true },
    { nome: 'Educação Moral e Cívica', codigo_disciplina: 'EMC', carga_horaria: 2, ordem: 6, is_obrigatoria: true },
    { nome: 'Educação Manual e Plástica', codigo_disciplina: 'EMP', carga_horaria: 2, ordem: 7, is_obrigatoria: false },
    { nome: 'Educação Musical', codigo_disciplina: 'EMUS', carga_horaria: 1, ordem: 8, is_obrigatoria: false },
    { nome: 'Educação Física', codigo_disciplina: 'EF', carga_horaria: 2, ordem: 9, is_obrigatoria: false },
]

/**
 * 7ª–9ª Classe — Iº Ciclo do Ensino Secundário Geral
 * (plano curricular MED: 12 disciplinas de formação geral).
 */
const SECUNDARIO_I: MedDisciplinaDef[] = [
    { nome: 'Língua Portuguesa', codigo_disciplina: 'LP', carga_horaria: 4, ordem: 1, is_obrigatoria: true },
    { nome: 'Língua Estrangeira (Inglês)', codigo_disciplina: 'ING', carga_horaria: 3, ordem: 2, is_obrigatoria: true },
    { nome: 'Matemática', codigo_disciplina: 'MAT', carga_horaria: 5, ordem: 3, is_obrigatoria: true },
    { nome: 'Biologia', codigo_disciplina: 'BIO', carga_horaria: 3, ordem: 4, is_obrigatoria: true },
    { nome: 'Física', codigo_disciplina: 'FIS', carga_horaria: 3, ordem: 5, is_obrigatoria: true },
    { nome: 'Química', codigo_disciplina: 'QUI', carga_horaria: 3, ordem: 6, is_obrigatoria: true },
    { nome: 'Geografia', codigo_disciplina: 'GEO', carga_horaria: 2, ordem: 7, is_obrigatoria: true },
    { nome: 'História', codigo_disciplina: 'HIS', carga_horaria: 2, ordem: 8, is_obrigatoria: true },
    { nome: 'Educação Moral e Cívica', codigo_disciplina: 'EMC', carga_horaria: 2, ordem: 9, is_obrigatoria: true },
    { nome: 'Educação Visual e Plástica', codigo_disciplina: 'EVP', carga_horaria: 2, ordem: 10, is_obrigatoria: false },
    { nome: 'Educação Laboral e Empreendedorismo', codigo_disciplina: 'ELE', carga_horaria: 2, ordem: 11, is_obrigatoria: false },
    { nome: 'Educação Física', codigo_disciplina: 'EF', carga_horaria: 2, ordem: 12, is_obrigatoria: false },
]

/**
 * 10ª–13ª Classe — IIº Ciclo (núcleo comum + ciências).
 * Escolas de área económico-jurídica / humanidades podem editar ou remover disciplinas.
 */
const SECUNDARIO_II: MedDisciplinaDef[] = [
    { nome: 'Língua Portuguesa', codigo_disciplina: 'LP', carga_horaria: 3, ordem: 1, is_obrigatoria: true },
    { nome: 'Matemática', codigo_disciplina: 'MAT', carga_horaria: 5, ordem: 2, is_obrigatoria: true },
    { nome: 'Física', codigo_disciplina: 'FIS', carga_horaria: 4, ordem: 3, is_obrigatoria: true },
    { nome: 'Química', codigo_disciplina: 'QUI', carga_horaria: 4, ordem: 4, is_obrigatoria: true },
    { nome: 'Biologia', codigo_disciplina: 'BIO', carga_horaria: 4, ordem: 5, is_obrigatoria: true },
    { nome: 'História', codigo_disciplina: 'HIS', carga_horaria: 2, ordem: 6, is_obrigatoria: true },
    { nome: 'Geografia', codigo_disciplina: 'GEO', carga_horaria: 2, ordem: 7, is_obrigatoria: true },
    { nome: 'Filosofia', codigo_disciplina: 'FIL', carga_horaria: 2, ordem: 8, is_obrigatoria: false },
    { nome: 'Língua Estrangeira (Inglês)', codigo_disciplina: 'ING', carga_horaria: 3, ordem: 9, is_obrigatoria: true },
    { nome: 'Educação Moral e Cívica', codigo_disciplina: 'EMC', carga_horaria: 2, ordem: 10, is_obrigatoria: false },
    { nome: 'Educação Física', codigo_disciplina: 'EF', carga_horaria: 2, ordem: 11, is_obrigatoria: false },
]

function disciplinasForClasse(classe: string): MedDisciplinaDef[] {
    const num = parseInt(String(classe).match(/(\d+)/)?.[1] || '0', 10)
    if (num >= 1 && num <= 4) return PRIMARIO_1_4
    if (num >= 5 && num <= 6) return PRIMARIO_5_6
    if (num >= 7 && num <= 9) return SECUNDARIO_I
    if (num >= 10 && num <= 13) return SECUNDARIO_II
    return []
}

function nivelForClasse(classe: string): MedClasseCurriculum['nivel'] {
    const num = parseInt(String(classe).match(/(\d+)/)?.[1] || '0', 10)
    if (num >= 1 && num <= 6) return 'primario'
    if (num >= 7 && num <= 9) return 'secundario_i'
    return 'secundario_ii'
}

/** Classes oficiais a pré-cadastrar conforme o tipo de estabelecimento. */
export function classesForTipoEscola(
    tipo: Exclude<TipoEscolaCenso, 'desconhecido'>
): string[] {
    if (tipo === 'primario') return [...CLASSES_ENSINO_PRIMARIO]
    if (tipo === 'secundario') {
        return [...CLASSES_ENSINO_SECUNDARIO_I, ...CLASSES_ENSINO_SECUNDARIO_II]
    }
    return [
        ...CLASSES_ENSINO_PRIMARIO,
        ...CLASSES_ENSINO_SECUNDARIO_I,
        ...CLASSES_ENSINO_SECUNDARIO_II,
    ]
}

/** Currículo completo (disciplinas por classe) para um tipo de escola. */
export function getMedCurriculumForTipo(
    tipo: Exclude<TipoEscolaCenso, 'desconhecido'>
): MedClasseCurriculum[] {
    return classesForTipoEscola(tipo).map((classe) => ({
        classe,
        nivel: nivelForClasse(classe),
        disciplinas: disciplinasForClasse(classe).map((d) => ({ ...d })),
    }))
}

export const MED_CURRICULUM_SOURCE_LABEL =
    'Currículo oficial MED/INADE — editável pela escola'
