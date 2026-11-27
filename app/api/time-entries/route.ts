import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withIdempotency } from '@/lib/idempotency';
import { logAudit } from '@/lib/audit';
import { exigirAcceso } from '@/lib/permisosServer';

import { calculateHours } from '@/lib/timeUtils';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const date = searchParams.get('date');
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const operatorId = searchParams.get('operatorId');
        const projectId = searchParams.get('projectId');

        let where: any = {};
        if (date) where.fecha = date;
        if (from || to) {
            where.fecha = {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {})
            };
        }
        if (operatorId) where.operatorId = operatorId;
        if (projectId) where.projectId = projectId;

        // Exclude legacy punch-in records (they have a deviceId).
        // New punch-ins go to the Fichada table. This ensures time-entries only returns manual entries.
        where.deviceId = null;

        const entries = await prisma.timeEntry.findMany({
            where,
            include: {
                project: { select: { nombre: true, cliente: true, codigoProyecto: true } },
                proyectoTarea: { select: { id: true, descripcion: true } },
                operator: { select: { nombreCompleto: true } }
            },
            orderBy: [{ fecha: 'desc' }, { horaIngreso: 'desc' }]
        });

        // Attach causaRegistro as a virtual display name when no project
        // (it's already in the data from prisma)

        return NextResponse.json(entries);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch time entries' }, { status: 500 });
    }
}

// Formatos que mandan Registro de tiempos y la campana (aprobar una modificación).
const fechaSchema = z.string({ error: 'Falta la fecha' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)');
/** "HH:mm" (o "HH:mm:ss"); vacío o null cuando no hay hora (p. ej. ausencias). */
const horaSchema = z.union([z.literal(''), z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/, 'Hora inválida (HH:mm)')]).nullish();
const idSchema = z.string().trim().max(64);
const textoSchema = z.string().max(2000).nullish();

/** Usuario y rol salen de la sesión: requestUserId / requestUserRole del cuerpo se descartan. */
const postSchema = z.object({
    operatorId: z.string({ error: 'Falta el operador' }).trim().min(1, 'Falta el operador').max(64),
    fecha: fechaSchema,
    projectId: idSchema.nullish(),
    proyectoTareaId: idSchema.nullish(),
    causaRegistro: z.string().trim().max(200).nullish(),
    horaIngreso: horaSchema,
    horaEgreso: horaSchema,
    isExtra: z.boolean().optional(),
    isDevolucion: z.boolean().optional(),
    descripcionDevolucion: textoSchema,
});

/** Campos ausentes conservan el valor guardado; null lo borra donde el campo lo admite. */
const putSchema = z.object({
    id: z.string({ error: 'Falta el id del registro' }).trim().min(1, 'Falta el id del registro').max(64),
    fecha: fechaSchema.optional(),
    projectId: idSchema.nullish(),
    proyectoTareaId: idSchema.nullish(),
    causaRegistro: z.string().trim().max(200).nullish(),
    horaIngreso: horaSchema,
    horaEgreso: horaSchema,
    estadoConfirmado: z.boolean().optional(),
    isExtra: z.boolean().optional(),
    isDevolucion: z.boolean().optional(),
    descripcionDevolucion: textoSchema,
});

/**
 * Horas reales por tarea: la tarea tiene que ser del proyecto del registro. Devuelve el id válido, null o un error.
 */
async function tareaDelProyecto(proyectoTareaId: string | null | undefined, projectId: string | null): Promise<string | null | NextResponse> {
    if (!proyectoTareaId) return null;
    if (!projectId) return NextResponse.json({ error: 'Una tarea solo se indica en un registro de proyecto.' }, { status: 400 });
    const t = await prisma.proyectoTarea.findFirst({ where: { id: proyectoTareaId, projectId }, select: { id: true } });
    if (!t) return NextResponse.json({ error: 'La tarea no es de ese proyecto.' }, { status: 400 });
    return t.id;
}

function datosInvalidos(error: z.ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
}

export async function POST(req: Request) {
    return withIdempotency(req, async () => {
        try {
            // Usuario y permisos salen de la sesión: se ignoran requestUserId / requestUserRole del cuerpo.
            const acceso = await exigirAcceso(req);
            if (acceso instanceof NextResponse) return acceso;
            const gestionaHoras = acceso.puede('timesheets.gestionar_horas');

            const parsed = postSchema.safeParse(await req.json().catch(() => null));
            if (!parsed.success) return datosInvalidos(parsed.error);
            const { operatorId, projectId, proyectoTareaId, causaRegistro, fecha, horaIngreso, horaEgreso, isExtra, isDevolucion, descripcionDevolucion } = parsed.data;

            // DEVOLUCIÓN requires a description
            if (isDevolucion && (!descripcionDevolucion || !descripcionDevolucion.trim())) {
                return NextResponse.json({ error: 'Para tipo DEVOLUCIÓN debe ingresar una descripción obligatoria.' }, { status: 400 });
            }

            if (!operatorId || !fecha) {
                console.error("POST Error: Missing required fields", { operatorId, fecha });
                return NextResponse.json({ error: 'Faltan campos obligatorios (Operador o Fecha).' }, { status: 400 });
            }

            // Must have either project or causa, never both
            if (!projectId && !causaRegistro) {
                return NextResponse.json({ error: 'Debe seleccionar un Proyecto o una Causa.' }, { status: 400 });
            }
            if (projectId && causaRegistro) {
                return NextResponse.json({ error: 'No puede seleccionar Proyecto y Causa simultáneamente.' }, { status: 400 });
            }

            if (!gestionaHoras && operatorId !== acceso.userId) {
                return NextResponse.json({ error: 'No tienes permisos para crear registros para otros operadores.' }, { status: 403 });
            }

            const tareaId = await tareaDelProyecto(proyectoTareaId, projectId || null);
            if (tareaId instanceof NextResponse) return tareaId;

            let horasTrabajadas = 0;
            if (horaIngreso && horaEgreso) {
                horasTrabajadas = calculateHours(horaIngreso, horaEgreso);
            }

            console.log("Creating time entry in Prisma...", { operatorId, projectId, causaRegistro, fecha });
            // When DEVOLUCIÓN, force isExtra to false
            const finalIsExtra = isDevolucion ? false : (isExtra || false);
            const entry = await prisma.timeEntry.create({
                data: {
                    operatorId,
                    projectId: projectId || null,
                    proyectoTareaId: tareaId,
                    causaRegistro: causaRegistro || null,
                    fecha,
                    horaIngreso,
                    horaEgreso,
                    horasTrabajadas,
                    isExtra: finalIsExtra,
                    isDevolucion: isDevolucion || false,
                    descripcionDevolucion: isDevolucion ? (descripcionDevolucion?.trim() || null) : null
                }
            });


            // Also update project total hours roughly, though normally this is kept separate or aggregated upon need.
            // If we want to automatically add consumed hours to the project:
            // Overtime hours (isExtra) count double for project consumption
            // DEVOLUCIÓN hours are NOT counted towards project consumption
            // Only update project hours if linked to a project (not a causa)
            if (horasTrabajadas > 0 && projectId && !isDevolucion) {
                const projectHoursImpact = finalIsExtra ? Math.ceil(horasTrabajadas) * 2 : Math.ceil(horasTrabajadas);
                await prisma.project.update({
                    where: { id: projectId },
                    data: { horasConsumidas: { increment: projectHoursImpact } }
                });
            }

            // Audit
            await logAudit({
                userId: acceso.userId,
                userName: acceso.nombre,
                action: 'CREATE',
                entity: 'TIME_ENTRY',
                entityId: entry.id,
                newValue: entry,
                metadata: { operatorId, projectId, fecha, horaIngreso, horaEgreso, isExtra: finalIsExtra, isDevolucion: isDevolucion || false, descripcionDevolucion, causaRegistro }
            });

            return NextResponse.json(entry, { status: 201 });
        } catch (error: any) {
            console.error("POST Error: ", error);
            return NextResponse.json({ error: error?.message || 'Failed to create time entry' }, { status: 500 });
        }
    });
}


export async function PUT(req: Request) {
    try {
        const acceso = await exigirAcceso(req);
        if (acceso instanceof NextResponse) return acceso;
        const gestionaHoras = acceso.puede('timesheets.gestionar_horas');

        const parsed = putSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return datosInvalidos(parsed.error);
        const { id, projectId, proyectoTareaId, causaRegistro, fecha, horaIngreso, horaEgreso, estadoConfirmado, isExtra, isDevolucion, descripcionDevolucion } = parsed.data;

        // DEVOLUCIÓN requires a description
        if (isDevolucion && (!descripcionDevolucion || !descripcionDevolucion.trim())) {
            return NextResponse.json({ error: 'Para tipo DEVOLUCIÓN debe ingresar una descripción obligatoria.' }, { status: 400 });
        }

        // Check if existing
        const existing = await prisma.timeEntry.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

        if (!gestionaHoras && existing.operatorId !== acceso.userId) {
            return NextResponse.json({ error: 'No tienes permisos para modificar los registros de otros operadores.' }, { status: 403 });
        }

        // Un día ya confirmado solo lo edita quien gestiona horas
        if (existing.estadoConfirmado && !gestionaHoras) {
            return NextResponse.json({ error: 'No tienes permisos para editar un día ya confirmado.' }, { status: 403 });
        }

        const oldProjectId = existing.projectId;
        // Handle causa mode: if causaRegistro is being set, clear projectId
        const newCausa = causaRegistro !== undefined ? causaRegistro : existing.causaRegistro;
        const newProjectId = newCausa ? null : (projectId !== undefined ? projectId : oldProjectId);
        // La tarea: la enviada o la que tenía, siempre que siga siendo del proyecto (si cambia el proyecto, se borra)
        const tareaPedida = proyectoTareaId !== undefined ? proyectoTareaId : newProjectId === oldProjectId ? existing.proyectoTareaId : null;
        const newTareaId = await tareaDelProyecto(tareaPedida, newProjectId);
        if (newTareaId instanceof NextResponse) return newTareaId;

        let horasTrabajadas = existing.horasTrabajadas;
        let newHoraIngreso = horaIngreso !== undefined ? horaIngreso : existing.horaIngreso;
        let newHoraEgreso = horaEgreso !== undefined ? horaEgreso : existing.horaEgreso;

        if (newHoraIngreso && newHoraEgreso) {
            horasTrabajadas = calculateHours(newHoraIngreso, newHoraEgreso);
        }

        // When DEVOLUCIÓN, force isExtra to false
        const newIsDevolucion = isDevolucion !== undefined ? isDevolucion : existing.isDevolucion;
        const finalIsExtraForUpdate = newIsDevolucion ? false : (isExtra !== undefined ? isExtra : existing.isExtra);

        const updated = await prisma.timeEntry.update({
            where: { id },
            data: {
                projectId: newProjectId,
                proyectoTareaId: newTareaId,
                causaRegistro: newCausa || null,
                fecha: fecha !== undefined ? fecha : existing.fecha,
                horaIngreso: newHoraIngreso,
                horaEgreso: newHoraEgreso,
                horasTrabajadas,
                isExtra: finalIsExtraForUpdate,
                isDevolucion: newIsDevolucion,
                descripcionDevolucion: newIsDevolucion ? ((descripcionDevolucion !== undefined ? descripcionDevolucion?.trim() : existing.descripcionDevolucion) || null) : null,
                estadoConfirmado: estadoConfirmado !== undefined ? estadoConfirmado : existing.estadoConfirmado,
                // Solo cambia quién confirmó cuando se confirma o desconfirma; editar no lo borra
                confirmadoPorSupervisor: estadoConfirmado === undefined
                    ? existing.confirmadoPorSupervisor
                    : (estadoConfirmado ? acceso.userId : null)
            }
        });

        // Overtime hours (isExtra) count double for project consumption
        const oldIsExtra = existing.isExtra;
        const newIsExtra = finalIsExtraForUpdate;
        const oldIsDevolucion = existing.isDevolucion;

        // Only adjust project hours when projects are involved
        // DEVOLUCIÓN hours are NOT counted towards project consumption
        if (oldProjectId && newProjectId && oldProjectId === newProjectId) {
            // Same project: compute delta considering overtime multiplier
            const oldProjectImpact = oldIsDevolucion ? 0 : (oldIsExtra ? Math.ceil(existing.horasTrabajadas) * 2 : Math.ceil(existing.horasTrabajadas));
            const newProjectImpact = newIsDevolucion ? 0 : (newIsExtra ? Math.ceil(horasTrabajadas) * 2 : Math.ceil(horasTrabajadas));
            const deltaHours = newProjectImpact - oldProjectImpact;
            if (deltaHours !== 0) {
                await prisma.project.update({
                    where: { id: oldProjectId },
                    data: { horasConsumidas: { increment: deltaHours } }
                });
            }
        } else {
            // Project changed or switched to/from causa
            if (oldProjectId && existing.horasTrabajadas > 0 && !oldIsDevolucion) {
                const oldProjectImpact = oldIsExtra ? Math.ceil(existing.horasTrabajadas) * 2 : Math.ceil(existing.horasTrabajadas);
                await prisma.project.update({
                    where: { id: oldProjectId },
                    data: { horasConsumidas: { decrement: oldProjectImpact } }
                });
            }
            if (newProjectId && horasTrabajadas > 0 && !newIsDevolucion) {
                const newProjectImpact = newIsExtra ? Math.ceil(horasTrabajadas) * 2 : Math.ceil(horasTrabajadas);
                await prisma.project.update({
                    where: { id: newProjectId },
                    data: { horasConsumidas: { increment: newProjectImpact } }
                });
            }
        }

        // Audit
        await logAudit({
            userId: acceso.userId,
            userName: acceso.nombre,
            action: 'UPDATE',
            entity: 'TIME_ENTRY',
            entityId: id,
            oldValue: existing,
            newValue: updated,
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error("PUT Error [Detailed]: ", error, error?.stack);
        return NextResponse.json({ error: error?.message || 'Failed to update time entry' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const acceso = await exigirAcceso(req);
        if (acceso instanceof NextResponse) return acceso;
        const gestionaHoras = acceso.puede('timesheets.gestionar_horas');

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const existing = await prisma.timeEntry.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        if (!gestionaHoras && existing.operatorId !== acceso.userId) {
            return NextResponse.json({ error: 'No tienes permisos para eliminar los registros de otros operadores.' }, { status: 403 });
        }

        if (existing.estadoConfirmado && !gestionaHoras) {
            return NextResponse.json({ error: 'No tienes permisos para eliminar un día ya confirmado.' }, { status: 403 });
        }

        await prisma.timeEntry.delete({ where: { id } });

        // Only decrement project hours if linked to a project (not a causa) and not DEVOLUCIÓN
        if (existing.horasTrabajadas > 0 && existing.projectId && !existing.isDevolucion) {
            const projectHoursImpact = existing.isExtra ? Math.ceil(existing.horasTrabajadas) * 2 : Math.ceil(existing.horasTrabajadas);
            await prisma.project.update({
                where: { id: existing.projectId },
                data: { horasConsumidas: { decrement: projectHoursImpact } }
            });
        }

        // Audit
        await logAudit({
            userId: acceso.userId,
            userName: acceso.nombre,
            action: 'DELETE',
            entity: 'TIME_ENTRY',
            entityId: id,
            oldValue: existing,
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("DELETE Error: ", error);
        return NextResponse.json({ error: error?.message || 'Failed to delete time entry' }, { status: 500 });
    }
}
