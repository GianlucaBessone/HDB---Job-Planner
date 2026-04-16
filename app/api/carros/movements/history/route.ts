import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const operatorId = searchParams.get('operatorId');
        const projectId = searchParams.get('projectId');
        const cartId = searchParams.get('cartId');
        const toolName = searchParams.get('toolName');

        const whereClause: any = {};

        if (operatorId) whereClause.operatorId = operatorId;
        if (projectId) whereClause.projectId = projectId;
        if (cartId) whereClause.cartId = cartId;
        if (toolName) {
            whereClause.items = {
                some: {
                    nombre: { contains: toolName, mode: 'insensitive' }
                }
            };
        }

        const movements = await prisma.toolCartMovement.findMany({
            where: whereClause,
            include: {
                cart: { select: { id: true, nombre: true } },
                operator: { select: { id: true, nombreCompleto: true } },
                project: { select: { id: true, nombre: true, codigoProyecto: true } },
                items: {
                    orderBy: { nombre: 'asc' }
                }
            },
            orderBy: { fechaSalida: 'desc' },
            take: 200
        });

        return NextResponse.json(movements);
    } catch (e: any) {
        return NextResponse.json(
            { error: 'Error al obtener historial de movimientos', details: e.message },
            { status: 500 }
        );
    }
}
