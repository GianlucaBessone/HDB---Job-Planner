import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;

    const existing = await prisma.codigoGasto.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    // Soft delete
    await prisma.codigoGasto.update({
      where: { id },
      data: { activo: false }
    });

    // Auditoria
    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        entity: 'CODIGO_GASTO',
        entityId: id,
        oldValue: JSON.parse(JSON.stringify(existing)),
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting codigo gasto:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
