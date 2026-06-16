import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const proveedorSchema = z.object({
  razonSocial: z.string().min(1),
  nombreFantasia: z.string().optional().nullable(),
  cuit: z.string().min(11),
  condicionIva: z.string().optional().nullable(),
  domicilio: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get('search');

    let whereClause = { activo: true };
    if (search) {
      whereClause = {
        ...whereClause,
        OR: [
          { razonSocial: { contains: search, mode: 'insensitive' } },
          { cuit: { contains: search } },
        ],
      } as any;
    }

    const proveedores = await prisma.proveedor.findMany({
      where: whereClause,
      orderBy: { razonSocial: 'asc' },
    });

    return NextResponse.json(proveedores);
  } catch (error) {
    console.error('Error fetching proveedores:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = proveedorSchema.parse(body);

    // Check for existing CUIT
    const existing = await prisma.proveedor.findUnique({ where: { cuit: data.cuit } });
    if (existing) {
      if (!existing.activo) {
        // reactivate soft-deleted item
        const proveedor = await prisma.proveedor.update({
          where: { id: existing.id },
          data: {
            activo: true,
            razonSocial: data.razonSocial,
            nombreFantasia: data.nombreFantasia ?? null,
            condicionIva: data.condicionIva ?? null,
            domicilio: data.domicilio ?? null
          }
        });
        return NextResponse.json(proveedor, { status: 200 });
      }
      return NextResponse.json({ error: 'Proveedor con este CUIT ya existe', id: existing.id }, { status: 409 });
    }

    const proveedor = await prisma.proveedor.create({ data });
    return NextResponse.json(proveedor, { status: 201 });
  } catch (error: any) {
    console.error('Error creating proveedor:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
