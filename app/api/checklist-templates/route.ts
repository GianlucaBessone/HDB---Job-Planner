import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');
        const tagId = searchParams.get('tagId');

        const where: any = {};
        if (status) where.status = status;
        if (tagId) {
            where.tags = { some: { tagId } };
        }

        const templates = await prisma.checklistTemplate.findMany({
            where,
            include: {
                tags: {
                    include: {
                        tag: { select: { id: true, name: true } }
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        return NextResponse.json(templates);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al obtener plantillas', details: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const data = await req.json();
        const {
            code, name, description, checklistItems,
            requiresEvidence, requiresPhotos, requiresSignature,
            riskLevel, tagIds, userId, userName
        } = data;

        if (!name?.trim()) {
            return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
        }

        // Check unique code if provided
        if (code?.trim()) {
            const existing = await prisma.checklistTemplate.findUnique({
                where: { code: code.trim().toUpperCase() }
            });
            if (existing) {
                return NextResponse.json({ error: 'Ya existe una plantilla con ese código' }, { status: 409 });
            }
        }

        const template = await prisma.checklistTemplate.create({
            data: {
                code: code?.trim()?.toUpperCase() || null,
                name: name.trim(),
                description: description || null,
                version: 1,
                status: 'active',
                checklistItems: checklistItems || [],
                requiresEvidence: requiresEvidence || false,
                requiresPhotos: requiresPhotos || false,
                requiresSignature: requiresSignature || false,
                riskLevel: riskLevel || 'low',
            }
        });

        // Link to tags if provided
        if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
            for (const tagId of tagIds) {
                await prisma.tagChecklistTemplate.create({
                    data: { tagId, checklistTemplateId: template.id }
                });
            }
        }

        await logAudit({
            userId,
            userName,
            action: 'CREATE',
            entity: 'CHECKLIST_TEMPLATE',
            entityId: template.id,
            newValue: template,
        });

        return NextResponse.json(template);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al crear plantilla', details: e.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const data = await req.json();
        const {
            id, name, description, checklistItems,
            requiresEvidence, requiresPhotos, requiresSignature,
            riskLevel, status, bumpVersion, tagIds,
            userId, userName
        } = data;

        if (!id) {
            return NextResponse.json({ error: 'ID es obligatorio' }, { status: 400 });
        }

        const old = await prisma.checklistTemplate.findUnique({ where: { id } });
        if (!old) {
            return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
        }

        const updateData: any = {};
        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description;
        if (checklistItems !== undefined) updateData.checklistItems = checklistItems;
        if (requiresEvidence !== undefined) updateData.requiresEvidence = requiresEvidence;
        if (requiresPhotos !== undefined) updateData.requiresPhotos = requiresPhotos;
        if (requiresSignature !== undefined) updateData.requiresSignature = requiresSignature;
        if (riskLevel !== undefined) updateData.riskLevel = riskLevel;
        if (status !== undefined) updateData.status = status;

        // Version bump: increment version number
        if (bumpVersion) {
            updateData.version = old.version + 1;
        }

        const template = await prisma.checklistTemplate.update({
            where: { id },
            data: updateData
        });

        // Update tag links if provided
        if (tagIds !== undefined && Array.isArray(tagIds)) {
            // Remove old links
            await prisma.tagChecklistTemplate.deleteMany({
                where: { checklistTemplateId: id }
            });
            // Create new links
            for (const tagId of tagIds) {
                await prisma.tagChecklistTemplate.create({
                    data: { tagId, checklistTemplateId: id }
                });
            }
        }

        await logAudit({
            userId,
            userName,
            action: 'UPDATE',
            entity: 'CHECKLIST_TEMPLATE',
            entityId: template.id,
            oldValue: old,
            newValue: template,
            metadata: {
                signature: data.signature || null,
                signatureReason: data.signatureReason || null,
                versionBumped: !!bumpVersion,
                date: new Date().toISOString()
            }
        });

        return NextResponse.json(template);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al actualizar plantilla', details: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID es obligatorio' }, { status: 400 });

        const old = await prisma.checklistTemplate.findUnique({ where: { id } });
        if (!old) return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });

        await prisma.tagChecklistTemplate.deleteMany({ where: { checklistTemplateId: id } });
        await prisma.checklistTemplate.delete({ where: { id } });

        await logAudit({
            action: 'DELETE',
            entity: 'CHECKLIST_TEMPLATE',
            entityId: id,
            oldValue: old,
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al eliminar plantilla', details: e.message }, { status: 500 });
    }
}
