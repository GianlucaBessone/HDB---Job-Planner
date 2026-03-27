'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    FileSignature, Search, Eye, Download, CheckCircle2, Clock, X,
    AlertCircle, Loader2, FileText, User, Package, PenLine, Building2,
    CalendarDays, QrCode, Smartphone, Trash2, Calculator, MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import { formatDate, formatDateTime } from '@/lib/formatDate';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import CodeBadge from '@/components/CodeBadge';
import OSCobroModal from '@/components/OSCobroModal';

interface OrdenServicio {
    id: string;
    codigoOS?: string;
    linkPublico: string;
    estado: string;
    reporte: string;
    comentario?: string;
    fechaCreacion: string;
    project: {
        id: string;
        nombre: string;
        codigoProyecto?: string;
        cliente?: string;
        client?: { nombre: string };
        responsableUser?: { nombreCompleto: string };
        fechaInicio?: string;
        fechaFin?: string;
    };
    materiales: { id: string; material: string; cantidad: number; unidadMedida: string }[];
    operadores: { id: string; horas: number; isExtra?: boolean; operador: { id: string; nombreCompleto: string } }[];
    firma?: {
        nombre: string;
        dni: string;
        firmaImagen: string;
        fechaFirma: string;
    };
}

function QRImage({ url }: { url: string }) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    return (
        <div className="flex flex-col items-center gap-2">
            <img src={qrUrl} alt="QR Code" className="w-36 h-36 rounded-xl border border-slate-200 shadow-sm" />
            <p className="text-[10px] font-bold text-slate-400 text-center max-w-[160px] break-all">{url}</p>
        </div>
    );
}

function OSDetalle({ os, onClose }: { os: OrdenServicio; onClose: () => void }) {
    const printRef = useRef<HTMLDivElement>(null);
    const publicUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/os/${os.linkPublico}`
        : `/os/${os.linkPublico}`;

    const isFirmada = os.estado === 'firmada';
    const clienteName = os.project.client?.nombre || os.project.cliente || 'No especificado';


    const handleDownload = () => {
        // Use the server-side PDF API — works on all devices including mobile
        window.location.href = `/api/ordenes-servicio/${os.id}/pdf`;
    };

    const _handleDownloadLegacy = () => {
        const printStyles = `
            <style>
                @page { margin: 0; size: A4 portrait; }
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 20mm; color: #1e293b; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                * { box-sizing: border-box; }
                .header { border-bottom: 3px solid #059669; padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
                .logo { max-height: 80px; object-fit: contain; }
                .badge { padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
                .badge.firmada { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
                .badge.pendiente { background: #fef3c7; color: #92400e; border: 1px solid #fbbf24; }
                h2 { font-size: 18px; font-weight: 900; color: #0f172a; margin: 0 0 4px; }
                h3 { font-size: 13px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
                .section { margin-bottom: 22px; }
                .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                .field label { font-size: 9px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 2px; }
                .field p { font-size: 13px; font-weight: 700; color: #1e293b; margin: 0; }
                .reporte-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 13px; color: #334155; line-height: 1.6; white-space: pre-wrap; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th { background: #f8fafc; text-align: left; padding: 8px 12px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
                td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: 600; }
                .firma-box { border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px; background: #f0fdf4; }
                .firma-box img { max-width: 200px; max-height: 80px; border: 1px solid #d1fae5; border-radius: 6px; padding: 4px; background: white; }
                .footer { margin-top: 30px; padding-top: 14px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
            </style>
        `;

        const content = `
            <div class="header">
                <div>
                    <img class="logo" src="${window.location.origin}/logo-hdb.jpg" alt="HDB Servicios Electricos" />
                    <h2 style="margin-top:10px;">Orden de Servicio — ${(os as any).codigoOS || os.id.slice(-8).toUpperCase()}</h2>
                    <p style="font-size:12px;color:#64748b;margin:4px 0 0;">${(os as any).project.codigoProyecto ? (os as any).project.codigoProyecto + ' | ' : ''}${os.project.nombre}</p>
                </div>
                <div>
                    <div class="badge ${isFirmada ? 'firmada' : 'pendiente'}">${isFirmada ? '✓ Firmada' : 'Pendiente de firma'}</div>
                    <p style="font-size:11px;color:#94a3b8;margin-top:8px;text-align:right;">Emitida: ${formatDate(os.fechaCreacion)}</p>
                </div>
            </div>

            <div class="section">
                <h3>Datos del Proyecto</h3>
                <div class="grid-2">
                    <div class="field" style="grid-column: 1 / -1"><label>Cliente</label><p>${clienteName}</p></div>
                </div>
            </div>

            <div class="section">
                <h3>Reporte del Trabajo</h3>
                <div class="reporte-box">${os.reporte}</div>
            </div>

            <div class="section">
                <h3>Operadores</h3>
                <table>
                    <thead><tr><th>Nombre</th><th>Horas</th></tr></thead>
                    <tbody>
                        ${os.operadores.map(op => `<tr><td>${op.operador.nombreCompleto}</td><td>${op.horas}h</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>

            ${os.materiales.length > 0 ? `
            <div class="section">
                <h3>Materiales Utilizados</h3>
                <table>
                    <thead><tr><th>Material</th><th>Cantidad</th><th>Unidad</th></tr></thead>
                    <tbody>
                        ${os.materiales.map(m => `<tr><td>${m.material}</td><td>${m.cantidad}</td><td>${m.unidadMedida}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>` : ''}

            ${os.comentario ? `
            <div class="section">
                <h3>Comentario Adicional</h3>
                <div class="reporte-box" style="border-color: #e2e8f0; background: #fdfdfd;">${os.comentario}</div>
            </div>` : ''}

            ${isFirmada && os.firma ? `
            <div class="section">
                <h3>Firma del Cliente</h3>
                <div class="firma-box">
                    <div class="grid-2" style="margin-bottom:10px;">
                        <div class="field"><label>Nombre</label><p>${os.firma.nombre}</p></div>
                        <div class="field"><label>DNI</label><p>${os.firma.dni}</p></div>
                        <div class="field"><label>Fecha de firma</label><p>${formatDateTime(os.firma.fechaFirma)}</p></div>
                    </div>
                    <img src="${os.firma.firmaImagen}" alt="Firma" />
                </div>
            </div>` : ''}

            <div class="footer">
                <span>HDB Job Planner — Gestión de Órdenes de Servicio</span>
                <span>${(os as any).codigoOS || 'OS #' + os.id.slice(-8).toUpperCase()} — ${(os as any).project.codigoProyecto || ''} — ${formatDate(os.fechaCreacion)}</span>
            </div>
        `;

        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>OS - ${os.project.nombre}</title>${printStyles}</head><body>${content}</body></html>`);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 500);
    };

    const copyLink = () => {
        navigator.clipboard.writeText(publicUrl);
        showToast('Link copiado al portapapeles', 'success');
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-t-3xl md:rounded-[2rem] shadow-2xl border border-slate-200 animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-300 max-h-[92vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${isFirmada ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {isFirmada ? '✓ Firmada' : 'Pendiente de firma'}
                            </span>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2 flex-wrap">
                            {(os as any).codigoOS ? (
                                <span className="text-emerald-700 font-mono">{(os as any).codigoOS} |</span>
                            ) : (
                                <span className="text-slate-400 font-mono">#SIN-OS |</span>
                            )}
                            {(os as any).project.codigoProyecto ? (
                                <span className="text-primary font-mono">{(os as any).project.codigoProyecto} |</span>
                            ) : (
                                <span className="text-slate-400 font-mono">#SIN-PR |</span>
                            )}
                            {os.project.nombre}
                        </h3>
                        <p className="text-sm text-slate-500 font-medium flex items-center gap-1.5 mt-1">
                            <Building2 className="w-3.5 h-3.5" /> {clienteName}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownload}
                            className="p-2.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-500 rounded-xl transition-all"
                            title="Descargar PDF"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                        <button onClick={onClose} className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 transition-all">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">
                    {/* Info */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Fecha de emisión</p>
                            <p className="font-bold text-slate-700">{formatDate(os.fechaCreacion)}</p>
                        </div>
                        {os.project.responsableUser && (
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Responsable</p>
                                <p className="font-bold text-slate-700">{os.project.responsableUser.nombreCompleto}</p>
                            </div>
                        )}
                    </div>

                    {/* Reporte */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-blue-500" /> Reporte del Trabajo
                        </h4>
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{os.reporte}</p>
                        </div>
                    </div>

                    {/* Operadores */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-indigo-500" /> Operadores
                        </h4>
                        <div className="divide-y divide-slate-50 border border-slate-100 rounded-2xl overflow-hidden">
                            {os.operadores.map(op => (
                                <div key={op.id} className="flex items-center justify-between px-4 py-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs">
                                            {op.operador.nombreCompleto.charAt(0)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-700">{op.operador.nombreCompleto}</span>
                                            {op.isExtra && (
                                                <span className="text-[10px] text-amber-600 font-black uppercase tracking-tight">Horas Extras</span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-sm font-black text-indigo-600">{op.horas}h</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Materiales */}
                    {os.materiales.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 text-amber-500" /> Materiales
                            </h4>
                            <div className="border border-slate-100 rounded-2xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-slate-100 bg-slate-50">
                                        <tr>
                                            <th className="text-left px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Material</th>
                                            <th className="text-right px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cant.</th>
                                            <th className="text-right px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidad</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {os.materiales.map(m => (
                                            <tr key={m.id}>
                                                <td className="px-4 py-3 font-medium text-slate-700">{m.material}</td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-800">{m.cantidad}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-black border border-amber-100 uppercase">{m.unidadMedida}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {os.comentario && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-slate-500" /> Comentario Adicional
                            </h4>
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{os.comentario}</p>
                            </div>
                        </div>
                    )}

                    {/* QR + Link */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <QrCode className="w-3.5 h-3.5 text-slate-500" /> Link y QR Público
                        </h4>
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col sm:flex-row items-center gap-4">
                            <QRImage url={publicUrl} />
                            <div className="flex-1 space-y-2 w-full">
                                <p className="text-xs text-slate-500 font-medium">El cliente puede escanear el QR o usar el link para ver y firmar la OS.</p>
                                <div className="flex gap-2">
                                    <input
                                        readOnly
                                        value={publicUrl}
                                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-500 outline-none truncate"
                                    />
                                    <button
                                        onClick={copyLink}
                                        className="px-3 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all whitespace-nowrap"
                                    >
                                        Copiar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Firma */}
                    {isFirmada && os.firma ? (
                        <div className="space-y-2">
                            <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Firma del Cliente
                            </h4>
                            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 space-y-3">
                                <div className="grid grid-cols-3 gap-3 text-sm">
                                    <div>
                                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-0.5">Nombre</p>
                                        <p className="font-bold text-slate-700">{os.firma.nombre}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-0.5">DNI</p>
                                        <p className="font-bold text-slate-700">{os.firma.dni}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-0.5">Fecha</p>
                                        <p className="font-bold text-slate-700">{formatDate(os.firma.fechaFirma)}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Firma</p>
                                    <div className="bg-white rounded-xl border border-emerald-100 p-2 inline-block">
                                        <img src={os.firma.firmaImagen} alt="Firma" className="max-h-24" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                            <PenLine className="w-5 h-5 text-amber-500 shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-amber-800">Pendiente de firma del cliente</p>
                                <p className="text-xs text-amber-600 font-medium mt-0.5">Compartí el link o QR con el cliente para que firme.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-100 flex gap-2 shrink-0">
                    <button
                        onClick={handleDownload}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-2xl font-black text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95"
                    >
                        <Download className="w-4 h-4" /> Descargar PDF
                    </button>
                    {!isFirmada && (
                        <Link
                            href={`/ordenes-servicio/qr/${os.id}`}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                        >
                            <Smartphone className="w-4 h-4" /> Ver QR
                        </Link>
                    )}
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all active:scale-95"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}

function OrdenesServicioContent() {
    const searchParams = useSearchParams();
    const highlightId = searchParams.get('highlight') || '';

    const [ordenes, setOrdenes] = useState<OrdenServicio[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEstado, setFilterEstado] = useState<'all' | 'pendiente' | 'firmada' | 'cobrada'>('all');
    const [activeTab, setActiveTab] = useState<'activas' | 'historial'>('activas');
    const [selectedOS, setSelectedOS] = useState<OrdenServicio | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [osToDelete, setOsToDelete] = useState<string | null>(null);
    const [osToPay, setOsToPay] = useState<OrdenServicio | null>(null);
    const [osToCancel, setOsToCancel] = useState<OrdenServicio | null>(null);
    const [osCobroToOpen, setOsCobroToOpen] = useState<OrdenServicio | null>(null);

    useEffect(() => {
        const user = localStorage.getItem('currentUser');
        if (user) setCurrentUser(JSON.parse(user));
        loadOrdenes();
    }, []);

    const loadOrdenes = async () => {
        setLoading(true);
        try {
            const res = await safeApiRequest('/api/ordenes-servicio');
            const data = await res.json();
            if (Array.isArray(data)) setOrdenes(data);
        } catch {
            showToast('Error al cargar órdenes de servicio', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePagarOS = async (os: OrdenServicio) => {
        try {
            const res = await fetch(`/api/ordenes-servicio/${os.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: 'pagada' })
            });
            if (res.ok) {
                const updated = await res.json();
                setOrdenes(prev => prev.map(o => o.id === updated.id ? updated : o));
                showToast('Orden marcada como PAGADA', 'success');
            }
        } catch (err) {
            showToast('Error al actualizar estado', 'error');
        } finally {
            setOsToPay(null);
        }
    };

    const handleCancelarOS = async (os: OrdenServicio) => {
        try {
            const res = await fetch(`/api/ordenes-servicio/${os.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: 'cancelada' })
            });
            if (res.ok) {
                const updated = await res.json();
                setOrdenes(prev => prev.map(o => o.id === updated.id ? updated : o));
                showToast('Orden CANCELADA', 'success');
            }
        } catch (err) {
            showToast('Error al actualizar estado', 'error');
        } finally {
            setOsToCancel(null);
        }
    };

    const confirmDeleteOS = async () => {
        if (!osToDelete) return;
        setIsDeleting(osToDelete);
        try {
            const res = await safeApiRequest(`/api/ordenes-servicio/${osToDelete}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Orden de Servicio eliminada', 'success');
                setOrdenes(prev => prev.filter(o => o.id !== osToDelete));
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al eliminar la OS', 'error');
            }
        } catch {
            showToast('Error de conexión', 'error');
        } finally {
            setIsDeleting(null);
            setOsToDelete(null);
        }
    };

    const isSupervisorOrAdmin = currentUser?.role === 'supervisor' || currentUser?.role === 'admin';

    if (!loading && !isSupervisorOrAdmin) {
        return (
            <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-slate-500 font-medium">No tenés permisos para acceder a esta sección.</p>
            </div>
        );
    }

    const filtered = ordenes.filter(os => {
        const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const term = normalize(searchTerm);
        const matchSearch = !searchTerm ||
            normalize(os.project.nombre).includes(term) ||
            normalize(os.project.client?.nombre || os.project.cliente || '').includes(term) ||
            ((os as any).codigoOS || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            ((os as any).project.codigoProyecto || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchEstado = filterEstado === 'all' || os.estado === filterEstado;
        const isHistory = os.estado === 'pagada' || os.estado === 'cancelada';
        const tabMatch = activeTab === 'historial' ? isHistory : !isHistory;
        
        return matchSearch && matchEstado && tabMatch;
    });


    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            {/* Header */}
            <div className="space-y-1">
                <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 md:gap-3">
                    <FileSignature className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                    Órdenes de Servicio
                </h2>
                <div className="flex items-center gap-4 border-b border-slate-200 mt-4">
                    <button
                        onClick={() => { setActiveTab('activas'); setFilterEstado('all'); }}
                        className={`pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'activas' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Activas
                    </button>
                    <button
                        onClick={() => { setActiveTab('historial'); setFilterEstado('all'); }}
                        className={`pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'historial' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Historial
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 min-w-0 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar por código OS, PR, proyecto o cliente..."
                        className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium shadow-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                {activeTab === 'activas' && (
                    <div className="flex gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-sm shrink-0">
                        {(['all', 'pendiente', 'firmada', 'cobrada'] as const).map(estado => (
                            <button
                                key={estado}
                                onClick={() => setFilterEstado(estado)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterEstado === estado
                                    ? estado === 'firmada' ? 'bg-emerald-100 text-emerald-700'
                                        : estado === 'pendiente' ? 'bg-amber-100 text-amber-700'
                                            : estado === 'cobrada' ? 'bg-indigo-100 text-indigo-700'
                                                : 'bg-primary text-white'
                                    : 'text-slate-500 hover:bg-slate-50'
                                    }`}
                            >
                                {estado === 'all' ? 'Todas' : estado === 'firmada' ? '✓ Firmadas' : estado === 'cobrada' ? 'OC Emitida' : 'Pendientes'}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-center">
                    <p className="text-2xl font-black text-slate-800">{ordenes.length}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-sm text-center">
                    <p className="text-2xl font-black text-emerald-700">{ordenes.filter(o => o.estado === 'firmada').length}</p>
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Firmadas</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm text-center">
                    <p className="text-2xl font-black text-amber-700">{ordenes.filter(o => o.estado === 'pendiente').length}</p>
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Pendientes</p>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400">
                    <FileSignature className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-semibold text-slate-600">No se encontraron órdenes de servicio</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(os => {
                        const isFirmada = os.estado === 'firmada';
                        const clienteName = os.project.client?.nombre || os.project.cliente || '—';
                        const isHighlighted = os.id === highlightId;
                        return (
                            <div
                                key={os.id}
                                className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all p-4 ${isHighlighted ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200'}`}
                            >
                                <div className="flex items-center gap-3 flex-wrap">
                                    {/* Status dot */}
                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isFirmada ? 'bg-emerald-500' : 'bg-amber-400'}`} />

                                    {/* Main info */}
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap text-sm">
                                            <p className="font-black text-slate-800 truncate flex items-center gap-1.5">
                                                {(os as any).codigoOS ? (
                                                    <span className="text-emerald-700 font-mono">{(os as any).codigoOS} |</span>
                                                ) : (
                                                    <span className="text-slate-400 font-mono">#SIN-OS |</span>
                                                )}
                                                {(os as any).project.codigoProyecto ? (
                                                    <span className="text-primary font-mono">{(os as any).project.codigoProyecto} |</span>
                                                ) : (
                                                    <span className="text-slate-400 font-mono">#SIN-PR |</span>
                                                )}
                                                {os.project.nombre}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-400 font-medium flex-wrap">
                                            <span className="flex items-center gap-1">
                                                <Building2 className="w-3 h-3" /> {clienteName}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <CalendarDays className="w-3 h-3" /> {formatDate(os.fechaCreacion)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Estado badge */}
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 ${
                                        os.estado === 'firmada' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 
                                        os.estado === 'pendiente' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                        os.estado === 'cobrada' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                                        os.estado === 'pagada' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                        'bg-slate-100 text-slate-700 border border-slate-200'
                                    }`}>
                                        {os.estado === 'firmada' ? '✓ Firmada' : 
                                         os.estado === 'pendiente' ? 'Pendiente' : 
                                         os.estado === 'cobrada' ? 'OC Emitida' :
                                         os.estado === 'pagada' ? 'Pagada' : 'Cancelada'}
                                    </span>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                                        {currentUser?.role === 'admin' && os.estado === 'cobrada' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOsToPay(os);
                                                }}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black text-emerald-600 border border-emerald-200 bg-emerald-50 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Pagada
                                            </button>
                                        )}
                                        {currentUser?.role === 'admin' && (os.estado === 'pendiente' || os.estado === 'firmada' || os.estado === 'cobrada') && (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setOsCobroToOpen(os); }}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                                >
                                                    <Calculator className="w-3.5 h-3.5" /> {(os as any).cobroGenerado ? 'Ver Cobro' : 'Generar Cobro'}
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOsToCancel(os);
                                                    }}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black text-slate-400 border border-slate-200 bg-slate-50 hover:bg-slate-200 hover:text-slate-600 transition-all shadow-sm"
                                                    title="Cancelar orden"
                                                >
                                                    <X className="w-3.5 h-3.5" /> Cancelar
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => setSelectedOS(os)}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black text-slate-600 border border-slate-200 hover:border-primary/40 hover:text-primary transition-all shadow-sm"
                                        >
                                            <Eye className="w-3.5 h-3.5" /> Ver
                                        </button>
                                        <button
                                            onClick={() => setOsToDelete(os.id)}
                                            title="Eliminar OS"
                                            disabled={isDeleting === os.id}
                                            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 border border-slate-200 hover:border-red-500 hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-50"
                                        >
                                            {isDeleting === os.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedOS && <OSDetalle os={selectedOS} onClose={() => setSelectedOS(null)} />}
            
            {osCobroToOpen && (
                <OSCobroModal 
                    os={osCobroToOpen} 
                    onClose={() => setOsCobroToOpen(null)} 
                    onSaveSuccess={(updated) => {
                        setOrdenes(prev => prev.map(o => o.id === updated.id ? updated : o));
                        setOsCobroToOpen(null);
                    }}
                />
            )}

            <ConfirmDialog
                isOpen={!!osToPay}
                title="Confirmar Pago"
                message="¿Estás seguro de que quieres marcar esta orden como PAGADA? Se moverá al historial."
                onConfirm={() => osToPay && handlePagarOS(osToPay)}
                onCancel={() => setOsToPay(null)}
                variant="info"
                confirmLabel="Marcar Pagada"
            />

            <ConfirmDialog
                isOpen={!!osToCancel}
                title="Cancelar Orden"
                message="¿Estás seguro de que quieres cancelar esta orden? Se moverá al historial."
                onConfirm={() => osToCancel && handleCancelarOS(osToCancel)}
                onCancel={() => setOsToCancel(null)}
                variant="danger"
                confirmLabel="Cancelar Orden"
            />

            <ConfirmDialog
                isOpen={!!osToDelete}
                title="Eliminar Orden de Servicio"
                message="¿Estás seguro de que quieres eliminar esta Orden de Servicio? Esta acción no se puede deshacer."
                onConfirm={confirmDeleteOS}
                onCancel={() => setOsToDelete(null)}
                variant="danger"
            />
        </div>
    );
}

export default function OrdenesServicioPage() {
    return (
        <Suspense fallback={
            <div className="space-y-4">
                <div className="h-12 bg-slate-100 rounded-2xl animate-pulse" />
                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />)}
            </div>
        }>
            <OrdenesServicioContent />
        </Suspense>
    );
}
