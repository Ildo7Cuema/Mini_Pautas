import { supabase } from '../lib/supabaseClient'
import { getApprovalThreshold } from './angolaGradeScale'
import type {
    Escola,
    MunicipioStats,
    EscolaStats,
    SolicitacaoDocumento,
    SolicitacaoStats,
    EstadoSolicitacao,
    TipoDocumento
} from '../types'

/**
 * Direção Municipal Utility Functions
 * Provides API functions for Municipal Directorate operations
 */

// ============================================
// STATISTICS FUNCTIONS
// ============================================

/**
 * Fetch statistics for the municipality
 */
export async function fetchMunicipioStats(municipio: string): Promise<MunicipioStats> {
    try {
        // Fetch escolas in the municipality
        const { data: escolas, error: escolasError } = await supabase
            .from('escolas')
            .select('id, nome, ativo')
            .eq('municipio', municipio)

        if (escolasError) throw escolasError

        const escolaIds = escolas?.map(e => e.id) || []
        const total_escolas = escolas?.length || 0
        const escolas_ativas = escolas?.filter(e => e.ativo).length || 0

        // Initialize counters
        let total_alunos = 0
        let alunos_masculino = 0
        let alunos_feminino = 0
        let total_professores = 0
        let professores_masculino = 0
        let professores_feminino = 0
        let total_funcionarios = 0
        let funcionarios_masculino = 0
        let funcionarios_feminino = 0
        let total_turmas = 0
        let soma_medias = 0
        let escolas_com_media = 0

        const estatisticas_por_escola: EscolaStats[] = []

        // Fetch stats for each escola
        for (const escola of (escolas || [])) {
            const stats = await fetchEscolaStats(escola.id)
            estatisticas_por_escola.push({
                ...stats,
                escola_id: escola.id,
                escola_nome: escola.nome
            })

            total_alunos += stats.total_alunos
            alunos_masculino += stats.alunos_masculino
            alunos_feminino += stats.alunos_feminino
            total_professores += stats.total_professores
            professores_masculino += stats.professores_masculino
            professores_feminino += stats.professores_feminino
            total_funcionarios += stats.total_funcionarios
            funcionarios_masculino += stats.funcionarios_masculino
            funcionarios_feminino += stats.funcionarios_feminino
            total_turmas += stats.total_turmas

            if (stats.media_geral > 0) {
                soma_medias += stats.media_geral
                escolas_com_media++
            }
        }

        // Fetch pending solicitações count
        const { count: solicitacoes_pendentes } = await supabase
            .from('solicitacoes_documentos')
            .select('*', { count: 'exact', head: true })
            .in('escola_id', escolaIds)
            .in('estado', ['pendente', 'em_analise'])

        // Calculate overall average
        const media_geral = escolas_com_media > 0 ? soma_medias / escolas_com_media : 0

        // Calculate overall approval rate
        const total_aprovados = estatisticas_por_escola.reduce((sum, e) => {
            if (e.taxa_aprovacao > 0) {
                return sum + e.taxa_aprovacao
            }
            return sum
        }, 0)
        const escolas_com_taxa = estatisticas_por_escola.filter(e => e.taxa_aprovacao > 0).length
        const taxa_aprovacao = escolas_com_taxa > 0 ? total_aprovados / escolas_com_taxa : 0

        return {
            total_escolas,
            escolas_ativas,
            total_alunos,
            alunos_masculino,
            alunos_feminino,
            total_professores,
            professores_masculino,
            professores_feminino,
            total_funcionarios,
            funcionarios_masculino,
            funcionarios_feminino,
            total_turmas,
            media_geral: Math.round(media_geral * 10) / 10,
            taxa_aprovacao: Math.round(taxa_aprovacao),
            solicitacoes_pendentes: solicitacoes_pendentes || 0,
            estatisticas_por_escola
        }
    } catch (error) {
        console.error('Error fetching municipio stats:', error)
        throw error
    }
}

/**
 * Fetch statistics for a specific escola
 */
export async function fetchEscolaStats(escolaId: string): Promise<EscolaStats> {
    try {
        // Get escola name
        const { data: escola } = await supabase
            .from('escolas')
            .select('nome')
            .eq('id', escolaId)
            .single()

        // Count turmas
        const { count: total_turmas } = await supabase
            .from('turmas')
            .select('*', { count: 'exact', head: true })
            .eq('escola_id', escolaId)

        // Get turma IDs + nível de ensino (RAA)
        const { data: turmas } = await supabase
            .from('turmas')
            .select('id, nivel_ensino, nome')
            .eq('escola_id', escolaId)

        const turmaIds = turmas?.map(t => t.id) || []
        const nivelByTurma = new Map(
            (turmas || []).map(t => [t.id, t.nivel_ensino || t.nome || null])
        )

        // Count alunos and get gender breakdown
        let total_alunos = 0
        let alunos_masculino = 0
        let alunos_feminino = 0
        if (turmaIds.length > 0) {
            const { data: alunosData } = await supabase
                .from('alunos')
                .select('id, genero')
                .in('turma_id', turmaIds)

            if (alunosData) {
                total_alunos = alunosData.length
                alunos_masculino = alunosData.filter(a => a.genero === 'M').length
                alunos_feminino = alunosData.filter(a => a.genero === 'F').length
            }
        }

        // Count professores and get gender breakdown
        const { data: professoresData } = await supabase
            .from('professores')
            .select('id, genero')
            .eq('escola_id', escolaId)
            .eq('ativo', true)

        const total_professores = professoresData?.length || 0
        const professores_masculino = professoresData?.filter(p => p.genero === 'M').length || 0
        const professores_feminino = professoresData?.filter(p => p.genero === 'F').length || 0

        // Count funcionarios (staff) and get gender breakdown
        const { data: staffData } = await supabase
            .from('funcionarios_escola')
            .select('id, genero')
            .eq('escola_id', escolaId)
            .eq('ativo', true)

        const total_funcionarios = staffData?.length || 0
        const funcionarios_masculino = staffData?.filter(s => s.genero === 'M').length || 0
        const funcionarios_feminino = staffData?.filter(s => s.genero === 'F').length || 0

        // Calculate average and approval rate from final grades
        let media_geral = 0
        let taxa_aprovacao = 0

        if (turmaIds.length > 0) {
            const { data: notasFinais } = await supabase
                .from('notas_finais')
                .select('nota_final, turma_id')
                .in('turma_id', turmaIds)

            if (notasFinais && notasFinais.length > 0) {
                const soma = notasFinais.reduce((acc, n) => acc + (n.nota_final || 0), 0)
                media_geral = soma / notasFinais.length

                const aprovados = notasFinais.filter(n =>
                    (n.nota_final || 0) >= getApprovalThreshold(nivelByTurma.get(n.turma_id))
                ).length
                taxa_aprovacao = (aprovados / notasFinais.length) * 100
            }
        }

        return {
            escola_id: escolaId,
            escola_nome: escola?.nome || '',
            total_turmas: total_turmas || 0,
            total_alunos,
            alunos_masculino,
            alunos_feminino,
            total_professores,
            professores_masculino,
            professores_feminino,
            total_funcionarios,
            funcionarios_masculino,
            funcionarios_feminino,
            media_geral: Math.round(media_geral * 10) / 10,
            taxa_aprovacao: Math.round(taxa_aprovacao)
        }
    } catch (error) {
        console.error('Error fetching escola stats:', error)
        throw error
    }
}

// ============================================
// ESCOLA MANAGEMENT FUNCTIONS
// ============================================

/**
 * Fetch all escolas in a municipality
 */
export async function fetchEscolasDoMunicipio(municipio: string): Promise<Escola[]> {
    try {
        const { data, error } = await supabase
            .from('escolas')
            .select('*')
            .eq('municipio', municipio)
            .order('nome')

        if (error) throw error

        return data || []
    } catch (error) {
        console.error('Error fetching escolas do municipio:', error)
        throw error
    }
}

/**
 * Update escola information (Direção Municipal has write access)
 */
export async function updateEscolaInfo(escolaId: string, updates: Partial<Escola>): Promise<void> {
    try {
        // Remove fields that shouldn't be updated
        const { id, created_at, updated_at, user_id, ...safeUpdates } = updates as any

        const { error } = await supabase
            .from('escolas')
            .update(safeUpdates)
            .eq('id', escolaId)

        if (error) throw error
    } catch (error) {
        console.error('Error updating escola:', error)
        throw error
    }
}

// ============================================
// SOLICITAÇÕES FUNCTIONS
// ============================================

/**
 * Fetch solicitações for the municipality
 */
export async function fetchSolicitacoes(filters?: {
    estado?: EstadoSolicitacao
    urgente?: boolean
    escola_id?: string
    limit?: number
}): Promise<SolicitacaoDocumento[]> {
    try {
        let query = supabase
            .from('solicitacoes_documentos')
            .select(`
                *,
                tipo_documento:tipos_documento(*),
                escola:escolas(id, nome, codigo_escola)
            `)
            .order('urgente', { ascending: false })
            .order('created_at', { ascending: false })

        if (filters?.estado) {
            query = query.eq('estado', filters.estado)
        }

        if (filters?.urgente !== undefined) {
            query = query.eq('urgente', filters.urgente)
        }

        if (filters?.escola_id) {
            query = query.eq('escola_id', filters.escola_id)
        }

        if (filters?.limit) {
            query = query.limit(filters.limit)
        }

        const { data, error } = await query

        if (error) throw error

        // Add solicitante_nome by querying related tables
        const solicitacoesComNome = await Promise.all(
            (data || []).map(async (sol) => {
                let solicitante_nome = 'Desconhecido'
                let solicitante_cargo = 'Funcionário'

                if (sol.solicitante_tipo === 'PROFESSOR') {
                    const { data: prof } = await supabase
                        .from('professores')
                        .select('nome_completo, categoria_docente')
                        .eq('user_id', sol.solicitante_user_id)
                        .single()
                    solicitante_nome = prof?.nome_completo || 'Professor'
                    solicitante_cargo = prof?.categoria_docente || 'Professor'
                } else if (sol.solicitante_tipo === 'SECRETARIO') {
                    const { data: sec } = await supabase
                        .from('secretarios')
                        .select('nome_completo, cargo')
                        .eq('user_id', sol.solicitante_user_id)
                        .single()
                    solicitante_nome = sec?.nome_completo || 'Secretário'
                    solicitante_cargo = sec?.cargo || 'Secretaria'
                } else if (sol.solicitante_tipo === 'ESCOLA') {
                    const { data: esc } = await supabase
                        .from('escolas')
                        .select('nome')
                        .eq('user_id', sol.solicitante_user_id)
                        .single()
                    solicitante_nome = esc?.nome || 'Escola'
                    solicitante_cargo = 'Direcção da Escola'
                }

                return {
                    ...sol,
                    solicitante_nome,
                    solicitante_cargo
                }
            })
        )

        return solicitacoesComNome
    } catch (error) {
        console.error('Error fetching solicitacoes:', error)
        throw error
    }
}

/**
 * Fetch solicitação statistics
 */
export async function fetchSolicitacaoStats(): Promise<SolicitacaoStats> {
    try {
        const { data, error } = await supabase
            .from('solicitacoes_documentos')
            .select('estado')

        if (error) throw error

        const stats: SolicitacaoStats = {
            total: data?.length || 0,
            pendentes: 0,
            em_analise: 0,
            aprovadas: 0,
            rejeitadas: 0,
            concluidas: 0
        }

        data?.forEach(sol => {
            switch (sol.estado) {
                case 'pendente':
                case 'pendente_info':
                    stats.pendentes++
                    break
                case 'em_analise':
                    stats.em_analise++
                    break
                case 'aprovado':
                    stats.aprovadas++
                    break
                case 'rejeitado':
                    stats.rejeitadas++
                    break
                case 'concluido':
                    stats.concluidas++
                    break
            }
        })

        return stats
    } catch (error) {
        console.error('Error fetching solicitacao stats:', error)
        throw error
    }
}

/**
 * Update solicitação status (Direção Municipal action)
 */
export async function updateSolicitacaoStatus(
    solicitacaoId: string,
    estado: EstadoSolicitacao,
    resposta?: string,
    documentoUrl?: string,
    documentoFilename?: string
): Promise<void> {
    try {
        const { data: { user } } = await supabase.auth.getUser()

        const updates: Partial<SolicitacaoDocumento> = {
            estado,
            resposta_direcao: resposta || undefined,
            analisado_por: user?.id,
            analisado_em: new Date().toISOString()
        }

        if (documentoUrl) {
            updates.documento_url = documentoUrl
            updates.documento_filename = documentoFilename
        }

        if (estado === 'concluido') {
            updates.concluido_em = new Date().toISOString()
        }

        const { error } = await supabase
            .from('solicitacoes_documentos')
            .update(updates)
            .eq('id', solicitacaoId)

        if (error) throw error
    } catch (error) {
        console.error('Error updating solicitacao status:', error)
        throw error
    }
}

// ============================================
// TIPOS DOCUMENTO FUNCTIONS
// ============================================

/**
 * Fetch all active document types
 */
export async function fetchTiposDocumento(): Promise<TipoDocumento[]> {
    try {
        const { data, error } = await supabase
            .from('tipos_documento')
            .select('*')
            .eq('ativo', true)
            .order('nome')

        if (error) throw error

        return data || []
    } catch (error) {
        console.error('Error fetching tipos documento:', error)
        throw error
    }
}
