/**
 * Provincial Pedagogic Supervision Component
 * Display pedagogic indicators and comparisons between municipalities
 * Mobile-first design with simplified indicators and vertical lists
 */

import React, { useState } from 'react';
import { Icons } from '../../../components/ui/Icons';
import { usePedagogicDataProvincial } from '../hooks/usePedagogicDataProvincial';
import {
    DpPage,
    DpContent,
    DpHeader,
    DpIconButton,
    DpPanel,
    DpLoading,
    DpAlert,
    DpChip,
    DpSectionTitle,
    DpSelect,
    DpBadge,
} from './ProvincialChrome';

// Classification card
const ClassificationCard: React.FC<{
    label: string;
    range: string;
    value: number;
    color: 'green' | 'blue' | 'yellow' | 'red';
}> = ({ label, range, value, color }) => {
    const colorStyles = {
        green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        blue: 'bg-blue-50 border-blue-200 text-blue-700',
        yellow: 'bg-amber-50 border-amber-200 text-amber-700',
        red: 'bg-red-50 border-red-200 text-red-700',
    };

    const textColors = {
        green: 'text-emerald-600',
        blue: 'text-blue-600',
        yellow: 'text-amber-600',
        red: 'text-red-600',
    };

    return (
        <div className={`rounded-xl border p-3 sm:p-4 ${colorStyles[color]}`}>
            <p className="text-xs font-medium opacity-80">{range}</p>
            <p className={`text-2xl sm:text-3xl font-bold ${textColors[color]}`}>{value}</p>
            <p className="text-xs font-medium mt-0.5">{label}</p>
        </div>
    );
};

// Ranking item
const RankingItem: React.FC<{
    rank: number;
    municipio: string;
    escolas: number;
    alunos: number;
    media: number;
}> = ({ rank, municipio, escolas, alunos, media }) => {
    const getRankStyle = () => {
        if (rank === 1) return 'bg-amber-100 text-amber-700';
        if (rank === 2) return 'bg-slate-200 text-slate-600';
        if (rank === 3) return 'bg-orange-100 text-orange-700';
        return 'bg-slate-100 text-slate-500';
    };

    return (
        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/60 shadow-sm">
            <span className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm ${getRankStyle()}`}>
                {rank}
            </span>
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{municipio}</p>
                <p className="text-xs text-slate-500">{escolas} escolas • {alunos.toLocaleString()} alunos</p>
            </div>
            <span className="text-lg font-bold text-primary-600">{media.toFixed(1)}</span>
        </div>
    );
};

// Approval rate item
const ApprovalItem: React.FC<{
    municipio: string;
    taxa: number;
}> = ({ municipio, taxa }) => {
    const getColor = () => {
        if (taxa >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-600' };
        if (taxa >= 60) return { bar: 'bg-amber-500', text: 'text-amber-600' };
        return { bar: 'bg-red-500', text: 'text-red-600' };
    };

    const colors = getColor();

    return (
        <div className="p-3 bg-white rounded-xl border border-slate-200/60 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-slate-900 truncate">{municipio}</span>
                <span className={`font-bold ${colors.text}`}>{taxa.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                    className={`h-2 rounded-full ${colors.bar} transition-all duration-500`}
                    style={{ width: `${Math.min(taxa, 100)}%` }}
                />
            </div>
        </div>
    );
};

// Municipality card for detailed view
const MunicipalityCard: React.FC<{
    municipio: string;
    total_escolas: number;
    escolas_activas: number;
    total_professores: number;
    total_alunos: number;
    total_turmas: number;
    media_geral: number;
    taxa_aprovacao: number;
}> = ({ municipio, total_escolas, escolas_activas, total_professores, total_alunos, total_turmas, media_geral, taxa_aprovacao }) => (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
                    <Icons.LocationMarker className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">{municipio}</h3>
                    <p className="text-xs text-slate-500">{escolas_activas}/{total_escolas} escolas activas</p>
                </div>
                <div className="text-right">
                    <p className={`text-lg font-bold ${media_geral >= 14 ? 'text-emerald-600' : media_geral >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                        {media_geral.toFixed(1)}
                    </p>
                    <p className="text-xs text-slate-500">média</p>
                </div>
            </div>
        </div>
        <div className="grid grid-cols-4 divide-x divide-slate-100 text-center">
            <div className="py-3">
                <p className="text-lg font-bold text-slate-900">{total_professores}</p>
                <p className="text-xs text-slate-500">Prof.</p>
            </div>
            <div className="py-3">
                <p className="text-lg font-bold text-slate-900">{total_alunos.toLocaleString()}</p>
                <p className="text-xs text-slate-500">Alunos</p>
            </div>
            <div className="py-3">
                <p className="text-lg font-bold text-slate-900">{total_turmas}</p>
                <p className="text-xs text-slate-500">Turmas</p>
            </div>
            <div className="py-3">
                <p className={`text-lg font-bold ${taxa_aprovacao >= 80 ? 'text-emerald-600' : taxa_aprovacao >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                    {taxa_aprovacao.toFixed(0)}%
                </p>
                <p className="text-xs text-slate-500">Aprov.</p>
            </div>
        </div>
    </div>
);

export const SupervisaoPedagogicaProvincial: React.FC = () => {
    const {
        indicadores,
        indicadoresPorMunicipio,
        comparativo,
        taxaAprovacao,
        loading,
        error,
        refresh,
        trimestre,
        setTrimestre
    } = usePedagogicDataProvincial();

    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'ranking' | 'aprovacao' | 'detalhes'>('ranking');

    const handleRefresh = async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
    };

    if (loading) {
        return <DpLoading label="A carregar supervisão pedagógica..." />;
    }

    return (
        <DpPage>
            <DpHeader
                title="Supervisão Pedagógica"
                subtitle="Indicadores e comparativos por município"
                icon={<Icons.TrendingUp />}
                accent="amber"
                actions={
                    <div className="flex items-center gap-2">
                        <DpSelect
                            value={trimestre || ''}
                            onChange={(e) => setTrimestre(e.target.value ? Number(e.target.value) as 1 | 2 | 3 : undefined)}
                            className="!min-h-[44px] !py-2.5 !w-[7.5rem] sm:!w-auto"
                        >
                            <option value="">Todos</option>
                            <option value="1">1º Trim.</option>
                            <option value="2">2º Trim.</option>
                            <option value="3">3º Trim.</option>
                        </DpSelect>
                        <DpIconButton
                            label="Actualizar"
                            onClick={handleRefresh}
                            disabled={refreshing}
                        >
                            <Icons.Refresh className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                        </DpIconButton>
                    </div>
                }
            />

            <DpContent className="space-y-5">
                {error && <DpAlert>{error}</DpAlert>}

                {indicadores && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                        {[
                            { icon: <Icons.BarChart className="w-4 h-4 text-blue-600" />, tone: 'from-blue-50 to-blue-100', value: indicadores.media_geral.toFixed(1), label: 'Média Geral', accent: false },
                            { icon: <Icons.TrendingUp className="w-4 h-4 text-emerald-600" />, tone: 'from-emerald-50 to-emerald-100', value: `${indicadores.taxa_aprovacao.toFixed(1)}%`, label: 'Aprovação', accent: true },
                            { icon: <Icons.AcademicCap className="w-4 h-4 text-purple-600" />, tone: 'from-purple-50 to-purple-100', value: indicadores.total_alunos.toLocaleString(), label: 'Alunos', accent: false },
                            { icon: <Icons.Award className="w-4 h-4 text-orange-600" />, tone: 'from-orange-50 to-orange-100', value: indicadores.total_escolas, label: 'Escolas', accent: false },
                        ].map((stat) => (
                            <DpPanel key={stat.label} className="!p-4">
                                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.tone} flex items-center justify-center mb-2`}>
                                    {stat.icon}
                                </div>
                                <p className={`text-2xl sm:text-3xl font-bold tabular-nums tracking-tight ${stat.accent ? 'text-emerald-600' : 'text-slate-900'}`}>
                                    {stat.value}
                                </p>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">{stat.label}</p>
                            </DpPanel>
                        ))}
                    </div>
                )}

                {indicadores && (
                    <div>
                        <DpSectionTitle>Distribuição por Classificação</DpSectionTitle>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <ClassificationCard
                                label="Excelente"
                                range="17-20"
                                value={indicadores.notas_por_classificacao.excelente}
                                color="green"
                            />
                            <ClassificationCard
                                label="Bom"
                                range="14-16"
                                value={indicadores.notas_por_classificacao.bom}
                                color="blue"
                            />
                            <ClassificationCard
                                label="Suficiente"
                                range="10-13"
                                value={indicadores.notas_por_classificacao.suficiente}
                                color="yellow"
                            />
                            <ClassificationCard
                                label="Insuficiente"
                                range="<10"
                                value={indicadores.notas_por_classificacao.insuficiente}
                                color="red"
                            />
                        </div>
                    </div>
                )}

                <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 lg:hidden">
                    {[
                        { id: 'ranking', label: 'Ranking' },
                        { id: 'aprovacao', label: 'Aprovação' },
                        { id: 'detalhes', label: 'Detalhes' },
                    ].map((tab) => (
                        <DpChip
                            key={tab.id}
                            label={tab.label}
                            active={activeTab === tab.id}
                            onClick={() => setActiveTab(tab.id as 'ranking' | 'aprovacao' | 'detalhes')}
                        />
                    ))}
                </div>

                {/* Mobile: Tab content */}
                <div className="lg:hidden">
                    {activeTab === 'ranking' && (
                        <div className="space-y-3">
                            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                                <Icons.Award className="w-5 h-5 text-amber-500" />
                                Ranking de Municípios
                            </h2>
                            {comparativo.slice(0, 10).map((item) => (
                                <RankingItem
                                    key={item.municipio}
                                    rank={item.ranking}
                                    municipio={item.municipio}
                                    escolas={item.total_escolas}
                                    alunos={item.total_alunos}
                                    media={item.media_aprovacao}
                                />
                            ))}
                        </div>
                    )}

                    {activeTab === 'aprovacao' && (
                        <div className="space-y-3">
                            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                                <Icons.TrendingUp className="w-5 h-5 text-emerald-500" />
                                Taxa de Aprovação
                            </h2>
                            {taxaAprovacao.slice(0, 10).map((item) => (
                                <ApprovalItem
                                    key={item.municipio}
                                    municipio={item.municipio}
                                    taxa={item.taxa_aprovacao}
                                />
                            ))}
                        </div>
                    )}

                    {activeTab === 'detalhes' && (
                        <div className="space-y-3">
                            <h2 className="text-base font-semibold text-slate-900">Detalhes por Município</h2>
                            {indicadoresPorMunicipio.map((ind) => (
                                <MunicipalityCard key={ind.municipio} {...ind} />
                            ))}
                        </div>
                    )}
                </div>

                <div className="hidden lg:grid lg:grid-cols-2 gap-6">
                    <DpPanel>
                        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2 tracking-tight">
                            <Icons.Award className="w-5 h-5 text-amber-500" />
                            Ranking de Municípios
                        </h2>
                        <div className="space-y-2">
                            {comparativo.slice(0, 10).map((item) => (
                                <RankingItem
                                    key={item.municipio}
                                    rank={item.ranking}
                                    municipio={item.municipio}
                                    escolas={item.total_escolas}
                                    alunos={item.total_alunos}
                                    media={item.media_aprovacao}
                                />
                            ))}
                        </div>
                    </DpPanel>

                    <DpPanel>
                        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2 tracking-tight">
                            <Icons.TrendingUp className="w-5 h-5 text-emerald-500" />
                            Taxa de Aprovação
                        </h2>
                        <div className="space-y-2">
                            {taxaAprovacao.slice(0, 10).map((item) => (
                                <ApprovalItem
                                    key={item.municipio}
                                    municipio={item.municipio}
                                    taxa={item.taxa_aprovacao}
                                />
                            ))}
                        </div>
                    </DpPanel>
                </div>

                <DpPanel padding={false} className="hidden lg:block">
                    <div className="px-5 py-4 border-b border-slate-100">
                        <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Indicadores por Município</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50/80">
                                <tr>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Município</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Escolas</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Professores</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Alunos</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Turmas</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Média</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Aprovação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {indicadoresPorMunicipio.map((ind) => (
                                    <tr key={ind.municipio} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-4 font-medium text-slate-900">{ind.municipio}</td>
                                        <td className="px-5 py-4 text-slate-600">
                                            {ind.total_escolas}
                                            <span className="text-slate-400 text-sm"> ({ind.escolas_activas})</span>
                                        </td>
                                        <td className="px-5 py-4 text-slate-600">{ind.total_professores}</td>
                                        <td className="px-5 py-4 text-slate-600">{ind.total_alunos.toLocaleString()}</td>
                                        <td className="px-5 py-4 text-slate-600">{ind.total_turmas}</td>
                                        <td className="px-5 py-4">
                                            <span className={`font-bold ${ind.media_geral >= 14 ? 'text-emerald-600' : ind.media_geral >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                                                {ind.media_geral.toFixed(1)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <DpBadge
                                                tone={
                                                    ind.taxa_aprovacao >= 80
                                                        ? 'success'
                                                        : ind.taxa_aprovacao >= 60
                                                          ? 'warning'
                                                          : 'danger'
                                                }
                                            >
                                                {ind.taxa_aprovacao.toFixed(1)}%
                                            </DpBadge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </DpPanel>
            </DpContent>
        </DpPage>
    );
};

export default SupervisaoPedagogicaProvincial;
