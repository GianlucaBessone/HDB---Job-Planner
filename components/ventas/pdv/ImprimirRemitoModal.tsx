'use client';

import React, { useRef } from 'react';
import { X, Printer, PackageCheck } from 'lucide-react';

interface RemitoItem {
  id: string;
  sku: string;
  descripcion: string;
  unidad?: string | null;
  cantidad: number;
}

interface RemitoData {
  id: string;
  numero: string;
  fecha: string | Date;
  clienteNombre?: string | null;
  clienteIdentificacion?: string | null;
  clienteDireccion?: string | null;
  clienteTelefono?: string | null;
  vendedorNombre?: string | null;
  receptorNombre?: string | null;
  receptorDni?: string | null;
  observaciones?: string | null;
  estado?: string | null;
  items?: RemitoItem[];
  venta?: {
    id?: string;
    numero?: string;
    fecha?: string | Date;
    estado?: string;
    items?: Array<{
      id: string;
      sku: string;
      descripcion: string;
      unidad?: string | null;
      cantidad: number;
      cantidadEntregada?: number;
      cantidadCancelada?: number;
    }>;
  } | null;
}

interface ImprimirRemitoModalProps {
  isOpen: boolean;
  onClose: () => void;
  remito: RemitoData | null;
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

export default function ImprimirRemitoModal({
  isOpen,
  onClose,
  remito,
}: ImprimirRemitoModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  // Atajos de teclado: ESC para cerrar, Ctrl+P o Enter para imprimir
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !remito) return null;

  const handlePrint = () => {
    window.print();
  };

  const fechaFormateada = safeFormatDateTime(remito.fecha);
  const items = remito.items || [];
  const isVentaAnulada = remito.venta?.estado === 'ANULADA' || remito.estado === 'ANULADO';

  // Calcular items pendientes si vienen en la venta asociada (sin romper si no están; omitir si la venta está anulada)
  const itemsPendientes = isVentaAnulada
    ? []
    : (remito.venta?.items || [])
        .map((it) => {
          const cant = Number(it.cantidad) || 0;
          const entregada = Number(it.cantidadEntregada) || 0;
          const cancelada = Number(it.cantidadCancelada) || 0;
          const pendiente = Math.max(0, cant - entregada - cancelada);
          return {
            ...it,
            cantidadPendiente: Math.round(pendiente * 1000) / 1000,
          };
        })
        .filter((it) => it.cantidadPendiente > 0);

  const clienteNombre = remito.clienteNombre || 'Consumidor Final';
  const vendedor = remito.vendedorNombre || 'Personal de Ventas';
  const receptor = remito.receptorNombre || clienteNombre;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      {/* Estilos para impresión física de remito comercial sobrio */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page {
            size: auto;
            margin: 10mm;
          }
          body * {
            visibility: hidden !important;
          }
          #remito-print-area, #remito-print-area * {
            visibility: visible !important;
          }
          #remito-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
            font-size: 10pt !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `,
        }}
      />

      <div className="bg-card w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[94vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecera del modal (no imprimible) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 print:hidden">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Remito de Entrega {remito.numero}</span>
                {isVentaAnulada && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-300">
                    Venta Anulada
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                Comprobante físico de traslado y salida de materiales (sin precios)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              Imprimir Remito (Ctrl+P)
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Área imprimible del Remito: diseño sobrio, comercial y profesional */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-slate-100/50 dark:bg-slate-950/40">
          <div
            id="remito-print-area"
            ref={printRef}
            className="bg-white text-slate-900 p-6 md:p-8 max-w-2xl mx-auto space-y-5 text-xs font-sans border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0"
          >
            {/* Header Sobrio del Remito */}
            <div className="border-b-2 border-slate-900 pb-3">
              <div className="flex items-start justify-between gap-4">
                {/* Membrete Emisor */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                    HDB - Materiales Eléctricos
                  </h1>
                  <p className="text-[11px] text-slate-600 font-medium">
                    Distribución y Suministro de Materiales Eléctricos Industriales
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                    Documento no válido como factura comercial
                  </p>
                </div>

                {/* Letra 'R' formato oficial de remito */}
                <div className="flex flex-col items-center justify-center border-2 border-slate-900 px-3 py-1 text-center shrink-0">
                  <span className="text-2xl font-black leading-none text-slate-900">R</span>
                  <span className="text-[8px] font-bold tracking-tight text-slate-600 uppercase mt-0.5">
                    CÓD. 091
                  </span>
                </div>

                {/* Numeración y Fecha */}
                <div className="text-right shrink-0">
                  <div className="text-xs font-black tracking-wider text-slate-900 uppercase">
                    REMITO DE ENTREGA
                  </div>
                  <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                    {remito.numero}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1 font-medium">
                    Fecha: {fechaFormateada}
                  </div>
                  {remito.venta?.numero && (
                    <div className="text-[11px] text-slate-600 mt-0.5 font-medium">
                      Venta Asoc.: <span className="font-mono font-bold text-slate-900">{remito.venta.numero}</span>
                    </div>
                  )}
                  {isVentaAnulada && (
                    <div className="inline-block mt-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-slate-200 text-slate-800 border border-slate-400">
                      COMPROBANTE DE VENTA ANULADA
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Datos de Entrega, Cliente y Despacho en estructura tabular limpia */}
            <div className="border border-slate-300 divide-y divide-slate-200 text-[11px]">
              <div className="grid grid-cols-2 divide-x divide-slate-200 p-2.5">
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider block">
                    Destinatario / Cliente
                  </span>
                  <div className="font-black text-slate-900 text-xs mt-0.5">
                    {clienteNombre}
                  </div>
                  {remito.clienteIdentificacion && (
                    <div className="text-slate-700 mt-0.5">
                      <span className="font-semibold">CUIT/DNI:</span> {remito.clienteIdentificacion}
                    </div>
                  )}
                </div>
                <div className="pl-3">
                  <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider block">
                    Lugar / Datos de Entrega
                  </span>
                  <div className="text-slate-700 mt-0.5">
                    <span className="font-semibold">Dirección:</span> {remito.clienteDireccion || 'Retiro en almacén / Mostrador'}
                  </div>
                  {remito.clienteTelefono && (
                    <div className="text-slate-700 mt-0.5">
                      <span className="font-semibold">Teléfono:</span> {remito.clienteTelefono}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-slate-200 p-2.5 bg-slate-50/50">
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider block">
                    Despacho
                  </span>
                  <div className="text-slate-800 mt-0.5">
                    <span className="font-semibold">Despachado por (Vendedor):</span>{' '}
                    <span className="font-bold">{vendedor}</span>
                  </div>
                </div>
                <div className="pl-3">
                  <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider block">
                    Receptor de la Mercadería
                  </span>
                  <div className="text-slate-800 mt-0.5">
                    <span className="font-semibold">Retirado por:</span>{' '}
                    <span className="font-bold">{receptor}</span>
                  </div>
                  {remito.receptorDni && (
                    <div className="text-slate-700 text-[10px]">
                      <span className="font-semibold">DNI:</span> {remito.receptorDni}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabla de Materiales Entregados (ESTRICTAMENTE SIN PRECIOS) */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-black uppercase text-slate-900 tracking-wider">
                Detalle de Materiales Entregados en este Acto
              </div>
              <table className="w-full text-left text-[11px] border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-bold uppercase tracking-wider text-[10px] border-b border-slate-300">
                    <th className="py-2 px-2.5 w-10 text-center border-r border-slate-300">#</th>
                    <th className="py-2 px-2.5 w-28 border-r border-slate-300">Código / SKU</th>
                    <th className="py-2 px-2.5 border-r border-slate-300">Descripción del Material</th>
                    <th className="py-2 px-2.5 text-right w-24 border-r border-slate-300">Cantidad</th>
                    <th className="py-2 px-2.5 w-16 text-center">Unidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 px-2.5 text-center text-slate-500 italic">
                        No hay ítems registrados en este remito
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td className="py-1.5 px-2.5 text-center text-slate-500 font-mono border-r border-slate-200">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono font-bold text-slate-800 border-r border-slate-200">
                          {it.sku}
                        </td>
                        <td className="py-1.5 px-2.5 font-medium text-slate-900 border-r border-slate-200">
                          {it.descripcion}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-black text-slate-900 border-r border-slate-200">
                          {it.cantidad}
                        </td>
                        <td className="py-1.5 px-2.5 text-center text-slate-600">
                          {it.unidad || 'u.'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="text-[10px] text-slate-500 text-right pr-1">
                Total artículos entregados: <span className="font-bold text-slate-800">{items.length}</span>
              </div>
            </div>

            {/* Sección de Saldo Pendiente de Retiro (Sober y tabular) */}
            {itemsPendientes.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-black uppercase text-slate-700 tracking-wider">
                  Materiales Pendientes de Retiro (Saldo en Depósito)
                </div>
                <table className="w-full text-left text-[11px] border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-300">
                      <th className="py-1.5 px-2.5 w-28 border-r border-slate-300">SKU</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-300">Descripción</th>
                      <th className="py-1.5 px-2.5 text-right w-24 border-r border-slate-300">Cant. Pendiente</th>
                      <th className="py-1.5 px-2.5 w-16 text-center">Unidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {itemsPendientes.map((p, idx) => (
                      <tr key={p.id || idx}>
                        <td className="py-1.5 px-2.5 font-mono text-slate-700 border-r border-slate-200">
                          {p.sku}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-800 border-r border-slate-200">{p.descripcion}</td>
                        <td className="py-1.5 px-2.5 text-right font-bold text-slate-800 border-r border-slate-200">
                          {p.cantidadPendiente}
                        </td>
                        <td className="py-1.5 px-2.5 text-center text-slate-600">
                          {p.unidad || 'u.'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Observaciones del remito */}
            {remito.observaciones && (
              <div className="text-[11px] text-slate-700 border border-slate-300 p-2.5 bg-slate-50/40">
                <span className="font-bold">Observaciones:</span> {remito.observaciones}
              </div>
            )}

            {/* Cuadro de Conformidad y Firma ÚNICA para el Receptor (Sin firma del vendedor) */}
            <div className="border border-slate-300 p-4 mt-6">
              <div className="text-[10px] text-slate-600 text-center leading-relaxed">
                El receptor declara haber recibido en este acto, a su entera conformidad y en perfecto estado, los materiales detallados en este remito.
              </div>

              <div className="flex justify-end pt-12 pr-4 sm:pr-8">
                <div className="w-72 text-center space-y-1">
                  <div className="border-t border-slate-800 pt-1 font-bold text-slate-900 text-xs uppercase tracking-wide">
                    Recibí Conforme (Firma)
                  </div>
                  <div className="text-[11px] text-slate-800 font-semibold">
                    Aclaración: {receptor}
                  </div>
                  <div className="text-[10px] text-slate-600">
                    DNI: {remito.receptorDni || '__________________'}
                  </div>
                  <div className="text-[10px] text-slate-600">
                    Fecha: ______ / ______ / 202___
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer no imprimible */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 print:hidden">
          <div className="text-xs text-slate-400 font-medium">
            Remito emitido para control de salida física de materiales • HDB - Materiales Eléctricos
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
