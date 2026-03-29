'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    QrCode, CheckCircle2, Loader2, AlertCircle, Clock, FileText,
    User, Package, ArrowLeft, Copy, ExternalLink, FileSignature,
    Building2, Smartphone, MessageSquare
} from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import CodeBadge from '@/components/CodeBadge';

interface OrdenServicio {
    id: string;
    codigoOS?: string;
    linkPublico: string;
    estado: string;
    reporte: string;
    comentario?: string;
    fechaCreacion: string;
    project: {
        nombre: string;
        codigoProyecto?: string;
        cliente?: string;
        client?: { nombre: string };
    };
    materiales: { id: string; material: string; cantidad: number; unidadMedida: string }[];
    operadores: { id: string; horas: number; operador: { id: string; nombreCompleto: string } }[];
    firma?: { nombre: string; dni: string; fechaFirma: string };
}

function QRView() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [os, setOs] = useState<OrdenServicio | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    const publicUrl = os
        ? `${typeof window !== 'undefined' ? window.location.origin : ''}/os/${os.linkPublico}`
        : '';

    const qrUrl = publicUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(publicUrl)}`
        : '';

    useEffect(() => {
        loadOS();
        // Auto-refresh each 8 seconds to detect when client has signed
        const interval = setInterval(loadOS, 8000);
        return () => clearInterval(interval);
    }, [id]);

    const loadOS = async () => {
        try {
            const res = await safeApiRequest(`/api/ordenes-servicio/${id}`);
            if (!res.ok) { setError('Orden de servicio no encontrada.'); return; }
            const data = await res.json();
            setOs(data);
        } catch {
            setError('Error al cargar la OS.');
        } finally {
            setLoading(false);
        }
    };

    const copyLink = async () => {
        await navigator.clipboard.writeText(publicUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isFirmada = os?.estado === 'firmada';
    const clienteName = os?.project.client?.nombre || os?.project.cliente || 'No especificado';

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Cargando orden de servicio...</p>
                </div>
            </div>
        );
    }

    if (error || !os) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-lg border border-red-100 text-center space-y-4 max-w-sm w-full">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                    <p className="text-slate-600 dark:text-slate-300 font-medium">{error}</p>
                    <button onClick={() => router.back()} className="text-sm text-primary font-bold hover:underline">
                        ← Volver
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Back */}
            <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-primary transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Volver
            </button>

            {/* Status banner */}
            {isFirmada ? (
                <div className="bg-emerald-600 rounded-3xl p-6 text-white text-center space-y-3 shadow-xl shadow-emerald-200 animate-in zoom-in-95 duration-500">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-9 h-9 text-white" />
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-emerald-100">Orden de Servicio</p>
                        <h2 className="text-2xl font-black mt-1">¡Firmada!</h2>
                        <p className="text-sm text-emerald-100 font-medium mt-1">
                            Firmada por <span className="font-black text-white">{os.firma?.nombre}</span> · DNI {os.firma?.dni}
                        </p>
                    </div>
                    <button
                        onClick={() => router.push('/ordenes-servicio')}
                        className="bg-white/20 hover:bg-white/30 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all"
                    >
                        Ver listado de OS
                    </button>
                </div>
            ) : (
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-3xl p-6 text-white shadow-xl shadow-emerald-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                            <FileSignature className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100 italic">
                                {os.codigoOS || '#SIN-OS'} | {os.project.codigoProyecto || '#SIN-PR'}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-lg font-black leading-tight">
                                    {os.codigoOS ? (
                                        <span className="text-white font-mono">{os.codigoOS} | </span>
                                    ) : (
                                        <span className="opacity-50 font-mono">#SIN-OS | </span>
                                    )}
                                    {os.project.codigoProyecto ? (
                                        <span className="text-white font-mono">{os.project.codigoProyecto} | </span>
                                    ) : (
                                        <span className="opacity-50 font-mono">#SIN-PR | </span>
                                    )}
                                    {os.project.nombre}
                                </h2>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-emerald-100 font-medium">
                        <Clock className="w-3.5 h-3.5 animate-pulse" />
                        <span>Esperando firma del cliente... se actualiza automáticamente</span>
                    </div>
                </div>
            )}

            {/* QR Card */}
            {!isFirmada && (
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-50">
                        <div className="flex items-center gap-2">
                            <Smartphone className="w-4 h-4 text-emerald-600" />
                            <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                                Mostrá este QR al cliente
                            </h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                            El cliente escanea el código con su celular para ver y firmar la OS
                        </p>
                    </div>

                    {/* QR Image */}
                    <div className="flex flex-col items-center py-8 px-6 space-y-4">
                        <div className="relative">
                            {/* Decorative ring */}
                            <div className="absolute inset-0 rounded-3xl bg-emerald-50 scale-110 -z-10 border-2 border-emerald-100" />
                            <img
                                src={qrUrl}
                                alt="QR para firma de OS"
                                className="w-56 h-56 rounded-2xl border-4 border-emerald-100 shadow-lg"
                            />
                        </div>

                        <div className="text-center space-y-1">
                            <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">O compartir link</p>
                        </div>

                        {/* Link + Copy */}
                        <div className="w-full flex gap-2">
                            <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                                {publicUrl}
                            </div>
                            <button
                                onClick={copyLink}
                                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shrink-0 ${copied
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700'
                                    }`}
                            >
                                {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                {copied ? '¡Copiado!' : 'Copiar'}
                            </button>
                        </div>

                        <a
                            href={publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 py-3 border border-emerald-200 text-emerald-700 rounded-xl font-bold text-sm hover:bg-emerald-50 transition-all"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Abrir vista del cliente
                        </a>
                    </div>
                </div>
            )}

            {/* OS Summary */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50">
                    <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Resumen de la OS</h3>
                </div>
                <div className="px-6 py-4 space-y-4">
                    {/* Project info */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800/50 rounded-lg flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Cliente</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{clienteName}</p>
                        </div>
                    </div>

                    {/* Operadores */}
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Operadores</p>
                            <div className="space-y-1">
                                {os.operadores.map(op => (
                                    <div key={op.id} className="flex justify-between text-sm">
                                        <span className="font-medium text-slate-700 dark:text-slate-200">{op.operador.nombreCompleto}</span>
                                        <span className="font-black text-indigo-600">{op.horas}h</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Materiales */}
                    {os.materiales.length > 0 && (
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4 text-amber-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Materiales</p>
                                <div className="space-y-1">
                                    {os.materiales.map(m => (
                                        <div key={m.id} className="flex justify-between text-sm">
                                            <span className="font-medium text-slate-700 dark:text-slate-200">{m.material}</span>
                                            <span className="font-bold text-slate-500 dark:text-slate-400">{m.cantidad} {m.unidadMedida}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Reporte preview */}
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Reporte</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium whitespace-pre-wrap">{os.reporte}</p>
                        </div>
                    </div>

                    {/* Comentario Adicional */}
                    {os.comentario && (
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-slate-50 dark:bg-slate-900/50 rounded-lg flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-800">
                                <MessageSquare className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Comentario Adicional</p>
                                <p className="text-sm text-slate-600 dark:text-slate-300 font-medium whitespace-pre-wrap">{os.comentario}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="pb-10 pt-2">
                <button
                    onClick={() => router.push('/ordenes-servicio')}
                    className="w-full py-3.5 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all"
                >
                    Ir al listado de Órdenes de Servicio
                </button>
            </div>
        </div>
    );
}

export default function QRPage() {
    return (
        <Suspense fallback={
            <div className="max-w-lg mx-auto space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-40 bg-slate-100 dark:bg-slate-800/50 rounded-3xl animate-pulse" />)}
            </div>
        }>
            <QRView />
        </Suspense>
    );
}
