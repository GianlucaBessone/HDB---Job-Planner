import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const tipo = searchParams.get('tipo');
        const area = searchParams.get('area');

        if (!tipo || !area) {
            return NextResponse.json({ error: 'Tipo y área son requeridos' }, { status: 400 });
        }

        const prefix = `${tipo.toUpperCase()}-${area.toUpperCase()}-`;

        // Buscar todos los documentos que comiencen con ese prefijo
        const docs = await prisma.controlledDocument.findMany({
            where: {
                codigoDocumental: {
                    startsWith: prefix
                }
            },
            select: {
                codigoDocumental: true
            }
        });

        let maxNumber = 0;

        // Extraer el correlativo de cada código y encontrar el máximo
        for (const doc of docs) {
            const parts = doc.codigoDocumental.split('-');
            if (parts.length >= 3) {
                const numPart = parts[parts.length - 1]; // Toma la última parte
                const num = parseInt(numPart, 10);
                if (!isNaN(num) && num > maxNumber) {
                    maxNumber = num;
                }
            }
        }

        const nextNumber = maxNumber + 1;

        if (nextNumber > 999) {
            console.error(`Límite alcanzado para la serie documental: ${prefix}`);
            return NextResponse.json({ 
                error: 'No es posible generar un nuevo identificador. Se alcanzó el máximo permitido para la serie documental.' 
            }, { status: 400 });
        }

        const nextCode = `${prefix}${nextNumber.toString().padStart(3, '0')}`;

        return NextResponse.json({ nextCode });

    } catch (e: any) {
        return NextResponse.json({ error: 'Error al generar el siguiente código', details: e.message }, { status: 500 });
    }
}
