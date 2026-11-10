/*
component-meta:
  name: QuadroHonraPreview
  description: Quadro de Honra / Prémio de Mérito com cartões e foto tipo passe (Dec. Ext. 76/24)
  responsive: true
*/

import React, { useRef, useState } from 'react'
import {
    getCriteriaDescription,
    getDistincaoLabel,
    getQuadroHonraThresholds,
    type QuadroHonraEntry,
    type QuadroHonraPeriodo,
} from '../utils/quadroHonra'
import { uploadAlunoFoto } from '../utils/alunoFotoUtils'

export interface QuadroHonraDisciplinaData {
    disciplina_id: string
    disciplina_nome: string
    disciplina_codigo?: string
    entries: QuadroHonraEntry[]
}

export interface QuadroHonraData {
    escola: {
        nome: string
        provincia: string
        municipio: string
        codigo_escola?: string
    }
    turma: {
        id: string
        nome: string
        codigo_turma: string
        ano_lectivo: string | number
        nivel_ensino: string
        classe?: string
    }
    trimestre: QuadroHonraPeriodo
    mode: 'disciplina' | 'global'
    disciplinas: QuadroHonraDisciplinaData[]
    globalEntries?: QuadroHonraEntry[]
}

interface Props {
    data: QuadroHonraData
    headerConfig?: {
        logo_url?: string | null
        nome_escola: string
        provincia?: string
        municipio?: string
        nivel_ensino?: string
        mostrar_republica?: boolean
        texto_republica?: string
        mostrar_governo_provincial?: boolean
        mostrar_orgao_educacao?: boolean
    } | null
    /** Chamado após upload bem-sucedido da foto tipo passe */
    onFotoUpdated?: (alunoId: string, fotoUrl: string) => void
    allowFotoUpload?: boolean
}

function getTrimLabel(trimestre: QuadroHonraPeriodo): string {
    if (trimestre === 'anual') return 'Anual'
    return `${trimestre}º Trimestre`
}

function medalhaTone(medalha: QuadroHonraEntry['medalha']): {
    badge: string
    ring: string
    accent: string
    label: string
} {
    switch (medalha) {
        case 'Ouro':
            return {
                badge: 'bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 text-amber-950',
                ring: 'ring-amber-400/70',
                accent: 'from-amber-500/15 via-yellow-50 to-white',
                label: 'Ouro',
            }
        case 'Prata':
            return {
                badge: 'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-500 text-slate-800',
                ring: 'ring-slate-300/80',
                accent: 'from-slate-400/10 via-slate-50 to-white',
                label: 'Prata',
            }
        case 'Bronze':
            return {
                badge: 'bg-gradient-to-br from-orange-300 via-amber-600 to-orange-800 text-orange-50',
                ring: 'ring-orange-400/60',
                accent: 'from-orange-500/10 via-orange-50 to-white',
                label: 'Bronze',
            }
        default:
            return {
                badge: 'bg-slate-200 text-slate-600',
                ring: 'ring-slate-200',
                accent: 'from-slate-100 via-white to-white',
                label: '—',
            }
    }
}

function initials(nome: string): string {
    const parts = nome.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function posicaoRibbon(posicao: number): string {
    if (posicao === 1) return 'bg-amber-500 text-white shadow-amber-500/30'
    if (posicao === 2) return 'bg-slate-500 text-white shadow-slate-500/30'
    if (posicao === 3) return 'bg-orange-700 text-white shadow-orange-700/30'
    return 'bg-slate-700 text-white shadow-slate-700/20'
}

const AlunoHonraCard: React.FC<{
    entry: QuadroHonraEntry
    allowFotoUpload: boolean
    onFotoUpdated?: (alunoId: string, fotoUrl: string) => void
    onError?: (msg: string) => void
}> = ({ entry, allowFotoUpload, onFotoUpdated, onError }) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [localFoto, setLocalFoto] = useState<string | null | undefined>(entry.foto_url)
    const tone = medalhaTone(entry.medalha)
    const foto = localFoto ?? entry.foto_url

    const handleFile = async (file: File | undefined) => {
        if (!file) return
        try {
            setUploading(true)
            const url = await uploadAlunoFoto(entry.aluno_id, file)
            setLocalFoto(url)
            onFotoUpdated?.(entry.aluno_id, url)
        } catch (err) {
            onError?.(err instanceof Error ? err.message : 'Erro ao carregar a fotografia')
        } finally {
            setUploading(false)
            if (inputRef.current) inputRef.current.value = ''
        }
    }

    return (
        <article
            className={`
                group relative overflow-hidden rounded-2xl border border-amber-100/80
                bg-gradient-to-b ${tone.accent}
                shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300
            `}
        >
            <div className={`absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r ${entry.medalha === 'Ouro' ? 'from-amber-400 via-yellow-300 to-amber-500' : entry.medalha === 'Prata' ? 'from-slate-300 via-slate-200 to-slate-400' : 'from-orange-400 via-amber-600 to-orange-700'}`} />

            <div className="p-4 flex flex-col items-center text-center">
                <div className="relative mb-3">
                    <div
                        className={`
                            w-[104px] h-[132px] rounded-xl overflow-hidden
                            ring-2 ${tone.ring} ring-offset-2 ring-offset-white
                            bg-slate-100 shadow-inner
                        `}
                    >
                        {foto ? (
                            <img
                                src={foto}
                                alt={`Foto tipo passe de ${entry.nome_completo}`}
                                className="w-full h-full object-cover object-top"
                                loading="lazy"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 text-slate-500">
                                <span className="text-2xl font-bold tracking-wide">{initials(entry.nome_completo)}</span>
                                <span className="text-[10px] mt-1 uppercase tracking-wider">Sem foto</span>
                            </div>
                        )}
                    </div>

                    <span
                        className={`
                            absolute -top-2 -left-2 min-w-[2rem] h-8 px-2 rounded-full
                            flex items-center justify-center text-xs font-bold shadow-md
                            ${posicaoRibbon(entry.posicao)}
                        `}
                    >
                        {entry.posicao}º
                    </span>

                    {entry.medalha && (
                        <span
                            className={`
                                absolute -bottom-2 -right-2 px-2.5 py-1 rounded-full text-[10px] font-bold
                                uppercase tracking-wide shadow-md ${tone.badge}
                            `}
                        >
                            {tone.label}
                        </span>
                    )}
                </div>

                <h4 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2 min-h-[2.5rem]">
                    {entry.nome_completo}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">N.º {entry.numero_processo}</p>

                <div className="mt-3 w-full grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white/80 border border-amber-100 px-2 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">Nota</p>
                        <p className="text-lg font-bold tabular-nums text-amber-800 leading-none mt-0.5">
                            {entry.nota.toFixed(1)}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">arred. {entry.nota_arredondada}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 border border-amber-100 px-2 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">Nível</p>
                        <p className="text-sm font-semibold text-slate-800 mt-1 leading-tight">
                            {entry.classificacao}
                        </p>
                    </div>
                </div>

                {allowFotoUpload && (
                    <div className="mt-3 w-full">
                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => handleFile(e.target.files?.[0])}
                        />
                        <button
                            type="button"
                            disabled={uploading}
                            onClick={() => inputRef.current?.click()}
                            className="
                                w-full inline-flex items-center justify-center gap-1.5
                                px-3 py-2 rounded-xl text-xs font-medium
                                border border-dashed border-amber-300 text-amber-800
                                bg-amber-50/70 hover:bg-amber-100 transition
                                disabled:opacity-60 min-h-[40px]
                            "
                        >
                            {uploading ? (
                                <>
                                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    A optimizar e carregar…
                                </>
                            ) : (
                                <>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {foto ? 'Alterar foto passe' : 'Inserir foto passe'}
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </article>
    )
}

function HonraGallery({
    entries,
    emptyLabel,
    allowFotoUpload,
    onFotoUpdated,
    onError,
}: {
    entries: QuadroHonraEntry[]
    emptyLabel: string
    allowFotoUpload: boolean
    onFotoUpdated?: (alunoId: string, fotoUrl: string) => void
    onError?: (msg: string) => void
}) {
    if (entries.length === 0) {
        return <p className="text-sm text-slate-500 py-8 text-center">{emptyLabel}</p>
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {entries.map((e) => (
                <AlunoHonraCard
                    key={e.aluno_id}
                    entry={e}
                    allowFotoUpload={allowFotoUpload}
                    onFotoUpdated={onFotoUpdated}
                    onError={onError}
                />
            ))}
        </div>
    )
}

export const QuadroHonraPreview: React.FC<Props> = ({
    data,
    headerConfig,
    onFotoUpdated,
    allowFotoUpload = true,
}) => {
    const [localError, setLocalError] = useState<string | null>(null)
    const escola = headerConfig?.nome_escola || data.escola.nome
    const provincia = headerConfig?.provincia || data.escola.provincia
    const municipio = headerConfig?.municipio || data.escola.municipio
    const distincao = getDistincaoLabel(data.trimestre)
    const thresholds = getQuadroHonraThresholds(data.turma.nivel_ensino)
    const totalHonrados =
        data.mode === 'global'
            ? data.globalEntries?.length || 0
            : data.disciplinas.reduce((s, d) => s + d.entries.length, 0)

    return (
        <div className="rounded-2xl border border-amber-200/70 overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-50 via-white to-slate-50 shadow-sm">
            <div className="relative px-4 py-6 md:px-8 md:py-8 text-center border-b border-amber-100/80 bg-gradient-to-br from-[#1a2744] via-[#243556] to-[#3d2a12] text-white overflow-hidden">
                <div className="pointer-events-none absolute inset-0 opacity-30"
                    style={{
                        backgroundImage:
                            'radial-gradient(circle at 20% 20%, rgba(251,191,36,0.35), transparent 40%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.12), transparent 35%)',
                    }}
                />
                <div className="relative space-y-1">
                    {headerConfig?.mostrar_republica && (
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">
                            {headerConfig.texto_republica || 'República de Angola'}
                        </p>
                    )}
                    {headerConfig?.mostrar_governo_provincial && (
                        <p className="text-xs text-slate-200/80">Governo Provincial da {provincia}</p>
                    )}
                    {headerConfig?.mostrar_orgao_educacao && (
                        <p className="text-xs text-slate-200/80">
                            {(headerConfig.nivel_ensino || data.turma.nivel_ensino || '')
                                .toLowerCase()
                                .includes('secund')
                                ? `Direcção Provincial da Educação da ${provincia}`
                                : `Direcção Municipal da Educação de ${municipio}`}
                        </p>
                    )}
                    <p className="text-sm font-medium text-amber-100/90 pt-1">{escola}</p>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-amber-300 drop-shadow-sm pt-1">
                        {distincao.toUpperCase()}
                    </h2>
                    <p className="text-xs text-slate-300">
                        Decreto Executivo n.º 76/24 — MED · {getTrimLabel(data.trimestre)} · Ano Lectivo{' '}
                        {data.turma.ano_lectivo}
                    </p>
                    <p className="text-sm text-slate-100 pt-2">
                        Turma:{' '}
                        <span className="font-semibold text-white">{data.turma.codigo_turma}</span>
                        {' — '}
                        {data.turma.nome}
                        {data.turma.classe ? ` · ${data.turma.classe}` : ''}
                    </p>
                </div>
            </div>

            <div className="px-4 py-3 md:px-6 bg-amber-50/80 border-b border-amber-100 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-amber-950/75 max-w-3xl leading-relaxed">
                    {getCriteriaDescription(data.turma.nivel_ensino)}
                    {allowFotoUpload
                        ? ' Pode inserir a fotografia tipo passe em cada cartão.'
                        : ''}
                </p>
                <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white border border-amber-200 px-2.5 py-1">
                        Limiar ≥ <strong className="text-amber-800">{thresholds.mediaMinima}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-600 text-white px-2.5 py-1 font-semibold">
                        {totalHonrados} aluno{totalHonrados === 1 ? '' : 's'}
                    </span>
                </div>
            </div>

            {localError && (
                <div className="mx-4 mt-4 md:mx-6 bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm">
                    {localError}
                </div>
            )}

            {data.mode === 'global' && data.globalEntries && (
                <div className="p-4 md:p-6">
                    <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Classificação geral da turma
                    </h3>
                    <HonraGallery
                        entries={data.globalEntries}
                        emptyLabel="Nenhum aluno reúne os critérios oficiais para esta distinção."
                        allowFotoUpload={allowFotoUpload}
                        onFotoUpdated={onFotoUpdated}
                        onError={setLocalError}
                    />
                </div>
            )}

            {data.mode === 'disciplina' && (
                <div className="divide-y divide-amber-100/80">
                    {data.disciplinas.length === 0 ? (
                        <p className="text-sm text-slate-500 py-10 text-center">
                            Sem disciplinas com notas para classificar.
                        </p>
                    ) : (
                        data.disciplinas.map((disc) => (
                            <section key={disc.disciplina_id} className="p-4 md:p-6">
                                <div className="flex items-center justify-between gap-2 mb-4">
                                    <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                                        <span className="inline-flex w-8 h-8 rounded-lg bg-amber-100 text-amber-800 items-center justify-center text-xs font-bold">
                                            {(disc.disciplina_codigo || disc.disciplina_nome).slice(0, 3).toUpperCase()}
                                        </span>
                                        <span>
                                            {disc.disciplina_nome}
                                            {disc.disciplina_codigo ? (
                                                <span className="ml-2 text-xs font-normal text-slate-500">
                                                    ({disc.disciplina_codigo})
                                                </span>
                                            ) : null}
                                        </span>
                                    </h3>
                                    <span className="text-xs font-medium text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full">
                                        {disc.entries.length} honrado{disc.entries.length === 1 ? '' : 's'}
                                    </span>
                                </div>
                                <HonraGallery
                                    entries={disc.entries}
                                    emptyLabel="Nenhum aluno atingiu o limiar nesta disciplina."
                                    allowFotoUpload={allowFotoUpload}
                                    onFotoUpdated={onFotoUpdated}
                                    onError={setLocalError}
                                />
                            </section>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}
