import { NextResponse } from 'next/server';
import { dataLayer } from '@/lib/dataLayer';

export async function GET() {
    try {
        const projects = await dataLayer.getProjects();
        return NextResponse.json(projects);
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const data = await req.json();
    const project = await dataLayer.createProject(data);
    return NextResponse.json(project);
}

export async function PATCH(req: Request) {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const data = await req.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    const project = await dataLayer.updateProject(id, data);
    return NextResponse.json(project);
}

export async function DELETE(req: Request) {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await dataLayer.deleteProject(id);
    return NextResponse.json({ success: true });
}
