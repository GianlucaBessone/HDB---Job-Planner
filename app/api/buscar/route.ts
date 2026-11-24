import { NextResponse } from 'next/server';
import { z } from 'zod';
import { exigirAcceso } from '@/lib/permisosServer';
import { buscarRegistros } from '@/lib/buscador';

export const dynamic = 'force-dynamic';

const consultaSchema = z.object({ q: z.string().trim().max(100).default('') });

/** GET /api/buscar?q= — búsqueda global de registros para la paleta (P32), según los accesos de la sesión. */
export async function GET(req: Request) {
    const acceso = await exigirAcceso(req);
    if (acceso instanceof NextResponse) return acceso;

    const parsed = consultaSchema.safeParse({ q: new URL(req.url).searchParams.get('q') ?? '' });
    if (!parsed.success) return NextResponse.json({ error: 'Búsqueda inválida' }, { status: 400 });

    try {
        const resultados = await buscarRegistros(acceso, parsed.data.q);
        return NextResponse.json({ resultados });
    } catch (error) {
        console.error('Error en la búsqueda global:', error);
        return NextResponse.json({ error: 'No se pudo buscar' }, { status: 500 });
    }
}
