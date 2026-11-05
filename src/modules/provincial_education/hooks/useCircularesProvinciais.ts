/**
 * Hook for managing provincial circulars
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import {
    fetchCircularesProvinciais,
    fetchCircularProvincial,
    createCircularProvincial,
    updateCircularProvincial,
    deleteCircularProvincial,
    publishCircularProvincial,
    unpublishCircularProvincial,
    fetchLeiturasCircular,
    deriveEstatisticasCirculares,
} from '../api/circularesProvinciais';
import { dedupeRequest } from '../../../utils/requestDedupe';
import type {
    CircularProvincial,
    LeituraCircularProvincial,
    CreateCircularProvincialRequest,
    FiltrosCircularesProvinciais
} from '../types';

interface UseCircularesProvinciaisReturn {
    circulares: CircularProvincial[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;

    // CRUD operations
    create: (data: CreateCircularProvincialRequest) => Promise<CircularProvincial>;
    update: (id: string, data: Partial<CreateCircularProvincialRequest>) => Promise<CircularProvincial>;
    remove: (id: string) => Promise<void>;

    // Publishing
    publish: (id: string) => Promise<CircularProvincial>;
    unpublish: (id: string) => Promise<CircularProvincial>;

    // Reading tracking
    fetchLeituras: (circularId: string) => Promise<LeituraCircularProvincial[]>;

    // Filtering
    filtros: FiltrosCircularesProvinciais;
    setFiltros: (filtros: FiltrosCircularesProvinciais) => void;

    // Statistics
    estatisticas: {
        total: number;
        publicadas: number;
        rascunhos: number;
        urgentes: number;
        por_tipo: Record<string, number>;
    };

    // Selected circular
    selectedCircular: CircularProvincial | null;
    selectCircular: (id: string) => Promise<void>;
    clearSelection: () => void;

    // Portuguese aliases
    criarCircular: (data: CreateCircularProvincialRequest) => Promise<CircularProvincial>;
    actualizarCircular: (id: string, data: Partial<CreateCircularProvincialRequest>) => Promise<CircularProvincial>;
    eliminarCircular: (id: string) => Promise<void>;
    publicarCircular: (id: string, publicar: boolean) => Promise<CircularProvincial>;
}

export function useCircularesProvinciais(): UseCircularesProvinciaisReturn {
    const { user } = useAuth();
    const [circulares, setCirculares] = useState<CircularProvincial[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtros, setFiltros] = useState<FiltrosCircularesProvinciais>({});
    const [estatisticas, setEstatisticas] = useState({
        total: 0,
        publicadas: 0,
        rascunhos: 0,
        urgentes: 0,
        por_tipo: {} as Record<string, number>
    });
    const [selectedCircular, setSelectedCircular] = useState<CircularProvincial | null>(null);

    // Get province from user profile
    const provincia = user?.direcaoProvincial?.provincia;

    const loadCirculares = useCallback(async () => {
        if (!provincia) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Full list; derive stats locally (no second round-trip / N+1).
            const cacheKey = `circulares:${provincia}:${JSON.stringify(filtros || {})}`
            const circularesData = await dedupeRequest(cacheKey, () =>
                fetchCircularesProvinciais(provincia, filtros)
            )
            setCirculares(circularesData)
            setEstatisticas(deriveEstatisticasCirculares(circularesData))
        } catch (err) {
            console.error('Error loading circulars:', err);
            setError('Erro ao carregar circulares');
        } finally {
            setLoading(false);
        }
    }, [provincia, filtros]);

    useEffect(() => {
        loadCirculares();
    }, [loadCirculares]);

    const create = useCallback(async (data: CreateCircularProvincialRequest): Promise<CircularProvincial> => {
        if (!provincia) throw new Error('Província não definida');
        const circular = await createCircularProvincial(provincia, data);
        await loadCirculares();
        return circular;
    }, [provincia, loadCirculares]);

    const update = useCallback(async (id: string, data: Partial<CreateCircularProvincialRequest>): Promise<CircularProvincial> => {
        const circular = await updateCircularProvincial(id, data);
        await loadCirculares();
        return circular;
    }, [loadCirculares]);

    const remove = useCallback(async (id: string): Promise<void> => {
        await deleteCircularProvincial(id);
        await loadCirculares();
    }, [loadCirculares]);

    const publish = useCallback(async (id: string): Promise<CircularProvincial> => {
        const circular = await publishCircularProvincial(id);
        await loadCirculares();
        return circular;
    }, [loadCirculares]);

    const unpublish = useCallback(async (id: string): Promise<CircularProvincial> => {
        const circular = await unpublishCircularProvincial(id);
        await loadCirculares();
        return circular;
    }, [loadCirculares]);

    const fetchLeituras = useCallback(async (circularId: string): Promise<LeituraCircularProvincial[]> => {
        return await fetchLeiturasCircular(circularId);
    }, []);

    const selectCircular = useCallback(async (id: string): Promise<void> => {
        const circular = await fetchCircularProvincial(id);
        setSelectedCircular(circular);
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedCircular(null);
    }, []);

    return {
        circulares,
        loading,
        error,
        refresh: loadCirculares,
        create,
        update,
        remove,
        publish,
        unpublish,
        fetchLeituras,
        filtros,
        setFiltros,
        estatisticas,
        selectedCircular,
        selectCircular,
        clearSelection,
        // Portuguese aliases for compatibility
        criarCircular: create,
        actualizarCircular: update,
        eliminarCircular: remove,
        publicarCircular: async (id: string, publicar: boolean) => {
            if (publicar) {
                return await publish(id);
            } else {
                return await unpublish(id);
            }
        }
    };
}
