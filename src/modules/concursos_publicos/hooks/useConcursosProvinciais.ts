import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import {
    createConcursoProvincial,
    deleteConcursoProvincial,
    fetchConcursoDetalhe,
    fetchConcursosProvinciais,
    replaceConcursoCategorias,
    replaceConcursoRequisitos,
    setEstadoConcurso,
    updateConcursoProvincial,
} from '../api/concursosApi'
import type { ConcursoPublico, CreateConcursoRequest, EstadoConcurso } from '../types'

export function useConcursosProvinciais() {
    const { direcaoProvincialProfile } = useAuth()
    const [concursos, setConcursos] = useState<ConcursoPublico[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        if (!direcaoProvincialProfile?.provincia) {
            setConcursos([])
            setLoading(false)
            return
        }
        setLoading(true)
        setError(null)
        try {
            const data = await fetchConcursosProvinciais(direcaoProvincialProfile.provincia)
            setConcursos(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar concursos')
        } finally {
            setLoading(false)
        }
    }, [direcaoProvincialProfile?.provincia])

    useEffect(() => {
        refresh()
    }, [refresh])

    const criar = async (request: CreateConcursoRequest) => {
        if (!direcaoProvincialProfile?.id || !direcaoProvincialProfile.provincia) {
            throw new Error('Perfil provincial em falta')
        }
        const created = await createConcursoProvincial(
            direcaoProvincialProfile.id,
            direcaoProvincialProfile.provincia,
            request
        )
        await refresh()
        return created
    }

    const actualizar = async (
        id: string,
        patch: Partial<Pick<ConcursoPublico, 'titulo' | 'descricao' | 'instrucoes' | 'data_inicio' | 'data_fim'>>,
        categorias?: CreateConcursoRequest['categorias'],
        requisitos?: CreateConcursoRequest['requisitos']
    ) => {
        await updateConcursoProvincial(id, patch)
        if (categorias) await replaceConcursoCategorias(id, categorias)
        if (requisitos) await replaceConcursoRequisitos(id, requisitos)
        await refresh()
    }

    const publicar = async (id: string, publicarFlag: boolean) => {
        const estado: EstadoConcurso = publicarFlag ? 'publicado' : 'rascunho'
        await setEstadoConcurso(id, estado)
        await refresh()
    }

    const encerrar = async (id: string) => {
        await setEstadoConcurso(id, 'encerrado')
        await refresh()
    }

    const eliminar = async (id: string) => {
        await deleteConcursoProvincial(id)
        await refresh()
    }

    const detalhe = async (id: string) => fetchConcursoDetalhe(id)

    return {
        concursos,
        loading,
        error,
        refresh,
        criar,
        actualizar,
        publicar,
        encerrar,
        eliminar,
        detalhe,
    }
}
