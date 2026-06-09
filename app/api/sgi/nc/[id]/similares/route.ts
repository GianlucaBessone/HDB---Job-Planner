import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEmbedding, cosineSimilarity } from '@/lib/ai/embeddings';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        // 1. Fetch current NC
        const targetNc = await prisma.noConformidad.findUnique({
            where: { id: params.id },
            include: {
                analisisCausaRaiz: true
            }
        });

        if (!targetNc) {
            return NextResponse.json({ error: 'No Conformidad no encontrada' }, { status: 404 });
        }

        // 2. Build text representation for the target NC
        const targetText = `Código: ${targetNc.codigoNC || ''}
Categoría: ${targetNc.categoria || ''}
Área: ${targetNc.areaAfectada || ''}
Proceso: ${targetNc.procesoAfectado || ''}
Descripción: ${targetNc.descripcion || ''}
Causa Raíz: ${targetNc.analisisCausaRaiz?.map(acr => acr.causaRaiz || acr.descripcion).join('; ') || ''}`;

        // 3. Obtain target embedding
        let targetEmbedding: number[];
        if (targetNc.embedding && Array.isArray(targetNc.embedding)) {
            targetEmbedding = targetNc.embedding as number[];
        } else {
            try {
                targetEmbedding = await getEmbedding(targetText);
                // Cache the generated embedding back to database
                await prisma.noConformidad.update({
                    where: { id: params.id },
                    data: { embedding: targetEmbedding }
                });
            } catch (err) {
                console.error("Error generating embedding for current NC:", err);
                return NextResponse.json({ error: 'Error al generar vector para la NC actual' }, { status: 500 });
            }
        }

        // 4. Load all closed NCs
        const otherNcs = await prisma.noConformidad.findMany({
            where: {
                id: { not: params.id },
                estado: 'Cerrada'
            },
            include: {
                analisisCausaRaiz: true,
                accionesMejora: true,
                verificacionesEficacia: true
            }
        });

        // 5. Compare similarity
        const matches = [];
        for (const nc of otherNcs) {
            let ncEmbedding: number[];
            if (nc.embedding && Array.isArray(nc.embedding)) {
                ncEmbedding = nc.embedding as number[];
            } else {
                // Generate embedding on the fly (lazy backfill)
                const text = `Código: ${nc.codigoNC || ''}
Categoría: ${nc.categoria || ''}
Área: ${nc.areaAfectada || ''}
Proceso: ${nc.procesoAfectado || ''}
Descripción: ${nc.descripcion || ''}
Causa Raíz: ${nc.analisisCausaRaiz?.map(acr => acr.causaRaiz || acr.descripcion).join('; ') || ''}`;
                
                try {
                    ncEmbedding = await getEmbedding(text);
                    await prisma.noConformidad.update({
                        where: { id: nc.id },
                        data: { embedding: ncEmbedding }
                    });
                } catch (e) {
                    console.error(`Skipping NC ${nc.codigoNC || nc.id} due to embedding failure:`, e);
                    continue;
                }
            }

            const score = cosineSimilarity(targetEmbedding, ncEmbedding);
            matches.push({ nc, score });
        }

        // 6. Sort and format results
        matches.sort((a, b) => b.score - a.score);

        // Keep top matches above a decent threshold (e.g. 0.45)
        const topMatches = matches
            .filter(m => m.score > 0.45)
            .slice(0, 5)
            .map(m => {
                const acr = m.nc.analisisCausaRaiz?.[0];
                return {
                    id: m.nc.id,
                    codigoNC: m.nc.codigoNC || 'Sin código',
                    fechaDeteccion: m.nc.fechaDeteccion,
                    descripcion: m.nc.descripcion,
                    score: Math.round(m.score * 100),
                    causaRaiz: acr?.causaRaiz || acr?.descripcion || 'No detallada',
                    acciones: m.nc.accionesMejora.map(a => ({
                        codigoAccion: a.codigoAccion || 'Acción',
                        descripcion: a.descripcion,
                        estado: a.estado,
                        eficacia: a.eficacia
                    })),
                    verificaciones: m.nc.verificacionesEficacia.map(v => ({
                        fecha: v.fechaVerificacion,
                        resultado: v.resultado,
                        eficaz: v.eficaz
                    }))
                };
            });

        return NextResponse.json({ similares: topMatches });
    } catch (error) {
        console.error('Error fetching similar NCs:', error);
        return NextResponse.json({ error: 'Error interno del servidor al procesar similitudes' }, { status: 500 });
    }
}
