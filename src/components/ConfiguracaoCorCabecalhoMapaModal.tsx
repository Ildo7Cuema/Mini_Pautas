import React, { useEffect, useState } from 'react'
import {
    DEFAULT_MAP_HEADER_COLOR,
    DEFAULT_MAP_HEADER_COLOR_MAPA,
    DEFAULT_MAP_HEADER_COLOR_PRIMARY,
    HeaderConfig,
    loadHeaderConfig,
    saveHeaderConfig,
    getDefaultHeaderConfig,
} from '../utils/headerConfigUtils'
import { translateError } from '../utils/translations'

interface Props {
    isOpen: boolean
    onClose: () => void
    onSave: (config: HeaderConfig) => void
    escolaId: string
    currentConfig: HeaderConfig | null
}

const PRESETS = [
    { label: 'Azul', value: DEFAULT_MAP_HEADER_COLOR },
    { label: 'Verde', value: DEFAULT_MAP_HEADER_COLOR_PRIMARY },
    { label: 'Navy', value: DEFAULT_MAP_HEADER_COLOR_MAPA },
    { label: 'Cinza', value: '#334155' },
    { label: 'Teal', value: '#0f766e' },
]

export const ConfiguracaoCorCabecalhoMapaModal: React.FC<Props> = ({
    isOpen,
    onClose,
    onSave,
    escolaId,
    currentConfig,
}) => {
    const [color, setColor] = useState(DEFAULT_MAP_HEADER_COLOR)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!isOpen) return
        setColor(currentConfig?.cor_cabecalho_mapa || DEFAULT_MAP_HEADER_COLOR)
        setError(null)
    }, [isOpen, currentConfig])

    if (!isOpen) return null

    const handleSave = async () => {
        if (!/^#([0-9a-fA-F]{6})$/.test(color.trim())) {
            setError('Use uma cor hexadecimal válida (ex.: #1e40af)')
            return
        }

        try {
            setSaving(true)
            setError(null)

            let base = currentConfig
            if (!base) {
                base = (await loadHeaderConfig(escolaId)) || null
            }

            const defaults = getDefaultHeaderConfig()
            const configToSave: HeaderConfig = {
                ...(base || defaults),
                escola_id: escolaId,
                nome_escola: base?.nome_escola || defaults.nome_escola || 'Escola',
                cor_cabecalho_mapa: color.trim(),
            } as HeaderConfig

            const saved = await saveHeaderConfig(configToSave)
            onSave(saved)
            onClose()
        } catch (err) {
            setError(translateError(err instanceof Error ? err.message : 'Erro ao guardar a cor'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Cor do cabeçalho dos mapas</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Pautas, mini-pautas, mapas e documentos semelhantes
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition"
                        aria-label="Fechar"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="h-11 w-14 cursor-pointer rounded border border-slate-300 bg-white p-1"
                            aria-label="Seleccionar cor"
                        />
                        <input
                            type="text"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            maxLength={7}
                            placeholder="#1e40af"
                        />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {PRESETS.map((preset) => (
                            <button
                                key={preset.value}
                                type="button"
                                onClick={() => setColor(preset.value)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition ${
                                    color.toLowerCase() === preset.value.toLowerCase()
                                        ? 'border-blue-400 bg-blue-50 text-blue-800'
                                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                }`}
                            >
                                <span
                                    className="w-3.5 h-3.5 rounded-sm border border-slate-300"
                                    style={{ backgroundColor: preset.value }}
                                />
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    <div
                        className="rounded-md px-3 py-2.5 text-center text-xs font-semibold text-white"
                        style={{ backgroundColor: /^#([0-9a-fA-F]{6})$/.test(color) ? color : DEFAULT_MAP_HEADER_COLOR }}
                    >
                        Pré-visualização do cabeçalho
                    </div>
                </div>

                <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition text-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm disabled:opacity-50"
                    >
                        {saving ? 'A guardar…' : 'Guardar cor'}
                    </button>
                </div>
            </div>
        </div>
    )
}
