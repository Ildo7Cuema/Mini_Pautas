import React from 'react'
import { GradeColorConfig } from '../utils/gradeColorConfigUtils'
import { MiniPautaPreviewSecundario } from './MiniPautaPreviewSecundario'
import { MiniPautaPreviewPrimario } from './MiniPautaPreviewPrimario'

interface TrimestreData {
    notas: Record<string, number>
    nota_final: number
}

export interface MiniPautaPreviewProps {
    data: {
        turma: {
            nome: string
            codigo_turma: string
            ano_lectivo: number
        }
        disciplina: {
            nome: string
            codigo_disciplina: string
        }
        trimestre: number | 'all'
        nivel_ensino?: string  // Educational level (Ensino Secundário, Ensino Primário, etc.)
        classe?: string  // Class level (5ª Classe, 6ª Classe, etc.)
        alunos: Array<{
            numero_processo: string
            nome_completo: string
            notas: Record<string, number>
            nota_final?: number  // Optional - only present if MF component is configured
            media_trimestral?: number | null
            classificacao: string
            aprovado: boolean
            trimestres?: {
                1?: TrimestreData
                2?: TrimestreData
                3?: TrimestreData
            }
        }>
        componentes: Array<{
            id: string  // Component ID for unique identification
            codigo_componente: string
            nome: string
            peso_percentual: number
            trimestre?: number // Which trimestre this component belongs to
            is_calculated?: boolean // Whether this component is auto-calculated
            disciplina_nome?: string // Discipline name for grouping
            disciplina_ordem?: number // Discipline order for sorting
        }>
        showMT?: boolean
    }
    loading?: boolean
    colorConfig?: GradeColorConfig | null
    mapHeaderColor?: string
}

/**
 * MiniPautaPreview - Router/Wrapper component that delegates to the appropriate
 * preview component based on the educational level (nivel_ensino).
 * 
 * - Primary Education (Ensino Primário) -> MiniPautaPreviewPrimario
 * - Secondary Education (Ensino Secundário) -> MiniPautaPreviewSecundario
 */
export const MiniPautaPreview: React.FC<MiniPautaPreviewProps> = ({ data, loading, colorConfig, mapHeaderColor }) => {
    // Detect if this is Primary Education
    const isPrimaryEducation = data.nivel_ensino?.toLowerCase().includes('primário') ||
        data.nivel_ensino?.toLowerCase().includes('primario')

    if (isPrimaryEducation) {
        return (
            <MiniPautaPreviewPrimario
                data={data}
                loading={loading}
                colorConfig={colorConfig}
                mapHeaderColor={mapHeaderColor}
            />
        )
    }

    // Default to Secondary Education
    return (
        <MiniPautaPreviewSecundario
            data={data}
            loading={loading}
            colorConfig={colorConfig}
            mapHeaderColor={mapHeaderColor}
        />
    )
}
