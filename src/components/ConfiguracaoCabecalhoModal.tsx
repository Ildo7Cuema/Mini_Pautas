import { useState, useEffect } from 'react'
import {
    HeaderConfig,
    loadHeaderConfig,
    saveHeaderConfig,
    uploadLogo,
    deleteLogo,
    getDefaultHeaderConfig,
    getOrgaoEducacao
} from '../utils/headerConfigUtils'
import { translateError } from '../utils/translations'

interface ConfiguracaoCabecalhoModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: () => void
    escolaId: string // Required school ID for configuration isolation
    /** @deprecated Kept for call-site compatibility; header is shared across all school documents */
    documentType?: 'Mini-Pauta' | 'Pauta-Geral' | 'Documentos'
}

export const ConfiguracaoCabecalhoModal: React.FC<ConfiguracaoCabecalhoModalProps> = ({
    isOpen,
    onClose,
    onSave,
    escolaId,
    documentType = 'Documentos',
}) => {
    const [config, setConfig] = useState<Partial<HeaderConfig>>(getDefaultHeaderConfig())
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [logoPreview, setLogoPreview] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen) {
            loadConfig()
        }
    }, [isOpen])

    const loadConfig = async () => {
        try {
            setLoading(true)
            const data = await loadHeaderConfig(escolaId)
            if (data) {
                setConfig(data)
                setLogoPreview(data.logo_url || null)
            } else {
                // Set default config with escola_id
                const defaultConfig = getDefaultHeaderConfig()
                setConfig({ ...defaultConfig, escola_id: escolaId })
            }
        } catch (err) {
            console.error('Error loading config:', err)
            setError(translateError(err instanceof Error ? err.message : 'Erro ao carregar configuração'))
        } finally {
            setLoading(false)
        }
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            setUploading(true)
            setError(null)

            // Delete old logo if exists
            if (config.logo_url) {
                await deleteLogo(config.logo_url)
            }

            const logoUrl = await uploadLogo(file)
            setConfig({ ...config, logo_url: logoUrl })
            setLogoPreview(logoUrl)
            setSuccess('Logo carregado com sucesso!')
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao fazer upload do logo'
            setError(translateError(errorMessage))
        } finally {
            setUploading(false)
        }
    }

    const handleRemoveLogo = async () => {
        if (config.logo_url) {
            await deleteLogo(config.logo_url)
        }
        setConfig({ ...config, logo_url: null })
        setLogoPreview(null)
    }

    const handleSave = async () => {
        try {
            setLoading(true)
            setError(null)

            if (!config.nome_escola) {
                setError('Nome da escola é obrigatório')
                return
            }

            // Ensure escola_id is set
            const configToSave = {
                ...config,
                escola_id: escolaId
            } as HeaderConfig

            await saveHeaderConfig(configToSave)
            setSuccess('Configuração salva com sucesso!')
            setTimeout(() => {
                setSuccess(null)
                onSave()
                onClose()
            }, 1500)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar configuração'
            setError(translateError(errorMessage))
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900">Configurar Cabeçalho dos Documentos</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
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

                    {loading && !uploading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="mt-4 text-slate-600">Carregando...</p>
                        </div>
                    ) : (
                        <>
                            {/* Logo Upload */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Logomarca (opcional)
                                </label>
                                <div className="flex items-start gap-4">
                                    {logoPreview ? (
                                        <div className="relative">
                                            <img
                                                src={logoPreview}
                                                alt="Logo preview"
                                                className="w-24 h-24 object-contain border border-slate-200 rounded"
                                            />
                                            <button
                                                onClick={handleRemoveLogo}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-24 h-24 border-2 border-dashed border-slate-300 rounded flex items-center justify-center">
                                            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/jpg"
                                            onChange={handleLogoUpload}
                                            disabled={uploading}
                                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">
                                            PNG, JPG ou JPEG. Máximo 2MB.
                                        </p>
                                        {uploading && (
                                            <p className="text-sm text-blue-600 mt-2">Fazendo upload...</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* República de Angola */}
                            <div>
                                <label className="flex items-center gap-2 mb-2">
                                    <input
                                        type="checkbox"
                                        checked={config.mostrar_republica}
                                        onChange={(e) => setConfig({ ...config, mostrar_republica: e.target.checked })}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">Mostrar República</span>
                                </label>
                                {config.mostrar_republica && (
                                    <input
                                        type="text"
                                        value={config.texto_republica}
                                        onChange={(e) => setConfig({ ...config, texto_republica: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="República de Angola"
                                    />
                                )}
                            </div>

                            {/* Governo Provincial */}
                            <div>
                                <label className="flex items-center gap-2 mb-2">
                                    <input
                                        type="checkbox"
                                        checked={config.mostrar_governo_provincial}
                                        onChange={(e) => setConfig({ ...config, mostrar_governo_provincial: e.target.checked })}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">Mostrar Governo Provincial</span>
                                </label>
                                {config.mostrar_governo_provincial && (
                                    <input
                                        type="text"
                                        value={config.provincia}
                                        onChange={(e) => setConfig({ ...config, provincia: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Huíla"
                                    />
                                )}
                            </div>

                            {/* Órgão de Educação */}
                            <div>
                                <label className="flex items-center gap-2 mb-2">
                                    <input
                                        type="checkbox"
                                        checked={config.mostrar_orgao_educacao}
                                        onChange={(e) => setConfig({ ...config, mostrar_orgao_educacao: e.target.checked })}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">Mostrar Órgão de Educação</span>
                                </label>
                                {config.mostrar_orgao_educacao && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Nível de Ensino
                                            </label>
                                            <select
                                                value={config.nivel_ensino}
                                                onChange={(e) => setConfig({ ...config, nivel_ensino: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            >
                                                <option value="Ensino Secundário">Ensino Secundário</option>
                                                <option value="Ensino Primário">Ensino Primário</option>
                                            </select>
                                        </div>
                                        {config.nivel_ensino?.toLowerCase().includes('primário') || config.nivel_ensino?.toLowerCase().includes('primario') ? (
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                    Município
                                                </label>
                                                <input
                                                    type="text"
                                                    value={config.municipio}
                                                    onChange={(e) => setConfig({ ...config, municipio: e.target.value })}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    placeholder="Chipindo"
                                                />
                                            </div>
                                        ) : null}
                                        <div className="bg-slate-50 p-3 rounded-lg">
                                            <p className="text-sm text-slate-600">
                                                <strong>Será exibido:</strong> {getOrgaoEducacao(config.nivel_ensino || 'Ensino Secundário', config.provincia, config.municipio)}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Nome da Escola */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Nome da Escola <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={config.nome_escola}
                                    onChange={(e) => setConfig({ ...config, nome_escola: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Liceu nº 1837"
                                    required
                                />
                            </div>

                            {/* Font Sizes */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Tamanho Fonte "Mini-Pauta"
                                    </label>
                                    <input
                                        type="number"
                                        value={config.tamanho_fonte_mini_pauta}
                                        onChange={(e) => setConfig({ ...config, tamanho_fonte_mini_pauta: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        min="12"
                                        max="24"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Tamanho Fonte Outros
                                    </label>
                                    <input
                                        type="number"
                                        value={config.tamanho_fonte_outros}
                                        onChange={(e) => setConfig({ ...config, tamanho_fonte_outros: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        min="8"
                                        max="16"
                                    />
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <p className="text-sm font-medium text-slate-700 mb-3">Preview do Cabeçalho:</p>
                                <div className="bg-white p-4 rounded text-center space-y-1">
                                    {logoPreview && (
                                        <img
                                            src={logoPreview}
                                            alt="Logo"
                                            className="mx-auto mb-2"
                                            style={{ width: `${config.logo_width}px`, height: `${config.logo_height}px` }}
                                        />
                                    )}
                                    {config.mostrar_republica && (
                                        <p style={{ fontSize: `${config.tamanho_fonte_outros}px` }}>{config.texto_republica}</p>
                                    )}
                                    {config.mostrar_governo_provincial && (
                                        <p style={{ fontSize: `${config.tamanho_fonte_outros}px` }}>Governo Provincial da {config.provincia}</p>
                                    )}
                                    {config.mostrar_orgao_educacao && (
                                        <p style={{ fontSize: `${config.tamanho_fonte_outros}px` }}>
                                            {getOrgaoEducacao(config.nivel_ensino || 'Ensino Secundário', config.provincia, config.municipio)}
                                        </p>
                                    )}
                                    <p style={{ fontSize: `${config.tamanho_fonte_outros}px` }}>{config.nome_escola}</p>
                                    <p className="font-bold mt-2" style={{ fontSize: `${config.tamanho_fonte_mini_pauta}px` }}>{documentType.toUpperCase()}</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition"
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                        disabled={loading || uploading}
                    >
                        {loading ? 'Salvando...' : 'Salvar Configuração'}
                    </button>
                </div>
            </div>
        </div>
    )
}
