import { NextResponse } from 'next/server';
import { dataLayer } from '@/lib/dataLayer';
import { exigirAcceso } from '@/lib/permisosServer';

/** Libera el dispositivo registrado de todos los usuarios (fichado). */
export async function POST(req: Request) {
    try {
        const acceso = await exigirAcceso(req, ['usuarios.gestionar'], 'No tenés permisos para gestionar usuarios');
        if (acceso instanceof NextResponse) return acceso;

        await dataLayer.resetAllDevices(acceso);
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to reset devices' }, { status: 500 });
    }
}
