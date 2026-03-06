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
