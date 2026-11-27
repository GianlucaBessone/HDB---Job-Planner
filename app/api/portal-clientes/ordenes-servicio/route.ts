import { NextResponse } from 'next/server';
import { ordenesServicioPortal, responsablePortal, SIN_CACHE } from '@/lib/portalCompleto';

export const dynamic = 'force-dynamic';

/** GET /api/portal-clientes/ordenes-servicio — OS de los proyectos autorizados del responsable. */
export async function GET(req: Request) {
    const r = await responsablePortal(req);
    if (r instanceof NextResponse) return r;
    try {
        return NextResponse.json({ ordenes: await ordenesServicioPortal(r) }, { headers: SIN_CACHE });
    } catch (e) {
        console.error('Error en portal/ordenes-servicio:', e);
        return NextResponse.json({ error: 'No se pudieron cargar las órdenes' }, { status: 500 });
    }
}
