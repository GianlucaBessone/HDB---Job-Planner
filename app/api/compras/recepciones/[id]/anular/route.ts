import { NextResponse } from 'next/server';
import { exigirAcceso } from '@/lib/permisosServer';
import { anularRecepcion } from '@/lib/compras';
import { respuestaError } from '@/lib/comprasApi';

export const dynamic = 'force-dynamic';

/** POST /api/compras/recepciones/[id]/anular — saca del stock lo que había entrado con la recepción. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const acceso = await exigirAcceso(req, ['compras.recibir']);
    if (acceso instanceof NextResponse) return acceso;
    const { id } = await params;
    try {
        const estado = await anularRecepcion(id, { id: acceso.userId, nombre: acceso.nombre });
        return NextResponse.json({ ok: true, estado });
    } catch (error) {
        return respuestaError(error, 'anular recepción');
    }
}
