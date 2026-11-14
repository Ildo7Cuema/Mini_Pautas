import { useCallback, useEffect, useState } from 'react'
import {
    fetchConsolidadoAvaliacaoTutela,
    fetchMapaGeralTutela,
} from '../api/consolidadoTutela'
import type { ConsolidadoAvaliacaoTutela, MapaGeralLinha } from '../types'

export function useConsolidadoTutela(params: {
    municipio?: string | null
    provincia?: string | null
    enabled?: boolean
}) {
    const { municipio, provincia, enabled = true } = params
    const [anoReferencia, setAnoReferencia] = useState<string>('')
    const [data, setData] = useState<ConsolidadoAvaliacaoTutela | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [mapaEscolaId, setMapaEscolaId] = useState<string | null>(null)
    const [mapaLinhas, setMapaLinhas] = useState<MapaGeralLinha[]>([])
    const [mapaLoading, setMapaLoading] = useState(false)

    const load = useCallback(async () => {
        if (!enabled || (!municipio && !provincia)) {
            setData(null)
            return
        }
        setLoading(true)
        setError(null)
        try {
            const result = await fetchConsolidadoAvaliacaoTutela({
                municipio: municipio || undefined,
                provincia: provincia || undefined,
                anoReferencia: anoReferencia || null,
            })
            setData(result)
            if (!anoReferencia && result.ano_referencia) {
                setAnoReferencia(result.ano_referencia)
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erro ao carregar consolidado.')
            setData(null)
        } finally {
            setLoading(false)
        }
    }, [enabled, municipio, provincia, anoReferencia])

    useEffect(() => {
        void load()
    }, [load])

    const openMapaEscola = useCallback(
        async (escolaId: string, cicloId: string | null) => {
            if (!cicloId) {
                setMapaEscolaId(escolaId)
                setMapaLinhas([])
                return
            }
            setMapaEscolaId(escolaId)
            setMapaLoading(true)
            try {
                setMapaLinhas(await fetchMapaGeralTutela(escolaId, cicloId))
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : 'Erro ao carregar mapa da escola.')
                setMapaLinhas([])
            } finally {
                setMapaLoading(false)
            }
        },
        [],
    )

    const closeMapa = useCallback(() => {
        setMapaEscolaId(null)
        setMapaLinhas([])
    }, [])

    return {
        anoReferencia,
        setAnoReferencia,
        data,
        loading,
        error,
        reload: load,
        mapaEscolaId,
        mapaLinhas,
        mapaLoading,
        openMapaEscola,
        closeMapa,
    }
}
