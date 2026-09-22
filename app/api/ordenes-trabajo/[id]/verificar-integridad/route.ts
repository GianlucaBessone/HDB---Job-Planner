import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCycleIntegrity } from '@/lib/ot/canonicalHash';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const { cicloId } = body;

    const ot = await prisma.ordenTrabajo.findUnique({
      where: { id },
      include: {
        ciclos: {
          where: cicloId ? { id: cicloId } : { estado: 'FIRMADO' },
          orderBy: { numeroCiclo: 'asc' },
        },
      },
    });

    if (!ot) return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });

    if (ot.ciclos.length === 0) {
      return NextResponse.json({ error: 'No se encontraron ciclos firmados para verificar' }, { status: 400 });
    }

    const verificationResults = ot.ciclos.map((ciclo) => {
      if (!ciclo.hashIntegridad || !ciclo.datosCanonicos) {
        return {
          cicloId: ciclo.id,
          numeroCiclo: ciclo.numeroCiclo,
          valido: false,
          mensaje: 'El ciclo firmado no posee registro de hash o datos canónicos completos',
        };
      }

      const res = verifyCycleIntegrity(ciclo.hashIntegridad, ciclo.datosCanonicos);
      return {
        cicloId: ciclo.id,
        numeroCiclo: ciclo.numeroCiclo,
        valido: res.valido,
        hashAlmacenado: res.hashAlmacenado,
        hashCalculado: res.hashCalculado,
        firmanteNombre: ciclo.firmanteNombre,
        fechaFirma: ciclo.fechaFirma,
        tipoCierre: ciclo.tipoCierre,
      };
    });

    const allValid = verificationResults.every((r) => r.valido);

    await logAudit({
      userId: req.headers.get('x-user-id') || undefined,
      userName: req.headers.get('x-user-name') || undefined,
      action: 'APPROVE',
      entity: 'OT_VERIFICACION_INTEGRIDAD',
      entityId: id,
      metadata: { allValid, results: verificationResults },
    });

    return NextResponse.json({
      ordenTrabajoId: id,
      numeroOT: ot.numeroOT,
      integridadTotal: allValid,
      resultados: verificationResults,
    });
  } catch (error: any) {
    console.error('Error in POST /api/ordenes-trabajo/[id]/verificar-integridad:', error);
    return NextResponse.json({ error: error.message || 'Error al verificar integridad' }, { status: 500 });
  }
}
