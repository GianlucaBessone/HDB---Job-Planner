import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSignatureHash } from '@/lib/signature';
import { logAudit } from '@/lib/audit';

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const body = await req.json();
        const { verifiedBy } = body; // User ID who requested verification

        const signatureId = params.id;
        
        const signature = await prisma.documentSignatureAudit.findUnique({
            where: { SignatureID: signatureId }
        });

        if (!signature) {
            return NextResponse.json({ error: 'Firma no encontrada' }, { status: 404 });
        }

        // Recalculate hash using the stored fields
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
                VerifiedBy: verifiedBy || null
            }
        });

        await logAudit({
            action: 'UPDATE',
            entity: 'SIGNATURE_AUDIT',
            entityId: signatureId,
            newValue: updatedSignature,
            userId: verifiedBy,
            metadata: { result: newStatus }
        });

        return NextResponse.json({
            ...updatedSignature,
            RecalculatedHash: recalculatedHash, // Provide recalculated hash for UI comparison
            ValidationResult: newStatus
        });

    } catch (e: any) {
        console.error('Signature Verify Error:', e);
        return NextResponse.json({ error: 'Error verifying signature', details: e.message }, { status: 500 });
    }
}
