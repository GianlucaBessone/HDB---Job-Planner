import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/materiales-proyecto/devolucion
// Body: { materialId, cantidadADevolver, estado, comentario?, confirmadoPor }
// estado: 'cerrado_ok' | 'cerrado_con_reserva'
export async function POST(req: Request) {
    const body = await req.json();
    const { id, materialId, cantidadADevolver, estado, comentario, confirmadoPor } = body;

    if (!materialId || cantidadADevolver === undefined || !estado) {
        return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // Confirmation logic
    if (estado !== 'pendiente' && !confirmadoPor) {
        return NextResponse.json({ error: 'confirmadoPor es requerido para confirmar la devolución' }, { status: 400 });
    }

    if (estado === 'cerrado_con_reserva' && !comentario?.trim()) {
        return NextResponse.json({ error: 'El comentario es obligatorio al confirmar con reserva' }, { status: 400 });
    }

    const data: any = {
        materialId,
        cantidadADevolver: parseFloat(cantidadADevolver),
        estado,
        comentario: comentario || null,
        confirmadoPor: confirmadoPor || null,
        fechaConfirm: estado !== 'pendiente' ? new Date() : null,
    };

    let devolucion;
    if (id) {
        // Update existing record (e.g. confirming a pending one)
        devolucion = await prisma.materialDevolucion.update({
            where: { id },
            data
        });
    } else {
        // Create new record (request or direct confirmation)
        devolucion = await prisma.materialDevolucion.create({
            data
        });
    }

    // If confirmed, maybe update material state
    if (estado !== 'pendiente') {
        await prisma.materialProyecto.update({
            where: { id: materialId },
            data: { estado }
        });
    }

    // Notify if needed
    const material = await prisma.materialProyecto.findUnique({
        where: { id: materialId },
        include: { proyecto: { select: { nombre: true } } },
    });

    if (material) {
        const supervisors = await prisma.operator.findMany({
            where: { role: { in: ['supervisor', 'admin'] }, activo: true },
            select: { id: true },
        });

        let title = '';
        let message = '';

        if (estado === 'pendiente') {
            title = `Solicitud de devolución – ${material.proyecto.nombre}`;
            message = `El operador solicita devolver ${cantidadADevolver} ${material.unidad} de "${material.nombre}".${comentario ? ` Nota: ${comentario}` : ''}`;
        } else {
            const estadoLabel = estado === 'cerrado_ok' ? 'sin reserva' : 'con reserva';
            title = `Devolución confirmada – ${material.proyecto.nombre}`;
            message = `La devolución de "${material.nombre}" (${cantidadADevolver} ${material.unidad}) fue confirmada por ${confirmadoPor} (${estadoLabel}).${comentario ? ` Observación: ${comentario}` : ''}`;
        }

        await prisma.notification.createMany({
            data: supervisors.map(s => ({
                operatorId: s.id,
                title,
                message,
                type: 'MATERIAL_DEVOLUCION',
                relatedId: material.proyectoId,
            })),
        });
    }

    return NextResponse.json(devolucion, { status: id ? 200 : 201 });
}
