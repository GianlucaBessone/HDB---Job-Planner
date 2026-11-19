import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { exigirAcceso } from '@/lib/permisosServer';

const codigoGastoSchema = z.object({
  codigo: z.string().min(1),
  descripcion: z.string().min(1),
});

export async function GET(req: NextRequest) {
  try {
    const acceso = await exigirAcceso(req, ['gastos.ver', 'gastos.gestionar'], 'No tenés permiso para ver gastos');
    if (acceso instanceof NextResponse) return acceso;

    const codigos = await prisma.codigoGasto.findMany({
      where: { activo: true },
      orderBy: { codigo: 'asc' },
    });
    return NextResponse.json(codigos);
  } catch (error) {
    console.error('Error fetching codigos de gasto:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const acceso = await exigirAcceso(req, ['gastos.gestionar'], 'No tenés permiso para gestionar gastos');
    if (acceso instanceof NextResponse) return acceso;

    const body = await req.json();
    const data = codigoGastoSchema.parse(body);

    const existing = await prisma.codigoGasto.findUnique({ where: { codigo: data.codigo } });
    if (existing) {
      if (!existing.activo) {
        // reactivate soft-deleted item
        const codigo = await prisma.codigoGasto.update({
          where: { id: existing.id },
          data: { activo: true, descripcion: data.descripcion }
        });
        return NextResponse.json(codigo, { status: 200 });
      }
      return NextResponse.json({ error: 'El código ya existe' }, { status: 409 });
    }

    const codigo = await prisma.codigoGasto.create({ data });
    return NextResponse.json(codigo, { status: 201 });
  } catch (error: any) {
    console.error('Error creating codigo gasto:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
