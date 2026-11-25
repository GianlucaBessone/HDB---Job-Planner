import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getNextInventarioNumero } from '@/lib/inventario/counter';
import { conciliarStockRecepcion } from '@/lib/inventario/consumos';
import { numeroFactura, type EstadoOrdenCompra, type OrdenCompraDetalle, type OrdenCompraResumen } from '@/lib/comprasTipos';

/**
 * Compras y recepción (auditoría, faltante). Una orden de compra se hace a un proveedor comercial; cada entrega
 * (parcial o total) se registra como recepción y entra stock al almacén de la orden con su movimiento de kardex
 * (`lib/inventario/consumos.ts`, origen COMPRA). La factura del proveedor (Gastos y facturas) se vincula a la orden.
 */

type Tx = Prisma.TransactionClient;
interface Usuario { id?: string | null; nombre?: string | null }

export class ErrorCompra extends Error {
    constructor(mensaje: string, public status = 400) {
        super(mensaje);
    }
}

const EPS = 0.0005;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Serializa operaciones simultáneas sobre la misma orden. */
async function bloquearOrden(tx: Tx, ordenId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`compra:${ordenId}`}))`;
}

/** Estado según lo recibido. Borrador y cancelada no cambian solos. */
function estadoPorRecepcion(actual: string, items: { cantidad: number; cantidadRecibida: number }[]): EstadoOrdenCompra {
    if (actual === 'cancelada') return 'cancelada';
    const algo = items.some((i) => i.cantidadRecibida > EPS);
    const todo = items.length > 0 && items.every((i) => i.cantidadRecibida >= i.cantidad - EPS);
    if (todo) return 'recibida';
    if (algo) return 'parcial';
    return actual === 'borrador' ? 'borrador' : 'enviada';
}

async function recalcularEstado(tx: Tx, ordenId: string) {
    const orden = await tx.ordenCompra.findUniqueOrThrow({
        where: { id: ordenId },
        select: { estado: true, fechaRecepcion: true, items: { select: { cantidad: true, cantidadRecibida: true } } },
    });
    const estado = estadoPorRecepcion(orden.estado, orden.items);
    await tx.ordenCompra.update({
        where: { id: ordenId },
        data: { estado, fechaRecepcion: estado === 'recibida' ? orden.fechaRecepcion ?? new Date() : null },
    });
    return estado;
}

// ── Lectura ─────────────────────────────────────────────────────────────────────────────────────────

const INCLUIR_RESUMEN = {
    proveedor: { select: { id: true, razonSocial: true } },
    almacen: { select: { id: true, nombre: true } },
    factura: { select: { id: true, tipoComprobante: true, letraComprobante: true, puntoVenta: true, numeroComprobante: true, fechaEmision: true, total: true } },
    items: { select: { cantidad: true, costoUnitario: true, cantidadRecibida: true } },
} satisfies Prisma.OrdenCompraInclude;

type OrdenConResumen = Prisma.OrdenCompraGetPayload<{ include: typeof INCLUIR_RESUMEN }>;

function resumen(o: OrdenConResumen): OrdenCompraResumen {
    const pedido = o.items.reduce((a, i) => a + i.cantidad, 0);
    const recibido = o.items.reduce((a, i) => a + Math.min(i.cantidadRecibida, i.cantidad), 0);
    return {
        id: o.id,
        numero: o.numero,
        estado: o.estado as EstadoOrdenCompra,
        proveedor: o.proveedor,
        almacen: o.almacen,
        fechaEmision: o.fechaEmision.toISOString(),
        fechaEsperada: iso(o.fechaEsperada),
        items: o.items.length,
        total: Math.round(o.items.reduce((a, i) => a + i.cantidad * i.costoUnitario, 0) * 100) / 100,
        recibido: pedido > 0 ? Math.round((recibido / pedido) * 100) : 0,
        factura: o.factura ? { id: o.factura.id, numero: numeroFactura(o.factura) } : null,
    };
}

export async function listarOrdenes(filtro: { estados?: string[]; q?: string; proveedorId?: string }, limite = 200) {
    const where: Prisma.OrdenCompraWhereInput = {
        ...(filtro.estados?.length ? { estado: { in: filtro.estados } } : {}),
        ...(filtro.proveedorId ? { proveedorId: filtro.proveedorId } : {}),
        ...(filtro.q
            ? {
                  OR: [
                      { numero: { contains: filtro.q, mode: 'insensitive' } },
                      { proveedor: { razonSocial: { contains: filtro.q, mode: 'insensitive' } } },
                      { items: { some: { descripcion: { contains: filtro.q, mode: 'insensitive' } } } },
                  ],
              }
            : {}),
    };
    const ordenes = await prisma.ordenCompra.findMany({ where, include: INCLUIR_RESUMEN, orderBy: { fechaEmision: 'desc' }, take: limite });
    return ordenes.map(resumen);
}

export async function detalleOrden(id: string): Promise<OrdenCompraDetalle | null> {
    const o = await prisma.ordenCompra.findUnique({
        where: { id },
        include: {
            ...INCLUIR_RESUMEN,
            items: {
                orderBy: { posicion: 'asc' },
                include: { producto: { select: { sku: true, unidad: { select: { codigo: true } } } } },
            },
            recepciones: { orderBy: { fecha: 'desc' }, include: { items: { select: { itemId: true, cantidad: true } } } },
        },
    });
    if (!o) return null;
    return {
        ...resumen(o),
        observaciones: o.observaciones,
        fechaEnvio: iso(o.fechaEnvio),
        fechaRecepcion: iso(o.fechaRecepcion),
        creadoPorNombre: o.creadoPorNombre,
        items: o.items.map((i) => ({
            id: i.id,
            productoId: i.productoId,
            sku: i.producto.sku,
            descripcion: i.descripcion,
            unidad: i.producto.unidad?.codigo ?? null,
            cantidad: i.cantidad,
            costoUnitario: i.costoUnitario,
            cantidadRecibida: i.cantidadRecibida,
        })),
        recepciones: o.recepciones.map((r) => ({
            id: r.id,
            numero: r.numero,
            fecha: r.fecha.toISOString(),
            remito: r.remito,
            observaciones: r.observaciones,
            anulada: r.anulada,
            usuarioNombre: r.usuarioNombre,
            items: r.items,
        })),
        factura: o.factura
            ? { id: o.factura.id, numero: numeroFactura(o.factura), fechaEmision: o.factura.fechaEmision.toISOString(), total: o.factura.total }
            : null,
    };
}

// ── Alta y edición ──────────────────────────────────────────────────────────────────────────────────

export interface DatosOrden {
    proveedorId: string;
    almacenId: string;
    fechaEsperada?: Date | null;
    observaciones?: string | null;
    items: { productoId: string; cantidad: number; costoUnitario: number }[];
}

async function validarDatos(tx: Tx, d: DatosOrden) {
    const [proveedor, almacen] = await Promise.all([
        tx.proveedorVentas.findUnique({ where: { id: d.proveedorId }, select: { activo: true } }),
        tx.almacen.findUnique({ where: { id: d.almacenId }, select: { activo: true } }),
    ]);
    if (!proveedor?.activo) throw new ErrorCompra('El proveedor no existe o está inactivo');
    if (!almacen?.activo) throw new ErrorCompra('El almacén no existe o está inactivo');
    const ids = Array.from(new Set(d.items.map((i) => i.productoId)));
    if (ids.length !== d.items.length) throw new ErrorCompra('Un producto aparece dos veces en la orden');
    const productos = await tx.producto.findMany({ where: { id: { in: ids } }, select: { id: true, descripcion: true } });
    if (productos.length !== ids.length) throw new ErrorCompra('Algún producto de la orden no existe');
    return new Map(productos.map((p) => [p.id, p.descripcion]));
}

const datosItems = (d: DatosOrden, descripciones: Map<string, string>) =>
    d.items.map((i, n) => ({
        productoId: i.productoId,
        descripcion: descripciones.get(i.productoId) || '',
        cantidad: r3(i.cantidad),
        costoUnitario: i.costoUnitario,
        posicion: n,
    }));

export async function crearOrden(d: DatosOrden, usuario: Usuario) {
    return prisma.$transaction(async (tx) => {
        const descripciones = await validarDatos(tx, d);
        const orden = await tx.ordenCompra.create({
            data: {
                numero: await getNextInventarioNumero(tx, 'OC'),
                proveedorId: d.proveedorId,
                almacenId: d.almacenId,
                fechaEsperada: d.fechaEsperada ?? null,
                observaciones: d.observaciones || null,
                creadoPorId: usuario.id || null,
                creadoPorNombre: usuario.nombre || null,
                items: { create: datosItems(d, descripciones) },
            },
            select: { id: true, numero: true },
        });
        return orden;
    });
}

/** Edita una orden en borrador (proveedor, almacén, ítems). Enviada solo admite fecha esperada y observaciones. */
export async function editarOrden(id: string, d: Partial<DatosOrden>) {
    return prisma.$transaction(async (tx) => {
        await bloquearOrden(tx, id);
        const orden = await tx.ordenCompra.findUnique({ where: { id }, select: { estado: true, proveedorId: true, almacenId: true } });
        if (!orden) throw new ErrorCompra('La orden no existe', 404);
        const cambiaContenido = d.items !== undefined || d.proveedorId !== undefined || d.almacenId !== undefined;
        if (cambiaContenido && orden.estado !== 'borrador') throw new ErrorCompra('Solo se cambian proveedor, almacén y productos en borrador');
        if (orden.estado === 'cancelada' || orden.estado === 'recibida') throw new ErrorCompra('La orden ya está cerrada');

        if (cambiaContenido) {
            const completo: DatosOrden = {
                proveedorId: d.proveedorId ?? orden.proveedorId,
                almacenId: d.almacenId ?? orden.almacenId,
                items: d.items ?? (await tx.ordenCompraItem.findMany({ where: { ordenId: id }, orderBy: { posicion: 'asc' } })),
            };
            const descripciones = await validarDatos(tx, completo);
            if (d.items !== undefined) {
                await tx.ordenCompraItem.deleteMany({ where: { ordenId: id } });
                await tx.ordenCompraItem.createMany({ data: datosItems(completo, descripciones).map((i) => ({ ...i, ordenId: id })) });
            }
        }
        await tx.ordenCompra.update({
            where: { id },
            data: {
                ...(d.proveedorId !== undefined ? { proveedorId: d.proveedorId } : {}),
                ...(d.almacenId !== undefined ? { almacenId: d.almacenId } : {}),
                ...(d.fechaEsperada !== undefined ? { fechaEsperada: d.fechaEsperada } : {}),
                ...(d.observaciones !== undefined ? { observaciones: d.observaciones || null } : {}),
            },
        });
    });
}

export async function enviarOrden(id: string) {
    return prisma.$transaction(async (tx) => {
        await bloquearOrden(tx, id);
        const o = await tx.ordenCompra.findUnique({ where: { id }, select: { estado: true, _count: { select: { items: true } } } });
        if (!o) throw new ErrorCompra('La orden no existe', 404);
        if (o.estado !== 'borrador') throw new ErrorCompra('La orden ya fue enviada');
        if (o._count.items === 0) throw new ErrorCompra('Agregá al menos un producto');
        await tx.ordenCompra.update({ where: { id }, data: { estado: 'enviada', fechaEnvio: new Date() } });
    });
}

/**
 * Cancela la orden: lo que no llegó deja de esperarse. Lo ya recibido queda en el stock (para sacarlo, anular
 * la recepción).
 */
export async function cancelarOrden(id: string) {
    return prisma.$transaction(async (tx) => {
        await bloquearOrden(tx, id);
        const o = await tx.ordenCompra.findUnique({ where: { id }, select: { estado: true } });
        if (!o) throw new ErrorCompra('La orden no existe', 404);
        if (o.estado === 'recibida' || o.estado === 'cancelada') throw new ErrorCompra('La orden ya está cerrada');
        await tx.ordenCompra.update({ where: { id }, data: { estado: 'cancelada' } });
    });
}

/** Borra una orden en borrador (nunca enviada, sin recepciones). */
export async function borrarOrden(id: string) {
    return prisma.$transaction(async (tx) => {
        await bloquearOrden(tx, id);
        const o = await tx.ordenCompra.findUnique({ where: { id }, select: { estado: true, _count: { select: { recepciones: true } } } });
        if (!o) throw new ErrorCompra('La orden no existe', 404);
        if (o.estado !== 'borrador' || o._count.recepciones > 0) throw new ErrorCompra('Solo se borra una orden en borrador; si no, cancelala');
        await tx.ordenCompra.delete({ where: { id } });
    });
}

/** Vincula (o desvincula con null) la factura del proveedor. Tiene que ser del mismo proveedor. */
export async function vincularFactura(id: string, facturaId: string | null) {
    const o = await prisma.ordenCompra.findUnique({ where: { id }, select: { proveedorId: true, estado: true } });
    if (!o) throw new ErrorCompra('La orden no existe', 404);
    if (facturaId) {
        const f = await prisma.facturaConsumo.findUnique({ where: { id: facturaId }, select: { proveedorId: true } });
        if (!f) throw new ErrorCompra('La factura no existe', 404);
        if (f.proveedorId !== o.proveedorId) throw new ErrorCompra('La factura es de otro proveedor');
    }
    await prisma.ordenCompra.update({ where: { id }, data: { facturaId } });
}

// ── Recepción ───────────────────────────────────────────────────────────────────────────────────────

export interface DatosRecepcion {
    items: { itemId: string; cantidad: number }[];
    remito?: string | null;
    observaciones?: string | null;
    fecha?: Date | null;
    /** Pasa el costo de la orden al costo del proveedor en el producto (afecta los precios de venta). */
    actualizarCostos?: boolean;
}

/**
 * Registra una entrega del proveedor: suma lo recibido a cada ítem, entra el stock al almacén de la orden con
 * su movimiento de kardex y actualiza el estado. Se puede recibir más de lo pedido (queda a la vista).
 */
export async function registrarRecepcion(ordenId: string, d: DatosRecepcion, usuario: Usuario) {
    return prisma.$transaction(
        async (tx) => {
            await bloquearOrden(tx, ordenId);
            const orden = await tx.ordenCompra.findUnique({
                where: { id: ordenId },
                select: { numero: true, estado: true, proveedorId: true, items: { select: { id: true, productoId: true, costoUnitario: true } } },
            });
            if (!orden) throw new ErrorCompra('La orden no existe', 404);
            if (orden.estado === 'cancelada' || orden.estado === 'recibida') throw new ErrorCompra('La orden ya está cerrada');
            if (orden.estado === 'borrador') throw new ErrorCompra('Enviá la orden antes de recibir mercadería');

            const items = d.items.filter((i) => i.cantidad > EPS);
            if (items.length === 0) throw new ErrorCompra('Cargá al menos una cantidad recibida');
            const porId = new Map(orden.items.map((i) => [i.id, i]));
            if (items.some((i) => !porId.has(i.itemId))) throw new ErrorCompra('Algún ítem no es de esta orden');
            if (new Set(items.map((i) => i.itemId)).size !== items.length) throw new ErrorCompra('Un ítem aparece dos veces');

            const fecha = d.fecha ?? new Date();
            const recepcion = await tx.recepcionCompra.create({
                data: {
                    numero: await getNextInventarioNumero(tx, 'REC', fecha),
                    ordenId,
                    fecha,
                    remito: d.remito || null,
                    observaciones: d.observaciones || null,
                    usuarioId: usuario.id || null,
                    usuarioNombre: usuario.nombre || null,
                    items: { create: items.map((i) => ({ itemId: i.itemId, cantidad: r3(i.cantidad) })) },
                },
                select: { id: true, numero: true },
            });
            for (const i of items) {
                await tx.ordenCompraItem.update({ where: { id: i.itemId }, data: { cantidadRecibida: { increment: r3(i.cantidad) } } });
            }
            await conciliarStockRecepcion(tx, recepcion.id, usuario);

            if (d.actualizarCostos) {
                for (const i of items) {
                    const item = porId.get(i.itemId)!;
                    if (item.costoUnitario <= 0) continue;
                    const tieneProveedores = await tx.productoProveedorVentas.count({ where: { productoId: item.productoId } });
                    await tx.productoProveedorVentas.upsert({
                        where: { productoId_proveedorId: { productoId: item.productoId, proveedorId: orden.proveedorId } },
                        update: { costo: item.costoUnitario },
                        create: { productoId: item.productoId, proveedorId: orden.proveedorId, costo: item.costoUnitario, esPrincipal: tieneProveedores === 0 },
                    });
                }
            }
            const estado = await recalcularEstado(tx, ordenId);
            return { ...recepcion, estado };
        },
        { timeout: 20_000 }
    );
}

/** Anula una recepción: saca del stock lo que había entrado y lo descuenta de lo recibido. */
export async function anularRecepcion(recepcionId: string, usuario: Usuario) {
    return prisma.$transaction(
        async (tx) => {
            const r = await tx.recepcionCompra.findUnique({ where: { id: recepcionId }, select: { ordenId: true } });
            if (!r) throw new ErrorCompra('La recepción no existe', 404);
            await bloquearOrden(tx, r.ordenId);
            const rec = await tx.recepcionCompra.findUniqueOrThrow({
                where: { id: recepcionId },
                select: { anulada: true, items: { select: { itemId: true, cantidad: true } } },
            });
            if (rec.anulada) throw new ErrorCompra('La recepción ya está anulada');
            await tx.recepcionCompra.update({ where: { id: recepcionId }, data: { anulada: true, anuladaAt: new Date() } });
            for (const i of rec.items) {
                await tx.ordenCompraItem.update({ where: { id: i.itemId }, data: { cantidadRecibida: { decrement: i.cantidad } } });
            }
            await conciliarStockRecepcion(tx, recepcionId, usuario);
            // Si estaba recibida completa vuelve a esperar lo que falta
            const orden = await tx.ordenCompra.findUniqueOrThrow({ where: { id: r.ordenId }, select: { estado: true } });
            if (orden.estado === 'recibida') await tx.ordenCompra.update({ where: { id: r.ordenId }, data: { estado: 'enviada' } });
            return recalcularEstado(tx, r.ordenId);
        },
        { timeout: 20_000 }
    );
}
