import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING_APPROVAL';

    try {
        const entries = await prisma.timeEntry.findMany({
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
        const body = await req.json();
        const { id, action, approvedById } = body; // action: 'APPROVED' | 'REJECTED'

        if (!['APPROVED', 'REJECTED'].includes(action)) {
            return NextResponse.json({ error: 'Acción no permitida' }, { status: 400 });
        }

        const existing = await prisma.timeEntry.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({ error: 'Fichada no encontrada' }, { status: 404 });

        const updated = await prisma.timeEntry.update({
            where: { id },
            data: {
                status: action,
                approvedById,
                approvedAt: new Date()
            }
        });

        // Audit Log
        await logAudit({
            userId: approvedById,
            action: action === 'APPROVED' ? 'APPROVE' : 'REJECT',
            entity: 'TIME_ENTRY',
            entityId: id,
            oldValue: existing,
            newValue: updated
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
