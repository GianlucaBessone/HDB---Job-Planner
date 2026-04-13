import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

export async function POST(req: Request) {
    try {
        const { cartId, operatorId, projectId, tools } = await req.json();
        // tools is array: { nombre, cantidad, isAdditional, presentAtOut }

        if (!cartId || !operatorId || !projectId) {
            return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 });
        }

        // Verify cart availability
        const cart = await prisma.toolCart.findUnique({ where: { id: cartId } });
        if (!cart) return NextResponse.json({ error: 'Carro no encontrado.' }, { status: 404 });
        if (cart.estado !== 'DISPONIBLE') return NextResponse.json({ error: 'El carro no está disponible (estado actual: ' + cart.estado + ').' }, { status: 400 });

        // Create Movement
        const mov = await prisma.toolCartMovement.create({
            data: {
                cartId,
                operatorId,
                projectId,
                estado: 'ACTIVO',
                fechaSalida: new Date(),
                items: {
                    create: tools.map((t: any) => ({
                        nombre: t.nombre,
                        cantidad: t.cantidad || 1,
                        isAdditional: t.isAdditional || false,
                        presentAtOut: t.cantidadOut >= (t.cantidad || 1),
                        cantidadOut: t.cantidadOut || 0
                    }))
                }
            }
        });

        // Mark cart as EN_USO
        await prisma.toolCart.update({
            where: { id: cartId },
            data: { estado: 'EN_USO' }
        });

        // Notify if there are missing tools
        const missingTools = tools.filter((t: any) => t.cantidadOut < (t.cantidad || 1));
        if (missingTools.length > 0) {
            const missingDetails = missingTools.map((t: any) => 
                `${t.nombre} (Tiene: ${t.cantidadOut}, Esperado: ${t.cantidad || 1})`
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
