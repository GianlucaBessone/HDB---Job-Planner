'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
    ShieldCheck, Camera, Search, Wrench, Package, 
    CheckCircle2, AlertTriangle, ArrowRight, X,
    Info, Building2, ExternalLink
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Suspense } from 'react';

function PublicHerramientasContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [searchId, setSearchId] = useState('');
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => {
        const queryId = searchParams.get('id');
        if (queryId) {
            router.push(`/public/herramientas/${encodeURIComponent(queryId.trim())}`);
        }
    }, [searchParams, router]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = searchId.trim();
        if (trimmed) {
            let id = trimmed;
            if (id.includes('/public/herramientas/')) {
                const parts = id.split('/public/herramientas/');
                id = parts[1].split('?')[0].split('#')[0];
            } else if (id.startsWith('TOOL:')) {
                id = id.replace('TOOL:', '');
            } else if (id.startsWith('TOOLCART:')) {
                id = id.replace('TOOLCART:', '');
            }
            router.push(`/public/herramientas/${encodeURIComponent(id.trim())}`);
        }
    };

    const handleScan = (decodedText: string) => {
        setIsScanning(false);
        let id = decodedText;
        if (id.includes('/public/herramientas/')) {
            const parts = id.split('/public/herramientas/');
            id = parts[1].split('?')[0].split('#')[0];
        } else if (id.startsWith('TOOL:')) {
            id = id.replace('TOOL:', '');
        } else if (id.startsWith('TOOLCART:')) {
            id = id.replace('TOOLCART:', '');
        }
        id = id.trim();
        if (id) {
            router.push(`/public/herramientas/${encodeURIComponent(id)}`);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-12">
            
            {/* Top Auditor Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white py-6 sm:py-8 px-4 sm:px-6 shadow-md border-b border-indigo-900/30">
                <div className="max-w-3xl mx-auto text-center space-y-2.5 sm:space-y-3">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 mx-auto shadow-inner">
                        <ShieldCheck className="w-8 h-8 sm:w-9 sm:h-9" />
                    </div>
                    <div className="inline-flex items-center gap-2 bg-indigo-500/30 text-indigo-200 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-indigo-400/20">
                        HDB SGI • AUDITORÍA Y CONTROL
                    </div>
                    <h1 className="text-xl sm:text-3xl md:text-4xl font-black tracking-tight text-white px-2">
                        Verificación de Herramientas y Carros
                    </h1>
                    <p className="text-xs sm:text-sm text-indigo-200/80 max-w-lg mx-auto font-medium px-2">
                        Portal público de consulta técnica y control metrológico para clientes y auditores de calidad y seguridad.
                    </p>
                </div>
            </div>

            <div className="max-w-xl mx-auto px-3.5 sm:px-6 -mt-4 sm:-mt-6 space-y-4 sm:space-y-6">
                
                {/* Search & Scan Action Card */}
                <div className="bg-card text-card-foreground rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-xl border border-slate-200/80 dark:border-slate-800 space-y-5 sm:space-y-6">
                    
                    {/* Camera QR Scanner Primary Button */}
                    <div className="text-center space-y-2">
                        <button
                            onClick={() => setIsScanning(true)}
                            className="w-full py-3.5 sm:py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2.5 active:scale-98"
                        >
                            <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span>Escanear Código QR con Cámara</span>
                        </button>
                        <p className="text-[11px] font-medium text-slate-400">
                            Apunta la cámara de tu smartphone al tag o código QR del activo.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 my-2">
                        <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">o ingresa el código manual</span>
                        <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
                    </div>

                    {/* Manual Search Form */}
                    <form onSubmit={handleSearch} className="space-y-2.5">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
                            Identificador / Código de Herramienta o Carro
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Ej: EV5PR2RC, TOOL-001, CARRO-01..."
                                    value={searchId}
                                    onChange={(e) => setSearchId(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-background border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!searchId.trim()}
                                className="w-full sm:w-auto px-5 py-2.5 sm:py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold disabled:opacity-40 transition-all hover:bg-slate-800 flex items-center justify-center gap-1.5"
                            >
                                <span>Ver Estado</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </form>
                </div>

                {/* Audit Information Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200">Control Metrológico y Calibración</h3>
                        <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-relaxed">
                            Validación de fechas límites, vencimientos periódicos de control y registro de operadores certificados.
                        </p>
                    </div>

                    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center">
                            <Package className="w-4 h-4" />
                        </div>
                        <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200">Auditoría Integral de Carros</h3>
                        <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-relaxed">
                            Desglose de inventario móvil con estado individualizado de cada herramienta asignada al servicio.
                        </p>
                    </div>
                </div>

                {/* Footer Stamp */}
                <div className="text-center py-4 text-[11px] sm:text-xs text-slate-400 space-y-0.5">
                    <p className="font-semibold">HDB Servicios Eléctricos SGI</p>
                    <p className="text-[10px]">Plataforma Operativa y Aseguramiento de la Calidad.</p>
                </div>
            </div>

            {/* QR Scanner Modal */}
            {isScanning && (
                <PublicScannerModal onScan={handleScan} onClose={() => setIsScanning(false)} />
            )}
        </div>
    );
}

function PublicScannerModal({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const containerId = useRef(`landing-reader-${Math.random().toString(36).substring(2, 9)}`).current;

    useEffect(() => {
        let isCancelled = false;

        const timer = setTimeout(() => {
            if (isCancelled) return;
            const html5QrCode = new Html5Qrcode(containerId);
            scannerRef.current = html5QrCode;

            const config = { 
                fps: 15, 
                qrbox: { width: 220, height: 220 },
                aspectRatio: 1.0
            };

            html5QrCode.start(
                { facingMode: 'environment' },
                config,
                (decodedText) => {
                    if (!isCancelled) {
                        onScan(decodedText);
                        html5QrCode.stop().then(() => {
                            try { html5QrCode.clear(); } catch (_) {}
                        }).catch(() => {});
                    }
                },
                () => {}
            ).catch((err) => {
                console.error('Scanner error', err);
                if (!isCancelled) {
                    alert('No se pudo acceder a la cámara. Por favor permite el acceso para escanear.');
                    onClose();
                }
            });
        }, 100);

        return () => {
            isCancelled = true;
            clearTimeout(timer);
            if (scannerRef.current) {
                if (scannerRef.current.isScanning) {
                    scannerRef.current.stop().then(() => {
                        try { scannerRef.current?.clear(); } catch (_) {}
                    }).catch(() => {});
                } else {
                    try { scannerRef.current.clear(); } catch (_) {}
                }
            }
        };
    }, [containerId, onScan, onClose]);

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-card text-card-foreground rounded-3xl overflow-hidden shadow-2xl space-y-3">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-xs sm:text-sm">
                        <Camera className="w-4 h-4 text-indigo-600" /> Escanear QR de Herramienta
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                {/* Single camera viewport with strict overflow containment */}
                <div className="p-3">
                    <div className="relative aspect-square w-full max-w-[280px] mx-auto rounded-2xl overflow-hidden bg-slate-950 border-2 border-indigo-500/40 shadow-inner">
                        <div id={containerId} className="w-full h-full [&>video]:!w-full [&>video]:!h-full [&>video]:!object-cover [&>canvas]:!hidden" />
                    </div>
                </div>

                <div className="px-4 pb-4 text-center">
                    <p className="text-[11px] font-bold text-slate-500">Apunta la cámara al código QR de la herramienta o carro</p>
                </div>
            </div>
            <button
                onClick={onClose}
                className="mt-4 px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold text-xs uppercase tracking-widest transition-all"
            >
                Cerrar
            </button>
        </div>
    );
}

export default function PublicHerramientasPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin" />
            </div>
        }>
            <PublicHerramientasContent />
        </Suspense>
    );
}
