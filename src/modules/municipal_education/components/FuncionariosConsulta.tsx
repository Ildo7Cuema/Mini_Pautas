/**
 * Funcionários Consulta Page
 * Comprehensive staff query page for Municipal Education Direction
 * Supports all staff categories with detailed filtering
 */

import { useState } from 'react';
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
import {
    DmPage,
    DmHeader,
    DmContent,
    DmButton,
} from './MunicipalChrome';

interface FuncionariosConsultaProps {
    onNavigate?: (page: string, params?: Record<string, any>) => void;
}

// Category styling
const categoriaStyles: Record<string, { bg: string; text: string; icon: string }> = {
    'DOCENTE': { bg: 'bg-blue-100', text: 'text-blue-800', icon: '👨‍🏫' },
    'DIRECAO': { bg: 'bg-purple-100', text: 'text-purple-800', icon: '👔' },
    'COORDENACAO': { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: '📋' },
    'ADMINISTRATIVO': { bg: 'bg-green-100', text: 'text-green-800', icon: '📝' },
    'APOIO': { bg: 'bg-gray-100', text: 'text-gray-800', icon: '🔧' }
};

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

            {/* Details Modal */}
            {selectedFuncionario && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Detalhes do Funcionário</h3>
                            <button onClick={() => setSelectedFuncionario(null)} className="text-gray-500 hover:text-gray-700">
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-2xl">
                                    {categoriaStyles[selectedFuncionario.tipo]?.icon || '👤'}
                                </div>
                                <div>
                                    <div className="font-bold text-lg text-gray-900">{selectedFuncionario.nome_completo}</div>
                                    <div className="text-gray-500">{selectedFuncionario.cargo || selectedFuncionario.subtipo}</div>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-4 space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Categoria</span>
                                    <span className="font-medium">{selectedFuncionario.tipo}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Escola</span>
                                    <span className="font-medium">{selectedFuncionario.escola_nome}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Email</span>
                                    <span className="font-medium">{selectedFuncionario.email || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Telefone</span>
                                    <span className="font-medium">{selectedFuncionario.telefone || '-'}</span>
                                </div>

                                {/* Teacher-specific fields */}
                                {selectedFuncionario.tipo === 'DOCENTE' && (
                                    <>
                                        {selectedFuncionario.numero_agente && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Nº Agente</span>
                                                <span className="font-medium">{selectedFuncionario.numero_agente}</span>
                                            </div>
                                        )}
                                        {selectedFuncionario.grau_academico && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Grau Académico</span>
                                                <span className="font-medium">{grauLabels[selectedFuncionario.grau_academico]}</span>
                                            </div>
                                        )}
                                        {selectedFuncionario.area_formacao && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Área de Formação</span>
                                                <span className="font-medium">{selectedFuncionario.area_formacao}</span>
                                            </div>
                                        )}
                                        {selectedFuncionario.especialidade && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Especialidade</span>
                                                <span className="font-medium">{selectedFuncionario.especialidade}</span>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Non-teacher fields */}
                                {selectedFuncionario.numero_funcionario && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Nº Funcionário</span>
                                        <span className="font-medium">{selectedFuncionario.numero_funcionario}</span>
                                    </div>
                                )}

                                <div className="flex justify-between">
                                    <span className="text-gray-500">Estado</span>
                                    <span className={`font-medium ${selectedFuncionario.ativo ? 'text-green-600' : 'text-gray-600'}`}>
                                        {selectedFuncionario.ativo ? '✓ Activo' : 'Inactivo'}
                                    </span>
                                </div>

                                {/* Coordination roles */}
                                {selectedFuncionario.cargos_coordenacao && selectedFuncionario.cargos_coordenacao.length > 0 && (
                                    <div className="pt-3 border-t border-gray-100">
                                        <div className="font-medium text-gray-700 mb-2">Cargos de Coordenação</div>
                                        {selectedFuncionario.cargos_coordenacao.map(cargo => (
                                            <div key={cargo.id} className="bg-indigo-50 px-3 py-2 rounded mb-1">
                                                <div className="font-medium text-indigo-800">{cargo.tipo_cargo}</div>
                                                {cargo.ano_lectivo && (
                                                    <div className="text-xs text-indigo-600">{cargo.ano_lectivo}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={() => setSelectedFuncionario(null)}
                            className="w-full mt-6 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}
            </DmContent>
        </DmPage>
    );
}

export default FuncionariosConsulta;
