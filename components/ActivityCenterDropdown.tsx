'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, X, BellOff, MessageSquare, AlertTriangle, AlertCircle, Info, Clock, CheckCircle2, MoreHorizontal, User, FileText, Timer, Calendar, ShieldAlert } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/formatDate';
import { useRouter } from 'next/navigation';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { showToast } from './Toast';
import { safeApiRequest } from '@/lib/offline';
import ProjectFinalizeAuthModal from './ProjectFinalizeAuthModal';
import { useModalScroll } from '@/lib/useModalScroll';

export default function ActivityCenterDropdown({ user }: { user: any }) {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState<any>(null);
    const [mounted, setMounted] = useState(false);
    const router = useRouter();

    // Lock body scroll when a notification modal is open
    useModalScroll(!!selectedNotification);

    const knownIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        setMounted(true);
        if (!user) return;
        const fetchNotifications = async (isPoll = false) => {
            try {
                const res = await safeApiRequest(`/api/activities?operatorId=${user.id}`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    if (isPoll && knownIdsRef.current.size > 0) {
                        const newNotifs = data.filter(d => !knownIdsRef.current.has(d.id));
                        if (newNotifs.length > 0) {
                            console.log("📬 [INTERNAL_NOTIFICATION_RECEIVED]:", newNotifs[0]);
                            showToast(`Nueva notificación: ${newNotifs[0].title}`, 'success');
                        }
                    }
                    
                    data.forEach(d => knownIdsRef.current.add(d.id));
                    setNotifications(data);
                }
            } catch (err) {
                console.error('Error fetching notifications:', err);
            }
        };

        fetchNotifications();
        const interval = setInterval(() => fetchNotifications(true), 10000); // Poll every 10 seconds

        const handleFocus = () => fetchNotifications(true);
        const handleForceUpdate = () => fetchNotifications(false);
        
        window.addEventListener('focus', handleFocus);
        window.addEventListener('notifications-updated', handleForceUpdate);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('notifications-updated', handleForceUpdate);
        };
    }, [user?.id, user?.role]);

    if (!user) return null;

    const markAsRead = async (id: string, recipientId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        try {
            await safeApiRequest(`/api/activities/${recipientId}`, {
                method: 'PATCH',
                body: JSON.stringify({ read: true })
            });
        } catch (err) {
            console.error('Error marking as read', err);
        }
    };

    const handleNotificationClick = (notif: any) => {
        if (!notif.read) markAsRead(notif.id, notif.recipientId);

        // Types that have their own modal
        const hasOwnModal = [
            'TIME_MODIFICATION_REQUEST',
            'PLANNING_ASSIGNMENT',
            'PLANNING_ASSIGNMENT_SUMMARY',
            'PROJECT_FINALIZE_REQUEST'
        ].includes(notif.type);

        if (hasOwnModal) {
            setSelectedNotification(notif);
        } else if (notif.type === 'FICHADA_ALERTA' || notif.type === 'approval_required') {
            // Deep-link directly to Monitoring view
            const meta = notif.metadata && typeof notif.metadata === 'object' ? notif.metadata : {};
            router.push(meta.url || '/monitoreo-fichadas');
        } else if (notif.metadata?.url) {
            // Generic metadata url deep-link
            router.push(notif.metadata.url);
        } else {
            // No modal: navigate to notifications page and scroll to this notification
            router.push(`/notifications?highlight=${notif.id}`);
        }
        setIsOpen(false);
    };

    const handleAcceptModification = async () => {
        if (!selectedNotification || (user.role === 'operador')) return;
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
                const res = await safeApiRequest('/api/time-entries', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: notif.entityId,
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
                const res = await safeApiRequest(`/api/time-entries?id=${notif.entityId}&requestUserId=${user.id}&requestUserRole=${user.role}`, {
                    method: 'DELETE'
                });
                if (!res.ok) success = false;
            }

            if (!success) {
                showToast('Error procesando la solicitud en el servidor.', 'error');
                return;
            }

            const feedbackRes = await safeApiRequest('/api/activities', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'SYSTEM_MESSAGE',
                    priority: 'NORMAL',
                    category: 'System',
                    title: 'Solicitud Aprobada',
                    message: `Tu solicitud para ${resData ? 'modificar' : 'eliminar'} el registro ha sido aprobada.`,
                    entityType: 'general',
                    entityId: 'system',
                    recipients: [{ operatorId: notif.operatorId }]
                }),
                headers: { 'Content-Type': 'application/json' }
            });

            if (!feedbackRes.ok) {
                console.warn('Feedback notification failed to send');
            }

            await safeApiRequest(`/api/activities/${notif.recipientId}`, { method: 'DELETE' });
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
        if (!selectedNotification || (user.role === 'operador')) return;
        try {
            const notif = selectedNotification;
            const resData = notif.metadata;

            const feedbackRes = await safeApiRequest('/api/activities', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'SYSTEM_MESSAGE',
                    priority: 'NORMAL',
                    category: 'System',
                    title: 'Solicitud Rechazada',
                    message: `Tu solicitud para ${resData ? 'modificar' : 'eliminar'} el registro ha sido rechazada por el supervisor.`,
                    entityType: 'general',
                    entityId: 'system',
                    recipients: [{ operatorId: notif.operatorId }]
                }),
                headers: { 'Content-Type': 'application/json' }
            });

            if (!feedbackRes.ok) {
                console.warn('Feedback notification failed to send');
            }

            await safeApiRequest(`/api/activities/${notif.recipientId}`, { method: 'DELETE' });
            setNotifications(prev => prev.filter(n => n.id !== notif.id));
            setSelectedNotification(null);
            showToast('Solicitud rechazada.', 'success');
        } catch (e) {
            console.error(e);
            showToast('Hubo un error al rechazar la solicitud.', 'error');
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    // Grouping Logic
    const groupedNotifications = {
        hoy: [] as typeof notifications,
        ayer: [] as typeof notifications,
        semana: [] as typeof notifications,
        anteriores: [] as typeof notifications,
    };

    notifications.forEach(n => {
        const d = new Date(n.createdAt);
        if (isToday(d)) {
            groupedNotifications.hoy.push(n);
        } else if (isYesterday(d)) {
            groupedNotifications.ayer.push(n);
        } else if (isThisWeek(d)) {
            groupedNotifications.semana.push(n);
        } else {
            groupedNotifications.anteriores.push(n);
        }
    });

    const renderNotification = (notif: typeof notifications[0]) => {
        const match = notif.message.match(/\[(Nota|Reporte|Consulta|Bloqueante)\]/);
        const parsedCategory = match ? match[1] : notif.category;
        const cleanMessage = match ? notif.message.replace(match[0], '').trim() : notif.message;
        
        const catStyles: Record<string, { bg: string, text: string, border: string, icon: any }> = {
            Bloqueante: { bg: 'bg-red-50 dark:bg-red-950/20', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-900', icon: ShieldAlert },
            Reporte:    { bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-900', icon: FileText },
            Consulta:   { bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/20', text: 'text-fuchsia-700 dark:text-fuchsia-400', border: 'border-fuchsia-200 dark:border-fuchsia-900', icon: MessageSquare },
            Nota:       { bg: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-900', icon: Info },
            System:     { bg: 'bg-indigo-50 dark:bg-indigo-950/20', text: 'text-indigo-700 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-900', icon: AlertCircle },
        };
        
        const style = catStyles[parsedCategory] || catStyles['System'];
        const Icon = style.icon;

        return (
            <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer transition-all relative flex gap-4 ${!notif.read ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
            >
                <div className="shrink-0 mt-0.5 relative">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${style.bg} ${style.border} ${style.text}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    {!notif.read && <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary rounded-full border-2 border-white dark:border-slate-900 shadow-sm"></div>}
                </div>
                <div className="flex-1 min-w-0 pr-2">
                    <div className="flex flex-col gap-1 mb-1">
                        <h4 className={`text-sm ${!notif.read ? 'font-bold text-slate-800 dark:text-slate-100' : 'font-medium text-slate-600 dark:text-slate-300'}`}>
                            {notif.title}
                        </h4>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed font-medium">
                        {cleanMessage}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">
                            {formatTime(notif.createdAt)}
                        </span>
                        {parsedCategory && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                                <span className={`text-[9px] font-black uppercase tracking-widest ${style.text}`}>
                                    {parsedCategory}
                                </span>
                            </>
                        )}
                    </div>
                </div>
                {!notif.read && (
                    <button
                        onClick={(e) => markAsRead(notif.id, notif.recipientId, e)}
                        className="absolute right-4 top-4 p-1.5 hover:bg-primary/10 rounded-lg text-primary/60 hover:text-primary transition-colors h-fit"
                        title="Marcar como leída"
                    >
                        <Check className="w-4 h-4" />
                    </button>
                )}
            </div>
        );
    };

    return (
        <>
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
                >
                    <Bell className="w-6 h-6" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
                    )}
                </button>

                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-card text-card-foreground rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 z-50 overflow-hidden ring-1 ring-slate-900/5 origin-top-right animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm">
                                <div>
                                    <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 tracking-tight">Centro de Actividad</h3>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Eventos del Sistema</p>
                                </div>
                                {unreadCount > 0 && (
                                    <span className="text-xs font-black text-primary bg-primary/10 px-3 py-1.5 rounded-xl shadow-sm">{unreadCount} nuevas</span>
                                )}
                            </div>

                            <div className="max-h-[28rem] overflow-y-auto overscroll-contain">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm font-medium">
                                        No hay actividad reciente
                                    </div>
                                ) : (
                                    <div className="flex flex-col">
                                        {groupedNotifications.hoy.length > 0 && (
                                            <div>
                                                <div className="bg-slate-100/50 dark:bg-slate-900/50 px-4 py-2 text-xs font-black text-slate-500 uppercase tracking-widest border-y border-slate-100 dark:border-slate-800 sticky top-0 z-10 backdrop-blur-md">
                                                    Hoy
                                                </div>
                                                <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                                    {groupedNotifications.hoy.map(renderNotification)}
                                                </div>
                                            </div>
                                        )}
                                        {groupedNotifications.ayer.length > 0 && (
                                            <div>
                                                <div className="bg-slate-100/50 dark:bg-slate-900/50 px-4 py-2 text-xs font-black text-slate-500 uppercase tracking-widest border-y border-slate-100 dark:border-slate-800 sticky top-0 z-10 backdrop-blur-md">
                                                    Ayer
                                                </div>
                                                <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                                    {groupedNotifications.ayer.map(renderNotification)}
                                                </div>
                                            </div>
                                        )}
                                        {groupedNotifications.semana.length > 0 && (
                                            <div>
                                                <div className="bg-slate-100/50 dark:bg-slate-900/50 px-4 py-2 text-xs font-black text-slate-500 uppercase tracking-widest border-y border-slate-100 dark:border-slate-800 sticky top-0 z-10 backdrop-blur-md">
                                                    Últimos 7 días
                                                </div>
                                                <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                                    {groupedNotifications.semana.map(renderNotification)}
                                                </div>
                                            </div>
                                        )}
                                        {groupedNotifications.anteriores.length > 0 && (
                                            <div>
                                                <div className="bg-slate-100/50 dark:bg-slate-900/50 px-4 py-2 text-xs font-black text-slate-500 uppercase tracking-widest border-y border-slate-100 dark:border-slate-800 sticky top-0 z-10 backdrop-blur-md">
                                                    Más Antiguos
                                                </div>
                                                <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                                    {groupedNotifications.anteriores.map(renderNotification)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                <button
                                    onClick={() => { setIsOpen(false); router.push('/notifications'); }}
                                    className="w-full py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm"
                                >
                                    Ver toda la actividad
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {mounted && typeof document !== 'undefined' && createPortal(
                <>
                    {selectedNotification && selectedNotification.type === 'TIME_MODIFICATION_REQUEST' && (
                        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                            <div className="bg-card text-card-foreground w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden p-8 relative">
                                <button onClick={() => setSelectedNotification(null)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 dark:text-slate-500">
                                    <X className="w-5 h-5" />
                                </button>
                                <div className="mb-6">
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
                                        <AlertCircle className="w-6 h-6 text-indigo-500" />
                                        {(selectedNotification.metadata || selectedNotification.message?.includes('modificar')) ? 'Modificación Solicitada' : 'Eliminación Solicitada'}
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium bg-background text-foreground/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 italic">
                                        "{selectedNotification.message.split('Motivo:')[1]?.trim() || 'Sin motivo especificado'}"
                                    </p>
                                </div>

                                {selectedNotification.metadata && (
                                    <div className="bg-indigo-50/50 rounded-2xl p-5 mb-6 border border-indigo-100/50">
                                        <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3">Cambios Solicitados</h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-500 dark:text-slate-400 font-medium">Hora Inicio:</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-100">{selectedNotification.metadata.horaIngreso || '-'}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-500 dark:text-slate-400 font-medium">Hora Fin:</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-100">{selectedNotification.metadata.horaEgreso || '-'}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-500 dark:text-slate-400 font-medium">Horas Extras:</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-100">{selectedNotification.metadata.isExtra ? 'Sí' : 'No'}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {(user?.role === 'supervisor' || user?.role === 'admin' || user?.role === 'qa') && (
                                    <div className="flex gap-3">
                                        <button onClick={handleRejectModification} className="flex-1 py-4 bg-rose-50 text-rose-600 rounded-xl font-bold hover:bg-rose-100 transition-colors">Rechazar</button>
                                        <button onClick={handleAcceptModification} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95">Aprobar</button>
                                    </div>
                                )}
                                {user?.role === 'operador' && (
                                    <div className="p-4 bg-background text-foreground/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Pendiente de aprobación</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {selectedNotification && selectedNotification.type === 'PLANNING_ASSIGNMENT' && (
                        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                            <div className="bg-card text-card-foreground w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden p-8 relative max-h-[90vh] overflow-y-auto">
                                <button onClick={() => setSelectedNotification(null)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 dark:text-slate-500 z-10">
                                    <X className="w-5 h-5" />
                                </button>
                                <div className="mb-6 pr-8">
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
                                        <Calendar className="w-6 h-6 text-primary" />
                                        Planificación del Día
                                    </h3>
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">
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
                                        <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tus Proyectos Asignados</h4>
                                        {selectedNotification.metadata.assignments.map((assignment: any, i: number) => (
                                            <div key={i} className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
                                                <h5 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-2">{assignment.projectName}</h5>
                                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 mb-1">
                                                    <Clock className="w-4 h-4 text-primary shrink-0" />
                                                    <span className="font-medium">{assignment.startTime || '-'} a {assignment.endTime || '-'}</span>
                                                </div>
                                                {assignment.companionNames && assignment.companionNames.length > 0 && (
                                                    <div className="mt-3">
                                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Compañeros:</span>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {assignment.companionNames.map((name: string, j: number) => (
                                                                <span key={j} className="text-xs bg-card text-card-foreground text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-800 shadow-sm">{name}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {assignment.note && (
                                                    <div className="mt-3 bg-card text-card-foreground p-3 rounded-xl border border-amber-100">
                                                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block mb-1">Nota de la Asignación:</span>
                                                        <p className="text-sm text-slate-700 dark:text-slate-200 italic">{assignment.note}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500 dark:text-slate-400 italic mb-6">No tienes proyectos asignados específicamente, más allá de las notas generales.</p>
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
                                    <button onClick={() => setSelectedNotification(null)} className="w-full py-4 bg-muted text-muted-foreground/50 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cerrar</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedNotification && selectedNotification.type === 'PLANNING_ASSIGNMENT_SUMMARY' && (
                        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                            <div className="bg-card text-card-foreground w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden p-8 relative max-h-[90vh] overflow-y-auto">
                                <button onClick={() => setSelectedNotification(null)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 dark:text-slate-500 z-10">
                                    <X className="w-5 h-5" />
                                </button>
                                <div className="mb-6 pr-8">
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
                                        <ShieldAlert className="w-6 h-6 text-indigo-500" />
                                        Resumen de Planificación
                                    </h3>
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">
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
                                    <button onClick={() => setSelectedNotification(null)} className="w-full py-4 bg-muted text-muted-foreground/50 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cerrar Resumen</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedNotification && selectedNotification.type === 'PROJECT_FINALIZE_REQUEST' && (
                        <ProjectFinalizeAuthModal
                            notification={selectedNotification}
                            user={user}
                            onClose={() => setSelectedNotification(null)}
                            onSuccess={() => {
                                setNotifications(prev => prev.filter(n => n.id !== selectedNotification.id));
                            }}
                        />
                    )}
                </>,
                document.body
            )}
        </>
    );
}
