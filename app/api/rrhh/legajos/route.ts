import { NextResponse } from 'next/server';
import { exigirAcceso } from '@/lib/permisosServer';
import { listarLegajos } from '@/lib/legajo';
import { respuestaError, SIN_CACHE } from '@/lib/legajoApi';

export const dynamic = 'force-dynamic';

/** GET /api/rrhh/legajos?estado=activos|inactivos|todos — personal con el resumen de su legajo. */
export async function GET(req: Request) {
    const acceso = await exigirAcceso(req, ['rrhh.legajo_ver', 'rrhh.legajo_gestionar']);
    if (acceso instanceof NextResponse) return acceso;
    const estado = new URL(req.url).searchParams.get('estado') || 'activos';
    if (!['activos', 'inactivos', 'todos'].includes(estado)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    try {
        return NextResponse.json({ personas: await listarLegajos(estado as 'activos') }, { headers: SIN_CACHE });
    } catch (error) {
        return respuestaError(error, 'listar');
    }
}
