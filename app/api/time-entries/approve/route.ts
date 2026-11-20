import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { exigirAcceso } from '@/lib/permisosServer';

const SIN_PERMISO = 'No tenés permiso para aprobar fichadas';

export async function GET(req: Request) {
    const acceso = await exigirAcceso(req, ['fichadas.aprobar'], SIN_PERMISO);
    if (acceso instanceof NextResponse) return acceso;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING_APPROVAL';

    try {
        const entries = await prisma.fichada.findMany({
            where: { status },
            include: {
                operator: {
                    select: { id: true, nombreCompleto: true }
                },
                project: {
                    select: { id: true, nombre: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(entries);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const acceso = await exigirAcceso(req, ['fichadas.aprobar'], SIN_PERMISO);
        if (acceso instanceof NextResponse) return acceso;

        const body = await req.json();
        // Quien aprueba es siempre el usuario de la sesión (se ignora approvedById del cuerpo).
        const { id, action } = body; // action: 'APPROVED' | 'REJECTED'

        if (!['APPROVED', 'REJECTED'].includes(action)) {
            return NextResponse.json({ error: 'Acción no permitida' }, { status: 400 });
        }

        const existing = await prisma.fichada.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({ error: 'Fichada no encontrada' }, { status: 404 });

        let result;
        if (action === 'APPROVED') {
            result = await prisma.fichada.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    isSuspicious: false // Approved entries become verified
                }
            });
        } else {
            // REJECTED -> Delete from DB
            result = await prisma.fichada.delete({
                where: { id }
            });
        }

        // Audit Log
        await logAudit({
            userId: acceso.userId,
            userName: acceso.nombre,
            action: action === 'APPROVED' ? 'APPROVE' : 'REJECT',
            entity: 'FICHADA',
            entityId: id,
            oldValue: existing,
            newValue: action === 'APPROVED' ? result : null
        });

        return NextResponse.json({ success: true, action, deleted: action === 'REJECTED' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

