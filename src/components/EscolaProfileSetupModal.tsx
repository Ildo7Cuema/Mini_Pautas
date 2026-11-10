/*
component-meta:
  name: EscolaProfileSetupModal
  description: Modal for first-time escola profile setup after registration
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Card, CardBody, CardHeader } from './ui/Card'
import { Button } from './ui/Button'
import { translateError } from '../utils/translations'
import { useAuth } from '../contexts/AuthContext'
import {
    ESCOLA_NATUREZA_OPTIONS,
    EscolaNatureza,
    getEscolaNaturezaFromConfig,
} from '../utils/angolaGradeScale'
import {
    TIPO_ESCOLA_OPTIONS,
    parseTipoEscolaFromConfig,
    type TipoEscolaCenso,
} from '../modules/censo_escolar/utils/escolaModalidade'
import { applyMedCurriculumTemplates } from '../utils/applyMedCurriculumTemplates'

type TipoEscolaConfig = Exclude<TipoEscolaCenso, 'desconhecido'>

interface EscolaProfileSetupModalProps {
    onComplete: () => void
}

export const EscolaProfileSetupModal: React.FC<EscolaProfileSetupModalProps> = ({ onComplete }) => {
    const { escolaProfile, refreshProfile } = useAuth()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [natureza, setNatureza] = useState<EscolaNatureza | ''>(
        () => getEscolaNaturezaFromConfig(escolaProfile?.configuracoes as Record<string, unknown>) || ''
    )
    const [tipoEscola, setTipoEscola] = useState<TipoEscolaConfig | ''>(
        () => parseTipoEscolaFromConfig(escolaProfile?.configuracoes as Record<string, unknown>) || ''
    )

    const handleComplete = async () => {
        if (!escolaProfile?.id) {
            setError('Perfil da escola não encontrado')
            return
        }

        if (!natureza) {
            setError('Seleccione a natureza da instituição (Pública, Público-privada ou Privada)')
            return
        }

        if (!tipoEscola) {
            setError('Seleccione o tipo / subsistema de ensino da escola')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const currentConfig = escolaProfile.configuracoes || {}
            const updatedConfig = {
                ...currentConfig,
                natureza,
                tipo_escola: tipoEscola,
                perfil_configurado: true,
                data_configuracao: new Date().toISOString(),
            }

            const { error: updateError } = await supabase
                .from('escolas')
                .update({ configuracoes: updatedConfig })
                .eq('id', escolaProfile.id)

            if (updateError) throw updateError

            // Pré-cadastrar disciplinas e componentes oficiais MED/INADE por classe
            try {
                await applyMedCurriculumTemplates({
                    supabase,
                    escolaId: escolaProfile.id,
                    tipoEscola,
                    natureza,
                    mode: 'fill_missing',
                })
            } catch (seedErr) {
                console.warn('Currículo MED não aplicado automaticamente:', seedErr)
            }

            await refreshProfile()
            onComplete()
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar perfil'
            setError(translateError(errorMessage))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
            <Card className="w-full max-w-lg overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                    <div className="text-center py-4">
                        <div className="text-5xl mb-4">🎓</div>
                        <h2 className="text-xl md:text-2xl font-bold mb-2">
                            Bem-vindo ao EduGest Angola!
                        </h2>
                        <p className="text-sm md:text-base text-white/90">
                            Complete o perfil da escola para começar
                        </p>
                    </div>
                </CardHeader>
                <CardBody className="p-6 md:p-8">
                    {error && (
                        <div className="alert alert-error mb-6">
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    <div className="space-y-4 mb-6">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                                Sua Escola
                            </h3>
                            <div className="space-y-2">
                                <p className="text-lg font-bold text-slate-900">
                                    {escolaProfile?.nome || 'Nome da Escola'}
                                </p>
                                <p className="text-sm text-slate-600">
                                    Código: <span className="font-medium">{escolaProfile?.codigo_escola || '-'}</span>
                                </p>
                                <p className="text-sm text-slate-600">
                                    {escolaProfile?.municipio}, {escolaProfile?.provincia}
                                </p>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="escola-natureza" className="block text-sm font-semibold text-slate-700 mb-2">
                                Natureza da instituição <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="escola-natureza"
                                value={natureza}
                                onChange={(e) => setNatureza(e.target.value as EscolaNatureza | '')}
                                className="w-full px-3 py-3 border border-slate-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                required
                            >
                                <option value="">Seleccione…</option>
                                {ESCOLA_NATUREZA_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500 mt-2">
                                Escolas públicas e público-privadas usam as escalas oficiais do RAA
                                (Primário 1–10; Secundário 0–20). Instituições privadas podem definir a própria escala.
                            </p>
                        </div>

                        <div>
                            <label htmlFor="escola-tipo" className="block text-sm font-semibold text-slate-700 mb-2">
                                Tipo / Subsistema de ensino <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="escola-tipo"
                                value={tipoEscola}
                                onChange={(e) => setTipoEscola(e.target.value as TipoEscolaConfig | '')}
                                className="w-full px-3 py-3 border border-slate-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                required
                            >
                                <option value="">Seleccione…</option>
                                {TIPO_ESCOLA_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500 mt-2">
                                O sistema pré-cadastra as disciplinas e componentes de avaliação
                                oficiais (MED/INADE) para as classes deste subsistema. Poderá editar,
                                apagar ou adicionar depois em Templates.
                            </p>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="primary"
                        loading={loading}
                        onClick={handleComplete}
                        className="w-full py-3 text-base font-semibold"
                    >
                        Começar a usar o sistema
                    </Button>
                </CardBody>
            </Card>
        </div>
    )
}
