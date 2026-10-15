import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q')?.trim() || '';
    const estado = searchParams.get('estado') || undefined; // 'CONFIRMADA' | 'ANULADA'
    const estadoPago = searchParams.get('estadoPago') || undefined; // 'PAGADO' | 'PARCIAL' | 'PENDIENTE'
    const clienteId = searchParams.get('clienteId') || undefined;
    const vendedorId = searchParams.get('vendedorId') || undefined;
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));

    const where: any = {};

    if (estado) where.estado = estado;
    if (estadoPago) where.estadoPago = estadoPago;
    if (clienteId) where.clienteId = clienteId;
    if (vendedorId) where.vendedorId = vendedorId;

    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) where.fecha.gte = new Date(fechaDesde);
      if (fechaHasta) {
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        where.fecha.lte = hasta;
      }
    }

    if (search) {
      where.OR = [
        { numero: { contains: search, mode: 'insensitive' } },
        { clienteNombre: { contains: search, mode: 'insensitive' } },
        { clienteIdentificacion: { contains: search, mode: 'insensitive' } },
        { vendedorNombre: { contains: search, mode: 'insensitive' } },
        { items: { some: { descripcion: { contains: search, mode: 'insensitive' } } } },
        { items: { some: { sku: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [total, ventas] = await Promise.all([
      prisma.venta.count({ where }),
      prisma.venta.findMany({
        where,
        orderBy: { fecha: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          items: true,
          pagos: true,
          remitos: {
            include: {
              items: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          cliente: {
            select: { id: true, nombre: true, email: true, telefono: true, direccion: true },
          },
          vendedor: {
            select: { id: true, nombreCompleto: true, role: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      ventas,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Error listando ventas PDV:', error);
    return NextResponse.json(
      { error: 'Error al listar ventas', details: error.message },
      { status: 500 }
    );
  }
}
