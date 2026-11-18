import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sesion, esTablaFaltante } from '@/lib/presupuestosServicio/sesion';

export const dynamic = 'force-dynamic';

/**
 * GET: mapa proyecto → presupuesto de origen, para marcar las tarjetas de /projects.
 * Si el módulo todavía no está instalado en la base devuelve {} (la lista de proyectos no cambia).
 */
export async function GET(req: NextRequest) {
    const s = await sesion(req);
    if (s instanceof NextResponse) return s;
    try {
        const filas = await prisma.presupuestoServicio.findMany({
            where: { proyectoId: { not: null } },
            select: { id: true, numero: true, proyectoId: true },
        });
        const mapa: Record<string, { id: string; numero: string }> = {};
        for (const f of filas) if (f.proyectoId) mapa[f.proyectoId] = { id: f.id, numero: f.numero };
        return NextResponse.json(mapa, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) {
        if (!esTablaFaltante(e)) console.error('[presupuestos-servicio/vinculos]', e);
        return NextResponse.json({});
    }
}
