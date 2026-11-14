/**
 * Funcionários Query API
 * Comprehensive staff query functions supporting all categories
 */

import { supabase } from '../../../lib/supabaseClient';
import type {
    FuncionarioMunicipio,
    FiltrosFuncionarios,
    CategoriaFuncionario,
    GrauAcademico,
    CargosCoordenacao
} from '../types';

/**
 * Fetch all funcionários in the municipality with expanded categories
 */
export async function fetchFuncionariosMunicipio(
    municipio: string,
    filtros?: FiltrosFuncionarios
): Promise<FuncionarioMunicipio[]> {
    // Get schools in municipality
    let escolasQuery = supabase
        .from('escolas')
        .select('id, nome')
        .eq('municipio', municipio);

    if (filtros?.escola_id) {
        escolasQuery = escolasQuery.eq('id', filtros.escola_id);
    }

    const { data: escolas } = await escolasQuery;

    if (!escolas || escolas.length === 0) return [];

    const escolaIds = escolas.map(e => e.id);
    const escolaMap = new Map(escolas.map(e => [e.id, e.nome]));

    const funcionarios: FuncionarioMunicipio[] = [];

    // Fetch professores (DOCENTE)
    if (!filtros?.categoria || filtros.categoria === 'DOCENTE' || filtros.categoria === 'TODOS') {
        let profQuery = supabase
            .from('professores')
            .select('*')
            .in('escola_id', escolaIds);

        if (filtros?.ativo !== undefined) {
            profQuery = profQuery.eq('ativo', filtros.ativo);
        }

        if (filtros?.search) {
            profQuery = profQuery.ilike('nome_completo', `%${filtros.search}%`);
        }

        // Filter by grau_academico if specified
        if (filtros?.grau_academico) {
            profQuery = profQuery.eq('grau_academico', filtros.grau_academico);
        }

        // Filter by categoria_docente if specified
        if (filtros?.categoria_docente) {
            profQuery = profQuery.eq('categoria_docente', filtros.categoria_docente);
        }

        // Filter by area_formacao if specified
        if (filtros?.area_formacao) {
            profQuery = profQuery.eq('area_formacao', filtros.area_formacao);
        }

        const { data: professores } = await profQuery;

        for (const prof of (professores || [])) {
            funcionarios.push({
                id: prof.id,
                tipo: 'DOCENTE',
                subtipo: prof.grau_academico || 'SEM_FORMACAO',
                nome_completo: prof.nome_completo,
                email: prof.email,
                telefone: prof.telefone,
                escola_id: prof.escola_id,
                escola_nome: escolaMap.get(prof.escola_id) || '',
                cargo: prof.especialidade || 'Professor',
                ativo: prof.ativo,
                created_at: prof.created_at,
                numero_agente: prof.numero_agente,
                especialidade: prof.especialidade,
                grau_academico: prof.grau_academico,
                area_formacao: prof.area_formacao,
                categoria_docente: prof.categoria_docente,
                genero: prof.genero || null,
                data_nascimento: prof.data_nascimento || null,
                data_inicio_servico: prof.data_inicio_funcoes || null,
                numero_filhos: prof.numero_filhos ?? 0,
            });
        }
    }

    // Fetch secretários (ADMINISTRATIVO)
    if (!filtros?.categoria || filtros.categoria === 'ADMINISTRATIVO' || filtros.categoria === 'TODOS') {
        let secQuery = supabase
            .from('secretarios')
            .select('*')
            .in('escola_id', escolaIds);

        if (filtros?.ativo !== undefined) {
            secQuery = secQuery.eq('ativo', filtros.ativo);
        }

        if (filtros?.search) {
            secQuery = secQuery.ilike('nome_completo', `%${filtros.search}%`);
        }

        const { data: secretarios } = await secQuery;

        for (const sec of (secretarios || [])) {
            funcionarios.push({
                id: sec.id,
                tipo: 'ADMINISTRATIVO',
                subtipo: 'TECNICO_SECRETARIA',
                nome_completo: sec.nome_completo,
                email: sec.email,
                telefone: sec.telefone,
                escola_id: sec.escola_id,
                escola_nome: escolaMap.get(sec.escola_id) || '',
                cargo: 'Técnico de Secretaria',
                ativo: sec.ativo,
                created_at: sec.created_at,
                numero_funcionario: sec.numero_funcionario,
                categoria: 'ADMINISTRATIVO',
                subcategoria: 'TECNICO_SECRETARIA'
            });
        }
    }

    // Fetch funcionarios_escola (DIRECAO, COORDENACAO, ADMINISTRATIVO others, APOIO)
    const categoriasExtras: CategoriaFuncionario[] = ['DIRECAO', 'COORDENACAO', 'APOIO'];

    if (!filtros?.categoria || filtros.categoria === 'TODOS' || categoriasExtras.includes(filtros.categoria as CategoriaFuncionario)) {
        let funcQuery = supabase
            .from('funcionarios_escola')
            .select('*')
            .in('escola_id', escolaIds);

        if (filtros?.categoria && filtros.categoria !== 'TODOS' && filtros.categoria !== 'DOCENTE') {
            funcQuery = funcQuery.eq('categoria', filtros.categoria);
        }

        if (filtros?.ativo !== undefined) {
            funcQuery = funcQuery.eq('ativo', filtros.ativo);
        }

        if (filtros?.search) {
            funcQuery = funcQuery.ilike('nome_completo', `%${filtros.search}%`);
        }

        if (filtros?.subcategoria) {
            funcQuery = funcQuery.eq('subcategoria', filtros.subcategoria);
        }

        const { data: funcionariosEscola } = await funcQuery;

        for (const func of (funcionariosEscola || [])) {
            funcionarios.push({
                id: func.id,
                tipo: func.categoria as 'DIRECAO' | 'COORDENACAO' | 'ADMINISTRATIVO' | 'APOIO',
                subtipo: func.subcategoria,
                nome_completo: func.nome_completo,
                email: func.email,
                telefone: func.telefone,
                escola_id: func.escola_id,
                escola_nome: escolaMap.get(func.escola_id) || '',
                cargo: func.cargo || func.subcategoria,
                ativo: func.ativo,
                created_at: func.created_at,
                numero_funcionario: func.numero_funcionario,
                categoria: func.categoria,
                subcategoria: func.subcategoria,
                genero: func.genero || null,
                data_nascimento: func.data_nascimento || null,
                data_inicio_servico: func.data_admissao || null,
                numero_filhos: func.numero_filhos ?? 0,
            });
        }
    }

    // Fetch coordination roles for teachers
    if (!filtros?.categoria || filtros.categoria === 'COORDENACAO' || filtros.categoria === 'TODOS') {
        const { data: cargos } = await supabase
            .from('cargos_coordenacao')
            .select(`
                *,
                professor:professores(nome_completo, email, escola_id)
            `)
            .in('escola_id', escolaIds)
            .eq('ativo', true);

        // Attach coordination roles to teachers
        for (const cargo of (cargos || [])) {
            const teacherIndex = funcionarios.findIndex(f =>
                f.tipo === 'DOCENTE' && f.id === cargo.professor_id
            );

            if (teacherIndex >= 0) {
                if (!funcionarios[teacherIndex].cargos_coordenacao) {
                    funcionarios[teacherIndex].cargos_coordenacao = [];
                }
                funcionarios[teacherIndex].cargos_coordenacao!.push({
                    id: cargo.id,
                    escola_id: cargo.escola_id,
                    professor_id: cargo.professor_id,
                    tipo_cargo: cargo.tipo_cargo,
                    turma_id: cargo.turma_id,
                    disciplina_nome: cargo.disciplina_nome,
                    ano_lectivo: cargo.ano_lectivo,
                    data_inicio: cargo.data_inicio,
                    data_fim: cargo.data_fim,
                    observacoes: cargo.observacoes,
                    ativo: cargo.ativo,
                    created_at: cargo.created_at
                });
            }
        }
    }

    // Sort by name
    funcionarios.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));

    return funcionarios;
}

/**
 * Fetch funcionários for a specific school
 */
export async function fetchFuncionariosEscola(
    escolaId: string,
    categoria?: CategoriaFuncionario
): Promise<FuncionarioMunicipio[]> {
    return fetchFuncionariosMunicipio('', { escola_id: escolaId, categoria });
}

/**
 * Get funcionários statistics with expanded categories
 */
export async function fetchFuncionariosStats(municipio: string): Promise<{
    total: number;
    professores: number;
    secretarios: number;
    activos: number;
    inactivos: number;
    direcao?: number;
    coordenacao?: number;
    apoio?: number;
    por_grau?: Record<GrauAcademico, number>;
    por_escola: { escola_nome: string; total: number }[];
}> {
    const funcionarios = await fetchFuncionariosMunicipio(municipio);

    const por_escola_map = new Map<string, number>();
    funcionarios.forEach(f => {
        por_escola_map.set(
            f.escola_nome,
            (por_escola_map.get(f.escola_nome) || 0) + 1
        );
    });

    // Count by academic degree for teachers
    const docentes = funcionarios.filter(f => f.tipo === 'DOCENTE');
    const por_grau: Record<GrauAcademico, number> = {
        DOUTORADO: 0,
        MESTRADO: 0,
        LICENCIATURA: 0,
        BACHARELATO: 0,
        TECNICO_MEDIO: 0,
        TECNICO_BASICO: 0,
        SEM_FORMACAO: 0
    };

    docentes.forEach(d => {
        const grau = d.grau_academico || 'SEM_FORMACAO';
        por_grau[grau] = (por_grau[grau] || 0) + 1;
    });

    return {
        total: funcionarios.length,
        professores: docentes.length,
        secretarios: funcionarios.filter(f => f.tipo === 'ADMINISTRATIVO' && f.subcategoria === 'SECRETARIO').length,
        direcao: funcionarios.filter(f => f.tipo === 'DIRECAO').length,
        coordenacao: funcionarios.filter(f => f.tipo === 'COORDENACAO').length,
        apoio: funcionarios.filter(f => f.tipo === 'APOIO').length,
        activos: funcionarios.filter(f => f.ativo).length,
        inactivos: funcionarios.filter(f => !f.ativo).length,
        por_grau,
        por_escola: Array.from(por_escola_map.entries())
            .map(([escola_nome, total]) => ({ escola_nome, total }))
            .sort((a, b) => b.total - a.total)
    };
}

/**
 * Search funcionários
 */
export async function searchFuncionarios(
    municipio: string,
    query: string
): Promise<FuncionarioMunicipio[]> {
    return fetchFuncionariosMunicipio(municipio, { search: query });
}

/**
 * Fetch areas de formação (lookup table)
 */
export async function fetchAreasFormacao(): Promise<{ id: string; nome: string }[]> {
    const { data } = await supabase
        .from('areas_formacao')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');

    return data || [];
}
