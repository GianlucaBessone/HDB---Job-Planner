import { useState, useEffect } from 'react';
import { X, Calendar, GitBranch, Target, Users, Clock, AlertTriangle, Edit, Trash2 } from 'lucide-react';
import { useModalScroll } from '@/lib/useModalScroll';
import NewRootCauseModal from './NewRootCauseModal';
import NewMeetingModal from './NewMeetingModal';
import NewCapaModal from './NewCapaModal';
import ConfirmModal from '@/components/ConfirmModal';

interface NcDetailModalProps {
    ncId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
}

export default function NcDetailModal({ ncId, isOpen, onClose, onUpdate }: NcDetailModalProps) {
    useModalScroll(isOpen);

    const [nc, setNc] = useState<any>(null);
    const [operators, setOperators] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'detalles' | 'causa' | 'reuniones' | 'acciones'>('detalles');
    const [isRootCauseModalOpen, setIsRootCauseModalOpen] = useState(false);
    const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
    const [isCapaModalOpen, setIsCapaModalOpen] = useState(false);
    const [editingMeeting, setEditingMeeting] = useState<any>(null);
    const [meetingToDelete, setMeetingToDelete] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/operators')
            .then(res => res.json())
            .then(data => setOperators(data))
            .catch(err => console.error("Error fetching operators:", err));
    }, []);

    const fetchNcDetails = async () => {
        if (!ncId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/sgi/nc/${ncId}`);
            if (res.ok) {
                const data = await res.json();
                setNc(data);
            }
        } catch (error) {
            console.error('Error fetching NC details:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && ncId) {
            fetchNcDetails();
            setActiveTab('detalles');
        }
    }, [isOpen, ncId]);

    const handleStatusChange = async (newStatus: string) => {
        try {
            const res = await fetch(`/api/sgi/nc/${ncId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: newStatus })
            });
            if (res.ok) {
                fetchNcDetails();
                onUpdate();
            }
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const handleResponsableChange = async (newResponsableId: string) => {
        try {
            const res = await fetch(`/api/sgi/nc/${ncId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ responsableTratamientoId: newResponsableId || null })
            });
            if (res.ok) {
                fetchNcDetails();
                onUpdate();
            }
        } catch (error) {
            console.error('Error updating responsable:', error);
        }
    };

    const handleDeleteMeeting = async (id: string) => {
        try {
            const res = await fetch(`/api/sgi/reunion/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchNcDetails();
                onUpdate();
            }
        } catch (err) { console.error(err); }
        setMeetingToDelete(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-card w-full max-w-5xl rounded-xl shadow-xl flex flex-col h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${nc?.criticidad === 'Crítica' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                {nc?.codigoNC || 'Cargando...'}
                                {nc && (
                                    <select 
                                        className="text-xs font-medium bg-background border px-2 py-1 rounded-full cursor-pointer ml-2"
                                        value={nc.estado}
                                        onChange={(e) => handleStatusChange(e.target.value)}
                                    >
                                        <option value="Abierta">Abierta</option>
                                        <option value="En análisis">En análisis</option>
                                        <option value="Acción definida">Acción definida</option>
                                        <option value="En ejecución">En ejecución</option>
                                        <option value="Pendiente de validación">Pendiente validación</option>
                                        <option value="Cerrada">Cerrada</option>
                                    </select>
                                )}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {nc?.tipoNC} • {nc?.categoria}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-4 border-b bg-muted/10">
                    <button 
                        onClick={() => setActiveTab('detalles')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'detalles' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Detalles Generales</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('causa')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'causa' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        <span className="flex items-center gap-2"><GitBranch className="w-4 h-4" /> Análisis Causa Raíz</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('reuniones')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'reuniones' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Reuniones ({nc?.reuniones?.length || 0})</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('acciones')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'acciones' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        <span className="flex items-center gap-2"><Target className="w-4 h-4" /> Acciones CAPA ({nc?.accionesMejora?.length || 0})</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 bg-muted/5">
                    {loading || !nc ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <>
                            {/* DETALLES */}
                            {activeTab === 'detalles' && (
                                <div className="space-y-6 max-w-4xl animate-in fade-in">
                                    <div className="bg-card p-5 rounded-lg border shadow-sm">
                                        <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Descripción del Hallazgo</h3>
                                        <p className="text-foreground whitespace-pre-wrap">{nc.descripcion}</p>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div className="bg-card p-4 rounded-lg border shadow-sm">
                                                <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase">Información de Origen</h3>
                                                <div className="grid grid-cols-2 gap-y-3 text-sm">
                                                    <span className="text-muted-foreground">Fecha Detección:</span>
                                                    <span className="font-medium">{new Date(nc.fechaDeteccion).toLocaleDateString()}</span>
                                                    <span className="text-muted-foreground">Origen:</span>
                                                    <span className="font-medium">{nc.origen}</span>
                                                    <span className="text-muted-foreground">Proceso Afectado:</span>
                                                    <span className="font-medium">{nc.procesoAfectado || '-'}</span>
                                                    <span className="text-muted-foreground">Área Afectada:</span>
                                                    <span className="font-medium">{nc.areaAfectada || '-'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            <div className="bg-card p-4 rounded-lg border shadow-sm">
                                                <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase">Evaluación e Impacto</h3>
                                                <div className="grid grid-cols-2 gap-y-3 text-sm">
                                                    <span className="text-muted-foreground">Criticidad:</span>
                                                    <span className={`font-medium ${nc.criticidad === 'Crítica' ? 'text-red-600' : ''}`}>{nc.criticidad}</span>
                                                    <span className="text-muted-foreground">Impacto:</span>
                                                    <span className="font-medium">{nc.impacto || 'No definido'}</span>
                                                    <span className="text-muted-foreground">Resp. Registro:</span>
                                                    <span className="font-medium">{nc.responsableRegistro?.nombreCompleto || 'Sistema'}</span>
                                                    <span className="text-muted-foreground flex items-center">Resp. Tratamiento:</span>
                                                    <div className="relative -ml-2">
                                                        <select 
                                                            className="font-medium bg-muted/20 hover:bg-muted/50 border border-transparent hover:border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background cursor-pointer w-full text-sm py-1 px-2 appearance-none transition-colors"
                                                            value={nc.responsableTratamientoId || ''}
                                                            onChange={(e) => handleResponsableChange(e.target.value)}
                                                        >
                                                            <option value="">Sin asignar (Pendiente)</option>
                                                            {operators.filter(op => op.activo !== false).map(op => (
                                                                <option key={op.id} value={op.id}>{op.nombreCompleto}</option>
                                                            ))}
                                                        </select>
                                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                                                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CAUSA RAIZ */}
                            {activeTab === 'causa' && (
                                <div className="space-y-4 animate-in fade-in">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-lg">Metodología de los 5 Porqués / Ishikawa</h3>
                                        <button className="btn-secondary text-sm" onClick={() => setIsRootCauseModalOpen(true)}>
                                            + Registrar Análisis
                                        </button>
                                    </div>
                                    {nc.analisisCausaRaiz?.length > 0 ? (
                                        <div className="space-y-3">
                                            {nc.analisisCausaRaiz.map((acr: any) => (
                                                <div key={acr.id} className="bg-card p-4 rounded-lg border">
                                                    <span className="text-xs font-semibold text-primary">{acr.metodologia}</span>
                                                    <p className="text-sm mt-2">{acr.descripcion}</p>
                                                    <div className="text-xs text-muted-foreground mt-3 flex items-center gap-4">
                                                        <span>Por: {acr.participantes?.join(', ') || 'Equipo'}</span>
                                                        <span>{new Date(acr.fechaAnalisis).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center p-8 border border-dashed rounded-lg bg-card">
                                            <GitBranch className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                                            <p className="text-muted-foreground text-sm">Aún no se ha registrado un análisis de causa raíz para esta NC.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* REUNIONES */}
                            {activeTab === 'reuniones' && (
                                <div className="space-y-4 animate-in fade-in">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-lg">Reuniones de Tratamiento</h3>
                                        <button className="btn-secondary text-sm" onClick={() => { setEditingMeeting(null); setIsMeetingModalOpen(true); }}>
                                            + Programar Reunión
                                        </button>
                                    </div>
                                    {nc.reuniones?.length > 0 ? (
                                        <div className="space-y-3">
                                            {nc.reuniones.map((r: any) => (
                                                <div key={r.id} className="bg-card p-4 rounded-lg border flex justify-between items-start group">
                                                    <div>
                                                        <h4 className="font-medium text-sm">{r.agenda || 'Reunión'}</h4>
                                                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                            <Calendar className="w-3 h-3" />
                                                            <span>{new Date(r.fecha).toLocaleString()}</span>
                                                        </div>
                                                        {r.participantes?.length > 0 && (
                                                            <div className="mt-2 text-xs text-muted-foreground">
                                                                Participantes: {r.participantes.join(', ')}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => { setEditingMeeting(r); setIsMeetingModalOpen(true); }}
                                                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => setMeetingToDelete(r.id)}
                                                            className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center p-8 border border-dashed rounded-lg bg-card">
                                            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                                            <p className="text-muted-foreground text-sm">No hay reuniones programadas.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ACCIONES */}
                            {activeTab === 'acciones' && (
                                <div className="space-y-4 animate-in fade-in">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-lg">Plan de Acción (CAPA)</h3>
                                        <button className="btn-secondary text-sm" onClick={() => setIsCapaModalOpen(true)}>
                                            + Vincular Acción
                                        </button>
                                    </div>
                                    {nc.accionesMejora?.length > 0 ? (
                                        <div className="space-y-3">
                                            {nc.accionesMejora.map((a: any) => (
                                                <div key={a.id} className="bg-card p-4 rounded-lg border flex items-center justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-semibold text-sm text-primary">{a.codigoAccion}</span>
                                                            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{a.estado}</span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">{a.descripcion || 'Acción vinculada'}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-20 bg-muted rounded-full h-1.5">
                                                            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${a.porcentajeAvance || 0}%` }}></div>
                                                        </div>
                                                        <span className="text-xs text-muted-foreground w-8 text-right">{a.porcentajeAvance || 0}%</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center p-8 border border-dashed rounded-lg bg-card">
                                            <Target className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                                            <p className="text-muted-foreground text-sm">No hay acciones preventivas o correctivas vinculadas.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {ncId && (
                <>
                    <NewRootCauseModal
                        isOpen={isRootCauseModalOpen}
                        onClose={() => setIsRootCauseModalOpen(false)}
                        onSuccess={() => { setIsRootCauseModalOpen(false); fetchNcDetails(); onUpdate(); }}
                        ncId={ncId}
                    />
                    <NewMeetingModal
                        isOpen={isMeetingModalOpen}
                        onClose={() => setIsMeetingModalOpen(false)}
                        onSuccess={() => { setIsMeetingModalOpen(false); fetchNcDetails(); onUpdate(); }}
                        ncId={ncId}
                        initialData={editingMeeting}
                    />
                    <NewCapaModal
                        isOpen={isCapaModalOpen}
                        onClose={() => setIsCapaModalOpen(false)}
                        onSuccess={() => { setIsCapaModalOpen(false); fetchNcDetails(); onUpdate(); }}
                        user={null}
                        initialNcId={ncId}
                    />
                    <ConfirmModal
                        isOpen={!!meetingToDelete}
                        onClose={() => setMeetingToDelete(null)}
                        onConfirm={() => meetingToDelete && handleDeleteMeeting(meetingToDelete)}
                        title="Eliminar Reunión"
                        message="¿Está seguro de que desea eliminar esta reunión? Esta acción no se puede deshacer y se borrará del historial del desvío."
                        isDestructive={true}
                        confirmText="Eliminar Reunión"
                    />
                </>
            )}
        </div>
    );
}
