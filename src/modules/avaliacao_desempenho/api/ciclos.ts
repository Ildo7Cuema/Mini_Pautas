import { supabase } from '../../../lib/supabaseClient'
import type { AdCiclo, CreateCicloInput, EstadoCiclo } from '../types'

export async function fetchCiclos(escolaId: string): Promise<AdCiclo[]> {
    const { data, error } = await supabase
        .from('ad_ciclos')
        .select('*')
        .eq('escola_id', escolaId)
        .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []) as AdCiclo[]
}

export async function createCiclo(input: CreateCicloInput): Promise<AdCiclo> {
    const { data, error } = await supabase
        .from('ad_ciclos')
        .insert({
            escola_id: input.escola_id,
            ano_referencia: input.ano_referencia.trim(),
            tipo_periodo: input.tipo_periodo,
            observacoes: input.observacoes || null,
            estado: 'ABERTO',
        })
        .select('*')
        .single()

    if (error) throw error
    return data as AdCiclo
}

export async function updateCicloEstado(cicloId: string, estado: EstadoCiclo): Promise<AdCiclo> {
    const { data, error } = await supabase
        .from('ad_ciclos')
        .update({ estado })
        .eq('id', cicloId)
        .select('*')
        .single()

    if (error) throw error
    return data as AdCiclo
}
