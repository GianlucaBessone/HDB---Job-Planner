import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const operatorId = searchParams.get('operatorId');
        
        const where: any = {};
        if (operatorId) {
            where.operatorId = operatorId;
        }

        const trainings = await prisma.technicianTraining.findMany({
            where,
            include: {
                operator: { select: { id: true, nombreCompleto: true } },
                document: { 
                    select: { 
                        id: true, 
                        titulo: true, 
                        tipoDocumento: true, 
                        nivelCriticidad: true, 
                        validezMeses: true, 
                        codigoDocumental: true,
                        descripcion: true,
                        versions: {
                            orderBy: { createdAt: 'desc' },
                            take: 1,
                            include: {
                                files: true
                            }
                        }
                    } 
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(trainings);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const data = await req.json();
        const { id, respuestas, tiempoInvertido } = data;

        if (!id) {
            return NextResponse.json({ error: 'Faltan campos requeridos para la evaluación.' }, { status: 400 });
        }

        const training = await prisma.technicianTraining.findUnique({
            where: { id },
            include: { document: true }
        });

        if (!training) {
            return NextResponse.json({ error: 'Capacitación no encontrada.' }, { status: 404 });
        }

        const finalRespuestas = respuestas || {};
        const quiz = training.cuestionario ? (Array.isArray(training.cuestionario) ? training.cuestionario : JSON.parse(training.cuestionario as string)) : [];
        let correctCount = 0;
        const totalQuestions = quiz.length;

        // Evaluar las respuestas
        quiz.forEach((q: any, index: number) => {
            const userAnswer = finalRespuestas[index];
            if (userAnswer !== undefined && Number(userAnswer) === Number(q.correctAnswerIndex)) {
                correctCount++;
            }
        });

        const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 100;
        const approved = score >= training.puntajeMinimo;
        const newEstado = approved ? 'aprobado' : 'reprobado';

        // Actualizar capacitación
        const updatedTraining = await prisma.technicianTraining.update({
            where: { id },
            data: {
                estado: newEstado,
                respuestas: finalRespuestas,
                puntaje: score,
                tiempoInvertido: tiempoInvertido ? Number(tiempoInvertido) : null,
                fechaFin: new Date(),
                observaciones: approved 
                    ? (totalQuestions > 0 
                        ? `Aprobado automáticamente con puntaje de ${Math.round(score)}%` 
                        : 'Capacitación marcada como leída y completada.')
                    : `Reprobado con puntaje de ${Math.round(score)}%. Requiere nuevo intento.`
            }
        });

        // Si aprobó, actualizar competencia técnica relacionada a vigente
        if (approved && training.documentId) {
            const existingComp = await prisma.technicianCompetency.findFirst({
                where: {
                    operatorId: training.operatorId,
                    documentId: training.documentId
                }
            });

            const docTitle = training.document?.titulo || 'Documento Controlado';
            
            // Calcular vencimiento basado en validezMeses (default: 12 meses)
            const months = training.document?.validezMeses || 12;
            const vencimientoDate = new Date();
            vencimientoDate.setMonth(vencimientoDate.getMonth() + months);

            if (existingComp) {
                await prisma.technicianCompetency.update({
                    where: { id: existingComp.id },
                    data: {
                        estado: 'vigente',
                        vencimiento: vencimientoDate,
                        evidencia: totalQuestions > 0
                            ? `Aprobación de examen teórico LMS en fecha ${new Date().toLocaleDateString()} con score de ${Math.round(score)}%`
                            : `Lectura y conformidad del documento realizada el ${new Date().toLocaleDateString()}`,
                        evaluacion: `Competencia acreditada por aprobación de capacitación obligatoria. Validez de ${months} meses.`,
                        aprobadorNombre: 'QMS Auto-Validation Engine'
                    }
                });
            } else {
                await prisma.technicianCompetency.create({
                    data: {
                        operatorId: training.operatorId,
                        nombre: docTitle,
                        documentId: training.documentId,
                        estado: 'vigente',
                        vencimiento: vencimientoDate,
                        evidencia: totalQuestions > 0
                            ? `Aprobación de examen teórico LMS en fecha ${new Date().toLocaleDateString()} con score de ${Math.round(score)}%`
                            : `Lectura y conformidad del documento realizada el ${new Date().toLocaleDateString()}`,
                        evaluacion: `Competencia acreditada por aprobación de capacitación obligatoria. Validez de ${months} meses.`,
                        aprobadorNombre: 'QMS Auto-Validation Engine'
                    }
                });
            }
        }

        return NextResponse.json({
            success: true,
            score,
            approved,
            training: updatedTraining
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
