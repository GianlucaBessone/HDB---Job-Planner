import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAcceso } from '@/lib/permisosServer';
import { hoyISO } from '@/lib/viajes';
import type { BloqueAgenda, MiDiaRespuesta, PendienteInicio } from '@/lib/inicio';

export const dynamic = 'force-dynamic';

/** Valor de una consulta opcional: si falla (p. ej. tabla que falta), cuenta como vacío. */
async function seguro<T>(p: Promise<T>, vacio: T): Promise<T> {
    try { return await p; } catch (e) { console.error('[INICIO] consulta de pendientes', e); return vacio; }
}

/**
 * Inicio "Mi día": lo que la persona de la sesión tiene que atender hoy.
 * Todo sale del usuario de la sesión; lo que depende de una función (aprobar
 * fichadas, gestionar EPP) solo se cuenta si la tiene.
 */
export async function GET(req: Request) {
    const acceso = await getAcceso(req);
    if (!acceso.userId) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    const userId = acceso.userId;

    const hoy = hoyISO();
    const finDeHoy = new Date(`${hoy}T23:59:59.999-03:00`);
    const ahora = new Date();

    const [
        jornada,
        planning,
        asignaciones,
        fichadasPendientes,
        avisosSinLeer,
        tareasVencidas,
        tareasHoy,
        eppPorFirmar,
        viajesPorRendir,
        capacitaciones,
        solicitudesEpp,
    ] = await Promise.all([
        seguro(prisma.fichada.findFirst({
            where: { operatorId: userId, horaEgreso: null },
            orderBy: { createdAt: 'desc' },
            select: { fecha: true, horaIngreso: true, project: { select: { nombre: true } } },
        }), null),
        seguro(prisma.planning.findUnique({ where: { fecha: hoy } }), null),
        seguro(prisma.proyectoAsignacion.findMany({
            where: { operatorId: userId, fechaDesde: { lte: hoy }, fechaHasta: { gte: hoy } },
            select: { project: { select: { id: true, nombre: true } } },
        }), []),
        acceso.puede('fichadas.aprobar')
            ? seguro(prisma.fichada.count({ where: { status: 'PENDING_APPROVAL' } }), 0)
            : Promise.resolve(0),
        seguro(prisma.activityRecipient.count({ where: { operatorId: userId, readAt: null, archivedAt: null } }), 0),
        seguro(prisma.tarea.count({
            where: {
                estado: { in: ['pendiente', 'en_progreso'] },
                fechaVencimiento: { lt: ahora },
                OR: [{ creadorId: userId }, { involucrados: { some: { operatorId: userId } } }],
            },
        }), 0),
        seguro(prisma.tarea.count({
            where: {
                estado: { in: ['pendiente', 'en_progreso'] },
                fechaVencimiento: { gte: ahora, lte: finDeHoy },
                OR: [{ creadorId: userId }, { involucrados: { some: { operatorId: userId } } }],
            },
        }), 0),
        seguro(prisma.eppDelivery.count({ where: { operatorId: userId, estado: 'PENDIENTE_FIRMA' } }), 0),
        seguro(prisma.viaje.count({ where: { responsableId: userId, estado: 'finalizado' } }), 0),
        seguro(prisma.technicianTraining.count({ where: { operatorId: userId, estado: { in: ['pendiente', 'en_progreso'] } } }), 0),
        acceso.puede('rrhh.epp_gestionar')
            ? seguro(prisma.eppRequest.count({ where: { estado: 'PENDIENTE' } }), 0)
            : Promise.resolve(0),
    ]);

    // Bloques de la agenda de hoy donde figura la persona
    const agenda: BloqueAgenda[] = [];
    const bloques = Array.isArray(planning?.blocks) ? (planning!.blocks as any[]) : [];
    for (const b of bloques) {
        let ids: string[] = [];
        try {
            ids = Array.isArray(b?.operatorIds) ? b.operatorIds : (b?.operatorIds ? JSON.parse(b.operatorIds) : []);
        } catch { ids = []; }
        if (!ids.includes(userId)) continue;
        agenda.push({
            proyecto: b?.projectName || (b?.isNoteOnly ? 'Nota' : 'Sin proyecto'),
            proyectoId: b?.projectId || null,
            inicio: b?.startTime || null,
            fin: b?.endTime || null,
            nota: b?.note || null,
        });
    }
    agenda.sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''));

    const pendientes: PendienteInicio[] = [];
    const agregar = (p: PendienteInicio) => { if (p.cantidad > 0) pendientes.push(p); };

    agregar({ id: 'fichadas', titulo: 'Fichadas a aprobar', detalle: 'Fichadas con alertas que esperan validación', cantidad: fichadasPendientes, href: '/aprobaciones', tono: 'warning' });
    agregar({ id: 'tareas_vencidas', titulo: 'Tareas vencidas', detalle: 'Tareas tuyas que pasaron su fecha', cantidad: tareasVencidas, href: '/tareas', tono: 'danger' });
    agregar({ id: 'tareas_hoy', titulo: 'Tareas para hoy', detalle: 'Vencen antes de que termine el día', cantidad: tareasHoy, href: '/tareas', tono: 'warning' });
    agregar({ id: 'epp_firma', titulo: 'Actas de EPP para firmar', detalle: 'Entregas de elementos de protección sin tu firma', cantidad: eppPorFirmar, href: '/mis-epp', tono: 'warning' });
    agregar({ id: 'viajes', titulo: 'Viajes por rendir', detalle: 'Viajes terminados que esperan la rendición', cantidad: viajesPorRendir, href: '/mis-viajes', tono: 'warning' });
    agregar({ id: 'capacitaciones', titulo: 'Capacitaciones pendientes', detalle: 'Cursos asignados sin completar', cantidad: capacitaciones, href: '/capacitacion', tono: 'info' });
    agregar({ id: 'epp_solicitudes', titulo: 'Solicitudes de EPP', detalle: 'Pedidos del personal sin resolver', cantidad: solicitudesEpp, href: '/rrhh/personal/epp?tab=solicitudes', tono: 'info' });
    agregar({ id: 'avisos', titulo: 'Avisos sin leer', detalle: 'Novedades y pedidos en la campana', cantidad: avisosSinLeer, href: '/notifications', tono: 'brand' });

    const respuesta: MiDiaRespuesta = {
        hoy,
        jornada: jornada ? { fecha: jornada.fecha, horaIngreso: jornada.horaIngreso, proyecto: jornada.project?.nombre ?? null } : null,
        agenda,
        asignaciones: asignaciones.map(a => ({ proyectoId: a.project.id, proyecto: a.project.nombre })),
        pendientes,
    };
    return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'private, no-store' } });
}
