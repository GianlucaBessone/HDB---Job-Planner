import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const operatorId = searchParams.get('operatorId');

        const whereClause: any = { estado: 'ACTIVO' };
        if (operatorId) {
            whereClause.operatorId = operatorId;
        }

        const activeMovements = await prisma.toolMovement.findMany({
            where: whereClause,
            include: {
                carro: {
                    select: { id: true, nombre: true, tipo: true }
                },
                items: true,
                project: { select: { id: true, nombre: true, codigoProyecto: true } },
                operator: { select: { nombreCompleto: true } }
            },
            orderBy: { fechaSalida: 'desc' }
        });

        // Map to expected format (backward compat)
        const result = activeMovements.map(m => ({
            ...m,
            cart: m.carro,
        }));

        return NextResponse.json(result);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al obtener movimientos activos', details: e.message }, { status: 500 });
    }
}
