import { useState, useEffect } from 'react';
import { safeApiRequest } from '@/lib/offline';
import { 
    ShieldCheck, AlertTriangle, Clock, XCircle, Award, 
    Calendar, Check, User, FileText, CheckCircle2, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

let cachedCompetenciesData: { competencies: any[]; operators: any[]; documents: any[] } | null = null;

export default function CompetenciesTab({ user }: { user: any }) {
    const [competencies, setCompetencies] = useState<any[]>([]);
    const [operators, setOperators] = useState<any[]>([]);
    const [documents, setDocuments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCell, setSelectedCell] = useState<any>(null); // For manual approval form
    const [formState, setFormState] = useState<any>({
        estado: 'vigente',
        vencimiento: '',
        evidencia: '',
        evaluacion: ''
    });

    const isTech = user?.role?.toLowerCase() === 'operador';

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        let showLoader = true;
        if (cachedCompetenciesData) {
            setCompetencies(cachedCompetenciesData.competencies);
            setOperators(cachedCompetenciesData.operators);
            setDocuments(cachedCompetenciesData.documents);
            showLoader = false;
        }
        if (showLoader) {
            setIsLoading(true);
        }
        try {
            // Load competencies
            const compUrl = isTech ? `/api/qms/competencias?operatorId=${user.id}` : '/api/qms/competencias';
            const compRes = await safeApiRequest(compUrl);
            const compData = compRes.ok ? await compRes.json() : [];

            let opDataFiltered: any[] = [];
            let docDataFiltered: any[] = [];
            if (!isTech) {
                // Load all operators
                const opRes = await safeApiRequest('/api/operators');
                const opData = opRes.ok ? await opRes.json() : [];
                opDataFiltered = opData.filter((o: any) => o.activo);

                // Load all controlled docs
                const docRes = await safeApiRequest('/api/documentos');
                const docData = docRes.ok ? await docRes.json() : [];
                docDataFiltered = docData.filter((d: any) => d.estado === 'vigente');
            }

            cachedCompetenciesData = {
                competencies: compData,
                operators: opDataFiltered,
                documents: docDataFiltered
            };

            setCompetencies(compData);
            if (!isTech) {
                setOperators(opDataFiltered);
                setDocuments(docDataFiltered);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenCertify = (operatorId: string, docId: string, currentComp: any) => {
        setSelectedCell({ operatorId, docId, currentComp });
        setFormState({
            estado: currentComp?.estado || 'vigente',
            vencimiento: currentComp?.vencimiento ? currentComp.vencimiento.split('T')[0] : '',
            evidencia: currentComp?.evidencia || '',
            evaluacion: currentComp?.evaluacion || ''
        });
    };

    const handleSaveCertify = async () => {
        try {
            const operator = operators.find(o => o.id === selectedCell.operatorId);
            const doc = documents.find(d => d.id === selectedCell.docId);

            const res = await safeApiRequest('/api/qms/competencias', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedCell.currentComp?.id || undefined,
                    operatorId: selectedCell.operatorId,
                    nombre: doc?.titulo || 'Certificación Técnica',
                    documentId: selectedCell.docId,
                    estado: formState.estado,
                    vencimiento: formState.vencimiento || null,
                    evidencia: formState.evidencia,
                    evaluacion: formState.evaluacion,
                    aprobadorId: user.id,
                    aprobadorNombre: user.nombreCompleto
                })
            });

            if (res.ok) {
                setSelectedCell(null);
                loadData();
            } else {
                alert('Error al guardar la acreditación.');
            }
        } catch (e) {
            console.error(e);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    if (isTech) {
        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div className="bg-card text-card-foreground rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                            <Award className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Mis Competencias Técnicas</h3>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                Certificaciones y habilitaciones QMS activas
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {competencies.map(c => {
                        const isVigente = c.estado === 'vigente';
                        return (
                            <div 
                                key={c.id} 
                                className="bg-card text-card-foreground rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-6 hover:shadow-md transition-shadow"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">{c.nombre}</h4>
                                        <span className="text-[10px] font-bold text-slate-400">Certificación HDB-QMS</span>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                                        isVigente 
                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' 
                                            : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                    }`}>
                                        {c.estado}
                                    </span>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                    {c.vencimiento && (
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                            <span>Vence: {format(new Date(c.vencimiento), 'dd MMM yyyy', { locale: es })}</span>
                                        </div>
                                    )}
                                    {c.evidencia && (
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evidencia</p>
                                            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-background text-foreground p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">{c.evidencia}</p>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 pt-2">
                                        <span>Aprobador: {c.aprobadorNombre || 'QMS Auto Engine'}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {competencies.length === 0 && (
                        <div className="col-span-full bg-background text-foreground border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-500">
                            <Award className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                            <h4 className="text-sm font-black text-slate-700 dark:text-slate-300">Sin Competencias</h4>
                            <p className="text-xs font-medium text-slate-500 mt-1">Aún no cuentas con competencias acreditadas.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-card text-card-foreground rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                            <Award className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Matriz de Competencias Enterprise</h3>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                Acreditación, monitoreo y auditoría de personal operativo
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Enterprise Grid Matrix */}
            <div className="bg-card text-card-foreground rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-background text-foreground/60 border-b border-slate-200 dark:border-slate-700">
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest sticky left-0 bg-background text-foreground z-10 w-64">
                                    Operador / Técnico
                                </th>
                                {documents.map(doc => (
                                    <th key={doc.id} className="px-6 py-4 text-left text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest min-w-[200px]">
                                        {doc.titulo}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-750">
                            {operators.map(op => (
                                <tr key={op.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100 sticky left-0 bg-card text-card-foreground shadow-md shadow-slate-100/10 z-10 flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-black">
                                            {op.nombreCompleto.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black">{op.nombreCompleto}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">{op.role}</p>
                                        </div>
                                    </td>
                                    {documents.map(doc => {
                                        const comp = competencies.find(c => c.operatorId === op.id && c.documentId === doc.id);
                                        const isVigente = comp?.estado === 'vigente';
                                        const isPendiente = comp?.estado === 'pendiente';
                                        const isVencida = comp?.estado === 'vencida';

                                        return (
                                            <td key={doc.id} className="px-6 py-4">
                                                <button
                                                    onClick={() => handleOpenCertify(op.id, doc.id, comp)}
                                                    className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border border-dashed ${
                                                        isVigente
                                                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50'
                                                            : isPendiente
                                                                ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50'
                                                                : isVencida
                                                                    ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50'
                                                                    : 'bg-background text-foreground text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
                                                    }`}
                                                >
                                                    {isVigente && <ShieldCheck className="w-4 h-4 shrink-0" />}
                                                    {isPendiente && <Clock className="w-4 h-4 shrink-0" />}
                                                    {isVencida && <AlertTriangle className="w-4 h-4 shrink-0" />}
                                                    {!comp && <XCircle className="w-4 h-4 shrink-0" />}
                                                    <span>{comp?.estado || 'No Registrada'}</span>
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Certify technician modal */}
            {selectedCell && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-card text-card-foreground w-full max-w-lg rounded-3xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
                        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Award className="w-5 h-5 text-primary" /> Acreditación Técnica QMS
                            </h3>
                            <button onClick={() => setSelectedCell(null)} className="text-slate-400 hover:text-slate-600 font-bold">×</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Técnico Operador</label>
                                <div className="bg-background text-foreground px-4 py-3 rounded-xl flex items-center gap-2">
                                    <User className="w-4 h-4 text-slate-400" />
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                        {operators.find(o => o.id === selectedCell.operatorId)?.nombreCompleto}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Norma / Documento</label>
                                <div className="bg-background text-foreground px-4 py-3 rounded-xl flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-slate-400" />
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                        {documents.find(d => d.id === selectedCell.docId)?.titulo}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</label>
                                    <select
                                        value={formState.estado}
                                        onChange={(e) => setFormState(prev => ({ ...prev, estado: e.target.value }))}
                                        className="w-full bg-background text-foreground border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                                    >
                                        <option value="vigente">Vigente</option>
                                        <option value="pendiente">Pendiente</option>
                                        <option value="vencida">Vencida</option>
                                        <option value="inactiva">Inactiva</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vencimiento</label>
                                    <input
                                        type="date"
                                        value={formState.vencimiento}
                                        onChange={(e) => setFormState(prev => ({ ...prev, vencimiento: e.target.value }))}
                                        className="w-full bg-background text-foreground border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evidencia Acreditada</label>
                                <textarea
                                    value={formState.evidencia}
                                    onChange={(e) => setFormState(prev => ({ ...prev, evidencia: e.target.value }))}
                                    placeholder="Detalle o enlace del certificado, aprobación práctica, o prueba técnica..."
                                    className="w-full bg-background text-foreground border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 h-20 resize-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evaluación / Notas de Auditor</label>
                                <textarea
                                    value={formState.evaluacion}
                                    onChange={(e) => setFormState(prev => ({ ...prev, evaluacion: e.target.value }))}
                                    placeholder="Comentarios de habilitación del auditor..."
                                    className="w-full bg-background text-foreground border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 h-20 resize-none"
                                />
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-background text-foreground/60 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                            <button
                                onClick={() => setSelectedCell(null)}
                                className="px-4 py-2 text-xs font-black text-slate-500 hover:text-slate-700"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveCertify}
                                className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-md shadow-primary/10 flex items-center gap-1.5"
                            >
                                <Check className="w-4 h-4" /> Acreditar Competencia
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
