import { NextResponse } from 'next/server';
import { estadoCuentaPortal, responsablePortal, sinPermiso, SIN_CACHE } from '@/lib/portalCompleto';

export const dynamic = 'force-dynamic';

/** GET /api/portal-clientes/estado-cuenta — solo responsables con "Ver el estado de cuenta". */
export async function GET(req: Request) {
    const r = await responsablePortal(req);
    if (r instanceof NextResponse) return r;
    if (!r.verCuentaCorriente) return sinPermiso('No tenés habilitado el estado de cuenta. Pedíselo a HDB.');
    try {
        return NextResponse.json(await estadoCuentaPortal(r), { headers: SIN_CACHE });
    } catch (e) {
        console.error('Error en portal/estado-cuenta:', e);
        return NextResponse.json({ error: 'No se pudo cargar el estado de cuenta' }, { status: 500 });
    }
}
