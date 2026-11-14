import { supabase } from '../../../lib/supabaseClient'
import type { PessoalDirecaoProvincial } from '../../../types'

export async function fetchPessoalProvincial(
    direcaoProvincialId: string,
): Promise<PessoalDirecaoProvincial[]> {
    const { data, error } = await supabase
        .from('pessoal_direcao_provincial')
        .select('*')
        .eq('direcao_provincial_id', direcaoProvincialId)
        .order('nome', { ascending: true })

    if (error) throw error
    return (data || []) as PessoalDirecaoProvincial[]
}

export async function createPessoalProvincial(
    payload: Omit<PessoalDirecaoProvincial, 'id' | 'created_at' | 'updated_at' | 'user_id'>,
): Promise<PessoalDirecaoProvincial> {
    const { data, error } = await supabase
        .from('pessoal_direcao_provincial')
        .insert({
            direcao_provincial_id: payload.direcao_provincial_id,
            nome: payload.nome,
            email: payload.email,
            telefone: payload.telefone || null,
            numero_funcionario: payload.numero_funcionario || null,
            departamento: payload.departamento,
            cargo: payload.cargo || null,
            ativo: payload.ativo ?? true,
            data_nascimento: payload.data_nascimento || null,
            data_admissao: payload.data_admissao || null,
            genero: payload.genero || null,
            numero_filhos: payload.numero_filhos ?? 0,
        })
        .select('*')
        .single()

    if (error) throw error
    return data as PessoalDirecaoProvincial
}

export async function updatePessoalProvincial(
    id: string,
    patch: Partial<
        Pick<
            PessoalDirecaoProvincial,
            | 'nome'
            | 'email'
            | 'telefone'
            | 'numero_funcionario'
            | 'departamento'
            | 'cargo'
            | 'ativo'
            | 'data_nascimento'
            | 'data_admissao'
            | 'genero'
            | 'numero_filhos'
        >
    >,
): Promise<void> {
    const { error } = await supabase
        .from('pessoal_direcao_provincial')
        .update(patch)
        .eq('id', id)

    if (error) throw error
}

export async function deletePessoalProvincial(id: string): Promise<void> {
    const { error } = await supabase
        .from('pessoal_direcao_provincial')
        .delete()
        .eq('id', id)

    if (error) throw error
}
