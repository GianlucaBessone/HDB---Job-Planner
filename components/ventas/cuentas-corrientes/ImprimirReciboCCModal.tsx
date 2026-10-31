'use client';

import React from 'react';
import { X, Printer, Receipt, CheckCircle2, Ban } from 'lucide-react';

interface ImprimirReciboCCModalProps {
  isOpen: boolean;
  onClose: () => void;
  movimiento: any | null;
  cliente?: any | null;
}

const formatARS = (val: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(Number(val) || 0);

function formatDateTime(val: any): string {
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

export default function ImprimirReciboCCModal({
  isOpen,
  onClose,
  movimiento,
  cliente,
}: ImprimirReciboCCModalProps) {
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

  if (!isOpen || !movimiento) return null;

  const mediosPago = Array.isArray(movimiento.mediosPago) ? movimiento.mediosPago : [];
  const imputaciones = Array.isArray(movimiento.imputaciones) ? movimiento.imputaciones : [];
  const montoTotal = Number(movimiento.haber) > 0 ? Number(movimiento.haber) : Number(movimiento.debe) || 0;
  const esAnulado = movimiento.estado === 'ANULADO';
  const clienteData = movimiento.cliente || cliente || {};

  const tituloTipo =
    movimiento.tipo === 'RECIBO_PAGO'
      ? 'RECIBO DE COBRANZA EN CUENTA CORRIENTE'
      : movimiento.tipo === 'NOTA_CREDITO'
      ? 'NOTA DE CRÉDITO INTERNA EN CUENTA CORRIENTE'
      : movimiento.tipo === 'SALDO_INICIAL'
      ? 'COMPROBANTE DE SALDO INICIAL EN CUENTA CORRIENTE'
      : 'NOTA DE DÉBITO / CARGO EN CUENTA CORRIENTE';

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-slate-950/50-xs">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #recibo-cc-print-area, #recibo-cc-print-area * {
            visibility: visible !important;
          }
          #recibo-cc-print-area {
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
      `,
        }}
      />

      <div className="bg-card w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header no imprimible */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 print:hidden">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Comprobante {movimiento.numero}
            </h3>
            {esAnulado && (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-red-100 text-red-700 border border-red-300">
                ANULADO
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir Comprobante
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
        <div className="p-6 sm:p-8 overflow-y-auto print:p-0" id="recibo-cc-print-area">
          <div className="border border-slate-300 dark:border-slate-700 rounded-xl p-6 print:border-slate-400 print:rounded-none text-slate-800 dark:text-slate-200 text-xs space-y-5 bg-white dark:bg-slate-950 print:bg-white print:text-black">
            {/* Encabezado */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 dark:border-slate-700 pb-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100 uppercase">
                  HDB - Materiales Eléctricos
                </h2>
                <p className="text-[11px] text-slate-500">
                  ADMINISTRACIÓN DE CUENTAS CORRIENTES — SGI
                </p>
                <div className="mt-1.5 inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[11px] font-bold uppercase tracking-wider border border-slate-300 dark:border-slate-700">
                  {tituloTipo}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                  N° {movimiento.numero}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Fecha: <strong>{formatDateTime(movimiento.fecha)}</strong>
                </div>
                <div className="text-[11px] text-slate-500">
                  Emitido por: <strong>{movimiento.operadorNombre || 'Administración'}</strong>
                </div>
              </div>
            </div>

            {/* Datos del cliente */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-[11px]">
              <div>
                <span className="text-slate-400 uppercase font-bold text-[11px] block">
                  Titular de Cuenta Corriente
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                  {clienteData.nombre || 'Cliente Registrado'}
                </span>
                {clienteData.direccion && (
                  <span className="text-slate-500 block mt-0.5">{clienteData.direccion}</span>
                )}
              </div>
              <div className="text-right">
                {clienteData.telefono && (
                  <div className="text-slate-600 dark:text-slate-400">
                    Tel: <strong>{clienteData.telefono}</strong>
                  </div>
                )}
                {clienteData.email && (
                  <div className="text-slate-600 dark:text-slate-400">
                    Email: <strong>{clienteData.email}</strong>
                  </div>
                )}
                <div className="mt-1">
                  Estado:{' '}
                  <strong className={esAnulado ? 'text-red-600' : 'text-emerald-600'}>
                    {movimiento.estado}
                  </strong>
                </div>
              </div>
            </div>

            {/* Concepto */}
            <div className="text-xs">
              <span className="text-slate-500 font-bold uppercase text-[11px] block mb-0.5">
                Concepto de la Operación:
              </span>
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 font-semibold text-slate-900 dark:text-slate-100">
                {movimiento.concepto}
              </div>
            </div>

            {/* Medios de pago (si aplica) */}
            {mediosPago.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Detalle de Valores / Medios de Pago Recibidos
                </span>
                <table className="w-full text-left text-[11px] border border-slate-200 dark:border-slate-800">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold">
                    <tr>
                      <th className="py-1.5 px-2.5">Medio de Pago</th>
                      <th className="py-1.5 px-2.5">Referencia / Comprobante</th>
                      <th className="py-1.5 px-2.5 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {mediosPago.map((mp: any, i: number) => (
                      <tr key={i}>
                        <td className="py-1.5 px-2.5 font-bold">
                          {String(mp.metodo || 'PAGO').replace(/_/g, ' ')}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-500">{mp.referencia || '—'}</td>
                        <td className="py-1.5 px-2.5 text-right font-bold">
                          {formatARS(mp.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Comprobantes Imputados */}
            {imputaciones.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Imputación a Comprobantes de Cuenta Corriente
                </span>
                <table className="w-full text-left text-[11px] border border-slate-200 dark:border-slate-800">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold">
                    <tr>
                      <th className="py-1.5 px-2.5">Comprobante</th>
                      <th className="py-1.5 px-2.5 text-right">Saldo Anterior</th>
                      <th className="py-1.5 px-2.5 text-right">Monto Imputado</th>
                      <th className="py-1.5 px-2.5 text-right">Saldo Restante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {imputaciones.map((imp: any, i: number) => (
                      <tr key={i}>
                        <td className="py-1.5 px-2.5 font-mono font-bold">{imp.numero}</td>
                        <td className="py-1.5 px-2.5 text-right text-slate-500">
                          {formatARS(imp.saldoAnterior)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-bold text-emerald-600">
                          {formatARS(imp.montoImputado)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-bold">
                          {formatARS(imp.saldoPosterior)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Total del comprobante */}
            <div className="p-3.5 rounded-xl bg-slate-900 text-white print:bg-slate-100 print:text-black print:border print:border-slate-400 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Importe Total del Comprobante:
              </span>
              <span className="text-lg font-bold text-emerald-400 print:text-black">
                {formatARS(montoTotal)}
              </span>
            </div>

            {movimiento.observaciones && (
              <div className="text-[11px] text-slate-600 dark:text-slate-400">
                <strong>Observaciones:</strong> {movimiento.observaciones}
              </div>
            )}

            {/* Firma y conformidad */}
            <div className="pt-8 grid grid-cols-2 gap-8 text-center text-[11px] text-slate-500">
              <div className="border-t border-slate-400 pt-1.5">
                Firma y Sello — Administración HDB
              </div>
              <div className="border-t border-slate-400 pt-1.5">
                Conforme Cliente ({clienteData.nombre || 'Firma'})
              </div>
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
