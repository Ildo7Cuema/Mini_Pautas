/**
 * Provincial Education Dashboard
 * Main dashboard for the Provincial Education Direction
 * Mobile-first design with native app-like experience
 */

import React, { useState } from 'react';
import { Icons } from '../../../components/ui/Icons';
import { useAuth } from '../../../contexts/AuthContext';
import { usePedagogicDataProvincial } from '../hooks/usePedagogicDataProvincial';
import { useDirecoesMunicipais } from '../hooks/useDirecoesMunicipais';
import { useCircularesProvinciais } from '../hooks/useCircularesProvinciais';
import {
    DpPage,
    DpContent,
    DpHeader,
    DpIconButton,
    DpStatCard,
    DpQuickAction,
    DpSectionTitle,
    DpBadge,
    DpPanel,
    DpLoading,
} from './ProvincialChrome';

interface DirecaoProvincialDashboardProps {
    onNavigate?: (page: string, params?: Record<string, any>) => void;
}

const DirectionCard: React.FC<{
    municipio: string;
    nome: string;
    escolas_count: number;
    ativo: boolean;
    onClick?: () => void;
}> = ({ municipio, nome, escolas_count, ativo, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="
            w-full bg-white/90 backdrop-blur-sm rounded-2xl p-4
            border border-slate-200/70
            shadow-[0_1px_2px_rgba(15,23,42,0.04)]
            transition-all duration-200
            hover:shadow-md hover:border-slate-300/80 active:scale-[0.98]
            text-left
        "
    >
        <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Icons.Building className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate tracking-tight">{municipio}</p>
                    <p className="text-sm text-slate-500 truncate">{nome}</p>
                </div>
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0">
                <span className="text-sm font-semibold text-slate-600 tabular-nums">{escolas_count}</span>
                <span
                    className={`w-2.5 h-2.5 rounded-full ring-2 ring-white ${ativo ? 'bg-emerald-500' : 'bg-red-500'}`}
                    aria-label={ativo ? 'Activa' : 'Inactiva'}
                />
            </div>
        </div>
    </button>
);

export const DirecaoProvincialDashboard: React.FC<DirecaoProvincialDashboardProps> = ({ onNavigate }) => {
    const { user } = useAuth();
    const { estatisticas, loading: loadingPedagogic, refresh: refreshPedagogic } = usePedagogicDataProvincial();
    const { direcoes, estatisticas: estatsDirecoes, loading: loadingDirecoes, refresh: refreshDirecoes } = useDirecoesMunicipais();
    const { estatisticas: estatsCirculares, loading: loadingCirculares } = useCircularesProvinciais();
    const [refreshing, setRefreshing] = useState(false);

    const provincia = user?.direcaoProvincial?.provincia || 'Desconhecida';
    const nomeDirector = user?.direcaoProvincial?.nome || 'Director Provincial';

    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([refreshPedagogic(), refreshDirecoes()]);
        setRefreshing(false);
    };

    const loading = loadingPedagogic || loadingDirecoes || loadingCirculares;
    const direcoesInactivas = direcoes.filter(d => !d.ativo);

    if (loading) {
        return <DpLoading label="A carregar dashboard..." />;
    }

    return (
        <DpPage>
            <DpHeader
                title="Dashboard Provincial"
                subtitle={`Bem-vindo, ${nomeDirector}`}
                icon={<Icons.LocationMarker />}
                accent="indigo"
                meta={
                    <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                        <Icons.LocationMarker className="w-4 h-4 text-primary-500" />
                        <span className="font-medium text-slate-600">{provincia}</span>
                    </span>
                }
                actions={
                    <DpIconButton
                        label="Actualizar dados"
                        onClick={handleRefresh}
                        disabled={refreshing}
                    >
                        <Icons.Refresh className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                    </DpIconButton>
                }
            />

            <DpContent>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                    <DpStatCard
                        title="Municípios"
                        value={estatisticas.total_municipios}
                        icon={<Icons.LocationMarker className="w-5 h-5 sm:w-6 sm:h-6" />}
                        iconTone="from-indigo-50 to-indigo-100 text-indigo-600"
                    />
                    <DpStatCard
                        title="Direções"
                        value={estatisticas.total_direcoes_municipais}
                        icon={<Icons.Building className="w-5 h-5 sm:w-6 sm:h-6" />}
                        iconTone="from-blue-50 to-blue-100 text-blue-600"
                        subtitle={`${estatsDirecoes.activas} activas`}
                        onClick={() => onNavigate?.('provincial-direcoes-municipais')}
                    />
                    <DpStatCard
                        title="Escolas"
                        value={estatisticas.total_escolas}
                        icon={<Icons.School className="w-5 h-5 sm:w-6 sm:h-6" />}
                        iconTone="from-emerald-50 to-emerald-100 text-emerald-600"
                        subtitle={`${estatisticas.escolas_activas} activas`}
                        onClick={() => onNavigate?.('provincial-escolas')}
                    />
                    <DpStatCard
                        title="Alunos"
                        value={estatisticas.total_alunos.toLocaleString()}
                        icon={<Icons.AcademicCap className="w-5 h-5 sm:w-6 sm:h-6" />}
                        iconTone="from-orange-50 to-orange-100 text-orange-600"
                    />
                </div>

                <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 lg:grid-cols-4 sm:overflow-visible">
                    <DpStatCard
                        title="Professores"
                        value={estatisticas.total_professores.toLocaleString()}
                        icon={<Icons.Users className="w-5 h-5" />}
                        iconTone="from-purple-50 to-purple-100 text-purple-600"
                    />
                    <DpStatCard
                        title="Turmas"
                        value={estatisticas.total_turmas.toLocaleString()}
                        icon={<Icons.ClipboardList className="w-5 h-5" />}
                        iconTone="from-teal-50 to-teal-100 text-teal-600"
                    />
                    <DpStatCard
                        title="Circulares"
                        value={estatsCirculares.publicadas}
                        icon={<Icons.DocumentText className="w-5 h-5" />}
                        iconTone="from-pink-50 to-pink-100 text-pink-600"
                        subtitle={`${estatsCirculares.rascunhos} rascunhos`}
                        onClick={() => onNavigate?.('provincial-circulares')}
                    />
                </div>

                <div>
                    <DpSectionTitle>Acções Rápidas</DpSectionTitle>
                    <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 lg:grid-cols-5 sm:overflow-visible">
                        <DpQuickAction
                            label="Direções"
                            icon={<Icons.Building className="w-6 h-6" />}
                            iconTone="from-blue-50 to-blue-100 text-blue-600"
                            onClick={() => onNavigate?.('provincial-direcoes-municipais')}
                        />
                        <DpQuickAction
                            label="Escolas"
                            icon={<Icons.School className="w-6 h-6" />}
                            iconTone="from-emerald-50 to-emerald-100 text-emerald-600"
                            onClick={() => onNavigate?.('provincial-escolas')}
                        />
                        <DpQuickAction
                            label="Supervisão"
                            icon={<Icons.TrendingUp className="w-6 h-6" />}
                            iconTone="from-amber-50 to-amber-100 text-amber-600"
                            onClick={() => onNavigate?.('provincial-supervisao')}
                        />
                        <DpQuickAction
                            label="Circulares"
                            icon={<Icons.DocumentText className="w-6 h-6" />}
                            iconTone="from-pink-50 to-pink-100 text-pink-600"
                            onClick={() => onNavigate?.('provincial-circulares')}
                        />
                        <DpQuickAction
                            label="Relatórios"
                            icon={<Icons.BarChart className="w-6 h-6" />}
                            iconTone="from-indigo-50 to-indigo-100 text-indigo-600"
                            onClick={() => onNavigate?.('provincial-relatorios')}
                        />
                    </div>
                </div>

                {direcoesInactivas.length > 0 && (
                    <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-orange-50/80 to-white p-4 sm:p-5 shadow-sm">
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                                <Icons.ExclamationCircle className="w-5 h-5 text-amber-600" />
                            </div>
                            <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                                Alertas ({direcoesInactivas.length})
                            </h2>
                        </div>
                        <div className="space-y-2">
                            {direcoesInactivas.slice(0, 3).map(direcao => (
                                <div
                                    key={direcao.id}
                                    className="flex items-center justify-between gap-3 p-3 bg-white/80 rounded-xl border border-amber-100/80"
                                >
                                    <div className="min-w-0">
                                        <p className="font-medium text-slate-800 truncate">{direcao.municipio}</p>
                                        <p className="text-sm text-slate-500 truncate">{direcao.nome}</p>
                                    </div>
                                    <DpBadge tone="danger">Inactiva</DpBadge>
                                </div>
                            ))}
                        </div>
                        {direcoesInactivas.length > 3 && (
                            <button
                                type="button"
                                onClick={() => onNavigate?.('provincial-direcoes-municipais')}
                                className="mt-3 text-sm font-semibold text-amber-700 hover:text-amber-800 inline-flex items-center gap-1"
                            >
                                Ver mais {direcoesInactivas.length - 3} alertas
                                <Icons.ChevronRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}

                <div>
                    <DpSectionTitle
                        action={
                            <button
                                type="button"
                                onClick={() => onNavigate?.('provincial-direcoes-municipais')}
                                className="text-sm font-semibold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
                            >
                                Ver todas
                                <Icons.ChevronRight className="w-4 h-4" />
                            </button>
                        }
                    >
                        Direções Municipais
                    </DpSectionTitle>

                    <div className="space-y-3 md:hidden">
                        {direcoes.slice(0, 5).map(direcao => (
                            <DirectionCard
                                key={direcao.id}
                                municipio={direcao.municipio}
                                nome={direcao.nome}
                                escolas_count={direcao.escolas_count}
                                ativo={direcao.ativo}
                                onClick={() => onNavigate?.('provincial-direcoes-municipais')}
                            />
                        ))}
                    </div>

                    <DpPanel padding={false} className="hidden md:block">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50/80">
                                <tr>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Município
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Director
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Escolas
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Estado
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {direcoes.slice(0, 5).map(direcao => (
                                    <tr key={direcao.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <span className="font-semibold text-slate-900">{direcao.municipio}</span>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <div>
                                                <p className="text-slate-900">{direcao.nome}</p>
                                                <p className="text-sm text-slate-500">{direcao.email}</p>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap text-slate-700 tabular-nums">
                                            {direcao.escolas_count}
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <DpBadge tone={direcao.ativo ? 'success' : 'danger'}>
                                                {direcao.ativo ? 'Activa' : 'Inactiva'}
                                            </DpBadge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </DpPanel>
                </div>
            </DpContent>
        </DpPage>
    );
};

export default DirecaoProvincialDashboard;
