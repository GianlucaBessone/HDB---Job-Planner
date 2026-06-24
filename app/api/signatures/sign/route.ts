import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSignatureId, generateSignatureHash } from '@/lib/signature';
import { logAudit } from '@/lib/audit';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { documentId, documentVersion, userId, userName, dni, deviceId } = body;

        if (!documentId || !documentVersion || !userId || !userName || !dni || !deviceId) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('remote-addr') || 'unknown';
        const signatureId = generateSignatureId();
        const signedAtUTC = new Date();

        const hash = generateSignatureHash(
            documentId,
            documentVersion,
            userId,
            userName,
            dni,
            deviceId,
            signedAtUTC
        );

        const auditRecord = await prisma.documentSignatureAudit.create({
            data: {
                SignatureID: signatureId,
                DocumentID: documentId,
                DocumentVersion: documentVersion,
                UserID: userId,
                UserName: userName,
                DNI: dni,
                DeviceID: deviceId,
                IPAddress: ipAddress,
                SignedAtUTC: signedAtUTC,
                HashSignature: hash,
                VerificationStatus: 'VALIDA'
            }
        });

        await logAudit({
            action: 'CREATE',
            entity: 'SIGNATURE_AUDIT',
            entityId: signatureId,
            newValue: auditRecord,
            userId: userId,
            userName: userName
        });

        return NextResponse.json(auditRecord);

    } catch (e: any) {
        console.error('Signature Error:', e);
        return NextResponse.json({ error: 'Error generating signature', details: e.message }, { status: 500 });
    }
}
