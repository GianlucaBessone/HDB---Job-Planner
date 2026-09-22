import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedResponsible, verifyPassword, getAuthorizedProjectIds } from '@/lib/portalAuth';
import { generateCanonicalHash } from '@/lib/ot/canonicalHash';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthenticatedResponsible(req);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { otIds, tipoCierre, password } = body;

    if (!Array.isArray(otIds) || otIds.length === 0) {
      return NextResponse.json({ error: 'Debe seleccionar al menos una orden de trabajo' }, { status: 400 });
    }

    if (!['INCOMPLETO', 'PARCIAL', 'COMPLETO', 'NORMAL'].includes(tipoCierre)) {
      return NextResponse.json({ error: 'Tipo de cierre inválido (debe ser INCOMPLETO o PARCIAL)' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'Debe ingresar su contraseña para autorizar la firma' }, { status: 400 });
    }

    // 1. Verify password
    const responsable = await prisma.clientResponsable.findUnique({
      where: { id: session.responsibleId },
    });

    if (!responsable || !responsable.passwordHash) {
      return NextResponse.json({ error: 'Responsable inválido o sin clave configurada' }, { status: 401 });
    }

    const isPasswordValid = await verifyPassword(password, responsable.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'La contraseña ingresada es incorrecta' }, { status: 401 });
    }

    // 2. Verify all OTs belong to authorized projects of this client
    const authorizedProjectIds = await getAuthorizedProjectIds(session.responsibleId);

    const ots = await prisma.ordenTrabajo.findMany({
      where: {
        id: { in: otIds },
        clienteId: session.clientId,
      },
      include: {
        cliente: true,
        proyecto: true,
        ciclos: {
          orderBy: { numeroCiclo: 'desc' },
          include: {
            operadores: {
              include: { operador: true },
            },
            materiales: true,
          },
        },
      },
    });

    if (ots.length !== otIds.length) {
      return NextResponse.json(
        { error: 'Una o más órdenes de trabajo no fueron encontradas o no pertenecen a su cuenta' },
        { status: 403 }
      );
    }

    for (const ot of ots) {
      if (!authorizedProjectIds.includes(ot.proyectoId)) {
        return NextResponse.json(
          { error: `No tiene autorización sobre el proyecto de la OT ${ot.numeroOT}` },
          { status: 403 }
        );
      }
      if (ot.estado === 'CERRADA') {
        return NextResponse.json(
          { error: `La orden ${ot.numeroOT} ya se encuentra cerrada` },
          { status: 400 }
        );
      }
    }

    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 3. Atomic Transaction for all selected OTs
    const resultados = await prisma.$transaction(async (tx) => {
      const signedDataList = [];

      for (const ot of ots) {
        // Find latest open cycle
        const activeCycle = ot.ciclos.find((c) => c.estado !== 'FIRMADO') || ot.ciclos[0];
        if (!activeCycle || activeCycle.estado === 'FIRMADO') {
          throw new Error(`La OT ${ot.numeroOT} no posee un ciclo abierto para firmar`);
        }

        // Generate canonical representation and SHA-256 hash
        const { canonicalString, hash } = generateCanonicalHash({
          numeroOT: ot.numeroOT,
          refCliente: ot.refCliente,
          clienteNombre: ot.cliente.nombre,
          proyectoNombre: ot.proyecto.nombre,
          sector: ot.sector,
          reporteTrabajo: ot.reporteTrabajo,
          numeroCiclo: activeCycle.numeroCiclo,
          periodo: activeCycle.periodo,
          tipoCierre,
          firmanteNombre: session.nombre,
          fechaFirma: now,
          operadores: activeCycle.operadores.map((op) => ({
            operadorNombre: op.operador.nombreCompleto,
            horas: op.horas,
            valorHoraSnapshot: op.valorHoraSnapshot,
            costoManoObra: op.costoManoObra,
          })),
          materiales: activeCycle.materiales.map((m) => ({
            materialCodigo: m.materialCodigo,
            descripcion: m.descripcion,
            cantidad: m.cantidad,
            metros: m.metros,
            precioFinalSnapshot: m.precioFinalSnapshot,
            importeTotal: m.importeTotal,
          })),
          totales: {
            totalHoras: activeCycle.totalHoras,
            totalManoObra: activeCycle.totalManoObra,
            totalMateriales: activeCycle.totalMateriales,
            totalGeneral: activeCycle.totalGeneral,
          },
        });

        // Update active cycle to FIRMADO
        await tx.otCiclo.update({
          where: { id: activeCycle.id },
          data: {
            estado: 'FIRMADO',
            fechaFirma: now,
            responsableClienteId: session.responsibleId,
            firmanteNombre: session.nombre,
            tipoCierre,
            hashIntegridad: hash,
            datosCanonicos: canonicalString,
          },
        });

        if (tipoCierre === 'INCOMPLETO' || tipoCierre === 'COMPLETO' || tipoCierre === 'NORMAL') {
          // Close the OT completely
          await tx.ordenTrabajo.update({
            where: { id: ot.id },
            data: {
              estado: 'CERRADA',
              tipoCierre,
              fechaCierre: now,
            },
          });

          await tx.otHistorialEstado.create({
            data: {
              ordenTrabajoId: ot.id,
              estadoAnterior: ot.estado,
              estadoNuevo: 'CERRADA',
              usuarioId: session.responsibleId,
              usuarioNombre: session.nombre,
              motivo: `Cierre firmado por cliente (${tipoCierre}). Hash: ${hash.slice(0, 12)}...`,
            },
          });
        } else if (tipoCierre === 'PARCIAL') {
          // Partial close: OT remains ABIERTA, create next cycle
          await tx.ordenTrabajo.update({
            where: { id: ot.id },
            data: {
              estado: 'ABIERTA',
              tipoCierre: 'PARCIAL',
            },
          });

          const nextNumeroCiclo = activeCycle.numeroCiclo + 1;
          await tx.otCiclo.create({
            data: {
              ordenTrabajoId: ot.id,
              numeroCiclo: nextNumeroCiclo,
              periodo: currentPeriod,
              estado: 'ABIERTO',
            },
          });

          await tx.otHistorialEstado.create({
            data: {
              ordenTrabajoId: ot.id,
              estadoAnterior: ot.estado,
              estadoNuevo: 'ABIERTA',
              usuarioId: session.responsibleId,
              usuarioNombre: session.nombre,
              motivo: `Cierre parcial del Ciclo ${activeCycle.numeroCiclo} firmado. Apertura del Ciclo ${nextNumeroCiclo}. Hash: ${hash.slice(0, 12)}...`,
            },
          });
        }

        signedDataList.push({
          otId: ot.id,
          numeroOT: ot.numeroOT,
          cicloNumero: activeCycle.numeroCiclo,
          hash,
        });
      }

      return signedDataList;
    });

    await logAudit({
      userId: session.responsibleId,
      userName: session.nombre,
      action: 'APPROVE',
      entity: 'PORTAL_FIRMA_CIERRE_CICLO',
      metadata: { tipoCierre, totalOts: otIds.length, resultados },
    });

    return NextResponse.json({
      success: true,
      mensaje: `Se procesó la firma y cierre de ${otIds.length} orden(es) de trabajo exitosamente`,
      tipoCierre,
      firmadas: resultados,
    });
  } catch (error: any) {
    console.error('Error in portal /api/portal-clientes/firmar:', error);
    return NextResponse.json({ error: error.message || 'Error al firmar y cerrar ciclo' }, { status: 500 });
  }
}
