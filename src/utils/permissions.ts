import type { UserProfile, TurmaProfessor } from '../types'

/**
 * Permission utility functions for role-based access control
 */

/**
 * Check if user is SUPERADMIN
 */
export const isSuperAdmin = (profile: UserProfile | null): boolean => {
    return profile?.tipo_perfil === 'SUPERADMIN' && profile.ativo
}

/**
 * Check if user is SECRETARIO
 */
export const isSecretario = (profile: UserProfile | null): boolean => {
    return profile?.tipo_perfil === 'SECRETARIO' && profile.ativo
}

/**
 * Check if user is DIRECAO_MUNICIPAL
 */
export const isDirecaoMunicipal = (profile: UserProfile | null): boolean => {
    return profile?.tipo_perfil === 'DIRECAO_MUNICIPAL' && profile.ativo
}


/**
 * Check if user can manage all escolas (SUPERADMIN only)
 */
export const canManageEscolas = (profile: UserProfile | null): boolean => {
    return isSuperAdmin(profile)
}

/**
 * Check if user can view all escolas (SUPERADMIN only)
 */
export const canViewAllEscolas = (profile: UserProfile | null): boolean => {
    return isSuperAdmin(profile)
}

/**
 * Check if user can block/unblock escolas (SUPERADMIN only)
 */
export const canBlockEscola = (profile: UserProfile | null): boolean => {
    return isSuperAdmin(profile)
}

/**
 * Check if user can view audit logs (SUPERADMIN only)
 */
export const canViewAuditLogs = (profile: UserProfile | null): boolean => {
    return isSuperAdmin(profile)
}

/**
 * Check if user can edit system configuration (SUPERADMIN only)
 */
export const canEditSystemConfig = (profile: UserProfile | null): boolean => {
    return isSuperAdmin(profile)
}

/**
 * Check if user can create teachers (ESCOLA; Director Administrativo via UI/RLS)
 */
export const canCreateTeacher = (profile: UserProfile | null): boolean => {
    if (isSuperAdmin(profile)) return true
    if (profile?.tipo_perfil === 'ESCOLA' && profile.ativo) return true
    // Director Administrativo uses SECRETARIO login; page + RLS enforce cargo
    if (isSecretario(profile)) return true
    return false
}

/**
 * Check if user can create students (ESCOLA and SECRETARIO)
 */
export const canCreateStudent = (profile: UserProfile | null): boolean => {
    if (isSuperAdmin(profile)) return true
    if (isSecretario(profile)) return true
    return profile?.tipo_perfil === 'ESCOLA' && profile.ativo
}

/**
 * Check if user can manage tuition payments (ESCOLA and SECRETARIO)
 */
export const canManageTuitionPayments = (profile: UserProfile | null): boolean => {
    if (isSuperAdmin(profile)) return true
    if (isSecretario(profile)) return true
    return profile?.tipo_perfil === 'ESCOLA' && profile.ativo
}

/**
 * Check if user can create turmas (classes)
 */
export const canCreateTurma = (profile: UserProfile | null): boolean => {
    if (isSuperAdmin(profile)) return true
    return profile?.tipo_perfil === 'ESCOLA' && profile.ativo
}

/**
 * Check if user can assign teachers to turmas/disciplinas
 */
export const canAssignTeacher = (profile: UserProfile | null): boolean => {
    if (isSuperAdmin(profile)) return true
    return profile?.tipo_perfil === 'ESCOLA' && profile.ativo
}

/**
 * Check if user can grade students in a specific turma/disciplina
 */
export const canGradeStudent = (
    profile: UserProfile | null,
    turmaId: string,
    disciplinaId: string,
    associations?: TurmaProfessor[]
): boolean => {
    if (!profile || !profile.ativo) return false

    // Schools can grade any student in their school
    if (profile.tipo_perfil === 'ESCOLA') return true

    // Professors can only grade in their assigned turmas/disciplinas
    if (profile.tipo_perfil === 'PROFESSOR' && associations) {
        return associations.some(
            a => a.turma_id === turmaId && a.disciplina_id === disciplinaId
        )
    }

    return false
}

/**
 * Check if user can view mini-pauta for a specific turma/disciplina
 */
export const canViewMiniPauta = (
    profile: UserProfile | null,
    turmaId: string,
    disciplinaId: string,
    associations?: TurmaProfessor[]
): boolean => {
    if (!profile || !profile.ativo) return false

    // Schools can view all mini-pautas from their school
    if (profile.tipo_perfil === 'ESCOLA') return true

    // Professors can only view mini-pautas for their assigned turmas/disciplinas
    if (profile.tipo_perfil === 'PROFESSOR' && associations) {
        return associations.some(
            a => a.turma_id === turmaId && a.disciplina_id === disciplinaId
        )
    }

    return false
}

/**
 * Check if user can export mini-pauta
 */
export const canExportMiniPauta = (
    profile: UserProfile | null,
    turmaId: string,
    disciplinaId: string,
    associations?: TurmaProfessor[]
): boolean => {
    // Same permissions as viewing
    return canViewMiniPauta(profile, turmaId, disciplinaId, associations)
}

/**
 * Check if user can edit turma details
 */
export const canEditTurma = (profile: UserProfile | null): boolean => {
    if (isSuperAdmin(profile)) return true
    return profile?.tipo_perfil === 'ESCOLA' && profile.ativo
}

/**
 * Check if user can delete turma
 */
export const canDeleteTurma = (profile: UserProfile | null): boolean => {
    if (isSuperAdmin(profile)) return true
    return profile?.tipo_perfil === 'ESCOLA' && profile.ativo
}

/**
 * Check if user can edit student details (ESCOLA and SECRETARIO)
 */
export const canEditStudent = (profile: UserProfile | null): boolean => {
    if (isSuperAdmin(profile)) return true
    if (isSecretario(profile)) return true
    return profile?.tipo_perfil === 'ESCOLA' && profile.ativo
}

/**
 * Check if user can delete student (ESCOLA and SECRETARIO)
 */
export const canDeleteStudent = (profile: UserProfile | null): boolean => {
    if (isSuperAdmin(profile)) return true
    if (isSecretario(profile)) return true
    return profile?.tipo_perfil === 'ESCOLA' && profile.ativo
}

/**
 * Check if user can manage evaluation components
 */
export const canManageComponents = (
    profile: UserProfile | null,
    turmaId: string,
    disciplinaId: string,
    associations?: TurmaProfessor[]
): boolean => {
    if (!profile || !profile.ativo) return false

    // Schools can manage all components
    if (profile.tipo_perfil === 'ESCOLA') return true

    // Professors can manage components for their assigned disciplinas
    if (profile.tipo_perfil === 'PROFESSOR' && associations) {
        return associations.some(
            a => a.turma_id === turmaId && a.disciplina_id === disciplinaId
        )
    }

    return false
}

/**
 * Check if user can manage formulas
 */
export const canManageFormulas = (
    profile: UserProfile | null,
    turmaId: string,
    disciplinaId: string,
    associations?: TurmaProfessor[]
): boolean => {
    // Same permissions as managing components
    return canManageComponents(profile, turmaId, disciplinaId, associations)
}

/**
 * Check if user can view all turmas (not just assigned ones) - ESCOLA and SECRETARIO
 */
export const canViewAllTurmas = (profile: UserProfile | null): boolean => {
    if (isSuperAdmin(profile)) return true
    if (isSecretario(profile)) return true
    return profile?.tipo_perfil === 'ESCOLA' && profile.ativo
}

/**
 * Check if user can view all students (not just from assigned turmas) - ESCOLA and SECRETARIO
 */
export const canViewAllStudents = (profile: UserProfile | null): boolean => {
    if (isSuperAdmin(profile)) return true
    if (isSecretario(profile)) return true
    return profile?.tipo_perfil === 'ESCOLA' && profile.ativo
}

/**
 * Check if user can access school settings
 */
export const canAccessSchoolSettings = (profile: UserProfile | null): boolean => {
    if (isSuperAdmin(profile)) return true
    return profile?.tipo_perfil === 'ESCOLA' && profile.ativo
}

/**
 * Check if user can manage secretaries (ESCOLA only)
 */
export const canManageSecretaries = (profile: UserProfile | null): boolean => {
    if (isSuperAdmin(profile)) return true
    return profile?.tipo_perfil === 'ESCOLA' && profile.ativo
}

/**
 * Get accessible turma IDs for a professor
 */
export const getAccessibleTurmaIds = (associations?: TurmaProfessor[]): string[] => {
    if (!associations) return []
    return [...new Set(associations.map(a => a.turma_id))]
}

/**
 * Get accessible disciplina IDs for a professor in a specific turma
 */
export const getAccessibleDisciplinaIds = (
    turmaId: string,
    associations?: TurmaProfessor[]
): string[] => {
    if (!associations) return []
    return associations
        .filter(a => a.turma_id === turmaId)
        .map(a => a.disciplina_id)
}

/**
 * Check if professor has any turma assignments
 */
export const hasAnyAssignments = (associations?: TurmaProfessor[]): boolean => {
    return (associations?.length || 0) > 0
}

// ============================================
// ALUNO AND ENCARREGADO PERMISSIONS
// ============================================

/**
 * Check if user is ALUNO (student)
 */
export const isAluno = (profile: UserProfile | null): boolean => {
    return profile?.tipo_perfil === 'ALUNO' && profile.ativo
}

/**
 * Check if user is ENCARREGADO (guardian)
 */
export const isEncarregado = (profile: UserProfile | null): boolean => {
    return profile?.tipo_perfil === 'ENCARREGADO' && profile.ativo
}

/**
 * Check if user can view their own grades (ALUNO only)
 */
export const canViewOwnGrades = (profile: UserProfile | null): boolean => {
    return isAluno(profile)
}

/**
 * Check if user can view associated students' grades (ENCARREGADO only)
 */
export const canViewAssociatedStudentGrades = (profile: UserProfile | null): boolean => {
    return isEncarregado(profile)
}

/**
 * Check if user is a read-only viewer (ALUNO or ENCARREGADO)
 * These users can only view data, not modify it
 */
export const isReadOnlyViewer = (profile: UserProfile | null): boolean => {
    return isAluno(profile) || isEncarregado(profile)
}

/**
 * Check if user can modify grades (ESCOLA, PROFESSOR only - not ALUNO/ENCARREGADO/SECRETARIO)
 */
export const canModifyGrades = (profile: UserProfile | null): boolean => {
    if (!profile || !profile.ativo) return false
    return profile.tipo_perfil === 'ESCOLA' || profile.tipo_perfil === 'PROFESSOR'
}

