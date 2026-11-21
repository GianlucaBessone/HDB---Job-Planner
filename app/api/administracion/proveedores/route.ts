import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { exigirAcceso } from '@/lib/permisosServer';
import { comoProveedorGastos, normalizarCuit, proveedorPorCuit } from '@/lib/proveedores';

// Proveedores de Gastos: usan el maestro único de proveedores (`ProveedorVentas`, P24). Las pantallas de
// Gastos siguen recibiendo `domicilio` (en el maestro se llama `direccion`).
const proveedorSchema = z.object({
  razonSocial: z.string().trim().min(1),
  nombreFantasia: z.string().optional().nullable(),
  cuit: z.string().refine((c) => normalizarCuit(c) !== null, 'El CUIT debe tener 11 dígitos'),
  condicionIva: z.string().optional().nullable(),
  domicilio: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const acceso = await exigirAcceso(req, ['gastos.ver', 'gastos.gestionar'], 'No tenés permiso para ver gastos');
    if (acceso instanceof NextResponse) return acceso;

    const search = new URL(req.url).searchParams.get('search')?.trim();
    const where: Prisma.ProveedorVentasWhereInput = { activo: true };
    if (search) {
      const digitos = search.replace(/\D/g, '');
      where.OR = [
        { razonSocial: { contains: search, mode: 'insensitive' } },
        { nombreFantasia: { contains: search, mode: 'insensitive' } },
        { cuit: { contains: search } },
      ];
      // El CUIT se guarda como 30-12345678-9: buscar también por los dígitos escritos sin guiones
      if (digitos.length >= 3 && digitos !== search) where.OR.push({ cuit: { contains: digitos } });
      if (digitos.length === 11) where.OR.push({ cuit: normalizarCuit(digitos)! });
    }

    const proveedores = await prisma.proveedorVentas.findMany({ where, orderBy: { razonSocial: 'asc' } });
    return NextResponse.json(proveedores.map(comoProveedorGastos));
  } catch (error) {
    console.error('Error fetching proveedores:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const acceso = await exigirAcceso(req, ['gastos.gestionar'], 'No tenés permiso para gestionar gastos');
    if (acceso instanceof NextResponse) return acceso;

    const data = proveedorSchema.parse(await req.json());
    const cuit = normalizarCuit(data.cuit)!;
    const datos = {
      razonSocial: data.razonSocial,
      nombreFantasia: data.nombreFantasia || null,
      condicionIva: data.condicionIva || null,
      direccion: data.domicilio || null,
    };

    // Mismo CUIT escrito con o sin guiones: es el mismo proveedor
    const existing = await proveedorPorCuit(prisma, cuit);
    if (existing) {
      if (!existing.activo) {
        const proveedor = await prisma.proveedorVentas.update({ where: { id: existing.id }, data: { ...datos, cuit, activo: true } });
        return NextResponse.json(comoProveedorGastos(proveedor), { status: 200 });
      }
      return NextResponse.json({ error: 'Proveedor con este CUIT ya existe', id: existing.id }, { status: 409 });
    }

    const proveedor = await prisma.proveedorVentas.create({ data: { ...datos, cuit } });
    return NextResponse.json(comoProveedorGastos(proveedor), { status: 201 });
  } catch (error: any) {
    console.error('Error creating proveedor:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
