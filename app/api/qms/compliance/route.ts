import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateComplianceScore } from '../compliance-engine';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const operatorId = searchParams.get('operatorId');

        if (operatorId) {
            // Retornar el score de cumplimiento específico de un operador
            const score = await calculateComplianceScore(operatorId);
            return NextResponse.json(score);
        }

        // Obtener datos consolidados para el dashboard enterprise
        const activeOperators = await prisma.operator.findMany({ where: { activo: true } });
        const allDocuments = await prisma.controlledDocument.findMany({ where: { estado: 'vigente' } });
        
        // Competencias agrupadas
        const allCompetencies = await prisma.technicianCompetency.findMany({
            include: { operator: { select: { nombreCompleto: true } } }
        });
        
        // Capacitaciones consolidadas
        const allTrainings = await prisma.technicianTraining.findMany({
            include: { operator: { select: { nombreCompleto: true } } }
        });

        // 1. Calcular compliance score global promedio
        let sumScore = 0;
        const operatorScores = [];

        for (const op of activeOperators) {
            const score = await calculateComplianceScore(op.id);
            sumScore += score.globalScore;
            operatorScores.push({
                operatorId: op.id,
                operatorNombre: op.nombreCompleto,
                ...score
            });
        }

        const globalAvgScore = activeOperators.length > 0 
            ? Math.round(sumScore / activeOperators.length) 
            : 100;

        // 2. Certificaciones por vencer (Próximos 30 días)
        const in30Days = new Date();
        in30Days.setDate(in30Days.getDate() + 30);
        
        const expirations = allCompetencies.filter(c => 
            c.vencimiento && 
            new Date(c.vencimiento) <= in30Days && 
            c.estado === 'vigente'
        );

        // 3. Riesgos documentales (por falta de lectura o capacitación en documentos de criticidad alta/critica)
        const criticalDocs = allDocuments.filter(d => d.nivelCriticidad === 'alta' || d.nivelCriticidad === 'critica');
        const risks = [];

        for (const op of activeOperators) {
            const missingReads = [];
            const missingTrainings = [];

            for (const doc of criticalDocs) {
                if (doc.requiereConfirmacionLectura) {
                    const read = await prisma.documentReadConfirmation.findUnique({
                        where: { documentId_operatorId: { documentId: doc.id, operatorId: op.id } }
                    });
                    if (!read) missingReads.push(doc.titulo);
                }

                if (doc.requiereCapacitacion) {
                    const trained = allTrainings.some(t => t.operatorId === op.id && t.documentId === doc.id && t.estado === 'aprobado');
                    if (!trained) missingTrainings.push(doc.titulo);
                }
            }

            if (missingReads.length > 0 || missingTrainings.length > 0) {
                risks.push({
                    operatorId: op.id,
                    operatorNombre: op.nombreCompleto,
                    missingReads,
                    missingTrainings,
                    level: (missingReads.length + missingTrainings.length) > 2 ? 'Alto' : 'Medio'
                });
            }
        }

        // 4. Matrix de Competencias agrupadas por nombre
        const competencyCounts: Record<string, { vigente: number, pendiente: number, vencida: number }> = {};
        allCompetencies.forEach(c => {
            if (!competencyCounts[c.nombre]) {
                competencyCounts[c.nombre] = { vigente: 0, pendiente: 0, vencida: 0 };
            }
            if (c.estado === 'vigente') competencyCounts[c.nombre].vigente++;
            if (c.estado === 'pendiente') competencyCounts[c.nombre].pendiente++;
            if (c.estado === 'vencida') competencyCounts[c.nombre].vencida++;
        });

        // 5. Historial de Auditoría / Actividad (lecturas y aprobaciones recientes)
        const auditHistory = [];
        const readConfirmations = await prisma.documentReadConfirmation.findMany({
            take: 10,
            orderBy: { confirmadoAt: 'desc' },
            include: { document: { select: { titulo: true } } }
        });

        readConfirmations.forEach(r => {
            auditHistory.push({
                tipo: 'LECTURA',
                mensaje: `El técnico ${r.operatorNombre} confirmó la lectura del documento "${r.document.titulo}" (v${r.versionAlMomento})`,
                fecha: r.confirmadoAt
            });
        });

        const recentTrainings = allTrainings
            .filter(t => t.estado === 'aprobado')
            .slice(0, 10);
        
        recentTrainings.forEach(t => {
            auditHistory.push({
                tipo: 'CAPACITACION',
                mensaje: `El técnico ${t.operator?.nombreCompleto} aprobó la capacitación "${t.titulo}" con score de ${Math.round(t.puntaje || 0)}%`,
                fecha: t.updatedAt
            });
        });

        auditHistory.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        return NextResponse.json({
            globalAvgScore,
            operatorScores,
            expirationsCount: expirations.length,
            expirations: expirations.map(e => ({
                id: e.id,
                operatorNombre: e.operator.nombreCompleto,
                competencia: e.nombre,
                vencimiento: e.vencimiento
            })),
            risksCount: risks.length,
            risks,
            competencyCounts,
            auditHistory: auditHistory.slice(0, 10)
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
