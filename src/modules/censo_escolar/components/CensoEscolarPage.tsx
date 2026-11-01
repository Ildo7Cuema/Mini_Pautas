import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { supabase } from '../../../lib/supabaseClient'
import { gerarQuestionarioCenso } from '../api/censoAggregation'
import { exportCensoQuestionarioPdf } from '../api/censoPdfExport'
import { abrirJanelaPreviewPdf, fecharJanelaPreviewPdf } from '../api/censoPdfOutput'
import {
    emptyInfraestrutura,
    loadCensoInfraestrutura,
    saveCensoInfraestrutura,
    saveCensoQuestionario,
} from '../api/censoPersistence'
import {
    CensoGeracaoResultado,
    CensoInfraestrutura,
    LABELS_DEFICIENCIA,
    ModalidadeCensoCodigo,
} from '../types'
import {
    defaultDataReferenciaIdade,
    normalizeAnoLectivoInput,
    suggestAnoLectivoCenso,
} from '../utils/ageBands'
import { guardarIdentificacaoCenso, lerIdentificacaoCenso } from '../utils/censoIdentificacao'
import {
    defaultModalidadeForTipo,
    LABELS_TIPO_ESCOLA,
    modalidadesParaTipoEscola,
    resolveTipoEscolaCenso,
    TipoEscolaCenso,
} from '../utils/escolaModalidade'

function numInput(
    label: string,
    value: number,
    onChange: (n: number) => void
) {
    return (
        <label className="block text-sm">
            <span className="text-slate-600">{label}</span>
            <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={value}
                onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))}
            />
        </label>
    )
}

export function CensoEscolarPage() {
    const { escolaProfile, user, refreshProfile } = useAuth()
    const escolaId = escolaProfile?.id || ''

    const anoSugerido = useMemo(() => suggestAnoLectivoCenso(), [])
    const [anoLectivo, setAnoLectivo] = useState(anoSugerido)
    const [anosDisponiveis, setAnosDisponiveis] = useState<string[]>([anoSugerido])
    const [niveisTurmas, setNiveisTurmas] = useState<string[]>([])
    const [modalidade, setModalidade] = useState<ModalidadeCensoCodigo>('ensino_primario_geral')
    const [infra, setInfra] = useState<CensoInfraestrutura | null>(null)
    const [resultado, setResultado] = useState<CensoGeracaoResultado | null>(null)
    const [loading, setLoading] = useState(false)
    const [savingInfra, setSavingInfra] = useState(false)
    const [exportingPdf, setExportingPdf] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [tab, setTab] = useState<'gerar' | 'identificacao' | 'infra' | 'resultado'>('gerar')
    const [codigoEscolaMed, setCodigoEscolaMed] = useState('')
    const [idQuestionario, setIdQuestionario] = useState('')
    const [savingIdent, setSavingIdent] = useState(false)

    const tipoEscolaInfo = useMemo(() => {
        return resolveTipoEscolaCenso({
            configuracoes: (escolaProfile?.configuracoes as Record<string, unknown>) || null,
            niveisTurmas,
        })
    }, [escolaProfile?.configuracoes, niveisTurmas])

    const tipoEscola: TipoEscolaCenso = tipoEscolaInfo.tipo

    const modalidadesDisponiveis = useMemo(
        () => modalidadesParaTipoEscola(tipoEscola),
        [tipoEscola]
    )

    const modalidadeDef = useMemo(
        () => modalidadesDisponiveis.find(m => m.codigo === modalidade) || modalidadesDisponiveis[0],
        [modalidade, modalidadesDisponiveis]
    )

    useEffect(() => {
        if (!escolaId) return
        ;(async () => {
            const { data } = await supabase
                .from('turmas')
                .select('ano_lectivo, nivel_ensino')
                .eq('escola_id', escolaId)
            const anosTurmas = Array.from(
                new Set((data || []).map(t => String(t.ano_lectivo).trim()).filter(Boolean))
            ).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
            const niveis = Array.from(
                new Set((data || []).map(t => String(t.nivel_ensino || '').trim()).filter(Boolean))
            )
            setNiveisTurmas(niveis)
            const sugerido = suggestAnoLectivoCenso()
            const anos = Array.from(new Set([sugerido, ...anosTurmas]))
                .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
            setAnosDisponiveis(anos)
            // Preferir ano das turmas se existir; senão o sugerido actual
            setAnoLectivo(anosTurmas[0] || sugerido)
        })()
    }, [escolaId])

    // Carregar identificação guardada (código MED da escola + ID do questionário do ano/modalidade)
    useEffect(() => {
        const ident = lerIdentificacaoCenso(escolaProfile?.configuracoes, anoLectivo, modalidade)
        setCodigoEscolaMed(ident.codigo_escola_med)
        setIdQuestionario(ident.id_questionario)
    }, [escolaProfile?.configuracoes, anoLectivo, modalidade])

    // Garantir que a modalidade seleccionada é válida para o tipo da escola
    useEffect(() => {
        if (!modalidadesDisponiveis.length) return
        if (!modalidadesDisponiveis.some(m => m.codigo === modalidade)) {
            setModalidade(defaultModalidadeForTipo(tipoEscola))
        }
    }, [modalidadesDisponiveis, modalidade, tipoEscola])

    const reloadInfra = useCallback(async () => {
        if (!escolaId) return
        try {
            const loaded = await loadCensoInfraestrutura(escolaId, anoLectivo, modalidade)
            setInfra(loaded || emptyInfraestrutura(escolaId, anoLectivo, modalidade))
        } catch {
            setInfra(emptyInfraestrutura(escolaId, anoLectivo, modalidade))
        }
    }, [escolaId, anoLectivo, modalidade])

    useEffect(() => {
        reloadInfra()
        setResultado(null)
    }, [reloadInfra])

    const handleSaveInfra = async () => {
        if (!infra || !escolaId) return
        setSavingInfra(true)
        setError(null)
        setSuccess(null)
        try {
            const saved = await saveCensoInfraestrutura({
                ...infra,
                escola_id: escolaId,
                ano_lectivo: anoLectivo,
                modalidade_codigo: modalidade,
            })
            setInfra(saved)
            setSuccess('Infraestrutura guardada.')
        } catch (e: any) {
            setError(e.message || 'Erro ao guardar infraestrutura. Confirme que a migration do censo foi aplicada.')
        } finally {
            setSavingInfra(false)
        }
    }

    const handleSaveIdentificacao = async () => {
        if (!escolaId) return
        const ano = normalizeAnoLectivoInput(anoLectivo) || anoLectivo
        setSavingIdent(true)
        setError(null)
        setSuccess(null)
        try {
            await guardarIdentificacaoCenso({
                escolaId,
                configuracoesActuais: escolaProfile?.configuracoes,
                anoLectivo: ano,
                modalidade,
                identificacao: { codigo_escola_med: codigoEscolaMed, id_questionario: idQuestionario },
            })
            await refreshProfile()
            setSuccess('Identificação do censo guardada.')
        } catch (e: any) {
            setError(e.message || 'Erro ao guardar a identificação do censo.')
        } finally {
            setSavingIdent(false)
        }
    }

    const handleGerar = async () => {
        if (!escolaId) return
        const ano = normalizeAnoLectivoInput(anoLectivo)
        if (!ano) {
            setError('Indique o ano lectivo do censo (ex.: 2025/2026).')
            return
        }
        setAnoLectivo(ano)
        // Abrir a aba do PDF já no clique (antes dos awaits) para não ser bloqueada como pop-up
        const janelaPdf = abrirJanelaPreviewPdf()
        setLoading(true)
        setError(null)
        setSuccess(null)
        try {
            const dataRef = defaultDataReferenciaIdade(ano)
            const infraAno = infra ? { ...infra, ano_lectivo: ano } : null
            const res = await gerarQuestionarioCenso({
                escolaId,
                anoLectivo: ano,
                modalidadeCodigo: modalidade,
                dataReferenciaIdade: dataRef,
                infraestrutura: infraAno,
                identificacao: { codigo_escola_med: codigoEscolaMed, id_questionario: idQuestionario },
            })
            setResultado(res)
            setTab('resultado')

            let msg = 'Questionário gerado.'
            try {
                await saveCensoQuestionario({
                    escolaId,
                    anoLectivo: ano,
                    modalidade,
                    dataReferenciaIdade: [
                        dataRef.getFullYear(),
                        String(dataRef.getMonth() + 1).padStart(2, '0'),
                        String(dataRef.getDate()).padStart(2, '0'),
                    ].join('-'),
                    resultado: res,
                    userId: user?.id,
                })
                msg = 'Questionário gerado e guardado como snapshot.'
            } catch {
                msg = 'Questionário gerado (snapshot não guardado — migration pode estar pendente).'
            }

            try {
                await exportCensoQuestionarioPdf(res.payload, janelaPdf)
                msg += ' PDF aberto numa nova aba (formato do modelo MED/INE).'
            } catch (pdfErr: any) {
                fecharJanelaPreviewPdf(janelaPdf)
                msg += ` PDF não exportado: ${pdfErr?.message || 'erro desconhecido'}.`
            }
            setSuccess(msg)
        } catch (e: any) {
            fecharJanelaPreviewPdf(janelaPdf)
            setError(e.message || 'Erro ao gerar o censo.')
        } finally {
            setLoading(false)
        }
    }

    const handleExportJson = () => {
        if (!resultado) return
        const blob = new Blob([JSON.stringify(resultado.payload, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `censo_${modalidade}_${anoLectivo.replace(/[\/\\]/g, '-')}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleExportPdf = async () => {
        if (!resultado) return
        const janelaPdf = abrirJanelaPreviewPdf()
        setExportingPdf(true)
        setError(null)
        try {
            await exportCensoQuestionarioPdf(resultado.payload, janelaPdf)
            setSuccess('PDF aberto numa nova aba (formato do modelo oficial do Censo Escolar).')
        } catch (e: any) {
            fecharJanelaPreviewPdf(janelaPdf)
            setError(e.message || 'Erro ao exportar PDF.')
        } finally {
            setExportingPdf(false)
        }
    }

    if (!escolaId) {
        return (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
                O Censo Escolar está disponível para o perfil de escola. Inicie sessão como administrador da escola.
            </div>
        )
    }

    const p = resultado?.payload

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Censo Escolar</h1>
                <p className="mt-1 text-sm text-slate-600">
                    Geração automática dos questionários MED {anoLectivo || '—'} —
                    {' '}{LABELS_TIPO_ESCOLA[tipoEscola]}.
                </p>
            </div>

            {(error || success) && (
                <div
                    className={`rounded-lg border px-4 py-3 text-sm ${
                        error
                            ? 'border-red-200 bg-red-50 text-red-800'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}
                >
                    {error || success}
                </div>
            )}

            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
                {([
                    ['gerar', 'Gerar'],
                    ['identificacao', 'Identificação'],
                    ['infra', 'Infraestrutura'],
                    ['resultado', 'Resultado'],
                ] as const).map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={`rounded-lg px-4 py-2 text-sm font-medium ${
                            tab === id
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {tab === 'gerar' && (
                <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-2">
                    <label className="block text-sm">
                        <span className="font-medium text-slate-700">Ano lectivo do censo</span>
                        <input
                            list="censo-anos-lectivos"
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                            value={anoLectivo}
                            onChange={e => setAnoLectivo(e.target.value)}
                            onBlur={e => {
                                const n = normalizeAnoLectivoInput(e.target.value)
                                if (n) setAnoLectivo(n)
                            }}
                            placeholder="Ex: 2025/2026 ou 2026"
                        />
                        <datalist id="censo-anos-lectivos">
                            {anosDisponiveis.map(a => (
                                <option key={a} value={a} />
                            ))}
                        </datalist>
                        <span className="mt-1 block text-xs text-slate-500">
                            Editável. Sugestão actual: {anoSugerido}. Pode escolher um ano das turmas ou escrever outro.
                        </span>
                    </label>
                    <label className="block text-sm">
                        <span className="font-medium text-slate-700">Modalidade (questionário)</span>
                        <select
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                            value={modalidadeDef?.codigo || modalidade}
                            onChange={e => setModalidade(e.target.value as ModalidadeCensoCodigo)}
                            disabled={modalidadesDisponiveis.length <= 1}
                        >
                            {modalidadesDisponiveis.map(m => (
                                <option key={m.codigo} value={m.codigo}>{m.nome}</option>
                            ))}
                        </select>
                        <span className="mt-1 block text-xs text-slate-500">
                            Filtrada pelo tipo da escola: {LABELS_TIPO_ESCOLA[tipoEscola]}
                            {tipoEscola !== 'desconhecido' ? ` (${tipoEscolaInfo.fonte})` : ''}.
                            {tipoEscola === 'desconhecido' &&
                                ' Cadastre o tipo da escola ou crie turmas com nível de ensino para restringir as modalidades.'}
                        </span>
                    </label>
                    <div className="md:col-span-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                        <p className="font-medium text-slate-800">O que é calculado automaticamente</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Matrículas e turmas por classe e turno</li>
                            <li>Matrículas por idade e sexo (idade em 31 Março do ano lectivo)</li>
                            <li>Matrículas por deficiência (se preenchida no aluno)</li>
                            <li>Professores por nível académico / formação pedagógica</li>
                            <li>Aproveitamento do ano anterior (via matrículas/transição)</li>
                        </ul>
                        <p className="mt-3 text-slate-500">
                            Classes desta modalidade: {modalidadeDef?.classes.join(', ') || '—'}
                        </p>
                    </div>
                    <div className="md:col-span-2">
                        <button
                            type="button"
                            disabled={loading}
                            onClick={handleGerar}
                            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            {loading ? 'A gerar…' : 'Gerar questionário do censo'}
                        </button>
                    </div>
                </div>
            )}

            {tab === 'identificacao' && (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Identificação do questionário</h2>
                        <p className="mt-1 text-sm text-slate-600">
                            O código da escola é atribuído pela Direcção Municipal da Educação, bem como o ID do
                            questionário. Preencha-os aqui para que apareçam no PDF do censo.
                        </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="block text-sm">
                            <span className="font-medium text-slate-700">Código da escola (Direcção Municipal)</span>
                            <input
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                                value={codigoEscolaMed}
                                onChange={e => setCodigoEscolaMed(e.target.value)}
                                placeholder="Código atribuído pela Direcção Municipal"
                                maxLength={40}
                            />
                            <span className="mt-1 block text-xs text-slate-500">
                                Vale para todos os anos e modalidades desta escola.
                            </span>
                        </label>
                        <label className="block text-sm">
                            <span className="font-medium text-slate-700">ID do questionário</span>
                            <input
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                                value={idQuestionario}
                                onChange={e => setIdQuestionario(e.target.value)}
                                placeholder="ID atribuído ao questionário"
                                maxLength={40}
                            />
                            <span className="mt-1 block text-xs text-slate-500">
                                Específico de: {anoLectivo || '—'} · {modalidadeDef?.nome || modalidade}.
                            </span>
                        </label>
                    </div>
                    <button
                        type="button"
                        disabled={savingIdent}
                        onClick={handleSaveIdentificacao}
                        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60"
                    >
                        {savingIdent ? 'A guardar…' : 'Guardar identificação'}
                    </button>
                </div>
            )}
            {tab === 'infra' && infra && (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
                    <h2 className="text-lg font-semibold text-slate-900">Infraestrutura e mobiliário</h2>
                    <p className="text-sm text-slate-600">
                        Dados manuais exigidos pelo MED — não existem no operacional pedagógico.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {numInput('Mês início', infra.mes_inicio || 0, n => setInfra({ ...infra, mes_inicio: n || null }))}
                        {numInput('Mês término', infra.mes_termino || 0, n => setInfra({ ...infra, mes_termino: n || null }))}
                        {numInput('Total salas', infra.total_salas, n => setInfra({ ...infra, total_salas: n }))}
                        {numInput('Salas próprias', infra.salas_proprias, n => setInfra({ ...infra, salas_proprias: n }))}
                        {numInput('Salas emprestadas', infra.salas_emprestadas, n => setInfra({ ...infra, salas_emprestadas: n }))}
                        {numInput('Salas arrendadas', infra.salas_arrendadas, n => setInfra({ ...infra, salas_arrendadas: n }))}
                        {numInput('Próprias bom estado', infra.salas_proprias_bom_estado, n => setInfra({ ...infra, salas_proprias_bom_estado: n }))}
                        {numInput('Total assentos', infra.total_assentos, n => setInfra({ ...infra, total_assentos: n }))}
                        {numInput('Assentos bom estado', infra.assentos_bom_estado, n => setInfra({ ...infra, assentos_bom_estado: n }))}
                        {numInput('Assentos acessíveis', infra.assentos_acessiveis, n => setInfra({ ...infra, assentos_acessiveis: n }))}
                        {numInput('Total mesas', infra.total_mesas, n => setInfra({ ...infra, total_mesas: n }))}
                        {numInput('Mesas bom estado', infra.mesas_bom_estado, n => setInfra({ ...infra, mesas_bom_estado: n }))}
                        {numInput('Mesas acessíveis', infra.mesas_acessiveis, n => setInfra({ ...infra, mesas_acessiveis: n }))}
                        {numInput('Total quadros', infra.total_quadros, n => setInfra({ ...infra, total_quadros: n }))}
                        {numInput('Quadros bom estado', infra.quadros_bom_estado, n => setInfra({ ...infra, quadros_bom_estado: n }))}
                    </div>
                    <button
                        type="button"
                        disabled={savingInfra}
                        onClick={handleSaveInfra}
                        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60"
                    >
                        {savingInfra ? 'A guardar…' : 'Guardar infraestrutura'}
                    </button>
                </div>
            )}

            {tab === 'resultado' && (
                <div className="space-y-4">
                    {!p ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                            Ainda não gerou nenhum questionário. Use o separador Gerar.
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                                <div>
                                    <div className="font-semibold text-slate-900">{p.cabecalho.modalidade_nome}</div>
                                    <div className="text-sm text-slate-600">
                                        {p.cabecalho.nome_instituicao} · Cód. {p.cabecalho.codigo_escola_med || '—'} · ID {p.cabecalho.id_questionario || '—'} · {p.cabecalho.ano_lectivo}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                        Idade calculada em {p.cabecalho.data_referencia_idade} · {p.totais.alunos} alunos · {p.totais.turmas} turmas · {p.totais.professores} professores
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        disabled={exportingPdf}
                                        onClick={handleExportPdf}
                                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                                    >
                                        {exportingPdf ? 'A abrir PDF…' : 'Ver PDF (modelo MED)'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleExportJson}
                                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                    >
                                        Exportar JSON
                                    </button>
                                </div>
                            </div>

                            {resultado!.lacunas.length > 0 && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                                    <h3 className="font-semibold text-amber-900">Lacunas / avisos</h3>
                                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
                                        {resultado!.lacunas.map((l, i) => (
                                            <li key={i}>{l}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                <div className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-800">
                                    Matrículas e turmas por classe e turno
                                </div>
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-50 text-left text-slate-600">
                                        <tr>
                                            <th className="px-3 py-2">Classe</th>
                                            <th className="px-3 py-2">Turno</th>
                                            <th className="px-3 py-2">Matrículas</th>
                                            <th className="px-3 py-2">Turmas</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {p.matriculas_classe_turno
                                            .filter(r => r.matriculas > 0 || r.turmas > 0)
                                            .map(r => (
                                                <tr key={`${r.classe}-${r.turno}`} className="border-t border-slate-100">
                                                    <td className="px-3 py-2">{r.classe}</td>
                                                    <td className="px-3 py-2 capitalize">{r.turno}</td>
                                                    <td className="px-3 py-2">{r.matriculas}</td>
                                                    <td className="px-3 py-2">{r.turmas}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </section>

                            <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                <div className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-800">
                                    Matrículas por idade e sexo (amostra não-zero)
                                </div>
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-50 text-left text-slate-600">
                                        <tr>
                                            <th className="px-3 py-2">Classe</th>
                                            <th className="px-3 py-2">Faixa etária</th>
                                            <th className="px-3 py-2">M</th>
                                            <th className="px-3 py-2">F</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {p.matriculas_idade
                                            .filter(r => r.M + r.F > 0)
                                            .map(r => (
                                                <tr key={`${r.classe}-${r.faixa_etaria}`} className="border-t border-slate-100">
                                                    <td className="px-3 py-2">{r.classe}</td>
                                                    <td className="px-3 py-2">{r.faixa_etaria}</td>
                                                    <td className="px-3 py-2">{r.M}</td>
                                                    <td className="px-3 py-2">{r.F}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </section>

                            <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                <div className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-800">
                                    Deficiências registadas
                                </div>
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-50 text-left text-slate-600">
                                        <tr>
                                            <th className="px-3 py-2">Classe</th>
                                            <th className="px-3 py-2">Tipo</th>
                                            <th className="px-3 py-2">M</th>
                                            <th className="px-3 py-2">F</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {p.matriculas_deficiencia
                                            .filter(r => r.M + r.F > 0)
                                            .map(r => (
                                                <tr key={`${r.classe}-${r.tipo_deficiencia}`} className="border-t border-slate-100">
                                                    <td className="px-3 py-2">{r.classe}</td>
                                                    <td className="px-3 py-2">{LABELS_DEFICIENCIA[r.tipo_deficiencia]}</td>
                                                    <td className="px-3 py-2">{r.M}</td>
                                                    <td className="px-3 py-2">{r.F}</td>
                                                </tr>
                                            ))}
                                        {p.matriculas_deficiencia.every(r => r.M + r.F === 0) && (
                                            <tr>
                                                <td colSpan={4} className="px-3 py-4 text-slate-500">
                                                    Sem dados de deficiência.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </section>

                            <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                <div className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-800">
                                    Professores por nível académico
                                </div>
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-50 text-left text-slate-600">
                                        <tr>
                                            <th className="px-3 py-2">Nível</th>
                                            <th className="px-3 py-2">M</th>
                                            <th className="px-3 py-2">F</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {p.professores_nivel_academico.map(r => (
                                            <tr key={r.nivel_academico} className="border-t border-slate-100">
                                                <td className="px-3 py-2">{r.nivel_academico}</td>
                                                <td className="px-3 py-2">{r.M}</td>
                                                <td className="px-3 py-2">{r.F}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="grid gap-2 border-t border-slate-100 p-4 text-sm text-slate-700 sm:grid-cols-2">
                                    <div>Com formação pedagógica: M {p.professores_qualificacao.com_formacao_pedagogica.M} / F {p.professores_qualificacao.com_formacao_pedagogica.F}</div>
                                    <div>Sem formação pedagógica: M {p.professores_qualificacao.sem_formacao_pedagogica.M} / F {p.professores_qualificacao.sem_formacao_pedagogica.F}</div>
                                    <div>Nacionais: M {p.professores_qualificacao.nacionais.M} / F {p.professores_qualificacao.nacionais.F}</div>
                                    <div>Estrangeiros: M {p.professores_qualificacao.estrangeiros.M} / F {p.professores_qualificacao.estrangeiros.F}</div>
                                </div>
                            </section>

                            <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                <div className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-800">
                                    Aproveitamento ano lectivo anterior
                                </div>
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-50 text-left text-slate-600">
                                        <tr>
                                            <th className="px-3 py-2">Classe</th>
                                            <th className="px-3 py-2">Matric. M/F</th>
                                            <th className="px-3 py-2">Aprov. M/F</th>
                                            <th className="px-3 py-2">Reprov. M/F</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {p.aproveitamento_ano_anterior.map(r => (
                                            <tr key={r.classe} className="border-t border-slate-100">
                                                <td className="px-3 py-2">{r.classe}</td>
                                                <td className="px-3 py-2">{r.matriculados.M}/{r.matriculados.F}</td>
                                                <td className="px-3 py-2">{r.aprovados.M}/{r.aprovados.F}</td>
                                                <td className="px-3 py-2">{r.reprovados.M}/{r.reprovados.F}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </section>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

export default CensoEscolarPage
