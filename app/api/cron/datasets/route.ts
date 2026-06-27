import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ejecutarDataset, calcularProximaEjecucion } from '@/lib/datasetEngine';

export const dynamic = 'force-dynamic';

/**
 * Endpoint para ejecución programada de datasets.
 * Se invoca periódicamente desde un servicio externo (cron-job.org).
 * Ejecuta todos los datasets programados cuya proximaEjecucion ha pasado.
 */
export async function GET(req: NextRequest) {
    // Verificar token de seguridad (mismo patrón que /api/cron/reminders)
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const expectedToken = process.env.CRON_SECRET || 'cron-secret-default';

    if (token !== expectedToken) {
        console.error('Unauthorized cron/datasets access attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const ahora = new Date();

        // Buscar datasets programados cuya próxima ejecución ha pasado
        const datasetsPendientes = await prisma.dataset.findMany({
            where: {
                tipoEjecucion: 'Programada',
                habilitado: true,
                estado: { not: 'Inactivo' },
                proximaEjecucion: { lte: ahora },
            },
            select: {
                id: true,
                codigoDataset: true,
                nombre: true,
                frecuencia: true,
                horaEjecucion: true,
            },
        });

        if (datasetsPendientes.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No hay datasets pendientes de ejecución',
                ejecutados: 0,
            });
        }

        const resultados: { id: string; codigo: string; estado: string; error?: string }[] = [];

        for (const ds of datasetsPendientes) {
            try {
                await ejecutarDataset(ds.id, {
                    preview: false,
                    tipo: 'Programada',
                });

                // Calcular próxima ejecución
                const proximaEjecucion = calcularProximaEjecucion(
                    ds.frecuencia || 'Diario',
                    ds.horaEjecucion
                );

                await prisma.dataset.update({
                    where: { id: ds.id },
                    data: { proximaEjecucion },
                });

                resultados.push({
                    id: ds.id,
                    codigo: ds.codigoDataset,
                    estado: 'Exitosa',
                });

                console.log(`[CRON-DATASETS] ✓ ${ds.codigoDataset} ejecutado correctamente`);
            } catch (err: any) {
                resultados.push({
                    id: ds.id,
                    codigo: ds.codigoDataset,
                    estado: 'Error',
                    error: err.message,
                });

                console.error(`[CRON-DATASETS] ✗ ${ds.codigoDataset} falló:`, err.message);

                // Aún así calcular próxima ejecución para no bloquear
                try {
                    const proximaEjecucion = calcularProximaEjecucion(
                        ds.frecuencia || 'Diario',
                        ds.horaEjecucion
                    );
                    await prisma.dataset.update({
                        where: { id: ds.id },
                        data: { proximaEjecucion },
                    });
                } catch {}
            }
        }

        const exitosos = resultados.filter(r => r.estado === 'Exitosa').length;
        const errores = resultados.filter(r => r.estado === 'Error').length;

        return NextResponse.json({
            success: true,
            message: `${exitosos} datasets ejecutados correctamente, ${errores} con errores`,
            ejecutados: exitosos,
            errores,
            detalles: resultados,
        });
    } catch (error) {
        console.error('[CRON-DATASETS] Error general:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
