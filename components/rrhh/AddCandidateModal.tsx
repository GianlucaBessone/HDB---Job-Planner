'use client';

import React, { useState, useEffect } from 'react';
import { X, UserPlus, Users, Search, Check, AlertCircle, ExternalLink, BrainCircuit } from 'lucide-react';
import { useModalScroll } from '@/lib/useModalScroll';
import { createCandidate, getAvailableCandidatesForVacancy, assignCandidateToVacancy } from '@/app/rrhh/actions';
import { useRouter } from 'next/navigation';

interface AddCandidateModalProps {
    isOpen: boolean;
    onClose: () => void;
    vacancyId: string;
    vacancyTitle?: string;
    onCandidateAdded: () => void;
    initialStage?: string;
}

const STAGES = [
    { id: 'POSTULADO', label: 'Postulado' },
    { id: 'PRESELECCION', label: 'Preselección' },
    { id: 'CONTACTADO', label: 'Contactado' },
    { id: 'ENTREVISTA_RRHH', label: 'Entrevista RRHH' },
    { id: 'ENTREVISTA_TEC', label: 'Entrevista Técnica' },
    { id: 'FINALISTAS', label: 'Finalista' },
];

export default function AddCandidateModal({
    isOpen,
    onClose,
    vacancyId,
    vacancyTitle,
    onCandidateAdded,
    initialStage = 'POSTULADO'
}: AddCandidateModalProps) {
    const router = useRouter();
    useModalScroll(isOpen);

    const [activeTab, setActiveTab] = useState<'new' | 'existing'>('new');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Form data for new candidate
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        city: '',
        linkedin: '',
        stage: initialStage,
        notes: ''
    });

    // Existing talent pool candidates
    const [availableCandidates, setAvailableCandidates] = useState<any[]>([]);
    const [loadingAvailable, setLoadingAvailable] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [assigningId, setAssigningId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && vacancyId) {
            setErrorMsg(null);
            setSuccessMsg(null);
            setFormData(prev => ({ ...prev, stage: initialStage }));
            if (activeTab === 'existing') {
                loadAvailableCandidates();
            }
        }
    }, [isOpen, vacancyId, initialStage, activeTab]);

    const loadAvailableCandidates = async () => {
        setLoadingAvailable(true);
        try {
            const res = await getAvailableCandidatesForVacancy(vacancyId);
            if (res.success && res.data) {
                setAvailableCandidates(res.data);
            }
        } catch (err: any) {
            console.error('Error loading candidates:', err);
        } finally {
            setLoadingAvailable(false);
        }
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg(null);
        setSuccessMsg(null);

        try {
            const res = await createCandidate({
                ...formData,
                vacancyId
            });

            if (res.success) {
                setSuccessMsg('¡Postulante creado y asignado exitosamente!');
                // Reset fields
                setFormData({
                    firstName: '',
                    lastName: '',
                    email: '',
                    phone: '',
                    city: '',
                    linkedin: '',
                    stage: initialStage,
                    notes: ''
                });
                onCandidateAdded();
                setTimeout(() => {
                    onClose();
                }, 1000);
            } else {
                setErrorMsg(res.error || 'Ocurrió un error al crear el postulante');
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error de conexión');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAssignExisting = async (candidateId: string) => {
        setAssigningId(candidateId);
        setErrorMsg(null);
        try {
            const res = await assignCandidateToVacancy(candidateId, vacancyId, initialStage);
            if (res.success) {
                setAvailableCandidates(prev => prev.filter(c => c.id !== candidateId));
                setSuccessMsg('Candidato vinculado a la vacante');
                onCandidateAdded();
                setTimeout(() => setSuccessMsg(null), 2500);
            } else {
                setErrorMsg(res.error || 'Error al vincular el postulante');
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error al vincular');
        } finally {
            setAssigningId(null);
        }
    };

    if (!isOpen) return null;

    const filteredAvailable = availableCandidates.filter(c => {
        const full = `${c.firstName} ${c.lastName}`.toLowerCase();
        const mail = (c.email || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        return full.includes(search) || mail.includes(search);
    });

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                <UserPlus className="w-5 h-5" />
                            </div>
                            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                                Cargar Postulante
                            </h2>
                        </div>
                        {vacancyTitle && (
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 pl-9">
                                Vacante: <span className="text-indigo-600 dark:text-indigo-400">{vacancyTitle}</span>
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 bg-white dark:bg-slate-900">
                    <button
                        type="button"
                        onClick={() => { setActiveTab('new'); setErrorMsg(null); setSuccessMsg(null); }}
                        className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-all ${
                            activeTab === 'new'
                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <UserPlus className="w-4 h-4" />
                        Nuevo Postulante
                    </button>
                    <button
                        type="button"
                        onClick={() => { setActiveTab('existing'); setErrorMsg(null); setSuccessMsg(null); }}
                        className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-all ${
                            activeTab === 'existing'
                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <Users className="w-4 h-4" />
                        Desde Base de Talentos
                    </button>
                </div>

                {/* Feedback Alerts */}
                {errorMsg && (
                    <div className="mx-5 mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                )}
                {successMsg && (
                    <div className="mx-5 mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                        <Check className="w-4 h-4 shrink-0" />
                        <span>{successMsg}</span>
                    </div>
                )}

                {/* Body Content */}
                <div className="p-5 overflow-y-auto flex-1">
                    {activeTab === 'new' ? (
                        <form id="add-candidate-form" onSubmit={handleCreateSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Nombre <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="Ej: Carlos"
                                        value={formData.firstName}
                                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                        className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Apellido <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="Ej: Gomez"
                                        value={formData.lastName}
                                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                        className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="carlos.gomez@gmail.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Teléfono / WhatsApp
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="+54 9 11 1234-5678"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Ciudad / Ubicación
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Buenos Aires, Argentina"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Etapa Inicial en Pipeline
                                    </label>
                                    <select
                                        value={formData.stage}
                                        onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                                        className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    >
                                        {STAGES.map(s => (
                                            <option key={s.id} value={s.id}>{s.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    LinkedIn (URL)
                                </label>
                                <input
                                    type="text"
                                    placeholder="https://linkedin.com/in/usuario"
                                    value={formData.linkedin}
                                    onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                                    className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Notas iniciales (Opcional)
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Comentarios u observaciones iniciales sobre el postulante..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        router.push(`/rrhh/reclutamiento/postulantes/nuevo?vacancyId=${vacancyId}`);
                                    }}
                                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Abrir formulario completo
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Buscar por nombre o email..."
                                    className="w-full h-10 pl-9 pr-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                />
                            </div>

                            {loadingAvailable ? (
                                <div className="py-12 flex justify-center items-center">
                                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : filteredAvailable.length > 0 ? (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[340px] overflow-y-auto">
                                    {filteredAvailable.map((candidate) => (
                                        <div
                                            key={candidate.id}
                                            className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                                        >
                                            <div className="min-w-0 flex-1 pr-3">
                                                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                                                    {candidate.firstName} {candidate.lastName}
                                                </h4>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                    <span className="truncate">{candidate.email || 'Sin email'}</span>
                                                    {candidate.city && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="truncate">{candidate.city}</span>
                                                        </>
                                                    )}
                                                </div>
                                                {candidate.tags && candidate.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                        {candidate.tags.slice(0, 3).map((tag: any) => (
                                                            <span key={tag.id} className="text-[9px] uppercase font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                                                                {tag.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                disabled={assigningId === candidate.id}
                                                onClick={() => handleAssignExisting(candidate.id)}
                                                className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                            >
                                                {assigningId === candidate.id ? (
                                                    <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <>
                                                        <UserPlus className="w-3.5 h-3.5" />
                                                        <span>Vincular</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-12 text-center text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                                    <p className="text-sm font-semibold">No hay postulantes disponibles en la base</p>
                                    <p className="text-xs text-slate-400 mt-1">Todos los postulantes ya están asignados o aún no creaste candidatos</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Cerrar
                    </button>
                    {activeTab === 'new' && (
                        <button
                            type="submit"
                            form="add-candidate-form"
                            disabled={isLoading}
                            className="px-5 py-2 text-sm font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Guardando...</span>
                                </>
                            ) : (
                                <>
                                    <UserPlus className="w-4 h-4" />
                                    <span>Cargar Postulante</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
