import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { sendPushNotification } from '@/lib/onesignal';
import type { AccesoSesion } from '@/lib/permisosServer';
import { puedeFuncion, type FuncionId, type PermisoEspecial } from '@/lib/permisos';
import { actualizarRegistro, eliminarRegistro, type CambiosRegistro } from '@/lib/registroHoras';
import { TIPO_SOLICITUD_INFO, type EstadoSolicitud, type SolicitudVista, type TipoSolicitud } from '@/lib/solicitudesTipos';

/**
 * Solicitudes y aprobaciones (auditoría, F8). Antes un pedido de autorización era un aviso con botones: no tenía
 * estado, el solicitante no sabía qué pasó y el cambio lo aplicaba el navegador de quien aprobaba. Ahora:
 *
 * 1. Se crea la solicitud (tipo, objeto, motivo y el cambio propuesto).
 * 2. Llega a la bandeja de quien tiene la función para aprobarla (con aviso).
 * 3. Se aprueba o se rechaza con comentario. Al aprobar una corrección o eliminación de horas, el servidor aplica
 *    el cambio con la misma lógica que la edición directa; una finalización se aprueba al finalizar el proyecto.
 * 4. El solicitante ve el estado en su bandeja (y recibe un aviso).
 */

export class ErrorSolicitud extends Error {
    constructor(mensaje: string, public status = 400) {
        super(mensaje);
    }
}

const fechaCorta = (f: string) => {
    const [a, m, d] = f.split('-');
    return d && m ? `${d}/${m}/${a}` : f;
};

const urlDe = (tipo: string, entidadId: string, extra?: { projectId?: string | null }) =>
    tipo === 'proyecto_finalizar' ? `/projects/ficha/${entidadId}` : `/timesheets${extra?.projectId ? `?proyecto=${extra.projectId}` : ''}`;

/** Personas activas que pueden aprobar con esa función (rol + permisos especiales). */
async function aprobadores(funcion: string, excluir: string): Promise<string[]> {
    const ops = await prisma.operator.findMany({
        where: { activo: true, id: { not: excluir } },
        select: { id: true, role: true, permisosEspeciales: { select: { clave: true, efecto: true } } },
    });
    return ops.filter((o) => puedeFuncion(funcion as FuncionId, o.role, o.permisosEspeciales as PermisoEspecial[])).map((o) => o.id);
}

async function avisar(ids: string[], titulo: string, mensaje: string, solicitudId: string, creador: string) {
    if (ids.length === 0) return;
    await prisma.activity.create({
        data: {
            type: 'SOLICITUD',
            priority: 'HIGH',
            category: 'Solicitudes',
            title: titulo,
            message: mensaje,
            entityType: 'solicitud',
            entityId: solicitudId,
            metadata: { url: `/solicitudes?id=${solicitudId}` },
            createdBy: creador,
            recipients: { create: ids.map((operatorId) => ({ operatorId })) },
        },
    });
    await sendPushNotification({ userIds: ids, title: titulo, message: mensaje, data: { type: 'SOLICITUD', entityId: solicitudId } }).catch(() => {});
}

// ── Crear ────────────────────────────────────────────────────────────────────────────────────────────

export interface NuevaSolicitud {
    tipo: TipoSolicitud;
    entidadId: string;
    motivo: string;
    /** Para horas_modificar: los campos nuevos del registro. */
    cambios?: CambiosRegistro;
}

export async function crearSolicitud(acceso: AccesoSesion, d: NuevaSolicitud) {
    const info = TIPO_SOLICITUD_INFO[d.tipo];
    let resumen: string;

    if (info.entidad === 'timeEntry') {
        const r = await prisma.timeEntry.findUnique({ where: { id: d.entidadId }, include: { project: { select: { nombre: true } } } });
        if (!r) throw new ErrorSolicitud('El registro de horas no existe', 404);
        // Se pide sobre lo propio; quien gestiona horas lo cambia directamente
        if (r.operatorId !== acceso.userId) throw new ErrorSolicitud('Solo podés pedir cambios sobre tus registros', 403);
        if (d.tipo === 'horas_modificar' && (!d.cambios || Object.keys(d.cambios).length === 0)) throw new ErrorSolicitud('Indicá qué hay que corregir');
        const donde = r.causaRegistro ? `Causa: ${r.causaRegistro}` : r.project?.nombre || 'Sin proyecto';
        resumen = `${d.tipo === 'horas_eliminar' ? 'Eliminar' : 'Corregir'} el registro del ${fechaCorta(r.fecha)} (${donde}, ${r.horaIngreso || '?'}–${r.horaEgreso || '?'})`;
    } else {
        const p = await prisma.project.findUnique({ where: { id: d.entidadId }, select: { nombre: true, codigoProyecto: true, estado: true } });
        if (!p) throw new ErrorSolicitud('El proyecto no existe', 404);
        if (p.estado === 'finalizado') throw new ErrorSolicitud('El proyecto ya está finalizado', 409);
        resumen = `Finalizar el proyecto ${p.codigoProyecto ? `${p.codigoProyecto} · ` : ''}${p.nombre}`;
    }

    const repetida = await prisma.solicitud.findFirst({ where: { tipo: d.tipo, entidadId: d.entidadId, estado: 'pendiente' }, select: { id: true } });
    if (repetida) throw new ErrorSolicitud('Ya hay una solicitud pendiente para esto', 409);

    const s = await prisma.solicitud.create({
        data: {
            tipo: d.tipo,
            entidadTipo: info.entidad,
            entidadId: d.entidadId,
            resumen,
            motivo: d.motivo.trim(),
            datos: d.cambios ? (d.cambios as Prisma.InputJsonObject) : undefined,
            funcionAprobar: info.funcion,
            solicitanteId: acceso.userId,
        },
    });
    const ids = await aprobadores(info.funcion, acceso.userId);
    await avisar(ids, `Solicitud: ${info.label}`, `${acceso.nombre} pide: ${resumen}. Motivo: ${d.motivo.trim()}`, s.id, acceso.userId);
    await logAudit({ userId: acceso.userId, userName: acceso.nombre, action: 'CREATE', entity: 'SOLICITUD', entityId: s.id, newValue: { tipo: d.tipo, entidadId: d.entidadId, resumen } });
    return { id: s.id, aprobadores: ids.length };
}

// ── Listar ───────────────────────────────────────────────────────────────────────────────────────────

const INCLUIR = {
    solicitante: { select: { id: true, nombreCompleto: true } },
    resueltoPor: { select: { id: true, nombreCompleto: true } },
} satisfies Prisma.SolicitudInclude;

function vista(s: Prisma.SolicitudGetPayload<{ include: typeof INCLUIR }>, acceso: AccesoSesion, proyectos: Map<string, string | null>): SolicitudVista {
    const pendiente = s.estado === 'pendiente';
    return {
        id: s.id,
        tipo: s.tipo as TipoSolicitud,
        estado: s.estado as EstadoSolicitud,
        resumen: s.resumen,
        motivo: s.motivo,
        datos: (s.datos as Record<string, unknown>) ?? null,
        entidadTipo: s.entidadTipo,
        entidadId: s.entidadId,
        url: urlDe(s.tipo, s.entidadId, { projectId: proyectos.get(s.entidadId) }),
        solicitante: { id: s.solicitante.id, nombre: s.solicitante.nombreCompleto },
        resueltoPor: s.resueltoPor ? { id: s.resueltoPor.id, nombre: s.resueltoPor.nombreCompleto } : null,
        resueltoAt: s.resueltoAt?.toISOString() ?? null,
        comentario: s.comentario,
        createdAt: s.createdAt.toISOString(),
        puedeResolver: pendiente && s.solicitanteId !== acceso.userId && acceso.puede(s.funcionAprobar as FuncionId),
        puedeCancelar: pendiente && s.solicitanteId === acceso.userId,
    };
}

/** Funciones de aprobación que tiene quien mira. */
const funcionesDe = (acceso: AccesoSesion) => Array.from(new Set(Object.values(TIPO_SOLICITUD_INFO).map((i) => i.funcion))).filter((f) => acceso.puede(f as FuncionId));

export async function listarSolicitudes(acceso: AccesoSesion, vistaPedida: 'para_aprobar' | 'mias' | 'resueltas') {
    const funciones = funcionesDe(acceso);
    let where: Prisma.SolicitudWhereInput;
    if (vistaPedida === 'mias') where = { solicitanteId: acceso.userId };
    else if (funciones.length === 0) return [];
    else if (vistaPedida === 'para_aprobar') where = { estado: 'pendiente', funcionAprobar: { in: funciones }, solicitanteId: { not: acceso.userId } };
    else where = { estado: { in: ['aprobada', 'rechazada'] }, funcionAprobar: { in: funciones } };

    const ss = await prisma.solicitud.findMany({ where, include: INCLUIR, orderBy: { createdAt: vistaPedida === 'para_aprobar' ? 'asc' : 'desc' }, take: 200 });
    // Para abrir el registro de horas en su proyecto
    const ids = ss.filter((s) => s.entidadTipo === 'timeEntry').map((s) => s.entidadId);
    const registros = ids.length ? await prisma.timeEntry.findMany({ where: { id: { in: ids } }, select: { id: true, projectId: true } }) : [];
    const proyectos = new Map(registros.map((r) => [r.id, r.projectId]));
    return ss.map((s) => vista(s, acceso, proyectos));
}

/** Cantidad pendiente de aprobar por quien mira (para Inicio). */
export async function pendientesDeAprobar(acceso: AccesoSesion) {
    const funciones = funcionesDe(acceso);
    if (funciones.length === 0) return 0;
    return prisma.solicitud.count({ where: { estado: 'pendiente', funcionAprobar: { in: funciones }, solicitanteId: { not: acceso.userId } } });
}

// ── Resolver ─────────────────────────────────────────────────────────────────────────────────────────

export async function resolverSolicitud(acceso: AccesoSesion, id: string, accion: 'aprobar' | 'rechazar' | 'cancelar', comentario: string | null) {
    const s = await prisma.solicitud.findUnique({ where: { id }, include: { solicitante: { select: { nombreCompleto: true } } } });
    if (!s) throw new ErrorSolicitud('La solicitud no existe', 404);
    if (s.estado !== 'pendiente') throw new ErrorSolicitud('La solicitud ya fue resuelta', 409);

    if (accion === 'cancelar') {
        if (s.solicitanteId !== acceso.userId) throw new ErrorSolicitud('Solo quien la pidió puede cancelarla', 403);
        await prisma.solicitud.update({ where: { id }, data: { estado: 'cancelada', resueltoAt: new Date() } });
        return 'cancelada' as const;
    }

    if (s.solicitanteId === acceso.userId) throw new ErrorSolicitud('No podés resolver tu propia solicitud', 403);
    if (!acceso.puede(s.funcionAprobar as FuncionId)) throw new ErrorSolicitud('No tenés permiso para resolver esta solicitud', 403);
    if (accion === 'rechazar' && !comentario?.trim()) throw new ErrorSolicitud('Contá por qué se rechaza');
    if (accion === 'aprobar' && s.tipo === 'proyecto_finalizar') {
        // Finalizar tiene su propio control (checklist): se aprueba finalizando el proyecto desde su ficha
        throw new ErrorSolicitud('Para aprobarla, finalizá el proyecto desde su ficha', 409);
    }

    // Marca primero (evita que dos personas la resuelvan a la vez) y aplica el cambio
    const ok = await prisma.solicitud.updateMany({
        where: { id, estado: 'pendiente' },
        data: { estado: accion === 'aprobar' ? 'aprobada' : 'rechazada', resueltoPorId: acceso.userId, resueltoAt: new Date(), comentario: comentario?.trim() || null },
    });
    if (ok.count !== 1) throw new ErrorSolicitud('La solicitud ya fue resuelta', 409);

    if (accion === 'aprobar') {
        try {
            const r = await prisma.timeEntry.findUnique({ where: { id: s.entidadId } });
            if (!r) throw new ErrorSolicitud('El registro de horas ya no existe', 409);
            const usuario = { id: acceso.userId, nombre: acceso.nombre };
            if (s.tipo === 'horas_eliminar') await eliminarRegistro(r, usuario);
            else await actualizarRegistro(r, (s.datos as CambiosRegistro) || {}, usuario);
        } catch (e) {
            // No se pudo aplicar: vuelve a pendiente
            await prisma.solicitud.update({ where: { id }, data: { estado: 'pendiente', resueltoPorId: null, resueltoAt: null, comentario: null } });
            throw e;
        }
    }

    await avisar(
        [s.solicitanteId],
        accion === 'aprobar' ? 'Solicitud aprobada' : 'Solicitud rechazada',
        `${s.resumen}: ${accion === 'aprobar' ? 'aprobada' : 'rechazada'} por ${acceso.nombre}${comentario?.trim() ? `. ${comentario.trim()}` : ''}`,
        id,
        acceso.userId
    );
    await logAudit({ userId: acceso.userId, userName: acceso.nombre, action: accion === 'aprobar' ? 'APPROVE' : 'REJECT', entity: 'SOLICITUD', entityId: id, newValue: { tipo: s.tipo, entidadId: s.entidadId, comentario } });
    return accion === 'aprobar' ? ('aprobada' as const) : ('rechazada' as const);
}

/** Al finalizar un proyecto, sus pedidos de finalización pendientes quedan aprobados (y se avisa). */
export async function aprobarFinalizacionesDe(projectId: string, acceso: AccesoSesion) {
    const pend = await prisma.solicitud.findMany({ where: { tipo: 'proyecto_finalizar', entidadId: projectId, estado: 'pendiente' } });
    for (const s of pend) {
        await prisma.solicitud.update({ where: { id: s.id }, data: { estado: 'aprobada', resueltoPorId: acceso.userId, resueltoAt: new Date(), comentario: 'Proyecto finalizado' } });
        await avisar([s.solicitanteId], 'Solicitud aprobada', `${s.resumen}: el proyecto fue finalizado por ${acceso.nombre}`, s.id, acceso.userId);
    }
}
