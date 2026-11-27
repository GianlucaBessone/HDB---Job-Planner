import { prisma } from '@/lib/prisma';
import { contenidoPresupuestoSchema } from '@/lib/presupuestosServicio/schemas';
import { crearPresupuesto } from '@/lib/presupuestosServicio/servicio';
import type { UsuarioSesion } from '@/lib/presupuestosServicio/sesion';
import { analisisIASchema, type MaterialPliego } from '@/lib/pliegos';

/**
 * Presupuesto desde el pliego (auditoría, P36). Antes el análisis del pliego se copiaba a mano en el presupuesto.
 * Ahora, desde un pliego analizado, se arma un presupuesto de servicio en borrador con:
 * - cliente y título del pliego;
 * - alcance: el resumen del análisis;
 * - tareas: las marcadas "dentro del pliego" (y, si se elige, las sin marcar), con su modificación si la tienen;
 *   las "fuera del pliego" no se cargan. Cada una lleva una línea de mano de obra con la primera categoría y 0 horas,
 *   para completar en el editor;
 * - materiales: los del pliego (y, si se elige, los sugeridos por la IA), sin precio: se eligen del catálogo en el
 *   editor.
 * El presupuesto queda vinculado al pliego (`PresupuestoServicio.pliegoId`).
 */

export class ErrorPliegoPresupuesto extends Error {
    constructor(mensaje: string, public status = 400) {
        super(mensaje);
    }
}

const corto = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** "10", "10,5 m", "1.500 m", "aprox. 3" → número (formato argentino); sin número → null. */
export function cantidadDePliego(c: string | null | undefined): number | null {
    const m = (c || '').match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/);
    if (!m) return null;
    const t = /^\d{1,3}(\.\d{3})+/.test(m[0]) ? m[0].replace(/\./g, '').replace(',', '.') : m[0].replace(',', '.');
    const n = Number(t);
    return isFinite(n) && n > 0 ? n : null;
}

async function ultimoAnalisis(pliegoId: string) {
    return prisma.pliegoAnalisis.findFirst({
        where: { pliegoId },
        orderBy: { version: 'desc' },
        select: { id: true, version: true, resumen: true, contenido: true, tareas: { select: { titulo: true, alcance: true, modificacion: true }, orderBy: { orden: 'asc' } } },
    });
}

function materialesDe(contenido: unknown): { delPliego: MaterialPliego[]; sugeridos: MaterialPliego[] } {
    const c = analisisIASchema.shape.materiales.safeParse((contenido as any)?.materiales);
    return c.success ? { delPliego: (c.data.delPliego ?? []) as MaterialPliego[], sugeridos: (c.data.sugeridos ?? []) as MaterialPliego[] } : { delPliego: [], sugeridos: [] };
}

/** Lo que se va a cargar y los presupuestos ya armados desde este pliego. */
export async function previaPresupuesto(pliegoId: string) {
    const pliego = await prisma.pliego.findUnique({
        where: { id: pliegoId },
        select: {
            id: true,
            estado: true,
            client: { select: { id: true, nombre: true } },
            presupuestos: { select: { id: true, numero: true, estado: true, titulo: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
        },
    });
    if (!pliego) return null;
    const a = await ultimoAnalisis(pliegoId);
    const mats = a ? materialesDe(a.contenido) : { delPliego: [], sugeridos: [] };
    return {
        analizado: !!a,
        version: a?.version ?? null,
        cliente: pliego.client,
        tareas: {
            dentro: a?.tareas.filter((t) => t.alcance === 'dentro').length ?? 0,
            sinMarcar: a?.tareas.filter((t) => !t.alcance).length ?? 0,
            fuera: a?.tareas.filter((t) => t.alcance === 'fuera').length ?? 0,
        },
        materiales: { delPliego: mats.delPliego.length, sugeridos: mats.sugeridos.length },
        presupuestos: pliego.presupuestos.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    };
}

export interface OpcionesPresupuestoPliego {
    clienteId?: string | null;
    titulo?: string | null;
    incluirSinMarcar: boolean;
    incluirSugeridos: boolean;
}

export async function crearPresupuestoDesdePliego(pliegoId: string, o: OpcionesPresupuestoPliego, usuario: UsuarioSesion) {
    const pliego = await prisma.pliego.findUnique({ where: { id: pliegoId }, select: { codigo: true, titulo: true, clientId: true } });
    if (!pliego) throw new ErrorPliegoPresupuesto('Pliego no encontrado', 404);
    const a = await ultimoAnalisis(pliegoId);
    if (!a) throw new ErrorPliegoPresupuesto('Analizá el pliego antes de armar el presupuesto', 409);

    const clienteId = o.clienteId || pliego.clientId;
    if (!clienteId) throw new ErrorPliegoPresupuesto('Elegí el cliente del presupuesto');

    // Cada tarea necesita una línea de mano de obra: va con la primera categoría y 0 horas, para completar en el editor
    const categoria = await prisma.manoObraCategoria.findFirst({ where: { activo: true }, orderBy: [{ orden: 'asc' }, { nombre: 'asc' }], select: { id: true, nombre: true, valorHora: true, ivaPorcentaje: true } });
    const lineaBase = {
        categoriaId: categoria?.id ?? null,
        categoriaNombre: categoria?.nombre ?? 'A definir',
        modo: 'costo' as const,
        horas: 0,
        valorHora: categoria?.valorHora ?? 0,
        importe: 0,
        ivaPorcentaje: categoria?.ivaPorcentaje ?? 21,
    };
    const tareas = a.tareas
        .filter((t) => t.alcance === 'dentro' || (o.incluirSinMarcar && !t.alcance))
        .map((t) => ({ descripcion: corto(t.modificacion ? `${t.titulo} — ${t.modificacion}` : t.titulo, 300), etiqueta: null, manoObra: [{ ...lineaBase }] }));

    const mats = materialesDe(a.contenido);
    const materiales = [...mats.delPliego, ...(o.incluirSugeridos ? mats.sugeridos : [])].map((m) => {
        const cantidad = cantidadDePliego(m.cantidad);
        return {
            productoId: null,
            sku: null,
            descripcion: corto(cantidad === null && m.cantidad ? `${m.descripcion} (cantidad del pliego: ${m.cantidad})` : m.descripcion, 300),
            unidad: m.unidad ? corto(m.unidad, 20) : null,
            cantidad: cantidad ?? 1,
            precioUnitario: 0,
            precioModificado: false,
            ivaPorcentaje: 21,
        };
    });

    const contenido = contenidoPresupuestoSchema.parse({
        clienteId,
        titulo: corto((o.titulo || pliego.titulo).trim(), 200),
        alcance: corto(`${a.resumen}\n\nSegún el pliego ${pliego.codigo} (análisis v${a.version}).`, 5000),
        tareas,
        materiales,
    });
    const creado = await crearPresupuesto(contenido, usuario, { pliegoId });
    return { id: creado.id, numero: creado.numero, tareas: tareas.length, materiales: materiales.length };
}
