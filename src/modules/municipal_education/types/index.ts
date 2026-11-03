/**
 * Municipal Education Module Types
 * Types specific to the Municipal Education Direction functionality
 */

// ============================================
// HISTÓRICO ADMINISTRATIVO
// ============================================

export type EstadoEscola = 'activa' | 'suspensa' | 'bloqueada' | 'inactiva';

export interface HistoricoAdministrativoEscola {
    id: string;
    escola_id: string;
    estado_anterior: EstadoEscola | null;
    estado_novo: EstadoEscola;
    motivo: string | null;
    observacoes: string | null;
    alterado_por: string | null;
    alterado_por_tipo: 'DIRECAO_MUNICIPAL' | 'SUPERADMIN' | null;
    created_at: string;
    // Joined fields
    escola?: {
        id: string;
        nome: string;
        codigo_escola: string;
    };
    alterado_por_nome?: string;
}

// ============================================
// CIRCULARES MUNICIPAIS
// ============================================

export type TipoCircular = 'circular' | 'aviso' | 'comunicado' | 'despacho';

export interface CircularMunicipal {
    id: string;
    numero_circular: string | null;
    titulo: string;
    conteudo: string;
    tipo: TipoCircular;
    municipio: string;
    provincia: string;
    urgente: boolean;
    publicado: boolean;
    data_publicacao: string;
    data_validade: string | null;
    anexo_url: string | null;
    anexo_filename: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
    // Computed fields
    leituras_count?: number;
    escolas_pendentes?: number;
}

export interface LeituraCircular {
    id: string;
    circular_id: string;
    escola_id: string;
    lido_por: string;
    lido_por_nome: string | null;
    lido_por_cargo: string | null;
    lido_em: string;
    // Joined fields
    escola?: {
        id: string;
        nome: string;
        codigo_escola: string;
    };
}

export interface CreateCircularRequest {
    numero_circular?: string;
    titulo: string;
    conteudo: string;
    tipo: TipoCircular;
    urgente?: boolean;
    data_validade?: string;
    anexo_url?: string;
    anexo_filename?: string;
}

// ============================================
// DOCUMENTOS OFICIAIS
// ============================================

export type TipoDocumentoOficial =
    | 'declaracao_servico'
    | 'guia_marcha'
    | 'ordem_servico'
    | 'declaracao_bancaria';

export interface TemplateDocumento {
    titulo: string;
    introducao?: string;
    corpo: string;
    conclusao?: string;
    observacoes?: string;
    fundamentacao?: string;
    numero?: string;
    assinatura: string;
    campos_requeridos: string[];
}

export interface DadosDocumentoOficial {
    // Common fields
    nome: string;
    bi: string;
    cargo: string;
    escola: string;

    // Declaração de Serviço
    data_inicio?: string;

    // Guia de Marcha
    destino?: string;
    data_fim?: string;
    motivo?: string;

    // Ordem de Serviço
    numero?: string;
    ano?: string;
    tarefa?: string;
    prazo?: string;
    fundamentacao?: string;

    // Declaração Bancária
    salario?: string;
    salario_extenso?: string;
}

export interface DocumentoGerado {
    tipo: TipoDocumentoOficial;
    titulo: string;
    conteudo: string;
    data_geracao: string;
    gerado_por: string;
    destinatario: string;
    escola: string;
}

// ============================================
// SUPERVISÃO PEDAGÓGICA (READ-ONLY)
// ============================================

export interface IndicadoresPedagogicos {
    escola_id: string;
    escola_nome: string;
    ano_lectivo: string;
    trimestre: 1 | 2 | 3;
    total_alunos: number;
    total_turmas: number;
    media_geral: number;
    taxa_aprovacao: number;
    taxa_reprovacao: number;
    taxa_abandono: number;
    notas_por_classificacao: {
        excelente: number;
        bom: number;
        suficiente: number;
        insuficiente: number;
    };
}

export interface PautaReadOnly {
    turma_id: string;
    turma_nome: string;
    disciplina_id: string;
    disciplina_nome: string;
    professor_nome: string;
    alunos: {
        id: string;
        nome: string;
        numero_processo: string;
        nota_final: number | null;
        classificacao: string | null;
    }[];
    estatisticas: {
        media: number;
        aprovados: number;
        reprovados: number;
    };
}

// ============================================
// FUNCIONÁRIOS - EXPANDED CATEGORIES
// ============================================

// Main staff categories
export type CategoriaFuncionario =
    | 'TODOS'
    | 'DOCENTE'
    | 'DIRECAO'
    | 'COORDENACAO'
    | 'ADMINISTRATIVO'
    | 'APOIO';

// Academic degrees for teachers
export type GrauAcademico =
    | 'DOUTORADO'
    | 'MESTRADO'
    | 'LICENCIATURA'
    | 'BACHARELATO'
    | 'TECNICO_MEDIO'
    | 'TECNICO_BASICO'
    | 'SEM_FORMACAO';

// Teaching categories
export type CategoriaDocente =
    | 'PROFESSOR_TITULAR'
    | 'PROFESSOR_AUXILIAR'
    | 'PROFESSOR_ESTAGIARIO'
    | 'PROFESSOR_CONTRATADO'
    | 'MONITOR';

// Subcategories for non-teaching staff
export type SubcategoriaDirecao =
    | 'DIRECTOR_GERAL'
    | 'DIRECTOR_PEDAGOGICO'
    | 'DIRECTOR_ADMINISTRATIVO';

export type SubcategoriaCoordenacao =
    | 'COORDENADOR_CLASSE'
    | 'COORDENADOR_DISCIPLINA'
    | 'COORDENADOR_PEDAGOGICO'
    | 'COORDENADOR_TURNO';

export type SubcategoriaAdministrativo =
    | 'SECRETARIO'
    | 'TECNICO_SECRETARIA'
    | 'AUXILIAR_ADMINISTRATIVO'
    | 'RECEPCIONISTA'
    | 'TESOUREIRO';

export type SubcategoriaApoio =
    | 'AUXILIAR_LIMPEZA'
    | 'SEGURANCA'
    | 'MOTORISTA'
    | 'CONTÍNUO'
    | 'JARDINEIRO';

// Labels for display
export const LABELS_GRAU_ACADEMICO: Record<GrauAcademico, string> = {
    DOUTORADO: 'Doutorado (PhD)',
    MESTRADO: 'Mestrado',
    LICENCIATURA: 'Licenciatura',
    BACHARELATO: 'Bacharelato',
    TECNICO_MEDIO: 'Técnico Médio',
    TECNICO_BASICO: 'Técnico Básico',
    SEM_FORMACAO: 'Sem Formação Superior'
};

export const LABELS_CATEGORIA_DOCENTE: Record<CategoriaDocente, string> = {
    PROFESSOR_TITULAR: 'Professor Titular',
    PROFESSOR_AUXILIAR: 'Professor Auxiliar',
    PROFESSOR_ESTAGIARIO: 'Professor Estagiário',
    PROFESSOR_CONTRATADO: 'Professor Contratado',
    MONITOR: 'Monitor'
};

export const LABELS_CATEGORIA: Record<CategoriaFuncionario, string> = {
    TODOS: 'Todos',
    DOCENTE: 'Docentes',
    DIRECAO: 'Direcção',
    COORDENACAO: 'Coordenação',
    ADMINISTRATIVO: 'Administrativo',
    APOIO: 'Apoio'
};

// Extended teacher interface
export interface ProfessorCompleto {
    id: string;
    escola_id: string;
    escola_nome?: string;
    user_id: string | null;
    nome_completo: string;
    numero_agente: string;
    email: string;
    telefone: string | null;
    especialidade: string | null;
    funcoes: string[];
    ativo: boolean;
    // New fields
    grau_academico: GrauAcademico | null;
    area_formacao: string | null;
    categoria_docente: CategoriaDocente | null;
    instituicao_formacao: string | null;
    ano_conclusao: number | null;
    numero_diploma: string | null;
    // Coordination roles (if any)
    cargos_coordenacao?: CargosCoordenacao[];
    created_at: string;
    updated_at: string;
}

// Non-teaching staff
export interface FuncionarioEscola {
    id: string;
    escola_id: string;
    escola_nome?: string;
    user_id: string | null;
    nome_completo: string;
    email: string | null;
    telefone: string | null;
    numero_funcionario: string | null;
    categoria: Exclude<CategoriaFuncionario, 'TODOS' | 'DOCENTE'>;
    subcategoria: string;
    cargo: string | null;
    departamento: string | null;
    data_admissao: string | null;
    data_saida: string | null;
    observacoes: string | null;
    ativo: boolean;
    created_at: string;
    updated_at: string;
}

// Coordination roles for teachers
export interface CargosCoordenacao {
    id: string;
    escola_id: string;
    professor_id: string;
    professor_nome?: string;
    tipo_cargo: SubcategoriaDirecao | SubcategoriaCoordenacao;
    turma_id: string | null;
    turma_nome?: string;
    disciplina_nome: string | null;
    ano_lectivo: string | null;
    data_inicio: string | null;
    data_fim: string | null;
    observacoes: string | null;
    ativo: boolean;
    created_at: string;
}

// Formation areas
export interface AreaFormacao {
    id: string;
    nome: string;
    descricao: string | null;
    ativo: boolean;
}

// Unified staff member (for queries)
export interface FuncionarioMunicipio {
    id: string;
    tipo: 'DOCENTE' | 'DIRECAO' | 'COORDENACAO' | 'ADMINISTRATIVO' | 'APOIO';
    subtipo: string; // grau_academico for teachers, subcategoria for others
    nome_completo: string;
    email: string | null;
    telefone: string | null;
    escola_id: string;
    escola_nome: string;
    cargo: string | null;
    ativo: boolean;
    created_at: string;
    // Teacher-specific
    numero_agente?: string;
    especialidade?: string;
    grau_academico?: GrauAcademico;
    area_formacao?: string;
    categoria_docente?: CategoriaDocente;
    // Non-teacher specific
    numero_funcionario?: string;
    categoria?: Exclude<CategoriaFuncionario, 'TODOS' | 'DOCENTE'>;
    subcategoria?: string;
    // Coordination roles
    cargos_coordenacao?: CargosCoordenacao[];
}

// Statistics
export interface EstatisticasFuncionarios {
    total: number;
    docentes: {
        total: number;
        por_grau_academico: Record<GrauAcademico, number>;
        por_categoria_docente: Record<CategoriaDocente, number>;
        por_area_formacao: Record<string, number>;
        licenciados: number;
        mestres_doutores: number;
        tecnicos: number;
        sem_formacao: number;
    };
    direcao: {
        total: number;
        por_cargo: Record<string, number>;
    };
    coordenacao: {
        total: number;
        por_tipo: Record<string, number>;
    };
    administrativo: {
        total: number;
        por_subcategoria: Record<string, number>;
    };
    apoio: {
        total: number;
        por_subcategoria: Record<string, number>;
    };
    por_escola: Record<string, number>;
}

// Filters
export interface FiltrosFuncionarios {
    escola_id?: string;
    categoria?: CategoriaFuncionario;
    grau_academico?: GrauAcademico;
    categoria_docente?: CategoriaDocente;
    area_formacao?: string;
    subcategoria?: string;
    ativo?: boolean;
    search?: string;
}

// ============================================
// RELATÓRIOS
// ============================================

export interface RelatorioConsolidado {
    tipo: 'escolas' | 'aprovacao' | 'funcionarios' | 'solicitacoes';
    municipio: string;
    periodo: {
        inicio: string;
        fim: string;
    };
    dados: any; // Specific to each report type
    generated_at: string;
    generated_by: string;
}

export interface EstatisticasMunicipioCompletas {
    total_escolas: number;
    escolas_activas: number;
    escolas_suspensas: number;
    escolas_bloqueadas: number;
    total_alunos: number;
    total_professores: number;
    total_turmas: number;
    media_geral: number;
    taxa_aprovacao: number;
    taxa_reprovacao: number;
    solicitacoes_pendentes: number;
    circulares_activas: number;
}
