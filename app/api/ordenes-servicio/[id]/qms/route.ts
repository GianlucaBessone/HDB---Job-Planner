import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const body = await req.json();
        const { action } = body;

        if (action === 'acknowledge') {
            const { osDocumentoId, operatorId, operatorNombre, gpsLat, gpsLng, ip, dispositivo } = body;

            // Upsert to allow re-confirming but we only care about the record
            const ack = await prisma.oSDocumentAcknowledgement.create({
                data: {
                    osDocumentoId,
                    operatorId,
                    operatorNombre,
                    gpsLat,
                    gpsLng,
                    ip,
                    dispositivo
                }
            });

            // Mark document as read
            await prisma.ordenServicioDocumento.update({
                where: { id: osDocumentoId },
                data: { leido: true }
            });

            return NextResponse.json({ success: true, acknowledgement: ack });
        }

        if (action === 'evidence') {
            const { osChecklistItemId, tipo, urlArchivo, observacion, gpsLat, gpsLng } = body;
            
            const evidence = await prisma.oSChecklistEvidence.create({
                data: {
                    osChecklistItemId,
                    tipo,
                    urlArchivo,
                    observacion,
                    gpsLat,
                    gpsLng
                }
            });

            return NextResponse.json({ success: true, evidence });
        }

        return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
    } catch (e: any) {
        return NextResponse.json({ error: 'Error en QMS OS API', details: e.message }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    try {
        const body = await req.json();
        const { action } = body;

        if (action === 'checklist_item') {
            const { itemId, completado, observaciones, operatorId } = body;

            const item = await prisma.oSChecklistItem.update({
                where: { id: itemId },
                data: {
                    completado,
                    observaciones,
                    completadoPorId: operatorId,
                    fechaCompletado: completado ? new Date() : null
                }
            });

            // Check if all items in checklist are done, to update Checklist state
            const checklist = await prisma.oSChecklist.findUnique({
                where: { id: item.osChecklistId },
                include: { items: true }
            });

            if (checklist) {
                const allDone = checklist.items.every(i => i.completado || !i.esObligatorio);
                await prisma.oSChecklist.update({
                    where: { id: checklist.id },
                    data: { estado: allDone ? 'completado' : 'en_progreso' }
                });
            }

            return NextResponse.json({ success: true, item });
        }

        return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
    } catch (e: any) {
        return NextResponse.json({ error: 'Error en QMS OS API', details: e.message }, { status: 500 });
    }
}
