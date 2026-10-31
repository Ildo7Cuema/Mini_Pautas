import { supabase } from '../lib/supabaseClient'

export interface HeaderConfig {
    id?: string
    user_id?: string
    escola_id?: string

    // Logo configuration
    logo_url?: string | null
    logo_width?: number
    logo_height?: number

    // Hierarchical information
    mostrar_republica?: boolean
    texto_republica?: string

    mostrar_governo_provincial?: boolean
    provincia?: string

    mostrar_orgao_educacao?: boolean
    nivel_ensino?: string // 'Ensino Secundário' ou 'Ensino Primário'
    municipio?: string

    nome_escola: string

    // Style configuration
    tamanho_fonte_mini_pauta?: number
    tamanho_fonte_outros?: number

    created_at?: string
    updated_at?: string
}

/**
 * Load header configuration for a specific school
 * @param escolaId - Required school ID to load configuration for
 */
export async function loadHeaderConfig(escolaId: string): Promise<HeaderConfig | null> {
    try {
        if (!escolaId) {
            throw new Error('escola_id is required to load header configuration')
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('User not authenticated')

        // maybeSingle: 0 rows → null without HTTP 406 (unlike .single())
        const { data, error } = await supabase
            .from('configuracao_cabecalho')
            .select('*')
            .eq('user_id', user.id)
            .eq('escola_id', escolaId)
            .maybeSingle()

        if (error) throw error

        return data
    } catch (err) {
        console.error('Error loading header config:', err)
        return null
    }
}

/**
 * Save or update header configuration for a specific school
 */
export async function saveHeaderConfig(config: HeaderConfig): Promise<HeaderConfig> {
    try {
        if (!config.escola_id) {
            throw new Error('escola_id is required to save header configuration')
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('User not authenticated')

        // Check if config already exists
        const existing = await loadHeaderConfig(config.escola_id)

        const configData = {
            ...config,
            user_id: user.id,
            escola_id: config.escola_id, // Ensure escola_id is always set
            updated_at: new Date().toISOString()
        }

        if (existing) {
            // Update existing config
            const { data, error } = await supabase
                .from('configuracao_cabecalho')
                .update(configData)
                .eq('id', existing.id)
                .select()
                .single()

            if (error) throw error
            return data
        } else {
            // Insert new config
            const { data, error } = await supabase
                .from('configuracao_cabecalho')
                .insert(configData)
                .select()
                .single()

            if (error) throw error
            return data
        }
    } catch (err) {
        console.error('Error saving header config:', err)
        throw err
    }
}

/**
 * Upload logo to Supabase Storage
 * @param file - Image file (PNG, JPG, JPEG)
 * @returns URL of the uploaded image
 */
export async function uploadLogo(file: File): Promise<string> {
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('User not authenticated')

        // Validate file type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg']
        if (!allowedTypes.includes(file.type)) {
            throw new Error('Formato de arquivo inválido. Use PNG, JPG ou JPEG.')
        }

        // Validate file size (max 2MB)
        const maxSize = 2 * 1024 * 1024 // 2MB
        if (file.size > maxSize) {
            throw new Error('Arquivo muito grande. Tamanho máximo: 2MB.')
        }

        // Generate unique filename
        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}_${Date.now()}.${fileExt}`
        const filePath = `logos/${fileName}`

        // Upload to Supabase Storage
        const { error } = await supabase.storage
            .from('mini-pauta-assets')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            })

        if (error) throw error

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('mini-pauta-assets')
            .getPublicUrl(filePath)

        return urlData.publicUrl
    } catch (err) {
        console.error('Error uploading logo:', err)
        throw err
    }
}

/**
 * Delete logo from Supabase Storage
 */
export async function deleteLogo(logoUrl: string): Promise<void> {
    try {
        // Extract file path from URL
        const urlParts = logoUrl.split('/mini-pauta-assets/')
        if (urlParts.length < 2) return

        const filePath = urlParts[1]

        const { error } = await supabase.storage
            .from('mini-pauta-assets')
            .remove([filePath])

        if (error) throw error
    } catch (err) {
        console.error('Error deleting logo:', err)
        // Don't throw - deletion failure shouldn't block other operations
    }
}

/**
 * Get the appropriate educational organization text based on nivel_ensino
 */
export function getOrgaoEducacao(nivelEnsino: string, provincia?: string, municipio?: string): string {
    const nivel = nivelEnsino.toLowerCase()

    if (nivel.includes('secundário') || nivel.includes('secundario')) {
        return `Direcção Provincial da Educação da ${provincia || 'Huíla'}`
    } else if (nivel.includes('primário') || nivel.includes('primario')) {
        return `Administração Municipal de ${municipio || 'Chipindo'}`
    }

    // Default fallback
    return `Direcção Provincial da Educação da ${provincia || 'Huíla'}`
}

/**
 * Get default header configuration
 */
export function getDefaultHeaderConfig(): Partial<HeaderConfig> {
    return {
        mostrar_republica: true,
        texto_republica: 'República de Angola',
        mostrar_governo_provincial: true,
        provincia: 'Huíla',
        mostrar_orgao_educacao: true,
        nivel_ensino: 'Ensino Secundário',
        municipio: 'Chipindo',
        nome_escola: 'Liceu nº 1837',
        tamanho_fonte_mini_pauta: 16,
        tamanho_fonte_outros: 10,
        logo_width: 50,
        logo_height: 50
    }
}
