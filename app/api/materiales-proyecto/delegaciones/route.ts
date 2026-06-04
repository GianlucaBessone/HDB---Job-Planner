import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
        }

        const delegaciones = await prisma.materialDevolucion.findMany({
            where: {
                delegadoAId: userId,
                estado: 'delegacion_pendiente'
            },
            include: {
                material: {
                    include: {
                        proyecto: {
                            select: { nombre: true, codigoProyecto: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(delegaciones);
    } catch (error: any) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
