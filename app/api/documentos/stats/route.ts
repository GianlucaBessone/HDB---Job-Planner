import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/documentos/stats
 * Dashboard statistics for document control module
 */
export async function GET() {
    try {
        const now = new Date();
        const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const [
            totalDocs,
            vigentes,
            borradores,
            enRevision,
            obsoletos,
            criticos,
            proximosVencimiento,
            vencidos,
            alertasSinLeer,
            totalVersiones,
            confirmacionesPendientes,
        ] = await Promise.all([
            prisma.controlledDocument.count(),
            prisma.controlledDocument.count({ where: { estado: 'vigente' } }),
            prisma.controlledDocument.count({ where: { estado: 'borrador' } }),
            prisma.controlledDocument.count({ where: { estado: 'en_revision' } }),
            prisma.controlledDocument.count({ where: { estado: 'obsoleto' } }),
            prisma.controlledDocument.count({ where: { nivelCriticidad: 'critica' } }),
            prisma.controlledDocument.count({
                where: {
                    proximaRevision: { gte: now, lte: in30Days },
                    estado: { not: 'obsoleto' }
                }
            }),
            prisma.controlledDocument.count({
                where: {
                    proximaRevision: { lt: now },
                    estado: { not: 'obsoleto' }
                }
            }),
            prisma.documentAlert.count({ where: { leido: false } }),
            prisma.documentVersion.count(),
            prisma.controlledDocument.count({
                where: {
                    requiereConfirmacionLectura: true,
                    estado: 'vigente'
                }
            }),
        ]);

        // Documents by type
        const byType = await prisma.controlledDocument.groupBy({
            by: ['tipoDocumento'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } }
        });

        // Documents by area
        const byArea = await prisma.controlledDocument.groupBy({
            by: ['area'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } }
        });

        // Documents by criticality
        const byCriticality = await prisma.controlledDocument.groupBy({
            by: ['nivelCriticidad'],
            _count: { id: true },
        });

        // Recent activity (last 10 versions created)
        const recentVersions = await prisma.documentVersion.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
                document: {
                    select: { codigoDocumental: true, titulo: true }
                }
            }
        });

        return NextResponse.json({
            totals: {
                totalDocs,
                vigentes,
                borradores,
                enRevision,
                obsoletos,
                criticos,
                proximosVencimiento,
                vencidos,
                alertasSinLeer,
                totalVersiones,
                confirmacionesPendientes,
            },
            byType: byType.map(t => ({ tipo: t.tipoDocumento, count: t._count.id })),
            byArea: byArea.map(a => ({ area: a.area, count: a._count.id })),
            byCriticality: byCriticality.map(c => ({ criticidad: c.nivelCriticidad, count: c._count.id })),
            recentVersions,
        });
    } catch (e: any) {
        return NextResponse.json({ error: 'Error al obtener estadísticas', details: e.message }, { status: 500 });
    }
}
