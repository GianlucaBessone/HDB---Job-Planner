import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type RouteParams = { params: { id: string } };

const include = {
    template: true,
    project: { select: { nombre: true, codigoProyecto: true } },
    client: { select: { nombre: true } },
    responsable: { select: { nombreCompleto: true } },
    personnel: { include: { operator: { select: { nombreCompleto: true } } } },
    evidences: true,
    signature: true
};

export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        const report = await prisma.technicalReport.findUnique({
            where: { id: params.id },
            include
        });

        if (!report) {
            return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 });
        }

        return NextResponse.json(report);
    } catch (e) {
        console.error('Error fetching technical report:', e);
        return NextResponse.json({ error: 'Error al obtener el informe' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
    try {
        const existing = await prisma.technicalReport.findUnique({ where: { id: params.id } });
        if (!existing) return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 });
        const body = await req.json();
        
        const isOnlySignatureUpdate = Object.keys(body).length === 1 && Object.keys(body)[0] === 'signatureId';
        if (existing.status === 'finalizado' && !isOnlySignatureUpdate) {
            return NextResponse.json({ error: 'No se puede editar un informe finalizado' }, { status: 400 });
        }

        const {
            projectId,
            ordenServicioId,
            clientId,
            planta,
            sector,
            equipo,
            activo,
            responsableId,
            empresaEjecutora,
            startTime,
            endTime,
            data,
            personnel,
            status,
            signatureId
        } = body;

        if (status === 'finalizado' && existing.status !== 'finalizado') {
            const hasSignature = signatureId || existing.signatureId;
            if (!hasSignature) {
                return NextResponse.json({ error: 'Debes firmar electrónicamente el documento antes de poder finalizarlo' }, { status: 400 });
            }
        }

        let updateData: any = {};
        if (projectId !== undefined) updateData.projectId = projectId === '' ? null : projectId;
        if (ordenServicioId !== undefined) updateData.ordenServicioId = ordenServicioId === '' ? null : ordenServicioId;
        if (clientId !== undefined) updateData.clientId = clientId === '' ? null : clientId;
        if (planta !== undefined) updateData.planta = planta;
        if (sector !== undefined) updateData.sector = sector;
        if (equipo !== undefined) updateData.equipo = equipo;
        if (activo !== undefined) updateData.activo = activo;
        if (responsableId !== undefined) updateData.responsableId = responsableId === '' ? null : responsableId;
        if (empresaEjecutora !== undefined) updateData.empresaEjecutora = empresaEjecutora;
        if (startTime !== undefined) updateData.startTime = startTime;
        if (endTime !== undefined) updateData.endTime = endTime;
        if (status !== undefined) updateData.status = status;
        if (signatureId !== undefined) updateData.signatureId = signatureId;
        if (data !== undefined) updateData.data = data;
        
        if (personnel) {
            updateData.personnel = {
                create: personnel.map((p: { operatorId?: string; name?: string; role?: string; hoursWorked?: string }) => ({
                    operatorId: p.operatorId || null,
                    name: p.name,
                    role: p.role,
                    hoursWorked: p.hoursWorked ? parseFloat(p.hoursWorked) : 0
                }))
            };
        }

        const updated = await prisma.$transaction(async (tx) => {
            if (personnel) {
                await tx.technicalReportPersonnel.deleteMany({ where: { reportId: params.id } });
            }

            return await tx.technicalReport.update({
                where: { id: params.id },
                data: updateData,
                include
            });
        });

        // Audit Log
        const reqHeaders = new Headers(req.headers);
        const userId = reqHeaders.get('x-user-id') || null;
        
        await prisma.auditLog.create({
            data: {
                userId: userId,
                userEmail: '', // Not available in x-user-id headers, maybe query user if needed
                userName: 'Sistema',
                action: 'UPDATE',
                entity: 'TECHNICAL_REPORT',
                entityId: updated.id,
                newValue: { status: updated.status }
            }
        });

        return NextResponse.json(updated);
    } catch (e: any) {
        console.error('Error updating technical report:', e);
        return NextResponse.json({ error: 'Error al actualizar el informe', details: e?.message || String(e), stack: e?.stack }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
    try {
        const existing = await prisma.technicalReport.findUnique({ where: { id: params.id } });
        if (!existing) return NextResponse.json({ error: 'Informe no encontrado' }, { status: 404 });

        let justificacion: string | null = null;
        let metadataToLog: any = undefined;

        if (existing.status === 'finalizado') {
            const body = await req.json().catch(() => null);
            if (!body) return NextResponse.json({ error: 'Se requiere justificación y firma para eliminar un informe finalizado' }, { status: 400 });
            
            const { signatureId, justificacion: just, dni } = body;
            if (!signatureId || !just || !dni) return NextResponse.json({ error: 'Faltan datos requeridos (firma, justificación, DNI)' }, { status: 400 });

            const reqHeaders = new Headers(req.headers);
            const userId = reqHeaders.get('x-user-id');
            const userRole = reqHeaders.get('x-user-role');
            if (!userId || !['admin', 'supervisor'].includes((userRole || '').trim().toLowerCase())) {
                return NextResponse.json({ error: `No tienes permisos de administrador/supervisor para realizar esta acción (Tu rol detectado: "${userRole || 'Ninguno'}")` }, { status: 403 });
            }

            const operator = await prisma.operator.findUnique({ where: { id: userId } });
            if (!operator || operator.dni !== dni) {
                return NextResponse.json({ error: 'El DNI ingresado no coincide con el registrado en tu usuario' }, { status: 400 });
            }

            const signature = await prisma.documentSignatureAudit.findUnique({ where: { SignatureID: signatureId } });
            if (!signature) {
                return NextResponse.json({ error: 'Firma digital inválida' }, { status: 400 });
            }

            justificacion = just;
            metadataToLog = { justificacion, adminDni: dni, signatureId };
        }

        await prisma.technicalReport.delete({ where: { id: params.id } });

        const reqHeadersFinal = new Headers(req.headers);
        const userIdFinal = reqHeadersFinal.get('x-user-id') || null;
        
        await prisma.auditLog.create({
            data: {
                userId: userIdFinal,
                userEmail: '',
                userName: 'Sistema',
                action: 'DELETE',
                entity: 'TECHNICAL_REPORT',
                entityId: params.id,
                oldValue: { reportNumber: existing.reportNumber },
                metadata: metadataToLog
            }
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('Error deleting technical report:', e);
        return NextResponse.json({ error: 'Error al eliminar el informe', details: e?.message || String(e) }, { status: 500 });
    }
}
