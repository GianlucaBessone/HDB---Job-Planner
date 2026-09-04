'use client';

import React, { useState } from 'react';
import { 
    Printer, 
    X, 
    QrCode, 
    Copy, 
    Check, 
    ShieldCheck, 
    Building2, 
    Users, 
    ExternalLink,
    Smartphone,
    FileCheck2,
    CheckCircle2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { renderToString } from 'react-dom/server';
import { showToast } from '@/components/Toast';

interface EppQrPosterModalProps {
    isOpen: boolean;
    onClose: () => void;
    shareUrl: string;
    share: {
        id?: string;
        token?: string;
        titulo?: string;
        tipo?: 'CLIENTE' | 'GENERAL' | string;
        clientNombre?: string | null;
        createdAt?: string | Date;
    };
}

export default function EppQrPosterModal({
    isOpen,
    onClose,
    shareUrl,
    share
}: EppQrPosterModalProps) {
    const [copied, setCopied] = useState(false);

    if (!isOpen || !shareUrl) return null;

    const isCliente = share.tipo === 'CLIENTE' && Boolean(share.clientNombre);
    const clientName = share.clientNombre || 'Cliente Asignado';
    const mainTitle = share.titulo || (isCliente ? `Matriz de EPP · ${clientName}` : 'Matriz General de EPP');
    const emitDate = new Date().toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        showToast('Enlace copiado al portapapeles', 'success');
        setTimeout(() => setCopied(false), 2500);
    };

    const getHtmlContent = () => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const qrSvg = renderToString(
            <QRCodeSVG 
                value={shareUrl} 
                size={230} 
                level="H"
                includeMargin={false}
            />
        );

        return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Cartel QR - Matriz de Cumplimiento EPP - ${isCliente ? clientName : 'Dotación General'}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 10mm 12mm;
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
            background: #ffffff;
            color: #0f172a;
            -webkit-font-smoothing: antialiased;
        }
        .poster-frame {
            border: 3px solid #0f172a;
            border-radius: 16px;
            padding: 24px 28px;
            min-height: 272mm;
            max-height: 272mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            page-break-inside: avoid;
            background: #ffffff;
            position: relative;
        }
        .header-section {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 14px;
        }
        .header-brand {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .header-brand img {
            height: 48px;
            max-width: 140px;
            object-fit: contain;
        }
        .header-brand-info h2 {
            margin: 0;
            font-size: 15px;
            font-weight: 900;
            letter-spacing: -0.2px;
            color: #0f172a;
            text-transform: uppercase;
        }
        .header-brand-info p {
            margin: 2px 0 0 0;
            font-size: 10px;
            color: #475569;
            font-weight: 600;
        }
        .header-badge {
            background-color: #0f172a;
            color: #ffffff;
            padding: 7px 14px;
            border-radius: 9999px;
            text-align: right;
        }
        .header-badge .badge-main {
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            display: block;
        }
        .header-badge .badge-sub {
            font-size: 8.5px;
            opacity: 0.85;
            display: block;
        }
        .title-block {
            text-align: center;
            margin: 18px 0 12px 0;
        }
        .title-block .subtitle-tag {
            display: inline-block;
            background: #f1f5f9;
            color: #334155;
            font-size: 10px;
            font-weight: 800;
            padding: 4px 12px;
            border-radius: 6px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 6px;
        }
        .title-block h1 {
            margin: 0;
            font-size: 22px;
            font-weight: 900;
            color: #0f172a;
            line-height: 1.15;
            text-transform: uppercase;
        }
        .title-block p {
            margin: 5px 0 0 0;
            font-size: 12px;
            font-weight: 600;
            color: #475569;
        }
        .client-box {
            border: 2px solid ${isCliente ? '#f59e0b' : '#6366f1'};
            background: ${isCliente ? '#fffbeb' : '#f8fafc'};
            border-radius: 12px;
            padding: 12px 18px;
            margin: 8px 0 14px 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .client-box .label {
            font-size: 9.5px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: ${isCliente ? '#b45309' : '#4338ca'};
            margin-bottom: 2px;
        }
        .client-box .value {
            font-size: 17px;
            font-weight: 900;
            color: #0f172a;
        }
        .client-box .meta {
            font-size: 10px;
            font-weight: 600;
            color: #64748b;
            text-align: right;
            max-width: 250px;
        }
        .qr-hero-card {
            background: #ffffff;
            border: 2px solid #cbd5e1;
            border-radius: 14px;
            padding: 20px 24px;
            text-align: center;
            margin: 4px 0;
        }
        .qr-hero-card .scan-headline {
            font-size: 15px;
            font-weight: 900;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-bottom: 3px;
        }
        .qr-hero-card .scan-subtext {
            font-size: 11px;
            font-weight: 600;
            color: #64748b;
            margin-bottom: 16px;
        }
        .qr-code-wrapper {
            display: inline-block;
            background: #ffffff;
            padding: 14px;
            border: 2px solid #0f172a;
            border-radius: 14px;
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
            margin-bottom: 14px;
        }
        .qr-code-wrapper svg {
            display: block;
            margin: 0 auto;
        }
        .instructions-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-top: 10px;
            text-align: left;
        }
        .instruction-item {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 10px 12px;
        }
        .instruction-item .item-title {
            font-size: 10px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            margin-bottom: 3px;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .instruction-item .item-desc {
            font-size: 9px;
            color: #475569;
            line-height: 1.35;
            font-weight: 500;
        }
        .url-access-box {
            background: #f1f5f9;
            border: 1px dashed #94a3b8;
            border-radius: 10px;
            padding: 8px 14px;
            margin: 12px 0 6px 0;
            text-align: center;
        }
        .url-access-box .url-label {
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            color: #475569;
            margin-bottom: 2px;
        }
        .url-access-box .url-text {
            font-family: 'Courier New', Courier, monospace;
            font-size: 10.5px;
            font-weight: 700;
            color: #0f172a;
            word-break: break-all;
        }
        .footer-section {
            border-top: 2px solid #e2e8f0;
            padding-top: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 9px;
            color: #64748b;
        }
        .footer-section .footer-left {
            font-weight: 700;
            color: #334155;
        }
        .footer-section .footer-right {
            text-align: right;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="poster-frame">
        <!-- Encabezado Corporativo -->
        <div class="header-section">
            <div class="header-brand">
                <img src="${origin}/logo-hdb.jpg" alt="HDB Servicios Eléctricos" onerror="this.style.display='none'" />
                <div class="header-brand-info">
                    <h2>HDB Servicios Eléctricos</h2>
                    <p>Bassignana Hernán David · C.U.I.T.: 20-26566944-2</p>
                    <p>Departamento de Higiene y Seguridad Laboral</p>
                </div>
            </div>
            <div class="header-badge">
                <span class="badge-main">Higiene y Seguridad</span>
                <span class="badge-sub">Sistema de Gestión Integral HDB</span>
            </div>
        </div>

        <!-- Título Principal -->
        <div class="title-block">
            <span class="subtitle-tag">Registro Oficial de Control y Asignación</span>
            <h1>Matriz de Cumplimiento y Entrega de EPP</h1>
            <p>${mainTitle}</p>
        </div>

        <!-- Tarjeta de Alcance / Cliente -->
        <div class="client-box">
            <div>
                <div class="label">${isCliente ? 'Cliente / Destinatario' : 'Alcance del Registro'}</div>
                <div class="value">${isCliente ? clientName : 'Dotación Operativa General'}</div>
            </div>
            <div class="meta">
                ${isCliente 
                    ? 'Operarios con horas de servicio asignadas en los últimos 90 días y su estado de protección personal.'
                    : 'Control integral de entregas y vigencias para todo el personal operativo de la empresa.'}
            </div>
        </div>

        <!-- Card Central con Código QR -->
        <div class="qr-hero-card">
            <div class="scan-headline">Escanee para acceder al registro de cumplimiento EPP</div>
            <div class="scan-subtext">Consulte en tiempo real la vigencia, entregas y actas digitales de los operarios</div>

            <div class="qr-code-wrapper">
                ${qrSvg}
            </div>

            <!-- Guía de 3 pasos / especificación -->
            <div class="instructions-grid">
                <div class="instruction-item">
                    <div class="item-title">📱 Escaneo Inmediato</div>
                    <div class="item-desc">Apunte con la cámara de su teléfono o tablet al código QR. No requiere descargar aplicaciones ni ingresar contraseñas.</div>
                </div>
                <div class="instruction-item">
                    <div class="item-title">🛡️ Estado en Tiempo Real</div>
                    <div class="item-desc">Verifique qué EPP posee cada trabajador, su fecha de renovación y el estado de cumplimiento operativo al día de hoy.</div>
                </div>
                <div class="instruction-item">
                    <div class="item-title">✍️ Planilla Oficial 299/11</div>
                    <div class="item-desc">Acceso instantáneo a los legajos digitales y constancias firmadas conforme a la normativa oficial de la SRT.</div>
                </div>
            </div>
        </div>

        <!-- Acceso alternativo por URL -->
        <div class="url-access-box">
            <div class="url-label">Enlace de Acceso Directo (Si no dispone de escáner QR):</div>
            <div class="url-text">${shareUrl}</div>
        </div>

        <!-- Pie de Página y Auditoría -->
        <div class="footer-section">
            <div class="footer-left">
                HDB SERVICIOS ELÉCTRICOS · Juan Laiz N° 496, Arroyito, Córdoba
            </div>
            <div class="footer-right">
                Fecha de Emisión: ${emitDate} · Documento Oficial de Consulta en Higiene y Seguridad
            </div>
        </div>
    </div>
</body>
</html>`;
    };

    const handlePrint = () => {
        const html = getHtmlContent();
        
        // Intentar abrir ventana popup
        const printWindow = window.open('', '_blank', 'width=950,height=1000');
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 600);
            return;
        }

        // Fallback a iframe invisible si el navegador bloquea popups
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (!doc) {
            showToast('No se pudo inicializar la impresión', 'error');
            return;
        }

        doc.open();
        doc.write(html);
        doc.close();

        setTimeout(() => {
            if (iframe.contentWindow) {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            }
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 60000);
        }, 600);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl my-6">
                {/* Cabecera del Modal */}
                <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                            <QrCode className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">
                                Cartel de Notificación con Código QR (A4 Vertical)
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Listo para imprimir en A4 y colocar en cartelera de obra, comedor o enviar al cliente
                            </p>
                        </div>
                    </div>

                    <button 
                        onClick={onClose} 
                        className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Vista Previa del Cartel A4 */}
                <div className="p-4 sm:p-6 max-h-[75vh] overflow-y-auto bg-slate-100/70 dark:bg-slate-950/60 text-xs">
                    <div className="bg-white dark:bg-slate-900 border-2 border-slate-800 dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-md max-w-xl mx-auto space-y-4 text-slate-800 dark:text-slate-100">
                        {/* Header preview */}
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-tight">
                                    HDB SERVICIOS ELÉCTRICOS
                                </div>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-[10px] font-black uppercase tracking-wider">
                                Higiene y Seguridad
                            </span>
                        </div>

                        {/* Title block preview */}
                        <div className="text-center space-y-1">
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                REGISTRO OFICIAL DE CONTROL Y ASIGNACIÓN
                            </span>
                            <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase">
                                Matriz de Cumplimiento y Entrega de EPP
                            </h4>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                {mainTitle}
                            </p>
                        </div>

                        {/* Client / Scope box preview */}
                        <div className={`p-3 rounded-xl border flex items-center justify-between ${
                            isCliente 
                                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800' 
                                : 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800'
                        }`}>
                            <div className="space-y-0.5">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    {isCliente ? 'Cliente / Destinatario' : 'Alcance del Registro'}
                                </span>
                                <div className="text-sm font-black text-slate-900 dark:text-white">
                                    {isCliente ? clientName : 'Dotación Operativa General'}
                                </div>
                            </div>
                            <div className="text-right text-[10px] text-slate-500 dark:text-slate-400 hidden sm:block max-w-[200px]">
                                {isCliente ? 'Operarios asignados al cliente' : 'Toda la dotación activa de la empresa'}
                            </div>
                        </div>

                        {/* QR card hero preview */}
                        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 text-center space-y-3">
                            <div>
                                <h5 className="font-black text-xs uppercase tracking-wide text-slate-900 dark:text-slate-100">
                                    Escanee para acceder al registro de cumplimiento EPP
                                </h5>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    Acceso dinámico y auditable en tiempo real
                                </p>
                            </div>

                            <div className="inline-block p-3 bg-white rounded-2xl border-2 border-slate-900 dark:border-slate-700 shadow-sm">
                                <QRCodeSVG 
                                    value={shareUrl} 
                                    size={180} 
                                    level="H" 
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-left pt-1">
                                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px]">
                                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                                        <Smartphone className="w-3 h-3 text-indigo-500" /> Cámara Móvil
                                    </div>
                                    <p className="text-slate-500 text-[9px] mt-0.5">Sin instalar apps ni iniciar sesión</p>
                                </div>
                                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px]">
                                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                                        <ShieldCheck className="w-3 h-3 text-emerald-500" /> Cobertura EPP
                                    </div>
                                    <p className="text-slate-500 text-[9px] mt-0.5">Vigencias y reposiciones al día</p>
                                </div>
                                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px]">
                                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                                        <FileCheck2 className="w-3 h-3 text-amber-500" /> Res. SRT 299/11
                                    </div>
                                    <p className="text-slate-500 text-[9px] mt-0.5">Planillas con firma digital</p>
                                </div>
                            </div>
                        </div>

                        {/* URL direct display preview */}
                        <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Enlace público directo:</span>
                            <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300 break-all select-all font-semibold">
                                {shareUrl}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Acciones del Modal */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={handleCopyUrl}
                        className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold flex items-center justify-center gap-2 text-xs transition-all"
                    >
                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        {copied ? '¡Copiado!' : 'Copiar Enlace'}
                    </button>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs"
                        >
                            Cerrar
                        </button>

                        <button
                            type="button"
                            onClick={handlePrint}
                            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-xs shadow-md active:scale-95 transition-all"
                        >
                            <Printer className="w-4 h-4" />
                            Imprimir Cartel (A4)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
