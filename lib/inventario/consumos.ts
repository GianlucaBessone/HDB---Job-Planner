import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getNextInventarioNumero } from '@/lib/inventario/counter';
import { productoPorCodigo } from '@/lib/ventas/precioMaterial';

/**
 * Consumos reales → stock (auditoría, P9). Antes el kardex solo se movía con ajustes manuales:
 * las ventas y las entregas a obra no descontaban nada.
 *
 * Cómo funciona: cada origen (una venta, un material entregado a obra) tiene una SALIDA NETA
 * objetivo por producto. La función compara ese objetivo con lo que ya está registrado en el
 * kardex para ese origen (`referenciaTipo` + `referenciaId`) y registra solo la diferencia
 * (SALIDA si falta descontar, ENTRADA si hay que devolver). Llamarla dos veces no duplica nada,
 * y sirve igual para el alta, la anulación, la cancelación de pendientes o una devolución.
 *
 * El stock puede quedar negativo: una venta nunca se frena por stock (se asume un error de
 * conteo físico, Anexo A). Las existencias negativas se corrigen con un conteo o un ajuste.
 */

/** COMPRA: recepción de una orden de compra; su objetivo es negativo (entra stock). */
export type OrigenConsumo = 'VENTA' | 'ENTREGA_OBRA' | 'OT' | 'COMPRA';

const EPS = 0.0005;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Inicio de la integración para materiales de obra. Lo cargado antes no se descuenta al
 * modificarlo, para no restar dos veces lo que ya se ajustó a mano.
 * Se puede mover con la variable STOCK_OBRA_DESDE (fecha ISO).
 */
export const STOCK_OBRA_DESDE = new Date(process.env.STOCK_OBRA_DESDE || '2026-11-20T21:00:00Z');

interface Usuario { id?: string | null; nombre?: string | null }

/** Almacén por defecto: el predeterminado activo o, si no hay, el primero activo. */
export async function almacenPorDefecto(tx: Prisma.TransactionClient = prisma): Promise<string | null> {
    const alm =
        (await tx.almacen.findFirst({ where: { activo: true, esPredeterminado: true }, select: { id: true } })) ||
        (await tx.almacen.findFirst({ where: { activo: true }, orderBy: { createdAt: 'asc' }, select: { id: true } }));
    return alm?.id ?? null;
}

/**
 * Lleva el kardex de un origen a su salida neta objetivo. Debe correr dentro de una transacción.
 * `objetivos`: productoId → cantidad que tiene que estar fuera del stock por este origen.
 */
async function aplicarObjetivo(
    tx: Prisma.TransactionClient,
    p: {
        referenciaTipo: OrigenConsumo;
        referenciaId: string;
        referencia: string;
        almacenId: string;
        objetivos: Map<string, number>;
        motivo: string;
        usuario?: Usuario;
    }
): Promise<number> {
    // Serializa dos conciliaciones simultáneas del mismo origen
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`stock:${p.referenciaTipo}:${p.referenciaId}`}))`;

    const previos = await tx.productoStockMovimiento.groupBy({
        by: ['productoId'],
        where: { referenciaTipo: p.referenciaTipo, referenciaId: p.referenciaId },
        _sum: { variacion: true },
    });
    const yaFuera = new Map(previos.map(m => [m.productoId, -(m._sum.variacion || 0)]));
    const productos = new Set([...Array.from(p.objetivos.keys()), ...Array.from(yaFuera.keys())]);

    let movimientos = 0;
    for (const productoId of Array.from(productos)) {
        const diferencia = r3((p.objetivos.get(productoId) || 0) - (yaFuera.get(productoId) || 0));
        if (Math.abs(diferencia) < EPS) continue;

        const variacion = -diferencia; // salida → resta, devolución → suma
        const actual = await tx.productoStock.findUnique({
            where: { productoId_almacenId: { productoId, almacenId: p.almacenId } },
            select: { stockActual: true },
        });
        const stockAnterior = actual?.stockActual ?? 0;
        const stockPosterior = r3(stockAnterior + variacion);
        const ahora = new Date();

        await tx.productoStock.upsert({
            where: { productoId_almacenId: { productoId, almacenId: p.almacenId } },
            update: { stockActual: { increment: variacion }, ultimoMovimientoAt: ahora },
            create: { productoId, almacenId: p.almacenId, stockActual: variacion, ultimoMovimientoAt: ahora },
        });
        await tx.productoStockMovimiento.create({
            data: {
                numero: await getNextInventarioNumero(tx, 'MOV', ahora),
                productoId,
                almacenId: p.almacenId,
                tipo: diferencia > 0 ? 'SALIDA' : 'ENTRADA',
                cantidad: Math.abs(diferencia),
                variacion,
                stockAnterior,
                stockPosterior,
                motivo: p.motivo,
                referenciaTipo: p.referenciaTipo,
                referenciaId: p.referenciaId,
                referencia: p.referencia,
                usuarioId: p.usuario?.id || null,
                usuarioNombre: p.usuario?.nombre || null,
                metadata: stockPosterior < 0 ? { stockNegativo: true } : undefined,
            },
        });
        movimientos++;
    }
    return movimientos;
}

/**
 * Venta del PDV: sale lo vendido menos lo cancelado; una venta anulada devuelve todo.
 * Solo concilia ventas integradas (`stockDescontado`), para no tocar las anteriores al cambio.
 * `integrar: true` la integra (se usa al confirmarla).
 */
export async function conciliarStockVenta(
    tx: Prisma.TransactionClient,
    ventaId: string,
    opciones: { integrar?: boolean; usuario?: Usuario; motivo?: string } = {}
): Promise<number> {
    const venta = await tx.venta.findUnique({
        where: { id: ventaId },
        select: {
            id: true, numero: true, estado: true, almacenId: true, stockDescontado: true,
            items: { select: { productoId: true, cantidad: true, cantidadCancelada: true } },
        },
    });
    if (!venta) return 0;
    if (!venta.stockDescontado && !opciones.integrar) return 0;

    const almacenId = venta.almacenId || (await almacenPorDefecto(tx));
    if (!almacenId) return 0; // sin almacenes cargados no hay stock que mover

    const objetivos = new Map<string, number>();
    if (venta.estado !== 'ANULADA') {
        for (const it of venta.items) {
            if (!it.productoId) continue;
            const neto = Math.max(0, it.cantidad - (it.cantidadCancelada || 0));
            objetivos.set(it.productoId, r3((objetivos.get(it.productoId) || 0) + neto));
        }
    }

    const n = await aplicarObjetivo(tx, {
        referenciaTipo: 'VENTA',
        referenciaId: venta.id,
        referencia: venta.numero,
        almacenId,
        objetivos,
        motivo: opciones.motivo || (venta.estado === 'ANULADA' ? `Anulación de la venta ${venta.numero}` : `Venta ${venta.numero}`),
        usuario: opciones.usuario,
    });
    if (!venta.stockDescontado) {
        await tx.venta.update({ where: { id: venta.id }, data: { stockDescontado: true } });
    }
    return n;
}

/**
 * Material borrado de la obra: lo que había salido vuelve al stock (el material ya no existe,
 * así que se revierte todo lo registrado con su id).
 */
export async function devolverStockMaterialBorrado(tx: Prisma.TransactionClient, materialId: string, descripcion: string, usuario?: Usuario) {
    const previos = await tx.productoStockMovimiento.findFirst({
        where: { referenciaTipo: 'ENTREGA_OBRA', referenciaId: materialId },
        select: { almacenId: true },
    });
    if (!previos) return 0;
    return aplicarObjetivo(tx, {
        referenciaTipo: 'ENTREGA_OBRA',
        referenciaId: materialId,
        referencia: descripcion,
        almacenId: previos.almacenId,
        objetivos: new Map(),
        motivo: `Material borrado de la obra: ${descripcion}`,
        usuario,
    });
}

/**
 * Material entregado a obra: sale lo entregado menos lo devuelto y cerrado por el depósito
 * (con o sin reserva). Se vincula con el catálogo por código = SKU; un material sin producto
 * en el catálogo no mueve stock.
 */
export async function conciliarStockMaterialObra(
    tx: Prisma.TransactionClient,
    materialId: string,
    usuario?: Usuario
): Promise<number> {
    const mat = await tx.materialProyecto.findUnique({
        where: { id: materialId },
        select: {
            id: true, codigo: true, nombre: true, cantidadEntregada: true, createdAt: true,
            proyecto: { select: { nombre: true, codigoProyecto: true } },
            devoluciones: { select: { cantidadADevolver: true, estado: true } },
        },
    });
    if (!mat?.codigo) return 0;

    const yaIntegrado = await tx.productoStockMovimiento.count({ where: { referenciaTipo: 'ENTREGA_OBRA', referenciaId: mat.id } });
    if (!yaIntegrado && mat.createdAt < STOCK_OBRA_DESDE) return 0;

    const producto = await productoPorCodigo(tx, mat.codigo);
    if (!producto) return 0;

    const almacenId = await almacenPorDefecto(tx);
    if (!almacenId) return 0;

    const devuelto = mat.devoluciones
        .filter(d => d.estado === 'cerrado_ok' || d.estado === 'cerrado_con_reserva')
        .reduce((a, d) => a + (d.cantidadADevolver || 0), 0);
    const neto = Math.max(0, r3(mat.cantidadEntregada - devuelto));
    const obra = mat.proyecto.codigoProyecto || mat.proyecto.nombre;

    return aplicarObjetivo(tx, {
        referenciaTipo: 'ENTREGA_OBRA',
        referenciaId: mat.id,
        referencia: `Obra ${obra}`,
        almacenId,
        objetivos: new Map([[producto.id, neto]]),
        motivo: `Entrega a obra ${obra}: ${mat.nombre}`,
        usuario,
    });
}

/**
 * Ciclo de OT: salen del depósito los materiales de catálogo cargados en el ciclo (los de código
 * 999999 son manuales y no mueven stock). Quitar un material lo devuelve. Los materiales cargados
 * antes de `STOCK_OBRA_DESDE` no se cuentan, para no restar dos veces lo que ya se ajustó a mano.
 */
export async function conciliarStockCicloOT(tx: Prisma.TransactionClient, cicloId: string, usuario?: Usuario): Promise<number> {
    const ciclo = await tx.otCiclo.findUnique({
        where: { id: cicloId },
        select: {
            id: true, numeroCiclo: true,
            ordenTrabajo: { select: { numeroOT: true } },
            materiales: { select: { materialSource: true, materialCodigo: true, cantidad: true, createdAt: true } },
        },
    });
    if (!ciclo) return 0;

    const objetivos = new Map<string, number>();
    for (const m of ciclo.materiales) {
        if (m.materialSource !== 'INVENTARIO' || m.createdAt < STOCK_OBRA_DESDE) continue;
        const producto = await productoPorCodigo(tx, m.materialCodigo);
        if (!producto) continue;
        objetivos.set(producto.id, r3((objetivos.get(producto.id) || 0) + m.cantidad));
    }

    const previo = await tx.productoStockMovimiento.findFirst({
        where: { referenciaTipo: 'OT', referenciaId: ciclo.id },
        select: { almacenId: true },
    });
    if (!objetivos.size && !previo) return 0;
    const almacenId = previo?.almacenId || (await almacenPorDefecto(tx));
    if (!almacenId) return 0;

    const ref = `${ciclo.ordenTrabajo.numeroOT} · ciclo ${ciclo.numeroCiclo}`;
    return aplicarObjetivo(tx, {
        referenciaTipo: 'OT',
        referenciaId: ciclo.id,
        referencia: ref,
        almacenId,
        objetivos,
        motivo: `Materiales de la ${ref}`,
        usuario,
    });
}

/**
 * Versión fuera de transacción para los caminos que ya guardaron el material: un error al
 * mover el stock se registra pero no deshace la entrega (el stock se puede corregir con un ajuste).
 */
export async function conciliarMaterialesObra(materialIds: (string | null | undefined)[], usuario?: Usuario) {
    for (const id of Array.from(new Set(materialIds.filter(Boolean) as string[]))) {
        try {
            await prisma.$transaction(tx => conciliarStockMaterialObra(tx, id, usuario));
        } catch (e) {
            console.error(`No se pudo mover el stock del material de obra ${id}:`, e);
        }
    }
}

/**
 * Recepción de una orden de compra → ENTRADA al almacén de la orden (compras y recepción). Una recepción
 * anulada tiene objetivo cero: la conciliación saca del stock lo que había entrado.
 */
export async function conciliarStockRecepcion(tx: Prisma.TransactionClient, recepcionId: string, usuario?: Usuario): Promise<number> {
    const r = await tx.recepcionCompra.findUnique({
        where: { id: recepcionId },
        select: {
            numero: true,
            anulada: true,
            orden: { select: { numero: true, almacenId: true } },
            items: { select: { cantidad: true, item: { select: { productoId: true } } } },
        },
    });
    if (!r) return 0;
    const objetivos = new Map<string, number>();
    if (!r.anulada) {
        for (const i of r.items) objetivos.set(i.item.productoId, (objetivos.get(i.item.productoId) || 0) - i.cantidad);
    }
    return aplicarObjetivo(tx, {
        referenciaTipo: 'COMPRA',
        referenciaId: recepcionId,
        referencia: `${r.orden.numero} · ${r.numero}`,
        almacenId: r.orden.almacenId,
        objetivos,
        motivo: r.anulada ? 'Recepción de compra anulada' : 'Recepción de compra',
        usuario,
    });
}
