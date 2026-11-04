/**
 * Catalog for Direção Municipal / Provincial test seed.
 * Aligns with SCHOOLS in catalog.mjs (Luanda/Belas, Benguela, Huambo).
 */

import { SEED_PASSWORD, seedEmail } from './_shared.mjs'

/** Marker stored in numero_funcionario for safe cleanup */
export const SEED_NUMERO_PREFIX = 'SEED-'

/**
 * Provincial directorates (one per province — DB unique).
 * Includes active + one pending for approval flows.
 */
export const PROVINCIAL_DIRECTIONS = [
    {
        key: 'luanda',
        nome: 'Direção Provincial da Educação de Luanda (Seed)',
        provincia: 'Luanda',
        emailLocal: 'dp.luanda',
        telefone: '+244923100001',
        cargo: 'Director Provincial de Educação',
        numero_funcionario: 'SEED-DP-LUANDA',
        ativo: true,
        bloqueado: false,
        directorNome: 'Dr. Carlos Mendes Seed Provincial Luanda',
    },
    {
        key: 'benguela',
        nome: 'Direção Provincial da Educação de Benguela (Seed)',
        provincia: 'Benguela',
        emailLocal: 'dp.benguela',
        telefone: '+244923100002',
        cargo: 'Director Provincial de Educação',
        numero_funcionario: 'SEED-DP-BENGUELA',
        ativo: true,
        bloqueado: false,
        directorNome: 'Dra. Ana Ferreira Seed Provincial Benguela',
    },
    {
        key: 'huambo',
        nome: 'Direção Provincial da Educação do Huambo (Seed)',
        provincia: 'Huambo',
        emailLocal: 'dp.huambo',
        telefone: '+244923100003',
        cargo: 'Director Provincial de Educação',
        numero_funcionario: 'SEED-DP-HUAMBO',
        ativo: true,
        bloqueado: false,
        directorNome: 'Dr. Paulo Santos Seed Provincial Huambo',
    },
    {
        key: 'cabinda',
        nome: 'Direção Provincial da Educação de Cabinda (Seed Pendente)',
        provincia: 'Cabinda',
        emailLocal: 'dp.cabinda.pendente',
        telefone: '+244923100004',
        cargo: 'Director Provincial de Educação',
        numero_funcionario: 'SEED-DP-CABINDA',
        ativo: false,
        bloqueado: false,
        directorNome: 'Dr. Rui Oliveira Seed Provincial Cabinda',
        note: 'Pendente de aprovação SUPERADMIN',
    },
]

/**
 * Municipal directorates — mix of active, pending, blocked, empty municipios.
 */
export const MUNICIPAL_DIRECTIONS = [
    // Luanda — Belas has SEED-PRI school
    {
        key: 'belas',
        nome: 'Direção Municipal da Educação de Belas (Seed)',
        provincia: 'Luanda',
        municipio: 'Belas',
        emailLocal: 'dm.belas',
        telefone: '+244923200001',
        cargo: 'Director Municipal de Educação',
        numero_funcionario: 'SEED-DM-BELAS',
        ativo: true,
        bloqueado: false,
        directorNome: 'Dra. Maria Costa Seed Municipal Belas',
        linkedSchoolCodigo: 'SEED-PRI-2026',
    },
    {
        key: 'cacuaco',
        nome: 'Direção Municipal da Educação de Cacuaco (Seed)',
        provincia: 'Luanda',
        municipio: 'Cacuaco',
        emailLocal: 'dm.cacuaco',
        telefone: '+244923200002',
        cargo: 'Director Municipal de Educação',
        numero_funcionario: 'SEED-DM-CACUACO',
        ativo: true,
        bloqueado: false,
        directorNome: 'Dr. João Almeida Seed Municipal Cacuaco',
        note: 'Município sem escolas seed (estado vazio)',
    },
    {
        key: 'viana',
        nome: 'Direção Municipal da Educação de Viana (Seed Pendente)',
        provincia: 'Luanda',
        municipio: 'Viana',
        emailLocal: 'dm.viana.pendente',
        telefone: '+244923200003',
        cargo: 'Director Municipal de Educação',
        numero_funcionario: 'SEED-DM-VIANA',
        ativo: false,
        bloqueado: false,
        directorNome: 'Dra. Sofia Lopes Seed Municipal Viana',
        note: 'Pendente de aprovação',
    },
    // Benguela — Benguela has SEED-SEC school
    {
        key: 'benguela-mun',
        nome: 'Direção Municipal da Educação de Benguela (Seed)',
        provincia: 'Benguela',
        municipio: 'Benguela',
        emailLocal: 'dm.benguela',
        telefone: '+244923200004',
        cargo: 'Director Municipal de Educação',
        numero_funcionario: 'SEED-DM-BENGUELA',
        ativo: true,
        bloqueado: false,
        directorNome: 'Dr. Hélder Nascimento Seed Municipal Benguela',
        linkedSchoolCodigo: 'SEED-SEC-2026',
    },
    {
        key: 'lobito',
        nome: 'Direção Municipal da Educação do Lobito (Seed)',
        provincia: 'Benguela',
        municipio: 'Lobito',
        emailLocal: 'dm.lobito',
        telefone: '+244923200005',
        cargo: 'Director Municipal de Educação',
        numero_funcionario: 'SEED-DM-LOBITO',
        ativo: true,
        bloqueado: false,
        directorNome: 'Dra. Catarina Mendes Seed Municipal Lobito',
        note: 'Município sem escolas seed',
    },
    // Huambo — Huambo has SEED-CMP school
    {
        key: 'huambo-mun',
        nome: 'Direção Municipal da Educação do Huambo (Seed)',
        provincia: 'Huambo',
        municipio: 'Huambo',
        emailLocal: 'dm.huambo',
        telefone: '+244923200006',
        cargo: 'Director Municipal de Educação',
        numero_funcionario: 'SEED-DM-HUAMBO',
        ativo: true,
        bloqueado: false,
        directorNome: 'Dr. António Pereira Seed Municipal Huambo',
        linkedSchoolCodigo: 'SEED-CMP-2026',
    },
    {
        key: 'caala',
        nome: 'Direção Municipal da Educação da Caála (Seed Bloqueada)',
        provincia: 'Huambo',
        municipio: 'Caála',
        emailLocal: 'dm.caala.bloqueada',
        telefone: '+244923200007',
        cargo: 'Director Municipal de Educação',
        numero_funcionario: 'SEED-DM-CAALA',
        ativo: true,
        bloqueado: true,
        bloqueado_motivo: 'Seed de testes — direcção bloqueada para validar fluxo provincial/SUPERADMIN',
        directorNome: 'Dra. Isabel Rodrigues Seed Municipal Caála',
        note: 'Bloqueada para testes de gestão provincial',
    },
]

export function buildProvincialAuthPlan(dir) {
    return {
        email: seedEmail(dir.emailLocal),
        password: SEED_PASSWORD,
        fullName: dir.directorNome,
        role: 'DIRECAO_PROVINCIAL',
    }
}

export function buildMunicipalAuthPlan(dir) {
    return {
        email: seedEmail(dir.emailLocal),
        password: SEED_PASSWORD,
        fullName: dir.directorNome,
        role: 'DIRECAO_MUNICIPAL',
    }
}

/** Sample provincial circulars per province key */
export function provincialCircularsPlan(provincia, createdBy) {
    const base = [
        {
            numero_circular: 'SEED-P-001/2026',
            titulo: 'Calendário Lectivo Provincial 2026',
            conteudo:
                'Circular seed de testes. Determina o calendário lectivo provincial para o ano de 2026, ' +
                'incluindo períodos de avaliação e férias escolares.',
            tipo: 'circular',
            urgente: false,
            publicado: true,
        },
        {
            numero_circular: 'SEED-P-002/2026',
            titulo: 'Aviso Urgente — Recolha de Mini-Pautas',
            conteudo:
                'Aviso seed urgente. Todas as Direções Municipais devem garantir a submissão das ' +
                'mini-pautas do 1º trimestre até à data indicada.',
            tipo: 'aviso',
            urgente: true,
            publicado: true,
        },
        {
            numero_circular: 'SEED-P-003/2026',
            titulo: 'Rascunho — Formação Contínua de Docentes',
            conteudo: 'Rascunho seed não publicado. Plano de formação contínua para docentes da província.',
            tipo: 'comunicado',
            urgente: false,
            publicado: false,
        },
        {
            numero_circular: 'SEED-P-004/2026',
            titulo: 'Despacho — Supervisão Pedagógica Provincial',
            conteudo:
                'Despacho seed. Orienta as Direções Municipais a preparar visitas de supervisão pedagógica ' +
                'nas escolas do município durante o 2º trimestre.',
            tipo: 'despacho',
            urgente: false,
            publicado: true,
        },
    ]

    return base.map((c) => ({
        ...c,
        provincia,
        created_by: createdBy,
        data_publicacao: c.publicado ? new Date().toISOString() : null,
    }))
}

/** Sample municipal circulars */
export function municipalCircularsPlan(municipio, provincia, createdBy) {
    const base = [
        {
            numero_circular: `SEED-M-001/${municipio.slice(0, 3).toUpperCase()}/2026`,
            titulo: `Início do Ano Lectivo — ${municipio}`,
            conteudo:
                `Circular municipal seed para ${municipio}. Orienta as escolas do município sobre ` +
                'procedimentos de abertura do ano lectivo 2026.',
            tipo: 'circular',
            urgente: false,
            publicado: true,
        },
        {
            numero_circular: `SEED-M-002/${municipio.slice(0, 3).toUpperCase()}/2026`,
            titulo: 'Aviso — Entrega de Relatórios Trimestrais',
            conteudo: 'Aviso seed. Prazo de entrega dos relatórios trimestrais às escolas do município.',
            tipo: 'aviso',
            urgente: true,
            publicado: true,
        },
        {
            numero_circular: `SEED-M-003/${municipio.slice(0, 3).toUpperCase()}/2026`,
            titulo: 'Rascunho — Reunião de Directores de Escola',
            conteudo: 'Rascunho seed. Convocatória para reunião mensal de directores (ainda não publicada).',
            tipo: 'comunicado',
            urgente: false,
            publicado: false,
        },
    ]

    return base.map((c) => ({
        ...c,
        municipio,
        provincia,
        created_by: createdBy,
        data_publicacao: c.publicado ? new Date().toISOString() : null,
    }))
}

/** Document request scenarios linked to seed schools */
export const SOLICITACAO_SCENARIOS = [
    {
        schoolCodigo: 'SEED-PRI-2026',
        solicitanteTipo: 'ESCOLA',
        tipoCodigo: 'DECLARACAO_TRABALHO',
        assunto: 'Seed — Declaração de trabalho docente',
        descricao: 'Solicitação seed de testes para declaração de vínculo laboral.',
        estado: 'pendente',
        urgente: false,
    },
    {
        schoolCodigo: 'SEED-PRI-2026',
        solicitanteTipo: 'PROFESSOR',
        tipoCodigo: 'TRANSFERENCIA',
        assunto: 'Seed — Pedido de transferência (urgente)',
        descricao: 'Solicitação seed urgente de transferência entre escolas do município.',
        estado: 'em_analise',
        urgente: true,
    },
    {
        schoolCodigo: 'SEED-SEC-2026',
        solicitanteTipo: 'ESCOLA',
        tipoCodigo: 'DECLARACAO_SERVICO',
        assunto: 'Seed — Declaração de tempo de serviço',
        descricao: 'Solicitação seed aprovada para testes de fluxo completo.',
        estado: 'aprovado',
        urgente: false,
        resposta: 'Pedido aprovado (seed). Documento disponível para levantamento.',
    },
    {
        schoolCodigo: 'SEED-SEC-2026',
        solicitanteTipo: 'PROFESSOR',
        tipoCodigo: 'AUTORIZACAO_LICENCA',
        assunto: 'Seed — Autorização de licença',
        descricao: 'Solicitação seed rejeitada para testes de resposta negativa.',
        estado: 'rejeitado',
        urgente: false,
        resposta: 'Pedido rejeitado (seed). Documentação incompleta.',
    },
    {
        schoolCodigo: 'SEED-CMP-2026',
        solicitanteTipo: 'ESCOLA',
        tipoCodigo: 'CERTIFICADO_FORMACAO',
        assunto: 'Seed — Certificado de formação',
        descricao: 'Solicitação seed concluída.',
        estado: 'concluido',
        urgente: false,
        resposta: 'Documento emitido e entregue (seed).',
    },
    {
        schoolCodigo: 'SEED-CMP-2026',
        solicitanteTipo: 'PROFESSOR',
        tipoCodigo: 'OUTRO',
        assunto: 'Seed — Pedido de informação adicional',
        descricao: 'Solicitação seed à espera de mais informação da escola.',
        estado: 'pendente_info',
        urgente: false,
        resposta: 'Favor anexar cópia do BI e comprovativo de formação (seed).',
    },
]
