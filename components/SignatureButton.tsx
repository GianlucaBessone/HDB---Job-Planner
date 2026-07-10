'use client';

import React, { useState, useEffect } from 'react';
import { PenTool, CheckCircle2, Loader2, AlertTriangle, Fingerprint } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
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
            const res = await safeApiRequest('/api/signatures/sign', {
                method: 'POST',
                body: JSON.stringify({
                    documentId,
                    documentVersion,
                    userId: currentUser.id,
                    userName: currentUser.nombreCompleto,
                    dni: currentUser.dni,
                    deviceId
                })
            });

            if (res.ok) {
                const signature = await res.json();
                setIsSigned(true);
                showToast('Documento firmado electrónicamente con éxito', 'success');
                if (onSignComplete) onSignComplete(signature);
            } else {
                const errorData = await res.json();
                showToast(`Error al firmar: ${errorData.error || 'Desconocido'}`, 'error');
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
            className={`group relative flex items-center justify-center gap-3 px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0 border border-indigo-500/30 overflow-hidden ${className}`}
        >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
            {isSigning ? (
                <>
                    <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                    <span className="tracking-wide relative z-10">Validando Identidad...</span>
                </>
            ) : (
                <>
                    <Fingerprint className="w-6 h-6 text-indigo-200 group-hover:scale-110 transition-transform relative z-10" />
                    <span className="tracking-wide text-[15px] relative z-10">Firmar con Identidad Digital</span>
                </>
            )}
        </button>
    );
}
