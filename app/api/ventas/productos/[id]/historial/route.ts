import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const historial = await prisma.productoHistorial.findMany({
      where: { productoId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Populate user names if available
    const userIds = Array.from(new Set(historial.map((h) => h.usuarioId).filter(Boolean))) as string[];
    let userMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const operators = await prisma.operator.findMany({
        where: { id: { in: userIds } },
        select: { id: true, nombreCompleto: true },
      });
      userMap = Object.fromEntries(operators.map((o) => [o.id, o.nombreCompleto]));
    }

    const items = historial.map((h) => ({
      ...h,
      usuarioNombre: h.usuarioNombre || (h.usuarioId ? userMap[h.usuarioId] || 'Usuario' : 'Sistema'),
    }));

    return NextResponse.json(items);
  } catch (error: any) {
    console.error('Error fetching producto historial:', error);
    return NextResponse.json({ error: 'Error al obtener historial', details: error.message }, { status: 500 });
  }
}
