'use client';

import { useState, useEffect } from 'react';
import {
    X,
    Clock,
    CheckCircle2,
    Activity,
    Building2,
    Timer,
    CheckSquare,
    Users,
    ShieldCheck,
    XCircle,
    Loader2
} from 'lucide-react';
import { showToast } from './Toast';
import { safeApiRequest } from '@/lib/offline';

interface Project {
    id: string;
    nombre: string;
    estado: string;
    horasEstimadas: number;
    horasConsumidas: number;
    cliente?: string;
    client?: { nombre: string };
    observaciones?: string;
}

const STATUS_CONFIG: any = {
    por_hacer: { label: 'Por Hacer', color: 'text-blue-700', bg: 'bg-blue-50' },
    planificado: { label: 'Planificado', color: 'text-violet-700', bg: 'bg-violet-50' },
    activo: { label: 'Activo', color: 'text-emerald-700', bg: 'bg-emerald-50' },
    en_riesgo: { label: 'En Riesgo', color: 'text-amber-700', bg: 'bg-amber-50' },
    atrasado: { label: 'Atrasado', color: 'text-red-700', bg: 'bg-red-50' },
    finalizado: { label: 'Finalizado', color: 'text-slate-500', bg: 'bg-slate-100' },
};

export default function ProjectFinalizeAuthModal({
    notification,
    user,
    onClose,
    onSuccess
}: {
    notification: any,
    user: any,
    onClose: () => void,
    onSuccess: () => void
}) {
    const [project, setProject] = useState<Project | null>(null);
    const [entries, setEntries] = useState<any[]>([]);
    const [checklist, setChecklist] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const projectId = notification.relatedId;
                const [pRes, eRes, cRes] = await Promise.all([
                    safeApiRequest(`/api/projects/${projectId}`).then(res => res.json()),
                    safeApiRequest(`/api/time-entries?projectId=${projectId}`).then(res => res.json()),
                    safeApiRequest(`/api/projects/${projectId}/checklist`).then(res => res.json())
                ]);

                setProject(pRes);
                setEntries(Array.isArray(eRes) ? eRes : []);
                setChecklist(Array.isArray(cRes) ? cRes : []);
            } catch (error) {
                console.error('Error fetching project details:', error);
                showToast('Error al cargar los detalles del proyecto', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [notification.relatedId]);

    const handleAuthorize = async () => {
        if (!project || isActionLoading) return;
        setIsActionLoading(true);
        try {
            const res = await safeApiRequest(`/api/projects/${project.id}/finalize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force: true, userId: user.id })
            });

            if (res.ok) {
                // Delete the notification
                await safeApiRequest(`/api/notifications/${notification.id}`, { method: 'DELETE' });

                // Notify the operator
                await safeApiRequest('/api/notifications', {
                    method: 'POST',
                    body: JSON.stringify({
                        operatorId: notification.operatorId,
                        forSupervisors: false,
                        title: 'Proyecto Finalizado',
                        message: `El supervisor ha autorizado el cierre del proyecto "${project.nombre}".`,
                        type: 'SYSTEM_MESSAGE'
                    }),
                    headers: { 'Content-Type': 'application/json' }
                });

                showToast('Proyecto finalizado y notificado.', 'success');
                onSuccess();
                onClose();
            } else {
                const data = await res.json();
                showToast(data.error || 'Error al finalizar el proyecto', 'error');
            }
        } catch (error) {
            showToast('Error de conexión', 'error');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!project || isActionLoading) return;
        setIsActionLoading(true);
        try {
            // Delete the notification
            await safeApiRequest(`/api/notifications/${notification.id}`, { method: 'DELETE' });

            // Notify the operator
            await safeApiRequest('/api/notifications', {
                method: 'POST',
                body: JSON.stringify({
                    operatorId: notification.operatorId,
                    forSupervisors: false,
                    title: 'Cierre Rechazado',
                    message: `El supervisor ha rechazado el cierre del proyecto "${project.nombre}". Por favor, verifique los pendientes.`,
                    type: 'SYSTEM_MESSAGE'
                }),
                headers: { 'Content-Type': 'application/json' }
            });

            showToast('Solicitud rechazada y notificada.', 'info');
            onSuccess();
            onClose();
        } catch (error) {
            showToast('Error de conexión', 'error');
        } finally {
            setIsActionLoading(false);
        }
    };

    if (isLoading || !project) {
        return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando revisión...</p>
                </div>
            </div>
        );
    }

    const hoursRemaining = Math.max(0, project.horasEstimadas - project.horasConsumidas);
    const progress = project.horasEstimadas > 0 ? Math.min(100, Math.round((project.horasConsumidas / project.horasEstimadas) * 100)) : 0;

    const operatorStats = entries.reduce((acc: any, entry: any) => {
        const opId = entry.operatorId;
        if (!acc[opId]) {
            acc[opId] = {
                name: entry.operator?.nombreCompleto || 'Desconocido',
                totalHours: 0,
                lastSeen: entry.fecha
            };
        }
        acc[opId].totalHours += entry.horasTrabajadas;
        if (entry.fecha > acc[opId].lastSeen) acc[opId].lastSeen = entry.fecha;
        return acc;
    }, {});

    const statsArray = Object.values(operatorStats);

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-300 max-h-[95vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                <ShieldCheck className="w-3.5 h-3.5" /> Autorización de Cierre
                            </div>
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${STATUS_CONFIG[project.estado]?.bg || 'bg-slate-100'} ${STATUS_CONFIG[project.estado]?.color || 'text-slate-500'}`}>
                                {STATUS_CONFIG[project.estado]?.label || project.estado}
                            </span>
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">{project.nombre}</h3>
                        <p className="text-sm text-slate-500 font-medium flex items-center gap-1.5">
                            <Building2 className="w-4 h-4" /> {project.client?.nombre || project.cliente || 'Sin cliente'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full text-slate-400 transition-all active:scale-95">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-3xl space-y-2">
                            <div className="flex items-center justify-between">
                                <Clock className="w-5 h-5 text-indigo-500" />
                                <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Horas</span>
                            </div>
                            <div>
                                <p className="text-2xl font-black text-indigo-900">{project.horasConsumidas}h / {project.horasEstimadas}h</p>
                                <p className="text-xs font-bold text-indigo-600/70 uppercase">Consumidas vs Estimadas</p>
                            </div>
                            <div className="w-full bg-indigo-100 h-1.5 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${progress}%` }} />
                            </div>
                        </div>

                        <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-3xl space-y-2">
                            <div className="flex items-center justify-between">
                                <Timer className="w-5 h-5 text-emerald-500" />
                                <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Restante</span>
                            </div>
                            <div>
                                <p className="text-2xl font-black text-emerald-900">{hoursRemaining}h</p>
                                <p className="text-xs font-bold text-emerald-600/70 uppercase">Tiempo disponible</p>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600/50 uppercase tracking-tight">
                                <Activity className="w-3 h-3" /> Eficiencia: {100 - progress > 0 ? 'En rango' : 'Límite'}
                            </div>
                        </div>

                        <div className="bg-amber-50/50 border border-amber-100 p-5 rounded-3xl space-y-2">
                            <div className="flex items-center justify-between">
                                <CheckSquare className="w-5 h-5 text-amber-500" />
                                <span className="text-xs font-black text-amber-400 uppercase tracking-widest">Tareas</span>
                            </div>
                            <div>
                                <p className="text-2xl font-black text-amber-900">
                                    {checklist.filter(i => i.completed).length} / {checklist.length}
                                </p>
                                <p className="text-xs font-bold text-amber-600/70 uppercase">Checklist completado</p>
                            </div>
                            <div className="w-full bg-amber-100 h-1.5 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${checklist.length > 0 ? (checklist.filter(i => i.completed).length / checklist.length) * 100 : 0}%` }} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Personnel & History */}
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <h4 className="flex items-center gap-2 font-black text-slate-800 uppercase tracking-widest text-xs">
                                    <Users className="w-4 h-4 text-primary" /> Personal Asignado
                                </h4>
                                <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operador</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Horas Totales</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {statsArray.map((stat: any) => (
                                                <tr key={stat.name} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-slate-700 text-sm">{stat.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-medium">Carga: {stat.lastSeen}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className="inline-block px-3 py-1 rounded-xl bg-primary/5 text-primary font-black text-sm border border-primary/10">
                                                            {stat.totalHours.toLocaleString()}h
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* History */}
                            {entries.length > 0 && (
                                <div className="space-y-4">
                                    <h4 className="flex items-center gap-2 font-black text-slate-800 uppercase tracking-widest text-xs">
                                        <Activity className="w-4 h-4 text-primary" /> Historial Reciente
                                    </h4>
                                    <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 border-b border-slate-100 font-black text-slate-400 uppercase tracking-widest">
                                                <tr>
                                                    <th className="px-4 py-3">Fecha</th>
                                                    <th className="px-4 py-3">Operador</th>
                                                    <th className="px-4 py-3 text-right">Horas</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {entries.slice(0, 5).map((entry: any) => (
                                                    <tr key={entry.id}>
                                                        <td className="px-4 py-2 text-slate-500 font-medium">{entry.fecha}</td>
                                                        <td className="px-4 py-2 font-bold text-slate-700">{entry.operator?.nombreCompleto}</td>
                                                        <td className="px-4 py-2 text-right font-black text-slate-900">{entry.horasTrabajadas}h</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Checklist Detail */}
                        <div className="space-y-4">
                            <h4 className="flex items-center gap-2 font-black text-slate-800 uppercase tracking-widest text-xs">
                                <CheckCircle2 className="w-4 h-4 text-primary" /> Estado del Checklist
                            </h4>
                            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                                {checklist.map((item: any) => (
                                    <div key={item.id} className={`flex items-start gap-4 p-4 rounded-3xl border transition-all ${item.completed ? 'bg-emerald-50/40 border-emerald-100 shadow-sm' : 'bg-red-50/40 border-red-100 hover:border-red-200'}`}>
                                        <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-all ${item.completed ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-200'}`}>
                                            {item.completed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-sm font-bold leading-snug ${item.completed ? 'text-emerald-900' : 'text-red-900'}`}>{item.description}</p>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white/50 px-2 py-0.5 rounded-lg border border-slate-200 mt-1 inline-block">{item.tag}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-8 border-t border-slate-100 bg-slate-50/80 flex gap-4 shrink-0">
                    <button
                        onClick={handleReject}
                        disabled={isActionLoading}
                        className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        {isActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5 text-rose-500" />}
                        RECHAZAR CIERRE
                    </button>
                    <button
                        onClick={handleAuthorize}
                        disabled={isActionLoading}
                        className="flex-[2] py-4 bg-primary text-white rounded-2xl font-black text-lg shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        {isActionLoading ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <ShieldCheck className="w-7 h-7" />}
                        AUTORIZAR Y FINALIZAR PROYECTO
                    </button>
                </div>
            </div>
        </div>
    );
}
