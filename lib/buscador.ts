import { prisma } from '@/lib/prisma';
import type { AccesoSesion } from '@/lib/permisosServer';
import { canOpenView, getViewConfig, type ViewConfig } from '@/lib/viewAccess';

/**
 * Búsqueda global de registros (auditoría, P32): encontrar un proyecto, cliente, orden, presupuesto, producto o
 * ticket por número o nombre desde la paleta (Ctrl+K). Cada tipo se busca solo si la persona puede abrir su
 * vista (roles configurados + permisos especiales, igual que el menú).
 */

export interface ResultadoBusqueda {
    id: string;
    tipo: TipoRegistro;
    titulo: string;
    detalle: string;
    url: string;
}

export type TipoRegistro = 'proyecto' | 'cliente' | 'orden_trabajo' | 'orden_servicio' | 'presupuesto' | 'producto' | 'ticket';

export const ETIQUETA_TIPO: Record<TipoRegistro, string> = {
    proyecto: 'Proyectos',
    cliente: 'Clientes',
    orden_trabajo: 'Órdenes de trabajo',
    orden_servicio: 'Órdenes de servicio',
    presupuesto: 'Presupuestos de servicio',
    producto: 'Productos',
    ticket: 'Tickets',
};

const POR_TIPO = 5;
const ci = (q: string) => ({ contains: q, mode: 'insensitive' as const });

async function vistasConfiguradas(): Promise<ViewConfig[]> {
    const opciones = await prisma.configOption.findMany({ where: { category: 'VIEW_ACCESS' } }).catch(() => []);
    const guardadas = opciones
        .map((o) => {
            try {
                return JSON.parse(o.value);
            } catch {
                return null;
            }
        })
        .filter(Boolean);
    return getViewConfig(guardadas);
}

export async function buscarRegistros(acceso: AccesoSesion, texto: string): Promise<ResultadoBusqueda[]> {
    const q = texto.trim();
    if (q.length < 2) return [];

    const vistas = await vistasConfiguradas();
    const ve = (vista: string) => canOpenView(vista, acceso.role, vistas, acceso.permisos);
    const busquedas: Promise<ResultadoBusqueda[]>[] = [];

    if (ve('/projects')) {
        busquedas.push(
            prisma.project
                .findMany({
                    where: { OR: [{ codigoProyecto: ci(q) }, { nombre: ci(q) }, { cliente: ci(q) }, { client: { nombre: ci(q) } }] },
                    select: { id: true, codigoProyecto: true, nombre: true, cliente: true, estado: true, client: { select: { nombre: true } } },
                    orderBy: { updatedAt: 'desc' },
                    take: POR_TIPO,
                })
                .then((r) =>
                    r.map((p) => ({
                        id: p.id,
                        tipo: 'proyecto' as const,
                        titulo: [p.codigoProyecto, p.nombre].filter(Boolean).join(' · '),
                        detalle: [p.client?.nombre || p.cliente, p.estado.replace('_', ' ')].filter(Boolean).join(' · '),
                        url: `/projects/ficha/${p.id}`,
                    }))
                )
        );
    }

    if (ve('/clients')) {
        const digitos = q.replace(/\D/g, '');
        busquedas.push(
            prisma.hdbClient
                .findMany({
                    where: {
                        OR: [
                            { nombre: ci(q) },
                            { razonSocial: ci(q) },
                            { cuit: { contains: q } },
                            ...(digitos.length >= 4 && digitos !== q ? [{ cuit: { contains: digitos } }] : []),
                        ],
                    },
                    select: { id: true, nombre: true, razonSocial: true, cuit: true, activo: true },
                    orderBy: { nombre: 'asc' },
                    take: POR_TIPO,
                })
                .then((r) =>
                    r.map((c) => ({
                        id: c.id,
                        tipo: 'cliente' as const,
                        titulo: c.nombre,
                        detalle: [c.razonSocial !== c.nombre ? c.razonSocial : null, c.cuit, c.activo ? null : 'inactivo'].filter(Boolean).join(' · '),
                        url: `/clients/${c.id}`,
                    }))
                )
        );
    }

    if (ve('/ordenes-trabajo')) {
        busquedas.push(
            prisma.ordenTrabajo
                .findMany({
                    where: { OR: [{ numeroOT: ci(q) }, { proyecto: { nombre: ci(q) } }] },
                    select: { id: true, numeroOT: true, estado: true, proyecto: { select: { nombre: true } } },
                    orderBy: { numeroSecuencial: 'desc' },
                    take: POR_TIPO,
                })
                .then((r) =>
                    r.map((o) => ({
                        id: o.id,
                        tipo: 'orden_trabajo' as const,
                        titulo: o.numeroOT,
                        detalle: [o.proyecto?.nombre, o.estado.replace('_', ' ').toLowerCase()].filter(Boolean).join(' · '),
                        url: `/ordenes-trabajo/${o.id}`,
                    }))
                )
        );
    }

    if (ve('/ordenes-servicio')) {
        busquedas.push(
            prisma.ordenServicio
                .findMany({
                    where: { OR: [{ codigoOS: ci(q) }, { project: { nombre: ci(q) } }, { project: { codigoProyecto: ci(q) } }] },
                    select: { id: true, codigoOS: true, estado: true, project: { select: { nombre: true } } },
                    orderBy: { fechaCreacion: 'desc' },
                    take: POR_TIPO,
                })
                .then((r) =>
                    r.map((o) => ({
                        id: o.id,
                        tipo: 'orden_servicio' as const,
                        titulo: o.codigoOS || 'Orden de servicio',
                        detalle: [o.project?.nombre, o.estado].filter(Boolean).join(' · '),
                        url: `/ordenes-servicio?highlight=${o.id}`,
                    }))
                )
        );
    }

    if (ve('/presupuestos-servicio')) {
        busquedas.push(
            prisma.presupuestoServicio
                .findMany({
                    where: { OR: [{ numero: ci(q) }, { titulo: ci(q) }, { clienteNombre: ci(q) }] },
                    select: { id: true, numero: true, titulo: true, clienteNombre: true, estado: true },
                    orderBy: { createdAt: 'desc' },
                    take: POR_TIPO,
                })
                .then((r) =>
                    r.map((p) => ({
                        id: p.id,
                        tipo: 'presupuesto' as const,
                        titulo: `${p.numero} · ${p.titulo}`,
                        detalle: [p.clienteNombre, p.estado].filter(Boolean).join(' · '),
                        url: `/presupuestos-servicio/${p.id}`,
                    }))
                )
        );
    }

    if (ve('/ventas/gestion')) {
        busquedas.push(
            prisma.producto
                .findMany({
                    where: { OR: [{ sku: ci(q) }, { codigoBarras: q }, { descripcion: ci(q) }] },
                    select: { id: true, sku: true, descripcion: true, activo: true },
                    orderBy: [{ activo: 'desc' }, { sku: 'asc' }],
                    take: POR_TIPO,
                })
                .then((r) =>
                    r.map((p) => ({
                        id: p.id,
                        tipo: 'producto' as const,
                        titulo: `${p.sku} · ${p.descripcion}`,
                        detalle: p.activo ? 'Producto' : 'Producto inactivo',
                        url: `/ventas/gestion/productos/${p.id}`,
                    }))
                )
        );
    }

    if (ve('/tickets')) {
        // Sin "tickets.gestionar" cada persona ve solo los tickets que reportó (igual que /api/tickets)
        const propios = acceso.puede('tickets.gestionar') ? {} : { reportadoPorId: acceso.userId };
        busquedas.push(
            prisma.ticket
                .findMany({
                    where: { ...propios, OR: [{ codigo: ci(q) }, { titulo: ci(q) }] },
                    select: { id: true, codigo: true, titulo: true, estado: true },
                    orderBy: { createdAt: 'desc' },
                    take: POR_TIPO,
                })
                .then((r) =>
                    r.map((t) => ({
                        id: t.id,
                        tipo: 'ticket' as const,
                        titulo: `${t.codigo} · ${t.titulo}`,
                        detalle: t.estado.replace('_', ' '),
                        url: `/tickets/${t.id}`,
                    }))
                )
        );
    }

    // Un tipo que falla (tabla vieja, etc.) no deja sin resultados a los demás
    const grupos = await Promise.allSettled(busquedas);
    return grupos.flatMap((g) => (g.status === 'fulfilled' ? g.value : []));
}
