/**
 * Direção Municipal — abrir concursos locais, gerir inscrições, cabeçalho PDF e exportação
 */

import { useMemo, useState } from 'react'
import { Icons } from '../../../components/ui/Icons'
import { useConcursosMunicipais } from '../hooks/useConcursosMunicipais'
import { exportInscricoesConcursoPdf } from '../api/inscricoesPdf'
import { publicConcursoUrl } from '../api/concursosApi'
import type { CabecalhoConcursoPdf, EstadoInscricao, OrdenacaoInscricoes } from '../types'
import {
    CORES_ESTADO_ABERTURA,
    LABELS_ESTADO_ABERTURA,
    LABELS_ESTADO_INSCRICAO,
} from '../types'

export function ConcursosMunicipaisPage() {
    const {
        disponiveis,
        aberturas,
        inscricoes,
        loading,
        error,
        ordenacao,
        setOrdenacao,
        aberturaFiltro,
        setAberturaFiltro,
        categoriaFiltro,
        setCategoriaFiltro,
        search,
        setSearch,
        abrir,
        setEstado,
        guardarCabecalho,
        uploadLogo,
        actualizarInscricao,
        perfil,
    } = useConcursosMunicipais()

    const [tab, setTab] = useState<'aberturas' | 'inscricoes'>('aberturas')
    const [openingId, setOpeningId] = useState<string | null>(null)
    const [headerAberturaId, setHeaderAberturaId] = useState<string | null>(null)
    const [cabecalhoDraft, setCabecalhoDraft] = useState<CabecalhoConcursoPdf>({})
    const [savingHeader, setSavingHeader] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

    const aberturasPorConcurso = useMemo(() => {
        const map = new Map(aberturas.map((a) => [a.concurso_id, a]))
        return map
    }, [aberturas])

    const categoriasFiltro = useMemo(() => {
        const map = new Map<string, string>()
        for (const i of inscricoes) {
            if (i.categoria?.id) map.set(i.categoria.id, i.categoria.nome)
        }
        return Array.from(map.entries())
    }, [inscricoes])

    const aberturaActual = aberturas.find((a) => a.id === (aberturaFiltro || headerAberturaId)) || aberturas[0]

    const handleAbrir = async (concursoId: string) => {
        setOpeningId(concursoId)
        try {
            await abrir(concursoId)
            setTab('aberturas')
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Erro ao abrir concurso')
        } finally {
            setOpeningId(null)
        }
    }

    const openHeaderConfig = (aberturaId: string) => {
        const ab = aberturas.find((a) => a.id === aberturaId)
        if (!ab) return
        setHeaderAberturaId(aberturaId)
        setCabecalhoDraft({
            mostrar_republica: true,
            texto_republica: 'REPÚBLICA DE ANGOLA',
            mostrar_governo_provincial: true,
            provincia: ab.provincia,
            mostrar_orgao_educacao: true,
            municipio: ab.municipio,
            nome_instituicao: perfil?.nome || `Direção Municipal — ${ab.municipio}`,
            ...ab.cabecalho,
        })
    }

    const saveHeader = async () => {
        if (!headerAberturaId) return
        setSavingHeader(true)
        try {
            await guardarCabecalho(headerAberturaId, cabecalhoDraft)
            setHeaderAberturaId(null)
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Erro ao guardar cabeçalho')
        } finally {
            setSavingHeader(false)
        }
    }

    const handleExportPdf = async () => {
        if (!aberturaActual) {
            alert('Seleccione ou abra um concurso primeiro')
            return
        }
        if (!aberturaActual.cabecalho?.nome_instituicao && !cabecalhoDraft.nome_instituicao) {
            openHeaderConfig(aberturaActual.id)
            alert('Configure o cabeçalho PDF antes de exportar')
            return
        }
        setExporting(true)
        try {
            await exportInscricoesConcursoPdf({
                tituloConcurso: aberturaActual.concurso?.titulo || 'Concurso',
                municipio: aberturaActual.municipio,
                inscricoes,
                cabecalho: aberturaActual.cabecalho,
                ordenacao,
                agruparPorCategoria: ordenacao === 'categoria',
            })
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Erro ao exportar PDF')
        } finally {
            setExporting(false)
        }
    }

    const copyLink = async (slug: string) => {
        const url = publicConcursoUrl(slug)
        await navigator.clipboard.writeText(url)
        setCopiedSlug(slug)
        setTimeout(() => setCopiedSlug(null), 2000)
    }

    if (loading && aberturas.length === 0 && disponiveis.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-24 md:pb-6 animate-fade-in">
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-slate-900 to-slate-950 rounded-2xl p-6 md:p-8 text-white shadow-xl">
                <div className="relative z-10">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Concursos Públicos</h1>
                    <p className="text-white/80 mt-1">
                        Abra inscrições no município de {perfil?.municipio || '—'} e gira apenas as candidaturas desta instituição
                    </p>
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
            )}

            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                <button
                    onClick={() => setTab('aberturas')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'aberturas' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
                >
                    Aberturas
                </button>
                <button
                    onClick={() => setTab('inscricoes')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'inscricoes' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
                >
                    Inscrições ({inscricoes.length})
                </button>
            </div>

            {tab === 'aberturas' && (
                <div className="space-y-6">
                    <section className="space-y-3">
                        <h2 className="text-lg font-semibold text-slate-900">Concursos publicados pela Província</h2>
                        {disponiveis.length === 0 ? (
                            <p className="text-sm text-slate-500">Não há concursos publicados neste momento.</p>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2">
                                {disponiveis.map((c) => {
                                    const ab = aberturasPorConcurso.get(c.id)
                                    return (
                                        <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                                            <h3 className="font-semibold text-slate-900">{c.titulo}</h3>
                                            {c.descricao && <p className="text-sm text-slate-500 line-clamp-2">{c.descricao}</p>}
                                            {ab ? (
                                                <div className="space-y-2">
                                                    <span
                                                        className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${CORES_ESTADO_ABERTURA[ab.estado].bg} ${CORES_ESTADO_ABERTURA[ab.estado].text}`}
                                                    >
                                                        {LABELS_ESTADO_ABERTURA[ab.estado]}
                                                    </span>
                                                    <p className="text-xs text-slate-500 break-all">
                                                        Link público: {publicConcursoUrl(ab.slug)}
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            onClick={() => copyLink(ab.slug)}
                                                            className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200"
                                                        >
                                                            {copiedSlug === ab.slug ? 'Copiado!' : 'Copiar link'}
                                                        </button>
                                                        {ab.estado !== 'aberto' && (
                                                            <button
                                                                onClick={() => setEstado(ab.id, 'aberto')}
                                                                className="px-3 py-2 text-xs font-medium rounded-lg bg-emerald-600 text-white"
                                                            >
                                                                Abrir inscrições
                                                            </button>
                                                        )}
                                                        {ab.estado === 'aberto' && (
                                                            <button
                                                                onClick={() => setEstado(ab.id, 'encerrado')}
                                                                className="px-3 py-2 text-xs font-medium rounded-lg bg-amber-600 text-white"
                                                            >
                                                                Encerrar
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => openHeaderConfig(ab.id)}
                                                            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200"
                                                        >
                                                            Cabeçalho PDF
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleAbrir(c.id)}
                                                    disabled={openingId === c.id}
                                                    className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60"
                                                >
                                                    {openingId === c.id ? 'A abrir...' : 'Abrir concurso neste município'}
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </section>
                </div>
            )}

            {tab === 'inscricoes' && (
                <div className="space-y-4">
                    <div className="flex flex-col lg:flex-row gap-3">
                        <select
                            value={aberturaFiltro || ''}
                            onChange={(e) => setAberturaFiltro(e.target.value || null)}
                            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        >
                            <option value="">Todas as aberturas</option>
                            {aberturas.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.concurso?.titulo || a.slug} ({LABELS_ESTADO_ABERTURA[a.estado]})
                                </option>
                            ))}
                        </select>
                        <select
                            value={ordenacao}
                            onChange={(e) => setOrdenacao(e.target.value as OrdenacaoInscricoes)}
                            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        >
                            <option value="alfabetica">Ordem alfabética</option>
                            <option value="idade">Por idade</option>
                            <option value="categoria">Por categoria</option>
                            <option value="municipio">Por município</option>
                            <option value="data">Por data</option>
                        </select>
                        <select
                            value={categoriaFiltro || ''}
                            onChange={(e) => setCategoriaFiltro(e.target.value || null)}
                            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        >
                            <option value="">Todas as categorias</option>
                            {categoriasFiltro.map(([id, nome]) => (
                                <option key={id} value={id}>
                                    {nome}
                                </option>
                            ))}
                        </select>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Pesquisar nome / BI / município"
                            className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        />
                        <button
                            onClick={handleExportPdf}
                            disabled={exporting || inscricoes.length === 0}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
                        >
                            <Icons.Download className="w-4 h-4" />
                            {exporting ? 'A exportar...' : 'Exportar PDF'}
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50 text-slate-600">
                                    <tr>
                                        <th className="text-left px-4 py-3 font-medium">Nome</th>
                                        <th className="text-left px-4 py-3 font-medium">Categoria</th>
                                        <th className="text-left px-4 py-3 font-medium">Idade</th>
                                        <th className="text-left px-4 py-3 font-medium">Município</th>
                                        <th className="text-left px-4 py-3 font-medium">Contacto</th>
                                        <th className="text-left px-4 py-3 font-medium">Estado</th>
                                        <th className="text-left px-4 py-3 font-medium">Acções</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inscricoes.map((ins) => (
                                        <tr key={ins.id} className="border-t border-slate-100">
                                            <td className="px-4 py-3 font-medium text-slate-900">{ins.nome_completo}</td>
                                            <td className="px-4 py-3 text-slate-600">{ins.categoria?.nome || '—'}</td>
                                            <td className="px-4 py-3 text-slate-600">{ins.idade ?? '—'}</td>
                                            <td className="px-4 py-3 text-slate-600">{ins.municipio}</td>
                                            <td className="px-4 py-3 text-slate-600">
                                                <div>{ins.telefone || '—'}</div>
                                                <div className="text-xs text-slate-400">{ins.email || ''}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                                                    {LABELS_ESTADO_INSCRICAO[ins.estado]}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    value={ins.estado}
                                                    onChange={(e) =>
                                                        actualizarInscricao(ins.id, e.target.value as EstadoInscricao)
                                                    }
                                                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                                >
                                                    {(Object.keys(LABELS_ESTADO_INSCRICAO) as EstadoInscricao[]).map((k) => (
                                                        <option key={k} value={k}>
                                                            {LABELS_ESTADO_INSCRICAO[k]}
                                                        </option>
                                                    ))}
                                                </select>
                                                {ins.documentos && ins.documentos.length > 0 && (
                                                    <div className="mt-1 space-y-0.5">
                                                        {ins.documentos.map((d) => (
                                                            <a
                                                                key={d.id}
                                                                href={d.file_url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="block text-xs text-blue-600 hover:underline truncate max-w-[140px]"
                                                            >
                                                                {d.filename}
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {inscricoes.length === 0 && (
                            <div className="text-center py-12 text-slate-500 text-sm">
                                Sem inscrições nesta instituição.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {headerAberturaId && (
                <div className="fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-slate-900/50" onClick={() => setHeaderAberturaId(null)} />
                    <div className="absolute inset-x-0 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg bg-white md:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between px-4 py-4 border-b">
                            <h2 className="font-semibold text-slate-900">Configurar cabeçalho PDF</h2>
                            <button onClick={() => setHeaderAberturaId(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                                <Icons.X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            <label className="block text-sm space-y-1">
                                <span className="text-slate-600">Nome da instituição</span>
                                <input
                                    value={cabecalhoDraft.nome_instituicao || ''}
                                    onChange={(e) => setCabecalhoDraft((p) => ({ ...p, nome_instituicao: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                                />
                            </label>
                            <label className="block text-sm space-y-1">
                                <span className="text-slate-600">Texto República</span>
                                <input
                                    value={cabecalhoDraft.texto_republica || ''}
                                    onChange={(e) => setCabecalhoDraft((p) => ({ ...p, texto_republica: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                                />
                            </label>
                            <label className="block text-sm space-y-1">
                                <span className="text-slate-600">Província</span>
                                <input
                                    value={cabecalhoDraft.provincia || ''}
                                    onChange={(e) => setCabecalhoDraft((p) => ({ ...p, provincia: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                                />
                            </label>
                            <label className="block text-sm space-y-1">
                                <span className="text-slate-600">Município</span>
                                <input
                                    value={cabecalhoDraft.municipio || ''}
                                    onChange={(e) => setCabecalhoDraft((p) => ({ ...p, municipio: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                                />
                            </label>
                            <div className="space-y-2 text-sm">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={cabecalhoDraft.mostrar_republica !== false}
                                        onChange={(e) => setCabecalhoDraft((p) => ({ ...p, mostrar_republica: e.target.checked }))}
                                    />
                                    Mostrar República
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={!!cabecalhoDraft.mostrar_governo_provincial}
                                        onChange={(e) =>
                                            setCabecalhoDraft((p) => ({ ...p, mostrar_governo_provincial: e.target.checked }))
                                        }
                                    />
                                    Mostrar Governo Provincial
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={!!cabecalhoDraft.mostrar_orgao_educacao}
                                        onChange={(e) =>
                                            setCabecalhoDraft((p) => ({ ...p, mostrar_orgao_educacao: e.target.checked }))
                                        }
                                    />
                                    Mostrar órgão de educação
                                </label>
                            </div>
                            <label className="block text-sm space-y-1">
                                <span className="text-slate-600">Logo (opcional)</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (!file) return
                                        try {
                                            const url = await uploadLogo(file)
                                            setCabecalhoDraft((p) => ({ ...p, logo_url: url }))
                                        } catch (err) {
                                            alert(err instanceof Error ? err.message : 'Falha no upload do logo')
                                        }
                                    }}
                                    className="w-full text-sm"
                                />
                                {cabecalhoDraft.logo_url && (
                                    <img src={cabecalhoDraft.logo_url} alt="Logo" className="h-14 object-contain mt-2" />
                                )}
                            </label>
                        </div>
                        <div className="p-4 border-t flex gap-3">
                            <button
                                onClick={() => setHeaderAberturaId(null)}
                                className="flex-1 rounded-xl border border-slate-200 py-3 text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveHeader}
                                disabled={savingHeader || !cabecalhoDraft.nome_instituicao?.trim()}
                                className="flex-1 rounded-xl bg-blue-600 text-white py-3 text-sm font-semibold disabled:opacity-60"
                            >
                                {savingHeader ? 'A guardar...' : 'Guardar cabeçalho'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ConcursosMunicipaisPage
