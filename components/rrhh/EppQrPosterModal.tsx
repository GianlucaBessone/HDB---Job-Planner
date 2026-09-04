'use client';

import React, { useState } from 'react';
import { 
    Printer, 
    X, 
    QrCode, 
    Copy, 
    Check
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
    const clientName = share.clientNombre || '';
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
                size={260} 
                level="H"
                includeMargin={false}
            />
        );

        return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>QR Matriz EPP - ${isCliente ? clientName : 'General'}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 15mm 18mm;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        body {
            font-family: Arial, Helvetica, sans-serif;
            color: #1a1a1a;
            background: #fff;
            line-height: 1.3;
        }
        .page {
            width: 100%;
            display: flex;
            flex-direction: column;
            min-height: 267mm;
        }

        /* ── Header bar ── */
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 0 12px 0;
            border-bottom: 2px solid #1a1a1a;
        }
        .header-left {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .header-left img {
            height: 44px;
            object-fit: contain;
        }
        .header-left .company-name {
            font-size: 14px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        .header-right {
            text-align: right;
            font-size: 10px;
            color: #444;
            line-height: 1.5;
        }

        /* ── Department band ── */
        .dept-band {
            background: #1a1a1a;
            color: #fff;
            text-align: center;
            padding: 8px 0;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            margin-top: 0;
        }

        /* ── Content area ── */
        .content {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 28px 0 0 0;
        }

        .doc-title {
            font-size: 20px;
            font-weight: 700;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        }
        .doc-subtitle {
            font-size: 12px;
            color: #555;
            text-align: center;
            margin-bottom: 28px;
        }

        ${isCliente ? `
        .client-line {
            width: 100%;
            border: 1px solid #ccc;
            padding: 10px 16px;
            margin-bottom: 24px;
            display: flex;
            align-items: baseline;
            gap: 8px;
        }
        .client-line .cl-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            color: #666;
            white-space: nowrap;
        }
        .client-line .cl-value {
            font-size: 14px;
            font-weight: 700;
        }
        ` : ''}

        /* ── QR block ── */
        .qr-block {
            text-align: center;
            margin-bottom: 24px;
        }
        .qr-frame {
            display: inline-block;
            padding: 16px;
            border: 2px solid #1a1a1a;
        }
        .qr-frame svg {
            display: block;
        }

        .scan-instruction {
            font-size: 15px;
            font-weight: 700;
            text-align: center;
            margin: 20px 0 6px 0;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        .scan-detail {
            font-size: 11px;
            color: #555;
            text-align: center;
            max-width: 420px;
            margin: 0 auto 20px auto;
        }

        /* ── Info rows ── */
        .info-section {
            width: 100%;
            border-top: 1px solid #ddd;
            padding-top: 16px;
            margin-top: 8px;
        }
        .info-section .info-heading {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            color: #666;
            margin-bottom: 8px;
            letter-spacing: 0.5px;
        }
        .info-list {
            list-style: none;
            padding: 0;
        }
        .info-list li {
            font-size: 10.5px;
            padding: 4px 0;
            border-bottom: 1px solid #eee;
            display: flex;
            align-items: flex-start;
            gap: 6px;
        }
        .info-list li:last-child {
            border-bottom: none;
        }
        .info-list li .bullet {
            font-weight: 700;
            color: #1a1a1a;
            flex-shrink: 0;
        }

        /* ── URL fallback ── */
        .url-row {
            width: 100%;
            margin-top: 16px;
            padding: 8px 12px;
            border: 1px solid #ddd;
            background: #fafafa;
        }
        .url-row .url-label {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            color: #888;
            margin-bottom: 2px;
        }
        .url-row .url-value {
            font-family: 'Courier New', monospace;
            font-size: 10px;
            word-break: break-all;
            color: #1a1a1a;
        }

        /* ── Footer ── */
        .footer {
            border-top: 2px solid #1a1a1a;
            padding-top: 8px;
            margin-top: 20px;
            display: flex;
            justify-content: space-between;
            font-size: 8.5px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
            <div class="header-left">
                <img src="${origin}/logo-hdb.jpg" alt="HDB" onerror="this.style.display='none'" />
                <span class="company-name">HDB Servicios Eléctricos</span>
            </div>
            <div class="header-right">
                Bassignana Hernán David<br>
                C.U.I.T. 20-26566944-2
            </div>
        </div>

        <div class="dept-band">
            Departamento de Higiene y Seguridad
        </div>

        <div class="content">
            <div class="doc-title">Registro de Cumplimiento EPP</div>
            <div class="doc-subtitle">Matriz de entrega y vigencia de Elementos de Protección Personal</div>

            ${isCliente ? `
            <div class="client-line">
                <span class="cl-label">Cliente:</span>
                <span class="cl-value">${clientName}</span>
            </div>
            ` : ''}

            <div class="qr-block">
                <div class="qr-frame">
                    ${qrSvg}
                </div>
            </div>

            <div class="scan-instruction">Escanee este código para consultar el registro</div>
            <div class="scan-detail">
                Apunte con la cámara de su teléfono al código QR para acceder a la matriz de cumplimiento EPP actualizada en tiempo real. No requiere aplicaciones ni contraseñas.
            </div>

            <div class="info-section">
                <div class="info-heading">Información disponible en el registro digital</div>
                <ul class="info-list">
                    <li><span class="bullet">—</span> Estado de entrega y vigencia de EPP por operario</li>
                    <li><span class="bullet">—</span> Fechas de última entrega y próximo vencimiento</li>
                    <li><span class="bullet">—</span> Actas de entrega con firma del trabajador (Res. SRT 299/11)</li>
                    <li><span class="bullet">—</span> Planilla oficial imprimible conforme al Anexo I</li>
                </ul>
            </div>

            <div class="url-row">
                <div class="url-label">Acceso alternativo por URL</div>
                <div class="url-value">${shareUrl}</div>
            </div>
        </div>

        <div class="footer">
            <span>HDB Servicios Eléctricos · Juan Bautista Alberdi 448, Arroyito, Córdoba</span>
            <span>Emitido el ${emitDate}</span>
        </div>
    </div>
</body>
</html>`;
    };

    const handlePrint = () => {
        const html = getHtmlContent();
        
        const printWindow = window.open('', '_blank', 'width=950,height=1000');
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => { printWindow.print(); }, 600);
            return;
        }

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
                if (document.body.contains(iframe)) document.body.removeChild(iframe);
            }, 60000);
        }, 600);
    };

    // ── Modal UI ──
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl my-6">
                {/* Cabecera */}
                <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                            <QrCode className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">
                                Imprimir QR de Acceso
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Hoja A4 vertical para cartelera de obra, comedor u oficina
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

                {/* Vista previa */}
                <div className="p-4 sm:p-6 max-h-[75vh] overflow-y-auto bg-slate-100/70 dark:bg-slate-950/60 text-xs">
                    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 max-w-xl mx-auto text-slate-800 dark:text-slate-100" style={{ aspectRatio: '210/297' }}>
                        <div className="flex flex-col h-full p-5 sm:p-6">
                            {/* Header */}
                            <div className="flex items-center justify-between pb-2.5 border-b-2 border-slate-900 dark:border-slate-300">
                                <span className="font-bold text-xs uppercase tracking-tight text-slate-900 dark:text-white">
                                    HDB Servicios Eléctricos
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 text-right leading-snug">
                                    Bassignana Hernán David<br />
                                    C.U.I.T. 20-26566944-2
                                </span>
                            </div>

                            {/* Dept band */}
                            <div className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-center py-1.5 text-[10px] font-bold uppercase tracking-widest">
                                Departamento de Higiene y Seguridad
                            </div>

                            {/* Content */}
                            <div className="flex-1 flex flex-col items-center pt-4">
                                <h4 className="text-sm font-bold uppercase text-center tracking-wide text-slate-900 dark:text-white">
                                    Registro de Cumplimiento EPP
                                </h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center mb-3">
                                    Matriz de entrega y vigencia de Elementos de Protección Personal
                                </p>

                                {isCliente && (
                                    <div className="w-full border border-slate-300 dark:border-slate-700 px-3 py-2 mb-3 flex items-baseline gap-2">
                                        <span className="text-[9px] font-bold uppercase text-slate-500">Cliente:</span>
                                        <span className="text-xs font-bold text-slate-900 dark:text-white">{clientName}</span>
                                    </div>
                                )}

                                {/* QR */}
                                <div className="inline-block p-3 border-2 border-slate-900 dark:border-slate-600 my-2">
                                    <QRCodeSVG value={shareUrl} size={140} level="H" />
                                </div>

                                <p className="text-xs font-bold uppercase text-center mt-2 text-slate-900 dark:text-white tracking-wide">
                                    Escanee este código para consultar el registro
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center max-w-xs mt-1 leading-relaxed">
                                    Apunte con la cámara de su teléfono al código QR. No requiere aplicaciones ni contraseñas.
                                </p>

                                {/* Info */}
                                <div className="w-full border-t border-slate-200 dark:border-slate-800 pt-2.5 mt-3">
                                    <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider block mb-1.5">
                                        Información disponible
                                    </span>
                                    <ul className="space-y-0.5 text-[10px] text-slate-700 dark:text-slate-300">
                                        <li className="flex gap-1.5"><span className="font-bold text-slate-900 dark:text-white">—</span> Estado de entrega y vigencia de EPP por operario</li>
                                        <li className="flex gap-1.5"><span className="font-bold text-slate-900 dark:text-white">—</span> Actas con firma del trabajador (Res. SRT 299/11)</li>
                                        <li className="flex gap-1.5"><span className="font-bold text-slate-900 dark:text-white">—</span> Planilla oficial imprimible conforme al Anexo I</li>
                                    </ul>
                                </div>

                                {/* URL */}
                                <div className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-1.5 mt-2.5">
                                    <span className="text-[8px] font-bold uppercase text-slate-400 block">Acceso alternativo</span>
                                    <span className="font-mono text-[9px] text-slate-600 dark:text-slate-300 break-all select-all">{shareUrl}</span>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex justify-between border-t-2 border-slate-900 dark:border-slate-300 pt-1.5 mt-3 text-[8px] text-slate-500 dark:text-slate-400">
                                <span>HDB Servicios Eléctricos · Arroyito, Córdoba</span>
                                <span>Emitido el {emitDate}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Acciones */}
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
                            Imprimir QR
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
