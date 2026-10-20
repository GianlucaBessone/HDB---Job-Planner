import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { calculateSuggestedPrice, ListaPrecioConfig, resolverPrecioProducto } from '@/lib/ventas/priceRules';

export interface ItemVentaInput {
  productoId?: string | null;
  esManual?: boolean;
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
  cotizacionId?: string | null;
}

/**
 * Resuelve el precio de un producto según la lista de precio seleccionada
 */
export { resolverPrecioProducto };

/**
 * Calcula y desglosa los totales de una venta de forma decimal precisa
 */
export function calcularTotalesVenta(
  items: ItemVentaInput[],
  descuentoGlobalPorcentaje: number = 0,
  recargoGlobalPorcentaje: number = 0,
  options?: { ivaDiscriminado?: boolean }
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
    if (descPorc > 0) {
      descLineaMonto = Math.round(((brutoLinea * descPorc) / 100) * 100) / 100;
    }
    descLineaMonto = Math.min(brutoLinea, Math.max(0, descLineaMonto));

    const netoLinea = Math.round((brutoLinea - descLineaMonto) * 100) / 100;
    let ivaLinea = 0;
    if (ivaPorc > 0) {
      if (options?.ivaDiscriminado) {
        ivaLinea = Math.round(((netoLinea * ivaPorc) / 100) * 100) / 100;
      } else {
        const divisor = 1 + ivaPorc / 100;
        const netoSinIva = divisor > 0 ? netoLinea / divisor : netoLinea;
        ivaLinea = Math.round((netoLinea - netoSinIva) * 100) / 100;
      }
    }

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

  // Recalcular impuestos teniendo en cuenta el descuento global si aplica
  let impuestosTotalAjustado = 0;
  for (const it of itemsCalculados) {
    if (it.ivaPorcentaje && it.ivaPorcentaje > 0) {
      const baseLinea = it.subtotal * (1 - descGlobPorc / 100);
      if (options?.ivaDiscriminado) {
        const iva = Math.round(((baseLinea * it.ivaPorcentaje) / 100) * 100) / 100;
        impuestosTotalAjustado += iva;
      } else {
        const divisor = 1 + it.ivaPorcentaje / 100;
        const netoSinIva = divisor > 0 ? baseLinea / divisor : baseLinea;
        const iva = Math.round((baseLinea - netoSinIva) * 100) / 100;
        impuestosTotalAjustado += iva;
      }
    }
  }
  const impuestosMonto = Math.round(impuestosTotalAjustado * 100) / 100;

  let total: number;
  if (options?.ivaDiscriminado) {
    total = Math.max(0, Math.round((subtotalNetoLineas - descGlobMonto + recGlobMonto + impuestosMonto) * 100) / 100);
  } else {
    total = Math.max(0, Math.round((subtotalNetoLineas - descGlobMonto + recGlobMonto) * 100) / 100);
  }

  return {
    items: itemsCalculados,
    subtotalBruto: Math.round(subtotalBruto * 100) / 100,
    descuentoLineasTotal: Math.round(descuentoLineasTotal * 100) / 100,
    subtotal: subtotalNetoLineas,
    descuentoPorcentaje: descGlobPorc,
    descuentoMonto: descGlobMonto,
    recargoPorcentaje: recGlobPorc,
    recargoMonto: recGlobMonto,
    impuestosMonto,
    total,
    ivaDiscriminado: Boolean(options?.ivaDiscriminado),
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

  // 1. Validar productos de catálogo en base de datos (permitiendo ítems manuales sin productoId)
  const productoIds = input.items
    .map((i) => i.productoId)
    .filter((id): id is string => Boolean(id && !id.startsWith('manual-')));
  const productosDb =
    productoIds.length > 0
      ? await prisma.producto.findMany({
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
        })
      : [];

  const productosMap = new Map(productosDb.map((p) => [p.id, p]));
  for (const item of input.items) {
    const esItemManual = Boolean(item.esManual || !item.productoId || item.productoId.startsWith('manual-'));
    if (!esItemManual && item.productoId && !productosMap.has(item.productoId)) {
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

  // Vendedor validado contra Operator para evitar errores de Foreign Key
  let validVendedorId: string | null = null;
  let vendedorNombre = input.vendedorNombre || null;
  const candidateVendedorId = input.vendedorId || userId || null;

  if (candidateVendedorId) {
    const op = await prisma.operator.findUnique({
      where: { id: candidateVendedorId },
      select: { id: true, nombreCompleto: true },
    });
    if (op) {
      validVendedorId = op.id;
      if (!vendedorNombre) {
        vendedorNombre = op.nombreCompleto;
      }
    }
  }

  if (!vendedorNombre) {
    vendedorNombre = 'Ventas HDB';
  }

  // 4. Calcular totales precisos
  const calculo = calcularTotalesVenta(
    input.items,
    input.descuentoPorcentaje || 0,
    input.recargoPorcentaje || 0,
    { ivaDiscriminado: Boolean(listaDb?.ivaDiscriminado) }
  );

  const totalCalculado = calculo.total;

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

  // Validar estado crediticio y límite en Cuenta Corriente si corresponde
  if (imputadoCuentaCorriente > 0 && clienteId) {
    try {
      const ccConfig = await prisma.cuentaCorrienteConfig.findUnique({
        where: { clienteId },
      });
      if (ccConfig) {
        if (ccConfig.estadoCredito === 'SUSPENDIDO') {
          throw new Error(
            `La Cuenta Corriente del cliente "${clienteNombre}" se encuentra SUSPENDIDA. No es posible imputar nuevas ventas a crédito.`
          );
        }
        if (ccConfig.limiteCredito > 0) {
          const [ventasPrevias, movsPrevios] = await Promise.all([
            prisma.venta.findMany({
              where: {
                clienteId,
                estado: 'CONFIRMADA',
                OR: [{ imputadoCuentaCorriente: { gt: 0 } }, { saldoPendiente: { gt: 0 } }],
              },
              select: { imputadoCuentaCorriente: true, saldoPendiente: true },
            }),
            prisma.cuentaCorrienteMovimiento.findMany({
              where: { clienteId, estado: 'CONFIRMADO' },
              select: { debe: true, haber: true },
            }),
          ]);
          const debePrevio =
            ventasPrevias.reduce(
              (acc, v) => acc + (v.imputadoCuentaCorriente > 0 ? v.imputadoCuentaCorriente : v.saldoPendiente),
              0
            ) + movsPrevios.reduce((acc, m) => acc + (m.debe || 0), 0);
          const haberPrevio = movsPrevios.reduce((acc, m) => acc + (m.haber || 0), 0);
          const saldoActualCC = Math.round((debePrevio - haberPrevio) * 100) / 100;
          const nuevoSaldoProyectado = Math.round((saldoActualCC + imputadoCuentaCorriente) * 100) / 100;
          const rolVendedor = (input.vendedorRol || '').toLowerCase();

          if (
            nuevoSaldoProyectado > ccConfig.limiteCredito + 0.05 &&
            !['admin', 'administrador', 'supervisor'].includes(rolVendedor)
          ) {
            const disponible = Math.max(0, Math.round((ccConfig.limiteCredito - saldoActualCC) * 100) / 100);
            throw new Error(
              `El monto a imputar ($${imputadoCuentaCorriente.toLocaleString('es-AR')}) supera el margen de crédito disponible del cliente ($${disponible.toLocaleString('es-AR')} sobre un límite de $${ccConfig.limiteCredito.toLocaleString('es-AR')}). Requiere autorización de Supervisor o Administrador.`
            );
          }
        }
      }
    } catch (ccErr: any) {
      if (
        ccErr.message?.includes('SUSPENDIDA') ||
        ccErr.message?.includes('margen de crédito disponible')
      ) {
        throw ccErr;
      }
      // Si la tabla aún no fue inicializada, continuar sin bloquear
    }
  }

  let totalVenta = totalCalculado;
  if (Math.abs(sumaMedios - totalCalculado) <= 0.50) {
    // Absorber pequeñas diferencias de redondeo decimal entre cliente y servidor
    totalVenta = sumaMedios;
  } else {
    throw new Error(
      `La suma de pagos ($${sumaMedios}) no coincide con el total de la venta ($${totalCalculado})`
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
  const resultado = await prisma.$transaction(
    async (tx) => {
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
          vendedorId: validVendedorId,
          vendedorNombre,
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
              productoId: it.productoId && productosMap.has(it.productoId) ? it.productoId : null,
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
          listaPrecio: true,
        },
      });

      // Si proviene de una cotización, marcarla como CONVERTIDA
      if (input.cotizacionId) {
        try {
          await tx.cotizacion.update({
            where: { id: input.cotizacionId },
            data: {
              estado: 'CONVERTIDA',
              ventaId: venta.id,
              ventaNumero: venta.numero,
            },
          });
        } catch {
          // Ignorar si la cotización no existe
        }
      }

      return venta;
    },
    {
      maxWait: 15000,
      timeout: 30000,
    }
  );

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
      cotizacionId: input.cotizacionId || null,
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

  // Comprobar rol permitido (admin, administrador o supervisor)
  const rol = (usuarioRol || '').toLowerCase();
  if (rol && !['admin', 'administrador', 'supervisor'].includes(rol)) {
    throw new Error('Solo usuarios con rol Administrador o Supervisor pueden anular ventas');
  }

  // Si la venta fue imputada a Cuenta Corriente y ya posee cobros/recibos aplicados sobre ese saldo, impedir anular sin revertir antes el recibo
  if (
    venta.imputadoCuentaCorriente > 0 &&
    venta.saldoPendiente < venta.imputadoCuentaCorriente - 0.01
  ) {
    throw new Error(
      'No se puede anular una venta que ya posee recibos de cobro imputados en Cuenta Corriente. Anule primero el recibo de cobranza en Cuentas Corrientes.'
    );
  }

  const updatedVenta = await prisma.$transaction(async (tx) => {
    const v = await tx.venta.update({
      where: { id: ventaId },
      data: {
        estado: 'ANULADA',
        saldoPendiente: 0,
        motivoAnulacion: motivo.trim(),
        anuladoPorId: usuarioId || null,
        anuladoEn: new Date(),
      },
      include: {
        items: true,
        pagos: true,
        listaPrecio: true,
      },
    });

    // Si la venta provenía de una cotización convertida, liberar la cotización a estado APROBADA
    try {
      await tx.cotizacion.updateMany({
        where: { ventaId: ventaId, estado: 'CONVERTIDA' },
        data: {
          estado: 'APROBADA',
          ventaId: null,
          ventaNumero: null,
        },
      });
    } catch {
      // Ignorar si la tabla aún no fue inicializada
    }

    return v;
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

/**
 * Genera el siguiente número secuencial de remito de entrega (ej: REM-2026-000001)
 */
export async function generarNumeroRemito(tx: any, year?: number): Promise<string> {
  const currentYear = year || new Date().getFullYear();

  const counter = await tx.remitoEntregaCounter.upsert({
    where: { year: currentYear },
    update: { currentNumber: { increment: 1 } },
    create: { year: currentYear, currentNumber: 1 },
  });

  const seq = String(counter.currentNumber).padStart(6, '0');
  return `REM-${currentYear}-${seq}`;
}

export interface CrearRemitoInput {
  ventaId: string;
  vendedorNombre?: string | null;
  receptorNombre?: string | null;
  receptorDni?: string | null;
  observaciones?: string | null;
  items: {
    ventaItemId: string;
    cantidad: number;
  }[];
}

/**
 * Crea un Remito de Entrega con los materiales seleccionados, actualiza cantidades entregadas y estado de la venta
 */
export async function crearRemitoEntrega(
  input: CrearRemitoInput,
  usuarioId?: string,
  usuarioNombre?: string
) {
  const { ventaId, items, receptorNombre, receptorDni, observaciones } = input;

  if (!items || items.length === 0) {
    throw new Error('Debe seleccionar al menos un producto para generar el remito de entrega');
  }

  const venta = await prisma.venta.findUnique({
    where: { id: ventaId },
    include: {
      items: true,
      cliente: true,
    },
  });

  if (!venta) {
    throw new Error('Venta no encontrada');
  }

  if (venta.estado === 'ANULADA') {
    throw new Error('No se pueden generar remitos para una venta anulada');
  }

  // Validar cantidades a entregar
  const itemsMap = new Map(venta.items.map((i) => [i.id, i]));
  const itemsParaEntregar: {
    ventaItem: typeof venta.items[0];
    cantidadAEntregar: number;
  }[] = [];

  for (const it of items) {
    const vItem = itemsMap.get(it.ventaItemId);
    if (!vItem) {
      throw new Error(`El ítem ${it.ventaItemId} no pertenece a esta venta`);
    }

    const cantPendiente = Math.max(0, vItem.cantidad - (vItem.cantidadEntregada || 0) - (vItem.cantidadCancelada || 0));
    const cantAEntregar = Math.round(Number(it.cantidad) * 1000) / 1000;

    if (cantAEntregar <= 0) {
      continue;
    }

    if (cantAEntregar > cantPendiente + 0.001) {
      throw new Error(
        `La cantidad a entregar (${cantAEntregar}) para "${vItem.descripcion}" supera la cantidad pendiente (${cantPendiente})`
      );
    }

    itemsParaEntregar.push({
      ventaItem: vItem,
      cantidadAEntregar: cantAEntregar,
    });
  }

  if (itemsParaEntregar.length === 0) {
    throw new Error('No se seleccionaron cantidades válidas para entregar');
  }

  // Ejecutar transacción
  const remitoCreado = await prisma.$transaction(async (tx) => {
    const numero = await generarNumeroRemito(tx);

    const remito = await tx.remitoEntrega.create({
      data: {
        numero,
        ventaId: venta.id,
        clienteNombre: venta.clienteNombre,
        clienteIdentificacion: venta.clienteIdentificacion,
        clienteDireccion: venta.clienteDireccion,
        clienteTelefono: venta.clienteTelefono,
        vendedorNombre: input.vendedorNombre || usuarioNombre || venta.vendedorNombre || 'Ventas HDB',
        receptorNombre: receptorNombre?.trim() || venta.clienteNombre,
        receptorDni: receptorDni?.trim() || venta.clienteIdentificacion,
        observaciones: observaciones?.trim() || null,
        items: {
          create: itemsParaEntregar.map((it) => ({
            ventaItemId: it.ventaItem.id,
            sku: it.ventaItem.sku,
            descripcion: it.ventaItem.descripcion,
            unidad: it.ventaItem.unidad,
            cantidad: it.cantidadAEntregar,
          })),
        },
      },
      include: {
        items: true,
        venta: {
          include: {
            items: true,
          },
        },
      },
    });

    // Actualizar cantidadEntregada en cada VentaItem
    for (const it of itemsParaEntregar) {
      await tx.ventaItem.update({
        where: { id: it.ventaItem.id },
        data: {
          cantidadEntregada: {
            increment: it.cantidadAEntregar,
          },
        },
      });
    }

    // Recalcular estadoEntrega de la Venta
    const allItemsUpdated = await tx.ventaItem.findMany({
      where: { ventaId: venta.id },
    });

    let totalPendiente = 0;
    let totalEntregado = 0;

    for (const i of allItemsUpdated) {
      const pendiente = Math.max(0, i.cantidad - (i.cantidadEntregada || 0) - (i.cantidadCancelada || 0));
      totalPendiente += pendiente;
      totalEntregado += (i.cantidadEntregada || 0);
    }

    let nuevoEstadoEntrega = 'PENDIENTE';
    if (totalPendiente <= 0.001) {
      nuevoEstadoEntrega = 'ENTREGADO';
    } else if (totalEntregado > 0) {
      nuevoEstadoEntrega = 'PARCIAL';
    }

    await tx.venta.update({
      where: { id: venta.id },
      data: {
        estadoEntrega: nuevoEstadoEntrega,
      },
    });

    return remito;
  });

  return remitoCreado;
}

/**
 * Cancela ítems pendientes de entrega de una venta
 */
export async function cancelarPendientesVenta(
  ventaId: string,
  itemsParaCancelar?: { ventaItemId: string; cantidadACancelar?: number }[],
  motivo?: string
) {
  const venta = await prisma.venta.findUnique({
    where: { id: ventaId },
    include: { items: true },
  });

  if (!venta) {
    throw new Error('Venta no encontrada');
  }

  if (venta.estado === 'ANULADA') {
    throw new Error('La venta ya se encuentra anulada');
  }

  await prisma.$transaction(async (tx) => {
    for (const item of venta.items) {
      const match = itemsParaCancelar?.find((p) => p.ventaItemId === item.id);
      const pendiente = Math.max(0, item.cantidad - (item.cantidadEntregada || 0) - (item.cantidadCancelada || 0));

      if (pendiente <= 0) continue;

      let aCancelar = pendiente;
      if (match && typeof match.cantidadACancelar === 'number' && match.cantidadACancelar > 0) {
        aCancelar = Math.min(pendiente, match.cantidadACancelar);
      } else if (itemsParaCancelar && itemsParaCancelar.length > 0 && !match) {
        continue;
      }

      await tx.ventaItem.update({
        where: { id: item.id },
        data: {
          cantidadCancelada: {
            increment: aCancelar,
          },
        },
      });
    }

    // Recalcular estadoEntrega
    const allItems = await tx.ventaItem.findMany({
      where: { ventaId: venta.id },
    });

    let totalPendiente = 0;
    let totalEntregado = 0;
    for (const i of allItems) {
      const rem = Math.max(0, i.cantidad - (i.cantidadEntregada || 0) - (i.cantidadCancelada || 0));
      totalPendiente += rem;
      totalEntregado += (i.cantidadEntregada || 0);
    }

    let nuevoEstado = 'PENDIENTE';
    if (totalPendiente <= 0.001) {
      nuevoEstado = totalEntregado > 0 ? 'ENTREGADO' : 'CANCELADO';
    } else if (totalEntregado > 0) {
      nuevoEstado = 'PARCIAL';
    }

    await tx.venta.update({
      where: { id: venta.id },
      data: { estadoEntrega: nuevoEstado },
    });
  });

  return prisma.venta.findUnique({
    where: { id: ventaId },
    include: { items: true, remitos: { include: { items: true } } },
  });
}

