import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const data = await req.json();
        const { userId, userName, role, status, comment, signature } = data;

        if (!userId || !role || !status) {
            return NextResponse.json({ error: 'Faltan parámetros obligatorios (userId, role, status)' }, { status: 400 });
        }

        const doc = await prisma.controlledDocument.findUnique({
            where: { id: params.id },
            include: {
                versions: {
                    orderBy: [{ versionMayor: 'desc' }, { versionMenor: 'desc' }],
                    take: 1
                }
            }
        });

        if (!doc) {
            return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
        }

        // Parse workflowState
        let workflow: any = doc.workflowState;
        if (!workflow || typeof workflow !== 'object') {
            workflow = {
                creatorStatus: doc.createdBy ? 'approved' : 'pending',
                creatorSignature: null,
                creatorSignatureDate: null,
                revisadorStatus: doc.revisadorId ? 'pending' : 'none',
                revisadorComment: null,
                revisadorSignature: null,
                revisadorSignatureDate: null,
                aprobadorStatus: doc.aprobadorId ? 'pending' : 'none',
                aprobadorComment: null,
                aprobadorSignature: null,
                aprobadorSignatureDate: null,
                history: []
            };
        }
        // Backfill creatorStatus for legacy documents that don't have it
        if (workflow.creatorStatus === undefined) {
            workflow.creatorStatus = workflow.creatorSignature ? 'approved' : 'pending';
        }

        if (!workflow.history) {
            workflow.history = [];
        }

        const nowStr = new Date().toISOString();

        // Fetch user's current position to snapshot it
        const operator = await prisma.operator.findUnique({
            where: { id: userId },
            select: { posicion: true }
        });
        const userPosition = operator?.posicion || '';

        if (status === 'approved') {
            if (role === 'creador') {
                workflow.creatorStatus = 'approved';
                workflow.creatorSignature = signature;
                workflow.creatorSignatureDate = nowStr;
                workflow.creatorPosition = userPosition;
            } else if (role === 'revisador') {
                workflow.revisadorStatus = 'approved';
                workflow.revisadorComment = comment || 'Aprobado de conformidad';
                workflow.revisadorSignature = signature;
                workflow.revisadorSignatureDate = nowStr;
                workflow.revisadorPosition = userPosition;
            } else if (role === 'aprobador') {
                workflow.aprobadorStatus = 'approved';
                workflow.aprobadorComment = comment || 'Aprobado de conformidad';
                workflow.aprobadorSignature = signature;
                workflow.aprobadorSignatureDate = nowStr;
                workflow.aprobadorPosition = userPosition;
            }

            workflow.history.push({
                user: userName || 'Firmante',
                posicion: userPosition,
                action: 'approved',
                date: nowStr,
                comment: comment || 'Firma de conformidad',
                signature: signature
            });

            // Check if all active signers approved
            const reqCreatorApproved = workflow.creatorStatus === 'approved' || workflow.creatorStatus === 'none';
            const reqRevApproved = workflow.revisadorStatus === 'approved' || workflow.revisadorStatus === 'none';
            const reqAprApproved = workflow.aprobadorStatus === 'approved' || workflow.aprobadorStatus === 'none';

            let nuevoEstado = doc.estado;
            if (reqCreatorApproved && reqRevApproved && reqAprApproved) {
                nuevoEstado = 'vigente';

                // Promote latest version to vigente
                if (doc.versions.length > 0) {
                    const latestVersion = doc.versions[0];
                    await prisma.documentVersion.update({
                        where: { id: latestVersion.id },
                        data: {
                            estado: 'vigente',
                            aprobadorId: role === 'aprobador' ? userId : doc.aprobadorId,
                            aprobadorNombre: role === 'aprobador' ? userName : doc.aprobadorNombre,
                            fechaAprobacion: new Date()
                        }
                    });

                    // If it's a MAJOR version (versionMenor === 0), invalidate old trainings and versions
                    if (latestVersion.versionMenor === 0) {
                        // Mark all other versions as obsoleta
                        await prisma.documentVersion.updateMany({
                            where: { 
                                documentId: doc.id,
                                id: { not: latestVersion.id }
                            },
                            data: { estado: 'obsoleta' }
                        });

                        // Delete pending/unapproved operator trainings for this document
                        await prisma.technicianTraining.deleteMany({
                            where: {
                                documentId: doc.id,
                                estado: { not: 'aprobado' }
                            }
                        });

                        // Archive approved operator trainings for this document as obsoleto
                        await prisma.technicianTraining.updateMany({
                            where: {
                                documentId: doc.id,
                                estado: 'aprobado'
                            },
                            data: { estado: 'obsoleto' }
                        });

                        // Delete read confirmations so they have to read the new major version
                        await prisma.documentReadConfirmation.deleteMany({
                            where: { documentId: doc.id }
                        });

                        // Reset competencies to pendiente
                        await prisma.technicianCompetency.updateMany({
                            where: { documentId: doc.id },
                            data: { estado: 'pendiente', evidencia: null, evaluacion: null }
                        });
                    } else {
                        // For minor versions, we still obsolete older versions but we KEEP trainings intact
                        await prisma.documentVersion.updateMany({
                            where: { 
                                documentId: doc.id,
                                id: { not: latestVersion.id }
                            },
                            data: { estado: 'obsoleta' }
                        });
                    }
                }

                // Disparar capacitaciones automáticas (Motor de cumplimiento QMS)
                try {
                    const { triggerAutomaticTraining } = await import('../../../qms/compliance-engine');
                    await triggerAutomaticTraining(doc.id);
                } catch (qmsErr) {
                    console.error('QMS Automatic Training Trigger Error:', qmsErr);
                }
            }

            const updatedDoc = await prisma.controlledDocument.update({
                where: { id: params.id },
                data: {
                    estado: nuevoEstado,
                    workflowState: workflow as any
                }
            });

            await logAudit({
                userId,
                userName,
                action: 'APPROVE',
                entity: 'CONTROLLED_DOCUMENT',
                entityId: doc.id,
                newValue: updatedDoc
            });

            return NextResponse.json(updatedDoc);

        } else if (status === 'rejected') {
            if (role === 'creador') {
                workflow.creatorStatus = 'rejected';
            } else if (role === 'revisador') {
                workflow.revisadorStatus = 'rejected';
                workflow.revisadorComment = comment;
            } else if (role === 'aprobador') {
                workflow.aprobadorStatus = 'rejected';
                workflow.aprobadorComment = comment;
            }

            workflow.history.push({
                user: userName || 'Firmante',
                action: 'rejected',
                date: nowStr,
                comment: comment || 'Se requiere revisión'
            });

            // Devolver a borrador para que el creador lo modifique
            const updatedDoc = await prisma.controlledDocument.update({
                where: { id: params.id },
                data: {
                    estado: 'borrador',
                    workflowState: workflow as any
                }
            });

            // notify creator (and also create a DocumentAlert)
            if (doc.createdBy) {
                await prisma.documentAlert.create({
                    data: {
                        documentId: doc.id,
                        tipo: 'SIN_ACTUALIZAR',
                        mensaje: `Documento observado por ${userName}. Recomendación: ${comment}`,
                        leido: false,
                        destinatarioId: doc.createdBy,
                        destinatarioNombre: doc.createdByName
                    }
                });

                await prisma.notification.create({
                    data: {
                        operatorId: doc.createdBy,
                        title: "Documento Observado",
                        message: `El revisador/aprobador ${userName} ha dejado observaciones en tu documento "${doc.titulo}".`,
                        type: 'QMS_DOCUMENT_REJECTED',
                        relatedId: doc.id,
                        forSupervisors: false
                    }
                }).catch(e => console.error("Error creating document observed notification:", e));

                const { sendPushNotification } = await import('@/lib/onesignal');
                await sendPushNotification({
                    userIds: [doc.createdBy],
                    title: "Documento Observado",
                    message: `El revisador/aprobador ${userName} ha dejado observaciones en tu documento "${doc.titulo}".`,
                    data: { route: `/calidad/documentos/${doc.id}` }
                }).catch(e => console.error("Error sending push notification to creator:", e));
            }

            await logAudit({
                userId,
                userName,
                action: 'REJECT',
                entity: 'CONTROLLED_DOCUMENT',
                entityId: doc.id,
                newValue: updatedDoc
            });

            return NextResponse.json(updatedDoc);
        }

        return NextResponse.json({ error: 'Estado de firma no soportado' }, { status: 400 });

    } catch (e: any) {
        return NextResponse.json({ error: 'Error al procesar la firma', details: e.message }, { status: 500 });
    }
}
