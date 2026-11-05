/**
 * Provincial Schools Overview Component
 * Read-only view of all schools in the province
 * Mobile-first design with cards, filter drawer, and full-screen modals
 */

import React, { useState } from 'react';
import { Icons } from '../../../components/ui/Icons';
import { FilterDrawer } from '../../../components/ui/FilterDrawer';
import { useEscolasProvincial } from '../hooks/useEscolasProvincial';
import type { Escola } from '../../../types';
import { fetchEscolaDetalhesProvincial } from '../api/escolasProvincialQuery';
import {
    DpPage,
    DpContent,
    DpHeader,
    DpSearch,
    DpChip,
    DpBadge,
    DpPanel,
    DpMetricPill,
    DpEmpty,
    DpLoading,
    DpAlert,
    DpModal,
} from './ProvincialChrome';

const SchoolCard: React.FC<{
    escola: Escola;
    onClick: () => void;
}> = ({ escola, onClick }) => {
    const tone = escola.bloqueado ? 'warning' : escola.ativo ? 'success' : 'danger';
    const label = escola.bloqueado ? 'Bloqueada' : escola.ativo ? 'Activa' : 'Inactiva';

    return (
        <button
            type="button"
            onClick={onClick}
            className="
                w-full bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/70
                shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 text-left
                transition-all hover:shadow-md hover:border-slate-300/80 active:scale-[0.98]
            "
        >
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
                    <Icons.School className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-slate-900 truncate tracking-tight">{escola.nome}</h3>
                        <DpBadge tone={tone}>{label}</DpBadge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                        <Icons.LocationMarker className="w-4 h-4" />
                        <span className="truncate">{escola.municipio}</span>
                    </div>
                    {escola.codigo_escola && (
                        <p className="text-xs text-slate-400 mt-1">Código: {escola.codigo_escola}</p>
                    )}
                </div>
            </div>
        </button>
    );
};

const StatsBar: React.FC<{
    total: number;
    activas: number;
    bloqueadas: number;
    inactivas: number;
}> = ({ total, activas, bloqueadas, inactivas }) => (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 sm:gap-3">
        <DpMetricPill label="Total" value={total} tone="neutral" />
        <DpMetricPill label="Activas" value={activas} tone="success" />
        <DpMetricPill label="Bloqueadas" value={bloqueadas} tone="warning" />
        <DpMetricPill label="Inactivas" value={inactivas} tone="danger" />
    </div>
);

export const EscolasProvincialOverview: React.FC = () => {
    const {
        escolas,
        escolasAgrupadas,
        loading,
        error,
        filtros,
        setFiltros,
        estatisticas,
        municipios
    } = useEscolasProvincial();

    const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');
    const [showFilterDrawer, setShowFilterDrawer] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedEscola, setSelectedEscola] = useState<Escola | null>(null);
    const [escolaDetalhes, setEscolaDetalhes] = useState<{
        escola: Escola;
        total_professores: number;
        total_turmas: number;
        total_alunos: number;
    } | null>(null);
    const [loadingDetalhes, setLoadingDetalhes] = useState(false);

    // Filter state
    const [filterValues, setFilterValues] = useState<Record<string, string | boolean | null>>({
        municipio: filtros.municipio || null,
        status: null,
    });

    const handleViewDetails = async (escola: Escola) => {
        setSelectedEscola(escola);
        setShowDetailsModal(true);
        setLoadingDetalhes(true);
        try {
            const detalhes = await fetchEscolaDetalhesProvincial(escola.id);
            setEscolaDetalhes(detalhes);
        } catch (err) {
            console.error('Error fetching school details:', err);
        } finally {
            setLoadingDetalhes(false);
        }
    };

    const handleApplyFilters = () => {
        const newFiltros = { ...filtros };

        if (filterValues.municipio) {
            newFiltros.municipio = filterValues.municipio as string;
        } else {
            newFiltros.municipio = undefined;
        }

        if (filterValues.status === 'activa') {
            newFiltros.ativo = true;
            newFiltros.bloqueado = false;
        } else if (filterValues.status === 'bloqueada') {
            newFiltros.bloqueado = true;
            newFiltros.ativo = undefined;
        } else if (filterValues.status === 'inactiva') {
            newFiltros.ativo = false;
            newFiltros.bloqueado = undefined;
        } else {
            newFiltros.ativo = undefined;
            newFiltros.bloqueado = undefined;
        }

        setFiltros(newFiltros);
    };

    const handleClearFilters = () => {
        setFilterValues({ municipio: null, status: null });
        setFiltros({ search: filtros.search });
    };

    const activeFiltersCount = [
        filtros.municipio,
        filtros.ativo !== undefined || filtros.bloqueado !== undefined
    ].filter(Boolean).length;

    if (loading) {
        return <DpLoading label="A carregar escolas..." />;
    }

    return (
        <DpPage>
            <DpHeader
                title="Escolas"
                subtitle="Consulta consolidada da província (somente leitura)"
                icon={<Icons.School />}
                accent="emerald"
                actions={
                    <DpBadge tone="info">
                        <span className="inline-flex items-center gap-1">
                            <Icons.EyeOpen className="w-3.5 h-3.5" />
                            Leitura
                        </span>
                    </DpBadge>
                }
            />

            <DpContent>
                <StatsBar
                    total={estatisticas.total_escolas}
                    activas={estatisticas.escolas_activas}
                    bloqueadas={estatisticas.escolas_bloqueadas}
                    inactivas={estatisticas.escolas_inactivas}
                />

                <div className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-md pb-3 -mx-4 px-4 pt-2 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none">
                    <div className="flex gap-2">
                        <DpSearch
                            value={filtros.search || ''}
                            onChange={(value) => setFiltros({ ...filtros, search: value })}
                            placeholder="Pesquisar escolas..."
                            className="flex-1"
                        />
                        <button
                            type="button"
                            onClick={() => setShowFilterDrawer(true)}
                            className="relative flex-shrink-0 p-3 bg-white border border-slate-200/80 rounded-xl hover:bg-slate-50 transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center shadow-sm"
                        >
                            <Icons.Filter className="w-5 h-5 text-slate-600" />
                            {activeFiltersCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                    {activeFiltersCount}
                                </span>
                            )}
                        </button>
                    </div>

                    <div className="flex gap-2 mt-3">
                        {[
                            { id: 'list', label: 'Lista' },
                            { id: 'grouped', label: 'Por Município' },
                        ].map((mode) => (
                            <DpChip
                                key={mode.id}
                                label={mode.label}
                                active={viewMode === mode.id}
                                onClick={() => setViewMode(mode.id as 'list' | 'grouped')}
                            />
                        ))}
                    </div>
                </div>

                {error && <DpAlert>{error}</DpAlert>}

                {/* Content */}
                {viewMode === 'list' ? (
                    <>
                        {/* Mobile: Cards */}
                        <div className="space-y-3 md:hidden">
                            {escolas.map((escola) => (
                                <SchoolCard key={escola.id} escola={escola} onClick={() => handleViewDetails(escola)} />
                            ))}
                        </div>

                        <DpPanel padding={false} className="hidden md:block">
                            <table className="min-w-full divide-y divide-slate-100">
                                <thead className="bg-slate-50/80">
                                    <tr>
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Escola</th>
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Município</th>
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Código</th>
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Acções</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {escolas.map((escola) => (
                                        <tr key={escola.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
                                                        <Icons.School className="w-4 h-4 text-emerald-600" />
                                                    </div>
                                                    <span className="font-semibold text-slate-900">{escola.nome}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-slate-600">{escola.municipio}</td>
                                            <td className="px-5 py-4 text-slate-500">{escola.codigo_escola || '-'}</td>
                                            <td className="px-5 py-4">
                                                <DpBadge tone={escola.bloqueado ? 'warning' : escola.ativo ? 'success' : 'danger'}>
                                                    {escola.bloqueado ? 'Bloqueada' : escola.ativo ? 'Activa' : 'Inactiva'}
                                                </DpBadge>
                                            </td>
                                            <td className="px-5 py-4">
                                                <button
                                                    type="button"
                                                    onClick={() => handleViewDetails(escola)}
                                                    className="p-2.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors"
                                                >
                                                    <Icons.EyeOpen className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </DpPanel>
                    </>
                ) : (
                    <div className="space-y-4">
                        {escolasAgrupadas.map((grupo) => (
                            <DpPanel key={grupo.municipio} padding={false}>
                                <div className="bg-gradient-to-r from-primary-600 to-indigo-600 px-4 py-3.5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 text-white min-w-0">
                                            <Icons.Building className="w-5 h-5 flex-shrink-0" />
                                            <h3 className="font-semibold truncate tracking-tight">{grupo.municipio}</h3>
                                        </div>
                                        <div className="flex items-center gap-2 text-white/85 text-sm flex-shrink-0">
                                            <span>{grupo.total} escolas</span>
                                            <span aria-hidden>•</span>
                                            <span>{grupo.activas} activas</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {grupo.escolas.map((escola) => (
                                        <SchoolCard key={escola.id} escola={escola} onClick={() => handleViewDetails(escola)} />
                                    ))}
                                </div>
                            </DpPanel>
                        ))}
                    </div>
                )}

                {escolas.length === 0 && (
                    <DpEmpty
                        icon={<Icons.School />}
                        title="Nenhuma escola encontrada"
                        description="Ajuste a pesquisa ou os filtros para ver resultados."
                    />
                )}
            </DpContent>

            {/* Filter Drawer */}
            <FilterDrawer
                isOpen={showFilterDrawer}
                onClose={() => setShowFilterDrawer(false)}
                title="Filtrar Escolas"
                filters={[
                    {
                        id: 'municipio',
                        label: 'Município',
                        value: filterValues.municipio,
                        options: [
                            { label: 'Todos', value: null },
                            ...municipios.map((m) => ({ label: m, value: m })),
                        ],
                    },
                    {
                        id: 'status',
                        label: 'Estado',
                        value: filterValues.status,
                        options: [
                            { label: 'Todos', value: null },
                            { label: 'Activas', value: 'activa' },
                            { label: 'Bloqueadas', value: 'bloqueada' },
                            { label: 'Inactivas', value: 'inactiva' },
                        ],
                    },
                ]}
                values={filterValues}
                onChange={(id, value) => setFilterValues({ ...filterValues, [id]: value })}
                onApply={handleApplyFilters}
                onClear={handleClearFilters}
            />

            <DpModal
                isOpen={showDetailsModal}
                onClose={() => {
                    setShowDetailsModal(false)
                    setEscolaDetalhes(null)
                }}
                title={selectedEscola?.nome || 'Detalhes da escola'}
                subtitle="Consulta provincial"
                icon={<Icons.School />}
                accent="emerald"
                size="lg"
                badge={
                    escolaDetalhes ? (
                        <DpBadge
                            tone={
                                escolaDetalhes.escola.bloqueado
                                    ? 'warning'
                                    : escolaDetalhes.escola.ativo
                                      ? 'success'
                                      : 'danger'
                            }
                        >
                            {escolaDetalhes.escola.bloqueado
                                ? 'Bloqueada'
                                : escolaDetalhes.escola.ativo
                                  ? 'Activa'
                                  : 'Inactiva'}
                        </DpBadge>
                    ) : undefined
                }
            >
                {loadingDetalhes ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
                    </div>
                ) : escolaDetalhes ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { label: 'Município', value: escolaDetalhes.escola.municipio },
                                { label: 'Província', value: escolaDetalhes.escola.provincia },
                                { label: 'Código', value: escolaDetalhes.escola.codigo_escola || 'N/A' },
                            ].map((item) => (
                                <div key={item.label}>
                                    <p className="text-sm text-slate-500 font-medium">{item.label}</p>
                                    <p className="text-slate-900">{item.value}</p>
                                </div>
                            ))}
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Estado</p>
                                <div className="mt-1">
                                    <DpBadge tone={escolaDetalhes.escola.bloqueado ? 'warning' : escolaDetalhes.escola.ativo ? 'success' : 'danger'}>
                                        {escolaDetalhes.escola.bloqueado ? 'Bloqueada' : escolaDetalhes.escola.ativo ? 'Activa' : 'Inactiva'}
                                    </DpBadge>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                            <h3 className="font-semibold text-slate-900 mb-3">Estatísticas</h3>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { icon: <Icons.Users className="w-5 h-5 text-blue-600" />, value: escolaDetalhes.total_professores, label: 'Professores', bg: 'bg-blue-50' },
                                    { icon: <Icons.AcademicCap className="w-5 h-5 text-emerald-600" />, value: escolaDetalhes.total_alunos, label: 'Alunos', bg: 'bg-emerald-50' },
                                    { icon: <Icons.Building className="w-5 h-5 text-purple-600" />, value: escolaDetalhes.total_turmas, label: 'Turmas', bg: 'bg-purple-50' },
                                ].map((stat) => (
                                    <div key={stat.label} className={`${stat.bg} rounded-xl p-3 text-center`}>
                                        <div className="flex justify-center mb-1">{stat.icon}</div>
                                        <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                                        <p className="text-xs text-slate-500">{stat.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                            <div className="flex items-start gap-2">
                                <Icons.Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <p>Esta é uma visão de consulta. A gestão desta escola é responsabilidade da Direção Municipal de {escolaDetalhes.escola.municipio}.</p>
                            </div>
                        </div>
                    </div>
                ) : null}
            </DpModal>
        </DpPage>
    );
};

export default EscolasProvincialOverview;
