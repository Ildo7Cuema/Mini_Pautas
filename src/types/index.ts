/**
 * TypeScript Type Definitions for EduGest Angola System
 */

// ============================================
// DATABASE ENTITIES
// ============================================

/** Natureza jurídica da instituição (escolas.configuracoes.natureza). */
export type EscolaNatureza = 'publica' | 'publico_privada' | 'privada';

export interface EscolaConfiguracoes {
    natureza?: EscolaNatureza;
    perfil_configurado?: boolean;
    data_configuracao?: string;
    [key: string]: unknown;
}

export interface Escola {
    id: string;
    nome: string;
    codigo_escola: string;
    provincia: string;
    municipio: string;
    endereco?: string;
    telefone?: string;
    email?: string;
    /** Inclui `natureza`: publica | publico_privada | privada (obrigatória para escalas RAA). */
    configuracoes?: EscolaConfiguracoes | Record<string, any>;
    ativo?: boolean;
    bloqueado?: boolean;
    bloqueado_motivo?: string;
    bloqueado_em?: string;
    bloqueado_por?: string;
    created_at: string;
    updated_at: string;
}

export interface Professor {
    id: string;
    escola_id: string;
    user_id: string;
    nome_completo: string;
    numero_agente: string;
    email: string;
    telefone?: string;
    genero?: 'M' | 'F';
    especialidade?: string;
    funcoes: string[];
    ativo: boolean;
    created_at: string;
    updated_at: string;

    // Novos Campos para Documentação Automática
    data_nascimento?: string;
    nome_pai?: string;
    nome_mae?: string;
    estado_civil?: 'Solteiro' | 'Casado' | 'Divorciado' | 'Viúvo' | 'União de Facto';
    numero_bi?: string;
    nacionalidade?: string;
    naturalidade?: string;

    provincia_residencia?: string;
    municipio_residencia?: string;
    bairro_residencia?: string;
    endereco_completo?: string;

    iban?: string;
    banco?: string;
    numero_seguranca_social?: string;
    data_inicio_funcoes?: string;
    categoria_laboral?: 'Quadro Definitivo' | 'Contratado' | 'Colaborador';

    grau_academico?: string;
    area_formacao?: string;
    categoria_docente?: string;
    numero_diploma?: string;
    instituicao_formacao?: string;
    ano_conclusao?: number;

    // Censo Escolar
    formacao_pedagogica?: boolean;
    nacionalidade_censo?: 'nacional' | 'estrangeiro';
    interprete_lingua_gestual?: boolean;
    formacao_diferenciada_sala?: boolean;
    participou_dpc_12_meses?: boolean;
}

export interface Turma {
    id: string;
    escola_id: string;
    professor_id: string;
    nome: string;
    codigo_turma: string;
    ano_lectivo: number;
    trimestre: 1 | 2 | 3;
    nivel_ensino: string;
    sala?: number;
    turno?: 'manhã' | 'tarde' | 'noite';
    capacidade_maxima: number;
    created_at: string;
    updated_at: string;
}

export interface Aluno {
    id: string;
    turma_id: string;
    user_id?: string;
    encarregado_user_id?: string; // Links guardian auth user to this student

    // Dados Pessoais
    nome_completo: string;
    numero_processo: string;
    /** URL da fotografia tipo passe (Storage) */
    foto_url?: string | null;
    data_nascimento?: string;
    genero?: 'M' | 'F' | 'Outro';
    nacionalidade?: string;
    naturalidade?: string;
    tipo_documento?: string;
    numero_documento?: string;

    // Dados do Encarregado/Responsável
    nome_pai?: string;
    nome_mae?: string;
    nome_encarregado?: string;
    parentesco_encarregado?: string;
    telefone_encarregado?: string;
    email_encarregado?: string;
    profissao_encarregado?: string;

    // Endereço/Morada
    provincia?: string;
    municipio?: string;
    bairro?: string;
    rua?: string;
    endereco?: string; // Referência/complemento

    // Dados Acadêmicos
    ano_ingresso?: number;
    escola_anterior?: string;
    classe_anterior?: string;
    observacoes_academicas?: string;

    // Censo Escolar
    tipo_deficiencia?: string;
    primeira_matricula_na_classe?: boolean;
    frequentou_pre_escolar?: boolean;

    ativo: boolean;
    created_at: string;
    updated_at: string;
}

export interface FuncionarioEscola {
    id: string;
    escola_id: string;
    user_id?: string;
    nome_completo: string;
    email: string;
    telefone: string;
    numero_funcionario?: string;
    categoria: 'DIRECAO' | 'COORDENACAO' | 'ADMINISTRATIVO' | 'APOIO';
    subcategoria: string;
    cargo?: string;
    departamento?: string;
    data_admissao?: string;
    data_saida?: string;
    observacoes?: string;
    ativo: boolean;
    genero?: 'M' | 'F';
    data_nascimento?: string;
    nif?: string;
    created_at: string;
    updated_at: string;
}

export interface Disciplina {
    id: string;
    professor_id: string;
    turma_id: string;
    nome: string;
    codigo_disciplina: string;
    carga_horaria?: number;
    descricao?: string;
    ordem?: number;  // Display order in reports
    created_at: string;
    updated_at: string;
}

export interface ComponenteAvaliacao {
    id: string;
    disciplina_id: string;
    turma_id: string;
    nome: string;
    codigo_componente: string;
    peso_percentual: number;
    escala_minima: number;
    escala_maxima: number;
    obrigatorio: boolean;
    ordem: number;
    descricao?: string;
    is_calculated?: boolean;
    formula_expression?: string | null;
    depends_on_components?: string[] | null;
    tipo_calculo?: 'trimestral' | 'anual';
    created_at: string;
    updated_at: string;
}

export interface Formula {
    id: string;
    turma_id: string;
    disciplina_id: string;
    expressao: string;
    componentes_usados: string[];
    validada: boolean;
    mensagem_validacao?: string;
    created_at: string;
    updated_at: string;
}

// ============================================
// TEMPLATE TYPES
// ============================================

export interface DisciplinaTemplate {
    id: string;
    escola_id: string;
    classe: string;
    nome: string;
    codigo_disciplina: string;
    carga_horaria?: number;
    descricao?: string;
    ordem: number;
    is_obrigatoria: boolean;
    created_at: string;
    updated_at: string;
    // Computed fields from joins
    componentes?: ComponenteTemplate[];
    componentes_count?: number;
    turmas_count?: number;
}

export interface ComponenteTemplate {
    id: string;
    disciplina_template_id: string;
    nome: string;
    codigo_componente: string;
    peso_percentual: number;
    escala_minima: number;
    escala_maxima: number;
    obrigatorio: boolean;
    ordem: number;
    descricao?: string;
    trimestre: 1 | 2 | 3;
    is_calculated: boolean;
    formula_expression?: string;
    depends_on_components?: string[];
    tipo_calculo: 'trimestral' | 'anual';
    created_at: string;
    updated_at: string;
}

export interface TurmaTemplateLink {
    id: string;
    turma_id: string;
    disciplina_template_id: string;
    disciplina_id: string;
    sincronizado_em: string;
    created_at: string;
    // Joined fields
    disciplina_template?: DisciplinaTemplate;
    disciplina?: Disciplina;
}

export interface Nota {
    id: string;
    aluno_id: string;
    componente_id: string;
    turma_id: string;
    trimestre: 1 | 2 | 3;
    valor: number;
    observacao?: string;
    lancado_por: string;
    data_lancamento: string;
    created_at: string;
    updated_at: string;
}

export interface NotaFinal {
    id: string;
    aluno_id: string;
    turma_id: string;
    disciplina_id: string;
    trimestre: 1 | 2 | 3;
    nota_final: number;
    classificacao: string;
    calculo_detalhado?: CalculoDetalhado;
    data_calculo: string;
    created_at: string;
    updated_at: string;
}

export interface Auditoria {
    id: string;
    user_id?: string;
    tabela: string;
    operacao: 'INSERT' | 'UPDATE' | 'DELETE';
    dados_antigos?: Record<string, any>;
    dados_novos?: Record<string, any>;
    ip_address?: string;
    user_agent?: string;
    created_at: string;
}

export interface AppNotification {
    id: string;
    user_id: string;
    escola_id?: string;
    tipo: string;
    titulo: string;
    mensagem?: string;
    link?: string;
    lida: boolean;
    created_at: string;
    updated_at?: string;
}

export interface ConfiguracaoSistema {
    id: string;
    chave: string;
    valor: Record<string, any>;
    descricao?: string;
    created_at: string;
    updated_at: string;
}

// ============================================
// CALCULATION & REPORTING TYPES
// ============================================

export interface CalculoDetalhado {
    componentes: Record<string, ComponenteCalculo>;
    nota_final: number;
    expressao_completa: string;
    classificacao: string;
}

export interface ComponenteCalculo {
    valor: number;
    peso: number;
    contribuicao: number;
    calculo: string;
}

export interface MiniPauta {
    turma: Turma;
    disciplina: Disciplina;
    professor: Professor;
    escola: Escola;
    alunos: AlunoComNota[];
    estatisticas: EstatisticasTurma;
    componentes: ComponenteAvaliacao[];
    formula: Formula;
}

export interface AlunoComNota extends Aluno {
    nota_final?: NotaFinal;
    notas_componentes?: Record<string, Nota>;
}

export interface EstatisticasTurma {
    total_alunos: number;
    media_turma: number;
    nota_minima: number;
    nota_maxima: number;
    aprovados: number;
    reprovados: number;
    taxa_aprovacao: number;
    distribuicao_classificacoes: Record<string, number>;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateTurmaRequest {
    escola_id: string;
    professor_id: string;
    nome: string;
    codigo_turma: string;
    ano_lectivo: number;
    trimestre: 1 | 2 | 3;
    nivel_ensino: string;
    sala?: number;
    turno?: 'manhã' | 'tarde' | 'noite';
    capacidade_maxima?: number;
}

export interface CreateComponenteRequest {
    disciplina_id: string;
    turma_id: string;
    nome: string;
    codigo_componente: string;
    peso_percentual: number;
    escala_minima?: number;
    escala_maxima?: number;
    obrigatorio?: boolean;
    ordem?: number;
    descricao?: string;
}

export interface CreateFormulaRequest {
    turma_id: string;
    disciplina_id: string;
    expressao: string;
}

export interface SubmitGradeRequest {
    aluno_id: string;
    componente_id: string;
    turma_id: string;
    valor: number;
    observacao?: string;
}

export interface CalculateFinalGradeRequest {
    aluno_id: string;
    turma_id: string;
    disciplina_id: string;
    trimestre: 1 | 2 | 3;
}

export interface CalculateFinalGradeResponse {
    success: boolean;
    data?: NotaFinal;
    error?: string;
}

export interface GenerateReportRequest {
    turma_id: string;
    disciplina_id: string;
    trimestre: 1 | 2 | 3;
}

export interface GenerateReportResponse {
    success: boolean;
    data?: MiniPauta;
    error?: string;
}

export interface ImportCSVRequest {
    turma_id: string;
    disciplina_id: string;
    csv_data: string;
}

export interface ImportCSVResponse {
    success: boolean;
    imported: number;
    errors: ImportError[];
}

export interface ImportError {
    row: number;
    field: string;
    message: string;
}

// ============================================
// USER ROLES AND PROFILES
// ============================================

export type UserRole = 'ESCOLA' | 'PROFESSOR' | 'SUPERADMIN' | 'ALUNO' | 'ENCARREGADO' | 'SECRETARIO' | 'DIRECAO_MUNICIPAL' | 'DIRECAO_PROVINCIAL' | 'FUNCIONARIO_PROVINCIAL' | 'FUNCIONARIO_MUNICIPAL';

export interface UserProfile {
    id: string;
    user_id: string;
    tipo_perfil: UserRole;
    escola_id: string | null;  // Nullable for SUPERADMIN, DIRECAO_MUNICIPAL and DIRECAO_PROVINCIAL users
    ativo: boolean;
    metadata: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface EscolaProfile extends Escola {
    user_profile: UserProfile;
}

export interface TurmaProfessor {
    id: string;
    turma_id: string;
    professor_id: string;
    disciplina_id: string;
    created_at: string;
    updated_at: string;
    turma?: Turma;
    disciplina?: Disciplina;
}

export interface ProfessorProfile extends Professor {
    user_profile: UserProfile;
    turmas_associadas?: TurmaProfessor[];
    escola?: Escola;
}

/** Login cargo for school staff (secretarios table); maps to area permissions */
export type SecretarioCargo =
    | 'TECNICO_SECRETARIA'
    | 'DIRECTOR_PEDAGOGICO'
    | 'DIRECTOR_ADMINISTRATIVO';

// SECRETARIO - School staff with system access (técnico / directors)
export interface Secretario {
    id: string;
    escola_id: string;
    user_id?: string;
    nome_completo: string;
    email: string;
    telefone?: string;
    numero_funcionario?: string;
    /** Access profile within SECRETARIO login role */
    cargo?: SecretarioCargo | string;
    ativo: boolean;
    created_at: string;
    updated_at: string;
}

export interface SecretarioProfile extends Secretario {
    user_profile: UserProfile;
    escola?: Escola;
}

// ============================================
// DIREÇÃO MUNICIPAL TYPES
// ============================================

export interface DirecaoMunicipal {
    id: string;
    user_id?: string;
    nome: string;
    provincia: string;
    municipio: string;
    email: string;
    telefone?: string;
    cargo?: string;
    numero_funcionario?: string;
    ativo: boolean;
    created_at: string;
    updated_at: string;
}

export interface DirecaoMunicipalProfile extends DirecaoMunicipal {
    user_profile: UserProfile;
    escolas_count?: number;
}

// ============================================
// DIREÇÃO PROVINCIAL TYPES
// ============================================

export interface DirecaoProvincial {
    id: string;
    user_id?: string;
    nome: string;
    provincia: string;
    email: string;
    telefone?: string;
    cargo?: string;
    numero_funcionario?: string;
    ativo: boolean;
    created_at: string;
    updated_at: string;
}

export interface DirecaoProvincialProfile extends DirecaoProvincial {
    user_profile: UserProfile;
    municipios_count?: number;
    escolas_count?: number;
    direcoes_municipais_count?: number;
}

export type DepartamentoProvincial =
    | 'EDUCACAO_ENSINO'
    | 'PLANEAMENTO_RH'
    | 'INSPECCAO_SUPERVISAO'
    | 'CIENCIA_TECNOLOGIA';

export interface PessoalDirecaoProvincial {
    id: string;
    direcao_provincial_id: string;
    user_id?: string | null;
    nome: string;
    email: string;
    telefone?: string | null;
    numero_funcionario?: string | null;
    departamento: DepartamentoProvincial | string;
    cargo?: string | null;
    ativo: boolean;
    created_at: string;
    updated_at: string;
}

export interface PessoalDirecaoProvincialProfile extends PessoalDirecaoProvincial {
    user_profile: UserProfile;
    direcao_provincial?: DirecaoProvincial;
}

export type DepartamentoMunicipal =
    | 'EDUCACAO_ENSINO'
    | 'PLANEAMENTO_RH'
    | 'INSPECCAO_SUPERVISAO'
    | 'CIENCIA_TECNOLOGIA';

export interface PessoalDirecaoMunicipal {
    id: string;
    direcao_municipal_id: string;
    user_id?: string | null;
    nome: string;
    email: string;
    telefone?: string | null;
    numero_funcionario?: string | null;
    departamento: DepartamentoMunicipal | string;
    cargo?: string | null;
    ativo: boolean;
    created_at: string;
    updated_at: string;
}

export interface PessoalDirecaoMunicipalProfile extends PessoalDirecaoMunicipal {
    user_profile: UserProfile;
    direcao_municipal?: DirecaoMunicipal;
}

export type EstadoProcessoProvincial = 'rascunho' | 'em_curso' | 'concluido' | 'suspenso';

export interface PlanoProvincial {
    id: string;
    direcao_provincial_id: string;
    titulo: string;
    descricao?: string | null;
    periodo?: string | null;
    objectivos?: string | null;
    metas?: string | null;
    responsavel?: string | null;
    estado: EstadoProcessoProvincial;
    data_inicio?: string | null;
    data_fim?: string | null;
    notas?: string | null;
    created_at: string;
    updated_at: string;
}

export interface ContratacaoEmpresaProvincial {
    id: string;
    direcao_provincial_id: string;
    titulo: string;
    empresa?: string | null;
    objecto?: string | null;
    valor_estimado?: number | null;
    responsavel?: string | null;
    estado: EstadoProcessoProvincial;
    data_inicio?: string | null;
    data_fim?: string | null;
    notas?: string | null;
    created_at: string;
    updated_at: string;
}

export type AreaProjectoProvincial = 'ciencia' | 'tecnologia' | 'inovacao' | 'investigacao';

export interface ProjectoProvincial {
    id: string;
    direcao_provincial_id: string;
    titulo: string;
    descricao?: string | null;
    area: AreaProjectoProvincial;
    responsavel?: string | null;
    estado: EstadoProcessoProvincial;
    data_inicio?: string | null;
    data_fim?: string | null;
    notas?: string | null;
    created_at: string;
    updated_at: string;
}

// ============================================
// SOLICITAÇÕES DE DOCUMENTOS TYPES
// ============================================

export type TipoDocumentoCodigo =
    | 'DECLARACAO_TRABALHO'
    | 'DECLARACAO_SERVICO'
    | 'CERTIFICADO_FORMACAO'
    | 'AUTORIZACAO_LICENCA'
    | 'TRANSFERENCIA'
    | 'OUTRO';

export type EstadoSolicitacao =
    | 'pendente'
    | 'em_analise'
    | 'pendente_info'
    | 'aprovado'
    | 'rejeitado'
    | 'concluido';

export interface TipoDocumento {
    id: string;
    codigo: TipoDocumentoCodigo;
    nome: string;
    descricao?: string;
    campos_requeridos?: Record<string, any>[];
    prazo_dias: number;
    ativo: boolean;
    created_at: string;
}

export interface SolicitacaoDocumento {
    id: string;
    solicitante_user_id: string;
    solicitante_tipo: 'PROFESSOR' | 'SECRETARIO' | 'ESCOLA';
    escola_id: string;
    tipo_documento_id: string;
    assunto: string;
    descricao?: string;
    urgente: boolean;
    dados_adicionais?: Record<string, any>;
    estado: EstadoSolicitacao;
    entidade_destino: 'ESCOLA' | 'DIRECAO_MUNICIPAL';
    resposta_direcao?: string;
    documento_url?: string;
    documento_filename?: string;
    analisado_por?: string;
    analisado_em?: string;
    concluido_em?: string;
    created_at: string;
    updated_at: string;
    // Joined fields
    tipo_documento?: TipoDocumento;
    escola?: Escola;
    solicitante_nome?: string;
    solicitante_cargo?: string;
}

export interface SolicitacaoStats {
    total: number;
    pendentes: number;
    em_analise: number;
    aprovadas: number;
    rejeitadas: number;
    concluidas: number;
}

export interface CreateSolicitacaoRequest {
    escola_id: string;
    tipo_documento_id: string;
    assunto: string;
    descricao?: string;
    urgente?: boolean;
    entidade_destino?: 'ESCOLA' | 'DIRECAO_MUNICIPAL';
    dados_adicionais?: Record<string, any>;
}

// ============================================
// ESTATÍSTICAS DO MUNICÍPIO
// ============================================

export interface MunicipioStats {
    total_escolas: number;
    escolas_ativas: number;
    total_alunos: number;
    alunos_masculino: number;
    alunos_feminino: number;
    total_professores: number;
    professores_masculino: number;
    professores_feminino: number;
    total_funcionarios: number;
    funcionarios_masculino: number;
    funcionarios_feminino: number;
    total_turmas: number;
    media_geral: number;
    taxa_aprovacao: number;
    solicitacoes_pendentes: number;
    estatisticas_por_escola: EscolaStats[];
}

export interface EscolaStats {
    escola_id: string;
    escola_nome: string;
    total_turmas: number;
    total_alunos: number;
    alunos_masculino: number;
    alunos_feminino: number;
    total_professores: number;
    professores_masculino: number;
    professores_feminino: number;
    total_funcionarios: number;
    funcionarios_masculino: number;
    funcionarios_feminino: number;
    media_geral: number;
    taxa_aprovacao: number;
}

export interface AuthUser {
    id: string;
    email: string;
    profile: UserProfile | null;
    escola?: EscolaProfile;
    professor?: ProfessorProfile;
    aluno?: AlunoProfile;
    encarregado?: EncarregadoProfile;
    secretario?: SecretarioProfile;
    direcaoMunicipal?: DirecaoMunicipalProfile;
    direcaoProvincial?: DirecaoProvincialProfile;
    pessoalDirecaoProvincial?: PessoalDirecaoProvincialProfile;
    pessoalDirecaoMunicipal?: PessoalDirecaoMunicipalProfile;
}

// ALUNO Profile - Student with turma and escola info
export interface AlunoProfile extends Aluno {
    user_profile: UserProfile;
    turma?: Turma;
    escola?: Escola;
}

// ENCARREGADO Profile - Guardian with associated students
export interface EncarregadoProfile {
    user_profile: UserProfile;
    alunos_associados: AlunoProfile[];
    escola?: Escola;
}

// ============================================
// FRONTEND STATE TYPES
// ============================================

export interface AppState {
    user: AuthUser | null;
    currentTurma: Turma | null;
    currentDisciplina: Disciplina | null;
    loading: boolean;
    error: string | null;
}

export interface FormulaBuilderState {
    expressao: string;
    componentes: ComponenteAvaliacao[];
    validacao: {
        valida: boolean;
        mensagem: string;
    };
    preview: CalculoDetalhado | null;
}

export interface GradeEntryState {
    alunos: Aluno[];
    componente: ComponenteAvaliacao;
    notas: Record<string, number>;
    saving: boolean;
    errors: Record<string, string>;
}

// ============================================
// VIEW TYPES (from database views)
// ============================================

export interface ViewMiniPauta {
    turma_id: string;
    turma_nome: string;
    codigo_turma: string;
    ano_lectivo: number;
    trimestre: number;
    disciplina_id: string;
    disciplina_nome: string;
    aluno_id: string;
    aluno_nome: string;
    numero_processo: string;
    nota_final: number;
    classificacao: string;
    calculo_detalhado: CalculoDetalhado;
    data_calculo: string;
    professor_nome: string;
    escola_nome: string;
}

export interface ViewEstatisticasTurma {
    turma_id: string;
    turma_nome: string;
    codigo_turma: string;
    disciplina_id: string;
    disciplina_nome: string;
    trimestre: number;
    ano_lectivo: number;
    total_alunos: number;
    media_turma: number;
    nota_minima: number;
    nota_maxima: number;
    aprovados: number;
    reprovados: number;
    taxa_aprovacao: number;
}

export interface ViewDesempenhoAluno {
    aluno_id: string;
    aluno_nome: string;
    numero_processo: string;
    turma_id: string;
    turma_nome: string;
    disciplina_id: string;
    disciplina_nome: string;
    componente_nome: string;
    nota_componente: number;
    nota_final: number;
    classificacao: string;
    trimestre: number;
    ano_lectivo: number;
}

// ============================================
// SUPERADMIN TYPES
// ============================================

export interface SuperAdminEntityStats {
    total: number;
    ativas: number;
    inativas: number;
    bloqueadas: number;
}

export interface SuperAdminStats {
    total_escolas: number;
    escolas_ativas: number;
    escolas_inativas: number;
    escolas_bloqueadas: number;
    estatisticas_por_provincia: Record<string, number>;
    estatisticas_por_municipio: Record<string, number>;
    crescimento_mensal: Array<{ mes: string; ano: number; total: number }>;
    /** Direções Municipais (gestão + atenção) */
    direcoes_municipais: SuperAdminEntityStats;
    /** Direções Provinciais (gestão + atenção) */
    direcoes_provinciais: SuperAdminEntityStats;
    /** Resumo de licenças (hoje aplicadas a escolas) */
    licencas: {
        total: number;
        ativas: number;
        expiradas: number;
        suspensas: number;
    };
}

export interface SuperAdminAction {
    id: string;
    superadmin_user_id: string;
    action_type: string;
    target_escola_id?: string;
    action_details: Record<string, any>;
    ip_address?: string;
    user_agent?: string;
    created_at: string;
}

// Backup de escola eliminada
export interface EscolaBackup {
    id: string;
    escola_id: string;
    escola_data: Escola;
    related_data: {
        professores: any[];
        turmas: any[];
        alunos: any[];
        disciplinas: any[];
        licencas: any[];
        secretarios: any[];
    };
    deleted_by: string;
    deleted_at: string;
    motivo: string;
    restored_at?: string;
    restored_by?: string;
    created_at: string;
}

// Sistema de Rastreamento de Acessos
export interface SystemVisit {
    id: string;
    user_id?: string;
    escola_id?: string;
    tipo_perfil?: string;
    ip_address?: string;
    user_agent?: string;
    device_type: 'mobile' | 'tablet' | 'desktop' | 'unknown';
    browser?: string;
    os?: string;
    session_duration_seconds?: number;
    page_views: number;
    created_at: string;
    // Joined fields
    user_email?: string;
    escola_nome?: string;
}

export interface SystemVisitStats {
    total_visits: number;
    unique_users: number;
    visits_today: number;
    unique_users_today: number;
    visits_last_7_days: number;
    unique_users_last_7_days: number;
    visits_last_30_days: number;
    unique_users_last_30_days: number;
    mobile_visits: number;
    tablet_visits: number;
    desktop_visits: number;
    visits_by_profile: Array<{ tipo: string; count: number }>;
}

/** Estado de utilização concreta de uma escola (SUPERADMIN) */
export type EscolaUsoEstado = 'activo' | 'parcial' | 'inactivo';

export interface SuperAdminUsageResumo {
    total_escolas: number;
    escolas_com_professores: number;
    escolas_com_alunos: number;
    escolas_com_notas: number;
    escolas_activas_7d: number;
    escolas_sem_uso: number;
    total_professores: number;
    total_alunos: number;
    total_turmas: number;
    total_notas: number;
    professores_7d: number;
    professores_30d: number;
    alunos_7d: number;
    alunos_30d: number;
    notas_7d: number;
    notas_30d: number;
    acessos_hoje: number;
    acessos_7d: number;
    utilizadores_unicos_7d: number;
    gerado_em?: string;
}

export interface SuperAdminUsageDailyPoint {
    dia: string;
    professores: number;
    alunos: number;
    notas: number;
    acessos: number;
}

export interface SuperAdminEscolaUso {
    escola_id: string;
    nome: string;
    codigo_escola?: string | null;
    provincia?: string | null;
    municipio?: string | null;
    ativo: boolean;
    bloqueado: boolean;
    professores: number;
    alunos: number;
    turmas: number;
    notas: number;
    professores_7d: number;
    alunos_7d: number;
    notas_7d: number;
    acessos_7d: number;
    acessos_30d: number;
    ultimo_acesso?: string | null;
    ultima_actividade?: string | null;
    estado_uso: EscolaUsoEstado;
}

export interface SuperAdminUsageStats {
    resumo: SuperAdminUsageResumo;
    actividade_diaria: SuperAdminUsageDailyPoint[];
    escolas: SuperAdminEscolaUso[];
    parametros?: {
        dias_actividade: number;
        limite_escolas: number;
    };
}

// ============================================
// LICENSING TYPES
// ============================================


export type PlanoLicenca = 'trimestral' | 'semestral' | 'anual';
export type EstadoLicenca = 'ativa' | 'expirada' | 'suspensa' | 'cancelada';
export type EstadoTransacao = 'pendente' | 'processando' | 'sucesso' | 'falha' | 'cancelado' | 'reembolsado';
export type PaymentProvider = 'emis_gpo' | 'proxypay' | 'appypay' | 'manual';
export type MetodoPagamento = 'multicaixa_express' | 'referencia' | 'transferencia' | 'numerario';

export interface Licenca {
    id: string;
    escola_id: string;
    plano: PlanoLicenca;
    data_inicio: string;
    data_fim: string;
    estado: EstadoLicenca;
    valor: number;
    data_ultimo_pagamento?: string;
    criado_por?: string;
    created_at: string;
    updated_at: string;
    // Joined fields
    escola?: Escola;
}

export interface TransacaoPagamento {
    id: string;
    licenca_id?: string;
    escola_id: string;
    provider: PaymentProvider;
    provider_transaction_id?: string;
    valor: number;
    estado: EstadoTransacao;
    metodo_pagamento?: MetodoPagamento;
    moeda: string;
    descricao?: string;
    metadata?: Record<string, any>;
    ip_address?: string;
    created_at: string;
    updated_at: string;
    // Joined fields
    licenca?: Licenca;
    escola?: Escola;
}

export interface HistoricoLicenca {
    id: string;
    licenca_id: string;
    escola_id: string;
    estado_anterior?: string;
    estado_novo: string;
    motivo?: string;
    alterado_por?: string;
    metadata?: Record<string, any>;
    created_at: string;
}

export interface PrecoLicenca {
    id: string;
    plano: PlanoLicenca;
    valor: number;
    desconto_percentual: number;
    descricao?: string;
    ativo: boolean;
    created_at: string;
    updated_at: string;
}

/** Tipo de instituição para preços de assinatura personalizados */
export type TipoInstituicaoAssinatura = 'ESCOLA' | 'DIRECAO_MUNICIPAL' | 'DIRECAO_PROVINCIAL';

export interface PrecoLicencaInstituicao {
    id: string;
    tipo_instituicao: TipoInstituicaoAssinatura;
    instituicao_id: string;
    plano: PlanoLicenca;
    valor: number;
    desconto_percentual: number;
    descricao?: string;
    ativo: boolean;
    created_at: string;
    updated_at: string;
}

/** Plano efectivo após merge global + override da instituição */
export interface PlanoAssinaturaResolvido {
    plano: PlanoLicenca;
    valor: number;
    desconto_percentual: number;
    descricao?: string;
    origem: 'global' | 'instituicao';
    global_price_id?: string;
    instituicao_price_id?: string;
}

export interface LicenseStatus {
    valid: boolean;
    dias_restantes: number;
    estado?: EstadoLicenca;
    plano?: PlanoLicenca;
    data_fim?: string;
    licenca?: Licenca;
    escola_bloqueada?: boolean;
    bloqueio_motivo?: string;
}

export interface LicenseStats {
    total_licencas: number;
    licencas_ativas: number;
    licencas_expiradas: number;
    licencas_suspensas: number;
    escolas_bloqueadas_por_falta_pagamento: number;
    receita_total: number;
    receita_trimestre: number;
    receita_semestre: number;
    receita_ano: number;
    receitas_por_mes: Array<{ mes: string; ano: number; total: number }>;
}

export interface CreatePaymentRequest {
    escola_id: string;
    plano: PlanoLicenca;
    provider?: PaymentProvider;
}

export interface CreatePaymentResponse {
    success: boolean;
    transaction_id: string;
    payment_url?: string;
    reference?: string;
    expires_at?: string;
    error?: string;
}

// ============================================
// TUITION PAYMENT TYPES
// ============================================

export type MetodoPagamentoPropina = 'numerario' | 'transferencia' | 'deposito';
export type MesReferencia = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface PropinasConfig {
    id: string;
    escola_id: string;
    turma_id?: string;
    ano_lectivo: number | string;
    valor_mensalidade: number;
    /** Meses lectivos de cobrança (1=Jan .. 12=Dez) definidos pela escola */
    meses_lectivos?: number[];
    descricao?: string;
    ativo: boolean;
    created_at: string;
    updated_at: string;
    turma?: Turma;
}

export interface PagamentoPropina {
    id: string;
    aluno_id: string;
    escola_id: string;
    mes_referencia: MesReferencia;
    ano_referencia: number;
    valor: number;
    data_pagamento: string;
    metodo_pagamento: MetodoPagamentoPropina;
    numero_recibo: string;
    observacao?: string;
    registado_por: string;
    created_at: string;
    updated_at: string;
    aluno?: Aluno;

    // AGT / Compliance Fields
    estado: 'valido' | 'anulado';
    motivo_anulacao?: string;
    data_anulacao?: string;
    anulado_por?: string;
    hash: string;
    hash_control: string;
    sistema_certificado: string;
    tipo_documento: string;
}

export interface PagamentoMesStatus {
    mes: number;
    status: 'pago' | 'parcial' | 'pendente';
    valor_pago: number;
    valor_total: number;
    detalhes_pagamentos: Array<{
        id: string;
        data: string;
        valor: number;
        recibo: string;
        estado: string;
        hash_control: string;
    }>;
}

export interface EstatisticasPropinas {
    total_alunos: number;
    total_previsto: number;
    total_recebido: number;
    total_em_falta: number;
    percentagem_recebido: number;
}

export interface RegistarPagamentoRequest {
    aluno_id: string;
    escola_id: string;
    mes_referencia: MesReferencia;
    ano_referencia: number;
    valor: number;
    metodo_pagamento: MetodoPagamentoPropina;
    observacao?: string;
}

// ============================================
// TUTORIAL TYPES
// ============================================

export type CategoriaTutorial = 'geral' | 'login' | 'turmas' | 'notas' | 'relatorios' | 'configuracoes';

export interface Tutorial {
    id: string;
    titulo: string;
    descricao?: string;
    url_video: string;
    thumbnail_url?: string;
    categoria: CategoriaTutorial;
    ordem: number;
    publico: boolean;
    ativo: boolean;
    visualizacoes: number;
    likes: number;
    created_by?: string;
    created_at: string;
    updated_at: string;
    perfis?: TutorialPerfil[];
}

export interface TutorialPerfil {
    id: string;
    tutorial_id: string;
    perfil: UserRole;
    created_at?: string;
}

// ============================================
// MATRICULAS TYPES
// ============================================

export type StatusTransicao = 'Transita' | 'Não Transita' | 'Condicional' | 'AguardandoNotas';
export type EstadoMatricula = 'pendente' | 'confirmada' | 'cancelada' | 'aguardando_exame' | 'exame_realizado';
export type ResultadoExame = 'aprovado' | 'reprovado';
export type EstadoAnoLectivo = 'aberto' | 'em_encerramento' | 'fechado' | 'inexistente';

/** Conselho de Notas (antes da publicação da Pauta-Geral) */
export type ConselhoNotasStatus = 'rascunho' | 'aprovado' | 'anulado';

export interface ConselhoNotas {
    id: string;
    escola_id: string;
    turma_id: string;
    ano_lectivo: string;
    data_reuniao?: string | null;
    local_reuniao?: string | null;
    coordenador_nome?: string | null;
    secretario_nome?: string | null;
    membro_2_nome?: string | null;
    status: ConselhoNotasStatus;
    parecer_geral?: string | null;
    aprovado_em?: string | null;
    aprovado_por?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface ConselhoNotasDeliberacao {
    id: string;
    conselho_id: string;
    aluno_id: string;
    situacao_sistema: StatusTransicao;
    situacao_deliberada: StatusTransicao;
    motivo?: string | null;
    is_caso_critico: boolean;
    media_geral?: number | null;
    frequencia_anual?: number | null;
    created_at?: string;
    updated_at?: string;
    aluno?: {
        id: string;
        numero_processo: string;
        nome_completo: string;
        genero?: 'M' | 'F' | null;
    };
}

export type ConselhoMembroPapel = 'coordenador' | 'secretario' | 'membro';
export type ConselhoMembroStatus = 'pendente' | 'aceite' | 'expirado' | 'revogado';
export type ConselhoPropostaStatus = 'pendente' | 'aplicada' | 'descartada';

export interface ConselhoNotasMembro {
    id: string;
    conselho_id: string;
    user_id: string;
    papel: ConselhoMembroPapel;
    status: ConselhoMembroStatus;
    token: string;
    prazo_dias: number;
    expires_at: string;
    convidado_por?: string | null;
    convidado_em?: string;
    aceite_em?: string | null;
    nome_exibicao?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface ConselhoNotasProposta {
    id: string;
    conselho_id: string;
    aluno_id: string;
    disciplina_id: string;
    componente_id: string;
    valor_atual: number;
    valor_proposto: number;
    motivo: string;
    proposto_por?: string | null;
    status: ConselhoPropostaStatus;
    aplicada_em?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface AnoLectivo {
    id: string;
    escola_id: string;
    ano: string;
    estado: Exclude<EstadoAnoLectivo, 'inexistente'>;
    aberto_em?: string;
    aberto_por?: string;
    fechado_em?: string;
    fechado_por?: string;
    observacao?: string;
    created_at?: string;
    updated_at?: string;
}

export interface TurmaProntidaoPauta {
    turma_id: string;
    turma_nome: string;
    nivel_ensino?: string;
    pronta: boolean;
    motivo: string;
    alunos_ativos: number;
    alunos_completos: number;
    componentes_mf: number;
}

export interface ProntidaoPautasFinais {
    escola_id: string;
    ano_lectivo: string;
    pronta: boolean;
    total_turmas: number;
    turmas_prontas: number;
    turmas_sem_mf: number;
    turmas_incompletas: number;
    turmas: TurmaProntidaoPauta[];
}

export interface EstadoCicloMatriculas {
    ano_origem: string;
    ano_destino: string;
    origem_existe: boolean;
    origem_estado: EstadoAnoLectivo;
    destino_existe: boolean;
    destino_estado: EstadoAnoLectivo;
    pode_gerar_matriculas: boolean;
    prontidao_pautas: ProntidaoPautasFinais;
}

export interface Matricula {
    id: string;
    aluno_id: string;
    escola_id: string;
    turma_origem_id?: string;
    turma_destino_id?: string;
    ano_lectivo_origem: string;
    ano_lectivo_destino: string;

    // Classificação
    status_transicao: StatusTransicao;
    estado_matricula: EstadoMatricula;

    // Detalhes da classificação
    disciplinas_em_risco?: string[];
    observacao_padronizada?: string;
    motivo_retencao?: string;
    media_geral?: number;
    frequencia_anual?: number;
    matricula_condicional?: boolean;

    // Classe de origem e destino
    classe_origem?: string;
    classe_destino?: string;

    // Exame extraordinário
    resultado_exame?: ResultadoExame;
    data_exame?: string;
    nota_exame?: number;
    disciplina_exame_id?: string;
    observacao_exame?: string;

    // Auditoria
    criado_por?: string;
    confirmado_por?: string;
    confirmado_em?: string;
    created_at: string;
    updated_at: string;

    // Joined fields
    aluno?: Aluno;
    turma_origem?: Turma;
    turma_destino?: Turma;
}

export interface ResumoMatriculas {
    escola_id: string;
    ano_lectivo_origem: string;
    ano_lectivo_destino: string;
    turma_nome?: string;
    nivel_ensino?: string;
    total_alunos: number;
    transitados: number;
    nao_transitados: number;
    condicionais: number;
    pendentes: number;
    confirmadas: number;
    aguardando_exame: number;
}

// ============================================
// UTILITY TYPES
// ============================================

export type Trimestre = 1 | 2 | 3;
export type Genero = 'M' | 'F' | 'Outro';
export type Turno = 'manhã' | 'tarde' | 'noite';
export type Classificacao = 'Excelente' | 'Bom' | 'Suficiente' | 'Insuficiente';
export type OperacaoAuditoria = 'INSERT' | 'UPDATE' | 'DELETE';

