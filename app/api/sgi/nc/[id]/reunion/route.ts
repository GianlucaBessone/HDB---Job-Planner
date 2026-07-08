import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushNotification } from '@/lib/onesignal';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const body = await req.json();
        
        const operatorIds = Array.isArray(body.participantes) ? body.participantes : [];
        const operators = await prisma.operator.findMany({
            where: { id: { in: operatorIds } },
            select: { nombreCompleto: true }
        });
        const participantesNombres = operators.map(op => op.nombreCompleto);

        const nc = await prisma.noConformidad.findUnique({
            where: { id: params.id },
            select: { codigoNC: true, categoria: true }
        });
        
        const reunion = await prisma.reunionNC.create({
            data: {
                ncId: params.id,
                fecha: new Date(body.fecha),
                agenda: body.agenda || body.motivo,
                participantes: participantesNombres,
                acta: body.acta || body.minuta || null
            }
        });

        if (operatorIds.length > 0) {
            const title = `Reunión Programada: NC ${nc?.codigoNC || params.id}`;
            const message = `Has sido convocado a una reunión el ${new Date(body.fecha).toLocaleString()} para tratar la NC de ${nc?.categoria || 'Calidad'}.\nAsunto: ${body.agenda || body.motivo}`;

            await Promise.all(operatorIds.map(opId => 
                prisma.activity.create({
                    data: {
                        type: 'MEETING_SCHEDULED',
                        priority: 'NORMAL',
                        category: 'Quality',
                        title,
                        message,
                        entityType: 'reunion',
                        entityId: reunion.id,
                        metadata: { ncId: params.id, reunionId: reunion.id },
                        recipients: { create: [{ operatorId: opId }] }
                    }
                })
            ));

            await sendPushNotification({
                userIds: operatorIds,
                title,
                message,
                data: {
                    url: `/calidad`
                }
            });
        }

        return NextResponse.json(reunion, { status: 201 });
    } catch (error) {
        console.error('Error creating Reunion NC:', error);
        return NextResponse.json({ error: 'Error del servidor al crear la reunión' }, { status: 500 });
    }
}
