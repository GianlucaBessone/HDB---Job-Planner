import { NextResponse } from 'next/server';
import { dataLayer } from '@/lib/dataLayer';
import { exigirAcceso } from '@/lib/permisosServer';
import { clienteParcialSchema, clienteSchema } from '@/lib/clientes';

const SIN_PERMISO = 'No tenés permiso para gestionar clientes';

export async function GET() {
    try {
        const clients = await dataLayer.getClients();
        return NextResponse.json(clients);
    } catch (error) {
        console.error('GET /api/clients error:', error);
        return NextResponse.json({ error: 'Error fetching clients', details: String(error) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const acceso = await exigirAcceso(req, ['clientes.gestionar'], SIN_PERMISO);
        if (acceso instanceof NextResponse) return acceso;

        const parsed = clienteSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
        const client = await dataLayer.createClient(parsed.data);
        return NextResponse.json(client);
    } catch (error) {
        return NextResponse.json({ error: 'Error creating client' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const acceso = await exigirAcceso(req, ['clientes.gestionar'], SIN_PERMISO);
        if (acceso instanceof NextResponse) return acceso;

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const parsed = clienteParcialSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
        const client = await dataLayer.updateClient(id, parsed.data);
        return NextResponse.json(client);
    } catch (error) {
        return NextResponse.json({ error: 'Error updating client' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const acceso = await exigirAcceso(req, ['clientes.eliminar'], 'No tenés permiso para eliminar clientes');
        if (acceso instanceof NextResponse) return acceso;

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        // Con historial (proyectos, ventas, órdenes…) se desactiva en lugar de borrarse.
        const resultado = await dataLayer.deleteClient(id, acceso);
        return NextResponse.json({ success: true, ...resultado });
    } catch (error) {
        return NextResponse.json({ error: 'Error deleting client' }, { status: 500 });
    }
}
