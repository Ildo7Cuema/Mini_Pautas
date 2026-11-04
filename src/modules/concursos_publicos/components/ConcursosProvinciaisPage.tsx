/**
 * Direção Provincial — criar/publicar concursos com requisitos e documentos
 */

import { useMemo, useState } from 'react'
import { Icons } from '../../../components/ui/Icons'
import { useConcursosProvinciais } from '../hooks/useConcursosProvinciais'
import type {
    ConcursoPublico,
    CreateConcursoRequest,
    TipoCampoRequisito,
    TipoRequisito,
} from '../types'
import { CORES_ESTADO_CONCURSO, LABELS_ESTADO_CONCURSO } from '../types'

type CatDraft = CreateConcursoRequest['categorias'][number]
type ReqDraft = CreateConcursoRequest['requisitos'][number]

const emptyCat = (): CatDraft => ({ nome: '', descricao: null, idade_min: null, idade_max: null, ordem: 0 })
const emptyReq = (tipo: TipoRequisito = 'campo'): ReqDraft => ({
    tipo,
    codigo: '',
    label: '',
    descricao: null,
    obrigatorio: true,
    tipo_campo: tipo === 'campo' ? 'texto' : null,
    opcoes: [],
    permite_upload: tipo === 'documento',
    tipos_ficheiro: tipo === 'documento' ? ['pdf', 'jpg', 'jpeg', 'png'] : null,
    tamanho_max_mb: tipo === 'documento' ? 5 : null,
    ordem: 0,
})

export function ConcursosProvinciaisPage() {
    const { concursos, loading, error, criar, actualizar, publicar, encerrar, eliminar, detalhe } =
        useConcursosProvinciais()

    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<ConcursoPublico | null>(null)
    const [saving, setSaving] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)

    const [titulo, setTitulo] = useState('')
    const [descricao, setDescricao] = useState('')
    const [instrucoes, setInstrucoes] = useState('')
    const [dataInicio, setDataInicio] = useState('')
    const [dataFim, setDataFim] = useState('')
    const [categorias, setCategorias] = useState<CatDraft[]>([emptyCat()])
    const [requisitos, setRequisitos] = useState<ReqDraft[]>([
        emptyReq('campo'),
        { ...emptyReq('documento'), label: 'Bilhete de Identidade (cópia)', codigo: 'doc_bi' },
    ])

    const filtered = useMemo(
        () =>
            concursos.filter((c) =>
                c.titulo.toLowerCase().includes(search.toLowerCase())
            ),
        [concursos, search]
    )

    const resetForm = () => {
        setTitulo('')
        setDescricao('')
        setInstrucoes('')
        setDataInicio('')
        setDataFim('')
        setCategorias([emptyCat()])
        setRequisitos([
            emptyReq('campo'),
            { ...emptyReq('documento'), label: 'Bilhete de Identidade (cópia)', codigo: 'doc_bi' },
        ])
        setEditing(null)
        setFormError(null)
    }

    const openCreate = () => {
        resetForm()
        setShowModal(true)
    }

    const openEdit = async (c: ConcursoPublico) => {
        setFormError(null)
        setSaving(true)
        try {
            const full = await detalhe(c.id)
            if (!full) throw new Error('Concurso não encontrado')
            setEditing(full)
            setTitulo(full.titulo)
            setDescricao(full.descricao || '')
            setInstrucoes(full.instrucoes || '')
            setDataInicio(full.data_inicio || '')
            setDataFim(full.data_fim || '')
            setCategorias(
                full.categorias?.length
                    ? full.categorias.map((cat, i) => ({
                          nome: cat.nome,
                          descricao: cat.descricao,
                          idade_min: cat.idade_min,
                          idade_max: cat.idade_max,
                          ordem: cat.ordem ?? i,
                      }))
                    : [emptyCat()]
            )
            setRequisitos(
                full.requisitos?.length
                    ? full.requisitos.map((r, i) => ({
                          tipo: r.tipo,
                          codigo: r.codigo,
                          label: r.label,
                          descricao: r.descricao,
                          obrigatorio: r.obrigatorio,
                          tipo_campo: r.tipo_campo,
                          opcoes: r.opcoes || [],
                          permite_upload: r.permite_upload,
                          tipos_ficheiro: r.tipos_ficheiro,
                          tamanho_max_mb: r.tamanho_max_mb,
                          ordem: r.ordem ?? i,
                      }))
                    : [emptyReq('campo')]
            )
            setShowModal(true)
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Erro ao carregar concurso')
        } finally {
            setSaving(false)
        }
    }

    const handleSave = async () => {
        if (!titulo.trim()) {
            setFormError('Título é obrigatório')
            return
        }
        const cats = categorias.filter((c) => c.nome.trim())
        if (cats.length === 0) {
            setFormError('Adicione pelo menos uma categoria de inscrição')
            return
        }
        const reqs = requisitos.filter((r) => r.label.trim())
        if (reqs.length === 0) {
            setFormError('Adicione pelo menos um requisito (campo ou documento)')
            return
        }

        setSaving(true)
        setFormError(null)
        try {
            const payload: CreateConcursoRequest = {
                titulo: titulo.trim(),
                descricao: descricao.trim() || undefined,
                instrucoes: instrucoes.trim() || undefined,
                data_inicio: dataInicio || null,
                data_fim: dataFim || null,
                categorias: cats.map((c, i) => ({ ...c, ordem: i })),
                requisitos: reqs.map((r, i) => ({ ...r, ordem: i })),
            }
            if (editing) {
                await actualizar(
                    editing.id,
                    {
                        titulo: payload.titulo,
                        descricao: payload.descricao || null,
                        instrucoes: payload.instrucoes || null,
                        data_inicio: payload.data_inicio,
                        data_fim: payload.data_fim,
                    },
                    payload.categorias,
                    payload.requisitos
                )
            } else {
                await criar(payload)
            }
            setShowModal(false)
            resetForm()
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Erro ao guardar')
        } finally {
            setSaving(false)
        }
    }

    if (loading && concursos.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-24 md:pb-6 animate-fade-in">
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 rounded-2xl p-6 md:p-8 text-white shadow-xl">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1
                            className="text-2xl md:text-3xl font-bold tracking-tight text-white"
                            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.35)' }}
                        >
                            Concursos Públicos
                        </h1>
                        <p
                            className="text-white mt-1.5 text-sm md:text-base font-medium leading-relaxed"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                        >
                            Defina requisitos e documentos para as Direções Municipais abrirem inscrições
                        </p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-900 rounded-xl font-semibold hover:bg-slate-100 min-h-[48px] shadow-sm"
                    >
                        <Icons.Plus className="w-5 h-5" />
                        Novo concurso
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm font-medium">
                    {error}
                </div>
            )}

            <div className="flex gap-3">
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Pesquisar concurso..."
                    className="flex-1 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {filtered.map((c) => {
                    const cor = CORES_ESTADO_CONCURSO[c.estado]
                    return (
                        <div key={c.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 md:p-5 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <h3 className="text-base md:text-lg font-bold text-slate-900 leading-snug">{c.titulo}</h3>
                                    <span className={`shrink-0 px-2.5 py-1 text-xs font-semibold rounded-full border border-black/5 ${cor.bg} ${cor.text}`}>
                                        {LABELS_ESTADO_CONCURSO[c.estado]}
                                    </span>
                                </div>
                                {c.descricao && (
                                    <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">{c.descricao}</p>
                                )}
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold">
                                        {c.aberturas_count || 0} aberturas
                                    </span>
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold">
                                        {c.inscricoes_count || 0} inscrições
                                    </span>
                                    {c.data_inicio && (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-medium">
                                            Início: {new Date(c.data_inicio).toLocaleDateString('pt-AO')}
                                        </span>
                                    )}
                                    {c.data_fim && (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-medium">
                                            Fim: {new Date(c.data_fim).toLocaleDateString('pt-AO')}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-wrap border-t border-slate-200 bg-slate-50/80">
                                <button
                                    onClick={() => openEdit(c)}
                                    className="flex-1 min-w-[100px] py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                                >
                                    Editar
                                </button>
                                {c.estado !== 'publicado' && c.estado !== 'encerrado' && (
                                    <button
                                        onClick={() => publicar(c.id, true)}
                                        className="flex-1 min-w-[100px] py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                                    >
                                        Publicar
                                    </button>
                                )}
                                {c.estado === 'publicado' && (
                                    <>
                                        <button
                                            onClick={() => publicar(c.id, false)}
                                            className="flex-1 min-w-[100px] py-3 text-sm font-semibold text-amber-800 hover:bg-amber-50"
                                        >
                                            Despublicar
                                        </button>
                                        <button
                                            onClick={() => encerrar(c.id)}
                                            className="flex-1 min-w-[100px] py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                                        >
                                            Encerrar
                                        </button>
                                    </>
                                )}
                                {c.estado === 'rascunho' && (
                                    <button
                                        onClick={async () => {
                                            if (confirm('Eliminar este concurso?')) await eliminar(c.id)
                                        }}
                                        className="flex-1 min-w-[100px] py-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                                    >
                                        Eliminar
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {filtered.length === 0 && (
                <div className="text-center py-16 text-slate-700 font-medium">
                    Nenhum concurso criado. Publique um concurso para as Direções Municipais.
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <div className="absolute inset-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-3xl md:w-full md:mx-4 md:max-h-[92vh] bg-white md:rounded-2xl shadow-2xl flex flex-col">
                        <div className="flex items-center justify-between px-4 py-4 md:px-6 border-b border-slate-100">
                            <h2 className="text-lg font-semibold text-slate-900">
                                {editing ? 'Editar concurso' : 'Novo concurso público'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-slate-100">
                                <Icons.X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                            {formError && (
                                <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
                                    {formError}
                                </div>
                            )}

                            <section className="space-y-3">
                                <h3 className="font-semibold text-slate-800">Dados gerais</h3>
                                <input
                                    value={titulo}
                                    onChange={(e) => setTitulo(e.target.value)}
                                    placeholder="Título do concurso *"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                                />
                                <textarea
                                    value={descricao}
                                    onChange={(e) => setDescricao(e.target.value)}
                                    placeholder="Descrição"
                                    rows={3}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                                />
                                <textarea
                                    value={instrucoes}
                                    onChange={(e) => setInstrucoes(e.target.value)}
                                    placeholder="Instruções para os candidatos"
                                    rows={2}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <label className="text-sm text-slate-600 space-y-1">
                                        <span>Data início</span>
                                        <input
                                            type="date"
                                            value={dataInicio}
                                            onChange={(e) => setDataInicio(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                                        />
                                    </label>
                                    <label className="text-sm text-slate-600 space-y-1">
                                        <span>Data fim</span>
                                        <input
                                            type="date"
                                            value={dataFim}
                                            onChange={(e) => setDataFim(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                                        />
                                    </label>
                                </div>
                            </section>

                            <section className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-slate-800">Categorias de inscrição</h3>
                                    <button
                                        type="button"
                                        onClick={() => setCategorias((prev) => [...prev, emptyCat()])}
                                        className="text-sm text-blue-700 font-medium"
                                    >
                                        + Categoria
                                    </button>
                                </div>
                                {categorias.map((cat, idx) => (
                                    <div key={idx} className="rounded-xl border border-slate-200 p-3 space-y-2">
                                        <div className="flex gap-2">
                                            <input
                                                value={cat.nome}
                                                onChange={(e) =>
                                                    setCategorias((prev) =>
                                                        prev.map((c, i) => (i === idx ? { ...c, nome: e.target.value } : c))
                                                    )
                                                }
                                                placeholder="Nome da categoria *"
                                                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                            />
                                            {categorias.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setCategorias((prev) => prev.filter((_, i) => i !== idx))}
                                                    className="px-2 text-red-600"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="number"
                                                value={cat.idade_min ?? ''}
                                                onChange={(e) =>
                                                    setCategorias((prev) =>
                                                        prev.map((c, i) =>
                                                            i === idx
                                                                ? { ...c, idade_min: e.target.value ? Number(e.target.value) : null }
                                                                : c
                                                        )
                                                    )
                                                }
                                                placeholder="Idade mín."
                                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                            />
                                            <input
                                                type="number"
                                                value={cat.idade_max ?? ''}
                                                onChange={(e) =>
                                                    setCategorias((prev) =>
                                                        prev.map((c, i) =>
                                                            i === idx
                                                                ? { ...c, idade_max: e.target.value ? Number(e.target.value) : null }
                                                                : c
                                                        )
                                                    )
                                                }
                                                placeholder="Idade máx."
                                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </section>

                            <section className="space-y-3">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <h3 className="font-semibold text-slate-800">Requisitos e documentos</h3>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setRequisitos((prev) => [...prev, emptyReq('campo')])}
                                            className="text-sm text-blue-700 font-medium"
                                        >
                                            + Campo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRequisitos((prev) => [...prev, emptyReq('documento')])}
                                            className="text-sm text-blue-700 font-medium"
                                        >
                                            + Documento
                                        </button>
                                    </div>
                                </div>
                                {requisitos.map((req, idx) => (
                                    <div key={idx} className="rounded-xl border border-slate-200 p-3 space-y-2">
                                        <div className="flex flex-wrap gap-2 items-center">
                                            <span
                                                className={`text-xs font-medium px-2 py-1 rounded-full ${
                                                    req.tipo === 'documento'
                                                        ? 'bg-violet-100 text-violet-800'
                                                        : 'bg-sky-100 text-sky-800'
                                                }`}
                                            >
                                                {req.tipo === 'documento' ? 'Upload de documento' : 'Campo do formulário'}
                                            </span>
                                            <label className="flex items-center gap-1 text-xs text-slate-600 ml-auto">
                                                <input
                                                    type="checkbox"
                                                    checked={req.obrigatorio}
                                                    onChange={(e) =>
                                                        setRequisitos((prev) =>
                                                            prev.map((r, i) =>
                                                                i === idx ? { ...r, obrigatorio: e.target.checked } : r
                                                            )
                                                        )
                                                    }
                                                />
                                                Obrigatório
                                            </label>
                                            {requisitos.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setRequisitos((prev) => prev.filter((_, i) => i !== idx))}
                                                    className="text-red-600 text-sm"
                                                >
                                                    Remover
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            value={req.label}
                                            onChange={(e) =>
                                                setRequisitos((prev) =>
                                                    prev.map((r, i) => (i === idx ? { ...r, label: e.target.value } : r))
                                                )
                                            }
                                            placeholder="Etiqueta *"
                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                        />
                                        {req.tipo === 'campo' && (
                                            <select
                                                value={req.tipo_campo || 'texto'}
                                                onChange={(e) =>
                                                    setRequisitos((prev) =>
                                                        prev.map((r, i) =>
                                                            i === idx
                                                                ? { ...r, tipo_campo: e.target.value as TipoCampoRequisito }
                                                                : r
                                                        )
                                                    )
                                                }
                                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                            >
                                                <option value="texto">Texto</option>
                                                <option value="textarea">Texto longo</option>
                                                <option value="numero">Número</option>
                                                <option value="data">Data</option>
                                                <option value="email">Email</option>
                                                <option value="telefone">Telefone</option>
                                                <option value="select">Lista de opções</option>
                                            </select>
                                        )}
                                        {req.tipo === 'campo' && req.tipo_campo === 'select' && (
                                            <input
                                                value={(req.opcoes || []).join(', ')}
                                                onChange={(e) =>
                                                    setRequisitos((prev) =>
                                                        prev.map((r, i) =>
                                                            i === idx
                                                                ? {
                                                                      ...r,
                                                                      opcoes: e.target.value
                                                                          .split(',')
                                                                          .map((s) => s.trim())
                                                                          .filter(Boolean),
                                                                  }
                                                                : r
                                                        )
                                                    )
                                                }
                                                placeholder="Opções separadas por vírgula"
                                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                            />
                                        )}
                                        {req.tipo === 'documento' && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <input
                                                    value={(req.tipos_ficheiro || []).join(',')}
                                                    onChange={(e) =>
                                                        setRequisitos((prev) =>
                                                            prev.map((r, i) =>
                                                                i === idx
                                                                    ? {
                                                                          ...r,
                                                                          tipos_ficheiro: e.target.value
                                                                              .split(',')
                                                                              .map((s) => s.trim().toLowerCase())
                                                                              .filter(Boolean),
                                                                          permite_upload: true,
                                                                      }
                                                                    : r
                                                            )
                                                        )
                                                    }
                                                    placeholder="Extensões (pdf,jpg,png)"
                                                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                                />
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={20}
                                                    value={req.tamanho_max_mb ?? 5}
                                                    onChange={(e) =>
                                                        setRequisitos((prev) =>
                                                            prev.map((r, i) =>
                                                                i === idx
                                                                    ? { ...r, tamanho_max_mb: Number(e.target.value) || 5 }
                                                                    : r
                                                            )
                                                        )
                                                    }
                                                    placeholder="Tamanho máx. MB"
                                                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </section>
                        </div>
                        <div className="border-t border-slate-100 p-4 flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 rounded-xl bg-blue-600 text-white py-3 text-sm font-semibold disabled:opacity-60"
                            >
                                {saving ? 'A guardar...' : 'Guardar concurso'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ConcursosProvinciaisPage
