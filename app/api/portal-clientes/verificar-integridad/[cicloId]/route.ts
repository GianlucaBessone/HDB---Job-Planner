import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedResponsible, checkResponsibleProjectAccess } from '@/lib/portalAuth';
import { verifyCycleIntegrity } from '@/lib/ot/canonicalHash';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { cicloId: string } }
) {
  try {
    const session = await getAuthenticatedResponsible(req);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { cicloId } = params;

    const ciclo = await prisma.otCiclo.findUnique({
      where: { id: cicloId },
      include: {
        ordenTrabajo: {
          select: { id: true, numeroOT: true, clienteId: true, proyectoId: true },
        },
      },
    });

    if (!ciclo) return NextResponse.json({ error: 'Ciclo no encontrado' }, { status: 404 });

    if (ciclo.ordenTrabajo.clienteId !== session.clientId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const hasAccess = await checkResponsibleProjectAccess(session.responsibleId, ciclo.ordenTrabajo.proyectoId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'No tiene permiso para auditar este proyecto' }, { status: 403 });
    }

    if (!ciclo.hashIntegridad || !ciclo.datosCanonicos) {
      return NextResponse.json({
        valido: false,
        mensaje: 'El ciclo no cuenta con un hash criptográfico sellado',
      });
    }

    const result = verifyCycleIntegrity(ciclo.hashIntegridad, ciclo.datosCanonicos);

    return NextResponse.json({
      cicloId,
      numeroOT: ciclo.ordenTrabajo.numeroOT,
      valido: result.valido,
      hashAlmacenado: result.hashAlmacenado,
      hashCalculado: result.hashCalculado,
      firmanteNombre: ciclo.firmanteNombre,
      fechaFirma: ciclo.fechaFirma,
      tipoCierre: ciclo.tipoCierre,
    });
  } catch (error: any) {
    console.error('Error verifying integrity in portal:', error);
    return NextResponse.json({ error: error.message || 'Error al verificar integridad' }, { status: 500 });
  }
}
