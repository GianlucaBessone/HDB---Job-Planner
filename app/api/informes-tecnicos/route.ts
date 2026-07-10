import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const clientId = searchParams.get('clientId');
    const templateId = searchParams.get('templateId');
    const status = searchParams.get('status');

    try {
        const where: any = {};
        if (projectId) where.projectId = projectId;
        if (clientId) where.clientId = clientId;
        if (templateId) where.templateId = templateId;
        if (status) where.status = status;

        const reports = await prisma.technicalReport.findMany({
            where,
            include: {
                template: { select: { name: true } },
                project: { select: { nombre: true, codigoProyecto: true } },
                client: { select: { nombre: true } },
                responsable: { select: { nombreCompleto: true } },
                signature: { select: { SignatureID: true, SignedAtUTC: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(reports);
    } catch (e) {
        console.error('Error fetching technical reports:', e);
        return NextResponse.json({ error: 'Error al obtener informes técnicos' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            templateId,
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
            personnel
        } = body;

        // Generate report number
        const date = new Date();
        const year = date.getFullYear();
        const count = await prisma.technicalReport.count({
            where: {
                createdAt: {
                    gte: new Date(`${year}-01-01`),
                    lt: new Date(`${year + 1}-01-01`)
                }
            }
        });
        const reportNumber = `IT-${year}-${String(count + 1).padStart(4, '0')}`;

        const report = await prisma.technicalReport.create({
            data: {
                reportNumber,
                templateId,
                projectId: projectId || null,
                ordenServicioId: ordenServicioId || null,
                clientId: clientId || null,
                planta,
                sector,
                equipo,
                activo,
                responsableId: responsableId || null,
                empresaEjecutora: empresaEjecutora || 'HDB',
                startTime,
                endTime,
                data: data || {},
                personnel: personnel && personnel.length > 0 ? {
                    create: personnel.map((p: any) => ({
                        operatorId: p.operatorId || null,
                        name: p.name,
                        role: p.role,
                        hoursWorked: p.hoursWorked ? parseFloat(p.hoursWorked) : 0
                    }))
                } : undefined
            },
            include: {
                template: true,
                project: true,
                client: true,
                responsable: true,
                personnel: true
            }
        });

        // Register in AuditLog
        const reqHeaders = new Headers(req.headers);
        const userHeader = reqHeaders.get('x-user') ? JSON.parse(reqHeaders.get('x-user') as string) : null;
        
        await prisma.auditLog.create({
            data: {
                userId: userHeader?.id,
                userEmail: userHeader?.email,
                userName: userHeader?.nombreCompleto || 'Sistema',
                action: 'CREATE',
                entity: 'TECHNICAL_REPORT',
                entityId: report.id,
                newValue: { reportNumber: report.reportNumber, templateId: report.templateId }
            }
        });

        return NextResponse.json(report);
    } catch (e) {
        console.error('Error creating technical report:', e);
        return NextResponse.json({ error: 'Error al crear informe técnico', details: String(e) }, { status: 500 });
    }
}
