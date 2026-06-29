'use client';

import { useEffect, useState, useRef } from 'react';
import { Loader2, AlertCircle, FileText, Download, CheckCircle2, Printer, Link as LinkIcon, X, ChevronLeft, ChevronRight, Calculator, StickyNote } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';
import { useCommandStore } from '@/lib/store/useCommandStore';
import { useDrawerStore } from '@/lib/store/useDrawerStore';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const OSNotaModal = dynamic(() => import('@/components/OSNotaModal'), { ssr: false });

const formatDate = (date: string | Date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

export default function OrdenServicioDrawerContent({ id, onClose }: { id: string, onClose: () => void }) {
    const [os, setOs] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [showNotaModal, setShowNotaModal] = useState(false);

    useEffect(() => {
        const user = localStorage.getItem('currentUser');
        if (user) setCurrentUser(JSON.parse(user));
    }, []);
    
    const userRole = currentUser?.role?.trim().toLowerCase() || '';
    const isAdminOrQa = userRole === 'admin' || userRole === 'qa';

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const nextId = useDrawerStore(state => state.getNextId(id));
    const prevId = useDrawerStore(state => state.getPrevId(id));

    const handleNavigate = (newId: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('id', newId);
        router.push(`${pathname}?${params.toString()}`);
    };

    const [firmaImageUrl, setFirmaImageUrl] = useState<string | null>(null);
    const [loadingFirma, setLoadingFirma] = useState<boolean>(false);

    const latestActions = useRef({ 
        handleDownload: () => {}, 
        handlePrint: () => {}, 
        handleCopyLink: () => {}, 
        handleGenerarCobro: () => {}, 
        handleShowNota: () => {} 
    });

    useEffect(() => {
        const registerCommand = useCommandStore.getState().registerCommand;
        const unregisterCommand = useCommandStore.getState().unregisterCommand;

        registerCommand({
            id: 'os-drawer-print',
            label: 'Imprimir',
            category: 'Contextual',
            action: () => latestActions.current.handlePrint()
        });
        
        registerCommand({
            id: 'os-drawer-pdf',
            label: 'Descargar PDF',
            category: 'Contextual',
            action: () => latestActions.current.handleDownload()
        });

        registerCommand({
            id: 'os-drawer-copylink',
            label: 'Copiar Link',
            category: 'Contextual',
            action: () => latestActions.current.handleCopyLink()
        });

        if (isAdminOrQa) {
            registerCommand({
                id: 'os-drawer-nota',
                label: 'Añadir Nota Interna',
                category: 'Contextual',
                action: () => latestActions.current.handleShowNota()
            });

            registerCommand({
                id: 'os-drawer-cobro',
                label: 'Generar/Ver Cobro',
                category: 'Contextual',
                action: () => latestActions.current.handleGenerarCobro()
            });
        }

        return () => {
            unregisterCommand('os-drawer-print');
            unregisterCommand('os-drawer-pdf');
            unregisterCommand('os-drawer-copylink');
            unregisterCommand('os-drawer-nota');
            unregisterCommand('os-drawer-cobro');
        };
    }, [isAdminOrQa]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'ArrowLeft' && prevId) {
                e.preventDefault();
                handleNavigate(prevId);
            }
            if (e.ctrlKey && e.key === 'ArrowRight' && nextId) {
                e.preventDefault();
                handleNavigate(nextId);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [prevId, nextId]);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        safeApiRequest(`/api/ordenes-servicio/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('OS no encontrada');
                return res.json();
            })
            .then(data => {
                if (mounted) {
                    setOs(data);
                    if (data.firma?.firmaImagen) {
                        setFirmaImageUrl(data.firma.firmaImagen);
                    }
                }
            })
            .catch(err => {
                if (mounted) setError(err.message);
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });
        
        return () => { mounted = false; };
    }, [id]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p>Cargando información de la Orden...</p>
            </div>
        );
    }

    if (error || !os) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-rose-500">
                <AlertCircle className="w-8 h-8 mb-4" />
                <p className="font-bold">{error || 'No se pudo cargar la orden'}</p>
            </div>
        );
    }

    const publicUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/os/${os.linkPublico}`
        : `/os/${os.linkPublico}`;

    const isFirmada = os.estado === 'firmada' || os.estado === 'cobrada' || os.estado === 'pagada';
    const clienteName = os.project?.client?.nombre || os.project?.cliente || 'No especificado';
    const osTitle = os.codigoOS || `OS-${os.id.slice(-8).toUpperCase()}`;

    const handleDownload = () => {
        window.location.href = `/api/ordenes-servicio/${os.id}/pdf`;
    };

    const handlePrint = () => {
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
                .badge.cobrada { background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; }
                .badge.pagada { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
                h2 { font-size: 18px; font-weight: 900; color: #0f172a; margin: 0 0 4px; }
                h3 { font-size: 13px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
                .section { margin-bottom: 22px; page-break-inside: avoid; }
                .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                .field label { font-size: 9px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 2px; }
                .field p { font-size: 13px; font-weight: 700; color: #1e293b; margin: 0; }
                .reporte-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 13px; color: #334155; line-height: 1.6; white-space: pre-wrap; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th { background: #f8fafc; text-align: left; padding: 8px 12px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
                tr { page-break-inside: avoid; }
                td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: 600; }
                .firma-box { border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px; background: #f0fdf4; page-break-inside: avoid; }
                .firma-box img { max-width: 200px; max-height: 80px; border: 1px solid #d1fae5; border-radius: 6px; padding: 4px; background: white; }
                .footer { margin-top: 30px; padding-top: 14px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
            </style>
        `;

        const content = `
            <div class="header">
                <div>
                    <img class="logo" src="${window.location.origin}/logo-hdb.jpg" alt="HDB Servicios Electricos" />
                    <h2 style="margin-top:10px;">Orden de Servicio — ${osTitle}</h2>
                    <p style="font-size:12px;color:#64748b;margin:4px 0 0;">${os.project?.codigoProyecto ? os.project.codigoProyecto + ' | ' : ''}${os.project?.nombre}</p>
                </div>
                <div>
                    <div class="badge ${os.estado}">${
                        os.estado === 'firmada' ? '✓ Firmada' :
                        os.estado === 'cobrada' ? 'OC Emitida' :
                        os.estado === 'pagada' ? '✓ Pagada' :
                        os.estado === 'pendiente' ? 'Pendiente de firma' : 'Cancelada'
                    }</div>
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
                        ${os.operadores?.map((op: any) => `<tr><td>${op.operador?.nombreCompleto || op.operadorNombre || op.nombre || ''}</td><td>${op.horas} hrs</td></tr>`).join('') || ''}
                    </tbody>
                </table>
            </div>

            ${os.materiales && os.materiales.length > 0 ? `
            <div class="section">
                <h3>Materiales / Gastos Extra</h3>
                <table>
                    <thead><tr><th>Material</th><th>Cantidad</th></tr></thead>
                    <tbody>
                        ${os.materiales.map((m: any) => `<tr><td>${m.material || m.nombre || ''}</td><td>${m.cantidad}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}

            ${isFirmada ? `
            <div class="section" style="margin-top:40px;">
                <div class="firma-box">
                    <h3>Firma de Conformidad</h3>
                    <div class="grid-2">
                        <div class="field"><label>Aclaración</label><p>${os.firma?.aclaracion || '-'}</p></div>
                        <div class="field"><label>DNI</label><p>${os.firma?.dni || '-'}</p></div>
                        ${os.firma?.cargo ? `<div class="field"><label>Cargo</label><p>${os.firma.cargo}</p></div>` : ''}
                        <div class="field"><label>Fecha</label><p>${os.firma?.fecha ? formatDate(os.firma.fecha) : formatDate(os.fechaCreacion)}</p></div>
                    </div>
                    ${firmaImageUrl ? `<div style="margin-top:16px"><img src="${firmaImageUrl}" alt="Firma" /></div>` : ''}
                </div>
            </div>
            ` : ''}

            <div class="footer">
                <span>Generado desde HDB Gestión Integral</span>
                <span>Página 1/1</span>
            </div>
        `;

        const win = window.open('', '_blank');
        if (!win) {
            alert('Por favor, permite los popups para imprimir.');
            return;
        }

        win.document.write(`
            <html>
                <head>
                    <title>${osTitle}</title>
                    ${printStyles}
                </head>
                <body>
                    ${content}
                    <script>
                        window.onload = () => {
                            setTimeout(() => {
                                window.print();
                                setTimeout(() => window.close(), 100);
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        win.document.close();
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(publicUrl);
        showToast('Enlace copiado al portapapeles', 'success');
    };

    const handleGenerarCobro = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('drawer', 'cobro');
        params.set('id', os.id);
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleShowNota = () => setShowNotaModal(true);

    // Update ref without a hook since we are after conditional returns
    latestActions.current = { handleDownload, handlePrint, handleCopyLink, handleGenerarCobro, handleShowNota };

    return (
        <div className="flex flex-col h-full bg-background animate-in fade-in duration-200">
            {/* Header del Contenido */}
            <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex flex-col gap-1 pr-4 flex-1">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        <h3 className="text-lg sm:text-2xl font-black text-slate-800 dark:text-slate-100">
                            {osTitle}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider ${
                            os.estado === 'firmada' ? 'bg-emerald-100 text-emerald-700' :
                            os.estado === 'pendiente' ? 'bg-amber-100 text-amber-700' :
                            os.estado === 'cobrada' ? 'bg-indigo-100 text-indigo-700' :
                            os.estado === 'pagada' ? 'bg-blue-100 text-blue-700' :
                            'bg-rose-100 text-rose-700'
                        }`}>
                            {os.estado === 'firmada' ? 'Firmada' : os.estado}
                        </span>
                    </div>
                    <p className="text-[11px] sm:text-sm font-bold text-slate-500 dark:text-slate-400 line-clamp-1">
                        {os.project?.codigoProyecto ? os.project.codigoProyecto + ' | ' : ''}{os.project?.nombre}
                    </p>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 pr-3 sm:pr-4 mr-3 sm:mr-4 border-r border-slate-200 dark:border-slate-800 shrink-0">
                    <button 
                        disabled={!prevId}
                        onClick={() => prevId && handleNavigate(prevId)}
                        className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        aria-label="Anterior"
                    >
                        <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                    <button 
                        disabled={!nextId}
                        onClick={() => nextId && handleNavigate(nextId)}
                        className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        aria-label="Siguiente"
                    >
                        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                </div>

                <button
                    onClick={onClose}
                    className="p-1.5 sm:p-2 -mr-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors shrink-0"
                    aria-label="Cerrar"
                >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
            </div>

            {/* Contenido scrolleable */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8 bg-background hide-scrollbar" ref={printRef}>
                {/* Tarjeta Info General */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-slate-50 dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Cliente</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{clienteName}</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Emisión</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            {new Date(os.fechaCreacion).toLocaleDateString()}
                        </span>
                    </div>
                </div>

                {/* Reporte de Trabajo */}
                <div className="space-y-2 sm:space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
                        <FileText className="w-3.5 h-3.5" /> Reporte Técnico
                    </h4>
                    <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-inner text-sm sm:text-base text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-medium">
                        {os.reporte}
                    </div>
                </div>

                {/* Operadores y Materiales */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    {os.operadores && os.operadores.length > 0 && (
                        <div className="space-y-2 sm:space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Personal Asignado</h4>
                            <ul className="space-y-2">
                                {os.operadores.map((op: any, i: number) => (
                                    <li key={i} className="flex justify-between items-center text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <span>{op.operador?.nombreCompleto || op.operadorNombre || op.nombre || ''}</span>
                                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-lg text-xs font-black">{op.horas} hrs</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    
                    {os.materiales && os.materiales.length > 0 && (
                        <div className="space-y-2 sm:space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Materiales Utilizados</h4>
                            <ul className="space-y-2">
                                {os.materiales.map((m: any, i: number) => (
                                    <li key={i} className="flex justify-between items-center text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <span>{m.material || m.nombre || ''}</span>
                                        <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-lg text-xs font-black">x{m.cantidad}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Firma de Conformidad */}
                {isFirmada && (
                    <div className="space-y-2 sm:space-y-3 pt-2 sm:pt-4 border-t border-slate-100 dark:border-slate-800/50">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 
                            Firma del Cliente
                        </h4>
                        <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 p-4 sm:p-5 rounded-2xl sm:rounded-3xl">
                            <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs sm:text-sm">
                                <div>
                                    <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-600/60 dark:text-emerald-400/60 mb-0.5">Aclaración</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{os.firma?.aclaracion || '-'}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-600/60 dark:text-emerald-400/60 mb-0.5">DNI</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{os.firma?.dni || '-'}</span>
                                </div>
                                {os.firma?.cargo && (
                                    <div className="col-span-2">
                                        <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-600/60 dark:text-emerald-400/60 mb-0.5">Cargo</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{os.firma.cargo}</span>
                                    </div>
                                )}
                            </div>
                            {loadingFirma ? (
                                <div className="mt-4 sm:mt-6 h-16 sm:h-20 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-center">
                                    <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                                </div>
                            ) : firmaImageUrl ? (
                                <div className="mt-4 sm:mt-6 bg-white dark:bg-slate-900 p-2 sm:p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/50 inline-block">
                                    <img src={firmaImageUrl} alt="Firma del cliente" className="max-h-16 sm:max-h-20 object-contain dark:invert dark:opacity-90" />
                                </div>
                            ) : (
                                <div className="mt-4 sm:mt-6 text-xs font-medium text-slate-500 dark:text-slate-400 italic">No se pudo cargar la imagen de la firma.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer fijo con acciones */}
            <div className="shrink-0 flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <button 
                    onClick={handleDownload}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black transition-all active:scale-[0.98] shadow-lg shadow-slate-900/20"
                >
                    <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                    Descargar PDF
                </button>
                <button 
                    onClick={handlePrint}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 transition-all active:scale-[0.98]"
                >
                    <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
                    Imprimir
                </button>
                
                {isAdminOrQa && (
                    <>
                        <button 
                            onClick={handleGenerarCobro}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 border py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black transition-all active:scale-[0.98] ${
                                os.cobroGenerado 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-900/50' 
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/50'
                            }`}
                        >
                            <Calculator className="w-4 h-4 sm:w-5 sm:h-5" />
                            {os.cobroGenerado ? 'Ver Cobro' : 'Generar Cobro'}
                        </button>
                        <button 
                            onClick={handleShowNota}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 border py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black transition-all active:scale-[0.98] ${
                                os.notaInterna
                                ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/50'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-200'
                            }`}
                        >
                            <StickyNote className="w-4 h-4 sm:w-5 sm:h-5" />
                            {os.notaInterna ? 'Editar Nota' : 'Añadir Nota'}
                        </button>
                    </>
                )}

                <div className="hidden sm:block flex-1" />
                
                <button 
                    onClick={handleCopyLink}
                    className="p-2.5 sm:p-3 bg-slate-200/50 hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl sm:rounded-2xl transition-all"
                    title="Copiar link público"
                >
                    <LinkIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
            </div>

            {/* Modal for internal notes rendered conditionally over the drawer */}
            {showNotaModal && (
                <OSNotaModal
                    os={os}
                    onClose={() => setShowNotaModal(false)}
                    onSaveSuccess={(updated) => {
                        setOs(updated);
                        setShowNotaModal(false);
                    }}
                />
            )}
        </div>
    );
}
