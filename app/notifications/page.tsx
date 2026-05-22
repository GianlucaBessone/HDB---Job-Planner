'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { Bell, Check, Trash2, ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';
import { formatDateTime } from '@/lib/formatDate';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

function NotificationsContent() {
    const [user, setUser] = useState<any>(null);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'unread' | 'read'>('unread');
    const [unreadSubTab, setUnreadSubTab] = useState<'generales' | 'prioritarias'>('prioritarias');
    const [showClearModal, setShowClearModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [highlightId, setHighlightId] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();

    const isPriorityNotification = (n: any) => {
        const type = (n.type || '').toUpperCase();
        const title = (n.title || '').toUpperCase();
        return (
            type.includes('REVIEW') ||
            type.includes('APPROVE') ||
            type.includes('AUTH') ||
            type.includes('REQUEST') ||
            type.includes('TRAINING') ||
            type.includes('REJECTED') ||
            type.includes('REQUIRED') ||
            title.includes('REQUERIDA') ||
            title.includes('REQUERIDO') ||
            title.includes('APROBAR') ||
            title.includes('FIRMA') ||
            title.includes('OBSERVADO')
        );
    };

    const getDisplayedNotifications = () => {
        return notifications.filter(n => {
            if (activeTab === 'read') return n.read;
            if (n.read) return false;
            const priority = isPriorityNotification(n);
            return unreadSubTab === 'prioritarias' ? priority : !priority;
        });
    };

    const handleClearAll = async () => {
        if (!user) return;
        const currentDisplayed = getDisplayedNotifications();
        const idsToClear = currentDisplayed.map(n => n.id);
        if (idsToClear.length === 0) return;

        try {
            const res = await safeApiRequest(`/api/notifications?operatorId=${user.id}&role=${user.role}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: idsToClear })
            });
            if (res.ok) {
                setNotifications(prev => prev.filter(n => !idsToClear.includes(n.id)));
                showToast('Notificaciones de la pestaña eliminadas', 'success');
            }
        } catch (error) {
            showToast('Error al limpiar notificaciones', 'error');
        }
    };

    useEffect(() => {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            const parsed = JSON.parse(storedUser);
            setUser(parsed);
            const highlight = searchParams.get('highlight');
            if (highlight) setHighlightId(highlight);
            loadNotifications(parsed.id, parsed.role);
        } else {
            router.push('/');
        }
    }, [router]);

    // When data loads and we have a highlight target, switch tab and scroll
    useEffect(() => {
        if (!highlightId || loading || notifications.length === 0) return;
        const notif = notifications.find(n => n.id === highlightId);
        if (!notif) return;

        // Switch to the right tab
        setActiveTab(notif.read ? 'read' : 'unread');

        // Wait for render, then scroll
        requestAnimationFrame(() => {
            setTimeout(() => {
                const el = document.getElementById(`notif-${highlightId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        });
    }, [highlightId, loading, notifications]);

    const loadNotifications = async (userId: string, role: string) => {
        setLoading(true);
        try {
            const res = await safeApiRequest(`/api/notifications?operatorId=${userId}&role=${role}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setNotifications(data);
            }
        } catch (error) {
            console.error(error);
            showToast('Error al cargar notificaciones', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleRead = async (id: string, currentReadStatus: boolean) => {
        try {
            const res = await safeApiRequest(`/api/notifications/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ read: !currentReadStatus })
            });
            if (res.ok) {
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: !currentReadStatus } : n));
                showToast(!currentReadStatus ? 'Marcada como leída' : 'Marcada como no leída', 'success');
            }
        } catch (error) {
            showToast('Error al actualizar notificación', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await safeApiRequest(`/api/notifications/${id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setNotifications(prev => prev.filter(n => n.id !== id));
                showToast('Notificación eliminada', 'success');
            }
        } catch (error) {
            showToast('Error al eliminar notificación', 'error');
        }
    };

    const displayedNotifications = getDisplayedNotifications();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900/50 pb-20 pt-8 px-4 md:px-8 max-w-3xl mx-auto">
            <div className="flex items-center justify-between gap-3 mb-8">
                <div className="flex items-center gap-2 min-w-0">
                    <Link href="/" className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition shrink-0">
                        <ArrowRight className="w-5 h-5 text-slate-500 dark:text-slate-400 rotate-180" />
                    </Link>
                    <h1 className="text-lg sm:text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5 truncate">
                        <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
                        <span className="truncate">Centro de Notificaciones</span>
                    </h1>
                </div>
                {notifications.length > 0 && (
                    <button
                        onClick={() => setShowClearModal(true)}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-rose-100 shadow-sm shrink-0"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Limpiar Notificaciones</span>
                        <span className="sm:hidden">Limpiar</span>
                    </button>
                )}
            </div>

            <div className="flex p-1 bg-slate-200/50 rounded-2xl mb-6">
                <button
                    onClick={() => setActiveTab('unread')}
                    className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'unread' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    No leídas ({notifications.filter(n => !n.read).length})
                </button>
                <button
                    onClick={() => setActiveTab('read')}
                    className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'read' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Leídas ({notifications.filter(n => n.read).length})
                </button>
            </div>

            {activeTab === 'unread' && (
                <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 gap-6">
                    <button
                        onClick={() => setUnreadSubTab('prioritarias')}
                        className={`pb-3 text-sm font-bold transition-all border-b-2 ${unreadSubTab === 'prioritarias' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Prioritarias ({notifications.filter(n => !n.read && isPriorityNotification(n)).length})
                    </button>
                    <button
                        onClick={() => setUnreadSubTab('generales')}
                        className={`pb-3 text-sm font-bold transition-all border-b-2 ${unreadSubTab === 'generales' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Generales ({notifications.filter(n => !n.read && !isPriorityNotification(n)).length})
                    </button>
                </div>
            )}

            {loading ? (
                <div className="text-center py-10">
                    <div className="w-8 h-8 border-4 border-slate-200 dark:border-slate-700 border-t-primary rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-sm font-bold text-slate-400 dark:text-slate-500">Cargando notificaciones...</p>
                </div>
            ) : displayedNotifications.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                    <Bell className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">No tienes notificaciones {activeTab === 'unread' ? (unreadSubTab === 'prioritarias' ? 'prioritarias' : 'generales') : 'leídas'}.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {displayedNotifications.map((notification) => {
                        const isHighlighted = notification.id === highlightId;
                        const match = notification.message.match(/\[(Nota|Reporte|Consulta|Bloqueante)\]/);
                        const category = match ? match[1] : null;
                        const cleanMessage = match ? notification.message.replace(match[0], '').trim() : notification.message;
                        const catStyles: Record<string, string> = {
                            Bloqueante: 'bg-red-100 text-red-700 border-red-200',
                            Reporte:    'bg-emerald-100 text-emerald-700 border-emerald-200',
                            Consulta:   'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
                            Nota:       'bg-blue-100 text-blue-700 border-blue-200',
                        };

                        return (
                        <div
                            key={notification.id}
                            id={`notif-${notification.id}`}
                            className={`p-5 rounded-3xl border transition-all ${
                                notification.read ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-70' : 'bg-white dark:bg-slate-800 border-indigo-100 shadow-md shadow-indigo-100/50'
                            } ${isHighlighted ? 'ring-2 ring-primary ring-offset-2 scale-[1.01] shadow-lg shadow-primary/10' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="space-y-1.5 flex-1 pr-4">
                                    <h3 className={`text-base font-black ${notification.read ? 'text-slate-700 dark:text-slate-200' : 'text-indigo-900'}`}>{notification.title}</h3>
                                    {category && (
                                        <div className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-widest ${catStyles[category] || catStyles['Nota']}`}>
                                            {category === 'Bloqueante' && '🚨 '}{category}
                                        </div>
                                    )}
                                </div>
                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded-lg shrink-0">
                                    {formatDateTime(notification.createdAt).replace(' ', ' - ')}
                                </span>
                            </div>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-pre-wrap mb-4">
                                {cleanMessage}
                            </p>
                            
                            <div className="flex justify-end gap-2 border-t border-slate-50 pt-3">
                                <button
                                    onClick={() => handleToggleRead(notification.id, notification.read)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${notification.read ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                                >
                                    {notification.read ? (
                                        <><Circle className="w-3.5 h-3.5" /> Marcar no leída</>
                                    ) : (
                                        <><CheckCircle2 className="w-3.5 h-3.5" /> Marcar como leída</>
                                    )}
                                </button>
                                <button
                                    onClick={() => handleDelete(notification.id)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Eliminar
                                </button>
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}

            {showClearModal && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full border border-slate-100 dark:border-slate-700 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-600 mb-2">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">¿Limpiar notificaciones?</h3>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                Esta acción eliminará permanentemente todas sus notificaciones. No se puede deshacer.
                            </p>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setShowClearModal(false)}
                                className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    setShowClearModal(false);
                                    await handleClearAll();
                                }}
                                className="flex-1 py-3 text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition shadow-lg shadow-rose-600/20"
                            >
                                Sí, limpiar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function NotificationsPage() {
    return (
        <Suspense fallback={
            <div className="space-y-4">
                <div className="h-12 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />)}
            </div>
        }>
            <NotificationsContent />
        </Suspense>
    );
}
