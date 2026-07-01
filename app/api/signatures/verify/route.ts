import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const signatures = await prisma.documentSignatureAudit.findMany({
            orderBy: { SignedAtUTC: 'desc' }
        });

        const docIds = [...new Set(signatures.map(s => s.DocumentID))];
        const docs = await prisma.controlledDocument.findMany({
            where: { id: { in: docIds } },
            select: { id: true, codigoDocumental: true }
        });

        const docCodeMap = new Map(docs.map(d => [d.id, d.codigoDocumental]));

        const enrichedSignatures = signatures.map(sig => ({
            ...sig,
            DocumentCode: docCodeMap.get(sig.DocumentID) || null
        }));

        return NextResponse.json(enrichedSignatures);
    } catch (e: any) {
        return NextResponse.json({ error: 'Failed to fetch signatures', details: e.message }, { status: 500 });
    }
}
