import { NextResponse } from 'next/server';
import { z } from 'zod';
import { exigirAcceso } from '@/lib/permisosServer';
import { vencimientos } from '@/lib/vencimientos';

export const dynamic = 'force-dynamic';

const consultaSchema = z.object({
    desde: z.coerce.number().int().min(-365).max(0).default(-90),
    hasta: z.coerce.number().int().min(0).max(365).default(90),
});

/** GET /api/vencimientos?desde=-90&hasta=90 — calendario único de vencimientos según los accesos de la sesión. */
export async function GET(req: Request) {
    const acceso = await exigirAcceso(req);
    if (acceso instanceof NextResponse) return acceso;
    const sp = new URL(req.url).searchParams;
    const parsed = consultaSchema.safeParse({ desde: sp.get('desde') ?? undefined, hasta: sp.get('hasta') ?? undefined });
    if (!parsed.success) return NextResponse.json({ error: 'Rango inválido' }, { status: 400 });
    try {
        return NextResponse.json({ vencimientos: await vencimientos(acceso, parsed.data.desde, parsed.data.hasta) });
    } catch (error) {
        console.error('Error en vencimientos:', error);
        return NextResponse.json({ error: 'No se pudo cargar el calendario' }, { status: 500 });
    }
}
