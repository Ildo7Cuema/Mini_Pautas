/**
 * @component BlockedSchoolMessage
 * @description Professional modal displayed when a user tries to access a blocked school
 * @updated 2025-12-29 - Added WhatsApp contact for subscription renewal
 */

import React, { useEffect, useState } from 'react'
import { getSuperAdminContact, getDadosBancarios, type SuperAdminContact, type DadosBancarios } from '../utils/license'

interface BlockedSchoolMessageProps {
    reason?: string
    type: 'blocked' | 'inactive' | 'deleted'
    escolaCodigo?: string
    escolaNome?: string
    entityType?: 'escola' | 'direcao_municipal' | 'direcao_provincial'
    onClose: () => void
}

export const BlockedSchoolMessage: React.FC<BlockedSchoolMessageProps> = ({
    reason,
    type,
    escolaCodigo,
    escolaNome,
    entityType = 'escola',
    onClose
}) => {
    const [superAdminContact, setSuperAdminContact] = useState<SuperAdminContact | null>(null)
    const [dadosBancarios, setDadosBancarios] = useState<DadosBancarios | null>(null)

    // Nomenclatura baseada no tipo de entidade
    const isDirecaoMunicipal = entityType === 'direcao_municipal'
    const isDirecaoProvincial = entityType === 'direcao_provincial'
    const isDirecao = isDirecaoMunicipal || isDirecaoProvincial
    const entityName = isDirecaoProvincial
        ? 'Direção Provincial'
        : isDirecaoMunicipal
          ? 'Direção Municipal'
          : 'Instituição'
    const entityNameLower = isDirecaoProvincial
        ? 'direção provincial'
        : isDirecaoMunicipal
          ? 'direção municipal'
          : 'instituição de ensino'

    useEffect(() => {
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden'

        // Load contact info
        const loadContactInfo = async () => {
            const [contact, bank] = await Promise.all([
                getSuperAdminContact(),
                getDadosBancarios()
            ])
            setSuperAdminContact(contact)
            setDadosBancarios(bank)
        }
        loadContactInfo()

        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [])

    const isBlocked = type === 'blocked'
    const isDeleted = type === 'deleted'
    const isLicenseExpired = !isDirecao && (reason?.toLowerCase().includes('licença') || reason?.toLowerCase().includes('expirad'))

    // Generate WhatsApp link for renewal
    const getWhatsAppLink = () => {
        if (!superAdminContact) return '#'

        const entityLabel = isDirecao ? entityName : 'Escola'
        const message = encodeURIComponent(
            `Olá! Gostaria de ${isDirecao ? 'obter informações sobre o meu registo' : 'renovar a licença da minha escola'}.\n\n` +
            `📋 ${entityLabel}: ${escolaNome || 'N/A'}\n` +
            `${!isDirecao ? `🔢 Código: ${escolaCodigo || 'N/A'}\n` : ''}\n` +
            `Por favor, ${isDirecao ? 'ajude-me a esclarecer a situação' : 'envie-me os dados para efectuar o pagamento'}.`
        )

        const cleanPhone = superAdminContact.numero.replace(/[^\d+]/g, '')
        return `https://wa.me/${cleanPhone}?text=${message}`
    }

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            {/* Modal Container */}
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-slide-up max-h-[90vh] overflow-y-auto">
                {/* Header with gradient */}
                <div className={`${isDeleted ? 'bg-gradient-to-r from-slate-700 to-slate-800' : isBlocked ? 'bg-gradient-to-r from-red-600 to-red-700' : 'bg-gradient-to-r from-amber-600 to-amber-700'} px-8 py-6`}>
                    <div className="flex items-center gap-4">
                        {/* Icon */}
                        <div className="flex-shrink-0">
                            <div className={`h-16 w-16 rounded-full ${isDeleted ? 'bg-slate-500/30 border-slate-400' : isBlocked ? 'bg-red-500/30 border-red-300' : 'bg-amber-500/30 border-amber-300'} flex items-center justify-center backdrop-blur-sm border-2`}>
                                {isDeleted ? (
                                    <svg className="h-9 w-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                ) : isBlocked ? (
                                    <svg className="h-9 w-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                    </svg>
                                ) : (
                                    <svg className="h-9 w-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                )}
                            </div>
                        </div>

                        {/* Title */}
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold text-white mb-1">
                                {isDeleted ? `${entityName} Encerrada` : isBlocked ? 'Acesso Bloqueado' : 'Acesso Temporariamente Indisponível'}
                            </h3>
                            <p className={`${isDeleted ? 'text-slate-300' : 'text-red-100'} text-sm`}>
                                EduGest Angola - Sistema de Gestão Escolar
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="px-8 py-6">
                    {/* Main Message */}
                    <div className="mb-6">
                        <div className={`${isDeleted ? 'bg-slate-50 border-slate-300' : isBlocked ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'} border-l-4 rounded-r-lg p-4 mb-4`}>
                            <p className={`${isDeleted ? 'text-slate-900' : isBlocked ? 'text-red-900' : 'text-amber-900'} font-semibold mb-2`}>
                                {isDeleted
                                    ? `${isDirecao ? '🏢' : '🏫'} ${entityName} Encerrada Definitivamente`
                                    : isBlocked
                                        ? `🚫 ${entityName} Bloqueada`
                                        : `⏸️ ${entityName} ${isDirecao ? 'Pendente de Aprovação' : 'Inactiva'}`
                                }
                            </p>
                            <p className={`${isDeleted ? 'text-slate-700' : isBlocked ? 'text-red-700' : 'text-amber-700'} text-sm leading-relaxed`}>
                                {reason || (isDeleted
                                    ? `Esta ${entityNameLower} foi encerrada definitivamente pelo administrador do sistema.${!isDirecao ? ' Todos os dados da escola foram removidos do sistema.' : ''}`
                                    : isBlocked
                                        ? `Esta ${entityNameLower} foi temporariamente bloqueada pelo administrador do sistema.`
                                        : isDirecao
                                            ? `O seu registo como ${entityName} está pendente de aprovação. Será notificado quando o acesso for activado.`
                                            : 'Esta instituição de ensino encontra-se temporariamente inactiva.'
                                )}
                            </p>
                        </div>

                        {/* Additional info for deleted schools */}
                        {isDeleted && (
                            <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 mb-4">
                                <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                                    <span>ℹ️</span> O que isto significa?
                                </h4>
                                <ul className="space-y-2 text-sm text-slate-700">
                                    <li className="flex gap-2">
                                        <span>•</span>
                                        <span>A sua conta está associada a {isDirecaoMunicipal ? 'uma Direção Municipal' : 'uma escola'} que já não existe no sistema</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span>•</span>
                                        <span>Não é possível aceder aos dados anteriores desta instituição</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span>•</span>
                                        <span>Entre em contacto com o suporte para mais informações</span>
                                    </li>
                                </ul>
                            </div>
                        )}

                        {/* License Renewal Instructions (if license expired) */}
                        {isLicenseExpired && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                                <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                                    <span>💳</span> Como Renovar a Licença
                                </h4>
                                <ol className="space-y-2 text-sm text-blue-700">
                                    <li className="flex gap-2">
                                        <span className="font-bold">1.</span>
                                        <span>Efectue uma transferência bancária com o valor do plano</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="font-bold">2.</span>
                                        <span>Envie o comprovativo pelo WhatsApp abaixo</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="font-bold">3.</span>
                                        <span>Aguarde a confirmação e sua licença será activada!</span>
                                    </li>
                                </ol>

                                {/* Bank Details */}
                                {dadosBancarios && (
                                    <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
                                        <p className="text-xs text-neutral-500 mb-2 font-semibold">Dados para Transferência:</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <span className="text-neutral-500">Banco:</span>
                                                <span className="ml-1 font-medium text-neutral-800 break-words">{dadosBancarios.banco}</span>
                                            </div>
                                            <div>
                                                <span className="text-neutral-500">Titular:</span>
                                                <span className="ml-1 font-medium text-neutral-800 break-words">{dadosBancarios.titular}</span>
                                            </div>
                                            <div className="col-span-1 md:col-span-2">
                                                <span className="text-neutral-500">Conta:</span>
                                                <span className="ml-1 font-mono font-medium text-neutral-800 break-all">{dadosBancarios.conta}</span>
                                            </div>
                                            <div className="col-span-1 md:col-span-2">
                                                <span className="text-neutral-500">IBAN:</span>
                                                <span className="ml-1 font-mono font-medium text-neutral-800 break-all">{dadosBancarios.iban}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Contact Info */}
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                            <p className="text-slate-700 text-sm mb-3">
                                <strong>O que fazer agora?</strong>
                            </p>
                            <ul className="space-y-2 text-sm text-slate-600">
                                <li className="flex items-start gap-2">
                                    <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Contacte o administrador da sua instituição para mais informações</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                    </svg>
                                    <div className="flex-1 min-w-0">
                                        <p className="mb-1 font-medium text-sm">Suporte EduGest Angola - WhatsApp</p>
                                        {superAdminContact ? (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <strong className="text-green-600 break-all text-sm">{superAdminContact.numero}</strong>
                                            </div>
                                        ) : (
                                            <span className="text-neutral-400 text-xs">A carregar...</span>
                                        )}
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        {/* WhatsApp Button - Primary Action for License Expired */}
                        {isLicenseExpired && superAdminContact && (
                            <a
                                href={getWhatsAppLink()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                                Renovar via WhatsApp
                            </a>
                        )}

                        {/* Close Button - Secondary Action */}
                        <button
                            onClick={onClose}
                            className={`w-full px-6 py-3 ${isDeleted || isBlocked ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white'} rounded-lg font-semibold transition-all duration-200`}
                        >
                            Entendido
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 px-8 py-4 border-t border-slate-200">
                    <p className="text-center text-xs text-slate-500">
                        © 2025 EduGest Angola - Todos os direitos reservados
                    </p>
                </div>
            </div>
        </div>
    )
}
