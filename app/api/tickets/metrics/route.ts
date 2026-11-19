import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigirAcceso } from '@/lib/permisosServer';
import { esTicketAbierto, TICKET_ESTADOS, TICKET_TIPOS, TICKET_URGENCIAS, getSlaEstado } from '@/lib/tickets';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const acceso = await exigirAcceso(req);
        if (acceso instanceof NextResponse) return acceso;

        // Quien gestiona tickets ve las métricas de todos; el resto, solo las de los suyos.
        const where: any = {};
        if (!acceso.puede('tickets.gestionar')) where.reportadoPorId = acceso.userId;

        const tickets = await prisma.ticket.findMany({
            where,
            select: {
                id: true,
                estado: true,
                tipo: true,
                urgencia: true,
                prioridad: true,
                createdAt: true,
                fechaResolucion: true,
                fechaCierre: true,
            },
        });

        const porEstado: Record<string, number> = {};
        const porTipo: Record<string, number> = {};
        const porUrgencia: Record<string, number> = {};

        TICKET_ESTADOS.forEach(e => { porEstado[e.value] = 0; });
        TICKET_TIPOS.forEach(t => { porTipo[t.value] = 0; });
        TICKET_URGENCIAS.forEach(u => { porUrgencia[u.value] = 0; });

        let abiertos = 0;
        let criticos = 0;
        let vencidos = 0;
        let resueltosSemana = 0;
        const haceSeteDias = Date.now() - 7 * 24 * 60 * 60 * 1000;

        for (const t of tickets) {
            porEstado[t.estado] = (porEstado[t.estado] || 0) + 1;
            porTipo[t.tipo] = (porTipo[t.tipo] || 0) + 1;
            porUrgencia[t.urgencia] = (porUrgencia[t.urgencia] || 0) + 1;

            if (esTicketAbierto(t.estado)) {
                abiertos++;
                if (t.urgencia === 'critica') criticos++;
                const sla = getSlaEstado(t.urgencia as any, t.createdAt, t.fechaResolucion);
                if (sla.estado === 'vencido') vencidos++;
            }

            if (t.fechaResolucion && new Date(t.fechaResolucion).getTime() >= haceSeteDias) {
                resueltosSemana++;
            }
        }

        return NextResponse.json({
            total: tickets.length,
            abiertos,
            criticos,
            vencidos,
            resueltosSemana,
            porEstado,
            porTipo,
            porUrgencia,
        });
    } catch (error) {
        console.error('[TICKETS_METRICS]', error);
        return NextResponse.json({ error: 'Error al obtener métricas' }, { status: 500 });
    }
}
