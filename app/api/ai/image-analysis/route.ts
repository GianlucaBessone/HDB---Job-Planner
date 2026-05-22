import { NextResponse } from 'next/server';
import { analyzeImageContent } from '@/lib/ai/gemini';
import { ImageAnomalyOutput } from '@/lib/ai/types';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { 
            base64Image, 
            mimeType, 
            tipoInstalacion, 
            contexto, 
            userId, 
            userName, 
            userRole,
            evidenceId 
        } = body;

        // 1. Validaciones básicas
        if (!base64Image || !mimeType || !tipoInstalacion) {
            return NextResponse.json({ 
                error: 'Faltan parámetros obligatorios: base64Image, mimeType y tipoInstalacion.' 
            }, { status: 400 });
        }

        // 2. Seguridad: Validar tipo MIME (solo imágenes)
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMimeTypes.includes(mimeType)) {
            return NextResponse.json({ 
                error: 'Tipo de archivo no permitido. Solo se admiten imágenes (JPEG, PNG, WEBP).' 
            }, { status: 400 });
        }

        // 3. Seguridad: Limitar tamaño de archivo (5 MB máx. para imágenes de análisis visual)
        const approxSize = (base64Image.length * 3) / 4;
        if (approxSize > 5 * 1024 * 1024) {
            return NextResponse.json({ 
                error: 'La imagen excede el tamaño máximo permitido de 5 MB.' 
            }, { status: 413 });
        }

        // 4. Invocar el Servicio Centralizado de Análisis Multimodal
        const aiResponse = await analyzeImageContent(
            base64Image,
            mimeType,
            tipoInstalacion,
            contexto || 'Inspección de rutina',
            {
                userId,
                userName,
                userRole,
                entity: evidenceId ? 'OSChecklistEvidence' : undefined,
                entityId: evidenceId,
                temperature: 0.1
            }
        );

        if (!aiResponse.success || !aiResponse.data) {
            return NextResponse.json({ error: aiResponse.error || 'Error al analizar la imagen.' }, { status: 500 });
        }

        const analysis: ImageAnomalyOutput = aiResponse.data;

        // 5. Si hay evidenceId, registrar los hallazgos en la evidencia del checklist de la OS en DB
        if (evidenceId && analysis) {
            const auditNotes = `
[Análisis IA - Estado: ${analysis.estadoGeneral.toUpperCase()}]
Anomalías: ${analysis.anomaliasDetectadas.map(a => `${a.anomalia} (${a.gravedad})`).join(', ') || 'Ninguna'}
Obs: ${analysis.observacionesSugeridas.join(' ')}
            `.trim();

            await prisma.oSChecklistEvidence.update({
                where: { id: evidenceId },
                data: {
                    observacion: auditNotes
                }
            });
        }

        return NextResponse.json({
            success: true,
            analysis,
            usage: aiResponse.usage,
            latencyMs: aiResponse.latencyMs
        });

    } catch (error: any) {
        console.error('[Api][ImageAnalysis] Failed:', error);
        return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
    }
}
