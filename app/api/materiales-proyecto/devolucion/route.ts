import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/materiales-proyecto/devolucion
// Body: { materialId, cantidadADevolver, estado, comentario?, confirmadoPor }
// estado: 'cerrado_ok' | 'cerrado_con_reserva'
export async function POST(req: Request) {
    const body = await req.json();
    const { id, materialId, cantidadADevolver, estado, comentario, confirmadoPor, delegadoAId, delegadoANombre, firmaDelegacion, delegadoPorId, delegadoPorNombre } = body;

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
        fechaConfirm: (estado !== 'pendiente' && estado !== 'delegacion_pendiente') ? new Date() : null,
        delegadoAId: delegadoAId || null,
        delegadoANombre: delegadoANombre || null,
        firmaDelegacion: firmaDelegacion || null,
        delegadoPorId: delegadoPorId || null,
        delegadoPorNombre: delegadoPorNombre || null,
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

    // Update material state based on remaining pending returns
    const pendingCount = await prisma.materialDevolucion.count({
        where: {
            materialId,
            estado: { in: ['pendiente', 'delegacion_pendiente', 'delegacion_rechazada'] }
        }
    });

    if (pendingCount > 0) {
        await prisma.materialProyecto.update({
            where: { id: materialId },
            data: { estado: 'pendiente_devolucion' }
        });
    } else if (estado !== 'pendiente') {
        // All returns confirmed. Check if the material is fully returned/accounted for.
        const matDb = await prisma.materialProyecto.findUnique({
            where: { id: materialId },
            include: { usos: true, devoluciones: true }
        });
        if (matDb) {
            const totalUsado = matDb.usos.reduce((acc, u) => acc + u.cantidadUtilizada, 0);
            const totalDevuelto = matDb.devoluciones.filter(d => d.estado === 'cerrado_ok' || d.estado === 'cerrado_con_reserva').reduce((acc, d) => acc + d.cantidadADevolver, 0);
            const aDevolver = Math.max(0, matDb.cantidadEntregada - totalUsado - totalDevuelto);
            if (aDevolver <= 0) {
                await prisma.materialProyecto.update({
                    where: { id: materialId },
                    data: { estado }
                });
            } else {
                await prisma.materialProyecto.update({
                    where: { id: materialId },
                    data: { estado: totalUsado > 0 ? 'uso_confirmado' : 'material_entregado' }
                });
            }
        }
    }

    // Notify if needed
    const material = await prisma.materialProyecto.findUnique({
        where: { id: materialId },
        include: { proyecto: { select: { nombre: true } } },
    });

    if (material) {
        const supervisors = await prisma.operator.findMany({
            where: { role: { in: ['supervisor', 'admin', 'qa'] }, activo: true },
            select: { id: true },
        });

        let title = '';
        let message = '';

        if (estado === 'pendiente') {
            title = `Solicitud de devolución – ${material.proyecto.nombre}`;
            message = `El operador solicita devolver ${cantidadADevolver} ${material.unidad} de "${material.nombre}".${comentario ? ` Nota: ${comentario}` : ''}`;
        } else if (estado === 'delegacion_pendiente') {
            title = `Delegación de devolución – ${material.proyecto.nombre}`;
            message = `${delegadoPorNombre} delegó la devolución de ${cantidadADevolver} ${material.unidad} de "${material.nombre}" a ${delegadoANombre}.`;
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

        // Notify the delegated user specifically
        if (estado === 'delegacion_pendiente' && delegadoAId) {
            await prisma.notification.create({
                data: {
                    operatorId: delegadoAId,
                    title: `Te han delegado materiales`,
                    message: `${delegadoPorNombre} te ha delegado ${cantidadADevolver} ${material.unidad} de "${material.nombre}" en la obra ${material.proyecto.nombre}.`,
                    type: 'DELEGACION_MATERIAL',
                    relatedId: material.proyectoId,
                }
            });

            // Project Log para auditoría
            await prisma.projectLog.create({
                data: {
                    projectId: material.proyectoId,
                    fecha: new Date().toISOString().split('T')[0],
                    responsable: delegadoPorNombre || 'Sistema',
                    observacion: `Delegación de devolución de material:\nMaterial: ${material.nombre}\nCantidad: ${cantidadADevolver} ${material.unidad}\nDelegado a: ${delegadoANombre}`,
                    categoria: 'Nota'
                }
            });
        } else if (id && estado === 'pendiente') {
            // Un delegado aceptó la delegación, pasando el estado a 'pendiente' para almacén
            const acceptedDelegation = await prisma.materialDevolucion.findUnique({ where: { id } }) as any;
            if (acceptedDelegation && acceptedDelegation.delegadoANombre) {
                await prisma.projectLog.create({
                    data: {
                        projectId: material.proyectoId,
                        fecha: new Date().toISOString().split('T')[0],
                        responsable: acceptedDelegation.delegadoANombre,
                        observacion: `El operador aceptó la responsabilidad de devolución delegada por ${acceptedDelegation.delegadoPorNombre}.\nMaterial: ${material.nombre}\nCantidad: ${acceptedDelegation.cantidadADevolver}`,
                        categoria: 'Nota'
                    }
                });
            }
        } else if (id && estado === 'delegacion_rechazada') {
            const rejectedDelegation = await prisma.materialDevolucion.findUnique({ where: { id } }) as any;
            if (rejectedDelegation && rejectedDelegation.delegadoANombre) {
                await prisma.projectLog.create({
                    data: {
                        projectId: material.proyectoId,
                        fecha: new Date().toISOString().split('T')[0],
                        responsable: rejectedDelegation.delegadoANombre,
                        observacion: `El operador rechazó la responsabilidad de devolución delegada por ${rejectedDelegation.delegadoPorNombre}.\nMaterial: ${material.nombre}\nCantidad: ${rejectedDelegation.cantidadADevolver}`,
                        categoria: 'Nota'
                    }
                });
            }
        }
    }

    return NextResponse.json(devolucion, { status: id ? 200 : 201 });
}
