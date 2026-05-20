import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const doc = await prisma.controlledDocument.findUnique({
            where: { id: params.id },
            include: {
                versions: {
                    orderBy: [{ versionMayor: 'desc' }, { versionMenor: 'desc' }],
                    include: {
                        files: true
                    }
                },
                readConfirmations: {
                    orderBy: { confirmadoAt: 'desc' }
                },
                alerts: {
                    orderBy: { createdAt: 'desc' }
                },
                documentoReemplazado: {
                    select: { id: true, codigoDocumental: true, titulo: true }
                },
                applicabilityRules: true,
                documentosReemplazantes: {
                    select: { id: true, codigoDocumental: true, titulo: true }
                },
                trainings: {
                    include: {
                        operator: true
                    }
                }
            }
        });

        if (!doc) {
            return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
        }

        // Compute indicators
        let indicadorVencimiento: string = 'sin_fecha';
        if (doc.proximaRevision) {
            const now = new Date();
            const diff = doc.proximaRevision.getTime() - now.getTime();
            const daysDiff = diff / (1000 * 60 * 60 * 24);
            if (daysDiff < 0) indicadorVencimiento = 'vencido';
            else if (daysDiff <= 30) indicadorVencimiento = 'proximo';
            else indicadorVencimiento = 'vigente';
        }
        if (doc.estado === 'obsoleto') indicadorVencimiento = 'vencido';

        return NextResponse.json({
            ...doc,
            indicadorVencimiento,
            versionActual: `${doc.versionMayor}.${doc.versionMenor}`,
        });
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al obtener documento', details: e.message }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    try {
        const data = await req.json();
        const {
            titulo, tipoDocumento, area, estado,
            responsableId, responsableNombre, 
            revisadorId, revisadorNombre,
            aprobadorId, aprobadorNombre,
            requiereConfirmacionLectura, requiereCapacitacion, nivelCriticidad,
            documentoReemplazadoId, motivoCambio,
            tags, observaciones, proximaRevision, validezMeses,
            descripcion, creatorSignature,
            userId, userName
        } = data;

        const oldDoc = await prisma.controlledDocument.findUnique({ where: { id: params.id } }) as any;
        if (!oldDoc) {
            return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
        }

        const updateData: any = {};
        if (titulo !== undefined) updateData.titulo = titulo.trim();
        if (tipoDocumento !== undefined) updateData.tipoDocumento = tipoDocumento;
        if (area !== undefined) updateData.area = area;
        if (estado !== undefined) updateData.estado = estado;
        if (responsableId !== undefined) updateData.responsableId = responsableId || null;
        if (responsableNombre !== undefined) updateData.responsableNombre = responsableNombre || null;
        if (revisadorId !== undefined) updateData.revisadorId = revisadorId || null;
        if (revisadorNombre !== undefined) updateData.revisadorNombre = revisadorNombre || null;
        if (aprobadorId !== undefined) updateData.aprobadorId = aprobadorId || null;
        if (aprobadorNombre !== undefined) updateData.aprobadorNombre = aprobadorNombre || null;
        if (requiereConfirmacionLectura !== undefined) updateData.requiereConfirmacionLectura = requiereConfirmacionLectura;
        if (requiereCapacitacion !== undefined) updateData.requiereCapacitacion = requiereCapacitacion;
        if (nivelCriticidad !== undefined) updateData.nivelCriticidad = nivelCriticidad;
        if (validezMeses !== undefined) updateData.validezMeses = validezMeses ? parseInt(validezMeses) : null;
        if (documentoReemplazadoId !== undefined) updateData.documentoReemplazadoId = documentoReemplazadoId || null;
        if (motivoCambio !== undefined) updateData.motivoCambio = motivoCambio;
        if (tags !== undefined) updateData.tags = tags;
        if (observaciones !== undefined) updateData.observaciones = observaciones;
        if (proximaRevision !== undefined) updateData.proximaRevision = proximaRevision ? new Date(proximaRevision) : null;
        if (descripcion !== undefined) updateData.descripcion = descripcion;

        // Fetch user's position for signature block
        const operator = await prisma.operator.findUnique({
            where: { id: userId },
            select: { posicion: true }
        });
        const userPosition = operator?.posicion || '';

        // Si el documento entra en un nuevo ciclo de revisión, actualizamos las firmas
        if (oldDoc.estado === 'borrador' || oldDoc.estado === 'en_revision' || estado === 'en_revision') {
            let workflow: any = oldDoc.workflowState || {};
            if (workflow && typeof workflow === 'object') {
                workflow.creatorStatus = creatorSignature ? 'approved' : (workflow.creatorStatus || 'pending');
                workflow.creatorSignature = creatorSignature || workflow.creatorSignature;
                workflow.creatorSignatureDate = creatorSignature ? new Date().toISOString() : workflow.creatorSignatureDate;
                
                // Track the actual person doing this specific edit/version
                workflow.editorName = userName || null;
                workflow.editorPosition = userPosition || null;

                workflow.revisadorStatus = (revisadorId || oldDoc.revisadorId) ? 'pending' : 'none';
                workflow.revisadorComment = null;
                workflow.revisadorSignature = null;
                workflow.revisadorSignatureDate = null;
                
                workflow.aprobadorStatus = (aprobadorId || oldDoc.aprobadorId) ? 'pending' : 'none';
                workflow.aprobadorComment = null;
                workflow.aprobadorSignature = null;
                workflow.aprobadorSignatureDate = null;

                if (!workflow.history) workflow.history = [];
                workflow.history.push({
                    user: userName || 'Editor',
                    posicion: userPosition || '',
                    action: 'modified',
                    date: new Date().toISOString(),
                    comment: motivoCambio || 'Modificaciones aplicadas / Nueva versión',
                    signature: creatorSignature || null
                });

                updateData.workflowState = workflow;
                updateData.estado = 'en_revision'; // Re-submit for review!
            }
        }

        const doc = await prisma.controlledDocument.update({
            where: { id: params.id },
            data: updateData
        });

        if (updateData.estado === 'en_revision') {
            const notifiedUserIds: string[] = [];
            if (doc.revisadorId) notifiedUserIds.push(doc.revisadorId);
            if (doc.aprobadorId && doc.aprobadorId !== doc.revisadorId) notifiedUserIds.push(doc.aprobadorId);

            if (notifiedUserIds.length > 0) {
                const { sendPushNotification } = await import('@/lib/onesignal');
                await sendPushNotification({
                    userIds: notifiedUserIds,
                    title: "Revisión Documental Requerida",
                    message: `El documento "${doc.codigoDocumental}" ha sido modificado y requiere tu firma/revisión nuevamente.`,
                    data: { route: `/calidad/documentos/${doc.id}` }
                }).catch(e => console.error("Error sending push notification to reviewers:", e));

                for (const targetId of notifiedUserIds) {
                    await prisma.notification.create({
                        data: {
                            operatorId: targetId,
                            title: "Revisión Documental Requerida",
                            message: `El documento "${doc.codigoDocumental}" ha sido modificado y requiere tu firma/revisión nuevamente.`,
                            type: 'QMS_DOCUMENT_REVIEW',
                            relatedId: doc.id,
                            forSupervisors: false
                        }
                    }).catch(e => console.error("Error creating internal QMS notification:", e));
                }
            }
        }

        await logAudit({
            userId,
            userName,
            action: 'UPDATE',
            entity: 'CONTROLLED_DOCUMENT',
            entityId: doc.id,
            oldValue: oldDoc,
            newValue: doc,
        });

        return NextResponse.json(doc);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al actualizar documento', details: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        const doc = await prisma.controlledDocument.findUnique({ where: { id: params.id } });
        if (!doc) {
            return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
        }

        // Don't allow deleting vigente documents — must obsolete first
        if (doc.estado === 'vigente') {
            return NextResponse.json({ error: 'No se puede eliminar un documento vigente. Primero debe marcarlo como obsoleto.' }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const userName = searchParams.get('userName');

        await prisma.controlledDocument.delete({ where: { id: params.id } });

        await logAudit({
            userId: userId || undefined,
            userName: userName || undefined,
            action: 'DELETE',
            entity: 'CONTROLLED_DOCUMENT',
            entityId: params.id,
            oldValue: doc,
        });

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al eliminar documento', details: e.message }, { status: 500 });
    }
}
