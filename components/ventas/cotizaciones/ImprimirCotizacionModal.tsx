'use client';

import React from 'react';
import { X, Printer, ShoppingCart, Copy, FileCheck2 } from 'lucide-react';

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
        (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden print:shadow-none print:border-none print:max-w-none print:max-h-none">
                {/* Barra superior de acciones (oculta en impresión) */}
                <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
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
                                Lista para imprimir o guardar como PDF (Formato A4 Comercial)
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {onEnviarAPdv &&
                            cotizacion.estado !== 'CONVERTIDA' &&
                            cotizacion.estado !== 'ANULADA' && (
                                <button
                                    onClick={() => onEnviarAPdv(cotizacion)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors"
                                    title="Cargar esta cotización en el Punto de Venta para facturarla"
                                >
                                    <ShoppingCart className="w-4 h-4" />
                                    Facturar en PDV
                                </button>
                            )}
                        {onDuplicar && (
                            <button
                                onClick={() => onDuplicar(cotizacion)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                Duplicar
                            </button>
                        )}
                        <button
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                        >
                            <Printer className="w-4 h-4" />
                            Imprimir / Descargar PDF
                        </button>
                        {onNuevaCotizacion && (
                            <button
                                onClick={onNuevaCotizacion}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                            >
                                + Nueva Cotización
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Hoja A4 Imprimible */}
                <div className="p-8 overflow-y-auto flex-1 print:p-6 print:overflow-visible text-slate-900">
                    {/* Encabezado Comercial */}
                    <div className="border-2 border-slate-900 rounded-xl overflow-hidden mb-6">
                        <div className="grid grid-cols-12 divide-x-2 divide-slate-900">
                            {/* Emisor */}
                            <div className="col-span-5 p-4 flex flex-col justify-between">
                                <div>
                                    <div className="text-xl font-black tracking-tight text-slate-900 uppercase">
                                        HDB Servicios Eléctricos
                                    </div>
                                    <div className="text-xs font-semibold text-slate-600 mt-0.5">
                                        Materiales Eléctricos • Tableros • Obras e Ingeniería
                                    </div>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-3 space-y-0.5">
                                    <div>Presupuesto Comercial sujeto a disponibilidad</div>
                                    {(cotizacion.vendedorNombre || cotizacion.operadorNombre) && (
                                        <div>
                                            Atendido por:{' '}
                                            <strong className="text-slate-700">
                                                {cotizacion.vendedorNombre || cotizacion.operadorNombre}
                                            </strong>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Letra Central P / Presupuesto */}
                            <div className="col-span-2 p-3 flex flex-col items-center justify-center bg-slate-50 text-center">
                                <div className="w-12 h-12 rounded-xl border-2 border-slate-900 flex items-center justify-center text-2xl font-black bg-white">
                                    P
                                </div>
                                <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 mt-1.5 leading-tight">
                                    Documento No Válido Como Factura
                                </div>
                            </div>

                            {/* Numeración y Fechas */}
                            <div className="col-span-5 p-4 flex flex-col justify-between bg-slate-50/40">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-700">
                                        Cotización / Presupuesto
                                    </div>
                                    <div className="text-xl font-black font-mono text-slate-900">
                                        N° {cotizacion.numero}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-200 text-xs">
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                            Fecha Emisión
                                        </span>
                                        <span className="font-bold text-slate-800">
                                            {fmtDate(cotizacion.fecha)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
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

                    {/* Datos del Destinatario y Condiciones */}
                    <div className="grid grid-cols-12 gap-4 mb-6 bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs">
                        <div className="col-span-7 space-y-1">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Destinatario / Cliente
                            </div>
                            <div className="text-sm font-black text-slate-900">
                                {cotizacion.clienteNombre || 'Consumidor Final'}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-600">
                                {(cotizacion.clienteIdentificacion || cotizacion.clienteCuit) && (
                                    <span>
                                        <strong>CUIT/DNI:</strong>{' '}
                                        <span className="font-mono">
                                            {cotizacion.clienteIdentificacion || cotizacion.clienteCuit}
                                        </span>
                                    </span>
                                )}
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
                                <div className="text-slate-600">
                                    <strong>Dirección:</strong> {cotizacion.clienteDireccion}
                                </div>
                            )}
                        </div>

                        <div className="col-span-5 border-l border-slate-200 pl-4 space-y-1">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Condiciones Comerciales
                            </div>
                            <div>
                                <span className="text-slate-500">Condición de Pago:</span>{' '}
                                <strong className="text-slate-900">
                                    {cotizacion.condicionPago || 'Contado / Transferencia'}
                                </strong>
                            </div>
                            <div>
                                <span className="text-slate-500">Plazo de Entrega:</span>{' '}
                                <strong className="text-slate-900">
                                    {cotizacion.plazoEntrega || 'Inmediata s/stock'}
                                </strong>
                            </div>
                            {cotizacion.referenciaObra && (
                                <div>
                                    <span className="text-slate-500">Obra / Referencia:</span>{' '}
                                    <strong className="text-indigo-800">{cotizacion.referenciaObra}</strong>
                                </div>
                            )}
                            <div>
                                <span className="text-slate-500">Lista de Precios:</span>{' '}
                                <strong className="text-slate-800">
                                    {cotizacion.listaPrecioNombre || 'General'}
                                </strong>
                            </div>
                        </div>
                    </div>

                    {/* Tabla de Ítems Cotizados */}
                    <div className="border border-slate-300 rounded-xl overflow-hidden mb-6">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-900 text-white">
                                <tr className="text-[10px] font-bold uppercase tracking-wider">
                                    <th className="py-2.5 px-3 text-center w-10">#</th>
                                    <th className="py-2.5 px-3 text-left w-28">Código</th>
                                    <th className="py-2.5 px-3 text-left">Descripción del Material / Servicio</th>
                                    <th className="py-2.5 px-3 text-right w-20">Cant.</th>
                                    <th className="py-2.5 px-3 text-right w-28">P. Unitario</th>
                                    {tieneDescuentosLinea && (
                                        <th className="py-2.5 px-3 text-right w-20">Bonif.</th>
                                    )}
                                    <th className="py-2.5 px-3 text-right w-32">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {items.map((item: any, idx: number) => {
                                    const descPct = item.descuentoPorcentaje || item.descuentoPct || 0;
                                    return (
                                        <tr key={item.id || idx} className="hover:bg-slate-50/50">
                                            <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                                                {idx + 1}
                                            </td>
                                            <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                                                {item.sku || item.codigo || '—'}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <div className="font-bold text-slate-900">
                                                    {item.descripcion || item.nombre}
                                                </div>
                                                {(item.motivoModificacion || item.observacion) && (
                                                    <div className="text-[11px] text-slate-500 italic mt-0.5">
                                                        Nota: {item.motivoModificacion || item.observacion}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                                {item.cantidad}{' '}
                                                <span className="text-[10px] font-normal text-slate-500">
                                                    {item.unidad || 'u'}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                                                ${fmt(item.precioUnitario)}
                                            </td>
                                            {tieneDescuentosLinea && (
                                                <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                                                    {descPct > 0 ? `-${descPct}%` : '—'}
                                                </td>
                                            )}
                                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                                ${fmt(item.subtotal)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pie de Cotización: Observaciones + Totales */}
                    <div className="grid grid-cols-12 gap-6 items-start">
                        <div className="col-span-7 space-y-3">
                            {cotizacion.observaciones ? (
                                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                        Observaciones y Alcance de la Oferta
                                    </div>
                                    <p className="text-slate-700 whitespace-pre-line leading-relaxed">
                                        {cotizacion.observaciones}
                                    </p>
                                </div>
                            ) : (
                                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                                    Los precios expresados en la presente cotización tienen una validez de{' '}
                                    <strong>{cotizacion.validezDias || 15} días corridos</strong> desde su fecha de emisión, sujetos a disponibilidad de stock al momento de la confirmación de la orden de compra.
                                </div>
                            )}

                            <div className="pt-8 grid grid-cols-2 gap-6 text-center text-[11px] text-slate-400">
                                <div className="border-t border-slate-300 pt-1.5">
                                    Firma y Sello Emisor
                                </div>
                                <div className="border-t border-slate-300 pt-1.5">
                                    Conformidad del Cliente
                                </div>
                            </div>
                        </div>

                        <div className="col-span-5 bg-slate-50 rounded-xl border-2 border-slate-900 p-4 space-y-2 text-xs">
                            <div className="flex justify-between text-slate-600">
                                <span>Subtotal ({items.length} ítems):</span>
                                <span className="font-mono font-semibold">${fmt(cotizacion.subtotal)}</span>
                            </div>

                            {(cotizacion.descuentoMonto || 0) > 0 && (
                                <div className="flex justify-between text-emerald-700">
                                    <span>
                                        Descuento Global ({cotizacion.descuentoPorcentaje || 0}%):
                                    </span>
                                    <span className="font-mono font-semibold">
                                        -${fmt(cotizacion.descuentoMonto)}
                                    </span>
                                </div>
                            )}

                            {cotizacion.ivaDiscriminado && (
                                <>
                                    <div className="flex justify-between text-slate-700 pt-1 border-t border-slate-200">
                                        <span>Subtotal Neto Gravado:</span>
                                        <span className="font-mono font-semibold">
                                            ${fmt((cotizacion.subtotal || 0) - (cotizacion.descuentoMonto || 0))}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-slate-700">
                                        <span>IVA Discriminado:</span>
                                        <span className="font-mono font-semibold">
                                            ${fmt(cotizacion.impuestosMonto || 0)}
                                        </span>
                                    </div>
                                </>
                            )}

                            <div className="pt-2.5 border-t-2 border-slate-900 flex items-baseline justify-between">
                                <span className="text-sm font-black uppercase tracking-wider text-slate-900">
                                    Total Cotizado
                                </span>
                                <span className="text-2xl font-black font-mono text-slate-900">
                                    ${fmt(cotizacion.total)}
                                </span>
                            </div>
                            <div className="text-[10px] text-right text-slate-500">
                                {cotizacion.ivaDiscriminado
                                    ? 'Precios con IVA discriminado incluido en el Total'
                                    : 'Precios finales (IVA incluido)'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
