export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushNotification } from '@/lib/onesignal';

// ── GET — List comments for a task ─────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const tareaId = url.searchParams.get('tareaId');

        if (!tareaId) {
            return NextResponse.json({ error: 'tareaId requerido' }, { status: 400 });
        }

        const comentarios = await prisma.tareaComentario.findMany({
            where: { tareaId },
            include: {
                operator: { select: { id: true, nombreCompleto: true, role: true } }
            },
            orderBy: { createdAt: 'asc' }
        });

        return NextResponse.json(comentarios);
    } catch (error) {
        console.error('[COMENTARIOS_GET]', error);
        return NextResponse.json({ error: 'Error al obtener comentarios' }, { status: 500 });
    }
}

// ── POST — Create a comment ──────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { tareaId, operatorId, operatorName, mensaje } = body;

        if (!tareaId || !operatorId || !mensaje) {
            return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
        }

        const tarea = await prisma.tarea.findUnique({
            where: { id: tareaId },
            include: { involucrados: true }
        });

        if (!tarea) {
            return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
        }

        const nuevoComentario = await prisma.tareaComentario.create({
            data: {
                tareaId,
                operatorId,
                mensaje
            },
            include: {
                operator: { select: { id: true, nombreCompleto: true, role: true } }
            }
        });

        // ── Notifications Logic ──
        const targetIds = tarea.involucrados.map(i => i.operatorId).filter(id => id !== operatorId);
        if (tarea.creadorId && tarea.creadorId !== operatorId && !targetIds.includes(tarea.creadorId)) {
            targetIds.push(tarea.creadorId);
        }

        if (targetIds.length > 0) {
            const safeName = operatorName || nuevoComentario.operator.nombreCompleto || 'Alguien';
            const msg = `${safeName} comentó en "${tarea.titulo}": ${mensaje.substring(0, 50)}${mensaje.length > 50 ? '...' : ''}`;
            
            try { 
                await sendPushNotification({ 
                    userIds: targetIds, 
                    title: 'Nuevo Comentario', 
                    message: msg, 
                    data: { url: `/tareas?id=${tarea.id}` } 
                }); 
            } catch (e) { 
                console.error('[ONESIGNAL]', e); 
            }
            
            await Promise.allSettled(targetIds.map(opId => prisma.activity.create({
                data: { 
                    type: 'COMMENT_CREATED', 
                    priority: 'NORMAL',
                    category: 'Work Orders',
                    title: 'Nuevo Comentario', 
                    message: msg, 
                    entityType: 'tarea',
                    entityId: tarea.id,
                    recipients: { create: [{ operatorId: opId }] }
                }
            })));
        }

        return NextResponse.json(nuevoComentario, { status: 201 });
    } catch (error) {
        console.error('[COMENTARIOS_POST]', error);
        return NextResponse.json({ error: 'Error al guardar comentario' }, { status: 500 });
    }
}
