import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { calcularTotalesVenta } from '@/lib/ventas/pdvService';

let cotizacionTablesPromise: Promise<void> | null = null;

/**
 * Garantiza de forma aditiva e idempotente que las tablas de Cotizaciones existan en PostgreSQL
 * sin alterar ni borrar ninguna tabla existente.
 */
export async function ensureCotizacionTables(): Promise<void> {
  if (!cotizacionTablesPromise) {
    cotizacionTablesPromise = (async () => {
      try {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "CotizacionCounter" (
            "year" INTEGER NOT NULL,
            "currentNumber" INTEGER NOT NULL DEFAULT 0,
            CONSTRAINT "CotizacionCounter_pkey" PRIMARY KEY ("year")
          );
        `);

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "Cotizacion" (
            "id" TEXT NOT NULL,
            "numero" TEXT NOT NULL,
            "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "validezDias" INTEGER NOT NULL DEFAULT 15,
            "fechaVencimiento" TIMESTAMP(3),
            "clienteId" TEXT,
            "clienteNombre" TEXT NOT NULL,
            "clienteIdentificacion" TEXT,
            "clienteDireccion" TEXT,
            "clienteTelefono" TEXT,
            "clienteEmail" TEXT,
            "listaPrecioId" TEXT,
            "listaPrecioNombre" TEXT NOT NULL DEFAULT 'Lista General',
            "ivaDiscriminado" BOOLEAN NOT NULL DEFAULT false,
            "vendedorId" TEXT,
            "vendedorNombre" TEXT,
            "condicionPago" TEXT,
            "plazoEntrega" TEXT,
            "referenciaObra" TEXT,
            "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "descuentoPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "descuentoMonto" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "recargoPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "recargoMonto" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "impuestosMonto" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "estado" TEXT NOT NULL DEFAULT 'VIGENTE',
            "ventaId" TEXT,
            "ventaNumero" TEXT,
            "observaciones" TEXT,
            "notasInternas" TEXT,
            "motivoAnulacion" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "Cotizacion_pkey" PRIMARY KEY ("id")
          );
        `);

        await prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "Cotizacion_numero_key" ON "Cotizacion"("numero");
        `);
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "Cotizacion_fecha_idx" ON "Cotizacion"("fecha");
        `);
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "Cotizacion_clienteId_idx" ON "Cotizacion"("clienteId");
        `);
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "Cotizacion_estado_idx" ON "Cotizacion"("estado");
        `);

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "CotizacionItem" (
            "id" TEXT NOT NULL,
            "cotizacionId" TEXT NOT NULL,
            "productoId" TEXT,
            "sku" TEXT NOT NULL,
            "descripcion" TEXT NOT NULL,
            "marca" TEXT,
            "unidad" TEXT,
            "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 1,
            "precioOriginal" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "precioUnitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "descuentoPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "descuentoMonto" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "ivaPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 21,
            "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "precioModificado" BOOLEAN NOT NULL DEFAULT false,
            "motivoModificacion" TEXT,
            "esManual" BOOLEAN NOT NULL DEFAULT false,
            "orden" INTEGER NOT NULL DEFAULT 0,
            CONSTRAINT "CotizacionItem_pkey" PRIMARY KEY ("id"),
            CONSTRAINT "CotizacionItem_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE
          );
        `);

        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "CotizacionItem_cotizacionId_idx" ON "CotizacionItem"("cotizacionId");
        `);
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "CotizacionItem_productoId_idx" ON "CotizacionItem"("productoId");
        `);
      } catch (err) {
        console.error('Error asegurando tablas de Cotizaciones:', err);
        cotizacionTablesPromise = null;
        throw err;
      }
    })();
  }
  return cotizacionTablesPromise;
}

export interface ItemCotizacionInput {
  productoId?: string | null;
  sku: string;
  descripcion: string;
  marca?: string | null;
  unidad?: string | null;
  cantidad: number;
  precioOriginal: number;
  precioUnitario: number;
  descuentoPorcentaje?: number;
  descuentoMonto?: number;
  ivaPorcentaje?: number;
  precioModificado?: boolean;
  motivoModificacion?: string | null;
  esManual?: boolean;
}

export interface GuardarCotizacionInput {
  cotizacionId?: string | null; // Si se especifica, actualiza la cotización existente
  clienteId?: string | null;
  clienteNombre?: string | null;
  clienteIdentificacion?: string | null;
  clienteDireccion?: string | null;
  clienteTelefono?: string | null;
  clienteEmail?: string | null;
  listaPrecioId?: string | null;
  ivaDiscriminado?: boolean;
  vendedorId?: string | null;
  vendedorNombre?: string | null;
  validezDias?: number;
  condicionPago?: string | null;
  plazoEntrega?: string | null;
  referenciaObra?: string | null;
  descuentoPorcentaje?: number;
  recargoPorcentaje?: number;
  observaciones?: string | null;
  notasInternas?: string | null;
  items: ItemCotizacionInput[];
}

export async function generarNumeroCotizacion(tx: any, year?: number): Promise<string> {
  const currentYear = year || new Date().getFullYear();

  const counter = await tx.cotizacionCounter.upsert({
    where: { year: currentYear },
    update: { currentNumber: { increment: 1 } },
    create: { year: currentYear, currentNumber: 1 },
  });

  const seq = String(counter.currentNumber).padStart(6, '0');
  return `COT-${currentYear}-${seq}`;
}

/**
 * Crea o actualiza una Cotización comercial de forma transaccional
 */
export async function guardarCotizacion(input: GuardarCotizacionInput, userId?: string) {
  await ensureCotizacionTables();

  if (!input.items || input.items.length === 0) {
    throw new Error('La cotización debe incluir al menos un ítem');
  }

  for (const item of input.items) {
    if (!item.descripcion || !item.descripcion.trim()) {
      throw new Error('Todos los ítems deben tener descripción');
    }
    if ((Number(item.cantidad) || 0) <= 0) {
      throw new Error(`Cantidad inválida para el ítem "${item.descripcion}"`);
    }
    if ((Number(item.precioUnitario) || 0) < 0) {
      throw new Error(`Precio unitario inválido para el ítem "${item.descripcion}"`);
    }
  }

  // Lista de precios
  let listaPrecioNombre = 'Lista General';
  let ivaDiscriminado = Boolean(input.ivaDiscriminado);
  let listaDb = null;
  if (input.listaPrecioId) {
    listaDb = await prisma.listaPrecio.findUnique({
      where: { id: input.listaPrecioId },
    });
  }
  if (!listaDb) {
    listaDb = await prisma.listaPrecio.findFirst({
      where: { esPredeterminada: true, activo: true },
    });
  }
  if (!listaDb) {
    listaDb = await prisma.listaPrecio.findFirst({
      where: { activo: true },
      orderBy: { orden: 'asc' },
    });
  }
  if (listaDb) {
    listaPrecioNombre = listaDb.nombre;
    if (input.ivaDiscriminado === undefined) {
      ivaDiscriminado = Boolean(listaDb.ivaDiscriminado);
    }
  }

  // Cliente
  let clienteId: string | null = null;
  let clienteNombre = input.clienteNombre?.trim() || 'Consumidor Final / A quien corresponda';
  let clienteIdentificacion = input.clienteIdentificacion?.trim() || null;
  let clienteDireccion = input.clienteDireccion?.trim() || null;
  let clienteTelefono = input.clienteTelefono?.trim() || null;
  let clienteEmail = input.clienteEmail?.trim() || null;

  if (input.clienteId) {
    const cliDb = await prisma.hdbClient.findUnique({
      where: { id: input.clienteId },
    });
    if (cliDb) {
      clienteId = cliDb.id;
      clienteNombre = input.clienteNombre?.trim() || cliDb.nombre;
      clienteDireccion = clienteDireccion || cliDb.direccion || null;
      clienteTelefono = clienteTelefono || cliDb.telefono || null;
      clienteEmail = clienteEmail || cliDb.email || null;
    }
  }

  // Vendedor
  let validVendedorId: string | null = null;
  let vendedorNombre = input.vendedorNombre?.trim() || null;
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

  // Validar productos de catálogo existentes para evitar errores de FK si alguno fue eliminado
  const catalogIds = input.items
    .map((i) => i.productoId)
    .filter((id): id is string => Boolean(id));
  const existingProds =
    catalogIds.length > 0
      ? await prisma.producto.findMany({
          where: { id: { in: catalogIds } },
          select: { id: true },
        })
      : [];
  const validProdSet = new Set(existingProds.map((p) => p.id));

  // Calcular totales
  const calculo = calcularTotalesVenta(
    input.items.map((it) => ({
      productoId: it.productoId || 'manual',
      sku: it.sku || '999999',
      descripcion: it.descripcion.trim(),
      unidad: it.unidad || 'UNID',
      cantidad: Number(it.cantidad) || 1,
      precioOriginal: Number(it.precioOriginal) || Number(it.precioUnitario) || 0,
      precioUnitario: Number(it.precioUnitario) || 0,
      descuentoPorcentaje: Number(it.descuentoPorcentaje) || 0,
      descuentoMonto: Number(it.descuentoMonto) || 0,
      ivaPorcentaje: it.ivaPorcentaje ?? 21,
      precioModificado: Boolean(it.precioModificado),
      motivoModificacion: it.motivoModificacion || null,
    })),
    input.descuentoPorcentaje || 0,
    input.recargoPorcentaje || 0,
    { ivaDiscriminado }
  );

  const validezDias = Math.max(1, Math.min(365, Math.round(Number(input.validezDias) || 15)));
  const fechaEmision = new Date();
  const fechaVencimiento = new Date(fechaEmision);
  fechaVencimiento.setDate(fechaVencimiento.getDate() + validezDias);

  const resultado = await prisma.$transaction(
    async (tx) => {
      if (input.cotizacionId) {
        const existente = await tx.cotizacion.findUnique({
          where: { id: input.cotizacionId },
        });
        if (!existente) {
          throw new Error('La cotización que intenta editar no existe');
        }
        if (existente.estado === 'ANULADA' || existente.estado === 'CONVERTIDA') {
          throw new Error(
            `No se puede modificar una cotización en estado ${existente.estado}. Puede duplicarla como una nueva cotización.`
          );
        }

        const fBase = new Date(existente.fecha);
        const fVenc = new Date(fBase);
        fVenc.setDate(fVenc.getDate() + validezDias);

        await tx.cotizacionItem.deleteMany({
          where: { cotizacionId: existente.id },
        });

        const actualizada = await tx.cotizacion.update({
          where: { id: existente.id },
          data: {
            validezDias,
            fechaVencimiento: fVenc,
            clienteId,
            clienteNombre,
            clienteIdentificacion,
            clienteDireccion,
            clienteTelefono,
            clienteEmail,
            listaPrecioId: listaDb?.id || input.listaPrecioId || null,
            listaPrecioNombre: listaDb?.nombre || listaPrecioNombre,
            ivaDiscriminado,
            vendedorId: validVendedorId,
            vendedorNombre,
            condicionPago: input.condicionPago?.trim() || 'Contado / Transferencia',
            plazoEntrega: input.plazoEntrega?.trim() || 'Inmediata (según disponibilidad)',
            referenciaObra: input.referenciaObra?.trim() || null,
            subtotal: calculo.subtotal,
            descuentoPorcentaje: calculo.descuentoPorcentaje,
            descuentoMonto: calculo.descuentoMonto,
            recargoPorcentaje: calculo.recargoPorcentaje,
            recargoMonto: calculo.recargoMonto,
            impuestosMonto: calculo.impuestosMonto,
            total: calculo.total,
            observaciones: input.observaciones?.trim() || null,
            notasInternas: input.notasInternas?.trim() || null,
            items: {
              create: calculo.items.map((it, idx) => {
                const rawItem = input.items[idx];
                const prodId =
                  rawItem.productoId && validProdSet.has(rawItem.productoId)
                    ? rawItem.productoId
                    : null;
                return {
                  productoId: prodId,
                  sku: it.sku || '999999',
                  descripcion: it.descripcion,
                  marca: rawItem.marca || null,
                  unidad: it.unidad || 'UNID',
                  cantidad: it.cantidad,
                  precioOriginal: it.precioOriginal,
                  precioUnitario: it.precioUnitario,
                  descuentoPorcentaje: it.descuentoPorcentaje,
                  descuentoMonto: it.descuentoMonto,
                  ivaPorcentaje: it.ivaPorcentaje,
                  subtotal: it.subtotal,
                  precioModificado: it.precioModificado || false,
                  motivoModificacion: it.motivoModificacion || null,
                  esManual: Boolean(rawItem.esManual || !prodId),
                  orden: idx + 1,
                };
              }),
            },
          },
          include: {
            items: {
              orderBy: { orden: 'asc' },
            },
            cliente: true,
            listaPrecio: true,
          },
        });

        return actualizada;
      }

      // Crear nueva cotización
      const numero = await generarNumeroCotizacion(tx);

      const creada = await tx.cotizacion.create({
        data: {
          numero,
          fecha: fechaEmision,
          validezDias,
          fechaVencimiento,
          clienteId,
          clienteNombre,
          clienteIdentificacion,
          clienteDireccion,
          clienteTelefono,
          clienteEmail,
          listaPrecioId: listaDb?.id || input.listaPrecioId || null,
          listaPrecioNombre: listaDb?.nombre || listaPrecioNombre,
          ivaDiscriminado,
          vendedorId: validVendedorId,
          vendedorNombre,
          condicionPago: input.condicionPago?.trim() || 'Contado / Transferencia',
          plazoEntrega: input.plazoEntrega?.trim() || 'Inmediata (según disponibilidad)',
          referenciaObra: input.referenciaObra?.trim() || null,
          subtotal: calculo.subtotal,
          descuentoPorcentaje: calculo.descuentoPorcentaje,
          descuentoMonto: calculo.descuentoMonto,
          recargoPorcentaje: calculo.recargoPorcentaje,
          recargoMonto: calculo.recargoMonto,
          impuestosMonto: calculo.impuestosMonto,
          total: calculo.total,
          estado: 'VIGENTE',
          observaciones: input.observaciones?.trim() || null,
          notasInternas: input.notasInternas?.trim() || null,
          items: {
            create: calculo.items.map((it, idx) => {
              const rawItem = input.items[idx];
              const prodId =
                rawItem.productoId && validProdSet.has(rawItem.productoId)
                  ? rawItem.productoId
                  : null;
              return {
                productoId: prodId,
                sku: it.sku || '999999',
                descripcion: it.descripcion,
                marca: rawItem.marca || null,
                unidad: it.unidad || 'UNID',
                cantidad: it.cantidad,
                precioOriginal: it.precioOriginal,
                precioUnitario: it.precioUnitario,
                descuentoPorcentaje: it.descuentoPorcentaje,
                descuentoMonto: it.descuentoMonto,
                ivaPorcentaje: it.ivaPorcentaje,
                subtotal: it.subtotal,
                precioModificado: it.precioModificado || false,
                motivoModificacion: it.motivoModificacion || null,
                esManual: Boolean(rawItem.esManual || !prodId),
                orden: idx + 1,
              };
            }),
          },
        },
        include: {
          items: {
            orderBy: { orden: 'asc' },
          },
          cliente: true,
          listaPrecio: true,
        },
      });

      return creada;
    },
    {
      maxWait: 15000,
      timeout: 30000,
    }
  );

  await logAudit({
    userId: validVendedorId || userId || undefined,
    userName: vendedorNombre || undefined,
    action: input.cotizacionId ? 'UPDATE' : 'CREATE',
    entity: 'COTIZACION',
    entityId: resultado.id,
    newValue: {
      numero: resultado.numero,
      cliente: resultado.clienteNombre,
      total: resultado.total,
      itemsCount: resultado.items.length,
      validezDias: resultado.validezDias,
    },
  });

  return resultado;
}

/**
 * Lista las cotizaciones con filtros y paginación
 */
export async function listarCotizaciones(filtros?: {
  q?: string;
  estado?: string;
  clienteId?: string;
  vendedorId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  page?: number;
  limit?: number;
}) {
  await ensureCotizacionTables();

  const page = Math.max(1, filtros?.page || 1);
  const limit = Math.min(100, Math.max(1, filtros?.limit || 20));
  const search = filtros?.q?.trim() || '';

  const where: any = {};

  if (filtros?.estado) {
    where.estado = filtros.estado;
  }
  if (filtros?.clienteId) {
    where.clienteId = filtros.clienteId;
  }
  if (filtros?.vendedorId) {
    where.vendedorId = filtros.vendedorId;
  }

  if (filtros?.fechaDesde || filtros?.fechaHasta) {
    where.fecha = {};
    if (filtros.fechaDesde) where.fecha.gte = new Date(filtros.fechaDesde);
    if (filtros.fechaHasta) {
      const hasta = new Date(filtros.fechaHasta);
      hasta.setHours(23, 59, 59, 999);
      where.fecha.lte = hasta;
    }
  }

  if (search) {
    where.OR = [
      { numero: { contains: search, mode: 'insensitive' } },
      { clienteNombre: { contains: search, mode: 'insensitive' } },
      { clienteIdentificacion: { contains: search, mode: 'insensitive' } },
      { referenciaObra: { contains: search, mode: 'insensitive' } },
      { vendedorNombre: { contains: search, mode: 'insensitive' } },
      { items: { some: { descripcion: { contains: search, mode: 'insensitive' } } } },
      { items: { some: { sku: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  const [total, cotizaciones] = await Promise.all([
    prisma.cotizacion.count({ where }),
    prisma.cotizacion.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        items: {
          orderBy: { orden: 'asc' },
        },
        cliente: {
          select: { id: true, nombre: true, email: true, telefono: true, direccion: true },
        },
        listaPrecio: {
          select: { id: true, nombre: true, codigo: true, ivaDiscriminado: true },
        },
      },
    }),
  ]);

  const hoy = new Date();
  const cotizacionesEnriquecidas = cotizaciones.map((c) => {
    const vencidaPorFecha =
      c.estado === 'VIGENTE' && c.fechaVencimiento && new Date(c.fechaVencimiento) < hoy;
    return {
      ...c,
      estaVencida: Boolean(vencidaPorFecha || c.estado === 'VENCIDA'),
    };
  });

  return {
    cotizaciones: cotizacionesEnriquecidas,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Obtiene una cotización por ID con todos sus ítems
 */
export async function obtenerCotizacionPorId(id: string) {
  await ensureCotizacionTables();

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { orden: 'asc' },
      },
      cliente: true,
      listaPrecio: true,
      vendedor: {
        select: { id: true, nombreCompleto: true, role: true },
      },
    },
  });

  if (!cotizacion) {
    throw new Error('Cotización no encontrada');
  }

  return cotizacion;
}

/**
 * Cambia el estado de una cotización (VIGENTE | APROBADA | RECHAZADA | ANULADA | CONVERTIDA)
 */
export async function cambiarEstadoCotizacion(
  id: string,
  nuevoEstado: 'VIGENTE' | 'APROBADA' | 'RECHAZADA' | 'ANULADA' | 'CONVERTIDA',
  opciones?: {
    motivo?: string | null;
    ventaId?: string | null;
    ventaNumero?: string | null;
    usuarioId?: string;
    usuarioNombre?: string;
  }
) {
  await ensureCotizacionTables();

  const cot = await prisma.cotizacion.findUnique({ where: { id } });
  if (!cot) {
    throw new Error('Cotización no encontrada');
  }

  if (nuevoEstado === 'ANULADA' && (!opciones?.motivo || opciones.motivo.trim().length < 3)) {
    throw new Error('Debe ingresar un motivo válido para anular la cotización');
  }

  const actualizada = await prisma.cotizacion.update({
    where: { id },
    data: {
      estado: nuevoEstado,
      motivoAnulacion:
        nuevoEstado === 'ANULADA' || nuevoEstado === 'RECHAZADA'
          ? opciones?.motivo?.trim() || cot.motivoAnulacion
          : cot.motivoAnulacion,
      ventaId: opciones?.ventaId ?? cot.ventaId,
      ventaNumero: opciones?.ventaNumero ?? cot.ventaNumero,
    },
    include: {
      items: {
        orderBy: { orden: 'asc' },
      },
      cliente: true,
      listaPrecio: true,
    },
  });

  await logAudit({
    userId: opciones?.usuarioId,
    userName: opciones?.usuarioNombre,
    action: 'UPDATE',
    entity: 'COTIZACION',
    entityId: id,
    oldValue: { estado: cot.estado },
    newValue: {
      estado: nuevoEstado,
      motivo: opciones?.motivo || null,
      ventaNumero: actualizada.ventaNumero,
    },
  });

  return actualizada;
}
