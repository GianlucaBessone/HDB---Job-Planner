import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { calculateSuggestedPrice, ListaPrecioConfig } from '@/lib/ventas/priceRules';

export interface ItemVentaInput {
  productoId: string;
  sku: string;
  descripcion: string;
  unidad?: string | null;
  cantidad: number;
  precioOriginal: number;
  precioUnitario: number;
  descuentoPorcentaje?: number;
  descuentoMonto?: number;
  ivaPorcentaje?: number;
  motivoModificacion?: string | null;
  precioModificado?: boolean;
}

export interface PagoVentaInput {
  metodo: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO' | 'CUENTA_CORRIENTE' | 'CHEQUE';
  monto: number;
  montoRecibido?: number | null;
  vuelto?: number | null;
  referencia?: string | null;
  observaciones?: string | null;
}

export interface ConfirmarVentaInput {
  clienteId?: string | null;
  clienteNombre?: string | null;
  clienteIdentificacion?: string | null;
  clienteDireccion?: string | null;
  clienteTelefono?: string | null;
  clienteEmail?: string | null;
  listaPrecioId?: string | null;
  almacenId?: string | null;
  vendedorId?: string | null;
  vendedorNombre?: string | null;
  vendedorRol?: string | null;
  items: ItemVentaInput[];
  pagos: PagoVentaInput[];
  descuentoPorcentaje?: number;
  recargoPorcentaje?: number;
  observaciones?: string | null;
}

/**
 * Resuelve el precio de un producto según la lista de precio seleccionada
 */
export function resolverPrecioProducto(
  producto: {
    precioBase: number;
    costo?: number;
    familiaId?: string | null;
    marcaId?: string | null;
  },
  lista?: (ListaPrecioConfig & { tipoAjuste: string; valorAjuste: number; esPredeterminada?: boolean }) | null,
  preciosMap: Record<string, number> = {}
): { precio: number; esFallback: boolean; detalleAjuste?: string } {
  const precioBase = Number(producto.precioBase) || 0;

  if (!lista || lista.tipoAjuste === 'MANUAL') {
    // Si la lista es manual y es base/predeterminada, precioBase es el precio
    return {
      precio: precioBase,
      esFallback: false,
      detalleAjuste: 'Precio Base / Manual',
    };
  }

  // Si tiene regla dinámica (costo, margen, descuento, recargo)
  const costo = Number(producto.costo) || 0;
  const mapaCalculo = {
    ...preciosMap,
    ...(lista.listaBaseId ? { [lista.listaBaseId]: precioBase } : {}),
    base: precioBase,
  };

  const precioSugerido = calculateSuggestedPrice(
    lista,
    {
      costo,
      familiaId: producto.familiaId,
      marcaId: producto.marcaId,
    },
    mapaCalculo
  );

  if (precioSugerido !== null && precioSugerido > 0) {
    return {
      precio: precioSugerido,
      esFallback: false,
      detalleAjuste: `${lista.tipoAjuste} (${lista.valorAjuste}%)`,
    };
  }

  // Fallback explícito a precio base si la regla no aplica o no pudo resolverse
  return {
    precio: precioBase,
    esFallback: true,
    detalleAjuste: 'Fallback a Precio Base (regla no aplicable o sin costo)',
  };
}

/**
 * Calcula y desglosa los totales de una venta de forma decimal precisa
 */
export function calcularTotalesVenta(
  items: ItemVentaInput[],
  descuentoGlobalPorcentaje: number = 0,
  recargoGlobalPorcentaje: number = 0
) {
  let subtotalBruto = 0;
  let descuentoLineasTotal = 0;
  let impuestosTotal = 0;

  const itemsCalculados = items.map((it) => {
    const cantidad = Number(it.cantidad) || 0;
    const precioUnitario = Number(it.precioUnitario) || 0;
    const descPorc = Math.max(0, Math.min(100, Number(it.descuentoPorcentaje) || 0));
    const ivaPorc = Math.max(0, Number(it.ivaPorcentaje) || 0);

    const brutoLinea = Math.round(cantidad * precioUnitario * 100) / 100;
    let descLineaMonto = Number(it.descuentoMonto) || 0;
    if (descPorc > 0 && descLineaMonto === 0) {
      descLineaMonto = Math.round(((brutoLinea * descPorc) / 100) * 100) / 100;
    }
    descLineaMonto = Math.min(brutoLinea, Math.max(0, descLineaMonto));

    const netoLinea = Math.round((brutoLinea - descLineaMonto) * 100) / 100;
    const ivaLinea = ivaPorc > 0 ? Math.round(((netoLinea * ivaPorc) / 100) * 100) / 100 : 0;

    subtotalBruto += brutoLinea;
    descuentoLineasTotal += descLineaMonto;
    impuestosTotal += ivaLinea;

    return {
      ...it,
      cantidad,
      precioUnitario,
      descuentoPorcentaje: descPorc,
      descuentoMonto: descLineaMonto,
      subtotal: netoLinea,
      ivaPorcentaje: ivaPorc,
      ivaMonto: ivaLinea,
    };
  });

  const subtotalNetoLineas = Math.round((subtotalBruto - descuentoLineasTotal) * 100) / 100;

  // Descuento global
  const descGlobPorc = Math.max(0, Math.min(100, Number(descuentoGlobalPorcentaje) || 0));
  const descGlobMonto = Math.round(((subtotalNetoLineas * descGlobPorc) / 100) * 100) / 100;

  // Recargo global
  const recGlobPorc = Math.max(0, Number(recargoGlobalPorcentaje) || 0);
  const recGlobMonto = Math.round(((subtotalNetoLineas * recGlobPorc) / 100) * 100) / 100;

  const total = Math.max(0, Math.round((subtotalNetoLineas - descGlobMonto + recGlobMonto) * 100) / 100);

  return {
    items: itemsCalculados,
    subtotalBruto: Math.round(subtotalBruto * 100) / 100,
    descuentoLineasTotal: Math.round(descuentoLineasTotal * 100) / 100,
    subtotal: subtotalNetoLineas,
    descuentoPorcentaje: descGlobPorc,
    descuentoMonto: descGlobMonto,
    recargoPorcentaje: recGlobPorc,
    recargoMonto: recGlobMonto,
    impuestosMonto: Math.round(impuestosTotal * 100) / 100,
    total,
  };
}

/**
 * Genera el siguiente número secuencial de venta de forma atómica (ej: VTA-2026-000001)
 */
export async function generarNumeroVenta(tx: any, year?: number): Promise<string> {
  const currentYear = year || new Date().getFullYear();

  const counter = await tx.ventaCounter.upsert({
    where: { year: currentYear },
    update: { currentNumber: { increment: 1 } },
    create: { year: currentYear, currentNumber: 1 },
  });

  const seq = String(counter.currentNumber).padStart(6, '0');
  return `VTA-${currentYear}-${seq}`;
}

/**
 * Confirma una venta en el PDV de forma transaccional e idempotente
 */
export async function confirmarVentaPDV(input: ConfirmarVentaInput, userId?: string) {
  if (!input.items || input.items.length === 0) {
    throw new Error('La venta debe contener al menos un producto');
  }

  // 1. Validar productos en base de datos
  const productoIds = input.items.map((i) => i.productoId).filter(Boolean);
  const productosDb = await prisma.producto.findMany({
    where: {
      id: { in: productoIds },
      activo: true,
    },
    include: {
      iva: true,
      proveedores: {
        where: { esPrincipal: true },
        take: 1,
      },
    },
  });

  const productosMap = new Map(productosDb.map((p) => [p.id, p]));
  for (const item of input.items) {
    if (!productosMap.has(item.productoId)) {
      throw new Error(`El producto con SKU ${item.sku} no existe o no está habilitado para la venta`);
    }
    if (item.cantidad <= 0) {
      throw new Error(`Cantidad inválida para el producto ${item.sku}`);
    }
  }

  // 2. Obtener lista de precios si se especificó
  let listaPrecioNombre = 'Lista General';
  let listaDb = null;
  if (input.listaPrecioId) {
    listaDb = await prisma.listaPrecio.findUnique({
      where: { id: input.listaPrecioId, activo: true },
    });
    if (listaDb) {
      listaPrecioNombre = listaDb.nombre;
    }
  }

  // 3. Cliente: nominal o Consumidor Final
  let clienteId: string | null = null;
  let clienteNombre = input.clienteNombre?.trim() || 'Consumidor Final';
  let clienteIdentificacion = input.clienteIdentificacion?.trim() || null;
  let clienteDireccion = input.clienteDireccion?.trim() || null;
  let clienteTelefono = input.clienteTelefono?.trim() || null;
  let clienteEmail = input.clienteEmail?.trim() || null;

  if (input.clienteId) {
    const clientDb = await prisma.hdbClient.findUnique({
      where: { id: input.clienteId, activo: true },
    });
    if (clientDb) {
      clienteId = clientDb.id;
      clienteNombre = clientDb.nombre;
      clienteIdentificacion = clienteIdentificacion || null;
      clienteDireccion = clientDb.direccion || clienteDireccion;
      clienteTelefono = clientDb.telefono || clienteTelefono;
      clienteEmail = clientDb.email || clienteEmail;
    }
  }

  // 4. Calcular totales precisos
  const calculo = calcularTotalesVenta(
    input.items,
    input.descuentoPorcentaje || 0,
    input.recargoPorcentaje || 0
  );

  const totalVenta = calculo.total;

  // 5. Validar Medios de Pago y Cuenta Corriente
  const pagos = input.pagos || [];
  let totalPagadoEfectivo = 0;
  let imputadoCuentaCorriente = 0;

  for (const p of pagos) {
    const monto = Number(p.monto) || 0;
    if (monto <= 0) continue;

    if (p.metodo === 'CUENTA_CORRIENTE') {
      if (!clienteId || clienteNombre === 'Consumidor Final') {
        throw new Error('Para imputar a Cuenta Corriente es obligatorio seleccionar un cliente nominal registrado');
      }
      imputadoCuentaCorriente += monto;
    } else {
      totalPagadoEfectivo += monto;
    }
  }

  totalPagadoEfectivo = Math.round(totalPagadoEfectivo * 100) / 100;
  imputadoCuentaCorriente = Math.round(imputadoCuentaCorriente * 100) / 100;
  const sumaMedios = Math.round((totalPagadoEfectivo + imputadoCuentaCorriente) * 100) / 100;

  if (Math.abs(sumaMedios - totalVenta) > 0.05) {
    throw new Error(
      `La suma de pagos ($${sumaMedios}) no coincide con el total de la venta ($${totalVenta})`
    );
  }

  // Determinar estado de pago
  const saldoPendiente = imputadoCuentaCorriente;
  let estadoPago: 'PAGADO' | 'PARCIAL' | 'PENDIENTE' = 'PAGADO';
  if (saldoPendiente > 0) {
    estadoPago = totalPagadoEfectivo > 0 ? 'PARCIAL' : 'PENDIENTE';
  }

  // Almacén de referencia
  let almacenNombre = 'Central';
  if (input.almacenId) {
    const alm = await prisma.almacen.findUnique({
      where: { id: input.almacenId },
      select: { nombre: true },
    });
    if (alm) almacenNombre = alm.nombre;
  }

  // 6. Transacción atómica en Base de Datos
  const resultado = await prisma.$transaction(async (tx) => {
    // Generar número correlativo
    const numero = await generarNumeroVenta(tx);

    // Crear la venta cabecera
    const venta = await tx.venta.create({
      data: {
        numero,
        clienteId,
        clienteNombre,
        clienteIdentificacion,
        clienteDireccion,
        clienteTelefono,
        clienteEmail,
        listaPrecioId: input.listaPrecioId || null,
        listaPrecioNombre,
        vendedorId: input.vendedorId || userId || null,
        vendedorNombre: input.vendedorNombre || null,
        almacenId: input.almacenId || null,
        almacenNombre,
        subtotal: calculo.subtotal,
        descuentoPorcentaje: calculo.descuentoPorcentaje,
        descuentoMonto: calculo.descuentoMonto,
        recargoPorcentaje: calculo.recargoPorcentaje,
        recargoMonto: calculo.recargoMonto,
        impuestosMonto: calculo.impuestosMonto,
        total: totalVenta,
        estado: 'CONFIRMADA',
        estadoPago,
        totalPagado: totalPagadoEfectivo,
        saldoPendiente,
        imputadoCuentaCorriente,
        cuentaCorrienteConciliada: false,
        stockDescontado: false, // Listo para futura integración con Almacén
        observaciones: input.observaciones?.trim() || null,
        items: {
          create: calculo.items.map((it) => ({
            productoId: it.productoId,
            sku: it.sku,
            descripcion: it.descripcion,
            unidad: it.unidad || null,
            cantidad: it.cantidad,
            precioOriginal: it.precioOriginal,
            precioUnitario: it.precioUnitario,
            descuentoPorcentaje: it.descuentoPorcentaje,
            descuentoMonto: it.descuentoMonto,
            ivaPorcentaje: it.ivaPorcentaje,
            subtotal: it.subtotal,
            precioModificado: it.precioModificado || false,
            motivoModificacion: it.motivoModificacion || null,
          })),
        },
        pagos: {
          create: pagos
            .filter((p) => (Number(p.monto) || 0) > 0)
            .map((p) => ({
              metodo: p.metodo,
              monto: Number(p.monto) || 0,
              montoRecibido: p.montoRecibido ? Number(p.montoRecibido) : null,
              vuelto: p.vuelto ? Number(p.vuelto) : null,
              referencia: p.referencia?.trim() || null,
              observaciones: p.observaciones?.trim() || null,
            })),
        },
      },
      include: {
        items: true,
        pagos: true,
      },
    });

    return venta;
  });

  // 7. Registro de auditoría
  await logAudit({
    userId: input.vendedorId || userId || undefined,
    userName: input.vendedorNombre || undefined,
    action: 'CREATE',
    entity: 'VENTA_PDV',
    entityId: resultado.id,
    newValue: {
      numero: resultado.numero,
      total: resultado.total,
      cliente: resultado.clienteNombre,
      estadoPago: resultado.estadoPago,
      itemsCount: resultado.items.length,
      saldoPendiente: resultado.saldoPendiente,
    },
    metadata: {
      listaPrecio: resultado.listaPrecioNombre,
      cuentaCorriente: resultado.imputadoCuentaCorriente > 0,
    },
  });

  return resultado;
}

/**
 * Anula una venta confirmada preservando trazabilidad
 */
export async function anularVentaPDV(
  ventaId: string,
  motivo: string,
  usuarioId: string,
  usuarioNombre?: string,
  usuarioRol?: string
) {
  if (!motivo || motivo.trim().length < 3) {
    throw new Error('Debe especificar un motivo válido de anulación (mínimo 3 caracteres)');
  }

  const venta = await prisma.venta.findUnique({
    where: { id: ventaId },
    include: { items: true, pagos: true },
  });

  if (!venta) {
    throw new Error('Venta no encontrada');
  }

  if (venta.estado === 'ANULADA') {
    throw new Error('Esta venta ya se encuentra anulada');
  }

  // Comprobar rol permitido (admin o supervisor)
  const rol = (usuarioRol || '').toLowerCase();
  if (rol && !['admin', 'supervisor'].includes(rol)) {
    throw new Error('Solo usuarios con rol Administrador o Supervisor pueden anular ventas');
  }

  const updatedVenta = await prisma.venta.update({
    where: { id: ventaId },
    data: {
      estado: 'ANULADA',
      motivoAnulacion: motivo.trim(),
      anuladoPorId: usuarioId || null,
      anuladoEn: new Date(),
    },
    include: {
      items: true,
      pagos: true,
    },
  });

  await logAudit({
    userId: usuarioId,
    userName: usuarioNombre,
    action: 'UPDATE',
    entity: 'VENTA_PDV',
    entityId: ventaId,
    oldValue: { estado: venta.estado },
    newValue: { estado: 'ANULADA', motivo: motivo.trim() },
    metadata: {
      numero: venta.numero,
      total: venta.total,
      motivo: motivo.trim(),
    },
  });

  return updatedVenta;
}
