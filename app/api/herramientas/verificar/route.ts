import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';

export async function POST(req: Request) {
    try {
        const acceso = await exigirAcceso(req);
        if (acceso instanceof NextResponse) return acceso;

        // Quien verifica es siempre el usuario de la sesión (se ignoran operadorId / operadorNombre).
        const operadorId = acceso.userId;
        const operadorNombre = acceso.nombre;
        const { toolId, estado } = await req.json();

        if (!toolId || !estado) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
        }

        if (!['APROBADA', 'RECHAZADA'].includes(estado)) {
            return NextResponse.json({ error: 'Estado inválido. Use APROBADA o RECHAZADA' }, { status: 400 });
        }

        const tool = await prisma.tool.findUnique({ where: { id: toolId } });
        if (!tool) return NextResponse.json({ error: 'Herramienta no encontrada' }, { status: 404 });
        if (!tool.controlActivo) {
            return NextResponse.json({ error: 'Esta herramienta no tiene control activo' }, { status: 400 });
        }

        // Create verification record
        const verificacion = await prisma.toolVerification.create({
            data: {
                toolId,
                operadorId,
                operadorNombre,
                estado,
            }
        });

        // Update tool control fields
        await prisma.tool.update({
            where: { id: toolId },
            data: {
                ultimoControlFecha: new Date(),
                ultimoControlOperador: operadorNombre,
                estadoHerramienta: estado,
            }
        });

        return NextResponse.json(verificacion);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al verificar herramienta', details: e.message }, { status: 500 });
    }
}
