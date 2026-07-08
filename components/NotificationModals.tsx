import { X, AlertCircle, Calendar, Clock, BookOpen, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';
import ProjectFinalizeAuthModal from '@/components/ProjectFinalizeAuthModal';

export default function NotificationModals({ selectedNotification, user, onClose, onSuccess }: any) {
    if (!selectedNotification) return null;

    const handleAcceptModification = async () => {
        if (!selectedNotification || (user?.role === 'operador')) return;
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

            await safeApiRequest(`/api/activities/${notif.recipientId}`, { method: 'DELETE' });
            onSuccess(notif.id);
            onClose();
            showToast('Modificación aprobada y aplicada.', 'success');
        } catch (e) {
            console.error(e);
            showToast('Hubo un error al procesar la solicitud.', 'error');
        }
    };

    const handleRejectModification = async () => {
        if (!selectedNotification || (user?.role === 'operador')) return;
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

            await safeApiRequest(`/api/activities/${notif.recipientId}`, { method: 'DELETE' });
            onSuccess(notif.id);
            onClose();
            showToast('Solicitud rechazada.', 'success');
        } catch (e) {
            console.error(e);
            showToast('Hubo un error al rechazar la solicitud.', 'error');
        }
    };

    return (
        <>
            {selectedNotification.type === 'TIME_MODIFICATION_REQUEST' && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-card text-card-foreground w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden p-8 relative">
                        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 dark:text-slate-500">
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

            {selectedNotification.type === 'PLANNING_ASSIGNMENT' && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-card text-card-foreground w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden p-8 relative max-h-[90vh] overflow-y-auto">
                        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 dark:text-slate-500 z-10">
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
                        
                        {selectedNotification.metadata?.generalNotes && (
                            <div className="mb-6">
                                <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Notas de Planificación</h4>
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    <p className="text-sm text-slate-700 dark:text-slate-300 italic whitespace-pre-wrap">{selectedNotification.metadata.generalNotes}</p>
                                </div>
                            </div>
                        )}
                        
                        <div className="mt-8">
                            <button onClick={onClose} className="w-full py-4 bg-muted text-muted-foreground/50 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cerrar Resumen</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedNotification.type === 'PLANNING_ASSIGNMENT_SUMMARY' && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-card text-card-foreground w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden p-8 relative max-h-[90vh] overflow-y-auto">
                        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 dark:text-slate-500 z-10">
                            <X className="w-5 h-5" />
                        </button>
                        <div className="mb-6 pr-8">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
                                <BookOpen className="w-6 h-6 text-primary" />
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

                        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-2xl p-5 mb-6 text-center">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                            <h4 className="font-bold text-emerald-800 dark:text-emerald-400 text-lg mb-1">¡Planificación enviada!</h4>
                            <p className="text-sm text-emerald-600 dark:text-emerald-500 font-medium">
                                Se ha notificado exitosamente a todos los operadores asignados y se actualizó la pizarra.
                            </p>
                        </div>

                        <div className="mt-8">
                            <button onClick={onClose} className="w-full py-4 bg-muted text-muted-foreground/50 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 transition-colors">Entendido</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedNotification.type === 'PROJECT_FINALIZE_REQUEST' && ProjectFinalizeAuthModal && (
                <ProjectFinalizeAuthModal
                    notification={selectedNotification}
                    user={user}
                    onClose={onClose}
                    onSuccess={() => {
                        onSuccess(selectedNotification.id);
                        onClose();
                    }}
                />
            )}
        </>
    );
}
