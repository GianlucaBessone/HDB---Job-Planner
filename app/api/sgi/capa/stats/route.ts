import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa', 'operador']); // Broad access for dashboard
    if (auth.error) return auth.error;

    try {
        const acciones = await prisma.accionMejora.findMany({
            select: { estado: true, eficacia: true, fechaCompromiso: true }
        });

        const stats = {
            total: acciones.length,
            abiertas: acciones.filter(a => ['Pendiente', 'En Progreso'].includes(a.estado)).length,
            completadas: acciones.filter(a => a.estado === 'Completada').length,
            cerradas: acciones.filter(a => a.estado === 'Cerrada').length,
            vencidas: acciones.filter(a => {
                if (!['Pendiente', 'En Progreso'].includes(a.estado)) return false;
                if (!a.fechaCompromiso) return false;
                return new Date(a.fechaCompromiso) < new Date();
            }).length,
            eficaciaGlobal: 0
        };

        const eficaces = acciones.filter(a => a.eficacia === 'Eficaz').length;
        const evaluadas = acciones.filter(a => a.eficacia === 'Eficaz' || a.eficacia === 'Ineficaz').length;
        
        if (evaluadas > 0) {
            stats.eficaciaGlobal = Math.round((eficaces / evaluadas) * 100);
        }

        return NextResponse.json(stats);
    } catch (error) {
        console.error('Error calculating CAPA stats:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
