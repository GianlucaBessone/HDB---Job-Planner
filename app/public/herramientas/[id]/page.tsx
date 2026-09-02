'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
    ShieldCheck, AlertTriangle, AlertOctagon, CheckCircle2, 
    XCircle, Clock, Calendar, User, Package, Wrench, 
    Printer, Share2, Search, Camera, QrCode, ArrowLeft,
    Check, Sparkles, Building2, Tag, Layers, ExternalLink, X
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface ToolItem {
    id: string;
    nombre: string;
    marca?: string | null;
    descripcion?: string | null;
    tipo: string;
    subtipo?: string | null;
    rubro?: string | null;
    controlActivo: boolean;
    periodoControl: number;
    estadoHerramienta?: string | null;
    ultimoControlFecha?: string | null;
    ultimoControlOperador?: string | null;
    estadoControl?: 'NUNCA_CONTROLADA' | 'EN_VIGENCIA' | 'POR_VENCER' | 'VENCIDO' | null;
    proximoControlFecha?: string | null;
    diasRestantes?: number | null;
    verificaciones?: any[];
    herramientas?: ToolItem[];
    carro?: { id: string; nombre: string } | null;
}

const ESTADO_CONTROL_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
    EN_VIGENCIA: {
        label: 'AL DÍA (EN VIGENCIA)',
        bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        text: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-500/30',
        icon: CheckCircle2
    },
    POR_VENCER: {
        label: 'POR VENCER (REQUERIDO PRONTO)',
        bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-500/30',
        icon: AlertTriangle
    },
    VENCIDO: {
        label: 'VENCIDO (NO APTO PARA AUDITORÍA)',
        bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
        text: 'text-rose-600 dark:text-rose-400',
        border: 'border-rose-500/30',
        icon: AlertOctagon
    },
    NUNCA_CONTROLADA: {
        label: 'SIN CONTROL REGISTRADO',
        bg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
        text: 'text-slate-600 dark:text-slate-400',
        border: 'border-slate-500/30',
        icon: Clock
    }
};

export default function PublicToolAuditPage() {
    const params = useParams();
    const router = useRouter();
    const toolId = params?.id as string;

    const [tool, setTool] = useState<ToolItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Search and Scanner state
    const [isScanning, setIsScanning] = useState(false);
    const [searchId, setSearchId] = useState('');

    const fetchToolData = async (idToFetch: string) => {
        if (!idToFetch) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/public/herramientas/${encodeURIComponent(idToFetch)}`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Herramienta no encontrada');
            }
            const data = await res.json();
            setTool(data);
        } catch (err: any) {
            setError(err.message || 'Error de conexión');
            setTool(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (toolId) {
            fetchToolData(toolId);
        }
    }, [toolId]);

    const handleCopyLink = () => {
        if (typeof window !== 'undefined') {
            navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
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

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = searchId.trim();
        if (trimmed) {
            let id = trimmed;
            if (id.startsWith('TOOL:')) id = id.replace('TOOL:', '');
            else if (id.startsWith('TOOLCART:')) id = id.replace('TOOLCART:', '');
            router.push(`/public/herramientas/${encodeURIComponent(id)}`);
        }
    };

    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatDateTime = (dateStr?: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handlePrintAuditSheet = () => {
        if (!tool) return;

        let itemsToPrint: any[] = [];
        if (tool.tipo === 'CARRO' && tool.herramientas) {
            // Priority ordering: 1. Requieren control (alfabéticamente), 2. Sin control (alfabéticamente)
            const conControl = (tool.herramientas.filter((h: any) => h.controlActivo) || []).sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
            const sinControl = (tool.herramientas.filter((h: any) => !h.controlActivo) || []).sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
            itemsToPrint = [...conControl, ...sinControl];
        } else {
            itemsToPrint = [tool];
        }

        const isCart = tool.tipo === 'CARRO';
        const controlState = tool.estadoControl ? (ESTADO_CONTROL_CONFIG[tool.estadoControl]?.label || tool.estadoControl) : 'NO SUJETO A CONTROL';
        const publicVerifyUrl = typeof window !== 'undefined' ? `${window.location.origin}/public/herramientas/${tool.id}` : `https://hdb.com.ar/public/herramientas/${tool.id}`;
        const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=4&data=${encodeURIComponent(publicVerifyUrl)}`;

        const rows = itemsToPrint.map((h: any) => {
            const hStatus = h.controlActivo 
                ? (ESTADO_CONTROL_CONFIG[h.estadoControl]?.label || h.estadoControl || 'SIN CONTROL')
                : 'NO REQUIERE';
            const estadoOp = h.estadoHerramienta || 'NO ESPECIFICADO';
            const ultimo = h.ultimoControlFecha ? formatDate(h.ultimoControlFecha) : '-';
            const prox = h.proximoControlFecha ? formatDate(h.proximoControlFecha) : '-';
            const dias = h.diasRestantes !== null && h.diasRestantes !== undefined ? `${h.diasRestantes} días` : '-';
            const resp = h.ultimoControlOperador || '-';

            return `
                <tr style="${h.controlActivo ? 'background-color: #ffffff;' : 'background-color: #fafafa;'}">
                    <td style="font-family: monospace; font-size: 11px; font-weight: bold; color: #0f172a;">${h.id}</td>
                    <td>
                        <strong>${h.nombre}</strong> ${h.marca ? `<span style="color:#64748b;">(${h.marca})</span>` : ''}
                        ${h.controlActivo ? '<span style="display:inline-block; margin-left:4px; font-size:9px; font-weight:800; color:#4338ca; background:#e0e7ff; padding:1px 5px; border-radius:4px;">SUJETO A CONTROL</span>' : ''}
                    </td>
                    <td><span style="font-weight: 700; color: ${estadoOp === 'APROBADA' ? '#16a34a' : (estadoOp === 'RECHAZADA' ? '#dc2626' : '#475569')}">${estadoOp}</span></td>
                    <td>${ultimo} <small style="display:block; color:#64748b;">${resp}</small></td>
                    <td><strong style="color: ${h.estadoControl === 'VENCIDO' ? '#dc2626' : (h.estadoControl === 'POR_VENCER' ? '#d97706' : (h.controlActivo ? '#16a34a' : '#64748b'))}">${hStatus}</strong></td>
                    <td>${prox} <small style="display:block; color:#64748b;">${dias}</small></td>
                </tr>
            `;
        }).join('');

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Por favor habilita las ventanas emergentes (popups) para imprimir.');
            return;
        }

        const title = `Certificado de Auditoría y Estado Técnico - ${tool.nombre}`;

        printWindow.document.write(`<!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="utf-8">
            <title>${title}</title>
            <style>
                @page { margin: 10mm; size: portrait; }
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 15px; color: #1e293b; line-height: 1.35; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; }
                .logo-title { font-size: 18px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px; }
                .badge-valid { display: inline-block; padding: 4px 10px; font-size: 10px; font-weight: 800; border-radius: 6px; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; text-transform: uppercase; }
                .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 11px; }
                .meta-item strong { display: block; font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
                table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 10px; }
                th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
                th { background-color: #f1f5f9; color: #334155; text-transform: uppercase; font-size: 9.5px; font-weight: 800; letter-spacing: 0.5px; }
                .verification-seal-container { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
                .qr-block { display: flex; align-items: center; gap: 12px; }
                .qr-block img { width: 70px; height: 70px; border-radius: 4px; border: 1px solid #cbd5e1; }
                .qr-text { font-size: 10.5px; color: #334155; }
                .footer { margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 9.5px; color: #64748b; display: flex; justify-content: space-between; align-items: center; }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <div class="logo-title">HDB Servicios Eléctricos</div>
                    <div style="font-size: 11px; color: #64748b; font-weight: 600;">Sistema de Gestión Integral (SGI) • Control Metrológico y Calibración</div>
                </div>
                <div style="text-align: right;">
                    <div class="badge-valid">Certificado Oficial de Auditoría</div>
                    <div style="font-size: 9.5px; color: #64748b; margin-top: 3px;">Fecha: ${formatDateTime(new Date().toISOString())}</div>
                </div>
            </div>

            <div class="meta-grid">
                <div class="meta-item"><strong>Elemento Auditado:</strong> ${tool.nombre}</div>
                <div class="meta-item"><strong>Código de Auditoría:</strong> <span style="font-family: monospace; font-weight: bold; color: #4338ca;">${tool.id}</span></div>
                <div class="meta-item"><strong>Tipo de Activo:</strong> ${tool.tipo} ${tool.subtipo ? `• ${tool.subtipo}` : ''}</div>
                <div class="meta-item"><strong>Marca / Modelo:</strong> ${tool.marca || 'Estándar'}</div>
                <div class="meta-item"><strong>Estado General:</strong> <strong>${controlState}</strong></div>
                <div class="meta-item"><strong>Último Control Registrado:</strong> ${formatDate(tool.ultimoControlFecha)}</div>
            </div>

            <div style="font-size: 11.5px; text-transform: uppercase; font-weight: 800; margin-bottom: 6px; color: #0f172a; display: flex; justify-content: space-between;">
                <span>${isCart ? `Desglose de Herramientas en Carro (${itemsToPrint.length} elementos)` : 'Registro de Control y Calibración'}</span>
                <span style="font-size: 10px; color: #64748b; font-weight: normal; text-transform: none;">* Ordenado: herramientas bajo control primero, luego resto alfabético</span>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 15%;">Código ID</th>
                        <th style="width: 35%;">Herramienta / Equipo</th>
                        <th style="width: 12%;">Estado Físico</th>
                        <th style="width: 16%;">Último Control</th>
                        <th style="width: 12%;">Vigencia</th>
                        <th style="width: 10%;">Próx. Vto.</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>

            <!-- Official Verification Box with Direct Link and QR -->
            <div class="verification-seal-container">
                <div class="qr-block">
                    <img src="${qrImgUrl}" alt="QR Verificación" />
                    <div class="qr-text">
                        <strong style="color: #0f172a; text-transform: uppercase; font-size: 11px;">Validación Digital en Tiempo Real</strong><br/>
                        Escanear código QR para auditar la vigencia en vivo en la plataforma HDB SGI.<br/>
                        <span style="font-family: monospace; font-size: 10px; color: #4338ca; font-weight: bold;">Código de Validación: ${tool.id}</span>
                    </div>
                </div>
                <div style="text-align: right; font-size: 9.5px; color: #64748b;">
                    <strong>Portal Público de Auditoría</strong><br/>
                    ${publicVerifyUrl}
                </div>
            </div>

            <div class="footer">
                <div>Documento digital para fiscalizaciones y auditorías de calidad/seguridad HDB SGI.</div>
                <div>ID Único: ${tool.id}</div>
            </div>

            <script>
                window.onload = function() {
                    setTimeout(function() { window.print(); }, 400);
                };
            </script>
        </body>
        </html>`);
        printWindow.document.close();
    };

    // Sorted tools for UI view: Sujetas a control first (A-Z), then sin control (A-Z)
    const conControlList = (tool?.herramientas?.filter(h => h.controlActivo) || []).sort((a, b) => a.nombre.localeCompare(b.nombre));
    const sinControlList = (tool?.herramientas?.filter(h => !h.controlActivo) || []).sort((a, b) => a.nombre.localeCompare(b.nombre));

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-16">
            
            {/* Auditor Top Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white py-3.5 sm:py-4 px-3 sm:px-6 shadow-md border-b border-indigo-900/30">
                <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 sm:gap-3 text-center sm:text-left">
                        <button 
                            onClick={() => router.push('/public/herramientas')}
                            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                            title="Volver al portal general"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 justify-center sm:justify-start">
                                <span className="font-black tracking-tight text-sm sm:text-base">HDB Servicios Eléctricos</span>
                                <span className="bg-indigo-500/30 text-indigo-200 text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-indigo-400/20">AUDIT SGI</span>
                            </div>
                            <p className="text-[11px] text-indigo-200/80 font-medium hidden sm:block">Certificado de Verificación y Control Metrológico</p>
                        </div>
                    </div>

                    {/* Quick Audit Bar Actions */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                            onClick={() => setIsScanning(true)}
                            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow flex items-center justify-center gap-1.5 active:scale-95"
                        >
                            <Camera className="w-3.5 h-3.5" /> Escanear Otro QR
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6 space-y-4 sm:space-y-6">

                {/* Quick Search Toolbar */}
                <div className="bg-card text-card-foreground rounded-2xl p-3 sm:p-4 shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row gap-2.5 items-center justify-between">
                    <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Consultar otro ID o Código (ej. EV5PR2RC, TOOL-001)..."
                                value={searchId}
                                onChange={(e) => setSearchId(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-background border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!searchId.trim()}
                            className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold disabled:opacity-40 transition-all hover:bg-slate-800"
                        >
                            Buscar
                        </button>
                    </form>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="bg-card text-card-foreground rounded-3xl p-10 sm:p-12 shadow-sm border border-slate-200 dark:border-slate-800 text-center space-y-3">
                        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                        <p className="text-xs sm:text-sm font-bold text-slate-500">Consultando estado técnico en base de datos HDB SGI...</p>
                    </div>
                )}

                {/* Error State */}
                {error && !loading && (
                    <div className="bg-card text-card-foreground rounded-3xl p-6 sm:p-8 shadow-sm border border-rose-200 dark:border-rose-900/40 text-center space-y-3">
                        <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                            <XCircle className="w-7 h-7" />
                        </div>
                        <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100">Elemento No Encontrado</h2>
                        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                            No se encontró ningún registro para el identificador <span className="font-mono font-bold text-slate-800 dark:text-slate-200">"{toolId}"</span>.
                        </p>
                        <button
                            onClick={() => setIsScanning(true)}
                            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 hover:bg-indigo-500 transition-all shadow"
                        >
                            <Camera className="w-4 h-4" /> Escanear Código QR
                        </button>
                    </div>
                )}

                {/* Main Tool / Cart Data View */}
                {tool && !loading && (
                    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
                        
                        {/* Status Header Card */}
                        <div className="bg-card text-card-foreground rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden">
                            
                            {/* Top row: Title, ID & Actions */}
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4 sm:pb-6">
                                <div>
                                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                        <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase tracking-wider border border-indigo-200/50 dark:border-indigo-800/50">
                                            {tool.tipo}
                                        </span>
                                        {tool.subtipo && (
                                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider">
                                                {tool.subtipo}
                                            </span>
                                        )}
                                        {tool.rubro && (
                                            <span className="px-2 py-0.5 rounded-lg bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[10px] font-bold uppercase tracking-wider">
                                                {tool.rubro}
                                            </span>
                                        )}
                                    </div>
                                    <h1 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                        {tool.nombre}
                                    </h1>
                                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400 font-mono">
                                        <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">Código: {tool.id}</span>
                                        {tool.marca && <span className="text-slate-500 font-sans">• Marca: <strong className="text-slate-700 dark:text-slate-300">{tool.marca}</strong></span>}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2 self-stretch sm:self-start">
                                    <button
                                        onClick={handleCopyLink}
                                        className="flex-1 sm:flex-initial p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors flex items-center justify-center gap-1.5 text-xs font-bold"
                                        title="Copiar enlace de auditoría"
                                    >
                                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
                                        <span>{copied ? 'Copiado' : 'Compartir'}</span>
                                    </button>
                                    <button
                                        onClick={handlePrintAuditSheet}
                                        className="flex-1 sm:flex-initial px-3.5 py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center justify-center gap-1.5 active:scale-95"
                                    >
                                        <Printer className="w-4 h-4" />
                                        <span>Imprimir Certificado</span>
                                    </button>
                                </div>
                            </div>

                            {/* Control & Calibration Status Banner */}
                            <div className="mt-4 sm:mt-6">
                                {tool.controlActivo ? (
                                    (() => {
                                        const config = ESTADO_CONTROL_CONFIG[tool.estadoControl || 'NUNCA_CONTROLADA'] || ESTADO_CONTROL_CONFIG.NUNCA_CONTROLADA;
                                        const Icon = config.icon;

                                        return (
                                            <div className={`p-3.5 sm:p-5 rounded-2xl border ${config.border} ${config.bg} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
                                                <div className="flex items-start gap-3">
                                                    <div className="p-2 rounded-xl bg-background shadow-xs shrink-0 mt-0.5">
                                                        <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${config.text}`} />
                                                    </div>
                                                    <div>
                                                        <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500">Estado de Control Metrológico</div>
                                                        <div className={`text-sm sm:text-base md:text-lg font-black ${config.text} mt-0.5`}>
                                                            {config.label}
                                                        </div>
                                                        {tool.diasRestantes !== null && tool.diasRestantes !== undefined && (
                                                            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                                                                {tool.diasRestantes >= 0 ? (
                                                                    <span>Vigencia restante: <strong className="font-black text-slate-900 dark:text-slate-100">{tool.diasRestantes} días</strong></span>
                                                                ) : (
                                                                    <span className="text-rose-600 font-bold">Vencido hace {Math.abs(tool.diasRestantes)} días</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/50 dark:border-slate-700/50 w-full sm:w-auto">
                                                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 block">Frecuencia de Control</span>
                                                    <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">Cada {tool.periodoControl} días</span>
                                                </div>
                                            </div>
                                        );
                                    })()
                                ) : (
                                    <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 flex items-center gap-3">
                                        <Wrench className="w-5 h-5 text-slate-400 shrink-0" />
                                        <div className="text-xs font-medium">
                                            Este activo <strong className="font-bold text-slate-800 dark:text-slate-200">no está sujeto a calibración o control periódico</strong> obligatorio.
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Inspection Timeline Metrics */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 mt-4 sm:mt-6">
                                <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-background border border-slate-100 dark:border-slate-800">
                                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-0.5 truncate">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Estado Físico
                                    </span>
                                    <span className={`text-xs sm:text-sm font-black ${tool.estadoHerramienta === 'APROBADA' ? 'text-emerald-600' : (tool.estadoHerramienta === 'RECHAZADA' ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300')}`}>
                                        {tool.estadoHerramienta || 'No Verificada'}
                                    </span>
                                </div>

                                <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-background border border-slate-100 dark:border-slate-800">
                                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-0.5 truncate">
                                        <Calendar className="w-3 h-3 text-indigo-500" /> Último Control
                                    </span>
                                    <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                                        {formatDate(tool.ultimoControlFecha)}
                                    </span>
                                </div>

                                <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-background border border-slate-100 dark:border-slate-800">
                                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-0.5 truncate">
                                        <User className="w-3 h-3 text-indigo-500" /> Responsable
                                    </span>
                                    <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 truncate block">
                                        {tool.ultimoControlOperador || '-'}
                                    </span>
                                </div>

                                <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-background border border-slate-100 dark:border-slate-800">
                                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-0.5 truncate">
                                        <Clock className="w-3 h-3 text-amber-500" /> Próx. Control
                                    </span>
                                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
                                        {formatDate(tool.proximoControlFecha)}
                                    </span>
                                </div>
                            </div>

                            {/* Additional info: Cart attachment / Description */}
                            {(tool.descripcion || tool.carro) && (
                                <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-100 dark:border-slate-800 space-y-2">
                                    {tool.carro && (
                                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                                            <Package className="w-4 h-4 text-indigo-500" />
                                            <span>Asignada al Carro: </span>
                                            <button
                                                onClick={() => router.push(`/public/herramientas/${tool.carro?.id}`)}
                                                className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-1"
                                            >
                                                {tool.carro.nombre} ({tool.carro.id}) <ExternalLink className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                    {tool.descripcion && (
                                        <p className="text-xs text-slate-500 font-medium italic">
                                            "{tool.descripcion}"
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* CARRO SECTION: Tool breakdown if this is a tool cart */}
                        {tool.tipo === 'CARRO' && tool.herramientas && (
                            <div className="bg-card text-card-foreground rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800 space-y-5 sm:space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
                                    <div>
                                        <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                            <Package className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
                                            Contenido del Carro de Herramientas
                                        </h2>
                                        <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 font-medium">
                                            Total: {tool.herramientas.length} herramientas asignadas (primeras las sujetas a control)
                                        </p>
                                    </div>

                                    {/* Quick Summary Badges for the Cart */}
                                    {(() => {
                                        const controlled = tool.herramientas.filter(h => h.controlActivo);
                                        const expired = controlled.filter(h => h.estadoControl === 'VENCIDO').length;
                                        const warning = controlled.filter(h => h.estadoControl === 'POR_VENCER').length;
                                        const ok = controlled.filter(h => h.estadoControl === 'EN_VIGENCIA').length;

                                        return (
                                            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                                                <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[11px]">
                                                    {ok} al día
                                                </span>
                                                {warning > 0 && (
                                                    <span className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[11px]">
                                                        {warning} por vencer
                                                    </span>
                                                )}
                                                {expired > 0 && (
                                                    <span className="px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[11px]">
                                                        {expired} vencidas
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div className="space-y-6">
                                    {/* 1. Tools under active control (FIRST, sorted A-Z) */}
                                    {conControlList.length > 0 && (
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                                                <ShieldCheck className="w-4 h-4" /> 1. Herramientas Sujetas a Control ({conControlList.length})
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {conControlList.map((h) => {
                                                    const hConfig = ESTADO_CONTROL_CONFIG[h.estadoControl || 'NUNCA_CONTROLADA'] || ESTADO_CONTROL_CONFIG.NUNCA_CONTROLADA;
                                                    return (
                                                        <div 
                                                            key={h.id} 
                                                            onClick={() => router.push(`/public/herramientas/${h.id}`)}
                                                            className="p-3.5 sm:p-4 rounded-2xl bg-background border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 cursor-pointer transition-all shadow-xs group"
                                                        >
                                                            <div className="flex justify-between items-start gap-2 mb-2">
                                                                <div>
                                                                    <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 transition-colors">
                                                                        {h.nombre}
                                                                    </h4>
                                                                    <span className="text-[10px] font-bold font-mono text-slate-400 block mt-0.5">
                                                                        ID: {h.id} {h.marca ? `• ${h.marca}` : ''}
                                                                    </span>
                                                                </div>
                                                                <div className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider shrink-0 ${hConfig.bg}`}>
                                                                    {hConfig.label}
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                                                                <div>
                                                                    <span className="text-slate-400 block text-[9px] font-bold uppercase">Último Control</span>
                                                                    <span className="font-bold text-slate-700 dark:text-slate-300">{formatDate(h.ultimoControlFecha)}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-slate-400 block text-[9px] font-bold uppercase">Próximo Vto.</span>
                                                                    <span className="font-bold text-slate-700 dark:text-slate-300">{formatDate(h.proximoControlFecha)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* 2. Tools without periodic control (SECOND, sorted A-Z) */}
                                    {sinControlList.length > 0 && (
                                        <div className="space-y-3 pt-2">
                                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                                <Wrench className="w-4 h-4" /> 2. Otras Herramientas y Accesorios ({sinControlList.length})
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                {sinControlList.map((h) => (
                                                    <div 
                                                        key={h.id}
                                                        onClick={() => router.push(`/public/herramientas/${h.id}`)}
                                                        className="p-2.5 sm:p-3 rounded-xl bg-background border border-slate-200/80 dark:border-slate-800 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                                                    >
                                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{h.nombre}</span>
                                                        <span className="text-[9px] font-mono font-bold text-slate-400 shrink-0 ml-2">{h.id}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Recent Verification History */}
                        {tool.verificaciones && tool.verificaciones.length > 0 && (
                            <div className="bg-card text-card-foreground rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
                                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-indigo-500" />
                                    Historial Reciente de Verificaciones
                                </h3>
                                <div className="space-y-2">
                                    {tool.verificaciones.map((v: any) => (
                                        <div 
                                            key={v.id} 
                                            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl sm:rounded-2xl bg-background border border-slate-100 dark:border-slate-800/80 gap-1.5"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                {v.estado === 'APROBADA' ? (
                                                    <div className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                    </div>
                                                ) : (
                                                    <div className="p-1 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-600">
                                                        <XCircle className="w-3.5 h-3.5" />
                                                    </div>
                                                )}
                                                <div>
                                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                        Verificación {v.estado}
                                                    </span>
                                                    <span className="text-[10px] sm:text-[11px] text-slate-400 block">
                                                        Por: <strong className="text-slate-600 dark:text-slate-300 font-semibold">{v.operadorNombre}</strong>
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 self-end sm:self-center">
                                                {formatDateTime(v.fecha)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Audit Verification Footer Stamp */}
                        <div className="text-center py-4 border-t border-slate-200 dark:border-slate-800 text-[11px] sm:text-xs text-slate-400 space-y-0.5">
                            <p className="font-semibold">HDB Servicios Eléctricos — Sistema de Gestión Integral de Calidad y Seguridad</p>
                            <p className="text-[10px]">Registro público oficial en tiempo real para auditorías y fiscalizaciones.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* QR Scanner Modal */}
            {isScanning && (
                <PublicDetailScannerModal onScan={handleScan} onClose={() => setIsScanning(false)} />
            )}
        </div>
    );
}

// ── Scanner Modal for Detail Page with fixed camera viewport ──────────────────────
function PublicDetailScannerModal({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const containerId = useRef(`detail-reader-${Math.random().toString(36).substring(2, 9)}`).current;

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
