import { useState } from 'react';
import { safeApiRequest } from '@/lib/offline';
import { ShieldAlert, CheckCircle2, FileText, ChevronRight, AlertTriangle, ExternalLink } from 'lucide-react';

export default function QMSSection({ os, onUpdate }: { os: any, onUpdate: () => void }) {
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    const documentos = os.documentosRequeridos || [];
    const checklists = os.checklists || [];

    if (documentos.length === 0 && checklists.length === 0) return null;

    const handleAcknowledge = async (docId: string) => {
        setLoadingAction(docId);
        try {
            const operatorId = os.operadores[0]?.operadorId;
            const operatorNombre = os.operadores[0]?.operador?.nombreCompleto;
            if (!operatorId) return alert('No hay operador asignado para confirmar lectura');

            // Optionally get GPS here
            await safeApiRequest(`/api/ordenes-servicio/${os.id}/qms`, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'acknowledge',
                    osDocumentoId: docId,
                    operatorId,
                    operatorNombre
                })
            });
            onUpdate();
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleChecklistItem = async (itemId: string, completado: boolean) => {
        setLoadingAction(itemId);
        try {
            const operatorId = os.operadores[0]?.operadorId;
            await safeApiRequest(`/api/ordenes-servicio/${os.id}/qms`, {
                method: 'PUT',
                body: JSON.stringify({
                    action: 'checklist_item',
                    itemId,
                    completado: !completado,
                    operatorId
                })
            });
            onUpdate();
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingAction(null);
        }
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
                <p className="text-xs text-slate-500 font-medium mt-1">Requisitos para la ejecución de esta OS</p>
            </div>

            <div className="px-6 py-5 space-y-6">
                {/* Documentos */}
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
                                                className={`text-xs font-black px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
                                                    d.leido 
                                                        ? 'bg-emerald-100 text-emerald-700' 
                                                        : 'bg-primary text-white hover:bg-primary/90'
                                                }`}
                                            >
                                                {loadingAction === d.id ? (
                                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : d.leido ? (
                                                    <><CheckCircle2 className="w-3.5 h-3.5" /> Leído</>
                                                ) : 'Confirmar Lectura'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Checklists */}
                {checklists.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Checklists Operativos</h4>
                        <div className="space-y-4">
                            {checklists.map((chk: any) => (
                                <div key={chk.id} className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                                    <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                                        <h5 className="font-bold text-sm text-slate-700 dark:text-slate-200">{chk.titulo}</h5>
                                    </div>
                                    <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {chk.items.map((item: any) => (
                                            <button 
                                                key={item.id}
                                                onClick={() => handleChecklistItem(item.id, item.completado)}
                                                disabled={loadingAction === item.id}
                                                className="w-full px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition-colors"
                                            >
                                                <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                                    item.completado ? 'bg-primary border-primary text-white' : 'border-slate-300 dark:border-slate-600'
                                                }`}>
                                                    {loadingAction === item.id ? (
                                                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                    ) : item.completado && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-medium ${item.completado ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                                                        {item.descripcion}
                                                        {item.esObligatorio && <span className="text-red-500 ml-1">*</span>}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
