/**
 * Municipal Directorates Management Component
 * For provincial-level management of municipal directorates
 * Mobile-first design with cards, bottom sheet actions, and full-screen modals
 */

import React, { useState } from 'react';
import { Icons } from '../../../components/ui/Icons';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { useDirecoesMunicipais } from '../hooks/useDirecoesMunicipais';
import type {
    DirecaoMunicipalResumida,
    DirecaoMunicipalDetalhes,
    HistoricoAdministrativoDirecaoMunicipal
} from '../types';
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
    DpModalFooter,
    DpConfirmModal,
    DpFormSection,
    DpButton,
    DpInput,
    DpTextarea,
} from './ProvincialChrome';

const SearchFilterBar: React.FC<{
    searchTerm: string;
    onSearchChange: (value: string) => void;
    filterActivo: boolean | null;
    onFilterChange: (value: boolean | null) => void;
}> = ({ searchTerm, onSearchChange, filterActivo, onFilterChange }) => (
    <div className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-md pb-3 -mx-4 px-4 pt-2 md:mx-0 md:px-0 md:bg-transparent md:backdrop-blur-none">
        <DpSearch
            value={searchTerm}
            onChange={onSearchChange}
            placeholder="Pesquisar direção..."
            className="mb-3"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
            {[
                { label: 'Todas', value: null as boolean | null },
                { label: 'Activas', value: true },
                { label: 'Inactivas', value: false },
            ].map((filter) => (
                <DpChip
                    key={String(filter.value)}
                    label={filter.label}
                    active={filterActivo === filter.value}
                    onClick={() => onFilterChange(filter.value)}
                />
            ))}
        </div>
    </div>
);

const DirectionCard: React.FC<{
    direcao: DirecaoMunicipalResumida;
    onOpenActions: () => void;
}> = ({ direcao, onOpenActions }) => (
    <DpPanel padding={false}>
        <div className="p-4">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                    <Icons.Building className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-slate-900 truncate tracking-tight">{direcao.municipio}</h3>
                        <DpBadge tone={direcao.ativo ? 'success' : 'danger'}>
                            {direcao.ativo ? 'Activa' : 'Inactiva'}
                        </DpBadge>
                    </div>
                    <p className="text-sm text-slate-600 truncate mt-0.5">{direcao.nome}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                            <Icons.School className="w-4 h-4" />
                            {direcao.escolas_count} escolas
                        </span>
                        {direcao.telefone && (
                            <span className="flex items-center gap-1">
                                <Icons.Phone className="w-4 h-4" />
                                {direcao.telefone}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
        <div className="flex items-center border-t border-slate-100">
            <button
                type="button"
                onClick={onOpenActions}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors min-h-[48px]"
            >
                <Icons.EyeOpen className="w-4 h-4" />
                Ver Opções
            </button>
        </div>
    </DpPanel>
);

const StatsBar: React.FC<{
    total: number;
    activas: number;
    suspensas: number;
    inactivas: number;
}> = ({ total, activas, suspensas, inactivas }) => (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4 md:gap-3">
        <DpMetricPill label="Total" value={total} tone="neutral" />
        <DpMetricPill label="Activas" value={activas} tone="success" />
        <DpMetricPill label="Suspensas" value={suspensas} tone="warning" />
        <DpMetricPill label="Inactivas" value={inactivas} tone="danger" />
    </div>
);

export const DirecoesMunicipaisGestao: React.FC = () => {
    const {
        direcoes,
        loading,
        error,
        refresh,
        fetchDetalhes,
        suspender,
        reativar,
        fetchHistorico,
        estatisticas
    } = useDirecoesMunicipais();

    const [searchTerm, setSearchTerm] = useState('');
    const [filterActivo, setFilterActivo] = useState<boolean | null>(null);

    // Bottom sheet for actions
    const [showActionsSheet, setShowActionsSheet] = useState(false);
    const [selectedDirecao, setSelectedDirecao] = useState<DirecaoMunicipalResumida | null>(null);

    // Modals
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showSuspendModal, setShowSuspendModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [direcaoDetalhes, setDirecaoDetalhes] = useState<DirecaoMunicipalDetalhes | null>(null);
    const [historico, setHistorico] = useState<HistoricoAdministrativoDirecaoMunicipal[]>([]);
    const [suspensionMotivo, setSuspensionMotivo] = useState('');
    const [suspensionObservacoes, setSuspensionObservacoes] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [showReactivateModal, setShowReactivateModal] = useState(false);

    // Filter directions
    const filteredDirecoes = direcoes.filter(d => {
        const matchesSearch = searchTerm === '' ||
            d.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.municipio.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.email.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesFilter = filterActivo === null || d.ativo === filterActivo;

        return matchesSearch && matchesFilter;
    });

    // Handlers
    const handleOpenActions = (direcao: DirecaoMunicipalResumida) => {
        setSelectedDirecao(direcao);
        setShowActionsSheet(true);
    };

    const handleViewDetails = async () => {
        if (!selectedDirecao) return;
        setShowActionsSheet(false);
        setShowDetailsModal(true);
        const detalhes = await fetchDetalhes(selectedDirecao.id);
        setDirecaoDetalhes(detalhes);
    };

    const handleViewHistory = async () => {
        if (!selectedDirecao) return;
        setShowActionsSheet(false);
        const hist = await fetchHistorico(selectedDirecao.id);
        setHistorico(hist);
        setShowHistoryModal(true);
    };

    const handleOpenSuspend = () => {
        setShowActionsSheet(false);
        setSuspensionMotivo('');
        setSuspensionObservacoes('');
        setShowSuspendModal(true);
    };

    const handleSuspend = async () => {
        if (!selectedDirecao || !suspensionMotivo) return;

        try {
            setActionLoading(true);
            await suspender(selectedDirecao.id, suspensionMotivo, suspensionObservacoes);
            setShowSuspendModal(false);
            setSelectedDirecao(null);
        } catch (err) {
            console.error('Error suspending:', err);
            alert('Erro ao suspender direção municipal');
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenReactivate = () => {
        setShowActionsSheet(false);
        setShowReactivateModal(true);
    };

    const handleReactivate = async () => {
        if (!selectedDirecao) return;

        try {
            setActionLoading(true);
            await reativar(selectedDirecao.id, 'Reativação manual');
            setShowReactivateModal(false);
            setSelectedDirecao(null);
        } catch (err) {
            console.error('Error reactivating:', err);
            alert('Erro ao reativar direção municipal');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return <DpLoading label="A carregar direções municipais..." />;
    }

    return (
        <DpPage>
            <DpHeader
                title="Direções Municipais"
                subtitle="Gerencie as direções da sua província"
                icon={<Icons.Building />}
                accent="blue"
            />

            <DpContent>
                <StatsBar
                    total={estatisticas.total}
                    activas={estatisticas.activas}
                    suspensas={estatisticas.suspensas}
                    inactivas={estatisticas.inactivas}
                />

                <SearchFilterBar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    filterActivo={filterActivo}
                    onFilterChange={setFilterActivo}
                />

                {error && <DpAlert>{error}</DpAlert>}

                <div className="space-y-3 md:hidden pb-2">
                    {filteredDirecoes.map(direcao => (
                        <DirectionCard
                            key={direcao.id}
                            direcao={direcao}
                            onOpenActions={() => handleOpenActions(direcao)}
                        />
                    ))}
                    {filteredDirecoes.length === 0 && (
                        <DpEmpty
                            icon={<Icons.Building />}
                            title="Nenhuma direção encontrada"
                            description="Ajuste a pesquisa ou os filtros para ver resultados."
                        />
                    )}
                </div>

                <DpPanel padding={false} className="hidden md:block">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50/80">
                            <tr>
                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Município</th>
                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Director</th>
                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Contacto</th>
                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Escolas</th>
                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Acções</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredDirecoes.map(direcao => (
                                <tr key={direcao.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                                                <Icons.Building className="w-4 h-4 text-indigo-600" />
                                            </div>
                                            <span className="font-semibold text-slate-900">{direcao.municipio}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap text-slate-700">{direcao.nome}</td>
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <div>
                                            <p className="text-slate-700">{direcao.email}</p>
                                            {direcao.telefone && (
                                                <p className="text-sm text-slate-400">{direcao.telefone}</p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap text-slate-700 tabular-nums">{direcao.escolas_count}</td>
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <DpBadge tone={direcao.ativo ? 'success' : 'danger'}>
                                            {direcao.ativo ? 'Activa' : 'Inactiva'}
                                        </DpBadge>
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedDirecao(direcao);
                                                    handleViewDetails();
                                                }}
                                                className="p-2.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                                                title="Ver detalhes"
                                            >
                                                <Icons.EyeOpen className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    setSelectedDirecao(direcao);
                                                    const hist = await fetchHistorico(direcao.id);
                                                    setHistorico(hist);
                                                    setShowHistoryModal(true);
                                                }}
                                                className="p-2.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                                                title="Ver histórico"
                                            >
                                                <Icons.History className="w-4 h-4" />
                                            </button>
                                            {direcao.ativo ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedDirecao(direcao);
                                                        handleOpenSuspend();
                                                    }}
                                                    className="p-2.5 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                                                    title="Suspender"
                                                >
                                                    <Icons.Pause className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedDirecao(direcao);
                                                        setShowReactivateModal(true);
                                                    }}
                                                    disabled={actionLoading}
                                                    className="p-2.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors disabled:opacity-50 min-w-[40px] min-h-[40px] flex items-center justify-center"
                                                    title="Reativar"
                                                >
                                                    <Icons.Play className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredDirecoes.length === 0 && (
                        <div className="text-center py-12 text-slate-500 text-sm">
                            Nenhuma direção municipal encontrada
                        </div>
                    )}
                </DpPanel>
            </DpContent>

            {/* Bottom Sheet for Actions (Mobile) */}
            <BottomSheet
                isOpen={showActionsSheet}
                onClose={() => setShowActionsSheet(false)}
                title={selectedDirecao?.municipio}
                actions={[
                    {
                        label: 'Ver Detalhes',
                        icon: <Icons.EyeOpen className="w-5 h-5" />,
                        onClick: handleViewDetails,
                        description: 'Informações completas da direção',
                    },
                    {
                        label: 'Ver Histórico',
                        icon: <Icons.History className="w-5 h-5" />,
                        onClick: handleViewHistory,
                        description: 'Histórico de alterações',
                    },
                    ...(selectedDirecao?.ativo ? [{
                        label: 'Suspender Direção',
                        icon: <Icons.Pause className="w-5 h-5" />,
                        onClick: handleOpenSuspend,
                        variant: 'danger' as const,
                        description: 'Suspender temporariamente',
                    }] : [{
                        label: 'Reativar Direção',
                        icon: <Icons.Play className="w-5 h-5" />,
                        onClick: handleOpenReactivate,
                        variant: 'success' as const,
                        description: 'Restaurar funcionamento',
                    }]),
                ]}
            />

            <DpModal
                isOpen={showDetailsModal}
                onClose={() => {
                    setShowDetailsModal(false)
                    setDirecaoDetalhes(null)
                }}
                title={`Detalhes — ${selectedDirecao?.municipio || ''}`}
                subtitle="Informação da direção municipal"
                icon={<Icons.Building />}
                accent="blue"
                size="lg"
                badge={
                    selectedDirecao ? (
                        <DpBadge tone={selectedDirecao.ativo ? 'success' : 'warning'}>
                            {selectedDirecao.ativo ? 'Activa' : 'Suspensa'}
                        </DpBadge>
                    ) : undefined
                }
            >
                {direcaoDetalhes ? (
                    <div className="space-y-4">
                        <DpFormSection title="Identificação" description="Dados institucionais e de contacto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {[
                                    { label: 'Município', value: direcaoDetalhes.municipio },
                                    { label: 'Província', value: direcaoDetalhes.provincia },
                                    { label: 'Director', value: direcaoDetalhes.nome },
                                    { label: 'Cargo', value: direcaoDetalhes.cargo || 'N/A' },
                                    { label: 'Email', value: direcaoDetalhes.email },
                                    { label: 'Telefone', value: direcaoDetalhes.telefone || 'N/A' },
                                ].map((item) => (
                                    <div
                                        key={item.label}
                                        className="rounded-xl bg-white/70 border border-slate-100 px-3 py-2.5"
                                    >
                                        <p className="text-xs text-slate-500 font-medium">{item.label}</p>
                                        <p className="text-slate-900 mt-0.5 text-sm font-medium break-words">
                                            {item.value}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </DpFormSection>

                        <DpFormSection title="Estatísticas" description="Indicadores sob gestão desta direção">
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    {
                                        icon: <Icons.School className="w-5 h-5 text-blue-600" />,
                                        value: direcaoDetalhes.total_escolas,
                                        label: 'Escolas',
                                        bg: 'bg-blue-50 border-blue-100',
                                    },
                                    {
                                        icon: <Icons.Users className="w-5 h-5 text-violet-600" />,
                                        value: direcaoDetalhes.total_professores,
                                        label: 'Professores',
                                        bg: 'bg-violet-50 border-violet-100',
                                    },
                                    {
                                        icon: <Icons.AcademicCap className="w-5 h-5 text-emerald-600" />,
                                        value: direcaoDetalhes.total_alunos,
                                        label: 'Alunos',
                                        bg: 'bg-emerald-50 border-emerald-100',
                                    },
                                ].map((stat) => (
                                    <div
                                        key={stat.label}
                                        className={`${stat.bg} border rounded-xl p-3 text-center transition-transform hover:scale-[1.02]`}
                                    >
                                        <div className="flex justify-center mb-1">{stat.icon}</div>
                                        <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                                        <p className="text-xs text-slate-500">{stat.label}</p>
                                    </div>
                                ))}
                            </div>
                        </DpFormSection>
                    </div>
                ) : (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
                    </div>
                )}
            </DpModal>

            <DpModal
                isOpen={showSuspendModal}
                onClose={() => {
                    if (!actionLoading) setShowSuspendModal(false)
                }}
                title="Suspender Direção"
                subtitle={selectedDirecao?.municipio}
                icon={<Icons.Pause />}
                accent="amber"
                busy={actionLoading}
                badge={<DpBadge tone="warning">Suspensão</DpBadge>}
                footer={
                    <DpModalFooter>
                        <DpButton
                            variant="secondary"
                            onClick={() => setShowSuspendModal(false)}
                            disabled={actionLoading}
                            className="sm:min-w-[7.5rem]"
                        >
                            Cancelar
                        </DpButton>
                        <DpButton
                            variant="warning"
                            onClick={handleSuspend}
                            disabled={actionLoading || !suspensionMotivo}
                            className="sm:min-w-[8rem]"
                        >
                            {actionLoading ? 'A suspender…' : 'Suspender'}
                        </DpButton>
                    </DpModalFooter>
                }
            >
                <div className="space-y-4">
                    <DpAlert tone="warning">
                        Está prestes a suspender a direção municipal de{' '}
                        <strong>{selectedDirecao?.municipio}</strong>. Esta acção será registada no
                        histórico.
                    </DpAlert>

                    <DpFormSection title="Justificação" description="Motivo obrigatório e observações">
                        <DpInput
                            label="Motivo da suspensão"
                            required
                            value={suspensionMotivo}
                            onChange={(e) => setSuspensionMotivo(e.target.value)}
                            placeholder="Indique o motivo..."
                        />
                        <DpTextarea
                            label="Observações (opcional)"
                            value={suspensionObservacoes}
                            onChange={(e) => setSuspensionObservacoes(e.target.value)}
                            placeholder="Observações adicionais..."
                            rows={3}
                        />
                    </DpFormSection>
                </div>
            </DpModal>

            <DpConfirmModal
                isOpen={showReactivateModal}
                onClose={() => setShowReactivateModal(false)}
                onConfirm={handleReactivate}
                title="Reativar Direção"
                message={`Tem a certeza que deseja reativar a direção municipal de ${selectedDirecao?.municipio || ''}?`}
                confirmText="Reativar"
                cancelText="Cancelar"
                variant="info"
                loading={actionLoading}
            />

            <DpModal
                isOpen={showHistoryModal}
                onClose={() => setShowHistoryModal(false)}
                title={`Histórico — ${selectedDirecao?.municipio || ''}`}
                subtitle="Alterações administrativas"
                icon={<Icons.History />}
                accent="slate"
                badge={<DpBadge tone="neutral">Auditoria</DpBadge>}
            >
                {historico.length > 0 ? (
                    <div className="space-y-3">
                        {historico.map((entry) => (
                            <div
                                key={entry.id}
                                className="relative rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 p-3.5 pl-4 border-l-4 border-l-primary-400 shadow-sm transition-shadow hover:shadow-md"
                            >
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <span
                                        className={`
                                        px-2.5 py-1 text-xs font-medium rounded-lg
                                        ${
                                            entry.estado_novo === 'activa'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : entry.estado_novo === 'suspensa'
                                                  ? 'bg-amber-100 text-amber-700'
                                                  : 'bg-red-100 text-red-700'
                                        }
                                    `}
                                    >
                                        {entry.estado_anterior || 'N/A'} → {entry.estado_novo}
                                    </span>
                                    <span className="text-xs text-slate-500 font-medium">
                                        {new Date(entry.created_at).toLocaleDateString('pt-AO')}
                                    </span>
                                </div>
                                {entry.motivo && (
                                    <p className="text-slate-700 mt-2 text-sm">{entry.motivo}</p>
                                )}
                                {entry.observacoes && (
                                    <p className="text-slate-500 text-sm mt-1">{entry.observacoes}</p>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10 text-slate-500">
                        <Icons.History className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                        <p className="font-medium text-slate-600">Nenhum histórico registado</p>
                        <p className="text-sm mt-1">As alterações administrativas aparecerão aqui.</p>
                    </div>
                )}
            </DpModal>
        </DpPage>
    );
};

export default DirecoesMunicipaisGestao;
