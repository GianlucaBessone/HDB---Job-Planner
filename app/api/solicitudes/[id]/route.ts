import { NextResponse } from 'next/server';
import { z } from 'zod';
import { exigirAcceso } from '@/lib/permisosServer';
import { ErrorSolicitud, resolverSolicitud } from '@/lib/solicitudes';
import { ErrorRegistro } from '@/lib/registroHoras';

export const dynamic = 'force-dynamic';

const schema = z.object({ accion: z.enum(['aprobar', 'rechazar', 'cancelar']), comentario: z.string().trim().max(2000).nullish() });

/** PATCH /api/solicitudes/[id] — aprobar (aplica el cambio), rechazar con comentario o cancelar la propia. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const acceso = await exigirAcceso(req);
    if (acceso instanceof NextResponse) return acceso;
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
    try {
        const estado = await resolverSolicitud(acceso, id, parsed.data.accion, parsed.data.comentario ?? null);
        return NextResponse.json({ estado });
    } catch (e) {
        if (e instanceof ErrorSolicitud || e instanceof ErrorRegistro) return NextResponse.json({ error: e.message }, { status: e.status });
        console.error('Error en solicitudes (PATCH):', e);
        return NextResponse.json({ error: 'No se pudo resolver la solicitud' }, { status: 500 });
    }
}
