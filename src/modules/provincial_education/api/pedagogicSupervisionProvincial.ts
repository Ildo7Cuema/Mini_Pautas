/**
 * Pedagogic Supervision Provincial API
 * Functions for provincial-level pedagogic indicators and comparisons
 */

import { supabase } from '../../../lib/supabaseClient';
import { getApprovalThreshold, getQualitativeBands } from '../../../utils/angolaGradeScale';
import type {
    IndicadoresPedagogicosProvinciais,
    IndicadoresPorMunicipio,
    ComparativoMunicipios
} from '../types';

async function loadNivelByTurmaIds(turmaIds: string[]): Promise<Map<string, string | null>> {
    if (turmaIds.length === 0) return new Map()
    const { data } = await supabase
        .from('turmas')
        .select('id, nivel_ensino, nome')
        .in('id', turmaIds)
    return new Map((data || []).map(t => [t.id, t.nivel_ensino || t.nome || null]))
}

/**
 * Fetch provincial pedagogic indicators
 */
export async function fetchIndicadoresPedagogicosProvinciais(
    provincia: string,
    anoLectivo?: string,
    trimestre?: 1 | 2 | 3
): Promise<IndicadoresPedagogicosProvinciais> {
    // Get all schools in the province
    const { data: escolas } = await supabase
        .from('escolas')
        .select('id, municipio')
        .eq('provincia', provincia)
        .eq('ativo', true);

    const escolaIds = escolas?.map(e => e.id) || [];

    // Normalize municipality names for accurate counting
    const normalizeMunicipio = (m: string) => {
        const trimmed = m?.trim() || '';
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    };
    const municipios = [...new Set(escolas?.map(e => normalizeMunicipio(e.municipio)) || [])];

    if (escolaIds.length === 0) {
        return {
            provincia,
            ano_lectivo: anoLectivo || '',
            trimestre,
            total_municipios: 0,
            total_escolas: 0,
            total_alunos: 0,
            total_turmas: 0,
            media_geral: 0,
            taxa_aprovacao: 0,
            taxa_reprovacao: 0,
            notas_por_classificacao: {
                excelente: 0,
                bom: 0,
                suficiente: 0,
                insuficiente: 0
            }
        };
    }

    // Get turmas
    const { data: turmas } = await supabase
        .from('turmas')
        .select('id, nivel_ensino, nome')
        .in('escola_id', escolaIds);

    const turmaIds = turmas?.map(t => t.id) || [];
    const nivelByTurma = new Map(
        (turmas || []).map(t => [t.id, t.nivel_ensino || t.nome || null])
    )

    // Get alunos count
    const { count: totalAlunos } = await supabase
        .from('alunos')
        .select('*', { count: 'exact', head: true })
        .in('turma_id', turmaIds)
        .eq('ativo', true);

    // Get notas_finais for aggregation
    let notasQuery = supabase
        .from('notas_finais')
        .select('nota_final, turma_id')
        .in('turma_id', turmaIds);

    if (trimestre) {
        notasQuery = notasQuery.eq('trimestre', trimestre);
    }

    const { data: notas } = await notasQuery;

    // Calculate statistics (limiar RAA por subsistema da turma)
    const notasValues = notas?.map(n => n.nota_final) || [];
    const mediaGeral = notasValues.length > 0
        ? notasValues.reduce((a, b) => a + b, 0) / notasValues.length
        : 0;

    const aprovados = (notas || []).filter(n =>
        n.nota_final >= getApprovalThreshold(nivelByTurma.get(n.turma_id))
    ).length;
    const taxaAprovacao = notasValues.length > 0 ? (aprovados / notasValues.length) * 100 : 0;

    // Classification distribution
    const classificacoes = {
        excelente: 0,
        bom: 0,
        suficiente: 0,
        insuficiente: 0
    };
    ;(notas || []).forEach(n => {
        const bands = getQualitativeBands(nivelByTurma.get(n.turma_id))
        if (n.nota_final >= bands.excellent) classificacoes.excelente++
        else if (n.nota_final >= bands.good) classificacoes.bom++
        else if (n.nota_final >= bands.sufficient) classificacoes.suficiente++
        else classificacoes.insuficiente++
    })

    return {
        provincia,
        ano_lectivo: anoLectivo || '',
        trimestre,
        total_municipios: municipios.length,
        total_escolas: escolaIds.length,
        total_alunos: totalAlunos || 0,
        total_turmas: turmaIds.length,
        media_geral: Math.round(mediaGeral * 100) / 100,
        taxa_aprovacao: Math.round(taxaAprovacao * 100) / 100,
        taxa_reprovacao: Math.round((100 - taxaAprovacao) * 100) / 100,
        notas_por_classificacao: classificacoes
    };
}

/**
 * Fetch indicators by municipality
 */
export async function fetchIndicadoresPorMunicipio(
    provincia: string
): Promise<IndicadoresPorMunicipio[]> {
    // Use the RPC function for efficiency
    const { data, error } = await supabase
        .rpc('get_estatisticas_por_municipio', { p_provincia: provincia });

    if (error) {
        console.warn('RPC get_estatisticas_por_municipio failed, falling back to manual query:', error);

        // Fallback: Manual calculation with normalized municipality names
        const { data: escolas } = await supabase
            .from('escolas')
            .select('*')
            .eq('provincia', provincia);

        // Normalize municipality names: trim and capitalize
        const normalizeMunicipio = (m: string) => {
            const trimmed = m?.trim() || '';
            return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
        };

        const municipios = [...new Set(escolas?.map(e => normalizeMunicipio(e.municipio)) || [])];
        const results: IndicadoresPorMunicipio[] = [];

        for (const municipio of municipios) {
            // Filter schools matching normalized municipality name
            const escolasMunicipio = escolas?.filter(e => normalizeMunicipio(e.municipio) === municipio) || [];
            const escolaIds = escolasMunicipio.map(e => e.id);

            // Count professores
            const { count: totalProfessores } = await supabase
                .from('professores')
                .select('*', { count: 'exact', head: true })
                .in('escola_id', escolaIds)
                .eq('ativo', true);

            // Get turmas
            const { data: turmas } = await supabase
                .from('turmas')
                .select('id')
                .in('escola_id', escolaIds);
            const turmaIds = turmas?.map(t => t.id) || [];

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

            // Get average
            let mediaGeral = 0;
            let taxaAprovacao = 0;
            if (turmaIds.length > 0) {
                const nivelByTurma = await loadNivelByTurmaIds(turmaIds)
                const { data: notas } = await supabase
                    .from('notas_finais')
                    .select('nota_final, turma_id')
                    .in('turma_id', turmaIds);

                if (notas && notas.length > 0) {
                    mediaGeral = notas.reduce((a, b) => a + b.nota_final, 0) / notas.length;
                    taxaAprovacao = (notas.filter(n =>
                        n.nota_final >= getApprovalThreshold(nivelByTurma.get(n.turma_id))
                    ).length / notas.length) * 100;
                }
            }

            results.push({
                municipio,
                total_escolas: escolasMunicipio.length,
                escolas_activas: escolasMunicipio.filter(e => e.ativo && !e.bloqueado).length,
                total_alunos: totalAlunos,
                total_professores: totalProfessores || 0,
                total_turmas: turmaIds.length,
                media_geral: Math.round(mediaGeral * 100) / 100,
                taxa_aprovacao: Math.round(taxaAprovacao * 100) / 100
            });
        }

        return results.sort((a, b) => a.municipio.localeCompare(b.municipio));
    }

    return (data || []).map((d: any) => ({
        municipio: d.municipio,
        total_escolas: d.total_escolas,
        escolas_activas: d.escolas_activas,
        total_alunos: Number(d.total_alunos),
        total_professores: Number(d.total_professores),
        total_turmas: Number(d.total_turmas),
        media_geral: Math.round(Number(d.media_aprovacao) * 100) / 100,
        taxa_aprovacao: 0 // Will be calculated separately
    }));
}

/**
 * Fetch comparative data between municipalities (for rankings)
 */
export async function fetchComparativoMunicipios(
    provincia: string
): Promise<ComparativoMunicipios[]> {
    const indicadores = await fetchIndicadoresPorMunicipio(provincia);

    // Sort by media_geral descending for ranking
    const sorted = [...indicadores].sort((a, b) => b.media_geral - a.media_geral);

    return sorted.map((ind, index) => ({
        municipio: ind.municipio,
        total_escolas: ind.total_escolas,
        total_alunos: ind.total_alunos,
        total_professores: ind.total_professores,
        media_aprovacao: ind.media_geral,
        ranking: index + 1
    }));
}

/**
 * Fetch approval rate by municipality
 */
export async function fetchTaxaAprovacaoPorMunicipio(
    provincia: string,
    trimestre?: 1 | 2 | 3
): Promise<{ municipio: string; taxa_aprovacao: number }[]> {
    const { data: escolas } = await supabase
        .from('escolas')
        .select('id, municipio')
        .eq('provincia', provincia)
        .eq('ativo', true);

    // Normalize municipality names
    const normalizeMunicipio = (m: string) => {
        const trimmed = m?.trim() || '';
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    };

    const municipios = [...new Set(escolas?.map(e => normalizeMunicipio(e.municipio)) || [])];
    const results: { municipio: string; taxa_aprovacao: number }[] = [];

    for (const municipio of municipios) {
        const escolaIds = escolas?.filter(e => normalizeMunicipio(e.municipio) === municipio).map(e => e.id) || [];

        // Get turmas
        const { data: turmas } = await supabase
            .from('turmas')
            .select('id')
            .in('escola_id', escolaIds);

        const turmaIds = turmas?.map(t => t.id) || [];

        if (turmaIds.length === 0) {
            results.push({ municipio, taxa_aprovacao: 0 });
            continue;
        }

        // Get notas
        const nivelByTurma = await loadNivelByTurmaIds(turmaIds)
        let notasQuery = supabase
            .from('notas_finais')
            .select('nota_final, turma_id')
            .in('turma_id', turmaIds);

        if (trimestre) {
            notasQuery = notasQuery.eq('trimestre', trimestre);
        }

        const { data: notas } = await notasQuery;

        if (!notas || notas.length === 0) {
            results.push({ municipio, taxa_aprovacao: 0 });
            continue;
        }

        const aprovados = notas.filter(n =>
            n.nota_final >= getApprovalThreshold(nivelByTurma.get(n.turma_id))
        ).length;
        const taxaAprovacao = (aprovados / notas.length) * 100;

        results.push({
            municipio,
            taxa_aprovacao: Math.round(taxaAprovacao * 100) / 100
        });
    }

    return results.sort((a, b) => b.taxa_aprovacao - a.taxa_aprovacao);
}

/**
 * Fetch overall provincial statistics using RPC
 */
export async function fetchEstatisticasProvinciaRPC(provincia: string): Promise<{
    total_municipios: number;
    total_direcoes_municipais: number;
    direcoes_activas: number;
    direcoes_inactivas: number;
    total_escolas: number;
    escolas_activas: number;
    total_professores: number;
    total_alunos: number;
    total_turmas: number;
}> {
    const { data, error } = await supabase
        .rpc('get_estatisticas_provincia', { p_provincia: provincia });

    if (error) {
        console.warn('RPC get_estatisticas_provincia failed:', error);
        // Return empty stats on error
        return {
            total_municipios: 0,
            total_direcoes_municipais: 0,
            direcoes_activas: 0,
            direcoes_inactivas: 0,
            total_escolas: 0,
            escolas_activas: 0,
            total_professores: 0,
            total_alunos: 0,
            total_turmas: 0
        };
    }

    const row = data?.[0] || {};
    return {
        total_municipios: row.total_municipios || 0,
        total_direcoes_municipais: row.total_direcoes_municipais || 0,
        direcoes_activas: row.direcoes_activas || 0,
        direcoes_inactivas: row.direcoes_inactivas || 0,
        total_escolas: row.total_escolas || 0,
        escolas_activas: row.escolas_activas || 0,
        total_professores: Number(row.total_professores) || 0,
        total_alunos: Number(row.total_alunos) || 0,
        total_turmas: Number(row.total_turmas) || 0
    };
}
