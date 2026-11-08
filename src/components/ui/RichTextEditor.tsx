import { useState, useRef, useCallback, useEffect } from 'react'
import { sanitizeHtml } from '../../utils/sanitizeHtml'

interface RichTextEditorProps {
    value: string
    onChange: (html: string) => void
    placeholder?: string
    variables?: string[]
    onInsertVariable?: (variable: string) => void
}

export const RichTextEditor = ({
    value,
    onChange,
    placeholder = "Escreva o conteúdo do documento...",
    variables = [],
    onInsertVariable
}: RichTextEditorProps) => {
    const editorRef = useRef<HTMLDivElement>(null)
    const [showVariableMenu, setShowVariableMenu] = useState(false)

    // Initialize content
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = sanitizeHtml(value)
        }
    }, [])

    const handleInput = useCallback(() => {
        if (editorRef.current) {
            onChange(sanitizeHtml(editorRef.current.innerHTML))
        }
    }, [onChange])

    const execCommand = (command: string, value?: string) => {
        document.execCommand(command, false, value)
        editorRef.current?.focus()
        handleInput()
    }

    const insertVariable = (variable: string) => {
        // Insert variable at cursor position
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)

            // Create a styled span for the variable
            const span = document.createElement('span')
            span.className = 'bg-indigo-100 text-indigo-700 px-1 rounded font-mono text-sm'
            span.contentEditable = 'false'
            span.textContent = variable

            range.deleteContents()
            range.insertNode(span)

            // Move cursor after the variable
            range.setStartAfter(span)
            range.setEndAfter(span)
            selection.removeAllRanges()
            selection.addRange(range)
        }

        handleInput()
        setShowVariableMenu(false)
    }

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-1 p-3 bg-slate-50 border-b border-slate-200">
                {/* Text Formatting */}
                <div className="flex gap-1 pr-3 border-r border-slate-200">
                    <ToolbarButton
                        onClick={() => execCommand('bold')}
                        title="Negrito (Ctrl+B)"
                    >
                        <strong>N</strong>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => execCommand('italic')}
                        title="Itálico (Ctrl+I)"
                    >
                        <em>I</em>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => execCommand('underline')}
                        title="Sublinhado (Ctrl+U)"
                    >
                        <u>S</u>
                    </ToolbarButton>
                </div>

                {/* Alignment */}
                <div className="flex gap-1 pr-3 border-r border-slate-200">
                    <ToolbarButton
                        onClick={() => execCommand('justifyLeft')}
                        title="Alinhar à Esquerda"
                    >
                        ⬜
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => execCommand('justifyCenter')}
                        title="Centralizar"
                    >
                        ⬛
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => execCommand('justifyRight')}
                        title="Alinhar à Direita"
                    >
                        🔲
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => execCommand('justifyFull')}
                        title="Justificar"
                    >
                        📄
                    </ToolbarButton>
                </div>

                {/* Headings */}
                <div className="flex gap-1 pr-3 border-r border-slate-200">
                    <ToolbarButton
                        onClick={() => execCommand('formatBlock', 'h2')}
                        title="Título"
                    >
                        T1
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => execCommand('formatBlock', 'h3')}
                        title="Subtítulo"
                    >
                        T2
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => execCommand('formatBlock', 'p')}
                        title="Parágrafo"
                    >
                        P
                    </ToolbarButton>
                </div>

                {/* Insert Variable */}
                <div className="relative">
                    <ToolbarButton
                        onClick={() => setShowVariableMenu(!showVariableMenu)}
                        title="Inserir Variável"
                        className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    >
                        + Variável
                    </ToolbarButton>

                    {/* Variable Dropdown */}
                    {showVariableMenu && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto w-64">
                            <div className="p-2 text-xs text-slate-500 border-b border-slate-100 font-medium">
                                Clique para inserir uma variável
                            </div>
                            <VariableGroup
                                title="📋 Dados Básicos"
                                variables={['{{NOME_FUNCIONARIO}}', '{{CARGO}}', '{{ESCOLA}}', '{{NUMERO_FUNCIONARIO}}']}
                                onSelect={insertVariable}
                            />
                            <VariableGroup
                                title="👤 Dados Pessoais"
                                variables={['{{DATA_NASCIMENTO}}', '{{NUMERO_BI}}', '{{NACIONALIDADE}}', '{{NATURALIDADE}}', '{{ESTADO_CIVIL}}', '{{NOME_PAI}}', '{{NOME_MAE}}']}
                                onSelect={insertVariable}
                            />
                            <VariableGroup
                                title="🏠 Endereço"
                                variables={['{{ENDERECO_COMPLETO}}', '{{PROVINCIA_RESIDENCIA}}', '{{MUNICIPIO_RESIDENCIA}}']}
                                onSelect={insertVariable}
                            />
                            <VariableGroup
                                title="🎓 Formação"
                                variables={['{{GRAU_ACADEMICO}}', '{{AREA_FORMACAO}}', '{{INSTITUICAO_FORMACAO}}', '{{ANO_CONCLUSAO}}']}
                                onSelect={insertVariable}
                            />
                            <VariableGroup
                                title="💼 Profissional"
                                variables={['{{CATEGORIA_DOCENTE}}', '{{CATEGORIA_LABORAL}}', '{{DATA_INICIO_FUNCOES}}']}
                                onSelect={insertVariable}
                            />
                            <VariableGroup
                                title="📝 Documento"
                                variables={['{{TIPO_DOCUMENTO}}', '{{MUNICIPIO}}', '{{PROVINCIA}}', '{{NOME_DIRECTOR}}', '{{DATA_ATUAL}}']}
                                onSelect={insertVariable}
                            />
                        </div>
                    )}
                </div>

                {/* Undo/Redo */}
                <div className="flex gap-1 ml-auto">
                    <ToolbarButton
                        onClick={() => execCommand('undo')}
                        title="Desfazer"
                    >
                        ↩️
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => execCommand('redo')}
                        title="Refazer"
                    >
                        ↪️
                    </ToolbarButton>
                </div>
            </div>

            {/* Editor Area */}
            <div
                ref={editorRef}
                contentEditable
                className="flex-1 p-6 outline-none overflow-y-auto prose prose-sm max-w-none"
                style={{
                    fontFamily: "'Times New Roman', serif",
                    fontSize: '14pt',
                    lineHeight: '1.8',
                    minHeight: '400px'
                }}
                onInput={handleInput}
                onBlur={handleInput}
                data-placeholder={placeholder}
            />

            {/* Click outside to close variable menu */}
            {showVariableMenu && (
                <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowVariableMenu(false)}
                />
            )}
        </div>
    )
}

// Toolbar Button Component
function ToolbarButton({
    onClick,
    title,
    children,
    className = ''
}: {
    onClick: () => void
    title: string
    children: React.ReactNode
    className?: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={`px-2 py-1 text-sm rounded hover:bg-slate-200 transition-colors min-w-[28px] ${className}`}
        >
            {children}
        </button>
    )
}

// Variable Group Component
function VariableGroup({
    title,
    variables,
    onSelect
}: {
    title: string
    variables: string[]
    onSelect: (v: string) => void
}) {
    return (
        <div className="border-b border-slate-100 last:border-b-0">
            <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-50">
                {title}
            </div>
            <div className="p-2 flex flex-wrap gap-1">
                {variables.map(v => (
                    <button
                        key={v}
                        onClick={() => onSelect(v)}
                        className="text-[10px] bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200 text-indigo-700 font-mono transition-colors"
                    >
                        {v.replace(/{{|}}/g, '')}
                    </button>
                ))}
            </div>
        </div>
    )
}
