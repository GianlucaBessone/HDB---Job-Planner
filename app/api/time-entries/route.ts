import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';


function calculateHours(start: string, end: string): number {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);

    const startMins = h1 * 60 + m1;
    let endMins = h2 * 60 + m2;

    // if end is before start, assume it means next day (overnight shift)
    if (endMins < startMins) {
        endMins += 24 * 60;
    }

    const diffHours = (endMins - startMins) / 60;
    return Math.round(diffHours * 100) / 100;
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const date = searchParams.get('date');
        const operatorId = searchParams.get('operatorId');
        const projectId = searchParams.get('projectId');

        let where: any = {};
        if (date) where.fecha = date;
        if (operatorId) where.operatorId = operatorId;
        if (projectId) where.projectId = projectId;

        const entries = await prisma.timeEntry.findMany({
            where,
            include: {
                project: { select: { nombre: true, cliente: true } },
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
    try {
        const data = await req.json();

        const { operatorId, projectId, fecha, horaIngreso, horaEgreso, isExtra, requestUserId, requestUserRole } = data;

        if (requestUserRole === 'operador' && requestUserId !== operatorId) {
            return NextResponse.json({ error: 'No tienes permisos para crear registros para otros operadores.' }, { status: 403 });
        }

        let horasTrabajadas = 0;
        if (horaIngreso && horaEgreso) {
            horasTrabajadas = calculateHours(horaIngreso, horaEgreso);
        }

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
        if (horasTrabajadas > 0) {
            await prisma.project.update({
                where: { id: projectId },
                data: { horasConsumidas: { increment: Math.ceil(horasTrabajadas) } }
            });
        }

        return NextResponse.json(entry, { status: 201 });
    } catch (error: any) {
        console.error("POST Error: ", error);
        return NextResponse.json({ error: error?.message || 'Failed to create time entry' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const data = await req.json();
        const { id, horaIngreso, horaEgreso, estadoConfirmado, isExtra, requestUserId, requestUserRole } = data;

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

        let horasTrabajadas = existing.horasTrabajadas;
        let newHoraIngreso = horaIngreso !== undefined ? horaIngreso : existing.horaIngreso;
        let newHoraEgreso = horaEgreso !== undefined ? horaEgreso : existing.horaEgreso;

        if (newHoraIngreso && newHoraEgreso) {
            horasTrabajadas = calculateHours(newHoraIngreso, newHoraEgreso);
        }

        // Calculate delta for project consumed hours update
        const deltaHours = horasTrabajadas - existing.horasTrabajadas;

        const updated = await prisma.timeEntry.update({
            where: { id },
            data: {
                horaIngreso: newHoraIngreso,
                horaEgreso: newHoraEgreso,
                horasTrabajadas,
                isExtra: isExtra !== undefined ? isExtra : existing.isExtra,
                estadoConfirmado: estadoConfirmado !== undefined ? estadoConfirmado : existing.estadoConfirmado,
                confirmadoPorSupervisor: estadoConfirmado ? requestUserId : null
            }
        });

        if (deltaHours !== 0) {
            await prisma.project.update({
                where: { id: existing.projectId },
                data: { horasConsumidas: { increment: Math.ceil(deltaHours) } }
            });
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
            await prisma.project.update({
                where: { id: existing.projectId },
                data: { horasConsumidas: { decrement: Math.ceil(existing.horasTrabajadas) } }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("DELETE Error: ", error);
        return NextResponse.json({ error: error?.message || 'Failed to delete time entry' }, { status: 500 });
    }
}
