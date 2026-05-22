import { NextResponse } from 'next/server';
import { generateContent } from '@/lib/ai/gemini';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { query, filterEntity, userId, userName, userRole } = body;

        if (!query) {
            return NextResponse.json({ error: 'Falta el parámetro obligatorio: query.' }, { status: 400 });
        }

        // 1. Invocar a Gemini para expandir semánticamente la búsqueda (intenciones + sinónimos)
        const aiResponse = await generateContent<{
            intencion: string;
            keywords: string[];
            sinonimos: string[];
            entidadesTarget: string[];
            consultaOptimizada: string;
        }>(
            'SEMANTIC_SEARCH',
            { query, filterEntity: filterEntity || 'todas' },
            { userId, userName, userRole, temperature: 0.1 }
        );

        if (!aiResponse.success || !aiResponse.data) {
            return NextResponse.json({ error: aiResponse.error || 'Error en la expansión semántica.' }, { status: 500 });
        }

        const expansion = aiResponse.data;
        const allSearchTerms = [...expansion.keywords, ...expansion.sinonimos];

        // 2. Realizar búsquedas híbridas en la Base de Datos basadas en los términos expandidos
        let documentResults: any[] = [];
        let logResults: any[] = [];
        let serviceOrderResults: any[] = [];

        // Combinación de condiciones para búsqueda
        const orConditions = allSearchTerms.map(term => ({
            OR: [
                { titulo: { contains: term, mode: 'insensitive' as const } },
                { descripcion: { contains: term, mode: 'insensitive' as const } },
                { observaciones: { contains: term, mode: 'insensitive' as const } }
            ]
        }));

        const logOrConditions = allSearchTerms.map(term => ({
            OR: [
                { observacion: { contains: term, mode: 'insensitive' as const } },
                { categoria: { contains: term, mode: 'insensitive' as const } }
            ]
        }));

        const osOrConditions = allSearchTerms.map(term => ({
            OR: [
                { reporte: { contains: term, mode: 'insensitive' as const } },
                { comentario: { contains: term, mode: 'insensitive' as const } }
            ]
        }));

        // Búsqueda en ControlledDocument (QMS)
        if (!filterEntity || filterEntity === 'documentos' || filterEntity === 'procedimientos') {
            documentResults = await prisma.controlledDocument.findMany({
                where: {
                    OR: orConditions.flatMap(cond => cond.OR)
                },
                take: 10,
                select: {
                    id: true,
                    codigoDocumental: true,
                    titulo: true,
                    tipoDocumento: true,
                    area: true,
                    estado: true
                }
            });
        }

        // Búsqueda en ProjectLog
        if (!filterEntity || filterEntity === 'incidencias' || filterEntity === 'mantenimientos') {
            logResults = await prisma.projectLog.findMany({
                where: {
                    OR: logOrConditions.flatMap(cond => cond.OR)
                },
                take: 10,
                include: {
                    project: { select: { nombre: true } }
                }
            });
        }

        // Búsqueda en OrdenServicio
        if (!filterEntity || filterEntity === 'mantenimientos') {
            serviceOrderResults = await prisma.ordenServicio.findMany({
                where: {
                    OR: osOrConditions.flatMap(cond => cond.OR)
                },
                take: 10,
                include: {
                    project: { select: { nombre: true } }
                }
            });
        }

        // 3. Consolidar y rankear resultados (scoring simulado por coincidencias)
        const consolidatedResults: any[] = [];

        documentResults.forEach(doc => {
            consolidatedResults.push({
                entity: 'ControlledDocument',
                entityId: doc.id,
                title: `[QMS] ${doc.codigoDocumental} - ${doc.titulo}`,
                snippet: `${doc.tipoDocumento} del área de ${doc.area}. Estado: ${doc.estado}`,
                score: 0.9
            });
        });

        logResults.forEach(log => {
            consolidatedResults.push({
                entity: 'ProjectLog',
                entityId: log.id,
                title: `[Bitácora] Proyecto: ${log.project.nombre} (${log.categoria})`,
                snippet: `Registrado por ${log.responsable}: ${log.observacion}`,
                score: 0.8
            });
        });

        serviceOrderResults.forEach(os => {
            consolidatedResults.push({
                entity: 'OrdenServicio',
                entityId: os.id,
                title: `[OS] Código: ${os.codigoOS || 'Pendiente'} - Proyecto: ${os.project.nombre}`,
                snippet: `Reporte de servicio: ${os.reporte.substring(0, 150)}...`,
                score: 0.85
            });
        });

        // Ordenar por score decreciente
        consolidatedResults.sort((a, b) => b.score - a.score);

        return NextResponse.json({
            success: true,
            queryExpansion: expansion,
            results: consolidatedResults,
            usage: aiResponse.usage,
            latencyMs: aiResponse.latencyMs
        });

    } catch (error: any) {
        console.error('[Api][SemanticSearch] Failed:', error);
        return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
    }
}
