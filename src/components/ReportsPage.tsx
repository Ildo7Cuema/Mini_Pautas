/*
component-meta:
  name: ReportsPage
  description: Page for generating reports and exporting data
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Card, CardHeader, CardBody } from './ui/Card'
import { Button } from './ui/Button'
import { translateError } from '../utils/translations'
import { MiniPautaPreview } from './MiniPautaPreview'
import { OrdenarDisciplinasModal } from './OrdenarDisciplinasModal'
import { TurmaStatistics } from './TurmaStatistics'
import { generateMiniPautaPDF } from '../utils/pdfGenerator'
import { generateMiniPautaExcel, generateCSV } from '../utils/excelGenerator'
import { calculateNotaFinal, calculateStatistics, getClassificacao } from '../utils/gradeCalculations'
import { getApprovalThreshold } from '../utils/angolaGradeScale'
import {
    evaluateConfiguredComponent,
    type GradesByTrimestre,
} from '../utils/formulaUtils'
import { HeaderConfig, loadHeaderConfig } from '../utils/headerConfigUtils'
import { GradeColorConfig, loadGradeColorConfig } from '../utils/gradeColorConfigUtils'
import { ConfiguracaoCoresModal } from './ConfiguracaoCoresModal'
import { PautaGeralPage } from './PautaGeralPage'
import { ConselhoNotasPage } from './ConselhoNotasPage'
import { useAuth } from '../contexts/AuthContext'
import { TermoFrequenciaPreview } from './TermoFrequenciaPreview'
import { BoletimNotasPreview, BoletimNotasData } from './BoletimNotasPreview'
import { generateTermoFrequenciaPDF, generateBatchTermosFrequenciaZip, generateMapaAproveitamentoPDF, generateBoletimNotasPDF, generateBatchBoletinsZip } from '../utils/pdfGenerator'
import { MapaAproveitamentoPreview, MapaAproveitamentoData, MapaAproveitamentoTurmaData } from './MapaAproveitamentoPreview'
import {
    classifyStudent,
    isAttendanceSufficient,
    type DisciplinaGrade,
} from '../utils/studentClassification'

function extractClasseFromTurmaNome(turmaNome: string): string | undefined {
    const match = turmaNome.match(/(\d+[ªº]\s*Classe)/i)
    return match ? match[1] : undefined
}

/**
 * Decide transição geral do Termo de Frequência alinhada com classifyStudent,
 * incluindo a regra de frequência mínima (66,67%).
 */
function resolveTransicaoTermo(
    disciplinasProcessadas: Array<{ id: string; nome: string; nota_final: number | null; transita: boolean }>,
    nivelEnsino: string | undefined,
    turmaNome: string,
    frequenciaAnual?: number | null
) {
    const disciplinaGrades: DisciplinaGrade[] = disciplinasProcessadas
        .filter((d): d is typeof d & { nota_final: number } => d.nota_final !== null)
        .map(d => ({ id: d.id, nome: d.nome, nota: d.nota_final }))

    const classification = classifyStudent(
        disciplinaGrades,
        nivelEnsino,
        extractClasseFromTurmaNome(turmaNome),
        undefined,
        frequenciaAnual ?? undefined
    )

    const frequenciaOk = isAttendanceSufficient(frequenciaAnual)

    // Transita plena ou condicional; frequência insuficiente bloqueia sempre
    const transita =
        frequenciaOk &&
        (classification.status === 'Transita' || classification.status === 'Condicional')

    return {
        transita,
        observacao_padronizada: classification.observacao_padronizada,
        motivo_retencao: classification.motivo_retencao,
        matricula_condicional: classification.matricula_condicional && frequenciaOk,
    }
}

interface Turma {
    id: string
    nome: string
    ano_lectivo: number
    codigo_turma: string
    nivel_ensino: string
}

interface Disciplina {
    id: string
    nome: string
    codigo_disciplina: string
    ordem?: number
}

interface ComponenteAvaliacao {
    id: string
    codigo_componente: string
    nome: string
    peso_percentual: number
    is_calculated?: boolean
    formula_expression?: string
    depends_on_components?: string[]
    disciplina_nome?: string  // For grouping in Primary Education format
    disciplina_ordem?: number  // For ordering disciplines in Primary Education format
}

interface TrimestreData {
    notas: Record<string, number>
    nota_final: number
    classificacao: string
    aprovado: boolean
}

interface MiniPautaData {
    turma: Turma
    disciplina: Disciplina
    trimestre: number | 'all'
    nivel_ensino?: string  // Educational level for color grading
    classe?: string  // Class level for color grading
    alunos: Array<{
        numero_processo: string
        nome_completo: string
        genero?: 'M' | 'F'
        notas: Record<string, number>
        nota_final?: number  // Optional - only present if MF component is configured
        media_trimestral?: number | null
        classificacao: string
        aprovado: boolean
        // For all-trimester mode
        trimestres?: {
            1?: TrimestreData
            2?: TrimestreData
            3?: TrimestreData
        }
    }>
    componentes: ComponenteAvaliacao[]
    estatisticas: {
        total_alunos: number
        aprovados: number
        reprovados: number
        taxa_aprovacao: number
        media_turma: number
        nota_minima: number
        nota_maxima: number
        distribuicao: Record<string, number>
    }
    showMT?: boolean
    escola?: {
        nome: string
        provincia: string
        municipio: string
    }
}

interface ReportsPageProps {
    searchQuery?: string
    initialTab?: 'mini-pauta' | 'pauta-geral' | 'termo-frequencia' | 'mapa-aproveitamento' | 'boletim-notas' | 'conselho-notas'
    initialConselhoTurmaId?: string
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
    searchQuery = '',
    initialTab,
    initialConselhoTurmaId,
}) => {
    const { isProfessor, professorProfile, escolaProfile, secretarioProfile, isDirecaoMunicipal, direcaoMunicipalProfile } = useAuth()
    const [turmas, setTurmas] = useState<Turma[]>([])
    const [disciplinas, setDisciplinas] = useState<Disciplina[]>([])
    const [selectedTurma, setSelectedTurma] = useState<string>('')
    const [selectedTurmaData, setSelectedTurmaData] = useState<Turma | null>(null)
    const [selectedDisciplina, setSelectedDisciplina] = useState<string>('')
    const [trimestre, setTrimestre] = useState<1 | 2 | 3 | 'all'>(1)
    const [loadingData, setLoadingData] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [miniPautaData, setMiniPautaData] = useState<MiniPautaData | null>(null)
    const [headerConfig, setHeaderConfig] = useState<HeaderConfig | null>(null)
    const [showOrdenarDisciplinasModal, setShowOrdenarDisciplinasModal] = useState(false)
    const [colorConfig, setColorConfig] = useState<GradeColorConfig | null>(null)
    const [showColorConfigModal, setShowColorConfigModal] = useState(false)

    // Tab state
    const [activeTab, setActiveTab] = useState<'mini-pauta' | 'pauta-geral' | 'termo-frequencia' | 'mapa-aproveitamento' | 'boletim-notas' | 'conselho-notas'>(
        initialTab || 'mini-pauta'
    )

    useEffect(() => {
        if (initialTab) setActiveTab(initialTab)
    }, [initialTab])

    // Deep-link from notification: force Conselho tab when turma arrives
    useEffect(() => {
        if (initialConselhoTurmaId) setActiveTab('conselho-notas')
    }, [initialConselhoTurmaId])

    // Mapa de Aproveitamento state
    const [mapaData, setMapaData] = useState<MapaAproveitamentoData | null>(null)
    const [mapaLoading, setMapaLoading] = useState(false)
    const [mapaTrimestre, setMapaTrimestre] = useState<1 | 2 | 3 | 'anual'>(1)
    const [mapaSelectedTurmas] = useState<string[]>([])

    // Boletim de Notas state
    const [boletimTrimestre, setBoletimTrimestre] = useState<1 | 2 | 3>(1)
    const [boletimData, setBoletimData] = useState<BoletimNotasData | null>(null)
    const [loadingBoletim, setLoadingBoletim] = useState(false)

    // Termo de Frequência state
    const [alunos, setAlunos] = useState<Array<{ id: string, numero_processo: string, nome_completo: string }>>([])
    const [selectedAluno, setSelectedAluno] = useState<string>('')
    const [termoFrequenciaData, setTermoFrequenciaData] = useState<any>(null)
    const [loadingTermo, setLoadingTermo] = useState(false)
    const [availableComponents, setAvailableComponents] = useState<Array<{ codigo: string, nome: string }>>([])
    const [selectedComponents, setSelectedComponents] = useState<string[]>([])
    const [componentAlignment, setComponentAlignment] = useState<'left' | 'center' | 'right'>('center')

    // Batch generation state
    const [selectedAlunosIds, setSelectedAlunosIds] = useState<string[]>([])
    const [batchProgress, setBatchProgress] = useState<{
        current: number
        total: number
        currentAluno: string
    } | null>(null)
    const [batchGenerating, setBatchGenerating] = useState(false)
    const [isBatchGenerationExpanded, setIsBatchGenerationExpanded] = useState(false)
    const [isComponentsExpanded, setIsComponentsExpanded] = useState(false)

    // Direção Municipal - escola filter state
    const [escolas, setEscolas] = useState<Array<{ id: string, nome: string, codigo_escola: string }>>([])
    const [selectedEscola, setSelectedEscola] = useState<string>('')

    // Detect if selected turma is Primary Education
    const isPrimaryEducation = selectedTurmaData?.nivel_ensino?.toLowerCase().includes('primário') ||
        selectedTurmaData?.nivel_ensino?.toLowerCase().includes('primario') ||
        false

    // Define functions before useEffects
    const loadAlunos = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('alunos')
                .select('id, numero_processo, nome_completo')
                .eq('turma_id', selectedTurma)
                .eq('ativo', true)
                .order('nome_completo')

            if (error) throw error
            setAlunos(data || [])

            // Auto-select first student
            if (data && data.length > 0 && !selectedAluno) {
                setSelectedAluno(data[0].id)
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar alunos'
            setError(translateError(errorMessage))
        }
    }, [selectedTurma, selectedAluno])

    const loadTermoFrequenciaData = useCallback(async () => {
        // Early return if no student selected
        if (!selectedAluno || !selectedTurma) {
            return
        }

        try {
            setLoadingTermo(true)
            setError(null)

            console.log('Loading termo data for student:', selectedAluno, 'turma:', selectedTurma)

            // Load student details with all expanded fields
            const { data: alunoData, error: alunoError } = await supabase
                .from('alunos')
                .select(`
                    id, numero_processo, nome_completo, data_nascimento, genero,
                    nacionalidade, naturalidade, tipo_documento, numero_documento,
                    nome_pai, nome_mae, nome_encarregado, parentesco_encarregado,
                    telefone_encarregado, email_encarregado, profissao_encarregado,
                    provincia, municipio, bairro, rua, endereco,
                    ano_ingresso, escola_anterior, classe_anterior, observacoes_academicas,
                    frequencia_anual, tipo_exame, observacao_transicao, motivo_retencao, matricula_condicional
                `)
                .eq('id', selectedAluno)
                .single()

            if (alunoError) {
                console.error('Error loading student:', alunoError)
                throw alunoError
            }

            // Load turma details
            const { data: turmaData, error: turmaError } = await supabase
                .from('turmas')
                .select('id, nome, ano_lectivo, codigo_turma, nivel_ensino')
                .eq('id', selectedTurma)
                .single()

            if (turmaError) {
                console.error('Error loading turma:', turmaError)
                throw turmaError
            }

            // Load all disciplines for this turma
            const { data: disciplinasData, error: disciplinasError } = await supabase
                .from('disciplinas')
                .select('id, nome, codigo_disciplina')
                .eq('turma_id', selectedTurma)
                .order('ordem')

            if (disciplinasError) {
                console.error('Error loading disciplines:', disciplinasError)
                throw disciplinasError
            }

            if (!disciplinasData || disciplinasData.length === 0) {
                setError('Nenhuma disciplina encontrada para esta turma')
                setTermoFrequenciaData(null)
                return
            }

            // Load all components for all disciplines (including calculated ones that are registered)
            const { data: componentesData, error: componentesError } = await supabase
                .from('componentes_avaliacao')
                .select('id, codigo_componente, nome, peso_percentual, trimestre, disciplina_id, is_calculated, formula_expression, depends_on_components, tipo_calculo')
                .eq('turma_id', selectedTurma)
                .in('disciplina_id', disciplinasData.map(d => d.id))

            if (componentesError) {
                console.error('Error loading components:', componentesError)
                throw componentesError
            }

            // Load all grades for this student across all trimesters
            const { data: notasData, error: notasError } = await supabase
                .from('notas')
                .select('componente_id, valor, trimestre')
                .eq('aluno_id', selectedAluno)
                .eq('turma_id', selectedTurma)

            if (notasError) {
                console.error('Error loading grades:', notasError)
                throw notasError
            }

            console.log('Loaded data:', { aluno: alunoData, turma: turmaData, disciplinas: disciplinasData?.length, componentes: componentesData?.length, notas: notasData?.length })

            // Extract unique components for selection (all registered components)
            const uniqueComponents = Array.from(
                new Map(componentesData?.map(c => [c.codigo_componente, { codigo: c.codigo_componente, nome: c.nome }]) || []).values()
            )
            setAvailableComponents(uniqueComponents)

            // Auto-select all components if none selected yet
            if (selectedComponents.length === 0 && uniqueComponents.length > 0) {
                setSelectedComponents(uniqueComponents.map(c => c.codigo))
            }

            // Process each discipline
            const disciplinasProcessadas = disciplinasData.map(disciplina => {
                const componentesDisciplina = componentesData?.filter(c => c.disciplina_id === disciplina.id) || []
                const notasTrimestrais: { 1: number | null, 2: number | null, 3: number | null } = {
                    1: null,
                    2: null,
                    3: null
                }

                // Process components BY TRIMESTRE - each trimester has its own components
                const componentesPorTrimestre: {
                    1: Array<{ codigo: string, nome: string, nota: number | null, is_calculated?: boolean }>,
                    2: Array<{ codigo: string, nome: string, nota: number | null, is_calculated?: boolean }>,
                    3: Array<{ codigo: string, nome: string, nota: number | null, is_calculated?: boolean }>
                } = { 1: [], 2: [], 3: [] }

                // Build a map of all grades for this discipline (by component ID)
                const notasMapByComponentId: Record<string, number> = {}
                notasData?.filter(n => componentesDisciplina.some(c => c.id === n.componente_id))
                    .forEach(n => {
                        notasMapByComponentId[n.componente_id] = n.valor
                    })

                // Process each trimester separately
                for (let t = 1; t <= 3; t++) {
                    const componentesDoTrimestre = componentesDisciplina
                        .filter(comp => comp.trimestre === t)
                        .filter(comp => selectedComponents.length === 0 || selectedComponents.includes(comp.codigo_componente))

                    // Build notas map for this trimester (by component code)
                    const notasMapTrimestre: Record<string, number> = {}
                    componentesDoTrimestre.forEach(comp => {
                        const nota = notasMapByComponentId[comp.id]
                        if (nota !== undefined) {
                            notasMapTrimestre[comp.codigo_componente] = nota
                        }
                    })

                    // STEP 1: TRIMESTRAL — só a fórmula configurada pelo utilizador
                    componentesDoTrimestre.forEach(comp => {
                        if (!(comp.is_calculated && comp.formula_expression)) return
                        if (!(comp.tipo_calculo === 'trimestral' || !comp.tipo_calculo)) return

                        const calculatedValue = evaluateConfiguredComponent(comp, {
                            gradesByCode: notasMapTrimestre,
                            components: componentesDoTrimestre,
                            trimestre: t,
                        })
                        if (calculatedValue !== null) {
                            notasMapTrimestre[comp.codigo_componente] = calculatedValue
                        }
                    })

                    // Add components to the trimester array
                    // IMPORTANT: Skip annual calculated components here - they will be added later after calculation
                    componentesDoTrimestre.forEach(comp => {
                        // Skip annual calculated components (like MFD, MF) - they'll be added in the annual calculation block
                        if (comp.is_calculated && comp.tipo_calculo === 'anual') {
                            console.log(`[TERMO DEBUG] Skipping annual component ${comp.codigo_componente} in initial loop - will be added after calculation`)
                            return
                        }

                        const nota = notasMapTrimestre[comp.codigo_componente] ?? null
                        componentesPorTrimestre[t as 1 | 2 | 3].push({
                            codigo: comp.codigo_componente,
                            nome: comp.nome,
                            nota: nota,
                            is_calculated: comp.is_calculated || false
                        })
                    })
                }

                // STEP 2: Calculate ANNUAL calculated components (like MFD, MF)
                // These need values from all trimesters
                const annualComponents = componentesDisciplina.filter(c =>
                    c.is_calculated && c.tipo_calculo === 'anual'
                )

                console.log(`[TERMO DEBUG] Disciplina: ${disciplina.nome}`)
                console.log(`[TERMO DEBUG] Total components:`, componentesDisciplina.length)
                console.log(`[TERMO DEBUG] Annual components found:`, annualComponents.length, annualComponents.map(c => c.codigo_componente))
                console.log(`[TERMO DEBUG] All components:`, componentesDisciplina.map(c => ({
                    codigo: c.codigo_componente,
                    is_calculated: c.is_calculated,
                    tipo_calculo: c.tipo_calculo
                })))

                if (annualComponents.length > 0) {
                    const gradesByTrimestre: GradesByTrimestre = { 1: {}, 2: {}, 3: {} }

                    notasData?.filter(n => componentesDisciplina.some(c => c.id === n.componente_id))
                        .forEach(n => {
                            const comp = componentesDisciplina.find(c => c.id === n.componente_id)
                            if (!comp) return
                            const t = Number(comp.trimestre) || Number(n.trimestre) || 1
                            if (!gradesByTrimestre[t]) gradesByTrimestre[t] = {}
                            gradesByTrimestre[t][comp.codigo_componente] = n.valor
                        })

                    for (let t = 1; t <= 3; t++) {
                        componentesPorTrimestre[t as 1 | 2 | 3].forEach(comp => {
                            if (comp.nota !== null && comp.is_calculated) {
                                gradesByTrimestre[t][comp.codigo] = comp.nota
                            }
                        })
                    }

                    annualComponents.forEach(comp => {
                        const roundedValue = evaluateConfiguredComponent(comp, {
                            gradesByTrimestre,
                            components: componentesDisciplina,
                        })
                        if (roundedValue !== null) {
                            const t = Number(comp.trimestre) || 3
                            if (!gradesByTrimestre[t]) gradesByTrimestre[t] = {}
                            gradesByTrimestre[t][comp.codigo_componente] = roundedValue

                            const shouldDisplay = selectedComponents.length === 0 || selectedComponents.includes(comp.codigo_componente)
                            if (shouldDisplay) {
                                componentesPorTrimestre[comp.trimestre as 1 | 2 | 3].push({
                                    codigo: comp.codigo_componente,
                                    nome: comp.nome,
                                    nota: roundedValue,
                                    is_calculated: true
                                })
                            }
                        }
                    })
                }

                // Calculate grade for each trimestre
                for (let t = 1; t <= 3; t++) {
                    const componentesTrimestre = componentesDisciplina.filter(c => c.trimestre === t)
                    const notasTrimestre = notasData?.filter(n =>
                        n.trimestre === t &&
                        componentesTrimestre.some(c => c.id === n.componente_id)
                    ) || []

                    if (notasTrimestre.length > 0 && componentesTrimestre.length > 0) {
                        const resultado = calculateNotaFinal(notasTrimestre, componentesTrimestre)
                        notasTrimestrais[t as 1 | 2 | 3] = resultado.nota_final
                    }
                }

                // Calculate final grade: prefer MFD/MF value if available, otherwise average of trimesters
                let notaFinal: number | null = null

                // Look for MFD or MF in the 3rd trimester components
                const mfdComponent = componentesPorTrimestre[3].find(c => c.codigo === 'MFD' || c.codigo === 'MF')
                if (mfdComponent && mfdComponent.nota !== null) {
                    notaFinal = mfdComponent.nota
                } else {
                    // Fallback to average of available trimester grades
                    const notasValidas = Object.values(notasTrimestrais).filter(n => n !== null) as number[]
                    notaFinal = notasValidas.length > 0
                        ? notasValidas.reduce((sum, n) => sum + n, 0) / notasValidas.length
                        : null
                }

                // Pass/fail RAA por subsistema: Primário ≥5 · Secundário ≥10
                const limiarTransicao = getApprovalThreshold(turmaData.nivel_ensino)
                const transita = notaFinal !== null && notaFinal >= limiarTransicao

                console.log(`[TERMO DEBUG] Final componentesPorTrimestre[3] for ${disciplina.nome}:`, componentesPorTrimestre[3].map(c => `${c.codigo}=${c.nota}`))

                return {
                    id: disciplina.id,
                    nome: disciplina.nome,
                    codigo_disciplina: disciplina.codigo_disciplina,
                    notas_trimestrais: notasTrimestrais,
                    componentesPorTrimestre: componentesPorTrimestre,
                    nota_final: notaFinal,
                    classificacao: notaFinal !== null
                        ? getClassificacao(notaFinal, turmaData.nivel_ensino)
                        : 'N/A',
                    transita
                }
            })

            // Calculate overall statistics
            const notasFinaisValidas = disciplinasProcessadas
                .map(d => d.nota_final)
                .filter(n => n !== null) as number[]

            const mediaGeral = notasFinaisValidas.length > 0
                ? notasFinaisValidas.reduce((sum, n) => sum + n, 0) / notasFinaisValidas.length
                : 0

            const disciplinasAprovadas = disciplinasProcessadas.filter(d => d.transita).length
            const disciplinasReprovadas = disciplinasProcessadas.filter(d => !d.transita).length

            // Transição geral: notas + frequência mínima (66,67%) via classifyStudent
            const transicao = resolveTransicaoTermo(
                disciplinasProcessadas,
                turmaData.nivel_ensino,
                turmaData.nome,
                alunoData.frequencia_anual
            )

            // Load escola info (optional)
            const { data: escolaData } = await supabase
                .from('escolas')
                .select('nome, provincia, municipio')
                .limit(1)
                .single()

            setTermoFrequenciaData({
                aluno: {
                    numero_processo: alunoData.numero_processo,
                    nome_completo: alunoData.nome_completo,
                    data_nascimento: alunoData.data_nascimento,
                    genero: alunoData.genero,
                    nacionalidade: alunoData.nacionalidade,
                    naturalidade: alunoData.naturalidade,
                    tipo_documento: alunoData.tipo_documento,
                    numero_documento: alunoData.numero_documento,
                    nome_pai: alunoData.nome_pai,
                    nome_mae: alunoData.nome_mae,
                    nome_encarregado: alunoData.nome_encarregado,
                    parentesco_encarregado: alunoData.parentesco_encarregado,
                    telefone_encarregado: alunoData.telefone_encarregado,
                    email_encarregado: alunoData.email_encarregado,
                    profissao_encarregado: alunoData.profissao_encarregado,
                    provincia: alunoData.provincia,
                    municipio: alunoData.municipio,
                    bairro: alunoData.bairro,
                    rua: alunoData.rua,
                    endereco: alunoData.endereco,
                    ano_ingresso: alunoData.ano_ingresso,
                    escola_anterior: alunoData.escola_anterior,
                    classe_anterior: alunoData.classe_anterior,
                    observacoes_academicas: alunoData.observacoes_academicas,
                    frequencia_anual: alunoData.frequencia_anual,
                    tipo_exame: alunoData.tipo_exame,
                },
                turma: turmaData,
                disciplinas: disciplinasProcessadas,
                estatisticas: {
                    media_geral: mediaGeral,
                    total_disciplinas: disciplinasProcessadas.length,
                    disciplinas_aprovadas: disciplinasAprovadas,
                    disciplinas_reprovadas: disciplinasReprovadas,
                    transita: transicao.transita,
                    observacao_padronizada: transicao.observacao_padronizada,
                    motivo_retencao: transicao.motivo_retencao,
                    matricula_condicional: transicao.matricula_condicional
                },
                escola: escolaData || undefined
            })

            console.log('Termo data loaded successfully')

        } catch (err) {
            console.error('Error in loadTermoFrequenciaData:', err)
            const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados do termo de frequência'
            setError(translateError(errorMessage))
            setTermoFrequenciaData(null)
        } finally {
            setLoadingTermo(false)
        }
    }, [selectedAluno, selectedTurma, selectedComponents])

    const buildBoletimForAluno = useCallback(async (
        alunoId: string,
        turmaId: string,
        trimestreSel: 1 | 2 | 3
    ): Promise<BoletimNotasData> => {
        const { data: alunoData, error: alunoError } = await supabase
            .from('alunos')
            .select(`
                id, numero_processo, nome_completo, data_nascimento, genero,
                nome_encarregado, telefone_encarregado
            `)
            .eq('id', alunoId)
            .single()
        if (alunoError) throw alunoError

        const { data: turmaData, error: turmaError } = await supabase
            .from('turmas')
            .select('id, nome, ano_lectivo, codigo_turma, nivel_ensino, escola_id')
            .eq('id', turmaId)
            .single()
        if (turmaError) throw turmaError

        const { data: disciplinasData, error: disciplinasError } = await supabase
            .from('disciplinas')
            .select('id, nome, codigo_disciplina')
            .eq('turma_id', turmaId)
            .order('ordem')
        if (disciplinasError) throw disciplinasError
        if (!disciplinasData || disciplinasData.length === 0) {
            throw new Error('Nenhuma disciplina encontrada para esta turma')
        }

        const { data: componentesData, error: componentesError } = await supabase
            .from('componentes_avaliacao')
            .select('id, codigo_componente, nome, peso_percentual, trimestre, disciplina_id, is_calculated, formula_expression, depends_on_components, tipo_calculo')
            .eq('turma_id', turmaId)
            .eq('trimestre', trimestreSel)
            .in('disciplina_id', disciplinasData.map(d => d.id))
        if (componentesError) throw componentesError

        const { data: notasData, error: notasError } = await supabase
            .from('notas')
            .select('componente_id, valor, trimestre')
            .eq('aluno_id', alunoId)
            .eq('turma_id', turmaId)
            .eq('trimestre', trimestreSel)
        if (notasError) throw notasError

        const limiar = getApprovalThreshold(turmaData.nivel_ensino)
        const isPrimary = limiar === 5

        const disciplinasProcessadas = disciplinasData.map(disciplina => {
            const componentesDisciplina = (componentesData || []).filter(c => c.disciplina_id === disciplina.id)
            // Exclude annual-only calculated components from trimestral boletim (MF/MFD etc.)
            const componentesTrimestre = componentesDisciplina.filter(c =>
                !(c.is_calculated && c.tipo_calculo === 'anual')
            )

            const notasMapById: Record<string, number> = {}
            notasData?.filter(n => componentesTrimestre.some(c => c.id === n.componente_id))
                .forEach(n => { notasMapById[n.componente_id] = n.valor })

            const notasMapByCode: Record<string, number> = {}
            componentesTrimestre.forEach(comp => {
                if (notasMapById[comp.id] !== undefined) {
                    notasMapByCode[comp.codigo_componente] = notasMapById[comp.id]
                }
            })

            // Calculate trimestral formula components from user config (tipo_calculo + formula_expression)
            componentesTrimestre.forEach(comp => {
                if (!(comp.is_calculated && comp.formula_expression)) return
                if (!(comp.tipo_calculo === 'trimestral' || !comp.tipo_calculo)) return
                if (Object.keys(notasMapByCode).length === 0) return

                const calculatedValue = evaluateConfiguredComponent(comp, {
                    gradesByCode: notasMapByCode,
                    components: componentesTrimestre,
                    trimestre: trimestreSel,
                })
                if (calculatedValue !== null) {
                    notasMapByCode[comp.codigo_componente] = calculatedValue
                }
            })

            const componentes = componentesTrimestre.map(comp => ({
                codigo: comp.codigo_componente,
                nome: comp.nome,
                nota: notasMapByCode[comp.codigo_componente] ?? null,
                is_calculated: comp.is_calculated || false
            }))

            // Prefer calculated MT / NF / MF for the trimester as the headline grade
            const preferCodes = ['MT', 'NF', 'MF', 'MFD', 'MEDIA', 'MÉDIA']
            let notaTrimestral: number | null = null
            for (const code of preferCodes) {
                const found = componentes.find(c => c.codigo.toUpperCase() === code && c.nota !== null)
                if (found) {
                    notaTrimestral = found.nota
                    break
                }
            }
            if (notaTrimestral === null) {
                // Prefer any calculated component value already resolved
                const calculatedWithNota = componentes.find(c => c.is_calculated && c.nota !== null)
                if (calculatedWithNota) {
                    notaTrimestral = calculatedWithNota.nota
                } else {
                    const notasParaCalculo = notasData?.filter(n =>
                        componentesTrimestre.some(c => c.id === n.componente_id)
                    ) || []
                    if (notasParaCalculo.length > 0 && componentesTrimestre.length > 0) {
                        const resultado = calculateNotaFinal(notasParaCalculo, componentesTrimestre)
                        notaTrimestral = resultado.nota_final
                    }
                }
            }

            const aprovado = notaTrimestral !== null && notaTrimestral >= limiar
            let classificacao = 'N/A'
            if (notaTrimestral !== null) {
                classificacao = getClassificacao(notaTrimestral, turmaData.nivel_ensino)
            }

            return {
                id: disciplina.id,
                nome: disciplina.nome,
                codigo_disciplina: disciplina.codigo_disciplina,
                componentes,
                nota_trimestral: notaTrimestral,
                classificacao,
                aprovado
            }
        })

        const notasValidas = disciplinasProcessadas
            .map(d => d.nota_trimestral)
            .filter((n): n is number => n !== null)
        const mediaGeral = notasValidas.length > 0
            ? notasValidas.reduce((sum, n) => sum + n, 0) / notasValidas.length
            : 0

        let escolaInfo: BoletimNotasData['escola']
        const escolaId = turmaData.escola_id
            || escolaProfile?.id
            || secretarioProfile?.escola_id
            || professorProfile?.escola_id
        if (escolaId) {
            const { data: escolaData } = await supabase
                .from('escolas')
                .select('nome, provincia, municipio')
                .eq('id', escolaId)
                .single()
            if (escolaData) escolaInfo = escolaData
        }

        return {
            aluno: {
                numero_processo: alunoData.numero_processo,
                nome_completo: alunoData.nome_completo,
                data_nascimento: alunoData.data_nascimento,
                genero: alunoData.genero,
                nome_encarregado: alunoData.nome_encarregado,
                telefone_encarregado: alunoData.telefone_encarregado,
            },
            turma: {
                nome: turmaData.nome,
                ano_lectivo: turmaData.ano_lectivo,
                codigo_turma: turmaData.codigo_turma,
                nivel_ensino: turmaData.nivel_ensino,
            },
            trimestre: trimestreSel,
            disciplinas: disciplinasProcessadas,
            estatisticas: {
                media_geral: mediaGeral,
                total_disciplinas: disciplinasProcessadas.length,
                disciplinas_aprovadas: disciplinasProcessadas.filter(d => d.aprovado).length,
                disciplinas_reprovadas: disciplinasProcessadas.filter(d => d.nota_trimestral !== null && !d.aprovado).length,
                limiar_aprovacao: limiar,
                is_primary: isPrimary,
            },
            escola: escolaInfo,
        }
    }, [escolaProfile, secretarioProfile, professorProfile])

    const loadBoletimNotasData = useCallback(async () => {
        if (!selectedAluno || !selectedTurma) return
        try {
            setLoadingBoletim(true)
            setError(null)
            const data = await buildBoletimForAluno(selectedAluno, selectedTurma, boletimTrimestre)
            setBoletimData(data)
        } catch (err) {
            console.error('Error in loadBoletimNotasData:', err)
            const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar boletim de notas'
            setError(translateError(errorMessage))
            setBoletimData(null)
        } finally {
            setLoadingBoletim(false)
        }
    }, [selectedAluno, selectedTurma, boletimTrimestre, buildBoletimForAluno])

    useEffect(() => {
        loadTurmas()
    }, [selectedEscola]) // Re-run when escola changes (for Direção Municipal)

    // Reset turma when escola changes
    useEffect(() => {
        if (isDirecaoMunicipal) {
            setSelectedTurma('')
            setSelectedTurmaData(null)
            setDisciplinas([])
            setSelectedDisciplina('')
        }
    }, [selectedEscola, isDirecaoMunicipal])

    useEffect(() => {
        if (selectedTurma) {
            loadTurmaDetails()
            loadDisciplinas()
        } else {
            setSelectedTurmaData(null)
            setDisciplinas([])
            setSelectedDisciplina('')
        }
    }, [selectedTurma])

    // Reset selections when switching between Primary/Secondary education
    useEffect(() => {
        if (isPrimaryEducation) {
            // For Primary Education, default to trimestre 1 (no 'all' option)
            if (trimestre === 'all') {
                setTrimestre(1)
            }
        } else {
            // For Secondary Education, reset discipline if 'all' was selected (not valid for Secondary)
            if (selectedDisciplina === 'all') {
                setSelectedDisciplina('')
            }
        }
    }, [isPrimaryEducation])

    useEffect(() => {
        if (selectedTurma && selectedDisciplina) {
            loadMiniPautaData()
        } else {
            setMiniPautaData(null)
        }
    }, [selectedTurma, selectedDisciplina, trimestre])

    useEffect(() => {
        loadHeaderConfiguration()
        loadColorConfiguration()
    }, [selectedTurma])

    useEffect(() => {
        if (selectedTurma && (activeTab === 'termo-frequencia' || activeTab === 'boletim-notas')) {
            loadAlunos()
        } else {
            setAlunos([])
            setSelectedAluno('')
            setTermoFrequenciaData(null)
            setBoletimData(null)
        }
    }, [selectedTurma, activeTab, loadAlunos])

    useEffect(() => {
        if (selectedTurma && selectedAluno && activeTab === 'termo-frequencia') {
            loadTermoFrequenciaData()
        } else if (activeTab !== 'termo-frequencia') {
            setTermoFrequenciaData(null)
        }
    }, [selectedTurma, selectedAluno, activeTab, loadTermoFrequenciaData])

    useEffect(() => {
        if (selectedTurma && selectedAluno && activeTab === 'boletim-notas') {
            loadBoletimNotasData()
        } else if (activeTab !== 'boletim-notas') {
            setBoletimData(null)
        }
    }, [selectedTurma, selectedAluno, activeTab, boletimTrimestre, loadBoletimNotasData])



    const loadTurmas = async () => {
        try {
            if (isProfessor && professorProfile) {
                console.log('📊 ReportsPage: Loading turmas for professor:', professorProfile.id)

                // Try NEW MODEL first: Get turmas via turma_professores
                const { data: turmaProfsData, error: turmaProfsError } = await supabase
                    .from('turma_professores')
                    .select(`
                        turma_id,
                        turmas!inner (
                            id,
                            nome,
                            ano_lectivo,
                            codigo_turma,
                            nivel_ensino
                        )
                    `)
                    .eq('professor_id', professorProfile.id)

                console.log('📊 ReportsPage: Turma_professores query result:', {
                    count: turmaProfsData?.length || 0,
                    error: turmaProfsError
                })

                let turmasData: any[] = []

                if (!turmaProfsError && turmaProfsData && turmaProfsData.length > 0) {
                    // NEW MODEL: Extract unique turmas from turma_professores
                    console.log('✅ ReportsPage: Using NEW model (turma_professores)')
                    const turmasMap = new Map()
                    turmaProfsData.forEach(tp => {
                        const turma = tp.turmas as any
                        if (!turmasMap.has(turma.id)) {
                            turmasMap.set(turma.id, {
                                id: turma.id,
                                nome: turma.nome,
                                ano_lectivo: turma.ano_lectivo,
                                codigo_turma: turma.codigo_turma,
                                nivel_ensino: turma.nivel_ensino
                            })
                        }
                    })
                    turmasData = Array.from(turmasMap.values())
                } else {
                    // OLD MODEL fallback: Get turmas via disciplinas
                    console.log('⚠️ ReportsPage: Falling back to OLD model (disciplinas.professor_id)')

                    const { data, error } = await supabase
                        .from('disciplinas')
                        .select(`
                            turma_id,
                            turmas!inner (
                                id,
                                nome,
                                ano_lectivo,
                                codigo_turma,
                                nivel_ensino
                            )
                        `)
                        .eq('professor_id', professorProfile.id)

                    if (error) throw error

                    // Extract unique turmas
                    const turmasMap = new Map()
                    data?.forEach(disc => {
                        const turma = disc.turmas as any
                        if (!turmasMap.has(turma.id)) {
                            turmasMap.set(turma.id, {
                                id: turma.id,
                                nome: turma.nome,
                                ano_lectivo: turma.ano_lectivo,
                                codigo_turma: turma.codigo_turma,
                                nivel_ensino: turma.nivel_ensino
                            })
                        }
                    })

                    turmasData = Array.from(turmasMap.values())

                    console.log('📊 ReportsPage: Old model query result:', {
                        count: turmasData.length
                    })
                }

                setTurmas(turmasData)
                console.log('✅ ReportsPage: Loaded', turmasData.length, 'turmas')
            } else if (escolaProfile || secretarioProfile) {
                // For escola or secretario: load all turmas for this escola
                console.log('📊 ReportsPage: Loading turmas for escola/secretario')

                const escolaId = escolaProfile?.id || secretarioProfile?.escola_id

                const { data, error } = await supabase
                    .from('turmas')
                    .select('id, nome, ano_lectivo, codigo_turma, nivel_ensino')
                    .eq('escola_id', escolaId)
                    .order('nome')

                if (error) throw error
                setTurmas(data || [])
                console.log('✅ ReportsPage: Loaded', data?.length || 0, 'turmas for escola')
            } else if (isDirecaoMunicipal && direcaoMunicipalProfile) {
                // For Direção Municipal: load escolas from municipio, then turmas from selected escola
                console.log('📊 ReportsPage: Loading data for Direção Municipal:', direcaoMunicipalProfile.municipio)

                // First, load escolas from this municipio
                const { data: escolasData, error: escolasError } = await supabase
                    .from('escolas')
                    .select('id, nome, codigo_escola')
                    .eq('municipio', direcaoMunicipalProfile.municipio)
                    .eq('ativo', true)
                    .order('nome')

                if (escolasError) throw escolasError
                setEscolas(escolasData || [])
                console.log('✅ ReportsPage: Loaded', escolasData?.length || 0, 'escolas for municipio')

                // If an escola is selected, load its turmas
                if (selectedEscola) {
                    const { data: turmasData, error: turmasError } = await supabase
                        .from('turmas')
                        .select('id, nome, ano_lectivo, codigo_turma, nivel_ensino')
                        .eq('escola_id', selectedEscola)
                        .order('nome')

                    if (turmasError) throw turmasError
                    setTurmas(turmasData || [])
                    console.log('✅ ReportsPage: Loaded', turmasData?.length || 0, 'turmas for selected escola')
                } else {
                    // No escola selected yet - clear turmas
                    setTurmas([])
                }
            } else {
                console.error('❌ ReportsPage: No profile found')
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar turmas'
            console.error('❌ ReportsPage: Error loading turmas:', err)
            setError(translateError(errorMessage))
        }
    }

    const loadTurmaDetails = async () => {
        try {
            const { data, error } = await supabase
                .from('turmas')
                .select('id, nome, ano_lectivo, codigo_turma, nivel_ensino')
                .eq('id', selectedTurma)
                .single()

            if (error) throw error
            setSelectedTurmaData(data)
        } catch (err) {
            console.error('Error loading turma details:', err)
        }
    }

    const loadDisciplinas = async () => {
        try {
            let disciplinasData: any[] = []

            if (isProfessor && professorProfile) {
                console.log('📊 ReportsPage: Loading disciplinas for professor:', professorProfile.id, 'turma:', selectedTurma)

                // Try NEW MODEL first: Get disciplinas via turma_professores
                const { data: turmaProfsData, error: turmaProfsError } = await supabase
                    .from('turma_professores')
                    .select(`
                        disciplina_id,
                        disciplinas!inner (
                            id,
                            nome,
                            codigo_disciplina,
                            ordem
                        )
                    `)
                    .eq('professor_id', professorProfile.id)
                    .eq('turma_id', selectedTurma)

                console.log('📊 ReportsPage: Turma_professores disciplinas query result:', {
                    count: turmaProfsData?.length || 0,
                    error: turmaProfsError
                })

                if (!turmaProfsError && turmaProfsData && turmaProfsData.length > 0) {
                    // NEW MODEL: Extract disciplinas from turma_professores
                    console.log('✅ ReportsPage: Using NEW model (turma_professores)')
                    disciplinasData = turmaProfsData.map(tp => tp.disciplinas)
                } else {
                    // OLD MODEL fallback: Query disciplinas directly
                    console.log('⚠️ ReportsPage: Falling back to OLD model (disciplinas.professor_id)')

                    const { data, error } = await supabase
                        .from('disciplinas')
                        .select('id, nome, codigo_disciplina, ordem')
                        .eq('turma_id', selectedTurma)
                        .eq('professor_id', professorProfile.id)
                        .order('ordem')

                    if (error) throw error
                    disciplinasData = data || []

                    console.log('📊 ReportsPage: Old model disciplinas query result:', {
                        count: disciplinasData.length
                    })
                }

                setDisciplinas(disciplinasData)
                console.log('✅ ReportsPage: Loaded', disciplinasData.length, 'disciplinas')
            } else {
                // For escola: load all disciplinas for the turma
                let query = supabase
                    .from('disciplinas')
                    .select('id, nome, codigo_disciplina, ordem')
                    .eq('turma_id', selectedTurma)

                const { data, error } = await query.order('ordem')

                if (error) throw error
                disciplinasData = data || []
                setDisciplinas(disciplinasData)
            }

            // Auto-select first discipline
            if (disciplinasData && disciplinasData.length > 0 && !selectedDisciplina) {
                setSelectedDisciplina(disciplinasData[0].id)
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar disciplinas'
            console.error('❌ ReportsPage: Error loading disciplinas:', err)
            setError(translateError(errorMessage))
        }
    }

    const loadMiniPautaData = async () => {
        try {
            setLoadingData(true)
            setError(null)

            // Load turma details
            const { data: turmaData, error: turmaError } = await supabase
                .from('turmas')
                .select('id, nome, ano_lectivo, codigo_turma, nivel_ensino')
                .eq('id', selectedTurma)
                .single()

            if (turmaError) throw turmaError

            // Extract classe from turma name (e.g., "10ª Classe A" -> "10ª Classe")
            const extractClasse = (turmaName: string): string | undefined => {
                const match = turmaName.match(/(\d+[ªº]\s*Classe)/i)
                return match ? match[1] : undefined
            }
            const classe = extractClasse(turmaData.nome)

            // Check if this is "All Disciplines" mode for Primary Education
            const isAllDisciplines = selectedDisciplina === 'all'
            const isPrimary = turmaData.nivel_ensino?.toLowerCase().includes('primário') ||
                turmaData.nivel_ensino?.toLowerCase().includes('primario')

            // Load disciplina details (skip if all disciplines mode)
            let disciplinaData: any = null
            if (!isAllDisciplines) {
                const { data, error: disciplinaError } = await supabase
                    .from('disciplinas')
                    .select('id, nome, codigo_disciplina')
                    .eq('id', selectedDisciplina)
                    .single()

                if (disciplinaError) throw disciplinaError
                disciplinaData = data
            } else {
                // For "all disciplines" mode, create a placeholder
                disciplinaData = {
                    id: 'all',
                    nome: 'Todas as Disciplinas',
                    codigo_disciplina: 'ALL'
                }
            }

            // Load componentes based on mode
            let componentesData: any[]

            if (isAllDisciplines && isPrimary) {
                // PRIMARY EDUCATION - ALL DISCIPLINES MODE
                // Load components from ALL disciplines for the selected trimestre
                const { data, error: componentesError } = await supabase
                    .from('componentes_avaliacao')
                    .select(`
                        id, 
                        codigo_componente,
                        disciplina_id,
                        nome, 
                        peso_percentual, 
                        trimestre,
                        ordem,
                        is_calculated, 
                        formula_expression, 
                        depends_on_components,
                        disciplinas!inner(nome, ordem)
                    `)
                    .eq('turma_id', selectedTurma)
                    .eq('trimestre', trimestre)
                    .order('disciplinas(ordem)')
                    .order('ordem')

                if (componentesError) throw componentesError

                console.log('🔍 Dados RAW do Supabase:', data?.slice(0, 2).map(c => ({
                    codigo: c.codigo_componente,
                    disciplinas_obj: c.disciplinas
                })))

                // Map the nested disciplina name and ordem to flat properties
                componentesData = (data || []).map((comp: any) => ({
                    ...comp,
                    disciplina_nome: comp.disciplinas?.nome,
                    disciplina_ordem: comp.disciplinas?.ordem
                }))
                console.log('📊 ReportsPage (All Disciplines): Componentes carregados:', componentesData.map(c => ({ nome: c.disciplina_nome, ordem: c.disciplina_ordem, codigo: c.codigo_componente })))
            } else if (trimestre === 'all') {
                // Load ALL components from all trimesters (including calculated components for display in reports)
                const { data, error: componentesError } = await supabase
                    .from('componentes_avaliacao')
                    .select(`
                        id, 
                        codigo_componente, 
                        nome, 
                        peso_percentual, 
                        trimestre,
                        ordem,
                        is_calculated, 
                        formula_expression, 
                        depends_on_components,
                        tipo_calculo,
                        disciplinas!inner(nome, ordem)
                    `)
                    .eq('disciplina_id', selectedDisciplina)
                    .eq('turma_id', selectedTurma)
                    .order('trimestre')
                    .order('ordem')

                if (componentesError) throw componentesError
                // Map the nested disciplina name and ordem to flat properties
                componentesData = (data || []).map((comp: any) => ({
                    ...comp,
                    disciplina_nome: comp.disciplinas?.nome,
                    disciplina_ordem: comp.disciplinas?.ordem
                }))
                console.log('📊 ReportsPage (trimestre=all): Componentes carregados:', componentesData.map(c => ({ nome: c.disciplina_nome, ordem: c.disciplina_ordem, codigo: c.codigo_componente })))
            } else {
                // Load components for specific trimestre (including calculated components for display in reports)
                const { data, error: componentesError } = await supabase
                    .from('componentes_avaliacao')
                    .select(`
                        id, 
                        codigo_componente, 
                        nome, 
                        peso_percentual, 
                        trimestre,
                        ordem,
                        is_calculated, 
                        formula_expression, 
                        depends_on_components,
                        tipo_calculo,
                        disciplinas!inner(nome, ordem)
                    `)
                    .eq('disciplina_id', selectedDisciplina)
                    .eq('turma_id', selectedTurma)
                    .eq('trimestre', trimestre)
                    .order('ordem')

                if (componentesError) throw componentesError
                // Map the nested disciplina name and ordem to flat properties
                componentesData = (data || []).map((comp: any) => ({
                    ...comp,
                    disciplina_nome: comp.disciplinas?.nome,
                    disciplina_ordem: comp.disciplinas?.ordem
                }))
                console.log('📊 ReportsPage (trimestre específico): Componentes carregados:', componentesData.map(c => ({ nome: c.disciplina_nome, ordem: c.disciplina_ordem, codigo: c.codigo_componente })))
            }

            if (!componentesData || componentesData.length === 0) {
                setError('Nenhum componente de avaliação configurado para esta disciplina')
                setMiniPautaData(null)
                return
            }


            // Load alunos
            const { data: alunosData, error: alunosError } = await supabase
                .from('alunos')
                .select('id, numero_processo, nome_completo, genero')
                .eq('turma_id', selectedTurma)
                .eq('ativo', true)
                .order('nome_completo')

            if (alunosError) throw alunosError

            if (!alunosData || alunosData.length === 0) {
                setError('Nenhum aluno encontrado nesta turma')
                setMiniPautaData(null)
                return
            }

            // Cálculos vêm exclusivamente de tipo_calculo + formula_expression
            // em componentes_avaliacao (configurados pelo utilizador nos Templates).

            // Handle ALL DISCIPLINES mode (Primary Education)
            if (isAllDisciplines && isPrimary) {
                // Load notas for all components in the selected trimestre
                const { data: notasData, error: notasError } = await supabase
                    .from('notas')
                    .select('aluno_id, componente_id, valor')
                    .eq('turma_id', selectedTurma)
                    .eq('trimestre', trimestre)
                    .in('componente_id', componentesData.map(c => c.id))

                if (notasError) throw notasError

                // Process data: organize by student with all disciplines
                const alunosComNotas = alunosData.map(aluno => {
                    const notasAluno = notasData?.filter(n => n.aluno_id === aluno.id) || []

                    // Build notas map by component ID (not code, since codes can repeat across disciplines)
                    const notasMap: Record<string, number> = {}
                    notasAluno.forEach(nota => {
                        const componente = componentesData.find(c => c.id === nota.componente_id)
                        if (componente) {
                            // Use component ID as key to avoid conflicts
                            notasMap[componente.id] = nota.valor
                        }
                    })

                    // Calculate values for calculated components
                    // Sort components: non-calculated first, then calculated (to ensure dependencies are available)
                    const sortedComponentes = [...componentesData].sort((a, b) => {
                        if (a.is_calculated && !b.is_calculated) return 1
                        if (!a.is_calculated && b.is_calculated) return -1
                        return 0
                    })

                    sortedComponentes.forEach(componente => {
                        if (!(componente.is_calculated && componente.formula_expression)) return
                        // Neste modo (um trimestre) só aplicamos fórmulas trimestrais;
                        // anuais exigem MT1/MT2/MT3 e são resolvidas no modo por disciplina.
                        if (componente.tipo_calculo === 'anual') return

                        const compsDisc = componentesData.filter(
                            (c) => c.disciplina_id === componente.disciplina_id
                        )
                        const gradesByCode: Record<string, number> = {}
                        compsDisc.forEach((c) => {
                            if (notasMap[c.id] !== undefined) {
                                gradesByCode[c.codigo_componente] = notasMap[c.id]
                            }
                        })

                        const calculatedValue = evaluateConfiguredComponent(componente, {
                            gradesByCode,
                            components: compsDisc,
                            trimestre: Number(trimestre) || undefined,
                        })
                        if (calculatedValue !== null) {
                            notasMap[componente.id] = calculatedValue
                        }
                    })

                    return {
                        numero_processo: aluno.numero_processo,
                        nome_completo: aluno.nome_completo,
                        genero: aluno.genero as 'M' | 'F' | undefined,
                        notas: notasMap,
                        nota_final: undefined,
                        classificacao: 'N/A',
                        aprovado: false
                    }
                })

                // Calculate statistics (using average of all component grades)
                const notasFinais = alunosComNotas.map(a => {
                    const notas = Object.values(a.notas).filter(n => n > 0)
                    return notas.length > 0 ? notas.reduce((sum, n) => sum + n, 0) / notas.length : 0
                }).filter(n => n > 0)
                const estatisticas = calculateStatistics(notasFinais, turmaData.nivel_ensino)

                // Load escola info (optional)
                const { data: escolaData } = await supabase
                    .from('escolas')
                    .select('nome, provincia, municipio')
                    .limit(1)
                    .single()

                setMiniPautaData({
                    turma: turmaData,
                    disciplina: disciplinaData,
                    trimestre,
                    nivel_ensino: turmaData.nivel_ensino,
                    classe,
                    alunos: alunosComNotas,
                    componentes: componentesData,
                    estatisticas,
                    escola: escolaData || undefined
                })

            } else if (trimestre === 'all') {
                // Load notas from all trimestres
                const { data: allNotasData, error: notasError } = await supabase
                    .from('notas')
                    .select('aluno_id, componente_id, valor, trimestre')
                    .eq('turma_id', selectedTurma)
                    .in('componente_id', componentesData.map(c => c.id))
                    .in('trimestre', [1, 2, 3])

                if (notasError) throw notasError

                // Process data: organize by trimestre with component grades
                const alunosComNotas = alunosData.map(aluno => {
                    const trimestres: any = {}
                    const nfPorTrimestre: Record<number, number> = {}

                    // Process each trimestre
                    for (let t = 1; t <= 3; t++) {
                        // Get components for this specific trimestre
                        const componentesTrimestre = componentesData.filter(c => c.trimestre === t)

                        const notasTrimestre = allNotasData?.filter(
                            n => n.aluno_id === aluno.id && n.trimestre === t
                        ) || []

                        // Build notas map by component code for this trimestre
                        const notasMap: Record<string, number> = {}
                        notasTrimestre.forEach(nota => {
                            const componente = componentesTrimestre.find(c => c.id === nota.componente_id)
                            if (componente) {
                                notasMap[componente.codigo_componente] = nota.valor
                            }
                        })

                        // TRIMESTRAL: strictly from user formula_expression + tipo_calculo
                        componentesTrimestre.forEach(componente => {
                            if (!(componente.is_calculated && componente.formula_expression)) return
                            if (!(componente.tipo_calculo === 'trimestral' || !componente.tipo_calculo)) return

                            const calculatedValue = evaluateConfiguredComponent(componente, {
                                gradesByCode: notasMap,
                                components: componentesTrimestre,
                                trimestre: t,
                            })
                            if (calculatedValue !== null) {
                                notasMap[componente.codigo_componente] = calculatedValue
                            }
                        })

                        // Calculate NF for this trimestre using only its components
                        let nf = 0
                        if (notasTrimestre.length > 0 && componentesTrimestre.length > 0) {
                            const resultado = calculateNotaFinal(notasTrimestre, componentesTrimestre)
                            nf = resultado.nota_final
                        }

                        console.log(`[DEBUG T${t}] Final notasMap before assignment:`, notasMap)
                        trimestres[t] = {
                            notas: notasMap,
                            nota_final: nf
                        }

                        nfPorTrimestre[t] = nf
                    }

                    // Now process ANNUAL calculated components (like MF / MFD)
                    // These can access components from all trimesters (MT1/MT2/MT3 or T1/T2/T3)
                    const componentesAnuais = componentesData.filter(c =>
                        c.is_calculated && c.tipo_calculo === 'anual'
                    )

                    const gradesByTrimestre: GradesByTrimestre = {
                        1: trimestres[1]?.notas || {},
                        2: trimestres[2]?.notas || {},
                        3: trimestres[3]?.notas || {},
                    }

                    componentesAnuais.forEach(componente => {
                        const calculatedValue = evaluateConfiguredComponent(componente, {
                            gradesByTrimestre,
                            components: componentesData,
                        })
                        if (calculatedValue !== null && trimestres[componente.trimestre]) {
                            trimestres[componente.trimestre].notas[componente.codigo_componente] = calculatedValue
                        }
                    })

                    // MF is no longer calculated automatically
                    // It should be configured as a calculated component if needed

                    return {
                        numero_processo: aluno.numero_processo,
                        nome_completo: aluno.nome_completo,
                        genero: aluno.genero as 'M' | 'F' | undefined,
                        notas: {}, // Not used in all-trimester mode
                        nota_final: undefined, // Will be calculated if MF component exists
                        media_trimestral: null,
                        classificacao: 'N/A', // Will be determined by MF component if configured
                        aprovado: false, // Will be determined by MF component if configured
                        trimestres // Contains data for each trimestre
                    }
                })

                // Calculate statistics based on MF if available, otherwise use average of trimester NFs
                const notasFinais = alunosComNotas.map(a => {
                    if (a.nota_final !== undefined && a.nota_final !== null) {
                        return a.nota_final
                    }
                    // Fallback: calculate average of available trimester NFs
                    const nfs: number[] = []
                    if (a.trimestres) {
                        for (let t = 1; t <= 3; t++) {
                            const trimestre = a.trimestres[t as 1 | 2 | 3]
                            if (trimestre && trimestre.nota_final > 0) {
                                nfs.push(trimestre.nota_final)
                            }
                        }
                    }
                    return nfs.length > 0 ? nfs.reduce((sum, n) => sum + n, 0) / nfs.length : 0
                }).filter(n => n > 0)
                const estatisticas = calculateStatistics(notasFinais, turmaData.nivel_ensino)

                // Load escola info (optional)
                const { data: escolaData } = await supabase
                    .from('escolas')
                    .select('nome, provincia, municipio')
                    .limit(1)
                    .single()

                setMiniPautaData({
                    turma: turmaData,
                    disciplina: disciplinaData,
                    trimestre: 'all',
                    nivel_ensino: turmaData.nivel_ensino,
                    classe,
                    alunos: alunosComNotas,
                    componentes: componentesData,
                    estatisticas,
                    showMT: false,
                    escola: escolaData || undefined
                })

            } else {
                // Handle SINGLE TRIMESTRE mode (existing logic)

                // Check if we have any ANNUAL calculated components that need dependencies from other trimesters
                const annualComponents = componentesData.filter(c =>
                    c.is_calculated && c.tipo_calculo === 'anual'
                )

                // If we have annual components, we need to load their dependencies from ALL trimesters
                let allDependencyComponents: any[] = []
                let allDependencyNotas: any[] = []

                if (annualComponents.length > 0) {
                    const allDependencyIds = new Set<string>()
                    annualComponents.forEach(comp => {
                        if (comp.depends_on_components?.length) {
                            comp.depends_on_components.forEach((depId: string) => {
                                allDependencyIds.add(depId)
                            })
                        }
                    })

                    // When depends_on is empty (common in templates/seed), load same-discipline
                    // components across all trimesters so MT1/MT2/MT3 and T1/T2/T3 can resolve.
                    const disciplinaIds = [...new Set(
                        annualComponents
                            .map((c: any) => c.disciplina_id)
                            .filter(Boolean)
                    )]

                    let depQuery = supabase
                        .from('componentes_avaliacao')
                        .select(`
                                id, 
                                codigo_componente, 
                                nome, 
                                peso_percentual, 
                                trimestre, 
                                disciplina_id,
                                is_calculated, 
                                formula_expression, 
                                depends_on_components,
                                tipo_calculo
                            `)
                        .eq('turma_id', selectedTurma)

                    if (allDependencyIds.size > 0) {
                        depQuery = depQuery.in('id', Array.from(allDependencyIds))
                    } else if (disciplinaIds.length > 0) {
                        depQuery = depQuery.in('disciplina_id', disciplinaIds)
                    }

                    const { data: depComponentsData, error: depError } = await depQuery

                    if (!depError && depComponentsData?.length) {
                        // Prefer non-annual deps (MT/MAC/NPT); keep annual ones only if explicitly linked
                        allDependencyComponents = depComponentsData.filter((c: any) =>
                            allDependencyIds.size > 0
                                ? allDependencyIds.has(c.id)
                                : !(c.is_calculated && c.tipo_calculo === 'anual')
                        )

                        if (allDependencyComponents.length > 0) {
                            const { data: depNotasData, error: depNotasError } = await supabase
                                .from('notas')
                                .select('aluno_id, componente_id, valor, trimestre')
                                .eq('turma_id', selectedTurma)
                                .in('componente_id', allDependencyComponents.map((c: any) => c.id))

                            if (!depNotasError && depNotasData) {
                                allDependencyNotas = depNotasData
                            }
                        }
                    }
                }

                // Load grades for the current trimester's components
                const { data: notasData, error: notasError } = await supabase
                    .from('notas')
                    .select('aluno_id, componente_id, valor')
                    .eq('turma_id', selectedTurma)
                    .eq('trimestre', trimestre)
                    .in('componente_id', componentesData.map(c => c.id))

                if (notasError) throw notasError

                // Process data
                const alunosComNotas = alunosData.map(aluno => {
                    const notasAluno = notasData?.filter(n => n.aluno_id === aluno.id) || []

                    // Build notas map by component code
                    const notasMap: Record<string, number> = {}
                    notasAluno.forEach(nota => {
                        const componente = componentesData.find(c => c.id === nota.componente_id)
                        if (componente) {
                            notasMap[componente.codigo_componente] = nota.valor
                        }
                    })

                    // STEP 1: TRIMESTRAL — formula_expression + tipo_calculo do utilizador
                    componentesData.forEach(componente => {
                        if (!(componente.is_calculated && componente.formula_expression)) return
                        if (!(componente.tipo_calculo === 'trimestral' || !componente.tipo_calculo)) return

                        const calculatedValue = evaluateConfiguredComponent(componente, {
                            gradesByCode: notasMap,
                            components: componentesData,
                            trimestre: Number(trimestre) || undefined,
                        })
                        if (calculatedValue !== null) {
                            notasMap[componente.codigo_componente] = calculatedValue
                        }
                    })

                    // STEP 2: ANUAL — mesma regra; contexto = notas dos 3 trimestres
                    if (annualComponents.length > 0 && allDependencyComponents.length > 0) {
                        const depNotasAluno = allDependencyNotas.filter(n => n.aluno_id === aluno.id)
                        const gradesByTrimestre: GradesByTrimestre = { 1: {}, 2: {}, 3: {} }

                        depNotasAluno.forEach(nota => {
                            const depComponent = allDependencyComponents.find(c => c.id === nota.componente_id)
                            if (!depComponent) return
                            const t = Number(depComponent.trimestre) || Number(nota.trimestre) || 1
                            if (!gradesByTrimestre[t]) gradesByTrimestre[t] = {}
                            gradesByTrimestre[t][depComponent.codigo_componente] = nota.valor
                        })

                        ;[1, 2, 3].forEach((t) => {
                            const compsT = allDependencyComponents.filter(
                                (c: any) => Number(c.trimestre) === t && (c.tipo_calculo === 'trimestral' || !c.tipo_calculo)
                            )
                            compsT.forEach((depComp: any) => {
                                const map = gradesByTrimestre[t] || {}
                                const calculatedValue = evaluateConfiguredComponent(depComp, {
                                    gradesByCode: map,
                                    components: compsT,
                                    trimestre: t,
                                })
                                if (calculatedValue !== null) {
                                    gradesByTrimestre[t][depComp.codigo_componente] = calculatedValue
                                }
                            })
                        })

                        const currentT = Number(trimestre) || 1
                        if (!gradesByTrimestre[currentT]) gradesByTrimestre[currentT] = {}
                        Object.entries(notasMap).forEach(([code, value]) => {
                            gradesByTrimestre[currentT][code] = value as number
                        })

                        annualComponents.forEach(componente => {
                            const calculatedValue = evaluateConfiguredComponent(componente, {
                                gradesByTrimestre,
                                components: allDependencyComponents,
                            })
                            if (calculatedValue !== null) {
                                notasMap[componente.codigo_componente] = calculatedValue
                            }
                        })
                    }

                    // Calculate final grade (classificação RAA por subsistema)
                    const resultado = calculateNotaFinal(notasAluno, componentesData, turmaData.nivel_ensino)

                    return {
                        numero_processo: aluno.numero_processo,
                        nome_completo: aluno.nome_completo,
                        genero: aluno.genero as 'M' | 'F' | undefined,
                        notas: notasMap,
                        nota_final: resultado.nota_final,
                        classificacao: resultado.classificacao,
                        aprovado: resultado.aprovado,
                        media_trimestral: null
                    }
                })

                // Calculate statistics
                const notasFinais = alunosComNotas.map(a => a.nota_final)
                const estatisticas = calculateStatistics(notasFinais, turmaData.nivel_ensino)

                // MT is no longer calculated automatically
                // It should be configured as a calculated component if needed

                // Load escola info (optional)
                const { data: escolaData } = await supabase
                    .from('escolas')
                    .select('nome, provincia, municipio')
                    .limit(1)
                    .single()

                setMiniPautaData({
                    turma: turmaData,
                    disciplina: disciplinaData,
                    trimestre,
                    nivel_ensino: turmaData.nivel_ensino,
                    classe,
                    alunos: alunosComNotas,
                    componentes: componentesData,
                    estatisticas,
                    escola: escolaData || undefined
                })
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados'
            setError(translateError(errorMessage))
            setMiniPautaData(null)
        } finally {
            setLoadingData(false)
        }
    }

    const loadHeaderConfiguration = async () => {
        try {
            // Get escola_id from auth context
            let escola_id: string | undefined

            if (escolaProfile) {
                // For school admins, use their escola_id
                escola_id = escolaProfile.id
            } else if (professorProfile) {
                // For professors, use their escola_id
                escola_id = professorProfile.escola_id
            } else if (secretarioProfile) {
                // For secretaries, use their escola_id
                escola_id = secretarioProfile.escola_id
            }

            if (!escola_id) {
                console.error('No escola_id found in auth context')
                return
            }

            const config = await loadHeaderConfig(escola_id)
            setHeaderConfig(config)
        } catch (err) {
            console.error('Error loading header config:', err)
        }
    }

    const loadColorConfiguration = async () => {
        try {
            console.log('Loading color configuration for turma:', selectedTurma)
            const config = await loadGradeColorConfig(selectedTurma || undefined)
            console.log('Loaded color config:', config)
            setColorConfig(config)
        } catch (err) {
            console.error('Error loading color config:', err)
        }
    }




    const handleGeneratePDF = async () => {
        if (!miniPautaData) {
            setError('Carregue os dados primeiro')
            return
        }

        try {
            await generateMiniPautaPDF(miniPautaData, headerConfig, colorConfig)
            setSuccess('PDF gerado com sucesso!')
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao gerar PDF'
            setError(translateError(errorMessage))
        }
    }

    const handleGenerateExcel = () => {
        if (!miniPautaData) {
            setError('Carregue os dados primeiro')
            return
        }

        try {
            generateMiniPautaExcel(miniPautaData)
            setSuccess('Excel gerado com sucesso!')
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao gerar Excel'
            setError(translateError(errorMessage))
        }
    }

    const handleExportCSV = () => {
        if (!miniPautaData) {
            setError('Carregue os dados primeiro')
            return
        }

        try {
            generateCSV(miniPautaData)
            setSuccess('CSV exportado com sucesso!')
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao exportar CSV'
            setError(translateError(errorMessage))
        }
    }

    const handleGenerateTermoFrequenciaPDF = async () => {
        if (!termoFrequenciaData) {
            setError('Carregue os dados do aluno primeiro')
            return
        }

        try {
            await generateTermoFrequenciaPDF(termoFrequenciaData, headerConfig, colorConfig)
            setSuccess('Termo de Frequência gerado com sucesso!')
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao gerar Termo de Frequência'
            setError(translateError(errorMessage))
        }
    }

    const handleGenerateBoletimPDF = async () => {
        if (!boletimData) {
            setError('Carregue os dados do boletim primeiro')
            return
        }
        try {
            await generateBoletimNotasPDF(boletimData, headerConfig, colorConfig)
            setSuccess('Boletim de Notas gerado com sucesso!')
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao gerar Boletim de Notas'
            setError(translateError(errorMessage))
        }
    }

    const handleGenerateBatchBoletins = async () => {
        if (!selectedTurma || selectedAlunosIds.length === 0) {
            setError('Seleccione pelo menos um aluno')
            return
        }
        try {
            setBatchGenerating(true)
            setError(null)
            const boletins: BoletimNotasData[] = []
            for (let i = 0; i < selectedAlunosIds.length; i++) {
                const alunoId = selectedAlunosIds[i]
                const alunoInfo = alunos.find(a => a.id === alunoId)
                setBatchProgress({
                    current: i + 1,
                    total: selectedAlunosIds.length,
                    currentAluno: alunoInfo?.nome_completo || 'Aluno'
                })
                const data = await buildBoletimForAluno(alunoId, selectedTurma, boletimTrimestre)
                boletins.push(data)
            }
            await generateBatchBoletinsZip(boletins, headerConfig, colorConfig, (current, total, alunoNome) => {
                setBatchProgress({ current, total, currentAluno: alunoNome })
            })
            setSuccess(`${boletins.length} boletim(ns) gerado(s) com sucesso!`)
            setTimeout(() => setSuccess(null), 4000)
            setSelectedAlunosIds([])
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao gerar boletins em lote'
            setError(translateError(errorMessage))
        } finally {
            setBatchGenerating(false)
            setBatchProgress(null)
        }
    }

    const handleSelectAllAlunos = () => {
        if (selectedAlunosIds.length === alunos.length) {
            // Deselect all
            setSelectedAlunosIds([])
        } else {
            // Select all
            setSelectedAlunosIds(alunos.map(a => a.id))
        }
    }

    const handleToggleAluno = (alunoId: string) => {
        if (selectedAlunosIds.includes(alunoId)) {
            setSelectedAlunosIds(selectedAlunosIds.filter(id => id !== alunoId))
        } else {
            setSelectedAlunosIds([...selectedAlunosIds, alunoId])
        }
    }

    // Component selection handlers
    const handleToggleComponent = (componentCode: string) => {
        if (selectedComponents.includes(componentCode)) {
            setSelectedComponents(selectedComponents.filter(c => c !== componentCode))
        } else {
            setSelectedComponents([...selectedComponents, componentCode])
        }
    }

    const handleSelectAllComponents = () => {
        if (selectedComponents.length === availableComponents.length) {
            setSelectedComponents([])
        } else {
            setSelectedComponents(availableComponents.map(c => c.codigo))
        }
    }

    // Component reordering handlers
    const moveComponentUp = (index: number) => {
        if (index === 0) return
        const newComponents = [...availableComponents]
        const temp = newComponents[index]
        newComponents[index] = newComponents[index - 1]
        newComponents[index - 1] = temp
        setAvailableComponents(newComponents)
    }

    const moveComponentDown = (index: number) => {
        if (index === availableComponents.length - 1) return
        const newComponents = [...availableComponents]
        const temp = newComponents[index]
        newComponents[index] = newComponents[index + 1]
        newComponents[index + 1] = temp
        setAvailableComponents(newComponents)
    }

    const handleGenerateBatchPDFs = async () => {
        if (selectedAlunosIds.length === 0) {
            setError('Selecione pelo menos um aluno')
            return
        }

        if (!selectedTurmaData) {
            setError('Dados da turma não encontrados')
            return
        }

        try {
            setBatchGenerating(true)
            setError(null)
            setBatchProgress({ current: 0, total: selectedAlunosIds.length, currentAluno: '' })

            // Load data for all selected students
            const termosDataPromises = selectedAlunosIds.map(async (alunoId) => {
                // Load student details with all expanded fields
                const { data: alunoData, error: alunoError } = await supabase
                    .from('alunos')
                    .select(`
                        id, numero_processo, nome_completo, data_nascimento, genero,
                        nacionalidade, naturalidade, tipo_documento, numero_documento,
                        nome_pai, nome_mae, nome_encarregado, parentesco_encarregado,
                        telefone_encarregado, email_encarregado, profissao_encarregado,
                        provincia, municipio, bairro, rua, endereco,
                        ano_ingresso, escola_anterior, classe_anterior, observacoes_academicas,
                        frequencia_anual, tipo_exame
                    `)
                    .eq('id', alunoId)
                    .single()

                if (alunoError) throw alunoError

                // Load all disciplines for this turma
                const { data: disciplinasData, error: disciplinasError } = await supabase
                    .from('disciplinas')
                    .select('id, nome, codigo_disciplina')
                    .eq('turma_id', selectedTurma)
                    .order('ordem')

                if (disciplinasError) throw disciplinasError

                // Load all components (including calculated ones that are registered)
                const { data: componentesData, error: componentesError } = await supabase
                    .from('componentes_avaliacao')
                    .select('id, codigo_componente, nome, peso_percentual, trimestre, disciplina_id, is_calculated, formula_expression, depends_on_components')
                    .eq('turma_id', selectedTurma)
                    .in('disciplina_id', disciplinasData.map(d => d.id))

                if (componentesError) throw componentesError

                // Load all grades
                const { data: notasData, error: notasError } = await supabase
                    .from('notas')
                    .select('componente_id, valor, trimestre')
                    .eq('aluno_id', alunoId)
                    .eq('turma_id', selectedTurma)

                if (notasError) throw notasError

                // Process disciplines (same logic as loadTermoFrequenciaData)
                const disciplinasProcessadas = disciplinasData.map(disciplina => {
                    const componentesDisciplina = componentesData?.filter(c => c.disciplina_id === disciplina.id) || []
                    const notasTrimestrais: { 1: number | null, 2: number | null, 3: number | null } = {
                        1: null,
                        2: null,
                        3: null
                    }

                    // Process components BY TRIMESTRE - each trimester has its own components
                    const componentesPorTrimestre: {
                        1: Array<{ codigo: string, nome: string, nota: number | null, is_calculated?: boolean }>,
                        2: Array<{ codigo: string, nome: string, nota: number | null, is_calculated?: boolean }>,
                        3: Array<{ codigo: string, nome: string, nota: number | null, is_calculated?: boolean }>
                    } = { 1: [], 2: [], 3: [] }

                    for (let t = 1; t <= 3; t++) {
                        const componentesTrimestre = componentesDisciplina.filter(c => c.trimestre === t)
                        const notasTrimestre = notasData?.filter(n =>
                            n.trimestre === t &&
                            componentesTrimestre.some(c => c.id === n.componente_id)
                        ) || []

                        if (notasTrimestre.length > 0 && componentesTrimestre.length > 0) {
                            const resultado = calculateNotaFinal(notasTrimestre, componentesTrimestre)
                            notasTrimestrais[t as 1 | 2 | 3] = resultado.nota_final
                        }

                        // Add components for this trimester
                        componentesTrimestre.forEach(comp => {
                            const nota = notasData?.find(n => n.componente_id === comp.id && n.trimestre === t)?.valor ?? null
                            componentesPorTrimestre[t as 1 | 2 | 3].push({
                                codigo: comp.codigo_componente,
                                nome: comp.nome,
                                nota: nota,
                                is_calculated: comp.is_calculated || false
                            })
                        })
                    }

                    const notasValidas = Object.values(notasTrimestrais).filter(n => n !== null) as number[]
                    const notaFinal = notasValidas.length > 0
                        ? notasValidas.reduce((sum, n) => sum + n, 0) / notasValidas.length
                        : null

                    // Pass/fail RAA por subsistema: Primário ≥5 · Secundário ≥10
                    const limiarTransicao = getApprovalThreshold(selectedTurmaData.nivel_ensino)
                    const transita = notaFinal !== null && notaFinal >= limiarTransicao

                    return {
                        id: disciplina.id,
                        nome: disciplina.nome,
                        codigo_disciplina: disciplina.codigo_disciplina,
                        notas_trimestrais: notasTrimestrais,
                        componentesPorTrimestre: componentesPorTrimestre,
                        nota_final: notaFinal,
                        classificacao: notaFinal !== null
                            ? getClassificacao(notaFinal, selectedTurmaData.nivel_ensino)
                            : 'N/A',
                        transita
                    }
                })

                const notasFinaisValidas = disciplinasProcessadas
                    .map(d => d.nota_final)
                    .filter(n => n !== null) as number[]

                const mediaGeral = notasFinaisValidas.length > 0
                    ? notasFinaisValidas.reduce((sum, n) => sum + n, 0) / notasFinaisValidas.length
                    : 0

                const disciplinasAprovadas = disciplinasProcessadas.filter(d => d.transita).length
                const disciplinasReprovadas = disciplinasProcessadas.filter(d => !d.transita).length

                // Transição geral: notas + frequência mínima (66,67%) via classifyStudent
                const transicao = resolveTransicaoTermo(
                    disciplinasProcessadas,
                    selectedTurmaData.nivel_ensino,
                    selectedTurmaData.nome,
                    alunoData.frequencia_anual
                )

                const { data: escolaData } = await supabase
                    .from('escolas')
                    .select('nome, provincia, municipio')
                    .limit(1)
                    .single()

                return {
                    aluno: {
                        numero_processo: alunoData.numero_processo,
                        nome_completo: alunoData.nome_completo,
                        data_nascimento: alunoData.data_nascimento,
                        genero: alunoData.genero,
                        nacionalidade: alunoData.nacionalidade,
                        naturalidade: alunoData.naturalidade,
                        tipo_documento: alunoData.tipo_documento,
                        numero_documento: alunoData.numero_documento,
                        nome_pai: alunoData.nome_pai,
                        nome_mae: alunoData.nome_mae,
                        nome_encarregado: alunoData.nome_encarregado,
                        parentesco_encarregado: alunoData.parentesco_encarregado,
                        telefone_encarregado: alunoData.telefone_encarregado,
                        email_encarregado: alunoData.email_encarregado,
                        profissao_encarregado: alunoData.profissao_encarregado,
                        provincia: alunoData.provincia,
                        municipio: alunoData.municipio,
                        bairro: alunoData.bairro,
                        rua: alunoData.rua,
                        endereco: alunoData.endereco,
                        ano_ingresso: alunoData.ano_ingresso,
                        escola_anterior: alunoData.escola_anterior,
                        classe_anterior: alunoData.classe_anterior,
                        observacoes_academicas: alunoData.observacoes_academicas,
                        frequencia_anual: alunoData.frequencia_anual,
                        tipo_exame: alunoData.tipo_exame,
                    },
                    turma: selectedTurmaData,
                    disciplinas: disciplinasProcessadas,
                    estatisticas: {
                        media_geral: mediaGeral,
                        total_disciplinas: disciplinasProcessadas.length,
                        disciplinas_aprovadas: disciplinasAprovadas,
                        disciplinas_reprovadas: disciplinasReprovadas,
                        transita: transicao.transita,
                        observacao_padronizada: transicao.observacao_padronizada,
                        motivo_retencao: transicao.motivo_retencao,
                        matricula_condicional: transicao.matricula_condicional
                    },
                    escola: escolaData || undefined
                }
            })

            const termosData = await Promise.all(termosDataPromises)

            // Generate ZIP
            const result = await generateBatchTermosFrequenciaZip(
                termosData,
                { codigo: selectedTurmaData.codigo_turma, ano: selectedTurmaData.ano_lectivo },
                headerConfig,
                colorConfig,
                (current, total, alunoNome) => {
                    setBatchProgress({ current, total, currentAluno: alunoNome })
                }
            )

            // Download ZIP
            const url = URL.createObjectURL(result.blob)
            const link = document.createElement('a')
            link.href = url
            link.download = result.filename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)

            // Show success message
            if (result.errors.length === 0) {
                setSuccess(`✅ ${selectedAlunosIds.length} Termos de Frequência gerados com sucesso!`)
            } else {
                setSuccess(`⚠️ ${selectedAlunosIds.length - result.errors.length} de ${selectedAlunosIds.length} termos gerados com sucesso`)
                setError(`Falhas: ${result.errors.map(e => e.aluno).join(', ')}`)
            }

            setTimeout(() => {
                setSuccess(null)
                setError(null)
            }, 5000)

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao gerar termos em lote'
            setError(translateError(errorMessage))
        } finally {
            setBatchGenerating(false)
            setBatchProgress(null)
        }
    }

    // ─── Mapa de Aproveitamento ─────────────────────────────────────────────
    const loadMapaAproveitamento = async () => {
        if (!selectedTurma && mapaSelectedTurmas.length === 0) {
            setError('Seleccione pelo menos uma turma')
            return
        }

        const turmaIds = mapaSelectedTurmas.length > 0 ? mapaSelectedTurmas : [selectedTurma]

        try {
            setMapaLoading(true)
            setError(null)

            // Load escola data
            let escola_id: string | undefined
            if (escolaProfile) escola_id = escolaProfile.id
            else if (professorProfile) escola_id = professorProfile.escola_id
            else if (secretarioProfile) escola_id = secretarioProfile.escola_id

            const { data: escolaData } = escola_id
                ? await supabase.from('escolas').select('nome, provincia, municipio, codigo_escola').eq('id', escola_id).single()
                : { data: null }

            // Load turmas info (classe is not a DB column — derived from nome)
            const { data: turmasData, error: turmasError } = await supabase
                .from('turmas')
                .select('id, nome, codigo_turma, ano_lectivo, nivel_ensino')
                .in('id', turmaIds)

            if (turmasError) throw turmasError
            if (!turmasData || turmasData.length === 0) throw new Error('Turmas não encontradas')

            const extractClasseFromNome = (turmaName: string): string => {
                const match = turmaName.match(/(\d+[ªº]\s*Classe)/i)
                return match ? match[1] : turmaName
            }

            const anoLectivo = turmasData[0].ano_lectivo

            const turmasProcessadas: MapaAproveitamentoTurmaData[] = []

            for (const turma of turmasData) {
                // Load disciplinas for this turma
                const { data: discData, error: discError } = await supabase
                    .from('disciplinas')
                    .select('id, nome, codigo_disciplina')
                    .eq('turma_id', turma.id)
                    .order('ordem')

                if (discError) throw discError
                if (!discData || discData.length === 0) continue

                // Load all active students with gender
                const { data: alunosData, error: alunosError } = await supabase
                    .from('alunos')
                    .select('id, genero, ativo, frequencia_anual, tipo_exame, observacao_transicao')
                    .eq('turma_id', turma.id)

                if (alunosError) throw alunosError

                const todosAlunos = alunosData || []

                // Load all componentes for this turma
                const { data: compData, error: compError } = await supabase
                    .from('componentes_avaliacao')
                    .select('id, codigo_componente, nome, peso_percentual, trimestre, disciplina_id, is_calculated, formula_expression, depends_on_components, tipo_calculo')
                    .eq('turma_id', turma.id)
                    .in('disciplina_id', discData.map(d => d.id))

                if (compError) throw compError

                // Load notas — filter by trimestre or all
                let notasQuery = supabase
                    .from('notas')
                    .select('aluno_id, componente_id, valor, trimestre')
                    .eq('turma_id', turma.id)

                if (mapaTrimestre !== 'anual') {
                    notasQuery = notasQuery.eq('trimestre', mapaTrimestre)
                }

                const { data: notasData, error: notasError } = await notasQuery
                if (notasError) throw notasError

                // Process each disciplina
                const disciplinasProcessadas = discData.map(disc => {
                    const compDisciplina = (compData || []).filter(c => c.disciplina_id === disc.id)

                    // Find MF or MFD component (the "nota final" component)
                    const mfComp = compDisciplina.find(c =>
                        c.is_calculated &&
                        (c.codigo_componente?.toUpperCase() === 'MF' ||
                            c.codigo_componente?.toUpperCase() === 'MFD' ||
                            c.nome?.toUpperCase().includes('MÉDIA FINAL'))
                    ) || compDisciplina.find(c => c.is_calculated) || compDisciplina[compDisciplina.length - 1]

                    // For each student, compute their final grade for this discipline
                    let aprovadosM = 0, aprovadosF = 0
                    let reprovadosM = 0, reprovadosF = 0
                    let desistentesM = 0, desistentesF = 0
                    let transferidosM = 0, transferidosF = 0
                    let inscritosM = 0, inscritosF = 0
                    let frequentaramM = 0, frequentaramF = 0
                    const notas: number[] = []

                    const limiar = getApprovalThreshold(turma.nivel_ensino)

                    for (const aluno of todosAlunos) {
                        const genM = aluno.genero === 'M'
                        const genF = aluno.genero === 'F'

                        // Inscritos = todos
                        if (genM) inscritosM++
                        else if (genF) inscritosF++

                        // Desistente = inativo com frequencia_anual < 66.67 or tipo_exame=desistente
                        const isDesistente = !aluno.ativo &&
                            (aluno.tipo_exame === 'desistente' ||
                                (aluno.frequencia_anual !== null && aluno.frequencia_anual < 66.67))
                        const isTransferido = !aluno.ativo && !isDesistente

                        if (isDesistente) {
                            if (genM) desistentesM++
                            else if (genF) desistentesF++
                            continue
                        }
                        if (isTransferido) {
                            if (genM) transferidosM++
                            else if (genF) transferidosF++
                            continue
                        }

                        // Active students that frequentaram
                        if (genM) frequentaramM++
                        else if (genF) frequentaramF++

                        // Get grade for this student in this discipline
                        const alunoNotas = (notasData || []).filter(n => n.aluno_id === aluno.id)
                        let notaFinal: number | null = null

                        if (mfComp) {
                            const notaMF = alunoNotas.find(n => n.componente_id === mfComp.id)
                            if (notaMF) notaFinal = notaMF.valor
                        }

                        // If no MF found, use weighted average of components for the discipline/trimestre
                        if (notaFinal === null) {
                            const compsTrim = mapaTrimestre !== 'anual'
                                ? compDisciplina.filter(c => c.trimestre === mapaTrimestre && !c.is_calculated)
                                : compDisciplina.filter(c => !c.is_calculated)

                            const notasTrim = alunoNotas.filter(n => compsTrim.some(c => c.id === n.componente_id))
                            if (notasTrim.length > 0) {
                                const totalPeso = compsTrim.reduce((s, c) => s + (c.peso_percentual || 0), 0)
                                if (totalPeso > 0) {
                                    notaFinal = notasTrim.reduce((s, n) => {
                                        const comp = compsTrim.find(c => c.id === n.componente_id)
                                        return s + n.valor * ((comp?.peso_percentual || 0) / totalPeso)
                                    }, 0)
                                }
                            }
                        }

                        if (notaFinal !== null) {
                            notas.push(notaFinal)
                            const aprovado = Math.round(notaFinal) >= limiar
                            if (aprovado) {
                                if (genM) aprovadosM++
                                else if (genF) aprovadosF++
                            } else {
                                if (genM) reprovadosM++
                                else if (genF) reprovadosF++
                            }
                        } else {
                            // No grade yet — count as reprovado (incomplete)
                            if (genM) reprovadosM++
                            else if (genF) reprovadosF++
                        }
                    }

                    const media = notas.length > 0 ? notas.reduce((a, b) => a + b, 0) / notas.length : null

                    return {
                        id: disc.id,
                        nome: disc.nome,
                        inscritos_m: inscritosM,
                        inscritos_f: inscritosF,
                        frequentaram_m: frequentaramM,
                        frequentaram_f: frequentaramF,
                        aprovados_m: aprovadosM,
                        aprovados_f: aprovadosF,
                        reprovados_m: reprovadosM,
                        reprovados_f: reprovadosF,
                        desistentes_m: desistentesM,
                        desistentes_f: desistentesF,
                        transferidos_m: transferidosM,
                        transferidos_f: transferidosF,
                        media_turma: media
                    }
                })

                turmasProcessadas.push({
                    turma_id: turma.id,
                    turma_nome: turma.nome,
                    turma_codigo: turma.codigo_turma,
                    classe: extractClasseFromNome(turma.nome),
                    nivel_ensino: turma.nivel_ensino || '',
                    disciplinas: disciplinasProcessadas
                })
            }

            setMapaData({
                escola: escolaData || { nome: 'Escola', provincia: '', municipio: '' },
                ano_lectivo: anoLectivo,
                trimestre: mapaTrimestre,
                turmas: turmasProcessadas
            })
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro ao carregar mapa de aproveitamento'
            setError(msg)
        } finally {
            setMapaLoading(false)
        }
    }

    const handleGenerateMapaPDF = async () => {
        if (!mapaData) { setError('Carregue o mapa primeiro'); return }
        try {
            await generateMapaAproveitamentoPDF(mapaData, headerConfig)
            setSuccess('PDF do Mapa de Aproveitamento gerado com sucesso!')
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao gerar PDF')
        }
    }


    return (
        <div className="space-y-4 md:space-y-6 pb-24 md:pb-6">
            {/* Header with Tabs */}
            <div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">Relatórios e Pautas</h2>
                <p className="text-sm md:text-base text-slate-600 mt-1">Gere relatórios e exporte dados das turmas</p>

                {/* Tab Navigation - Modern Pill Style */}
                <div className="mt-4">
                    <nav className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                        <button
                            onClick={() => setActiveTab('mini-pauta')}
                            className={`
                                flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 whitespace-nowrap touch-feedback min-h-touch
                                ${activeTab === 'mini-pauta'
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/25'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95'
                                }
                            `}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Mini-Pauta
                        </button>
                        {!isProfessor && (
                            <>
                                <button
                                    onClick={() => setActiveTab('pauta-geral')}
                                    className={`
                                        flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 whitespace-nowrap touch-feedback min-h-touch
                                        ${activeTab === 'pauta-geral'
                                            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/25'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95'
                                        }
                                    `}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Pauta-Geral
                                </button>
                                <button
                                    onClick={() => setActiveTab('termo-frequencia')}
                                    className={`
                                        flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 whitespace-nowrap touch-feedback min-h-touch
                                        ${activeTab === 'termo-frequencia'
                                            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/25'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95'
                                        }
                                    `}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    Termo de Frequência
                                </button>
                                <button
                                    onClick={() => setActiveTab('boletim-notas')}
                                    className={`
                                        flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 whitespace-nowrap touch-feedback min-h-touch
                                        ${activeTab === 'boletim-notas'
                                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-500/25'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95'
                                        }
                                    `}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Boletim de Notas
                                </button>
                                <button
                                    onClick={() => setActiveTab('mapa-aproveitamento')}
                                    className={`
                                        flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 whitespace-nowrap touch-feedback min-h-touch
                                        ${activeTab === 'mapa-aproveitamento'
                                            ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-500/25'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95'
                                        }
                                    `}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    Mapa de Aproveitamento
                                </button>
                                <button
                                    onClick={() => setActiveTab('conselho-notas')}
                                    className={`
                                        flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 whitespace-nowrap touch-feedback min-h-touch
                                        ${activeTab === 'conselho-notas'
                                            ? 'bg-gradient-to-r from-slate-700 to-blue-800 text-white shadow-md shadow-slate-500/25'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95'
                                        }
                                    `}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    Conselho de Notas
                                </button>
                            </>
                        )}
                    </nav>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'mini-pauta' ? (
                <div className="space-y-4 md:space-y-6">{/* Mini-Pauta Content */}

                    {/* Messages */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                            <span className="text-sm">{error}</span>
                        </div>
                    )}
                    {success && (
                        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
                            <span className="text-sm">{success}</span>
                        </div>
                    )}

                    {/* Filters */}
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-base md:text-lg font-semibold text-slate-900">Filtros</h3>
                                </div>
                                {selectedTurma && !isProfessor && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                            onClick={() => setShowOrdenarDisciplinasModal(true)}
                                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-all duration-200 touch-feedback"
                                        >
                                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                            </svg>
                                            <span className="hidden sm:inline">Ordenar</span>
                                        </button>
                                        <button
                                            onClick={() => setShowColorConfigModal(true)}
                                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-all duration-200 touch-feedback"
                                        >
                                            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                            </svg>
                                            <span className="hidden sm:inline">Cores</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardBody className="p-3 md:p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                                {/* Escola filter - only for Direção Municipal */}
                                {isDirecaoMunicipal && (
                                    <div>
                                        <label className="form-label">Escola</label>
                                        <select
                                            value={selectedEscola}
                                            onChange={(e) => setSelectedEscola(e.target.value)}
                                            className="form-input min-h-touch"
                                        >
                                            <option value="">Seleccione uma escola</option>
                                            {escolas.map((escola) => (
                                                <option key={escola.id} value={escola.id}>
                                                    {escola.nome}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label className="form-label">Turma</label>
                                    <select
                                        value={selectedTurma}
                                        onChange={(e) => setSelectedTurma(e.target.value)}
                                        className="form-input min-h-touch"
                                        disabled={isDirecaoMunicipal && !selectedEscola}
                                    >
                                        <option value="">{isDirecaoMunicipal && !selectedEscola ? 'Seleccione primeiro uma escola' : 'Seleccione uma turma'}</option>
                                        {turmas.map((turma) => (
                                            <option key={turma.id} value={turma.id}>
                                                {turma.nome} - {turma.ano_lectivo}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="form-label">Disciplina</label>
                                    <select
                                        value={selectedDisciplina}
                                        onChange={(e) => setSelectedDisciplina(e.target.value)}
                                        className="form-input min-h-touch"
                                        disabled={!selectedTurma || disciplinas.length === 0}
                                    >
                                        <option value="">Selecione uma disciplina</option>
                                        {/* For Primary Education, show "All Disciplines" option */}
                                        {isPrimaryEducation && (
                                            <option value="all">Todas as Disciplinas</option>
                                        )}
                                        {disciplinas.map((disciplina) => (
                                            <option key={disciplina.id} value={disciplina.id}>
                                                {disciplina.nome}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="form-label">Trimestre</label>
                                    <select
                                        value={trimestre}
                                        onChange={(e) => {
                                            const value = e.target.value
                                            setTrimestre(value === 'all' ? 'all' : parseInt(value) as 1 | 2 | 3)
                                        }}
                                        className="form-input min-h-touch"
                                    >
                                        <option value={1}>1º Trimestre</option>
                                        <option value={2}>2º Trimestre</option>
                                        <option value={3}>3º Trimestre</option>
                                        {/* For Secondary Education, show "All Trimesters" option */}
                                        {!isPrimaryEducation && (
                                            <option value="all">Todos os Trimestres</option>
                                        )}
                                    </select>
                                </div>

                                <div className="flex items-end">
                                    <button
                                        onClick={loadMiniPautaData}
                                        disabled={!selectedTurma || !selectedDisciplina || loadingData}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-xl transition-all duration-200 shadow-md shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none min-h-touch touch-feedback"
                                    >
                                        {loadingData ? (
                                            <>
                                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Carregando...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                </svg>
                                                Carregar Dados
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    {/* Statistics */}
                    {miniPautaData && (
                        <TurmaStatistics statistics={miniPautaData.estatisticas} />
                    )}

                    {/* Preview */}
                    {miniPautaData && (
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-base md:text-lg font-semibold text-slate-900">Preview da Mini-Pauta</h3>
                                            <p className="text-xs md:text-sm text-slate-500 hidden sm:block">
                                                {miniPautaData.disciplina.nome} • {miniPautaData.trimestre === 'all' ? 'Todos os Trimestres' : `${miniPautaData.trimestre}º Trimestre`}
                                            </p>
                                        </div>
                                    </div>
                                    {/* Action Buttons - Responsive */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {/* PDF - Primary Action */}
                                        <button
                                            onClick={handleGeneratePDF}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-medium rounded-xl transition-all duration-200 shadow-md shadow-red-500/25 touch-feedback min-h-touch"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                            <span className="hidden sm:inline">PDF</span>
                                        </button>
                                        {!isProfessor && (
                                            <>
                                                {/* Excel */}
                                                <button
                                                    onClick={handleGenerateExcel}
                                                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-sm font-medium rounded-xl transition-all duration-200 shadow-md shadow-green-500/25 touch-feedback min-h-touch"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    <span className="hidden sm:inline">Excel</span>
                                                </button>
                                                {/* CSV */}
                                                <button
                                                    onClick={handleExportCSV}
                                                    className="flex items-center gap-2 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-all duration-200 touch-feedback min-h-touch"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    <span className="hidden md:inline">CSV</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardBody className="p-0 md:p-4">
                                <MiniPautaPreview data={miniPautaData} loading={loadingData} colorConfig={colorConfig} />
                            </CardBody>
                        </Card>
                    )}

                    {!miniPautaData && !loadingData && selectedTurma && selectedDisciplina && (
                        <Card>
                            <CardBody className="p-8 md:p-12">
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <h4 className="text-base font-semibold text-slate-700 mb-2">Pronto para carregar</h4>
                                    <p className="text-sm text-slate-500 mb-4">Clique em "Carregar Dados" para visualizar a mini-pauta</p>
                                    <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>Os dados serão carregados com base nos filtros selecionados</span>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    )}

                    {/* Ordenar Disciplinas Modal */}
                    {showOrdenarDisciplinasModal && (
                        <OrdenarDisciplinasModal
                            turmaId={selectedTurma}
                            onClose={() => setShowOrdenarDisciplinasModal(false)}
                            onSave={() => {
                                console.log('💾 onSave callback: Recarregando dados após salvar ordenação')
                                console.log('   selectedDisciplina:', selectedDisciplina, 'miniPautaData:', !!miniPautaData)
                                setShowOrdenarDisciplinasModal(false)
                                loadDisciplinas()
                                // Recarregar mini-pauta se estiver sendo exibida
                                if (miniPautaData) {
                                    console.log('🔄 Chamando loadMiniPautaData()...')
                                    loadMiniPautaData()
                                } else {
                                    console.log('⚠️ miniPautaData não existe, não recarregando')
                                }
                            }}
                        />
                    )}

                    {/* Color Configuration Modal */}
                    <ConfiguracaoCoresModal
                        isOpen={showColorConfigModal}
                        onClose={() => setShowColorConfigModal(false)}
                        onSave={async () => {
                            console.log('Color config saved, reloading...')
                            await loadColorConfiguration()
                            setShowColorConfigModal(false)
                        }}
                        currentConfig={colorConfig}
                        nivelEnsino={selectedTurmaData?.nivel_ensino}
                        turmaId={selectedTurma}
                    />
                </div>
            ) : activeTab === 'pauta-geral' ? (
                <PautaGeralPage onGoToConselho={() => setActiveTab('conselho-notas')} />
            ) : activeTab === 'conselho-notas' ? (
                <ConselhoNotasPage initialTurmaId={initialConselhoTurmaId} />
            ) : activeTab === 'mapa-aproveitamento' ? (
                // ── Mapa de Aproveitamento Tab ─────────────────────────────────────────
                <div className="space-y-4 md:space-y-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                            <span className="text-sm">{error}</span>
                        </div>
                    )}
                    {success && (
                        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
                            <span className="text-sm">{success}</span>
                        </div>
                    )}

                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-base md:text-lg font-semibold text-slate-900">Mapa de Aproveitamento</h3>
                                    <p className="text-xs text-slate-500">Estatísticas por disciplina: inscritos, frequência, aprovados, reprovados, desistentes e transferidos — por género</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardBody className="p-3 md:p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Turma selector */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Turma</label>
                                    <select
                                        value={selectedTurma}
                                        onChange={e => { setSelectedTurma(e.target.value); setMapaData(null) }}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    >
                                        <option value="">Seleccionar turma...</option>
                                        {turmas.map(t => (
                                            <option key={t.id} value={t.id}>{t.codigo_turma} — {t.nome} ({t.ano_lectivo})</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Período */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Período</label>
                                    <select
                                        value={mapaTrimestre}
                                        onChange={e => { setMapaTrimestre(e.target.value as any); setMapaData(null) }}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    >
                                        <option value={1}>1º Trimestre</option>
                                        <option value={2}>2º Trimestre</option>
                                        <option value={3}>3º Trimestre</option>
                                        <option value="anual">Anual</option>
                                    </select>
                                </div>

                                {/* Generate button */}
                                <div className="flex items-end">
                                    <Button
                                        onClick={loadMapaAproveitamento}
                                        disabled={!selectedTurma || mapaLoading}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                        {mapaLoading ? (
                                            <span className="flex items-center gap-2">
                                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                                A carregar...
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                Gerar Mapa
                                            </span>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    {/* Preview */}
                    {mapaData && (
                        <>
                            {/* Action buttons */}
                            <div className="flex flex-wrap gap-3 justify-end">
                                <Button
                                    onClick={handleGenerateMapaPDF}
                                    className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Exportar PDF
                                </Button>
                            </div>

                            <MapaAproveitamentoPreview data={mapaData} headerConfig={headerConfig} />
                        </>
                    )}

                    {/* Empty state */}
                    {!mapaData && !mapaLoading && (
                        <Card>
                            <CardBody>
                                <div className="text-center py-12">
                                    <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    <h3 className="mt-2 text-sm font-medium text-slate-900">Mapa de Aproveitamento</h3>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Seleccione uma turma e o período, depois clique em "Gerar Mapa" para visualizar o mapa de aproveitamento escolar.
                                    </p>
                                    <p className="mt-2 text-xs text-slate-400">
                                        O mapa mostra por disciplina: inscritos, frequência, aprovados, reprovados, desistentes e transferidos — desagregados por género (M/F/T).
                                    </p>
                                </div>
                            </CardBody>
                        </Card>
                    )}
                </div>
            ) : activeTab === 'boletim-notas' ? (
                // Boletim de Notas Tab
                <div className="space-y-4 md:space-y-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                            <span className="text-sm">{error}</span>
                        </div>
                    )}
                    {success && (
                        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
                            <span className="text-sm">{success}</span>
                        </div>
                    )}

                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-base md:text-lg font-semibold text-slate-900">Boletim de Notas</h3>
                                    <p className="text-xs text-slate-500">Impressão por trimestre — limiar Primário: 5 · Secundário: 10</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardBody className="p-3 md:p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                                {isDirecaoMunicipal && (
                                    <div>
                                        <label className="form-label">Escola</label>
                                        <select
                                            value={selectedEscola}
                                            onChange={(e) => setSelectedEscola(e.target.value)}
                                            className="form-input min-h-touch"
                                        >
                                            <option value="">Seleccione uma escola</option>
                                            {escolas.map((escola) => (
                                                <option key={escola.id} value={escola.id}>
                                                    {escola.nome}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label className="form-label">Turma</label>
                                    <select
                                        value={selectedTurma}
                                        onChange={(e) => {
                                            setSelectedTurma(e.target.value)
                                            setSelectedAluno('')
                                            setBoletimData(null)
                                        }}
                                        className="form-input min-h-touch"
                                        disabled={isDirecaoMunicipal && !selectedEscola}
                                    >
                                        <option value="">{isDirecaoMunicipal && !selectedEscola ? 'Seleccione primeiro uma escola' : 'Seleccione uma turma'}</option>
                                        {turmas.map((turma) => (
                                            <option key={turma.id} value={turma.id}>
                                                {turma.nome} — {turma.ano_lectivo} ({turma.nivel_ensino})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Aluno</label>
                                    <select
                                        value={selectedAluno}
                                        onChange={(e) => setSelectedAluno(e.target.value)}
                                        disabled={!selectedTurma || alunos.length === 0}
                                        className="form-input min-h-touch"
                                    >
                                        <option value="">Seleccione um aluno</option>
                                        {alunos.map((aluno) => (
                                            <option key={aluno.id} value={aluno.id}>
                                                {aluno.nome_completo} ({aluno.numero_processo})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Trimestre</label>
                                    <select
                                        value={boletimTrimestre}
                                        onChange={(e) => {
                                            setBoletimTrimestre(Number(e.target.value) as 1 | 2 | 3)
                                            setBoletimData(null)
                                        }}
                                        className="form-input min-h-touch"
                                    >
                                        <option value={1}>1º Trimestre</option>
                                        <option value={2}>2º Trimestre</option>
                                        <option value={3}>3º Trimestre</option>
                                    </select>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    {/* Batch generation for boletim */}
                    {selectedTurma && alunos.length > 0 && !batchGenerating && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-base md:text-lg font-semibold text-slate-900">Impressão em Lote</h3>
                                            <p className="text-xs md:text-sm text-slate-500">
                                                Gerar boletins do {boletimTrimestre}º trimestre para vários alunos
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {selectedAlunosIds.length > 0 && (
                                            <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                                                {selectedAlunosIds.length} seleccionados
                                            </span>
                                        )}
                                        <button
                                            onClick={() => setIsBatchGenerationExpanded(!isBatchGenerationExpanded)}
                                            className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
                                        >
                                            <svg
                                                className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${isBatchGenerationExpanded ? 'rotate-180' : ''}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </CardHeader>
                            {isBatchGenerationExpanded && (
                                <CardBody className="p-3 md:p-4">
                                    <div className="mb-4 pb-4 border-b border-slate-200">
                                        <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-100 p-3 rounded-xl transition-all duration-200 touch-feedback min-h-touch">
                                            <input
                                                type="checkbox"
                                                checked={selectedAlunosIds.length === alunos.length && alunos.length > 0}
                                                onChange={handleSelectAllAlunos}
                                                className="w-5 h-5 text-blue-600 border-2 border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                            />
                                            <span className="font-semibold text-slate-900">
                                                {selectedAlunosIds.length === alunos.length && alunos.length > 0 ? 'Desmarcar Todos' : 'Seleccionar Todos'}
                                            </span>
                                        </label>
                                    </div>
                                    <div className="max-h-72 overflow-y-auto space-y-2 mb-4">
                                        {alunos.map((aluno, index) => (
                                            <label
                                                key={aluno.id}
                                                className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-all duration-200 touch-feedback min-h-touch ${
                                                    selectedAlunosIds.includes(aluno.id)
                                                        ? 'bg-indigo-50 border border-indigo-200'
                                                        : 'bg-slate-50 hover:bg-slate-100 border border-transparent'
                                                }`}
                                            >
                                                <div className="w-7 h-7 bg-slate-200 rounded-lg flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                                                    {index + 1}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedAlunosIds.includes(aluno.id)}
                                                    onChange={() => handleToggleAluno(aluno.id)}
                                                    className="w-5 h-5 text-indigo-600 border-2 border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-900 truncate">{aluno.nome_completo}</p>
                                                    <p className="text-xs text-slate-500">Nº {aluno.numero_processo}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="flex justify-end pt-4 border-t border-slate-200">
                                        <button
                                            onClick={handleGenerateBatchBoletins}
                                            disabled={selectedAlunosIds.length === 0}
                                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-medium rounded-xl transition-all duration-200 shadow-md shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed min-h-touch touch-feedback"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Gerar Boletins (ZIP)
                                        </button>
                                    </div>
                                </CardBody>
                            )}
                        </Card>
                    )}

                    {batchGenerating && batchProgress && (
                        <Card>
                            <CardBody>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-slate-900">A gerar boletins...</h3>
                                        <span className="text-sm text-slate-600">
                                            {batchProgress.current} de {batchProgress.total}
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                                        <div
                                            className="bg-indigo-600 h-full transition-all duration-300 ease-out"
                                            style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                                        />
                                    </div>
                                    <p className="text-sm text-slate-600">
                                        A processar: <span className="font-medium text-slate-900">{batchProgress.currentAluno}</span>
                                    </p>
                                </div>
                            </CardBody>
                        </Card>
                    )}

                    {loadingBoletim && (
                        <Card>
                            <CardBody>
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                    <span className="ml-3 text-slate-600">A carregar boletim...</span>
                                </div>
                            </CardBody>
                        </Card>
                    )}

                    {boletimData && !loadingBoletim && (
                        <>
                            <div className="flex flex-wrap gap-3 justify-end">
                                <Button
                                    onClick={handleGenerateBoletimPDF}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Imprimir Boletim (PDF)
                                </Button>
                            </div>
                            <BoletimNotasPreview data={boletimData} colorConfig={colorConfig} />
                        </>
                    )}

                    {!selectedTurma && !loadingBoletim && (
                        <Card>
                            <CardBody>
                                <div className="text-center py-12">
                                    <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <h3 className="mt-2 text-sm font-medium text-slate-900">Boletim de Notas</h3>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Seleccione turma, aluno e trimestre para visualizar e imprimir o boletim.
                                    </p>
                                </div>
                            </CardBody>
                        </Card>
                    )}
                </div>
            ) : (
                // Termo de Frequência Tab
                <div className="space-y-4 md:space-y-6">
                    {/* Messages */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                            <span className="text-sm">{error}</span>
                        </div>
                    )}
                    {success && (
                        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
                            <span className="text-sm">{success}</span>
                        </div>
                    )}

                    {/* Filters */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <h3 className="text-base md:text-lg font-semibold text-slate-900">Selecionar Aluno</h3>
                            </div>
                        </CardHeader>
                        <CardBody className="p-3 md:p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                                {/* Escola filter - only for Direção Municipal */}
                                {isDirecaoMunicipal && (
                                    <div>
                                        <label className="form-label">Escola</label>
                                        <select
                                            value={selectedEscola}
                                            onChange={(e) => setSelectedEscola(e.target.value)}
                                            className="form-input min-h-touch"
                                        >
                                            <option value="">Seleccione uma escola</option>
                                            {escolas.map((escola) => (
                                                <option key={escola.id} value={escola.id}>
                                                    {escola.nome}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {/* Turma Selection */}
                                <div>
                                    <label className="form-label">Turma</label>
                                    <select
                                        value={selectedTurma}
                                        onChange={(e) => {
                                            setSelectedTurma(e.target.value)
                                            setSelectedAluno('')
                                            setTermoFrequenciaData(null)
                                        }}
                                        className="form-input min-h-touch"
                                        disabled={isDirecaoMunicipal && !selectedEscola}
                                    >
                                        <option value="">{isDirecaoMunicipal && !selectedEscola ? 'Seleccione primeiro uma escola' : 'Seleccione uma turma'}</option>
                                        {turmas.map((turma) => (
                                            <option key={turma.id} value={turma.id}>
                                                {turma.nome} - {turma.ano_lectivo}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Student Selection */}
                                <div>
                                    <label className="form-label">Aluno</label>
                                    <select
                                        value={selectedAluno}
                                        onChange={(e) => setSelectedAluno(e.target.value)}
                                        disabled={!selectedTurma || alunos.length === 0}
                                        className="form-input min-h-touch"
                                    >
                                        <option value="">Selecione um aluno</option>
                                        {alunos.map((aluno) => (
                                            <option key={aluno.id} value={aluno.id}>
                                                {aluno.nome_completo} ({aluno.numero_processo})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    {/* Component Selection Section */}
                    {selectedTurma && availableComponents.length > 0 && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-base md:text-lg font-semibold text-slate-900">Componentes a Exibir</h3>
                                            <p className="text-xs md:text-sm text-slate-500">Selecione quais componentes mostrar no termo</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {selectedComponents.length > 0 && (
                                            <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                                                {selectedComponents.length}/{availableComponents.length}
                                            </span>
                                        )}
                                        <button
                                            onClick={() => setIsComponentsExpanded(!isComponentsExpanded)}
                                            className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
                                        >
                                            <svg
                                                className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${isComponentsExpanded ? 'rotate-180' : ''}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </CardHeader>
                            {isComponentsExpanded && (
                                <CardBody className="p-3 md:p-4">
                                    {/* Select All Components */}
                                    <div className="mb-4 pb-4 border-b border-slate-200">
                                        <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-100 p-3 rounded-xl transition-all duration-200 touch-feedback min-h-touch">
                                            <input
                                                type="checkbox"
                                                checked={selectedComponents.length === availableComponents.length}
                                                onChange={handleSelectAllComponents}
                                                className="w-5 h-5 text-purple-600 border-2 border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 cursor-pointer"
                                            />
                                            <div className="flex-1">
                                                <span className="font-semibold text-slate-900">
                                                    {selectedComponents.length === availableComponents.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                                                </span>
                                                <span className="ml-2 text-sm text-slate-500">
                                                    ({selectedComponents.length} de {availableComponents.length} selecionados)
                                                </span>
                                            </div>
                                        </label>
                                    </div>

                                    {/* Individual Component Checkboxes - Reorderable List */}
                                    <div className="space-y-2">
                                        {availableComponents.map((component, index) => (
                                            <div
                                                key={component.codigo}
                                                className={`
                                                flex items-center gap-2 p-3 rounded-xl transition-all duration-200
                                                ${selectedComponents.includes(component.codigo)
                                                        ? 'bg-purple-50 border-2 border-purple-300'
                                                        : 'bg-slate-50 hover:bg-slate-100 border-2 border-transparent'
                                                    }
                                            `}
                                            >
                                                {/* Reorder Buttons */}
                                                <div className="flex flex-col gap-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.preventDefault(); moveComponentUp(index); }}
                                                        disabled={index === 0}
                                                        className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition touch-feedback"
                                                        title="Mover para cima"
                                                    >
                                                        <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.preventDefault(); moveComponentDown(index); }}
                                                        disabled={index === availableComponents.length - 1}
                                                        className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition touch-feedback"
                                                        title="Mover para baixo"
                                                    >
                                                        <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </button>
                                                </div>

                                                {/* Checkbox */}
                                                <label className="flex items-center gap-2 flex-1 cursor-pointer min-h-touch">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedComponents.includes(component.codigo)}
                                                        onChange={() => handleToggleComponent(component.codigo)}
                                                        className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500 cursor-pointer"
                                                    />
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                        <span className={`text-sm font-bold ${selectedComponents.includes(component.codigo) ? 'text-purple-700' : 'text-slate-900'}`}>
                                                            {component.codigo}
                                                        </span>
                                                        <span className="text-xs text-slate-500 truncate">{component.nome}</span>
                                                    </div>
                                                </label>

                                                {/* Order Indicator */}
                                                <span className="text-sm font-medium text-slate-400 px-2">
                                                    #{index + 1}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Alignment Controls */}
                                    <div className="mt-6 pt-4 border-t border-slate-200">
                                        <label className="form-label mb-3">Alinhamento dos Componentes</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setComponentAlignment('left')}
                                                className={`flex-1 flex flex-col items-center gap-1.5 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 touch-feedback min-h-touch ${componentAlignment === 'left'
                                                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/25'
                                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95'
                                                    }`}
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h7" />
                                                </svg>
                                                <span>Esquerda</span>
                                            </button>
                                            <button
                                                onClick={() => setComponentAlignment('center')}
                                                className={`flex-1 flex flex-col items-center gap-1.5 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 touch-feedback min-h-touch ${componentAlignment === 'center'
                                                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/25'
                                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95'
                                                    }`}
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M9 18h6" />
                                                </svg>
                                                <span>Centro</span>
                                            </button>
                                            <button
                                                onClick={() => setComponentAlignment('right')}
                                                className={`flex-1 flex flex-col items-center gap-1.5 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 touch-feedback min-h-touch ${componentAlignment === 'right'
                                                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/25'
                                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95'
                                                    }`}
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M13 18h7" />
                                                </svg>
                                                <span>Direita</span>
                                            </button>
                                        </div>
                                    </div>
                                </CardBody>
                            )}
                        </Card>
                    )}

                    {/* Batch Generation Section */}
                    {selectedTurma && alunos.length > 0 && !batchGenerating && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-base md:text-lg font-semibold text-slate-900">Geração em Lote</h3>
                                            <p className="text-xs md:text-sm text-slate-500">Selecione múltiplos alunos para gerar vários termos</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {selectedAlunosIds.length > 0 && (
                                            <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                                                {selectedAlunosIds.length} selecionados
                                            </span>
                                        )}
                                        <button
                                            onClick={() => setIsBatchGenerationExpanded(!isBatchGenerationExpanded)}
                                            className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
                                        >
                                            <svg
                                                className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${isBatchGenerationExpanded ? 'rotate-180' : ''}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </CardHeader>
                            {isBatchGenerationExpanded && (
                                <CardBody className="p-3 md:p-4">
                                    {/* Select All Checkbox */}
                                    <div className="mb-4 pb-4 border-b border-slate-200">
                                        <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-100 p-3 rounded-xl transition-all duration-200 touch-feedback min-h-touch">
                                            <div className="relative flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedAlunosIds.length === alunos.length && alunos.length > 0}
                                                    onChange={handleSelectAllAlunos}
                                                    className="w-5 h-5 text-blue-600 border-2 border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <span className="font-semibold text-slate-900">
                                                    {selectedAlunosIds.length === alunos.length && alunos.length > 0 ? 'Desmarcar Todos' : 'Selecionar Todos'}
                                                </span>
                                                <span className="ml-2 text-sm text-slate-500">
                                                    ({alunos.length} alunos na turma)
                                                </span>
                                            </div>
                                        </label>
                                    </div>

                                    {/* Student List with Checkboxes - Mobile Card Style */}
                                    <div className="max-h-72 overflow-y-auto space-y-2 mb-4 -mx-1 px-1">
                                        {alunos.map((aluno, index) => (
                                            <label
                                                key={aluno.id}
                                                className={`
                                                flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-all duration-200 touch-feedback min-h-touch
                                                ${selectedAlunosIds.includes(aluno.id)
                                                        ? 'bg-blue-50 border border-blue-200'
                                                        : 'bg-slate-50 hover:bg-slate-100 border border-transparent'
                                                    }
                                            `}
                                            >
                                                <div className="w-7 h-7 bg-slate-200 rounded-lg flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                                                    {index + 1}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedAlunosIds.includes(aluno.id)}
                                                    onChange={() => handleToggleAluno(aluno.id)}
                                                    className="w-5 h-5 text-blue-600 border-2 border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-900 truncate">
                                                        {aluno.nome_completo}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        Nº {aluno.numero_processo}
                                                    </p>
                                                </div>
                                                {selectedAlunosIds.includes(aluno.id) && (
                                                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </label>
                                        ))}
                                    </div>

                                    {/* Counter and Button */}
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span className="font-medium">{selectedAlunosIds.length}</span> de <span className="font-medium">{alunos.length}</span> alunos selecionados
                                        </div>
                                        <button
                                            onClick={handleGenerateBatchPDFs}
                                            disabled={selectedAlunosIds.length === 0}
                                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium rounded-xl transition-all duration-200 shadow-md shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none min-h-touch touch-feedback"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Gerar PDFs em Lote
                                        </button>
                                    </div>
                                </CardBody>
                            )}
                        </Card>
                    )}

                    {/* Batch Progress */}
                    {batchGenerating && batchProgress && (
                        <Card>
                            <CardBody>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-slate-900">Gerando Termos de Frequência...</h3>
                                        <span className="text-sm text-slate-600">
                                            {batchProgress.current} de {batchProgress.total}
                                        </span>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                                        <div
                                            className="bg-blue-600 h-full transition-all duration-300 ease-out"
                                            style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                                        />
                                    </div>

                                    {/* Current Student */}
                                    <p className="text-sm text-slate-600">
                                        Processando: <span className="font-medium text-slate-900">{batchProgress.currentAluno}</span>
                                    </p>

                                    {/* Percentage */}
                                    <p className="text-center text-2xl font-bold text-blue-600">
                                        {Math.round((batchProgress.current / batchProgress.total) * 100)}%
                                    </p>
                                </div>
                            </CardBody>
                        </Card>
                    )}

                    {/* Loading State */}
                    {loadingTermo && (
                        <Card>
                            <CardBody>
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    <span className="ml-3 text-slate-600">Carregando dados do aluno...</span>
                                </div>
                            </CardBody>
                        </Card>
                    )}


                    {/* Preview and Actions */}
                    {termoFrequenciaData && !loadingTermo && (
                        <>
                            {/* Preview */}
                            <TermoFrequenciaPreview data={termoFrequenciaData} colorConfig={colorConfig} componentAlignment={componentAlignment} componentOrder={availableComponents.map(c => c.codigo)} />

                            {/* Actions */}
                            <Card>
                                <CardHeader>
                                    <h3 className="text-lg font-semibold text-slate-900">Ações</h3>
                                </CardHeader>
                                <CardBody>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <Button
                                            onClick={handleGenerateTermoFrequenciaPDF}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Gerar PDF
                                        </Button>
                                    </div>
                                </CardBody>
                            </Card>
                        </>
                    )}

                    {/* Empty State */}
                    {!selectedTurma && !loadingTermo && (
                        <Card>
                            <CardBody>
                                <div className="text-center py-12">
                                    <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <h3 className="mt-2 text-sm font-medium text-slate-900">Nenhuma turma selecionada</h3>
                                    <p className="mt-1 text-sm text-slate-500">Selecione uma turma e um aluno para gerar o Termo de Frequência</p>
                                </div>
                            </CardBody>
                        </Card>
                    )}
                </div>
            )}
        </div>
    )
}
