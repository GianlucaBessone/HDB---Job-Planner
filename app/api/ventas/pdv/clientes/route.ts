import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q')?.trim() || '';

    const where: any = { activo: true };
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { telefono: { contains: search, mode: 'insensitive' } },
        { direccion: { contains: search, mode: 'insensitive' } },
      ];
    }

    const clientes = await prisma.hdbClient.findMany({
      where,
      take: 20,
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        email: true,
        telefono: true,
        direccion: true,
        listaPrecioId: true,
        listaPrecio: {
          select: { id: true, nombre: true, codigo: true },
        },
      },
    });

    return NextResponse.json(clientes);
  } catch (error: any) {
    console.error('Error buscando clientes:', error);
    return NextResponse.json(
      { error: 'Error al buscar clientes', details: error.message },
      { status: 500 }
    );
  }
}
