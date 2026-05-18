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

        if (!workflow.history) {
            workflow.history = [];
        }

        const nowStr = new Date().toISOString();

        if (status === 'approved') {
            if (role === 'revisador') {
                workflow.revisadorStatus = 'approved';
                workflow.revisadorComment = comment || 'Aprobado de conformidad';
                workflow.revisadorSignature = signature;
                workflow.revisadorSignatureDate = nowStr;
            } else if (role === 'aprobador') {
                workflow.aprobadorStatus = 'approved';
                workflow.aprobadorComment = comment || 'Aprobado de conformidad';
                workflow.aprobadorSignature = signature;
                workflow.aprobadorSignatureDate = nowStr;
            }

            workflow.history.push({
                user: userName || 'Firmante',
                action: 'approved',
                date: nowStr,
                comment: comment || 'Firma de conformidad',
                signature: signature
            });

            // Check if all active signers approved
            const reqRevApproved = workflow.revisadorStatus === 'approved' || workflow.revisadorStatus === 'none';
            const reqAprApproved = workflow.aprobadorStatus === 'approved' || workflow.aprobadorStatus === 'none';

            let nuevoEstado = doc.estado;
            if (reqRevApproved && reqAprApproved) {
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
            if (role === 'revisador') {
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
