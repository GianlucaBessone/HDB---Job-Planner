import { NextRequest, NextResponse } from 'next/server';
import { analizarPliego, getActor, prohibido, respuestaError } from '@/lib/pliegosServer';

export const dynamic = 'force-dynamic';
// Un pliego largo puede tardar más de un minuto en la IA (y hay un reintento).
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

/** Analiza el PDF y crea una versión nueva (la primera o un re-análisis). */
export async function POST(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActor(req);
        if (!actor.puedeGestionar) return prohibido('Solo admin y supervisores pueden analizar pliegos.');
        return NextResponse.json(await analizarPliego(id, actor), { status: 201 });
    } catch (error) {
        return respuestaError(error, 'PLIEGO_ANALIZAR', 'Error al analizar el pliego.');
    }
}
