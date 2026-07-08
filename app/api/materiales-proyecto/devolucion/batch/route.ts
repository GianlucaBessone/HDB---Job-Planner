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
            projectName
        } = body;

        if (!delegations || delegations.length === 0 || !estado) {
            return NextResponse.json({ error: 'Faltan campos requeridos o no hay delegaciones' }, { status: 400 });
        }

        // Loop over delegations and create MaterialDevolucion and update MaterialProyecto
        for (const item of delegations) {
            await prisma.materialDevolucion.create({
                data: {
                    materialId: item.materialId,
                    cantidadADevolver: parseFloat(item.cantidadADevolver),
                    estado,
                    comentario: comentario || null,
                    delegadoAId: delegadoAId || null,
                    delegadoANombre: delegadoANombre || null,
                    firmaDelegacion: firmaDelegacion || null,
                    delegadoPorId: delegadoPorId || null,
                    delegadoPorNombre: delegadoPorNombre || null,
                }
            });

            await prisma.materialProyecto.update({
                where: { id: item.materialId },
                data: { estado: 'pendiente_devolucion' }
            });
        }

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
    } catch (e) {
        console.error('Error in batch delegacion:', e);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
