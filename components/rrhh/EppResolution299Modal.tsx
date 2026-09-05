'use client';

import React, { useState } from 'react';
import { 
    Printer, 
    X, 
    FileText, 
    CheckCircle2, 
    ShieldCheck, 
    Building2, 
    Fingerprint,
    Calendar,
    Download,
    Copy
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { renderToString } from 'react-dom/server';

interface EppResolution299ModalProps {
    isOpen: boolean;
    onClose: () => void;
    operator: {
        id?: string;
        nombreCompleto: string;
        dni?: string | null;
        posicion?: string | null;
        role?: string | null;
    };
    deliveries: any[];
}

export default function EppResolution299Modal({
    isOpen,
    onClose,
    operator,
    deliveries = []
}: EppResolution299ModalProps) {
    // Filtramos entregas con estado FIRMADA por defecto, o todas si no hay firmadas
    const signedDeliveries = deliveries.filter(d => d.estado === 'FIRMADA');
    const displayDeliveries = signedDeliveries.length > 0 ? signedDeliveries : deliveries;

    // Filtro por acta específica o todas
    const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>('ALL');
    const [copiedHash, setCopiedHash] = useState<string | null>(null);

    const handleCopyHash = (hash: string) => {
        if (!hash) return;
        navigator.clipboard.writeText(hash);
        setCopiedHash(hash);
        setTimeout(() => setCopiedHash(null), 2000);
    };

    if (!isOpen || !operator) return null;

    const filteredDeliveries = selectedDeliveryId === 'ALL'
        ? displayDeliveries
        : displayDeliveries.filter(d => d.id === selectedDeliveryId);

    // Desglosamos todos los items entregados
    const deliveredItemsList: Array<{
        item: any;
        delivery: any;
    }> = [];

    filteredDeliveries.forEach(del => {
        if (del.items && Array.isArray(del.items)) {
            del.items.forEach((it: any) => {
                deliveredItemsList.push({
                    item: it,
                    delivery: del
                });
            });
        }
    });

    // La planilla oficial del Anexo I cuenta con 18 filas
    const TOTAL_ROWS = Math.max(18, deliveredItemsList.length);
    const rowsArray = Array.from({ length: TOTAL_ROWS }, (_, i) => deliveredItemsList[i] || null);

    const handlePrint = () => {
        const printWindow = window.open('', '_blank', 'width=1100,height=800');
        if (!printWindow) {
            alert('Por favor permita las ventanas emergentes (popups) para generar la impresión.');
            return;
        }

        const origin = window.location.origin;
        const verifyUrl = `${origin}/public/verificar-firma`;
        const qrSvg = renderToString(
            <QRCodeSVG value={verifyUrl} size={50} level="M" />
        );

        const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Planilla Oficial EPP - Res. 299/11 - ${operator.nombreCompleto}</title>
    <style>
        @page {
            size: A4 landscape;
            margin: 6mm 8mm;
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        body {
            margin: 0;
            padding: 0;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 9.5px;
            color: #000;
            background: #fff;
            line-height: 1.15;
        }
        .sheet-container {
            width: 100%;
            max-width: 100%;
            margin: 0 auto;
        }
        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-bottom: 4px;
        }
        .header-top img {
            height: 38px;
            object-fit: contain;
        }
        .header-top .resolucion-tag {
            font-style: italic;
            font-weight: bold;
            font-size: 11.5px;
            color: #000;
        }
        .title-banner {
            background-color: #000000;
            color: #ffffff;
            font-weight: 900;
            font-size: 12px;
            text-align: center;
            padding: 4px 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 3px;
        }
        table.info-grid {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 4px;
            font-size: 9px;
        }
        table.info-grid td {
            border: 1px solid #000;
            padding: 3px 5px;
            vertical-align: top;
        }
        table.epp-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8.5px;
        }
        table.epp-table th {
            border: 1px solid #000;
            background-color: #f1f5f9;
            padding: 3px 4px;
            font-weight: bold;
            text-align: center;
            line-height: 1.1;
        }
        table.epp-table td {
            border: 1px solid #000;
            padding: 2.5px 4px;
            height: 18px;
            vertical-align: middle;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        .signature-cell {
            font-size: 7.5px;
            line-height: 1.05;
            text-align: center;
        }
        .signature-stamp {
            color: #065f46;
            font-weight: bold;
            display: block;
        }
        .signature-hash {
            font-family: monospace;
            font-size: 7px;
            color: #475569;
            display: block;
        }
        .footer-note {
            border: 1px solid #000;
            border-top: none;
            padding: 3px 6px;
            font-size: 8.5px;
            background: #fff;
        }
    </style>
</head>
<body>
    <div class="sheet-container">
        <!-- Logo y Resolución -->
        <div class="header-top">
            <div>
                <img src="${origin}/logo-hdb.jpg" alt="HDB Servicios Eléctricos" />
            </div>
            <div class="resolucion-tag">
                Resolución 299/11, Anexo I
            </div>
        </div>

        <!-- Banner de Título -->
        <div class="title-banner">
            ENTREGA DE ROPA DE TRABAJO Y ELEMENTOS DE PROTECCIÓN PERSONAL
        </div>

        <!-- Encabezado de Empresa y Trabajador -->
        <table class="info-grid">
            <tr>
                <td style="width: 62%;">(1) Razón Social: <span class="bold">Bassignana Hernán David</span></td>
                <td style="width: 38%;">(2) C.U.I.T.: <span class="bold">20-26566944-2</span></td>
            </tr>
            <tr>
                <td colspan="2" style="padding: 0;">
                    <table style="width: 100%; border-collapse: collapse; margin: -1px; font-size: 9px;">
                        <tr>
                            <td style="width: 40%; border: 1px solid #000; border-top: none; border-left: none; padding: 2px 5px;">(3) Dirección: <span class="bold">Juan Bautista Alberdi 448</span></td>
                            <td style="width: 25%; border: 1px solid #000; border-top: none; padding: 2px 5px;">(4) Localidad: <span class="bold">Arroyito</span></td>
                            <td style="width: 15%; border: 1px solid #000; border-top: none; padding: 2px 5px;">(5) C.P.: <span class="bold">2434</span></td>
                            <td style="width: 20%; border: 1px solid #000; border-top: none; border-right: none; padding: 2px 5px;">(6) Provincia: <span class="bold">Córdoba</span></td>
                        </tr>
                    </table>
                </td>
            </tr>
            <tr>
                <td style="width: 62%;">(7) Apellido y Nombre del Trabajador: <span class="bold">${operator.nombreCompleto}</span></td>
                <td style="width: 38%;">(8) D.N.I.: <span class="bold">${operator.dni || 'S/D'}</span></td>
            </tr>
            <tr>
                <td style="width: 50%; vertical-align: top; height: 36px;">
                    <div style="font-size: 8.5px; color: #333;">(9) Descripción breve del puesto/s de trabajo en el/los cuales se desempeña en trabajador:</div>
                    <div class="bold" style="font-size: 9.5px; margin-top: 2px;">
                        ${operator.posicion || operator.role || 'Operario de Montaje e Instalaciones Eléctricas'}
                    </div>
                </td>
                <td style="width: 50%; vertical-align: top; height: 36px;">
                    <div style="font-size: 8.5px; color: #333;">(10) Elementos de protección personal, necesarios para el trabajador, según el puesto de trabajo:</div>
                    <div style="font-size: 8.5px; font-weight: 600; margin-top: 2px;">
                        zapatos de seguridad dieléctrico, lentes protectores, casco de seguridad con barbijo, guantes de trabajo (nitrilo / anticorte), ropa grafa.
                    </div>
                </td>
            </tr>
        </table>

        <!-- Tabla de EPP (18 filas) -->
        <table class="epp-table">
            <thead>
                <tr>
                    <th style="width: 26px;">#</th>
                    <th style="width: 23%;">(11) Producto</th>
                    <th style="width: 19%;">(12) Tipo // Modelo</th>
                    <th style="width: 14%;">(13) Marca</th>
                    <th style="width: 10%;">(14) Posee certificación<br/>SI // NO</th>
                    <th style="width: 6%;">(15)<br/>Cantidad</th>
                    <th style="width: 11%;">(16) Fecha de<br/>entrega</th>
                    <th style="width: 17%;">(17) Firma del trabajador</th>
                </tr>
            </thead>
            <tbody>
                ${rowsArray.map((rowItem, idx) => {
                    const rowNumber = idx + 1;
                    if (!rowItem) {
                        return `
                            <tr>
                                <td class="text-center bold">${rowNumber}</td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td class="text-center"></td>
                                <td class="text-center"></td>
                                <td class="text-center"></td>
                                <td></td>
                            </tr>
                        `;
                    }

                    const it = rowItem.item;
                    const del = rowItem.delivery;
                    const epp = it.eppItem || {};
                    const fechaStr = it.fechaEntrega 
                        ? new Date(it.fechaEntrega).toLocaleDateString('es-AR')
                        : del.fechaEntrega 
                            ? new Date(del.fechaEntrega).toLocaleDateString('es-AR')
                            : '';

                    const isSigned = del.estado === 'FIRMADA';

                    // Firma digital o manuscrita
                    let signatureHtml = '';
                    if (isSigned) {
                        if (del.firmaManuscritaUrl) {
                            signatureHtml = `<img src="${del.firmaManuscritaUrl}" style="max-height: 16px; object-fit: contain;" />`;
                        } else {
                            signatureHtml = `
                                <div class="signature-cell">
                                    <span class="signature-stamp">✓ FIRMA DIGITAL VÁLIDA</span>
                                    <span class="signature-hash">${del.signatureId || del.codigoActa}</span>
                                </div>
                            `;
                        }
                    }

                    return `
                        <tr>
                            <td class="text-center bold">${rowNumber}</td>
                            <td class="bold">${epp.nombre || 'Elemento EPP'}</td>
                            <td>${epp.descripcion || (it.talle ? 'Talle: ' + it.talle : 'Estándar')}</td>
                            <td>${epp.marca || 'Grafa'}</td>
                            <td class="text-center bold">SI</td>
                            <td class="text-center bold">${it.cantidad || 1}</td>
                            <td class="text-center font-mono">${fechaStr}</td>
                            <td class="text-center">${signatureHtml}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>

        <!-- Nota al pie (18) -->
        <div class="footer-note" style="display: flex; align-items: center; justify-content: space-between;">
            <div>
                (18) Información adicional: Constancia emitida bajo Resolución SRT 299/11 y normativas de Higiene y Seguridad Laboral. Las entregas y firmas digitales cuentan con plena validez legal y trazabilidad criptográfica SHA-256 en el Sistema de Gestión Integral HDB.
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-left: 10px;">
                <div style="font-size: 7px; text-align: right; max-width: 100px; line-height: 1.1;">Escanee el QR para verificar firmas en el Portal SGI</div>
                <div style="display: flex; align-items: center; justify-content: center;">
                    ${qrSvg}
                </div>
            </div>
        </div>
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 300);
        };
    </script>
</body>
</html>
        `;

        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-[1200px] w-full overflow-hidden shadow-2xl flex flex-col my-auto max-h-[95vh]">
                {/* Header del Modal */}
                <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 dark:text-slate-100 text-sm sm:text-base flex items-center gap-2">
                                <span>Planilla Oficial EPP (Resolución 299/11 Anexo I)</span>
                                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-black rounded-full uppercase">
                                    Formato Apaisado
                                </span>
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {operator.nombreCompleto} · DNI: {operator.dni || 'S/D'} · {deliveredItemsList.length} elementos registrados
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Imprimir / Guardar PDF</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Barra de Filtro de Actas */}
                {displayDeliveries.length > 1 && (
                    <div className="px-4 py-2.5 bg-slate-100/60 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                            Actas a incluir en la planilla:
                        </span>
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => setSelectedDeliveryId('ALL')}
                                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                                    selectedDeliveryId === 'ALL'
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                }`}
                            >
                                Todas las Actas ({displayDeliveries.length})
                            </button>
                            {displayDeliveries.map((d: any) => (
                                <button
                                    key={d.id}
                                    onClick={() => setSelectedDeliveryId(d.id)}
                                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all whitespace-nowrap ${
                                        selectedDeliveryId === d.id
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                    }`}
                                >
                                    {d.codigoActa} ({new Date(d.fechaEntrega).toLocaleDateString('es-AR')})
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Previsualización en Pantalla del Formato Res. 299/11 */}
                <div className="p-4 sm:p-6 overflow-y-auto overflow-x-auto flex-1 bg-slate-200/60 dark:bg-slate-950/70">
                    <div className="bg-white text-slate-900 p-5 sm:p-7 rounded-xl shadow-md mx-auto max-w-[1000px] border border-slate-300 font-sans text-xs">
                        {/* Header preview */}
                        <div className="flex justify-between items-end mb-2">
                            <img src="/logo-hdb.jpg" alt="HDB" className="h-9 object-contain" />
                            <span className="italic font-bold text-xs text-slate-800">Resolución 299/11, Anexo I</span>
                        </div>

                        {/* Title preview */}
                        <div className="bg-black text-white text-center font-black text-xs py-1.5 px-3 uppercase tracking-wider mb-2">
                            ENTREGA DE ROPA DE TRABAJO Y ELEMENTOS DE PROTECCIÓN PERSONAL
                        </div>

                        {/* Info Grid preview */}
                        <div className="border border-black text-[11px] mb-2 leading-tight">
                            <div className="grid grid-cols-12 border-b border-black">
                                <div className="col-span-8 p-1.5 border-r border-black">
                                    (1) Razón Social: <strong>Bassignana Hernán David</strong>
                                </div>
                                <div className="col-span-4 p-1.5">
                                    (2) C.U.I.T.: <strong>20-26566944-2</strong>
                                </div>
                            </div>
                            <div className="grid grid-cols-12 border-b border-black">
                                <div className="col-span-5 p-1.5 border-r border-black">
                                    (3) Dirección: <strong>Juan Bautista Alberdi 448</strong>
                                </div>
                                <div className="col-span-3 p-1.5 border-r border-black">
                                    (4) Localidad: <strong>Arroyito</strong>
                                </div>
                                <div className="col-span-2 p-1.5 border-r border-black">
                                    (5) C.P.: <strong>2434</strong>
                                </div>
                                <div className="col-span-2 p-1.5">
                                    (6) Provincia: <strong>Córdoba</strong>
                                </div>
                            </div>
                            <div className="grid grid-cols-12 border-b border-black">
                                <div className="col-span-8 p-1.5 border-r border-black">
                                    (7) Apellido y Nombre del Trabajador: <strong>{operator.nombreCompleto}</strong>
                                </div>
                                <div className="col-span-4 p-1.5">
                                    (8) D.N.I.: <strong>{operator.dni || 'S/D'}</strong>
                                </div>
                            </div>
                            <div className="grid grid-cols-12">
                                <div className="col-span-6 p-1.5 border-r border-black">
                                    <span className="text-[10px] block text-slate-600">(9) Descripción breve del puesto/s de trabajo en el/los cuales se desempeña en trabajador:</span>
                                    <strong className="block mt-0.5">{operator.posicion || operator.role || 'Operario de Instalaciones Eléctricas'}</strong>
                                </div>
                                <div className="col-span-6 p-1.5">
                                    <span className="text-[10px] block text-slate-600">(10) Elementos de protección personal necesarios según puesto:</span>
                                    <span className="block text-[10px] font-semibold mt-0.5">
                                        Zapatos de seguridad dieléctricos, casco de seguridad con barbijo, lentes protectores, guantes anticorte/nitrilo, ropa grafa.
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* EPP Table preview */}
                        <div className="border border-black overflow-hidden mb-1">
                            <table className="w-full text-[10px] border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 font-bold border-b border-black text-center">
                                        <th className="p-1 border-r border-black w-8">#</th>
                                        <th className="p-1 border-r border-black text-left w-[24%]">(11) Producto</th>
                                        <th className="p-1 border-r border-black text-left w-[20%]">(12) Tipo // Modelo</th>
                                        <th className="p-1 border-r border-black text-left w-[14%]">(13) Marca</th>
                                        <th className="p-1 border-r border-black w-[10%]">(14) Cert. SI/NO</th>
                                        <th className="p-1 border-r border-black w-[6%]">(15) Cant.</th>
                                        <th className="p-1 border-r border-black w-[11%]">(16) Fecha</th>
                                        <th className="p-1 w-[15%]">(17) Firma trabajador</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black">
                                    {rowsArray.slice(0, 10).map((rowItem, idx) => {
                                        const num = idx + 1;
                                        if (!rowItem) {
                                            return (
                                                <tr key={num} className="h-5 text-center">
                                                    <td className="p-1 border-r border-black font-bold">{num}</td>
                                                    <td className="p-1 border-r border-black"></td>
                                                    <td className="p-1 border-r border-black"></td>
                                                    <td className="p-1 border-r border-black"></td>
                                                    <td className="p-1 border-r border-black"></td>
                                                    <td className="p-1 border-r border-black"></td>
                                                    <td className="p-1 border-r border-black"></td>
                                                    <td className="p-1"></td>
                                                </tr>
                                            );
                                        }

                                        const it = rowItem.item;
                                        const del = rowItem.delivery;
                                        const epp = it.eppItem || {};

                                        return (
                                            <tr key={num} className="h-6">
                                                <td className="p-1 text-center font-bold border-r border-black">{num}</td>
                                                <td className="p-1 font-bold border-r border-black">{epp.nombre}</td>
                                                <td className="p-1 border-r border-black">{epp.descripcion || (it.talle ? `Talle ${it.talle}` : 'Estándar')}</td>
                                                <td className="p-1 border-r border-black">{epp.marca || 'Grafa'}</td>
                                                <td className="p-1 text-center font-bold border-r border-black">SI</td>
                                                <td className="p-1 text-center font-bold border-r border-black">{it.cantidad || 1}</td>
                                                <td className="p-1 text-center font-mono border-r border-black">
                                                    {new Date(it.fechaEntrega || del.fechaEntrega).toLocaleDateString('es-AR')}
                                                </td>
                                                <td className="p-1 text-center font-bold text-[9px] text-emerald-800">
                                                    {del.estado === 'FIRMADA' ? (
                                                        <div 
                                                            className="flex items-center justify-between gap-1 bg-emerald-50 dark:bg-emerald-950/30 px-1 py-0.5 rounded cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
                                                            onClick={() => handleCopyHash(del.signatureHash || del.signatureId || del.codigoActa || '')}
                                                            title="Copiar Hash de Integridad"
                                                        >
                                                            <span className="font-mono text-[7px] truncate max-w-[90px]" title={del.signatureHash || del.signatureId || del.codigoActa}>
                                                                {del.signatureHash || del.signatureId || del.codigoActa || 'FIRMADA DIGITAL'}
                                                            </span>
                                                            {copiedHash === (del.signatureHash || del.signatureId || del.codigoActa) ? (
                                                                <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-600" />
                                                            ) : (
                                                                <Copy className="w-3 h-3 shrink-0 text-emerald-600/70" />
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 font-normal">PENDIENTE</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {rowsArray.length > 10 && (
                            <div className="text-center text-[10px] text-slate-500 italic py-1">
                                (... y {rowsArray.length - 10} filas adicionales incluidas en la impresión oficial)
                            </div>
                        )}

                        <div className="border border-black p-1.5 text-[9px] mt-1 flex items-center justify-between">
                            <div>
                                (18) Información adicional: Constancia de entrega conforme a Resolución SRT 299/11 y normativas de Higiene y Seguridad con trazabilidad criptográfica.
                            </div>
                            <div className="flex items-center gap-2 ml-4 shrink-0">
                                <div className="text-[7.5px] text-right max-w-[120px] text-slate-700 leading-tight">
                                    Escanee el código QR para verificar la validez de las firmas en el Portal SGI.
                                </div>
                                <QRCodeSVG 
                                    value={typeof window !== 'undefined' ? `${window.location.origin}/public/verificar-firma` : ''} 
                                    size={36} 
                                    level="M" 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer del Modal */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between shrink-0">
                    <span className="text-xs text-slate-500">
                        Total elementos listados: <strong>{deliveredItemsList.length}</strong> (se imprimen en 18 filas reglamentarias)
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs"
                        >
                            Cerrar
                        </button>
                        <button
                            onClick={handlePrint}
                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Imprimir Formato Apaisado</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
