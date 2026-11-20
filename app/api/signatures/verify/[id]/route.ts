import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateSignatureHash } from '@/lib/signature';
import { logAudit } from '@/lib/audit';
import { getAccesoDeCookie } from '@/lib/permisosServer';

export const dynamic = 'force-dynamic';

/**
 * Verificación de una firma digital. Es pública a propósito: los clientes
 * verifican desde /public/verificar-firma con el código impreso en el documento.
 *
 * - Sin sesión (o sin permiso) se responde una vista reducida: nombre del firmante,
 *   DNI enmascarado, documento, fecha, hash y resultado. Nunca UserID, IP ni dispositivo.
 * - Solo quien tiene `auditoria.ver` registra la verificación en la base
 *   (estado, fecha y quién verificó). Una consulta pública no escribe nada.
 * - Las consultas sin permiso tienen un límite por IP para frenar la enumeración de códigos.
 *
 * La sesión se lee de la cookie validada (getAccesoDeCookie): en una ruta pública el
 * middleware no completa x-user-id y el cliente podría mandarlo inventado.
 */

const NO_CACHE = { 'Cache-Control': 'private, no-store' };

const idSchema = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9-]+$/);

// Límite por IP para consultas sin permiso de auditoría. En serverless la memoria es
// por instancia: frena barridos desde una IP, no reemplaza un límite en el borde.
const LIMITE_CONSULTAS = 30;
const VENTANA_MS = 10 * 60 * 1000;
const consultasPorIp = new Map<string, number[]>();

function excedeLimite(ip: string): boolean {
    const ahora = Date.now();
    const recientes = (consultasPorIp.get(ip) || []).filter(t => t > ahora - VENTANA_MS);
    if (recientes.length >= LIMITE_CONSULTAS) {
        consultasPorIp.set(ip, recientes);
        return true;
    }
    recientes.push(ahora);
    consultasPorIp.set(ip, recientes);
    if (consultasPorIp.size > 10_000) {
        consultasPorIp.forEach((v, k) => {
            if (!v.some(t => t > ahora - VENTANA_MS)) consultasPorIp.delete(k);
        });
    }
    return false;
}

function ipDe(req: Request): string {
    const xff = req.headers.get('x-forwarded-for');
    return (xff && xff.split(',')[0].trim()) || req.headers.get('x-real-ip') || 'desconocida';
}

/** Deja visibles los últimos 3 dígitos: alcanza para que el firmante se reconozca. */
function enmascararDni(dni: string): string {
    const limpio = (dni || '').replace(/\D/g, '');
    if (limpio.length <= 3) return '***';
    return '*'.repeat(limpio.length - 3) + limpio.slice(-3);
}

export async function POST(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
    const params = await paramsPromise;

    const parsedId = idSchema.safeParse(params.id);
    if (!parsedId.success) {
        return NextResponse.json({ error: 'Código de firma inválido' }, { status: 400, headers: NO_CACHE });
    }
    const signatureId = parsedId.data;

    try {
        const acceso = await getAccesoDeCookie(req);
        const esAuditor = acceso.puede('auditoria.ver');

        if (!esAuditor && excedeLimite(ipDe(req))) {
            return NextResponse.json(
                { error: 'Demasiadas consultas. Probá de nuevo en unos minutos.' },
                { status: 429, headers: NO_CACHE }
            );
        }

        const signature = await prisma.documentSignatureAudit.findUnique({
            where: { SignatureID: signatureId }
        });

        if (!signature) {
            return NextResponse.json({ error: 'Firma no encontrada' }, { status: 404, headers: NO_CACHE });
        }

        const recalculatedHash = generateSignatureHash(
            signature.DocumentID,
            signature.DocumentVersion,
            signature.UserID,
            signature.UserName,
            signature.DNI,
            signature.DeviceID,
            signature.SignedAtUTC
        );
        const newStatus = signature.HashSignature === recalculatedHash ? 'VALIDA' : 'INVALIDA';

        const doc = await prisma.controlledDocument.findUnique({
            where: { id: signature.DocumentID },
            select: { codigoDocumental: true }
        });
        const documentCode = doc?.codigoDocumental || signature.DocumentID;

        // Solo un auditor deja registrada la verificación.
        if (esAuditor) {
            const updatedSignature = await prisma.documentSignatureAudit.update({
                where: { SignatureID: signatureId },
                data: {
                    VerificationStatus: newStatus,
                    VerifiedAtUTC: new Date(),
                    VerifiedBy: acceso.userId
                }
            });

            await logAudit({
                action: 'UPDATE',
                entity: 'SIGNATURE_AUDIT',
                entityId: signatureId,
                newValue: updatedSignature,
                userId: acceso.userId,
                userName: acceso.nombre,
                metadata: { result: newStatus }
            });

            return NextResponse.json({
                ...updatedSignature,
                DocumentCode: documentCode,
                RecalculatedHash: recalculatedHash,
                ValidationResult: newStatus
            }, { headers: NO_CACHE });
        }

        // El propio firmante ve sus datos completos, sin registrar la verificación.
        if (acceso.activo && acceso.userId === signature.UserID) {
            return NextResponse.json({
                ...signature,
                VerificationStatus: newStatus,
                DocumentCode: documentCode,
                RecalculatedHash: recalculatedHash,
                ValidationResult: newStatus
            }, { headers: NO_CACHE });
        }

        // Vista pública.
        return NextResponse.json({
            SignatureID: signature.SignatureID,
            DocumentCode: documentCode,
            DocumentVersion: signature.DocumentVersion,
            UserName: signature.UserName,
            DNI: enmascararDni(signature.DNI),
            SignedAtUTC: signature.SignedAtUTC,
            HashSignature: signature.HashSignature,
            VerificationStatus: newStatus,
            VerifiedAtUTC: signature.VerifiedAtUTC,
            ValidationResult: newStatus,
            VistaReducida: true
        }, { headers: NO_CACHE });

    } catch (e: unknown) {
        console.error('Signature Verify Error:', e);
        return NextResponse.json({ error: 'No se pudo verificar la firma' }, { status: 500, headers: NO_CACHE });
    }
}
