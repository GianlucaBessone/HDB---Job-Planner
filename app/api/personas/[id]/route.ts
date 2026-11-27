import { NextResponse } from 'next/server';
import { exigirAcceso } from '@/lib/permisosServer';
import { fichaPersona, puedeVerFicha } from '@/lib/fichaPersona';

export const dynamic = 'force-dynamic';

/**
 * GET /api/personas/[id] — ficha única de la persona (P16). `yo` es la propia. Cada sección viene solo si quien
 * mira puede abrir su módulo; la propia ficha se ve en solo lectura.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const acceso = await exigirAcceso(req);
    if (acceso instanceof NextResponse) return acceso;
    const { id: param } = await params;
    const id = param === 'yo' ? acceso.userId : param;
    if (!(await puedeVerFicha(acceso, id))) return NextResponse.json({ error: 'No tenés acceso a la ficha de esta persona' }, { status: 403 });
    try {
        const ficha = await fichaPersona(acceso, id);
        if (!ficha) return NextResponse.json({ error: 'La persona no existe' }, { status: 404 });
        return NextResponse.json({ ficha }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) {
        console.error('Error en ficha de la persona:', e);
        return NextResponse.json({ error: 'No se pudo cargar la ficha' }, { status: 500 });
    }
}
