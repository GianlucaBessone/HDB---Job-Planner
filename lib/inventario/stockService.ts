import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getNextInventarioNumero } from './counter';
import {
  calcularEstadoStock,
  redondearCantidad,
  ModoAjuste,
  TipoMovimientoStock,
  TipoOperacionStock,
  EstadoStock,
} from './types';
import { logAudit } from '@/lib/audit';

export interface AjusteItemInput {
  productoId: string;
  cantidad: number; // En DIFERENCIA: delta (+/-). En EXISTENCIA_REAL: conteo físico absoluto.
  almacenId?: string;
  ubicacionId?: string | null;
  motivo?: string;
  observaciones?: string;
}

export interface RegistrarAjusteParams {
  almacenId: string;
  modoAjuste: ModoAjuste;
  motivoGeneral: string;
  observaciones?: string;
  items: AjusteItemInput[];
  usuarioId?: string;
  usuarioNombre?: string;
  userRole?: string;
  idempotencyKey?: string;
}

export interface TransferenciaItemInput {
  productoId: string;
  cantidad: number;
  ubicacionOrigenId?: string | null;
  ubicacionDestinoId?: string | null;
  observaciones?: string;
}

export interface RegistrarTransferenciaParams {
  almacenOrigenId: string;
  almacenDestinoId: string;
  motivo: string;
  observaciones?: string;
  items: TransferenciaItemInput[];
  usuarioId?: string;
  usuarioNombre?: string;
  userRole?: string;
  idempotencyKey?: string;
}

export class StockService {
  /**
   * Valida si la empresa o el usuario autorizan stock negativo.
   */
  private static async validarPermisoStockNegativo(
    tx: Prisma.TransactionClient,
    userRole?: string
  ): Promise<boolean> {
    const setting = await tx.systemSetting.findUnique({
      where: { id: 'default' },
      select: { inventarioPermiteNegativo: true },
    });

    const flagHabilitado = setting?.inventarioPermiteNegativo ?? false;
    const esAdmin = (userRole || '').toLowerCase() === 'admin';

    return flagHabilitado && esAdmin;
  }

  /**
   * Ajuste rápido de stock (soporta uno o múltiples productos atómicamente).
   * Admite modo 'DIFERENCIA' o 'EXISTENCIA_REAL'.
   * Bloquea filas con FOR UPDATE para prevenir condiciones de carrera.
   * Maneja idempotencia estricta en DB.
   */
  static async registrarAjuste(params: RegistrarAjusteParams) {
    const {
      almacenId,
      modoAjuste,
      motivoGeneral,
      observaciones,
      items,
      usuarioId,
      usuarioNombre,
      userRole,
      idempotencyKey,
    } = params;

    if (!items || items.length === 0) {
      throw new Error('Debe especificar al menos un producto para ajustar');
    }

    if (!motivoGeneral || motivoGeneral.trim() === '') {
      throw new Error('El motivo o justificación de auditoría es obligatorio');
    }

    // Deduplicar productos para evitar colisiones en la misma transacción
    const uniqueMap = new Map<string, AjusteItemInput>();
    for (const item of items) {
      if (uniqueMap.has(item.productoId)) {
        throw new Error(`El producto con ID "${item.productoId}" está repetido en la solicitud de ajuste.`);
      }
      uniqueMap.set(item.productoId, item);
    }

    return await prisma.$transaction(
      async (tx) => {
        // 1. Control de Idempotencia estricto
        if (idempotencyKey) {
          const operacionExistente = await tx.stockOperacion.findUnique({
            where: { idempotencyKey },
            include: {
              movimientos: {
                include: {
                  producto: { select: { id: true, sku: true, descripcion: true } },
                  almacen: { select: { id: true, nombre: true } },
                },
              },
            },
          });
          if (operacionExistente) {
            return {
              operacion: operacionExistente,
              esReintento: true,
              mensaje: `Operación ya registrada previamente (${operacionExistente.numero})`,
            };
          }
        }

        // 2. Validar almacén
        const almacen = await tx.almacen.findUnique({
          where: { id: almacenId },
        });
        if (!almacen || !almacen.activo) {
          throw new Error('Almacén no encontrado o inactivo');
        }

        const puedeStockNegativo = await this.validarPermisoStockNegativo(tx, userRole);

        // 3. Obtener productos y unidades para validar decimales
        const prodIds = Array.from(uniqueMap.keys()).sort(); // Orden lexicográfico para evitar deadlocks
        const productosDb = await tx.producto.findMany({
          where: { id: { in: prodIds } },
          include: { unidad: true },
        });

        if (productosDb.length !== prodIds.length) {
          throw new Error('Uno o más productos no existen en el catálogo');
        }
        const prodMap = new Map(productosDb.map((p) => [p.id, p]));

        // 4. Bloquear y leer los saldos de ProductoStock con SELECT FOR UPDATE
        // Si no existe fila en ProductoStock para ese almacén, se creará
        for (const pId of prodIds) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "ProductoStock" ("id", "productoId", "almacenId", "stockActual", "stockMinimo", "stockMaximo", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, 0, 0, 0, NOW())
             ON CONFLICT ("productoId", "almacenId") DO NOTHING`,
            pId,
            almacenId
          );
        }

        // Bloqueo pesimista ordenado
        const lockedStocksRaw: Array<{ id: string; productoId: string; stockActual: number; ubicacionId: string | null }> =
          await tx.$queryRawUnsafe(
            `SELECT "id", "productoId", "stockActual", "ubicacionId"
             FROM "ProductoStock"
             WHERE "almacenId" = $1 AND "productoId" = ANY($2::text[])
             ORDER BY "productoId" ASC
             FOR UPDATE`,
            almacenId,
            prodIds
          );

        const stockMap = new Map(lockedStocksRaw.map((s) => [s.productoId, s]));

        // 5. Generar número de Operación atómico
        const numeroOperacion = await getNextInventarioNumero(tx, 'OPI');

        const operacion = await tx.stockOperacion.create({
          data: {
            numero: numeroOperacion,
            tipo: 'AJUSTE',
            almacenId,
            modoAjuste,
            motivo: motivoGeneral.trim(),
            observaciones: observaciones?.trim() || null,
            referenciaTipo: 'AJUSTE',
            idempotencyKey: idempotencyKey || null,
            totalLineas: prodIds.length,
            usuarioId,
            usuarioNombre,
          },
        });

        const movimientosCreados = [];
        const now = new Date();

        // 6. Procesar cada producto
        for (const pId of prodIds) {
          const itemInput = uniqueMap.get(pId)!;
          const prod = prodMap.get(pId)!;
          const currentStockRow = stockMap.get(pId)!;
          const stockAnterior = Number(currentStockRow.stockActual) || 0;

          const maxDecimales = prod.unidad?.decimales ?? 4;
          const cantIngresada = redondearCantidad(Number(itemInput.cantidad) || 0, maxDecimales);

          let stockPosterior: number;
          let delta: number;

          if (modoAjuste === 'DIFERENCIA') {
            delta = cantIngresada;
            stockPosterior = redondearCantidad(stockAnterior + delta, maxDecimales);
          } else {
            // EXISTENCIA_REAL
            if (cantIngresada < 0) {
              throw new Error(
                `La existencia física para "${prod.sku}" no puede ser un número negativo (${cantIngresada}).`
              );
            }
            stockPosterior = cantIngresada;
            delta = redondearCantidad(stockPosterior - stockAnterior, maxDecimales);
          }

          if (stockPosterior < 0 && !puedeStockNegativo) {
            throw new Error(
              `Operación bloqueada: El ajuste para el producto "${prod.sku} — ${prod.descripcion}" resultaría en un stock negativo (${stockPosterior} unidades). Stock actual en ${almacen.nombre}: ${stockAnterior}.`
            );
          }

          // Si delta es 0, no hay variación que registrar
          if (delta === 0) {
            continue;
          }

          const tipoMovimiento: TipoMovimientoStock = delta > 0 ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO';
          const numeroMovimiento = await getNextInventarioNumero(tx, 'MOV', now);

          // Actualizar saldo en ProductoStock
          await tx.productoStock.update({
            where: { id: currentStockRow.id },
            data: {
              stockActual: stockPosterior,
              ultimoMovimientoAt: now,
              ubicacionId: itemInput.ubicacionId || currentStockRow.ubicacionId,
            },
          });

          // Registrar movimiento inmutable
          const mov = await tx.productoStockMovimiento.create({
            data: {
              numero: numeroMovimiento,
              operacionId: operacion.id,
              productoId: pId,
              almacenId,
              ubicacionId: itemInput.ubicacionId || currentStockRow.ubicacionId,
              tipo: tipoMovimiento,
              cantidad: Math.abs(delta),
              variacion: delta,
              stockAnterior,
              stockPosterior,
              motivo: itemInput.motivo || motivoGeneral.trim(),
              observaciones: itemInput.observaciones || null,
              referenciaTipo: 'AJUSTE',
              referenciaId: operacion.id,
              referencia: operacion.numero,
              estado: 'CONFIRMADO',
              usuarioId,
              usuarioNombre,
              createdAt: now,
            },
          });

          movimientosCreados.push(mov);

          // Registrar en historial del producto
          await tx.productoHistorial.create({
            data: {
              productoId: pId,
              tipo: 'AJUSTE_STOCK',
              campo: 'stockActual',
              valorAnterior: String(stockAnterior),
              valorNuevo: String(stockPosterior),
              origen: 'AJUSTE_STOCK',
              detalles: {
                operacionNumero: operacion.numero,
                movimientoNumero: numeroMovimiento,
                modoAjuste,
                delta,
                almacen: almacen.nombre,
                motivo: itemInput.motivo || motivoGeneral.trim(),
              },
              usuarioId,
              usuarioNombre,
            },
          });
        }

        return {
          operacion,
          movimientos: movimientosCreados,
          esReintento: false,
          mensaje: `Ajuste ${operacion.numero} registrado exitosamente (${movimientosCreados.length} líneas actualizadas).`,
        };
      },
      { maxWait: 15000, timeout: 30000 }
    );
  }

  /**
   * Transferencia atómica entre almacenes.
   * Origen disminuye en cantidad, destino aumenta en cantidad.
   * Stock total neto de la empresa permanece invariante (+0).
   */
  static async registrarTransferencia(params: RegistrarTransferenciaParams) {
    const {
      almacenOrigenId,
      almacenDestinoId,
      motivo,
      observaciones,
      items,
      usuarioId,
      usuarioNombre,
      userRole,
      idempotencyKey,
    } = params;

    if (almacenOrigenId === almacenDestinoId) {
      throw new Error('El almacén de origen y de destino no pueden ser el mismo');
    }

    if (!items || items.length === 0) {
      throw new Error('Debe especificar al menos un producto a transferir');
    }

    return await prisma.$transaction(
      async (tx) => {
        // Idempotencia
        if (idempotencyKey) {
          const opExistente = await tx.stockOperacion.findUnique({
            where: { idempotencyKey },
            include: {
              movimientos: true,
            },
          });
          if (opExistente) {
            return {
              operacion: opExistente,
              esReintento: true,
              mensaje: `Transferencia ya registrada previamente (${opExistente.numero})`,
            };
          }
        }

        const [almOrigen, almDestino] = await Promise.all([
          tx.almacen.findUnique({ where: { id: almacenOrigenId } }),
          tx.almacen.findUnique({ where: { id: almacenDestinoId } }),
        ]);

        if (!almOrigen?.activo || !almDestino?.activo) {
          throw new Error('Uno o ambos almacenes no existen o están inactivos');
        }

        const puedeStockNegativo = await this.validarPermisoStockNegativo(tx, userRole);
        const prodIds = Array.from(new Set(items.map((i) => i.productoId))).sort();

        // Asegurar registros en ambos almacenes
        for (const pId of prodIds) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "ProductoStock" ("id", "productoId", "almacenId", "stockActual", "stockMinimo", "stockMaximo", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, 0, 0, 0, NOW())
             ON CONFLICT ("productoId", "almacenId") DO NOTHING`,
            pId,
            almacenOrigenId
          );
          await tx.$executeRawUnsafe(
            `INSERT INTO "ProductoStock" ("id", "productoId", "almacenId", "stockActual", "stockMinimo", "stockMaximo", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, 0, 0, 0, NOW())
             ON CONFLICT ("productoId", "almacenId") DO NOTHING`,
            pId,
            almacenDestinoId
          );
        }

        // Bloqueo pesimista de saldos en ambos almacenes ordenados por producto y almacén
        const lockedStocks: Array<{ id: string; productoId: string; almacenId: string; stockActual: number }> =
          await tx.$queryRawUnsafe(
            `SELECT "id", "productoId", "almacenId", "stockActual"
             FROM "ProductoStock"
             WHERE "almacenId" IN ($1, $2) AND "productoId" = ANY($3::text[])
             ORDER BY "productoId" ASC, "almacenId" ASC
             FOR UPDATE`,
            almacenOrigenId,
            almacenDestinoId,
            prodIds
          );

        const stockMap = new Map<string, { id: string; stockActual: number }>();
        for (const s of lockedStocks) {
          stockMap.set(`${s.productoId}_${s.almacenId}`, { id: s.id, stockActual: Number(s.stockActual) });
        }

        const numeroOperacion = await getNextInventarioNumero(tx, 'OPI');

        const operacion = await tx.stockOperacion.create({
          data: {
            numero: numeroOperacion,
            tipo: 'TRANSFERENCIA',
            almacenId: almacenOrigenId,
            almacenDestinoId,
            motivo: motivo.trim(),
            observaciones: observaciones?.trim() || null,
            referenciaTipo: 'TRANSFERENCIA',
            idempotencyKey: idempotencyKey || null,
            totalLineas: items.length,
            usuarioId,
            usuarioNombre,
          },
        });

        const movimientos = [];
        const now = new Date();

        for (const it of items) {
          const qty = redondearCantidad(Number(it.cantidad) || 0, 4);
          if (qty <= 0) {
            throw new Error(`La cantidad a transferir debe ser mayor a 0`);
          }

          const stockOrigen = stockMap.get(`${it.productoId}_${almacenOrigenId}`)!;
          const stockDestino = stockMap.get(`${it.productoId}_${almacenDestinoId}`)!;

          const nuevoOrigen = redondearCantidad(stockOrigen.stockActual - qty, 4);
          const nuevoDestino = redondearCantidad(stockDestino.stockActual + qty, 4);

          if (nuevoOrigen < 0 && !puedeStockNegativo) {
            throw new Error(
              `Stock insuficiente en almacén de origen "${almOrigen.nombre}" para transferir ${qty} unidades. Stock disponible: ${stockOrigen.stockActual}.`
            );
          }

          // Actualizar saldos
          await tx.productoStock.update({
            where: { id: stockOrigen.id },
            data: { stockActual: nuevoOrigen, ultimoMovimientoAt: now },
          });

          await tx.productoStock.update({
            where: { id: stockDestino.id },
            data: { stockActual: nuevoDestino, ultimoMovimientoAt: now },
          });

          // 1. Movimiento de Salida (Origen)
          const numSalida = await getNextInventarioNumero(tx, 'MOV', now);
          const movSalida = await tx.productoStockMovimiento.create({
            data: {
              numero: numSalida,
              operacionId: operacion.id,
              productoId: it.productoId,
              almacenId: almacenOrigenId,
              ubicacionId: it.ubicacionOrigenId || null,
              almacenOrigenId,
              ubicacionOrigenId: it.ubicacionOrigenId || null,
              almacenDestinoId,
              ubicacionDestinoId: it.ubicacionDestinoId || null,
              tipo: 'TRANSFERENCIA_SALIDA',
              cantidad: qty,
              variacion: -qty,
              stockAnterior: stockOrigen.stockActual,
              stockPosterior: nuevoOrigen,
              motivo: motivo.trim(),
              observaciones: it.observaciones || null,
              referenciaTipo: 'TRANSFERENCIA',
              referenciaId: operacion.id,
              referencia: operacion.numero,
              estado: 'CONFIRMADO',
              usuarioId,
              usuarioNombre,
              createdAt: now,
            },
          });

          // 2. Movimiento de Entrada (Destino)
          const numEntrada = await getNextInventarioNumero(tx, 'MOV', now);
          const movEntrada = await tx.productoStockMovimiento.create({
            data: {
              numero: numEntrada,
              operacionId: operacion.id,
              productoId: it.productoId,
              almacenId: almacenDestinoId,
              ubicacionId: it.ubicacionDestinoId || null,
              almacenOrigenId,
              ubicacionOrigenId: it.ubicacionOrigenId || null,
              almacenDestinoId,
              ubicacionDestinoId: it.ubicacionDestinoId || null,
              tipo: 'TRANSFERENCIA_ENTRADA',
              cantidad: qty,
              variacion: qty,
              stockAnterior: stockDestino.stockActual,
              stockPosterior: nuevoDestino,
              motivo: motivo.trim(),
              observaciones: it.observaciones || null,
              referenciaTipo: 'TRANSFERENCIA',
              referenciaId: operacion.id,
              referencia: operacion.numero,
              estado: 'CONFIRMADO',
              usuarioId,
              usuarioNombre,
              createdAt: now,
            },
          });

          movimientos.push(movSalida, movEntrada);
        }

        return {
          operacion,
          movimientos,
          esReintento: false,
          mensaje: `Transferencia ${operacion.numero} entre ${almOrigen.nombre} y ${almDestino.nombre} completada con éxito.`,
        };
      },
      { maxWait: 15000, timeout: 30000 }
    );
  }

  /**
   * Reversión de un movimiento confirmado.
   * Crea un contra-movimiento de tipo 'REVERSA' vinculado de forma única a reversaDeId.
   */
  static async revertirMovimiento(params: {
    movimientoId: string;
    motivo: string;
    usuarioId?: string;
    usuarioNombre?: string;
    userRole?: string;
  }) {
    const { movimientoId, motivo, usuarioId, usuarioNombre, userRole } = params;

    if (!motivo || motivo.trim() === '') {
      throw new Error('Debe especificar un motivo para la reversión');
    }

    return await prisma.$transaction(async (tx) => {
      const original = await tx.productoStockMovimiento.findUnique({
        where: { id: movimientoId },
        include: { producto: true, almacen: true },
      });

      if (!original) {
        throw new Error('Movimiento no encontrado');
      }

      if (original.reversaDeId) {
        throw new Error('No se puede revertir un movimiento que ya es una reversa');
      }

      const yaRevertido = await tx.productoStockMovimiento.findUnique({
        where: { reversaDeId: original.id },
      });

      if (yaRevertido) {
        throw new Error(`Este movimiento ya fue revertido mediante el comprobante ${yaRevertido.numero}`);
      }

      const puedeStockNegativo = await this.validarPermisoStockNegativo(tx, userRole);

      // Bloquear saldo del producto en el almacén
      const lockedStock: Array<{ id: string; stockActual: number }> = await tx.$queryRawUnsafe(
        `SELECT "id", "stockActual"
         FROM "ProductoStock"
         WHERE "productoId" = $1 AND "almacenId" = $2
         FOR UPDATE`,
        original.productoId,
        original.almacenId
      );

      if (!lockedStock || lockedStock.length === 0) {
        throw new Error('No se encontró el registro de saldo del producto');
      }

      const stockAnterior = Number(lockedStock[0].stockActual);
      // Invertir el efecto del original (si variacion fue +10, la reversa es -10)
      const variacionInversa = -Number(original.variacion);
      const stockPosterior = redondearCantidad(stockAnterior + variacionInversa, 4);

      if (stockPosterior < 0 && !puedeStockNegativo) {
        throw new Error(
          `La reversión dejaría el stock en negativo (${stockPosterior} u.). Operación cancelada.`
        );
      }

      const now = new Date();
      const numOperacion = await getNextInventarioNumero(tx, 'OPI', now);
      const op = await tx.stockOperacion.create({
        data: {
          numero: numOperacion,
          tipo: 'REVERSA',
          almacenId: original.almacenId,
          motivo: `Reversión de ${original.numero}: ${motivo.trim()}`,
          referenciaTipo: 'REVERSA',
          referenciaId: original.id,
          referencia: original.numero,
          totalLineas: 1,
          usuarioId,
          usuarioNombre,
        },
      });

      const numMov = await getNextInventarioNumero(tx, 'MOV', now);

      await tx.productoStock.update({
        where: { id: lockedStock[0].id },
        data: { stockActual: stockPosterior, ultimoMovimientoAt: now },
      });

      const movReversa = await tx.productoStockMovimiento.create({
        data: {
          numero: numMov,
          operacionId: op.id,
          productoId: original.productoId,
          almacenId: original.almacenId,
          ubicacionId: original.ubicacionId,
          tipo: 'REVERSA',
          cantidad: original.cantidad,
          variacion: variacionInversa,
          stockAnterior,
          stockPosterior,
          motivo: `Reversión de ${original.numero}: ${motivo.trim()}`,
          referenciaTipo: 'REVERSA',
          referenciaId: original.id,
          referencia: original.numero,
          reversaDeId: original.id,
          estado: 'CONFIRMADO',
          usuarioId,
          usuarioNombre,
          createdAt: now,
        },
      });

      return {
        operacion: op,
        movimiento: movReversa,
        mensaje: `Movimiento ${original.numero} revertido exitosamente con el comprobante ${movReversa.numero}.`,
      };
    }, { maxWait: 15000, timeout: 30000 });
  }

  /**
   * Consulta paginada y filtrada del maestro de existencias / resumen de stock.
   */
  static async consultarStock(filters: {
    q?: string;
    almacenId?: string;
    ubicacionId?: string;
    categoriaId?: string;
    marcaId?: string;
    familiaId?: string;
    subFamiliaId?: string;
    estadoStock?: EstadoStock | '';
    proveedorId?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(500, Math.max(1, filters.limit || 25));
    const skip = (page - 1) * limit;

    const where: any = { activo: true };

    if (filters.categoriaId) where.categoriaId = filters.categoriaId;
    if (filters.marcaId) where.marcaId = filters.marcaId;
    if (filters.familiaId) where.familiaId = filters.familiaId;
    if (filters.subFamiliaId) where.subFamiliaId = filters.subFamiliaId;

    if (filters.proveedorId) {
      where.proveedores = {
        some: { proveedorId: filters.proveedorId, esPrincipal: true },
      };
    }

    if (filters.q && filters.q.trim()) {
      const term = filters.q.trim();
      where.OR = [
        { sku: { contains: term, mode: 'insensitive' } },
        { codigoBarras: { contains: term, mode: 'insensitive' } },
        { descripcion: { contains: term, mode: 'insensitive' } },
      ];
    }

    // Almacén / Ubicación
    const stockWhere: any = {};
    if (filters.almacenId) stockWhere.almacenId = filters.almacenId;
    if (filters.ubicacionId) stockWhere.ubicacionId = filters.ubicacionId;

    if (Object.keys(stockWhere).length > 0) {
      where.stocks = { some: stockWhere };
    }

    const [total, rawProductos] = await Promise.all([
      prisma.producto.count({ where }),
      prisma.producto.findMany({
        where,
        include: {
          categoria: { select: { id: true, nombre: true } },
          marca: { select: { id: true, nombre: true } },
          familia: { select: { id: true, nombre: true } },
          subFamilia: { select: { id: true, nombre: true } },
          unidad: { select: { id: true, codigo: true, nombre: true, decimales: true } },
          stocks: {
            where: Object.keys(stockWhere).length > 0 ? stockWhere : undefined,
            include: {
              almacen: { select: { id: true, codigo: true, nombre: true } },
              ubicacion: { select: { id: true, codigo: true, nombre: true } },
            },
          },
          proveedores: {
            where: { esPrincipal: true },
            take: 1,
            include: {
              proveedor: { select: { id: true, razonSocial: true, nombreFantasia: true } },
            },
          },
        },
        orderBy:
          filters.sortBy === 'descripcion'
            ? { descripcion: filters.sortOrder || 'asc' }
            : { sku: filters.sortOrder || 'asc' },
        skip,
        take: limit,
      }),
    ]);

    // Aplanar y derivar estados
    const items = [];
    for (const prod of rawProductos) {
      const prov = prod.proveedores[0] || null;
      const stocksList = prod.stocks.length > 0 ? prod.stocks : [null];

      for (const st of stocksList) {
        const stockActual = st ? Number(st.stockActual) : 0;
        const stockMinimo = st ? Number(st.stockMinimo) : 0;
        const stockMaximo = st ? Number(st.stockMaximo) : 0;
        const statusInfo = calcularEstadoStock(stockActual, stockMinimo, stockMaximo);

        // Filtro por estado
        if (filters.estadoStock && statusInfo.estado !== filters.estadoStock) {
          continue;
        }

        items.push({
          id: prod.id,
          sku: prod.sku,
          codigoBarras: prod.codigoBarras,
          descripcion: prod.descripcion,
          marca: prod.marca?.nombre || null,
          marcaId: prod.marcaId,
          familia: prod.familia?.nombre || null,
          familiaId: prod.familiaId,
          subFamilia: prod.subFamilia?.nombre || null,
          categoria: prod.categoria?.nombre || null,
          unidad: prod.unidad?.codigo || prod.unidad?.nombre || 'UN',
          unidadDecimales: prod.unidad?.decimales ?? 0,
          proveedorNombre: prov?.proveedor?.nombreFantasia || prov?.proveedor?.razonSocial || null,
          almacenId: st?.almacenId || null,
          almacenNombre: st?.almacen?.nombre || 'Sin Asignar',
          almacenCodigo: st?.almacen?.codigo || null,
          ubicacionId: st?.ubicacionId || null,
          ubicacionCodigo: st?.ubicacion?.codigo || null,
          stockActual,
          stockMinimo,
          stockMaximo,
          estadoStock: statusInfo.estado,
          estadoLabel: statusInfo.label,
          estadoBadge: statusInfo.badgeClass,
          cantidadSugeridaReposicion: statusInfo.cantidadSugeridaReposicion,
          ultimoMovimientoAt: st?.ultimoMovimientoAt || null,
        });
      }
    }

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Consulta histórica de movimientos (Kardex).
   */
  static async consultarMovimientos(filters: {
    fechaDesde?: string;
    fechaHasta?: string;
    productoId?: string;
    sku?: string;
    tipo?: string;
    almacenId?: string;
    usuarioId?: string;
    motivo?: string;
    referencia?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(500, Math.max(1, filters.limit || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.ProductoStockMovimientoWhereInput = {};

    if (filters.productoId) where.productoId = filters.productoId;
    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.almacenId) where.almacenId = filters.almacenId;
    if (filters.usuarioId) where.usuarioId = filters.usuarioId;

    if (filters.sku) {
      where.producto = { sku: { contains: filters.sku.trim(), mode: 'insensitive' } };
    }

    if (filters.motivo) {
      where.motivo = { contains: filters.motivo.trim(), mode: 'insensitive' };
    }

    if (filters.referencia) {
      where.OR = [
        { numero: { contains: filters.referencia.trim(), mode: 'insensitive' } },
        { referencia: { contains: filters.referencia.trim(), mode: 'insensitive' } },
      ];
    }

    if (filters.fechaDesde || filters.fechaHasta) {
      where.createdAt = {};
      if (filters.fechaDesde) where.createdAt.gte = new Date(filters.fechaDesde);
      if (filters.fechaHasta) {
        const hasta = new Date(filters.fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        where.createdAt.lte = hasta;
      }
    }

    const [total, movimientos] = await Promise.all([
      prisma.productoStockMovimiento.count({ where }),
      prisma.productoStockMovimiento.findMany({
        where,
        include: {
          producto: {
            select: {
              id: true,
              sku: true,
              codigoBarras: true,
              descripcion: true,
              unidad: { select: { codigo: true } },
            },
          },
          almacen: { select: { id: true, codigo: true, nombre: true } },
          ubicacion: { select: { id: true, codigo: true, nombre: true } },
          almacenOrigen: { select: { id: true, codigo: true, nombre: true } },
          almacenDestino: { select: { id: true, codigo: true, nombre: true } },
          reversaDe: { select: { id: true, numero: true } },
          reversadoPor: { select: { id: true, numero: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      movimientos: movimientos.map((m) => ({
        id: m.id,
        numero: m.numero,
        fecha: m.createdAt,
        productoId: m.productoId,
        sku: m.producto.sku,
        codigoBarras: m.producto.codigoBarras,
        descripcion: m.producto.descripcion,
        unidad: m.producto.unidad?.codigo || 'UN',
        tipo: m.tipo,
        almacenNombre: m.almacen.nombre,
        almacenCodigo: m.almacen.codigo,
        ubicacionCodigo: m.ubicacion?.codigo || null,
        almacenOrigenNombre: m.almacenOrigen?.nombre || null,
        almacenDestinoNombre: m.almacenDestino?.nombre || null,
        cantidad: m.cantidad,
        variacion: m.variacion,
        stockAnterior: m.stockAnterior,
        stockPosterior: m.stockPosterior,
        motivo: m.motivo,
        observaciones: m.observaciones,
        referencia: m.referencia,
        referenciaTipo: m.referenciaTipo,
        usuarioNombre: m.usuarioNombre || 'Sistema',
        estado: m.estado,
        esRevertido: !!m.reversadoPor,
        reversadoPorNumero: m.reversadoPor?.numero || null,
        esReversa: !!m.reversaDe,
        reversaDeNumero: m.reversaDe?.numero || null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Crear nueva sesión de conteo físico / cíclico.
   */
  static async crearConteo(params: {
    almacenId: string;
    ubicacionId?: string | null;
    tipo: 'GENERAL' | 'UBICACION' | 'FAMILIA' | 'SELECCION' | 'CICLICO';
    observaciones?: string;
    alcance?: any;
    productoIds?: string[];
    usuarioId?: string;
    usuarioNombre?: string;
  }) {
    const {
      almacenId,
      ubicacionId,
      tipo,
      observaciones,
      alcance,
      productoIds,
      usuarioId,
      usuarioNombre,
    } = params;

    const almacen = await prisma.almacen.findUnique({
      where: { id: almacenId },
    });
    if (!almacen) throw new Error('Almacén no encontrado');

    return await prisma.$transaction(async (tx) => {
      const numero = await getNextInventarioNumero(tx, 'CNT');

      // Determinar productos a incluir en el conteo
      let targetProductIds: string[] = [];

      if (productoIds && productoIds.length > 0) {
        targetProductIds = productoIds;
      } else if (tipo === 'UBICACION' && ubicacionId) {
        const stocks = await tx.productoStock.findMany({
          where: { almacenId, ubicacionId },
          select: { productoId: true },
        });
        targetProductIds = stocks.map((s) => s.productoId);
      } else if (tipo === 'FAMILIA' && alcance?.familiaId) {
        const prods = await tx.producto.findMany({
          where: { activo: true, familiaId: alcance.familiaId },
          select: { id: true },
        });
        targetProductIds = prods.map((p) => p.id);
      } else if (tipo === 'CICLICO' && alcance?.bajoMinimo) {
        const stocks = await tx.productoStock.findMany({
          where: { almacenId, stockMinimo: { gt: 0 } },
          select: { productoId: true, stockActual: true, stockMinimo: true },
        });
        targetProductIds = stocks.filter((s) => s.stockActual <= s.stockMinimo).map((s) => s.productoId);
      } else {
        // GENERAL
        const prods = await tx.producto.findMany({
          where: { activo: true },
          select: { id: true },
        });
        targetProductIds = prods.map((p) => p.id);
      }

      if (targetProductIds.length === 0) {
        throw new Error('El criterio de alcance seleccionado no arrojó ningún producto');
      }

      // Snapshot del stock teórico en este momento
      const stocksActuales = await tx.productoStock.findMany({
        where: { almacenId, productoId: { in: targetProductIds } },
        select: { productoId: true, stockActual: true, ubicacionId: true },
      });
      const stockActualMap = new Map(stocksActuales.map((s) => [s.productoId, s]));

      const conteo = await tx.conteoInventario.create({
        data: {
          numero,
          almacenId,
          ubicacionId: ubicacionId || null,
          tipo,
          estado: 'BORRADOR',
          alcance: alcance || null,
          observaciones: observaciones?.trim() || null,
          creadoPorId: usuarioId,
          creadoPorNombre: usuarioNombre,
          responsableId: usuarioId,
          responsableNombre: usuarioNombre,
        },
      });

      // Crear detalles con stockTeorico snapshot
      const detallesData = targetProductIds.map((pId) => {
        const st = stockActualMap.get(pId);
        return {
          conteoId: conteo.id,
          productoId: pId,
          ubicacionId: st?.ubicacionId || ubicacionId || null,
          stockTeorico: st ? Number(st.stockActual) : 0,
          estado: 'PENDIENTE',
        };
      });

      await tx.conteoInventarioDetalle.createMany({
        data: detallesData,
      });

      return {
        conteo,
        totalItems: detallesData.length,
        mensaje: `Sesión de conteo ${conteo.numero} creada exitosamente con ${detallesData.length} productos.`,
      };
    });
  }

  /**
   * Guardar progreso de conteo físico (sin alterar existencias del sistema).
   */
  static async guardarProgresoConteo(params: {
    conteoId: string;
    items: Array<{
      productoId: string;
      cantidadContada: number;
      observaciones?: string;
    }>;
    usuarioId?: string;
  }) {
    const { conteoId, items, usuarioId } = params;

    const conteo = await prisma.conteoInventario.findUnique({
      where: { id: conteoId },
    });

    if (!conteo) throw new Error('Conteo no encontrado');
    if (['CONFIRMADO', 'CANCELADO'].includes(conteo.estado)) {
      throw new Error(`No se puede modificar un conteo en estado ${conteo.estado}`);
    }

    return await prisma.$transaction(async (tx) => {
      // Si estaba en BORRADOR, pasa automáticamente a EN_CONTEO
      if (conteo.estado === 'BORRADOR') {
        await tx.conteoInventario.update({
          where: { id: conteoId },
          data: { estado: 'EN_CONTEO', iniciadoEn: new Date() },
        });
      }

      for (const it of items) {
        const detalle = await tx.conteoInventarioDetalle.findUnique({
          where: {
            conteoId_productoId: {
              conteoId,
              productoId: it.productoId,
            },
          },
        });

        if (detalle) {
          const contada = redondearCantidad(Number(it.cantidadContada) || 0, 4);
          const diferencia = redondearCantidad(contada - Number(detalle.stockTeorico), 4);

          await tx.conteoInventarioDetalle.update({
            where: { id: detalle.id },
            data: {
              cantidadContada: contada,
              diferencia,
              estado: 'CONTADO',
              observaciones: it.observaciones || detalle.observaciones,
              contadoPorId: usuarioId,
              contadoEn: new Date(),
            },
          });
        }
      }

      return { success: true, mensaje: 'Progreso guardado correctamente' };
    });
  }

  /**
   * Finalizar captura del conteo: pasa a PENDIENTE_REVISION para que el responsable examine las diferencias.
   */
  static async finalizarCapturaConteo(conteoId: string, usuarioId?: string, usuarioNombre?: string) {
    const conteo = await prisma.conteoInventario.findUnique({
      where: { id: conteoId },
    });
    if (!conteo) throw new Error('Conteo no encontrado');
    if (conteo.estado !== 'EN_CONTEO') {
      throw new Error(`Para finalizar captura el conteo debe estar en EN_CONTEO (actual: ${conteo.estado})`);
    }

    const actualizado = await prisma.conteoInventario.update({
      where: { id: conteoId },
      data: {
        estado: 'PENDIENTE_REVISION',
        finalizadoEn: new Date(),
        revisadoPorId: usuarioId,
        revisadoPorNombre: usuarioNombre,
        revisadoEn: new Date(),
      },
    });

    return {
      conteo: actualizado,
      mensaje: 'Captura finalizada. El conteo se encuentra pendiente de revisión de diferencias.',
    };
  }

  /**
   * Confirmación del conteo:
   * Calcula las diferencias válidas, genera movimientos atómicos de tipo 'CONTEO',
   * actualiza existencias y bloquea el conteo a CONFIRMADO.
   */
  static async confirmarConteo(params: {
    conteoId: string;
    observacionesFinales?: string;
    usuarioId?: string;
    usuarioNombre?: string;
    userRole?: string;
  }) {
    const { conteoId, observacionesFinales, usuarioId, usuarioNombre, userRole } = params;

    const conteo = await prisma.conteoInventario.findUnique({
      where: { id: conteoId },
      include: {
        detalles: {
          include: { producto: true },
        },
        almacen: true,
      },
    });

    if (!conteo) throw new Error('Conteo no encontrado');
    if (conteo.estado === 'CONFIRMADO') {
      throw new Error(`Este conteo ya fue confirmado previamente`);
    }
    if (conteo.estado === 'CANCELADO') {
      throw new Error(`Un conteo cancelado no puede ser confirmado`);
    }

    return await prisma.$transaction(
      async (tx) => {
        const puedeStockNegativo = await this.validarPermisoStockNegativo(tx, userRole);
        const detallesConDiferencia = conteo.detalles.filter(
          (d) => d.cantidadContada !== null && d.diferencia !== null && d.diferencia !== 0
        );

        const now = new Date();
        const numeroOperacion = await getNextInventarioNumero(tx, 'OPI', now);

        // Crear Operación de inventario
        const operacion = await tx.stockOperacion.create({
          data: {
            numero: numeroOperacion,
            tipo: 'CONTEO',
            almacenId: conteo.almacenId,
            modoAjuste: 'EXISTENCIA_REAL',
            motivo: `Ajuste por Conteo Físico ${conteo.numero}`,
            observaciones: observacionesFinales || conteo.observaciones,
            referenciaTipo: 'CONTEO',
            referenciaId: conteo.id,
            referencia: conteo.numero,
            totalLineas: detallesConDiferencia.length,
            usuarioId,
            usuarioNombre,
          },
        });

        const movimientos = [];

        // Procesar diferencias con bloqueo FOR UPDATE
        for (const det of detallesConDiferencia) {
          const lockedStock: Array<{ id: string; stockActual: number; ubicacionId: string | null }> =
            await tx.$queryRawUnsafe(
              `SELECT "id", "stockActual", "ubicacionId"
               FROM "ProductoStock"
               WHERE "productoId" = $1 AND "almacenId" = $2
               FOR UPDATE`,
              det.productoId,
              conteo.almacenId
            );

          if (!lockedStock || lockedStock.length === 0) continue;

          const stockAnterior = Number(lockedStock[0].stockActual);
          const stockPosterior = Number(det.cantidadContada);
          const delta = redondearCantidad(stockPosterior - stockAnterior, 4);

          if (stockPosterior < 0 && !puedeStockNegativo) {
            throw new Error(
              `Operación bloqueada: El conteo para "${det.producto.sku}" dejaría stock negativo (${stockPosterior}).`
            );
          }

          if (delta === 0) continue;

          await tx.productoStock.update({
            where: { id: lockedStock[0].id },
            data: { stockActual: stockPosterior, ultimoMovimientoAt: now },
          });

          const numMov = await getNextInventarioNumero(tx, 'MOV', now);

          const mov = await tx.productoStockMovimiento.create({
            data: {
              numero: numMov,
              operacionId: operacion.id,
              productoId: det.productoId,
              almacenId: conteo.almacenId,
              ubicacionId: det.ubicacionId || lockedStock[0].ubicacionId,
              tipo: 'CONTEO',
              cantidad: Math.abs(delta),
              variacion: delta,
              stockAnterior,
              stockPosterior,
              motivo: `Ajuste por Conteo Físico ${conteo.numero}`,
              observaciones: det.observaciones || null,
              referenciaTipo: 'CONTEO',
              referenciaId: conteo.id,
              referencia: conteo.numero,
              conteoDetalleId: det.id,
              estado: 'CONFIRMADO',
              usuarioId,
              usuarioNombre,
              createdAt: now,
            },
          });

          movimientos.push(mov);

          await tx.productoHistorial.create({
            data: {
              productoId: det.productoId,
              tipo: 'AJUSTE_STOCK',
              campo: 'stockActual',
              valorAnterior: String(stockAnterior),
              valorNuevo: String(stockPosterior),
              origen: 'AJUSTE_STOCK',
              detalles: {
                tipoMovimiento: 'CONTEO',
                conteoNumero: conteo.numero,
                delta,
              },
              usuarioId,
              usuarioNombre,
            },
          });
        }

        // Marcar Conteo como CONFIRMADO
        const conteoConfirmado = await tx.conteoInventario.update({
          where: { id: conteo.id },
          data: {
            estado: 'CONFIRMADO',
            confirmadoPorId: usuarioId,
            confirmadoPorNombre: usuarioNombre,
            confirmadoEn: now,
            operacionId: operacion.id,
          },
        });

        await logAudit({
          userId: usuarioId,
          userName: usuarioNombre,
          action: 'APPROVE',
          entity: 'CONTEO_INVENTARIO',
          entityId: conteo.id,
          newValue: {
            numero: conteo.numero,
            diferenciasAjustadas: movimientos.length,
            operacionNumero: operacion.numero,
          },
        });

        return {
          conteo: conteoConfirmado,
          operacion,
          movimientosAjuste: movimientos,
          mensaje: `Conteo ${conteo.numero} confirmado. Se generaron ${movimientos.length} movimientos de ajuste atómicos.`,
        };
      },
      { maxWait: 15000, timeout: 30000 }
    );
  }

  /**
   * Cancelar sesión de conteo (no altera inventario).
   */
  static async cancelarConteo(conteoId: string, motivo: string, usuarioId?: string) {
    const conteo = await prisma.conteoInventario.findUnique({ where: { id: conteoId } });
    if (!conteo) throw new Error('Conteo no encontrado');
    if (conteo.estado === 'CONFIRMADO') {
      throw new Error('Un conteo confirmado no puede cancelarse. Debe realizarse una corrección vinculada.');
    }

    const cancelado = await prisma.conteoInventario.update({
      where: { id: conteoId },
      data: {
        estado: 'CANCELADO',
        canceladoPorId: usuarioId,
        canceladoEn: new Date(),
        motivoCancelacion: motivo,
      },
    });

    return { conteo: cancelado, mensaje: `Conteo ${conteo.numero} cancelado.` };
  }
}
