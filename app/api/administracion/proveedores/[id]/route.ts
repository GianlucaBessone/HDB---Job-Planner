import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';

export async function DELETE(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const acceso = await exigirAcceso(req, ['gastos.gestionar'], 'No tenés permiso para gestionar gastos');
    if (acceso instanceof NextResponse) return acceso;

    const id = params.id;

    const existing = await prisma.proveedorVentas.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    // Soft delete
    await prisma.proveedorVentas.update({
      where: { id },
      data: { activo: false }
    });

    // Auditoria
    await prisma.auditLog.create({
      data: {
        userId: acceso.userId,
        userName: acceso.nombre,
        action: 'DELETE',
        entity: 'PROVEEDOR',
        entityId: id,
        oldValue: JSON.parse(JSON.stringify(existing)),
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting proveedor:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
