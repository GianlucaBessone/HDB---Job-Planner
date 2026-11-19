import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { exigirAcceso } from '@/lib/permisosServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const acceso = await exigirAcceso(req);
    if (acceso instanceof NextResponse) return acceso;

    const { id } = params;
    const comentarios = await prisma.otComentario.findMany({
      where: { ordenTrabajoId: id },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(comentarios);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al obtener comentarios' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const acceso = await exigirAcceso(req);
    if (acceso instanceof NextResponse) return acceso;

    const { id } = params;
    const body = await req.json();
    // Autor, nombre y rol salen de la sesión: usuarioId / usuarioNombre / usuarioRol del cuerpo se ignoran.
    const { texto } = body;

    if (!texto?.trim()) {
      return NextResponse.json({ error: 'El texto del comentario no puede estar vacío' }, { status: 400 });
    }

    const ot = await prisma.ordenTrabajo.findUnique({ where: { id } });
    if (!ot) return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });

    const comentario = await prisma.otComentario.create({
      data: {
        ordenTrabajoId: id,
        usuarioId: acceso.userId,
        usuarioNombre: acceso.nombre,
        usuarioRol: acceso.role,
        texto: texto.trim(),
      },
    });

    await logAudit({
      userId: acceso.userId,
      userName: acceso.nombre,
      action: 'CREATE',
      entity: 'OT_COMENTARIO',
      entityId: comentario.id,
      newValue: { ordenTrabajoId: id, texto: texto.trim() },
    });

    return NextResponse.json(comentario, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/ordenes-trabajo/[id]/comentarios:', error);
    return NextResponse.json({ error: error.message || 'Error al crear comentario' }, { status: 500 });
  }
}
