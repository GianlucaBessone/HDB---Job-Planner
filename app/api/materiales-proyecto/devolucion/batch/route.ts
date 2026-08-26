import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            delegations, // Array of { materialId, cantidadADevolver, materialNombre, unidad }
            estado,
            comentario,
            delegadoAId,
            delegadoANombre,
            firmaDelegacion,
            delegadoPorId,
            delegadoPorNombre,
            projectId,
            projectName,
            operatorId
        } = body;

        if (!operatorId) {
            return NextResponse.json({ error: 'operatorId es requerido para esta acción' }, { status: 401 });
        }

        const operator = await prisma.operator.findUnique({ where: { id: operatorId, activo: true } });
        if (!operator) {
            return NextResponse.json({ error: 'Operador no válido o inactivo' }, { status: 401 });
        }

        if (!delegations || delegations.length === 0 || !estado) {
            return NextResponse.json({ error: 'Faltan campos requeridos o no hay delegaciones' }, { status: 400 });
        }

        // --- Transaction: Balance Check & DB Updates ---
        await prisma.$transaction(async (tx) => {
            for (const item of delegations) {
                const finalCantidad = parseFloat(item.cantidadADevolver);
                if (isNaN(finalCantidad) || finalCantidad <= 0) {
                    throw new Error(`Cantidad inválida para el material ${item.materialNombre}`);
                }

                // Balance check
                const matDb = await tx.materialProyecto.findUnique({
                    where: { id: item.materialId },
                    include: { usos: true, devoluciones: true }
                });

                if (!matDb) throw new Error(`Material no encontrado: ${item.materialNombre}`);

                const totalUsado = matDb.usos.reduce((acc, u) => acc + u.cantidadUtilizada, 0);
                const totalDevueltoOk = matDb.devoluciones.filter(d => d.estado === 'cerrado_ok' || d.estado === 'cerrado_con_reserva').reduce((acc, d) => acc + d.cantidadADevolver, 0);
                const pendingDevolucion = matDb.devoluciones.filter(d => d.estado === 'pendiente' || d.estado === 'delegacion_pendiente').reduce((acc, d) => acc + d.cantidadADevolver, 0);
                
                const balance = matDb.cantidadEntregada - totalUsado - totalDevueltoOk - pendingDevolucion;
                const roundedBalance = Math.round(balance * 100) / 100;

                if (finalCantidad > roundedBalance) {
                    throw new Error(`Saldo insuficiente para ${item.materialNombre}. Balance actual: ${roundedBalance}`);
                }

                await tx.materialDevolucion.create({
                    data: {
                        materialId: item.materialId,
                        cantidadADevolver: finalCantidad,
                        estado,
                        comentario: comentario || null,
                        delegadoAId: delegadoAId || null,
                        delegadoANombre: delegadoANombre || null,
                        firmaDelegacion: firmaDelegacion || null,
                        delegadoPorId: delegadoPorId || null,
                        delegadoPorNombre: delegadoPorNombre || null,
                    }
                });

                await tx.materialProyecto.update({
                    where: { id: item.materialId },
                    data: { estado: 'pendiente_devolucion' }
                });
            }
        });

        const supervisors = await prisma.operator.findMany({
            where: { role: { in: ['supervisor', 'admin', 'qa'] }, activo: true },
            select: { id: true },
        });

        // Notify supervisors
        if (supervisors.length > 0) {
            await prisma.activity.create({
                data: {
                    type: 'MATERIAL_RETURN',
                    priority: 'NORMAL',
                    category: 'Materials',
                    title: `Delegación Masiva – ${projectName}`,
                    message: `${delegadoPorNombre} delegó la devolución de ${delegations.length} materiales a ${delegadoANombre}.`,
                    entityType: 'project',
                    entityId: projectId,
                    recipients: { create: supervisors.map(s => ({ operatorId: s.id })) }
                }
            });
        }

        // Notify delegate
        if (estado === 'delegacion_pendiente' && delegadoAId) {
            await prisma.activity.create({
                data: {
                    type: 'MATERIAL_DELEGATION',
                    priority: 'HIGH',
                    category: 'Materials',
                    title: `Te han delegado múltiples materiales`,
                    message: `${delegadoPorNombre} te ha delegado la devolución de ${delegations.length} materiales en la obra ${projectName}.`,
                    entityType: 'project',
                    entityId: projectId,
                    recipients: { create: [{ operatorId: delegadoAId }] }
                }
            });

            // Project Log para auditoría
            const materialList = delegations.map((d: any) => `- ${d.cantidadADevolver} ${d.unidad} de ${d.materialNombre}`).join('\n');
            await prisma.projectLog.create({
                data: {
                    projectId: projectId,
                    fecha: new Date().toISOString().split('T')[0],
                    responsable: delegadoPorNombre || 'Sistema',
                    observacion: `Delegación masiva de devolución de materiales a ${delegadoANombre}:\n${materialList}`,
                    categoria: 'Nota'
                }
            });
        }

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (e: any) {
        console.error('Error in batch delegacion:', e);
        return NextResponse.json({ error: e.message || 'Error interno del servidor' }, { status: 400 });
    }
}
