import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import {
    abrirConcursoMunicipal,
    fetchAberturasMunicipais,
    fetchConcursosDisponiveisMunicipio,
    fetchInscricoesMunicipais,
    saveCabecalhoAbertura,
    setEstadoAbertura,
    updateEstadoInscricao,
    uploadLogoCabecalhoConcurso,
} from '../api/concursosApi'
import type {
    CabecalhoConcursoPdf,
    ConcursoAberturaMunicipal,
    ConcursoInscricao,
    ConcursoPublico,
    EstadoAbertura,
    EstadoInscricao,
    OrdenacaoInscricoes,
} from '../types'

export function useConcursosMunicipais() {
    const { direcaoMunicipalProfile } = useAuth()
    const [disponiveis, setDisponiveis] = useState<ConcursoPublico[]>([])
    const [aberturas, setAberturas] = useState<ConcursoAberturaMunicipal[]>([])
    const [inscricoes, setInscricoes] = useState<ConcursoInscricao[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [ordenacao, setOrdenacao] = useState<OrdenacaoInscricoes>('alfabetica')
    const [aberturaFiltro, setAberturaFiltro] = useState<string | null>(null)
    const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null)
    const [search, setSearch] = useState('')

    const refresh = useCallback(async () => {
        if (!direcaoMunicipalProfile?.id || !direcaoMunicipalProfile.provincia) {
            setDisponiveis([])
            setAberturas([])
            setInscricoes([])
            setLoading(false)
            return
        }
        setLoading(true)
        setError(null)
        try {
            const [disp, ab] = await Promise.all([
                fetchConcursosDisponiveisMunicipio(direcaoMunicipalProfile.provincia),
                fetchAberturasMunicipais(direcaoMunicipalProfile.id),
            ])
            setDisponiveis(disp)
            setAberturas(ab)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar concursos')
        } finally {
            setLoading(false)
        }
    }, [direcaoMunicipalProfile?.id, direcaoMunicipalProfile?.provincia])

    const refreshInscricoes = useCallback(async () => {
        if (!direcaoMunicipalProfile?.id) {
            setInscricoes([])
            return
        }
        try {
            const data = await fetchInscricoesMunicipais(direcaoMunicipalProfile.id, {
                aberturaId: aberturaFiltro || undefined,
                categoriaId: categoriaFiltro || undefined,
                ordenacao,
                search: search || undefined,
            })
            setInscricoes(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar inscrições')
        }
    }, [direcaoMunicipalProfile?.id, aberturaFiltro, categoriaFiltro, ordenacao, search])

    useEffect(() => {
        refresh()
    }, [refresh])

    useEffect(() => {
        refreshInscricoes()
    }, [refreshInscricoes])

    const abrir = async (concursoId: string, dataFecho?: string | null) => {
        if (!direcaoMunicipalProfile) throw new Error('Perfil municipal em falta')
        const ab = await abrirConcursoMunicipal({
            concursoId,
            direcaoMunicipalId: direcaoMunicipalProfile.id,
            municipio: direcaoMunicipalProfile.municipio,
            provincia: direcaoMunicipalProfile.provincia,
            dataFecho: dataFecho || null,
        })
        await refresh()
        return ab
    }

    const setEstado = async (aberturaId: string, estado: EstadoAbertura) => {
        await setEstadoAbertura(aberturaId, estado)
        await refresh()
    }

    const guardarCabecalho = async (aberturaId: string, cabecalho: CabecalhoConcursoPdf) => {
        await saveCabecalhoAbertura(aberturaId, cabecalho)
        await refresh()
    }

    const uploadLogo = async (file: File) => uploadLogoCabecalhoConcurso(file)

    const actualizarInscricao = async (id: string, estado: EstadoInscricao, observacoes?: string) => {
        await updateEstadoInscricao(id, estado, observacoes)
        await refreshInscricoes()
    }

    return {
        disponiveis,
        aberturas,
        inscricoes,
        loading,
        error,
        ordenacao,
        setOrdenacao,
        aberturaFiltro,
        setAberturaFiltro,
        categoriaFiltro,
        setCategoriaFiltro,
        search,
        setSearch,
        refresh,
        refreshInscricoes,
        abrir,
        setEstado,
        guardarCabecalho,
        uploadLogo,
        actualizarInscricao,
        perfil: direcaoMunicipalProfile,
    }
}
