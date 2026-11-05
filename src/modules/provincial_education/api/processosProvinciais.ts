import { supabase } from '../../../lib/supabaseClient'
import type {
    AreaProjectoProvincial,
    ContratacaoEmpresaProvincial,
    EstadoProcessoProvincial,
    PlanoProvincial,
    ProjectoProvincial,
} from '../../../types'

export async function fetchPlanosProvinciais(
    direcaoProvincialId: string,
): Promise<PlanoProvincial[]> {
    const { data, error } = await supabase
        .from('planos_provinciais')
        .select('*')
        .eq('direcao_provincial_id', direcaoProvincialId)
        .order('updated_at', { ascending: false })
    if (error) throw error
    return (data || []) as PlanoProvincial[]
}

export async function createPlanoProvincial(
    payload: Omit<PlanoProvincial, 'id' | 'created_at' | 'updated_at'>,
): Promise<PlanoProvincial> {
    const { data, error } = await supabase
        .from('planos_provinciais')
        .insert(payload)
        .select('*')
        .single()
    if (error) throw error
    return data as PlanoProvincial
}

export async function updatePlanoProvincial(
    id: string,
    patch: Partial<Omit<PlanoProvincial, 'id' | 'direcao_provincial_id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
    const { error } = await supabase.from('planos_provinciais').update(patch).eq('id', id)
    if (error) throw error
}

export async function deletePlanoProvincial(id: string): Promise<void> {
    const { error } = await supabase.from('planos_provinciais').delete().eq('id', id)
    if (error) throw error
}

export async function fetchContratacoesProvinciais(
    direcaoProvincialId: string,
): Promise<ContratacaoEmpresaProvincial[]> {
    const { data, error } = await supabase
        .from('contratacoes_empresas_provinciais')
        .select('*')
        .eq('direcao_provincial_id', direcaoProvincialId)
        .order('updated_at', { ascending: false })
    if (error) throw error
    return (data || []) as ContratacaoEmpresaProvincial[]
}

export async function createContratacaoProvincial(
    payload: Omit<ContratacaoEmpresaProvincial, 'id' | 'created_at' | 'updated_at'>,
): Promise<ContratacaoEmpresaProvincial> {
    const { data, error } = await supabase
        .from('contratacoes_empresas_provinciais')
        .insert(payload)
        .select('*')
        .single()
    if (error) throw error
    return data as ContratacaoEmpresaProvincial
}

export async function updateContratacaoProvincial(
    id: string,
    patch: Partial<
        Omit<ContratacaoEmpresaProvincial, 'id' | 'direcao_provincial_id' | 'created_at' | 'updated_at'>
    >,
): Promise<void> {
    const { error } = await supabase
        .from('contratacoes_empresas_provinciais')
        .update(patch)
        .eq('id', id)
    if (error) throw error
}

export async function deleteContratacaoProvincial(id: string): Promise<void> {
    const { error } = await supabase
        .from('contratacoes_empresas_provinciais')
        .delete()
        .eq('id', id)
    if (error) throw error
}

export async function fetchProjectosProvinciais(
    direcaoProvincialId: string,
): Promise<ProjectoProvincial[]> {
    const { data, error } = await supabase
        .from('projectos_provinciais')
        .select('*')
        .eq('direcao_provincial_id', direcaoProvincialId)
        .order('updated_at', { ascending: false })
    if (error) throw error
    return (data || []) as ProjectoProvincial[]
}

export async function createProjectoProvincial(
    payload: Omit<ProjectoProvincial, 'id' | 'created_at' | 'updated_at'>,
): Promise<ProjectoProvincial> {
    const { data, error } = await supabase
        .from('projectos_provinciais')
        .insert(payload)
        .select('*')
        .single()
    if (error) throw error
    return data as ProjectoProvincial
}

export async function updateProjectoProvincial(
    id: string,
    patch: Partial<Omit<ProjectoProvincial, 'id' | 'direcao_provincial_id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
    const { error } = await supabase.from('projectos_provinciais').update(patch).eq('id', id)
    if (error) throw error
}

export async function deleteProjectoProvincial(id: string): Promise<void> {
    const { error } = await supabase.from('projectos_provinciais').delete().eq('id', id)
    if (error) throw error
}

export type { EstadoProcessoProvincial, AreaProjectoProvincial }
