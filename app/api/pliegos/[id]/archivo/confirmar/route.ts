import { NextRequest, NextResponse } from 'next/server';
import { confirmarSubida, getActor, prohibido, respuestaError } from '@/lib/pliegosServer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** El navegador terminó de subir el PDF: se verifica tamaño y formato. */
export async function POST(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActor(req);
        if (!actor.puedeGestionar) return prohibido('Solo administración puede subir pliegos.');
        return NextResponse.json(await confirmarSubida(id));
    } catch (error) {
        return respuestaError(error, 'PLIEGO_ARCHIVO_CONFIRMAR', 'Error al verificar el PDF.');
    }
}
