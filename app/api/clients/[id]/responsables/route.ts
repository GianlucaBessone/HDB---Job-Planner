import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateInitialPassword, hashPassword } from '@/lib/portalAuth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: clientId } = params;
    const responsables = await prisma.clientResponsable.findMany({
      where: { clientId },
      include: {
        proyectos: {
          include: {
            project: { select: { id: true, nombre: true, codigoProyecto: true } },
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });
    return NextResponse.json(responsables);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al obtener responsables' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: clientId } = params;
    const body = await req.json();
    const {
      responsableId,
      nombre,
      email,
      cargo,
      portalHabilitado = true,
      proyectosIds = [],
      generarClave = false,
    } = body;

    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre del responsable es requerido' }, { status: 400 });
    }

    let initialPasswordPlain: string | null = null;
    let passwordHash: string | undefined = undefined;

    // Check if new or regenerating password
    if (!responsableId || generarClave) {
      initialPasswordPlain = generateInitialPassword(8);
      passwordHash = await hashPassword(initialPasswordPlain);
    }

    const currentUserId = req.headers.get('x-user-id') || undefined;
    const currentUserName = req.headers.get('x-user-name') || undefined;

    let responsable;

    if (responsableId) {
      // Update existing
      const existing = await prisma.clientResponsable.findUnique({
        where: { id: responsableId },
        include: { proyectos: true },
      });
      if (!existing) return NextResponse.json({ error: 'Responsable no encontrado' }, { status: 404 });

      const updateData: any = {
        nombre: nombre.trim(),
        email: email ? email.trim() : null,
        cargo: cargo ? cargo.trim() : null,
        portalHabilitado: Boolean(portalHabilitado),
      };

      if (passwordHash) {
        updateData.passwordHash = passwordHash;
        updateData.mustChangePassword = true;
      }

      responsable = await prisma.$transaction(async (tx) => {
        const updated = await tx.clientResponsable.update({
          where: { id: responsableId },
          data: updateData,
        });

        // Sync project permissions
        await tx.clientResponsableProyecto.deleteMany({
          where: { responsableId },
        });

        if (Array.isArray(proyectosIds) && proyectosIds.length > 0) {
          await tx.clientResponsableProyecto.createMany({
            data: proyectosIds.map((proyectoId: string) => ({
              responsableId,
              proyectoId,
            })),
            skipDuplicates: true,
          });
        }

        return tx.clientResponsable.findUnique({
          where: { id: responsableId },
          include: {
            proyectos: {
              include: { project: { select: { id: true, nombre: true } } },
            },
          },
        });
      });

      // Audit permission changes
      const oldProjects = existing.proyectos.map((p) => p.proyectoId).sort();
      const newProjects = [...proyectosIds].sort();
      await logAudit({
        userId: currentUserId,
        userName: currentUserName,
        action: 'UPDATE',
        entity: 'CLIENT_RESPONSABLE_PERMISSIONS',
        entityId: responsableId,
        oldValue: { portalHabilitado: existing.portalHabilitado, proyectosIds: oldProjects },
        newValue: { portalHabilitado, proyectosIds: newProjects, claveRegenerada: Boolean(passwordHash) },
      });
    } else {
      // Create new
      responsable = await prisma.$transaction(async (tx) => {
        const created = await tx.clientResponsable.create({
          data: {
            clientId,
            nombre: nombre.trim(),
            email: email ? email.trim() : null,
            cargo: cargo ? cargo.trim() : null,
            portalHabilitado: Boolean(portalHabilitado),
            passwordHash: passwordHash!,
            mustChangePassword: true,
          },
        });

        if (Array.isArray(proyectosIds) && proyectosIds.length > 0) {
          await tx.clientResponsableProyecto.createMany({
            data: proyectosIds.map((proyectoId: string) => ({
              responsableId: created.id,
              proyectoId,
            })),
            skipDuplicates: true,
          });
        }

        return tx.clientResponsable.findUnique({
          where: { id: created.id },
          include: {
            proyectos: {
              include: { project: { select: { id: true, nombre: true } } },
            },
          },
        });
      });

      await logAudit({
        userId: currentUserId,
        userName: currentUserName,
        action: 'CREATE',
        entity: 'CLIENT_RESPONSABLE',
        entityId: responsable!.id,
        newValue: { clientId, nombre: nombre.trim(), portalHabilitado, proyectosIds },
      });
    }

    return NextResponse.json({
      responsable,
      initialPassword: initialPasswordPlain, // Returned once so admin can give it to the client
    });
  } catch (error: any) {
    console.error('Error in POST /api/clients/[id]/responsables:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar responsable' }, { status: 500 });
  }
}
