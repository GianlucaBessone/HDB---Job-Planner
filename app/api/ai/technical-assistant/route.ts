import { NextResponse } from 'next/server';
import { generateObject } from '@/lib/ai';
import { TechAssistantOutput } from '@/lib/ai/types';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { 
            falla, 
            sintomas, 
            observaciones, 
            projectId, 
            userId, 
            userName, 
            userRole,
            conversationId 
        } = body;

        if (!falla || !sintomas) {
            return NextResponse.json({ error: 'Faltan parámetros obligatorios: falla y sintomas.' }, { status: 400 });
        }

        // 1. Obtener contexto del equipo en DB si projectId está presente
        let equipoTipo = 'No especificado';
        let equipoHistorial = 'Sin registros previos en base de datos.';
        let categoriaServicio = 'General';

        if (projectId) {
            const project = await prisma.project.findUnique({
                where: { id: projectId },
                include: {
                    logs: { orderBy: { createdAt: 'desc' }, take: 5 },
                    ordenesServicio: { 
                        orderBy: { fechaCreacion: 'desc' }, 
                        take: 3, 
                        select: { codigoOS: true, reporte: true, estado: true } 
                    }
                }
            });

            if (project) {
                equipoTipo = project.nombre;
                categoriaServicio = project.categoria || 'Mantenimiento';
                
                const logsStr = project.logs.map(log => 
                    `[${log.fecha}] (${log.categoria}) ${log.observacion}`
                ).join('\n');
                
                const osStr = project.ordenesServicio.map(os => 
                    `[OS: ${os.codigoOS}] Estado: ${os.estado} - Reporte: ${os.reporte.substring(0, 150)}...`
                ).join('\n');

                equipoHistorial = `Detalles del Proyecto:\n- Tipo/Actividad: ${project.tipoActividad || 'N/A'}\n- Estado: ${project.estado}\n\nHistorial Reciente de Notas/Bloqueos:\n${logsStr || 'Ninguno'}\n\nÓrdenes de Servicio Previas:\n${osStr || 'Ninguna'}`;
            }
        }

        // 2. Generación mediante la Capa Centralizada de IA
        const aiResponse = await generateObject<TechAssistantOutput>(
            'TECH_ASSISTANT',
            { 
                falla, 
                sintomas, 
                observaciones: observaciones || 'Sin observaciones.',
                equipoTipo,
                equipoHistorial,
                categoriaServicio
            },
            {
                userId,
                userName,
                userRole,
                entity: projectId ? 'Project' : undefined,
                entityId: projectId,
                temperature: 0.2
            }
        );

        if (!aiResponse.success || !aiResponse.data) {
            return NextResponse.json({ error: aiResponse.error || 'Error al generar diagnóstico técnico.' }, { status: 500 });
        }

        const diagnosis = aiResponse.data;

        // 3. Registrar o actualizar la conversación en DB
        let finalConversationId = conversationId;
        if (userId) {
            const userMsg = `Falla: ${falla}. Síntomas: ${sintomas}. Obs: ${observaciones || 'ninguna'}`;
            const modelMsg = `Prioridad: ${diagnosis.prioridadProblema.toUpperCase()}\n\nCausas probables:\n${diagnosis.causasPosibles.map(c => `- ${c.causa} (${c.probabilidad}): ${c.justificacion}`).join('\n')}\n\nPasos recomendados:\n${diagnosis.pasosDiagnostico.map((p, i) => `${i+1}. ${p}`).join('\n')}`;

            if (finalConversationId) {
                // Agregar mensajes a la conversación existente
                await prisma.$transaction([
                    prisma.aiConversationMessage.create({
                        data: { conversationId: finalConversationId, role: 'user', content: userMsg }
                    }),
                    prisma.aiConversationMessage.create({
                        data: { conversationId: finalConversationId, role: 'model', content: modelMsg }
                    }),
                    prisma.aiConversation.update({
                        where: { id: finalConversationId },
                        data: { updatedAt: new Date() }
                    })
                ]);
            } else {
                // Crear nueva conversación y agregar los mensajes
                const newConv = await prisma.aiConversation.create({
                    data: {
                        userId,
                        entity: projectId ? 'Project' : null,
                        entityId: projectId || null,
                        title: `Falla en ${equipoTipo}: ${falla.substring(0, 30)}...`,
                        messages: {
                            create: [
                                { role: 'user', content: userMsg },
                                { role: 'model', content: modelMsg }
                            ]
                        }
                    }
                });
                finalConversationId = newConv.id;
            }
        }

        return NextResponse.json({
            success: true,
            diagnosis,
            conversationId: finalConversationId,
            usage: aiResponse.usage,
            latencyMs: aiResponse.latencyMs
        });

    } catch (error: any) {
        console.error('[Api][TechAssistant] Failed:', error);
        return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
    }
}
