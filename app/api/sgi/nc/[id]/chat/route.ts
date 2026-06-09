import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateObject } from '@/lib/ai/service';
import { getEmbedding, cosineSimilarity } from '@/lib/ai/embeddings';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const body = await req.json();
        const { messages, methodology, currentAnalysisState } = body;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Mensajes inválidos o faltantes' }, { status: 400 });
        }

        // 1. Fetch current NC details
        const nc = await prisma.noConformidad.findUnique({
            where: { id: params.id },
            include: {
                analisisCausaRaiz: true
            }
        });

        if (!nc) {
            return NextResponse.json({ error: 'No Conformidad no encontrada' }, { status: 404 });
        }

        // 2. Fetch organizational SGI documents
        const documents = await prisma.controlledDocument.findMany({
            where: { estado: 'vigente' },
            select: {
                codigoDocumental: true,
                titulo: true,
                descripcion: true,
                tipoDocumento: true,
                area: true
            },
            take: 10
        });

        // 3. Find similar historical NCs
        // Build text to embed for current NC
        const targetText = `Código: ${nc.codigoNC || ''}
Categoría: ${nc.categoria || ''}
Área: ${nc.areaAfectada || ''}
Proceso: ${nc.procesoAfectado || ''}
Descripción: ${nc.descripcion || ''}
Causa Raíz: ${nc.analisisCausaRaiz?.map(acr => acr.causaRaiz || acr.descripcion).join('; ') || ''}`;

        let targetEmbedding: number[] | null = null;
        try {
            if (nc.embedding && Array.isArray(nc.embedding)) {
                targetEmbedding = nc.embedding as number[];
            } else {
                targetEmbedding = await getEmbedding(targetText);
                await prisma.noConformidad.update({
                    where: { id: params.id },
                    data: { embedding: targetEmbedding }
                });
            }
        } catch (e) {
            console.error("Failed to generate or retrieve target embedding in chat API:", e);
        }

        let similarNcsFormatted = "No se encontraron antecedentes similares cerrados.";
        if (targetEmbedding) {
            const otherNcs = await prisma.noConformidad.findMany({
                where: {
                    id: { not: params.id },
                    estado: 'Cerrada'
                },
                include: {
                    analisisCausaRaiz: true,
                    accionesMejora: true,
                    verificacionesEficacia: true
                }
            });

            const matches = [];
            for (const other of otherNcs) {
                let otherEmbedding: number[];
                if (other.embedding && Array.isArray(other.embedding)) {
                    otherEmbedding = other.embedding as number[];
                } else {
                    const text = `Código: ${other.codigoNC || ''}
Categoría: ${other.categoria || ''}
Área: ${other.areaAfectada || ''}
Proceso: ${other.procesoAfectado || ''}
Descripción: ${other.descripcion || ''}
Causa Raíz: ${other.analisisCausaRaiz?.map(acr => acr.causaRaiz || acr.descripcion).join('; ') || ''}`;
                    try {
                        otherEmbedding = await getEmbedding(text);
                        await prisma.noConformidad.update({
                            where: { id: other.id },
                            data: { embedding: otherEmbedding }
                        });
                    } catch (e) {
                        continue;
                    }
                }
                const score = cosineSimilarity(targetEmbedding, otherEmbedding);
                matches.push({ nc: other, score });
            }

            matches.sort((a, b) => b.score - a.score);
            const topMatches = matches.filter(m => m.score > 0.45).slice(0, 3);

            if (topMatches.length > 0) {
                similarNcsFormatted = topMatches.map(m => {
                    const acr = m.nc.analisisCausaRaiz?.[0];
                    const actions = m.nc.accionesMejora.map(a => `${a.codigoAccion || 'Acción'}: ${a.descripcion} (${a.estado})`).join(', ');
                    const verified = m.nc.verificacionesEficacia?.[0]?.eficaz ?? 'No validado';
                    return `- [NC: ${m.nc.codigoNC || 'Sin código'}] ${m.nc.descripcion}
  * Causa Raíz: ${acr?.causaRaiz || acr?.descripcion || 'No detallada'}
  * Acciones: ${actions || 'Ninguna'}
  * Eficacia: ${verified === true ? 'EFICAZ' : verified === false ? 'INEFICAZ' : 'No verificada aún'}`;
                }).join('\n\n');
            }
        }

        // 4. Format variables for prompt
        const ncDetails = `Código: ${nc.codigoNC || 'Borrador'}
Detección: ${new Date(nc.fechaDeteccion).toLocaleDateString()}
Origen: ${nc.origen}
Categoría: ${nc.categoria}
Criticidad: ${nc.criticidad}
Área Afectada: ${nc.areaAfectada || 'No especificada'}
Proceso Afectado: ${nc.procesoAfectado || 'No especificado'}
Descripción: ${nc.descripcion}`;

        const orgContext = documents.map(d => `[${d.codigoDocumental || 'DOC'}] ${d.titulo} (${d.tipoDocumento}): ${d.descripcion || ''}`).join('\n');

        const workspaceState = typeof currentAnalysisState === 'object' 
            ? JSON.stringify(currentAnalysisState, null, 2)
            : String(currentAnalysisState || 'Vacío');

        // Chat History formatting (keep only last 10 messages for token context)
        const recentMessages = messages.slice(-10);
        const chatHistoryFormatted = recentMessages.map((m: any) => {
            const role = m.role === 'user' || m.role === 'Usuario' ? 'Usuario' : 'Asistente';
            return `${role}: ${m.content}`;
        }).join('\n');

        // 5. Invoke AI Service
        const aiResponse = await generateObject('RCA_CHAT', {
            ncDetails,
            methodology: methodology || 'No seleccionada',
            currentAnalysisState: workspaceState,
            orgContext,
            historyContext: similarNcsFormatted,
            chatHistory: chatHistoryFormatted
        });

        if (!aiResponse.success || !aiResponse.data) {
            return NextResponse.json({ error: aiResponse.error || 'Error al invocar el asistente de IA.' }, { status: 500 });
        }

        return NextResponse.json(aiResponse.data);

    } catch (error) {
        console.error('Error in RCA Chat API:', error);
        return NextResponse.json({ error: 'Error del servidor en el chat de análisis' }, { status: 500 });
    }
}
