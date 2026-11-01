import { supabase } from '../../../lib/supabaseClient'
import { getModalidade, nivelMatchesModalidade } from '../catalog'
import {
    AproveitamentoClasse,
    CensoDadosComplementares,
    CensoGeracaoResultado,
    CensoIdentificacaoMed,
    CensoInfraestrutura,
    ContagemMF,
    ContagemNacionalidadeMF,
    MatriculasPorClasseTurno,
    MatriculasPorDeficiencia,
    MatriculasPorIdade,
    ModalidadeCensoCodigo,
    ProfessoresCruzamento,
    ProfessoresPorNivelAcademico,
    ProfessoresQualificacao,
    SexoCenso,
    TipoDeficiencia,
    TurnoCenso,
} from '../types'
import { calcIdade, defaultDataReferenciaIdade, faixaEtariaFor } from '../utils/ageBands'
import { extractClasseFromTurmaNome, normalizeClasseLabel } from '../utils/classeFromTurma'

function emptyMF(): ContagemMF {
    return { M: 0, F: 0, total: 0 }
}

function addSexo(target: ContagemMF, genero: string | null | undefined) {
    if (genero === 'M' || genero === 'F') {
        target[genero]++
        target.total++
    } else {
        // Sem sexo declarado: não entra em M/F; contabiliza só no total global de alunos
    }
}

function normalizeTurno(turno: string | null | undefined): TurnoCenso | null {
    if (!turno) return null
    const t = turno.toLowerCase()
    if (t.includes('manh')) return 'manhã'
    if (t.includes('tard')) return 'tarde'
    if (t.includes('noit')) return 'noite'
    return null
}

function mapGrauToNivelAcademico(grau: string | null | undefined, modalidade: ModalidadeCensoCodigo): string {
    if (!grau) return 'Não especificado'
    const g = grau.toLowerCase()
    if (g.includes('doutor')) return 'Doutoramento'
    if (g.includes('mestr')) return 'Mestrado'
    if (g.includes('licenc')) return 'Licenciatura'
    if (g.includes('bacharel')) return 'Bacharelato'
    if (g.includes('médio') || g.includes('medio') || g.includes('ii ciclo') || g.includes('2º ciclo') || g.includes('2 ciclo')) {
        return modalidade === 'ensino_primario_geral' ? 'II Ciclo Ens. Secundário' : 'II Ciclo Ens. Secundário'
    }
    if (g.includes('i ciclo') || g.includes('1º ciclo') || g.includes('1 ciclo') || g.includes('7') || g.includes('9')) {
        return 'I Ciclo Ens. Secundário'
    }
    if (g.includes('primár') || g.includes('primar')) return '< I Ciclo Ens. Secundário'
    return grau
}

export function anoAnterior(anoLectivo: string): string {
    const parts = anoLectivo.split(/[\/\-]/).map(p => p.trim()).filter(Boolean)
    if (parts.length >= 2) {
        const a = parseInt(parts[0], 10)
        const b = parseInt(parts[1], 10)
        if (!Number.isNaN(a) && !Number.isNaN(b)) {
            const prevA = a - 1
            const prevB = b - 1
            const sep = anoLectivo.includes('/') ? '/' : '-'
            return `${prevA}${sep}${String(prevB).slice(-2).padStart(parts[1].length, '0')}`
        }
    }
    const y = parseInt(parts[0], 10)
    if (!Number.isNaN(y)) return String(y - 1)
    return anoLectivo
}

export async function gerarQuestionarioCenso(params: {
    escolaId: string
    anoLectivo: string
    modalidadeCodigo: ModalidadeCensoCodigo
    dataReferenciaIdade?: Date
    infraestrutura?: CensoInfraestrutura | null
    identificacao?: CensoIdentificacaoMed | null
    complementares?: CensoDadosComplementares | null
}): Promise<CensoGeracaoResultado> {
    const modalidade = getModalidade(params.modalidadeCodigo)
    const dataRef = params.dataReferenciaIdade || defaultDataReferenciaIdade(params.anoLectivo)
    const lacunas: string[] = []

    const { data: escola, error: escolaError } = await supabase
        .from('escolas')
        .select('id, nome, codigo_escola, provincia, municipio')
        .eq('id', params.escolaId)
        .single()

    if (escolaError || !escola) throw new Error(escolaError?.message || 'Escola não encontrada')

    // Turmas do ano (todas as trimestres) — deduplicar por nome+turno para contagem de turmas
    const { data: turmasRaw, error: turmasError } = await supabase
        .from('turmas')
        .select('id, nome, turno, nivel_ensino, trimestre, ano_lectivo')
        .eq('escola_id', params.escolaId)
        .eq('ano_lectivo', params.anoLectivo)

    if (turmasError) throw turmasError

    const turmasModalidade = (turmasRaw || []).filter(t =>
        nivelMatchesModalidade(t.nivel_ensino, modalidade)
    )

    // Filtrar por classes da modalidade
    type TurmaRow = typeof turmasModalidade[number] & { classe: string }
    const turmasComClasse: TurmaRow[] = []
    for (const t of turmasModalidade) {
        const classe = extractClasseFromTurmaNome(t.nome)
        if (!classe) continue
        const classeNorm = normalizeClasseLabel(classe)
        if (!modalidade.classes.includes(classeNorm)) continue
        turmasComClasse.push({ ...t, classe: classeNorm })
    }

    if (turmasComClasse.length === 0) {
        lacunas.push(`Não foram encontradas turmas de ${modalidade.nome} no ano lectivo ${params.anoLectivo}.`)
    }

    // Preferir trimestre 3 (ou o mais alto) para matrículas actuais, evitando triplicar alunos
    const maxTrimestre = turmasComClasse.reduce((m, t) => Math.max(m, Number(t.trimestre) || 0), 0) || 3
    const turmasSnapshot = turmasComClasse.filter(t => Number(t.trimestre) === maxTrimestre)
    const turmasParaContagem = turmasSnapshot.length > 0 ? turmasSnapshot : turmasComClasse

    const turmaIds = turmasParaContagem.map(t => t.id)

    let alunos: Array<{
        id: string
        turma_id: string
        genero: string | null
        data_nascimento: string | null
        tipo_deficiencia: string | null
        primeira_matricula_na_classe: boolean | null
        frequentou_pre_escolar: boolean | null
        ativo: boolean | null
    }> = []

    if (turmaIds.length > 0) {
        const { data: alunosData, error: alunosError } = await supabase
            .from('alunos')
            .select(
                'id, turma_id, genero, data_nascimento, tipo_deficiencia, primeira_matricula_na_classe, frequentou_pre_escolar, ativo'
            )
            .in('turma_id', turmaIds)
            .eq('ativo', true)

        if (alunosError) {
            // Colunas do censo podem ainda não existir se a migration não estiver aplicada
            if (
                alunosError.message?.includes('tipo_deficiencia') ||
                alunosError.message?.includes('primeira_matricula') ||
                alunosError.message?.includes('frequentou_pre')
            ) {
                lacunas.push('Campos do censo nos alunos ainda não estão na base de dados. Aplique a migration do censo.')
                const { data: fallback, error: fbErr } = await supabase
                    .from('alunos')
                    .select('id, turma_id, genero, data_nascimento, ativo')
                    .in('turma_id', turmaIds)
                    .eq('ativo', true)
                if (fbErr) throw fbErr
                alunos = (fallback || []).map(a => ({
                    ...a,
                    tipo_deficiencia: null,
                    primeira_matricula_na_classe: null,
                    frequentou_pre_escolar: null,
                }))
            } else {
                throw alunosError
            }
        } else {
            alunos = alunosData || []
        }
    }

    const turmaById = new Map(turmasParaContagem.map(t => [t.id, t]))

    // --- Matrículas por classe × turno ---
    const matriculasMap = new Map<string, MatriculasPorClasseTurno>()
    const turmasUnicas = new Set<string>()

    for (const classe of modalidade.classes) {
        for (const turno of modalidade.turnos) {
            const key = `${classe}|${turno}`
            matriculasMap.set(key, {
                classe,
                turno,
                matriculas: 0,
                turmas: 0,
                turmas_ar_livre: 0,
            })
        }
    }

    for (const t of turmasParaContagem) {
        const turno = normalizeTurno(t.turno) || 'manhã'
        if (!modalidade.turnos.includes(turno)) continue
        const key = `${t.classe}|${turno}`
        const row = matriculasMap.get(key)
        if (!row) continue
        const uniqueKey = `${t.nome}|${turno}|${t.classe}`
        if (!turmasUnicas.has(uniqueKey)) {
            turmasUnicas.add(uniqueKey)
            row.turmas++
            if (params.complementares?.turmas_ar_livre?.[t.id]) {
                row.turmas_ar_livre++
            }
        }
    }

    let totalAlunos = 0
    let alunosSemSexo = 0
    let alunosSemNascimento = 0
    let alunosComDeficienciaPreenchida = 0

    for (const aluno of alunos) {
        const turma = turmaById.get(aluno.turma_id)
        if (!turma) continue
        const turno = normalizeTurno(turma.turno) || 'manhã'
        const key = `${turma.classe}|${turno}`
        const row = matriculasMap.get(key)
        if (row) row.matriculas++
        totalAlunos++
        if (aluno.genero !== 'M' && aluno.genero !== 'F') alunosSemSexo++
        if (!aluno.data_nascimento) alunosSemNascimento++
        if (aluno.tipo_deficiencia && aluno.tipo_deficiencia !== 'nenhuma') {
            alunosComDeficienciaPreenchida++
        }
    }

    if (alunosSemSexo > 0) {
        lacunas.push(`${alunosSemSexo} aluno(s) sem sexo (M/F) — excluídos das tabelas por sexo.`)
    }
    if (alunosSemNascimento > 0) {
        lacunas.push(`${alunosSemNascimento} aluno(s) sem data de nascimento — entram em "Idade não especificada".`)
    }

    // --- Idade × sexo ---
    const idadeMap = new Map<string, MatriculasPorIdade>()
    for (const classe of modalidade.classes) {
        for (const faixa of modalidade.faixasEtarias) {
            idadeMap.set(`${classe}|${faixa}`, { classe, faixa_etaria: faixa, M: 0, F: 0 })
        }
    }

    for (const aluno of alunos) {
        const turma = turmaById.get(aluno.turma_id)
        if (!turma) continue
        if (aluno.genero !== 'M' && aluno.genero !== 'F') continue
        const idade = calcIdade(aluno.data_nascimento, dataRef)
        const faixa = faixaEtariaFor(params.modalidadeCodigo, idade)
        const cell = idadeMap.get(`${turma.classe}|${faixa}`)
        if (cell) cell[aluno.genero as SexoCenso]++
    }

    // --- Deficiência ---
    const defMap = new Map<string, MatriculasPorDeficiencia>()
    for (const classe of modalidade.classes) {
        for (const def of modalidade.deficiencias) {
            defMap.set(`${classe}|${def}`, { classe, tipo_deficiencia: def, M: 0, F: 0 })
        }
    }

    let temAlgumaDeficiencia = false
    for (const aluno of alunos) {
        const turma = turmaById.get(aluno.turma_id)
        if (!turma) continue
        if (aluno.genero !== 'M' && aluno.genero !== 'F') continue
        const def = (aluno.tipo_deficiencia || 'nenhuma') as TipoDeficiencia
        if (def === 'nenhuma') continue
        temAlgumaDeficiencia = true
        const cell = defMap.get(`${turma.classe}|${def}`)
        if (cell) cell[aluno.genero as SexoCenso]++
    }

    if (!temAlgumaDeficiencia) {
        lacunas.push('Nenhum aluno com tipo de deficiência registado. Preencha o campo nos alunos para o bloco de inclusão.')
    }

    // --- Professores ---
    type ProfRow = {
        id: string
        genero: string | null
        grau_academico: string | null
        formacao_pedagogica: boolean | null
        nacionalidade_censo: string | null
        interprete_lingua_gestual: boolean | null
        formacao_diferenciada_sala: boolean | null
        participou_dpc_12_meses: boolean | null
        ativo: boolean | null
        nacionalidade: string | null
    }

    let profs: ProfRow[] = []
    const { data: professores, error: profError } = await supabase
        .from('professores')
        .select('id, genero, grau_academico, formacao_pedagogica, nacionalidade_censo, interprete_lingua_gestual, formacao_diferenciada_sala, participou_dpc_12_meses, ativo, nacionalidade')
        .eq('escola_id', params.escolaId)
        .eq('ativo', true)

    if (profError) {
        lacunas.push('Campos de formação pedagógica dos professores ainda não estão na BD. Aplique a migration do censo.')
        const { data: fallbackProfs, error: fbProfErr } = await supabase
            .from('professores')
            .select('id, genero, grau_academico, ativo, nacionalidade')
            .eq('escola_id', params.escolaId)
            .eq('ativo', true)
        if (fbProfErr) throw fbProfErr
        profs = (fallbackProfs || []).map(p => ({
            ...p,
            formacao_pedagogica: null,
            nacionalidade_censo: null,
            interprete_lingua_gestual: null,
            formacao_diferenciada_sala: null,
            participou_dpc_12_meses: null,
        }))
    } else {
        profs = (professores || []).map(p => ({
            ...p,
            participou_dpc_12_meses: (p as any).participou_dpc_12_meses ?? null,
        }))
    }
    const nivelMap = new Map<string, ProfessoresPorNivelAcademico>()
    const qualificacao: ProfessoresQualificacao = {
        com_formacao_pedagogica: emptyMF(),
        sem_formacao_pedagogica: emptyMF(),
        nacionais: emptyMF(),
        estrangeiros: emptyMF(),
        formacao_diferenciada: emptyMF(),
        interpretes_lga: emptyMF(),
    }

    const emptyNac = (): ContagemNacionalidadeMF => ({ nacionais: emptyMF(), estrangeiros: emptyMF() })
    const cruzamento: ProfessoresCruzamento = {
        com_formacao_pedagogica: emptyNac(),
        sem_formacao_pedagogica: emptyNac(),
        formacao_diferenciada: emptyNac(),
        interpretes_lga: emptyNac(),
        dpc_12_meses: emptyNac(),
    }

    let profsSemGenero = 0
    let profsSemFormacaoFlag = 0

    for (const p of profs) {
        const sexo = p.genero === 'M' || p.genero === 'F' ? (p.genero as SexoCenso) : null
        if (!sexo) {
            profsSemGenero++
            continue
        }
        const nivel = mapGrauToNivelAcademico(p.grau_academico, params.modalidadeCodigo)
        if (!nivelMap.has(nivel)) nivelMap.set(nivel, { nivel_academico: nivel, M: 0, F: 0 })
        nivelMap.get(nivel)![sexo]++

        if (p.formacao_pedagogica === true) addSexo(qualificacao.com_formacao_pedagogica, sexo)
        else if (p.formacao_pedagogica === false) addSexo(qualificacao.sem_formacao_pedagogica, sexo)
        else profsSemFormacaoFlag++

        const nac = p.nacionalidade_censo
            || (p.nacionalidade && /angola/i.test(p.nacionalidade) ? 'nacional' : null)
        if (nac === 'nacional') addSexo(qualificacao.nacionais, sexo)
        else if (nac === 'estrangeiro') addSexo(qualificacao.estrangeiros, sexo)

        if (p.formacao_diferenciada_sala) addSexo(qualificacao.formacao_diferenciada, sexo)
        if (p.interprete_lingua_gestual) addSexo(qualificacao.interpretes_lga, sexo)

        // Cruzamento formação × nacionalidade × sexo (modelo MED, secção 9)
        const nacKey = nac === 'nacional' ? 'nacionais' : nac === 'estrangeiro' ? 'estrangeiros' : null
        if (nacKey) {
            if (p.formacao_pedagogica === true) addSexo(cruzamento.com_formacao_pedagogica[nacKey], sexo)
            else if (p.formacao_pedagogica === false) addSexo(cruzamento.sem_formacao_pedagogica[nacKey], sexo)
            if (p.formacao_diferenciada_sala) addSexo(cruzamento.formacao_diferenciada[nacKey], sexo)
            if (p.interprete_lingua_gestual) addSexo(cruzamento.interpretes_lga[nacKey], sexo)
            if (p.participou_dpc_12_meses) addSexo(cruzamento.dpc_12_meses![nacKey], sexo)
        }
    }

    const classeIngresso =
        params.modalidadeCodigo === 'ensino_primario_geral'
            ? '1ª Classe'
            : params.modalidadeCodigo === 'i_ciclo_secundario_geral'
              ? '7ª Classe'
              : '10ª Classe'
    const infoClasseIngresso = {
        classe: classeIngresso,
        vagas:
            params.identificacao?.vagas_classe_ingresso ??
            params.complementares?.vagas_1a_classe ??
            null,
        primeira_vez: emptyMF(),
        frequentou_pre_escolar: emptyMF(),
    }
    for (const aluno of alunos) {
        const turma = turmaById.get(aluno.turma_id)
        if (!turma || turma.classe !== classeIngresso) continue
        if (aluno.genero !== 'M' && aluno.genero !== 'F') continue
        if (aluno.primeira_matricula_na_classe) {
            addSexo(infoClasseIngresso.primeira_vez, aluno.genero)
            if (aluno.frequentou_pre_escolar) {
                addSexo(infoClasseIngresso.frequentou_pre_escolar, aluno.genero)
            }
        }
    }

    if (profsSemGenero > 0) lacunas.push(`${profsSemGenero} professor(es) sem género — excluídos das tabelas por sexo.`)
    if (profsSemFormacaoFlag > 0) {
        lacunas.push(`${profsSemFormacaoFlag} professor(es) sem indicação de formação pedagógica.`)
    }

    // --- Aproveitamento ano anterior via matrículas ---
    const prevAno = anoAnterior(params.anoLectivo)
    const aproveitamento: AproveitamentoClasse[] = modalidade.classes.map(classe => ({
        classe,
        matriculados: emptyMF(),
        aprovados: emptyMF(),
        reprovados: emptyMF(),
        desistentes: emptyMF(),
        transferidos: emptyMF(),
    }))
    const aprovByClasse = new Map(aproveitamento.map(a => [a.classe, a]))

    const { data: mats, error: matsError } = await supabase
        .from('matriculas')
        .select('classe_origem, status_transicao, aluno_id, alunos(genero)')
        .eq('escola_id', params.escolaId)
        .eq('ano_lectivo_origem', prevAno)

    if (matsError) {
        lacunas.push(`Não foi possível carregar aproveitamento de ${prevAno}: ${matsError.message}`)
    } else if (!mats || mats.length === 0) {
        lacunas.push(`Sem registos de matrícula/transição para o ano anterior (${prevAno}). Bloco de aproveitamento fica a zeros.`)
    } else {
        for (const m of mats) {
            const classeRaw = m.classe_origem
            if (!classeRaw) continue
            const classe = normalizeClasseLabel(classeRaw)
            const row = aprovByClasse.get(classe)
            if (!row) continue
            const genero = (m as any).alunos?.genero as string | null
            if (genero !== 'M' && genero !== 'F') continue
            addSexo(row.matriculados, genero)
            if (m.status_transicao === 'Transita' || m.status_transicao === 'Condicional') {
                addSexo(row.aprovados, genero)
            } else if (m.status_transicao === 'Não Transita') {
                addSexo(row.reprovados, genero)
            } else if (/desist|abandon/i.test(m.status_transicao || '')) {
                addSexo(row.desistentes, genero)
            } else if (/transf/i.test(m.status_transicao || '')) {
                addSexo(row.transferidos, genero)
            }
        }
    }

    const praeerRows: MatriculasPorClasseTurno[] = []
    const praeer = params.complementares?.praeer
    if (praeer) {
        ;(['1', '2', '3'] as const).forEach(etapa => {
            const e = praeer[etapa]
            ;(['manhã', 'tarde'] as const).forEach(turno => {
                const t = e?.[turno]
                if (!t) return
                if (!t.matriculas && !t.turmas && !t.turmas_ar_livre) return
                praeerRows.push({
                    classe: `PRAEER Etapa ${etapa}`,
                    turno,
                    matriculas: t.matriculas || 0,
                    turmas: t.turmas || 0,
                    turmas_ar_livre: t.turmas_ar_livre || 0,
                })
            })
        })
    }

    const manuais = params.complementares?.manuais || {}
    if (params.modalidadeCodigo === 'ensino_primario_geral') {
        if (!Object.values(manuais).some(v => typeof v === 'number' && v > 0)) {
            lacunas.push('Manuais escolares não preenchidos — indique-os no separador Dados do mapa.')
        }
        if (infoClasseIngresso.vagas == null) {
            lacunas.push('Vagas da 1ª classe não preenchidas — indique-as no separador Identificação.')
        }
    }

    if (!params.identificacao?.codigo_escola_med?.trim()) {
        lacunas.push('Código da escola (atribuído pela Direcção Municipal) não preenchido — indique-o no separador Identificação.')
    }
    if (!params.identificacao?.id_questionario?.trim()) {
        lacunas.push('ID do questionário não preenchido — indique-o no separador Identificação.')
    }

    if (!params.infraestrutura) {
        lacunas.push('Infraestrutura/mobiliário não preenchidos — bloco 1–2 do questionário fica vazio até cadastro manual.')
    } else {
        const infra = params.infraestrutura
        if (!infra.total_salas && !infra.salas_proprias) {
            lacunas.push('Infraestrutura registada sem salas — confirme os números antes de submeter ao MED.')
        }
    }

    const payload = {
        cabecalho: {
            codigo_escola: escola.codigo_escola,
            codigo_escola_med: params.identificacao?.codigo_escola_med?.trim() || '',
            id_questionario: params.identificacao?.id_questionario?.trim() || '',
            nome_instituicao: escola.nome,
            provincia: escola.provincia,
            municipio: escola.municipio,
            ano_lectivo: params.anoLectivo,
            modalidade_codigo: params.modalidadeCodigo,
            modalidade_nome: modalidade.nome,
            data_referencia_idade: [
                dataRef.getFullYear(),
                String(dataRef.getMonth() + 1).padStart(2, '0'),
                String(dataRef.getDate()).padStart(2, '0'),
            ].join('-'),
            mes_inicio: params.infraestrutura?.mes_inicio ?? null,
            mes_termino: params.infraestrutura?.mes_termino ?? null,
        },
        infraestrutura: params.infraestrutura || null,
        matriculas_classe_turno: [...Array.from(matriculasMap.values()), ...praeerRows],
        matriculas_idade: Array.from(idadeMap.values()),
        matriculas_deficiencia: Array.from(defMap.values()),
        professores_nivel_academico: Array.from(nivelMap.values()),
        professores_qualificacao: qualificacao,
        professores_cruzamento: cruzamento,
        aproveitamento_ano_anterior: aproveitamento,
        info_classe_ingresso: infoClasseIngresso,
        manuais,
        dados_complementares: params.complementares || undefined,
        totais: {
            alunos: totalAlunos,
            turmas: turmasUnicas.size,
            professores: profs.length,
            alunos_com_deficiencia: alunosComDeficienciaPreenchida,
        },
    }

    return { payload: payload as any, lacunas }
}
