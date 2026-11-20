import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSignatureHash } from '@/lib/signature';
import { logAudit } from '@/lib/audit';
import { getSessionFromRequest } from '@/lib/auth';

export async function POST(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    try {
        // Ruta pública (el middleware la deja pasar sin sesión y no pisa x-user-id),
        // así que quién verifica se toma de la cookie de sesión validada, nunca del cuerpo.
        const session = await getSessionFromRequest(req);
        const verifiedBy = session?.id || 'Portal Público';

        const signatureId = params.id;
        
        const signature = await prisma.documentSignatureAudit.findUnique({
            where: { SignatureID: signatureId }
        });

        if (!signature) {
            return NextResponse.json({ error: 'Firma no encontrada' }, { status: 404 });
        }

        let recalculatedHash: string;
        try {
            recalculatedHash = generateSignatureHash(
                signature.DocumentID,
                signature.DocumentVersion,
                signature.UserID,
                signature.UserName,
                signature.DNI,
                signature.DeviceID,
                signature.SignedAtUTC
            );
        } catch (e: any) {
            return NextResponse.json({ error: 'Error recalculating hash', details: e.message }, { status: 500 });
        }

        // Compare
        const isValid = signature.HashSignature === recalculatedHash;
        const newStatus = isValid ? 'VALIDA' : 'INVALIDA';

        // Update DB
        const updatedSignature = await prisma.documentSignatureAudit.update({
            where: { SignatureID: signatureId },
            data: {
                VerificationStatus: newStatus,
                VerifiedAtUTC: new Date(),
                VerifiedBy: verifiedBy
            }
        });

        await logAudit({
            action: 'UPDATE',
            entity: 'SIGNATURE_AUDIT',
            entityId: signatureId,
            newValue: updatedSignature,
            userId: session?.id,
            userName: session?.nombreCompleto,
            metadata: { result: newStatus }
        });

        // Fetch document code for display purposes
        const doc = await prisma.controlledDocument.findUnique({
            where: { id: signature.DocumentID },
            select: { codigoDocumental: true }
        });
        const documentCode = doc?.codigoDocumental || signature.DocumentID;

        return NextResponse.json({
            ...updatedSignature,
            DocumentCode: documentCode,
            RecalculatedHash: recalculatedHash, // Provide recalculated hash for UI comparison
            ValidationResult: newStatus
        });

    } catch (e: any) {
        console.error('Signature Verify Error:', e);
        return NextResponse.json({ error: 'Error verifying signature', details: e.message }, { status: 500 });
    }
}
