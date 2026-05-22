import { NextResponse } from 'next/server';
import { generateContent } from '@/lib/ai/gemini';
import { TrainingQuizOutput } from '@/lib/ai/types';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { documentId, cantidadPreguntas, nivelDificultad, userId, userName, userRole, saveAsTraining, operatorId } = body;

        if (!documentId) {
            return NextResponse.json({ error: 'Falta parámetro obligatorio: documentId.' }, { status: 400 });
        }

        // 1. Buscar el documento en DB para obtener su contenido real
        const doc = await prisma.controlledDocument.findUnique({
            where: { id: documentId },
            include: {
                versions: {
                    orderBy: [{ versionMayor: 'desc' }, { versionMenor: 'desc' }],
                    take: 1
                }
            }
        });

        if (!doc) {
            return NextResponse.json({ error: 'Documento controlado no encontrado.' }, { status: 404 });
        }

        const latestVersion = doc.versions[0];
        // Usamos el campo de notas, descripción o desarrollo para alimentar la IA
        const documentContent = `
Código: ${doc.codigoDocumental}
Título: ${doc.titulo}
Tipo: ${doc.tipoDocumento}
Área: ${doc.area}
Descripción: ${doc.descripcion || 'Sin descripción'}
Contenido Adicional/Notas de Versión: ${latestVersion?.notas || 'Sin contenido detallado en versión.'}
        `.trim();

        // 2. Invocar la Capa Centralizada de IA
        const aiResponse = await generateContent<TrainingQuizOutput>(
            'TRAINING_GEN',
            { 
                documentId: doc.codigoDocumental,
                documentContent,
                cantidadPreguntas: cantidadPreguntas || 5,
                nivelDificultad: nivelDificultad || 'intermedio'
            },
            {
                userId,
                userName,
                userRole,
                entity: 'ControlledDocument',
                entityId: documentId,
                temperature: 0.3
            }
        );

        if (!aiResponse.success || !aiResponse.data) {
            return NextResponse.json({ error: aiResponse.error || 'Error al generar material de capacitación.' }, { status: 500 });
        }

        const trainingContent = aiResponse.data;

        // 3. Registrar capacitación en DB si saveAsTraining y operatorId están presentes
        let savedTraining = null;
        if (saveAsTraining && operatorId) {
            savedTraining = await prisma.technicianTraining.create({
                data: {
                    operatorId,
                    documentId,
                    versionId: latestVersion?.id || null,
                    titulo: `Capacitación IA: ${doc.titulo}`,
                    estado: 'pendiente',
                    tipoContenido: 'cuestionario',
                    urlContenido: `/calidad/documentos/${documentId}`,
                    cuestionario: trainingContent.cuestionario as any,
                    observaciones: `Capacitación autogenerada para el procedimiento ${doc.codigoDocumental}.`
                }
            });
        }

        return NextResponse.json({
            success: true,
            training: trainingContent,
            trainingDb: savedTraining,
            usage: aiResponse.usage,
            latencyMs: aiResponse.latencyMs
        });

    } catch (error: any) {
        console.error('[Api][Training] Failed:', error);
        return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
    }
}
