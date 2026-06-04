import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { performOCR } from '@/lib/ai';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const operatorId = searchParams.get('operatorId');

        const where: any = {};
        if (operatorId) {
            where.operatorId = operatorId;
        }

        const certificates = await prisma.externalCertificate.findMany({
            where,
            include: {
                operator: { select: { id: true, nombreCompleto: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(certificates);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Certificate response schema (previously hardcoded in gemini.ts analyzeCertificateOcr)
const CERTIFICATE_RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        nombreCurso: {
            type: 'STRING',
            description: 'Nombre oficial del curso, taller o certificación encontrada'
        },
        institucion: {
            type: 'STRING',
            description: 'Entidad, universidad o empresa emisora del certificado'
        },
        horas: {
            type: 'INTEGER',
            description: 'Número de horas o duración total del curso (null si no figura)',
            nullable: true
        },
        fechaEmision: {
            type: 'STRING',
            description: 'Fecha de emisión en formato YYYY-MM-DD (null si no figura)',
            nullable: true
        },
        descripcion: {
            type: 'STRING',
            description: 'Breve resumen del contenido y de qué se trata la capacitación'
        },
        habilidadesRelevantes: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Extraer habilidades clave si aplican: HyS, Técnico en Dispensers, Técnico en Refrigeración, Técnico en CCTV/Alarmas, Electricista, Instrumentista Industrial, Especialista en Automatización (Neumática), Especialista en Automatización (PLC)'
        },
        otrasHabilidades: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Otras habilidades o blandas: Lectura de Planos Eléctricos, Lectura de Planos Civiles, Soft Skills (Habilidades Blandas), Herramientas de Informática, Team Leader'
        },
        justificacionMapeo: {
            type: 'STRING',
            description: 'Breve explicación de por qué se asignaron esas habilidades'
        },
        confianzaAnalisis: {
            type: 'STRING',
            enum: ['ALTA', 'MEDIA', 'BAJA'],
            description: 'Nivel de confianza en el análisis'
        }
    },
    required: [
        'nombreCurso',
        'institucion',
        'descripcion',
        'habilidadesRelevantes',
        'otrasHabilidades',
        'justificacionMapeo',
        'confianzaAnalisis'
    ]
};

export async function POST(req: Request) {
    try {
        const data = await req.json();
        const {
            operatorId,
            nombreCurso,
            institucion,
            descripcion,
            archivoUrl, // Base64 content
            fileType,
            runAiAnalysis
        } = data;

        if (!operatorId) {
            return NextResponse.json({ error: 'El ID de operador es obligatorio.' }, { status: 400 });
        }

        // Initialize variables that can be extracted by AI
        let extractedNombreCurso = nombreCurso || '';
        let extractedInstitucion = institucion || '';
        let extractedDescripcion = descripcion || '';
        let extractedHoras = null;
        let extractedFechaEmision = null;
        let aiData = null;

        if (runAiAnalysis && archivoUrl && fileType) {
            // Build manual data suffix for the prompt (same logic as old analyzeCertificateOcr)
            let promptSuffix = '';
            if (nombreCurso || institucion || descripcion) {
                promptSuffix = `\n\nEl operador ha proporcionado esta información de forma manual para ayudar (puede complementar o corregir lo que se ve en la imagen):\nNombre del Curso: ${nombreCurso || 'N/A'}\nInstitución: ${institucion || 'N/A'}\nDescripción/Temario: ${descripcion || 'N/A'}\n\nUsa estos datos como contexto principal si la imagen es ilegible o le falta información. Extrae las habilidades en base a la combinación de la imagen y esta información provista.`;
            }

            const aiRes = await performOCR(
                archivoUrl,
                fileType,
                'CERTIFICATE_ANALYSIS',
                {
                    userId: operatorId,
                    entity: 'ExternalCertificate'
                },
                {
                    responseSchema: CERTIFICATE_RESPONSE_SCHEMA,
                    promptSuffix: promptSuffix || undefined
                }
            );

            if (aiRes.success && aiRes.data) {
                aiData = aiRes.data;
                if (aiRes.data.nombreCurso) extractedNombreCurso = aiRes.data.nombreCurso;
                if (aiRes.data.institucion) extractedInstitucion = aiRes.data.institucion;
                if (aiRes.data.descripcion) extractedDescripcion = aiRes.data.descripcion;
                if (typeof aiRes.data.horas === 'number') extractedHoras = aiRes.data.horas;
                else if (typeof aiRes.data.horas === 'string') {
                    const parsed = parseFloat(aiRes.data.horas);
                    if (!isNaN(parsed)) extractedHoras = parsed;
                }
                if (aiRes.data.fechaEmision) extractedFechaEmision = aiRes.data.fechaEmision;
            }
        }

        // If not extracted or empty, fall back to manual values or default
        if (!extractedNombreCurso) {
            extractedNombreCurso = nombreCurso || 'Certificado Técnico';
        }
        if (!extractedInstitucion) {
            extractedInstitucion = institucion || 'Institución Externa';
        }
        if (!extractedDescripcion) {
            extractedDescripcion = descripcion || '';
        }

        const certificate = await prisma.externalCertificate.create({
            data: {
                operatorId,
                nombreCurso: extractedNombreCurso,
                institucion: extractedInstitucion,
                descripcion: extractedDescripcion,
                horas: extractedHoras ? Number(extractedHoras) : null,
                fechaEmision: extractedFechaEmision,
                archivoUrl: archivoUrl || null,
                aiData: aiData as any,
                estado: 'pendiente' // default to pendiente
            }
        });

        // Try sending notification to supervisors / admins
        try {
            const { sendPushNotification } = await import('@/lib/onesignal');
            // Fetch supervisors/admins
            const supervisors = await prisma.operator.findMany({
                where: {
                    role: { in: ['supervisor', 'admin', 'qa'] }
                },
                select: { id: true }
            });
            const operator = await prisma.operator.findUnique({
                where: { id: operatorId },
                select: { nombreCompleto: true }
            });

            if (supervisors.length > 0 && operator) {
                const userIds = supervisors.map(s => s.id);
                await sendPushNotification({
                    userIds,
                    title: "Nuevo Certificado Cargado",
                    message: `${operator.nombreCompleto} ha subido un certificado: "${extractedNombreCurso}".`,
                    data: { route: `/calidad` }
                });
            }
        } catch (e) {
            console.error('Error sending push notification for certificate:', e);
        }

        return NextResponse.json({ success: true, certificate });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Add updates (e.g. approve/reject certificates by supervisors)
export async function PUT(req: Request) {
    try {
        const data = await req.json();
        const { id, estado, horas, fechaEmision, nombreCurso, institucion, descripcion, aiData, userId, userName } = data;

        if (!id || !estado) {
            return NextResponse.json({ error: 'El ID de certificado y el estado son obligatorios.' }, { status: 400 });
        }

        const certificate = await prisma.externalCertificate.findUnique({
            where: { id }
        });

        if (!certificate) {
            return NextResponse.json({ error: 'Certificado no encontrado.' }, { status: 404 });
        }

        const updated = await prisma.externalCertificate.update({
            where: { id },
            data: {
                estado,
                horas: horas !== undefined ? (horas !== null ? Number(horas) : null) : certificate.horas,
                fechaEmision: fechaEmision !== undefined ? fechaEmision : certificate.fechaEmision,
                nombreCurso: nombreCurso !== undefined ? nombreCurso : certificate.nombreCurso,
                institucion: institucion !== undefined ? institucion : certificate.institucion,
                descripcion: descripcion !== undefined ? descripcion : certificate.descripcion,
                aiData: aiData !== undefined ? aiData : certificate.aiData
            }
        });

        // Create pending competency if certificate is approved and has aiData
        if (estado === 'aprobado') {
            const aiJson = (updated.aiData || {}) as any;
            const relevant = Array.isArray(aiJson.habilidadesRelevantes) ? aiJson.habilidadesRelevantes : [];
            const others = Array.isArray(aiJson.otrasHabilidades) ? aiJson.otrasHabilidades : [];
            const allSkills = [...relevant, ...others];
            
            for (const skillName of allSkills) {
                // Only create if skill is not already active and is a valid predefined skill (not 'Ninguna / Revisión Manual')
                if (skillName && skillName !== 'Ninguna / Revisión Manual') {
                    const existingComp = await prisma.technicianCompetency.findFirst({
                        where: {
                            operatorId: updated.operatorId,
                            nombre: skillName
                        }
                    });

                    if (!existingComp) {
                        await prisma.technicianCompetency.create({
                            data: {
                                operatorId: updated.operatorId,
                                nombre: skillName,
                                estado: 'pendiente', // Pendiente para validación manual del supervisor
                                evidencia: `Certificado: ${updated.nombreCurso}`
                            }
                        });
                    }
                }
            }
        }

        // Auditing
        await logAudit({
            userId,
            userName,
            action: 'UPDATE',
            entity: 'EXTERNAL_CERTIFICATE',
            entityId: id,
            newValue: updated
        });

        // Notify technician about approval status
        try {
            const { sendPushNotification } = await import('@/lib/onesignal');
            const stateMsg = estado === 'aprobado' ? 'aprobado' : 'rechazado';
            await sendPushNotification({
                userIds: [certificate.operatorId],
                title: `Certificado ${stateMsg.toUpperCase()}`,
                message: `Tu certificado "${updated.nombreCurso}" ha sido ${stateMsg}.`,
                data: { route: `/capacitacion` }
            });
        } catch (e) {
            console.error('Error sending push notification to operator:', e);
        }

        return NextResponse.json({ success: true, certificate: updated });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        
        if (!id) {
            return NextResponse.json({ error: 'El ID de certificado es obligatorio.' }, { status: 400 });
        }

        const certificate = await prisma.externalCertificate.findUnique({
            where: { id }
        });

        if (!certificate) {
            return NextResponse.json({ error: 'Certificado no encontrado.' }, { status: 404 });
        }

        // Also clean up any pending/active competency that was created from this certificate
        await prisma.technicianCompetency.deleteMany({
            where: {
                operatorId: certificate.operatorId,
                evidencia: {
                    startsWith: `Certificado: ${certificate.nombreCurso}`
                }
            }
        });

        await prisma.externalCertificate.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
