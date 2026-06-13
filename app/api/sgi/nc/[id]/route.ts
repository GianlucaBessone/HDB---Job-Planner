import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const nc = await prisma.noConformidad.findUnique({
            where: { id: params.id },
            include: {
                responsableRegistro: { select: { id: true, nombreCompleto: true } },
                responsablesTratamiento: { select: { id: true, nombreCompleto: true } },
                analisisCausaRaiz: true,
                accionesMejora: true,
                verificacionesEficacia: true,
                reuniones: true,
                documentacionAfectada: {
                    include: {
                        documento: { select: { id: true, codigoDocumental: true, titulo: true } }
                    }
                },
                capacitacionesReq: true
            }
        });

        if (!nc) return NextResponse.json({ error: 'No Conformidad no encontrada' }, { status: 404 });

        return NextResponse.json(nc);
    } catch (error) {
        console.error('Error fetching No Conformidad details:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();
        
        // H-002 State transition validation
        const currentNc = await prisma.noConformidad.findUnique({
            where: { id: params.id },
            select: { estado: true }
        });
        
        if (!currentNc) return NextResponse.json({ error: 'NC no encontrada' }, { status: 404 });

        if (body.estado && body.estado !== currentNc.estado) {
            const validStates = ['Abierta', 'En análisis', 'Acción definida', 'En ejecución', 'Pendiente de validación', 'Cerrada'];
            const currentIndex = validStates.indexOf(currentNc.estado);
            const newIndex = validStates.indexOf(body.estado);

            if (newIndex === -1) {
                return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
            }
            if (newIndex > currentIndex + 1) {
                return NextResponse.json({ error: 'Transición de estado inválida' }, { status: 400 });
            }
        }

        let updateData: any = { ...body };
        if (body.responsablesTratamientoIds !== undefined) {
            updateData.responsablesTratamiento = {
                set: body.responsablesTratamientoIds.map((id: string) => ({ id }))
            };
            delete updateData.responsablesTratamientoIds;
        }

        const nc = await prisma.noConformidad.update({
            where: { id: params.id },
            data: updateData,
            include: {
                analisisCausaRaiz: true
            }
        });

        await logAudit({
            userId: auth.user.id,
            action: 'UPDATE',
            entity: 'NC',
            entityId: nc.id,
            oldValue: currentNc,
            newValue: nc
        });

        // Si se cierra la NC, generar y guardar el embedding
        if (body.estado === 'Cerrada' || nc.estado === 'Cerrada') {
            const textToEmbed = `Código: ${nc.codigoNC || ''}
Categoría: ${nc.categoria || ''}
Área: ${nc.areaAfectada || ''}
Proceso: ${nc.procesoAfectado || ''}
Descripción: ${nc.descripcion || ''}
Causa Raíz: ${nc.analisisCausaRaiz?.map(acr => acr.causaRaiz || acr.descripcion).join('; ') || ''}`;
            
            try {
                // Importación dinámica para evitar problemas de dependencias en tiempo de carga inicial
                const { getEmbedding } = require('@/lib/ai/embeddings');
                const embedding = await getEmbedding(textToEmbed);
                await prisma.noConformidad.update({
                    where: { id: nc.id },
                    data: { embedding }
                });
                console.log(`[Embedding] Vector generado con éxito para NC cerrada: ${nc.codigoNC}`);
            } catch (err) {
                console.error("[Embedding] Error al generar vector al cerrar la NC:", err);
            }
        }

        return NextResponse.json(nc);
    } catch (error) {
        console.error('Error updating No Conformidad:', error);
        return NextResponse.json({ error: 'Error al actualizar NC' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const nc = await prisma.noConformidad.findUnique({ where: { id: params.id } });
        
        await prisma.noConformidad.delete({
            where: { id: params.id }
        });

        if (nc) {
            await logAudit({
                userId: auth.user.id,
                action: 'DELETE',
                entity: 'NC',
                entityId: nc.id,
                oldValue: nc
            });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting No Conformidad:', error);
        return NextResponse.json({ error: 'Error al eliminar NC' }, { status: 500 });
    }
}
