import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    const auth = await exigirAcceso(req, ['calidad.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const body = await req.json();
        
        const operatorIds = Array.isArray(body.participantes) ? body.participantes : [];
        const operators = await prisma.operator.findMany({
            where: { id: { in: operatorIds } },
            select: { nombreCompleto: true }
        });
        const participantesNombres = operators.map(op => op.nombreCompleto);
        
        const causa = await prisma.analisisCausaRaiz.create({
            data: {
                ncId: params.id,
                metodologia: body.metodologia,
                descripcion: body.descripcion || '',
                descripcionAnalisis: body.descripcionAnalisis || '',
                causaInmediata: body.causaInmediata || '',
                causaBasica: body.causaBasica || '',
                causaRaiz: body.causaRaiz || '',
                participantes: participantesNombres,
                fechaAnalisis: body.fechaAnalisis ? new Date(body.fechaAnalisis) : new Date()
            }
        });

        return NextResponse.json(causa, { status: 201 });
    } catch (error) {
        console.error('Error creating Analisis Causa Raiz:', error);
        return NextResponse.json({ error: 'Error del servidor al crear el análisis' }, { status: 500 });
    }
}
