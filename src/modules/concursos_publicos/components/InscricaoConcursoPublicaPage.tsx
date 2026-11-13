/**
 * Página pública de inscrição — sem login.
 * Só mostra o formulário se a Direção Municipal tiver o concurso aberto.
 */

import { useEffect, useMemo, useState } from 'react'
import {
    fetchConcursoPublicoPorSlug,
    submeterInscricaoPublica,
    uploadDocumentoInscricaoPublico,
} from '../api/concursosApi'
import { PublicBrandMark } from '../../../components/auth/PublicBrandMark'
import type { ConcursoCategoria, ConcursoRequisito, PublicConcursoPayload } from '../types'

function getSlugFromPath(): string | null {
    const parts = window.location.pathname.split('/').filter(Boolean)
    if (parts[0] === 'concurso' && parts[1]) return decodeURIComponent(parts[1])
    const params = new URLSearchParams(window.location.search)
    return params.get('slug')
}

export function InscricaoConcursoPublicaPage() {
    const slug = useMemo(() => getSlugFromPath(), [])
    const [loading, setLoading] = useState(true)
    const [payload, setPayload] = useState<PublicConcursoPayload | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [successId, setSuccessId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const [categoriaId, setCategoriaId] = useState('')
    const [nomeCompleto, setNomeCompleto] = useState('')
    const [dataNascimento, setDataNascimento] = useState('')
    const [genero, setGenero] = useState('')
    const [bi, setBi] = useState('')
    const [telefone, setTelefone] = useState('')
    const [email, setEmail] = useState('')
    const [municipio, setMunicipio] = useState('')
    const [camposExtra, setCamposExtra] = useState<Record<string, string>>({})
    const [docs, setDocs] = useState<
        Record<string, { file_url: string; filename: string; mime_type?: string; tamanho_bytes?: number } | null>
    >({})
    const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)

    useEffect(() => {
        if (!slug) {
            setLoading(false)
            setPayload({ ok: false, error: 'Link de concurso inválido' })
            return
        }
        ;(async () => {
            try {
                const data = await fetchConcursoPublicoPorSlug(slug)
                setPayload(data)
                if (data.ok && data.abertura?.municipio) {
                    setMunicipio(data.abertura.municipio)
                }
                if (data.ok && data.categorias?.length === 1) {
                    setCategoriaId(data.categorias[0].id)
                }
            } catch (err) {
                setPayload({
                    ok: false,
                    error: err instanceof Error ? err.message : 'Não foi possível carregar o concurso',
                })
            } finally {
                setLoading(false)
            }
        })()
    }, [slug])

    const requisitosCampo = (payload?.requisitos || []).filter((r) => r.tipo === 'campo')
    const requisitosDoc = (payload?.requisitos || []).filter((r) => r.tipo === 'documento')

    const handleUpload = async (req: ConcursoRequisito, file: File) => {
        if (!slug) return
        const maxMb = req.tamanho_max_mb || 5
        if (file.size > maxMb * 1024 * 1024) {
            setError(`Ficheiro demasiado grande (máx. ${maxMb} MB)`)
            return
        }
        const ext = (file.name.split('.').pop() || '').toLowerCase()
        const allowed = (req.tipos_ficheiro || ['pdf', 'jpg', 'jpeg', 'png']).map((t) => t.toLowerCase())
        if (allowed.length && !allowed.includes(ext)) {
            setError(`Tipo de ficheiro não permitido. Use: ${allowed.join(', ')}`)
            return
        }

        setUploadingDoc(req.id)
        setError(null)
        try {
            const uploaded = await uploadDocumentoInscricaoPublico(slug, req.id, file)
            setDocs((prev) => ({ ...prev, [req.id]: uploaded }))
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha no upload')
        } finally {
            setUploadingDoc(null)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!slug || !payload?.ok) return

        if (!nomeCompleto.trim() || !dataNascimento) {
            setError('Preencha nome e data de nascimento')
            return
        }
        if ((payload.categorias?.length || 0) > 0 && !categoriaId) {
            setError('Seleccione a categoria')
            return
        }

        for (const req of requisitosCampo) {
            if (req.obrigatorio && !camposExtra[req.codigo]?.trim()) {
                setError(`Campo obrigatório: ${req.label}`)
                return
            }
        }
        for (const req of requisitosDoc) {
            if (req.obrigatorio && !docs[req.id]?.file_url) {
                setError(`Documento obrigatório: ${req.label}`)
                return
            }
        }

        setSubmitting(true)
        setError(null)
        try {
            const documentos = Object.entries(docs)
                .filter(([, v]) => v?.file_url)
                .map(([requisito_id, v]) => ({
                    requisito_id,
                    file_url: v!.file_url,
                    filename: v!.filename,
                    mime_type: v!.mime_type,
                    tamanho_bytes: v!.tamanho_bytes,
                }))

            const result = await submeterInscricaoPublica({
                slug,
                categoriaId: categoriaId || null,
                nomeCompleto: nomeCompleto.trim(),
                dataNascimento,
                genero: genero || null,
                bilheteIdentidade: bi || null,
                telefone: telefone || null,
                email: email || null,
                municipio: municipio || payload.abertura?.municipio || null,
                camposExtra,
                documentos,
            })

            if (!result.ok) {
                setError(result.error || 'Não foi possível submeter a inscrição')
                return
            }
            setSuccessId(result.inscricao_id || 'ok')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao submeter inscrição')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <PublicBrandMark />
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        )
    }

    if (!payload?.ok) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-blue-100 flex items-center justify-center p-4">
                <PublicBrandMark />
                <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center space-y-3">
                    <h1 className="text-xl font-bold text-slate-900">Inscrições indisponíveis</h1>
                    <p className="text-slate-600 text-sm">
                        {payload?.error || 'Não há concurso aberto neste momento para esta instituição.'}
                    </p>
                    <a href="/" className="inline-block mt-4 text-sm font-medium text-blue-700 hover:underline">
                        Voltar ao início
                    </a>
                </div>
            </div>
        )
    }

    if (successId) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-sky-50 to-blue-100 flex items-center justify-center p-4">
                <PublicBrandMark />
                <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-emerald-200 p-8 text-center space-y-3">
                    <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl">
                        ✓
                    </div>
                    <h1 className="text-xl font-bold text-slate-900">Inscrição submetida</h1>
                    <p className="text-slate-600 text-sm">
                        A sua candidatura a <strong>{payload.concurso?.titulo}</strong> foi recebida pela Direção Municipal
                        de {payload.abertura?.municipio}.
                    </p>
                    {successId !== 'ok' && (
                        <p className="text-xs text-slate-400">Referência: {successId}</p>
                    )}
                </div>
            </div>
        )
    }

    const categorias = (payload.categorias || []) as ConcursoCategoria[]

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/80 to-blue-100/90 py-8 px-4">
            <PublicBrandMark />
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-950 text-white p-6 md:p-8">
                        <p className="text-white/70 text-sm mb-1">
                            {payload.abertura?.municipio} · {payload.concurso?.provincia}
                        </p>
                        <h1 className="text-2xl md:text-3xl font-bold">{payload.concurso?.titulo}</h1>
                        {payload.concurso?.descricao && (
                            <p className="text-white/80 mt-2 text-sm">{payload.concurso.descricao}</p>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5">
                        {payload.concurso?.instrucoes && (
                            <div className="rounded-xl bg-sky-50 border border-sky-100 px-4 py-3 text-sm text-sky-900">
                                {payload.concurso.instrucoes}
                            </div>
                        )}

                        {error && (
                            <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
                                {error}
                            </div>
                        )}

                        {categorias.length > 0 && (
                            <label className="block text-sm space-y-1">
                                <span className="font-medium text-slate-700">Categoria *</span>
                                <select
                                    required
                                    value={categoriaId}
                                    onChange={(e) => setCategoriaId(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                                >
                                    <option value="">Seleccione...</option>
                                    {categorias.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.nome}
                                            {c.idade_min != null || c.idade_max != null
                                                ? ` (${c.idade_min ?? '—'}–${c.idade_max ?? '—'} anos)`
                                                : ''}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}

                        <label className="block text-sm space-y-1">
                            <span className="font-medium text-slate-700">Nome completo *</span>
                            <input
                                required
                                value={nomeCompleto}
                                onChange={(e) => setNomeCompleto(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                            />
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="block text-sm space-y-1">
                                <span className="font-medium text-slate-700">Data de nascimento *</span>
                                <input
                                    required
                                    type="date"
                                    value={dataNascimento}
                                    onChange={(e) => setDataNascimento(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                                />
                            </label>
                            <label className="block text-sm space-y-1">
                                <span className="font-medium text-slate-700">Género</span>
                                <select
                                    value={genero}
                                    onChange={(e) => setGenero(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                                >
                                    <option value="">—</option>
                                    <option value="M">Masculino</option>
                                    <option value="F">Feminino</option>
                                    <option value="OUTRO">Outro</option>
                                </select>
                            </label>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="block text-sm space-y-1">
                                <span className="font-medium text-slate-700">Bilhete de Identidade</span>
                                <input
                                    value={bi}
                                    onChange={(e) => setBi(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                                />
                            </label>
                            <label className="block text-sm space-y-1">
                                <span className="font-medium text-slate-700">Município</span>
                                <input
                                    value={municipio}
                                    onChange={(e) => setMunicipio(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                                />
                            </label>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="block text-sm space-y-1">
                                <span className="font-medium text-slate-700">Telefone</span>
                                <input
                                    value={telefone}
                                    onChange={(e) => setTelefone(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                                />
                            </label>
                            <label className="block text-sm space-y-1">
                                <span className="font-medium text-slate-700">Email</span>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                                />
                            </label>
                        </div>

                        {requisitosCampo.map((req) => (
                            <label key={req.id} className="block text-sm space-y-1">
                                <span className="font-medium text-slate-700">
                                    {req.label}
                                    {req.obrigatorio ? ' *' : ''}
                                </span>
                                {req.tipo_campo === 'textarea' ? (
                                    <textarea
                                        required={req.obrigatorio}
                                        value={camposExtra[req.codigo] || ''}
                                        onChange={(e) =>
                                            setCamposExtra((p) => ({ ...p, [req.codigo]: e.target.value }))
                                        }
                                        rows={3}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                                    />
                                ) : req.tipo_campo === 'select' ? (
                                    <select
                                        required={req.obrigatorio}
                                        value={camposExtra[req.codigo] || ''}
                                        onChange={(e) =>
                                            setCamposExtra((p) => ({ ...p, [req.codigo]: e.target.value }))
                                        }
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                                    >
                                        <option value="">Seleccione...</option>
                                        {(req.opcoes || []).map((opt) => (
                                            <option key={opt} value={opt}>
                                                {opt}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        required={req.obrigatorio}
                                        type={
                                            req.tipo_campo === 'numero'
                                                ? 'number'
                                                : req.tipo_campo === 'data'
                                                  ? 'date'
                                                  : req.tipo_campo === 'email'
                                                    ? 'email'
                                                    : req.tipo_campo === 'telefone'
                                                      ? 'tel'
                                                      : 'text'
                                        }
                                        value={camposExtra[req.codigo] || ''}
                                        onChange={(e) =>
                                            setCamposExtra((p) => ({ ...p, [req.codigo]: e.target.value }))
                                        }
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                                    />
                                )}
                            </label>
                        ))}

                        {requisitosDoc.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="font-semibold text-slate-800">Documentos</h3>
                                {requisitosDoc.map((req) => (
                                    <div key={req.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                                        <div className="text-sm font-medium text-slate-700">
                                            {req.label}
                                            {req.obrigatorio ? ' *' : ''}
                                        </div>
                                        {req.descricao && <p className="text-xs text-slate-500">{req.descricao}</p>}
                                        <p className="text-xs text-slate-400">
                                            Formatos: {(req.tipos_ficheiro || ['pdf', 'jpg', 'png']).join(', ')} · máx.{' '}
                                            {req.tamanho_max_mb || 5} MB
                                        </p>
                                        <input
                                            type="file"
                                            accept={(req.tipos_ficheiro || [])
                                                .map((t) => `.${t}`)
                                                .join(',')}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0]
                                                if (file) handleUpload(req, file)
                                            }}
                                            className="w-full text-sm"
                                        />
                                        {uploadingDoc === req.id && (
                                            <p className="text-xs text-blue-600">A carregar...</p>
                                        )}
                                        {docs[req.id] && (
                                            <p className="text-xs text-emerald-700">✓ {docs[req.id]!.filename}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full rounded-xl bg-blue-600 text-white py-3.5 font-semibold disabled:opacity-60"
                        >
                            {submitting ? 'A submeter...' : 'Submeter inscrição'}
                        </button>

                        <p className="text-center text-xs text-slate-400">
                            Página pública · EduGest Angola
                        </p>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default InscricaoConcursoPublicaPage
