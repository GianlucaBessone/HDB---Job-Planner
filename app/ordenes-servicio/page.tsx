'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    FileSignature, Search, Eye, Download, CheckCircle2, Clock, X,
    AlertCircle, Loader2, FileText, User, Package, PenLine, Building2,
    CalendarDays, QrCode, Smartphone, Trash2, Calculator
} from 'lucide-react';
import Link from 'next/link';
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
    operadores: { id: string; horas: number; operador: { id: string; nombreCompleto: string } }[];
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

    const formatDate = (d: string) => {
        try { return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
        catch { return d; }
    };

    const formatDateTime = (d: string) => {
        try {
            return new Date(d).toLocaleString('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch { return d; }
    };

    const handleDownload = () => {
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
                    <img class="logo" src="data:image/jpeg;base64,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" alt="HDB Servicios Electricos" />
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
                                        <span className="text-sm font-bold text-slate-700">{op.operador.nombreCompleto}</span>
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
    const [filterEstado, setFilterEstado] = useState<'all' | 'pendiente' | 'firmada'>('all');
    const [selectedOS, setSelectedOS] = useState<OrdenServicio | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [osToDelete, setOsToDelete] = useState<string | null>(null);
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
        return matchSearch && matchEstado;
    });

    const formatDate = (d: string) => {
        try { return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
        catch { return d; }
    };

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            {/* Header */}
            <div className="space-y-1">
                <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 md:gap-3">
                    <FileSignature className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                    Órdenes de Servicio
                </h2>
                <p className="text-sm text-slate-500 font-medium hidden md:block">Gestión y seguimiento de Órdenes de Servicio</p>
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
                <div className="flex gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-sm shrink-0">
                    {(['all', 'pendiente', 'firmada'] as const).map(estado => (
                        <button
                            key={estado}
                            onClick={() => setFilterEstado(estado)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterEstado === estado
                                ? estado === 'firmada' ? 'bg-emerald-100 text-emerald-700'
                                    : estado === 'pendiente' ? 'bg-amber-100 text-amber-700'
                                        : 'bg-primary text-white'
                                : 'text-slate-500 hover:bg-slate-50'
                                }`}
                        >
                            {estado === 'all' ? 'Todas' : estado === 'firmada' ? '✓ Firmadas' : 'Pendientes'}
                        </button>
                    ))}
                </div>
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
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 ${isFirmada ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                                        {isFirmada ? '✓ Firmada' : 'Pendiente'}
                                    </span>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {currentUser?.role === 'admin' && (
                                            <button
                                                onClick={() => setOsCobroToOpen(os)}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                            >
                                                <Calculator className="w-3.5 h-3.5" /> {(os as any).cobroGenerado ? 'Ver Cobro' : 'Generar Cobro'}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setSelectedOS(os)}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 border border-slate-200 hover:border-primary/40 hover:text-primary transition-all"
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
