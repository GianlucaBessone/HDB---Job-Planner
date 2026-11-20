import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAcceso } from '@/lib/permisosServer';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        // El listado expone nombre y DNI de todos los firmantes.
        const acceso = await getAcceso(req);
        if (!acceso.puede('firmas.ver_registro')) {
            return NextResponse.json({ error: 'No tenés permiso para ver el registro de firmas' }, { status: 403 });
        }

        const signatures = await prisma.documentSignatureAudit.findMany({
            orderBy: { SignedAtUTC: 'desc' }
        });

        const docIds = Array.from(new Set(signatures.map(s => s.DocumentID)));
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
