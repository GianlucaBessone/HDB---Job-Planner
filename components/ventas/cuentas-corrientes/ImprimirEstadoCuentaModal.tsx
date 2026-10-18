'use client';

import React from 'react';
import { X, Printer, FileText } from 'lucide-react';

interface ImprimirEstadoCuentaModalProps {
  isOpen: boolean;
  onClose: () => void;
  detalleCliente: any | null;
}

const formatARS = (val: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(Number(val) || 0);

const formatDate = (val: any) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export default function ImprimirEstadoCuentaModal({
  isOpen,
  onClose,
  detalleCliente,
}: ImprimirEstadoCuentaModalProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !detalleCliente) return null;

  const { cliente, resumen, comprobantesPendientes = [], libroMayorCronologico = [] } =
    detalleCliente;

  const movimientosActivos = libroMayorCronologico.filter(
    (m: any) => m.estado !== 'ANULADA' && m.estado !== 'ANULADO'
  );

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          body * {
            visibility: hidden !important;
          }
          #estado-cuenta-print-area, #estado-cuenta-print-area * {
            visibility: visible !important;
          }
          #estado-cuenta-print-area {
            position: absolute !important;
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
      `,
        }}
      />

      <div className="bg-card w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header no imprimible */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                Estado de Cuenta Corriente — {cliente.nombre}
              </h3>
              <p className="text-[11px] text-slate-400">
                Resumen formal descargable e imprimible de saldos y movimientos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              Imprimir / Guardar PDF (Ctrl+P)
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
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50 dark:bg-slate-950/50">
          <div
            id="estado-cuenta-print-area"
            className="bg-white text-slate-900 p-6 sm:p-8 rounded-xl border border-slate-300 shadow-xs max-w-3xl mx-auto space-y-6 text-xs print:border-none print:shadow-none print:p-0"
          >
            {/* Cabecera del Estado de Cuenta */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
              <div>
                <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
                  HDB - Materiales Eléctricos
                </h1>
                <p className="text-[11px] text-slate-600 font-medium">
                  Resumen de Cuenta Corriente Comercial
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs font-black uppercase tracking-wider text-slate-900">
                  ESTADO DE CUENTA
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Fecha de emisión: <strong>{formatDate(new Date())}</strong>
                </div>
                <div className="text-[11px] text-slate-600">
                  Plazo acordado: <strong>{cliente.config?.plazoDias || 30} días</strong>
                </div>
              </div>
            </div>

            {/* Datos del Cliente y Resumen de Saldos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-slate-300 p-3 rounded-lg space-y-1 text-[11px]">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                  Datos del Cliente
                </span>
                <div className="text-sm font-black text-slate-900">{cliente.nombre}</div>
                {cliente.direccion && <div>Dirección: {cliente.direccion}</div>}
                {cliente.telefono && <div>Teléfono: {cliente.telefono}</div>}
                {cliente.email && <div>Email: {cliente.email}</div>}
                {cliente.config?.limiteCredito > 0 && (
                  <div>
                    Límite de Crédito: <strong>{formatARS(cliente.config.limiteCredito)}</strong>
                  </div>
                )}
              </div>

              <div className="border border-slate-300 p-3 rounded-lg bg-slate-50 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Compras / Cargos (Debe):</span>
                  <span className="font-bold">{formatARS(resumen.totalDebe)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Pagos / Acreditaciones (Haber):</span>
                  <span className="font-bold text-emerald-700">
                    -{formatARS(resumen.totalHaber)}
                  </span>
                </div>
                {resumen.deudaVencida > 0 && (
                  <div className="flex justify-between text-red-700 font-bold">
                    <span>Deuda Vencida Exigible:</span>
                    <span>{formatARS(resumen.deudaVencida)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-slate-300">
                  <span>SALDO ACTUAL A PAGAR:</span>
                  <span>{formatARS(resumen.saldoActual)}</span>
                </div>
              </div>
            </div>

            {/* Comprobantes Pendientes de Cancelación */}
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                1. Comprobantes Pendientes de Cancelación ({comprobantesPendientes.length})
              </h3>
              {comprobantesPendientes.length === 0 ? (
                <div className="p-3 border border-slate-200 text-center text-slate-500 italic">
                  El cliente no registra comprobantes pendientes de pago a la fecha.
                </div>
              ) : (
                <table className="w-full text-left text-[11px] border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 font-bold text-[10px] uppercase">
                      <th className="py-1.5 px-2 border-r border-slate-300">Comprobante</th>
                      <th className="py-1.5 px-2 border-r border-slate-300">Emisión</th>
                      <th className="py-1.5 px-2 border-r border-slate-300">Vencimiento</th>
                      <th className="py-1.5 px-2 border-r border-slate-300">Detalle</th>
                      <th className="py-1.5 px-2 text-right border-r border-slate-300">
                        Importe CC
                      </th>
                      <th className="py-1.5 px-2 text-right border-r border-slate-300">Abonado</th>
                      <th className="py-1.5 px-2 text-right">Saldo Pendiente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {comprobantesPendientes.map((cp: any) => (
                      <tr key={`${cp.destinoTipo}-${cp.id}`}>
                        <td className="py-1.5 px-2 font-mono font-bold border-r border-slate-200">
                          {cp.numero}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200">
                          {formatDate(cp.fecha)}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200">
                          {formatDate(cp.fechaVencimiento)}
                          {cp.vencido && (
                            <span className="ml-1 text-[9px] font-bold text-red-700">
                              (Venc. {cp.diasVencido}d)
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200">{cp.concepto}</td>
                        <td className="py-1.5 px-2 text-right border-r border-slate-200">
                          {formatARS(cp.montoOriginalCC)}
                        </td>
                        <td className="py-1.5 px-2 text-right border-r border-slate-200">
                          {formatARS(cp.montoPagadoCC)}
                        </td>
                        <td className="py-1.5 px-2 text-right font-black">
                          {formatARS(cp.saldoPendiente)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Historial del Libro Mayor */}
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                2. Historial de Movimientos en Cuenta Corriente ({movimientosActivos.length})
              </h3>
              {movimientosActivos.length === 0 ? (
                <div className="p-3 border border-slate-200 text-center text-slate-500 italic">
                  Sin movimientos registrados.
                </div>
              ) : (
                <table className="w-full text-left text-[11px] border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 font-bold text-[10px] uppercase">
                      <th className="py-1.5 px-2 border-r border-slate-300">Fecha</th>
                      <th className="py-1.5 px-2 border-r border-slate-300">Comprobante</th>
                      <th className="py-1.5 px-2 border-r border-slate-300">Concepto</th>
                      <th className="py-1.5 px-2 text-right border-r border-slate-300">
                        Debe (+)
                      </th>
                      <th className="py-1.5 px-2 text-right border-r border-slate-300">
                        Haber (-)
                      </th>
                      <th className="py-1.5 px-2 text-right">Saldo Acum.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {movimientosActivos.map((m: any) => (
                      <tr key={m.id}>
                        <td className="py-1.5 px-2 border-r border-slate-200 whitespace-nowrap">
                          {formatDate(m.fecha)}
                        </td>
                        <td className="py-1.5 px-2 font-mono font-bold border-r border-slate-200 whitespace-nowrap">
                          {m.numero}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200">{m.concepto}</td>
                        <td className="py-1.5 px-2 text-right border-r border-slate-200">
                          {m.debe > 0 ? formatARS(m.debe) : '—'}
                        </td>
                        <td className="py-1.5 px-2 text-right border-r border-slate-200 text-emerald-700 font-semibold">
                          {m.haber > 0 ? formatARS(m.haber) : '—'}
                        </td>
                        <td className="py-1.5 px-2 text-right font-black">
                          {formatARS(m.saldoAcumulado)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-4 border-t border-slate-300 text-center text-[10px] text-slate-500">
              Documento emitido por el Sistema Integrado de Gestión (SGI) — HDB Materiales Eléctricos
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 print:hidden">
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
