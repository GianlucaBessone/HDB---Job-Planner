'use client';

import React from 'react';
import { X, Printer, ShoppingCart, Copy, FileCheck2, Download, ExternalLink } from 'lucide-react';

interface Props {
    isOpen: boolean;
    cotizacion: any;
    onClose: () => void;
    onNuevaCotizacion?: () => void;
    onEnviarAPdv?: (cotizacion: any) => void;
    onDuplicar?: (cotizacion: any) => void;
}

export default function ImprimirCotizacionModal({
    isOpen,
    cotizacion,
    onClose,
    onNuevaCotizacion,
    onEnviarAPdv,
    onDuplicar,
}: Props) {
    if (!isOpen || !cotizacion) return null;

    const fmt = (n: number) =>
        (Number(n) || 0).toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

    const fmtDate = (iso: string | Date | null) => {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            });
        } catch {
            return String(iso);
        }
    };

    const items = Array.isArray(cotizacion.items) ? cotizacion.items : [];
    const tieneDescuentosLinea = items.some(
        (it: any) => (it.descuentoPorcentaje || it.descuentoPct || 0) > 0
    );

    const pdfUrl = `/api/ventas/cotizaciones/${cotizacion.id}/pdf`;
    const pdfDownloadUrl = `${pdfUrl}?download=true`;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto">
            {/* Reglas CSS para impresión limpia sin capturas de pantalla ni elementos de UI */}
            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 10mm;
                    }
                    body {
                        visibility: hidden !important;
                        background: #ffffff !important;
                    }
                    #cotizacion-imprimible,
                    #cotizacion-imprimible * {
                        visibility: visible !important;
                    }
                    #cotizacion-imprimible {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                }
            `}</style>

            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden print:shadow-none print:border-none print:max-w-none print:max-h-none print:overflow-visible">
                {/* Barra superior de acciones (oculta en impresión) */}
                <div className="px-6 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0">
                            <FileCheck2 className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-black text-base">
                                    Cotización {cotizacion.numero}
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                                    {cotizacion.estado || 'VIGENTE'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                Plantilla Oficial HDB Servicios Eléctricos • Formato A4
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {onEnviarAPdv &&
                            cotizacion.estado !== 'CONVERTIDA' &&
                            cotizacion.estado !== 'ANULADA' && (
                                <button
                                    onClick={() => onEnviarAPdv(cotizacion)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors"
                                    title="Cargar esta cotización en el Punto de Venta para facturarla"
                                >
                                    <ShoppingCart className="w-3.5 h-3.5" />
                                    Facturar en PDV
                                </button>
                            )}

                        {onDuplicar && (
                            <button
                                onClick={() => onDuplicar(cotizacion)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                Duplicar
                            </button>
                        )}

                        {/* Botón 1: Descargar PDF nativo generado sobre plantilla corporativa */}
                        <a
                            href={pdfDownloadUrl}
                            download={`Cotizacion_${cotizacion.numero || 'HDB'}.pdf`}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
                            title="Descargar archivo PDF oficial generado por el servidor"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Descargar PDF Oficial
                        </a>

                        {/* Botón 2: Abrir PDF oficial en nueva pestaña */}
                        <a
                            href={pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                            title="Abrir visor de PDF corporativo en nueva pestaña para imprimir o guardar"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Ver / Imprimir PDF
                        </a>

                        {/* Botón 3: Impresión rápida */}
                        <button
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                            title="Impresión rápida de la hoja actual"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            Imprimir
                        </button>

                        {onNuevaCotizacion && (
                            <button
                                onClick={onNuevaCotizacion}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                            >
                                + Nueva
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Hoja A4 Imprimible Corporativa */}
                <div
                    id="cotizacion-imprimible"
                    className="p-8 overflow-y-auto flex-1 print:p-0 print:overflow-visible text-slate-900 bg-white flex flex-col min-h-full"
                >
                    {/* Encabezado Corporativo Oficial */}
                    <div className="border-2 border-slate-900 rounded-xl overflow-hidden mb-5">
                        <div className="grid grid-cols-12 divide-x-2 divide-slate-900">
                            {/* Emisor / Datos de la Empresa y Logo */}
                            <div className="col-span-5 p-4 flex flex-col justify-between">
                                <div>
                                    {/* Logo Institucional de HDB */}
                                    <div className="mb-2">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src="/logo-hdb.jpg"
                                            alt="HDB Servicios Eléctricos"
                                            className="h-11 object-contain"
                                        />
                                    </div>
                                    <div className="text-sm font-black tracking-tight text-slate-950 uppercase">
                                        HDB Servicios Eléctricos
                                    </div>
                                    <div className="text-[11px] font-bold text-sky-700 mt-0.5">
                                        Materiales Eléctricos • Tableros • Obras e Ingeniería
                                    </div>
                                </div>
                                <div className="text-[10px] text-slate-600 mt-2.5 space-y-0.5 border-t border-slate-200 pt-2">
                                    <div>
                                        <span className="font-bold">Razón Social:</span> Bassignana Hernán David
                                    </div>
                                    <div>
                                        <span className="font-bold">C.U.I.T.:</span> 20-26566944-2
                                    </div>
                                    <div>
                                        <span className="font-bold">Dirección:</span> Juan Bautista Alberdi 448, Arroyito (2434), Cba.
                                    </div>
                                    {(cotizacion.vendedorNombre || cotizacion.operadorNombre) && (
                                        <div className="pt-1 text-slate-700">
                                            <span className="font-bold">Atendido por:</span>{' '}
                                            {cotizacion.vendedorNombre || cotizacion.operadorNombre}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Letra Central P / Presupuesto */}
                            <div className="col-span-2 p-3 flex flex-col items-center justify-center bg-slate-50 text-center">
                                <div className="w-12 h-12 rounded-xl border-2 border-slate-900 flex items-center justify-center text-2xl font-black bg-white">
                                    P
                                </div>
                                <div className="text-[8.5px] font-black uppercase tracking-wider text-slate-600 mt-1.5 leading-tight">
                                    DOCUMENTO NO VÁLIDO COMO FACTURA
                                </div>
                            </div>

                            {/* Numeración y Fechas */}
                            <div className="col-span-5 p-4 flex flex-col justify-between bg-slate-50/40">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-sky-800">
                                        Cotización / Presupuesto
                                    </div>
                                    <div className="text-xl font-black font-mono text-slate-900 mt-0.5">
                                        N° {cotizacion.numero}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-200 text-xs">
                                    <div>
                                        <span className="text-[9.5px] uppercase font-bold text-slate-400 block">
                                            Fecha Emisión
                                        </span>
                                        <span className="font-bold text-slate-800">
                                            {fmtDate(cotizacion.fecha)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[9.5px] uppercase font-bold text-slate-400 block">
                                            Válido Hasta ({cotizacion.validezDias || 15}d)
                                        </span>
                                        <span className="font-bold text-amber-800">
                                            {fmtDate(cotizacion.fechaVencimiento)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Datos del Destinatario y Condiciones Comerciales */}
                    <div className="grid grid-cols-12 gap-4 mb-5 bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs">
                        <div className="col-span-7 space-y-1">
                            <div className="text-[10px] font-black uppercase tracking-wider text-sky-800 border-b border-slate-200 pb-1 mb-1.5">
                                Destinatario / Cliente
                            </div>
                            <div className="text-sm font-black text-slate-900">
                                {cotizacion.clienteNombre || 'Consumidor Final'}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-600 text-[11px]">
                                <span>
                                    <strong>CUIT/DNI:</strong>{' '}
                                    <span className="font-mono font-bold">
                                        {cotizacion.clienteIdentificacion ||
                                            cotizacion.clienteCuit ||
                                            'Consumidor Final'}
                                    </span>
                                </span>
                                {cotizacion.clienteTelefono && (
                                    <span>
                                        <strong>Tel:</strong> {cotizacion.clienteTelefono}
                                    </span>
                                )}
                                {cotizacion.clienteEmail && (
                                    <span>
                                        <strong>Email:</strong> {cotizacion.clienteEmail}
                                    </span>
                                )}
                            </div>
                            {cotizacion.clienteDireccion && (
                                <div className="text-slate-600 text-[11px]">
                                    <strong>Dirección:</strong> {cotizacion.clienteDireccion}
                                </div>
                            )}
                        </div>

                        <div className="col-span-5 border-l border-slate-200 pl-4 space-y-1">
                            <div className="text-[10px] font-black uppercase tracking-wider text-sky-800 border-b border-slate-200 pb-1 mb-1.5">
                                Condiciones Comerciales
                            </div>
                            <div className="text-[11px]">
                                <span className="text-slate-500">Condición de Pago:</span>{' '}
                                <strong className="text-slate-900">
                                    {cotizacion.condicionPago || 'Contado / Transferencia'}
                                </strong>
                            </div>
                            <div className="text-[11px]">
                                <span className="text-slate-500">Plazo de Entrega:</span>{' '}
                                <strong className="text-slate-900">
                                    {cotizacion.plazoEntrega || 'Inmediata s/stock'}
                                </strong>
                            </div>
                            {cotizacion.referenciaObra && (
                                <div className="text-[11px]">
                                    <span className="text-slate-500">Obra / Referencia:</span>{' '}
                                    <strong className="text-sky-800">{cotizacion.referenciaObra}</strong>
                                </div>
                            )}
                            <div className="text-[11px]">
                                <span className="text-slate-500">Lista de Precios:</span>{' '}
                                <strong className="text-slate-800">
                                    {cotizacion.listaPrecioNombre || 'General'}
                                </strong>
                            </div>
                        </div>
                    </div>

                    {/* Tabla de Ítems Cotizados */}
                    <div className="border border-slate-300 rounded-xl overflow-hidden mb-5">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-900 text-white">
                                <tr className="text-[10px] font-bold uppercase tracking-wider">
                                    <th className="py-2 px-3 text-center w-9">#</th>
                                    <th className="py-2 px-3 text-left w-24">Código</th>
                                    <th className="py-2 px-3 text-left">Descripción del Material / Servicio</th>
                                    <th className="py-2 px-3 text-center w-20">Cant.</th>
                                    <th className="py-2 px-3 text-right w-28">P. Unit. (ARS)</th>
                                    {tieneDescuentosLinea && (
                                        <th className="py-2 px-3 text-center w-16">Bonif%</th>
                                    )}
                                    <th className="py-2 px-3 text-right w-32">Subtotal (ARS)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {items.map((item: any, idx: number) => {
                                    const descPct =
                                        item.descuentoPorcentaje || item.descuentoPct || 0;
                                    return (
                                        <tr
                                            key={item.id || idx}
                                            className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}
                                        >
                                            <td className="py-2 px-3 text-center font-mono text-slate-400 text-[11px]">
                                                {idx + 1}
                                            </td>
                                            <td className="py-2 px-3 font-mono font-bold text-slate-700 text-[11px]">
                                                {item.sku || item.codigo || '—'}
                                            </td>
                                            <td className="py-2 px-3">
                                                <div className="font-bold text-slate-900">
                                                    {item.descripcion || item.nombre}
                                                </div>
                                                {(item.motivoModificacion || item.observacion) && (
                                                    <div className="text-[10px] text-slate-500 italic mt-0.5">
                                                        Nota: {item.motivoModificacion || item.observacion}
                                                    </div>
                                                )}
                                                {item.marca && (
                                                    <div className="text-[10px] text-slate-400">
                                                        Marca: {item.marca}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono font-bold text-slate-900 text-[11px]">
                                                {item.cantidad}{' '}
                                                <span className="text-[9px] font-normal text-slate-500">
                                                    {item.unidad || 'u'}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-slate-800 text-[11px]">
                                                $ {fmt(item.precioUnitario)}
                                            </td>
                                            {tieneDescuentosLinea && (
                                                <td className="py-2 px-3 text-center font-mono text-emerald-700 font-bold text-[11px]">
                                                    {descPct > 0 ? `${descPct}%` : '—'}
                                                </td>
                                            )}
                                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-950 text-[11px]">
                                                $ {fmt(item.subtotal)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pie de Cotización: Observaciones + Totales en ARS */}
                    <div className="grid grid-cols-12 gap-5 items-start mt-auto pt-6 mb-6">
                        <div className="col-span-7 space-y-3">
                            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                    Observaciones y Alcance de la Oferta
                                </div>
                                <p className="text-slate-700 text-[11px] whitespace-pre-line leading-relaxed">
                                    {cotizacion.observaciones ||
                                        'Presupuesto formal sujeto a verificación de stock y variación de listas de fábrica. Precios expresados en Pesos Argentinos (ARS). Los plazos de entrega comienzan a computarse a partir de la confirmación formal del pedido.'}
                                </p>
                            </div>

                            <div className="pt-6 grid grid-cols-2 gap-6 text-center text-[10px] text-slate-500">
                                <div className="border-t border-slate-300 pt-1.5">
                                    <span className="font-bold text-slate-700 block">
                                        HDB SERVICIOS ELÉCTRICOS
                                    </span>
                                    Firma y Sello Emisor
                                </div>
                                <div className="border-t border-slate-300 pt-1.5">
                                    <span className="font-bold text-slate-700 block">
                                        {cotizacion.clienteNombre || 'CLIENTE'}
                                    </span>
                                    Conformidad y Firma
                                </div>
                            </div>
                        </div>

                        <div className="col-span-5 bg-slate-50/80 rounded-xl border border-slate-200 p-4 space-y-2 text-xs flex flex-col justify-between">
                            <div className="space-y-2">
                                <div className="flex justify-between text-slate-600">
                                    <span>Subtotal ({items.length} ítems):</span>
                                    <span className="font-mono font-semibold">$ {fmt(cotizacion.subtotal)}</span>
                                </div>

                                {(cotizacion.descuentoMonto || 0) > 0 && (
                                    <div className="flex justify-between text-emerald-700">
                                        <span>
                                            Descuento Global ({cotizacion.descuentoPorcentaje || 0}%):
                                        </span>
                                        <span className="font-mono font-semibold">
                                            -$ {fmt(cotizacion.descuentoMonto)}
                                        </span>
                                    </div>
                                )}

                                {(cotizacion.recargoMonto || 0) > 0 && (
                                    <div className="flex justify-between text-slate-700">
                                        <span>Recargos financieros:</span>
                                        <span className="font-mono font-semibold">
                                            +$ {fmt(cotizacion.recargoMonto)}
                                        </span>
                                    </div>
                                )}

                                {cotizacion.ivaDiscriminado && (
                                    <>
                                        <div className="flex justify-between text-slate-700 pt-1 border-t border-slate-200">
                                            <span>Subtotal Neto Gravado:</span>
                                            <span className="font-mono font-semibold">
                                                $ {fmt((cotizacion.subtotal || 0) - (cotizacion.descuentoMonto || 0))}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-slate-700">
                                            <span>IVA Discriminado:</span>
                                            <span className="font-mono font-semibold">
                                                $ {fmt(cotizacion.impuestosMonto || 0)}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="pt-3 mt-1">
                                <div className="pt-3 border-t border-slate-200 flex items-baseline justify-between">
                                    <span className="text-sm font-bold uppercase tracking-wider text-slate-900">
                                        Total Cotizado
                                    </span>
                                    <span className="text-2xl font-black font-mono text-slate-950">
                                        $ {fmt(cotizacion.total)}{' '}
                                        <span className="text-xs font-sans font-bold text-slate-500">ARS</span>
                                    </span>
                                </div>
                                <div className="text-[10px] text-right font-medium text-slate-500 pt-2 mt-1">
                                    {cotizacion.ivaDiscriminado
                                        ? 'Precios con IVA discriminado incluido en el Total'
                                        : 'Precios finales (IVA incluido) — Moneda: ARS'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Oficial */}
                    <div className="border-t border-slate-300 pt-2 text-[9.5px] text-slate-500 flex justify-between items-center">
                        <span>
                            HDB Servicios Eléctricos • Juan Bautista Alberdi 448, Arroyito (Cba) • CUIT 20-26566944-2
                        </span>
                        <span>Sistema de Gestión Integral (SGI)</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
