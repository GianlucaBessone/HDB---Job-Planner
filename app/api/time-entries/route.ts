import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

// Mapeo simple de roles o PINs. Por simplicidad, se puede validar acá un PIN fijo o implementando el modelo User creado.
// Aquí usamos una validación básica "si envían adminPin correcto, pueden sobreescribir confirmados".
const SUPERVISOR_PIN = process.env.SUPERVISOR_PIN || '1234';

function calculateHours(start: string, end: string): number {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    const date1 = new Date();
    date1.setHours(h1, m1, 0, 0);
    const date2 = new Date();
    date2.setHours(h2, m2, 0, 0);
    // if end is before start, assume it means next day (though usually not the case here)
    if (date2 < date1) date2.setDate(date2.getDate() + 1);

    const diff = (date2.getTime() - date1.getTime()) / (1000 * 60 * 60);
    return Math.round(diff * 100) / 100;
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

        const { operatorId, projectId, fecha, horaIngreso, horaEgreso } = data;

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
                horasTrabajadas
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
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create time entry' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const data = await req.json();
        const { id, horaIngreso, horaEgreso, estadoConfirmado, adminPin } = data;

        // Check if existing
        const existing = await prisma.timeEntry.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

        // If it was already confirmed, require supervisor pin to edit
        if (existing.estadoConfirmado) {
            if (adminPin !== SUPERVISOR_PIN) {
                return NextResponse.json({ error: 'PIN de supervisor incorrecto o faltante. No se puede editar un día ya confirmado.' }, { status: 403 });
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
                estadoConfirmado: estadoConfirmado !== undefined ? estadoConfirmado : existing.estadoConfirmado,
                confirmadoPorSupervisor: estadoConfirmado ? (adminPin ? "Supervisor" : null) : null
            }
        });

        if (deltaHours !== 0) {
            await prisma.project.update({
                where: { id: existing.projectId },
                data: { horasConsumidas: { increment: Math.ceil(deltaHours) } }
            });
        }

        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update time entry' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const adminPin = searchParams.get('adminPin');

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const existing = await prisma.timeEntry.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        if (existing.estadoConfirmado && adminPin !== SUPERVISOR_PIN) {
            return NextResponse.json({ error: 'PIN de supervisor incorrecto. El día está confirmado.' }, { status: 403 });
        }

        await prisma.timeEntry.delete({ where: { id } });

        if (existing.horasTrabajadas > 0) {
            await prisma.project.update({
                where: { id: existing.projectId },
                data: { horasConsumidas: { decrement: Math.ceil(existing.horasTrabajadas) } }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete time entry' }, { status: 500 });
    }
}
