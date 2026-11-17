import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateSignatureId, generateSignatureHash } from '@/lib/signature';
import { logAudit } from '@/lib/audit';
import { getAcceso } from '@/lib/permisosServer';

export const dynamic = 'force-dynamic';

// El firmante sale de la sesión, no del body: cualquier userId / userName / dni que mande el cliente se ignora.
const bodySchema = z.object({
    documentId: z.string().trim().min(1).max(200),
    documentVersion: z.string().trim().min(1).max(50),
    deviceId: z.string().trim().min(1).max(200),
});

export async function POST(req: Request) {
    const { userId } = await getAcceso(req);
    if (!userId) {
        return NextResponse.json({ error: 'Tenés que iniciar sesión para firmar' }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Faltan datos de la firma (documento, versión o dispositivo)' }, { status: 400 });
    }
    const { documentId, documentVersion, deviceId } = parsed.data;

    try {
        const operador = await prisma.operator.findUnique({
            where: { id: userId },
            select: { id: true, nombreCompleto: true, dni: true, activo: true },
        });
        if (!operador || !operador.activo) {
            return NextResponse.json({ error: 'Tu usuario no está activo' }, { status: 401 });
        }

        const dni = operador.dni?.trim();
        if (!dni) {
            return NextResponse.json(
                { error: 'Tu usuario no tiene DNI cargado. Pedile a un administrador que lo cargue para poder firmar.' },
                { status: 422 }
            );
        }

        const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('remote-addr') || 'unknown';
        const signatureId = generateSignatureId();
        const signedAtUTC = new Date();

        const hash = generateSignatureHash(
            documentId,
            documentVersion,
            operador.id,
            operador.nombreCompleto,
            dni,
            deviceId,
            signedAtUTC
        );

        const auditRecord = await prisma.documentSignatureAudit.create({
            data: {
                SignatureID: signatureId,
                DocumentID: documentId,
                DocumentVersion: documentVersion,
                UserID: operador.id,
                UserName: operador.nombreCompleto,
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
            userId: operador.id,
            userName: operador.nombreCompleto
        });

        return NextResponse.json(auditRecord);
    } catch (e: unknown) {
        console.error('Signature Error:', e);
        return NextResponse.json({ error: 'No se pudo generar la firma' }, { status: 500 });
    }
}
