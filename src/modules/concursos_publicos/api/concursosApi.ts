/**
 * Concursos Públicos API — Provincial + Municipal + Public
 */

import { supabase } from '../../../lib/supabaseClient'
import type {
    CabecalhoConcursoPdf,
    ConcursoAberturaMunicipal,
    ConcursoCategoria,
    ConcursoInscricao,
    ConcursoPublico,
    ConcursoRequisito,
    CreateConcursoRequest,
    EstadoAbertura,
    EstadoConcurso,
    EstadoInscricao,
    OrdenacaoInscricoes,
    PublicConcursoPayload,
} from '../types'

function slugify(input: string): string {
    return input
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48)
}

function codigoFromLabel(label: string, index: number): string {
    const base = slugify(label).replace(/-/g, '_').slice(0, 40) || `campo_${index + 1}`
    return base
}

// ---------------------------------------------------------------------------
// Provincial
// ---------------------------------------------------------------------------

export async function fetchConcursosProvinciais(provincia: string): Promise<ConcursoPublico[]> {
    const { data, error } = await supabase
        .from('concursos_publicos')
        .select('*')
        .eq('provincia', provincia)
        .order('created_at', { ascending: false })

    if (error) throw error

    const concursos = data || []
    const result: ConcursoPublico[] = []

    for (const c of concursos) {
        const [{ count: aberturas }, { count: inscricoes }] = await Promise.all([
            supabase
                .from('concurso_aberturas_municipais')
                .select('*', { count: 'exact', head: true })
                .eq('concurso_id', c.id),
            supabase
                .from('concurso_inscricoes')
                .select('*', { count: 'exact', head: true })
                .eq('concurso_id', c.id),
        ])

        result.push({
            ...c,
            aberturas_count: aberturas || 0,
            inscricoes_count: inscricoes || 0,
        })
    }

    return result
}

export async function fetchConcursoDetalhe(concursoId: string): Promise<ConcursoPublico | null> {
    const { data, error } = await supabase
        .from('concursos_publicos')
        .select('*')
        .eq('id', concursoId)
        .maybeSingle()

    if (error) throw error
    if (!data) return null

    const [{ data: categorias }, { data: requisitos }] = await Promise.all([
        supabase
            .from('concurso_categorias')
            .select('*')
            .eq('concurso_id', concursoId)
            .order('ordem'),
        supabase
            .from('concurso_requisitos')
            .select('*')
            .eq('concurso_id', concursoId)
            .order('ordem'),
    ])

    return {
        ...data,
        categorias: (categorias || []) as ConcursoCategoria[],
        requisitos: (requisitos || []).map((r: ConcursoRequisito) => ({
            ...r,
            opcoes: Array.isArray(r.opcoes) ? r.opcoes : [],
        })),
    }
}

export async function createConcursoProvincial(
    direcaoProvincialId: string,
    provincia: string,
    request: CreateConcursoRequest
): Promise<ConcursoPublico> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Utilizador não autenticado')

    const { data: concurso, error } = await supabase
        .from('concursos_publicos')
        .insert({
            direcao_provincial_id: direcaoProvincialId,
            provincia,
            titulo: request.titulo.trim(),
            descricao: request.descricao?.trim() || null,
            instrucoes: request.instrucoes?.trim() || null,
            data_inicio: request.data_inicio || null,
            data_fim: request.data_fim || null,
            estado: 'rascunho',
            created_by: user.id,
        })
        .select()
        .single()

    if (error) throw error

    if (request.categorias.length > 0) {
        const { error: catErr } = await supabase.from('concurso_categorias').insert(
            request.categorias.map((cat, i) => ({
                concurso_id: concurso.id,
                nome: cat.nome.trim(),
                descricao: cat.descricao || null,
                idade_min: cat.idade_min ?? null,
                idade_max: cat.idade_max ?? null,
                ordem: cat.ordem ?? i,
            }))
        )
        if (catErr) throw catErr
    }

    if (request.requisitos.length > 0) {
        const { error: reqErr } = await supabase.from('concurso_requisitos').insert(
            request.requisitos.map((req, i) => ({
                concurso_id: concurso.id,
                tipo: req.tipo,
                codigo: req.codigo?.trim() || codigoFromLabel(req.label, i),
                label: req.label.trim(),
                descricao: req.descricao || null,
                obrigatorio: req.obrigatorio ?? true,
                tipo_campo: req.tipo === 'campo' ? req.tipo_campo || 'texto' : null,
                opcoes: req.tipo === 'campo' ? req.opcoes || [] : [],
                permite_upload: req.tipo === 'documento',
                tipos_ficheiro: req.tipo === 'documento' ? req.tipos_ficheiro || ['pdf', 'jpg', 'jpeg', 'png'] : null,
                tamanho_max_mb: req.tipo === 'documento' ? req.tamanho_max_mb ?? 5 : null,
                ordem: req.ordem ?? i,
            }))
        )
        if (reqErr) throw reqErr
    }

    return (await fetchConcursoDetalhe(concurso.id))!
}

export async function updateConcursoProvincial(
    concursoId: string,
    patch: Partial<Pick<ConcursoPublico, 'titulo' | 'descricao' | 'instrucoes' | 'data_inicio' | 'data_fim'>>
): Promise<void> {
    const { error } = await supabase
        .from('concursos_publicos')
        .update(patch)
        .eq('id', concursoId)

    if (error) throw error
}

export async function replaceConcursoCategorias(
    concursoId: string,
    categorias: Omit<ConcursoCategoria, 'id' | 'concurso_id' | 'created_at'>[]
): Promise<void> {
    const { error: delErr } = await supabase
        .from('concurso_categorias')
        .delete()
        .eq('concurso_id', concursoId)
    if (delErr) throw delErr

    if (categorias.length === 0) return

    const { error } = await supabase.from('concurso_categorias').insert(
        categorias.map((cat, i) => ({
            concurso_id: concursoId,
            nome: cat.nome.trim(),
            descricao: cat.descricao || null,
            idade_min: cat.idade_min ?? null,
            idade_max: cat.idade_max ?? null,
            ordem: cat.ordem ?? i,
        }))
    )
    if (error) throw error
}

export async function replaceConcursoRequisitos(
    concursoId: string,
    requisitos: Omit<ConcursoRequisito, 'id' | 'concurso_id' | 'created_at'>[]
): Promise<void> {
    const { error: delErr } = await supabase
        .from('concurso_requisitos')
        .delete()
        .eq('concurso_id', concursoId)
    if (delErr) throw delErr

    if (requisitos.length === 0) return

    const { error } = await supabase.from('concurso_requisitos').insert(
        requisitos.map((req, i) => ({
            concurso_id: concursoId,
            tipo: req.tipo,
            codigo: req.codigo?.trim() || codigoFromLabel(req.label, i),
            label: req.label.trim(),
            descricao: req.descricao || null,
            obrigatorio: req.obrigatorio ?? true,
            tipo_campo: req.tipo === 'campo' ? req.tipo_campo || 'texto' : null,
            opcoes: req.tipo === 'campo' ? req.opcoes || [] : [],
            permite_upload: req.tipo === 'documento',
            tipos_ficheiro: req.tipo === 'documento' ? req.tipos_ficheiro || ['pdf', 'jpg', 'jpeg', 'png'] : null,
            tamanho_max_mb: req.tipo === 'documento' ? req.tamanho_max_mb ?? 5 : null,
            ordem: req.ordem ?? i,
        }))
    )
    if (error) throw error
}

export async function setEstadoConcurso(concursoId: string, estado: EstadoConcurso): Promise<void> {
    const { error } = await supabase
        .from('concursos_publicos')
        .update({ estado })
        .eq('id', concursoId)
    if (error) throw error
}

export async function deleteConcursoProvincial(concursoId: string): Promise<void> {
    const { error } = await supabase.from('concursos_publicos').delete().eq('id', concursoId)
    if (error) throw error
}

// ---------------------------------------------------------------------------
// Municipal
// ---------------------------------------------------------------------------

export async function fetchConcursosDisponiveisMunicipio(provincia: string): Promise<ConcursoPublico[]> {
    const { data, error } = await supabase
        .from('concursos_publicos')
        .select('*')
        .eq('provincia', provincia)
        .eq('estado', 'publicado')
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

export async function fetchAberturasMunicipais(direcaoMunicipalId: string): Promise<ConcursoAberturaMunicipal[]> {
    const { data, error } = await supabase
        .from('concurso_aberturas_municipais')
        .select('*, concurso:concursos_publicos(*)')
        .eq('direcao_municipal_id', direcaoMunicipalId)
        .order('created_at', { ascending: false })

    if (error) throw error

    const rows = data || []
    const result: ConcursoAberturaMunicipal[] = []

    for (const row of rows) {
        const { count } = await supabase
            .from('concurso_inscricoes')
            .select('*', { count: 'exact', head: true })
            .eq('abertura_id', row.id)

        result.push({
            ...row,
            cabecalho: (row.cabecalho || {}) as CabecalhoConcursoPdf,
            concurso: row.concurso as ConcursoPublico,
            inscricoes_count: count || 0,
        })
    }

    return result
}

export async function abrirConcursoMunicipal(params: {
    concursoId: string
    direcaoMunicipalId: string
    municipio: string
    provincia: string
    dataAbertura?: string | null
    dataFecho?: string | null
}): Promise<ConcursoAberturaMunicipal> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Utilizador não autenticado')

    const { data: existing } = await supabase
        .from('concurso_aberturas_municipais')
        .select('*')
        .eq('concurso_id', params.concursoId)
        .eq('direcao_municipal_id', params.direcaoMunicipalId)
        .maybeSingle()

    if (existing) {
        const { data, error } = await supabase
            .from('concurso_aberturas_municipais')
            .update({
                estado: 'aberto',
                data_abertura: params.dataAbertura || new Date().toISOString(),
                data_fecho: params.dataFecho || existing.data_fecho,
            })
            .eq('id', existing.id)
            .select()
            .single()
        if (error) throw error
        return { ...data, cabecalho: (data.cabecalho || {}) as CabecalhoConcursoPdf }
    }

    const baseSlug = `${slugify(params.municipio)}-${slugify(params.concursoId.slice(0, 8))}-${Date.now().toString(36)}`
    const slug = baseSlug || `concurso-${Date.now().toString(36)}`

    const { data, error } = await supabase
        .from('concurso_aberturas_municipais')
        .insert({
            concurso_id: params.concursoId,
            direcao_municipal_id: params.direcaoMunicipalId,
            municipio: params.municipio,
            provincia: params.provincia,
            slug,
            estado: 'aberto',
            data_abertura: params.dataAbertura || new Date().toISOString(),
            data_fecho: params.dataFecho || null,
            cabecalho: {
                mostrar_republica: true,
                texto_republica: 'REPÚBLICA DE ANGOLA',
                mostrar_governo_provincial: true,
                provincia: params.provincia,
                mostrar_orgao_educacao: true,
                municipio: params.municipio,
                nome_instituicao: `Direção Municipal da Educação — ${params.municipio}`,
            },
            created_by: user.id,
        })
        .select()
        .single()

    if (error) throw error
    return { ...data, cabecalho: (data.cabecalho || {}) as CabecalhoConcursoPdf }
}

export async function setEstadoAbertura(aberturaId: string, estado: EstadoAbertura): Promise<void> {
    const patch: Record<string, unknown> = { estado }
    if (estado === 'aberto') patch.data_abertura = new Date().toISOString()
    if (estado === 'encerrado') patch.data_fecho = new Date().toISOString()

    const { error } = await supabase
        .from('concurso_aberturas_municipais')
        .update(patch)
        .eq('id', aberturaId)

    if (error) throw error
}

export async function saveCabecalhoAbertura(
    aberturaId: string,
    cabecalho: CabecalhoConcursoPdf
): Promise<void> {
    const { error } = await supabase
        .from('concurso_aberturas_municipais')
        .update({ cabecalho })
        .eq('id', aberturaId)

    if (error) throw error
}

export async function uploadLogoCabecalhoConcurso(file: File): Promise<string> {
    const ext = file.name.split('.').pop() || 'png'
    const path = `cabecalhos/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('concursos-documentos').upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from('concursos-documentos').getPublicUrl(path)
    return data.publicUrl
}

export async function fetchInscricoesMunicipais(
    direcaoMunicipalId: string,
    options?: {
        aberturaId?: string
        concursoId?: string
        categoriaId?: string
        ordenacao?: OrdenacaoInscricoes
        search?: string
    }
): Promise<ConcursoInscricao[]> {
    let query = supabase
        .from('concurso_inscricoes')
        .select('*, categoria:concurso_categorias(*), documentos:concurso_inscricao_documentos(*)')
        .eq('direcao_municipal_id', direcaoMunicipalId)

    if (options?.aberturaId) query = query.eq('abertura_id', options.aberturaId)
    if (options?.concursoId) query = query.eq('concurso_id', options.concursoId)
    if (options?.categoriaId) query = query.eq('categoria_id', options.categoriaId)
    if (options?.search) {
        query = query.or(
            `nome_completo.ilike.%${options.search}%,bilhete_identidade.ilike.%${options.search}%,municipio.ilike.%${options.search}%`
        )
    }

    const ordenacao = options?.ordenacao || 'alfabetica'
    switch (ordenacao) {
        case 'idade':
            query = query.order('idade', { ascending: true }).order('nome_completo')
            break
        case 'categoria':
            query = query.order('categoria_id').order('nome_completo')
            break
        case 'municipio':
            query = query.order('municipio').order('nome_completo')
            break
        case 'data':
            query = query.order('created_at', { ascending: false })
            break
        default:
            query = query.order('nome_completo', { ascending: true })
    }

    const { data, error } = await query
    if (error) throw error
    return (data || []) as ConcursoInscricao[]
}

export async function updateEstadoInscricao(
    inscricaoId: string,
    estado: EstadoInscricao,
    observacoes?: string
): Promise<void> {
    const { error } = await supabase
        .from('concurso_inscricoes')
        .update({ estado, observacoes: observacoes ?? null })
        .eq('id', inscricaoId)
    if (error) throw error
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export async function fetchConcursoPublicoPorSlug(slug: string): Promise<PublicConcursoPayload> {
    const { data, error } = await supabase.rpc('get_concurso_publico_por_slug', { p_slug: slug })
    if (error) throw error
    return data as PublicConcursoPayload
}

export async function uploadDocumentoInscricaoPublico(
    slug: string,
    requisitoId: string,
    file: File
): Promise<{ file_url: string; filename: string; mime_type: string; tamanho_bytes: number }> {
    const ext = file.name.split('.').pop() || 'bin'
    const path = `inscricoes/${slug}/${requisitoId}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('concursos-documentos').upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from('concursos-documentos').getPublicUrl(path)
    return {
        file_url: data.publicUrl,
        filename: file.name,
        mime_type: file.type,
        tamanho_bytes: file.size,
    }
}

export async function submeterInscricaoPublica(params: {
    slug: string
    categoriaId: string | null
    nomeCompleto: string
    dataNascimento: string
    genero?: string | null
    bilheteIdentidade?: string | null
    telefone?: string | null
    email?: string | null
    municipio?: string | null
    camposExtra?: Record<string, string>
    documentos?: Array<{
        requisito_id: string
        file_url: string
        filename: string
        mime_type?: string
        tamanho_bytes?: number
    }>
}): Promise<{ ok: boolean; error?: string; inscricao_id?: string; message?: string }> {
    const { data, error } = await supabase.rpc('submeter_inscricao_concurso', {
        p_slug: params.slug,
        p_categoria_id: params.categoriaId,
        p_nome_completo: params.nomeCompleto,
        p_data_nascimento: params.dataNascimento,
        p_genero: params.genero || null,
        p_bilhete_identidade: params.bilheteIdentidade || null,
        p_telefone: params.telefone || null,
        p_email: params.email || null,
        p_municipio: params.municipio || null,
        p_campos_extra: params.camposExtra || {},
        p_documentos: params.documentos || [],
    })

    if (error) throw error
    return data as { ok: boolean; error?: string; inscricao_id?: string; message?: string }
}

export function publicConcursoUrl(slug: string): string {
    if (typeof window !== 'undefined') {
        return `${window.location.origin}/concurso/${slug}`
    }
    return `/concurso/${slug}`
}
