import { NextResponse } from 'next/server';
import { dataLayer } from '@/lib/dataLayer';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const delays = await dataLayer.getClientDelays();
        return NextResponse.json(delays);
    } catch (e) {
        console.error('Fetch Delays Error:', e);
        return NextResponse.json({ error: 'Failed to fetch delays', details: String(e) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const data = await req.json();
        const delay = await dataLayer.createClientDelay(data);
        return NextResponse.json(delay);
    } catch (e) {
        console.error('Create Delay Error:', e);
        return NextResponse.json({ error: 'Failed to create delay', details: String(e) }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
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
