/**
 * @component TutoriaisPublicosPage
 * @description Página pública para exibir tutoriais do sistema EduGest Angola
 * @tokens [--color-primary, --gradient-primary]
 * @responsive true
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Button } from './ui/Button'
import { Card, CardBody } from './ui/Card'
import { PublicBrandMark } from './auth/PublicBrandMark'
import type { Tutorial, CategoriaTutorial } from '../types'

interface TutoriaisPublicosPageProps {
    onBack?: () => void
}

const CATEGORIAS: { value: CategoriaTutorial | 'todos'; label: string; icon: string }[] = [
    { value: 'todos', label: 'Todos', icon: '📚' },
    { value: 'geral', label: 'Geral', icon: '🎯' },
    { value: 'login', label: 'Login & Cadastro', icon: '🔐' },
    { value: 'turmas', label: 'Turmas', icon: '👥' },
    { value: 'notas', label: 'Notas', icon: '📝' },
    { value: 'relatorios', label: 'Relatórios', icon: '📊' },
    { value: 'configuracoes', label: 'Configurações', icon: '⚙️' }
]

// Gerar ou obter session ID para usuários não autenticados
const getSessionId = (): string => {
    let sessionId = localStorage.getItem('tutorial_session_id')
    if (!sessionId) {
        sessionId = 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
        localStorage.setItem('tutorial_session_id', sessionId)
    }
    return sessionId
}

// Formatar número grande
const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
}

export const TutoriaisPublicosPage: React.FC<TutoriaisPublicosPageProps> = ({ onBack }) => {
    const [tutoriais, setTutoriais] = useState<Tutorial[]>([])
    const [loading, setLoading] = useState(true)
    const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaTutorial | 'todos'>('todos')
    const [tutorialSelecionado, setTutorialSelecionado] = useState<Tutorial | null>(null)
    const [likedTutorials, setLikedTutorials] = useState<Set<string>>(new Set())
    const [likingInProgress, setLikingInProgress] = useState<Set<string>>(new Set())
    const [likeAnimations, setLikeAnimations] = useState<Set<string>>(new Set())
    const [viewsRegistered, setViewsRegistered] = useState<Set<string>>(new Set())

    useEffect(() => {
        loadTutoriais()
    }, [])

    const loadTutoriais = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('tutoriais')
                .select('*')
                .eq('publico', true)
                .eq('ativo', true)
                .order('ordem', { ascending: true })
                .order('created_at', { ascending: false })

            if (error) throw error
            setTutoriais(data || [])
        } catch (error) {
            console.error('Erro ao carregar tutoriais:', error)
        } finally {
            setLoading(false)
        }
    }

    // Verificar likes do usuário/sessão
    const checkUserLikes = useCallback(async () => {
        try {
            const sessionId = getSessionId()
            const { data: { user } } = await supabase.auth.getUser()

            let query = supabase.from('tutorial_likes').select('tutorial_id')
            if (user) {
                query = query.eq('user_id', user.id)
            } else {
                query = query.eq('session_id', sessionId)
            }

            const { data } = await query
            if (data) {
                setLikedTutorials(new Set(data.map(d => d.tutorial_id)))
            }
        } catch (error) {
            console.error('Erro ao verificar likes:', error)
        }
    }, [])

    useEffect(() => {
        checkUserLikes()
    }, [checkUserLikes])

    // Registrar visualização
    const registrarVisualizacao = async (tutorialId: string) => {
        try {
            const sessionId = getSessionId()
            const { data: { user } } = await supabase.auth.getUser()

            await supabase.rpc('incrementar_visualizacao_tutorial', {
                p_tutorial_id: tutorialId,
                p_user_id: user?.id || null,
                p_session_id: user ? null : sessionId
            })

            // Atualizar contador local
            setTutoriais(prev => prev.map(t =>
                t.id === tutorialId ? { ...t, visualizacoes: t.visualizacoes + 1 } : t
            ))
        } catch (error) {
            console.error('Erro ao registrar visualização:', error)
        }
    }

    // Toggle like
    const toggleLike = async (e: React.MouseEvent, tutorialId: string) => {
        e.stopPropagation()

        // Evitar múltiplos cliques simultâneos
        if (likingInProgress.has(tutorialId)) return

        // Mostrar estado de carregamento
        setLikingInProgress(prev => new Set(prev).add(tutorialId))

        try {
            const sessionId = getSessionId()
            const { data: { user } } = await supabase.auth.getUser()

            const { data } = await supabase.rpc('toggle_like_tutorial', {
                p_tutorial_id: tutorialId,
                p_user_id: user?.id || null,
                p_session_id: user ? null : sessionId
            })

            if (data && data[0]) {
                const { liked, total_likes } = data[0]

                // Disparar animação do coração
                if (liked) {
                    setLikeAnimations(prev => new Set(prev).add(tutorialId))
                    setTimeout(() => {
                        setLikeAnimations(prev => {
                            const newSet = new Set(prev)
                            newSet.delete(tutorialId)
                            return newSet
                        })
                    }, 600)
                }

                // Atualizar estado de likes
                setLikedTutorials(prev => {
                    const newSet = new Set(prev)
                    if (liked) {
                        newSet.add(tutorialId)
                    } else {
                        newSet.delete(tutorialId)
                    }
                    return newSet
                })

                // Atualizar contador local
                setTutoriais(prev => prev.map(t =>
                    t.id === tutorialId ? { ...t, likes: total_likes } : t
                ))

                // Atualizar tutorial selecionado se for o mesmo
                if (tutorialSelecionado?.id === tutorialId) {
                    setTutorialSelecionado(prev => prev ? { ...prev, likes: total_likes } : null)
                }
            }
        } catch (error) {
            console.error('Erro ao alternar like:', error)
        } finally {
            // Remover estado de carregamento
            setLikingInProgress(prev => {
                const newSet = new Set(prev)
                newSet.delete(tutorialId)
                return newSet
            })
        }
    }

    // Abrir tutorial (não registrar visualização aqui, só quando o usuário assistir o vídeo)
    const abrirTutorial = (tutorial: Tutorial) => {
        setTutorialSelecionado(tutorial)
    }

    // Registrar visualização após assistir o vídeo (chamado após fechar o modal)
    const fecharTutorialERegistrarView = () => {
        if (tutorialSelecionado && !viewsRegistered.has(tutorialSelecionado.id)) {
            // Registrar visualização ao fechar o modal (assumindo que o usuário assistiu)
            registrarVisualizacao(tutorialSelecionado.id)
            setViewsRegistered(prev => new Set(prev).add(tutorialSelecionado.id))
        }
        setTutorialSelecionado(null)
    }

    const tutoriaisFiltrados = categoriaFiltro === 'todos'
        ? tutoriais
        : tutoriais.filter(t => t.categoria === categoriaFiltro)

    // Convert YouTube URL to embed URL
    const getEmbedUrl = (url: string): string => {
        // Handle YouTube URLs
        if (url.includes('youtube.com/watch')) {
            const videoId = new URL(url).searchParams.get('v')
            return `https://www.youtube.com/embed/${videoId}`
        }
        if (url.includes('youtu.be/')) {
            const videoId = url.split('youtu.be/')[1]?.split('?')[0]
            return `https://www.youtube.com/embed/${videoId}`
        }
        // Already embed URL or Vimeo
        if (url.includes('/embed/') || url.includes('player.vimeo.com')) {
            return url
        }
        // Handle Vimeo URLs
        if (url.includes('vimeo.com/')) {
            const videoId = url.split('vimeo.com/')[1]?.split('?')[0]
            return `https://player.vimeo.com/video/${videoId}`
        }
        return url
    }

    // Get thumbnail from YouTube URL
    const getThumbnail = (tutorial: Tutorial): string => {
        if (tutorial.thumbnail_url) return tutorial.thumbnail_url

        const url = tutorial.url_video
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            let videoId = ''
            if (url.includes('youtube.com/watch')) {
                videoId = new URL(url).searchParams.get('v') || ''
            } else if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1]?.split('?')[0] || ''
            } else if (url.includes('/embed/')) {
                videoId = url.split('/embed/')[1]?.split('?')[0] || ''
            }
            if (videoId) {
                return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
            }
        }
        return '/placeholder-video.png'
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/80 to-indigo-100">
            <PublicBrandMark />
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="blob blob-1 w-[500px] h-[500px] -top-32 -right-32" />
                <div className="blob blob-2 w-[400px] h-[400px] -bottom-24 -left-24" />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8 pr-14 sm:pr-20">
                    <div className="flex items-center gap-4">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="p-2 rounded-xl bg-white/80 hover:bg-white shadow-sm transition-all"
                            >
                                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 flex items-center gap-3">
                                <span className="text-3xl">📹</span>
                                Tutoriais
                            </h1>
                            <p className="text-slate-500 text-sm mt-1">
                                Aprenda a usar o EduGest Angola
                            </p>
                        </div>
                    </div>

                    {onBack && (
                        <Button
                            variant="ghost"
                            onClick={onBack}
                            className="hidden sm:flex"
                        >
                            ← Voltar ao Login
                        </Button>
                    )}
                </div>

                {/* Category Filter */}
                <div className="mb-8 overflow-x-auto pb-2">
                    <div className="flex gap-2 min-w-max">
                        {CATEGORIAS.map((cat) => (
                            <button
                                key={cat.value}
                                onClick={() => setCategoriaFiltro(cat.value)}
                                className={`px-4 py-2 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${categoriaFiltro === cat.value
                                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/25'
                                    : 'bg-white/80 text-slate-600 hover:bg-white hover:shadow-md'
                                    }`}
                            >
                                <span className="mr-2">{cat.icon}</span>
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600" />
                    </div>
                )}

                {/* Empty State */}
                {!loading && tutoriaisFiltrados.length === 0 && (
                    <Card className="bg-white/80 backdrop-blur-sm">
                        <CardBody className="py-16 text-center">
                            <div className="text-6xl mb-4">📹</div>
                            <h3 className="text-xl font-semibold text-slate-800 mb-2">
                                Nenhum tutorial disponível
                            </h3>
                            <p className="text-slate-500">
                                {categoriaFiltro !== 'todos'
                                    ? 'Não há tutoriais nesta categoria.'
                                    : 'Os tutoriais serão adicionados em breve.'}
                            </p>
                        </CardBody>
                    </Card>
                )}

                {/* Tutorials Grid */}
                {!loading && tutoriaisFiltrados.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tutoriaisFiltrados.map((tutorial) => (
                            <Card
                                key={tutorial.id}
                                className="bg-white/90 backdrop-blur-sm hover:shadow-xl transition-all duration-300 cursor-pointer group overflow-hidden"
                                onClick={() => abrirTutorial(tutorial)}
                            >
                                {/* Thumbnail */}
                                <div className="relative aspect-video bg-slate-100 overflow-hidden">
                                    <img
                                        src={getThumbnail(tutorial)}
                                        alt={tutorial.titulo}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,' + encodeURIComponent(`
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225" fill="none">
                                                    <rect width="400" height="225" fill="#e2e8f0"/>
                                                    <circle cx="200" cy="112" r="40" fill="#cbd5e1"/>
                                                    <path d="M188 92v40l30-20z" fill="#94a3b8"/>
                                                </svg>
                                            `)
                                        }}
                                    />
                                    {/* Play Button Overlay */}
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                            <svg className="w-8 h-8 text-primary-600 ml-1" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M8 5v14l11-7z" />
                                            </svg>
                                        </div>
                                    </div>
                                    {/* Category Badge */}
                                    <div className="absolute top-3 left-3">
                                        <span className="px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-xs font-medium text-slate-700">
                                            {CATEGORIAS.find(c => c.value === tutorial.categoria)?.icon}{' '}
                                            {CATEGORIAS.find(c => c.value === tutorial.categoria)?.label || tutorial.categoria}
                                        </span>
                                    </div>
                                    {/* Stats Badge */}
                                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                                        <span className="px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-xs font-medium text-white flex items-center gap-1">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                            {formatNumber(tutorial.visualizacoes || 0)}
                                        </span>
                                    </div>
                                </div>

                                <CardBody className="p-4">
                                    <h3 className="font-semibold text-slate-800 group-hover:text-primary-600 transition-colors line-clamp-2">
                                        {tutorial.titulo}
                                    </h3>
                                    {tutorial.descricao && (
                                        <p className="text-slate-500 text-sm mt-2 line-clamp-2">
                                            {tutorial.descricao}
                                        </p>
                                    )}
                                    {/* Stats Row */}
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                                        <div className="flex items-center gap-3 text-sm text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                                {formatNumber(tutorial.visualizacoes || 0)}
                                            </span>
                                        </div>
                                        <button
                                            onClick={(e) => toggleLike(e, tutorial.id)}
                                            disabled={likingInProgress.has(tutorial.id)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${likedTutorials.has(tutorial.id)
                                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                } ${likingInProgress.has(tutorial.id) ? 'opacity-70 cursor-wait' : ''}`}
                                        >
                                            {likingInProgress.has(tutorial.id) ? (
                                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            ) : (
                                                <svg
                                                    className={`w-4 h-4 transition-transform ${likedTutorials.has(tutorial.id) ? 'scale-110' : ''} ${likeAnimations.has(tutorial.id) ? 'animate-bounce' : ''}`}
                                                    fill={likedTutorials.has(tutorial.id) ? 'currentColor' : 'none'}
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                                </svg>
                                            )}
                                            {formatNumber(tutorial.likes || 0)}
                                        </button>
                                    </div>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Video Modal */}
                {tutorialSelecionado && (
                    <div
                        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                        onClick={fecharTutorialERegistrarView}
                    >
                        <div
                            className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl animate-scale-in"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-4 border-b border-slate-100">
                                <h3 className="font-semibold text-slate-800 text-lg line-clamp-1">
                                    {tutorialSelecionado.titulo}
                                </h3>
                                <button
                                    onClick={fecharTutorialERegistrarView}
                                    className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Video Player */}
                            <div className="aspect-video bg-black">
                                <iframe
                                    src={getEmbedUrl(tutorialSelecionado.url_video)}
                                    title={tutorialSelecionado.titulo}
                                    className="w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 border-t border-slate-100">
                                {/* Stats and Like Button */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-4 text-sm text-slate-500">
                                        <span className="flex items-center gap-1.5">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                            {formatNumber(tutorialSelecionado.visualizacoes || 0)} visualizações
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                            </svg>
                                            {formatNumber(tutorialSelecionado.likes || 0)} likes
                                        </span>
                                    </div>
                                    <button
                                        onClick={(e) => toggleLike(e, tutorialSelecionado.id)}
                                        disabled={likingInProgress.has(tutorialSelecionado.id)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${likedTutorials.has(tutorialSelecionado.id)
                                            ? 'bg-red-500 text-white hover:bg-red-600'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            } ${likingInProgress.has(tutorialSelecionado.id) ? 'opacity-70 cursor-wait' : ''}`}
                                    >
                                        {likingInProgress.has(tutorialSelecionado.id) ? (
                                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : (
                                            <svg
                                                className={`w-5 h-5 transition-transform ${likedTutorials.has(tutorialSelecionado.id) ? 'scale-110' : ''} ${likeAnimations.has(tutorialSelecionado.id) ? 'animate-bounce' : ''}`}
                                                fill={likedTutorials.has(tutorialSelecionado.id) ? 'currentColor' : 'none'}
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                            </svg>
                                        )}
                                        {likedTutorials.has(tutorialSelecionado.id) ? 'Gostei!' : 'Gostei'}
                                    </button>
                                </div>
                                {/* Description */}
                                {tutorialSelecionado.descricao && (
                                    <p className="text-slate-600 text-sm">
                                        {tutorialSelecionado.descricao}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="relative z-10 text-center py-8 border-t border-slate-200/50">
                <p className="text-slate-500 text-sm">
                    © 2025 EduGest Angola · Sistema de Gestão Escolar
                </p>
            </div>
        </div>
    )
}

export default TutoriaisPublicosPage
