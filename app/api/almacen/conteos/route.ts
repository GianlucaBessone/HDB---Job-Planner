import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { StockService } from '@/lib/inventario/stockService';
import { verificarPermisoInventario } from '@/lib/inventario/permisos';

const conteoCreateSchema = z.object({
  almacenId: z.string().min(1, 'El almacén es obligatorio'),
  ubicacionId: z.string().optional().nullable(),
  tipo: z.enum(['GENERAL', 'UBICACION', 'FAMILIA', 'SELECCION', 'CICLICO']),
  observaciones: z.string().optional(),
  alcance: z.any().optional(),
  productoIds: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = verificarPermisoInventario(req, 'consultar_stock');
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const almacenId = searchParams.get('almacenId') || undefined;
    const estado = searchParams.get('estado') || undefined;
    const tipo = searchParams.get('tipo') || undefined;

    const where: any = {};
    if (almacenId) where.almacenId = almacenId;
    if (estado) where.estado = estado;
    if (tipo) where.tipo = tipo;

    const conteos = await prisma.conteoInventario.findMany({
      where,
      include: {
        almacen: { select: { id: true, nombre: true, codigo: true } },
        ubicacion: { select: { id: true, codigo: true } },
        _count: { select: { detalles: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ conteos });
  } catch (error: any) {
    console.error('Error listando conteos:', error);
    return NextResponse.json(
      { error: error.message || 'Error al listar conteos' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = verificarPermisoInventario(req, 'conteos_crear');
    if (auth.error) return auth.error;

    const body = await req.json();
    const data = conteoCreateSchema.parse(body);

    const result = await StockService.crearConteo({
      almacenId: data.almacenId,
      ubicacionId: data.ubicacionId,
      tipo: data.tipo,
      observaciones: data.observaciones,
      alcance: data.alcance,
      productoIds: data.productoIds,
      usuarioId: auth.usuario?.id,
      usuarioNombre: auth.usuario?.nombreCompleto,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Error creando conteo:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear sesión de conteo' },
      { status: 500 }
    );
  }
}
