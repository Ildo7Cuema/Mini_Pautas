/**
 * Provincial Reports Page
 * Generate and export consolidated reports
 * Mobile-first design with summarized view and clear export feedback
 */

import React, { useState } from 'react';
import { Icons } from '../../../components/ui/Icons';
import { useRelatoriosProvinciais } from '../hooks/useRelatoriosProvinciais';
import type { RelatorioConsolidadoProvincia } from '../types';
import {
    DpPage,
    DpContent,
    DpHeader,
    DpPanel,
    DpButton,
    DpSelect,
    DpEmpty,
    DpAlert,
    DpSectionTitle,
} from './ProvincialChrome';

const MunicipioCard: React.FC<{
    municipio: string;
    total_alunos: number;
    taxa_aprovacao: number;
}> = ({ municipio, total_alunos, taxa_aprovacao }) => (
    <DpPanel className="!p-4">
        <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate tracking-tight">{municipio}</p>
                <p className="text-sm text-slate-500 mt-0.5">{total_alunos.toLocaleString()} alunos</p>
            </div>
            <div className="text-right flex-shrink-0">
                <p className={`text-xl font-bold tabular-nums ${taxa_aprovacao >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {taxa_aprovacao.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-400">aprovação</p>
            </div>
        </div>
    </DpPanel>
);

export const RelatoriosProvinciaisPage: React.FC = () => {
    const {
        loading,
        loadingExport,
        error,
        gerarRelatorioConsolidado,
        exportarRelatorioCSV,
        exportarRelatorioJSON
    } = useRelatoriosProvinciais();

    const [trimestre, setTrimestre] = useState<1 | 2 | 3 | undefined>(undefined);
    const [anoLectivo, setAnoLectivo] = useState(new Date().getFullYear().toString());
    const [relatorio, setRelatorio] = useState<RelatorioConsolidadoProvincia | null>(null);
    const [exportSuccess, setExportSuccess] = useState<string | null>(null);

    const handleGerarRelatorio = async () => {
        try {
            const dados = await gerarRelatorioConsolidado(anoLectivo, trimestre);
            setRelatorio(dados);
        } catch (err) {
            console.error('Error generating report:', err);
        }
    };

    const handleExportCSV = async () => {
        if (!relatorio) return;
        try {
            await exportarRelatorioCSV(relatorio);
            setExportSuccess('CSV exportado com sucesso!');
            setTimeout(() => setExportSuccess(null), 3000);
        } catch (err) {
            console.error('Error exporting CSV:', err);
        }
    };

    const handleExportJSON = async () => {
        if (!relatorio) return;
        try {
            await exportarRelatorioJSON(relatorio);
            setExportSuccess('JSON exportado com sucesso!');
            setTimeout(() => setExportSuccess(null), 3000);
        } catch (err) {
            console.error('Error exporting JSON:', err);
        }
    };

    return (
        <DpPage>
            <DpHeader
                title="Relatórios"
                subtitle="Gere e exporte relatórios consolidados da província"
                icon={<Icons.BarChart />}
                accent="indigo"
            />

            <DpContent className="space-y-4">
                <DpPanel className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <DpSelect
                            label="Ano Lectivo"
                            value={anoLectivo}
                            onChange={(e) => setAnoLectivo(e.target.value)}
                        >
                            <option value="">Todos</option>
                            <option value="2024">2024</option>
                            <option value="2024/2025">2024/2025</option>
                            <option value="2025">2025</option>
                            <option value="2025/2026">2025/2026</option>
                            <option value="2026">2026</option>
                        </DpSelect>
                        <DpSelect
                            label="Trimestre"
                            value={trimestre || ''}
                            onChange={(e) => setTrimestre(e.target.value ? Number(e.target.value) as 1 | 2 | 3 : undefined)}
                        >
                            <option value="">Todo o Ano</option>
                            <option value="1">1º Trimestre</option>
                            <option value="2">2º Trimestre</option>
                            <option value="3">3º Trimestre</option>
                        </DpSelect>
                    </div>

                    <DpButton
                        fullWidth
                        onClick={handleGerarRelatorio}
                        disabled={loading}
                        icon={<Icons.Refresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />}
                    >
                        {loading ? 'A gerar...' : 'Gerar Relatório'}
                    </DpButton>
                </DpPanel>

                {error && <DpAlert>{error}</DpAlert>}

                {exportSuccess && (
                    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-auto bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-slide-up z-50">
                        <Icons.CheckCircle className="w-5 h-5" />
                        {exportSuccess}
                    </div>
                )}

                {relatorio && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-md py-3 -mx-4 px-4 sm:mx-0 sm:px-0 sm:static sm:bg-transparent sm:backdrop-blur-none">
                            <div className="flex gap-2">
                                <DpButton
                                    variant="success"
                                    fullWidth
                                    onClick={handleExportCSV}
                                    disabled={loadingExport}
                                    icon={<Icons.FileSpreadsheet className="w-4 h-4" />}
                                >
                                    CSV
                                </DpButton>
                                <DpButton
                                    variant="secondary"
                                    fullWidth
                                    onClick={handleExportJSON}
                                    disabled={loadingExport}
                                    icon={<Icons.FileJson className="w-4 h-4" />}
                                    className="!bg-slate-800 !text-white !border-slate-800 hover:!bg-slate-900"
                                >
                                    JSON
                                </DpButton>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {[
                                { label: 'Escolas', value: relatorio.estatisticas_gerais.total_escolas },
                                { label: 'Alunos', value: relatorio.estatisticas_gerais.total_alunos.toLocaleString() },
                                { label: 'Professores', value: relatorio.estatisticas_gerais.total_professores.toLocaleString() },
                                { label: 'Aprovação', value: `${relatorio.estatisticas_gerais.taxa_aprovacao_media.toFixed(1)}%`, accent: true },
                            ].map((stat) => (
                                <DpPanel key={stat.label} className="!p-4">
                                    <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
                                    <p className={`text-2xl sm:text-3xl font-bold mt-1 tabular-nums tracking-tight ${stat.accent ? 'text-emerald-600' : 'text-slate-900'}`}>
                                        {stat.value}
                                    </p>
                                </DpPanel>
                            ))}
                        </div>

                        <div>
                            <DpSectionTitle icon={<Icons.BarChart />}>
                                Por Município
                            </DpSectionTitle>
                            <div className="space-y-3">
                                {relatorio.dados_por_municipio.map(mun => (
                                    <MunicipioCard
                                        key={mun.municipio}
                                        municipio={mun.municipio}
                                        total_alunos={mun.total_alunos}
                                        taxa_aprovacao={mun.taxa_aprovacao}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-4 bg-red-50 rounded-2xl border border-red-200/70">
                                <p className="text-xs font-medium text-red-700">Inactivas</p>
                                <p className="text-2xl font-bold text-red-700 mt-1 tabular-nums">{relatorio.estatisticas_gerais.escolas_inactivas}</p>
                            </div>
                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/70">
                                <p className="text-xs font-medium text-amber-700">Bloqueadas</p>
                                <p className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">{relatorio.estatisticas_gerais.escolas_bloqueadas}</p>
                            </div>
                        </div>

                        <p className="text-center text-xs text-slate-400 pt-2">
                            Gerado em {new Date(relatorio.data_geracao).toLocaleString('pt-AO')}
                        </p>
                    </div>
                )}

                {!relatorio && !loading && (
                    <DpEmpty
                        icon={<Icons.DocumentText />}
                        title="Nenhum relatório"
                        description="Seleccione as opções e gere o relatório consolidado."
                    />
                )}
            </DpContent>
        </DpPage>
    );
};

export default RelatoriosProvinciaisPage;
