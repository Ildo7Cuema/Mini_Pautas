/**
 * Circulares Page - Official communications management
 * Visual layer modernized with MunicipalChrome — logic unchanged.
 */

import { useState, useEffect } from 'react';
import { useCirculares } from '../hooks/useCirculares';
import type { TipoCircular, CreateCircularRequest, CircularMunicipal } from '../types';
import { supabase } from '../../../lib/supabaseClient';
import { Icons } from '../../../components/ui/Icons';
import {
    DmPage,
    DmHeader,
    DmContent,
    DmPanel,
    DmStatCard,
    DmChip,
    DmBadge,
    DmButton,
    DmEmpty,
    DmModal,
    DmModalFooter,
    DmInput,
    DmTextarea,
    DmSelect,
    DmFormSection,
} from './MunicipalChrome';

interface CircularesPageProps {
    onNavigate?: (page: string, params?: Record<string, any>) => void;
}

const tipoLabels: Record<TipoCircular, string> = {
    circular: 'Circular',
    aviso: 'Aviso',
    comunicado: 'Comunicado',
    despacho: 'Despacho',
};

export function CircularesPage({ onNavigate: _onNavigate }: CircularesPageProps) {
    const { circulares, loading, stats, selectedCircular, leituras, escolasPendentes, filtros, setFiltros, selectCircular, criar, getNextNumber } = useCirculares();
    const [showModal, setShowModal] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [formData, setFormData] = useState<CreateCircularRequest>({ titulo: '', conteudo: '', tipo: 'circular', urgente: false });
    const [file, setFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (showModal && formData.tipo) {
            getNextNumber(formData.tipo).then(number => {
                setFormData(prev => ({ ...prev, numero_circular: number }));
            });
        }
    }, [showModal, formData.tipo, getNextNumber]);

    const handleCreate = async () => {
        if (!formData.titulo.trim() || !formData.conteudo.trim()) return;
        setSaving(true);
        try {
            let anexo_url = undefined;
            let anexo_filename = undefined;

            if (file) {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (!authUser?.id) throw new Error('Sessão inválida para upload');
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
                const filePath = `${authUser.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('circulares')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('circulares')
                    .getPublicUrl(filePath);

                anexo_url = publicUrl;
                anexo_filename = file.name;
            }

            await criar({
                ...formData,
                anexo_url,
                anexo_filename
            });
            setShowModal(false);
            setFormData({ titulo: '', conteudo: '', tipo: 'circular', urgente: false });
            setFile(null);
        } catch (err: any) {
            console.error('Erro ao criar circular:', err);
            const errorMessage = err.message || err.error_description || JSON.stringify(err) || 'Erro desconhecido';
            alert('Erro: ' + errorMessage);
        }
        finally { setSaving(false); }
    };

    const handleSelectCircular = async (circular: CircularMunicipal) => { await selectCircular(circular); setShowDetails(true); };

    if (loading && circulares.length === 0) {
        return (
            <DmPage className="pb-24 md:pb-0">
                <DmContent>
                    <div className="flex flex-col items-center justify-center gap-3 py-16">
                        <Icons.Spinner className="w-8 h-8 text-indigo-600" />
                        <p className="text-sm font-medium text-slate-500">A carregar comunicações...</p>
                    </div>
                </DmContent>
            </DmPage>
        );
    }

    return (
        <DmPage className="pb-24 md:pb-0">
            <DmHeader
                title="Comunicação Oficial"
                subtitle="Circulares, avisos e comunicados"
                icon={<Icons.DocumentText className="w-6 h-6" />}
                accent="indigo"
                actions={
                    <DmButton
                        onClick={() => setShowModal(true)}
                        icon={<Icons.Plus className="w-4 h-4" />}
                        className="!bg-white/15 !text-white !border !border-white/20 hover:!bg-white/25"
                    >
                        Nova comunicação
                    </DmButton>
                }
            />
            <DmContent>
                {stats && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                        <DmStatCard title="Total" value={stats.total} icon={<Icons.DocumentText className="w-5 h-5" />} iconTone="from-slate-50 to-slate-100 text-slate-600" />
                        <DmStatCard title="Circulares" value={stats.circulares} icon={<Icons.ClipboardList className="w-5 h-5" />} iconTone="from-blue-50 to-blue-100 text-blue-600" />
                        <DmStatCard title="Urgentes" value={stats.urgentes} icon={<Icons.ExclamationTriangle className="w-5 h-5" />} iconTone="from-red-50 to-red-100 text-red-600" />
                        <DmStatCard title="Este mês" value={stats.este_mes} icon={<Icons.Calendar className="w-5 h-5" />} iconTone="from-emerald-50 to-emerald-100 text-emerald-600" />
                    </div>
                )}

                <div className="flex flex-wrap gap-2">
                    <DmChip label="Todos" active={!filtros.tipo} onClick={() => setFiltros({})} />
                    {(Object.keys(tipoLabels) as TipoCircular[]).map(tipo => (
                        <DmChip
                            key={tipo}
                            label={tipoLabels[tipo]}
                            active={filtros.tipo === tipo}
                            onClick={() => setFiltros({ tipo })}
                        />
                    ))}
                </div>

                <div className="space-y-3">
                    {circulares.map(c => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectCircular(c)}
                            className="w-full text-left"
                        >
                            <DmPanel
                                className={`hover:border-indigo-200 hover:shadow-md transition-all ${c.urgente ? '!border-red-300' : ''}`}
                            >
                                <div className="flex justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            {c.urgente && <DmBadge tone="danger">Urgente</DmBadge>}
                                            <DmBadge tone="info">{tipoLabels[c.tipo]}</DmBadge>
                                        </div>
                                        <h3 className="font-semibold text-slate-900">{c.titulo}</h3>
                                        <p className="text-slate-600 text-sm mt-1 line-clamp-2">{c.conteudo}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-sm text-slate-500">
                                            {new Date(c.data_publicacao).toLocaleDateString('pt-AO')}
                                        </div>
                                        <div className="mt-2 text-sm text-emerald-600 inline-flex items-center gap-1">
                                            <Icons.Check className="w-3.5 h-3.5" />
                                            {c.leituras_count || 0} leituras
                                        </div>
                                    </div>
                                </div>
                            </DmPanel>
                        </button>
                    ))}
                    {circulares.length === 0 && (
                        <DmEmpty
                            title="Nenhuma comunicação"
                            description="Publique a primeira circular, aviso ou comunicado."
                            icon={<Icons.DocumentText className="w-8 h-8" />}
                        />
                    )}
                </div>
            </DmContent>

            <DmModal
                isOpen={showModal}
                onClose={() => { if (!saving) setShowModal(false); }}
                title="Nova comunicação"
                subtitle="Publicar circular, aviso, comunicado ou despacho"
                icon={<Icons.Send />}
                accent="indigo"
                size="lg"
                busy={saving}
                footer={
                    <DmModalFooter>
                        <DmButton variant="secondary" onClick={() => setShowModal(false)} disabled={saving} icon={<Icons.X />}>
                            Cancelar
                        </DmButton>
                        <DmButton
                            onClick={handleCreate}
                            disabled={saving || !formData.titulo.trim()}
                            icon={saving ? <Icons.Spinner /> : <Icons.Send />}
                        >
                            {saving ? 'A publicar…' : 'Publicar'}
                        </DmButton>
                    </DmModalFooter>
                }
            >
                <div className="space-y-4">
                    <DmFormSection title="Tipo e número">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <DmSelect
                                label="Tipo"
                                value={formData.tipo}
                                onChange={e => setFormData({ ...formData, tipo: e.target.value as TipoCircular })}
                            >
                                <option value="circular">Circular</option>
                                <option value="aviso">Aviso</option>
                                <option value="comunicado">Comunicado</option>
                                <option value="despacho">Despacho</option>
                            </DmSelect>
                            <DmInput
                                label="Número"
                                value={formData.numero_circular || ''}
                                onChange={e => setFormData({ ...formData, numero_circular: e.target.value })}
                                placeholder="N.º (opcional)"
                            />
                        </div>
                    </DmFormSection>
                    <DmFormSection title="Conteúdo">
                        <DmInput
                            label="Título"
                            value={formData.titulo}
                            onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                            required
                        />
                        <DmTextarea
                            label="Mensagem"
                            value={formData.conteudo}
                            onChange={e => setFormData({ ...formData, conteudo: e.target.value })}
                            rows={6}
                            required
                        />
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                            <input
                                type="checkbox"
                                checked={formData.urgente}
                                onChange={e => setFormData({ ...formData, urgente: e.target.checked })}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            Marcar como urgente
                        </label>
                    </DmFormSection>
                    <DmFormSection title="Anexo" description="PDF ou imagem (opcional)">
                        <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        />
                        {file && (
                            <p className="text-sm text-emerald-600 inline-flex items-center gap-1.5">
                                <Icons.Paperclip className="w-4 h-4" />
                                {file.name}
                            </p>
                        )}
                    </DmFormSection>
                </div>
            </DmModal>

            <DmModal
                isOpen={showDetails && !!selectedCircular}
                onClose={() => setShowDetails(false)}
                title={selectedCircular?.titulo || 'Detalhe'}
                subtitle={selectedCircular ? `Publicado em ${new Date(selectedCircular.data_publicacao).toLocaleDateString('pt-AO')}` : undefined}
                icon={<Icons.DocumentText />}
                accent="indigo"
                size="xl"
                footer={
                    <DmModalFooter>
                        <DmButton variant="secondary" onClick={() => setShowDetails(false)} fullWidth>
                            Fechar
                        </DmButton>
                    </DmModalFooter>
                }
            >
                {selectedCircular && (
                    <div className="space-y-5">
                        <div className="flex flex-wrap gap-2">
                            {selectedCircular.urgente && <DmBadge tone="danger">Urgente</DmBadge>}
                            <DmBadge tone="info">{tipoLabels[selectedCircular.tipo]}</DmBadge>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap text-sm text-slate-700">
                            {selectedCircular.conteudo}
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800 mb-3 inline-flex items-center gap-2">
                                <Icons.EyeOpen className="w-4 h-4" />
                                Leitura ({leituras.length}/{leituras.length + escolasPendentes.length})
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <h4 className="text-emerald-700 font-medium mb-2">Leram</h4>
                                    {leituras.map(l => (
                                        <div key={l.id} className="bg-emerald-50 text-emerald-900 p-2 rounded-lg mb-1">{l.escola?.nome}</div>
                                    ))}
                                    {leituras.length === 0 && <p className="text-slate-400">Nenhuma ainda</p>}
                                </div>
                                <div>
                                    <h4 className="text-amber-700 font-medium mb-2">Pendentes</h4>
                                    {escolasPendentes.map(e => (
                                        <div key={e.id} className="bg-amber-50 text-amber-900 p-2 rounded-lg mb-1">{e.nome}</div>
                                    ))}
                                    {escolasPendentes.length === 0 && <p className="text-slate-400">Nenhuma</p>}
                                </div>
                            </div>
                        </div>
                        {selectedCircular.anexo_url && (
                            <a
                                href={selectedCircular.anexo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-colors text-sm font-medium"
                            >
                                <Icons.Paperclip className="w-4 h-4" />
                                {selectedCircular.anexo_filename || 'Visualizar documento'}
                            </a>
                        )}
                    </div>
                )}
            </DmModal>
        </DmPage>
    );
}

export default CircularesPage;
