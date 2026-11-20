import { NextResponse } from 'next/server';
import { dataLayer } from '@/lib/dataLayer';
import { withIdempotency } from '@/lib/idempotency';
import { exigirAcceso } from '@/lib/permisosServer';

export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    try {
        const logs = await dataLayer.getProjectLogs(params.id);
        return NextResponse.json(logs);
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function POST(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    return withIdempotency(req, async () => {
        try {
            const acceso = await exigirAcceso(req);
            if (acceso instanceof NextResponse) return acceso;

            const data = await req.json();
            // Solo los campos de la entrada; el responsable lo elige la pantalla (si no viene, la sesión).
            const log = await dataLayer.createProjectLog({
                fecha: data.fecha,
                observacion: data.observacion,
                categoria: data.categoria,
                responsable: data.responsable || acceso.nombre,
                projectId: params.id
            });
            return NextResponse.json(log);
        } catch (e) {
            return NextResponse.json({ error: String(e) }, { status: 500 });
        }
    });
}


export async function DELETE(req: Request) {
    try {
        const acceso = await exigirAcceso(req, ['proyectos.crear'], 'No tenés permiso para borrar entradas de la bitácora');
        if (acceso instanceof NextResponse) return acceso;

        const url = new URL(req.url);
        const logId = url.searchParams.get('logId');
        if (!logId) return NextResponse.json({ error: 'Missing logId' }, { status: 400 });
        await dataLayer.deleteProjectLog(logId);
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
