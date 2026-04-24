import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { cartId, operatorId, projectId, tools } = await req.json();

        if (!cartId || !operatorId || !projectId) {
            return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 });
        }

        // Verify cart (Tool with tipo=CARRO) availability
        const cart = await prisma.tool.findUnique({
            where: { id: cartId },
            include: {
                cartMovementsAsCarro: { where: { estado: 'ACTIVO' } },
                herramientas: { where: { activo: true } }
            }
        });

        if (!cart || cart.tipo !== 'CARRO') {
            return NextResponse.json({ error: 'Carro no encontrado.' }, { status: 404 });
        }

        if (cart.cartMovementsAsCarro.length > 0) {
            return NextResponse.json({ error: 'El carro ya tiene un movimiento activo (está en uso).' }, { status: 400 });
        }

        // Create Movement using new ToolMovement model
        const mov = await prisma.toolMovement.create({
            data: {
                carroId: cartId,
                operatorId,
                projectId,
                estado: 'ACTIVO',
                fechaSalida: new Date(),
                items: {
                    create: tools.map((t: any) => ({
                        toolId: t.isAdditional ? null : (t.id || null),
                        nombre: t.nombre,
                        cantidad: t.cantidad || 1,
                        isAdditional: t.isAdditional || false,
                        presentAtOut: (t.cantidadOut || 0) >= (t.cantidad || 1),
                        cantidadOut: t.cantidadOut || 0
                    }))
                }
            }
        });

        // Notify if there are missing tools
        const missingTools = tools.filter((t: any) => (t.cantidadOut || 0) < (t.cantidad || 1));
        if (missingTools.length > 0) {
            const missingDetails = missingTools.map((t: any) =>
                `${t.nombre} (Tiene: ${t.cantidadOut || 0}, Esperado: ${t.cantidad || 1})`
            ).join('\n- ');

            const [op, pb, supers] = await Promise.all([
                prisma.operator.findUnique({ where: { id: operatorId } }),
                prisma.project.findUnique({ where: { id: projectId } }),
                prisma.operator.findMany({ where: { role: 'supervisor', activo: true } })
            ]);

            await prisma.notification.createMany({
                data: supers.map(s => ({
                    operatorId: s.id,
                    title: `Herramientas faltantes - Salida: ${cart.nombre}`,
                    message: `El operador ${op?.nombreCompleto || 'Desconocido'} registró la salida en obra ${pb?.nombre || 'Desconocida'} con faltantes:\n- ${missingDetails}`,
                    type: 'WARNING'
                }))
            });
        }

        return NextResponse.json(mov);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al registrar la salida.', details: e.message }, { status: 500 });
    }
}
