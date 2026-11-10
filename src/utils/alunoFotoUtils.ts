/**
 * Upload / remoção de fotografia tipo passe do aluno.
 * Bucket: mini-pauta-assets / fotos-alunos/{uid}/{alunoId}_{ts}.ext
 *
 * Imagens acima do limite são redimensionadas e comprimidas automaticamente
 * (proporção tipo passe) para o utilizador não precisar de outra app.
 */

import { supabase } from '../lib/supabaseClient'

const BUCKET = 'mini-pauta-assets'
const FOLDER = 'fotos-alunos'
/** Tamanho máximo após processamento (upload) */
const MAX_BYTES = 2 * 1024 * 1024
/** Aceita ficheiros originais maiores; serão comprimidos */
const MAX_SOURCE_BYTES = 25 * 1024 * 1024
/** Dimensão máxima do lado maior (foto passe ~3:4) */
const MAX_EDGE = 1200
const ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

function validateFotoFile(file: File): void {
    if (!ALLOWED.has(file.type)) {
        throw new Error('Formato inválido. Use JPG, PNG ou WEBP.')
    }
    if (file.size > MAX_SOURCE_BYTES) {
        throw new Error('Ficheiro demasiado grande. Máximo original: 25 MB.')
    }
}

function extractStoragePath(fotoUrl: string): string | null {
    const marker = `/${BUCKET}/`
    const idx = fotoUrl.indexOf(marker)
    if (idx < 0) return null
    return decodeURIComponent(fotoUrl.slice(idx + marker.length).split('?')[0])
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => {
            URL.revokeObjectURL(url)
            resolve(img)
        }
        img.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error('Não foi possível ler a imagem. Escolha outro ficheiro.'))
        }
        img.src = url
    })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error('Falha ao comprimir a imagem.'))
                    return
                }
                resolve(blob)
            },
            type,
            quality
        )
    })
}

/**
 * Redimensiona e comprime a imagem para caber em MAX_BYTES,
 * com lado máximo MAX_EDGE (adequado a foto tipo passe).
 */
export async function prepareAlunoFotoPasse(file: File): Promise<File> {
    validateFotoFile(file)

    // Já dentro do limite e dimensões razoáveis: manter original
    if (file.size <= MAX_BYTES) {
        try {
            const img = await loadImageFromFile(file)
            if (img.naturalWidth <= MAX_EDGE && img.naturalHeight <= MAX_EDGE) {
                return file
            }
        } catch {
            return file
        }
    }

    const img = await loadImageFromFile(file)
    const srcW = img.naturalWidth || img.width
    const srcH = img.naturalHeight || img.height
    if (!srcW || !srcH) {
        throw new Error('Imagem inválida ou corrompida.')
    }

    const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH))
    let targetW = Math.max(1, Math.round(srcW * scale))
    let targetH = Math.max(1, Math.round(srcH * scale))

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Este navegador não permite processar imagens.')

    // Preferir JPEG no resultado (melhor compressão para fotos)
    const outputType = 'image/jpeg'
    const qualities = [0.88, 0.8, 0.72, 0.64, 0.55, 0.45, 0.36]

    let bestBlob: Blob | null = null

    for (let attempt = 0; attempt < 8; attempt++) {
        canvas.width = targetW
        canvas.height = targetH
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, targetW, targetH)
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, targetW, targetH)

        for (const q of qualities) {
            const blob = await canvasToBlob(canvas, outputType, q)
            bestBlob = blob
            if (blob.size <= MAX_BYTES) {
                const baseName = file.name.replace(/\.[^.]+$/, '') || 'foto-passe'
                return new File([blob], `${baseName}.jpg`, {
                    type: outputType,
                    lastModified: Date.now(),
                })
            }
        }

        // Ainda grande: reduzir dimensões e tentar de novo
        targetW = Math.max(320, Math.round(targetW * 0.82))
        targetH = Math.max(400, Math.round(targetH * 0.82))
    }

    if (bestBlob && bestBlob.size <= MAX_BYTES) {
        const baseName = file.name.replace(/\.[^.]+$/, '') || 'foto-passe'
        return new File([bestBlob], `${baseName}.jpg`, {
            type: outputType,
            lastModified: Date.now(),
        })
    }

    throw new Error(
        'Não foi possível reduzir a imagem para menos de 2 MB. Experimente outra fotografia.'
    )
}

/**
 * Faz upload da foto tipo passe e actualiza alunos.foto_url.
 * Comprime automaticamente se o ficheiro exceder 2 MB.
 */
export async function uploadAlunoFoto(alunoId: string, file: File): Promise<string> {
    const prepared = await prepareAlunoFotoPasse(file)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Sessão expirada. Inicie sessão novamente.')

    const { data: actual } = await supabase
        .from('alunos')
        .select('foto_url')
        .eq('id', alunoId)
        .maybeSingle()

    const ext = prepared.type === 'image/png' ? 'png' : prepared.type === 'image/webp' ? 'webp' : 'jpg'
    const filePath = `${FOLDER}/${user.id}/${alunoId}_${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, prepared, {
            cacheControl: '3600',
            upsert: false,
            contentType: prepared.type || 'image/jpeg',
        })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
    const publicUrl = urlData.publicUrl

    const { error: updateError } = await supabase
        .from('alunos')
        .update({ foto_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', alunoId)

    if (updateError) {
        await supabase.storage.from(BUCKET).remove([filePath]).catch(() => {})
        throw updateError
    }

    if (actual?.foto_url) {
        const oldPath = extractStoragePath(actual.foto_url)
        if (oldPath && oldPath !== filePath) {
            await supabase.storage.from(BUCKET).remove([oldPath]).catch(() => {})
        }
    }

    return publicUrl
}

export async function removeAlunoFoto(alunoId: string, fotoUrl?: string | null): Promise<void> {
    const { error } = await supabase
        .from('alunos')
        .update({ foto_url: null, updated_at: new Date().toISOString() })
        .eq('id', alunoId)

    if (error) throw error

    if (fotoUrl) {
        const path = extractStoragePath(fotoUrl)
        if (path) {
            await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
        }
    }
}
