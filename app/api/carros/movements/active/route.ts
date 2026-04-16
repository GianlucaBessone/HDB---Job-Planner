import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const operatorId = searchParams.get('operatorId');
        
        let whereClause: any = { estado: 'ACTIVO' };
        if (operatorId) {
            whereClause.operatorId = operatorId;
        }

        const activeMovements = await prisma.toolCartMovement.findMany({
            where: whereClause,
            include: {
                cart: true,
                items: true,
                project: { select: { nombre: true, codigoProyecto: true } },
                operator: { select: { nombreCompleto: true } }
            },
            orderBy: { fechaSalida: 'desc' }
        });

        return NextResponse.json(activeMovements);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al obtener movimientos activos', details: e.message }, { status: 500 });
    }
}
