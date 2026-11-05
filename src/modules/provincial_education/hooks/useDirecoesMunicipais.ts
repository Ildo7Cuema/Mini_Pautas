/**
 * Hook for managing municipal directorates at provincial level
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import {
    fetchDirecoesMunicipaisProvincia,
    fetchDirecaoMunicipalDetalhes,
    suspenderDirecaoMunicipal,
    reativarDirecaoMunicipal,
    fetchHistoricoDirecaoMunicipal,
    fetchHistoricoProvincia,
    deriveEstatisticasEstadosDirecoes,
} from '../api/direcoesMunicipaisManagement';
import { dedupeRequest } from '../../../utils/requestDedupe';
import type {
    DirecaoMunicipalResumida,
    DirecaoMunicipalDetalhes,
    HistoricoAdministrativoDirecaoMunicipal
} from '../types';

interface UseDirecoesMunicipaisReturn {
    direcoes: DirecaoMunicipalResumida[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;

    // Detail operations
    fetchDetalhes: (direcaoId: string) => Promise<DirecaoMunicipalDetalhes>;

    // Administrative actions
    suspender: (direcaoId: string, motivo: string, observacoes?: string) => Promise<void>;
    reativar: (direcaoId: string, observacoes?: string) => Promise<void>;

    // History
    fetchHistorico: (direcaoId: string) => Promise<HistoricoAdministrativoDirecaoMunicipal[]>;
    fetchHistoricoGeral: (limit?: number) => Promise<HistoricoAdministrativoDirecaoMunicipal[]>;

    // Stats
    estatisticas: {
        activas: number;
        suspensas: number;
        inactivas: number;
        total: number;
    };
}

export function useDirecoesMunicipais(): UseDirecoesMunicipaisReturn {
    const { user } = useAuth();
    const [direcoes, setDirecoes] = useState<DirecaoMunicipalResumida[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [estatisticas, setEstatisticas] = useState({
        activas: 0,
        suspensas: 0,
        inactivas: 0,
        total: 0
    });

    // Get province from user profile
    const provincia = user?.direcaoProvincial?.provincia;

    const loadDirecoes = useCallback(async () => {
        if (!provincia) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const direcoesData = await dedupeRequest(
                `direcoes-municipais:${provincia}`,
                () => fetchDirecoesMunicipaisProvincia(provincia)
            );

            setDirecoes(direcoesData);
            setEstatisticas(deriveEstatisticasEstadosDirecoes(direcoesData));
        } catch (err) {
            console.error('Error loading municipal directorates:', err);
            setError('Erro ao carregar direções municipais');
        } finally {
            setLoading(false);
        }
    }, [provincia]);

    useEffect(() => {
        loadDirecoes();
    }, [loadDirecoes]);

    const fetchDetalhes = useCallback(async (direcaoId: string) => {
        return await fetchDirecaoMunicipalDetalhes(direcaoId);
    }, []);

    const suspender = useCallback(async (direcaoId: string, motivo: string, observacoes?: string) => {
        await suspenderDirecaoMunicipal(direcaoId, motivo, observacoes);
        await loadDirecoes(); // Refresh list
    }, [loadDirecoes]);

    const reativar = useCallback(async (direcaoId: string, observacoes?: string) => {
        await reativarDirecaoMunicipal(direcaoId, observacoes);
        await loadDirecoes(); // Refresh list
    }, [loadDirecoes]);

    const fetchHistorico = useCallback(async (direcaoId: string) => {
        return await fetchHistoricoDirecaoMunicipal(direcaoId);
    }, []);

    const fetchHistoricoGeral = useCallback(async (limit?: number) => {
        if (!provincia) return [];
        return await fetchHistoricoProvincia(provincia, limit);
    }, [provincia]);

    return {
        direcoes,
        loading,
        error,
        refresh: loadDirecoes,
        fetchDetalhes,
        suspender,
        reativar,
        fetchHistorico,
        fetchHistoricoGeral,
        estatisticas
    };
}
