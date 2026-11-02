'use client';

import React from 'react';
import { X, Printer, FileText } from 'lucide-react';
import { Button } from '@/components/ui';
import { useModalScroll } from '@/lib/useModalScroll';

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

// Bordes y celdas del documento: legibles en pantalla (claro/oscuro) y en papel
const CELL = 'py-1.5 px-2 border-r border-slate-200 dark:border-slate-700';
const HEAD_CELL = 'py-1.5 px-2 border-r border-slate-300 dark:border-slate-600 font-semibold';
const TABLE = 'w-full text-left text-[11px] border-collapse border border-slate-300 dark:border-slate-600';
const THEAD_ROW = 'bg-slate-100 dark:bg-slate-700/60 border-b border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 uppercase';

export default function ImprimirEstadoCuentaModal({
  isOpen,
  onClose,
  detalleCliente,
}: ImprimirEstadoCuentaModalProps) {
  const visible = isOpen && !!detalleCliente;
  useModalScroll(visible);

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

  if (!visible) return null;

  const { cliente, resumen, comprobantesPendientes = [], libroMayorCronologico = [] } =
    detalleCliente;

  const movimientosActivos = libroMayorCronologico.filter(
    (m: any) => m.estado !== 'ANULADA' && m.estado !== 'ANULADO'
  );

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-6"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
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
          .dark #estado-cuenta-print-area, .dark #estado-cuenta-print-area * {
            color: black !important;
            background-color: transparent !important;
            border-color: #94a3b8 !important;
          }
        }
      `,
        }}
      />
      <div className="scrim -z-10 animate-in fade-in duration-150 print:hidden" aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="estado-cuenta-titulo"
        className="relative w-full sm:max-w-4xl flex flex-col max-h-[92dvh] bg-popover text-popover-foreground border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 sm:zoom-in-95 duration-200"
      >
        {/* Header no imprimible */}
        <header className="flex items-start gap-3 px-5 pt-5 pb-3 border-b border-border print:hidden">
          <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200 flex items-center justify-center shrink-0">
            <FileText className="w-[18px] h-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="estado-cuenta-titulo" className="text-heading text-slate-900 dark:text-slate-50 truncate">
              Estado de cuenta — {cliente.nombre}
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-600 dark:text-slate-300">
              Resumen de saldos y movimientos, listo para imprimir o guardar en PDF.
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm -mr-2 -mt-1" aria-label="Cerrar">
            <X />
          </button>
        </header>

        {/* Contenido imprimible */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-surface-sunken">
          <div
            id="estado-cuenta-print-area"
            className="bg-card text-slate-800 dark:text-slate-100 p-6 sm:p-8 rounded-xl border border-border max-w-3xl mx-auto space-y-6 text-xs print:border-none print:shadow-none print:p-0"
          >
            {/* Cabecera del Estado de Cuenta */}
            <div className="flex items-start justify-between gap-4 border-b-2 border-slate-800 dark:border-slate-400 pb-4">
              <div>
                <h1 className="text-xl font-semibold uppercase tracking-tight text-slate-900 dark:text-slate-50">
                  HDB - Materiales Eléctricos
                </h1>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                  Resumen de Cuenta Corriente Comercial
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-50">
                  ESTADO DE CUENTA
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                  Fecha de emisión: <strong>{formatDate(new Date())}</strong>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300">
                  Plazo acordado: <strong>{cliente.config?.plazoDias || 30} días</strong>
                </div>
              </div>
            </div>

            {/* Datos del Cliente y Resumen de Saldos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-slate-300 dark:border-slate-600 p-3 rounded-lg space-y-1 text-[11px]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                  Datos del Cliente
                </span>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{cliente.nombre}</div>
                {cliente.direccion && <div>Dirección: {cliente.direccion}</div>}
                {cliente.telefono && <div>Teléfono: {cliente.telefono}</div>}
                {cliente.email && <div>Email: {cliente.email}</div>}
                {cliente.config?.limiteCredito > 0 && (
                  <div>
                    Límite de Crédito: <strong>{formatARS(cliente.config.limiteCredito)}</strong>
                  </div>
                )}
              </div>

              <div className="border border-slate-300 dark:border-slate-600 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/40 space-y-1.5 text-[11px]">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-300">Total Compras / Cargos (Debe):</span>
                  <span className="font-semibold tabular-nums">{formatARS(resumen.totalDebe)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-300">Total Pagos / Acreditaciones (Haber):</span>
                  <span className="font-semibold tabular-nums text-success-700 dark:text-success-300">
                    -{formatARS(resumen.totalHaber)}
                  </span>
                </div>
                {resumen.deudaVencida > 0 && (
                  <div className="flex justify-between gap-2 text-danger-700 dark:text-danger-300 font-semibold">
                    <span>Deuda Vencida Exigible:</span>
                    <span className="tabular-nums">{formatARS(resumen.deudaVencida)}</span>
                  </div>
                )}
                <div className="flex justify-between gap-2 text-sm font-semibold text-slate-900 dark:text-slate-50 pt-1.5 border-t border-slate-300 dark:border-slate-600">
                  <span>SALDO ACTUAL A PAGAR:</span>
                  <span className="tabular-nums">{formatARS(resumen.saldoActual)}</span>
                </div>
              </div>
            </div>

            {/* Comprobantes Pendientes de Cancelación */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-50">
                1. Comprobantes Pendientes de Cancelación ({comprobantesPendientes.length})
              </h3>
              {comprobantesPendientes.length === 0 ? (
                <div className="p-3 border border-slate-200 dark:border-slate-700 text-center text-slate-600 dark:text-slate-300 italic">
                  El cliente no registra comprobantes pendientes de pago a la fecha.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className={TABLE}>
                    <thead>
                      <tr className={THEAD_ROW}>
                        <th className={HEAD_CELL}>Comprobante</th>
                        <th className={HEAD_CELL}>Emisión</th>
                        <th className={HEAD_CELL}>Vencimiento</th>
                        <th className={HEAD_CELL}>Detalle</th>
                        <th className={`${HEAD_CELL} text-right`}>Importe CC</th>
                        <th className={`${HEAD_CELL} text-right`}>Abonado</th>
                        <th className="py-1.5 px-2 text-right font-semibold">Saldo Pendiente</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {comprobantesPendientes.map((cp: any) => (
                        <tr key={`${cp.destinoTipo}-${cp.id}`}>
                          <td className={`${CELL} font-mono font-semibold whitespace-nowrap`}>{cp.numero}</td>
                          <td className={`${CELL} whitespace-nowrap`}>{formatDate(cp.fecha)}</td>
                          <td className={`${CELL} whitespace-nowrap`}>
                            {formatDate(cp.fechaVencimiento)}
                            {cp.vencido && (
                              <span className="ml-1 text-[11px] font-semibold text-danger-700 dark:text-danger-300">
                                (Venc. {cp.diasVencido}d)
                              </span>
                            )}
                          </td>
                          <td className={CELL}>{cp.concepto}</td>
                          <td className={`${CELL} text-right tabular-nums whitespace-nowrap`}>
                            {formatARS(cp.montoOriginalCC)}
                          </td>
                          <td className={`${CELL} text-right tabular-nums whitespace-nowrap`}>
                            {formatARS(cp.montoPagadoCC)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-semibold tabular-nums whitespace-nowrap">
                            {formatARS(cp.saldoPendiente)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Historial del Libro Mayor */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-50">
                2. Historial de Movimientos en Cuenta Corriente ({movimientosActivos.length})
              </h3>
              {movimientosActivos.length === 0 ? (
                <div className="p-3 border border-slate-200 dark:border-slate-700 text-center text-slate-600 dark:text-slate-300 italic">
                  Sin movimientos registrados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className={TABLE}>
                    <thead>
                      <tr className={THEAD_ROW}>
                        <th className={HEAD_CELL}>Fecha</th>
                        <th className={HEAD_CELL}>Comprobante</th>
                        <th className={HEAD_CELL}>Concepto</th>
                        <th className={`${HEAD_CELL} text-right`}>Debe (+)</th>
                        <th className={`${HEAD_CELL} text-right`}>Haber (-)</th>
                        <th className="py-1.5 px-2 text-right font-semibold">Saldo Acum.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {movimientosActivos.map((m: any) => (
                        <tr key={m.id}>
                          <td className={`${CELL} whitespace-nowrap`}>{formatDate(m.fecha)}</td>
                          <td className={`${CELL} font-mono font-semibold whitespace-nowrap`}>{m.numero}</td>
                          <td className={CELL}>{m.concepto}</td>
                          <td className={`${CELL} text-right tabular-nums whitespace-nowrap`}>
                            {m.debe > 0 ? formatARS(m.debe) : '—'}
                          </td>
                          <td className={`${CELL} text-right tabular-nums whitespace-nowrap text-success-700 dark:text-success-300 font-semibold`}>
                            {m.haber > 0 ? formatARS(m.haber) : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-right font-semibold tabular-nums whitespace-nowrap">
                            {formatARS(m.saldoAcumulado)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-300 dark:border-slate-600 text-center text-[11px] text-slate-600 dark:text-slate-300">
              Documento emitido por el Sistema Integrado de Gestión (SGI) — HDB Materiales Eléctricos
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 px-5 py-4 border-t border-border safe-area-bottom print:hidden">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={() => window.print()} icon={<Printer />}>
            Imprimir o guardar PDF
          </Button>
        </footer>
      </div>
    </div>
  );
}
