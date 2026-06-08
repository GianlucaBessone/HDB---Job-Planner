import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    try {
        const body = await req.json();
        
        const operatorIds = Array.isArray(body.participantes) ? body.participantes : [];
        const operators = await prisma.operator.findMany({
            where: { id: { in: operatorIds } },
            select: { nombreCompleto: true }
        });
        const participantesNombres = operators.map(op => op.nombreCompleto);

        const reunion = await prisma.reunionNC.update({
            where: { id: params.id },
            data: {
                fecha: body.fecha ? new Date(body.fecha) : undefined,
                agenda: body.agenda,
                participantes: participantesNombres, // Storing names, or we can store IDs if we prefer. Let's stick to names as it is now.
                acta: body.acta
            }
        });

        return NextResponse.json(reunion);
    } catch (error) {
        console.error('Error updating Reunion NC:', error);
        return NextResponse.json({ error: 'Error al actualizar la reunión' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        await prisma.reunionNC.delete({
            where: { id: params.id }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting Reunion NC:', error);
        return NextResponse.json({ error: 'Error al eliminar la reunión' }, { status: 500 });
    }
}
