/**
 * Direções Municipais Management API (Provincial Level)
 * Functions for managing municipal directorates within the province
 */

import { supabase } from '../../../lib/supabaseClient';
import type { DirecaoMunicipal } from '../../../types';
import type {
    EstadoDirecaoMunicipal,
    HistoricoAdministrativoDirecaoMunicipal,
    DirecaoMunicipalDetalhes,
    DirecaoMunicipalResumida
} from '../types';

/**
 * Fetch all municipal directorates in the province
 * Uses 2 queries (direções + escolas) instead of N+1 HEAD counts.
 */
export async function fetchDirecoesMunicipaisProvincia(provincia: string): Promise<DirecaoMunicipalResumida[]> {
    const [{ data: direcoes, error }, { data: escolas, error: escolasError }] = await Promise.all([
        supabase
            .from('direcoes_municipais')
            .select('id, nome, municipio, email, telefone, ativo, created_at')
            .eq('provincia', provincia)
            .order('municipio'),
        supabase
            .from('escolas')
            .select('municipio')
            .eq('provincia', provincia),
    ]);

    if (error) throw error;
    if (escolasError) throw escolasError;

    const escolasPorMunicipio = new Map<string, number>();
    for (const escola of escolas || []) {
        const key = (escola.municipio || '').trim().toLowerCase();
        if (!key) continue;
        escolasPorMunicipio.set(key, (escolasPorMunicipio.get(key) || 0) + 1);
    }

    return (direcoes || []).map((direcao) => ({
        id: direcao.id,
        nome: direcao.nome,
        municipio: direcao.municipio,
        email: direcao.email,
        telefone: direcao.telefone,
        ativo: direcao.ativo,
        escolas_count: escolasPorMunicipio.get((direcao.municipio || '').trim().toLowerCase()) || 0,
        created_at: direcao.created_at,
    }));
}

/**
 * Fetch municipal directorate details with statistics
 */
export async function fetchDirecaoMunicipalDetalhes(direcaoId: string): Promise<DirecaoMunicipalDetalhes> {
    // Fetch directorate
    const { data: direcao, error: direcaoError } = await supabase
        .from('direcoes_municipais')
        .select('*')
        .eq('id', direcaoId)
        .single();

    if (direcaoError) throw direcaoError;

    // Count schools
    const { data: escolas } = await supabase
        .from('escolas')
        .select('id')
        .eq('municipio', direcao.municipio);

    const escolaIds = escolas?.map(e => e.id) || [];
    const escolasActivas = escolas?.filter(() => true).length || 0; // TODO: Add ativo filter

    // Count professores
    let totalProfessores = 0;
    if (escolaIds.length > 0) {
        const { count } = await supabase
            .from('professores')
            .select('*', { count: 'exact', head: true })
            .in('escola_id', escolaIds)
            .eq('ativo', true);
        totalProfessores = count || 0;
    }

    // Count turmas
    let turmaIds: string[] = [];
    if (escolaIds.length > 0) {
        const { data: turmas } = await supabase
            .from('turmas')
            .select('id')
            .in('escola_id', escolaIds);
        turmaIds = turmas?.map(t => t.id) || [];
    }

    // Count alunos
    let totalAlunos = 0;
    if (turmaIds.length > 0) {
        const { count } = await supabase
            .from('alunos')
            .select('*', { count: 'exact', head: true })
            .in('turma_id', turmaIds)
            .eq('ativo', true);
        totalAlunos = count || 0;
    }

    // Count pending requests
    let solicitacoesPendentes = 0;
    if (escolaIds.length > 0) {
        const { count } = await supabase
            .from('solicitacoes_documentos')
            .select('*', { count: 'exact', head: true })
            .in('escola_id', escolaIds)
            .in('estado', ['pendente', 'em_analise']);
        solicitacoesPendentes = count || 0;
    }

    return {
        id: direcao.id,
        nome: direcao.nome,
        municipio: direcao.municipio,
        provincia: direcao.provincia,
        email: direcao.email,
        telefone: direcao.telefone,
        cargo: direcao.cargo,
        numero_funcionario: direcao.numero_funcionario,
        ativo: direcao.ativo,
        created_at: direcao.created_at,
        total_escolas: escolaIds.length,
        escolas_activas: escolasActivas,
        total_professores: totalProfessores,
        total_alunos: totalAlunos,
        total_turmas: turmaIds.length,
        solicitacoes_pendentes: solicitacoesPendentes
    };
}

/**
 * Get the current state of a municipal directorate
 */
export function getEstadoDirecaoMunicipal(direcao: DirecaoMunicipal): EstadoDirecaoMunicipal {
    if (!direcao.ativo) return 'inactiva';
    return 'activa';
}

/**
 * Suspend a municipal directorate
 */
export async function suspenderDirecaoMunicipal(
    direcaoId: string,
    motivo: string,
    observacoes?: string
): Promise<void> {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Utilizador não autenticado');

    // Get current directorate data
    const { data: direcao, error: direcaoError } = await supabase
        .from('direcoes_municipais')
        .select('*')
        .eq('id', direcaoId)
        .single();

    if (direcaoError) throw direcaoError;

    const estadoAnterior = getEstadoDirecaoMunicipal(direcao);

    // Update directorate - suspend by setting ativo = false
    const { error: updateError } = await supabase
        .from('direcoes_municipais')
        .update({ ativo: false })
        .eq('id', direcaoId);

    if (updateError) throw updateError;

    // Create history entry
    const { error: historyError } = await supabase
        .from('historico_administrativo_direcoes_municipais')
        .insert({
            direcao_municipal_id: direcaoId,
            estado_anterior: estadoAnterior,
            estado_novo: 'suspensa',
            motivo,
            observacoes,
            alterado_por: user.id,
            alterado_por_tipo: 'DIRECAO_PROVINCIAL'
        });

    if (historyError) throw historyError;
}

/**
 * Reactivate a municipal directorate
 */
export async function reativarDirecaoMunicipal(
    direcaoId: string,
    observacoes?: string
): Promise<void> {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Utilizador não autenticado');

    // Get current directorate data
    const { data: direcao, error: direcaoError } = await supabase
        .from('direcoes_municipais')
        .select('*')
        .eq('id', direcaoId)
        .single();

    if (direcaoError) throw direcaoError;

    const estadoAnterior = getEstadoDirecaoMunicipal(direcao);

    // Update directorate - reactivate
    const { error: updateError } = await supabase
        .from('direcoes_municipais')
        .update({ ativo: true })
        .eq('id', direcaoId);

    if (updateError) throw updateError;

    // Create history entry
    const { error: historyError } = await supabase
        .from('historico_administrativo_direcoes_municipais')
        .insert({
            direcao_municipal_id: direcaoId,
            estado_anterior: estadoAnterior,
            estado_novo: 'activa',
            motivo: 'Reactivação da direção municipal',
            observacoes,
            alterado_por: user.id,
            alterado_por_tipo: 'DIRECAO_PROVINCIAL'
        });

    if (historyError) throw historyError;
}

/**
 * Fetch administrative history for a municipal directorate
 */
export async function fetchHistoricoDirecaoMunicipal(
    direcaoId: string
): Promise<HistoricoAdministrativoDirecaoMunicipal[]> {
    const { data, error } = await supabase
        .from('historico_administrativo_direcoes_municipais')
        .select(`
            *,
            direcao_municipal:direcoes_municipais(id, nome, municipio)
        `)
        .eq('direcao_municipal_id', direcaoId)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
}

/**
 * Fetch all history for the province
 */
export async function fetchHistoricoProvincia(
    provincia: string,
    limit: number = 50
): Promise<HistoricoAdministrativoDirecaoMunicipal[]> {
    // First get directorate IDs in the province
    const { data: direcoes } = await supabase
        .from('direcoes_municipais')
        .select('id')
        .eq('provincia', provincia);

    const direcaoIds = direcoes?.map(d => d.id) || [];

    if (direcaoIds.length === 0) return [];

    const { data, error } = await supabase
        .from('historico_administrativo_direcoes_municipais')
        .select(`
            *,
            direcao_municipal:direcoes_municipais(id, nome, municipio)
        `)
        .in('direcao_municipal_id', direcaoIds)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;

    return data || [];
}

/**
 * Get municipal directorate state statistics for the province
 * Lightweight: only fetches ativo flags (no escolas N+1).
 */
export async function fetchEstatisticasEstadosDirecoes(provincia: string): Promise<{
    activas: number;
    suspensas: number;
    inactivas: number;
    total: number;
}> {
    const { data: direcoes, error } = await supabase
        .from('direcoes_municipais')
        .select('ativo')
        .eq('provincia', provincia);

    if (error) throw error;

    const stats = {
        activas: 0,
        suspensas: 0,
        inactivas: 0,
        total: direcoes?.length || 0,
    };

    for (const direcao of direcoes || []) {
        if (direcao.ativo) {
            stats.activas++;
        } else {
            stats.inactivas++;
        }
    }

    return stats;
}

/**
 * Derive state stats from an already-loaded list (avoids a second round-trip).
 */
export function deriveEstatisticasEstadosDirecoes(
    direcoes: Array<{ ativo: boolean }>
): {
    activas: number;
    suspensas: number;
    inactivas: number;
    total: number;
} {
    const stats = {
        activas: 0,
        suspensas: 0,
        inactivas: 0,
        total: direcoes.length,
    };

    for (const direcao of direcoes) {
        if (direcao.ativo) stats.activas++;
        else stats.inactivas++;
    }

    return stats;
}
