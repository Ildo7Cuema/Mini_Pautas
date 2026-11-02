/**
 * @component PriceEditModal
 * @description Modal for editing license prices (SUPERADMIN only)
 */

import React, { useState, useEffect } from 'react'
import type { PrecoLicenca } from '../types'
import { PLANO_ASSINATURA_LABELS } from '../utils/license'

interface PriceEditModalProps {
    price: PrecoLicenca | null
    isOpen: boolean
    onClose: () => void
    onSave: (id: string, updates: {
        valor: number
        desconto_percentual: number
        descricao: string
    }) => Promise<void>
}

export const PriceEditModal: React.FC<PriceEditModalProps> = ({
    price,
    isOpen,
    onClose,
    onSave
}) => {
    const [valor, setValor] = useState('')
    const [desconto, setDesconto] = useState('')
    const [descricao, setDescricao] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (price) {
            setValor(price.valor.toString())
            setDesconto(price.desconto_percentual.toString())
            setDescricao(price.descricao || '')
            setError(null)
        }
    }, [price])

    if (!isOpen || !price) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        const valorNum = parseFloat(valor)
        const descontoNum = parseFloat(desconto)

        // Validation
        if (isNaN(valorNum) || valorNum <= 0) {
            setError('O valor deve ser maior que 0')
            return
        }
        if (isNaN(descontoNum) || descontoNum < 0 || descontoNum > 100) {
            setError('O desconto deve estar entre 0 e 100')
            return
        }

        try {
            setSaving(true)
            await onSave(price.id, {
                valor: valorNum,
                desconto_percentual: descontoNum,
                descricao
            })
            onClose()
        } catch (err) {
            setError('Erro ao guardar alterações')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                    Editar Preço Global - {PLANO_ASSINATURA_LABELS[price.plano] || price.plano}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Valor */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Valor (AOA)
                        </label>
                        <input
                            type="number"
                            value={valor}
                            onChange={(e) => setValor(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="15000"
                            min="0"
                            step="0.01"
                            required
                        />
                    </div>

                    {/* Desconto */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Desconto (%)
                        </label>
                        <input
                            type="number"
                            value={desconto}
                            onChange={(e) => setDesconto(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0"
                            min="0"
                            max="100"
                            step="0.01"
                        />
                    </div>

                    {/* Descrição */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Descrição
                        </label>
                        <textarea
                            value={descricao}
                            onChange={(e) => setDescricao(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Descrição do plano..."
                            rows={3}
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-800 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            disabled={saving}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {saving ? 'A guardar...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default PriceEditModal
