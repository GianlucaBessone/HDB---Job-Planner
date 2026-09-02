'use client';

import React, { useEffect, useState } from 'react';
import { 
    X, 
    User, 
    ShieldCheck, 
    Calendar, 
    Clock, 
    CheckCircle2, 
    AlertTriangle, 
    Package, 
    FileSignature, 
    FileText,
    PlusCircle,
    Fingerprint
} from 'lucide-react';
import { getOperatorEppProfile } from '@/app/rrhh/personal/epp/actions';
import SignatureDetailModal from '@/components/SignatureDetailModal';

interface EppOperatorDrawerProps {
    operatorId: string | null;
    onClose: () => void;
    onStartDelivery: (operatorId: string) => void;
}

export default function EppOperatorDrawer({ operatorId, onClose, onStartDelivery }: EppOperatorDrawerProps) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(null);

    useEffect(() => {
        if (!operatorId) {
            setData(null);
            return;
        }

        setLoading(true);
        getOperatorEppProfile(operatorId)
            .then(res => {
                if (res.success) {
                    setData(res.data);
                }
            })
            .finally(() => setLoading(false));
    }, [operatorId]);

    if (!operatorId) return null;

    const op = data?.operator;
    const deliveries = data?.deliveries || [];
    const requests = data?.requests || [];

    return (
        <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
                onClick={onClose} 
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
                <div className="w-screen max-w-xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-950/40">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xl border border-emerald-200 dark:border-emerald-800/40 shadow-sm">
                                {op?.nombreCompleto?.slice(0, 2).toUpperCase() || <User className="w-7 h-7" />}
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
                                    {op?.nombreCompleto || 'Cargando...'}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    DNI: {op?.dni || 'Sin registrar'} · {op?.posicion || op?.role || 'Operario'}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
                                <span className="text-sm font-medium">Cargando legajo de EPP...</span>
                            </div>
                        ) : (
                            <>
                                {/* Action Banner */}
                                <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                                            Asignación de Elementos
                                        </h4>
                                        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                                            Despachar entrega o renovación de EPP
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => onStartDelivery(operatorId)}
                                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                                    >
                                        <PlusCircle className="w-4 h-4" />
                                        Nueva Entrega
                                    </button>
                                </div>

                                {/* Historial de Entregas */}
                                <div>
                                    <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <FileSignature className="w-4 h-4 text-emerald-500" />
                                        Historial de Entregas y Actas ({deliveries.length})
                                    </h4>

                                    {deliveries.length === 0 ? (
                                        <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs font-medium">
                                            No hay registros de entrega para este operador
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {deliveries.map((del: any) => (
                                                <div
                                                    key={del.id}
                                                    className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm space-y-3"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-xs font-black text-slate-800 dark:text-slate-200">
                                                                {del.codigoActa}
                                                            </span>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                del.estado === 'FIRMADA'
                                                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                                                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                                            }`}>
                                                                {del.estado === 'FIRMADA' ? 'Firmada' : 'Pendiente de Firma'}
                                                            </span>
                                                        </div>

                                                        <span className="text-[11px] text-slate-400">
                                                            {new Date(del.fechaEntrega).toLocaleDateString()}
                                                        </span>
                                                    </div>

                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                        Entregado por: <strong className="text-slate-700 dark:text-slate-300">{del.entregadoPor || 'Supervisor'}</strong>
                                                    </div>

                                                    {/* Items de la entrega */}
                                                    <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-2.5 space-y-1.5">
                                                        {del.items?.map((item: any) => {
                                                            const isExpired = new Date(item.fechaVencimiento).getTime() < Date.now();
                                                            return (
                                                                <div key={item.id} className="flex items-center justify-between text-xs">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                                                                            {item.cantidad}x {item.eppItem?.nombre}
                                                                        </span>
                                                                        {item.talle && (
                                                                            <span className="text-[10px] px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 rounded font-medium">
                                                                                Talle {item.talle}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <span className={`text-[11px] font-medium ${isExpired ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                                                                        Vence: {new Date(item.fechaVencimiento).toLocaleDateString()}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Firma Info */}
                                                    {del.estado === 'FIRMADA' && (
                                                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                                                <Fingerprint className="w-3.5 h-3.5" />
                                                                <span>Checksum: {del.signatureHash ? `${del.signatureHash.slice(0, 16)}...` : 'Válido'}</span>
                                                            </div>

                                                            {del.signatureId && (
                                                                <button
                                                                    onClick={() => setSelectedSignatureId(del.signatureId)}
                                                                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                                                                >
                                                                    Ver Certificado
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Solicitudes del Operador */}
                                <div>
                                    <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Package className="w-4 h-4 text-indigo-500" />
                                        Solicitudes Realizadas ({requests.length})
                                    </h4>

                                    {requests.length === 0 ? (
                                        <div className="p-4 text-center text-slate-400 text-xs">
                                            Sin solicitudes pendientes
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {requests.map((req: any) => (
                                                <div key={req.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
                                                    <div>
                                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                                            {req.eppItem?.nombre}
                                                        </span>
                                                        <span className="text-slate-400 block text-[11px]">
                                                            Motivo: {req.motivo} {req.comentario ? `· "${req.comentario}"` : ''}
                                                        </span>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                        req.estado === 'PENDIENTE' ? 'bg-amber-100 text-amber-700' :
                                                        req.estado === 'APROBADA' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                                    }`}>
                                                        {req.estado}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Detalle de Firma */}
            {selectedSignatureId && (
                <SignatureDetailModal
                    isOpen={Boolean(selectedSignatureId)}
                    onClose={() => setSelectedSignatureId(null)}
                    signatureId={selectedSignatureId}
                />
            )}
        </div>
    );
}
