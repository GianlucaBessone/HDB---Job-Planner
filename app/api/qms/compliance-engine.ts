import { prisma } from '@/lib/prisma';
import { sendPushNotification } from '@/lib/onesignal';

/**
 * Motor de cumplimiento y calidad (QMS & Compliance Engine)
 */

export async function triggerAutomaticTraining(documentId: string) {
    try {
        const doc = await prisma.controlledDocument.findUnique({
            where: { id: documentId }
        });

        if (!doc || doc.estado !== 'vigente' || !doc.requiereCapacitacion) {
            return { count: 0, message: 'Documento no requiere capacitación o no está vigente.' };
        }

        // Obtener todos los operadores activos
        const operators = await prisma.operator.findMany({
            where: { activo: true }
        });

        const docTags = doc.tags ? (Array.isArray(doc.tags) ? doc.tags : JSON.parse(doc.tags as string)) : [];

        // Obtener la versión vigente específica
        const latestVersion = await prisma.documentVersion.findFirst({
            where: {
                documentId: doc.id,
                versionMayor: doc.versionMayor,
                versionMenor: doc.versionMenor
            }
        });
        const versionId = latestVersion?.id || null;

        let assignedCount = 0;
        const notifiedUserIds: string[] = [];

        for (const op of operators) {
            let matches = false;

            // Si es de criticidad alta o crítica, aplica a todos los técnicos obligatoriamente
            if (doc.nivelCriticidad === 'alta' || doc.nivelCriticidad === 'alto' || doc.nivelCriticidad === 'critica' || doc.nivelCriticidad === 'critico') {
                matches = true;
            } else {
                // De lo contrario, verificar coincidencia de etiquetas
                const opTagsArr = op.etiquetas ? (Array.isArray(op.etiquetas) ? op.etiquetas : JSON.parse(op.etiquetas as string)) : [];
                matches = docTags.some((tag: string) => opTagsArr.includes(tag));
            }

            if (matches) {
                // Verificar si ya existe una capacitación activa para esta versión específica
                const existing = await prisma.technicianTraining.findFirst({
                    where: {
                        operatorId: op.id,
                        documentId: doc.id,
                        versionId: versionId || undefined,
                        estado: { not: 'obsoleto' }
                    }
                });

                if (!existing) {
                    // Verificar si tenía una versión anterior aprobada
                    const approvedTraining = await prisma.technicianTraining.findFirst({
                        where: {
                            operatorId: op.id,
                            documentId: doc.id,
                            estado: 'aprobado'
                        }
                    });

                    // Cuestionario de ejemplo si no existe en la base de datos
                    const defaultQuiz = [
                        {
                            question: `¿Cuál es el objetivo principal del procedimiento documental de ${doc.titulo}?`,
                            options: [
                                "Cumplir formalmente sin implicancia operativa",
                                "Garantizar la seguridad y calidad en la ejecución del servicio",
                                "Reducir los tiempos de entrega sin importar la seguridad",
                                "Ninguna de las anteriores"
                            ],
                            correctAnswerIndex: 1
                        },
                        {
                            question: `De acuerdo a la criticidad '${doc.nivelCriticidad}', ¿qué nivel de control operativo se requiere?`,
                            options: [
                                "Ningún control, es meramente informativo",
                                "Control ordinario sin requerimientos adicionales",
                                "Control estricto con validación de competencias y evidencias",
                                "Control parcial por parte de terceros"
                            ],
                            correctAnswerIndex: 2
                        }
                    ];

                    let questionnaireToUse = defaultQuiz;
                    const workflow = doc.workflowState as any;
                    if (workflow && typeof workflow === 'object' && Array.isArray(workflow.cuestionario) && workflow.cuestionario.length > 0) {
                        questionnaireToUse = workflow.cuestionario;
                    }

                    // Crear capacitación obligatoria para esta versión específica (preservando el historial anterior)
                    await prisma.technicianTraining.create({
                        data: {
                            operatorId: op.id,
                            documentId: doc.id,
                            versionId: versionId,
                            titulo: `Capacitación Obligatoria (v${doc.versionMayor}.${doc.versionMenor}): ${doc.titulo}`,
                            estado: 'pendiente',
                            tipoContenido: 'pdf',
                            urlContenido: `/api/documentos/${doc.id}/download`,
                            cuestionario: questionnaireToUse as any,
                            puntajeMinimo: 70.0
                        }
                    });

                    // Generar notificación / tarea automática
                    await prisma.notification.create({
                        data: {
                            operatorId: op.id,
                            title: approvedTraining 
                                ? 'Nueva Versión: Re-capacitación Obligatoria' 
                                : 'Capacitación Obligatoria Asignada',
                            message: approvedTraining
                                ? `Se ha publicado una nueva versión (${doc.versionMayor}.${doc.versionMenor}) del documento "${doc.titulo}". Tu capacitación anterior ha quedado registrada en tu historial y debes completar esta nueva evaluación.`
                                : `Se ha publicado una nueva versión crítica del documento "${doc.titulo}". Debes completar la capacitación obligatoria para poder operar.`,
                            type: 'QMS_TRAINING',
                            relatedId: doc.id
                        }
                    });

                    // También crear o actualizar la competencia como pendiente
                    const existingComp = await prisma.technicianCompetency.findFirst({
                        where: {
                            operatorId: op.id,
                            nombre: doc.titulo
                        }
                    });

                    if (!existingComp) {
                        await prisma.technicianCompetency.create({
                            data: {
                                operatorId: op.id,
                                nombre: doc.titulo,
                                documentId: doc.id,
                                estado: 'pendiente'
                            }
                        });
                    } else {
                        // Vuelve a pendiente por cambio de versión documental
                        await prisma.technicianCompetency.update({
                            where: { id: existingComp.id },
                            data: { estado: 'pendiente', evidencia: null, evaluacion: null }
                        });
                    }

                    if (op.id) {
                        notifiedUserIds.push(op.id);
                    }
                    assignedCount++;
                }
            }
        }

        if (notifiedUserIds.length > 0) {
            await sendPushNotification({
                userIds: notifiedUserIds,
                title: "Nueva Capacitación Obligatoria",
                message: `Se ha publicado la versión aprobada de "${doc.titulo}". Entra al portal LMS para completar la capacitación requerida.`,
                data: { route: '/capacitacion' }
            }).catch(e => console.error("Error sending push notification to operators:", e));
        }

        return { count: assignedCount, message: `Capacitaciones asignadas exitosamente a ${assignedCount} técnicos.` };
    } catch (error) {
        console.error('Error al disparar capacitaciones automáticas:', error);
        throw error;
    }
}

/**
 * Synchronize training requirements for a single operator.
 * Triggered dynamically when a new operator is created or their tags are updated.
 */
export async function syncOperatorTrainings(operatorId: string) {
    try {
        const op = await prisma.operator.findUnique({
            where: { id: operatorId }
        });

        if (!op || !op.activo) {
            return { count: 0, message: 'Operador no encontrado o inactivo.' };
        }

        // Get all active and vigente controlled documents requiring training
        const documents = await prisma.controlledDocument.findMany({
            where: {
                estado: 'vigente',
                requiereCapacitacion: true
            }
        });

        let assignedCount = 0;
        const opTags = op.etiquetas ? (Array.isArray(op.etiquetas) ? op.etiquetas : JSON.parse(op.etiquetas as string)) : [];

        for (const doc of documents) {
            let matches = false;

            // High or critical documents apply to all operators
            if (doc.nivelCriticidad === 'alta' || doc.nivelCriticidad === 'critica') {
                matches = true;
            } else {
                const docTags = doc.tags ? (Array.isArray(doc.tags) ? doc.tags : JSON.parse(doc.tags as string)) : [];
                matches = docTags.some((tag: string) => opTags.includes(tag));
            }

            if (matches) {
                // Verify if training already exists (any state except obsoleto)
                const existing = await prisma.technicianTraining.findFirst({
                    where: {
                        operatorId: op.id,
                        documentId: doc.id,
                        estado: { not: 'obsoleto' }
                    }
                });

                if (!existing) {
                    const defaultQuiz = [
                        {
                            question: `¿Cuál es el objetivo principal del procedimiento documental de ${doc.titulo}?`,
                            options: [
                                "Cumplir formalmente sin implicancia operativa",
                                "Garantizar la seguridad y calidad en la ejecución del servicio",
                                "Reducir los tiempos de entrega sin importar la seguridad",
                                "Ninguna de las anteriores"
                            ],
                            correctAnswerIndex: 1
                        },
                        {
                            question: `De acuerdo a la criticidad '${doc.nivelCriticidad}', ¿qué nivel de control operativo se requiere?`,
                            options: [
                                "Ningún control, es meramente informativo",
                                "Control ordinario sin requerimientos adicionales",
                                "Control estricto con validación de competencias y evidencias",
                                "Control parcial por parte de terceros"
                            ],
                            correctAnswerIndex: 2
                        }
                    ];

                    let questionnaireToUse = defaultQuiz;
                    const workflow = doc.workflowState as any;
                    if (workflow && typeof workflow === 'object' && Array.isArray(workflow.cuestionario) && workflow.cuestionario.length > 0) {
                        questionnaireToUse = workflow.cuestionario;
                    }

                    await prisma.technicianTraining.create({
                        data: {
                            operatorId: op.id,
                            documentId: doc.id,
                            titulo: `Capacitación Obligatoria: ${doc.titulo}`,
                            estado: 'pendiente',
                            tipoContenido: 'pdf',
                            urlContenido: `/api/documentos/${doc.id}/download`,
                            cuestionario: questionnaireToUse as any,
                            puntajeMinimo: 70.0
                        }
                    });

                    // Generate automatic notification
                    await prisma.notification.create({
                        data: {
                            operatorId: op.id,
                            title: 'Capacitación Obligatoria Asignada',
                            message: `Se ha publicado una nueva versión crítica del documento "${doc.titulo}". Debes completar la capacitación obligatoria para poder operar.`,
                            type: 'QMS_TRAINING',
                            relatedId: doc.id
                        }
                    });

                    // Competency record
                    const existingComp = await prisma.technicianCompetency.findFirst({
                        where: {
                            operatorId: op.id,
                            nombre: doc.titulo
                        }
                    });

                    if (!existingComp) {
                        await prisma.technicianCompetency.create({
                            data: {
                                operatorId: op.id,
                                nombre: doc.titulo,
                                documentId: doc.id,
                                estado: 'pendiente'
                            }
                        });
                    } else if (existingComp.estado === 'vigente') {
                        await prisma.technicianCompetency.update({
                            where: { id: existingComp.id },
                            data: { estado: 'pendiente', evidencia: null, evaluacion: null }
                        });
                    }

                    assignedCount++;
                }
            }
        }

        if (assignedCount > 0 && op.id) {
            await sendPushNotification({
                userIds: [op.id],
                title: "Nuevas Capacitaciones Asignadas",
                message: `Se te han asignado ${assignedCount} capacitaciones obligatorias nuevas. Revisa tu portal LMS.`,
                data: { route: '/capacitacion' }
            }).catch(e => console.error("Error sending push notification to operator:", e));
        }

        return { count: assignedCount, message: `Capacitaciones sincronizadas: ${assignedCount} nuevas asignadas.` };
    } catch (error) {
        console.error('Error al sincronizar capacitaciones de operador:', error);
        throw error;
    }
}

export async function validateTechnicianEligibility(operatorId: string, documentIds: string[]) {
    try {
        const reasons: string[] = [];
        let score = 100;

        // Si no hay documentos requeridos, es apto
        if (!documentIds || documentIds.length === 0) {
            return { eligible: 'apto', reasons: [], score: 100 };
        }

        const documents = await prisma.controlledDocument.findMany({
            where: { id: { in: documentIds }, estado: 'vigente' }
        });

        for (const doc of documents) {
            // 1. Confirmación de Lectura obligatoria
            if (doc.requiereConfirmacionLectura) {
                const read = await prisma.documentReadConfirmation.findUnique({
                    where: {
                        documentId_operatorId: {
                            documentId: doc.id,
                            operatorId
                        }
                    }
                });

                if (!read) {
                    reasons.push(`Lectura pendiente de: "${doc.titulo}"`);
                    score -= 20;
                }
            }

            // 2. Capacitación obligatoria
            if (doc.requiereCapacitacion) {
                const training = await prisma.technicianTraining.findFirst({
                    where: {
                        operatorId,
                        documentId: doc.id,
                        estado: 'aprobado'
                    }
                });

                if (!training) {
                    reasons.push(`Capacitación obligatoria pendiente o desaprobada de: "${doc.titulo}"`);
                    score -= 30;
                }
            }

            // 3. Competencia técnica asociada
            const competency = await prisma.technicianCompetency.findFirst({
                where: {
                    operatorId,
                    documentId: doc.id,
                    estado: 'vigente'
                }
            });

            if (!competency && doc.nivelCriticidad === 'critica') {
                reasons.push(`Falta Certificación / Competencia Vigente para: "${doc.titulo}"`);
                score -= 40;
            }
        }

        // Score boundings
        score = Math.max(0, score);
        let eligible = 'apto';
        if (score < 50) {
            eligible = 'no_apto';
        } else if (score < 100) {
            eligible = 'parcial';
        }

        return { eligible, reasons, score };
    } catch (error) {
        console.error('Error al validar elegibilidad de técnico:', error);
        return { eligible: 'no_apto', reasons: ['Error al validar cumplimiento de normas'], score: 0 };
    }
}

export async function calculateComplianceScore(operatorId: string) {
    try {
        // Lecturas requeridas vs confirmadas
        const reqDocs = await prisma.controlledDocument.findMany({
            where: { requiereConfirmacionLectura: true, estado: 'vigente' }
        });
        
        const readConfirms = await prisma.documentReadConfirmation.findMany({
            where: { operatorId }
        });

        const readScore = reqDocs.length > 0 
            ? (readConfirms.length / reqDocs.length) * 100
            : 100;

        // Capacitaciones asignadas vs aprobadas (excluyendo obsoletas que no fueron aprobadas)
        const assignedTrainings = await prisma.technicianTraining.findMany({
            where: { operatorId },
            include: { document: true }
        });

        const activeTrainings = assignedTrainings.filter(t => {
            if (t.estado === 'obsoleto') return false;
            if (t.document?.estado === 'obsoleto' && t.estado !== 'aprobado') return false;
            return true;
        });

        const approvedTrainings = activeTrainings.filter(t => t.estado === 'aprobado');
        const trainingScore = activeTrainings.length > 0
            ? (approvedTrainings.length / activeTrainings.length) * 100
            : 100;

        // Competencias vigentes vs total competencias registradas
        const registeredComps = await prisma.technicianCompetency.findMany({
            where: { operatorId }
        });

        const activeComps = registeredComps.filter(c => c.estado === 'vigente');
        const competencyScore = registeredComps.length > 0
            ? (activeComps.length / registeredComps.length) * 100
            : 100;

        // Compliance Score global ponderado
        // 30% lectura, 40% capacitaciones, 30% competencias
        const totalScore = (readScore * 0.3) + (trainingScore * 0.4) + (competencyScore * 0.3);
        
        return {
            readScore: Math.round(readScore),
            trainingScore: Math.round(trainingScore),
            competencyScore: Math.round(competencyScore),
            globalScore: Math.round(totalScore)
        };
    } catch (error) {
        console.error('Error al calcular score de cumplimiento:', error);
        return { readScore: 0, trainingScore: 0, competencyScore: 0, globalScore: 0 };
    }
}

export async function calculateQualityScore(filters: { 
    technicianId?: string, 
    clientId?: string, 
    branchId?: string,
    serviceType?: string 
}) {
    try {
        // En un sistema real, esto calcula base a rechazos de OS, errores en checklists, etc.
        // Simularemos una fórmula lógica sumando variables del QMS real
        let score = 95; // Base de calidad excelente

        if (filters.technicianId) {
            const compliance = await calculateComplianceScore(filters.technicianId);
            score = Math.round((score * 0.4) + (compliance.globalScore * 0.6));
        }

        return { score: Math.max(0, Math.min(100, score)) };
    } catch (error) {
        return { score: 0 };
    }
}
