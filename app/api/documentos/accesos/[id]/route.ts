import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    try {
        const body = await req.json();
        const { codigo, nombre, descripcion, icon, orden, moduleId, userId, userName } = body;

        const existing = await prisma.documentSubAccess.findUnique({
            where: { id: params.id }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Sub-acceso no encontrado.' }, { status: 404 });
        }

        const updateData: any = {};
        if (codigo !== undefined) updateData.codigo = codigo.trim();
        if (nombre !== undefined) updateData.nombre = nombre.trim();
        if (descripcion !== undefined) updateData.descripcion = descripcion?.trim() || null;
        if (icon !== undefined) updateData.icon = icon;
        if (orden !== undefined) updateData.orden = orden;
        if (moduleId !== undefined) updateData.moduleId = moduleId;

        const updated = await prisma.documentSubAccess.update({
            where: { id: params.id },
            data: updateData,
            include: {
                module: true,
                _count: { select: { documentos: true } }
            }
        });

        await logAudit({
            userId,
            userName,
            action: 'UPDATE',
            entity: 'DOCUMENT_SUB_ACCESS',
            entityId: updated.id,
            oldValue: existing,
            newValue: updated
        });

        return NextResponse.json(updated);
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al actualizar sub-acceso', details: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId') || undefined;
        const userName = searchParams.get('userName') || undefined;

        const existing = await prisma.documentSubAccess.findUnique({
            where: { id: params.id },
            include: { _count: { select: { documentos: true } } }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Sub-acceso no encontrado.' }, { status: 404 });
        }

        // Unlink any documents pointing to this sub-access before deletion
        if (existing._count.documentos > 0) {
            await prisma.controlledDocument.updateMany({
                where: { subAccessId: params.id },
                data: { subAccessId: null }
            });
        }

        await prisma.documentSubAccess.delete({
            where: { id: params.id }
        });

        await logAudit({
            userId,
            userName,
            action: 'DELETE',
            entity: 'DOCUMENT_SUB_ACCESS',
            entityId: params.id,
            oldValue: existing
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al eliminar sub-acceso', details: e.message }, { status: 500 });
    }
}
