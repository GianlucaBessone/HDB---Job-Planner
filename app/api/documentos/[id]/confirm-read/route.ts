import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/documentos/[id]/confirm-read
 * Confirm that a user has read the document
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const { operatorId, operatorNombre } = await req.json();

        if (!operatorId || !operatorNombre) {
            return NextResponse.json({ error: 'operatorId y operatorNombre son requeridos' }, { status: 400 });
        }

        const doc = await prisma.controlledDocument.findUnique({
            where: { id: params.id }
        });
        if (!doc) {
            return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
        }

        const versionActual = `${doc.versionMayor}.${doc.versionMenor}`;

        // Upsert — update if already confirmed (e.g., new version read)
        const confirmation = await prisma.documentReadConfirmation.upsert({
            where: {
                documentId_operatorId: {
                    documentId: params.id,
                    operatorId
                }
            },
            update: {
                confirmadoAt: new Date(),
                versionAlMomento: versionActual,
                operatorNombre,
            },
            create: {
                documentId: params.id,
                operatorId,
                operatorNombre,
                versionAlMomento: versionActual,
            }
        });

        await logAudit({
            userId: operatorId,
            userName: operatorNombre,
            action: 'APPROVE',
            entity: 'DOCUMENT_READ_CONFIRMATION',
            entityId: confirmation.id,
            newValue: { documentId: params.id, versionActual },
        });

        return NextResponse.json(confirmation);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al confirmar lectura', details: e.message }, { status: 500 });
    }
}

/**
 * GET /api/documentos/[id]/confirm-read
 * Get all read confirmations for a document
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const confirmations = await prisma.documentReadConfirmation.findMany({
            where: { documentId: params.id },
            orderBy: { confirmadoAt: 'desc' }
        });
        return NextResponse.json(confirmations);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al obtener confirmaciones', details: e.message }, { status: 500 });
    }
}
