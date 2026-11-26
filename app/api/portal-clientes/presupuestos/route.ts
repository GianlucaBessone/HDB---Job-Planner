import { NextResponse } from 'next/server';
import { presupuestosPortal, responsablePortal, SIN_CACHE } from '@/lib/portalCompleto';

export const dynamic = 'force-dynamic';

/** GET /api/portal-clientes/presupuestos — presupuestos de servicio enviados al cliente. */
export async function GET(req: Request) {
    const r = await responsablePortal(req);
    if (r instanceof NextResponse) return r;
    try {
        return NextResponse.json({ presupuestos: await presupuestosPortal(r), puedeResponder: r.aprobarPresupuestos }, { headers: SIN_CACHE });
    } catch (e) {
        console.error('Error en portal/presupuestos:', e);
        return NextResponse.json({ error: 'No se pudieron cargar los presupuestos' }, { status: 500 });
    }
}
