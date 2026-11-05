/**
 * Slim data loader for the provincial dashboard.
 * Avoids full pedagogic aggregates and circular leitura N+1 loops.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchEstatisticasProvinciaRPC } from '../api/pedagogicSupervisionProvincial';
import {
    fetchDirecoesMunicipaisProvincia,
    deriveEstatisticasEstadosDirecoes,
} from '../api/direcoesMunicipaisManagement';
import { fetchEstatisticasCirculares } from '../api/circularesProvinciais';
import { dedupeRequest } from '../../../utils/requestDedupe';
import type { DirecaoMunicipalResumida } from '../types';

const emptyStats = {
    total_municipios: 0,
    total_direcoes_municipais: 0,
    direcoes_activas: 0,
    direcoes_inactivas: 0,
    total_escolas: 0,
    escolas_activas: 0,
    total_professores: 0,
    total_alunos: 0,
    total_turmas: 0,
};

const emptyCirculares = {
    total: 0,
    publicadas: 0,
    rascunhos: 0,
    urgentes: 0,
    por_tipo: {} as Record<string, number>,
};

export function useProvincialDashboardData() {
    const { user } = useAuth();
    const provincia = user?.direcaoProvincial?.provincia;

    const [estatisticas, setEstatisticas] = useState(emptyStats);
    const [direcoes, setDirecoes] = useState<DirecaoMunicipalResumida[]>([]);
    const [estatsDirecoes, setEstatsDirecoes] = useState({
        activas: 0,
        suspensas: 0,
        inactivas: 0,
        total: 0,
    });
    const [estatsCirculares, setEstatsCirculares] = useState(emptyCirculares);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!provincia) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const [statsData, direcoesData, circularesStats] = await Promise.all([
                dedupeRequest(`estatisticas-provincia:${provincia}`, () =>
                    fetchEstatisticasProvinciaRPC(provincia)
                ),
                dedupeRequest(`direcoes-municipais:${provincia}`, () =>
                    fetchDirecoesMunicipaisProvincia(provincia)
                ),
                dedupeRequest(`circulares-stats:${provincia}`, () =>
                    fetchEstatisticasCirculares(provincia)
                ),
            ]);

            setEstatisticas(statsData);
            setDirecoes(direcoesData);
            setEstatsDirecoes(deriveEstatisticasEstadosDirecoes(direcoesData));
            setEstatsCirculares(circularesStats);
        } catch (err) {
            console.error('Error loading provincial dashboard:', err);
            setError('Erro ao carregar dashboard provincial');
        } finally {
            setLoading(false);
        }
    }, [provincia]);

    useEffect(() => {
        load();
    }, [load]);

    return {
        estatisticas,
        direcoes,
        estatsDirecoes,
        estatsCirculares,
        loading,
        error,
        refresh: load,
    };
}
