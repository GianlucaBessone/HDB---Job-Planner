'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, X, Calendar, Clock, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { showToast } from './Toast';

export default function NotificationsDropdown({ user }: { user: any }) {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState<any>(null);
    const [mounted, setMounted] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setMounted(true);
        if (!user) return;
        const fetchNotifications = async () => {
            try {
                const res = await fetch(`/api/notifications?operatorId=${user.id}&role=${user.role}`);
                const data = await res.json();
                if (Array.isArray(data)) setNotifications(data);
            } catch (err) {
                console.error(err);
            }
        };

        fetchNotifications();
        // Optional: poll every X seconds
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, [user]);

    const markAsRead = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        try {
            await fetch(`/api/notifications/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ read: true })
            });
        } catch (err) {
            console.error('Error marking as read', err);
        }
    };

    const handleNotificationClick = (notif: any) => {
        if (!notif.read) markAsRead(notif.id);

        if (notif.type === 'TIME_MODIFICATION_REQUEST' || notif.type === 'PLANNING_ASSIGNMENT' || notif.type === 'PLANNING_ASSIGNMENT_SUMMARY') {
            setSelectedNotification(notif);
        } else {
            if (notif.type === 'TIME_EDIT_REQUEST') router.push('/timesheets');
            else if (notif.type === 'PLANNING_ASSIGNMENT' || notif.type === 'PLANNING_ASSIGNMENT_SUMMARY') router.push('/');
        }
        setIsOpen(false);
    };

    const handleAcceptModification = async () => {
        if (!selectedNotification) return;
        try {
            const notif = selectedNotification;
            const resData = notif.metadata;
            const isModification = resData || notif.message?.includes('modificar');
            let success = true;

            if (isModification) {
                if (!resData) {
                    showToast('Esta es una solicitud antigua sin datos detallados. Pida al operador que la cargue de nuevo.', 'error');
                    return;
                }
                // Modify existing entry
                const res = await fetch('/api/time-entries', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: notif.relatedId,
                        horaIngreso: resData.horaIngreso,
                        horaEgreso: resData.horaEgreso,
                        isExtra: resData.isExtra,
                        requestUserId: user.id,
                        requestUserRole: user.role
                    })
                });
                if (!res.ok) success = false;
            } else {
                // Delete request
                const res = await fetch(`/api/time-entries?id=${notif.relatedId}&requestUserId=${user.id}&requestUserRole=${user.role}`, {
                    method: 'DELETE'
                });
                if (!res.ok) success = false;
            }

            if (!success) {
                showToast('Error procesando la solicitud en el servidor.', 'error');
                return;
            }

            await fetch('/api/notifications', {
                method: 'POST',
                body: JSON.stringify({
                    operatorId: notif.operatorId,
                    forSupervisors: false,
                    title: 'Solicitud Aprobada',
                    message: `Tu solicitud para ${resData ? 'modificar' : 'eliminar'} el registro ha sido aprobada.`,
                    type: 'SYSTEM_MESSAGE'
                }),
                headers: { 'Content-Type': 'application/json' }
            });

            await fetch(`/api/notifications/${notif.id}`, { method: 'DELETE' });
            setNotifications(prev => prev.filter(n => n.id !== notif.id));
            setSelectedNotification(null);
            showToast('Modificación aprobada y aplicada.', 'success');
            setTimeout(() => window.location.reload(), 1000);
        } catch (e) {
            console.error(e);
            showToast('Hubo un error al procesar la solicitud.', 'error');
        }
    };

    const handleRejectModification = async () => {
        if (!selectedNotification) return;
        try {
            const notif = selectedNotification;
            const resData = notif.metadata;

            await fetch('/api/notifications', {
                method: 'POST',
                body: JSON.stringify({
                    operatorId: notif.operatorId,
                    forSupervisors: false,
                    title: 'Solicitud Rechazada',
                    message: `Tu solicitud para ${resData ? 'modificar' : 'eliminar'} el registro ha sido rechazada por el supervisor.`,
                    type: 'SYSTEM_MESSAGE'
                }),
                headers: { 'Content-Type': 'application/json' }
            });

            await fetch(`/api/notifications/${notif.id}`, { method: 'DELETE' });
            setNotifications(prev => prev.filter(n => n.id !== notif.id));
            setSelectedNotification(null);
            showToast('Solicitud rechazada.', 'success');
        } catch (e) {
            console.error(e);
            showToast('Hubo un error al rechazar la solicitud.', 'error');
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <>
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="relative p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
                >
                    <Bell className="w-6 h-6" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
                    )}
                </button>

                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden ring-1 ring-slate-900/5 origin-top-right animate-in fade-in slide-in-from-top-2">
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <h3 className="font-bold text-slate-800">Notificaciones</h3>
                                {unreadCount > 0 && (
                                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">{unreadCount} nuevas</span>
                                )}
                            </div>

                            <div className="max-h-96 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 text-sm font-medium">
                                        No hay notificaciones
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-50">
                                        {notifications.map(notif => (
                                            <div
                                                key={notif.id}
                                                onClick={() => handleNotificationClick(notif)}
                                                className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors relative flex gap-3 ${!notif.read ? 'bg-primary/5' : ''}`}
                                            >
                                                <div className="mt-1">
                                                    {!notif.read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5"></div>}
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className={`text-sm ${!notif.read ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>
                                                        {notif.title}
                                                    </h4>
                                                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                                        {notif.message}
                                                    </p>
                                                    <span className="text-[10px] text-slate-400 mt-2 block uppercase tracking-wider font-semibold">
                                                        {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                {!notif.read && (
                                                    <button
                                                        onClick={(e) => markAsRead(notif.id, e)}
                                                        className="p-1.5 hover:bg-primary/10 rounded-lg text-primary/60 hover:text-primary transition-colors h-fit"
                                                        title="Marcar como leída"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {mounted && typeof document !== 'undefined' && createPortal(
                <>
                    {selectedNotification && selectedNotification.type === 'TIME_MODIFICATION_REQUEST' && (
                        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                            <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden p-8 relative">
                                <button onClick={() => setSelectedNotification(null)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-400">
                                    <X className="w-5 h-5" />
                                </button>
                                <div className="mb-6">
                                    <h3 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                                        <AlertCircle className="w-6 h-6 text-indigo-500" />
                                        {(selectedNotification.metadata || selectedNotification.message?.includes('modificar')) ? 'Modificación Solicitada' : 'Eliminación Solicitada'}
                                    </h3>
                                    <p className="text-sm text-slate-500 mt-2 font-medium bg-slate-50 p-4 rounded-xl border border-slate-100 italic">
                                        "{selectedNotification.message.split('Motivo:')[1]?.trim() || 'Sin motivo especificado'}"
                                    </p>
                                </div>

                                {selectedNotification.metadata && (
                                    <div className="bg-indigo-50/50 rounded-2xl p-5 mb-6 border border-indigo-100/50">
                                        <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3">Cambios Solicitados</h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-500 font-medium">Hora Inicio:</span>
                                                <span className="font-bold text-slate-800">{selectedNotification.metadata.horaIngreso || '-'}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-500 font-medium">Hora Fin:</span>
                                                <span className="font-bold text-slate-800">{selectedNotification.metadata.horaEgreso || '-'}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-500 font-medium">Horas Extras:</span>
                                                <span className="font-bold text-slate-800">{selectedNotification.metadata.isExtra ? 'Sí' : 'No'}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <button onClick={handleRejectModification} className="flex-1 py-4 bg-rose-50 text-rose-600 rounded-xl font-bold hover:bg-rose-100 transition-colors">Rechazar</button>
                                    <button onClick={handleAcceptModification} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95">Aprobar</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedNotification && selectedNotification.type === 'PLANNING_ASSIGNMENT' && (
                        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                            <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden p-8 relative max-h-[90vh] overflow-y-auto">
                                <button onClick={() => setSelectedNotification(null)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-400 z-10">
                                    <X className="w-5 h-5" />
                                </button>
                                <div className="mb-6 pr-8">
                                    <h3 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                                        <Calendar className="w-6 h-6 text-primary" />
                                        Planificación del Día
                                    </h3>
                                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
                                        {(() => {
                                            try {
                                                const d = new Date(selectedNotification.metadata.fecha + 'T12:00:00');
                                                const day = format(d, 'EEEE', { locale: es });
                                                return `${day.charAt(0).toUpperCase() + day.slice(1)} ${format(d, 'dd/MM/yyyy')}`;
                                            } catch (e) {
                                                return selectedNotification.metadata?.fecha;
                                            }
                                        })()}
                                    </p>
                                </div>

                                {selectedNotification.metadata?.assignments?.length > 0 ? (
                                    <div className="space-y-4 mb-6">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Tus Proyectos Asignados</h4>
                                        {selectedNotification.metadata.assignments.map((assignment: any, i: number) => (
                                            <div key={i} className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
                                                <h5 className="font-bold text-slate-800 text-lg mb-2">{assignment.projectName}</h5>
                                                <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                                                    <Clock className="w-4 h-4 text-primary shrink-0" />
                                                    <span className="font-medium">{assignment.startTime || '-'} a {assignment.endTime || '-'}</span>
                                                </div>
                                                {assignment.companionNames && assignment.companionNames.length > 0 && (
                                                    <div className="mt-3">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Compañeros:</span>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {assignment.companionNames.map((name: string, j: number) => (
                                                                <span key={j} className="text-xs bg-white text-slate-600 px-2 py-1 rounded-md border border-slate-100 shadow-sm">{name}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {assignment.note && (
                                                    <div className="mt-3 bg-white p-3 rounded-xl border border-amber-100">
                                                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block mb-1">Nota de la Asignación:</span>
                                                        <p className="text-sm text-slate-700 italic">{assignment.note}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500 italic mb-6">No tienes proyectos asignados específicamente, más allá de las notas generales.</p>
                                )}

                                {selectedNotification.metadata?.notes?.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest">Notas Generales del Día</h4>
                                        {selectedNotification.metadata.notes.map((noteBlock: any, i: number) => (
                                            <div key={i} className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                                                <p className="text-sm text-amber-900 font-medium">"{noteBlock.note}"</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-8">
                                    <button onClick={() => setSelectedNotification(null)} className="w-full py-4 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cerrar</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedNotification && selectedNotification.type === 'PLANNING_ASSIGNMENT_SUMMARY' && (
                        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                            <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden p-8 relative max-h-[90vh] overflow-y-auto">
                                <button onClick={() => setSelectedNotification(null)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-400 z-10">
                                    <X className="w-5 h-5" />
                                </button>
                                <div className="mb-6 pr-8">
                                    <h3 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                                        <ShieldAlert className="w-6 h-6 text-indigo-500" />
                                        Resumen de Planificación
                                    </h3>
                                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
                                        {(() => {
                                            try {
                                                const d = new Date(selectedNotification.metadata.fecha + 'T12:00:00');
                                                const day = format(d, 'EEEE', { locale: es });
                                                return `${day.charAt(0).toUpperCase() + day.slice(1)} ${format(d, 'dd/MM/yyyy')}`;
                                            } catch (e) {
                                                return selectedNotification.metadata?.fecha;
                                            }
                                        })()}
                                    </p>
                                </div>

                                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-6">
                                    <pre className="text-sm text-indigo-900 font-mono whitespace-pre-wrap leading-relaxed">
                                        {selectedNotification.message}
                                    </pre>
                                </div>

                                <div className="mt-8">
                                    <button onClick={() => setSelectedNotification(null)} className="w-full py-4 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cerrar Resumen</button>
                                </div>
                            </div>
                        </div>
                    )}
                </>,
                document.body
            )}
        </>
    );
}
