import { NextResponse } from 'next/server';
import { dataLayer } from '@/lib/dataLayer';

export async function POST(req: Request) {
    try {
        await dataLayer.resetAllDevices();
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to reset devices' }, { status: 500 });
    }
}
