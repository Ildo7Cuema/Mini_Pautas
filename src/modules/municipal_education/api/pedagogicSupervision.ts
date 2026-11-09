/**
 * Pedagogic Supervision API
 * READ-ONLY access to grades and attendance data for supervision purposes
 */

import { supabase } from '../../../lib/supabaseClient';
import { getApprovalThreshold, getQualitativeBands } from '../../../utils/angolaGradeScale';
import type { IndicadoresPedagogicos, PautaReadOnly } from '../types';

/**
 * Fetch pedagogic indicators for all schools in the municipality
 */
export async function fetchIndicadoresMunicipio(
    municipio: string,
    anoLectivo?: string,
    trimestre?: 1 | 2 | 3
): Promise<IndicadoresPedagogicos[]> {
    // Get schools in municipality
    const { data: escolas } = await supabase
        .from('escolas')
        .select('id, nome')
        .eq('municipio', municipio)
        .eq('ativo', true);

    if (!escolas || escolas.length === 0) return [];

    const indicadores: IndicadoresPedagogicos[] = [];

    for (const escola of escolas) {
        const indicador = await fetchIndicadoresEscola(
            escola.id,
            escola.nome,
            anoLectivo,
            trimestre
        );
        indicadores.push(indicador);
    }

    return indicadores;
}

/**
 * Fetch pedagogic indicators for a specific school
 */
export async function fetchIndicadoresEscola(
    escolaId: string,
    escolaNome: string,
    anoLectivo?: string,
    trimestre?: 1 | 2 | 3
): Promise<IndicadoresPedagogicos> {
    // Get turmas for this school
    let turmasQuery = supabase
        .from('turmas')
        .select('id')
        .eq('escola_id', escolaId);

    if (anoLectivo) {
        turmasQuery = turmasQuery.eq('ano_lectivo', anoLectivo);
    }
    if (trimestre) {
        turmasQuery = turmasQuery.eq('trimestre', trimestre);
    }

    const { data: turmas } = await turmasQuery;
    const turmaIds = turmas?.map(t => t.id) || [];

    // Count turmas
    const total_turmas = turmaIds.length;

    // Count alunos
    let total_alunos = 0;
    if (turmaIds.length > 0) {
        const { count } = await supabase
            .from('alunos')
            .select('*', { count: 'exact', head: true })
            .in('turma_id', turmaIds)
            .eq('ativo', true);
        total_alunos = count || 0;
    }

    // Get final grades with turma nivel for RAA thresholds
    let notasFinais: { nota_final: number; turma_id: string }[] = [];
    if (turmaIds.length > 0) {
        let notasQuery = supabase
            .from('notas_finais')
            .select('nota_final, turma_id')
            .in('turma_id', turmaIds);

        if (trimestre) {
            notasQuery = notasQuery.eq('trimestre', trimestre);
        }

        const { data } = await notasQuery;
        notasFinais = data || [];
    }

    const { data: turmasNivel } = turmaIds.length > 0
        ? await supabase.from('turmas').select('id, nivel_ensino, nome').in('id', turmaIds)
        : { data: [] as { id: string; nivel_ensino?: string | null; nome?: string | null }[] }
    const nivelByTurma = new Map(
        (turmasNivel || []).map(t => [t.id, t.nivel_ensino || t.nome || null])
    )

    // Calculate statistics (limiar RAA por subsistema da turma)
    const notas = notasFinais.map(n => n.nota_final);
    const media_geral = notas.length > 0
        ? notas.reduce((a, b) => a + b, 0) / notas.length
        : 0;

    const aprovados = notasFinais.filter(n =>
        n.nota_final >= getApprovalThreshold(nivelByTurma.get(n.turma_id))
    ).length;
    const reprovados = notasFinais.length - aprovados;
    const total_com_nota = notas.length;

    const taxa_aprovacao = total_com_nota > 0
        ? (aprovados / total_com_nota) * 100
        : 0;
    const taxa_reprovacao = total_com_nota > 0
        ? (reprovados / total_com_nota) * 100
        : 0;

    // Classification breakdown (faixas RAA por turma)
    const notas_por_classificacao = {
        excelente: 0,
        bom: 0,
        suficiente: 0,
        insuficiente: 0
    };
    notasFinais.forEach(n => {
        const bands = getQualitativeBands(nivelByTurma.get(n.turma_id))
        if (n.nota_final >= bands.excellent) notas_por_classificacao.excelente++
        else if (n.nota_final >= bands.good) notas_por_classificacao.bom++
        else if (n.nota_final >= bands.sufficient) notas_por_classificacao.suficiente++
        else notas_por_classificacao.insuficiente++
    })

    return {
        escola_id: escolaId,
        escola_nome: escolaNome,
        ano_lectivo: anoLectivo || new Date().getFullYear().toString(),
        trimestre: trimestre || 1,
        total_alunos,
        total_turmas,
        media_geral: Math.round(media_geral * 10) / 10,
        taxa_aprovacao: Math.round(taxa_aprovacao),
        taxa_reprovacao: Math.round(taxa_reprovacao),
        taxa_abandono: 0, // Would need separate tracking
        notas_por_classificacao
    };
}

/**
 * Fetch READ-ONLY pautas for a school
 */
export async function fetchPautasEscola(
    escolaId: string,
    anoLectivo?: string,
    trimestre?: 1 | 2 | 3
): Promise<PautaReadOnly[]> {
    // Get turmas
    let turmasQuery = supabase
        .from('turmas')
        .select(`
            id,
            nome,
            nivel_ensino,
            trimestre,
            ano_lectivo,
            professor:professores(nome_completo)
        `)
        .eq('escola_id', escolaId);

    if (anoLectivo) {
        turmasQuery = turmasQuery.eq('ano_lectivo', anoLectivo);
    }
    if (trimestre) {
        turmasQuery = turmasQuery.eq('trimestre', trimestre);
    }

    const { data: turmas } = await turmasQuery;

    if (!turmas || turmas.length === 0) return [];

    const pautas: PautaReadOnly[] = [];

    for (const turma of turmas) {
        // Get disciplinas for this turma
        const { data: disciplinas } = await supabase
            .from('disciplinas')
            .select('id, nome')
            .eq('turma_id', turma.id);

        for (const disciplina of (disciplinas || [])) {
            // Get alunos with final grades
            const { data: alunos } = await supabase
                .from('alunos')
                .select(`
                    id,
                    nome_completo,
                    numero_processo
                `)
                .eq('turma_id', turma.id)
                .eq('ativo', true)
                .order('nome_completo');

            // Get final grades for each aluno
            const alunosComNotas = await Promise.all(
                (alunos || []).map(async (aluno) => {
                    const { data: notaFinal } = await supabase
                        .from('notas_finais')
                        .select('nota_final, classificacao')
                        .eq('aluno_id', aluno.id)
                        .eq('turma_id', turma.id)
                        .eq('disciplina_id', disciplina.id)
                        .single();

                    return {
                        id: aluno.id,
                        nome: aluno.nome_completo,
                        numero_processo: aluno.numero_processo,
                        nota_final: notaFinal?.nota_final || null,
                        classificacao: notaFinal?.classificacao || null
                    };
                })
            );

            // Calculate statistics
            const notas = alunosComNotas
                .filter(a => a.nota_final !== null)
                .map(a => a.nota_final!);

            const media = notas.length > 0
                ? notas.reduce((a, b) => a + b, 0) / notas.length
                : 0;
            const limiar = getApprovalThreshold(turma.nivel_ensino || turma.nome)

            pautas.push({
                turma_id: turma.id,
                turma_nome: turma.nome,
                disciplina_id: disciplina.id,
                disciplina_nome: disciplina.nome,
                professor_nome: (turma.professor as any)?.nome_completo || 'N/A',
                alunos: alunosComNotas,
                estatisticas: {
                    media: Math.round(media * 10) / 10,
                    aprovados: notas.filter(n => n >= limiar).length,
                    reprovados: notas.filter(n => n < limiar).length
                }
            });
        }
    }

    return pautas;
}

/**
 * Get consolidated statistics for the municipality
 */
export async function fetchEstatisticasConsolidadas(municipio: string): Promise<{
    total_escolas: number;
    total_turmas: number;
    total_alunos: number;
    media_municipal: number;
    taxa_aprovacao_municipal: number;
    melhor_escola: { nome: string; media: number } | null;
    pior_escola: { nome: string; media: number } | null;
}> {
    const indicadores = await fetchIndicadoresMunicipio(municipio);

    const total_escolas = indicadores.length;
    const total_turmas = indicadores.reduce((sum, i) => sum + i.total_turmas, 0);
    const total_alunos = indicadores.reduce((sum, i) => sum + i.total_alunos, 0);

    // Calculate weighted average
    const escolasComMedia = indicadores.filter(i => i.media_geral > 0);
    const soma_medias = escolasComMedia.reduce((sum, i) => sum + i.media_geral, 0);
    const media_municipal = escolasComMedia.length > 0
        ? soma_medias / escolasComMedia.length
        : 0;

    const soma_taxas = escolasComMedia.reduce((sum, i) => sum + i.taxa_aprovacao, 0);
    const taxa_aprovacao_municipal = escolasComMedia.length > 0
        ? soma_taxas / escolasComMedia.length
        : 0;

    // Find best and worst schools
    const sorted = [...escolasComMedia].sort((a, b) => b.media_geral - a.media_geral);

    const melhor_escola = sorted.length > 0
        ? { nome: sorted[0].escola_nome, media: sorted[0].media_geral }
        : null;

    const pior_escola = sorted.length > 0
        ? { nome: sorted[sorted.length - 1].escola_nome, media: sorted[sorted.length - 1].media_geral }
        : null;

    return {
        total_escolas,
        total_turmas,
        total_alunos,
        media_municipal: Math.round(media_municipal * 10) / 10,
        taxa_aprovacao_municipal: Math.round(taxa_aprovacao_municipal),
        melhor_escola,
        pior_escola
    };
}
