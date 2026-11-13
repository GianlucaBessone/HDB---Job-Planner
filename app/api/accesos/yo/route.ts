import { NextResponse } from 'next/server';
import { getAcceso } from '@/lib/permisosServer';

export const dynamic = 'force-dynamic';

/** Permisos especiales del usuario de la sesión. Los usa el cliente para armar menú y pantallas. */
export async function GET(req: Request) {
    try {
        const acceso = await getAcceso(req);
        return NextResponse.json(
            { role: acceso.role, permisos: acceso.permisos },
            { headers: { 'Cache-Control': 'private, no-store' } }
        );
    } catch (e) {
        console.error('Error al leer los accesos de la sesión:', e);
        return NextResponse.json({ error: 'No se pudieron leer tus accesos' }, { status: 500 });
    }
}
