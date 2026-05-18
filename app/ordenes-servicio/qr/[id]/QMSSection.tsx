import { useState, useEffect, useRef } from 'react';
import { safeApiRequest } from '@/lib/offline';
import { 
    ShieldAlert, CheckCircle2, FileText, ChevronRight, 
    AlertTriangle, ExternalLink, Camera, Award, PenTool, 
    Check, RotateCcw, UploadCloud, X, ChevronDown, ChevronUp 
} from 'lucide-react';

// ----- CANVAS SIGNATURE MODAL -----
function SignatureModal({ isOpen, onClose, onSave }: { isOpen: boolean, onClose: () => void, onSave: (signature: string) => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.strokeStyle = '#4f46e5'; // primary color Indigo
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
        setIsDrawing(true);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleSave = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const blank = document.createElement('canvas');
        blank.width = canvas.width;
        blank.height = canvas.height;
        if (canvas.toDataURL() === blank.toDataURL()) {
            alert('Por favor, firme antes de guardar.');
            return;
        }
        onSave(canvas.toDataURL());
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md flex flex-col p-6 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <PenTool className="w-5 h-5 text-indigo-600" /> Firma de Conformidad
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-900 relative">
                    <canvas
                        ref={canvasRef}
                        width={400}
                        height={200}
                        className="w-full h-[200px] cursor-crosshair touch-none"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                    />
                </div>
                
                <div className="flex justify-between items-center mt-5 gap-3">
                    <button
                        onClick={clearCanvas}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl text-xs font-black text-slate-600 dark:text-slate-200 transition-colors flex items-center gap-1"
                    >
                        <RotateCcw className="w-3.5 h-3.5" /> Limpiar
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-black text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors rounded-xl"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-5 py-2.5 bg-primary hover:bg-primary/95 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-primary/20"
                        >
                            Confirmar Firma
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ----- MAIN QMS SECTION -----
export default function QMSSection({ os, onUpdate }: { os: any, onUpdate: () => void }) {
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [dbTemplates, setDbTemplates] = useState<any[]>([]);
    
    // Inline expand details state (checklistId + '-' + itemIndex)
    const [expandedItem, setExpandedItem] = useState<string | null>(null);
    const [localForm, setLocalForm] = useState({
        observacion: '',
        foto: '',
        firma: ''
    });

    // Signature Modal
    const [sigModalOpen, setSigModalOpen] = useState(false);

    useEffect(() => {
        safeApiRequest('/api/checklist-templates?status=active')
            .then(res => res.json())
            .then(data => setDbTemplates(Array.isArray(data) ? data : []))
            .catch(err => console.error(err));
    }, []);

    const documentos = os.documentosRequeridos || [];
    // Get checklists from dynamic decoupled DocumentChecklist snapshots on project:
    const documentChecklists = os.project?.documentChecklists || [];

    if (documentos.length === 0 && documentChecklists.length === 0) return null;

    const handleAcknowledge = async (docId: string) => {
        setLoadingAction(docId);
        try {
            const operatorId = os.operadores[0]?.operadorId || 'public_user';
            const operatorNombre = os.operadores[0]?.operador?.nombreCompleto || 'Cliente / Usuario Público';

            // 1. Get current geolocation details via browser API
            const getCoords = (): Promise<{ lat: number | null, lng: number | null }> => {
                return new Promise((resolve) => {
                    if (typeof window === 'undefined' || !navigator.geolocation) {
                        resolve({ lat: null, lng: null });
                        return;
                    }
                    navigator.geolocation.getCurrentPosition(
                        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                        () => resolve({ lat: null, lng: null }),
                        { timeout: 5000 }
                    );
                });
            };
            const coords = await getCoords();

            // 2. Fetch public IP address
            let ip = '';
            try {
                const ipRes = await fetch('https://api.ipify.org?format=json').then(r => r.json());
                ip = ipRes.ip || '';
            } catch (err) {
                console.warn('Could not determine public IP:', err);
            }

            // 3. Detect browser/device details
            let dispositivo = 'Desconocido';
            if (typeof navigator !== 'undefined') {
                const ua = navigator.userAgent;
                if (/Mobi|Android|iPhone/i.test(ua)) {
                    dispositivo = 'Mobile - ' + (ua.includes('Android') ? 'Android' : ua.includes('iPhone') ? 'iPhone' : 'Device');
                } else {
                    dispositivo = 'Desktop - ' + (ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'Mac' : ua.includes('Linux') ? 'Linux' : 'Device');
                }
            }

            await safeApiRequest(`/api/ordenes-servicio/${os.id}/qms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'acknowledge',
                    osDocumentoId: docId,
                    operatorId,
                    operatorNombre,
                    gpsLat: coords.lat,
                    gpsLng: coords.lng,
                    ip,
                    dispositivo
                })
            });
            onUpdate();
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingAction(null);
        }
    };

    // Toggle checklist completion state or expand for compliance input
    const handleCheckItemClick = (chkId: string, idx: number, item: any, chk: any) => {
        const key = `${chkId}-${idx}`;
        const snapshot = chk.snapshotData;
        const isObjectWrapper = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot);
        const reqEvidence = isObjectWrapper ? !!snapshot.requiresEvidence : false;
        const reqPhotos = isObjectWrapper ? !!snapshot.requiresPhotos : false;
        const reqSignature = isObjectWrapper ? !!snapshot.requiresSignature : false;

        const needsInputs = reqEvidence || reqPhotos || reqSignature;

        if (item.completado) {
            // Already completed, we allow untoggling directly
            saveItemState(chkId, idx, false, '', '', '');
        } else {
            // Needs visual criteria inputs: expand inline
            if (needsInputs) {
                setExpandedItem(expandedItem === key ? null : key);
                setLocalForm({
                    observacion: item.observacion || '',
                    foto: item.foto || '',
                    firma: item.firma || ''
                });
            } else {
                // No criteria required, save directly
                saveItemState(chkId, idx, true, '', '', '');
            }
        }
    };

    const saveItemState = async (
        documentChecklistId: string, 
        itemIndex: number, 
        completado: boolean, 
        observacion: string, 
        foto: string, 
        firma: string
    ) => {
        const key = `${documentChecklistId}-${itemIndex}`;
        setLoadingAction(key);
        try {
            const operatorId = os.operadores[0]?.operadorId;
            const operatorNombre = os.operadores[0]?.operador?.nombreCompleto;
            if (!operatorId) return alert('No hay operador asignado para esta OS');

            const res = await safeApiRequest(`/api/ordenes-servicio/${os.id}/qms`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'document_checklist_item',
                    documentChecklistId,
                    itemIndex,
                    completado,
                    observacion,
                    foto,
                    firma,
                    operatorId,
                    operatorNombre
                })
            });

            if (res.ok) {
                setExpandedItem(null);
                onUpdate();
            } else {
                const err = await res.json();
                alert(err.error || 'Error al guardar verificación');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.result) {
                setLocalForm(prev => ({ ...prev, foto: reader.result as string }));
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="px-6 py-4 border-b border-slate-50 dark:border-slate-700 bg-indigo-50/50 dark:bg-indigo-900/10">
                <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                        QMS - Calidad y Compliance
                    </h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">Requisitos obligatorios e ISO para la ejecución de esta OS</p>
            </div>

            <div className="px-6 py-5 space-y-6">
                {/* Documentación Aplicable */}
                {documentos.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Documentación Aplicable</h4>
                        <div className="space-y-3">
                            {documentos.map((d: any) => (
                                <div key={d.id} className={`p-4 rounded-2xl border ${d.bloqueante && !d.leido ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/10' : 'border-slate-200 dark:border-slate-700'}`}>
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <div className="flex gap-2 items-center mb-1">
                                                <span className="text-[10px] font-black font-mono bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                                                    {d.document.codigoDocumental}
                                                </span>
                                                {d.bloqueante && !d.leido && (
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-100 px-2 py-0.5 rounded flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3" /> Bloqueante
                                                    </span>
                                                )}
                                            </div>
                                            <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{d.document.titulo}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between mt-4">
                                        {d.version?.files?.[0]?.url && (
                                            <a href={d.version.files[0].url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                                                <ExternalLink className="w-3.5 h-3.5" /> Ver Documento
                                            </a>
                                        )}

                                        {d.document.requiereConfirmacionLectura && (
                                            <button 
                                                onClick={() => handleAcknowledge(d.id)}
                                                disabled={d.leido || loadingAction === d.id}
                                                className={`text-xs font-black px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 active:scale-95 duration-200 ${
                                                    d.leido 
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 cursor-default' 
                                                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 dark:shadow-none hover:shadow-none'
                                                }`}
                                            >
                                                {loadingAction === d.id ? (
                                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : d.leido ? (
                                                    <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Confirmado</>
                                                ) : (
                                                    <><FileText className="w-3.5 h-3.5" /> Confirmar Lectura</>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Checklists Operativos Desacoplados */}
                {documentChecklists.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Checklists Operativos (Snapshots ISO)</h4>
                        <div className="space-y-4">
                            {documentChecklists.map((chk: any) => {
                                const snapshot = chk.snapshotData;
                                const isObjectWrapper = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot);
                                const items = isObjectWrapper ? (snapshot.items || []) : (Array.isArray(snapshot) ? snapshot : []);
                                const reqEvidence = isObjectWrapper ? !!snapshot.requiresEvidence : false;
                                const reqPhotos = isObjectWrapper ? !!snapshot.requiresPhotos : false;
                                const reqSignature = isObjectWrapper ? !!snapshot.requiresSignature : false;
                                const riskLevel = isObjectWrapper ? snapshot.riskLevel || 'low' : 'low';

                                // Find in database if there's a newer template version
                                const activeTmpl = dbTemplates.find(t => t.id === chk.templateId);
                                const isOutdated = activeTmpl && activeTmpl.version > chk.templateVersion;

                                return (
                                    <div key={chk.id} className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-800/80">
                                        <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-2">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h5 className="font-black text-sm text-slate-700 dark:text-slate-200">{chk.templateName}</h5>
                                                    <span className="text-[9px] font-black font-mono bg-slate-200 dark:bg-slate-750 px-1.5 py-0.5 rounded text-slate-500">
                                                        v{chk.templateVersion}
                                                    </span>
                                                    <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                                                        riskLevel === 'high' || riskLevel === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
                                                        riskLevel === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                        'bg-slate-100 text-slate-600 border-slate-200'
                                                    }`}>
                                                        {riskLevel}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {reqEvidence && <span className="text-[8px] font-black bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100">EVIDENCIA</span>}
                                                {reqPhotos && <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">FOTO</span>}
                                                {reqSignature && <span className="text-[8px] font-black bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded border border-purple-100">FIRMA</span>}
                                            </div>
                                        </div>

                                        {/* Version Mismatch Warning Alert */}
                                        {isOutdated && (
                                            <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900 p-3.5 flex items-start gap-2.5">
                                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                                <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
                                                    Existe una versión más reciente de esta plantilla (v{activeTmpl.version}). Considere actualizar el documento en el panel de control.
                                                </div>
                                            </div>
                                        )}

                                        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                            {items.map((item: any, idx: number) => {
                                                const key = `${chk.id}-${idx}`;
                                                const isExpanded = expandedItem === key;
                                                const isItemLoading = loadingAction === key;

                                                return (
                                                    <div key={idx} className="flex flex-col">
                                                        <button 
                                                            onClick={() => handleCheckItemClick(chk.id, idx, item, chk)}
                                                            disabled={isItemLoading}
                                                            className="w-full px-4 py-3.5 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition-colors"
                                                        >
                                                            <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                                                item.completado ? 'bg-primary border-primary text-white' : 'border-slate-300 dark:border-slate-600'
                                                            }`}>
                                                                {isItemLoading ? (
                                                                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                                ) : item.completado && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className={`text-sm font-bold ${item.completado ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                                                                    {item.descripcion}
                                                                    {item.esObligatorio && <span className="text-red-500 ml-1">*</span>}
                                                                </p>
                                                                {item.completado && (item.completadoPorNombre || item.fechaCompletado) && (
                                                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-semibold">
                                                                        Verificado por {item.completadoPorNombre || 'Operador'} el {item.fechaCompletado ? new Date(item.fechaCompletado).toLocaleDateString() : ''}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            {(reqEvidence || reqPhotos || reqSignature) && !item.completado && (
                                                                <div className="shrink-0 text-slate-300">
                                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                                </div>
                                                            )}
                                                        </button>

                                                        {/* Expanded Visual Criteria Input Forms */}
                                                        {isExpanded && (
                                                            <div className="px-11 pb-5 pt-1 bg-slate-50/50 dark:bg-slate-900/10 space-y-4 border-t border-slate-50 dark:border-slate-750/30 animate-in slide-in-from-top-2 duration-200">
                                                                {reqEvidence && (
                                                                    <div>
                                                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Evidencia / Medición</label>
                                                                        <textarea
                                                                            rows={2}
                                                                            value={localForm.observacion}
                                                                            onChange={e => setLocalForm(p => ({ ...p, observacion: e.target.value }))}
                                                                            placeholder="Ingrese el valor medido o descripción del estado..."
                                                                            className="w-full text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-primary resize-none"
                                                                        />
                                                                    </div>
                                                                )}

                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                    {reqPhotos && (
                                                                        <div>
                                                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Captura Fotográfica</label>
                                                                            <div className="flex items-center gap-3">
                                                                                <label className="flex items-center gap-1.5 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors text-xs font-black text-slate-600 dark:text-slate-300">
                                                                                    <Camera className="w-4 h-4 text-blue-500" />
                                                                                    {localForm.foto ? 'Cambiar Foto' : 'Tomar Foto'}
                                                                                    <input 
                                                                                        type="file" 
                                                                                        accept="image/*" 
                                                                                        capture="environment" 
                                                                                        className="hidden" 
                                                                                        onChange={handleFileChange}
                                                                                    />
                                                                                </label>
                                                                                {localForm.foto && (
                                                                                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200">
                                                                                        <img src={localForm.foto} alt="Captura" className="w-full h-full object-cover" />
                                                                                        <button 
                                                                                            onClick={() => setLocalForm(p => ({ ...p, foto: '' }))}
                                                                                            className="absolute top-0.5 right-0.5 p-0.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full transition-colors"
                                                                                        >
                                                                                            <X className="w-2.5 h-2.5" />
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {reqSignature && (
                                                                        <div>
                                                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Firma Digital</label>
                                                                            <div className="flex items-center gap-3">
                                                                                <button
                                                                                    onClick={() => setSigModalOpen(true)}
                                                                                    className="flex items-center gap-1.5 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-xl hover:bg-slate-50 transition-colors text-xs font-black text-slate-600 dark:text-slate-300"
                                                                                >
                                                                                    <PenTool className="w-4 h-4 text-purple-500" />
                                                                                    {localForm.firma ? 'Cambiar Firma' : 'Dibujar Firma'}
                                                                                </button>
                                                                                {localForm.firma && (
                                                                                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 bg-white p-0.5">
                                                                                        <img src={localForm.firma} alt="Firma" className="w-full h-full object-contain" />
                                                                                        <button 
                                                                                            onClick={() => setLocalForm(p => ({ ...p, firma: '' }))}
                                                                                            className="absolute top-0.5 right-0.5 p-0.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full transition-colors"
                                                                                        >
                                                                                            <X className="w-2.5 h-2.5" />
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                                                    <button
                                                                        onClick={() => setExpandedItem(null)}
                                                                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                                                                    >
                                                                        Cancelar
                                                                    </button>
                                                                    <button
                                                                        disabled={
                                                                            (reqEvidence && !localForm.observacion.trim()) ||
                                                                            (reqPhotos && !localForm.foto) ||
                                                                            (reqSignature && !localForm.firma)
                                                                        }
                                                                        onClick={() => saveItemState(chk.id, idx, true, localForm.observacion, localForm.foto, localForm.firma)}
                                                                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-black rounded-xl transition-all shadow-sm shadow-indigo-150"
                                                                    >
                                                                        Guardar Verificación
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <SignatureModal 
                isOpen={sigModalOpen}
                onClose={() => setSigModalOpen(false)}
                onSave={(sig) => setLocalForm(prev => ({ ...prev, firma: sig }))}
            />
        </div>
    );
}
