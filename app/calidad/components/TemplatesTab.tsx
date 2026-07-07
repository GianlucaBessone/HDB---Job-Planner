import { useState, useEffect } from 'react';
import { safeApiRequest } from '@/lib/offline';
import { Search, Plus, FileText, CheckCircle2, ShieldAlert, Trash2, Edit3, Save, X, PlusCircle, CheckSquare, Camera, Award, RefreshCw, AlertTriangle, FileSignature, Check, Sparkles, Loader2 } from 'lucide-react';
import { showToast } from '@/components/Toast';
import SignatureButton from '@/components/SignatureButton';

export default function TemplatesTab({ user }: { user: any }) {
    const [templates, setTemplates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [allTags, setAllTags] = useState<any[]>([]);

    // AI checklist generator modal state
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiData, setAiData] = useState({
        tipoTrabajo: '',
        normativa: '',
        categoria: 'General',
        tagIds: [] as string[]
    });
    const [generatingChecklist, setGeneratingChecklist] = useState(false);

    // Signature Modal state
    const [signatureModal, setSignatureModal] = useState<any>({
        isOpen: false,
        bumpVersion: false,
        reason: '',
        showWarning: false
    });
    const [pendingTemplateSignature, setPendingTemplateSignature] = useState<any>(null);



    // Edit/New modal state
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState<any>({
        code: '',
        name: '',
        description: '',
        checklistItems: [],
        requiresEvidence: false,
        requiresPhotos: false,
        requiresSignature: false,
        riskLevel: 'low',
        tagIds: []
    });

    useEffect(() => {
        loadTemplates();
        loadTags();
    }, []);

    const loadTemplates = async () => {
        setIsLoading(true);
        try {
            let res = await fetch('/api/checklist-templates').catch(() => null);
            if (!res || !res.ok) {
                res = await safeApiRequest('/api/checklist-templates');
            }
            if (res.ok) setTemplates(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const loadTags = async () => {
        try {
            let res = await fetch('/api/config/tags').catch(() => null);
            if (!res || !res.ok) {
                res = await safeApiRequest('/api/config/tags');
            }
            if (res.ok) setAllTags(await res.json());
        } catch (e) {
            console.error(e);
        }
    };

    const handleOpenNew = () => {
        setSelectedTemplate(null);
        setModalData({
            code: '',
            name: '',
            description: '',
            checklistItems: [{ descripcion: '', esObligatorio: true }],
            requiresEvidence: false,
            requiresPhotos: false,
            requiresSignature: false,
            riskLevel: 'low',
            tagIds: []
        });
        setIsModalOpen(true);
    };

    const handleGenerateChecklist = async () => {
        if (!aiData.tipoTrabajo.trim()) {
            return showToast('El tipo de trabajo es obligatorio', 'error');
        }

        setGeneratingChecklist(true);
        try {
            const selectedTagNames = aiData.tagIds
                .map(id => allTags.find(t => t.id === id)?.name)
                .filter(Boolean);

            const res = await fetch('/api/ai/generate-checklist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipoTrabajo: aiData.tipoTrabajo,
                    normativa: aiData.normativa || 'Normas internas HDB SGI',
                    categoria: aiData.categoria,
                    etiquetas: selectedTagNames,
                    userId: user.id,
                    userName: user.nombreCompleto,
                    userRole: user.role || 'ADMIN',
                    saveAsTemplate: false
                })
            });

            const result = await res.json();
            if (res.ok && result.success && result.checklist) {
                const chk = result.checklist;
                
                const checklistItems = chk.items.map((item: any) => ({
                    descripcion: item.descripcion,
                    esObligatorio: item.esObligatorio ?? true
                }));

                const requiresEvidence = chk.items.some((i: any) => i.requiereEvidencia);
                const requiresPhotos = chk.items.some((i: any) => i.tipoEvidencia === 'foto');
                const requiresSignature = chk.items.some((i: any) => i.tipoEvidencia === 'firma');
                
                let riskLevel = 'low';
                if (chk.items.some((i: any) => i.categoria === 'seguridad' && i.esObligatorio)) {
                    riskLevel = 'high';
                }

                setSelectedTemplate(null);
                setModalData({
                    code: 'AI-CK-' + Math.floor(100 + Math.random() * 900),
                    name: chk.titulo || aiData.tipoTrabajo,
                    description: chk.descripcion || `Checklist para ${aiData.tipoTrabajo} generado automáticamente por IA.`,
                    checklistItems,
                    requiresEvidence,
                    requiresPhotos,
                    requiresSignature,
                    riskLevel,
                    tagIds: [...aiData.tagIds]
                });

                setIsAiModalOpen(false);
                setIsModalOpen(true);
                showToast('Checklist generado con éxito por Gemini', 'success');
            } else {
                showToast(result.error || 'Error al generar checklist', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error de conexión al generar checklist', 'error');
        } finally {
            setGeneratingChecklist(false);
        }
    };

    const handleOpenEdit = (template: any) => {
        setSelectedTemplate(template);
        setModalData({
            id: template.id,
            code: template.code || '',
            name: template.name,
            description: template.description || '',
            checklistItems: Array.isArray(template.checklistItems) ? template.checklistItems : [],
            requiresEvidence: template.requiresEvidence,
            requiresPhotos: template.requiresPhotos,
            requiresSignature: template.requiresSignature,
            riskLevel: template.riskLevel,
            tagIds: template.tags?.map((t: any) => t.tagId) || []
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Está seguro de que desea eliminar esta plantilla de checklist?')) return;
        try {
            const res = await safeApiRequest(`/api/checklist-templates?id=${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                showToast('Plantilla eliminada con éxito', 'success');
                loadTemplates();
            } else {
                showToast('Error al eliminar plantilla', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error al eliminar plantilla', 'error');
        }
    };

    const handleSave = async (bumpVersion: boolean = false) => {
        if (!modalData.name.trim()) {
            return showToast('El nombre de la plantilla es obligatorio', 'error');
        }

        const validItems = modalData.checklistItems
            .map((i: any) => ({ ...i, descripcion: (i.descripcion || '').trim() }))
            .filter((i: any) => i.descripcion !== '');

        if (validItems.length === 0) {
            return showToast('Debe agregar al menos un paso con descripción al checklist', 'error');
        }

        // Require signature only for existing templates (edit mode)
        if (selectedTemplate) {
            setSignatureModal({
                isOpen: true,
                bumpVersion,
                reason: '',
                showWarning: !bumpVersion
            });
            setPendingTemplateSignature(null);
            return;
        }

        // Direct save for new templates
        await proceedWithSave(bumpVersion, null, null);
    };

    const proceedWithSave = async (bumpVersion: boolean, signatureData: string | null, reason: string | null) => {
        try {
            const isEdit = !!selectedTemplate;
            const url = '/api/checklist-templates';
            const method = isEdit ? 'PUT' : 'POST';

            const validItems = modalData.checklistItems
                .map((i: any) => ({ ...i, descripcion: (i.descripcion || '').trim() }))
                .filter((i: any) => i.descripcion !== '');

            const payload = {
                ...modalData,
                checklistItems: validItems,
                bumpVersion,
                userId: user.id,
                userName: user.nombreCompleto,
                signature: signatureData,
                signatureReason: reason
            };

            const res = await safeApiRequest(url, {
                method,
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showToast(isEdit ? 'Plantilla actualizada con éxito' : 'Plantilla creada con éxito', 'success');
                setIsModalOpen(false);
                setSignatureModal({ isOpen: false, bumpVersion: false, reason: '', showWarning: false });
                loadTemplates();
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al guardar plantilla', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error al guardar plantilla', 'error');
        }
    };

    const handleConfirmSignature = () => {
        if (!pendingTemplateSignature) {
            showToast('Debe firmar electrónicamente para confirmar', 'error');
            return;
        }
        const signatureData = pendingTemplateSignature.SignatureID;

        if (signatureModal.showWarning && !signatureModal.reason.trim()) {
            return showToast('Debe ingresar una justificación para no incrementar la versión', 'error');
        }

        proceedWithSave(signatureModal.bumpVersion, signatureData, signatureModal.reason);
    };

    const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const filteredTemplates = templates.filter(t => 
        normalize(t.name).includes(normalize(searchQuery)) ||
        normalize(t.code).includes(normalize(searchQuery))
    );

    return (
        <div className="space-y-4">
            <div className="flex gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text" placeholder="Buscar plantilla de checklist..."
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold outline-none focus:border-primary"
                    />
                </div>
                <button
                    onClick={() => {
                        setAiData({
                            tipoTrabajo: '',
                            normativa: '',
                            categoria: 'General',
                            tagIds: []
                        });
                        setIsAiModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-3 rounded-2xl font-black text-sm hover:opacity-95 transition-all active:scale-95 shadow-md shadow-indigo-500/20"
                >
                    <Sparkles className="w-4 h-4" /> Generar con IA
                </button>
                <button
                    onClick={handleOpenNew}
                    className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-primary/90 transition-all active:scale-95 shadow-md shadow-primary/20"
                >
                    <Plus className="w-4 h-4" /> Nueva Plantilla
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
            ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-20 bg-card text-card-foreground rounded-2xl border border-slate-200 dark:border-slate-700">
                    <CheckSquare className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                    <p className="font-bold text-slate-500">No se encontraron plantillas de checklist.</p>
                    <p className="text-sm text-slate-400 mt-1">Haga clic en "Nueva Plantilla" para crear la primera.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplates.map(template => (
                        <div key={template.id} className="bg-card text-card-foreground rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow relative group">
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-[10px] font-black font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
                                    {template.code || 'SIN CÓDIGO'}
                                </span>
                                <div className="flex gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                                        v{template.version}
                                    </span>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                                        template.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                        {template.status === 'active' ? 'Activo' : 'Inactivo'}
                                    </span>
                                </div>
                            </div>

                            <h3 className="font-black text-slate-800 dark:text-slate-100 text-base mb-1">{template.name}</h3>
                            <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-2 min-h-[32px] mb-4">
                                {template.description || 'Sin descripción'}
                            </p>

                            <div className="flex flex-wrap gap-1.5 mb-4">
                                {template.requiresEvidence && (
                                    <span className="text-[9px] font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                                        EVIDENCIA
                                    </span>
                                )}
                                {template.requiresPhotos && (
                                    <span className="text-[9px] font-bold bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                                        FOTO
                                    </span>
                                )}
                                {template.requiresSignature && (
                                    <span className="text-[9px] font-bold bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-900">
                                        FIRMA
                                    </span>
                                )}
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                                    template.riskLevel === 'high' || template.riskLevel === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
                                    template.riskLevel === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    'bg-slate-50 text-slate-700 border-slate-200'
                                }`}>
                                    RIESGO: {template.riskLevel.toUpperCase()}
                                </span>
                            </div>

                            {/* Tags link display */}
                            {template.tags && template.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                                    {template.tags.map((t: any) => (
                                        <span key={t.id} className="text-[10px] bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-bold">
                                            #{t.tag?.name}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                                <span className="text-xs font-bold text-slate-400">
                                    {template.checklistItems?.length || 0} pasos
                                </span>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => handleOpenEdit(template)}
                                        className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(template.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Creation/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-card text-card-foreground rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col my-8 animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-background text-foreground/50 rounded-t-3xl">
                            <div className="flex items-center gap-3">
                                <CheckSquare className="w-6 h-6 text-primary" />
                                <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">
                                    {selectedTemplate ? 'Editar Plantilla de Checklist' : 'Nueva Plantilla de Checklist'}
                                </h3>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Código ISO / Interno</label>
                                    <input
                                        type="text"
                                        value={modalData.code}
                                        onChange={e => setModalData({ ...modalData, code: e.target.value })}
                                        placeholder="Ej. CK-OP-01"
                                        className="w-full bg-background text-foreground border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Nombre de la Plantilla</label>
                                    <input
                                        type="text"
                                        value={modalData.name}
                                        onChange={e => setModalData({ ...modalData, name: e.target.value })}
                                        placeholder="Nombre descriptivo"
                                        className="w-full bg-background text-foreground border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Descripción</label>
                                <textarea
                                    value={modalData.description}
                                    onChange={e => setModalData({ ...modalData, description: e.target.value })}
                                    placeholder="Detalles sobre el uso o alcance de esta verificación..."
                                    rows={2}
                                    className="w-full bg-background text-foreground border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-700">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Nivel de Riesgo Operativo</label>
                                    <select
                                        value={modalData.riskLevel}
                                        onChange={e => setModalData({ ...modalData, riskLevel: e.target.value })}
                                        className="w-full bg-background text-foreground border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                                    >
                                        <option value="low">Bajo (Low)</option>
                                        <option value="medium">Medio (Medium)</option>
                                        <option value="high">Alto (High)</option>
                                        <option value="critical">Crítico (Critical)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Vincular a Etiquetas de Actividad</label>
                                    <div className="flex flex-wrap gap-1.5 p-2 bg-background text-foreground border border-slate-200 dark:border-slate-700 rounded-xl min-h-[46px] max-h-[120px] overflow-y-auto">
                                        {allTags.map(tag => {
                                            const isSelected = modalData.tagIds.includes(tag.id);
                                            return (
                                                <button
                                                    key={tag.id}
                                                    type="button"
                                                    onClick={() => {
                                                        const tagIds = isSelected 
                                                            ? modalData.tagIds.filter((tid: string) => tid !== tag.id)
                                                            : [...modalData.tagIds, tag.id];
                                                        setModalData({ ...modalData, tagIds });
                                                    }}
                                                    className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition-colors ${
                                                        isSelected 
                                                            ? 'bg-primary text-white border-primary shadow-sm'
                                                            : 'bg-card text-card-foreground text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary/50'
                                                    }`}
                                                >
                                                    {tag.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-background text-foreground/40 rounded-2xl border border-slate-100 dark:border-slate-700/80 space-y-3">
                                <span className="block text-xs font-black uppercase tracking-widest text-slate-400">Requisitos para Aprobación Técnica</span>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <label className="flex items-center gap-2.5 p-3 bg-card text-card-foreground rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-sm transition-shadow">
                                        <input
                                            type="checkbox"
                                            checked={modalData.requiresEvidence}
                                            onChange={e => setModalData({ ...modalData, requiresEvidence: e.target.checked })}
                                            className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300 dark:border-slate-600"
                                        />
                                        <div className="text-left">
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1"><Award className="w-3.5 h-3.5 text-amber-500" /> Evidencia</p>
                                            <p className="text-[10px] text-slate-400">Texto descriptivo obligatorio</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-2.5 p-3 bg-card text-card-foreground rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-sm transition-shadow">
                                        <input
                                            type="checkbox"
                                            checked={modalData.requiresPhotos}
                                            onChange={e => setModalData({ ...modalData, requiresPhotos: e.target.checked })}
                                            className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300 dark:border-slate-600"
                                        />
                                        <div className="text-left">
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1"><Camera className="w-3.5 h-3.5 text-blue-500" /> Foto</p>
                                            <p className="text-[10px] text-slate-400">Captura fotográfica mandatoria</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-2.5 p-3 bg-card text-card-foreground rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-sm transition-shadow">
                                        <input
                                            type="checkbox"
                                            checked={modalData.requiresSignature}
                                            onChange={e => setModalData({ ...modalData, requiresSignature: e.target.checked })}
                                            className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300 dark:border-slate-600"
                                        />
                                        <div className="text-left">
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-purple-500" /> Firma</p>
                                            <p className="text-[10px] text-slate-400">Firma digital obligatoria</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                                <div className="flex justify-between items-center">
                                    <span className="block text-xs font-black uppercase tracking-widest text-slate-400">Pasos del Checklist</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const checklistItems = [...modalData.checklistItems, { descripcion: '', esObligatorio: true }];
                                            setModalData({ ...modalData, checklistItems });
                                        }}
                                        className="text-xs font-black text-primary hover:text-primary/90 flex items-center gap-1"
                                    >
                                        <PlusCircle className="w-4 h-4" /> Agregar paso
                                    </button>
                                </div>

                                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                                    {modalData.checklistItems.map((item: any, idx: number) => (
                                        <div key={idx} className="p-3.5 flex gap-4 items-center bg-card text-card-foreground hover:bg-slate-50 dark:hover:bg-slate-900/10 transition-colors group">
                                            <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                                                {idx + 1}
                                            </span>
                                            <input
                                                type="text"
                                                value={item.descripcion}
                                                onChange={e => {
                                                    const checklistItems = [...modalData.checklistItems];
                                                    checklistItems[idx].descripcion = e.target.value;
                                                    setModalData({ ...modalData, checklistItems });
                                                }}
                                                placeholder="Ej. Verificar presión en manómetro..."
                                                className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-semibold p-0 text-slate-700 dark:text-slate-200 outline-none"
                                            />
                                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer shrink-0">
                                                <input
                                                    type="checkbox"
                                                    checked={item.esObligatorio}
                                                    onChange={e => {
                                                        const checklistItems = [...modalData.checklistItems];
                                                        checklistItems[idx].esObligatorio = e.target.checked;
                                                        setModalData({ ...modalData, checklistItems });
                                                    }}
                                                    className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300 dark:border-slate-600 bg-transparent"
                                                />
                                                Obligatorio
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const checklistItems = modalData.checklistItems.filter((_: any, i: number) => i !== idx);
                                                    setModalData({ ...modalData, checklistItems });
                                                }}
                                                className="p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-background text-foreground/50 flex flex-wrap justify-between items-center gap-3 rounded-b-3xl">
                            {selectedTemplate ? (
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleSave(true)}
                                        className="px-5 py-2.5 rounded-xl text-xs font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 transition-colors flex items-center gap-1.5"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin-reverse" /> Incrementar Versión (v{selectedTemplate.version + 1})
                                    </button>
                                </div>
                            ) : <div />}

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 rounded-xl text-sm font-black text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSave(false)}
                                    className="px-5 py-2.5 rounded-xl text-sm font-black bg-primary text-white hover:bg-primary/95 transition-all shadow-md shadow-primary/20 flex items-center gap-1.5"
                                >
                                    <Save className="w-4 h-4" /> Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Signature Modal */}
            {signatureModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-card text-card-foreground rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 dark:border-slate-700 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <FileSignature className="w-5 h-5 text-primary" />
                                {signatureModal.showWarning ? 'Confirmar Cambio sin Nueva Versión' : 'Aprobación de Nueva Versión'}
                            </h3>
                            <button
                                onClick={() => setSignatureModal({ ...signatureModal, isOpen: false })}
                                className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 flex flex-col gap-4">
                            {signatureModal.showWarning && (
                                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex gap-3 text-amber-800 dark:text-amber-300 text-xs">
                                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                                    <div>
                                        <p className="font-bold mb-1">Advertencia de Trazabilidad</p>
                                        <p>Está a punto de aplicar cambios en la plantilla sin incrementar su número de versión. Esto sobrescribirá la versión actual y afectará la trazabilidad histórica de los checklists vinculados.</p>
                                    </div>
                                </div>
                            )}

                            {signatureModal.showWarning && (
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">
                                        Justificación / Motivo del Cambio <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={signatureModal.reason}
                                        onChange={(e) => setSignatureModal({ ...signatureModal, reason: e.target.value })}
                                        placeholder="Ej. Corrección de error tipográfico menor..."
                                        rows={2}
                                        className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-slate-100 placeholder:text-slate-400"
                                    />
                                </div>
                            )}

                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400">
                                        Firma Digital <span className="text-red-500">*</span>
                                    </label>
                                </div>
                                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-card text-card-foreground p-4">
                                    <SignatureButton 
                                        documentId={selectedTemplate?.id || 'template-edit'} 
                                        documentVersion={`v${(selectedTemplate?.version || 0) + (signatureModal.bumpVersion ? 1 : 0)}`}
                                        onSignComplete={(sig) => setPendingTemplateSignature(sig)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-background text-foreground/50 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setSignatureModal({ ...signatureModal, isOpen: false })}
                                className="px-5 py-2.5 rounded-xl text-sm font-black text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmSignature}
                                disabled={!pendingTemplateSignature}
                                className={`px-5 py-2.5 rounded-xl text-sm font-black text-white hover:bg-primary/95 transition-all shadow-md shadow-primary/20 flex items-center gap-1.5 disabled:opacity-50 ${
                                    signatureModal.showWarning ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/10' : 'bg-primary'
                                }`}
                            >
                                <Check className="w-4 h-4" /> Confirmar Firma
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Generator Modal */}
            {isAiModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-card text-card-foreground rounded-3xl shadow-2xl w-full max-w-xl flex flex-col my-8 animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-background text-foreground/50 rounded-t-3xl">
                            <div className="flex items-center gap-3">
                                <Sparkles className="w-6 h-6 text-indigo-500" />
                                <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">
                                    Generar Checklist con Gemini
                                </h3>
                            </div>
                            <button onClick={() => setIsAiModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Tipo de Trabajo / Actividad *</label>
                                <input
                                    type="text"
                                    value={aiData.tipoTrabajo}
                                    onChange={e => setAiData({ ...aiData, tipoTrabajo: e.target.value })}
                                    placeholder="Ej. Trabajos en Altura, Mantenimiento Eléctrico..."
                                    className="w-full bg-background text-foreground border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Normativa o Norma de Referencia (Opcional)</label>
                                <input
                                    type="text"
                                    value={aiData.normativa}
                                    onChange={e => setAiData({ ...aiData, normativa: e.target.value })}
                                    placeholder="Ej. OSHA 1926, ISO 9001, Norma Interna..."
                                    className="w-full bg-background text-foreground border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Categoría</label>
                                    <select
                                        value={aiData.categoria}
                                        onChange={e => setAiData({ ...aiData, categoria: e.target.value })}
                                        className="w-full bg-background text-foreground border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="General">General</option>
                                        <option value="Seguridad">Seguridad / EPP</option>
                                        <option value="Operaciones">Operaciones / Técnico</option>
                                        <option value="Calidad">Calidad / ISO 9001</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Vincular a Etiquetas</label>
                                    <div className="flex flex-wrap gap-1.5 p-2 bg-background text-foreground border border-slate-200 dark:border-slate-700 rounded-xl min-h-[46px] max-h-[120px] overflow-y-auto">
                                        {allTags.map(tag => {
                                            const isSelected = aiData.tagIds.includes(tag.id);
                                            return (
                                                <button
                                                    key={tag.id}
                                                    type="button"
                                                    onClick={() => {
                                                        const tagIds = isSelected 
                                                            ? aiData.tagIds.filter((tid: string) => tid !== tag.id)
                                                            : [...aiData.tagIds, tag.id];
                                                        setAiData({ ...aiData, tagIds });
                                                    }}
                                                    className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition-colors ${
                                                        isSelected 
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                            : 'bg-card text-card-foreground text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-500/50'
                                                    }`}
                                                >
                                                    {tag.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-background text-foreground/50 flex justify-end gap-3 rounded-b-3xl">
                            <button
                                type="button"
                                onClick={() => setIsAiModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl text-sm font-black text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleGenerateChecklist}
                                disabled={generatingChecklist}
                                className="px-5 py-2.5 rounded-xl text-sm font-black bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:opacity-95 transition-all shadow-md shadow-indigo-500/20 flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {generatingChecklist ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Diseñando Checklist...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        <span>Generar Checklist</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
