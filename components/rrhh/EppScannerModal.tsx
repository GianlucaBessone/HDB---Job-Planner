'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RefreshCw, AlertCircle } from 'lucide-react';

interface EppScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScanSuccess: (scannedText: string) => void;
}

export default function EppScannerModal({ isOpen, onClose, onScanSuccess }: EppScannerModalProps) {
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const containerId = 'epp-qr-scanner-region';

    useEffect(() => {
        if (!isOpen) {
            stopScanner();
            return;
        }

        const timer = setTimeout(() => {
            startScanner();
        }, 200);

        return () => {
            clearTimeout(timer);
            stopScanner();
        };
    }, [isOpen]);

    const startScanner = async () => {
        try {
            setCameraError(null);
            const html5QrCode = new Html5Qrcode(containerId);
            scannerRef.current = html5QrCode;

            await html5QrCode.start(
                { facingMode: 'environment' },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 }
                },
                (decodedText) => {
                    stopScanner().then(() => {
                        onScanSuccess(decodedText);
                        onClose();
                    });
                },
                () => {
                    // Ignore frame scan failures
                }
            );

            setIsScanning(true);
        } catch (err: any) {
            console.error('Error al iniciar cámara EPP:', err);
            setCameraError('No se pudo acceder a la cámara. Verifique los permisos en el navegador.');
        }
    };

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                if (scannerRef.current.isScanning) {
                    await scannerRef.current.stop();
                }
                scannerRef.current.clear();
            } catch (e) {
                console.error('Error al detener escáner:', e);
            }
            scannerRef.current = null;
        }
        setIsScanning(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-xl">
                            <Camera className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                                Escanear Operador o DNI
                            </h3>
                            <p className="text-[11px] text-slate-400">
                                Apunte la cámara al código QR o DNI
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Scanner Body */}
                <div className="p-6 flex flex-col items-center">
                    <div className="relative w-full aspect-square max-w-[300px] bg-black rounded-2xl overflow-hidden border-2 border-dashed border-indigo-500/50 flex items-center justify-center">
                        <div id={containerId} className="w-full h-full [&>video]:!w-full [&>video]:!h-full [&>video]:!object-cover [&>canvas]:!hidden" />

                        {!isScanning && !cameraError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-950/80">
                                <RefreshCw className="w-6 h-6 animate-spin mb-2 text-indigo-400" />
                                <span className="text-xs">Iniciando cámara...</span>
                            </div>
                        )}

                        {cameraError && (
                            <div className="absolute inset-0 p-4 flex flex-col items-center justify-center text-center bg-slate-950/90 text-rose-400 space-y-2">
                                <AlertCircle className="w-8 h-8" />
                                <span className="text-xs">{cameraError}</span>
                            </div>
                        )}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-4">
                        Detecta automáticamente credenciales QR o códigos de barras PDF417 de DNI.
                    </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-all"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
