import { NextResponse } from 'next/server';
import { exigirAcceso } from '@/lib/permisosServer';
import { misTareas } from '@/lib/misTareas';

export const dynamic = 'force-dynamic';

/** GET /api/mis-tareas — tareas, acciones de mejora y planes de KPI de la persona de la sesión (P31). */
export async function GET(req: Request) {
    const acceso = await exigirAcceso(req);
    if (acceso instanceof NextResponse) return acceso;
    try {
        return NextResponse.json({ tareas: await misTareas(acceso.userId) });
    } catch (error) {
        console.error('Error en mis tareas:', error);
        return NextResponse.json({ error: 'No se pudieron cargar tus tareas' }, { status: 500 });
    }
}
