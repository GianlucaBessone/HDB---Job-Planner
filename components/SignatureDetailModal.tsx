import React from 'react';
import { X, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface Signature {
    SignatureID: string;
    DocumentID: string;
    DocumentVersion: string;
    UserID: string;
    UserName: string;
    DNI: string;
    DeviceID: string;
    IPAddress: string;
    SignedAtUTC: string;
    HashSignature: string;
    VerificationStatus: string;
    VerifiedAtUTC: string;
    VerifiedBy?: string;
    RecalculatedHash?: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    signature: Signature | null;
}

export default function SignatureDetailModal({ isOpen, onClose, signature }: Props) {
    if (!isOpen || !signature) return null;

    const getStatusIcon = (status: string) => {
        if (status === 'VALIDA') return <CheckCircle2 className="w-8 h-8 text-emerald-500" />;
        if (status === 'DATOS MODIFICADOS') return <AlertTriangle className="w-8 h-8 text-amber-500" />;
        return <XCircle className="w-8 h-8 text-rose-500" />;
    };

    const getStatusText = (status: string) => {
        if (status === 'VALIDA') return 'Firma íntegra';
        if (status === 'DATOS MODIFICADOS') return 'Datos modificados encontrados';
        return 'Posible alteración de datos';
    };

    const getStatusColor = (status: string) => {
        if (status === 'VALIDA') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (status === 'DATOS MODIFICADOS') return 'bg-amber-50 text-amber-700 border-amber-200';
        return 'bg-rose-50 text-rose-700 border-rose-200';
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        Detalle de Firma Electrónica
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className={`p-4 rounded-2xl border flex items-center gap-4 ${getStatusColor(signature.VerificationStatus)}`}>
                        {getStatusIcon(signature.VerificationStatus)}
                        <div>
                            <h4 className="font-bold text-lg">{getStatusText(signature.VerificationStatus)}</h4>
                            <p className="text-sm opacity-80">Estado actual de la verificación de integridad.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">ID de Firma</span>
                            <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200">{signature.SignatureID}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">Fecha y Hora (UTC)</span>
                            <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{new Date(signature.SignedAtUTC).toLocaleString()}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">Documento / Versión</span>
                            <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{signature.DocumentID} v{signature.DocumentVersion}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">Firmante</span>
                            <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{signature.UserName} (DNI: {signature.DNI})</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">Dispositivo / IP</span>
                            <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{signature.DeviceID} / {signature.IPAddress}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">Última Verificación</span>
                            <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{new Date(signature.VerifiedAtUTC).toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">Hash Almacenado</span>
                            <div className="bg-slate-100 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto font-mono text-xs text-slate-600 dark:text-slate-400">
                                {signature.HashSignature}
                            </div>
                        </div>

                        {signature.RecalculatedHash && (
                            <div>
                                <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">Hash Recalculado</span>
                                <div className={`p-3 rounded-lg border overflow-x-auto font-mono text-xs ${
                                    signature.HashSignature === signature.RecalculatedHash 
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400'
                                        : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400'
                                }`}>
                                    {signature.RecalculatedHash}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t bg-slate-50 dark:bg-slate-900/50 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 font-bold rounded-xl transition-colors">
                        Cerrar Detalle
                    </button>
                </div>
            </div>
        </div>
    );
}
