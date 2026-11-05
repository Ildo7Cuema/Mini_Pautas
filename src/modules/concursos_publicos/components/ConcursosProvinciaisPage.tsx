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
import {
    DpPage,
    DpContent,
    DpHeader,
    DpSearch,
    DpPanel,
    DpButton,
    DpEmpty,
    DpLoading,
    DpAlert,
    DpModal,
    DpModalFooter,
    DpConfirmModal,
    DpFormSection,
    DpBadge,
    DpInput,
    DpTextarea,
} from '../../provincial_education/components/ProvincialChrome'

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
    const [deleteTarget, setDeleteTarget] = useState<ConcursoPublico | null>(null)
    const [deleting, setDeleting] = useState(false)

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
        return <DpLoading label="A carregar concursos..." />
    }

    return (
        <DpPage className="pb-24 md:pb-0">
            <DpHeader
                title="Concursos Públicos"
                subtitle="Defina requisitos e documentos para as Direções Municipais abrirem inscrições"
                icon={<Icons.ClipboardList />}
                accent="violet"
                actions={
                    <DpButton onClick={openCreate} icon={<Icons.Plus className="w-5 h-5" />}>
                        Novo
                    </DpButton>
                }
            />

            <DpContent>
                {error && <DpAlert>{error}</DpAlert>}

                <DpSearch
                    value={search}
                    onChange={setSearch}
                    placeholder="Pesquisar concurso..."
                />

                <div className="grid gap-4 md:grid-cols-2">
                    {filtered.map((c) => {
                        const cor = CORES_ESTADO_CONCURSO[c.estado]
                        return (
                            <DpPanel key={c.id} padding={false}>
                                <div className="p-4 md:p-5 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="text-base md:text-lg font-bold text-slate-900 leading-snug tracking-tight">
                                            {c.titulo}
                                        </h3>
                                        <span className={`shrink-0 px-2.5 py-1 text-xs font-semibold rounded-full ring-1 ring-black/5 ${cor.bg} ${cor.text}`}>
                                            {LABELS_ESTADO_CONCURSO[c.estado]}
                                        </span>
                                    </div>
                                    {c.descricao && (
                                        <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">{c.descricao}</p>
                                    )}
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                                            {c.aberturas_count || 0} aberturas
                                        </span>
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                                            {c.inscricoes_count || 0} inscrições
                                        </span>
                                        {c.data_inicio && (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium">
                                                Início: {new Date(c.data_inicio).toLocaleDateString('pt-AO')}
                                            </span>
                                        )}
                                        {c.data_fim && (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium">
                                                Fim: {new Date(c.data_fim).toLocaleDateString('pt-AO')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-wrap border-t border-slate-100 bg-slate-50/60">
                                    <button
                                        type="button"
                                        onClick={() => openEdit(c)}
                                        className="flex-1 min-w-[100px] py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors min-h-[48px]"
                                    >
                                        Editar
                                    </button>
                                    {c.estado !== 'publicado' && c.estado !== 'encerrado' && (
                                        <button
                                            type="button"
                                            onClick={() => publicar(c.id, true)}
                                            className="flex-1 min-w-[100px] py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors min-h-[48px]"
                                        >
                                            Publicar
                                        </button>
                                    )}
                                    {c.estado === 'publicado' && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => publicar(c.id, false)}
                                                className="flex-1 min-w-[100px] py-3 text-sm font-semibold text-amber-700 hover:bg-amber-50 transition-colors min-h-[48px]"
                                            >
                                                Despublicar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => encerrar(c.id)}
                                                className="flex-1 min-w-[100px] py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors min-h-[48px]"
                                            >
                                                Encerrar
                                            </button>
                                        </>
                                    )}
                                    {c.estado === 'rascunho' && (
                                        <button
                                            type="button"
                                            onClick={() => setDeleteTarget(c)}
                                            className="flex-1 min-w-[100px] py-3 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors min-h-[48px]"
                                        >
                                            Eliminar
                                        </button>
                                    )}
                                </div>
                            </DpPanel>
                        )
                    })}
                </div>

                {filtered.length === 0 && (
                    <DpEmpty
                        icon={<Icons.ClipboardList />}
                        title="Nenhum concurso criado"
                        description="Publique um concurso para as Direções Municipais abrirem inscrições."
                        action={
                            <DpButton onClick={openCreate} icon={<Icons.Plus className="w-5 h-5" />}>
                                Novo concurso
                            </DpButton>
                        }
                    />
                )}
            </DpContent>

            <DpModal
                isOpen={showModal}
                onClose={() => {
                    if (!saving) {
                        setShowModal(false)
                        resetForm()
                    }
                }}
                title={editing ? 'Editar concurso' : 'Novo concurso público'}
                subtitle="Categorias, requisitos e documentos para inscrição"
                icon={<Icons.ClipboardList />}
                accent="violet"
                busy={saving}
                size="xl"
                badge={
                    <DpBadge tone={editing ? 'info' : 'success'}>
                        {editing ? 'Edição' : 'Novo'}
                    </DpBadge>
                }
                footer={
                    <DpModalFooter>
                        <DpButton
                            variant="secondary"
                            onClick={() => {
                                setShowModal(false)
                                resetForm()
                            }}
                            disabled={saving}
                            icon={<Icons.X />}
                            className="sm:min-w-[7.5rem]"
                        >
                            Cancelar
                        </DpButton>
                        <DpButton
                            onClick={handleSave}
                            disabled={saving}
                            icon={saving ? <Icons.Spinner /> : <Icons.Check />}
                            className="sm:min-w-[9rem]"
                        >
                            {saving ? 'A guardar…' : 'Guardar concurso'}
                        </DpButton>
                    </DpModalFooter>
                }
            >
                        <div className="space-y-4">
                            {formError && <DpAlert>{formError}</DpAlert>}

                            <DpFormSection title="Dados gerais" description="Identificação e calendário do concurso">
                                <DpInput
                                    value={titulo}
                                    onChange={(e) => setTitulo(e.target.value)}
                                    placeholder="Título do concurso *"
                                    label="Título"
                                    icon={<Icons.DocumentText />}
                                    required
                                />
                                <DpTextarea
                                    value={descricao}
                                    onChange={(e) => setDescricao(e.target.value)}
                                    placeholder="Descrição"
                                    label="Descrição"
                                    icon={<Icons.ClipboardList />}
                                    rows={3}
                                />
                                <DpTextarea
                                    value={instrucoes}
                                    onChange={(e) => setInstrucoes(e.target.value)}
                                    placeholder="Instruções para os candidatos"
                                    label="Instruções"
                                    icon={<Icons.Info />}
                                    rows={2}
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <DpInput
                                        type="date"
                                        label="Data início"
                                        value={dataInicio}
                                        onChange={(e) => setDataInicio(e.target.value)}
                                    />
                                    <DpInput
                                        type="date"
                                        label="Data fim"
                                        value={dataFim}
                                        onChange={(e) => setDataFim(e.target.value)}
                                    />
                                </div>
                            </DpFormSection>

                            <DpFormSection title="Categorias de inscrição" description="Faixas etárias e áreas de candidatura">
                                <div className="flex justify-end -mt-1 mb-1">
                                    <button
                                        type="button"
                                        onClick={() => setCategorias((prev) => [...prev, emptyCat()])}
                                        className="text-sm text-primary-700 font-semibold hover:text-primary-800 transition-colors"
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
                            </DpFormSection>

                            <DpFormSection title="Requisitos e documentos" description="Campos do formulário e uploads exigidos">
                                <div className="flex justify-end gap-3 -mt-1 mb-1 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => setRequisitos((prev) => [...prev, emptyReq('campo')])}
                                        className="text-sm text-primary-700 font-semibold hover:text-primary-800 transition-colors"
                                    >
                                        + Campo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRequisitos((prev) => [...prev, emptyReq('documento')])}
                                        className="text-sm text-primary-700 font-semibold hover:text-primary-800 transition-colors"
                                    >
                                        + Documento
                                    </button>
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
                            </DpFormSection>
                        </div>
            </DpModal>

            <DpConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={async () => {
                    if (!deleteTarget) return
                    setDeleting(true)
                    try {
                        await eliminar(deleteTarget.id)
                        setDeleteTarget(null)
                    } finally {
                        setDeleting(false)
                    }
                }}
                title="Eliminar concurso"
                message={`Eliminar "${deleteTarget?.titulo || ''}"? Esta acção não pode ser desfeita.`}
                confirmText="Eliminar"
                cancelText="Cancelar"
                variant="danger"
                loading={deleting}
            />
        </DpPage>
    )
}

export default ConcursosProvinciaisPage
