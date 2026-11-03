import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { BlockedSchoolMessage } from '../components/BlockedSchoolMessage'
import type {
    AuthUser,
    UserProfile,
    EscolaProfile,
    ProfessorProfile,
    AlunoProfile,
    EncarregadoProfile,
    SecretarioProfile,
    DirecaoMunicipalProfile,
    TurmaProfessor,
    Escola,
    Professor,
    Aluno,
    Turma,
    Secretario,

    DirecaoMunicipal,
    DirecaoProvincial,
    DirecaoProvincialProfile
} from '../types'

interface AuthContextType {
    user: AuthUser | null
    loading: boolean
    isEscola: boolean
    isProfessor: boolean
    isAluno: boolean
    isEncarregado: boolean
    isSecretario: boolean
    isDirecaoMunicipal: boolean
    isDirecaoProvincial: boolean
    escolaProfile: EscolaProfile | null
    professorProfile: ProfessorProfile | null
    alunoProfile: AlunoProfile | null
    encarregadoProfile: EncarregadoProfile | null
    secretarioProfile: SecretarioProfile | null
    direcaoMunicipalProfile: DirecaoMunicipalProfile | null
    direcaoProvincialProfile: DirecaoProvincialProfile | null
    profile: UserProfile | null  // Added for SUPERADMIN support
    signOut: () => Promise<void>
    refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

interface AuthProviderProps {
    children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<AuthUser | null>(null)
    const [loading, setLoading] = useState(true)
    const [isEscola, setIsEscola] = useState(false)
    const [isProfessor, setIsProfessor] = useState(false)
    const [isAluno, setIsAluno] = useState(false)
    const [isEncarregado, setIsEncarregado] = useState(false)
    const [isSecretario, setIsSecretario] = useState(false)
    const [isDirecaoMunicipal, setIsDirecaoMunicipal] = useState(false)
    const [isDirecaoProvincial, setIsDirecaoProvincial] = useState(false)
    const [escolaProfile, setEscolaProfile] = useState<EscolaProfile | null>(null)
    const [professorProfile, setProfessorProfile] = useState<ProfessorProfile | null>(null)
    const [alunoProfile, setAlunoProfile] = useState<AlunoProfile | null>(null)
    const [encarregadoProfile, setEncarregadoProfile] = useState<EncarregadoProfile | null>(null)
    const [secretarioProfile, setSecretarioProfile] = useState<SecretarioProfile | null>(null)
    const [direcaoMunicipalProfile, setDirecaoMunicipalProfile] = useState<DirecaoMunicipalProfile | null>(null)
    const [direcaoProvincialProfile, setDirecaoProvincialProfile] = useState<DirecaoProvincialProfile | null>(null)

    // Blocked school modal state
    const [showBlockedModal, setShowBlockedModal] = useState(false)
    const [blockedModalData, setBlockedModalData] = useState<{
        reason?: string
        type: 'blocked' | 'inactive' | 'deleted'
        entityType?: 'escola' | 'direcao_municipal'
    }>({ type: 'blocked', entityType: 'escola' })

    // Flag to prevent race conditions between getSession and onAuthStateChange
    // Using useRef instead of useState for synchronous check
    const isLoadingProfileRef = useRef(false)

    const loadUserProfile = async (authUser: User) => {
        // Prevent multiple simultaneous calls (synchronous check)
        if (isLoadingProfileRef.current) {
            console.log('⏳ AuthContext: Profile already loading, skipping duplicate call')
            return
        }
        isLoadingProfileRef.current = true
        console.log('🔍 AuthContext: Loading user profile for:', authUser.id)
        console.log('🔍 AuthContext: Current loading state:', loading)
        try {
            // Get user profile
            console.log('📡 AuthContext: Querying user_profiles table...')

            const { data: profileData, error: profileError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', authUser.id)
                .eq('ativo', true)
                .maybeSingle()

            console.log('📊 AuthContext: Query result:', {
                data: profileData,
                error: profileError,
                errorDetails: profileError ? {
                    message: profileError.message,
                    details: profileError.details,
                    hint: profileError.hint,
                    code: profileError.code
                } : null
            })

            if (profileError) {
                console.error('❌ AuthContext: Error loading user profile:', profileError)
                setUser({
                    id: authUser.id,
                    email: authUser.email || '',
                    profile: null
                })
                isLoadingProfileRef.current = false
                setLoading(false)
                return
            }

            if (!profileData) {
                console.warn('⚠️ AuthContext: No user profile found for user:', authUser.id)
                console.log('🔍 AuthContext: Checking if user is a professor without user_profile...')

                // Try to find professor directly
                const { data: professorData, error: profError } = await supabase
                    .from('professores')
                    .select('*')
                    .eq('user_id', authUser.id)
                    .eq('ativo', true)
                    .maybeSingle()

                if (profError) {
                    console.error('❌ AuthContext: Error checking professor:', profError)
                }

                if (professorData) {
                    console.log('✅ AuthContext: Found professor record, creating minimal profile')
                    // User is a professor but doesn't have user_profile yet
                    setIsProfessor(true)
                    setIsEscola(false)

                    const professor = professorData as Professor
                    const professorProfile: ProfessorProfile = {
                        ...professor,
                        user_profile: null as any,
                        turmas_associadas: []
                    }

                    setProfessorProfile(professorProfile)
                    setUser({
                        id: authUser.id,
                        email: professor.email,
                        profile: null,
                        professor: professorProfile
                    })
                    isLoadingProfileRef.current = false
                    setLoading(false)
                    return
                }

                // Try to find professor by email (in case user_id wasn't linked yet)
                console.log('🔍 AuthContext: Checking professor by email:', authUser.email)
                const { data: professorByEmail, error: profEmailError } = await supabase
                    .from('professores')
                    .select('*')
                    .eq('email', authUser.email)
                    .eq('ativo', true)
                    .maybeSingle()

                if (profEmailError) {
                    console.error('❌ AuthContext: Error checking professor by email:', profEmailError)
                }

                if (professorByEmail) {
                    console.log('✅ AuthContext: Found professor by email, linking user_id...')

                    // Update professor with user_id
                    const { error: updateError } = await supabase
                        .from('professores')
                        .update({ user_id: authUser.id })
                        .eq('id', professorByEmail.id)

                    if (updateError) {
                        console.error('❌ AuthContext: Error linking user_id to professor:', updateError)
                    } else {
                        console.log('✅ AuthContext: Successfully linked user_id to professor')
                    }

                    // Set professor profile
                    setIsProfessor(true)
                    setIsEscola(false)

                    const professor = { ...professorByEmail, user_id: authUser.id } as Professor
                    const professorProfile: ProfessorProfile = {
                        ...professor,
                        user_profile: null as any,
                        turmas_associadas: []
                    }

                    setProfessorProfile(professorProfile)
                    setUser({
                        id: authUser.id,
                        email: professor.email,
                        profile: null,
                        professor: professorProfile
                    })
                    isLoadingProfileRef.current = false
                    setLoading(false)
                    return
                }

                // Try to find aluno directly
                console.log('🔍 AuthContext: Checking if user is an aluno...')
                const { data: alunoData, error: alunoError } = await supabase
                    .from('alunos')
                    .select('*, turmas(id, nome, escola_id, escolas(id, nome, codigo_escola, bloqueado, bloqueado_motivo, ativo))')
                    .eq('user_id', authUser.id)
                    .eq('ativo', true)
                    .maybeSingle()

                if (alunoError) {
                    console.error('❌ AuthContext: Error checking aluno:', alunoError)
                }

                if (alunoData) {
                    console.log('✅ AuthContext: Found aluno record, setting up aluno profile')
                    setIsAluno(true)
                    setIsEscola(false)
                    setIsProfessor(false)
                    setIsEncarregado(false)

                    // Extract escola from turma relation
                    const turmaData = alunoData.turmas as { id: string; nome: string; escola_id: string; escolas?: { id: string; nome: string; codigo_escola?: string; bloqueado?: boolean; bloqueado_motivo?: string; ativo?: boolean } } | null
                    const escolaData = turmaData?.escolas || null

                    // Check if escola was deleted (not found)
                    if (!escolaData) {
                        console.warn('🗑️ AuthContext: Escola not found for aluno - may have been deleted')
                        setBlockedModalData({
                            reason: 'A escola associada à sua conta de aluno foi eliminada do sistema. Contacte o suporte para mais informações.',
                            type: 'deleted'
                        })
                        setShowBlockedModal(true)
                        await supabase.auth.signOut()
                        setUser(null)
                        isLoadingProfileRef.current = false
                        setLoading(false)
                        return
                    }

                    // Check if escola is blocked or inactive
                    if (escolaData.bloqueado) {
                        console.error('🚫 AuthContext: Escola is blocked:', escolaData.bloqueado_motivo)
                        setBlockedModalData({
                            reason: escolaData.bloqueado_motivo || undefined,
                            type: 'blocked'
                        })
                        setShowBlockedModal(true)
                        await supabase.auth.signOut()
                        setUser(null)
                        isLoadingProfileRef.current = false
                        setLoading(false)
                        return
                    }

                    if (escolaData.ativo === false) {
                        console.warn('⚠️ AuthContext: Escola is inactive')
                        setBlockedModalData({
                            reason: undefined,
                            type: 'inactive'
                        })
                        setShowBlockedModal(true)
                        await supabase.auth.signOut()
                        setUser(null)
                        isLoadingProfileRef.current = false
                        setLoading(false)
                        return
                    }

                    // Create inline aluno profile with escola
                    const alunoProfile = {
                        ...alunoData,
                        turma: turmaData ? { id: turmaData.id, nome: turmaData.nome, escola_id: turmaData.escola_id } : undefined,
                        escola: escolaData,
                        user_profile: null as any
                    }

                    setAlunoProfile(alunoProfile)
                    setUser({
                        id: authUser.id,
                        email: authUser.email || '',
                        profile: null,
                        aluno: alunoProfile
                    })
                    isLoadingProfileRef.current = false
                    setLoading(false)
                    return
                }

                // Try to find encarregado (user associated with a student as guardian)
                // NOTE: Check encarregado even if user is an aluno - they might be both!
                console.log('🔍 AuthContext: Checking if user is an encarregado...')
                const { data: encarregadoData, error: encarregadoError } = await supabase
                    .from('alunos')
                    .select('*, turmas(id, nome, escola_id, escolas(*))')
                    .eq('encarregado_user_id', authUser.id)
                    .eq('ativo', true)

                if (encarregadoError) {
                    console.error('❌ AuthContext: Error checking encarregado:', encarregadoError)
                }

                if (encarregadoData && encarregadoData.length > 0) {
                    console.log('✅ AuthContext: Found encarregado association, setting up encarregado profile')
                    setIsEncarregado(true)
                    setIsEscola(false)
                    setIsProfessor(false)
                    setIsAluno(false)

                    // Extract escola from first aluno's turma
                    const firstAlunoTurma = encarregadoData[0]?.turmas as { id: string; nome: string; escola_id: string; escolas?: Escola } | null
                    const escolaData = (firstAlunoTurma?.escolas as Escola) || null

                    // Check if escola was deleted (not found)
                    if (!escolaData) {
                        console.warn('🗑️ AuthContext: Escola not found for encarregado - may have been deleted')
                        setBlockedModalData({
                            reason: 'A escola associada à conta do seu educando foi eliminada do sistema. Contacte o suporte para mais informações.',
                            type: 'deleted'
                        })
                        setShowBlockedModal(true)
                        await supabase.auth.signOut()
                        setUser(null)
                        isLoadingProfileRef.current = false
                        setLoading(false)
                        return
                    }

                    // Check if escola is blocked or inactive
                    if (escolaData.bloqueado) {
                        console.error('🚫 AuthContext: Escola is blocked:', escolaData.bloqueado_motivo)
                        setBlockedModalData({
                            reason: escolaData.bloqueado_motivo || undefined,
                            type: 'blocked'
                        })
                        setShowBlockedModal(true)
                        await supabase.auth.signOut()
                        setUser(null)
                        isLoadingProfileRef.current = false
                        setLoading(false)
                        return
                    }

                    if (escolaData.ativo === false) {
                        console.warn('⚠️ AuthContext: Escola is inactive')
                        setBlockedModalData({
                            reason: undefined,
                            type: 'inactive'
                        })
                        setShowBlockedModal(true)
                        await supabase.auth.signOut()
                        setUser(null)
                        isLoadingProfileRef.current = false
                        setLoading(false)
                        return
                    }

                    // Create inline encarregado profile with escola
                    const encarregadoProfile: EncarregadoProfile = {
                        alunos_associados: encarregadoData.map((aluno: any) => {
                            const turmaData = aluno.turmas as { id: string; nome: string; escola_id: string; escolas?: Escola } | null
                            return {
                                ...aluno,
                                turma: turmaData ? { id: turmaData.id, nome: turmaData.nome, escola_id: turmaData.escola_id } : undefined,
                                escola: turmaData?.escolas,
                                user_profile: null as any
                            }
                        }),
                        escola: escolaData,
                        user_profile: null as any
                    }

                    setEncarregadoProfile(encarregadoProfile)
                    setUser({
                        id: authUser.id,
                        email: authUser.email || '',
                        profile: null,
                        encarregado: encarregadoProfile
                    })
                    isLoadingProfileRef.current = false
                    setLoading(false)
                    return
                }

                // Try to find secretario directly (similar to professor fallback)
                console.log('🔍 AuthContext: Checking if user is a secretario...')
                const { data: secretarioData, error: secretarioError } = await supabase
                    .from('secretarios')
                    .select('*, escola:escolas(*)')
                    .eq('user_id', authUser.id)
                    .eq('ativo', true)
                    .maybeSingle()

                if (secretarioError) {
                    console.error('❌ AuthContext: Error checking secretario:', secretarioError)
                }

                if (secretarioData) {
                    console.log('✅ AuthContext: Found secretario record, creating profile')

                    // Create user_profile if it doesn't exist
                    const { error: profileCreateError } = await supabase
                        .from('user_profiles')
                        .upsert({
                            user_id: authUser.id,
                            tipo_perfil: 'SECRETARIO',
                            escola_id: secretarioData.escola_id,
                            ativo: true
                        }, { onConflict: 'user_id' })

                    if (profileCreateError) {
                        console.error('❌ AuthContext: Error creating user_profile for secretario:', profileCreateError)
                    }

                    setIsSecretario(true)
                    setIsEscola(false)
                    setIsProfessor(false)
                    setIsAluno(false)
                    setIsEncarregado(false)

                    const secretarioProfile = {
                        ...secretarioData,
                        user_profile: null as any,
                        escola: secretarioData.escola
                    }

                    setSecretarioProfile(secretarioProfile)
                    setUser({
                        id: authUser.id,
                        email: secretarioData.email,
                        profile: null,
                        secretario: secretarioProfile
                    })
                    isLoadingProfileRef.current = false
                    setLoading(false)
                    return
                }

                // Check for inactive DIRECAO_PROVINCIAL (pending approval)
                console.log('🔍 AuthContext: Checking for inactive DIRECAO_PROVINCIAL profile...')
                const { data: inactiveProfileData } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('user_id', authUser.id)
                    .eq('tipo_perfil', 'DIRECAO_PROVINCIAL')
                    .eq('ativo', false)
                    .maybeSingle()

                if (inactiveProfileData) {
                    console.warn('⏳ AuthContext: Found inactive DIRECAO_PROVINCIAL profile - pending approval')
                    setBlockedModalData({
                        reason: 'O seu registo como Direção Provincial está pendente de aprovação. Será notificado quando o acesso for activado.',
                        type: 'inactive',
                        entityType: 'direcao_municipal'
                    })
                    setShowBlockedModal(true)
                    await supabase.auth.signOut()
                    setUser(null)
                    isLoadingProfileRef.current = false
                    setLoading(false)
                    return
                }

                // No profile found at all
                console.warn('⚠️ AuthContext: User has no profile in any table')
                console.log('🔄 AuthContext: Clearing invalid session...')

                // Clear the session since this user has no valid profile
                await supabase.auth.signOut()

                setUser(null)
                isLoadingProfileRef.current = false
                setLoading(false)
                return
            }

            console.log('✅ AuthContext: User profile loaded:', profileData)
            const profile = profileData as UserProfile

            // Set role flags
            setIsEscola(profile.tipo_perfil === 'ESCOLA')
            setIsProfessor(profile.tipo_perfil === 'PROFESSOR')
            setIsAluno(profile.tipo_perfil === 'ALUNO')
            setIsEncarregado(profile.tipo_perfil === 'ENCARREGADO')
            setIsSecretario(profile.tipo_perfil === 'SECRETARIO')
            setIsDirecaoMunicipal(profile.tipo_perfil === 'DIRECAO_MUNICIPAL')
            setIsDirecaoProvincial(profile.tipo_perfil === 'DIRECAO_PROVINCIAL')

            // Handle SUPERADMIN separately (no escola_id required)
            if (profile.tipo_perfil === 'SUPERADMIN') {
                console.log('👑 AuthContext: SUPERADMIN user detected')
                setUser({
                    id: authUser.id,
                    email: authUser.email || '',
                    profile
                })
                console.log('✅ AuthContext: SUPERADMIN profile set successfully')
                isLoadingProfileRef.current = false
                setLoading(false)
                return
            }

            // Load specific profile data based on role
            if (profile.tipo_perfil === 'ESCOLA') {
                console.log('🏫 AuthContext: Loading escola profile...')
                await loadEscolaProfile(authUser.id, profile)
            } else if (profile.tipo_perfil === 'PROFESSOR') {
                console.log('👨‍🏫 AuthContext: Loading professor profile...')
                await loadProfessorProfile(authUser.id, profile)
            } else if (profile.tipo_perfil === 'ALUNO') {
                console.log('🎓 AuthContext: Loading aluno profile...')
                await loadAlunoProfile(authUser.id, profile)
            } else if (profile.tipo_perfil === 'ENCARREGADO') {
                console.log('👨‍👩‍👧 AuthContext: Loading encarregado profile...')
                await loadEncarregadoProfile(authUser.id, profile)
            } else if (profile.tipo_perfil === 'SECRETARIO') {
                console.log('📋 AuthContext: Loading secretario profile...')
                await loadSecretarioProfile(authUser.id, profile)
            } else if (profile.tipo_perfil === 'DIRECAO_MUNICIPAL') {
                console.log('🏛️ AuthContext: Loading direção municipal profile...')
                await loadDirecaoMunicipalProfile(authUser.id, profile)
            } else if (profile.tipo_perfil === 'DIRECAO_PROVINCIAL') {
                console.log('🏛️ AuthContext: Loading direção provincial profile...')
                await loadDirecaoProvincialProfile(authUser.id, profile)
            }

            // CRITICAL: Always set loading to false, even if profile loading fails
            console.log('✅ AuthContext: Profile loading complete, setting loading=false')
            isLoadingProfileRef.current = false
            setLoading(false)

        } catch (error) {
            console.error('❌ AuthContext: Unexpected error in loadUserProfile:', error)
            setUser({
                id: authUser.id,
                email: authUser.email || '',
                profile: null
            })
            // CRITICAL: Always set loading to false
            isLoadingProfileRef.current = false
            setLoading(false)
        }
    }

    const loadEscolaProfile = async (userId: string, profile: UserProfile) => {
        try {
            // Safety check: if escola_id is null, skip loading escola data
            if (!profile.escola_id) {
                console.warn('⚠️ AuthContext: escola_id is null, skipping escola profile load')
                setUser({
                    id: userId,
                    email: profile.user_id || '',
                    profile
                })
                return
            }

            console.log('🏫 AuthContext: Fetching escola data for escola_id:', profile.escola_id)
            // Get escola data
            const { data: escolaData, error: escolaError } = await supabase
                .from('escolas')
                .select('*')
                .eq('id', profile.escola_id)
                .maybeSingle()

            if (escolaError) {
                console.error('❌ AuthContext: Error loading escola:', escolaError)
                // Set minimal user data even if escola loading fails
                setUser({
                    id: userId,
                    email: profile.user_id || '',
                    profile
                })
                return
            }

            if (!escolaData) {
                console.warn('⚠️ AuthContext: No escola found for escola_id:', profile.escola_id)
                console.warn('🗑️ AuthContext: Escola may have been deleted')
                // Escola was deleted - show deleted modal
                setBlockedModalData({
                    reason: 'A escola associada à sua conta foi eliminada do sistema. Contacte o suporte para mais informações.',
                    type: 'deleted'
                })
                setShowBlockedModal(true)
                await supabase.auth.signOut()
                setUser(null)
                isLoadingProfileRef.current = false
                setLoading(false)
                return
            }

            console.log('✅ AuthContext: Escola data loaded:', escolaData)
            const escola = escolaData as Escola

            // Check if escola is blocked
            if (escola.bloqueado) {
                console.error('🚫 AuthContext: Escola is blocked:', escola.bloqueado_motivo)
                setBlockedModalData({
                    reason: escola.bloqueado_motivo || undefined,
                    type: 'blocked'
                })
                setShowBlockedModal(true)
                await supabase.auth.signOut()
                setUser(null)
                isLoadingProfileRef.current = false
                setLoading(false)
                return
            }

            // Check if escola is inactive
            if (!escola.ativo) {
                console.warn('⚠️ AuthContext: Escola is inactive')
                setBlockedModalData({
                    reason: undefined,
                    type: 'inactive'
                })
                setShowBlockedModal(true)
                await supabase.auth.signOut()
                setUser(null)
                isLoadingProfileRef.current = false
                setLoading(false)
                return
            }
            const escolaProfile: EscolaProfile = {
                ...escola,
                user_profile: profile
            }

            setEscolaProfile(escolaProfile)
            setUser({
                id: userId,
                email: escola.email || '',
                profile,
                escola: escolaProfile
            })
            console.log('✅ AuthContext: Escola profile set successfully')

        } catch (error) {
            console.error('❌ AuthContext: Unexpected error in loadEscolaProfile:', error)
            // Set minimal user data even on unexpected error
            setUser({
                id: userId,
                email: profile.user_id || '',
                profile
            })
        }
    }

    const loadProfessorProfile = async (userId: string, profile: UserProfile) => {
        try {
            console.log('👨‍🏫 AuthContext: Fetching professor data for user_id:', userId)
            // Get professor data
            const { data: professorData, error: professorError } = await supabase
                .from('professores')
                .select('*')
                .eq('user_id', userId)
                .eq('ativo', true)
                .maybeSingle()

            if (professorError) {
                console.error('❌ AuthContext: Error loading professor:', professorError)
                // Set minimal user data even if professor loading fails
                setUser({
                    id: userId,
                    email: profile.user_id || '',
                    profile
                })
                return
            }

            if (!professorData) {
                console.warn('⚠️ AuthContext: No professor found for user_id:', userId)
                setUser({
                    id: userId,
                    email: profile.user_id || '',
                    profile
                })
                return
            }

            console.log('✅ AuthContext: Professor data loaded:', professorData)
            const professor = professorData as Professor

            // Get escola data
            console.log('🏫 AuthContext: Fetching escola data for escola_id:', professor.escola_id)
            const { data: escolaData, error: escolaError } = await supabase
                .from('escolas')
                .select('*')
                .eq('id', professor.escola_id)
                .maybeSingle()

            if (escolaError) {
                console.warn('⚠️ AuthContext: Error loading escola for professor:', escolaError)
            }

            const escola = escolaData ? (escolaData as Escola) : undefined

            // Check if escola was deleted (not found)
            if (!escola) {
                console.warn('🗑️ AuthContext: Escola not found - may have been deleted')
                setBlockedModalData({
                    reason: 'A escola associada à sua conta de professor foi eliminada do sistema. Contacte o suporte para mais informações.',
                    type: 'deleted'
                })
                setShowBlockedModal(true)
                await supabase.auth.signOut()
                setUser(null)
                isLoadingProfileRef.current = false
                setLoading(false)
                return
            }

            // Check if escola is blocked or inactive
            console.log('✅ AuthContext: Escola data loaded:', escola.nome)

            if (escola.bloqueado) {
                console.error('🚫 AuthContext: Escola is blocked:', escola.bloqueado_motivo)
                setBlockedModalData({
                    reason: escola.bloqueado_motivo || undefined,
                    type: 'blocked'
                })
                setShowBlockedModal(true)
                await supabase.auth.signOut()
                setUser(null)
                isLoadingProfileRef.current = false
                setLoading(false)
                return
            }

            if (!escola.ativo) {
                console.warn('⚠️ AuthContext: Escola is inactive')
                setBlockedModalData({
                    reason: undefined,
                    type: 'inactive'
                })
                setShowBlockedModal(true)
                await supabase.auth.signOut()
                setUser(null)
                isLoadingProfileRef.current = false
                setLoading(false)
                return
            }

            // Get turmas associadas (may fail due to RLS, that's OK)
            console.log('📚 AuthContext: Fetching turmas associadas...')
            console.log('📚 AuthContext: Professor ID:', professor.id)

            const { data: turmasData, error: turmasError } = await supabase
                .from('turma_professores')
                .select(`
                    *,
                    turma:turmas(*),
                    disciplina:disciplinas(*)
                `)
                .eq('professor_id', professor.id)

            console.log('📊 AuthContext: Turmas query result:', {
                data: turmasData,
                error: turmasError,
                errorDetails: turmasError ? {
                    message: turmasError.message,
                    details: turmasError.details,
                    hint: turmasError.hint,
                    code: turmasError.code
                } : null
            })

            if (turmasError) {
                console.warn('⚠️ AuthContext: Error loading turmas associadas:', turmasError)
                console.warn('⚠️ AuthContext: This may be due to RLS policies or missing associations')
            }

            const turmasAssociadas = (turmasData || []) as TurmaProfessor[]
            console.log('✅ AuthContext: Loaded', turmasAssociadas.length, 'turmas associadas')

            if (turmasAssociadas.length === 0) {
                console.warn('⚠️ AuthContext: No turmas associadas found for professor')
                console.warn('⚠️ AuthContext: This professor may need to be associated with turmas via admin panel')
            }

            const professorProfile: ProfessorProfile = {
                ...professor,
                user_profile: profile,
                turmas_associadas: turmasAssociadas,
                escola
            }

            setProfessorProfile(professorProfile)
            setUser({
                id: userId,
                email: professor.email,
                profile,
                professor: professorProfile
            })
            console.log('✅ AuthContext: Professor profile set successfully')

        } catch (error) {
            console.error('❌ AuthContext: Unexpected error in loadProfessorProfile:', error)
            // Set minimal user data even on unexpected error
            setUser({
                id: userId,
                email: profile.user_id || '',
                profile
            })
        }
    }

    const loadAlunoProfile = async (userId: string, profile: UserProfile) => {
        try {
            console.log('🎓 AuthContext: Fetching aluno data for user_id:', userId)
            // Get aluno data linked to this user
            const { data: alunoData, error: alunoError } = await supabase
                .from('alunos')
                .select(`
                    *,
                    turma:turmas(
                        *,
                        escola:escolas(*)
                    )
                `)
                .eq('user_id', userId)
                .eq('ativo', true)
                .maybeSingle()

            if (alunoError) {
                console.error('❌ AuthContext: Error loading aluno:', alunoError)
                setUser({
                    id: userId,
                    email: profile.user_id || '',
                    profile
                })
                return
            }

            if (!alunoData) {
                console.warn('⚠️ AuthContext: No aluno found for user_id:', userId)
                setUser({
                    id: userId,
                    email: profile.user_id || '',
                    profile
                })
                return
            }

            console.log('✅ AuthContext: Aluno data loaded:', alunoData)
            const aluno = alunoData as Aluno & { turma: Turma & { escola: Escola } }

            // Check if escola is blocked or inactive
            if (aluno.turma?.escola) {
                if (aluno.turma.escola.bloqueado) {
                    console.error('🚫 AuthContext: Escola is blocked:', aluno.turma.escola.bloqueado_motivo)
                    setBlockedModalData({
                        reason: aluno.turma.escola.bloqueado_motivo || undefined,
                        type: 'blocked'
                    })
                    setShowBlockedModal(true)
                    await supabase.auth.signOut()
                    setUser(null)
                    isLoadingProfileRef.current = false
                    setLoading(false)
                    return
                }

                if (!aluno.turma.escola.ativo) {
                    console.warn('⚠️ AuthContext: Escola is inactive')
                    setBlockedModalData({
                        reason: undefined,
                        type: 'inactive'
                    })
                    setShowBlockedModal(true)
                    await supabase.auth.signOut()
                    setUser(null)
                    isLoadingProfileRef.current = false
                    setLoading(false)
                    return
                }
            }

            // Build aluno profile
            const alunoProfileData: AlunoProfile = {
                ...aluno,
                user_profile: profile,
                turma: aluno.turma,
                escola: aluno.turma?.escola
            }

            setAlunoProfile(alunoProfileData)
            setUser({
                id: userId,
                email: alunoData.email_encarregado || profile.user_id || '',
                profile,
                aluno: alunoProfileData
            })
            console.log('✅ AuthContext: Aluno profile set successfully')

        } catch (error) {
            console.error('❌ AuthContext: Unexpected error in loadAlunoProfile:', error)
            setUser({
                id: userId,
                email: profile.user_id || '',
                profile
            })
        }
    }

    const loadEncarregadoProfile = async (userId: string, profile: UserProfile) => {
        try {
            console.log('👨‍👩‍👧 AuthContext: Fetching encarregado data for user_id:', userId)
            // Get all alunos linked to this guardian
            const { data: alunosData, error: alunosError } = await supabase
                .from('alunos')
                .select(`
                    *,
                    turma:turmas(
                        *,
                        escola:escolas(*)
                    )
                `)
                .eq('encarregado_user_id', userId)
                .eq('ativo', true)

            if (alunosError) {
                console.error('❌ AuthContext: Error loading alunos for encarregado:', alunosError)
                setUser({
                    id: userId,
                    email: profile.user_id || '',
                    profile
                })
                return
            }

            if (!alunosData || alunosData.length === 0) {
                console.warn('⚠️ AuthContext: No alunos found for encarregado user_id:', userId)
                setUser({
                    id: userId,
                    email: profile.user_id || '',
                    profile
                })
                return
            }

            console.log('✅ AuthContext: Encarregado alunos loaded:', alunosData.length, 'students')

            // Build aluno profiles for associated students
            const alunosAssociados: AlunoProfile[] = alunosData.map((a: any) => ({
                ...a,
                user_profile: profile,
                turma: a.turma,
                escola: a.turma?.escola
            }))

            // Get escola from first aluno
            const escola = alunosAssociados[0]?.escola

            // Check if escola is blocked or inactive
            if (escola) {
                if (escola.bloqueado) {
                    console.error('🚫 AuthContext: Escola is blocked:', escola.bloqueado_motivo)
                    setBlockedModalData({
                        reason: escola.bloqueado_motivo || undefined,
                        type: 'blocked'
                    })
                    setShowBlockedModal(true)
                    await supabase.auth.signOut()
                    setUser(null)
                    isLoadingProfileRef.current = false
                    setLoading(false)
                    return
                }

                if (!escola.ativo) {
                    console.warn('⚠️ AuthContext: Escola is inactive')
                    setBlockedModalData({
                        reason: undefined,
                        type: 'inactive'
                    })
                    setShowBlockedModal(true)
                    await supabase.auth.signOut()
                    setUser(null)
                    isLoadingProfileRef.current = false
                    setLoading(false)
                    return
                }
            }

            const encarregadoProfileData: EncarregadoProfile = {
                user_profile: profile,
                alunos_associados: alunosAssociados,
                escola
            }

            setEncarregadoProfile(encarregadoProfileData)
            setUser({
                id: userId,
                email: profile.user_id || '',
                profile,
                encarregado: encarregadoProfileData
            })
            console.log('✅ AuthContext: Encarregado profile set successfully')

        } catch (error) {
            console.error('❌ AuthContext: Unexpected error in loadEncarregadoProfile:', error)
            setUser({
                id: userId,
                email: profile.user_id || '',
                profile
            })
        }
    }

    const loadSecretarioProfile = async (userId: string, profile: UserProfile) => {
        try {
            console.log('📋 AuthContext: Fetching secretario data for user_id:', userId)
            // Get secretario data linked to this user
            const { data: secretarioData, error: secretarioError } = await supabase
                .from('secretarios')
                .select(`
                    *,
                    escola:escolas(*)
                `)
                .eq('user_id', userId)
                .eq('ativo', true)
                .maybeSingle()

            if (secretarioError) {
                console.error('❌ AuthContext: Error loading secretario:', secretarioError)
                setUser({
                    id: userId,
                    email: profile.user_id || '',
                    profile
                })
                return
            }

            if (!secretarioData) {
                console.warn('⚠️ AuthContext: No secretario found for user_id:', userId)
                setUser({
                    id: userId,
                    email: profile.user_id || '',
                    profile
                })
                return
            }

            console.log('✅ AuthContext: Secretario data loaded:', secretarioData)
            const secretario = secretarioData as Secretario & { escola: Escola }

            // Check if escola was deleted (not found)
            if (!secretario.escola) {
                console.warn('🗑️ AuthContext: Escola not found for secretario - may have been deleted')
                setBlockedModalData({
                    reason: 'A escola associada à sua conta de secretário foi eliminada do sistema. Contacte o suporte para mais informações.',
                    type: 'deleted'
                })
                setShowBlockedModal(true)
                await supabase.auth.signOut()
                setUser(null)
                isLoadingProfileRef.current = false
                setLoading(false)
                return
            }

            // Check if escola is blocked or inactive
            console.log('✅ AuthContext: Escola data loaded:', secretario.escola.nome)

            if (secretario.escola.bloqueado) {
                console.error('🚫 AuthContext: Escola is blocked:', secretario.escola.bloqueado_motivo)
                setBlockedModalData({
                    reason: secretario.escola.bloqueado_motivo || undefined,
                    type: 'blocked'
                })
                setShowBlockedModal(true)
                await supabase.auth.signOut()
                setUser(null)
                isLoadingProfileRef.current = false
                setLoading(false)
                return
            }

            if (!secretario.escola.ativo) {
                console.warn('⚠️ AuthContext: Escola is inactive')
                setBlockedModalData({
                    reason: undefined,
                    type: 'inactive'
                })
                setShowBlockedModal(true)
                await supabase.auth.signOut()
                setUser(null)
                isLoadingProfileRef.current = false
                setLoading(false)
                return
            }

            // Resolve staff cargo (Director Pedagógico / Administrativo / Técnico)
            // Prefer secretarios.cargo; fallback to funcionarios_escola.subcategoria by email
            let resolvedCargo = (secretario as Secretario).cargo
            if (!resolvedCargo && secretario.email) {
                const { data: funcRow } = await supabase
                    .from('funcionarios_escola')
                    .select('subcategoria')
                    .eq('escola_id', secretario.escola_id)
                    .eq('email', secretario.email)
                    .maybeSingle()
                const sub = funcRow?.subcategoria
                if (
                    sub === 'DIRECTOR_PEDAGOGICO' ||
                    sub === 'DIRECTOR_ADMINISTRATIVO' ||
                    sub === 'TECNICO_SECRETARIA' ||
                    sub === 'SECRETARIO'
                ) {
                    resolvedCargo = sub === 'SECRETARIO' ? 'TECNICO_SECRETARIA' : sub
                }
            }
            if (!resolvedCargo) {
                resolvedCargo = 'TECNICO_SECRETARIA'
            }

            // Build secretario profile
            const secretarioProfileData: SecretarioProfile = {
                ...secretario,
                cargo: resolvedCargo,
                user_profile: profile,
                escola: secretario.escola
            }

            setSecretarioProfile(secretarioProfileData)
            setUser({
                id: userId,
                email: secretario.email || profile.user_id || '',
                profile,
                secretario: secretarioProfileData
            })
            console.log('✅ AuthContext: Secretario profile set successfully', { cargo: resolvedCargo })

        } catch (error) {
            console.error('❌ AuthContext: Unexpected error in loadSecretarioProfile:', error)
            setUser({
                id: userId,
                email: profile.user_id || '',
                profile
            })
        }
    }

    const loadDirecaoMunicipalProfile = async (userId: string, profile: UserProfile) => {
        try {
            console.log('🏛️ AuthContext: Fetching direção municipal data for user_id:', userId)

            // First, check if there's ANY direcao municipal record (active or not)
            const { data: anyDirecaoData, error: anyDirecaoError } = await supabase
                .from('direcoes_municipais')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle()

            if (anyDirecaoError) {
                console.error('❌ AuthContext: Error loading direção municipal:', anyDirecaoError)
                setUser({
                    id: userId,
                    email: profile.user_id || '',
                    profile
                })
                return
            }

            // Check if direcao municipal exists but is inactive (pending/rejected)
            if (anyDirecaoData && !anyDirecaoData.ativo) {
                console.warn('⏳ AuthContext: Direção Municipal is inactive/pending')
                setBlockedModalData({
                    reason: 'O seu registo como Direção Municipal está pendente de aprovação. Será notificado quando o acesso for activado.',
                    type: 'inactive',
                    entityType: 'direcao_municipal'
                })
                setShowBlockedModal(true)
                await supabase.auth.signOut()
                setUser(null)
                return
            }

            if (!anyDirecaoData) {
                console.warn('⚠️ AuthContext: No direção municipal found for user_id:', userId)
                // Profile exists as DIRECAO_MUNICIPAL but no record in direcoes_municipais - deleted?
                setBlockedModalData({
                    reason: 'O seu registo como Direção Municipal foi removido do sistema. Contacte o suporte para mais informações.',
                    type: 'deleted',
                    entityType: 'direcao_municipal'
                })
                setShowBlockedModal(true)
                await supabase.auth.signOut()
                setUser(null)
                return
            }

            const direcaoData = anyDirecaoData

            console.log('✅ AuthContext: Direção municipal data loaded:', direcaoData)
            const direcao = direcaoData as DirecaoMunicipal

            // Count escolas in the municipality
            const { count: escolasCount } = await supabase
                .from('escolas')
                .select('*', { count: 'exact', head: true })
                .eq('municipio', direcao.municipio)

            // Build direção municipal profile
            const direcaoProfile: DirecaoMunicipalProfile = {
                ...direcao,
                user_profile: profile,
                escolas_count: escolasCount || 0
            }

            setDirecaoMunicipalProfile(direcaoProfile)
            setUser({
                id: userId,
                email: direcao.email || profile.user_id || '',
                profile,
                direcaoMunicipal: direcaoProfile
            })
            console.log('✅ AuthContext: Direção municipal profile set successfully')

        } catch (error) {
            console.error('❌ AuthContext: Unexpected error in loadDirecaoMunicipalProfile:', error)
            setUser({
                id: userId,
                email: profile.user_id || '',
                profile
            })
        }
    }

    const loadDirecaoProvincialProfile = async (userId: string, profile: UserProfile) => {
        try {
            console.log('🏛️ AuthContext: Fetching direção provincial data for user_id:', userId)

            const { data: direcaoData, error: direcaoError } = await supabase
                .from('direcoes_provinciais')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle()

            if (direcaoError) {
                console.error('❌ AuthContext: Error loading direção provincial:', direcaoError)
                setUser({
                    id: userId,
                    email: profile.user_id || '',
                    profile
                })
                return
            }

            // Check if direcao provincial exists but is inactive (pending/rejected)
            if (direcaoData && !direcaoData.ativo) {
                console.warn('⏳ AuthContext: Direção Provincial is inactive/pending')
                setBlockedModalData({
                    reason: 'O seu registo como Direção Provincial está pendente de aprovação. Será notificado quando o acesso for activado.',
                    type: 'inactive',
                    entityType: 'direcao_municipal' // Reuse existing type style for now
                })
                setShowBlockedModal(true)
                await supabase.auth.signOut()
                setUser(null)
                return
            }

            if (direcaoError) {
                console.error('❌ AuthContext: Error loading direção provincial:', direcaoError)
                setUser({
                    id: userId,
                    email: profile.user_id || '',
                    profile
                })
                return
            }

            if (!direcaoData) {
                console.warn('⚠️ AuthContext: No direção provincial found for user_id:', userId)
                // Profile exists but no record
                setBlockedModalData({
                    reason: 'O seu registo como Direção Provincial foi removido do sistema.',
                    type: 'deleted',
                    entityType: 'direcao_municipal' // Reuse modal type for now or add new one
                })
                setShowBlockedModal(true)
                await supabase.auth.signOut()
                setUser(null)
                return
            }

            const direcao = direcaoData as DirecaoProvincial

            // For now, we don't have a direct "escolas_count" for province in the profile type
            // but we can add it or just ignore. The types/index.ts definition of DirecaoProvincialProfile
            // extends DirecaoProvincial. Let's check if it has extra fields.
            // Based on previous grep, it just extends. I'll stick to the base data + user_profile.

            const direcaoProfile: DirecaoProvincialProfile = {
                ...direcao,
                user_profile: profile
            }

            setDirecaoProvincialProfile(direcaoProfile)
            setUser({
                id: userId,
                email: direcao.email || profile.user_id || '',
                profile,
                direcaoProvincial: direcaoProfile
            })
            console.log('✅ AuthContext: Direção provincial profile set successfully')

        } catch (error) {
            console.error('❌ AuthContext: Unexpected error in loadDirecaoProvincialProfile:', error)
            setUser({
                id: userId,
                email: profile.user_id || '',
                profile
            })
        }
    }

    const refreshProfile = async () => {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
            await loadUserProfile(authUser)
        }
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        setUser(null)
        setIsEscola(false)
        setIsProfessor(false)
        setIsAluno(false)
        setIsEncarregado(false)
        setIsSecretario(false)
        setIsDirecaoMunicipal(false)
        setIsDirecaoProvincial(false)
        setEscolaProfile(null)
        setProfessorProfile(null)
        setAlunoProfile(null)
        setEncarregadoProfile(null)
        setSecretarioProfile(null)
        setDirecaoMunicipalProfile(null)
        setDirecaoProvincialProfile(null)
    }

    useEffect(() => {
        // Flag to track if initial auth check is complete
        let initialAuthChecked = false

        // Safety timeout: never let loading stay true for more than 10 seconds
        const safetyTimeout = setTimeout(() => {
            setLoading(prevLoading => {
                if (prevLoading) {
                    console.warn('⏰ AuthContext: Safety timeout triggered! Setting loading=false after 10 seconds')
                    isLoadingProfileRef.current = false
                    return false
                }
                return prevLoading
            })
        }, 10000)

        console.log('🚀 AuthContext: Starting initial auth check...')

        // Check active session (this handles the initial load)
        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('📋 AuthContext: getSession result:', session ? 'Session found' : 'No session')
            initialAuthChecked = true

            if (session?.user) {
                loadUserProfile(session.user)
            } else {
                console.log('✅ AuthContext: No session, setting loading=false immediately')
                setLoading(false)
            }
        }).catch((error) => {
            console.error('❌ AuthContext: Error getting session:', error)
            initialAuthChecked = true
            setLoading(false)
        })

        // Listen for auth changes (only for CHANGES after initial load)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('🔔 AuthContext: onAuthStateChange event:', event, 'initialAuthChecked:', initialAuthChecked)

                // Skip the initial event since getSession already handles it
                if (!initialAuthChecked) {
                    console.log('⏭️ AuthContext: Skipping initial auth event (handled by getSession)')
                    return
                }

                // Only process actual changes (sign in/out)
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    if (session?.user) {
                        // Reset the loading flag so we can reload profile
                        isLoadingProfileRef.current = false
                        await loadUserProfile(session.user)
                    }
                } else if (event === 'SIGNED_OUT') {
                    setUser(null)
                    setIsEscola(false)
                    setIsProfessor(false)
                    setIsAluno(false)
                    setIsEncarregado(false)
                    setEscolaProfile(null)
                    setProfessorProfile(null)
                    setAlunoProfile(null)
                    setEncarregadoProfile(null)
                    isLoadingProfileRef.current = false
                    setLoading(false)
                }
            }
        )

        return () => {
            clearTimeout(safetyTimeout)
            subscription.unsubscribe()
        }
    }, [])

    const value: AuthContextType = {
        user,
        loading,
        isEscola,
        isProfessor,
        isAluno,
        isEncarregado,
        isSecretario,
        isDirecaoMunicipal,
        isDirecaoProvincial,
        escolaProfile,
        professorProfile,
        alunoProfile,
        encarregadoProfile,
        secretarioProfile,
        direcaoMunicipalProfile,
        direcaoProvincialProfile,
        profile: user?.profile || null,  // Expose profile for SUPERADMIN checks
        signOut,
        refreshProfile
    }

    return (
        <>
            <AuthContext.Provider value={value}>{children}</AuthContext.Provider>

            {/* Blocked School Modal */}
            {showBlockedModal && (
                <BlockedSchoolMessage
                    reason={blockedModalData.reason}
                    type={blockedModalData.type}
                    entityType={blockedModalData.entityType}
                    onClose={() => setShowBlockedModal(false)}
                />
            )}
        </>
    )
}
