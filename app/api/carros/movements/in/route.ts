import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { movementId, tools } = await req.json();

        if (!movementId) return NextResponse.json({ error: 'Falta el ID del movimiento.' }, { status: 400 });

        const mov = await prisma.toolMovement.findUnique({
            where: { id: movementId },
            include: { carro: true }
        });

        if (!mov) return NextResponse.json({ error: 'Movimiento no encontrado.' }, { status: 404 });
        if (mov.estado !== 'ACTIVO') return NextResponse.json({ error: 'El movimiento ya fue cerrado.' }, { status: 400 });

        // Update items
        const updatePromises = tools.map((t: any) =>
            prisma.toolMovementItem.update({
                where: { id: t.id },
                data: {
                    cantidadIn: t.cantidadIn,
                    presentAtIn: (t.cantidadIn || 0) >= (t.expectedQty || t.cantidad || 1)
                }
            })
        );
        await Promise.all(updatePromises);

        // Update movement
        const updatedMov = await prisma.toolMovement.update({
            where: { id: movementId },
            data: {
                estado: 'COMPLETADO',
                fechaDevolucion: new Date()
            }
        });

        // Notify missing tools
        const missing = tools.filter((t: any) => (t.cantidadIn || 0) < (t.expectedQty || t.cantidad || 1));
        if (missing.length > 0) {
            const missingDetails = missing.map((t: any) =>
                `${t.nombre} (Devolvió: ${t.cantidadIn || 0}, Esperado: ${t.expectedQty || t.cantidad || 1})`
            ).join('\n- ');

            const [op, pb, supers] = await Promise.all([
                prisma.operator.findUnique({ where: { id: mov.operatorId } }),
                prisma.project.findUnique({ where: { id: mov.projectId } }),
                prisma.operator.findMany({ where: { role: 'supervisor', activo: true } })
            ]);

            await prisma.notification.createMany({
                data: supers.map(s => ({
                    operatorId: s.id,
                    title: `Herramientas faltantes - Devolución: ${mov.carro.nombre}`,
                    message: `El operador ${op?.nombreCompleto || 'Desconocido'} reportó faltantes al devolver desde la obra ${pb?.nombre || 'Desconocida'}:\n- ${missingDetails}`,
                    type: 'WARNING'
                }))
            });
        }

        return NextResponse.json(updatedMov);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al registrar devolución.', details: e.message }, { status: 500 });
    }
}
