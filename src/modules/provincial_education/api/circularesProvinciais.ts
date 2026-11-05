/**
 * Circulares Provinciais API
 * Functions for managing provincial circulars
 */

import { supabase } from '../../../lib/supabaseClient';
import type {
    CircularProvincial,
    LeituraCircularProvincial,
    CreateCircularProvincialRequest,
    FiltrosCircularesProvinciais
} from '../types';

/**
 * Fetch all circulars for the province
 * Batches leitura counts into 2 queries instead of 3*N HEAD requests.
 */
export async function fetchCircularesProvinciais(
    provincia: string,
    filtros?: FiltrosCircularesProvinciais
): Promise<CircularProvincial[]> {
    let query = supabase
        .from('circulares_provinciais')
        .select('*')
        .eq('provincia', provincia);

    // Apply filters
    if (filtros?.tipo) {
        query = query.eq('tipo', filtros.tipo);
    }

    if (filtros?.publicado !== undefined) {
        query = query.eq('publicado', filtros.publicado);
    }

    if (filtros?.urgente !== undefined) {
        query = query.eq('urgente', filtros.urgente);
    }

    if (filtros?.search) {
        query = query.or(`titulo.ilike.%${filtros.search}%,conteudo.ilike.%${filtros.search}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const rows = data || [];
    if (rows.length === 0) return [];

    const circularIds = rows.map((c) => c.id);

    const [{ count: totalDirecoes }, { data: leituras }] = await Promise.all([
        supabase
            .from('direcoes_municipais')
            .select('*', { count: 'exact', head: true })
            .eq('provincia', provincia)
            .eq('ativo', true),
        supabase
            .from('leituras_circulares_provinciais')
            .select('circular_id, direcao_municipal_id')
            .in('circular_id', circularIds),
    ]);

    const leiturasPorCircular = new Map<string, { total: number; comDirecao: number }>();
    for (const leitura of leituras || []) {
        const current = leiturasPorCircular.get(leitura.circular_id) || { total: 0, comDirecao: 0 };
        current.total += 1;
        if (leitura.direcao_municipal_id) current.comDirecao += 1;
        leiturasPorCircular.set(leitura.circular_id, current);
    }

    const direcoesActivas = totalDirecoes || 0;

    return rows.map((circular) => {
        const counts = leiturasPorCircular.get(circular.id) || { total: 0, comDirecao: 0 };
        return {
            ...circular,
            leituras_count: counts.total,
            direcoes_pendentes: Math.max(0, direcoesActivas - counts.comDirecao),
            escolas_pendentes: 0,
        };
    });
}

/**
 * Fetch a single circular by ID
 */
export async function fetchCircularProvincial(circularId: string): Promise<CircularProvincial | null> {
    const { data, error } = await supabase
        .from('circulares_provinciais')
        .select('*')
        .eq('id', circularId)
        .maybeSingle();

    if (error) throw error;
    return data;
}

/**
 * Create a new provincial circular
 */
export async function createCircularProvincial(
    provincia: string,
    request: CreateCircularProvincialRequest
): Promise<CircularProvincial> {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Utilizador não autenticado');

    const { data, error } = await supabase
        .from('circulares_provinciais')
        .insert({
            ...request,
            provincia,
            created_by: user.id,
            publicado: false
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update a provincial circular
 */
export async function updateCircularProvincial(
    circularId: string,
    updates: Partial<CreateCircularProvincialRequest>
): Promise<CircularProvincial> {
    const { data, error } = await supabase
        .from('circulares_provinciais')
        .update(updates)
        .eq('id', circularId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Delete a provincial circular
 */
export async function deleteCircularProvincial(circularId: string): Promise<void> {
    const { error } = await supabase
        .from('circulares_provinciais')
        .delete()
        .eq('id', circularId);

    if (error) throw error;
}

/**
 * Publish a provincial circular
 */
export async function publishCircularProvincial(circularId: string): Promise<CircularProvincial> {
    const { data, error } = await supabase
        .from('circulares_provinciais')
        .update({
            publicado: true,
            data_publicacao: new Date().toISOString()
        })
        .eq('id', circularId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Unpublish a provincial circular
 */
export async function unpublishCircularProvincial(circularId: string): Promise<CircularProvincial> {
    const { data, error } = await supabase
        .from('circulares_provinciais')
        .update({
            publicado: false
        })
        .eq('id', circularId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Fetch readings for a circular
 */
export async function fetchLeiturasCircular(
    circularId: string
): Promise<LeituraCircularProvincial[]> {
    const { data, error } = await supabase
        .from('leituras_circulares_provinciais')
        .select(`
            *,
            direcao_municipal:direcoes_municipais(id, nome, municipio),
            escola:escolas(id, nome, codigo_escola)
        `)
        .eq('circular_id', circularId)
        .order('lido_em', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Register a reading of a circular (for municipal directorates)
 */
export async function registrarLeituraDirecaoMunicipal(
    circularId: string,
    direcaoMunicipalId: string,
    nome: string,
    cargo?: string
): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Utilizador não autenticado');

    const { error } = await supabase
        .from('leituras_circulares_provinciais')
        .upsert({
            circular_id: circularId,
            direcao_municipal_id: direcaoMunicipalId,
            lido_por: user.id,
            lido_por_nome: nome,
            lido_por_cargo: cargo,
            lido_em: new Date().toISOString()
        }, {
            onConflict: 'circular_id,direcao_municipal_id'
        });

    if (error) throw error;
}

/**
 * Register a reading of a circular (for schools)
 */
export async function registrarLeituraEscola(
    circularId: string,
    escolaId: string,
    nome: string,
    cargo?: string
): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Utilizador não autenticado');

    const { error } = await supabase
        .from('leituras_circulares_provinciais')
        .upsert({
            circular_id: circularId,
            escola_id: escolaId,
            lido_por: user.id,
            lido_por_nome: nome,
            lido_por_cargo: cargo,
            lido_em: new Date().toISOString()
        }, {
            onConflict: 'circular_id,escola_id'
        });

    if (error) throw error;
}

/**
 * Get circular statistics without fetching leitura counts (dashboard-friendly).
 */
export async function fetchEstatisticasCirculares(provincia: string): Promise<{
    total: number;
    publicadas: number;
    rascunhos: number;
    urgentes: number;
    por_tipo: Record<string, number>;
}> {
    const { data: circulares, error } = await supabase
        .from('circulares_provinciais')
        .select('tipo, publicado, urgente')
        .eq('provincia', provincia);

    if (error) throw error;

    const stats = {
        total: circulares?.length || 0,
        publicadas: 0,
        rascunhos: 0,
        urgentes: 0,
        por_tipo: {} as Record<string, number>,
    };

    for (const circular of circulares || []) {
        if (circular.publicado) stats.publicadas++;
        else stats.rascunhos++;
        if (circular.urgente) stats.urgentes++;
        stats.por_tipo[circular.tipo] = (stats.por_tipo[circular.tipo] || 0) + 1;
    }

    return stats;
}

/**
 * Derive stats from an already-loaded circular list.
 */
export function deriveEstatisticasCirculares(
    circulares: Array<{ tipo: string; publicado: boolean; urgente: boolean }>
): {
    total: number;
    publicadas: number;
    rascunhos: number;
    urgentes: number;
    por_tipo: Record<string, number>;
} {
    const stats = {
        total: circulares.length,
        publicadas: 0,
        rascunhos: 0,
        urgentes: 0,
        por_tipo: {} as Record<string, number>,
    };

    for (const circular of circulares) {
        if (circular.publicado) stats.publicadas++;
        else stats.rascunhos++;
        if (circular.urgente) stats.urgentes++;
        stats.por_tipo[circular.tipo] = (stats.por_tipo[circular.tipo] || 0) + 1;
    }

    return stats;
}

/**
 * Fetch published circulars for municipal directorates/schools to view
 */
export async function fetchCircularesPublicadasProvincia(
    provincia: string
): Promise<CircularProvincial[]> {
    const { data, error } = await supabase
        .from('circulares_provinciais')
        .select('*')
        .eq('provincia', provincia)
        .eq('publicado', true)
        .order('data_publicacao', { ascending: false });

    if (error) throw error;
    return data || [];
}
