'use client';

import React, { useRef } from 'react';
import { X, Printer, PackageCheck, AlertCircle, FileText } from 'lucide-react';

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
  clienteNombre: string;
  clienteIdentificacion?: string | null;
  clienteDireccion?: string | null;
  clienteTelefono?: string | null;
  vendedorNombre?: string | null;
  receptorNombre?: string | null;
  receptorDni?: string | null;
  observaciones?: string | null;
  items: RemitoItem[];
  venta?: {
    id: string;
    numero: string;
    fecha: string | Date;
    items?: Array<{
      id: string;
      sku: string;
      descripcion: string;
      unidad?: string | null;
      cantidad: number;
      cantidadEntregada: number;
      cantidadCancelada: number;
    }>;
  } | null;
}

interface ImprimirRemitoModalProps {
  isOpen: boolean;
  onClose: () => void;
  remito: RemitoData | null;
}

export default function ImprimirRemitoModal({
  isOpen,
  onClose,
  remito,
}: ImprimirRemitoModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !remito) return null;

  const handlePrint = () => {
    window.print();
  };

  const fechaFormateada = new Date(remito.fecha || Date.now()).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Calcular items pendientes si vienen en la venta asociada
  const itemsPendientes = (remito.venta?.items || [])
    .map((it) => {
      const pendiente = Math.max(
        0,
        it.cantidad - (it.cantidadEntregada || 0) - (it.cantidadCancelada || 0)
      );
      return {
        ...it,
        cantidadPendiente: Math.round(pendiente * 1000) / 1000,
      };
    })
    .filter((it) => it.cantidadPendiente > 0);

  // Atajos de teclado: ESC para cerrar, Ctrl+P o Enter para imprimir
  React.useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, onClose]);

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      {/* Estilos para impresión física de remito */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #remito-print-area, #remito-print-area * {
            visibility: visible !important;
          }
          #remito-print-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 15mm !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
            font-size: 11pt !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `,
        }}
      />

      <div className="bg-card w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecera del modal (no imprimible) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 print:hidden">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                Remito de Entrega {remito.numero}
              </h3>
              <p className="text-[11px] text-slate-400">
                Comprobante físico de entrega de materiales (sin precios)
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

        {/* Área imprimible del Remito */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-100/50 dark:bg-slate-950/40">
          <div
            id="remito-print-area"
            ref={printRef}
            className="bg-white text-slate-900 p-6 md:p-8 rounded-xl border border-slate-200 shadow-xs max-w-2xl mx-auto space-y-6 text-xs font-sans"
          >
            {/* Header del Remito */}
            <div className="border-b-2 border-slate-900 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                    HDB - Soluciones Electromecánicas
                  </h1>
                  <p className="text-[11px] text-slate-600 font-medium">
                    Servicios Integrales, Mantenimiento y Suministro Técnico
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Documento no válido como factura comercial
                  </p>
                </div>
                <div className="text-right border border-slate-300 rounded-lg p-2.5 bg-slate-50">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    REMITO DE ENTREGA
                  </div>
                  <div className="text-sm font-black font-mono text-slate-900">
                    {remito.numero}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                    Fecha: {fechaFormateada}
                  </div>
                </div>
              </div>
            </div>

            {/* Datos de la Venta, Cliente y Receptor */}
            <div className="grid grid-cols-2 gap-4 border border-slate-200 rounded-lg p-3 bg-slate-50/70 text-[11px]">
              <div className="space-y-1">
                <div className="font-bold uppercase text-[10px] text-slate-400">
                  Datos del Cliente
                </div>
                <div className="font-black text-slate-900 text-xs">
                  {remito.clienteNombre}
                </div>
                {remito.clienteIdentificacion && (
                  <div className="text-slate-600">
                    <span className="font-semibold">CUIT/DNI:</span> {remito.clienteIdentificacion}
                  </div>
                )}
                {remito.clienteDireccion && (
                  <div className="text-slate-600 truncate">
                    <span className="font-semibold">Dirección:</span> {remito.clienteDireccion}
                  </div>
                )}
                {remito.clienteTelefono && (
                  <div className="text-slate-600">
                    <span className="font-semibold">Teléfono:</span> {remito.clienteTelefono}
                  </div>
                )}
              </div>

              <div className="space-y-1 border-l border-slate-200 pl-4">
                <div className="font-bold uppercase text-[10px] text-slate-400">
                  Despacho y Retiro
                </div>
                {remito.venta && (
                  <div className="text-slate-800">
                    <span className="font-semibold">Venta Asociada:</span>{' '}
                    <span className="font-mono font-bold">{remito.venta.numero}</span>
                  </div>
                )}
                <div className="text-slate-800">
                  <span className="font-semibold">Despachado por:</span>{' '}
                  {remito.vendedorNombre || 'Personal de Almacén'}
                </div>
                <div className="text-slate-800">
                  <span className="font-semibold">Retirado por:</span>{' '}
                  <span className="font-bold">{remito.receptorNombre || remito.clienteNombre}</span>
                </div>
                {remito.receptorDni && (
                  <div className="text-slate-800">
                    <span className="font-semibold">DNI Receptor:</span> {remito.receptorDni}
                  </div>
                )}
              </div>
            </div>

            {/* Tabla de Materiales Retirados (ESTRICTAMENTE SIN PRECIOS) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Materiales Retirados en este Acto
                </h4>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {remito.items.length} {remito.items.length === 1 ? 'artículo' : 'artículos'}
                </span>
              </div>
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-300">
                    <tr>
                      <th className="py-2 px-3 w-10 text-center">#</th>
                      <th className="py-2 px-3 w-28">SKU</th>
                      <th className="py-2 px-3">Descripción del Material</th>
                      <th className="py-2 px-3 text-right w-28">Cant. Retirada</th>
                      <th className="py-2 px-3 w-20 text-center">Unidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {remito.items.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td className="py-2 px-3 text-center text-slate-400 font-mono font-semibold">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">
                          {it.sku}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-900">
                          {it.descripcion}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-slate-900 text-xs">
                          {it.cantidad}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-500 font-medium">
                          {it.unidad || 'u.'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sección de Materiales Pendientes de Retiro (si existen) */}
            {itemsPendientes.length > 0 && (
              <div className="border border-amber-300 bg-amber-50/60 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-amber-800 font-black text-xs uppercase tracking-wide">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Materiales Pendientes de Retiro (Saldo en Depósito)</span>
                </div>
                <p className="text-[10px] text-amber-700">
                  Los siguientes artículos correspondientes a la venta no se retiran en este momento y quedan registrados como pendientes de retiro:
                </p>
                <table className="w-full text-left text-[11px] bg-white rounded border border-amber-200">
                  <thead className="bg-amber-100/70 text-amber-900 text-[10px] font-bold uppercase border-b border-amber-200">
                    <tr>
                      <th className="py-1.5 px-2.5">SKU</th>
                      <th className="py-1.5 px-2.5">Descripción</th>
                      <th className="py-1.5 px-2.5 text-right">Cant. Pendiente</th>
                      <th className="py-1.5 px-2.5 text-center">Unidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {itemsPendientes.map((p) => (
                      <tr key={p.id}>
                        <td className="py-1.5 px-2.5 font-mono font-bold text-slate-700">
                          {p.sku}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-800">{p.descripcion}</td>
                        <td className="py-1.5 px-2.5 text-right font-black text-amber-800">
                          {p.cantidadPendiente}
                        </td>
                        <td className="py-1.5 px-2.5 text-center text-slate-500">
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
              <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                <span className="font-bold text-slate-700">Observaciones:</span>{' '}
                {remito.observaciones}
              </div>
            )}

            {/* Cuadro de Conformidad y Firma */}
            <div className="border border-slate-300 rounded-lg p-4 space-y-3 bg-slate-50/50 mt-6">
              <div className="text-center font-bold text-slate-800 text-xs uppercase tracking-wider">
                Recibí Conforme
              </div>
              <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                El receptor declara haber recibido en este acto, a su entera conformidad y en perfecto estado, los materiales detallados en este remito.
              </p>

              <div className="grid grid-cols-2 gap-8 pt-10">
                {/* Firma despachador */}
                <div className="text-center space-y-1">
                  <div className="border-t border-slate-400 mx-6 pt-1 font-semibold text-slate-700 text-[11px]">
                    Firma y Aclaración Despacho
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {remito.vendedorNombre || 'Almacén / Vendedor'}
                  </div>
                </div>

                {/* Firma receptor */}
                <div className="text-center space-y-1">
                  <div className="border-t border-slate-400 mx-6 pt-1 font-semibold text-slate-900 text-[11px]">
                    Firma y Aclaración Quien Retira
                  </div>
                  <div className="text-[10px] text-slate-700 font-bold">
                    {remito.receptorNombre || remito.clienteNombre}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    DNI: {remito.receptorDni || '__________________'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer no imprimible */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 print:hidden">
          <div className="text-xs text-slate-400 font-medium">
            Remito emitido para control de salida física de materiales
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
