/**
 * Tipos do módulo Censo Escolar (MED) — MVP
 */

export type ModalidadeCensoCodigo =
    | 'ensino_primario_geral'
    | 'i_ciclo_secundario_geral'
    | 'ii_ciclo_secundario_geral'

export type TurnoCenso = 'manhã' | 'tarde' | 'noite'

export type SexoCenso = 'M' | 'F'

export type TipoDeficiencia =
    | 'nenhuma'
    | 'visual'
    | 'auditiva'
    | 'fisica_motora'
    | 'intelectual'
    | 'espectro_autista'
    | 'sindrome_down'
    | 'surdo_cegueira'
    | 'altas_habilidades'
    | 'multiplas'
    | 'outra'

export type EstadoQuestionarioCenso = 'rascunho' | 'gerado' | 'submetido' | 'recebido_dme'

export interface ModalidadeCensoDef {
    codigo: ModalidadeCensoCodigo
    nome: string
    niveisEnsinoMatch: string[]
    classes: string[]
    turnos: TurnoCenso[]
    faixasEtarias: string[]
    deficiencias: TipoDeficiencia[]
}

export interface ContagemMF {
    M: number
    F: number
    total: number
}

export interface MatriculasPorClasseTurno {
    classe: string
    turno: TurnoCenso
    matriculas: number
    turmas: number
    turmas_ar_livre: number
}

export interface MatriculasPorIdade {
    classe: string
    faixa_etaria: string
    M: number
    F: number
}

export interface MatriculasPorDeficiencia {
    classe: string
    tipo_deficiencia: TipoDeficiencia
    M: number
    F: number
}

export interface ProfessoresPorNivelAcademico {
    nivel_academico: string
    M: number
    F: number
}

export interface ProfessoresQualificacao {
    com_formacao_pedagogica: ContagemMF
    sem_formacao_pedagogica: ContagemMF
    nacionais: ContagemMF
    estrangeiros: ContagemMF
    formacao_diferenciada: ContagemMF
    interpretes_lga: ContagemMF
}

/** Contagem por nacionalidade (cruzamento exigido pelo modelo MED). */
export interface ContagemNacionalidadeMF {
    nacionais: ContagemMF
    estrangeiros: ContagemMF
}

/** Formação × nacionalidade × sexo (secção 9 Primário / 8 I Ciclo). */
export interface ProfessoresCruzamento {
    com_formacao_pedagogica: ContagemNacionalidadeMF
    sem_formacao_pedagogica: ContagemNacionalidadeMF
    formacao_diferenciada: ContagemNacionalidadeMF
    interpretes_lga: ContagemNacionalidadeMF
    /** Desenvolvimento Profissional Contínuo nos últimos 12 meses (I/II Ciclo). */
    dpc_12_meses?: ContagemNacionalidadeMF
}

/** Informações da classe de ingresso (1ª no Primário, 7ª no I Ciclo, 10ª no II Ciclo). */
export interface CensoInfoClasseIngresso {
    classe: string
    vagas: number | null
    primeira_vez: ContagemMF
    /** Só aplicável ao Primário (1ª classe × pré-escolar). */
    frequentou_pre_escolar?: ContagemMF
}

export type ManualGrupoCenso = 'matematica' | 'lingua_portuguesa' | 'braille' | 'outros'
export type ManualBeneficiarioCenso = 'professor' | 'aluno'

export const CLASSES_MANUAIS_PRIMARIO = [
    '1ª Classe',
    '2ª Classe',
    '3ª Classe',
    '4ª Classe',
    '5ª Classe',
    '6ª Classe',
    'PRAEER Etapa 1',
    'PRAEER Etapa 2',
    'PRAEER Etapa 3',
] as const

export interface CensoPraeerTurno {
    matriculas: number
    turmas: number
    turmas_ar_livre: number
}

export interface CensoPraeerEtapa {
    manhã: CensoPraeerTurno
    tarde: CensoPraeerTurno
}

/** Dados do mapa que não existem no operacional pedagógico (escola × ano × modalidade). */
export interface CensoDadosComplementares {
    /** @deprecated Preferir identificacao.vagas_classe_ingresso; mantido por compatibilidade. */
    vagas_1a_classe?: number | null
    manuais?: Record<string, number>
    turmas_ar_livre?: Record<string, boolean>
    praeer?: Record<'1' | '2' | '3', CensoPraeerEtapa>
}

export interface AproveitamentoClasse {
    classe: string
    matriculados: ContagemMF
    aprovados: ContagemMF
    reprovados: ContagemMF
    desistentes: ContagemMF
    transferidos: ContagemMF
}

export interface CensoInfraestrutura {
    id?: string
    escola_id: string
    ano_lectivo: string
    modalidade_codigo: ModalidadeCensoCodigo
    mes_inicio?: number | null
    mes_termino?: number | null
    total_salas: number
    salas_proprias: number
    salas_emprestadas: number
    salas_arrendadas: number
    salas_proprias_bom_estado: number
    total_assentos: number
    assentos_bom_estado: number
    assentos_acessiveis: number
    total_mesas: number
    mesas_bom_estado: number
    mesas_acessiveis: number
    total_quadros: number
    quadros_bom_estado: number
    observacoes?: string | null
}

export interface CensoEscolaPerfil {
    id?: string
    escola_id: string
    situacao_funcionamento: 'em_funcionamento' | 'paralisada' | 'extinta'
    sala_anexa: boolean
    escola_principal_nome?: string | null
    escola_principal_codigo?: string | null
    ponto_referencia?: string | null
    natureza?: 'publica' | 'publico_privada' | 'privada' | null
    decreto_criacao?: string | null
    licenca?: string | null
    comuna_distrito?: string | null
    localidade?: string | null
    zona_geografica?: 'urbana' | 'rural' | null
    modalidades_oferecidas: string[]
}

/** Identificação oficial atribuída pela Direcção Municipal (preenchida pelo gestor da escola). */
export interface CensoIdentificacaoMed {
    /** Código da escola atribuído pela Direcção Municipal da Educação */
    codigo_escola_med: string
    /** ID do questionário (por ano lectivo + modalidade) */
    id_questionario: string
    /** Vagas disponibilizadas na classe de ingresso (1ª / 7ª / 10ª conforme modalidade) */
    vagas_classe_ingresso?: number | null
}

export interface CensoCabecalho {
    /** Código interno EduGest (não é o código oficial do MED) */
    codigo_escola: string
    /** Código oficial da escola atribuído pela Direcção Municipal */
    codigo_escola_med?: string
    /** ID do questionário atribuído pela Direcção Municipal */
    id_questionario?: string
    nome_instituicao: string
    provincia: string
    municipio: string
    ano_lectivo: string
    modalidade_codigo: ModalidadeCensoCodigo
    modalidade_nome: string
    data_referencia_idade: string
    mes_inicio?: number | null
    mes_termino?: number | null
}

export interface CensoQuestionarioPayload {
    cabecalho: CensoCabecalho
    infraestrutura: CensoInfraestrutura | null
    matriculas_classe_turno: MatriculasPorClasseTurno[]
    matriculas_idade: MatriculasPorIdade[]
    matriculas_deficiencia: MatriculasPorDeficiencia[]
    professores_nivel_academico: ProfessoresPorNivelAcademico[]
    professores_qualificacao: ProfessoresQualificacao
    professores_cruzamento?: ProfessoresCruzamento
    aproveitamento_ano_anterior: AproveitamentoClasse[]
    info_classe_ingresso?: CensoInfoClasseIngresso
    manuais?: Record<string, number>
    dados_complementares?: CensoDadosComplementares
    totais: {
        alunos: number
        turmas: number
        professores: number
        alunos_com_deficiencia: number
    }
}

export interface CensoGeracaoResultado {
    payload: CensoQuestionarioPayload
    lacunas: string[]
}

export const LABELS_DEFICIENCIA: Record<TipoDeficiencia, string> = {
    nenhuma: 'Nenhuma / Não aplicável',
    visual: 'Visual',
    auditiva: 'Auditiva',
    fisica_motora: 'Física/Motora',
    intelectual: 'Intelectual',
    espectro_autista: 'Espectro-Autista',
    sindrome_down: 'Síndrome de Down',
    surdo_cegueira: 'Surdo-Cegueira',
    altas_habilidades: 'Altas habilidades',
    multiplas: 'Múltiplas',
    outra: 'Outra',
}

export const DEFICIENCIAS_CENSO: TipoDeficiencia[] = [
    'visual',
    'auditiva',
    'fisica_motora',
    'intelectual',
    'espectro_autista',
    'sindrome_down',
    'surdo_cegueira',
    'altas_habilidades',
    'multiplas',
    'outra',
]
