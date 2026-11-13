import { supabase } from '../../../lib/supabaseClient'
import type { AdAvaliacao } from '../types'

/** Fichas do próprio professor (Art. 25.º — consulta e concordância). */
export async function fetchMinhasAvaliacoesProfessor(
    professorId: string,
): Promise<AdAvaliacao[]> {
    const { data, error } = await supabase
        .from('ad_avaliacoes')
        .select(`
            *,
            professor:professores(id, nome_completo, email, user_id, numero_agente, especialidade, funcoes),
            ciclo:ad_ciclos(id, ano_referencia, tipo_periodo, estado)
        `)
        .eq('avaliado_tipo', 'PROFESSOR')
        .eq('professor_id', professorId)
        .order('updated_at', { ascending: false })

    if (error) throw error
    return (data || []) as AdAvaliacao[]
}
