import { NextRequest, NextResponse } from 'next/server';
import { getActor, noEncontrado, prohibido, respuestaError, urlDescarga, urlSubida } from '@/lib/pliegosServer';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** Abre el PDF: redirige a una URL prefirmada del almacenamiento (5 minutos). */
export async function GET(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActor(req);
        if (!actor.puedeVer) return prohibido();
        const url = await urlDescarga(id);
        if (!url) return noEncontrado('El PDF no está disponible.');
        return NextResponse.redirect(url, 302);
    } catch (error) {
        return respuestaError(error, 'PLIEGO_ARCHIVO_GET', 'Error al abrir el PDF.');
    }
}

/** Nueva URL de subida (por ejemplo, si la anterior venció o la subida se cortó). */
export async function POST(req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const actor = await getActor(req);
        if (!actor.puedeGestionar) return prohibido('Solo administración puede subir pliegos.');
        return NextResponse.json(await urlSubida(id));
    } catch (error) {
        return respuestaError(error, 'PLIEGO_ARCHIVO_POST', 'Error al preparar la subida.');
    }
}
