import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CAMPOS_RESPONSABLE, generateInitialPassword, hashPassword } from '@/lib/portalAuth';
import { logAudit } from '@/lib/audit';
import { exigirAcceso } from '@/lib/permisosServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  // Solo quien gestiona clientes; antes cualquier sesión recibía también el hash de la clave del portal
  const acceso = await exigirAcceso(req, ['clientes.gestionar'], 'No tenés permiso para gestionar clientes');
  if (acceso instanceof NextResponse) return acceso;
  try {
    const { id: clientId } = params;
    const responsables = await prisma.clientResponsable.findMany({
      where: { clientId },
      select: {
        ...CAMPOS_RESPONSABLE,
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

export async function POST(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const acceso = await exigirAcceso(req, ['clientes.gestionar'], 'No tenés permiso para gestionar clientes');
    if (acceso instanceof NextResponse) return acceso;

    const { id: clientId } = params;
    const body = await req.json();
    const {
      responsableId,
      nombre,
      email,
      cargo,
      portalHabilitado = true,
      verCuentaCorriente = false,
      aprobarPresupuestos = false,
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

    const currentUserId = acceso.userId;
    const currentUserName = acceso.nombre;

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
        verCuentaCorriente: verCuentaCorriente === true,
        aprobarPresupuestos: aprobarPresupuestos === true,
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
          select: {
            ...CAMPOS_RESPONSABLE,
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
        oldValue: { portalHabilitado: existing.portalHabilitado, verCuentaCorriente: existing.verCuentaCorriente, aprobarPresupuestos: existing.aprobarPresupuestos, proyectosIds: oldProjects },
        newValue: { portalHabilitado, verCuentaCorriente: verCuentaCorriente === true, aprobarPresupuestos: aprobarPresupuestos === true, proyectosIds: newProjects, claveRegenerada: Boolean(passwordHash) },
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
            verCuentaCorriente: verCuentaCorriente === true,
            aprobarPresupuestos: aprobarPresupuestos === true,
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
          select: {
            ...CAMPOS_RESPONSABLE,
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
        newValue: { clientId, nombre: nombre.trim(), portalHabilitado, verCuentaCorriente: verCuentaCorriente === true, aprobarPresupuestos: aprobarPresupuestos === true, proyectosIds },
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
