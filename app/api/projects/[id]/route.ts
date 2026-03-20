import { NextResponse } from 'next/server';
import { dataLayer } from '@/lib/dataLayer';

/**
 * GET /api/projects/[id]
 * Returns a single project by ID, including client, responsableUser and checklistItems.
 * Used by ProjectFinalizeAuthModal to load full project details.
 */
export async function GET(
    _req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const project = await dataLayer.getProjectById(params.id);

        if (!project) {
            return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
        }

        return NextResponse.json(project);
    } catch (e) {
        console.error('Error fetching project by ID:', e);
        return NextResponse.json({ error: 'Error del servidor', details: String(e) }, { status: 500 });
    }
}
