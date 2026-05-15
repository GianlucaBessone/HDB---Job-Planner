import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/documentos/[id]/versions/[versionId]
 * Update a version: change state (approve → vigente, obsolete, etc.)
 */
export async function PUT(req: Request, { params }: { params: { id: string; versionId: string } }) {
    try {
        const data = await req.json();
        const {
            estado, // borrador | en_revision | vigente | obsoleto
            aprobadorId, aprobadorNombre,
            motivoCambio, notas, checklistTemplate,
            userId, userName
        } = data;

        const version = await prisma.documentVersion.findUnique({
            where: { id: params.versionId }
        });
        if (!version || version.documentId !== params.id) {
            return NextResponse.json({ error: 'Versión no encontrada' }, { status: 404 });
        }

        const updateData: any = {};
        if (estado !== undefined) updateData.estado = estado;
        if (aprobadorId !== undefined) updateData.aprobadorId = aprobadorId;
        if (aprobadorNombre !== undefined) updateData.aprobadorNombre = aprobadorNombre;
        if (motivoCambio !== undefined) updateData.motivoCambio = motivoCambio;
        if (notas !== undefined) updateData.notas = notas;
        if (checklistTemplate !== undefined) updateData.checklistTemplate = checklistTemplate;

        // If setting to vigente → approve
        if (estado === 'vigente') {
            updateData.fechaAprobacion = new Date();
            if (!updateData.aprobadorId) updateData.aprobadorId = userId;
            if (!updateData.aprobadorNombre) updateData.aprobadorNombre = userName;

            // Obsolete ALL other vigente versions of this document
            await prisma.documentVersion.updateMany({
                where: {
                    documentId: params.id,
                    estado: 'vigente',
                    id: { not: params.versionId }
                },
                data: { estado: 'obsoleto' }
            });

            // Update the parent document
            await prisma.controlledDocument.update({
                where: { id: params.id },
                data: {
                    estado: 'vigente',
                    versionMayor: version.versionMayor,
                    versionMenor: version.versionMenor,
                    fechaRevision: new Date(),
                    aprobadorId: updateData.aprobadorId || null,
                    aprobadorNombre: updateData.aprobadorNombre || null,
                    hashDocumental: version.hashDocumental || null,
                }
            });
        }

        // If marking as obsoleto
        if (estado === 'obsoleto') {
            // Check if this is the only vigente version
            const otherVigente = await prisma.documentVersion.findFirst({
                where: {
                    documentId: params.id,
                    estado: 'vigente',
                    id: { not: params.versionId }
                }
            });
            // If no other vigente version, mark document as obsoleto too
            if (!otherVigente && version.estado === 'vigente') {
                await prisma.controlledDocument.update({
                    where: { id: params.id },
                    data: { estado: 'obsoleto' }
                });
            }
        }

        const updated = await prisma.documentVersion.update({
            where: { id: params.versionId },
            data: updateData,
            include: { files: true }
        });

        await logAudit({
            userId,
            userName,
            action: estado === 'vigente' ? 'APPROVE' : 'UPDATE',
            entity: 'DOCUMENT_VERSION',
            entityId: params.versionId,
            oldValue: version,
            newValue: updated,
        });

        return NextResponse.json(updated);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al actualizar versión', details: e.message }, { status: 500 });
    }
}
