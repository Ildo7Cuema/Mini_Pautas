import React, { useEffect, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { Icons } from '../../../components/ui/Icons'
import { translateError } from '../../../utils/translations'
import { fetchEstatisticasEscolasProvincia } from '../api/escolasProvincialQuery'
import { fetchEstatisticasProvinciaRPC } from '../api/pedagogicSupervisionProvincial'
import { fetchConcursosProvinciais } from '../../concursos_publicos/api/concursosApi'
import {
    DpAlert,
    DpContent,
    DpHeader,
    DpLoading,
    DpPage,
    DpPanel,
    DpStatCard,
} from './ProvincialChrome'

export const EstatisticasProvinciaisPage: React.FC = () => {
    const { direcaoProvincialProfile } = useAuth()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [escolas, setEscolas] = useState({
        total_escolas: 0,
        escolas_activas: 0,
        escolas_bloqueadas: 0,
        escolas_inactivas: 0,
        total_por_municipio: {} as Record<string, number>,
    })
    const [pedagogico, setPedagogico] = useState({
        total_alunos: 0,
        total_professores: 0,
        total_turmas: 0,
    })
    const [concursosCount, setConcursosCount] = useState(0)

    useEffect(() => {
        const run = async () => {
            if (!direcaoProvincialProfile?.provincia) {
                setLoading(false)
                return
            }
            setLoading(true)
            setError(null)
            try {
                const [esc, ped, conc] = await Promise.all([
                    fetchEstatisticasEscolasProvincia(direcaoProvincialProfile.provincia),
                    fetchEstatisticasProvinciaRPC(direcaoProvincialProfile.provincia).catch(() => ({
                        total_alunos: 0,
                        total_professores: 0,
                        total_turmas: 0,
                    })),
                    fetchConcursosProvinciais(direcaoProvincialProfile.provincia).catch(() => []),
                ])
                setEscolas(esc)
                setPedagogico({
                    total_alunos: (ped as any).total_alunos ?? 0,
                    total_professores: (ped as any).total_professores ?? 0,
                    total_turmas: (ped as any).total_turmas ?? 0,
                })
                setConcursosCount(Array.isArray(conc) ? conc.length : 0)
            } catch (err) {
                setError(
                    translateError(err instanceof Error ? err.message : 'Erro ao carregar estatísticas'),
                )
            } finally {
                setLoading(false)
            }
        }
        run()
    }, [direcaoProvincialProfile?.provincia])

    const municipios = Object.entries(escolas.total_por_municipio).sort((a, b) =>
        a[0].localeCompare(b[0], 'pt'),
    )

    return (
        <DpPage className="pb-24 md:pb-0">
            <DpHeader
                title="Estatísticas"
                subtitle={`Indicadores agregados — ${direcaoProvincialProfile?.provincia || 'Província'}`}
                icon={<Icons.ClipboardList className="w-6 h-6" />}
                accent="emerald"
            />
            <DpContent>
                {error && <DpAlert tone="error">{error}</DpAlert>}
                {loading ? (
                    <DpLoading />
                ) : (
                    <>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            <DpStatCard
                                title="Escolas"
                                value={escolas.total_escolas}
                                subtitle={`${escolas.escolas_activas} activas`}
                                icon={<Icons.Building className="w-5 h-5" />}
                            />
                            <DpStatCard
                                title="Alunos"
                                value={pedagogico.total_alunos}
                                icon={<Icons.Users className="w-5 h-5" />}
                            />
                            <DpStatCard
                                title="Professores"
                                value={pedagogico.total_professores}
                                icon={<Icons.AcademicCap className="w-5 h-5" />}
                            />
                            <DpStatCard
                                title="Concursos"
                                value={concursosCount}
                                subtitle="Registados na província"
                                icon={<Icons.ClipboardList className="w-5 h-5" />}
                            />
                        </div>

                        <DpPanel>
                            <h3 className="text-sm font-semibold text-slate-800 mb-3">
                                Escolas por município
                            </h3>
                            {municipios.length === 0 ? (
                                <p className="text-sm text-slate-500">Sem dados municipais.</p>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {municipios.map(([municipio, total]) => (
                                        <li
                                            key={municipio}
                                            className="flex items-center justify-between py-2.5 text-sm"
                                        >
                                            <span className="text-slate-700">{municipio}</span>
                                            <span className="font-semibold text-slate-900">{total}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </DpPanel>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <DpPanel>
                                <p className="text-xs uppercase tracking-wide text-slate-500">Activas</p>
                                <p className="text-2xl font-bold text-emerald-700 mt-1">
                                    {escolas.escolas_activas}
                                </p>
                            </DpPanel>
                            <DpPanel>
                                <p className="text-xs uppercase tracking-wide text-slate-500">Bloqueadas</p>
                                <p className="text-2xl font-bold text-amber-700 mt-1">
                                    {escolas.escolas_bloqueadas}
                                </p>
                            </DpPanel>
                            <DpPanel>
                                <p className="text-xs uppercase tracking-wide text-slate-500">Inactivas</p>
                                <p className="text-2xl font-bold text-slate-600 mt-1">
                                    {escolas.escolas_inactivas}
                                </p>
                            </DpPanel>
                        </div>
                    </>
                )}
            </DpContent>
        </DpPage>
    )
}

export default EstatisticasProvinciaisPage
