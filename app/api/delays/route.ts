import { NextResponse } from 'next/server';
import { dataLayer } from '@/lib/dataLayer';
import { withIdempotency } from '@/lib/idempotency';
import { exigirAcceso } from '@/lib/permisosServer';
import { demoraParcialSchema, demoraSchema, primerError } from '@/lib/bitacora';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const projectId = url.searchParams.get('projectId');
        const delays = await dataLayer.getClientDelays(projectId || undefined);
        return NextResponse.json(delays);
    } catch (e) {
        console.error('Fetch Delays Error:', e);
        return NextResponse.json({ error: 'Failed to fetch delays', details: String(e) }, { status: 500 });
    }
}

/**
 * Registra una demora del cliente. Cargarla está abierto a todos (desde la bitácora
 * del proyecto o desde Demoras del cliente); quien la carga sale de la sesión salvo
 * que quien gestiona demoras la registre a nombre de otra persona.
 */
export async function POST(req: Request) {
    return withIdempotency(req, async () => {
        const acceso = await exigirAcceso(req);
        if (acceso instanceof NextResponse) return acceso;

        try {
            const parsed = demoraSchema.safeParse(await req.json().catch(() => null));
            if (!parsed.success) return NextResponse.json({ error: primerError(parsed.error) }, { status: 400 });
            const { operador, responsableArea, ...datos } = parsed.data;

            const aNombreDeOtro = !!operador && operador !== acceso.nombre && acceso.puede('demoras.gestionar');
            const delay = await dataLayer.createClientDelay({
                ...datos,
                responsableArea: responsableArea || undefined,
                operador: aNombreDeOtro ? operador! : acceso.nombre || operador || 'Sin nombre',
                operadorId: aNombreDeOtro ? undefined : acceso.userId || undefined,
            });
            return NextResponse.json(delay);
        } catch (e) {
            console.error('Create Delay Error:', e);
            return NextResponse.json({ error: 'No se pudo registrar la demora' }, { status: 500 });
        }
    });
}


export async function PATCH(req: Request) {
    const acceso = await exigirAcceso(req, ['demoras.gestionar'], 'No tenés permiso para modificar demoras');
    if (acceso instanceof NextResponse) return acceso;

    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
        const parsed = demoraParcialSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: primerError(parsed.error) }, { status: 400 });
        const { responsableArea, ...datos } = parsed.data;
        const delay = await dataLayer.updateClientDelay(id, {
            ...datos,
            ...(responsableArea !== undefined ? { responsableArea: responsableArea || undefined } : {}),
        });
        return NextResponse.json(delay);
    } catch (e) {
        console.error('Update Delay Error:', e);
        return NextResponse.json({ error: 'No se pudo actualizar la demora' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const acceso = await exigirAcceso(req, ['demoras.gestionar'], 'No tenés permiso para modificar demoras');
    if (acceso instanceof NextResponse) return acceso;

    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
        await dataLayer.deleteClientDelay(id);
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to delete delay' }, { status: 500 });
    }
}
