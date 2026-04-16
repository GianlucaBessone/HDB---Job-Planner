import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/materiales-proyecto/devolucion
// Body: { materialId, cantidadADevolver, estado, comentario?, confirmadoPor }
// estado: 'cerrado_ok' | 'cerrado_con_reserva'
export async function POST(req: Request) {
    const body = await req.json();
    const { materialId, cantidadADevolver, estado, comentario, confirmadoPor } = body;

    if (!materialId || cantidadADevolver === undefined || !estado || !confirmadoPor) {
        return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }
    if (estado === 'cerrado_con_reserva' && !comentario?.trim()) {
        return NextResponse.json({ error: 'El comentario es obligatorio al confirmar con reserva' }, { status: 400 });
    }

    const [devolucion] = await prisma.$transaction([
        prisma.materialDevolucion.upsert({
            where: { materialId },
            update: {
                cantidadADevolver: parseFloat(cantidadADevolver),
                estado,
                comentario: comentario || null,
                confirmadoPor,
                fechaConfirm: new Date(),
            },
            create: {
                materialId,
                cantidadADevolver: parseFloat(cantidadADevolver),
                estado,
                comentario: comentario || null,
                confirmadoPor,
                fechaConfirm: new Date(),
            },
        }),
        prisma.materialProyecto.update({
            where: { id: materialId },
            data: { estado },
        }),
    ]);

    // Notify supervisors + admins about confirmed devolution
    const material = await prisma.materialProyecto.findUnique({
        where: { id: materialId },
        include: { proyecto: { select: { nombre: true } } },
    });
    if (material) {
        const supervisors = await prisma.operator.findMany({
            where: { role: { in: ['supervisor', 'admin'] }, activo: true },
            select: { id: true },
        });
        const estadoLabel = estado === 'cerrado_ok' ? 'sin reserva' : 'con reserva';
        await prisma.notification.createMany({
            data: supervisors.map(s => ({
                operatorId: s.id,
                title: `Materiales confirmados – ${material.proyecto.nombre}`,
                message: `El material "${material.nombre}" fue confirmado por ${confirmadoPor} (${estadoLabel}).${comentario ? ` Observación: ${comentario}` : ''}`,
                type: 'MATERIAL_DEVOLUCION',
                relatedId: material.proyectoId,
            })),
        });
    }

    return NextResponse.json(devolucion, { status: 201 });
}
