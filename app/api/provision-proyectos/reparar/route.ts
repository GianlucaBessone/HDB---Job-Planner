import { NextResponse } from 'next/server';
import { exigirAcceso } from '@/lib/permisosServer';
import { repararEstadosMateriales } from '@/lib/provision/repararEstados';

export const dynamic = 'force-dynamic';

/** Corrige estados de materiales de proyecto (antes lo hacía el GET de /api/provision-proyectos). */
export async function POST(req: Request) {
    try {
        const acceso = await exigirAcceso(req, ['provision.gestionar'], 'No tenés permiso para gestionar la provisión de materiales');
        if (acceso instanceof NextResponse) return acceso;

        const resultado = await repararEstadosMateriales();
        return NextResponse.json(resultado);
    } catch (error) {
        console.error('Provision reparar Error:', error);
        return NextResponse.json({ error: 'No se pudieron corregir los estados de materiales' }, { status: 500 });
    }
}
