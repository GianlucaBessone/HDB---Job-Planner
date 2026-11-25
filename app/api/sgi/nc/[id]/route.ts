import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { INCLUIR_RESPONSABLE, comoAccionMejora } from '@/lib/acciones';
import { MENSAJE_ANULADO, puedeBorrarseSgi, totalVinculados } from '@/lib/sgi/bajas';
import { exigirAcceso } from '@/lib/permisosServer';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    const auth = await exigirAcceso(req, ['calidad.ver', 'calidad.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const nc = await prisma.noConformidad.findUnique({
            where: { id: params.id },
            include: {
                responsableRegistro: { select: { id: true, nombreCompleto: true } },
                responsablesTratamiento: { select: { id: true, nombreCompleto: true } },
                analisisCausaRaiz: true,
                accionesMejora: { include: INCLUIR_RESPONSABLE },
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

        return NextResponse.json({ ...nc, accionesMejora: nc.accionesMejora.map(comoAccionMejora) });
    } catch (error) {
        console.error('Error fetching No Conformidad details:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    const auth = await exigirAcceso(req, ['calidad.gestionar']);
    if (auth instanceof NextResponse) return auth;

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
            userId: auth.userId,
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

export async function DELETE(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    const auth = await exigirAcceso(req, ['calidad.gestionar']);
    if (auth instanceof NextResponse) return auth;

    try {
        const nc = await prisma.noConformidad.findUnique({
            where: { id: params.id },
            include: { _count: { select: { analisisCausaRaiz: true, accionesMejora: true, verificacionesEficacia: true, reuniones: true, documentacionAfectada: true, capacitacionesReq: true } } },
        });
        if (!nc) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
        const motivo = new URL(req.url).searchParams.get('motivo')?.trim() || null;
        const { _count, ...datos } = nc;

        // Recién creado y sin nada vinculado: se puede borrar (error de carga). Si no, se anula.
        if (!puedeBorrarseSgi(datos, 'Abierta', totalVinculados(_count))) {
            if (datos.estado === 'Anulada') return NextResponse.json({ error: 'Ya está anulado' }, { status: 409 });
            await prisma.noConformidad.update({ where: { id: params.id }, data: { estado: 'Anulada' } });
            await logAudit({
                userId: auth.userId,
                userName: auth.nombre,
                action: 'UPDATE',
                entity: 'NC',
                entityId: params.id,
                oldValue: { estado: datos.estado },
                newValue: { estado: 'Anulada' },
                metadata: { message: 'Anulado en lugar de eliminado', motivo, vinculados: _count },
            });
            return NextResponse.json({ success: true, modo: 'anulado', message: MENSAJE_ANULADO });
        }

        await prisma.noConformidad.delete({ where: { id: params.id } });
        await logAudit({
            userId: auth.userId,
            userName: auth.nombre,
            action: 'DELETE',
            entity: 'NC',
            entityId: params.id,
            oldValue: datos,
            metadata: { motivo },
        });
        return NextResponse.json({ success: true, modo: 'eliminado' });
    } catch (error) {
        console.error('Error deleting No Conformidad:', error);
        return NextResponse.json({ error: 'Error al eliminar NC' }, { status: 500 });
    }
}
