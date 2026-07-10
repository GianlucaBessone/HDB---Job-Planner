import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const templates = await prisma.technicalReportTemplate.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(templates);
    } catch (e) {
        console.error('Error fetching technical report templates:', e);
        return NextResponse.json({ error: 'Error al obtener plantillas' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const template = await prisma.technicalReportTemplate.create({
            data: {
                name: body.name,
                description: body.description,
                schema: body.schema,
                pdfConfig: body.pdfConfig,
                isActive: body.isActive ?? true
            }
        });
        return NextResponse.json(template);
    } catch (e) {
        console.error('Error creating template:', e);
        return NextResponse.json({ error: 'Error al crear plantilla' }, { status: 500 });
    }
}
