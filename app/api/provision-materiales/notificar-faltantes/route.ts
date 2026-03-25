import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';
import { sendPushNotification } from '@/lib/onesignal';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { proyectoId, faltantes, notificadorNombre, userName } = body;

        if (!proyectoId || !faltantes || !Array.isArray(faltantes) || faltantes.length === 0) {
            return NextResponse.json({ error: 'Faltan datos requeridos o no hay faltantes' }, { status: 400 });
        }

        const proyecto = await prisma.project.findUnique({
            where: { id: proyectoId },
            select: { id: true, codigoProyecto: true, nombre: true }
        });

        if (!proyecto) {
            return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
        }

        const maxItems = 5;
        const topFaltantes = faltantes.slice(0, maxItems);
        const remaining = faltantes.length - maxItems;

        let messageList = topFaltantes.map(m => `${m.nombre}: faltan ${m.faltante} ${m.unidad}`).join('\n');
        if (remaining > 0) {
            messageList += `\n+ ${remaining} más...`;
        }

        const codigoTxt = proyecto.codigoProyecto ? `${proyecto.codigoProyecto} - ` : '';
        const title = "Faltantes de materiales";
        const message = `${codigoTxt}${proyecto.nombre}\n\nFaltantes:\n${messageList}`;

        // Destinatarios: Supervisores y Hernan Bassignana
        const supervisors = await prisma.operator.findMany({
            where: {
                role: { in: ['supervisor', 'admin'] },
                activo: true
            },
            select: { id: true }
        });

        const specificOperator = await prisma.operator.findFirst({
            where: {
                nombreCompleto: { contains: 'Hernan Bassignana' }
            },
            select: { id: true }
        });

        // Mix and unique IDs
        const recipientIds = Array.from(new Set([
            ...supervisors.map(s => s.id),
            ...(specificOperator ? [specificOperator.id] : [])
        ]));

        // Guardar notificación para cada destinatario
        if (recipientIds.length > 0) {
            await Promise.all(recipientIds.map(opId => 
                prisma.notification.create({
                    data: {
                        operatorId: opId,
                        title,
                        message,
                        type: 'FALTANTES_MATERIALES',
                        relatedId: proyecto.id,
                        metadata: { notificador: notificadorNombre || userName, faltantes, date: new Date().toISOString() },
                    }
                })
            ));
        }

        // Mantener una para "forSupervisors" general si el sistema la usa para el dropdown global
        await prisma.notification.create({
            data: {
                forSupervisors: true,
                title,
                message,
                type: 'FALTANTES_MATERIALES',
                relatedId: proyecto.id,
                metadata: { notificador: notificadorNombre || userName, faltantes, date: new Date().toISOString() },
            }
        });

        // Enviar Push (OneSignal va a combinar tags de rol con estos external IDs)
        await sendPushNotification({
            userIds: recipientIds.length > 0 ? recipientIds : undefined,
            forSupervisors: true,
            title,
            message,
            data: {
                url: `/provision-materiales?proyecto=${proyecto.id}`
            }
        });

        return NextResponse.json({ success: true, message: 'Notificación enviada con éxito' });

    } catch (error: any) {
        console.error('Error notificando faltantes:', error);
        return NextResponse.json({ error: 'Error interno del servidor al notificar faltantes' }, { status: 500 });
    }
}
