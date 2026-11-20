import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';

export async function GET(req: Request) {
    try {
        const acceso = await exigirAcceso(req);
        if (acceso instanceof NextResponse) return acceso;

        const { searchParams } = new URL(req.url);
        // Sin "formacion.gestionar", solo la formación propia (se ignora ?operatorId).
        const operatorId = acceso.puede('formacion.gestionar') ? searchParams.get('operatorId') : acceso.userId;
        
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
        const acceso = await exigirAcceso(req, ['formacion.gestionar'], 'No tenés permiso para gestionar la formación del personal');
        if (acceso instanceof NextResponse) return acceso;

        const data = await req.json();
        const {
            id,
            operatorId,
            nombre,
            documentId,
            estado,
            vencimiento,
            evidencia,
            evaluacion
        } = data;
        // El aprobador es el usuario de la sesión (se ignoran aprobadorId / aprobadorNombre del cuerpo).
        const aprobadorId = acceso.userId;
        const aprobadorNombre = acceso.nombre;

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
