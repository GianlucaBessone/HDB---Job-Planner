import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { texto, usuarioId, usuarioNombre, usuarioRol } = body;

    if (!texto?.trim()) {
      return NextResponse.json({ error: 'El texto del comentario no puede estar vacío' }, { status: 400 });
    }

    const ot = await prisma.ordenTrabajo.findUnique({ where: { id } });
    if (!ot) return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });

    const effectiveUserId = usuarioId || req.headers.get('x-user-id') || null;
    const effectiveUserName = usuarioNombre || req.headers.get('x-user-name') || 'Usuario SGI';
    const effectiveUserRol = usuarioRol || req.headers.get('x-user-role') || 'operador';

    const comentario = await prisma.otComentario.create({
      data: {
        ordenTrabajoId: id,
        usuarioId: effectiveUserId,
        usuarioNombre: effectiveUserName,
        usuarioRol: effectiveUserRol,
        texto: texto.trim(),
      },
    });

    await logAudit({
      userId: effectiveUserId || undefined,
      userName: effectiveUserName,
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
