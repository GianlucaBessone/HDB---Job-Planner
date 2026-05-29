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

        // 1. Buscar el documento en DB para obtener su contenido real con sus archivos asociados
        const doc = await prisma.controlledDocument.findUnique({
            where: { id: documentId },
            include: {
                versions: {
                    orderBy: [{ versionMayor: 'desc' }, { versionMenor: 'desc' }],
                    take: 1,
                    include: {
                        files: true
                    }
                }
            }
        });

        if (!doc) {
            return NextResponse.json({ error: 'Documento controlado no encontrado.' }, { status: 404 });
        }

        const latestVersion = doc.versions[0];
        const backupFiles = latestVersion?.files || [];

        // Parse general info (SOP sections) and video URL
        let digitalContentText = '';
        let videoContentText = '';
        if (doc.descripcion && doc.descripcion.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(doc.descripcion);
                digitalContentText = `
--- INFORMACIÓN GENERAL DEL PROCEDIMIENTO ---
Objetivo: ${parsed.objetivo || 'No especificado'}
Alcance: ${parsed.alcance || 'No especificado'}
Desarrollo de la Actividad: ${parsed.desarrollo || 'No especificado'}
Responsabilidades: ${parsed.responsabilidades || 'No especificado'}
`;
                if (parsed.videoUrl) {
                    videoContentText = `\n--- VIDEO DE CAPACITACIÓN INSERTADO ---
URL del Video: ${parsed.videoUrl}
Hay un video insertado en este procedimiento. Generar preguntas relacionadas con el aprendizaje esperado que el operario obtendrá al visualizar este video de capacitación.`;
                }
            } catch (e) {
                digitalContentText = `Descripción del documento: ${doc.descripcion}`;
            }
        } else {
            digitalContentText = `Descripción del documento: ${doc.descripcion || 'Sin descripción'}`;
        }

        // Parse backup documents / attachments
        let backupDocsText = '';
        if (backupFiles.length > 0) {
            backupDocsText = `\n--- DOCUMENTOS DE RESPALDO / ARCHIVOS ADJUNTOS ---
Se adjuntaron los siguientes archivos para respaldar la capacitación:
${backupFiles.map((f: any) => `- Archivo: ${f.nombreArchivo} (Tipo: ${f.tipoArchivo}, Tamaño: ${Math.round(f.tamanioBytes / 1024)} KB)`).join('\n')}
Generar preguntas específicas de evaluación sobre la información, especificaciones técnicas y manuales detallados en estos archivos de respaldo.`;
        }

        const documentContent = `
Código de Documento: ${doc.codigoDocumental}
Título: ${doc.titulo}
Tipo de Documento: ${doc.tipoDocumento}
Área: ${doc.area}
Notas de versión: ${latestVersion?.notas || 'Sin notas de versión.'}

${digitalContentText}
${videoContentText}
${backupDocsText}
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
