'use client';

import React, { useState, useEffect } from 'react';
import { PenTool, CheckCircle2, Loader2, AlertTriangle, Fingerprint } from 'lucide-react';
import { firmarDocumento } from '@/lib/signatureCliente';
import { showToast } from '@/components/Toast';

interface SignatureButtonProps {
    documentId: string;
    documentVersion: string;
    onSignComplete?: (signature: any) => void;
    className?: string;
}

export default function SignatureButton({ documentId, documentVersion, onSignComplete, className = '' }: SignatureButtonProps) {
    const [isSigning, setIsSigning] = useState(false);
    const [isSigned, setIsSigned] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [deviceId, setDeviceId] = useState<string>('UNKNOWN_DEVICE');

    useEffect(() => {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                setCurrentUser(parsedUser);
                
                if (!parsedUser.dni) {
                    fetch('/api/operators')
                        .then(r => r.json())
                        .then(ops => {
                            if (Array.isArray(ops)) {
                                const me = ops.find((o: any) => o.id === parsedUser.id);
                                if (me && me.dni) {
                                    const updatedUser = { ...parsedUser, dni: me.dni };
                                    setCurrentUser(updatedUser);
                                    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
                                }
                            }
                        })
                        .catch(() => {});
                }
            } catch (e) { }
        }
        
        const storedDevice = localStorage.getItem('deviceId');
        if (storedDevice) {
            setDeviceId(storedDevice);
        } else {
            // Generate a temporary device ID for the session if not present
            const newDevice = 'DEV-' + Math.random().toString(36).substring(2, 10).toUpperCase();
            localStorage.setItem('deviceId', newDevice);
            setDeviceId(newDevice);
        }
    }, []);

    const handleSign = async () => {
        if (!currentUser) {
            showToast('Debes iniciar sesión para firmar', 'error');
            return;
        }

        if (!currentUser.dni) {
            showToast('Debes configurar tu DNI en los Ajustes de Perfil antes de poder firmar', 'error');
            return;
        }

        setIsSigning(true);

        try {
            // Sin cola offline: si no hay red, la firma falla acá y no se reenvía después.
            // El firmante (id, nombre y DNI) lo resuelve el servidor desde la sesión.
            const resultado = await firmarDocumento({ documentId, documentVersion, deviceId });

            if (resultado.ok) {
                setIsSigned(true);
                showToast('Documento firmado electrónicamente con éxito', 'success');
                if (onSignComplete) onSignComplete(resultado.firma);
            } else if (resultado.sinConexion) {
                showToast(resultado.error, 'error');
            } else {
                showToast(`Error al firmar: ${resultado.error}`, 'error');
            }
        } catch (error) {
            console.error('Signature error:', error);
            showToast('Error de red al intentar firmar', 'error');
        } finally {
            setIsSigning(false);
        }
    };

    if (isSigned) {
        return (
            <div className={`flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-sm`}>
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Firmado Electrónicamente
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className={`flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 border border-slate-200 rounded-xl font-bold text-sm ${className}`}>
                <PenTool className="w-5 h-5 opacity-50" />
                Inicia sesión para firmar
            </div>
        );
    }

    if (!currentUser.dni) {
        return (
            <div className={`flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-bold text-sm ${className}`}>
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Configura tu DNI para firmar
            </div>
        );
    }

    return (
        <button
            onClick={handleSign}
            disabled={isSigning}
            className={`group relative flex items-center justify-center gap-3 px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold transition-all disabled:opacity-70 border border-indigo-500/30 overflow-hidden ${className}`}
        >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
            {isSigning ? (
                <>
                    <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                    <span className="tracking-wide relative z-10">Validando Identidad...</span>
                </>
            ) : (
                <>
                    <Fingerprint className="w-6 h-6 text-indigo-200 transition-transform relative z-10" />
                    <span className="tracking-wide text-[15px] relative z-10">Firmar con Identidad Digital</span>
                </>
            )}
        </button>
    );
}
