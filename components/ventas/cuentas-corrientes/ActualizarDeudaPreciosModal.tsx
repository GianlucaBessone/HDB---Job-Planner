'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, TrendingUp } from 'lucide-react';
import { Button, Dialog, LoadingState } from '@/components/ui';
import { formatARS } from '@/lib/formatCurrency';

interface LineaActualizacion {
  sku: string;
  descripcion: string;
  cantidad: number;
  precioVenta: number;
  precioActual: number;
  actualizado: boolean;
}

interface Propuesta {
  ventaId: string;
  numero: string;
  fecha: string;
  listaPrecioNombre: string | null;
  saldoPendiente: number;
  totalVenta: number;
  totalActual: number;
  factorAnterior: number;
  factorActual: number;
  diferencia: number;
  lineas: LineaActualizacion[];
}

interface Props {
  cliente: { id: string; name: string };
  operadorNombre?: string;
  onClose: () => void;
  onSuccess: (mensaje: string) => void;
}

const fmtFecha = (val: string) => {
  const d = new Date(val);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR');
};

const fmtPorc = (factor: number) =>
  `${factor >= 1 ? '+' : ''}${((factor - 1) * 100).toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`;

/**
 * Actualiza las facturas impagas de Cuenta Corriente a precios vigentes: muestra cuánto subió
 * cada una y emite una Nota de Débito por la diferencia sobre el saldo pendiente.
 */
export default function ActualizarDeudaPreciosModal({ cliente, operadorNombre, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propuestas, setPropuestas] = useState<Propuesta[]>([]);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [expandida, setExpandida] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    fetch(`/api/ventas/cuentas-corrientes/${cliente.id}/actualizacion-precios`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Error al calcular la actualización');
        return data;
      })
      .then((data) => {
        if (cancelado) return;
        const lista: Propuesta[] = data.propuestas || [];
        setPropuestas(lista);
        setSeleccion(new Set(lista.filter((p) => p.diferencia > 0).map((p) => p.ventaId)));
      })
      .catch((err) => !cancelado && setError(err.message))
      .finally(() => !cancelado && setLoading(false));
    return () => {
      cancelado = true;
    };
  }, [cliente.id]);

  const conDiferencia = useMemo(() => propuestas.filter((p) => p.diferencia > 0), [propuestas]);
  const totalSeleccionado = useMemo(
    () =>
      Math.round(
        propuestas.filter((p) => seleccion.has(p.ventaId)).reduce((acc, p) => acc + p.diferencia, 0) * 100
      ) / 100,
    [propuestas, seleccion]
  );

  const toggle = (id: string) =>
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleAplicar = async () => {
    if (seleccion.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ventas/cuentas-corrientes/${cliente.id}/actualizacion-precios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': `act-precios-${cliente.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
        body: JSON.stringify({ ventaIds: Array.from(seleccion), operadorNombre }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar la deuda');
      onSuccess(
        data.emitidas?.length
          ? `Se emitieron ${data.emitidas.length} nota(s) de débito por ${formatARS(data.total)}`
          : 'No había diferencias para actualizar'
      );
    } catch (err: any) {
      setError(err.message || 'No se pudo actualizar la deuda');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!submitting}
      size="xl"
      icon={
        <div className="w-9 h-9 rounded-xl bg-warning-50 text-warning-700 dark:bg-warning-950 dark:text-warning-300 flex items-center justify-center">
          <TrendingUp className="w-[18px] h-[18px]" />
        </div>
      }
      title="Actualizar deuda a precios vigentes"
      description={cliente.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleAplicar}
            isLoading={submitting}
            disabled={loading || seleccion.size === 0}
            icon={<CheckCircle2 />}
          >
            {seleccion.size > 0
              ? `Emitir ${seleccion.size} nota(s) de débito · ${formatARS(totalSeleccionado)}`
              : 'Emitir notas de débito'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-xs">
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
          Se recalcula cada factura impaga con los precios de hoy (mismos artículos, cantidades, descuentos y lista de
          la venta). Por la diferencia sobre el <strong>saldo pendiente</strong> se emite una nota de débito vinculada a
          la factura; la factura original no se modifica. Si ya se actualizó antes, solo se cobra el aumento nuevo. Las
          bajas de precio no generan movimientos.
        </p>

        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg border border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-800 dark:bg-danger-950 dark:text-danger-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <LoadingState label="Calculando facturas a precios vigentes…" />
        ) : propuestas.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-border text-center text-slate-500">
            El cliente no tiene facturas impagas en cuenta corriente.
          </div>
        ) : (
          <>
            {conDiferencia.length === 0 && (
              <div className="p-3 rounded-xl border border-border bg-surface-sunken text-slate-600 dark:text-slate-300">
                Las facturas impagas ya están a precios vigentes. No hay diferencias para cobrar.
              </div>
            )}
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  <tr>
                    <th className="py-2 px-2.5 w-8" />
                    <th className="py-2 px-2.5">Factura</th>
                    <th className="py-2 px-2.5">Fecha</th>
                    <th className="py-2 px-2.5 text-right">Saldo pendiente</th>
                    <th className="py-2 px-2.5 text-right">Variación</th>
                    <th className="py-2 px-2.5 text-right">Nota de débito</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {propuestas.map((p) => {
                    const habilitada = p.diferencia > 0;
                    const abierta = expandida === p.ventaId;
                    const variacion = p.factorAnterior > 0 ? p.factorActual / p.factorAnterior : 1;
                    return (
                      <React.Fragment key={p.ventaId}>
                        <tr className={habilitada ? '' : 'text-slate-400'}>
                          <td className="py-2 px-2.5">
                            <input
                              type="checkbox"
                              checked={seleccion.has(p.ventaId)}
                              disabled={!habilitada || submitting}
                              onChange={() => toggle(p.ventaId)}
                              className="rounded border-slate-300 text-primary h-3.5 w-3.5"
                              aria-label={`Actualizar ${p.numero}`}
                            />
                          </td>
                          <td className="py-2 px-2.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setExpandida(abierta ? null : p.ventaId)}
                              className="inline-flex items-center gap-1 font-mono font-bold hover:text-primary"
                              title="Ver artículos"
                            >
                              {abierta ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              {p.numero}
                            </button>
                            {p.factorAnterior > 1 && (
                              <span className="ml-1.5 text-[11px] text-slate-500">
                                (ya actualizada {fmtPorc(p.factorAnterior)})
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 whitespace-nowrap">{fmtFecha(p.fecha)}</td>
                          <td className="py-2 px-2.5 text-right font-mono whitespace-nowrap">{formatARS(p.saldoPendiente)}</td>
                          <td
                            className={`py-2 px-2.5 text-right font-mono whitespace-nowrap ${
                              variacion > 1.00001 ? 'text-warning-700 dark:text-warning-300 font-semibold' : ''
                            }`}
                          >
                            {fmtPorc(variacion)}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-bold whitespace-nowrap">
                            {habilitada ? formatARS(p.diferencia) : '—'}
                          </td>
                        </tr>
                        {abierta && (
                          <tr>
                            <td />
                            <td colSpan={5} className="pb-3 px-2.5">
                              <div className="text-[11px] text-slate-500 mb-1">
                                Lista: {p.listaPrecioNombre || '—'} · Total factura {formatARS(p.totalVenta)} → hoy{' '}
                                {formatARS(p.totalActual)}
                              </div>
                              <table className="w-full text-[11px] border border-border">
                                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500">
                                  <tr>
                                    <th className="py-1 px-2 text-left">SKU</th>
                                    <th className="py-1 px-2 text-left">Descripción</th>
                                    <th className="py-1 px-2 text-right">Cant.</th>
                                    <th className="py-1 px-2 text-right">Precio factura</th>
                                    <th className="py-1 px-2 text-right">Precio hoy</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {p.lineas.map((l, i) => (
                                    <tr key={`${l.sku}-${i}`}>
                                      <td className="py-1 px-2 font-mono">{l.sku}</td>
                                      <td className="py-1 px-2">{l.descripcion}</td>
                                      <td className="py-1 px-2 text-right font-mono">{l.cantidad}</td>
                                      <td className="py-1 px-2 text-right font-mono">{formatARS(l.precioVenta)}</td>
                                      <td className="py-1 px-2 text-right font-mono">
                                        {l.actualizado ? formatARS(l.precioActual) : <span title="Artículo libre o sin producto vigente">sin cambio</span>}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
