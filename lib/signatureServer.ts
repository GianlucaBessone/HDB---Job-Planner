/**
 * Firma digital del lado del servidor (DocumentSignatureAudit).
 *
 * La identidad del firmante (id, nombre y DNI) sale siempre del Operator de la
 * sesión: nunca se acepta del cliente. Lo usan /api/signatures/sign y las
 * acciones que firman dentro de su propia transacción (por ejemplo, Mis EPP).
 */
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateSignatureId, generateSignatureHash } from '@/lib/signature';

type Db = Prisma.TransactionClient | typeof prisma;

/** Error de firma con el status HTTP que corresponde devolver. */
export class FirmaError extends Error {
    constructor(message: string, public status: number) {
        super(message);
        this.name = 'FirmaError';
    }
}

// El payload del HMAC separa los campos con '|': no se aceptan en los datos de
// la firma para que no se puedan correr valores de un campo a otro.
const campo = (nombre: string, max: number) =>
    z.string().trim().min(1, `${nombre} es obligatorio`).max(max).refine(v => !v.includes('|'), `${nombre} no puede contener "|"`);

/** Datos que puede mandar el cliente. Zod descarta cualquier otro campo (identidad incluida). */
export const datosFirmaSchema = z.object({
    documentId: campo('documentId', 200),
    documentVersion: campo('documentVersion', 50),
    deviceId: campo('deviceId', 100),
});

export type DatosFirma = z.infer<typeof datosFirmaSchema>;

/**
 * Crea el registro de firma a nombre del operador de la sesión.
 * Lanza FirmaError si el operador no existe, está inactivo o no tiene DNI.
 */
export async function firmarComoOperador(
    db: Db,
    params: DatosFirma & { operatorId: string; ipAddress: string }
) {
    const { operatorId, documentId, documentVersion, deviceId, ipAddress } = params;
    if (!operatorId) throw new FirmaError('No autorizado', 401);

    const operador = await db.operator.findUnique({
        where: { id: operatorId },
        select: { id: true, nombreCompleto: true, dni: true, activo: true },
    });
    if (!operador || !operador.activo) {
        throw new FirmaError('Usuario de la sesión inexistente o inactivo', 403);
    }

    const userName = operador.nombreCompleto.trim();
    const dni = (operador.dni || '').trim();
    if (!dni) {
        throw new FirmaError('Configurá tu DNI en los Ajustes de Perfil antes de firmar', 400);
    }
    if (userName.includes('|') || dni.includes('|')) {
        throw new FirmaError('El nombre o DNI del perfil tiene caracteres no válidos ("|")', 400);
    }

    const signatureId = generateSignatureId();
    const signedAtUTC = new Date();
    const hash = generateSignatureHash(documentId, documentVersion, operador.id, userName, dni, deviceId, signedAtUTC);

    return db.documentSignatureAudit.create({
        data: {
            SignatureID: signatureId,
            DocumentID: documentId,
            DocumentVersion: documentVersion,
            UserID: operador.id,
            UserName: userName,
            DNI: dni,
            DeviceID: deviceId,
            IPAddress: ipAddress || 'unknown',
            SignedAtUTC: signedAtUTC,
            HashSignature: hash,
            VerificationStatus: 'VALIDA',
        },
    });
}

/** IP del cliente según los headers del request. */
export function ipDesdeHeaders(headers: Headers): string {
    return headers.get('x-forwarded-for') || headers.get('remote-addr') || 'unknown';
}
