import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAcceso } from '@/lib/permisosServer';
import { datosFirmaSchema, firmarComoOperador, FirmaError, ipDesdeHeaders } from '@/lib/signatureServer';
import { logAudit } from '@/lib/audit';

// La identidad del firmante (userId, userName, dni) no se acepta del cliente:
// sale de la sesión (lib/signatureServer.ts).
export async function POST(req: Request) {
    try {
        const acceso = await getAcceso(req);
        if (!acceso.userId) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await req.json().catch(() => null);
        const parsed = datosFirmaSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos de firma inválidos', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const auditRecord = await firmarComoOperador(prisma, {
            ...parsed.data,
            operatorId: acceso.userId,
            ipAddress: ipDesdeHeaders(req.headers),
        });

        await logAudit({
            action: 'CREATE',
            entity: 'SIGNATURE_AUDIT',
            entityId: auditRecord.SignatureID,
            newValue: auditRecord,
            userId: auditRecord.UserID,
            userName: auditRecord.UserName
        });

        return NextResponse.json(auditRecord);

    } catch (e: any) {
        if (e instanceof FirmaError) {
            return NextResponse.json({ error: e.message }, { status: e.status });
        }
        console.error('Signature Error:', e);
        return NextResponse.json({ error: 'Error al generar la firma', details: e.message }, { status: 500 });
    }
}
