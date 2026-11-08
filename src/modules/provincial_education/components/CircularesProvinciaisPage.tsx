/**
 * Provincial Circulars Management Page
 * Mobile-first design with cards, bottom sheet actions, and touch-friendly editor
 */

import React, { useState } from 'react';
import { Icons } from '../../../components/ui/Icons';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { useCircularesProvinciais } from '../hooks/useCircularesProvinciais';
import { supabase } from '../../../lib/supabaseClient';
import type { CircularProvincial } from '../types';
import {
    DpPage,
    DpContent,
    DpHeader,
    DpSearch,
    DpChip,
    DpBadge,
    DpPanel,
    DpEmpty,
    DpLoading,
    DpAlert,
    DpModal,
    DpModalFooter,
    DpConfirmModal,
    DpFormSection,
    DpButton,
    DpInput,
    DpTextarea,
} from './ProvincialChrome';

const CircularCard: React.FC<{
    circular: CircularProvincial;
    onView: () => void;
    onOpenActions: () => void;
}> = ({ circular, onView, onOpenActions }) => (
    <DpPanel padding={false}>
        <div className="p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
                {circular.urgente && <DpBadge tone="danger">URGENTE</DpBadge>}
                <span className="ml-auto">
                    <DpBadge tone={circular.publicado ? 'success' : 'neutral'}>
                        {circular.publicado ? 'Publicada' : 'Rascunho'}
                    </DpBadge>
                </span>
            </div>
            <h3 className="font-semibold text-slate-900 line-clamp-2 mb-2 tracking-tight">{circular.titulo}</h3>
            <p className="text-sm text-slate-500 line-clamp-2 mb-3">{circular.conteudo}</p>
            <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                    <Icons.Clock className="w-3.5 h-3.5" />
                    {new Date(circular.created_at).toLocaleDateString('pt-AO')}
                </span>
                {circular.publicado && (
                    <span className="flex items-center gap-1">
                        <Icons.Users className="w-3.5 h-3.5" />
                        {circular.leituras_count || 0} leituras
                    </span>
                )}
            </div>
        </div>
        <div className="flex items-center border-t border-slate-100">
            <button
                type="button"
                onClick={onView}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors min-h-[48px]"
            >
                <Icons.EyeOpen className="w-4 h-4" />
                Ver
            </button>
            <div className="w-px h-6 bg-slate-100" />
            <button
                type="button"
                onClick={onOpenActions}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors min-h-[48px]"
            >
                <Icons.ClipboardList className="w-4 h-4" />
                Opções
            </button>
        </div>
    </DpPanel>
);

export const CircularesProvinciaisPage: React.FC = () => {
    const {
        circulares,
        loading,
        error,
        criarCircular,
        actualizarCircular,
        eliminarCircular,
        publicarCircular
    } = useCircularesProvinciais();

    const [searchTerm, setSearchTerm] = useState('');
    const [filterTipo, setFilterTipo] = useState<'todos' | 'rascunho' | 'publicado'>('todos');

    // Bottom sheet and modals
    const [showActionsSheet, setShowActionsSheet] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [publishAction, setPublishAction] = useState<{ id: string; publicar: boolean } | null>(null);
    const [selectedCircular, setSelectedCircular] = useState<CircularProvincial | null>(null);

    // Form state
    const [formData, setFormData] = useState<{
        titulo: string;
        conteudo: string;
        urgente: boolean;
        tipo: 'circular' | 'aviso' | 'comunicado' | 'despacho';
    }>({
        titulo: '',
        conteudo: '',
        urgente: false,
        tipo: 'circular'
    });
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Filtering
    const filteredCirculares = circulares.filter(circular => {
        const matchesSearch =
            circular.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            circular.conteudo.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter =
            filterTipo === 'todos' ||
            (filterTipo === 'rascunho' && !circular.publicado) ||
            (filterTipo === 'publicado' && circular.publicado);
        return matchesSearch && matchesFilter;
    });

    // Handlers
    const resetForm = () => {
        setFormData({ titulo: '', conteudo: '', urgente: false, tipo: 'circular' });
        setAttachmentFile(null);
        setSelectedCircular(null);
    };

    const handleOpenActions = (circular: CircularProvincial) => {
        setSelectedCircular(circular);
        setShowActionsSheet(true);
    };

    const handleOpenEdit = () => {
        if (!selectedCircular) return;
        setShowActionsSheet(false);
        setFormData({
            titulo: selectedCircular.titulo,
            conteudo: selectedCircular.conteudo,
            urgente: selectedCircular.urgente || false,
            tipo: selectedCircular.tipo || 'circular'
        });
        setShowEditModal(true);
    };

    const handleCreate = async () => {
        if (!formData.titulo || !formData.conteudo) return;
        try {
            setActionLoading(true);
            let anexo_url: string | undefined;
            let anexo_filename: string | undefined;

            if (attachmentFile) {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (!authUser?.id) throw new Error('Sessão inválida para upload');
                const fileExt = attachmentFile.name.split('.').pop();
                const fileName = `provincial_${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
                const filePath = `${authUser.id}/${fileName}`;
                const { error: uploadError } = await supabase.storage.from('circulares').upload(filePath, attachmentFile);
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage.from('circulares').getPublicUrl(filePath);
                anexo_url = publicUrl;
                anexo_filename = attachmentFile.name;
            }

            await criarCircular({ ...formData, anexo_url, anexo_filename });
            setShowCreateModal(false);
            resetForm();
        } catch (err) {
            console.error('Error creating:', err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleUpdate = async () => {
        if (!selectedCircular || !formData.titulo || !formData.conteudo) return;
        try {
            setActionLoading(true);
            await actualizarCircular(selectedCircular.id, formData);
            setShowEditModal(false);
            resetForm();
        } catch (err) {
            console.error('Error updating:', err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedCircular) return;
        try {
            setActionLoading(true);
            await eliminarCircular(selectedCircular.id);
            setShowDeleteModal(false);
            setSelectedCircular(null);
        } catch (err) {
            console.error('Error deleting:', err);
        } finally {
            setActionLoading(false);
        }
    };

    const handlePublish = async () => {
        setShowActionsSheet(false);
        if (!selectedCircular) return;
        setPublishAction({ id: selectedCircular.id, publicar: !selectedCircular.publicado });
        setShowPublishModal(true);
    };

    const confirmPublish = async () => {
        if (!publishAction) return;
        try {
            setActionLoading(true);
            await publicarCircular(publishAction.id, publishAction.publicar);
            setShowPublishModal(false);
            setPublishAction(null);
        } catch (err) {
            console.error('Error publishing:', err);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return <DpLoading label="A carregar circulares..." />;
    }

    return (
        <DpPage>
            <DpHeader
                title="Circulares"
                subtitle="Comunicados e despachos provinciais"
                icon={<Icons.DocumentText />}
                accent="pink"
                actions={
                    <DpButton
                        onClick={() => { resetForm(); setShowCreateModal(true); }}
                        icon={<Icons.Plus className="w-5 h-5" />}
                    >
                        <span className="hidden sm:inline">Nova</span>
                        <span className="sm:hidden">Nova</span>
                    </DpButton>
                }
            />

            <DpContent>
                <div className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-md pb-3 -mx-4 px-4 pt-2 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none">
                    <DpSearch
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Pesquisar circulares..."
                        className="mb-3"
                    />
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {[
                            { id: 'todos', label: 'Todas' },
                            { id: 'rascunho', label: 'Rascunhos' },
                            { id: 'publicado', label: 'Publicadas' },
                        ].map((filter) => (
                            <DpChip
                                key={filter.id}
                                label={filter.label}
                                active={filterTipo === filter.id}
                                onClick={() => setFilterTipo(filter.id as 'todos' | 'rascunho' | 'publicado')}
                            />
                        ))}
                    </div>
                </div>

                {error && <DpAlert>{error}</DpAlert>}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCirculares.map(circular => (
                        <CircularCard
                            key={circular.id}
                            circular={circular}
                            onView={() => { setSelectedCircular(circular); setShowDetailsModal(true); }}
                            onOpenActions={() => handleOpenActions(circular)}
                        />
                    ))}
                </div>

                {filteredCirculares.length === 0 && (
                    <DpEmpty
                        icon={<Icons.DocumentText />}
                        title="Nenhuma circular"
                        description="Crie uma nova circular para começar a comunicar com as direções municipais."
                        action={
                            <DpButton
                                onClick={() => { resetForm(); setShowCreateModal(true); }}
                                icon={<Icons.Plus className="w-5 h-5" />}
                            >
                                Nova circular
                            </DpButton>
                        }
                    />
                )}
            </DpContent>

            {/* Bottom Sheet for Actions */}
            <BottomSheet
                isOpen={showActionsSheet}
                onClose={() => setShowActionsSheet(false)}
                title={selectedCircular?.titulo}
                actions={[
                    {
                        label: 'Ver Detalhes',
                        icon: <Icons.EyeOpen className="w-5 h-5" />,
                        onClick: () => { setShowActionsSheet(false); setShowDetailsModal(true); },
                    },
                    ...(!selectedCircular?.publicado ? [
                        {
                            label: 'Editar',
                            icon: <Icons.Edit className="w-5 h-5" />,
                            onClick: handleOpenEdit,
                        },
                        {
                            label: 'Publicar',
                            icon: <Icons.Send className="w-5 h-5" />,
                            onClick: handlePublish,
                            variant: 'success' as const,
                        },
                        {
                            label: 'Eliminar',
                            icon: <Icons.Trash className="w-5 h-5" />,
                            onClick: () => { setShowActionsSheet(false); setShowDeleteModal(true); },
                            variant: 'danger' as const,
                        },
                    ] : [
                        {
                            label: 'Reverter para Rascunho',
                            icon: <Icons.History className="w-5 h-5" />,
                            onClick: handlePublish,
                            variant: 'danger' as const,
                        },
                    ]),
                ]}
            />

            <DpModal
                isOpen={showCreateModal || showEditModal}
                onClose={() => {
                    if (actionLoading) return
                    setShowCreateModal(false)
                    setShowEditModal(false)
                    resetForm()
                }}
                title={showCreateModal ? 'Nova Circular' : 'Editar Circular'}
                subtitle="Comunicação oficial para as Direções Municipais"
                icon={<Icons.DocumentText />}
                accent="pink"
                busy={actionLoading}
                size="lg"
                badge={
                    <DpBadge tone={showCreateModal ? 'success' : 'info'}>
                        {showCreateModal ? 'Nova' : 'Edição'}
                    </DpBadge>
                }
                footer={
                    <DpModalFooter>
                        <DpButton
                            variant="secondary"
                            onClick={() => {
                                setShowCreateModal(false)
                                setShowEditModal(false)
                                resetForm()
                            }}
                            disabled={actionLoading}
                            icon={<Icons.X />}
                            className="sm:min-w-[7.5rem]"
                        >
                            Cancelar
                        </DpButton>
                        <DpButton
                            onClick={showCreateModal ? handleCreate : handleUpdate}
                            disabled={actionLoading || !formData.titulo || !formData.conteudo}
                            icon={
                                actionLoading ? (
                                    <Icons.Spinner />
                                ) : showCreateModal ? (
                                    <Icons.Plus />
                                ) : (
                                    <Icons.Check />
                                )
                            }
                            className="sm:min-w-[8rem]"
                        >
                            {actionLoading ? 'A guardar…' : showCreateModal ? 'Criar circular' : 'Guardar'}
                        </DpButton>
                    </DpModalFooter>
                }
            >
                <div className="space-y-4">
                    <DpFormSection title="Conteúdo" description="Título e texto da circular">
                        <DpInput
                            label="Título"
                            icon={<Icons.DocumentText />}
                            required
                            value={formData.titulo}
                            onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                            placeholder="Ex: Orientações para o Ano Lectivo"
                        />
                        <DpTextarea
                            label="Conteúdo"
                            icon={<Icons.ClipboardList />}
                            required
                            value={formData.conteudo}
                            onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                            rows={6}
                            placeholder="Escreva o conteúdo da circular..."
                        />
                    </DpFormSection>

                    <DpFormSection title="Prioridade e anexo" description="Urgência e documento de suporte">
                        <label className="flex items-center gap-3 p-3.5 rounded-xl border border-red-100 bg-gradient-to-br from-red-50 to-rose-50/60 cursor-pointer transition-all hover:border-red-200 hover:shadow-sm">
                            <input
                                type="checkbox"
                                checked={formData.urgente}
                                onChange={(e) => setFormData({ ...formData, urgente: e.target.checked })}
                                className="w-5 h-5 rounded text-red-600 focus:ring-red-500"
                            />
                            <div>
                                <p className="font-semibold text-red-700 text-sm">Marcar como Urgente</p>
                                <p className="text-xs text-red-500">Destaca a circular com prioridade máxima</p>
                            </div>
                        </label>

                        <div className="border border-dashed border-slate-300/80 rounded-xl p-4 bg-gradient-to-br from-slate-50 to-white transition-colors hover:border-primary-300 hover:bg-primary-50/30">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                <Icons.Paperclip className="w-4 h-4 inline mr-1" />
                                Anexar documento
                            </label>
                            <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                                className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer"
                            />
                            {attachmentFile && (
                                <p className="mt-2 text-sm text-emerald-600 flex items-center gap-1 font-medium">
                                    <Icons.CheckCircle className="w-4 h-4" />
                                    {attachmentFile.name}
                                </p>
                            )}
                        </div>
                    </DpFormSection>
                </div>
            </DpModal>

            <DpConfirmModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDelete}
                title="Eliminar Circular"
                message={`Eliminar "${selectedCircular?.titulo || ''}"? Esta acção não pode ser desfeita.`}
                confirmText="Eliminar"
                cancelText="Cancelar"
                variant="danger"
                loading={actionLoading}
            />

            <DpModal
                isOpen={showDetailsModal}
                onClose={() => setShowDetailsModal(false)}
                title="Detalhes da Circular"
                subtitle={
                    selectedCircular
                        ? new Date(selectedCircular.created_at).toLocaleDateString('pt-AO', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                          })
                        : undefined
                }
                icon={<Icons.DocumentText />}
                accent="pink"
                size="lg"
                badge={
                    selectedCircular ? (
                        <>
                            {selectedCircular.urgente && <DpBadge tone="danger">Urgente</DpBadge>}
                            <DpBadge tone={selectedCircular.publicado ? 'success' : 'neutral'}>
                                {selectedCircular.publicado ? 'Publicada' : 'Rascunho'}
                            </DpBadge>
                        </>
                    ) : undefined
                }
            >
                {selectedCircular && (
                    <div className="space-y-4">
                        <DpFormSection title={selectedCircular.titulo}>
                            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {selectedCircular.conteudo}
                            </p>
                        </DpFormSection>

                        {selectedCircular.publicado && (
                            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3.5 py-3 text-emerald-700">
                                <Icons.Users className="w-5 h-5 flex-shrink-0" />
                                <span className="text-sm font-medium">
                                    {selectedCircular.leituras_count || 0} direções leram esta circular
                                </span>
                            </div>
                        )}

                        {selectedCircular.anexo_url && (
                            <a
                                href={selectedCircular.anexo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3.5 rounded-xl border border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 hover:border-primary-200 transition-all"
                            >
                                <Icons.Download className="w-5 h-5" />
                                <span className="font-medium">
                                    {selectedCircular.anexo_filename || 'Descarregar anexo'}
                                </span>
                            </a>
                        )}
                    </div>
                )}
            </DpModal>

            <DpConfirmModal
                isOpen={showPublishModal}
                onClose={() => {
                    setShowPublishModal(false)
                    setPublishAction(null)
                }}
                onConfirm={confirmPublish}
                title={publishAction?.publicar ? 'Publicar Circular' : 'Reverter para Rascunho'}
                message={
                    publishAction?.publicar
                        ? 'Todas as Direções Municipais serão notificadas.'
                        : 'A circular deixará de estar visível para as Direções Municipais.'
                }
                confirmText="Confirmar"
                cancelText="Cancelar"
                variant={publishAction?.publicar ? 'info' : 'warning'}
                loading={actionLoading}
            />
        </DpPage>
    );
};

export default CircularesProvinciaisPage;
