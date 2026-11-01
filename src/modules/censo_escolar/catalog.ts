import { DEFICIENCIAS_CENSO, ModalidadeCensoDef, ModalidadeCensoCodigo } from './types'

const FAIXAS_PRIMARIO = [
    'Menos de 6 anos',
    '6 anos',
    '7 anos',
    '8 anos',
    '9 anos',
    '10 anos',
    '11 anos',
    '12 anos',
    '13 anos',
    '14 anos',
    '15 a 19 anos',
    '20 a 24 anos',
    'Mais de 24 anos',
    'Idade não especificada',
]

const FAIXAS_I_CICLO = [
    'Menos de 12 anos',
    '12 anos',
    '13 anos',
    '14 anos',
    '15 anos',
    '16 anos',
    '17 anos',
    '18 anos',
    '19 anos',
    '20 a 24 anos',
    'Mais de 24 anos',
    'Idade não especificada',
]

const FAIXAS_II_CICLO = [
    'Menos de 15 anos',
    '15 anos',
    '16 anos',
    '17 anos',
    '18 anos',
    '19 anos',
    '20 anos',
    '21 anos',
    '22 anos',
    '23 anos',
    '24 anos',
    '25 a 29 anos',
    '30 a 34 anos',
    '35 a 39 anos',
    '40 a 44 anos',
    '45 a 49 anos',
    'Mais de 49 anos',
    'Idade não especificada',
]

export const MODALIDADES_MVP: ModalidadeCensoDef[] = [
    {
        codigo: 'ensino_primario_geral',
        nome: 'Ensino Primário Geral',
        niveisEnsinoMatch: ['Ensino Primário', 'Primário'],
        classes: ['1ª Classe', '2ª Classe', '3ª Classe', '4ª Classe', '5ª Classe', '6ª Classe'],
        turnos: ['manhã', 'tarde'],
        faixasEtarias: FAIXAS_PRIMARIO,
        deficiencias: DEFICIENCIAS_CENSO,
    },
    {
        codigo: 'i_ciclo_secundario_geral',
        nome: 'I Ciclo do Ensino Secundário Geral',
        niveisEnsinoMatch: ['Ensino Secundário', 'Secundário'],
        classes: ['7ª Classe', '8ª Classe', '9ª Classe'],
        turnos: ['manhã', 'tarde', 'noite'],
        faixasEtarias: FAIXAS_I_CICLO,
        deficiencias: DEFICIENCIAS_CENSO,
    },
    {
        codigo: 'ii_ciclo_secundario_geral',
        nome: 'II Ciclo do Ensino Secundário Geral',
        niveisEnsinoMatch: ['Ensino Secundário', 'Secundário'],
        classes: ['10ª Classe', '11ª Classe', '12ª Classe'],
        turnos: ['manhã', 'tarde', 'noite'],
        faixasEtarias: FAIXAS_II_CICLO,
        deficiencias: DEFICIENCIAS_CENSO,
    },
]

export function getModalidade(codigo: ModalidadeCensoCodigo): ModalidadeCensoDef {
    const found = MODALIDADES_MVP.find(m => m.codigo === codigo)
    if (!found) throw new Error(`Modalidade não suportada no MVP: ${codigo}`)
    return found
}

export function nivelMatchesModalidade(nivelEnsino: string | null | undefined, modalidade: ModalidadeCensoDef): boolean {
    if (!nivelEnsino) return false
    const n = nivelEnsino.toLowerCase()
    return modalidade.niveisEnsinoMatch.some(m => n.includes(m.toLowerCase()))
}
