/*
component-meta:
  name: PautaGeralPage
  description: Page for generating Pauta-Geral (general report) by class with all disciplines
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Card, CardHeader, CardBody } from './ui/Card'
import { Button } from './ui/Button'
import { translateError } from '../utils/translations'
import { PautaGeralFieldSelector } from './PautaGeralFieldSelector'
import { PautaGeralPreview } from './PautaGeralPreview'
import { generatePautaGeralPDF } from '../utils/pdfGenerator'
import { generatePautaGeralExcel, generatePautaGeralCSV } from '../utils/excelGenerator'
import { evaluateFormula } from '../utils/formulaUtils'
import { HeaderConfig, loadHeaderConfig } from '../utils/headerConfigUtils'
import { GradeColorConfig, loadGradeColorConfig } from '../utils/gradeColorConfigUtils'
import { classifyStudent, DisciplinaGrade } from '../utils/studentClassification'
import { useAuth } from '../contexts/AuthContext'

interface Turma {
    id: string
    nome: string
    ano_lectivo: number
    codigo_turma: string
    nivel_ensino: string
}

interface ComponenteAvaliacao {
    id: string
    codigo_componente: string
    nome: string
    peso_percentual: number
    trimestre: number
    is_calculated?: boolean
    formula_expression?: string
    depends_on_components?: string[]
    tipo_calculo?: 'trimestral' | 'anual'
}

interface DisciplinaComComponentes {
    id: string
    nome: string
    codigo_disciplina: string
    ordem: number
    componentes: ComponenteAvaliacao[]
}

interface PautaGeralData {
    turma: Turma
    trimestre: number
    nivel_ensino?: string
    classe?: string
    alunos: Array<{
        numero_processo: string
        nome_completo: string
        genero?: 'M' | 'F'
        frequencia_anual?: number
        notas_por_disciplina: Record<string, Record<string, number>> // disciplinaId -> componenteId -> nota
        media_geral: number // Average across all disciplines
        observacao: 'Transita' | 'Não Transita' | 'Condicional' | 'AguardandoNotas'
        motivos: string[]
        disciplinas_em_risco: string[]
        acoes_recomendadas: string[]
        observacao_padronizada: string
        motivo_retencao?: string
        matricula_condicional: boolean
    }>
    disciplinas: DisciplinaComComponentes[]
    estatisticas?: {
        por_disciplina: Record<string, any>
        geral: any
    }
    escola?: {
        nome: string
        provincia: string
        municipio: string
    }
}

interface FieldSelection {
    disciplinas: string[] // IDs of selected disciplines
    includeAllDisciplinas: boolean
    componentes: string[] // IDs of selected components
    includeAllComponentes: boolean
    showStatistics: boolean
    showNumeroProcesso: boolean
    showNomeCompleto: boolean
    showMediaGeral: boolean // Show Média Geral column
    showObservacao: boolean // Show Transita/Não Transita column
    componenteParaMediaGeral: string // Component code to use for média geral (e.g., 'MF', 'MT', 'NF')
}

export const PautaGeralPage: React.FC = () => {
    const { escolaProfile, professorProfile, secretarioProfile } = useAuth()
    const [turmas, setTurmas] = useState<Turma[]>([])
    const [selectedTurma, setSelectedTurma] = useState<string>('')
    const trimestre = 3 // Fixed to 3rd trimester for Pauta-Geral
    const [loadingData, setLoadingData] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [pautaGeralData, setPautaGeralData] = useState<PautaGeralData | null>(null)
    const [headerConfig, setHeaderConfig] = useState<HeaderConfig | null>(null)
    const [colorConfig, setColorConfig] = useState<GradeColorConfig | null>(null)
    const [showExportMenu, setShowExportMenu] = useState(false)

    const [fieldSelection, setFieldSelection] = useState<FieldSelection>({
        disciplinas: [],
        includeAllDisciplinas: true,
        componentes: [],
        includeAllComponentes: true,
        showStatistics: true,
        showNumeroProcesso: true,
        showNomeCompleto: true,
        showMediaGeral: true,
        showObservacao: true,
        componenteParaMediaGeral: 'MF' // Default to MF (Média Final)
    })

    // Disciplinas obrigatórias state
    const [disciplinasObrigatorias, setDisciplinasObrigatorias] = useState<string[]>([])

    useEffect(() => {
        loadTurmas()
    }, [])

    useEffect(() => {
        if (selectedTurma) {
            loadPautaGeralData(true)
            loadDisciplinasObrigatorias()
        } else {
            setPautaGeralData(null)
            setDisciplinasObrigatorias([])
        }
    }, [selectedTurma]) // trimestre is now fixed at 3

    useEffect(() => {
        loadHeaderConfiguration()
        loadColorConfiguration()
    }, [selectedTurma])

    const loadTurmas = async () => {
        try {
            if (professorProfile) {
                console.log('📊 PautaGeralPage: Loading turmas for professor:', professorProfile.id)

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

                let turmasData: any[] = []

                if (!turmaProfsError && turmaProfsData && turmaProfsData.length > 0) {
                    // NEW MODEL: Extract unique turmas from turma_professores
                    console.log('✅ PautaGeralPage: Using NEW model (turma_professores)')
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
                    console.log('⚠️ PautaGeralPage: Falling back to OLD model (disciplinas.professor_id)')

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
                }

                setTurmas(turmasData)
                console.log('✅ PautaGeralPage: Loaded', turmasData.length, 'turmas')
            } else if (escolaProfile || secretarioProfile) {
                // For escola or secretario: load all turmas for this escola
                console.log('📊 PautaGeralPage: Loading turmas for escola/secretario')

                const escolaId = escolaProfile?.id || secretarioProfile?.escola_id

                const { data, error } = await supabase
                    .from('turmas')
                    .select('id, nome, ano_lectivo, codigo_turma, nivel_ensino')
                    .eq('escola_id', escolaId)
                    .order('nome')

                if (error) throw error
                setTurmas(data || [])
                console.log('✅ PautaGeralPage: Loaded', data?.length || 0, 'turmas for escola')
            } else {
                console.error('❌ PautaGeralPage: No profile found')
                setError('Perfil não encontrado')
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar turmas'
            console.error('❌ PautaGeralPage: Error loading turmas:', err)
            setError(translateError(errorMessage))
        }
    }

    const loadDisciplinasObrigatorias = async () => {
        try {
            const { data, error } = await supabase
                .from('disciplinas_obrigatorias')
                .select('disciplina_id')
                .eq('turma_id', selectedTurma)
                .eq('is_obrigatoria', true)

            if (error) throw error

            // Extract just the IDs
            const ids = (data || []).map(d => d.disciplina_id)
            setDisciplinasObrigatorias(ids)
        } catch (err) {
            console.error('Erro ao carregar disciplinas obrigatórias:', err)
            // Don't show error to user, just use empty array (fallback to Português/Matemática)
            setDisciplinasObrigatorias([])
        }
    }

    const loadPautaGeralData = async (resetSelection = false) => {
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

            // Extract classe from turma name
            const extractClasse = (turmaName: string): string | undefined => {
                const match = turmaName.match(/(\d+[ªº]\s*Classe)/i)
                return match ? match[1] : undefined
            }
            const classe = extractClasse(turmaData.nome)

            // Load all disciplinas for this turma
            const { data: disciplinasData, error: disciplinasError } = await supabase
                .from('disciplinas')
                .select('id, nome, codigo_disciplina, ordem')
                .eq('turma_id', selectedTurma)
                .order('ordem')

            if (disciplinasError) throw disciplinasError

            if (!disciplinasData || disciplinasData.length === 0) {
                setError('Nenhuma disciplina encontrada para esta turma')
                setPautaGeralData(null)
                return
            }

            // Load all componentes for all disciplinas from all trimesters
            // (Pauta Geral can include calculated components from T1, T2, T3)
            const { data: componentesData, error: componentesError } = await supabase
                .from('componentes_avaliacao')
                .select('id, codigo_componente, nome, peso_percentual, trimestre, disciplina_id, is_calculated, formula_expression, depends_on_components, tipo_calculo')
                .eq('turma_id', selectedTurma)
                .order('trimestre')
                .order('ordem')

            if (componentesError) throw componentesError

            // Group componentes by disciplina
            const disciplinasComComponentes: DisciplinaComComponentes[] = disciplinasData.map(disc => ({
                ...disc,
                componentes: componentesData?.filter(comp => comp.disciplina_id === disc.id) || []
            }))

            // Initialize field selection with all disciplines and components
            // Update field selection (reset if requested, or ensure consistency if "include all" is active)
            // This handles cases where data is reloaded (e.g. switching turmas) to properly update valid IDs
            setFieldSelection(prev => {
                const shouldIncludeAllDisciplinas = resetSelection || prev.includeAllDisciplinas
                const shouldIncludeAllComponentes = resetSelection || prev.includeAllComponentes

                return {
                    ...prev,
                    includeAllDisciplinas: shouldIncludeAllDisciplinas,
                    includeAllComponentes: shouldIncludeAllComponentes,
                    disciplinas: shouldIncludeAllDisciplinas
                        ? disciplinasComComponentes.map(d => d.id)
                        : prev.disciplinas, // Keep existing selection if not "All"
                    componentes: shouldIncludeAllComponentes
                        ? disciplinasComComponentes.flatMap(d => d.componentes.map(c => c.id))
                        : prev.componentes // Keep existing selection if not "All"
                }
            })

            // Load alunos
            const { data: alunosData, error: alunosError } = await supabase
                .from('alunos')
                .select('id, numero_processo, nome_completo, genero, frequencia_anual')
                .eq('turma_id', selectedTurma)
                .eq('ativo', true)
                .order('nome_completo')

            if (alunosError) throw alunosError

            if (!alunosData || alunosData.length === 0) {
                setError('Nenhum aluno encontrado nesta turma')
                setPautaGeralData(null)
                return
            }

            // Get all component IDs for loading notas
            const allComponentIds = componentesData?.map(c => c.id) || []

            // Load notas for all components from all trimesters
            const { data: notasData, error: notasError } = await supabase
                .from('notas')
                .select('aluno_id, componente_id, valor, trimestre')
                .eq('turma_id', selectedTurma)
                .in('componente_id', allComponentIds)

            if (notasError) throw notasError

            // Process data: organize by student with all disciplines
            const alunosComNotas = alunosData.map(aluno => {
                const notasAluno = notasData?.filter(n => n.aluno_id === aluno.id) || []
                const notasPorDisciplina: Record<string, Record<string, number>> = {}

                disciplinasComComponentes.forEach(disc => {
                    const notasMap: Record<string, number> = {}

                    // Build notas map by component ID (raw grades from database)
                    notasAluno.forEach(nota => {
                        const componente = disc.componentes.find(c => c.id === nota.componente_id)
                        if (componente) {
                            notasMap[componente.id] = nota.valor
                        }
                    })

                    // STEP 1: Calculate TRIMESTRAL calculated components first
                    // These are components like MT (Média Trimestral) that depend only on grades within their own trimester
                    disc.componentes.forEach(componente => {
                        if (componente.is_calculated && componente.formula_expression && componente.depends_on_components) {
                            // Only process trimestral components (or components without tipo_calculo - defaults to trimestral)
                            if (componente.tipo_calculo === 'trimestral' || !componente.tipo_calculo) {
                                const dependencyValues: Record<string, number> = {}

                                // STRATEGY: Provide ALL components from the same trimester as context
                                // This is more robust than relying solely on depends_on_components which might be incomplete
                                disc.componentes.forEach(depComponent => {
                                    // Only include components from the same current trimester context
                                    if (depComponent.trimestre === componente.trimestre) {
                                        const value = notasMap[depComponent.id] || 0

                                        // Add standard code (e.g. MAC)
                                        dependencyValues[depComponent.codigo_componente] = value

                                        // Add suffixed code (e.g. MAC1)
                                        if (depComponent.trimestre) {
                                            dependencyValues[`${depComponent.codigo_componente}${depComponent.trimestre}`] = value
                                        }
                                    }
                                })

                                if (Object.keys(dependencyValues).length > 0) {
                                    try {
                                        const calculatedValue = evaluateFormula(componente.formula_expression, dependencyValues)
                                        notasMap[componente.id] = Math.round(calculatedValue * 100) / 100
                                    } catch (error) {
                                        // Silent fail is okay here, logic might just be for another component set
                                    }
                                }
                            }
                        }
                    })

                    // STEP 2: Calculate ANNUAL calculated components
                    // These are components like MFD that depend on values from multiple trimesters (e.g., MT1, MT2, MT3)
                    disc.componentes.forEach(componente => {
                        if (componente.is_calculated && componente.formula_expression && componente.depends_on_components) {
                            if (componente.tipo_calculo === 'anual') {
                                const dependencyValues: Record<string, number> = {}

                                componente.depends_on_components.forEach((depId: string) => {
                                    // Find dependency from same discipline (can be from any trimester)
                                    const depComponent = disc.componentes.find(c => c.id === depId)
                                    if (depComponent) {
                                        // Get the value - could be a calculated trimestral component (like MT)
                                        const value = notasMap[depComponent.id]
                                        if (value !== undefined) {
                                            dependencyValues[depComponent.codigo_componente] = value
                                            // Also add version with trimester suffix (e.g. MT1, MT2) for annual formulas
                                            if (depComponent.trimestre) {
                                                dependencyValues[`${depComponent.codigo_componente}${depComponent.trimestre}`] = value
                                            }
                                        } else {
                                            dependencyValues[depComponent.codigo_componente] = 0
                                            if (depComponent.trimestre) {
                                                dependencyValues[`${depComponent.codigo_componente}${depComponent.trimestre}`] = 0
                                            }
                                        }
                                    }
                                })

                                if (Object.keys(dependencyValues).length > 0) {
                                    try {
                                        const calculatedValue = evaluateFormula(componente.formula_expression, dependencyValues)
                                        notasMap[componente.id] = Math.round(calculatedValue * 100) / 100
                                    } catch (error) {
                                        console.error(`Error calculating annual component ${componente.codigo_componente}:`, error)
                                    }
                                }
                            }
                        }
                    })

                    notasPorDisciplina[disc.id] = notasMap
                })

                return {
                    numero_processo: aluno.numero_processo,
                    nome_completo: aluno.nome_completo,
                    genero: aluno.genero as 'M' | 'F' | undefined,
                    frequencia_anual: aluno.frequencia_anual,
                    notas_por_disciplina: notasPorDisciplina,
                    media_geral: 0,
                    observacao: 'AguardandoNotas' as any,
                    motivos: [] as string[],
                    disciplinas_em_risco: [] as string[],
                    acoes_recomendadas: [] as string[],
                    observacao_padronizada: '',
                    motivo_retencao: undefined as string | undefined,
                    matricula_condicional: false
                }
            })

            // Calculate statistics per discipline and general statistics
            const notasFinaisPorAluno: number[] = [] // Store average final grade per student across all disciplines

            // For each student, calculate their classification based on new rules
            alunosComNotas.forEach((aluno, index) => {
                const notasFinaisDisciplinas: number[] = []
                const disciplinaGrades: DisciplinaGrade[] = []

                // Collect grades from MF or MFD component for each discipline
                disciplinasComComponentes.forEach(disc => {
                    const notasDisciplina = aluno.notas_por_disciplina[disc.id] || {}

                    // Find MF or MFD component
                    const componenteMF = disc.componentes.find(
                        comp => comp.codigo_componente === 'MF' || comp.codigo_componente === 'MFD'
                    )

                    if (componenteMF) {
                        const nota = notasDisciplina[componenteMF.id]
                        if (nota !== undefined) {
                            disciplinaGrades.push({
                                id: disc.id,
                                nome: disc.nome,
                                nota: nota
                            })
                            notasFinaisDisciplinas.push(nota)
                        }
                    }
                })

                // Calculate average across all disciplines for this student (for statistics)
                let mediaAluno = 0
                if (notasFinaisDisciplinas.length > 0) {
                    mediaAluno = notasFinaisDisciplinas.reduce((sum, n) => sum + n, 0) / notasFinaisDisciplinas.length
                    // Round to 2 decimal places
                    mediaAluno = Math.round(mediaAluno * 100) / 100
                    notasFinaisPorAluno.push(mediaAluno)
                }

                // Use new classification logic
                const classification = classifyStudent(
                    disciplinaGrades,
                    turmaData.nivel_ensino,
                    classe,
                    disciplinasObrigatorias,
                    aluno.frequencia_anual
                )

                // Update aluno with média_geral and classification results
                alunosComNotas[index] = {
                    ...aluno,
                    media_geral: mediaAluno,
                    observacao: classification.status,
                    motivos: classification.motivos,
                    disciplinas_em_risco: classification.disciplinas_em_risco,
                    acoes_recomendadas: classification.acoes_recomendadas,
                    observacao_padronizada: classification.observacao_padronizada,
                    motivo_retencao: classification.motivo_retencao,
                    matricula_condicional: classification.matricula_condicional
                }
            })

            // Calculate General Statistics
            const totalAlunos = alunosComNotas.length
            const aprovados = alunosComNotas.filter(a => a.observacao === 'Transita').length
            const reprovados = totalAlunos - aprovados

            const mediaTurma = notasFinaisPorAluno.length > 0
                ? notasFinaisPorAluno.reduce((a, b) => a + b, 0) / notasFinaisPorAluno.length
                : 0

            const notaMinima = notasFinaisPorAluno.length > 0 ? Math.min(...notasFinaisPorAluno) : 0
            const notaMaxima = notasFinaisPorAluno.length > 0 ? Math.max(...notasFinaisPorAluno) : 0

            setPautaGeralData({
                turma: turmaData,
                trimestre: 3,
                nivel_ensino: turmaData.nivel_ensino,
                classe: classe,
                alunos: alunosComNotas,
                disciplinas: disciplinasComComponentes,
                estatisticas: {
                    por_disciplina: {},
                    geral: {
                        total_alunos: totalAlunos,
                        aprovados,
                        reprovados,
                        media_turma: mediaTurma,
                        nota_minima: notaMinima,
                        nota_maxima: notaMaxima
                    }
                }
            })
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados'
            setError(translateError(errorMessage))
            setPautaGeralData(null)
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
            const config = await loadGradeColorConfig(selectedTurma || undefined)
            setColorConfig(config)
        } catch (err) {
            console.error('Error loading color config:', err)
        }
    }

    const getFilteredData = (): PautaGeralData | null => {
        if (!pautaGeralData) return null

        // Filter disciplines based on selection
        const selectedDisciplinaIds = fieldSelection.includeAllDisciplinas
            ? pautaGeralData.disciplinas.map(d => d.id)
            : fieldSelection.disciplinas

        const filteredDisciplinas = pautaGeralData.disciplinas
            .filter(d => selectedDisciplinaIds.includes(d.id))
            .map(disc => {
                // Filter components if needed
                const filteredComponentes = fieldSelection.includeAllComponentes
                    ? disc.componentes
                    : disc.componentes.filter(c => fieldSelection.componentes.includes(c.id))

                return {
                    ...disc,
                    componentes: filteredComponentes
                }
            })

        return {
            ...pautaGeralData,
            disciplinas: filteredDisciplinas
        }
    }

    const handleGeneratePDF = async () => {
        const filteredData = getFilteredData()
        if (!filteredData) {
            setError('Carregue os dados primeiro')
            return
        }

        try {
            await generatePautaGeralPDF(filteredData, headerConfig, colorConfig)
            setSuccess('PDF gerado com sucesso!')
            setShowExportMenu(false)
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao gerar PDF'
            setError(translateError(errorMessage))
        }
    }

    const handleGenerateExcel = () => {
        const filteredData = getFilteredData()
        if (!filteredData) {
            setError('Carregue os dados primeiro')
            return
        }

        try {
            generatePautaGeralExcel(filteredData)
            setSuccess('Excel gerado com sucesso!')
            setShowExportMenu(false)
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao gerar Excel'
            setError(translateError(errorMessage))
        }
    }

    const handleExportCSV = () => {
        const filteredData = getFilteredData()
        if (!filteredData) {
            setError('Carregue os dados primeiro')
            return
        }

        try {
            generatePautaGeralCSV(filteredData)
            setSuccess('CSV exportado com sucesso!')
            setShowExportMenu(false)
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao exportar CSV'
            setError(translateError(errorMessage))
        }
    }

    return (
        <div className="space-y-5 md:space-y-6 animate-fade-in pb-6">
            {/* Modern Header with Gradient */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-5 md:p-6 shadow-lg">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAzMHYySDI0di0yaDEyek0zNiAyNnYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
                <div className="relative flex items-start gap-4">
                    <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                        <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Pauta-Geral</h2>
                        <p className="text-sm md:text-base text-blue-100/90">
                            Gere a pauta geral completa por turma com todas as disciplinas e classificações finais
                        </p>
                    </div>
                </div>
            </div>

            {/* Messages */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl flex items-center gap-3 animate-slide-up shadow-sm">
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-red-100">
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <span className="text-sm flex-1">{error}</span>
                    <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 p-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}
            {success && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl flex items-center gap-3 animate-slide-up shadow-sm">
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-green-100">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <span className="text-sm flex-1">{success}</span>
                </div>
            )}

            {/* Filters Card - Modern Glass Design */}
            <Card className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200/50">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                        </div>
                        <h3 className="text-base md:text-lg font-semibold text-slate-800">Selecionar Turma</h3>
                    </div>
                </CardHeader>
                <CardBody className="p-4 md:p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Turma</label>
                            <div className="relative">
                                <select
                                    value={selectedTurma}
                                    onChange={(e) => setSelectedTurma(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm appearance-none cursor-pointer text-slate-700 transition-all hover:border-slate-300"
                                >
                                    <option value="">Selecione uma turma</option>
                                    {turmas.map((turma) => (
                                        <option key={turma.id} value={turma.id}>
                                            {turma.nome} - {turma.ano_lectivo}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-end">
                            <button
                                onClick={() => loadPautaGeralData(false)}
                                disabled={!selectedTurma || loadingData}
                                className="w-full px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                {loadingData ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Carregando...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        <span>Carregar Dados</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Info Note */}
                    <div className="mt-4 flex items-start gap-3 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-xl p-3">
                        <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p>
                            A Pauta-Geral é gerada automaticamente com os dados do <strong>3º Trimestre</strong>, incluindo médias finais e situação de cada aluno.
                        </p>
                    </div>
                </CardBody>
            </Card>

            {/* Field Selector */}
            {pautaGeralData && (
                <div className="animate-slide-up">
                    <PautaGeralFieldSelector
                        data={pautaGeralData}
                        selection={fieldSelection}
                        onChange={setFieldSelection}
                        onReorder={(newDisciplinas) => {
                            if (pautaGeralData) {
                                setPautaGeralData({
                                    ...pautaGeralData,
                                    disciplinas: newDisciplinas
                                })
                            }
                        }}
                    />
                </div>
            )}

            {/* Preview and Export */}
            {pautaGeralData && (
                <div className="animate-slide-up space-y-4">
                    {/* Section Header with Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
                                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800">Preview da Pauta-Geral</h3>
                        </div>

                        {/* Desktop Action Buttons */}
                        <div className="hidden md:flex items-center gap-2">
                            <Button
                                variant="primary"
                                onClick={handleGeneratePDF}
                                className="shadow-md hover:shadow-lg"
                                icon={
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                }
                            >
                                PDF
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={handleGenerateExcel}
                                icon={
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                }
                            >
                                Excel
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={handleExportCSV}
                                icon={
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                }
                            >
                                CSV
                            </Button>
                        </div>

                        {/* Mobile Action Menu */}
                        <div className="md:hidden relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl shadow-md flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                <span>Exportar</span>
                                <svg className={`w-4 h-4 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {showExportMenu && (
                                <div className="absolute right-0 left-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-20 animate-scale-in">
                                    <button
                                        onClick={handleGeneratePDF}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                                            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <span className="font-medium text-slate-700">Exportar PDF</span>
                                    </button>
                                    <button
                                        onClick={handleGenerateExcel}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left border-t border-slate-100"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <span className="font-medium text-slate-700">Exportar Excel</span>
                                    </button>
                                    <button
                                        onClick={handleExportCSV}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left border-t border-slate-100"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <span className="font-medium text-slate-700">Exportar CSV</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Preview Component */}
                    <PautaGeralPreview
                        data={getFilteredData()!}
                        loading={loadingData}
                        colorConfig={colorConfig}
                        fieldSelection={fieldSelection}
                        disciplinasObrigatorias={disciplinasObrigatorias}
                    />
                </div>
            )}

            {/* Empty State */}
            {!pautaGeralData && !loadingData && selectedTurma && (
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-8 md:p-12 text-center border border-slate-200 shadow-sm animate-fade-in">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-blue-100 flex items-center justify-center">
                        <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Pronto para gerar a Pauta-Geral</h3>
                    <p className="text-slate-600 mb-6 max-w-md mx-auto">
                        Clique no botão "Carregar Dados" acima para visualizar e exportar a pauta-geral desta turma.
                    </p>
                    <button
                        onClick={() => loadPautaGeralData(false)}
                        disabled={loadingData}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow-md hover:shadow-lg"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Carregar Dados
                    </button>
                </div>
            )}

            {/* Initial State - No turma selected */}
            {!selectedTurma && (
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-8 md:p-12 text-center border border-slate-200 shadow-sm animate-fade-in">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-200 flex items-center justify-center">
                        <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Selecione uma Turma</h3>
                    <p className="text-slate-600 max-w-md mx-auto">
                        Escolha uma turma no selector acima para começar a gerar a Pauta-Geral.
                    </p>
                </div>
            )}

            {/* Click outside to close export menu */}
            {showExportMenu && (
                <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowExportMenu(false)}
                />
            )}
        </div>
    )
}
