import { supabase } from '../../../lib/supabaseClient'
import type { PessoalDirecaoMunicipal } from '../../../types'

export async function fetchPessoalMunicipal(
    direcaoMunicipalId: string,
): Promise<PessoalDirecaoMunicipal[]> {
    const { data, error } = await supabase
        .from('pessoal_direcao_municipal')
        .select('*')
        .eq('direcao_municipal_id', direcaoMunicipalId)
        .order('nome', { ascending: true })

    if (error) throw error
    return (data || []) as PessoalDirecaoMunicipal[]
}

export async function createPessoalMunicipal(
    payload: Omit<PessoalDirecaoMunicipal, 'id' | 'created_at' | 'updated_at' | 'user_id'>,
): Promise<PessoalDirecaoMunicipal> {
    const { data, error } = await supabase
        .from('pessoal_direcao_municipal')
        .insert({
            direcao_municipal_id: payload.direcao_municipal_id,
            nome: payload.nome,
            email: payload.email,
            telefone: payload.telefone || null,
            numero_funcionario: payload.numero_funcionario || null,
            departamento: payload.departamento,
            cargo: payload.cargo || null,
            ativo: payload.ativo ?? true,
        })
        .select('*')
        .single()

    if (error) throw error
    return data as PessoalDirecaoMunicipal
}

export async function updatePessoalMunicipal(
    id: string,
    patch: Partial<
        Pick<
            PessoalDirecaoMunicipal,
            'nome' | 'email' | 'telefone' | 'numero_funcionario' | 'departamento' | 'cargo' | 'ativo'
        >
    >,
): Promise<void> {
    const { error } = await supabase
        .from('pessoal_direcao_municipal')
        .update(patch)
        .eq('id', id)

    if (error) throw error
}

export async function deletePessoalMunicipal(id: string): Promise<void> {
    const { error } = await supabase
        .from('pessoal_direcao_municipal')
        .delete()
        .eq('id', id)

    if (error) throw error
}
