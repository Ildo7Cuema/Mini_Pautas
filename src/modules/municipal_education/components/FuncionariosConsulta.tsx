/**
 * Funcionários Consulta Page
 * Comprehensive staff query page for Municipal Education Direction
 * Supports all staff categories with detailed filtering
 */

import { useState, type ReactNode } from 'react';
import { useFuncionarios } from '../hooks/useFuncionarios';
import type {
    CategoriaFuncionario,
    FuncionarioMunicipio,
    GrauAcademico,
    LABELS_GRAU_ACADEMICO,
    LABELS_CATEGORIA,
    LABELS_CATEGORIA_DOCENTE
} from '../types';
import { Icons } from '../../../components/ui/Icons';
import { TempoServicoReformaInfo } from '../../../components/TempoServicoReformaInfo';
import {
    DmPage,
    DmHeader,
    DmContent,
    DmButton,
    DmModal,
    DmModalFooter,
    DmBadge,
    DmFormSection,
} from './MunicipalChrome';

interface FuncionariosConsultaProps {
    onNavigate?: (page: string, params?: Record<string, any>) => void;
}

// Category styling
const categoriaStyles: Record<string, { bg: string; text: string; icon: string; accent: 'blue' | 'violet' | 'indigo' | 'emerald' | 'slate'; label: string }> = {
    'DOCENTE': { bg: 'bg-blue-100', text: 'text-blue-800', icon: '👨‍🏫', accent: 'blue', label: 'Docente' },
    'DIRECAO': { bg: 'bg-purple-100', text: 'text-purple-800', icon: '👔', accent: 'violet', label: 'Direcção' },
    'COORDENACAO': { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: '📋', accent: 'indigo', label: 'Coordenação' },
    'ADMINISTRATIVO': { bg: 'bg-green-100', text: 'text-green-800', icon: '📝', accent: 'emerald', label: 'Administrativo' },
    'APOIO': { bg: 'bg-gray-100', text: 'text-gray-800', icon: '🔧', accent: 'slate', label: 'Apoio' }
};

const avatarAccent: Record<string, string> = {
    DOCENTE: 'from-blue-500 to-sky-600 shadow-blue-500/30',
    DIRECAO: 'from-violet-500 to-purple-700 shadow-violet-500/30',
    COORDENACAO: 'from-indigo-500 to-indigo-700 shadow-indigo-500/30',
    ADMINISTRATIVO: 'from-emerald-500 to-teal-600 shadow-emerald-500/30',
    APOIO: 'from-slate-500 to-slate-700 shadow-slate-500/30',
};

function getInitials(nome: string): string {
    const parts = nome.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function DetailRow({
    icon,
    label,
    value,
}: {
    icon: ReactNode;
    label: string;
    value: ReactNode;
}) {
    return (
        <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0 last:pb-0 first:pt-0">
            <span className="mt-0.5 w-8 h-8 flex-shrink-0 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4">
                {icon}
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                <div className="mt-0.5 text-sm font-medium text-slate-800 break-words">{value || '—'}</div>
            </div>
        </div>
    );
}

// Academic degree labels
const grauLabels: Record<GrauAcademico, string> = {
    DOUTORADO: 'PhD',
    MESTRADO: 'Mestre',
    LICENCIATURA: 'Licenciado',
    BACHARELATO: 'Bacharel',
    TECNICO_MEDIO: 'Téc. Médio',
    TECNICO_BASICO: 'Téc. Básico',
    SEM_FORMACAO: 'S/ Formação'
};

function FuncionarioDetalhesModal({
    funcionario,
    onClose,
}: {
    funcionario: FuncionarioMunicipio | null;
    onClose: () => void;
}) {
    if (!funcionario) return null;

    const style = categoriaStyles[funcionario.tipo] || categoriaStyles.DOCENTE;
    const cargoLabel = funcionario.cargo || funcionario.subtipo || style.label;

    return (
        <DmModal
            isOpen={!!funcionario}
            onClose={onClose}
            title="Detalhes do Funcionário"
            subtitle={funcionario.escola_nome}
            icon={<Icons.User />}
            accent={style.accent}
            size="lg"
            badge={
                <DmBadge tone={funcionario.ativo ? 'success' : 'neutral'}>
                    {funcionario.ativo ? 'Activo' : 'Inactivo'}
                </DmBadge>
            }
            footer={
                <DmModalFooter>
                    <DmButton variant="secondary" onClick={onClose} fullWidth icon={<Icons.X />}>
                        Fechar
                    </DmButton>
                </DmModalFooter>
            }
        >
            <div className="space-y-4">
                <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-slate-100/80 p-4 sm:p-5">
                    <div
                        className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-slate-200/40 blur-2xl"
                        aria-hidden
                    />
                    <div className="relative flex items-start gap-3.5 sm:gap-4">
                        <div
                            className={`
                                w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 rounded-2xl
                                bg-gradient-to-br ${avatarAccent[funcionario.tipo] || avatarAccent.DOCENTE}
                                flex items-center justify-center
                                text-white text-lg sm:text-xl font-semibold tracking-tight
                                shadow-lg ring-2 ring-white/50
                            `}
                            aria-hidden
                        >
                            {getInitials(funcionario.nome_completo)}
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                            <h3 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight leading-snug">
                                {funcionario.nome_completo}
                            </h3>
                            <p className="mt-0.5 text-sm text-slate-500">{cargoLabel}</p>
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>
                                    <span aria-hidden>{style.icon}</span>
                                    {style.label}
                                </span>
                                {funcionario.tipo === 'DOCENTE' && funcionario.grau_academico && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                                        {grauLabels[funcionario.grau_academico]}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <DmFormSection title="Contacto e escola" description="Dados de contacto e vínculo escolar">
                    <DetailRow icon={<Icons.School />} label="Escola" value={funcionario.escola_nome} />
                    <DetailRow icon={<Icons.Email />} label="Email" value={funcionario.email || '—'} />
                    <DetailRow icon={<Icons.Phone />} label="Telefone" value={funcionario.telefone || '—'} />
                    <DetailRow icon={<Icons.Briefcase />} label="Categoria" value={style.label} />
                </DmFormSection>

                {(funcionario.tipo === 'DOCENTE' || funcionario.numero_funcionario) && (
                    <DmFormSection
                        title={funcionario.tipo === 'DOCENTE' ? 'Qualificação e identificação' : 'Identificação'}
                        description={
                            funcionario.tipo === 'DOCENTE'
                                ? 'Formação académica e número de agente'
                                : 'Número de funcionário'
                        }
                    >
                        {funcionario.tipo === 'DOCENTE' && (
                            <>
                                {funcionario.numero_agente && (
                                    <DetailRow icon={<Icons.Hash />} label="Nº Agente" value={funcionario.numero_agente} />
                                )}
                                {funcionario.grau_academico && (
                                    <DetailRow
                                        icon={<Icons.AcademicCap />}
                                        label="Grau académico"
                                        value={grauLabels[funcionario.grau_academico]}
                                    />
                                )}
                                {funcionario.area_formacao && (
                                    <DetailRow
                                        icon={<Icons.BookOpen />}
                                        label="Área de formação"
                                        value={funcionario.area_formacao}
                                    />
                                )}
                                {funcionario.especialidade && (
                                    <DetailRow
                                        icon={<Icons.Award />}
                                        label="Especialidade"
                                        value={funcionario.especialidade}
                                    />
                                )}
                            </>
                        )}
                        {funcionario.numero_funcionario && (
                            <DetailRow
                                icon={<Icons.Hash />}
                                label="Nº Funcionário"
                                value={funcionario.numero_funcionario}
                            />
                        )}
                    </DmFormSection>
                )}

                <TempoServicoReformaInfo
                    dataNascimento={funcionario.data_nascimento}
                    dataInicioServico={funcionario.data_inicio_servico}
                    genero={funcionario.genero}
                    numeroFilhos={funcionario.numero_filhos}
                    variant="detail"
                />

                {funcionario.cargos_coordenacao && funcionario.cargos_coordenacao.length > 0 && (
                    <DmFormSection
                        title="Cargos de coordenação"
                        description="Funções de coordenação activas ou históricas"
                    >
                        <div className="space-y-2">
                            {funcionario.cargos_coordenacao.map(cargo => (
                                <div
                                    key={cargo.id}
                                    className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3.5 py-3"
                                >
                                    <span className="mt-0.5 w-8 h-8 flex-shrink-0 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                        <Icons.ClipboardList className="w-4 h-4" />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-indigo-900">{cargo.tipo_cargo}</p>
                                        {cargo.ano_lectivo && (
                                            <p className="text-xs text-indigo-600 mt-0.5">
                                                Ano lectivo {cargo.ano_lectivo}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </DmFormSection>
                )}
            </div>
        </DmModal>
    );
}

export function FuncionariosConsulta({ onNavigate }: FuncionariosConsultaProps) {
    const {
        funcionarios,
        loading,
        error,
        stats,
        filtros,
        setFiltros,
        refresh,
        search
    } = useFuncionarios();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFuncionario, setSelectedFuncionario] = useState<FuncionarioMunicipio | null>(null);
    const [showFiltersExpanded, setShowFiltersExpanded] = useState(false);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            search(searchQuery);
        } else {
            refresh();
        }
    };

    const handleFilterCategoria = (categoria: CategoriaFuncionario) => {
        if (categoria === 'TODOS') {
            setFiltros({ ...filtros, categoria: undefined });
        } else {
            setFiltros({ ...filtros, categoria });
        }
    };

    const handleFilterGrau = (grau_academico: GrauAcademico | undefined) => {
        setFiltros({ ...filtros, grau_academico });
    };

    const handleFilterAtivo = (ativo: boolean | undefined) => {
        setFiltros({ ...filtros, ativo });
    };

    const clearFilters = () => {
        setFiltros({});
        setSearchQuery('');
    };

    if (loading && funcionarios.length === 0) {
        return (
            <DmPage className="pb-24 md:pb-0">
                <DmContent>
                    <div className="flex flex-col items-center justify-center gap-3 py-16">
                        <Icons.Spinner className="w-8 h-8 text-slate-600" />
                        <p className="text-sm font-medium text-slate-500">A carregar funcionários...</p>
                    </div>
                </DmContent>
            </DmPage>
        );
    }

    return (
        <DmPage className="pb-24 md:pb-0">
            <DmHeader
                title="Consulta de Funcionários"
                subtitle="Todos os funcionários das escolas do município"
                icon={<Icons.Users className="w-6 h-6" />}
                accent="slate"
                actions={
                    <DmButton
                        onClick={refresh}
                        icon={<Icons.Refresh className="w-4 h-4" />}
                        className="!bg-white/15 !text-white !border !border-white/20 hover:!bg-white/25"
                    >
                        Actualizar
                    </DmButton>
                }
            />
            <DmContent>
            {/* Main Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                        <div className="text-sm text-gray-500">Total</div>
                    </div>
                    <div
                        className="bg-white p-4 rounded-xl shadow-sm border border-blue-200 cursor-pointer hover:bg-blue-50"
                        onClick={() => handleFilterCategoria('DOCENTE')}
                    >
                        <div className="text-2xl font-bold text-blue-600">{stats.professores}</div>
                        <div className="text-sm text-blue-600">👨‍🏫 Docentes</div>
                    </div>
                    <div
                        className="bg-white p-4 rounded-xl shadow-sm border border-purple-200 cursor-pointer hover:bg-purple-50"
                        onClick={() => handleFilterCategoria('DIRECAO')}
                    >
                        <div className="text-2xl font-bold text-purple-600">{stats.direcao || 0}</div>
                        <div className="text-sm text-purple-600">👔 Direcção</div>
                    </div>
                    <div
                        className="bg-white p-4 rounded-xl shadow-sm border border-indigo-200 cursor-pointer hover:bg-indigo-50"
                        onClick={() => handleFilterCategoria('COORDENACAO')}
                    >
                        <div className="text-2xl font-bold text-indigo-600">{stats.coordenacao || 0}</div>
                        <div className="text-sm text-indigo-600">📋 Coordenação</div>
                    </div>
                    <div
                        className="bg-white p-4 rounded-xl shadow-sm border border-green-200 cursor-pointer hover:bg-green-50"
                        onClick={() => handleFilterCategoria('ADMINISTRATIVO')}
                    >
                        <div className="text-2xl font-bold text-green-600">{stats.secretarios}</div>
                        <div className="text-sm text-green-600">📝 Administrativo</div>
                    </div>
                    <div
                        className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleFilterCategoria('APOIO')}
                    >
                        <div className="text-2xl font-bold text-gray-600">{stats.apoio || 0}</div>
                        <div className="text-sm text-gray-600">🔧 Apoio</div>
                    </div>
                </div>
            )}

            {/* Teacher Qualification Stats (when filtering docentes) */}
            {filtros.categoria === 'DOCENTE' && stats && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
                    <h3 className="font-semibold text-gray-800 mb-3">📊 Qualificação dos Docentes</h3>
                    <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
                        <button
                            onClick={() => handleFilterGrau('DOUTORADO')}
                            className={`p-2 rounded-lg text-center ${filtros.grau_academico === 'DOUTORADO' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-blue-100'}`}
                        >
                            <div className="font-bold">{stats.por_grau?.DOUTORADO || 0}</div>
                            <div className="text-xs">PhD</div>
                        </button>
                        <button
                            onClick={() => handleFilterGrau('MESTRADO')}
                            className={`p-2 rounded-lg text-center ${filtros.grau_academico === 'MESTRADO' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-blue-100'}`}
                        >
                            <div className="font-bold">{stats.por_grau?.MESTRADO || 0}</div>
                            <div className="text-xs">Mestrado</div>
                        </button>
                        <button
                            onClick={() => handleFilterGrau('LICENCIATURA')}
                            className={`p-2 rounded-lg text-center ${filtros.grau_academico === 'LICENCIATURA' ? 'bg-green-600 text-white' : 'bg-white hover:bg-green-100'}`}
                        >
                            <div className="font-bold">{stats.por_grau?.LICENCIATURA || 0}</div>
                            <div className="text-xs">Licenciados</div>
                        </button>
                        <button
                            onClick={() => handleFilterGrau('BACHARELATO')}
                            className={`p-2 rounded-lg text-center ${filtros.grau_academico === 'BACHARELATO' ? 'bg-yellow-600 text-white' : 'bg-white hover:bg-yellow-100'}`}
                        >
                            <div className="font-bold">{stats.por_grau?.BACHARELATO || 0}</div>
                            <div className="text-xs">Bacharel</div>
                        </button>
                        <button
                            onClick={() => handleFilterGrau('TECNICO_MEDIO')}
                            className={`p-2 rounded-lg text-center ${filtros.grau_academico === 'TECNICO_MEDIO' ? 'bg-orange-600 text-white' : 'bg-white hover:bg-orange-100'}`}
                        >
                            <div className="font-bold">{stats.por_grau?.TECNICO_MEDIO || 0}</div>
                            <div className="text-xs">Téc. Médio</div>
                        </button>
                        <button
                            onClick={() => handleFilterGrau('TECNICO_BASICO')}
                            className={`p-2 rounded-lg text-center ${filtros.grau_academico === 'TECNICO_BASICO' ? 'bg-red-600 text-white' : 'bg-white hover:bg-red-100'}`}
                        >
                            <div className="font-bold">{stats.por_grau?.TECNICO_BASICO || 0}</div>
                            <div className="text-xs">Téc. Básico</div>
                        </button>
                        <button
                            onClick={() => handleFilterGrau('SEM_FORMACAO')}
                            className={`p-2 rounded-lg text-center ${filtros.grau_academico === 'SEM_FORMACAO' ? 'bg-gray-600 text-white' : 'bg-white hover:bg-gray-100'}`}
                        >
                            <div className="font-bold">{stats.por_grau?.SEM_FORMACAO || 0}</div>
                            <div className="text-xs">S/ Formação</div>
                        </button>
                    </div>
                    {filtros.grau_academico && (
                        <button
                            onClick={() => handleFilterGrau(undefined)}
                            className="mt-2 text-sm text-blue-600 hover:underline"
                        >
                            ✕ Limpar filtro de grau
                        </button>
                    )}
                </div>
            )}

            {/* Search and Quick Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                    <input
                        type="text"
                        placeholder="🔍 Pesquisar por nome, email ou número..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                        type="submit"
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                        Pesquisar
                    </button>
                </form>
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => handleFilterCategoria('TODOS')}
                        className={`px-4 py-2 rounded-lg ${!filtros.categoria ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                        Todos
                    </button>
                    <button
                        onClick={() => handleFilterCategoria('DOCENTE')}
                        className={`px-4 py-2 rounded-lg ${filtros.categoria === 'DOCENTE' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                        👨‍🏫 Docentes
                    </button>
                    <button
                        onClick={() => handleFilterCategoria('DIRECAO')}
                        className={`px-4 py-2 rounded-lg ${filtros.categoria === 'DIRECAO' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                        👔 Direcção
                    </button>
                    <button
                        onClick={() => handleFilterCategoria('ADMINISTRATIVO')}
                        className={`px-4 py-2 rounded-lg ${filtros.categoria === 'ADMINISTRATIVO' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                        📝 Administrativo
                    </button>
                    <button
                        onClick={() => handleFilterCategoria('APOIO')}
                        className={`px-4 py-2 rounded-lg ${filtros.categoria === 'APOIO' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                        🔧 Apoio
                    </button>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => handleFilterAtivo(undefined)}
                        className={`px-3 py-2 rounded-lg text-sm ${filtros.ativo === undefined ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                        Todos
                    </button>
                    <button
                        onClick={() => handleFilterAtivo(true)}
                        className={`px-3 py-2 rounded-lg text-sm ${filtros.ativo === true ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                        ✓ Activos
                    </button>
                    <button
                        onClick={() => handleFilterAtivo(false)}
                        className={`px-3 py-2 rounded-lg text-sm ${filtros.ativo === false ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                        Inactivos
                    </button>
                </div>
            </div>

            {/* Active Filters Display */}
            {(filtros.categoria || filtros.grau_academico || filtros.ativo !== undefined || searchQuery) && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-500">Filtros activos:</span>
                    {filtros.categoria && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                            {filtros.categoria}
                        </span>
                    )}
                    {filtros.grau_academico && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-sm rounded-full">
                            {grauLabels[filtros.grau_academico]}
                        </span>
                    )}
                    {filtros.ativo !== undefined && (
                        <span className={`px-2 py-1 text-sm rounded-full ${filtros.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            {filtros.ativo ? 'Activos' : 'Inactivos'}
                        </span>
                    )}
                    {searchQuery && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                            "{searchQuery}"
                        </span>
                    )}
                    <button
                        onClick={clearFilters}
                        className="text-sm text-red-600 hover:underline ml-2"
                    >
                        ✕ Limpar filtros
                    </button>
                </div>
            )}

            {/* Funcionários Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Funcionário</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qualificação</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Escola</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acções</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {funcionarios.map(funcionario => {
                            const style = categoriaStyles[funcionario.tipo] || categoriaStyles['DOCENTE'];
                            return (
                                <tr key={funcionario.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{funcionario.nome_completo}</div>
                                        <div className="text-sm text-gray-500">{funcionario.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                                            {style.icon} {funcionario.tipo === 'DOCENTE' ? 'Docente' : funcionario.subtipo || funcionario.tipo}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {funcionario.tipo === 'DOCENTE' && funcionario.grau_academico ? (
                                            <div>
                                                <span className={`px-2 py-1 text-xs rounded font-medium ${funcionario.grau_academico === 'DOUTORADO' || funcionario.grau_academico === 'MESTRADO'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : funcionario.grau_academico === 'LICENCIATURA'
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {grauLabels[funcionario.grau_academico]}
                                                </span>
                                                {funcionario.area_formacao && (
                                                    <div className="text-xs text-gray-500 mt-1">{funcionario.area_formacao}</div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{funcionario.escola_nome}</td>
                                    <td className="px-6 py-4 text-center">
                                        {funcionario.ativo ? (
                                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Activo</span>
                                        ) : (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">Inactivo</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => setSelectedFuncionario(funcionario)}
                                            className="text-blue-600 hover:text-blue-800"
                                            title="Ver detalhes"
                                        >
                                            👁️ Detalhes
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {funcionarios.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        Nenhum funcionário encontrado
                    </div>
                )}
            </div>

            {/* Result Count */}
            <div className="text-sm text-gray-500">
                Mostrando {funcionarios.length} funcionário(s)
            </div>

            <FuncionarioDetalhesModal
                funcionario={selectedFuncionario}
                onClose={() => setSelectedFuncionario(null)}
            />
            </DmContent>
        </DmPage>
    );
}

export default FuncionariosConsulta;
