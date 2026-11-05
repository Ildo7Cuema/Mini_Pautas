/**
 * Hook for provincial pedagogic data and supervision
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import {
    fetchIndicadoresPedagogicosProvinciais,
    fetchIndicadoresPorMunicipio,
    fetchComparativoMunicipios,
    fetchTaxaAprovacaoPorMunicipio,
    fetchEstatisticasProvinciaRPC
} from '../api/pedagogicSupervisionProvincial';
import { dedupeRequest } from '../../../utils/requestDedupe';
import type {
    IndicadoresPedagogicosProvinciais,
    IndicadoresPorMunicipio,
    ComparativoMunicipios
} from '../types';

interface UsePedagogicDataProvincialOptions {
    /** Dashboard only needs RPC stats — skip heavy pedagogic aggregates. */
    mode?: 'full' | 'stats';
}

interface UsePedagogicDataProvincialReturn {
    indicadores: IndicadoresPedagogicosProvinciais | null;
    indicadoresPorMunicipio: IndicadoresPorMunicipio[];
    comparativo: ComparativoMunicipios[];
    taxaAprovacao: { municipio: string; taxa_aprovacao: number }[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;

    // Filters
    trimestre: 1 | 2 | 3 | undefined;
    setTrimestre: (trimestre: 1 | 2 | 3 | undefined) => void;
    anoLectivo: string | undefined;
    setAnoLectivo: (anoLectivo: string | undefined) => void;

    // Statistics summary
    estatisticas: {
        total_municipios: number;
        total_direcoes_municipais: number;
        direcoes_activas: number;
        direcoes_inactivas: number;
        total_escolas: number;
        escolas_activas: number;
        total_professores: number;
        total_alunos: number;
        total_turmas: number;
    };
}

export function usePedagogicDataProvincial(
    options: UsePedagogicDataProvincialOptions = {}
): UsePedagogicDataProvincialReturn {
    const mode = options.mode ?? 'full';
    const { user } = useAuth();
    const [indicadores, setIndicadores] = useState<IndicadoresPedagogicosProvinciais | null>(null);
    const [indicadoresPorMunicipio, setIndicadoresPorMunicipio] = useState<IndicadoresPorMunicipio[]>([]);
    const [comparativo, setComparativo] = useState<ComparativoMunicipios[]>([]);
    const [taxaAprovacao, setTaxaAprovacao] = useState<{ municipio: string; taxa_aprovacao: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [trimestre, setTrimestre] = useState<1 | 2 | 3 | undefined>(undefined);
    const [anoLectivo, setAnoLectivo] = useState<string | undefined>(undefined);
    const [estatisticas, setEstatisticas] = useState({
        total_municipios: 0,
        total_direcoes_municipais: 0,
        direcoes_activas: 0,
        direcoes_inactivas: 0,
        total_escolas: 0,
        escolas_activas: 0,
        total_professores: 0,
        total_alunos: 0,
        total_turmas: 0
    });

    // Get province from user profile
    const provincia = user?.direcaoProvincial?.provincia;

    const loadData = useCallback(async () => {
        if (!provincia) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            if (mode === 'stats') {
                const statsData = await dedupeRequest(
                    `estatisticas-provincia:${provincia}`,
                    () => fetchEstatisticasProvinciaRPC(provincia)
                );
                setEstatisticas(statsData);
                return;
            }

            const [
                indicadoresData,
                porMunicipioData,
                comparativoData,
                taxaData,
                statsData
            ] = await Promise.all([
                fetchIndicadoresPedagogicosProvinciais(provincia, anoLectivo, trimestre),
                fetchIndicadoresPorMunicipio(provincia),
                fetchComparativoMunicipios(provincia),
                fetchTaxaAprovacaoPorMunicipio(provincia, trimestre),
                dedupeRequest(
                    `estatisticas-provincia:${provincia}`,
                    () => fetchEstatisticasProvinciaRPC(provincia)
                ),
            ]);

            setIndicadores(indicadoresData);
            setIndicadoresPorMunicipio(porMunicipioData);
            setComparativo(comparativoData);
            setTaxaAprovacao(taxaData);
            setEstatisticas(statsData);
        } catch (err) {
            console.error('Error loading pedagogic data:', err);
            setError('Erro ao carregar dados pedagógicos');
        } finally {
            setLoading(false);
        }
    }, [provincia, trimestre, anoLectivo, mode]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    return {
        indicadores,
        indicadoresPorMunicipio,
        comparativo,
        taxaAprovacao,
        loading,
        error,
        refresh: loadData,
        trimestre,
        setTrimestre,
        anoLectivo,
        setAnoLectivo,
        estatisticas
    };
}
