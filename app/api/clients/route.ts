import { NextResponse } from 'next/server';
import { dataLayer } from '@/lib/dataLayer';

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
        const data = await req.json();
        const client = await dataLayer.createClient(data);
        return NextResponse.json(client);
    } catch (error) {
        return NextResponse.json({ error: 'Error creating client' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const data = await req.json();
        const client = await dataLayer.updateClient(id, data);
        return NextResponse.json(client);
    } catch (error) {
        return NextResponse.json({ error: 'Error updating client' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        await dataLayer.deleteClient(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Error deleting client' }, { status: 500 });
    }
}
