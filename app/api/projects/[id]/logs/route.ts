import { NextResponse } from 'next/server';
import { dataLayer } from '@/lib/dataLayer';

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const logs = await dataLayer.getProjectLogs(params.id);
        return NextResponse.json(logs);
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const data = await req.json();
        const log = await dataLayer.createProjectLog({
            ...data,
            projectId: params.id
        });
        return NextResponse.json(log);
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const url = new URL(req.url);
        const logId = url.searchParams.get('logId');
        if (!logId) return NextResponse.json({ error: 'Missing logId' }, { status: 400 });
        await dataLayer.deleteProjectLog(logId);
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
