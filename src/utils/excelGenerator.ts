import * as XLSX from 'xlsx'
import {
    formatComponentePautaLabel,
    formatObservacaoPautaLabel,
    buildPautaGeralLegendaTableRows,
} from './pautaGeralFieldUtils'
import {
    DEFAULT_PAUTA_GERAL_EXPORT_CONFIG,
    type PautaGeralExportConfig,
} from './pautaGeralExportUtils'
import { getComponenteDisplayLabel } from './gradeUtils'

interface TrimestreData {
    notas: Record<string, number>
    nota_final?: number  // Optional - only if NF component configured
}

interface MiniPautaData {
    turma: {
        nome: string
        ano_lectivo: number
        codigo_turma: string
        nivel_ensino?: string
    }
    disciplina: {
        nome: string
        codigo_disciplina: string
    }
    trimestre: number | 'all'
    alunos: Array<{
        numero_processo: string
        nome_completo: string
        notas: Record<string, number>
        nota_final?: number  // Optional - only if NF component configured
        classificacao: string
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
        trimestre?: number
        is_calculated?: boolean
        disciplina_nome?: string // Discipline name for grouping (Primary Education)
        disciplina_ordem?: number // Discipline order for sorting (Primary Education)
    }>
    estatisticas: {
        total_alunos: number
        aprovados: number
        reprovados: number
        taxa_aprovacao: number
        media_turma: number
        nota_minima: number
        nota_maxima: number
    }
}

export function generateMiniPautaExcel(data: MiniPautaData): void {
    const workbook = XLSX.utils.book_new()

    // Check if all-trimester mode
    const isAllTrimesters = data.trimestre === 'all' && data.alunos[0]?.trimestres

    // Check if Primary Education
    const isPrimaryEducation = data.turma.nivel_ensino?.toLowerCase().includes('primário') ||
        data.turma.nivel_ensino?.toLowerCase().includes('primario')

    // Check if all disciplines mode (Primary Education only)
    const isAllDisciplines = data.componentes.length > 0 &&
        data.componentes.some(c => c.disciplina_nome) &&
        new Set(data.componentes.map(c => c.disciplina_nome)).size > 1

    let headerRow: any[]
    let dataRows: any[][]

    if (isPrimaryEducation && isAllDisciplines && !isAllTrimesters) {
        // PRIMARY EDUCATION - ALL DISCIPLINES FORMAT (Single Trimester)
        // Group components by discipline
        interface DisciplineGroup {
            disciplina_nome: string
            ordem?: number
            componentes: Array<{ id: string; codigo_componente: string; nome?: string }>
        }

        const disciplineMap = new Map<string, DisciplineGroup>()
        const currentTrimestre = (data.trimestre === 'all' ? 1 : data.trimestre) as number

        data.componentes.forEach(comp => {
            if (comp.trimestre === currentTrimestre || !comp.trimestre) {
                const disciplineName = comp.disciplina_nome || 'Sem Disciplina'

                if (!disciplineMap.has(disciplineName)) {
                    disciplineMap.set(disciplineName, {
                        disciplina_nome: disciplineName,
                        ordem: comp.disciplina_ordem,
                        componentes: []
                    })
                }

                disciplineMap.get(disciplineName)!.componentes.push({
                    id: comp.id,
                    codigo_componente: comp.codigo_componente,
                    nome: comp.nome,
                })
            }
        })

        // Sort by ordem if available
        const disciplineGroups = Array.from(disciplineMap.values()).sort((a, b) => {
            if (a.ordem !== undefined && b.ordem !== undefined) {
                return a.ordem - b.ordem
            }
            return a.disciplina_nome.localeCompare(b.disciplina_nome)
        })

        // Build headers
        headerRow = ['Nº', 'Nome do Aluno']
        disciplineGroups.forEach(group => {
            group.componentes.forEach(comp => {
                headerRow.push(getComponenteDisplayLabel(comp))
            })
        })

        // Build data rows
        dataRows = data.alunos.map((aluno, index) => {
            const row: any[] = [
                index + 1,
                aluno.nome_completo
            ]

            disciplineGroups.forEach(group => {
                group.componentes.forEach(comp => {
                    // Use component id for grade lookup to avoid conflicts
                    const nota = aluno.notas[comp.id]
                    row.push(nota !== undefined ? nota : '')
                })
            })

            return row
        })

    } else if (isAllTrimesters) {
        // Get components for each trimestre
        const componentes1T = data.componentes.filter(c => c.trimestre === 1)
        const componentes2T = data.componentes.filter(c => c.trimestre === 2)
        const componentes3T = data.componentes.filter(c => c.trimestre === 3)

        // Headers for all-trimester layout (without Nº Processo)
        headerRow = [
            'Nº',
            'Nome do Aluno',
            // 1º Trimestre
            ...componentes1T.map(c => getComponenteDisplayLabel(c)),
            // 2º Trimestre
            ...componentes2T.map(c => getComponenteDisplayLabel(c)),
            // 3º Trimestre
            ...componentes3T.map(c => getComponenteDisplayLabel(c))
        ]

        // Data rows for all-trimester layout (without Nº Processo)
        dataRows = data.alunos.map((aluno, index) => {
            const row: any[] = [
                index + 1,
                aluno.nome_completo
            ]

            // 1º Trimestre
            const trimestre1 = aluno.trimestres?.[1]
            componentes1T.forEach(c => {
                const nota = trimestre1?.notas[c.codigo_componente]
                row.push(nota !== undefined ? nota : '')
            })

            // 2º Trimestre
            const trimestre2 = aluno.trimestres?.[2]
            componentes2T.forEach(c => {
                const nota = trimestre2?.notas[c.codigo_componente]
                row.push(nota !== undefined ? nota : '')
            })

            // 3º Trimestre
            const trimestre3 = aluno.trimestres?.[3]
            componentes3T.forEach(c => {
                const nota = trimestre3?.notas[c.codigo_componente]
                row.push(nota !== undefined ? nota : '')
            })

            return row
        })
    } else {
        // Headers for single-trimester layout - MATCH PREVIEW (no Nota Final or Classificação)
        headerRow = [
            'Nº',
            'Nome do Aluno',
            ...data.componentes.map(c => `${getComponenteDisplayLabel(c)} (${c.peso_percentual}%)`)
        ]

        // Data rows for single-trimester layout - MATCH PREVIEW (no Nota Final or Classificação)
        dataRows = data.alunos.map((aluno, index) => [
            index + 1,
            aluno.nome_completo,
            ...data.componentes.map(c => aluno.notas[c.codigo_componente] ?? '')
        ])
    }

    // Create header rows
    let headerRows: any[][]

    if (isPrimaryEducation && isAllDisciplines && !isAllTrimesters) {
        // PRIMARY EDUCATION - ALL DISCIPLINES: Create discipline-grouped headers
        const disciplineMap = new Map<string, { ordem?: number; componentes: string[] }>()
        const currentTrimestre = (data.trimestre === 'all' ? 1 : data.trimestre) as number

        data.componentes.forEach(comp => {
            if (comp.trimestre === currentTrimestre || !comp.trimestre) {
                const disciplineName = comp.disciplina_nome || 'Sem Disciplina'

                if (!disciplineMap.has(disciplineName)) {
                    disciplineMap.set(disciplineName, {
                        ordem: comp.disciplina_ordem,
                        componentes: []
                    })
                }

                disciplineMap.get(disciplineName)!.componentes.push(getComponenteDisplayLabel(comp))
            }
        })

        // Sort by ordem if available
        const disciplineGroups = Array.from(disciplineMap.entries())
            .sort(([nameA, dataA], [nameB, dataB]) => {
                if (dataA.ordem !== undefined && dataB.ordem !== undefined) {
                    return dataA.ordem - dataB.ordem
                }
                return nameA.localeCompare(nameB)
            })

        // First 3 rows: Title and info
        const infoRows = [
            ['MINI-PAUTA'],
            [`Turma: ${data.turma.nome}`, '', `Ano Lectivo: ${data.turma.ano_lectivo}`],
            [`Trimestre: ${data.trimestre}º`],
            [] // Empty row
        ]

        // Discipline group header row
        const disciplineHeaderRow = ['Nº', 'Nome do Aluno']
        disciplineGroups.forEach(([disciplineName, disciplineData]) => {
            disciplineHeaderRow.push(disciplineName)
            // Add empty cells for the span
            for (let i = 1; i < disciplineData.componentes.length; i++) {
                disciplineHeaderRow.push('')
            }
        })

        // Component header row
        const componentHeaderRow = ['', ''] // Empty for Nº, Nome
        disciplineGroups.forEach(([, disciplineData]) => {
            componentHeaderRow.push(...disciplineData.componentes)
        })

        headerRows = [...infoRows, disciplineHeaderRow, componentHeaderRow]

    } else if (isAllTrimesters) {
        const componentsPerTrimestre = data.componentes.length

        // First 3 rows: Title and info
        const infoRows = [
            ['MINI-PAUTA'],
            [`Turma: ${data.turma.nome}`, '', `Disciplina: ${data.disciplina.nome}`],
            [`Ano Lectivo: ${data.turma.ano_lectivo}`, '', `Trimestre: Todos`],
            [] // Empty row
        ]

        // Trimester group header row (without Nº Processo)
        const trimestreHeaderRow = [
            'Nº', 'Nome do Aluno',
            '1º Trimestre', ...Array(componentsPerTrimestre).fill(''), '', // Spans components + MT1
            '2º Trimestre', ...Array(componentsPerTrimestre).fill(''), '', // Spans components + MT2
            '3º Trimestre', ...Array(componentsPerTrimestre).fill(''), '', // Spans components + MT3
            'MF'
        ]

        // Component header row (without Nº Processo)
        const componentHeaderRow = [
            '', '', // Empty for Nº, Nome
            ...headerRow.slice(2) // Components and MT columns
        ]

        headerRows = [...infoRows, trimestreHeaderRow, componentHeaderRow]
    } else {
        headerRows = [
            ['MINI-PAUTA'],
            [`Turma: ${data.turma.nome}`, '', `Disciplina: ${data.disciplina.nome}`],
            [`Ano Lectivo: ${data.turma.ano_lectivo}`, '', `Trimestre: ${data.trimestre}º`],
            [], // Empty row
            headerRow
        ]
    }


    // Statistics rows
    const statsRows = [
        [], // Empty row
        ['ESTATÍSTICAS DA TURMA'],
        ['Total de Alunos:', data.estatisticas.total_alunos],
        ['Aprovados:', data.estatisticas.aprovados, `(${data.estatisticas.taxa_aprovacao.toFixed(1)}%)`],
        ['Reprovados:', data.estatisticas.reprovados],
        ['Média da Turma:', data.estatisticas.media_turma.toFixed(2)],
        ['Nota Mínima:', data.estatisticas.nota_minima.toFixed(2)],
        ['Nota Máxima:', data.estatisticas.nota_maxima.toFixed(2)]
    ]

    // Combine all rows
    const allRows = [...headerRows, ...dataRows, ...statsRows]

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(allRows)

    // Add merges for discipline or trimester headers
    if (isPrimaryEducation && isAllDisciplines && !isAllTrimesters) {
        // PRIMARY EDUCATION - ALL DISCIPLINES: Merge discipline headers
        const disciplineMap = new Map<string, { ordem?: number; componentes: string[] }>()
        const currentTrimestre = (data.trimestre === 'all' ? 1 : data.trimestre) as number

        data.componentes.forEach(comp => {
            if (comp.trimestre === currentTrimestre || !comp.trimestre) {
                const disciplineName = comp.disciplina_nome || 'Sem Disciplina'

                if (!disciplineMap.has(disciplineName)) {
                    disciplineMap.set(disciplineName, {
                        ordem: comp.disciplina_ordem,
                        componentes: []
                    })
                }

                disciplineMap.get(disciplineName)!.componentes.push(getComponenteDisplayLabel(comp))
            }
        })

        // Sort by ordem if available
        const disciplineGroups = Array.from(disciplineMap.entries())
            .sort(([nameA, dataA], [nameB, dataB]) => {
                if (dataA.ordem !== undefined && dataB.ordem !== undefined) {
                    return dataA.ordem - dataB.ordem
                }
                return nameA.localeCompare(nameB)
            })

        const headerRowIndex = 4 // 0-indexed row where discipline headers are
        const startCol = 2 // After Nº, Nome

        const merges = []
        let currentCol = startCol

        disciplineGroups.forEach(([, disciplineData]) => {
            if (disciplineData.componentes.length > 1) {
                // Merge cells for discipline name spanning its components
                merges.push({
                    s: { r: headerRowIndex, c: currentCol },
                    e: { r: headerRowIndex, c: currentCol + disciplineData.componentes.length - 1 }
                })
            }
            currentCol += disciplineData.componentes.length
        })

        // Also merge Nº and Nome cells vertically (rows 4 and 5)
        merges.push(
            { s: { r: headerRowIndex, c: 0 }, e: { r: headerRowIndex + 1, c: 0 } }, // Nº
            { s: { r: headerRowIndex, c: 1 }, e: { r: headerRowIndex + 1, c: 1 } }  // Nome
        )

        worksheet['!merges'] = merges

    } else if (isAllTrimesters) {
        const componentsPerTrimestre = data.componentes.length
        const headerRowIndex = 4 // 0-indexed row where trimester headers are

        // Calculate column indices (0-indexed, without Nº Processo)
        const startCol = 2 // After Nº, Nome

        // Merge cells for each trimestre header
        const merges = [
            // 1º Trimestre: spans components + MT1
            { s: { r: headerRowIndex, c: startCol }, e: { r: headerRowIndex, c: startCol + componentsPerTrimestre } },
            // 2º Trimestre
            { s: { r: headerRowIndex, c: startCol + componentsPerTrimestre + 1 }, e: { r: headerRowIndex, c: startCol + (componentsPerTrimestre * 2) + 1 } },
            // 3º Trimestre
            { s: { r: headerRowIndex, c: startCol + (componentsPerTrimestre * 2) + 2 }, e: { r: headerRowIndex, c: startCol + (componentsPerTrimestre * 3) + 2 } }
        ]

        worksheet['!merges'] = merges
    }

    // Set column widths
    const columnWidths = [
        { wch: 5 },  // Nº
        { wch: 15 }, // Nº Processo
        { wch: 30 }, // Nome
        ...data.componentes.map(() => ({ wch: 12 })), // Componentes
        { wch: 12 }, // Nota Final
        { wch: 15 }  // Classificação
    ]
    worksheet['!cols'] = columnWidths

    // Style header
    const headerRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
    for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + '1'
        if (!worksheet[address]) continue
        worksheet[address].s = {
            font: { bold: true, sz: 14 },
            alignment: { horizontal: 'center' }
        }
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mini-Pauta')

    // Generate filename and download
    const trimestreStr = data.trimestre === 'all' ? 'todos' : `${data.trimestre}trim`
    const filename = `mini-pauta_${data.turma.codigo_turma}_${data.disciplina.codigo_disciplina}_${trimestreStr}.xlsx`
    XLSX.writeFile(workbook, filename)
}

export function generateCSV(data: MiniPautaData): void {
    // Check if all-trimester mode
    const isAllTrimesters = data.trimestre === 'all' && data.alunos[0]?.trimestres

    // Check if Primary Education
    const isPrimaryEducation = data.turma.nivel_ensino?.toLowerCase().includes('primário') ||
        data.turma.nivel_ensino?.toLowerCase().includes('primario')

    // Check if all disciplines mode (Primary Education only)
    const isAllDisciplines = data.componentes.length > 0 &&
        data.componentes.some(c => c.disciplina_nome) &&
        new Set(data.componentes.map(c => c.disciplina_nome)).size > 1

    let headers: string[]
    let rows: any[][]

    if (isPrimaryEducation && isAllDisciplines && !isAllTrimesters) {
        // PRIMARY EDUCATION - ALL DISCIPLINES FORMAT (Single Trimester)
        // Group components by discipline
        interface DisciplineGroup {
            disciplina_nome: string
            ordem?: number
            componentes: Array<{ id: string; codigo_componente: string; nome?: string }>
        }

        const disciplineMap = new Map<string, DisciplineGroup>()
        const currentTrimestre = (data.trimestre === 'all' ? 1 : data.trimestre) as number

        data.componentes.forEach(comp => {
            if (comp.trimestre === currentTrimestre || !comp.trimestre) {
                const disciplineName = comp.disciplina_nome || 'Sem Disciplina'

                if (!disciplineMap.has(disciplineName)) {
                    disciplineMap.set(disciplineName, {
                        disciplina_nome: disciplineName,
                        ordem: comp.disciplina_ordem,
                        componentes: []
                    })
                }

                disciplineMap.get(disciplineName)!.componentes.push({
                    id: comp.id,
                    codigo_componente: comp.codigo_componente,
                    nome: comp.nome,
                })
            }
        })

        // Sort by ordem if available
        const disciplineGroups = Array.from(disciplineMap.values()).sort((a, b) => {
            if (a.ordem !== undefined && b.ordem !== undefined) {
                return a.ordem - b.ordem
            }
            return a.disciplina_nome.localeCompare(b.disciplina_nome)
        })

        // Build headers
        headers = ['Nº', 'Nome do Aluno']
        disciplineGroups.forEach(group => {
            group.componentes.forEach(comp => {
                headers.push(getComponenteDisplayLabel(comp))
            })
        })

        // Build data rows
        rows = data.alunos.map((aluno, index) => {
            const row: any[] = [
                index + 1,
                aluno.nome_completo
            ]

            disciplineGroups.forEach(group => {
                group.componentes.forEach(comp => {
                    // Use component id for grade lookup to avoid conflicts
                    const nota = aluno.notas[comp.id]
                    row.push(nota !== undefined ? nota : '')
                })
            })

            return row
        })

    } else if (isAllTrimesters) {
        // Get components for each trimestre
        const componentes1T = data.componentes.filter(c => c.trimestre === 1)
        const componentes2T = data.componentes.filter(c => c.trimestre === 2)
        const componentes3T = data.componentes.filter(c => c.trimestre === 3)

        // Headers for all-trimester layout (without Nº Processo)
        headers = [
            'Nº',
            'Nome do Aluno',
            // 1º Trimestre
            ...componentes1T.map(c => getComponenteDisplayLabel(c)),
            // 2º Trimestre
            ...componentes2T.map(c => getComponenteDisplayLabel(c)),
            // 3º Trimestre
            ...componentes3T.map(c => getComponenteDisplayLabel(c))
        ]

        // Data rows for all-trimester layout (without Nº Processo)
        rows = data.alunos.map((aluno, index) => {
            const row: any[] = [
                index + 1,
                aluno.nome_completo
            ]

            // 1º Trimestre
            const trimestre1 = aluno.trimestres?.[1]
            componentes1T.forEach(c => {
                const nota = trimestre1?.notas[c.codigo_componente]
                row.push(nota !== undefined ? nota : '')
            })

            // 2º Trimestre
            const trimestre2 = aluno.trimestres?.[2]
            componentes2T.forEach(c => {
                const nota = trimestre2?.notas[c.codigo_componente]
                row.push(nota !== undefined ? nota : '')
            })

            // 3º Trimestre
            const trimestre3 = aluno.trimestres?.[3]
            componentes3T.forEach(c => {
                const nota = trimestre3?.notas[c.codigo_componente]
                row.push(nota !== undefined ? nota : '')
            })

            return row
        })
    } else {
        // Headers for single-trimester layout - MATCH PREVIEW (no Nota Final or Classificação)
        headers = [
            'Nº',
            'Nome do Aluno',
            ...data.componentes.map(c => `${getComponenteDisplayLabel(c)} (${c.peso_percentual}%)`)
        ]

        // Data rows for single-trimester layout - MATCH PREVIEW (no Nota Final or Classificação)
        rows = data.alunos.map((aluno, index) => [
            index + 1,
            aluno.nome_completo,
            ...data.componentes.map(c => aluno.notas[c.codigo_componente] ?? '')
        ])
    }

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    const trimestreStr = data.trimestre === 'all' ? 'todos' : `${data.trimestre}trim`
    link.download = `mini-pauta_${data.turma.codigo_turma}_${data.disciplina.codigo_disciplina}_${trimestreStr}.csv`
    link.click()
}

// ============================================================================
// PAUTA-GERAL EXPORT FUNCTIONS
// ============================================================================

interface ComponenteAvaliacao {
    id: string
    codigo_componente: string
    nome: string
    peso_percentual: number
    trimestre: number
    is_calculated?: boolean
    formula_expression?: string | null
    tipo_calculo?: 'trimestral' | 'anual' | string | null
}

interface DisciplinaComComponentes {
    id: string
    nome: string
    codigo_disciplina: string
    ordem: number
    componentes: ComponenteAvaliacao[]
}

interface PautaGeralData {
    turma: {
        nome: string
        ano_lectivo: number
        codigo_turma: string
        nivel_ensino: string
    }
    trimestre: number
    nivel_ensino?: string
    classe?: string
    alunos: Array<{
        numero_processo: string
        nome_completo: string
        genero?: 'M' | 'F'
        notas_por_disciplina: Record<string, Record<string, number>>
        media_geral?: number
        observacao?: 'Transita' | 'Não Transita' | 'Condicional' | 'AguardandoNotas' | string
    }>
    disciplinas: DisciplinaComComponentes[]
    estatisticas?: {
        por_disciplina: Record<string, any>
        geral: any
    }
}

export function generatePautaGeralExcel(
    data: PautaGeralData,
    exportConfig: PautaGeralExportConfig = DEFAULT_PAUTA_GERAL_EXPORT_CONFIG,
    metricSourceComponentes: ComponenteAvaliacao[] = []
): void {
    const cfg = { ...DEFAULT_PAUTA_GERAL_EXPORT_CONFIG, ...exportConfig }
    const disciplinas = data.disciplinas.filter((d) => d.componentes.length > 0)
    const workbook = XLSX.utils.book_new()

    const disciplineHeaderRow: any[] = []
    const componentHeaderRow: any[] = []

    if (cfg.showNumeroProcesso) {
        disciplineHeaderRow.push('Nº')
        componentHeaderRow.push('')
    }
    if (cfg.showNomeCompleto) {
        disciplineHeaderRow.push('Nome do Aluno')
        componentHeaderRow.push('')
    }
    disciplineHeaderRow.push('GÊN')
    componentHeaderRow.push('')

    disciplinas.forEach((disc) => {
        disciplineHeaderRow.push(disc.nome)
        for (let i = 1; i < disc.componentes.length; i++) {
            disciplineHeaderRow.push('')
        }
        disc.componentes.forEach((comp) => {
            componentHeaderRow.push(formatComponentePautaLabel(comp))
        })
    })

    if (cfg.showMediaGeral) {
        disciplineHeaderRow.push('MG')
        componentHeaderRow.push('')
    }
    if (cfg.showObservacao) {
        disciplineHeaderRow.push('Observação')
        componentHeaderRow.push('')
    }

    const dataRows = data.alunos.map((aluno, index) => {
        const row: any[] = []
        if (cfg.showNumeroProcesso) row.push(index + 1)
        if (cfg.showNomeCompleto) row.push(aluno.nome_completo)
        row.push(aluno.genero || '-')

        disciplinas.forEach((disc) => {
            const notasDisciplina = aluno.notas_por_disciplina[disc.id] || {}
            disc.componentes.forEach((comp) => {
                const nota = notasDisciplina[comp.id]
                row.push(nota !== undefined ? nota : '')
            })
        })

        if (cfg.showMediaGeral) {
            row.push(aluno.media_geral !== undefined ? aluno.media_geral : '')
        }
        if (cfg.showObservacao) {
            row.push(formatObservacaoPautaLabel(aluno.observacao))
        }

        return row
    })

    const infoRows = [
        ['PAUTA-GERAL'],
        [`Turma: ${data.turma.nome}`, '', `Ano Lectivo: ${data.turma.ano_lectivo}`],
        [`Trimestre: ${data.trimestre}º`],
        []
    ]

    const headerRows = [...infoRows, disciplineHeaderRow, componentHeaderRow]

    const statsRows: any[][] = []
    if (cfg.showStatistics && data.estatisticas) {
        statsRows.push(
            [],
            ['ESTATÍSTICAS GERAIS', '', '', ''],
            ['Total', 'Aprovados', 'Reprovados', 'Média'],
            [
                data.estatisticas.geral.total_alunos,
                data.estatisticas.geral.aprovados,
                data.estatisticas.geral.reprovados,
                data.estatisticas.geral.media_turma?.toFixed(2) || 'N/A',
            ]
        )
    }

    const legendTable = buildPautaGeralLegendaTableRows(
        disciplinas.flatMap((d) => d.componentes),
        {
            nivelEnsino: data.nivel_ensino || data.turma.nivel_ensino,
            classe: data.classe,
            showMediaGeral: cfg.showMediaGeral,
            showObservacao: cfg.showObservacao,
            componenteParaMediaGeral: cfg.componenteParaMediaGeral,
            metricSourceComponentes,
        }
    )
    const legendRows: any[][] = [
        [],
        ['LEGENDA — conforme configuração desta pauta', ''],
        ['Item', 'Detalhe / Fórmula'],
        ...legendTable.map((r) => [r.item, r.detalhe]),
    ]

    const allRows = [...headerRows, ...dataRows, ...statsRows, ...legendRows]
    const worksheet = XLSX.utils.aoa_to_sheet(allRows)

    const headerRowIndex = 4
    const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = []
    let currentCol = 0

    if (cfg.showNumeroProcesso) {
        merges.push({ s: { r: headerRowIndex, c: currentCol }, e: { r: headerRowIndex + 1, c: currentCol } })
        currentCol++
    }
    if (cfg.showNomeCompleto) {
        merges.push({ s: { r: headerRowIndex, c: currentCol }, e: { r: headerRowIndex + 1, c: currentCol } })
        currentCol++
    }
    merges.push({ s: { r: headerRowIndex, c: currentCol }, e: { r: headerRowIndex + 1, c: currentCol } })
    currentCol++

    disciplinas.forEach((disc) => {
        if (disc.componentes.length > 1) {
            merges.push({
                s: { r: headerRowIndex, c: currentCol },
                e: { r: headerRowIndex, c: currentCol + disc.componentes.length - 1 }
            })
        }
        currentCol += disc.componentes.length
    })

    if (cfg.showMediaGeral) {
        merges.push({ s: { r: headerRowIndex, c: currentCol }, e: { r: headerRowIndex + 1, c: currentCol } })
        currentCol++
    }
    if (cfg.showObservacao) {
        merges.push({ s: { r: headerRowIndex, c: currentCol }, e: { r: headerRowIndex + 1, c: currentCol } })
    }

    worksheet['!merges'] = merges
    worksheet['!cols'] = [
        ...(cfg.showNumeroProcesso ? [{ wch: 5 }] : []),
        ...(cfg.showNomeCompleto ? [{ wch: 30 }] : []),
        { wch: 5 },
        ...disciplinas.flatMap((disc) => disc.componentes.map(() => ({ wch: 10 }))),
        ...(cfg.showMediaGeral ? [{ wch: 8 }] : []),
        ...(cfg.showObservacao ? [{ wch: 16 }] : []),
    ]

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pauta-Geral')
    XLSX.writeFile(workbook, `pauta-geral_${data.turma.codigo_turma}_${data.trimestre}trim.xlsx`)
}

export function generatePautaGeralCSV(
    data: PautaGeralData,
    exportConfig: PautaGeralExportConfig = DEFAULT_PAUTA_GERAL_EXPORT_CONFIG,
    metricSourceComponentes: ComponenteAvaliacao[] = []
): void {
    const cfg = { ...DEFAULT_PAUTA_GERAL_EXPORT_CONFIG, ...exportConfig }
    const disciplinas = data.disciplinas.filter((d) => d.componentes.length > 0)

    const headers: string[] = []
    if (cfg.showNumeroProcesso) headers.push('Nº')
    if (cfg.showNomeCompleto) headers.push('Nome do Aluno')
    headers.push('GÊN')

    disciplinas.forEach((disc) => {
        disc.componentes.forEach((comp) => {
            headers.push(`${disc.nome} - ${formatComponentePautaLabel(comp)}`)
        })
    })
    if (cfg.showMediaGeral) headers.push('MG')
    if (cfg.showObservacao) headers.push('Observação')

    const rows = data.alunos.map((aluno, index) => {
        const row: any[] = []
        if (cfg.showNumeroProcesso) row.push(index + 1)
        if (cfg.showNomeCompleto) row.push(aluno.nome_completo)
        row.push(aluno.genero || '-')

        disciplinas.forEach((disc) => {
            const notasDisciplina = aluno.notas_por_disciplina[disc.id] || {}
            disc.componentes.forEach((comp) => {
                const nota = notasDisciplina[comp.id]
                row.push(nota !== undefined ? nota : '')
            })
        })

        if (cfg.showMediaGeral) {
            row.push(aluno.media_geral !== undefined ? aluno.media_geral : '')
        }
        if (cfg.showObservacao) {
            row.push(formatObservacaoPautaLabel(aluno.observacao))
        }

        return row
    })

    const legendTable = buildPautaGeralLegendaTableRows(
        disciplinas.flatMap((d) => d.componentes),
        {
            nivelEnsino: data.nivel_ensino || data.turma.nivel_ensino,
            classe: data.classe,
            showMediaGeral: cfg.showMediaGeral,
            showObservacao: cfg.showObservacao,
            componenteParaMediaGeral: cfg.componenteParaMediaGeral,
            metricSourceComponentes,
        }
    )

    const escapeCsv = (v: any) => {
        const s = String(v ?? '')
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`
        }
        return s
    }

    const csvContent = [
        headers.map(escapeCsv).join(','),
        ...rows.map((row) => row.map(escapeCsv).join(',')),
        '',
        ['LEGENDA — conforme configuração desta pauta', ''].map(escapeCsv).join(','),
        ['Item', 'Detalhe / Fórmula'].map(escapeCsv).join(','),
        ...legendTable.map((r) => [r.item, r.detalhe].map(escapeCsv).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `pauta-geral_${data.turma.codigo_turma}_${data.trimestre}trim.csv`
    link.click()
}

