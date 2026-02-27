import { NextResponse } from 'next/server';
import { dataLayer } from '@/lib/dataLayer';
import { prisma } from '@/lib/dataLayer';

export async function GET(req: Request) {
    const url = new URL(req.url);
    const fecha = url.searchParams.get('fecha');
    if (!fecha) return NextResponse.json({ error: 'Fecha required' }, { status: 400 });
    const planning = await dataLayer.getPlanningByDate(fecha);
    return NextResponse.json(planning || { blocks: [] });
}

export async function POST(req: Request) {
    const { fecha, blocks } = await req.json();
    const planning = await dataLayer.savePlanning(fecha, blocks);

    return NextResponse.json(planning);
}
