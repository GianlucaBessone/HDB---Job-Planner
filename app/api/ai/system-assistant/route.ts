import { NextResponse } from 'next/server';
import { generateObject } from '@/lib/ai';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { 
            consulta,
            userId, 
            userName, 
            userRole,
            conversationId 
        } = body;

        if (!consulta || !userId) {
            return NextResponse.json({ error: 'Faltan parámetros obligatorios: consulta o userId.' }, { status: 400 });
        }

        // 1. Obtener contexto del usuario (Least Privilege)
        // Horas trabajadas (últimos 30 días aprox o del periodo)
        const timeEntries = await prisma.timeEntry.findMany({
            where: { operatorId: userId },
            orderBy: { fecha: 'desc' },
            take: 20
        });

        // Proyectos asignados
        const proyectos = await prisma.project.findMany({
            where: { responsableId: userId },
            select: { id: true, nombre: true, estado: true }
        });

        const userDataStr = `
Usuario: ${userName}
Rol: ${userRole}
Proyectos Responsable: ${proyectos.map(p => p.nombre).join(', ') || 'Ninguno'}
Últimos Fichajes: ${timeEntries.map(t => `${t.fecha}: ${t.horasTrabajadas}h`).join(', ') || 'Ninguno'}
        `.trim();

        const userRoleLower = userRole?.toLowerCase() || 'operador';

        // 2. Obtener vistas permitidas del usuario
        let userViews: any[] = [];
        try {
            const options = await prisma.configOption.findMany({
                where: { category: 'VIEW_ACCESS' }
            });
            const { getViewConfig } = await import('@/lib/viewAccess');
            const savedConfigs = options.map(o => {
                try { return JSON.parse(o.value); } catch { return null; }
            }).filter(Boolean);
            
            const mergedViews = getViewConfig(savedConfigs);
            userViews = mergedViews.filter(v => v.roles.includes(userRoleLower));
        } catch (e) {
            console.error('Error fetching user views for AI context', e);
        }
        
        const vistasPermitidasStr = userViews.map(v => `- ${v.label} (${v.description})`).join('\n') || 'Ninguna';

        // 3. Extraer contexto organizacional SI es supervisor/admin
        let orgContextStr = '';
        if (['supervisor', 'admin'].includes(userRoleLower)) {
            try {
                const currentDate = new Date();
                const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                
                const timeEntriesThisMonth = await prisma.timeEntry.groupBy({
                    by: ['operatorId'],
                    _sum: { horasTrabajadas: true },
                    where: { fecha: { startsWith: currentMonth } }
                });
                
                const activeOperators = await prisma.operator.findMany({
                    where: { activo: true },
                    select: { 
                        id: true, 
                        nombreCompleto: true, 
                        role: true,
                        responsibleProjects: {
                            where: { estado: 'Activo' },
                            select: { nombre: true }
                        }
                    }
                });
                
                const operatorMetrics = activeOperators.map(op => {
                    const stats = timeEntriesThisMonth.find(t => t.operatorId === op.id);
                    return {
                        nombre: op.nombreCompleto,
                        rol: op.role,
                        horasEsteMes: stats?._sum?.horasTrabajadas || 0,
                        proyectosResponsable: op.responsibleProjects.map(p => p.nombre)
                    };
                });

                const activeProjects = await prisma.project.findMany({
                    where: { estado: 'Activo' },
                    select: { 
                        nombre: true, 
                        estado: true, 
                        client: { select: { nombre: true } },
                        horasEstimadas: true,
                        horasConsumidas: true,
                        responsableUser: { select: { nombreCompleto: true } }
                    }
                });

                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const recentSurveys = await prisma.encuestaServicio.findMany({
                    where: { fecha: { gte: thirtyDaysAgo } },
                    select: {
                        nps: true, atencion: true, calidad: true, tiempo: true, comentario: true,
                        project: { select: { nombre: true } },
                        ordenServicio: { select: { codigoOS: true } }
                    }
                });

                const systemSnapshot = {
                    mesActual: currentMonth,
                    operadores: operatorMetrics,
                    proyectosActivos: activeProjects.map(p => ({
                        nombre: p.nombre,
                        cliente: p.client?.nombre || 'Sin cliente',
                        progreso: p.horasEstimadas ? Math.round((p.horasConsumidas / p.horasEstimadas) * 100) : 0,
                        responsable: p.responsableUser?.nombreCompleto || 'Sin responsable'
                    })),
                    encuestasRecientes: recentSurveys.map(e => ({
                        proyecto: e.project?.nombre || 'Desconocido',
                        orden: e.ordenServicio?.codigoOS || 'Desconocido',
                        NPS: e.nps,
                        puntajePromedio: ((e.atencion + e.calidad + e.tiempo) / 3).toFixed(1),
                        comentario: e.comentario || ''
                    }))
                };

                orgContextStr = `
\n--- SNAPSHOT DE BASE DE DATOS EN TIEMPO REAL ---
${JSON.stringify(systemSnapshot, null, 2)}
------------------------------------------------`;
            } catch (e) {
                console.error("Error fetching org context for AI", e);
            }
        }

        const userRecordsContent = orgContextStr 
            ? `Privilegios elevados activos. Snapshot JSON de la DB adjunto para que evalúes y des respuestas directas:\n${orgContextStr}` 
            : "No hay registros organizacionales (Privilegios básicos).";

        // 4. Buscar artículos del Centro de Ayuda relevantes
        const articulos = await prisma.helpArticle.findMany({
            take: 15,
            select: { title: true, description: true, content: true }
        });

        const helpArticlesStr = articulos.map(a => `[${a.title}]: ${a.description}`).join('\n');

        // 5. Generación mediante la Capa Centralizada de IA
        const aiResponse = await generateObject<any>(
            'SYSTEM_ASSISTANT',
            { 
                consulta,
                userData: userDataStr,
                vistasPermitidas: vistasPermitidasStr,
                helpArticles: helpArticlesStr,
                userRecords: userRecordsContent
            },
            {
                userId,
                userName,
                userRole,
                temperature: 0.2
            }
        );

        if (!aiResponse.success || !aiResponse.data) {
            return NextResponse.json({ error: aiResponse.error || 'Error al procesar consulta del sistema.' }, { status: 500 });
        }

        const data = aiResponse.data;

        // 4. Registrar o actualizar la conversación en DB
        let finalConversationId = conversationId;
        const userMsg = `Consulta: ${consulta}`;
        const modelMsg = data.respuesta;

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
                    entity: 'SystemHelp',
                    title: `Ayuda: ${consulta.substring(0, 30)}...`,
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

        return NextResponse.json({
            success: true,
            respuesta: data.respuesta,
            articulosSugeridos: data.articulosSugeridos || [],
            conversationId: finalConversationId,
            usage: aiResponse.usage,
            latencyMs: aiResponse.latencyMs
        });

    } catch (error: any) {
        console.error('[Api][SystemAssistant] Failed:', error);
        return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
    }
}
