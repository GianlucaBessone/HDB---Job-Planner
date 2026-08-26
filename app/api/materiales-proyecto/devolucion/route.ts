import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/materiales-proyecto/devolucion
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { id, materialId, cantidadADevolver, estado, comentario, confirmadoPor, delegadoAId, delegadoANombre, firmaDelegacion, delegadoPorId, delegadoPorNombre, operatorId } = body;

        if (!operatorId) {
            return NextResponse.json({ error: 'operatorId es requerido para esta acción' }, { status: 401 });
        }

        const operator = await prisma.operator.findUnique({ where: { id: operatorId, activo: true } });
        if (!operator) {
            return NextResponse.json({ error: 'Operador no válido o inactivo' }, { status: 401 });
        }

        let existingRecord = null;
        if (id) {
            existingRecord = await prisma.materialDevolucion.findUnique({ where: { id } });
            if (!existingRecord) {
                return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
            }
        }

        const finalMaterialId = materialId || existingRecord?.materialId;
        const finalCantidad = cantidadADevolver !== undefined ? parseFloat(cantidadADevolver) : existingRecord?.cantidadADevolver;

        if (!finalMaterialId || finalCantidad === undefined || !estado || isNaN(finalCantidad) || finalCantidad <= 0) {
            return NextResponse.json({ error: 'Faltan campos requeridos o cantidad inválida' }, { status: 400 });
        }

        // --- Role & Identity Validations ---
        if (estado === 'cerrado_ok' || estado === 'cerrado_con_reserva') {
            const allowedRoles = ['supervisor', 'admin', 'qa'];
            if (!allowedRoles.includes(operator.role)) {
                return NextResponse.json({ error: 'No tienes permisos para cerrar una devolución' }, { status: 403 });
            }
            if (!comentario?.trim() && estado === 'cerrado_con_reserva') {
                return NextResponse.json({ error: 'El comentario es obligatorio al confirmar con reserva' }, { status: 400 });
            }
        }

        if (id && (estado === 'pendiente' || estado === 'delegacion_rechazada')) {
            // Aceptando o rechazando delegación
            if (existingRecord?.delegadoAId !== operator.id) {
                return NextResponse.json({ error: 'No tienes permiso para aceptar/rechazar esta delegación' }, { status: 403 });
            }
        }

        if (estado !== 'pendiente' && estado !== 'delegacion_pendiente' && estado !== 'delegacion_rechazada' && !confirmadoPor) {
            return NextResponse.json({ error: 'confirmadoPor es requerido para confirmar la devolución' }, { status: 400 });
        }

        // --- Transaction: Balance Check & DB Updates ---
        const result = await prisma.$transaction(async (tx) => {
            const matDb = await tx.materialProyecto.findUnique({
                where: { id: finalMaterialId },
                include: { usos: true, devoluciones: true }
            });

            if (!matDb) throw new Error('Material no encontrado');

            // Balance check (Only when creating a NEW return or delegation)
            if (!id && (estado === 'pendiente' || estado === 'delegacion_pendiente')) {
                const totalUsado = matDb.usos.reduce((acc, u) => acc + u.cantidadUtilizada, 0);
                const totalDevueltoOk = matDb.devoluciones.filter(d => d.estado === 'cerrado_ok' || d.estado === 'cerrado_con_reserva').reduce((acc, d) => acc + d.cantidadADevolver, 0);
                const pendingDevolucion = matDb.devoluciones.filter(d => d.estado === 'pendiente' || d.estado === 'delegacion_pendiente').reduce((acc, d) => acc + d.cantidadADevolver, 0);
                
                const balance = matDb.cantidadEntregada - totalUsado - totalDevueltoOk - pendingDevolucion;
                const roundedBalance = Math.round(balance * 100) / 100;
                
                if (finalCantidad > roundedBalance) {
                    throw new Error(`Saldo insuficiente. Balance actual: ${roundedBalance}`);
                }
            }

            const data: any = {
                materialId: finalMaterialId,
                cantidadADevolver: finalCantidad,
                estado,
                ...(comentario !== undefined ? { comentario: comentario || null } : {}),
                ...(confirmadoPor !== undefined ? { confirmadoPor: confirmadoPor || null } : {}),
                fechaConfirm: (estado !== 'pendiente' && estado !== 'delegacion_pendiente' && estado !== 'delegacion_rechazada') ? new Date() : null,
                ...(delegadoAId !== undefined ? { delegadoAId: delegadoAId || null } : {}),
                ...(delegadoANombre !== undefined ? { delegadoANombre: delegadoANombre || null } : {}),
                ...(firmaDelegacion !== undefined ? { firmaDelegacion: firmaDelegacion || null } : {}),
                ...(delegadoPorId !== undefined ? { delegadoPorId: delegadoPorId || null } : {}),
                ...(delegadoPorNombre !== undefined ? { delegadoPorNombre: delegadoPorNombre || null } : {}),
            };

            let devolucion;
            if (id) {
                devolucion = await tx.materialDevolucion.update({ where: { id }, data });
            } else {
                devolucion = await tx.materialDevolucion.create({ data });
            }

            // Recalculate material state
            const updatedMat = await tx.materialProyecto.findUnique({
                where: { id: finalMaterialId },
                include: { usos: true, devoluciones: true }
            });

            if (updatedMat) {
                const pendingCount = updatedMat.devoluciones.filter(d => ['pendiente', 'delegacion_pendiente', 'delegacion_rechazada'].includes(d.estado)).length;
                
                if (pendingCount > 0) {
                    await tx.materialProyecto.update({
                        where: { id: finalMaterialId },
                        data: { estado: 'pendiente_devolucion' }
                    });
                } else if (estado !== 'pendiente' && estado !== 'delegacion_pendiente' && estado !== 'delegacion_rechazada') {
                    const totalUsado = updatedMat.usos.reduce((acc, u) => acc + u.cantidadUtilizada, 0);
                    const totalDevuelto = updatedMat.devoluciones.filter(d => d.estado === 'cerrado_ok' || d.estado === 'cerrado_con_reserva').reduce((acc, d) => acc + d.cantidadADevolver, 0);
                    const aDevolver = Math.max(0, updatedMat.cantidadEntregada - totalUsado - totalDevuelto);
                    const roundedADevolver = Math.round(aDevolver * 100) / 100;
                    
                    if (roundedADevolver <= 0) {
                        await tx.materialProyecto.update({
                            where: { id: finalMaterialId },
                            data: { estado }
                        });
                    } else {
                        await tx.materialProyecto.update({
                            where: { id: finalMaterialId },
                            data: { estado: totalUsado > 0 ? 'uso_confirmado' : 'material_entregado' }
                        });
                    }
                }
            }

            return { devolucion, materialInfo: updatedMat };
        });

        // Notifications logic (outside transaction so it doesn't block)
        const material = await prisma.materialProyecto.findUnique({
            where: { id: finalMaterialId },
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
                message = `El operador solicita devolver ${finalCantidad} ${material.unidad} de "${material.nombre}".${comentario ? ` Nota: ${comentario}` : ''}`;
            } else if (estado === 'delegacion_pendiente') {
                title = `Delegación de devolución – ${material.proyecto.nombre}`;
                message = `${delegadoPorNombre} delegó la devolución de ${finalCantidad} ${material.unidad} de "${material.nombre}" a ${delegadoANombre}.`;
            } else {
                const estadoLabel = estado === 'cerrado_ok' ? 'sin reserva' : 'con reserva';
                title = `Devolución confirmada – ${material.proyecto.nombre}`;
                message = `La devolución de "${material.nombre}" (${finalCantidad} ${material.unidad}) fue confirmada por ${confirmadoPor} (${estadoLabel}).${comentario ? ` Observación: ${comentario}` : ''}`;
            }

            if (title && message) {
                 await prisma.activity.create({
                    data: {
                        type: 'MATERIAL_RETURN',
                        priority: 'NORMAL',
                        category: 'Materials',
                        title,
                        message,
                        entityType: 'project',
                        entityId: material.proyectoId,
                        recipients: { create: supervisors.map(s => ({ operatorId: s.id })) }
                    }
                });
            }

            if (estado === 'delegacion_pendiente' && delegadoAId) {
                await prisma.activity.create({
                    data: {
                        type: 'MATERIAL_DELEGATION',
                        priority: 'HIGH',
                        category: 'Materials',
                        title: `Te han delegado materiales`,
                        message: `${delegadoPorNombre} te ha delegado ${finalCantidad} ${material.unidad} de "${material.nombre}" en la obra ${material.proyecto.nombre}.`,
                        entityType: 'project',
                        entityId: material.proyectoId,
                        recipients: { create: [{ operatorId: delegadoAId }] }
                    }
                });

                await prisma.projectLog.create({
                    data: {
                        projectId: material.proyectoId,
                        fecha: new Date().toISOString().split('T')[0],
                        responsable: delegadoPorNombre || 'Sistema',
                        observacion: `Delegación de devolución de material:\nMaterial: ${material.nombre}\nCantidad: ${finalCantidad} ${material.unidad}\nDelegado a: ${delegadoANombre}`,
                        categoria: 'Nota'
                    }
                });
            } else if (id && estado === 'pendiente') {
                if (existingRecord && existingRecord.delegadoANombre) {
                    await prisma.projectLog.create({
                        data: {
                            projectId: material.proyectoId,
                            fecha: new Date().toISOString().split('T')[0],
                            responsable: existingRecord.delegadoANombre,
                            observacion: `El operador aceptó la responsabilidad de devolución delegada por ${existingRecord.delegadoPorNombre}.\nMaterial: ${material.nombre}\nCantidad: ${existingRecord.cantidadADevolver}`,
                            categoria: 'Nota'
                        }
                    });
                }
            } else if (id && estado === 'delegacion_rechazada') {
                if (existingRecord && existingRecord.delegadoANombre) {
                    await prisma.projectLog.create({
                        data: {
                            projectId: material.proyectoId,
                            fecha: new Date().toISOString().split('T')[0],
                            responsable: existingRecord.delegadoANombre,
                            observacion: `El operador rechazó la responsabilidad de devolución delegada por ${existingRecord.delegadoPorNombre}.\nMaterial: ${material.nombre}\nCantidad: ${existingRecord.cantidadADevolver}`,
                            categoria: 'Nota'
                        }
                    });
                }
            }
        }

        return NextResponse.json(result.devolucion, { status: id ? 200 : 201 });
    } catch (e: any) {
        console.error('Error en devolucion:', e);
        return NextResponse.json({ error: e.message || 'Error interno del servidor' }, { status: 400 });
    }
}
