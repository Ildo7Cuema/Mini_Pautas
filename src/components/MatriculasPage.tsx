/*
component-meta:
  name: MatriculasPage
  description: Confirmação de matrículas condicionada ao encerramento do ano e pautas finais
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardHeader, CardBody } from './ui/Card'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { translateError } from '../utils/translations'
import {
    carregarMatriculasPendentes,
    gerarMatriculasPendentes,
    gerarMatriculasAnoLectivo,
    classificarMatriculasDoAno,
    carregarTurmasDestino,
    carregarResumoMatriculas,
    calcularProximoAnoLectivo,
    extrairClasse,
    atualizarClassificacaoMatricula,
    calcularClassificacaoTurma,
    obterEstadoCicloMatriculas,
    encerrarAnoLectivo,
    abrirAnoLectivo,
    listarAnosLectivosDasTurmas,
    confirmarMatriculasEmLote,
    resolverDestinoPorObservacaoPauta,
    turmaPertenceAClasse,
    MatriculaComAluno
} from '../utils/matriculaUtils'
import { Turma, EstadoCicloMatriculas } from '../types'
import { ConfirmarMatriculaModal } from './ConfirmarMatriculaModal'
import { ExameExtraordinarioModal } from './ExameExtraordinarioModal'

interface TurmaOption {
    id: string
    nome: string
    ano_lectivo: string
    nivel_ensino: string
}

type FilterStatus = 'todos' | 'Transita' | 'Não Transita' | 'Condicional' | 'pendente' | 'confirmada' | 'AguardandoNotas'
type ViewMode = 'ciclo' | 'lista'

export const MatriculasPage: React.FC = () => {
    const { escolaProfile, professorProfile, secretarioProfile } = useAuth()

    const [anosDisponiveis, setAnosDisponiveis] = useState<string[]>([])
    const [anoOrigem, setAnoOrigem] = useState<string>('')
    const [anoDestino, setAnoDestino] = useState<string>('')
    const [turmas, setTurmas] = useState<TurmaOption[]>([])
    const [selectedTurma, setSelectedTurma] = useState<string>('')
    const [matriculas, setMatriculas] = useState<MatriculaComAluno[]>([])
    const [turmasDestino, setTurmasDestino] = useState<Turma[]>([])
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos')
    const [viewMode, setViewMode] = useState<ViewMode>('ciclo')
    const [ciclo, setCiclo] = useState<EstadoCicloMatriculas | null>(null)

    const [loading, setLoading] = useState(false)
    const [loadingCiclo, setLoadingCiclo] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [closingYear, setClosingYear] = useState(false)
    const [openingYear, setOpeningYear] = useState(false)

    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [showExameModal, setShowExameModal] = useState(false)
    const [selectedMatricula, setSelectedMatricula] = useState<MatriculaComAluno | null>(null)
    const [batchTurmaDestino, setBatchTurmaDestino] = useState('')
    const [batchConfirming, setBatchConfirming] = useState(false)

    const [resumo, setResumo] = useState({
        total: 0,
        transitados: 0,
        naoTransitados: 0,
        condicionais: 0,
        pendentes: 0,
        confirmadas: 0,
        aguardandoExame: 0
    })

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    const escolaId = escolaProfile?.id || professorProfile?.escola_id || secretarioProfile?.escola_id

    const turmasDoAno = useMemo(
        () => turmas.filter(t => t.ano_lectivo === anoOrigem),
        [turmas, anoOrigem]
    )

    useEffect(() => {
        if (escolaId) {
            void bootstrap()
        }
    }, [escolaId])

    useEffect(() => {
        if (escolaId && anoOrigem && anoDestino) {
            void loadCiclo()
        }
    }, [escolaId, anoOrigem, anoDestino])

    useEffect(() => {
        if (escolaId && anoOrigem && anoDestino) {
            void loadMatriculas()
        }
    }, [escolaId, anoOrigem, anoDestino, selectedTurma])

    const bootstrap = async () => {
        try {
            if (!escolaId) return
            setError(null)

            const { data, error: turmasError } = await supabase
                .from('turmas')
                .select('id, nome, ano_lectivo, nivel_ensino')
                .eq('escola_id', escolaId)
                .order('ano_lectivo', { ascending: false })
                .order('nome')

            if (turmasError) throw turmasError

            const mapped = (data || []).map(t => ({
                id: t.id,
                nome: t.nome,
                ano_lectivo: String(t.ano_lectivo),
                nivel_ensino: t.nivel_ensino
            }))
            setTurmas(mapped)

            const anos = await listarAnosLectivosDasTurmas(escolaId)
            setAnosDisponiveis(anos)

            if (anos.length > 0) {
                const origem = anos[0]
                setAnoOrigem(origem)
                setAnoDestino(calcularProximoAnoLectivo(origem))
            }
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao carregar dados'))
        }
    }

    const loadCiclo = async () => {
        try {
            if (!escolaId || !anoOrigem || !anoDestino) return
            setLoadingCiclo(true)
            const estado = await obterEstadoCicloMatriculas(escolaId, anoOrigem, anoDestino)
            setCiclo(estado)
        } catch (err) {
            const raw = err instanceof Error
                ? err.message
                : (typeof err === 'object' && err && 'message' in err
                    ? String((err as { message: unknown }).message)
                    : 'Erro ao carregar ciclo do ano lectivo')
            const code = typeof err === 'object' && err && 'code' in err
                ? String((err as { code: unknown }).code)
                : ''
            if (
                code === 'PGRST202' ||
                code === 'PGRST205' ||
                /obter_estado_ciclo_matriculas|anos_lectivos|could not find the (function|table)|schema cache/i.test(raw)
            ) {
                setError('Aplique no Supabase a migração supabase/migrations/20261031_anos_lectivos_matriculas_gates.sql para activar o ciclo de anos lectivos e os gates de matrícula.')
            } else {
                setError(translateError(raw || 'Erro ao carregar ciclo do ano lectivo'))
            }
            setCiclo(null)
        } finally {
            setLoadingCiclo(false)
        }
    }

    const loadMatriculas = async () => {
        try {
            setLoading(true)
            setError(null)
            if (!escolaId || !anoOrigem) return

            const data = await carregarMatriculasPendentes(escolaId, anoOrigem)
            const filtered = selectedTurma
                ? data.filter(m => m.turma_origem_id === selectedTurma)
                : data
            setMatriculas(filtered)

            const destTurmas = await carregarTurmasDestino(escolaId, anoDestino)
            setTurmasDestino(destTurmas)

            const resumoData = await carregarResumoMatriculas(escolaId, anoOrigem)
            setResumo(resumoData)
            setSelectedIds(new Set())
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao carregar matrículas'))
        } finally {
            setLoading(false)
        }
    }

    const handleEncerrarAno = async () => {
        try {
            if (!escolaId || !anoOrigem) return
            setClosingYear(true)
            setError(null)
            await encerrarAnoLectivo(escolaId, anoOrigem)
            setSuccess(`Ano lectivo ${anoOrigem} encerrado com sucesso.`)
            setTimeout(() => setSuccess(null), 5000)
            await loadCiclo()
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao encerrar ano lectivo'))
        } finally {
            setClosingYear(false)
        }
    }

    const handleAbrirAnoDestino = async () => {
        try {
            if (!escolaId || !anoDestino) return
            setOpeningYear(true)
            setError(null)
            await abrirAnoLectivo(escolaId, anoDestino)
            if (!anosDisponiveis.includes(anoDestino)) {
                setAnosDisponiveis(prev => [anoDestino, ...prev].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })))
            }
            setSuccess(`Ano lectivo ${anoDestino} aberto. Pode criar turmas desse ano e gerar matrículas.`)
            setTimeout(() => setSuccess(null), 5000)
            await loadCiclo()
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao abrir ano lectivo'))
        } finally {
            setOpeningYear(false)
        }
    }

    const handleGenerarTodas = async () => {
        try {
            if (!escolaId || !anoOrigem || !anoDestino) return
            if (!ciclo?.pode_gerar_matriculas) {
                setError('Só é possível gerar matrículas após encerrar o ano de origem e abrir o ano de destino.')
                return
            }

            setGenerating(true)
            setError(null)

            const resultado = await gerarMatriculasAnoLectivo(escolaId, anoOrigem, anoDestino)
            const actualizadas = await classificarMatriculasDoAno(escolaId, anoOrigem, turmasDoAno)

            setSuccess(
                `${resultado.matriculas_geradas} matrículas geradas em ${resultado.turmas_processadas} turma(s); ${actualizadas} classificadas com base nas pautas finais.`
            )
            setTimeout(() => setSuccess(null), 7000)
            setViewMode('lista')
            await loadMatriculas()
            await loadCiclo()
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao gerar matrículas'))
        } finally {
            setGenerating(false)
        }
    }

    const handleGenerarTurma = async () => {
        try {
            if (!escolaId || !selectedTurma || !anoDestino) {
                setError('Selecione a turma de origem')
                return
            }
            if (!ciclo?.pode_gerar_matriculas) {
                setError('Só é possível gerar matrículas após encerrar o ano de origem e abrir o ano de destino.')
                return
            }

            setGenerating(true)
            setError(null)

            const count = await gerarMatriculasPendentes(selectedTurma, anoDestino)
            const turmaInfo = turmas.find(t => t.id === selectedTurma)
            if (!turmaInfo) return

            const classe = extrairClasse(turmaInfo.nome)
            const { data: discObrig } = await supabase
                .from('disciplinas_obrigatorias')
                .select('disciplina_id')
                .eq('turma_id', selectedTurma)
                .eq('is_obrigatoria', true)

            const classificacoes = await calcularClassificacaoTurma(
                selectedTurma,
                turmaInfo.nivel_ensino,
                classe || '',
                (discObrig || []).map(d => d.disciplina_id)
            )

            const matriculasData = await carregarMatriculasPendentes(escolaId, turmaInfo.ano_lectivo)
            const turmaMatriculas = matriculasData.filter(m => m.turma_origem_id === selectedTurma)

            for (const matricula of turmaMatriculas) {
                const classificacao = classificacoes.find(c => c.aluno.id === matricula.aluno_id)
                if (classificacao) {
                    await atualizarClassificacaoMatricula(
                        matricula.id,
                        classificacao.classification,
                        classificacao.mediaGeral,
                        classe
                    )
                }
            }

            setSuccess(`${count} matrículas geradas e classificadas para ${turmaInfo.nome}.`)
            setTimeout(() => setSuccess(null), 5000)
            setViewMode('lista')
            await loadMatriculas()
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao gerar matrículas'))
        } finally {
            setGenerating(false)
        }
    }

    const handleConfirmarClick = (matricula: MatriculaComAluno) => {
        const destino = resolverDestinoPorObservacaoPauta(matricula)
        if (!destino.observacao) {
            setError(destino.mensagem)
            return
        }
        setSelectedMatricula(matricula)
        setShowConfirmModal(true)
    }

    const handleExameClick = (matricula: MatriculaComAluno) => {
        setSelectedMatricula(matricula)
        setShowExameModal(true)
    }

    const handleConfirmSuccess = async () => {
        setShowConfirmModal(false)
        setSelectedMatricula(null)
        setSuccess('Matrícula confirmada com sucesso!')
        setTimeout(() => setSuccess(null), 3000)
        await loadMatriculas()
    }

    const handleExameSuccess = async () => {
        setShowExameModal(false)
        setSelectedMatricula(null)
        setSuccess('Resultado do exame registado com sucesso!')
        setTimeout(() => setSuccess(null), 3000)
        await loadMatriculas()
    }

    const handleBatchConfirm = async () => {
        try {
            if (!batchTurmaDestino || selectedIds.size === 0) {
                setError('Seleccione alunos e a turma de destino para confirmação em lote')
                return
            }

            const turmaDestino = turmasDestino.find(t => t.id === batchTurmaDestino)
            if (!turmaDestino) {
                setError('Turma de destino inválida')
                return
            }

            const elegiveis = filteredMatriculas.filter(m => {
                if (!selectedIds.has(m.id) || m.estado_matricula !== 'pendente') return false
                const destino = resolverDestinoPorObservacaoPauta(m)
                return Boolean(destino.observacao && destino.classeEsperada
                    && turmaPertenceAClasse(turmaDestino.nome, destino.classeEsperada))
            })

            if (elegiveis.length === 0) {
                setError(
                    'Nenhuma matrícula seleccionada é compatível com a turma escolhida. '
                    + '«Transita» só confirma na classe seguinte; «Não Transita» só na mesma classe.'
                )
                return
            }

            setBatchConfirming(true)
            setError(null)
            const result = await confirmarMatriculasEmLote(elegiveis, turmaDestino)

            setSuccess(`${result.success} matrícula(s) confirmada(s)${result.errors.length ? `; ${result.errors.length} com erro` : ''}.`)
            setTimeout(() => setSuccess(null), 5000)
            setBatchTurmaDestino('')
            await loadMatriculas()
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro na confirmação em lote'))
        } finally {
            setBatchConfirming(false)
        }
    }

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedIds(next)
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredMatriculas.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredMatriculas.map(m => m.id)))
        }
    }

    const filteredMatriculas = matriculas.filter(m => {
        if (filterStatus === 'todos') return true
        if (filterStatus === 'pendente' || filterStatus === 'confirmada') {
            return m.estado_matricula === filterStatus
        }
        return m.status_transicao === filterStatus
    })

    const listaConfirmados = useMemo(
        () => matriculas.filter(m => m.estado_matricula === 'confirmada'),
        [matriculas]
    )

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Transita': return 'bg-green-100 text-green-800 border-green-200'
            case 'Não Transita': return 'bg-red-100 text-red-800 border-red-200'
            case 'Condicional': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
            case 'AguardandoNotas': return 'bg-slate-100 text-slate-700 border-slate-200'
            default: return 'bg-gray-100 text-gray-800 border-gray-200'
        }
    }

    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case 'confirmada': return 'bg-blue-100 text-blue-800 border-blue-200'
            case 'pendente': return 'bg-amber-100 text-amber-800 border-amber-200'
            case 'aguardando_exame': return 'bg-purple-100 text-purple-800 border-purple-200'
            default: return 'bg-gray-100 text-gray-800 border-gray-200'
        }
    }

    const estadoBadge = (estado: string | undefined) => {
        const e = estado || 'inexistente'
        if (e === 'fechado') return 'bg-slate-800 text-white'
        if (e === 'aberto') return 'bg-emerald-600 text-white'
        if (e === 'em_encerramento') return 'bg-amber-500 text-white'
        return 'bg-slate-200 text-slate-700'
    }

    const podeGerar = Boolean(ciclo?.pode_gerar_matriculas)
    const prontidao = ciclo?.prontidao_pautas

    return (
        <div className="space-y-5 md:space-y-6 animate-fade-in pb-6">
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-5 md:p-6 shadow-lg">
                <div className="relative flex items-start gap-4">
                    <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                        <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Confirmação de Matrículas</h2>
                        <p className="text-sm md:text-base text-indigo-100/90">
                            Só após encerrar o ano lectivo (com pautas finais completas) e abrir o novo ano é possível gerar matrículas e listas de alunos matriculados/confirmados.
                        </p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm">
                    <span className="text-sm flex-1">{error}</span>
                    <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 p-1" aria-label="Fechar erro">×</button>
                </div>
            )}

            {success && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm shadow-sm">
                    {success}
                </div>
            )}

            {/* Selecção de anos */}
            <Card className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200/50">
                    <h3 className="text-base md:text-lg font-semibold text-slate-800">Ciclo do Ano Lectivo</h3>
                </CardHeader>
                <CardBody className="p-4 md:p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Ano de origem (a encerrar)</label>
                            <select
                                value={anoOrigem}
                                onChange={(e) => {
                                    const v = e.target.value
                                    setAnoOrigem(v)
                                    setAnoDestino(calcularProximoAnoLectivo(v))
                                    setSelectedTurma('')
                                }}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
                            >
                                <option value="">Seleccione o ano</option>
                                {anosDisponiveis.map(ano => (
                                    <option key={ano} value={ano}>{ano}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Ano de destino (a abrir)</label>
                            <input
                                type="text"
                                value={anoDestino}
                                onChange={(e) => setAnoDestino(e.target.value.trim())}
                                placeholder="Ex: 2027"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
                            />
                        </div>
                        <div className="flex flex-col justify-end gap-2">
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-slate-500">Origem:</span>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${estadoBadge(ciclo?.origem_estado)}`}>
                                    {ciclo?.origem_estado || '—'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-slate-500">Destino:</span>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${estadoBadge(ciclo?.destino_estado)}`}>
                                    {ciclo?.destino_estado || '—'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-end gap-2">
                            <button
                                type="button"
                                onClick={() => setViewMode('ciclo')}
                                className={`flex-1 px-3 py-3 rounded-xl text-sm font-medium border ${viewMode === 'ciclo' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'}`}
                            >
                                Ciclo / Pautas
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('lista')}
                                className={`flex-1 px-3 py-3 rounded-xl text-sm font-medium border ${viewMode === 'lista' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'}`}
                            >
                                Listas
                            </button>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {viewMode === 'ciclo' && (
                <>
                    <Card className="overflow-hidden border-0 shadow-lg">
                        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200/50">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <h3 className="text-base font-semibold text-slate-800">Prontidão das pautas finais</h3>
                                    <p className="text-sm text-slate-500">
                                        Todas as turmas/classes do ano {anoOrigem || '—'} devem ter MF/MFD lançadas.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void loadCiclo()}
                                    disabled={loadingCiclo || !anoOrigem}
                                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                    {loadingCiclo ? 'A verificar…' : 'Actualizar verificação'}
                                </button>
                            </div>
                        </CardHeader>
                        <CardBody className="p-4 md:p-5 space-y-4">
                            {prontidao ? (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="rounded-xl border border-slate-200 p-3 bg-white">
                                            <div className="text-xl font-bold text-slate-800">{prontidao.total_turmas}</div>
                                            <div className="text-xs text-slate-500">Turmas</div>
                                        </div>
                                        <div className="rounded-xl border border-emerald-200 p-3 bg-emerald-50">
                                            <div className="text-xl font-bold text-emerald-700">{prontidao.turmas_prontas}</div>
                                            <div className="text-xs text-emerald-600">Prontas</div>
                                        </div>
                                        <div className="rounded-xl border border-amber-200 p-3 bg-amber-50">
                                            <div className="text-xl font-bold text-amber-700">{prontidao.turmas_incompletas}</div>
                                            <div className="text-xs text-amber-600">Incompletas</div>
                                        </div>
                                        <div className="rounded-xl border border-red-200 p-3 bg-red-50">
                                            <div className="text-xl font-bold text-red-700">{prontidao.turmas_sem_mf}</div>
                                            <div className="text-xs text-red-600">Sem MF/MFD</div>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Turma</th>
                                                    <th className="px-3 py-2 text-center font-semibold text-slate-600">Alunos</th>
                                                    <th className="px-3 py-2 text-center font-semibold text-slate-600">Completos</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Situação</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {(prontidao.turmas || []).map(t => (
                                                    <tr key={t.turma_id}>
                                                        <td className="px-3 py-2 font-medium text-slate-800">{t.turma_nome}</td>
                                                        <td className="px-3 py-2 text-center text-slate-600">{t.alunos_ativos}</td>
                                                        <td className="px-3 py-2 text-center text-slate-600">{t.alunos_completos}</td>
                                                        <td className="px-3 py-2">
                                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${t.pronta ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                                                                {t.pronta ? 'Pronta' : t.motivo}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-slate-500">Seleccione o ano de origem para verificar as pautas finais.</p>
                            )}

                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => void handleEncerrarAno()}
                                    disabled={!anoOrigem || closingYear || ciclo?.origem_estado === 'fechado' || !prontidao?.pronta}
                                    className="px-5 py-3 rounded-xl bg-slate-800 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-900"
                                >
                                    {closingYear ? 'A encerrar…' : ciclo?.origem_estado === 'fechado' ? `Ano ${anoOrigem} já encerrado` : `Encerrar ano ${anoOrigem || ''}`}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleAbrirAnoDestino()}
                                    disabled={!anoDestino || openingYear || ciclo?.destino_estado === 'aberto'}
                                    className="px-5 py-3 rounded-xl bg-emerald-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700"
                                >
                                    {openingYear ? 'A abrir…' : ciclo?.destino_estado === 'aberto' ? `Ano ${anoDestino} já aberto` : `Abrir ano ${anoDestino || ''}`}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleGenerarTodas()}
                                    disabled={!podeGerar || generating}
                                    className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 flex-1"
                                >
                                    {generating ? 'A gerar…' : 'Gerar matrículas de toda a escola'}
                                </button>
                            </div>

                            {!podeGerar && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                    Para gerar matrículas e produzir listas de alunos matriculados/confirmados:
                                    <ol className="list-decimal ml-5 mt-2 space-y-1">
                                        <li>Complete as pautas finais (MF/MFD) de todas as turmas do ano de origem.</li>
                                        <li>Encerre o ano lectivo de origem.</li>
                                        <li>Abra o novo ano lectivo de destino (e crie as turmas desse ano).</li>
                                    </ol>
                                </div>
                            )}
                        </CardBody>
                    </Card>

                    {podeGerar && (
                        <Card className="overflow-hidden border-0 shadow-lg">
                            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200/50">
                                <h3 className="text-base font-semibold text-slate-800">Gerar por turma (opcional)</h3>
                            </CardHeader>
                            <CardBody className="p-4 md:p-5">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="sm:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Turma de origem</label>
                                        <select
                                            value={selectedTurma}
                                            onChange={(e) => setSelectedTurma(e.target.value)}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white"
                                        >
                                            <option value="">Todas (use o botão da escola)</option>
                                            {turmasDoAno.map(t => (
                                                <option key={t.id} value={t.id}>{t.nome}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            type="button"
                                            onClick={() => void handleGenerarTurma()}
                                            disabled={!selectedTurma || generating}
                                            className="w-full px-5 py-3 bg-indigo-600 text-white font-medium rounded-xl disabled:opacity-50"
                                        >
                                            Gerar desta turma
                                        </button>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    )}
                </>
            )}

            {viewMode === 'lista' && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                            <div className="text-2xl font-bold text-slate-800">{resumo.total}</div>
                            <div className="text-xs text-slate-500">Total</div>
                        </div>
                        <div className="bg-green-50 rounded-xl p-4 shadow-sm border border-green-200">
                            <div className="text-2xl font-bold text-green-700">{resumo.transitados}</div>
                            <div className="text-xs text-green-600">Transitados</div>
                        </div>
                        <div className="bg-red-50 rounded-xl p-4 shadow-sm border border-red-200">
                            <div className="text-2xl font-bold text-red-700">{resumo.naoTransitados}</div>
                            <div className="text-xs text-red-600">Não Transitados</div>
                        </div>
                        <div className="bg-yellow-50 rounded-xl p-4 shadow-sm border border-yellow-200">
                            <div className="text-2xl font-bold text-yellow-700">{resumo.condicionais}</div>
                            <div className="text-xs text-yellow-600">Condicionais</div>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-4 shadow-sm border border-amber-200">
                            <div className="text-2xl font-bold text-amber-700">{resumo.pendentes}</div>
                            <div className="text-xs text-amber-600">Pendentes</div>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-4 shadow-sm border border-blue-200">
                            <div className="text-2xl font-bold text-blue-700">{resumo.confirmadas}</div>
                            <div className="text-xs text-blue-600">Confirmadas</div>
                        </div>
                        <div className="bg-purple-50 rounded-xl p-4 shadow-sm border border-purple-200">
                            <div className="text-2xl font-bold text-purple-700">{resumo.aguardandoExame}</div>
                            <div className="text-xs text-purple-600">Aguardando Exame</div>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Filtrar por turma de origem</label>
                            <select
                                value={selectedTurma}
                                onChange={(e) => setSelectedTurma(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white"
                            >
                                <option value="">Todas as turmas do ano {anoOrigem}</option>
                                {turmasDoAno.map(t => (
                                    <option key={t.id} value={t.id}>{t.nome}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={() => void loadMatriculas()}
                            className="px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium"
                        >
                            Actualizar lista
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {[
                            { key: 'todos', label: 'Todos' },
                            { key: 'Transita', label: 'Transitados' },
                            { key: 'Não Transita', label: 'Não Transitados' },
                            { key: 'Condicional', label: 'Condicionais' },
                            { key: 'AguardandoNotas', label: 'Sem classificação' },
                            { key: 'pendente', label: 'Pendentes' },
                            { key: 'confirmada', label: 'Confirmadas' }
                        ].map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setFilterStatus(key as FilterStatus)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterStatus === key
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {selectedIds.size > 0 && (
                        <Card className="border-0 shadow-md">
                            <CardBody className="p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Confirmar {selectedIds.size} seleccionados (Transita → classe seguinte; Não Transita → mesma classe)
                                    </label>
                                    <select
                                        value={batchTurmaDestino}
                                        onChange={(e) => setBatchTurmaDestino(e.target.value)}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white"
                                    >
                                        <option value="">Seleccione turma de destino ({anoDestino})</option>
                                        {turmasDestino.map(t => (
                                            <option key={t.id} value={t.id}>{t.nome}</option>
                                        ))}
                                    </select>
                                    {turmasDestino.length === 0 && (
                                        <p className="mt-2 text-xs text-amber-700">
                                            Não há turmas no ano {anoDestino}. Crie as turmas do novo ano antes de confirmar.
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void handleBatchConfirm()}
                                    disabled={batchConfirming || !batchTurmaDestino}
                                    className="px-5 py-3 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50"
                                >
                                    {batchConfirming ? 'A confirmar…' : 'Confirmar seleccionados'}
                                </button>
                            </CardBody>
                        </Card>
                    )}

                    {filterStatus === 'confirmada' && listaConfirmados.length > 0 && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                            Lista de alunos com matrícula confirmada para {anoDestino}: {listaConfirmados.length} aluno(s).
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <svg className="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                    ) : filteredMatriculas.length > 0 ? (
                        <Card className="overflow-hidden border-0 shadow-lg">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 text-left">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.size === filteredMatriculas.length && filteredMatriculas.length > 0}
                                                    onChange={toggleSelectAll}
                                                    className="rounded border-slate-300"
                                                />
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Aluno</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Turma origem</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Nº Processo</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Média</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Status</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Estado</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Destino</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredMatriculas.map((matricula) => (
                                            <tr key={matricula.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(matricula.id)}
                                                        onChange={() => toggleSelection(matricula.id)}
                                                        className="rounded border-slate-300"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-slate-800">{matricula.aluno?.nome_completo}</div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600">
                                                    {matricula.turma_origem?.nome || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600">
                                                    {matricula.aluno?.numero_processo}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="font-semibold text-slate-800">
                                                        {matricula.media_geral?.toFixed(1) || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(matricula.status_transicao)}`}>
                                                        {matricula.status_transicao}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${getEstadoColor(matricula.estado_matricula)}`}>
                                                        {matricula.estado_matricula === 'aguardando_exame' ? 'Aguardando Exame' :
                                                            matricula.estado_matricula.charAt(0).toUpperCase() + matricula.estado_matricula.slice(1)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center text-sm text-slate-600">
                                                    {(() => {
                                                        const d = resolverDestinoPorObservacaoPauta(matricula)
                                                        if (d.observacao === 'Transita') return d.classeEsperada || matricula.classe_destino || '—'
                                                        if (d.observacao === 'Não Transita') return d.classeEsperada || matricula.classe_origem || '—'
                                                        return matricula.classe_destino || '—'
                                                    })()}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {matricula.estado_matricula === 'pendente' && resolverDestinoPorObservacaoPauta(matricula).observacao && (
                                                            <button
                                                                onClick={() => handleConfirmarClick(matricula)}
                                                                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                                                                title={resolverDestinoPorObservacaoPauta(matricula).mensagem}
                                                            >
                                                                Confirmar
                                                            </button>
                                                        )}
                                                        {matricula.estado_matricula === 'pendente' && !resolverDestinoPorObservacaoPauta(matricula).observacao && (
                                                            <span className="text-xs text-slate-500">
                                                                {matricula.status_transicao === 'Condicional' || matricula.estado_matricula === 'aguardando_exame'
                                                                    ? 'Aguarda exame'
                                                                    : 'Sem observação definitiva'}
                                                            </span>
                                                        )}
                                                        {matricula.estado_matricula === 'aguardando_exame' && (
                                                            <button
                                                                onClick={() => handleExameClick(matricula)}
                                                                className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors"
                                                            >
                                                                Registar Exame
                                                            </button>
                                                        )}
                                                        {matricula.estado_matricula === 'confirmada' && (
                                                            <span className="text-xs text-green-600 font-medium">✓ Confirmada</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    ) : (
                        <div className="text-center py-12 text-slate-500">
                            <p className="text-lg font-medium text-slate-600">Nenhuma matrícula encontrada</p>
                            <p className="text-sm mt-1">
                                {podeGerar
                                    ? 'Vá a «Ciclo / Pautas» e gere as matrículas com base nas pautas finais.'
                                    : 'Encerre o ano de origem e abra o ano de destino para poder gerar matrículas.'}
                            </p>
                        </div>
                    )}
                </>
            )}

            {showConfirmModal && selectedMatricula && (
                <ConfirmarMatriculaModal
                    matricula={selectedMatricula}
                    turmasDestino={turmasDestino}
                    onClose={() => {
                        setShowConfirmModal(false)
                        setSelectedMatricula(null)
                    }}
                    onSuccess={handleConfirmSuccess}
                />
            )}

            {showExameModal && selectedMatricula && (
                <ExameExtraordinarioModal
                    matricula={selectedMatricula}
                    onClose={() => {
                        setShowExameModal(false)
                        setSelectedMatricula(null)
                    }}
                    onSuccess={handleExameSuccess}
                />
            )}
        </div>
    )
}
