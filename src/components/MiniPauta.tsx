import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Turma, Disciplina, ViewMiniPauta, ViewEstatisticasTurma } from '../types'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { applyStandardPdfFooters } from '../utils/pdfFooter'

interface MiniPautaProps {
    turma: Turma
    disciplina: Disciplina
}

export const MiniPauta: React.FC<MiniPautaProps> = ({ turma, disciplina }) => {
    const [dados, setDados] = useState<ViewMiniPauta[]>([])
    const [estatisticas, setEstatisticas] = useState<ViewEstatisticasTurma | null>(null)
    const [loading, setLoading] = useState(false)
    const [exporting, setExporting] = useState(false)

    useEffect(() => {
        loadMiniPauta()
        loadEstatisticas()
    }, [turma.id, disciplina.id])

    const loadMiniPauta = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('vw_mini_pauta')
                .select('*')
                .eq('turma_id', turma.id)
                .eq('disciplina_id', disciplina.id)
                .order('aluno_nome')

            if (error) throw error
            setDados(data || [])
        } catch (error) {
            console.error('Error loading mini-pauta:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadEstatisticas = async () => {
        try {
            const { data, error } = await supabase
                .from('vw_estatisticas_turma')
                .select('*')
                .eq('turma_id', turma.id)
                .eq('disciplina_id', disciplina.id)
                .single()

            if (error) throw error
            setEstatisticas(data)
        } catch (error) {
            console.error('Error loading statistics:', error)
        }
    }

    const exportToPDF = () => {
        setExporting(true)
        try {
            const doc = new jsPDF()

            // Header
            doc.setFontSize(16)
            doc.text('MINI-PAUTA', 105, 15, { align: 'center' })

            doc.setFontSize(10)
            doc.text(`Escola: ${dados[0]?.escola_nome || ''}`, 14, 25)
            doc.text(`Turma: ${turma.nome}`, 14, 30)
            doc.text(`Disciplina: ${disciplina.nome}`, 14, 35)
            doc.text(`Ano Lectivo: ${turma.ano_lectivo}`, 14, 40)
            doc.text(`Trimestre: ${turma.trimestre}º`, 14, 45)
            doc.text(`Professor: ${dados[0]?.professor_nome || ''}`, 14, 50)

            // Table
            const tableData = dados.map((item, index) => [
                index + 1,
                item.numero_processo,
                item.aluno_nome,
                item.nota_final.toFixed(2),
                item.classificacao,
            ])

            autoTable(doc, {
                startY: 55,
                head: [['Nº', 'Nº Processo', 'Nome do Aluno', 'Nota Final', 'Classificação']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: [59, 130, 246] },
                styles: { fontSize: 9 },
            })

            // Statistics
            if (estatisticas) {
                const finalY = (doc as any).lastAutoTable.finalY + 10

                doc.setFontSize(12)
                doc.text('Estatísticas da Turma', 14, finalY)

                doc.setFontSize(9)
                doc.text(`Total de Alunos: ${estatisticas.total_alunos}`, 14, finalY + 7)
                doc.text(`Média da Turma: ${estatisticas.media_turma}`, 14, finalY + 12)
                doc.text(`Nota Mínima: ${estatisticas.nota_minima}`, 14, finalY + 17)
                doc.text(`Nota Máxima: ${estatisticas.nota_maxima}`, 14, finalY + 22)
                doc.text(`Aprovados: ${estatisticas.aprovados}`, 14, finalY + 27)
                doc.text(`Reprovados: ${estatisticas.reprovados}`, 14, finalY + 32)
                doc.text(`Taxa de Aprovação: ${estatisticas.taxa_aprovacao}%`, 14, finalY + 37)
            }

            applyStandardPdfFooters(doc)

            // Save
            doc.save(`mini-pauta-${turma.codigo_turma}-${disciplina.codigo_disciplina}-T${turma.trimestre}.pdf`)
        } catch (error) {
            console.error('Error exporting PDF:', error)
            alert('Erro ao exportar PDF')
        } finally {
            setExporting(false)
        }
    }

    const getClassificacaoColor = (classificacao: string) => {
        switch (classificacao) {
            case 'Excelente':
                return 'bg-green-100 text-green-800'
            case 'Bom':
                return 'bg-blue-100 text-blue-800'
            case 'Suficiente':
                return 'bg-yellow-100 text-yellow-800'
            case 'Insuficiente':
                return 'bg-red-100 text-red-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <div className="text-gray-500">Carregando mini-pauta...</div>
            </div>
        )
    }

    if (dados.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <svg className="w-20 h-20 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    Nenhuma nota final calculada
                </h3>
                <p className="text-gray-500">
                    Lance as notas e calcule as notas finais para gerar a mini-pauta
                </p>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-lg shadow-md">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Mini-Pauta</h2>
                        <p className="text-gray-600">
                            {turma.nome} - {disciplina.nome} - {turma.trimestre}º Trimestre
                        </p>
                    </div>
                    <button
                        onClick={exportToPDF}
                        disabled={exporting}
                        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {exporting ? 'Exportando...' : 'Exportar PDF'}
                    </button>
                </div>
            </div>

            {/* Statistics Cards */}
            {estatisticas && (
                <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Estatísticas da Turma</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-xs text-gray-600 font-medium mb-1">Total</div>
                            <div className="text-2xl font-bold text-gray-900">{estatisticas.total_alunos}</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-xs text-gray-600 font-medium mb-1">Média</div>
                            <div className="text-2xl font-bold text-blue-600">{estatisticas.media_turma}</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-xs text-gray-600 font-medium mb-1">Mínima</div>
                            <div className="text-2xl font-bold text-red-600">{estatisticas.nota_minima}</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-xs text-gray-600 font-medium mb-1">Máxima</div>
                            <div className="text-2xl font-bold text-green-600">{estatisticas.nota_maxima}</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-xs text-gray-600 font-medium mb-1">Aprovados</div>
                            <div className="text-2xl font-bold text-green-600">{estatisticas.aprovados}</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-xs text-gray-600 font-medium mb-1">Reprovados</div>
                            <div className="text-2xl font-bold text-red-600">{estatisticas.reprovados}</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="text-xs text-gray-600 font-medium mb-1">Taxa</div>
                            <div className="text-2xl font-bold text-indigo-600">{estatisticas.taxa_aprovacao}%</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Grades Table */}
            <div className="p-6">
                <div className="overflow-x-auto">
                    <table className="table-excel">
                        <thead>
                            <tr>
                                <th className="text-center">Nº</th>
                                <th className="text-left">Nº Processo</th>
                                <th className="text-left">Nome do Aluno</th>
                                <th className="text-center">Nota Final</th>
                                <th className="text-center">Classificação</th>
                                <th className="text-center">Detalhes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dados.map((item, index) => (
                                <tr key={item.aluno_id}>
                                    <td className="text-center text-slate-600">{index + 1}</td>
                                    <td className="text-left text-slate-600">{item.numero_processo}</td>
                                    <td className="text-left font-medium text-slate-900">{item.aluno_nome}</td>
                                    <td className="text-center">
                                        <span className="text-lg font-bold text-slate-900">
                                            {item.nota_final.toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="text-center">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getClassificacaoColor(item.classificacao)}`}>
                                            {item.classificacao}
                                        </span>
                                    </td>
                                    <td className="text-center">
                                        <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                                            Ver Cálculo
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 text-center text-sm text-gray-600">
                Gerado em: {new Date().toLocaleString('pt-AO')}
            </div>
        </div>
    )
}
