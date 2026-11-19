import { NextResponse } from 'next/server';
import { dataLayer } from '@/lib/dataLayer';
import { exigirAcceso } from '@/lib/permisosServer';

export async function GET() {
    try {
        const projects = await dataLayer.getProjects();
        return NextResponse.json(projects);
    } catch (e) {
        console.error('Fetch Projects Error:', e);
        return NextResponse.json({ error: 'Failed to fetch projects', details: String(e) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const acceso = await exigirAcceso(req, ['proyectos.crear'], 'No tenés permiso para crear proyectos');
    if (acceso instanceof NextResponse) return acceso;

    const data = await req.json();
    const project = await dataLayer.createProject(data, acceso);
    return NextResponse.json(project);
}

export async function PATCH(req: Request) {
    const acceso = await exigirAcceso(req, ['proyectos.crear'], 'No tenés permiso para editar proyectos');
    if (acceso instanceof NextResponse) return acceso;

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const data = await req.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    const project = await dataLayer.updateProject(id, data, acceso);
    return NextResponse.json(project);
}

/** Borra el proyecto en cascada (órdenes de servicio, horas, fichadas): pide "proyectos.eliminar". */
export async function DELETE(req: Request) {
    const acceso = await exigirAcceso(req, ['proyectos.eliminar'], 'No tenés permiso para eliminar proyectos');
    if (acceso instanceof NextResponse) return acceso;

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    // Con historial (horas, fichadas, órdenes…) se desactiva en lugar de borrarse.
    const resultado = await dataLayer.deleteProject(id, acceso);
    return NextResponse.json({ success: true, ...resultado });
}
