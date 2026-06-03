import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { sendPushNotification } from '@/lib/onesignal';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const sugerencia = await prisma.sugerencia.findUnique({
            where: { id: params.id },
            include: {
                usuario: {
                    select: {
                        id: true,
                        nombreCompleto: true,
                        role: true,
                        posicion: true
                    }
                },
                responsable: {
                    select: {
                        id: true,
                        nombreCompleto: true,
                        role: true,
                        posicion: true
                    }
                },
                comentarios: {
                    orderBy: { fecha: 'asc' }
                },
                historial: {
                    orderBy: { fecha: 'asc' }
                },
                acciones: {
                    include: {
                        responsable: {
                            select: { id: true, nombreCompleto: true }
                        }
                    },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        if (!sugerencia) {
            return NextResponse.json({ error: 'Propuesta no encontrada.' }, { status: 404 });
        }

        return NextResponse.json(sugerencia);
    } catch (error) {
        console.error('Error fetching sugerencia:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    try {
        const body = await req.json();
        const { 
            estado, 
            comentario, 
            actorId, 
            actorNombre,
            responsable_id,
            fecha_cierre,
            reunion_programada,
            notas_resolucion,
            nuevaAccion
        } = body;

        const sugerencia = await prisma.sugerencia.findUnique({
            where: { id: params.id }
        });

        if (!sugerencia) {
            return NextResponse.json({ error: 'Propuesta no encontrada.' }, { status: 404 });
        }

        const oldValue = { ...sugerencia };
        let estadoActualizado = sugerencia.estado;
        const auditUserName = actorNombre || 'Sistema';
        const auditUserId = actorId || null;

        // 1. Handle fields update (responsable, fechas, notas, etc)
        const updateData: any = {};
        if (responsable_id !== undefined) updateData.responsable_id = responsable_id;
        if (fecha_cierre !== undefined) updateData.fecha_cierre = fecha_cierre ? new Date(fecha_cierre) : null;
        if (reunion_programada !== undefined) updateData.reunion_programada = reunion_programada ? new Date(reunion_programada) : null;
        if (notas_resolucion !== undefined) updateData.notas_resolucion = notas_resolucion;

        if (Object.keys(updateData).length > 0) {
            await prisma.sugerencia.update({
                where: { id: params.id },
                data: updateData
            });
            
            await logAudit({
                userId: auditUserId,
                userName: auditUserName,
                action: 'UPDATE',
                entity: 'SUGERENCIA',
                entityId: sugerencia.id,
                newValue: updateData
            });
        }

        // 2. Handle state change
        if (estado && estado !== sugerencia.estado) {
            const validStates = ['Pendiente', 'En evaluación', 'Solicita información adicional', 'Aprobada', 'Rechazada', 'En implementación', 'Implementada', 'Verificada', 'Cerrada'];
            if (!validStates.includes(estado)) {
                return NextResponse.json({ error: 'Estado no válido.' }, { status: 400 });
            }

            // Update in DB
            await prisma.sugerencia.update({
                where: { id: params.id },
                data: { estado }
            });
            estadoActualizado = estado;

            // Audit suggestion state history
            await prisma.sugerenciaHistorial.create({
                data: {
                    sugerenciaId: sugerencia.id,
                    estadoAnterior: sugerencia.estado,
                    estadoNuevo: estado,
                    usuario: auditUserName
                }
            });

            // System Audit Log
            await logAudit({
                userId: auditUserId,
                userName: auditUserName,
                action: 'UPDATE',
                entity: 'SUGERENCIA',
                entityId: sugerencia.id,
                oldValue: { estado: sugerencia.estado },
                newValue: { estado: estado }
            });

            // Send notification if presentation is identified
            if (sugerencia.presentacion === 'identificada' && sugerencia.usuario_id) {
                const title = "Actualización de tu propuesta";
                const message = `Tu propuesta "${sugerencia.titulo}" cambió de estado a: ${estado}.`;

                // In-app notification
                await prisma.notification.create({
                    data: {
                        operatorId: sugerencia.usuario_id,
                        title,
                        message,
                        type: 'SUGERENCIA_ESTADO_CHANGE',
                        relatedId: sugerencia.id,
                        forSupervisors: false
                    }
                }).catch(e => console.error("Error creating state change notification:", e));

                // Push notification
                await sendPushNotification({
                    userIds: [sugerencia.usuario_id],
                    title,
                    message,
                    data: { route: `/ideas-sugerencias-reclamos/${sugerencia.id}` }
                }).catch(e => console.error("Error sending state change push notification:", e));
            }
        }

        // 2. Handle comment / internal observation addition
        if (comentario && comentario.trim() !== '') {
            const nuevoComentario = await prisma.sugerenciaComentario.create({
                data: {
                    sugerenciaId: sugerencia.id,
                    autor: auditUserName,
                    texto: comentario.trim()
                }
            });

            // System Audit Log for comment
            await logAudit({
                userId: auditUserId,
                userName: auditUserName,
                action: 'CREATE',
                entity: 'SUGERENCIA_COMENTARIO',
                entityId: nuevoComentario.id,
                newValue: { comentario: comentario.trim() }
            });

            // Send notification if presentation is identified
            if (sugerencia.presentacion === 'identificada' && sugerencia.usuario_id) {
                const title = "Nueva observación en tu propuesta";
                const message = `Se ha agregado una nueva observación a tu propuesta "${sugerencia.titulo}".`;

                // In-app notification
                await prisma.notification.create({
                    data: {
                        operatorId: sugerencia.usuario_id,
                        title,
                        message,
                        type: 'SUGERENCIA_COMENTARIO',
                        relatedId: sugerencia.id,
                        forSupervisors: false
                    }
                }).catch(e => console.error("Error creating comment notification:", e));

                // Push notification
                await sendPushNotification({
                    userIds: [sugerencia.usuario_id],
                    title,
                    message,
                    data: { route: `/ideas-sugerencias-reclamos/${sugerencia.id}` }
                }).catch(e => console.error("Error sending comment push notification:", e));
            }
        }

        // 3. Handle AccionMejora addition
        if (nuevaAccion && nuevaAccion.descripcion && nuevaAccion.descripcion.trim() !== '') {
            const accion = await prisma.accionMejora.create({
                data: {
                    sugerenciaId: sugerencia.id,
                    descripcion: nuevaAccion.descripcion.trim(),
                    responsableId: nuevaAccion.responsableId || null,
                    fechaLimite: nuevaAccion.fechaLimite ? new Date(nuevaAccion.fechaLimite) : null,
                    estado: 'Pendiente'
                }
            });

            await logAudit({
                userId: auditUserId,
                userName: auditUserName,
                action: 'CREATE',
                entity: 'ACCION_MEJORA',
                entityId: accion.id,
                newValue: accion
            });

            if (accion.responsableId) {
                const title = "Nueva Acción de Mejora Asignada";
                const message = `Se te ha asignado una nueva acción: "${accion.descripcion}" vinculada al ticket #${sugerencia.id}.`;
                
                await prisma.notification.create({
                    data: {
                        operatorId: accion.responsableId,
                        title,
                        message,
                        type: 'ACCION_MEJORA_ASSIGNED',
                        relatedId: sugerencia.id,
                        forSupervisors: false
                    }
                }).catch(e => console.error("Error creating action notification:", e));

                await sendPushNotification({
                    userIds: [accion.responsableId],
                    title,
                    message,
                    data: { route: `/ideas-sugerencias-reclamos/${sugerencia.id}` }
                }).catch(e => console.error("Error sending action push notification:", e));
            }
        }

        // Return updated suggestion details
        const updatedSugerencia = await prisma.sugerencia.findUnique({
            where: { id: params.id },
            include: {
                usuario: {
                    select: {
                        id: true,
                        nombreCompleto: true,
                        role: true,
                        posicion: true
                    }
                },
                responsable: {
                    select: {
                        id: true,
                        nombreCompleto: true,
                        role: true,
                        posicion: true
                    }
                },
                comentarios: {
                    orderBy: { fecha: 'asc' }
                },
                historial: {
                    orderBy: { fecha: 'asc' }
                },
                acciones: {
                    include: {
                        responsable: {
                            select: { id: true, nombreCompleto: true }
                        }
                    },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        return NextResponse.json(updatedSugerencia);
    } catch (error: any) {
        console.error('Error updating sugerencia:', error);
        return NextResponse.json({ error: 'Error del servidor al actualizar.' }, { status: 500 });
    }
}
