import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';
import { withIdempotency } from '@/lib/idempotency';


function calculateHours(start: string, end: string): number {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);

    // Round Entry (start) UP to the next multiple of 30 minutes
    const startMinsTotal = h1 * 60 + m1;
    const roundedStartMins = Math.ceil(startMinsTotal / 30) * 30;

    // Round Exit (end) DOWN to the previous multiple of 30 minutes
    let endMinsTotal = h2 * 60 + m2;

    // Handle overnight shifts for the purpose of rounding
    if (endMinsTotal < startMinsTotal) {
        endMinsTotal += 24 * 60;
    }

    const roundedEndMins = Math.floor(endMinsTotal / 30) * 30;

    const diffHours = (roundedEndMins - roundedStartMins) / 60;
    return Math.max(0, Math.round(diffHours * 100) / 100);
}

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
                operator: { select: { nombreCompleto: true } }
            },
            orderBy: [{ fecha: 'desc' }, { horaIngreso: 'desc' }]
        });

        return NextResponse.json(entries);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch time entries' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    return withIdempotency(req, async () => {
        try {
            const data = await req.json();

            const { operatorId, projectId, fecha, horaIngreso, horaEgreso, isExtra, requestUserId, requestUserRole } = data;

            if (!operatorId || !projectId || !fecha) {
                console.error("POST Error: Missing required fields", { operatorId, projectId, fecha });
                return NextResponse.json({ error: 'Faltan campos obligatorios (Operador, Proyecto o Fecha).' }, { status: 400 });
            }

            if (requestUserRole === 'operador' && requestUserId !== operatorId) {
                return NextResponse.json({ error: 'No tienes permisos para crear registros para otros operadores.' }, { status: 403 });
            }

            let horasTrabajadas = 0;
            if (horaIngreso && horaEgreso) {
                horasTrabajadas = calculateHours(horaIngreso, horaEgreso);
            }

            console.log("Creating time entry in Prisma...", { operatorId, projectId, fecha });
            const entry = await prisma.timeEntry.create({
                data: {
                    operatorId,
                    projectId,
                    fecha,
                    horaIngreso,
                    horaEgreso,
                    horasTrabajadas,
                    isExtra: isExtra || false
                }
            });


            // Also update project total hours roughly, though normally this is kept separate or aggregated upon need.
            // If we want to automatically add consumed hours to the project:
            // Overtime hours (isExtra) count double for project consumption
            if (horasTrabajadas > 0) {
                const projectHoursImpact = (isExtra || false) ? Math.ceil(horasTrabajadas) * 2 : Math.ceil(horasTrabajadas);
                await prisma.project.update({
                    where: { id: projectId },
                    data: { horasConsumidas: { increment: projectHoursImpact } }
                });
            }

            return NextResponse.json(entry, { status: 201 });
        } catch (error: any) {
            console.error("POST Error: ", error);
            return NextResponse.json({ error: error?.message || 'Failed to create time entry' }, { status: 500 });
        }
    });
}


export async function PUT(req: Request) {
    try {
        const data = await req.json();
        const { id, projectId, fecha, horaIngreso, horaEgreso, estadoConfirmado, isExtra, requestUserId, requestUserRole } = data;

        // Check if existing
        const existing = await prisma.timeEntry.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

        if (requestUserRole === 'operador' && existing.operatorId !== requestUserId) {
            return NextResponse.json({ error: 'No tienes permisos para modificar los registros de otros operadores.' }, { status: 403 });
        }

        // If it was already confirmed, restrict operators from editing
        if (existing.estadoConfirmado) {
            if (requestUserRole === 'operador') {
                return NextResponse.json({ error: 'No tienes permisos para editar un día ya confirmado.' }, { status: 403 });
            }
        }

        const oldProjectId = existing.projectId;
        const newProjectId = projectId !== undefined ? projectId : oldProjectId;

        let horasTrabajadas = existing.horasTrabajadas;
        let newHoraIngreso = horaIngreso !== undefined ? horaIngreso : existing.horaIngreso;
        let newHoraEgreso = horaEgreso !== undefined ? horaEgreso : existing.horaEgreso;

        if (newHoraIngreso && newHoraEgreso) {
            horasTrabajadas = calculateHours(newHoraIngreso, newHoraEgreso);
        }

        const updated = await prisma.timeEntry.update({
            where: { id },
            data: {
                projectId: newProjectId,
                fecha: fecha !== undefined ? fecha : existing.fecha,
                horaIngreso: newHoraIngreso,
                horaEgreso: newHoraEgreso,
                horasTrabajadas,
                isExtra: isExtra !== undefined ? isExtra : existing.isExtra,
                estadoConfirmado: estadoConfirmado !== undefined ? estadoConfirmado : existing.estadoConfirmado,
                confirmadoPorSupervisor: estadoConfirmado ? requestUserId : null
            }
        });

        // Overtime hours (isExtra) count double for project consumption
        const oldIsExtra = existing.isExtra;
        const newIsExtra = isExtra !== undefined ? isExtra : existing.isExtra;

        if (oldProjectId === newProjectId) {
            // Same project: compute delta considering overtime multiplier
            const oldProjectImpact = oldIsExtra ? Math.ceil(existing.horasTrabajadas) * 2 : Math.ceil(existing.horasTrabajadas);
            const newProjectImpact = newIsExtra ? Math.ceil(horasTrabajadas) * 2 : Math.ceil(horasTrabajadas);
            const deltaHours = newProjectImpact - oldProjectImpact;
            if (deltaHours !== 0) {
                await prisma.project.update({
                    where: { id: oldProjectId },
                    data: { horasConsumidas: { increment: deltaHours } }
                });
            }
        } else {
            // Project changed - remove old impact, add new impact
            if (existing.horasTrabajadas > 0) {
                const oldProjectImpact = oldIsExtra ? Math.ceil(existing.horasTrabajadas) * 2 : Math.ceil(existing.horasTrabajadas);
                await prisma.project.update({
                    where: { id: oldProjectId },
                    data: { horasConsumidas: { decrement: oldProjectImpact } }
                });
            }
            if (horasTrabajadas > 0) {
                const newProjectImpact = newIsExtra ? Math.ceil(horasTrabajadas) * 2 : Math.ceil(horasTrabajadas);
                await prisma.project.update({
                    where: { id: newProjectId },
                    data: { horasConsumidas: { increment: newProjectImpact } }
                });
            }
        }

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error("PUT Error: ", error);
        return NextResponse.json({ error: error?.message || 'Failed to update time entry' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const requestUserId = searchParams.get('requestUserId');
        const requestUserRole = searchParams.get('requestUserRole');

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const existing = await prisma.timeEntry.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        if (requestUserRole === 'operador' && existing.operatorId !== requestUserId) {
            return NextResponse.json({ error: 'No tienes permisos para eliminar los registros de otros operadores.' }, { status: 403 });
        }

        if (existing.estadoConfirmado) {
            if (requestUserRole === 'operador') {
                return NextResponse.json({ error: 'No tienes permisos para eliminar un día ya confirmado.' }, { status: 403 });
            }
        }

        await prisma.timeEntry.delete({ where: { id } });

        if (existing.horasTrabajadas > 0) {
            // Overtime hours (isExtra) count double for project consumption
            const projectHoursImpact = existing.isExtra ? Math.ceil(existing.horasTrabajadas) * 2 : Math.ceil(existing.horasTrabajadas);
            await prisma.project.update({
                where: { id: existing.projectId },
                data: { horasConsumidas: { decrement: projectHoursImpact } }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("DELETE Error: ", error);
        return NextResponse.json({ error: error?.message || 'Failed to delete time entry' }, { status: 500 });
    }
}
