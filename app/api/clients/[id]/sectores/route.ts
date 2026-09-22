import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: clientId } = params;

    const [sectores, otsWithSector] = await Promise.all([
      prisma.clientSector.findMany({
        where: { clientId },
        include: {
          project: { select: { id: true, nombre: true } },
        },
        orderBy: { nombre: 'asc' },
      }),
      prisma.ordenTrabajo.findMany({
        where: {
          clienteId: clientId,
          sector: { not: null },
        },
        select: {
          sector: true,
          proyectoId: true,
          proyecto: { select: { id: true, nombre: true } },
        },
        distinct: ['sector'],
      }),
    ]);

    const sectorMap = new Map<string, any>();

    sectores.forEach((s) => {
      if (s.nombre?.trim()) {
        sectorMap.set(s.nombre.trim().toLowerCase(), {
          id: s.id,
          nombre: s.nombre.trim(),
          projectId: s.projectId,
          project: s.project,
        });
      }
    });

    otsWithSector.forEach((ot) => {
      if (ot.sector?.trim()) {
        const key = ot.sector.trim().toLowerCase();
        if (!sectorMap.has(key)) {
          sectorMap.set(key, {
            id: `ot-${key}`,
            nombre: ot.sector.trim(),
            projectId: ot.proyectoId,
            project: ot.proyecto,
          });
        }
      }
    });

    const result = Array.from(sectorMap.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al obtener sectores' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: clientId } = params;
    const body = await req.json();
    const { nombre, projectId } = body;

    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre del sector es requerido' }, { status: 400 });
    }

    const sector = await prisma.clientSector.create({
      data: {
        clientId,
        projectId: projectId || null,
        nombre: nombre.trim(),
      },
      include: {
        project: { select: { id: true, nombre: true } },
      },
    });

    await logAudit({
      userId: req.headers.get('x-user-id') || undefined,
      userName: req.headers.get('x-user-name') || undefined,
      action: 'CREATE',
      entity: 'CLIENT_SECTOR',
      entityId: sector.id,
      newValue: { clientId, nombre: nombre.trim(), projectId },
    });

    return NextResponse.json(sector, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/clients/[id]/sectores:', error);
    return NextResponse.json({ error: error.message || 'Error al crear sector' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const sectorId = searchParams.get('sectorId');

    if (!sectorId) return NextResponse.json({ error: 'sectorId es requerido' }, { status: 400 });

    const deleted = await prisma.clientSector.delete({ where: { id: sectorId } });

    await logAudit({
      userId: req.headers.get('x-user-id') || undefined,
      userName: req.headers.get('x-user-name') || undefined,
      action: 'DELETE',
      entity: 'CLIENT_SECTOR',
      entityId: sectorId,
      oldValue: deleted,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/clients/[id]/sectores:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar sector' }, { status: 500 });
  }
}
