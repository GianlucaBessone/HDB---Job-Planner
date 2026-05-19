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

        const competencies = await prisma.technicianCompetency.findMany({
            where,
            include: {
                operator: { select: { id: true, nombreCompleto: true } },
                document: { select: { id: true, titulo: true, tipoDocumento: true, nivelCriticidad: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(competencies);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const data = await req.json();
        const {
            id,
            operatorId,
            nombre,
            documentId,
            estado,
            vencimiento,
            evidencia,
            evaluacion,
            aprobadorId,
            aprobadorNombre
        } = data;

        if (!operatorId || !nombre) {
            return NextResponse.json({ error: 'Operador y nombre son campos obligatorios.' }, { status: 400 });
        }

        let competency;

        if (id) {
            // Actualizar competencia existente
            competency = await prisma.technicianCompetency.update({
                where: { id },
                data: {
                    estado: estado || 'pendiente',
                    vencimiento: vencimiento ? new Date(vencimiento) : null,
                    evidencia,
                    evaluacion,
                    aprobadorId,
                    aprobadorNombre,
                    documentId: documentId || null
                }
            });
        } else {
            // Crear nueva competencia
            competency = await prisma.technicianCompetency.create({
                data: {
                    operatorId,
                    nombre,
                    documentId: documentId || null,
                    estado: estado || 'pendiente',
                    vencimiento: vencimiento ? new Date(vencimiento) : null,
                    evidencia,
                    evaluacion,
                    aprobadorId,
                    aprobadorNombre
                }
            });
        }

        return NextResponse.json(competency);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
