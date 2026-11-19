import { NextResponse } from 'next/server';
import { dataLayer } from '@/lib/dataLayer';
import { prisma } from '@/lib/prisma';
import { withIdempotency } from '@/lib/idempotency';
import { exigirAcceso } from '@/lib/permisosServer';

export async function GET(req: Request) {
    const url = new URL(req.url);
    const fecha = url.searchParams.get('fecha');
    if (!fecha) return NextResponse.json({ error: 'Fecha required' }, { status: 400 });
    const planning = await dataLayer.getPlanningByDate(fecha);
    return NextResponse.json(planning || { blocks: [] });
}

// El GET sigue con solo sesión: Fichado lo usa para saber dónde está asignado cada operario.
export async function POST(req: Request) {
    const acceso = await exigirAcceso(req, ['planificacion.gestionar'], 'No tenés permiso para modificar la planificación');
    if (acceso instanceof NextResponse) return acceso;

    return withIdempotency(req, async () => {
        const { fecha, blocks } = await req.json();
        const planning = await dataLayer.savePlanning(fecha, blocks);

        return NextResponse.json(planning);
    });
}

