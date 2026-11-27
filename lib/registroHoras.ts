import type { TimeEntry } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { calculateHours } from '@/lib/timeUtils';

/**
 * Editar y borrar un registro de horas, con el ajuste de las horas consumidas del proyecto y la auditoría. Lo usan
 * la API de registros (`/api/time-entries`) y la aprobación de una solicitud de corrección (`lib/solicitudes.ts`),
 * así los dos caminos hacen exactamente lo mismo. Los permisos se controlan antes de llamar.
 */

export class ErrorRegistro extends Error {
    constructor(mensaje: string, public status = 400) {
        super(mensaje);
    }
}

interface Usuario {
    id: string;
    nombre: string;
}

/** Campos ausentes conservan el valor guardado; null lo borra donde el campo lo admite. */
export interface CambiosRegistro {
    fecha?: string;
    projectId?: string | null;
    proyectoTareaId?: string | null;
    causaRegistro?: string | null;
    horaIngreso?: string | null;
    horaEgreso?: string | null;
    estadoConfirmado?: boolean;
    isExtra?: boolean;
    isDevolucion?: boolean;
    descripcionDevolucion?: string | null;
}

/** Impacto en `Project.horasConsumidas`: horas redondeadas hacia arriba, extras doble, devoluciones no cuentan. */
const impacto = (horas: number, extra: boolean, devolucion: boolean) => (devolucion || horas <= 0 ? 0 : extra ? Math.ceil(horas) * 2 : Math.ceil(horas));

/** La tarea tiene que ser del proyecto del registro (horas reales por tarea). */
export async function tareaDelProyecto(proyectoTareaId: string | null | undefined, projectId: string | null): Promise<string | null> {
    if (!proyectoTareaId) return null;
    if (!projectId) throw new ErrorRegistro('Una tarea solo se indica en un registro de proyecto.');
    const t = await prisma.proyectoTarea.findFirst({ where: { id: proyectoTareaId, projectId }, select: { id: true } });
    if (!t) throw new ErrorRegistro('La tarea no es de ese proyecto.');
    return t.id;
}

export async function actualizarRegistro(existing: TimeEntry, c: CambiosRegistro, usuario: Usuario) {
    if (c.isDevolucion && !(c.descripcionDevolucion ?? existing.descripcionDevolucion)?.trim()) {
        throw new ErrorRegistro('Para tipo DEVOLUCIÓN debe ingresar una descripción obligatoria.');
    }
    const oldProjectId = existing.projectId;
    // Con causa, el registro deja de ser de proyecto
    const newCausa = c.causaRegistro !== undefined ? c.causaRegistro : existing.causaRegistro;
    const newProjectId = newCausa ? null : c.projectId !== undefined ? c.projectId : oldProjectId;
    // La tarea: la enviada o la que tenía, mientras siga siendo del proyecto (si cambia el proyecto, se borra)
    const tareaPedida = c.proyectoTareaId !== undefined ? c.proyectoTareaId : newProjectId === oldProjectId ? existing.proyectoTareaId : null;
    const newTareaId = await tareaDelProyecto(tareaPedida, newProjectId);

    const newHoraIngreso = c.horaIngreso !== undefined ? c.horaIngreso : existing.horaIngreso;
    const newHoraEgreso = c.horaEgreso !== undefined ? c.horaEgreso : existing.horaEgreso;
    const horasTrabajadas = newHoraIngreso && newHoraEgreso ? calculateHours(newHoraIngreso, newHoraEgreso) : existing.horasTrabajadas;
    const newIsDevolucion = c.isDevolucion !== undefined ? c.isDevolucion : existing.isDevolucion;
    // Una devolución nunca es extra
    const newIsExtra = newIsDevolucion ? false : c.isExtra !== undefined ? c.isExtra : existing.isExtra;

    const updated = await prisma.timeEntry.update({
        where: { id: existing.id },
        data: {
            projectId: newProjectId,
            proyectoTareaId: newTareaId,
            causaRegistro: newCausa || null,
            fecha: c.fecha !== undefined ? c.fecha : existing.fecha,
            horaIngreso: newHoraIngreso,
            horaEgreso: newHoraEgreso,
            horasTrabajadas,
            isExtra: newIsExtra,
            isDevolucion: newIsDevolucion,
            descripcionDevolucion: newIsDevolucion
                ? ((c.descripcionDevolucion !== undefined ? c.descripcionDevolucion?.trim() : existing.descripcionDevolucion) || null)
                : null,
            estadoConfirmado: c.estadoConfirmado !== undefined ? c.estadoConfirmado : existing.estadoConfirmado,
            // Solo cambia quién confirmó cuando se confirma o desconfirma; editar no lo borra
            confirmadoPorSupervisor: c.estadoConfirmado === undefined ? existing.confirmadoPorSupervisor : c.estadoConfirmado ? usuario.id : null,
        },
    });

    // Horas consumidas del proyecto
    const antes = impacto(existing.horasTrabajadas, existing.isExtra, existing.isDevolucion);
    const despues = impacto(horasTrabajadas, newIsExtra, newIsDevolucion);
    if (oldProjectId && newProjectId && oldProjectId === newProjectId) {
        if (despues !== antes) await prisma.project.update({ where: { id: oldProjectId }, data: { horasConsumidas: { increment: despues - antes } } });
    } else {
        if (oldProjectId && antes) await prisma.project.update({ where: { id: oldProjectId }, data: { horasConsumidas: { decrement: antes } } });
        if (newProjectId && despues) await prisma.project.update({ where: { id: newProjectId }, data: { horasConsumidas: { increment: despues } } });
    }

    await logAudit({ userId: usuario.id, userName: usuario.nombre, action: 'UPDATE', entity: 'TIME_ENTRY', entityId: existing.id, oldValue: existing, newValue: updated });
    return updated;
}

export async function eliminarRegistro(existing: TimeEntry, usuario: Usuario) {
    await prisma.timeEntry.delete({ where: { id: existing.id } });
    const antes = impacto(existing.horasTrabajadas, existing.isExtra, existing.isDevolucion);
    if (existing.projectId && antes) {
        await prisma.project.update({ where: { id: existing.projectId }, data: { horasConsumidas: { decrement: antes } } });
    }
    await logAudit({ userId: usuario.id, userName: usuario.nombre, action: 'DELETE', entity: 'TIME_ENTRY', entityId: existing.id, oldValue: existing });
}
