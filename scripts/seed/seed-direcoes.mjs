/**
 * Seed Direções Municipais + Provinciais with related test data.
 */
import {
    SEED_MARKER,
    createAuthUser,
    log,
    sleep,
} from './_shared.mjs'
import {
    MUNICIPAL_DIRECTIONS,
    PROVINCIAL_DIRECTIONS,
    SOLICITACAO_SCENARIOS,
    buildMunicipalAuthPlan,
    buildProvincialAuthPlan,
    municipalCircularsPlan,
    provincialCircularsPlan,
} from './direcoes-catalog.mjs'

/**
 * user_profiles → role_cache trigger may omit is_direcao_* flags.
 * Force-correct profile + cache so RLS helpers (is_direcao_municipal, etc.) work.
 */
async function ensureDirecaoProfileAndCache(supabase, { userId, tipo, ativo, provincia, municipio }) {
    const { error: pErr } = await supabase.from('user_profiles').upsert(
        {
            user_id: userId,
            tipo_perfil: tipo,
            escola_id: null,
            ativo,
        },
        { onConflict: 'user_id' }
    )
    if (pErr) throw new Error(`user_profiles upsert(${tipo}): ${pErr.message}`)

    const isDm = tipo === 'DIRECAO_MUNICIPAL' && ativo
    const isDp = tipo === 'DIRECAO_PROVINCIAL' && ativo

    const { error: cErr } = await supabase.from('role_cache').upsert(
        {
            user_id: userId,
            tipo_perfil: tipo,
            escola_id: null,
            ativo,
            is_superadmin: false,
            is_direcao_municipal: isDm,
            is_direcao_provincial: isDp,
            is_escola: false,
            municipio: tipo === 'DIRECAO_MUNICIPAL' ? municipio : null,
            provincia: provincia || null,
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
    )
    if (cErr) throw new Error(`role_cache upsert(${tipo}): ${cErr.message}`)
}

async function seedProvincial(supabase, dir) {
    const auth = buildProvincialAuthPlan(dir)
    const user = await createAuthUser(supabase, auth)
    await sleep(100)

    const row = {
        user_id: user.id,
        nome: dir.nome,
        provincia: dir.provincia,
        email: auth.email,
        telefone: dir.telefone,
        cargo: dir.cargo,
        numero_funcionario: dir.numero_funcionario,
        ativo: dir.ativo,
        bloqueado: dir.bloqueado === true,
        bloqueado_motivo: dir.bloqueado ? dir.bloqueado_motivo || null : null,
        bloqueado_em: dir.bloqueado ? new Date().toISOString() : null,
    }

    const { data, error } = await supabase
        .from('direcoes_provinciais')
        .insert(row)
        .select('id, nome, provincia, email, ativo, user_id')
        .single()

    if (error) throw new Error(`direcoes_provinciais(${dir.key}): ${error.message}`)

    await ensureDirecaoProfileAndCache(supabase, {
        userId: user.id,
        tipo: 'DIRECAO_PROVINCIAL',
        ativo: dir.ativo,
        provincia: dir.provincia,
        municipio: null,
    })

    return { ...data, key: dir.key, auth, plan: dir }
}

async function seedMunicipal(supabase, dir) {
    const auth = buildMunicipalAuthPlan(dir)
    const user = await createAuthUser(supabase, auth)
    await sleep(100)

    const row = {
        user_id: user.id,
        nome: dir.nome,
        provincia: dir.provincia,
        municipio: dir.municipio,
        email: auth.email,
        telefone: dir.telefone,
        cargo: dir.cargo,
        numero_funcionario: dir.numero_funcionario,
        ativo: dir.ativo,
        bloqueado: dir.bloqueado === true,
        bloqueado_motivo: dir.bloqueado ? dir.bloqueado_motivo || null : null,
        bloqueado_em: dir.bloqueado ? new Date().toISOString() : null,
    }

    const { data, error } = await supabase
        .from('direcoes_municipais')
        .insert(row)
        .select('id, nome, municipio, provincia, email, ativo, bloqueado, user_id')
        .single()

    if (error) throw new Error(`direcoes_municipais(${dir.key}): ${error.message}`)

    await ensureDirecaoProfileAndCache(supabase, {
        userId: user.id,
        tipo: 'DIRECAO_MUNICIPAL',
        ativo: dir.ativo,
        provincia: dir.provincia,
        municipio: dir.municipio,
    })

    return { ...data, key: dir.key, auth, plan: dir }
}

async function seedProvincialCirculars(supabase, provincials) {
    let count = 0
    for (const p of provincials) {
        if (!p.ativo) continue
        const rows = provincialCircularsPlan(p.provincia, p.user_id)
        const { error } = await supabase.from('circulares_provinciais').insert(rows)
        if (error) throw new Error(`circulares_provinciais(${p.provincia}): ${error.message}`)
        count += rows.length
    }
    return count
}

async function seedMunicipalCirculars(supabase, municipals) {
    let count = 0
    for (const m of municipals) {
        if (!m.ativo || m.bloqueado) continue
        const rows = municipalCircularsPlan(m.municipio, m.provincia, m.user_id)
        const { error } = await supabase.from('circulares_municipais').insert(rows)
        if (error) throw new Error(`circulares_municipais(${m.municipio}): ${error.message}`)
        count += rows.length
    }
    return count
}

async function markCircularRead(supabase, { circularId, escolaId, lidoPor, municipalId = null }) {
    if (municipalId) {
        // provincial circular read by municipal
        const { error } = await supabase.from('leituras_circulares_provinciais').insert({
            circular_id: circularId,
            direcao_municipal_id: municipalId,
            escola_id: null,
            lido_por: lidoPor,
        })
        if (error && !/duplicate|unique/i.test(error.message)) {
            console.warn(`  ! leitura provincial: ${error.message}`)
        }
        return
    }

    const { error } = await supabase.from('leitura_circulares').insert({
        circular_id: circularId,
        escola_id: escolaId,
        lido_por: lidoPor,
        lido_por_nome: 'Admin Seed',
        lido_por_cargo: 'Director',
    })
    if (error && !/duplicate|unique/i.test(error.message)) {
        console.warn(`  ! leitura municipal: ${error.message}`)
    }
}

async function seedLeituras(supabase, provincials, municipals, escolasByCodigo) {
    let count = 0

    // Municipal circulars: mark linked school as having read the first published circular
    for (const m of municipals) {
        if (!m.ativo || m.bloqueado || !m.plan.linkedSchoolCodigo) continue
        const escola = escolasByCodigo.get(m.plan.linkedSchoolCodigo)
        if (!escola) continue

        const { data: circs } = await supabase
            .from('circulares_municipais')
            .select('id')
            .eq('municipio', m.municipio)
            .eq('publicado', true)
            .like('numero_circular', 'SEED-M-%')
            .order('numero_circular', { ascending: true })
            .limit(1)

        if (circs?.[0] && escola.user_id) {
            await markCircularRead(supabase, {
                circularId: circs[0].id,
                escolaId: escola.id,
                lidoPor: escola.user_id,
            })
            count += 1
        }
    }

    // Provincial circulars: one municipal marks first published as read
    for (const p of provincials) {
        if (!p.ativo) continue
        const municipal = municipals.find((m) => m.provincia === p.provincia && m.ativo && !m.bloqueado)
        if (!municipal) continue

        const { data: circs } = await supabase
            .from('circulares_provinciais')
            .select('id')
            .eq('provincia', p.provincia)
            .eq('publicado', true)
            .like('numero_circular', 'SEED-P-%')
            .order('numero_circular', { ascending: true })
            .limit(1)

        if (circs?.[0]) {
            await markCircularRead(supabase, {
                circularId: circs[0].id,
                escolaId: null,
                lidoPor: municipal.user_id,
                municipalId: municipal.id,
            })
            count += 1
        }
    }

    return count
}

async function seedHistorico(supabase, provincials, municipals, escolasByCodigo) {
    let count = 0

    // Provincial → municipal history (block Caála / Huambo)
    const huamboProv = provincials.find((p) => p.key === 'huambo')
    const caala = municipals.find((m) => m.key === 'caala')
    if (huamboProv && caala) {
        const { error } = await supabase.from('historico_administrativo_direcoes_municipais').insert({
            direcao_municipal_id: caala.id,
            estado_anterior: 'activa',
            estado_novo: 'bloqueada',
            motivo: 'Seed — incumprimento de reporte mensal (teste)',
            observacoes: 'Registo gerado pela seed de testes EduGest.',
            alterado_por: huamboProv.user_id,
            alterado_por_tipo: 'DIRECAO_PROVINCIAL',
        })
        if (error) console.warn(`  ! historico DM: ${error.message}`)
        else count += 1
    }

    // Municipal → school history
    for (const m of municipals) {
        if (!m.plan.linkedSchoolCodigo || !m.ativo) continue
        const escola = escolasByCodigo.get(m.plan.linkedSchoolCodigo)
        if (!escola) continue

        const { error } = await supabase.from('historico_administrativo_escolas').insert({
            escola_id: escola.id,
            estado_anterior: null,
            estado_novo: 'activa',
            motivo: 'Seed — registo inicial de acompanhamento municipal',
            observacoes: `Marcador ${SEED_MARKER}`,
            alterado_por: m.user_id,
            alterado_por_tipo: 'DIRECAO_MUNICIPAL',
        })
        if (error) console.warn(`  ! historico escola ${escola.codigo_escola}: ${error.message}`)
        else count += 1
    }

    return count
}

async function seedSolicitacoes(supabase, municipals, escolasByCodigo) {
    const { data: tipos, error: tErr } = await supabase.from('tipos_documento').select('id, codigo')
    if (tErr) throw new Error(`tipos_documento: ${tErr.message}`)
    const tipoByCodigo = new Map((tipos || []).map((t) => [t.codigo, t.id]))

    let count = 0
    for (const scenario of SOLICITACAO_SCENARIOS) {
        const escola = escolasByCodigo.get(scenario.schoolCodigo)
        if (!escola) {
            console.warn(`  ! solicitação: escola ${scenario.schoolCodigo} não encontrada (corra seed de escolas)`)
            continue
        }

        const tipoId = tipoByCodigo.get(scenario.tipoCodigo)
        if (!tipoId) {
            console.warn(`  ! solicitação: tipo ${scenario.tipoCodigo} em falta`)
            continue
        }

        let solicitanteUserId = escola.user_id
        if (scenario.solicitanteTipo === 'PROFESSOR') {
            const { data: prof } = await supabase
                .from('professores')
                .select('user_id')
                .eq('escola_id', escola.id)
                .eq('ativo', true)
                .not('user_id', 'is', null)
                .limit(1)
                .maybeSingle()
            if (prof?.user_id) solicitanteUserId = prof.user_id
        }

        if (!solicitanteUserId) {
            console.warn(`  ! solicitação sem solicitante para ${scenario.schoolCodigo}`)
            continue
        }

        const municipal = municipals.find(
            (m) => m.plan.linkedSchoolCodigo === scenario.schoolCodigo && m.ativo
        )

        const row = {
            solicitante_user_id: solicitanteUserId,
            solicitante_tipo: scenario.solicitanteTipo,
            escola_id: escola.id,
            tipo_documento_id: tipoId,
            assunto: scenario.assunto,
            descricao: scenario.descricao,
            urgente: scenario.urgente,
            estado: scenario.estado,
            entidade_destino: 'DIRECAO_MUNICIPAL',
            dados_adicionais: { seed: true, seed_marker: SEED_MARKER },
            resposta_direcao: scenario.resposta || null,
            analisado_por:
                scenario.estado !== 'pendente' && municipal ? municipal.user_id : null,
            analisado_em:
                scenario.estado !== 'pendente' ? new Date().toISOString() : null,
            concluido_em: scenario.estado === 'concluido' ? new Date().toISOString() : null,
        }

        const { error } = await supabase.from('solicitacoes_documentos').insert(row)
        if (error) console.warn(`  ! solicitação ${scenario.assunto}: ${error.message}`)
        else count += 1
    }

    return count
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ escolas?: Array<{ id: string, codigo_escola: string, user_id?: string }> }} [ctx]
 */
export async function seedDirecoes(supabase, ctx = {}) {
    log('direcoes', '=== Direções Provinciais + Municipais ===')

    const escolasByCodigo = new Map()
    if (ctx.escolas?.length) {
        for (const e of ctx.escolas) escolasByCodigo.set(e.codigo_escola, e)
    } else {
        const { data } = await supabase
            .from('escolas')
            .select('id, codigo_escola, user_id, municipio, provincia')
            .like('codigo_escola', 'SEED-%')
        for (const e of data || []) escolasByCodigo.set(e.codigo_escola, e)
    }

    const provincials = []
    for (const dir of PROVINCIAL_DIRECTIONS) {
        const created = await seedProvincial(supabase, dir)
        provincials.push(created)
        log(
            'dp',
            `${created.provincia} · ${created.auth.email} · ${created.ativo ? 'activa' : 'pendente'}`
        )
        await sleep(120)
    }

    const municipals = []
    for (const dir of MUNICIPAL_DIRECTIONS) {
        const created = await seedMunicipal(supabase, dir)
        municipals.push(created)
        const status = created.bloqueado
            ? 'bloqueada'
            : created.ativo
              ? 'activa'
              : 'pendente'
        log('dm', `${created.municipio} (${created.provincia}) · ${created.auth.email} · ${status}`)
        await sleep(120)
    }

    const circProv = await seedProvincialCirculars(supabase, provincials)
    log('direcoes', `Circulares provinciais: ${circProv}`)

    const circMun = await seedMunicipalCirculars(supabase, municipals)
    log('direcoes', `Circulares municipais: ${circMun}`)

    const leituras = await seedLeituras(supabase, provincials, municipals, escolasByCodigo)
    log('direcoes', `Leituras de circulares: ${leituras}`)

    const hist = await seedHistorico(supabase, provincials, municipals, escolasByCodigo)
    log('direcoes', `Histórico administrativo: ${hist}`)

    const sols = await seedSolicitacoes(supabase, municipals, escolasByCodigo)
    log('direcoes', `Solicitações de documentos: ${sols}`)

    return {
        provincials: provincials.map((p) => ({
            nome: p.nome,
            provincia: p.provincia,
            email: p.auth.email,
            ativo: p.ativo,
            note: p.plan.note || null,
        })),
        municipals: municipals.map((m) => ({
            nome: m.nome,
            municipio: m.municipio,
            provincia: m.provincia,
            email: m.auth.email,
            ativo: m.ativo,
            bloqueado: m.bloqueado,
            note: m.plan.note || null,
            linkedSchool: m.plan.linkedSchoolCodigo || null,
        })),
        counts: {
            provincials: provincials.length,
            municipals: municipals.length,
            circularesProvinciais: circProv,
            circularesMunicipais: circMun,
            leituras,
            historico: hist,
            solicitacoes: sols,
        },
    }
}

export default seedDirecoes
