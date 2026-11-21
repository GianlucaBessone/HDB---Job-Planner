import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolverPrecioProducto } from '@/lib/ventas/priceRules';
import { buildProductSearchWhere } from '@/lib/ventas/skuUtils';

/**
 * Una sola fuente de precios para los materiales (auditoría, P8): el catálogo de Productos.
 * Antes las OT, el costo del proyecto y el cobro de las OS leían `MaterialMaestro`, una tabla
 * que ya no se mantenía, mientras las OS y los presupuestos usaban `Producto`.
 */

type Db = Prisma.TransactionClient | typeof prisma;

const incluir = {
    iva: { select: { porcentaje: true } },
    unidad: { select: { codigo: true, nombre: true } },
    proveedores: { where: { esPrincipal: true }, take: 1, select: { costo: true } },
} as const;

/** Variantes de un código de material: tal cual, en mayúsculas, sin ceros a la izquierda o con 5 dígitos. */
function variantes(codigo: string) {
    const limpio = codigo.trim();
    const sinCeros = limpio.replace(/^0+/, '') || '0';
    return Array.from(new Set([limpio, limpio.toUpperCase(), sinCeros, sinCeros.padStart(5, '0')]));
}

/** Producto activo del catálogo para un código de material (SKU, con o sin ceros, o código de barras). */
export async function productoPorCodigo(db: Db, codigo: string) {
    if (!codigo?.trim()) return null;
    // Primero el SKU exacto: "665" y "00665" pueden ser productos distintos
    const exacto = await db.producto.findFirst({ where: { activo: true, sku: codigo.trim() }, include: incluir });
    if (exacto) return exacto;
    return db.producto.findFirst({
        where: { activo: true, OR: [...variantes(codigo).map(sku => ({ sku })), { codigoBarras: codigo.trim() }] },
        include: incluir,
        orderBy: { sku: 'asc' },
    });
}

/**
 * Lista de precios que corresponde: la del proyecto, si no la del cliente, si no la predeterminada.
 */
export async function listaParaContexto(db: Db, ctx: { proyectoId?: string | null; clienteId?: string | null }) {
    if (ctx.proyectoId) {
        const prj = await db.project.findUnique({
            where: { id: ctx.proyectoId },
            select: { listaPrecio: true, clientId: true },
        });
        if (prj?.listaPrecio) return prj.listaPrecio;
        if (!ctx.clienteId && prj?.clientId) ctx = { ...ctx, clienteId: prj.clientId };
    }
    if (ctx.clienteId) {
        const cli = await db.hdbClient.findUnique({ where: { id: ctx.clienteId }, select: { listaPrecioId: true } });
        if (cli?.listaPrecioId) {
            const lp = await db.listaPrecio.findFirst({ where: { id: cli.listaPrecioId, activo: true } });
            if (lp) return lp;
        }
    }
    return db.listaPrecio.findFirst({ where: { esPredeterminada: true, activo: true } });
}

type ProductoConPrecio = NonNullable<Awaited<ReturnType<typeof productoPorCodigo>>>;
type Lista = Awaited<ReturnType<typeof listaParaContexto>>;

function precioDe(p: ProductoConPrecio, lista: Lista) {
    return resolverPrecioProducto(
        {
            precioBase: p.precioBase,
            costo: p.proveedores[0]?.costo ? Number(p.proveedores[0].costo) : 0,
            rentabilidad: p.rentabilidad,
            familiaId: p.familiaId,
            marcaId: p.marcaId,
            ivaPorcentaje: p.iva?.porcentaje ?? 21,
        },
        lista as any
    ).precio;
}

export interface MaterialDeCatalogo {
    productoId: string;
    codigo: string;
    nombre: string;
    unidad: string;
    precioVenta: number;
}

function aMaterial(p: ProductoConPrecio, lista: Lista): MaterialDeCatalogo {
    return {
        productoId: p.id,
        codigo: p.sku,
        nombre: p.descripcion,
        unidad: p.unidad?.codigo || p.unidad?.nombre || 'unidad',
        precioVenta: precioDe(p, lista),
    };
}

/** Precio de venta vigente de un material, con la lista del proyecto o del cliente. */
export async function precioMaterial(
    codigo: string,
    ctx: { proyectoId?: string | null; clienteId?: string | null } = {},
    db: Db = prisma
): Promise<MaterialDeCatalogo | null> {
    const p = await productoPorCodigo(db, codigo);
    if (!p) return null;
    return aMaterial(p, await listaParaContexto(db, ctx));
}

/** Búsqueda en el catálogo por código o descripción, con el precio del contexto. */
export async function buscarMateriales(
    q: string,
    ctx: { proyectoId?: string | null; clienteId?: string | null } = {},
    limite = 15
): Promise<MaterialDeCatalogo[]> {
    if (!q.trim()) return [];
    const productos = await prisma.producto.findMany({
        where: { activo: true, ...(buildProductSearchWhere(q.trim()) as object) },
        include: incluir,
        take: limite,
        orderBy: { sku: 'asc' },
    });
    const lista = await listaParaContexto(prisma, ctx);
    return productos.map(p => aMaterial(p, lista));
}

/** Precios de varios códigos de una vez (para precargar un cobro). Clave: el código pedido. */
export async function preciosPorCodigos(
    codigos: string[],
    ctx: { proyectoId?: string | null; clienteId?: string | null } = {}
): Promise<Record<string, MaterialDeCatalogo>> {
    const lista = await listaParaContexto(prisma, ctx);
    const res: Record<string, MaterialDeCatalogo> = {};
    for (const c of Array.from(new Set(codigos.filter(Boolean)))) {
        const p = await productoPorCodigo(prisma, c);
        if (p) res[c] = aMaterial(p, lista);
    }
    return res;
}
