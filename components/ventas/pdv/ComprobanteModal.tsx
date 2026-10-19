'use client';

import React, { useRef } from 'react';
import { X, Printer, CheckCircle2, AlertTriangle, FileText, PackageCheck } from 'lucide-react';

interface ComprobanteModalProps {
  isOpen: boolean;
  onClose: () => void;
  venta: any;
  onGenerarRemito?: (venta: any) => void;
}

function safeFormatDateTime(val: any): string {
  try {
    const d = new Date(val || Date.now());
    if (isNaN(d.getTime())) return new Date().toLocaleString('es-AR');
    return d.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date().toLocaleString('es-AR');
  }
}

export default function ComprobanteModal({
  isOpen,
  onClose,
  venta,
  onGenerarRemito,
}: ComprobanteModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  // Atajos de teclado: Escape para cerrar, Enter / Ctrl+P para imprimir
  React.useEffect(() => {
    if (!isOpen || !venta) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, venta, onClose]);

  if (!isOpen || !venta) return null;

  const formatARS = (val: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(Number(val) || 0);

  const fechaFormateada = safeFormatDateTime(venta.fecha || venta.createdAt);

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      {/* Estilos para impresión física limpia de ticket/comprobante */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #comprobante-print-area, #comprobante-print-area * {
            visibility: visible !important;
          }
          #comprobante-print-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
          }
        }
      ` }} />
      <div className="bg-card w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header no imprimible */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
              Comprobante de Venta {venta.numero}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {onGenerarRemito && (
              <button
                type="button"
                onClick={() => {
                  onGenerarRemito(venta);
                  onClose();
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-colors ${
                  venta.imputadoCuentaCorriente > 0
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                <PackageCheck className="w-3.5 h-3.5" />
                <span>Generar Remito de Entrega</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido imprimible */}
        <div className="p-8 overflow-y-auto print:p-0 print:m-0 print:overflow-visible" id="comprobante-print-area">
          <div
            ref={printRef}
            className="border border-slate-200 dark:border-slate-700 rounded-xl p-6 print:border-none print:p-0 text-slate-800 dark:text-slate-200 text-xs font-mono space-y-4"
          >
            {/* Membrete comercial */}
            <div className="text-center pb-3 border-b border-dashed border-slate-300 dark:border-slate-700">
              <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                HDB - Materiales Eléctricos
              </h2>
              <p className="text-[11px] text-slate-500">SISTEMA INTEGRADO DE GESTIÓN (SGI)</p>
              <div className="mt-2 inline-block px-2.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 text-[10px] font-bold uppercase tracking-wider">
                COMPROBANTE INTERNO DE VENTA — NO VÁLIDO COMO FACTURA
              </div>
            </div>

            {/* Datos de cabecera */}
            <div className="grid grid-cols-2 gap-2 text-[11px] pb-3 border-b border-dashed border-slate-300 dark:border-slate-700">
              <div>
                <span className="text-slate-500">OPERACIÓN: </span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{venta.numero}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500">FECHA: </span>
                <span className="font-bold">{fechaFormateada}</span>
              </div>
              <div>
                <span className="text-slate-500">CLIENTE: </span>
                <span className="font-bold">{venta.clienteNombre || 'Consumidor Final'}</span>
                {venta.clienteIdentificacion && (
                  <span className="text-slate-500 block text-[10px]">
                    CUIT/DNI: {venta.clienteIdentificacion}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-slate-500">VENDEDOR: </span>
                <span className="font-bold">{venta.vendedorNombre || 'Ventas HDB'}</span>
              </div>
              <div>
                <span className="text-slate-500">LISTA: </span>
                <span className="font-medium">{venta.listaPrecioNombre || 'General'}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500">ESTADO: </span>
                <span
                  className={`font-bold ${
                    venta.estado === 'ANULADA' ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {venta.estado}
                </span>
              </div>
            </div>

            {/* Detalle de ítems */}
            <div>
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-slate-300 dark:border-slate-700 text-slate-500">
                    <th className="py-1">CANT</th>
                    <th className="py-1">DESCRIPCIÓN</th>
                    <th className="py-1 text-right">P.UNIT</th>
                    <th className="py-1 text-right">SUBTOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {venta.items?.map((it: any, idx: number) => (
                    <tr key={it.id || idx}>
                      <td className="py-1.5 align-top font-bold text-slate-900 dark:text-slate-100">
                        {it.cantidad} {it.unidad || 'U'}
                      </td>
                      <td className="py-1.5 align-top">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {it.descripcion}
                        </div>
                        <div className="text-[10px] text-slate-400">SKU: {it.sku}</div>
                      </td>
                      <td className="py-1.5 align-top text-right whitespace-nowrap">
                        {formatARS(it.precioUnitario)}
                        {it.descuentoPorcentaje > 0 && (
                          <div className="text-[9px] text-emerald-600">-{it.descuentoPorcentaje}%</div>
                        )}
                      </td>
                      <td className="py-1.5 align-top text-right font-bold whitespace-nowrap">
                        {formatARS(it.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales y desglose */}
            <div className="pt-3 border-t border-dashed border-slate-300 dark:border-slate-700 space-y-1 text-[11px]">
              <div className="flex justify-between text-slate-500">
                <span>SUBTOTAL:</span>
                <span>{formatARS(venta.subtotal)}</span>
              </div>
              {venta.descuentoMonto > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>DESCUENTO ({venta.descuentoPorcentaje}%):</span>
                  <span>-{formatARS(venta.descuentoMonto)}</span>
                </div>
              )}
              {Boolean(
                (Number(venta.impuestosMonto) || 0) > 0 &&
                  (venta.listaPrecio?.ivaDiscriminado ||
                    Math.abs(
                      ((Number(venta.subtotal) || 0) - (Number(venta.descuentoMonto) || 0) + (Number(venta.recargoMonto) || 0) + (Number(venta.impuestosMonto) || 0)) -
                        (Number(venta.total) || 0)
                    ) < 0.05)
              ) && (
                <div className="flex justify-between text-slate-500 font-semibold">
                  <span>IVA:</span>
                  <span>+{formatARS(venta.impuestosMonto)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-slate-900 dark:text-slate-100 pt-2 border-t border-slate-300 dark:border-slate-700">
                <span>TOTAL OPERACIÓN:</span>
                <span>{formatARS(venta.total)}</span>
              </div>
            </div>

            {/* Detalle de pagos */}
            <div className="pt-3 border-t border-dashed border-slate-300 dark:border-slate-700 text-[11px] space-y-1">
              <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                FORMA DE PAGO:
              </span>
              {venta.pagos?.map((p: any, idx: number) => (
                <div key={p.id || idx} className="flex justify-between">
                  <span className="capitalize">
                    • {String(p?.metodo || 'PAGO').replace(/_/g, ' ')}
                    {p.referencia ? ` (Ref: ${p.referencia})` : ''}
                  </span>
                  <span className="font-bold">{formatARS(p?.monto || 0)}</span>
                </div>
              ))}

              {/* Vuelto en efectivo si existió */}
              {Array.isArray(venta.pagos) && venta.pagos.some((p: any) => p.vuelto && p.vuelto > 0) && (
                <div className="flex justify-between text-slate-500 text-[10px] pt-1">
                  <span>CAMBIO / VUELTO ENTREGADO:</span>
                  <span>
                    {formatARS(
                      venta.pagos.reduce((acc: number, p: any) => acc + (Number(p.vuelto) || 0), 0)
                    )}
                  </span>
                </div>
              )}

              {/* Imputación a Cuenta Corriente */}
              {Number(venta.imputadoCuentaCorriente) > 0 && (
                <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-300 mt-2 text-[10px]">
                  <div className="flex justify-between font-bold">
                    <span>IMPUTADO A CUENTA CORRIENTE:</span>
                    <span>{formatARS(venta.imputadoCuentaCorriente)}</span>
                  </div>
                  <div className="text-[9px] text-amber-700 dark:text-amber-400 mt-0.5">
                    Cliente: {venta.clienteNombre} — Saldo pendiente a conciliar en módulo de CC.
                  </div>
                </div>
              )}
            </div>

            {/* Pie de comprobante */}
            <div className="text-center pt-4 border-t border-dashed border-slate-300 dark:border-slate-700 text-[10px] text-slate-400">
              <p>¡Gracias por su compra!</p>
              <p>HDB - Materiales Eléctricos — Trazabilidad interna ID: {venta.id}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 print:hidden">
          <div>
            {onGenerarRemito && (
              <button
                type="button"
                onClick={() => {
                  onGenerarRemito(venta);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-xs border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
              >
                <PackageCheck className="w-3.5 h-3.5" />
                <span>Emitir Remito de Retiro</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 font-bold text-xs transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
