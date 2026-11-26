import { prisma } from '@/lib/prisma';
import type { AccesoSesion } from '@/lib/permisosServer';
import { canOpenView, getViewConfig, type ViewConfig } from '@/lib/viewAccess';
import type { TipoVencimiento, Vencimiento } from '@/lib/vencimientosTipos';
export type { TipoVencimiento, Vencimiento } from '@/lib/vencimientosTipos';

/**
 * Calendario único de vencimientos (auditoría, faltante "Calendario único de vencimientos"). Junta lo que vence
 * en cada módulo: EPP entregado, competencias del personal, documentos a revisar, presupuestos de servicio,
 * presupuestos de productos, entregas de compras
 * y documentos del legajo del personal. Cada tipo se incluye solo si la persona puede abrir su vista (igual que el menú).
 */

const DIA = 86_400_000;

async function vistasConfiguradas(): Promise<ViewConfig[]> {
    const opciones = await prisma.configOption.findMany({ where: { category: 'VIEW_ACCESS' } }).catch(() => []);
    return getViewConfig(
        opciones
            .map((o) => {
                try {
                    return JSON.parse(o.value);
                } catch {
                    return null;
                }
            })
            .filter(Boolean)
    );
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Vencimientos entre `desdeDias` (negativo: vencidos hace hasta N días) y `hastaDias` desde hoy, ordenados por fecha.
 */
export async function vencimientos(acceso: AccesoSesion, desdeDias = -90, hastaDias = 90, ahora = new Date()): Promise<Vencimiento[]> {
    const vistas = await vistasConfiguradas();
    const ve = (vista: string) => canOpenView(vista, acceso.role, vistas, acceso.permisos);
    const desde = new Date(ahora.getTime() + desdeDias * DIA);
    const hasta = new Date(ahora.getTime() + hastaDias * DIA);
    const entre = { gte: desde, lte: hasta };
    const hoy = iso(ahora);
    const fuentes: Promise<Vencimiento[]>[] = [];

    const item = (tipo: TipoVencimiento, id: string, fecha: Date | string, titulo: string, detalle: string, url: string): Vencimiento => {
        const f = typeof fecha === 'string' ? fecha.slice(0, 10) : iso(fecha);
        return { id: `${tipo}-${id}`, tipo, fecha: f, vencido: f < hoy, titulo, detalle, url };
    };

    // EPP entregado y vigente (el reemplazado deja de estar VIGENTE)
    if (ve('/rrhh')) {
        fuentes.push(
            prisma.eppDeliveryItem
                .findMany({
                    where: { estado: { in: ['VIGENTE', 'POR_VENCER'] }, fechaVencimiento: entre, delivery: { estado: { not: 'RECHAZADA' } } },
                    select: {
                        id: true,
                        fechaVencimiento: true,
                        talle: true,
                        eppItem: { select: { nombre: true } },
                        delivery: { select: { operator: { select: { nombreCompleto: true } } } },
                    },
                    take: 500,
                })
                .then((r) =>
                    r.map((e) =>
                        item('epp', e.id, e.fechaVencimiento, `${e.eppItem.nombre}${e.talle ? ` (talle ${e.talle})` : ''}`, e.delivery.operator.nombreCompleto, '/rrhh/personal/epp?tab=matriz')
                    )
                )
        );
    }

    // Competencias del personal
    if (ve('/calidad/formacion')) {
        fuentes.push(
            prisma.technicianCompetency
                .findMany({
                    where: { vencimiento: entre, estado: { notIn: ['inactiva'] } },
                    select: { id: true, nombre: true, vencimiento: true, operator: { select: { nombreCompleto: true } } },
                    take: 500,
                })
                .then((r) => r.map((c) => item('competencia', c.id, c.vencimiento!, c.nombre, c.operator.nombreCompleto, '/calidad/formacion?tab=competencies')))
        );
    }

    // Documentos controlados: próxima revisión
    if (ve('/calidad')) {
        fuentes.push(
            prisma.controlledDocument
                .findMany({
                    where: { proximaRevision: entre, estado: { not: 'obsoleto' } },
                    select: { id: true, codigoDocumental: true, titulo: true, proximaRevision: true, responsableNombre: true },
                    take: 500,
                })
                .then((r) =>
                    r.map((d) =>
                        item('documento', d.id, d.proximaRevision!, [d.codigoDocumental, d.titulo].filter(Boolean).join(' · '), d.responsableNombre ? `Revisión · ${d.responsableNombre}` : 'Revisión', `/calidad?tab=library&docId=${d.id}`)
                    )
                )
        );
    }

    // Presupuestos de servicio enviados (validez de la versión enviada, YYYY-MM-DD)
    if (ve('/presupuestos-servicio')) {
        fuentes.push(
            prisma.presupuestoServicio
                .findMany({
                    where: { estado: 'enviado', fechaVencimiento: { gte: iso(desde), lte: iso(hasta) } },
                    select: { id: true, numero: true, titulo: true, clienteNombre: true, fechaVencimiento: true },
                    take: 500,
                })
                .then((r) => r.map((p) => item('presupuesto_servicio', p.id, p.fechaVencimiento!, `${p.numero} · ${p.titulo}`, p.clienteNombre, `/presupuestos-servicio/${p.id}`)))
        );
    }

    // Presupuestos de productos (cotizaciones) vigentes
    if (ve('/ventas/cotizaciones')) {
        fuentes.push(
            prisma.cotizacion
                .findMany({
                    where: { estado: 'VIGENTE', fechaVencimiento: entre },
                    select: { id: true, numero: true, clienteNombre: true, fechaVencimiento: true },
                    take: 500,
                })
                .then((r) => r.map((c) => item('cotizacion', c.id, c.fechaVencimiento!, c.numero, c.clienteNombre, '/ventas/cotizaciones')))
        );
    }

    // Documentos del legajo (apto médico, licencia, ART, habilitaciones) del personal activo
    if (ve('/rrhh/legajo')) {
        fuentes.push(
            prisma.documentoPersonal
                .findMany({
                    where: { fechaVencimiento: entre, operator: { activo: true } },
                    select: { id: true, nombre: true, fechaVencimiento: true, operatorId: true, operator: { select: { nombreCompleto: true } } },
                    take: 500,
                })
                .then((r) => r.map((d) => item('legajo', d.id, d.fechaVencimiento!, d.nombre, d.operator.nombreCompleto, `/rrhh/legajo/${d.operatorId}`)))
        );
    }

    // Órdenes de compra que esperan mercadería (fecha esperada de entrega)
    if (ve('/compras')) {
        fuentes.push(
            prisma.ordenCompra
                .findMany({
                    where: { estado: { in: ['enviada', 'parcial'] }, fechaEsperada: entre },
                    select: { id: true, numero: true, estado: true, fechaEsperada: true, proveedor: { select: { razonSocial: true } } },
                    take: 500,
                })
                .then((r) =>
                    r.map((o) =>
                        item('compra', o.id, o.fechaEsperada!, `${o.numero} · ${o.proveedor.razonSocial}`, o.estado === 'parcial' ? 'Entrega pendiente (recibida en parte)' : 'Entrega pendiente', `/compras?orden=${o.id}`)
                    )
                )
        );
    }

    // Un origen que falla no deja sin calendario a los demás
    const grupos = await Promise.allSettled(fuentes);
    return grupos
        .flatMap((g) => (g.status === 'fulfilled' ? g.value : []))
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.titulo.localeCompare(b.titulo));
}
