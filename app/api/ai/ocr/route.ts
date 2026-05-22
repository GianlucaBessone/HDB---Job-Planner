import { NextResponse } from 'next/server';
import { analyzeDocumentOcr } from '@/lib/ai/gemini';
import { OcrAnalysisOutput } from '@/lib/ai/types';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { base64Data, mimeType, documentId, userId, userName, userRole } = body;

        // 1. Validaciones básicas
        if (!base64Data || !mimeType) {
            return NextResponse.json({ error: 'Faltan parámetros obligatorios: base64Data y mimeType.' }, { status: 400 });
        }

        // 2. Seguridad: Validar tipo MIME
        const allowedMimeTypes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp'
        ];
        if (!allowedMimeTypes.includes(mimeType)) {
            return NextResponse.json({ 
                error: 'Tipo de archivo no permitido. Solo se admiten PDFs e imágenes (JPEG, PNG, WEBP).' 
            }, { status: 400 });
        }

        // 3. Seguridad: Limitar tamaño de archivo (10 MB máx.)
        // La longitud de un string base64 es aprox 4/3 del tamaño original
        const approxSize = (base64Data.length * 3) / 4;
        if (approxSize > 10 * 1024 * 1024) {
            return NextResponse.json({ 
                error: 'El archivo excede el tamaño máximo permitido de 10 MB.' 
            }, { status: 413 });
        }

        // 4. Invocar el Servicio Centralizado de OCR
        const aiResponse = await analyzeDocumentOcr(
            base64Data,
            mimeType,
            {
                userId,
                userName,
                userRole,
                entity: documentId ? 'ControlledDocument' : undefined,
                entityId: documentId,
                temperature: 0.1
            }
        );

        if (!aiResponse.success || !aiResponse.data) {
            return NextResponse.json({ error: aiResponse.error || 'Error al procesar el documento con OCR.' }, { status: 500 });
        }

        const extractedData: OcrAnalysisOutput = aiResponse.data;

        // 5. Guardar la información estructurada en DB si está asociada a un ControlledDocument existente
        if (documentId && extractedData) {
            // Actualizar la metadata del documento controlado con la información extraída
            await prisma.controlledDocument.update({
                where: { id: documentId },
                data: {
                    observaciones: `Datos extraídos mediante OCR:\n` +
                                   `- Nro Doc: ${extractedData.numeroDocumento || 'N/A'}\n` +
                                   `- Cliente: ${extractedData.clienteNombre || 'N/A'}\n` +
                                   `- Obs: ${extractedData.observacionesGenerales || 'Ninguna'}\n\n` +
                                   `Comentarios previos:`,
                    tags: {
                        push: extractedData.equiposMencionados
                    }
                }
            });
        }

        return NextResponse.json({
            success: true,
            extractedData,
            usage: aiResponse.usage,
            latencyMs: aiResponse.latencyMs
        });

    } catch (error: any) {
        console.error('[Api][OCR] Failed:', error);
        return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
    }
}
