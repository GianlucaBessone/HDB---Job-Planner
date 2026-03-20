'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';
import { formatDateTime } from '@/lib/formatDate';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

export default function NotificationsPage() {
    const [user, setUser] = useState<any>(null);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'unread' | 'read'>('unread');
    const [loading, setLoading] = useState(true);
    const [highlightId, setHighlightId] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();

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

    const displayedNotifications = notifications.filter(n => activeTab === 'unread' ? !n.read : n.read);

    return (
        <div className="min-h-screen bg-slate-50 pb-20 pt-8 px-4 md:px-8 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
                <Link href="/dashboard" className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-100 transition">
                    <ArrowRight className="w-5 h-5 text-slate-500 rotate-180" />
                </Link>
                <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                    <Bell className="w-6 h-6 text-primary" />
                    Centro de Notificaciones
                </h1>
            </div>

            <div className="flex p-1 bg-slate-200/50 rounded-2xl mb-6">
                <button
                    onClick={() => setActiveTab('unread')}
                    className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'unread' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    No leídas ({notifications.filter(n => !n.read).length})
                </button>
                <button
                    onClick={() => setActiveTab('read')}
                    className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'read' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Leídas ({notifications.filter(n => n.read).length})
                </button>
            </div>

            {loading ? (
                <div className="text-center py-10">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-sm font-bold text-slate-400">Cargando notificaciones...</p>
                </div>
            ) : displayedNotifications.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
                    <Bell className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium text-sm">No tienes notificaciones {activeTab === 'unread' ? 'pendientes' : 'leídas'}.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {displayedNotifications.map((notification) => {
                        const isHighlighted = notification.id === highlightId;
                        return (
                        <div
                            key={notification.id}
                            id={`notif-${notification.id}`}
                            className={`p-5 rounded-3xl border transition-all ${
                                notification.read ? 'bg-white border-slate-200 opacity-70' : 'bg-white border-indigo-100 shadow-md shadow-indigo-100/50'
                            } ${isHighlighted ? 'ring-2 ring-primary ring-offset-2 scale-[1.01] shadow-lg shadow-primary/10' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <h3 className={`text-base font-black ${notification.read ? 'text-slate-700' : 'text-indigo-900'}`}>{notification.title}</h3>
                                <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                                    {formatDateTime(notification.createdAt).replace(' ', ' - ')}
                                </span>
                            </div>
                            <p className="text-sm font-medium text-slate-600 whitespace-pre-wrap mb-4">
                                {notification.message}
                            </p>
                            
                            <div className="flex justify-end gap-2 border-t border-slate-50 pt-3">
                                <button
                                    onClick={() => handleToggleRead(notification.id, notification.read)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${notification.read ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
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
        </div>
    );
}
