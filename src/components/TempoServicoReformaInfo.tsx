import React, { useMemo } from 'react'
import { Icons } from './ui/Icons'
import {
    calcularTempoServicoReforma,
    formatDatePt,
    type TempoServicoInput,
} from '../utils/tempoServicoReforma'

interface TempoServicoReformaInfoProps extends TempoServicoInput {
    /** compact = linhas em card; detail = bloco expandido (modais) */
    variant?: 'compact' | 'detail'
    className?: string
}

export const TempoServicoReformaInfo: React.FC<TempoServicoReformaInfoProps> = ({
    dataNascimento,
    dataInicioServico,
    genero,
    numeroFilhos,
    variant = 'compact',
    className = '',
}) => {
    const result = useMemo(
        () =>
            calcularTempoServicoReforma({
                dataNascimento,
                dataInicioServico,
                genero,
                numeroFilhos,
            }),
        [dataNascimento, dataInicioServico, genero, numeroFilhos],
    )

    if (result.incompleto && !result.tempoServico && !result.idadeActual) {
        if (variant === 'compact') return null
        return (
            <div className={`rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-800 ${className}`}>
                Indique a data de nascimento e a data de início de funções/admissão para calcular o tempo de serviço e a previsão de reforma
                (DP n.º 299/20).
            </div>
        )
    }

    const { tempoServico, previsao } = result
    const reformaTone = previsao.elegivelAgora
        ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
        : 'bg-slate-50 text-slate-700 border-slate-100'

    if (variant === 'compact') {
        return (
            <div className={`space-y-2 ${className}`}>
                {tempoServico && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                        <Icons.Clock className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Tempo de serviço</p>
                            <p className="text-sm text-slate-700 truncate">{tempoServico.label}</p>
                        </div>
                    </div>
                )}
                {(previsao.dataPrevista || previsao.elegivelAgora) && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${reformaTone}`}>
                        <Icons.Calendar className="w-4 h-4 text-teal-600 flex-shrink-0" />
                        <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wide opacity-70 font-medium">Previsão de reforma</p>
                            <p className="text-sm font-medium truncate">
                                {previsao.elegivelAgora
                                    ? 'Elegível agora'
                                    : formatDatePt(previsao.dataPrevista)}
                            </p>
                            {!previsao.elegivelAgora && previsao.tempoRestante && (
                                <p className="text-[11px] opacity-80 truncate">em {previsao.tempoRestante.label}</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className={`rounded-xl border border-slate-200 bg-white overflow-hidden ${className}`}>
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Tempo de serviço e reforma
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{previsao.baseLegal}</p>
            </div>
            <div className="px-3 py-3 space-y-2.5 text-sm">
                <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Tempo de serviço</span>
                    <span className="font-medium text-slate-900 text-right">
                        {tempoServico?.label || '—'}
                    </span>
                </div>
                {result.idadeActual && (
                    <div className="flex justify-between gap-3">
                        <span className="text-slate-500">Idade actual</span>
                        <span className="font-medium text-slate-900 text-right">{result.idadeActual.label}</span>
                    </div>
                )}
                <div className="flex justify-between gap-3">
                    <span className="text-slate-500">
                        Idade de reforma
                        {previsao.reducaoIdadeAnos > 0 ? ` (−${previsao.reducaoIdadeAnos} filho${previsao.reducaoIdadeAnos === 1 ? '' : 's'})` : ''}
                    </span>
                    <span className="font-medium text-slate-900 text-right">{previsao.idadeReformaAnos} anos</span>
                </div>
                <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Previsão (idade)</span>
                    <span className="font-medium text-slate-900 text-right">{formatDatePt(previsao.dataPorIdade)}</span>
                </div>
                <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Previsão (35 anos / 420 meses)</span>
                    <span className="font-medium text-slate-900 text-right">{formatDatePt(previsao.dataPorContribuicoes)}</span>
                </div>
                <div className={`flex justify-between gap-3 pt-2 border-t border-slate-100`}>
                    <span className="text-slate-500">Data prevista</span>
                    <span className={`font-semibold text-right ${previsao.elegivelAgora ? 'text-emerald-700' : 'text-teal-700'}`}>
                        {previsao.elegivelAgora ? 'Elegível agora' : formatDatePt(previsao.dataPrevista)}
                    </span>
                </div>
                <p className="text-xs text-slate-500">{previsao.tempoRestanteLabel}</p>
                {previsao.avisoGarantia && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-2 leading-snug">
                        {previsao.avisoGarantia}
                    </p>
                )}
                {result.incompleto && (
                    <p className="text-[11px] text-amber-700">
                        Em falta: {result.camposEmFalta.join(', ')}.
                    </p>
                )}
            </div>
        </div>
    )
}

export default TempoServicoReformaInfo
