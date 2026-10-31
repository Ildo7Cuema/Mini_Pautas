/*
component-meta:
  name: TuitionPaymentsPage
  description: Page for managing student tuition payments with receipts
  tokens: [--color-primary, --fs-md, min-h-touch]
  responsive: true
  tested-on: [360x800, 768x1024, 1440x900]
*/

import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { HeaderConfig, loadHeaderConfig, getOrgaoEducacao } from '../utils/headerConfigUtils'
import { applyStandardPdfFooters } from '../utils/pdfFooter'
import {
    fetchPropinasConfig,
    savePropinasConfig,
    fetchPagamentosPropinas,
    fetchEstatisticasPropinas,
    fetchAlunosComStatusPagamento,
    registarPagamento,
    anularPagamento,
    getNomeMes,
    getNomeMesCurto,
    formatarValor,
    getMetodoPagamentoLabel
} from '../utils/tuitionPayments'
import { generateReceiptPDF } from '../utils/receiptGenerator'
import type {
    PropinasConfig,
    PagamentoPropina,
    EstatisticasPropinas,
    Aluno,
    PagamentoMesStatus,
    MesReferencia,
    MetodoPagamentoPropina
} from '../types'

interface TuitionPaymentsPageProps {
    searchQuery?: string
}

// Minimal type for turma dropdown - only fields needed for display
interface TurmaBasic {
    id: string
    nome: string
    codigo_turma: string
    ano_lectivo: string
}

export const TuitionPaymentsPage: React.FC<TuitionPaymentsPageProps> = ({ searchQuery = '' }) => {
    const { escolaProfile, secretarioProfile } = useAuth()
    const escolaId = escolaProfile?.id || secretarioProfile?.escola_id || ''

    // Determine default academic year
    // If current month is before August (0-6), it's likely the second semester of the previous year's start
    // E.g., Jan 2026 is part of 2025/2026 academic year, so we default to 2025
    const today = new Date()
    const defaultYear = today.getMonth() < 7 ? today.getFullYear() - 1 : today.getFullYear()

    // State
    const [currentYear, setCurrentYear] = useState(defaultYear)
    const currentMonth = today.getMonth() + 1

    const [loading, setLoading] = useState(true)
    const [loadingStudents, setLoadingStudents] = useState(false)
    const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'payments' | 'config'>('overview')
    const [turmas, setTurmas] = useState<TurmaBasic[]>([])
    const [selectedTurma, setSelectedTurma] = useState<string>('')
    const [config, setConfig] = useState<PropinasConfig | null>(null)
    const [stats, setStats] = useState<EstatisticasPropinas>({
        total_alunos: 0,
        total_previsto: 0,
        total_recebido: 0,
        total_em_falta: 0,
        percentagem_recebido: 0
    })
    const [alunos, setAlunos] = useState<Array<Aluno & { pagamentos: PagamentoMesStatus[] }>>([])
    const [pagamentos, setPagamentos] = useState<PagamentoPropina[]>([])

    // Modal state
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [showReceiptModal, setShowReceiptModal] = useState(false)
    const [showConfigModal, setShowConfigModal] = useState(false)
    const [selectedAluno, setSelectedAluno] = useState<Aluno | null>(null)
    const [selectedMes, setSelectedMes] = useState<number>(currentMonth)
    const [selectedPagamento, setSelectedPagamento] = useState<PagamentoPropina | null>(null)

    // PDF Export state
    const [showExportModal, setShowExportModal] = useState(false)
    const [headerConfig, setHeaderConfig] = useState<HeaderConfig | null>(null)
    const [exportLoading, setExportLoading] = useState(false)
    const [exportMes, setExportMes] = useState<number>(currentMonth - 1 > 0 ? currentMonth - 1 : 12)
    const [exportTurma, setExportTurma] = useState<string>('')

    // Annulment Modal State
    const [showAnnulModal, setShowAnnulModal] = useState(false)
    const [paymentToAnnul, setPaymentToAnnul] = useState<PagamentoPropina | null>(null)
    const [annulReason, setAnnulReason] = useState('')
    const [confirmationCheck, setConfirmationCheck] = useState(false)
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' })

    const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, message, type })
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000)
    }

    // Form state
    const [paymentForm, setPaymentForm] = useState({
        valor: 0,
        metodo_pagamento: 'numerario' as MetodoPagamentoPropina,
        observacao: ''
    })
    const [configForm, setConfigForm] = useState({
        valor_mensalidade: 0,
        descricao: ''
    })
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    // Load data
    useEffect(() => {
        if (escolaId) {
            loadData()
        }
    }, [escolaId, currentYear])

    // Reload students when turma filter changes (including empty = all turmas)
    useEffect(() => {
        if (escolaId) {
            loadStudents()
        }
    }, [selectedTurma, currentYear])

    // Load header configuration for PDF export
    useEffect(() => {
        const loadHeaderConfiguration = async () => {
            if (escolaId) {
                const config = await loadHeaderConfig(escolaId)
                setHeaderConfig(config)
            }
        }
        loadHeaderConfiguration()
    }, [escolaId])

    // Helper function to add header to PDF
    const addPDFHeader = async (
        doc: jsPDF,
        logoBase64: string | null
    ): Promise<number> => {
        const pageWidth = doc.internal.pageSize.getWidth()
        const centerX = pageWidth / 2
        let startY = 15

        if (headerConfig) {
            // Logo (if configured and loaded) - reduced size for better proportion
            if (logoBase64) {
                const logoWidth = Math.min(headerConfig.logo_width || 12, 15)
                const logoHeight = Math.min(headerConfig.logo_height || 12, 15)
                const logoX = centerX - (logoWidth / 2)
                doc.addImage(logoBase64, 'PNG', logoX, 8, logoWidth, logoHeight)
                startY = 8 + logoHeight + 3
            }

            // República de Angola
            if (headerConfig.mostrar_republica && headerConfig.texto_republica) {
                doc.setFontSize(10)
                doc.setFont('helvetica', 'bold')
                doc.text(headerConfig.texto_republica.toUpperCase(), centerX, startY, { align: 'center' })
                startY += 5
            }

            // Governo Provincial
            if (headerConfig.mostrar_governo_provincial && headerConfig.provincia) {
                doc.setFontSize(9)
                doc.setFont('helvetica', 'normal')
                doc.text(`Governo Provincial da ${headerConfig.provincia}`, centerX, startY, { align: 'center' })
                startY += 5
            }

            // Órgão de Educação
            if (headerConfig.mostrar_orgao_educacao && headerConfig.nivel_ensino) {
                const orgaoTexto = getOrgaoEducacao(
                    headerConfig.nivel_ensino,
                    headerConfig.provincia,
                    headerConfig.municipio
                )
                doc.setFontSize(9)
                doc.text(orgaoTexto, centerX, startY, { align: 'center' })
                startY += 5
            }

            // Nome da Escola
            if (headerConfig.nome_escola) {
                doc.setFontSize(12)
                doc.setFont('helvetica', 'bold')
                doc.text(headerConfig.nome_escola, centerX, startY, { align: 'center' })
                startY += 8
            }

            // Separator line
            doc.setLineWidth(0.3)
            doc.line(14, startY, pageWidth - 14, startY)
            startY += 8
        } else {
            // If no header config, use escola profile name
            if (escolaProfile?.nome) {
                doc.setFontSize(14)
                doc.setFont('helvetica', 'bold')
                doc.text(escolaProfile.nome.toUpperCase(), centerX, startY, { align: 'center' })
                startY += 10
            }
        }

        return startY
    }

    // PDF Export function
    const handleExportPaidStudentsList = async () => {
        setExportLoading(true)
        setError(null)

        try {
            // Fetch payments for the selected month
            const pagamentosDoMes = await fetchPagamentosPropinas(escolaId, {
                mesReferencia: exportMes as MesReferencia,
                anoReferencia: currentYear,
                turmaId: exportTurma || undefined
            })

            if (pagamentosDoMes.length === 0) {
                setError(`Não há pagamentos registados para ${getNomeMes(exportMes)} ${currentYear}`)
                setExportLoading(false)
                return
            }

            // Group students by turma
            const studentsByTurma: Record<string, typeof pagamentosDoMes> = {}
            pagamentosDoMes.forEach(pag => {
                const turmaId = (pag.aluno as any)?.turma_id || 'sem-turma'
                if (!studentsByTurma[turmaId]) {
                    studentsByTurma[turmaId] = []
                }
                studentsByTurma[turmaId].push(pag)
            })

            const doc = new jsPDF()

            // Pre-load logo if configured
            let logoBase64: string | null = null
            if (headerConfig?.logo_url) {
                try {
                    const response = await fetch(headerConfig.logo_url)
                    const blob = await response.blob()
                    logoBase64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader()
                        reader.onloadend = () => resolve(reader.result as string)
                        reader.readAsDataURL(blob)
                    })
                } catch (logoError) {
                    console.error('Error loading logo:', logoError)
                }
            }

            let isFirstPage = true

            // Generate pages for each turma
            const turmaIds = exportTurma ? [exportTurma] : Object.keys(studentsByTurma)

            for (const turmaId of turmaIds) {
                const turmaPagamentos = studentsByTurma[turmaId]
                if (!turmaPagamentos || turmaPagamentos.length === 0) continue

                const turmaInfo = turmas.find(t => t.id === turmaId)
                const turmaNome = turmaInfo?.nome || 'Sem Turma'

                // Add new page if not first
                if (!isFirstPage) {
                    doc.addPage()
                }
                isFirstPage = false

                // Add header
                let startY = await addPDFHeader(doc, logoBase64)
                const pageWidth = doc.internal.pageSize.getWidth()

                // Document title
                doc.setFontSize(14)
                doc.setFont('helvetica', 'bold')
                doc.text('LISTA DE ALUNOS COM PROPINAS LIQUIDADAS', pageWidth / 2, startY, { align: 'center' })
                startY += 8

                // Turma and month info
                doc.setFontSize(10)
                doc.setFont('helvetica', 'normal')
                doc.text(`Turma: ${turmaNome}`, 14, startY)
                startY += 5
                doc.text(`Mês de Referência: ${getNomeMes(exportMes)} ${currentYear}`, 14, startY)
                startY += 5
                doc.text(`Total de Alunos: ${turmaPagamentos.length}`, 14, startY)
                startY += 8

                // Sort students alphabetically
                const sortedPagamentos = [...turmaPagamentos].sort((a, b) => {
                    const nomeA = a.aluno?.nome_completo || ''
                    const nomeB = b.aluno?.nome_completo || ''
                    return nomeA.localeCompare(nomeB, 'pt')
                })

                // Calculate total
                const totalValor = sortedPagamentos.reduce((sum, p) => sum + p.valor, 0)

                // Table data
                const tableData = sortedPagamentos.map((pag, index) => [
                    index + 1,
                    pag.aluno?.nome_completo || '-',
                    new Date(pag.data_pagamento).toLocaleDateString('pt-AO'),
                    formatarValor(pag.valor)
                ])

                autoTable(doc, {
                    startY: startY,
                    head: [['Nº', 'Nome do Aluno', 'Data Pagamento', 'Valor']],
                    body: tableData,
                    foot: [['', '', 'Total:', formatarValor(totalValor)]],
                    theme: 'plain',
                    headStyles: {
                        fillColor: [255, 255, 255],
                        textColor: [0, 0, 0],
                        fontSize: 10,
                        fontStyle: 'bold',
                        lineWidth: 0.1,
                        lineColor: [150, 150, 150]
                    },
                    footStyles: {
                        fillColor: [245, 245, 245],
                        textColor: [0, 0, 0],
                        fontSize: 10,
                        fontStyle: 'bold',
                        lineWidth: 0.1,
                        lineColor: [150, 150, 150]
                    },
                    styles: {
                        fontSize: 9,
                        cellPadding: 2,
                        lineWidth: 0.1,
                        lineColor: [200, 200, 200]
                    },
                    columnStyles: {
                        0: { cellWidth: 15, halign: 'center' },
                        1: { cellWidth: 'auto', halign: 'left' },
                        2: { cellWidth: 35, halign: 'left' },
                        3: { cellWidth: 35, halign: 'left' }
                    },
                    tableLineWidth: 0.1,
                    tableLineColor: [200, 200, 200]
                })

                // Get final Y position after table
                const finalY = (doc as any).lastAutoTable.finalY || 200

                // Signature section
                const pageHeight = doc.internal.pageSize.getHeight()
                if (finalY + 45 < pageHeight) {
                    const signatureY = finalY + 30
                    doc.setFontSize(10)
                    doc.setLineWidth(0.3)

                    // Left signature
                    doc.line(20, signatureY, 90, signatureY)
                    doc.text('Assinatura do Director', 55, signatureY + 5, { align: 'center' })

                    // Right signature
                    doc.line(120, signatureY, 190, signatureY)
                    doc.text('Assinatura do Tesoureiro', 155, signatureY + 5, { align: 'center' })
                }
            }

            applyStandardPdfFooters(doc)

            // Generate filename
            const date = new Date().toISOString().split('T')[0]
            const turmaNomeFile = exportTurma
                ? turmas.find(t => t.id === exportTurma)?.nome.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'turma'
                : 'todas-turmas'
            doc.save(`propinas-pagas-${getNomeMesCurto(exportMes).toLowerCase()}-${currentYear}-${turmaNomeFile}_${date}.pdf`)

            setSuccess('Lista exportada com sucesso!')
            setShowExportModal(false)
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            console.error('Error exporting PDF:', err)
            setError('Erro ao exportar a lista em PDF')
        } finally {
            setExportLoading(false)
        }
    }

    const loadData = async () => {
        setLoading(true)
        try {
            console.log('Loading Data for Year:', currentYear)

            // Load turmas
            console.log('Fetching turmas...')
            const { data: turmasData, error: turmasError } = await supabase
                .from('turmas')
                .select('id, nome, codigo_turma, ano_lectivo')
                .eq('escola_id', escolaId)
                .ilike('ano_lectivo', `%${currentYear}%`)
                .order('nome')

            if (turmasError) {
                console.error('Error fetching turmas:', turmasError)
                throw turmasError
            }
            console.log('Turmas fetched:', turmasData?.length)

            setTurmas(turmasData || [])

            // Load config
            console.log('Fetching config...')
            const configs = await fetchPropinasConfig(escolaId, currentYear)
            console.log('Config fetched:', configs.length)

            if (configs.length > 0) {
                setConfig(configs[0])
                setConfigForm({
                    valor_mensalidade: configs[0].valor_mensalidade,
                    descricao: configs[0].descricao || ''
                })
                setPaymentForm(prev => ({ ...prev, valor: configs[0].valor_mensalidade }))
            }

            // Load statistics
            console.log('Fetching stats...')
            const statsData = await fetchEstatisticasPropinas(escolaId, currentYear)
            console.log('Stats fetched')
            setStats(statsData)

            // Load recent payments
            console.log('Fetching payments...')
            const pagamentosData = await fetchPagamentosPropinas(escolaId, {
                anoReferencia: currentYear
            })
            console.log('Payments fetched:', pagamentosData.length)
            setPagamentos(pagamentosData.slice(0, 20))

            // Load students
            console.log('Fetching students...')
            const alunosData = await fetchAlunosComStatusPagamento(escolaId, undefined, currentYear)
            console.log('Students fetched:', alunosData.length)
            setAlunos(alunosData)

        } catch (err) {
            console.error('Error loading data:', err)
            setError('Erro ao carregar dados')
        } finally {
            setLoading(false)
        }
    }

    const loadStudents = async () => {
        setLoadingStudents(true)
        setError(null)
        try {
            const alunosData = await fetchAlunosComStatusPagamento(
                escolaId,
                selectedTurma || undefined,
                currentYear
            )
            setAlunos(alunosData)

            // Show feedback if no students found for the selected turma
            if (selectedTurma && alunosData.length === 0) {
                setError('Nenhum aluno encontrado nesta turma para o ano lectivo actual')
            }
        } catch (err) {
            console.error('Error loading students:', err)
            setError('Erro ao carregar a lista de alunos. Por favor, tente novamente.')
        } finally {
            setLoadingStudents(false)
        }
    }

    const handleSaveConfig = async () => {
        if (!configForm.valor_mensalidade || configForm.valor_mensalidade <= 0) {
            setError('Insira um valor de mensalidade válido')
            return
        }

        setSubmitting(true)
        setError(null)
        try {
            await savePropinasConfig({
                escola_id: escolaId,
                ano_lectivo: currentYear,
                valor_mensalidade: configForm.valor_mensalidade,
                descricao: configForm.descricao
            })
            setSuccess('Configuração guardada com sucesso!')
            setShowConfigModal(false)
            loadData()
        } catch (err: any) {
            setError(err.message || 'Erro ao guardar configuração')
        } finally {
            setSubmitting(false)
        }
    }

    const handleOpenPaymentModal = (aluno: Aluno, mes: number) => {
        setSelectedAluno(aluno)
        setSelectedMes(mes)
        setPaymentForm({
            valor: config?.valor_mensalidade || 0,
            metodo_pagamento: 'numerario',
            observacao: ''
        })
        setShowPaymentModal(true)
    }

    const handleSubmitPayment = async () => {
        if (!selectedAluno || !paymentForm.valor) {
            setError('Dados incompletos')
            return
        }

        setSubmitting(true)
        setError(null)
        try {
            const pagamento = await registarPagamento({
                aluno_id: selectedAluno.id,
                escola_id: escolaId,
                mes_referencia: selectedMes as MesReferencia,
                ano_referencia: currentYear,
                valor: paymentForm.valor,
                metodo_pagamento: paymentForm.metodo_pagamento,
                observacao: paymentForm.observacao
            })

            setSuccess('Pagamento registado com sucesso!')
            setShowPaymentModal(false)
            setSelectedPagamento(pagamento)
            setShowReceiptModal(true)
            loadData()
        } catch (err: any) {
            setError(err.message || 'Erro ao registar pagamento')
        } finally {
            setSubmitting(false)
        }
    }

    const handleViewReceipt = (pagamento: PagamentoPropina) => {
        setSelectedPagamento(pagamento)
        setShowReceiptModal(true)
    }

    const handlePrintReceipt = async () => {
        if (selectedPagamento) {
            await generateReceiptPDF(selectedPagamento, headerConfig, escolaProfile || undefined)
        }
    }

    const handleAnularPagamento = (pagamento: PagamentoPropina) => {
        setPaymentToAnnul(pagamento)
        setAnnulReason('')
        setConfirmationCheck(false)
        setShowAnnulModal(true)
    }

    const confirmAnnulment = async () => {
        if (!paymentToAnnul) return

        if (!annulReason || annulReason.trim().length < 5) {
            showNotification('A anulação não foi processada porque o motivo é inválido ou muito curto.', 'error')
            return
        }

        // Checkbox validation
        if (!confirmationCheck) {
            showNotification('Por favor, confirme que entende que a ação é irreversível.', 'error')
            return
        }

        try {
            await anularPagamento(paymentToAnnul.id, annulReason)
            showNotification('Recibo anulado com sucesso.', 'success')
            setShowAnnulModal(false)
            setPaymentToAnnul(null)
            loadData() // Reload to update UI
        } catch (err: any) {
            console.error('Error canceling payment:', err)
            showNotification(`Erro ao anular: ${err.message}`, 'error')
        }
    }

    const handleExportSaft = async () => {
        setExportLoading(true)
        try {
            // 1. Fetch Data Client-Side (Fallback since Edge Function deployment is blocked)

            // A. Fetch School Profile
            let escola = { nome: 'Escola Exemplo', nif: '999999999', cidade: 'Luanda' }
            if (escolaId) {
                const { data: esc } = await supabase.from('escolas_profile').select('*').eq('id', escolaId).single()
                if (esc) escola = { nome: esc.nome, nif: esc.nif || '999999999', cidade: esc.municipio || 'Luanda' }
            }

            // B. Fetch Payments
            const { data: payments, error } = await supabase
                .from('pagamentos_propinas')
                .select(`*, aluno:alunos(id, nome_completo, numero_processo)`)
                .eq('mes_referencia', exportMes)
                .eq('ano_referencia', currentYear)
                .order('created_at', { ascending: true })

            if (error) throw error
            if (!payments || payments.length === 0) throw new Error('Não existem pagamentos para exportar neste período.')

            // 2. Build XML (SAF-T AO Structure) - Ported from Edge Function
            const uniqueCustomers = Array.from(new Set(payments.map((p: any) => JSON.stringify(p.aluno))))

            const auditFile = [
                `<?xml version="1.0" encoding="UTF-8"?>`,
                `<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:AO_1.01_01" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:OECD:StandardAuditFile-Tax:AO_1.01_01 SAF-T_AO.xsd">`,
                `  <Header>`,
                `    <AuditFileVersion>1.01_01</AuditFileVersion>`,
                `    <CompanyID>${escola.nif}</CompanyID>`,
                `    <TaxRegistrationNumber>${escola.nif}</TaxRegistrationNumber>`,
                `    <TaxAccountingBasis>F</TaxAccountingBasis>`,
                `    <CompanyName>${escola.nome}</CompanyName>`,
                `    <BusinessName>${escola.nome}</BusinessName>`,
                `    <CompanyAddress>`,
                `      <AddressDetail>${escola.cidade}</AddressDetail>`,
                `      <City>${escola.cidade}</City>`,
                `      <Country>AO</Country>`,
                `    </CompanyAddress>`,
                `    <FiscalYear>${currentYear}</FiscalYear>`,
                `    <StartDate>${currentYear}-01-01</StartDate>`,
                `    <EndDate>${currentYear}-12-31</EndDate>`,
                `    <CurrencyCode>AOA</CurrencyCode>`,
                `    <DateCreated>${new Date().toISOString().split('T')[0]}</DateCreated>`,
                `    <TaxEntity>Global</TaxEntity>`,
                `    <ProductCompanyTaxID>${escola.nif}</ProductCompanyTaxID>`,
                `    <SoftwareValidationNumber>000/AGT/2024</SoftwareValidationNumber>`,
                `    <ProductID>EduGest/AO</ProductID>`,
                `    <ProductVersion>1.0.0</ProductVersion>`,
                `  </Header>`,
                `  <MasterFiles>`,
                `    <Customer>`,
                ...uniqueCustomers.map((aStr: string) => {
                    const a = JSON.parse(aStr);
                    return [
                        `      <CustomerID>${a.id}</CustomerID>`,
                        `      <AccountID>Desconhecido</AccountID>`,
                        `      <CustomerTaxID>999999999</CustomerTaxID>`,
                        `      <CompanyName>${a.nome_completo}</CompanyName>`,
                        `      <BillingAddress>`,
                        `        <AddressDetail>Luanda</AddressDetail>`,
                        `        <City>Luanda</City>`,
                        `        <Country>AO</Country>`,
                        `      </BillingAddress>`,
                        `      <SelfBillingIndicator>0</SelfBillingIndicator>`,
                    ].join('\n    ')
                }),
                `    </Customer>`,
                `    <Product>`,
                `      <ProductType>S</ProductType>`,
                `      <ProductCode>PROP</ProductCode>`,
                `      <ProductGroup>Servicos</ProductGroup>`,
                `      <Description>Propina Mensal</Description>`,
                `      <ProductNumberCode>PROP</ProductNumberCode>`,
                `    </Product>`,
                `    <TaxTable>`,
                `      <TaxTableEntry>`,
                `        <TaxType>IVA</TaxType>`,
                `        <TaxCountryRegion>AO</TaxCountryRegion>`,
                `        <TaxCode>ISE</TaxCode>`,
                `        <Description>Isento</Description>`,
                `        <TaxPercentage>0.00</TaxPercentage>`,
                `      </TaxTableEntry>`,
                `    </TaxTable>`,
                `  </MasterFiles>`,
                `  <SourceDocuments>`,
                `    <SalesInvoices>`,
                `      <NumberOfEntries>${payments.length}</NumberOfEntries>`,
                `      <TotalDebit>0.00</TotalDebit>`,
                `      <TotalCredit>${payments.reduce((acc: number, p: any) => acc + (p.estado === 'valido' ? p.valor : 0), 0).toFixed(2)}</TotalCredit>`,
                ...payments.map((p: any) => {
                    const status = p.estado === 'anulado' ? 'A' : 'N';
                    const hash = p.hash || '0';
                    const hashControl = p.hash_control || '0';
                    return [
                        `      <Invoice>`,
                        `        <InvoiceNo>${p.numero_recibo}</InvoiceNo>`,
                        `        <DocumentStatus>`,
                        `          <InvoiceStatus>${status}</InvoiceStatus>`,
                        `          <InvoiceStatusDate>${new Date(p.created_at).toISOString()}</InvoiceStatusDate>`,
                        `          <SourceID>Admin</SourceID>`,
                        `          <SourceBilling>P</SourceBilling>`,
                        `        </DocumentStatus>`,
                        `        <Hash>${hash}</Hash>`,
                        `        <HashControl>${hashControl}</HashControl>`,
                        `        <Period>${exportMes}</Period>`,
                        `        <InvoiceDate>${new Date(p.data_pagamento).toISOString().split('T')[0]}</InvoiceDate>`,
                        `        <InvoiceType>FT</InvoiceType>`,
                        `        <SpecialRegimes>`,
                        `          <SelfBillingIndicator>0</SelfBillingIndicator>`,
                        `          <CashVATSchemeIndicator>0</CashVATSchemeIndicator>`,
                        `          <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>`,
                        `        </SpecialRegimes>`,
                        `        <SourceID>Admin</SourceID>`,
                        `        <SystemEntryDate>${new Date(p.created_at).toISOString()}</SystemEntryDate>`,
                        `        <CustomerID>${p.aluno.id}</CustomerID>`,
                        `        <Line>`,
                        `          <LineNumber>1</LineNumber>`,
                        `          <ProductCode>PROP</ProductCode>`,
                        `          <ProductDescription>Propina ${p.mes_referencia}/${p.ano_referencia}</ProductDescription>`,
                        `          <Quantity>1</Quantity>`,
                        `          <UnitOfMeasure>Unid</UnitOfMeasure>`,
                        `          <UnitPrice>${p.valor.toFixed(2)}</UnitPrice>`,
                        `          <TaxPointDate>${new Date(p.data_pagamento).toISOString().split('T')[0]}</TaxPointDate>`,
                        `          <Description>Propina</Description>`,
                        `          <CreditAmount>${p.valor.toFixed(2)}</CreditAmount>`,
                        `          <Tax>`,
                        `            <TaxType>IVA</TaxType>`,
                        `            <TaxCountryRegion>AO</TaxCountryRegion>`,
                        `            <TaxCode>ISE</TaxCode>`,
                        `            <TaxPercentage>0.00</TaxPercentage>`,
                        `          </Tax>`,
                        `          <SettlementAmount>0.00</SettlementAmount>`,
                        `        </Line>`,
                        `        <DocumentTotals>`,
                        `          <TaxPayable>0.00</TaxPayable>`,
                        `          <NetTotal>${p.valor.toFixed(2)}</NetTotal>`,
                        `          <GrossTotal>${p.valor.toFixed(2)}</GrossTotal>`,
                        `        </DocumentTotals>`,
                        `      </Invoice>`
                    ].join('\n')
                }),
                `    </SalesInvoices>`,
                `  </SourceDocuments>`,
                `</AuditFile>`
            ].join('\n');

            // 3. Download
            const blob = new Blob([auditFile], { type: 'application/xml' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `SAFT_AO_${exportMes}_${currentYear}.xml`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

            showNotification('SAF-T (AO) exportado com sucesso.', 'success')
            setShowExportModal(false)
        } catch (err: any) {
            console.error('Error exporting SAF-T:', err)
            showNotification(`Erro ao exportar SAF-T: ${err.message}`, 'error')
        } finally {
            setExportLoading(false)
        }
    }

    const handlePrintExport = async () => {
        setExportLoading(true)
        try {
            const doc = new jsPDF()

            // Header
            doc.setFontSize(18)
            doc.text('Relatório de Pagamento de Propinas', 14, 20)

            doc.setFontSize(12)
            doc.text(`Mês Referência: ${getNomeMes(exportMes)}`, 14, 30)
            doc.text(`Ano: ${currentYear}`, 14, 36)

            if (escolaProfile) {
                doc.setFontSize(10)
                doc.text(escolaProfile.nome, 200, 20, { align: 'right' })
            }

            // Prepare Table Data
            let exportAlunos = alunos
            if (exportTurma) {
                exportAlunos = alunos.filter(a => a.turma_id === exportTurma)
            }

            const tableData = exportAlunos.map(student => {
                const paymentsForMonth = pagamentos.filter(p =>
                    p.aluno_id === student.id &&
                    p.mes_referencia === exportMes &&
                    p.ano_referencia === currentYear &&
                    p.estado === 'valido'
                )

                const totalPaid = paymentsForMonth.reduce((sum, p) => sum + p.valor, 0)

                return [
                    student.numero_processo,
                    student.nome_completo,
                    paymentsForMonth.length > 0 ? `${formatarValor(totalPaid)}` : '0,00 Kz',
                    paymentsForMonth.length > 0 ? (totalPaid >= (paymentForm.valor_mensalidade || 0) ? 'Pago' : 'Parcial') : 'Pendente'
                ]
            })

            autoTable(doc, {
                startY: 45,
                head: [['Nº Proc', 'Nome Completo', 'Valor Pago', 'Estado']],
                body: tableData,
                styles: { fontSize: 9 },
                headStyles: { fillColor: [41, 128, 185] }
            })

            doc.save(`Relatorio_Propinas_${getNomeMes(exportMes)}_${currentYear}.pdf`)
            showNotification('Lista exportada com sucesso.', 'success')
            setShowExportModal(false)
        } catch (error: any) {
            console.error('Error printing export:', error)
            showNotification('Erro ao exportar lista PDF.', 'error')
        } finally {
            setExportLoading(false)
        }
    }

    // Filter alunos by search
    const filteredAlunos = alunos.filter(aluno =>
        aluno.nome_completo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        aluno.numero_processo.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (loading) {
        return (
            <div className="space-y-6 animate-fade-in pb-24 md:pb-0">
                {/* Header Skeleton */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div className="skeleton h-8 w-48 mb-2 rounded-lg"></div>
                        <div className="skeleton h-4 w-64 rounded"></div>
                    </div>
                    <div className="flex gap-3">
                        <div className="skeleton h-10 w-32 rounded-xl"></div>
                        <div className="skeleton h-10 w-28 rounded-xl"></div>
                    </div>
                </div>
                {/* Stats Skeleton */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={`stat-skel-${i}`} className="bg-white rounded-xl p-4 border border-slate-200/60">
                            <div className="skeleton w-10 h-10 rounded-xl mb-2"></div>
                            <div className="skeleton h-7 w-20 mb-1 rounded"></div>
                            <div className="skeleton h-4 w-16 rounded"></div>
                        </div>
                    ))}
                </div>
                {/* Table Skeleton */}
                <div className="bg-white rounded-2xl border border-slate-200/60 p-5">
                    <div className="flex gap-2 mb-4">
                        <div className="skeleton h-10 w-24 rounded-xl"></div>
                        <div className="skeleton h-10 w-24 rounded-xl"></div>
                        <div className="skeleton h-10 w-24 rounded-xl"></div>
                    </div>
                    <div className="skeleton h-10 w-64 mb-5 rounded-xl"></div>
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={`row-skel-${i}`} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                                <div className="skeleton w-10 h-10 rounded-xl"></div>
                                <div className="flex-1">
                                    <div className="skeleton h-4 w-40 mb-2 rounded"></div>
                                    <div className="skeleton h-3 w-24 rounded"></div>
                                </div>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5, 6].map((j) => (
                                        <div key={`cell-skel-${j}`} className="skeleton w-8 h-8 rounded-lg"></div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-24 md:pb-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Gestão de Propinas</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-slate-500">Controlo de pagamentos - Ano Lectivo:</p>
                        <select
                            value={currentYear}
                            onChange={(e) => {
                                setCurrentYear(Number(e.target.value))
                                // Trigger data reload is handled by useEffect on escolaId/currentYear dependencies
                                // But we verify dependency array below
                            }}
                            className="bg-slate-100 border-none rounded-lg text-slate-700 font-bold py-0.5 px-2 text-sm focus:ring-2 focus:ring-primary-500 cursor-pointer"
                        >
                            <option value={today.getFullYear() - 1}>{today.getFullYear() - 1}</option>
                            <option value={today.getFullYear()}>{today.getFullYear()}</option>
                            <option value={today.getFullYear() + 1}>{today.getFullYear() + 1}</option>
                        </select>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowExportModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Imprimir Lista
                    </button>
                    {/* Hide Configurar button for secretário - they cannot configure tuition values */}
                    {!secretarioProfile && (
                        <button
                            onClick={() => setShowConfigModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Configurar
                        </button>
                    )}
                </div>
            </div>

            {/* Success/Error Messages */}
            {success && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-3">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{success}</span>
                    <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-600 hover:text-emerald-800">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Statistics Cards - Mobile Native */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 stagger-children">
                {/* Total Alunos */}
                <div className="tuition-stat-card">
                    <div className="stat-icon from-blue-500 to-indigo-600 mb-2">
                        <svg className="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <p className="stat-value text-slate-900">{stats.total_alunos}</p>
                    <p className="stat-label">Alunos</p>
                </div>

                {/* Recebido */}
                <div className="tuition-stat-card">
                    <div className="stat-icon from-emerald-500 to-green-600 mb-2">
                        <svg className="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <p className="stat-value text-emerald-600">{formatarValor(stats.total_recebido)}</p>
                    <p className="stat-label">Recebido</p>
                </div>

                {/* Em Falta */}
                <div className="tuition-stat-card">
                    <div className="stat-icon from-amber-500 to-orange-600 mb-2">
                        <svg className="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p className="stat-value text-amber-600">{formatarValor(stats.total_em_falta)}</p>
                    <p className="stat-label">Pendente</p>
                </div>

                {/* Taxa de Cobrança */}
                <div className="tuition-stat-card">
                    <div className="stat-icon from-primary-500 to-indigo-600 mb-2">
                        <svg className="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <p className="stat-value text-primary-600">{stats.percentagem_recebido.toFixed(1)}%</p>
                    <p className="stat-label">Cobrança</p>
                    {/* Mini progress bar */}
                    <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary-500 to-indigo-500 rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(stats.percentagem_recebido, 100)}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            {stats.total_previsto > 0 && (
                <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-medium text-slate-600">Progresso de Cobrança</span>
                        <span className="text-sm font-bold text-slate-900">
                            {formatarValor(stats.total_recebido)} de {formatarValor(stats.total_previsto)}
                        </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary-500 to-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(stats.percentagem_recebido, 100)}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                {/* Modern Pill Tabs */}
                <div className="p-4 pb-0">
                    <div className="tuition-tabs">
                        {[
                            {
                                id: 'overview', label: 'Visão Geral', icon: (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                )
                            },
                            {
                                id: 'students', label: 'Por Aluno', icon: (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                )
                            },
                            {
                                id: 'payments', label: 'Pagamentos', icon: (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                )
                            }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`tuition-tab ${activeTab === tab.id ? 'tuition-tab-active' : ''}`}
                            >
                                {tab.icon}
                                <span className="hidden sm:inline">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-5">
                    {/* Filter by Turma */}
                    <div className="mb-5 flex flex-wrap items-center gap-3">
                        <select
                            value={selectedTurma}
                            onChange={(e) => setSelectedTurma(e.target.value)}
                            disabled={loadingStudents}
                            className="w-full md:w-64 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 disabled:opacity-60"
                        >
                            <option value="">Todas as turmas</option>
                            {turmas.map(turma => (
                                <option key={turma.id} value={turma.id}>{turma.nome}</option>
                            ))}
                        </select>

                        {/* Loading indicator */}
                        {loadingStudents && (
                            <div className="flex items-center gap-2 text-sm text-primary-600">
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>A carregar alunos...</span>
                            </div>
                        )}

                        {/* Student count badge */}
                        {!loadingStudents && (
                            <span className="px-3 py-1 bg-slate-100 text-slate-600 text-sm rounded-full">
                                {filteredAlunos.length} aluno{filteredAlunos.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    {/* Overview Tab - Month Matrix */}
                    {activeTab === 'overview' && (
                        <>
                            {/* Mobile: Card View */}
                            <div className="md:hidden space-y-3">
                                {filteredAlunos.slice(0, 10).map(aluno => {
                                    const pendentes = aluno.pagamentos.filter(p => p.status !== 'pago' && p.mes <= currentMonth).length

                                    return (
                                        <div key={aluno.id} className="tuition-student-card">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-indigo-500 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm">
                                                        {aluno.nome_completo.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-900">{aluno.nome_completo}</p>
                                                        <p className="text-xs text-slate-500">{aluno.numero_processo}</p>
                                                    </div>
                                                </div>
                                                <span className={`payment-status ${pendentes === 0 ? 'payment-status-paid' : pendentes <= 2 ? 'payment-status-pending' : 'payment-status-overdue'}`}>
                                                    {pendentes === 0 ? '✓ Em dia' : `${pendentes} pend.`}
                                                </span>
                                            </div>
                                            {/* Month Pills Grid */}
                                            <div className="grid grid-cols-6 gap-1.5">
                                                {aluno.pagamentos.map(pag => (
                                                    <button
                                                        key={`mob-pill-${aluno.id}-${pag.mes}`}
                                                        onClick={() => pag.status !== 'pago' && pag.mes <= currentMonth && handleOpenPaymentModal(aluno, pag.mes)}
                                                        disabled={pag.status === 'pago' || pag.mes > currentMonth}
                                                        className={`month-pill ${pag.status === 'pago' ? 'month-pill-paid' : pag.status === 'parcial' ? 'bg-amber-100 text-amber-700 border-amber-200' : pag.mes <= currentMonth ? 'month-pill-pending' : 'month-pill-future'}`}
                                                    >
                                                        {getNomeMesCurto(pag.mes).substring(0, 3)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                                {filteredAlunos.length > 10 && (
                                    <button
                                        onClick={() => setActiveTab('students')}
                                        className="w-full py-3 text-sm font-medium text-primary-600 bg-primary-50 rounded-xl hover:bg-primary-100 transition-colors"
                                    >
                                        Ver todos os {filteredAlunos.length} alunos →
                                    </button>
                                )}
                            </div>

                            {/* Desktop: Table View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="table-excel">
                                    <thead>
                                        <tr>
                                            <th className="text-left px-4 py-3 min-w-[180px]">Aluno</th>
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(mes => (
                                                <th key={`header-mes-${mes}`} className="text-center px-2 py-3 w-12">
                                                    {getNomeMesCurto(mes)}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAlunos.slice(0, 15).map(aluno => (
                                            <tr key={aluno.id}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                                            {aluno.nome_completo.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-slate-900 truncate max-w-[150px]">{aluno.nome_completo}</p>
                                                            <p className="text-xs text-slate-500">{aluno.numero_processo}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                {aluno.pagamentos.map(pag => (
                                                    <td key={`cell-${aluno.id}-${pag.mes}`} className="text-center px-2 py-3">
                                                        {pag.status === 'pago' ? (
                                                            <button
                                                                onClick={() => {
                                                                    // Find the last payment for this month to view receipt
                                                                    // Ideally logic should handle multiple receipts, but for now show latest
                                                                    const pagamento = pagamentos.find(
                                                                        p => p.aluno_id === aluno.id && p.mes_referencia === pag.mes
                                                                    )
                                                                    if (pagamento) handleViewReceipt(pagamento)
                                                                }}
                                                                className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center mx-auto hover:bg-emerald-200 hover:shadow-sm transition-all"
                                                                title="Pago - Ver recibo"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            </button>
                                                        ) : pag.mes <= currentMonth ? (
                                                            <button
                                                                onClick={() => handleOpenPaymentModal(aluno, pag.mes)}
                                                                className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto hover:shadow-sm transition-all ${pag.status === 'parcial' ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100'}`}
                                                                title={pag.status === 'parcial' ? "Parcial - Completar pagamento" : "Pendente - Registar pagamento"}
                                                            >
                                                                {pag.status === 'parcial' ? (
                                                                    <span className="text-xs font-bold">%</span>
                                                                ) : (
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                                    </svg>
                                                                )}
                                                            </button>
                                                        ) : (
                                                            <div className="w-8 h-8 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center mx-auto" title="Futuro">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                                                </svg>
                                                            </div>
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredAlunos.length > 15 && (
                                    <p className="text-center text-sm text-slate-500 py-4 border-t border-slate-100">
                                        Mostrando 15 de {filteredAlunos.length} alunos. Use a aba "Por Aluno" para ver todos.
                                    </p>
                                )}
                            </div>
                        </>
                    )}

                    {/* Students Tab */}
                    {activeTab === 'students' && (
                        <div className="space-y-3 stagger-children">
                            {filteredAlunos.map(aluno => {
                                const totalPendente = aluno.pagamentos.filter(p => p.status !== 'pago' && p.mes <= currentMonth).length

                                return (
                                    <div key={aluno.id} className="tuition-student-card">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-11 h-11 bg-gradient-to-br from-primary-500 to-indigo-500 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm">
                                                    {aluno.nome_completo.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-900">{aluno.nome_completo}</p>
                                                    <p className="text-sm text-slate-500">{aluno.numero_processo} • {(aluno as any).turma?.nome || 'Sem turma'}</p>
                                                </div>
                                            </div>
                                            <span className={`payment-status ${totalPendente === 0
                                                ? 'payment-status-paid'
                                                : totalPendente <= 2
                                                    ? 'payment-status-pending'
                                                    : 'payment-status-overdue'
                                                }`}>
                                                {totalPendente === 0 ? (
                                                    <>
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        Em dia
                                                    </>
                                                ) : `${totalPendente} pend.`}
                                            </span>
                                        </div>
                                        {/* Month Pills - Grid Layout */}
                                        <div className="grid grid-cols-6 md:grid-cols-12 gap-1.5">
                                            {aluno.pagamentos.map(pag => (
                                                <button
                                                    key={`stud-pill-${aluno.id}-${pag.mes}`}
                                                    onClick={() => pag.status !== 'pago' && pag.mes <= currentMonth && handleOpenPaymentModal(aluno, pag.mes)}
                                                    disabled={pag.status === 'pago' || pag.mes > currentMonth}
                                                    className={`month-pill ${pag.status === 'pago'
                                                        ? 'month-pill-paid'
                                                        : pag.status === 'parcial'
                                                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                                                            : pag.mes <= currentMonth
                                                                ? 'month-pill-pending'
                                                                : 'month-pill-future'
                                                        }`}
                                                >
                                                    {getNomeMesCurto(pag.mes)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                            {filteredAlunos.length === 0 && (
                                <div className="text-center py-12 text-slate-500">
                                    <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <p className="font-medium">Nenhum aluno encontrado</p>
                                    <p className="text-sm mt-1">Tente ajustar os filtros de pesquisa</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Payments Tab */}
                    {activeTab === 'payments' && (
                        <>
                            {/* Mobile: Card View */}
                            <div className="md:hidden space-y-3">
                                {pagamentos.map(pag => (
                                    <div key={pag.id} className="tuition-student-card">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center text-white shadow-sm">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-900">{pag.aluno?.nome_completo || '-'}</p>
                                                    <p className="text-xs text-slate-500">{pag.aluno?.numero_processo}</p>
                                                </div>
                                            </div>
                                            <span className="text-lg font-bold text-emerald-600">{formatarValor(pag.valor)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-500">
                                                {getNomeMes(pag.mes_referencia)} {pag.ano_referencia}
                                            </span>
                                            <span className="text-slate-500">
                                                {new Date(pag.data_pagamento).toLocaleDateString('pt-AO')}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-mono">
                                                {pag.numero_recibo}
                                            </span>
                                            <button
                                                onClick={() => handleViewReceipt(pag)}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary-50 text-primary-600 rounded-xl text-sm font-medium hover:bg-primary-100 transition-colors min-h-touch"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                                </svg>
                                                Ver Recibo
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {pagamentos.length === 0 && (
                                    <div className="text-center py-12 text-slate-500">
                                        <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        <p className="font-medium">Nenhum pagamento registado</p>
                                        <p className="text-sm mt-1">Os pagamentos aparecerão aqui</p>
                                    </div>
                                )}
                            </div>

                            {/* Desktop: Table View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="table-excel">
                                    <thead>
                                        <tr>
                                            <th className="text-left px-4 py-3">Aluno</th>
                                            <th className="text-left px-4 py-3">Mês</th>
                                            <th className="text-right px-4 py-3">Valor</th>
                                            <th className="text-center px-4 py-3">Data</th>
                                            <th className="text-center px-4 py-3">Recibo</th>
                                            <th className="text-center px-4 py-3">Acções</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagamentos.map(pag => (
                                            <tr key={pag.id}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-slate-900">{pag.aluno?.nome_completo || '-'}</p>
                                                            <p className="text-xs text-slate-500">{pag.aluno?.numero_processo}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600">
                                                    {getNomeMes(pag.mes_referencia)} {pag.ano_referencia}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className="text-sm font-semibold text-emerald-600">{formatarValor(pag.valor)}</span>
                                                </td>
                                                <td className="px-4 py-3 text-center text-sm text-slate-600">
                                                    {new Date(pag.data_pagamento).toLocaleDateString('pt-AO')}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 ${pag.estado === 'anulado' ? 'bg-red-100 text-red-700 decoration-red-700 line-through' : 'bg-slate-100 text-slate-700'} rounded-lg text-xs font-mono`}>
                                                        {pag.numero_recibo}
                                                    </span>
                                                    {pag.estado === 'anulado' && (
                                                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800">
                                                            ANULADO
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => handleViewReceipt(pag)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-600 rounded-lg text-xs font-medium hover:bg-primary-100 hover:shadow-sm transition-all mr-2"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                                        </svg>
                                                        Recibo
                                                    </button>
                                                    {/* Só permitir anular se criado há menos de 24h e por este user (opcional) */}
                                                    <button
                                                        onClick={() => handleAnularPagamento(pag)}
                                                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                                                        title="Anular Recibo"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {pagamentos.length === 0 && (
                                    <div className="text-center py-12 text-slate-500 border-t border-slate-100">
                                        <p>Nenhum pagamento registado</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && selectedAluno && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-slide-up">
                        <h3 className="text-lg font-bold text-slate-900 mb-1">Registar Pagamento</h3>
                        <p className="text-sm text-slate-500 mb-5">
                            {selectedAluno.nome_completo} - {getNomeMes(selectedMes)} {currentYear}
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Valor</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">Kz</span>
                                    <input
                                        type="number"
                                        value={paymentForm.valor}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, valor: Number(e.target.value) })}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Método de Pagamento</label>
                                <select
                                    value={paymentForm.metodo_pagamento}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, metodo_pagamento: e.target.value as MetodoPagamentoPropina })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                >
                                    <option value="numerario">Numerário</option>
                                    <option value="transferencia">Transferência Bancária</option>
                                    <option value="deposito">Depósito Bancário</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Observação (opcional)</label>
                                <textarea
                                    value={paymentForm.observacao}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, observacao: e.target.value })}
                                    rows={2}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
                                    placeholder="Qualquer nota adicional..."
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSubmitPayment}
                                disabled={submitting || !paymentForm.valor}
                                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Processando...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Confirmar
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Modal - Premium Professional Design */}
            {showReceiptModal && selectedPagamento && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900/70 via-slate-900/60 to-primary-900/40 backdrop-blur-md" onClick={() => setShowReceiptModal(false)} />

                    {/* Receipt Container - Full height on mobile, centered on desktop */}
                    <div className="relative bg-white w-full max-w-md md:rounded-3xl rounded-t-3xl shadow-2xl animate-slide-up max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col print:shadow-none print:rounded-none print:max-h-none">

                        {/* Decorative Top Pattern */}
                        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-br from-primary-600 via-primary-500 to-indigo-600 overflow-hidden">
                            <div className="absolute inset-0 opacity-20">
                                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                    <defs>
                                        <pattern id="receipt-pattern" patternUnits="userSpaceOnUse" width="20" height="20">
                                            <circle cx="10" cy="10" r="1.5" fill="white" />
                                        </pattern>
                                    </defs>
                                    <rect width="100" height="100" fill="url(#receipt-pattern)" />
                                </svg>
                            </div>
                            {/* Decorative Circles */}
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-xl" />
                            <div className="absolute -bottom-20 -left-10 w-48 h-48 bg-indigo-400/20 rounded-full blur-2xl" />
                        </div>

                        {/* Close button */}
                        <button
                            onClick={() => setShowReceiptModal(false)}
                            className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/20 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-white/30 transition-colors print:hidden"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Receipt Content */}
                        <div className="flex-1 overflow-y-auto" id="receipt-content">
                            {/* Header Section */}
                            <div className="relative pt-6 pb-16 px-6 text-center text-white">
                                {/* School Logo Placeholder */}
                                <div className="w-16 h-16 bg-white rounded-2xl shadow-lg mx-auto mb-3 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                </div>
                                <h2 className="text-lg font-bold truncate">{escolaProfile?.nome || 'EduGest Angola'}</h2>
                                <p className="text-sm text-white/80 truncate">{escolaProfile?.endereco || 'Angola'}</p>
                            </div>

                            {/* White Card Content - Overlapping header */}
                            <div className="relative bg-white -mt-8 rounded-t-3xl px-6 pt-6 pb-4">
                                {/* Success Badge */}
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                                    <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 ring-4 ring-white">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                </div>

                                {/* Receipt Title */}
                                <div className="text-center mt-6 mb-6">
                                    <h3 className="text-xl font-bold text-slate-900">Recibo de Pagamento</h3>
                                    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-primary-50 rounded-full">
                                        <span className="text-xs font-medium text-primary-600">Nº</span>
                                        <span className="text-sm font-bold font-mono text-primary-700">{selectedPagamento.numero_recibo}</span>
                                    </div>
                                </div>

                                {/* Amount Card */}
                                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl p-5 mb-6 shadow-lg shadow-emerald-500/20">
                                    <p className="text-emerald-100 text-sm text-center mb-1">Valor Pago</p>
                                    <p className="text-3xl md:text-4xl font-bold text-white text-center tracking-tight">
                                        {formatarValor(selectedPagamento.valor)}
                                    </p>
                                </div>

                                {/* Details Grid */}
                                <div className="bg-slate-50 rounded-2xl p-4 space-y-0 divide-y divide-slate-200/80">
                                    <div className="flex items-center justify-between py-3 first:pt-0">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                            </div>
                                            <span className="text-sm text-slate-500">Aluno</span>
                                        </div>
                                        <span className="text-sm font-semibold text-slate-900 text-right max-w-[55%] truncate">{selectedPagamento.aluno?.nome_completo}</span>
                                    </div>

                                    <div className="flex items-center justify-between py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                                </svg>
                                            </div>
                                            <span className="text-sm text-slate-500">Nº Processo</span>
                                        </div>
                                        <span className="text-sm font-mono font-semibold text-slate-900">{selectedPagamento.aluno?.numero_processo}</span>
                                    </div>

                                    <div className="flex items-center justify-between py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                            <span className="text-sm text-slate-500">Referente a</span>
                                        </div>
                                        <span className="text-sm font-semibold text-slate-900">{getNomeMes(selectedPagamento.mes_referencia)} {selectedPagamento.ano_referencia}</span>
                                    </div>

                                    <div className="flex items-center justify-between py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                                </svg>
                                            </div>
                                            <span className="text-sm text-slate-500">Método</span>
                                        </div>
                                        <span className="text-sm font-semibold text-slate-900">{getMetodoPagamentoLabel(selectedPagamento.metodo_pagamento)}</span>
                                    </div>

                                    <div className="flex items-center justify-between py-3 last:pb-0">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </div>
                                            <span className="text-sm text-slate-500">Data</span>
                                        </div>
                                        <span className="text-sm font-semibold text-slate-900">
                                            {new Date(selectedPagamento.data_pagamento).toLocaleDateString('pt-AO', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </span>
                                    </div>
                                </div>

                                {/* Observation */}
                                {selectedPagamento.observacao && (
                                    <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100">
                                        <p className="text-xs font-medium text-amber-700 mb-1">Observação</p>
                                        <p className="text-sm text-amber-900">{selectedPagamento.observacao}</p>
                                    </div>
                                )}

                                {/* Footer */}
                                <div className="mt-6 pt-4 border-t border-dashed border-slate-200 text-center">
                                    <div className="inline-flex items-center gap-2 text-slate-400 text-xs mb-1">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                        Documento emitido eletronicamente
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        {new Date().toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' })} às {new Date().toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Actions - Fixed at bottom on mobile */}
                        <div className="flex-shrink-0 flex gap-3 p-4 bg-white border-t border-slate-100 print:hidden safe-area-inset-bottom">
                            <button
                                onClick={() => setShowReceiptModal(false)}
                                className="flex-1 px-4 py-3.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-all active:scale-[0.98]"
                            >
                                Fechar
                            </button>
                            <button
                                onClick={handlePrintReceipt}
                                className="flex-1 px-4 py-3.5 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                Imprimir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Annulment Modal */}
            {showAnnulModal && paymentToAnnul && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 bg-red-50/50">
                            <h3 className="text-lg font-semibold text-red-900 flex items-center gap-2">
                                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Anular Recibo #{paymentToAnnul.numero_recibo}
                            </h3>
                            <p className="text-sm text-red-700 mt-1">
                                Esta acção é irreversível e ficará registada para efeitos fiscais.
                            </p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Motivo da Anulação <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={annulReason}
                                    onChange={(e) => setAnnulReason(e.target.value)}
                                    placeholder="Descreva o motivo (ex: erro no lançamento, cheque devolvido)..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 min-h-[100px] text-sm"
                                    autoFocus
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Mínimo de 5 caracteres.
                                </p>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-xs text-gray-600">
                                <div className="flex justify-between mb-1">
                                    <span>Aluno:</span>
                                    <span className="font-medium">{paymentToAnnul.aluno?.nome_completo || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between mb-1">
                                    <span>Valor:</span>
                                    <span className="font-medium">{formatarValor(paymentToAnnul.valor)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Data:</span>
                                    <span className="font-medium">{new Date(paymentToAnnul.data_pagamento).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                                <div className="flex h-5 items-center">
                                    <input
                                        id="confirm-annul"
                                        type="checkbox"
                                        checked={confirmationCheck}
                                        onChange={(e) => setConfirmationCheck(e.target.checked)}
                                        className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                                    />
                                </div>
                                <label htmlFor="confirm-annul" className="text-sm text-red-800 font-medium select-none cursor-pointer">
                                    Confirmo que pretendo anular este recibo e compreendo que esta acção é irreversível e será auditada.
                                </label>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowAnnulModal(false)
                                    setPaymentToAnnul(null)
                                }}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmAnnulment}
                                disabled={!annulReason || annulReason.trim().length < 5 || !confirmationCheck}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
                            >
                                Confirmar Anulação
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Config Modal */}
            {showConfigModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowConfigModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-slide-up">
                        <h3 className="text-lg font-bold text-slate-900 mb-1">Configurar Propinas</h3>
                        <p className="text-sm text-slate-500 mb-5">Defina o valor da mensalidade para {currentYear}</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Valor da Mensalidade</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">Kz</span>
                                    <input
                                        type="number"
                                        value={configForm.valor_mensalidade}
                                        onChange={(e) => setConfigForm({ ...configForm, valor_mensalidade: Number(e.target.value) })}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (opcional)</label>
                                <input
                                    type="text"
                                    value={configForm.descricao}
                                    onChange={(e) => setConfigForm({ ...configForm, descricao: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                    placeholder="Ex: Mensalidade padrão"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowConfigModal(false)}
                                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveConfig}
                                disabled={submitting || !configForm.valor_mensalidade}
                                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PDF Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowExportModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-slide-up">
                        <h3 className="text-lg font-bold text-slate-900 mb-1">Imprimir Lista / Exportar</h3>
                        <p className="text-sm text-slate-500 mb-5">Exporte lista de pagamentos ou ficheiro SAF-T (AGT)</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Mês de Referência</label>
                                <select
                                    value={exportMes}
                                    onChange={(e) => setExportMes(Number(e.target.value))}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(mes => (
                                        <option key={`opt-mes-${mes}`} value={mes}>{getNomeMes(mes)} {mes > currentMonth ? currentYear - 1 : currentYear}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Turma</label>
                                <select
                                    value={exportTurma}
                                    onChange={(e) => setExportTurma(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                >
                                    <option value="">Todas as turmas</option>
                                    {turmas.map(turma => (
                                        <option key={turma.id} value={turma.id}>{turma.nome}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                                <button
                                    onClick={handlePrintExport}
                                    disabled={exportLoading}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium shadow-lg shadow-primary-600/20 disabled:opacity-50"
                                >
                                    {exportLoading ? (
                                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                        </svg>
                                    )}
                                    Imprimir Lista (PDF)
                                </button>

                                <button
                                    onClick={handleExportSaft}
                                    disabled={exportLoading}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors font-medium shadow-lg shadow-slate-800/20 disabled:opacity-50"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                    </svg>
                                    Exportar SAF-T (AO) XML
                                </button>
                            </div>
                            <div className="pt-2 border-t border-slate-100">
                                {headerConfig?.nome_escola ? (
                                    <p className="text-xs text-slate-500 text-center">
                                        <svg className="w-3 h-3 inline mr-1 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Cabeçalho: {headerConfig.nome_escola}
                                        <span className="block mt-1 text-slate-400">Alterar em Configurações</span>
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-400 text-center">
                                        Configure o cabeçalho em Configurações
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowExportModal(false)}
                                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleExportPaidStudentsList}
                                disabled={exportLoading}
                                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {exportLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Gerando...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Exportar PDF
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast.show && (
                <div className={`fixed bottom-4 right-4 z-[60] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                    {toast.type === 'success' ? (
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    )}
                    <div>
                        <p className="font-semibold text-sm">{toast.type === 'success' ? 'Sucesso' : 'Erro'}</p>
                        <p className="text-sm opacity-90">{toast.message}</p>
                    </div>
                </div>
            )}
        </div>
    )
}

export default TuitionPaymentsPage
