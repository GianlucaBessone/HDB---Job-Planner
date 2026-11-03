import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { resolverPrecioProducto } from '@/lib/ventas/priceRules';
import { calcularTotalesVenta } from '@/lib/ventas/pdvService';
import { ensureCuentaCorrienteTables, generarNumeroCC } from '@/lib/ventas/cuentaCorrienteService';

/**
 * Actualización de deuda en Cuenta Corriente a precios vigentes.
 *
 * Para cada venta con saldo pendiente en CC se recalcula cuánto valdría hoy (mismos artículos,
 * cantidades, descuentos y lista de precios de la venta, con los precios actuales de cada producto).
 * La diferencia sobre el saldo pendiente se cobra con una Nota de Débito (CARGO_MANUAL, serie ND)
 * vinculada a la venta; la venta original no se modifica.
 *
 * Factor de la venta = total a precios de hoy / total a precios de la venta.
 * Cada ND guarda el factor que dejó aplicado; la siguiente actualización solo cobra el tramo nuevo:
 *   ND = saldo pendiente × (factor actual − factor ya aplicado)
 * Si los precios bajaron no se emite nada (las bajas se resuelven con una nota de crédito manual).
 *
 * El factor aplicado se guarda en `mediosPago` (campo JSON sin uso en los cargos) como objeto
 * `{ actualizacionPrecios: {...} }`. Todo el código que lee `mediosPago` espera un array y lo ignora.
 */

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const round6 = (n: number) => Math.round((Number(n) || 0) * 1e6) / 1e6;

export const CONCEPTO_ACTUALIZACION = 'Actualización de precios';

interface MetaActualizacion {
  actualizacionPrecios: {
    ventaId: string;
    ventaNumero: string;
    factorAnterior: number;
    factorAplicado: number;
    saldoBase: number;
    calculadoEn: string;
  };
}

function leerMeta(mediosPago: unknown): MetaActualizacion['actualizacionPrecios'] | null {
  if (!mediosPago || typeof mediosPago !== 'object' || Array.isArray(mediosPago)) return null;
  const meta = (mediosPago as any).actualizacionPrecios;
  if (!meta || typeof meta.factorAplicado !== 'number') return null;
  return meta;
}

export interface LineaActualizacion {
  sku: string;
  descripcion: string;
  cantidad: number;
  precioVenta: number;
  precioActual: number;
  actualizado: boolean; // false: artículo libre o producto inexistente → se mantiene el precio
}

export interface PropuestaActualizacion {
  ventaId: string;
  numero: string;
  fecha: Date;
  listaPrecioNombre: string | null;
  saldoPendiente: number;
  totalVenta: number;
  totalActual: number;
  factorAnterior: number;
  factorActual: number;
  diferencia: number; // monto de la ND a emitir (0 si no corresponde)
  lineas: LineaActualizacion[];
}

async function calcularPropuestas(clienteId: string, tx: any = prisma): Promise<PropuestaActualizacion[]> {
  const ventas = await tx.venta.findMany({
    where: {
      clienteId,
      estado: 'CONFIRMADA',
      imputadoCuentaCorriente: { gt: 0 },
      saldoPendiente: { gt: 0.009 },
    },
    include: { items: true, listaPrecio: true },
    orderBy: { fecha: 'asc' },
  });
  if (ventas.length === 0) return [];

  const productoIds = Array.from(
    new Set(
      ventas.flatMap((v: any) => v.items.map((it: any) => it.productoId).filter((id: string | null) => !!id))
    )
  ) as string[];

  const [productos, ndsPrevias] = await Promise.all([
    productoIds.length > 0
      ? tx.producto.findMany({
          where: { id: { in: productoIds } },
          include: {
            iva: true,
            proveedores: { where: { esPrincipal: true }, take: 1 },
          },
        })
      : Promise.resolve([]),
    tx.cuentaCorrienteMovimiento.findMany({
      where: {
        clienteId,
        estado: 'CONFIRMADO',
        tipo: 'CARGO_MANUAL',
        ventaId: { in: ventas.map((v: any) => v.id) },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const productosMap = new Map<string, any>(productos.map((p: any) => [p.id, p]));

  // Último factor aplicado por venta
  const factorAplicadoPorVenta = new Map<string, number>();
  for (const nd of ndsPrevias) {
    const meta = leerMeta(nd.mediosPago);
    if (meta && nd.ventaId) factorAplicadoPorVenta.set(nd.ventaId, meta.factorAplicado);
  }

  return ventas.map((venta: any) => {
    const lista = venta.listaPrecio
      ? { ...venta.listaPrecio, ivaDiscriminado: Boolean(venta.listaPrecio.ivaDiscriminado) }
      : null;
    const ivaDiscriminado = Boolean(venta.listaPrecio?.ivaDiscriminado);

    const lineas: LineaActualizacion[] = [];
    const itemsVenta: any[] = [];
    const itemsActuales: any[] = [];

    for (const it of venta.items) {
      const prod = it.productoId ? productosMap.get(it.productoId) : null;
      const precioVenta = Number(it.precioUnitario) || 0;
      let precioActual = precioVenta;
      let actualizado = false;

      if (prod && prod.activo !== false) {
        const precioListaHoy = resolverPrecioProducto(
          {
            precioBase: prod.precioBase,
            costo: Number(prod.proveedores?.[0]?.costo) || 0,
            rentabilidad: prod.rentabilidad,
            familiaId: prod.familiaId,
            marcaId: prod.marcaId,
            ivaPorcentaje: Number(it.ivaPorcentaje) || prod.iva?.porcentaje || 0,
          },
          lista
        ).precio;
        const precioListaVenta = Number(it.precioOriginal) || precioVenta;
        if (precioListaHoy > 0 && precioListaVenta > 0) {
          // Se conserva la relación con el precio de lista (descuentos o precios autorizados a mano)
          precioActual = round2(precioVenta * (precioListaHoy / precioListaVenta));
          actualizado = true;
        }
      }

      const base = {
        productoId: it.productoId,
        sku: it.sku,
        descripcion: it.descripcion,
        cantidad: Number(it.cantidad) || 0,
        descuentoPorcentaje: Number(it.descuentoPorcentaje) || 0,
        descuentoMonto: Number(it.descuentoPorcentaje) > 0 ? 0 : Number(it.descuentoMonto) || 0,
        ivaPorcentaje: Number(it.ivaPorcentaje) || 0,
        precioOriginal: Number(it.precioOriginal) || precioVenta,
      };
      itemsVenta.push({ ...base, precioUnitario: precioVenta });
      itemsActuales.push({ ...base, precioUnitario: precioActual });
      lineas.push({
        sku: it.sku,
        descripcion: it.descripcion,
        cantidad: base.cantidad,
        precioVenta,
        precioActual,
        actualizado,
      });
    }

    const opciones = { ivaDiscriminado };
    const totalVenta = calcularTotalesVenta(itemsVenta, venta.descuentoPorcentaje, venta.recargoPorcentaje, opciones).total;
    const totalActual = calcularTotalesVenta(itemsActuales, venta.descuentoPorcentaje, venta.recargoPorcentaje, opciones).total;

    const factorActual = totalVenta > 0 ? round6(totalActual / totalVenta) : 1;
    const factorAnterior = factorAplicadoPorVenta.get(venta.id) ?? 1;
    const saldoPendiente = round2(venta.saldoPendiente);
    const diferencia = factorActual > factorAnterior ? round2(saldoPendiente * (factorActual - factorAnterior)) : 0;

    return {
      ventaId: venta.id,
      numero: venta.numero,
      fecha: venta.fecha,
      listaPrecioNombre: venta.listaPrecioNombre || venta.listaPrecio?.nombre || null,
      saldoPendiente,
      totalVenta: round2(venta.total),
      totalActual,
      factorAnterior,
      factorActual,
      diferencia: diferencia >= 0.01 ? diferencia : 0,
      lineas,
    };
  });
}

/** Vista previa: qué Notas de Débito se emitirían hoy para el cliente. */
export async function previsualizarActualizacionDeuda(clienteId: string) {
  await ensureCuentaCorrienteTables();
  const propuestas = await calcularPropuestas(clienteId);
  return {
    propuestas,
    totalDiferencia: round2(propuestas.reduce((acc, p) => acc + p.diferencia, 0)),
  };
}

/**
 * Emite una Nota de Débito por cada venta seleccionada cuya diferencia a precios vigentes sea positiva.
 * Recalcula dentro de la transacción: si los precios cambiaron entre la vista previa y la confirmación,
 * se usa el valor del momento de emitir.
 */
export async function aplicarActualizacionDeuda(input: {
  clienteId: string;
  ventaIds?: string[];
  operadorId?: string | null;
  operadorNombre?: string | null;
}) {
  await ensureCuentaCorrienteTables();

  const cliente = await prisma.hdbClient.findUnique({
    where: { id: input.clienteId },
    include: { cuentaCorrienteConfig: true },
  });
  if (!cliente) throw new Error('Cliente no encontrado');

  const operadorNombre = input.operadorNombre?.trim() || 'Administración HDB';
  const plazoDias = cliente.cuentaCorrienteConfig?.plazoDias ?? 30;
  const seleccion = input.ventaIds && input.ventaIds.length > 0 ? new Set(input.ventaIds) : null;

  const emitidas = await prisma.$transaction(
    async (tx) => {
      const propuestas = (await calcularPropuestas(input.clienteId, tx)).filter(
        (p) => p.diferencia > 0 && (!seleccion || seleccion.has(p.ventaId))
      );

      const creadas: any[] = [];
      for (const p of propuestas) {
        const numero = await generarNumeroCC(tx, 'ND');
        const fVenc = new Date();
        fVenc.setDate(fVenc.getDate() + Math.max(0, plazoDias));
        const meta: MetaActualizacion = {
          actualizacionPrecios: {
            ventaId: p.ventaId,
            ventaNumero: p.numero,
            factorAnterior: p.factorAnterior,
            factorAplicado: p.factorActual,
            saldoBase: p.saldoPendiente,
            calculadoEn: new Date().toISOString(),
          },
        };
        const variacion = ((p.factorActual / p.factorAnterior - 1) * 100).toLocaleString('es-AR', {
          maximumFractionDigits: 2,
        });

        const mov = await tx.cuentaCorrienteMovimiento.create({
          data: {
            numero,
            clienteId: input.clienteId,
            tipo: 'CARGO_MANUAL',
            concepto: `${CONCEPTO_ACTUALIZACION} — ${p.numero} (+${variacion}% s/ saldo pendiente)`,
            debe: p.diferencia,
            haber: 0,
            saldoPendienteCargo: p.diferencia,
            fechaVencimiento: fVenc,
            mediosPago: meta as any,
            ventaId: p.ventaId,
            estado: 'CONFIRMADO',
            operadorId: input.operadorId || null,
            operadorNombre,
            observaciones: `Saldo pendiente actualizado de $${p.saldoPendiente.toLocaleString('es-AR', {
              minimumFractionDigits: 2,
            })} a precios vigentes.`,
          },
        });
        creadas.push(mov);
      }
      return creadas;
    },
    { maxWait: 15000, timeout: 30000 }
  );

  if (emitidas.length > 0) {
    await logAudit({
      userId: input.operadorId || undefined,
      userName: operadorNombre,
      action: 'CREATE',
      entity: 'CUENTA_CORRIENTE_MOVIMIENTO',
      entityId: emitidas[0].id,
      newValue: {
        tipo: 'ACTUALIZACION_PRECIOS',
        cliente: cliente.nombre,
        notasDebito: emitidas.map((m) => ({ numero: m.numero, ventaId: m.ventaId, debe: m.debe })),
        total: round2(emitidas.reduce((acc, m) => acc + m.debe, 0)),
      },
    });
  }

  return {
    emitidas,
    total: round2(emitidas.reduce((acc, m) => acc + m.debe, 0)),
  };
}
