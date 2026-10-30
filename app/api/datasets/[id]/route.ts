import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSGIRole } from '@/lib/sgiAuth';
import { logAudit } from '@/lib/audit';
import { validarSQL, calcularProximaEjecucion, construirSQLDesdeVisual, DefinicionVisual } from '@/lib/datasetEngine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    const auth = requireSGIRole(req, ['supervisor', 'admin', 'qa']);
    if (auth.error) return auth.error;

    try {
        const dataset = await prisma.dataset.findUnique({
            where: { id: params.id },
            include: {
                responsable: { select: { id: true, nombreCompleto: true } },
                kpisAsociados: {
                    select: { id: true, codigoKpi: true, nombre: true, estadoCumplimiento: true },
                },
                graficosAsociados: {
                    select: { id: true, codigoGrafico: true, nombre: true },
                },
                historico: {
                    orderBy: { fechaEjecucion: 'desc' },
                    take: 20,
                },
            },
        });

        if (!dataset) {
            return NextResponse.json({ error: 'Dataset no encontrado' }, { status: 404 });
        }

        return NextResponse.json(dataset);
    } catch (error) {
        console.error('Error fetching dataset:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    const auth = requireSGIRole(req, ['supervisor', 'admin']);
    if (auth.error) return auth.error;

    try {
        const body = await req.json();
        const existing = await prisma.dataset.findUnique({ where: { id: params.id } });
        if (!existing) {
            return NextResponse.json({ error: 'Dataset no encontrado' }, { status: 404 });
        }

        let consultaSQL = body.consultaSQL !== undefined ? body.consultaSQL : existing.consultaSQL;

        // Compilar si está en modo visual
        const modoConsulta = body.modoConsulta ?? existing.modoConsulta;
        const definicionVisual = body.definicionVisual !== undefined ? body.definicionVisual : existing.definicionVisual;

        if (modoConsulta === 'Visual' && definicionVisual) {
            try {
                if (definicionVisual.tablas?.length > 0 && definicionVisual.campos?.length > 0) {
                    consultaSQL = construirSQLDesdeVisual(definicionVisual as DefinicionVisual);
                }
            } catch (err: any) {
                return NextResponse.json({
                    error: `Error al generar SQL visual: ${err.message}`,
                }, { status: 400 });
            }
        }

        // Validar SQL si se proporciona
        if (consultaSQL) {
            const validacion = validarSQL(consultaSQL);
            if (!validacion.valido) {
                return NextResponse.json({
                    error: 'SQL inválido',
                    detalles: validacion.errores,
                }, { status: 400 });
            }
        }

        // Calcular próxima ejecución si cambia la programación
        let proximaEjecucion = existing.proximaEjecucion;
        const tipoEjecucion = body.tipoEjecucion ?? existing.tipoEjecucion;
        const frecuencia = body.frecuencia ?? existing.frecuencia;
        const horaEjecucion = body.horaEjecucion ?? existing.horaEjecucion;

        if (tipoEjecucion === 'Programada' && frecuencia) {
            proximaEjecucion = calcularProximaEjecucion(frecuencia, horaEjecucion);
        } else if (tipoEjecucion === 'Manual') {
            proximaEjecucion = null;
        }

        const dataset = await prisma.dataset.update({
            where: { id: params.id },
            data: {
                nombre: body.nombre ?? existing.nombre,
                descripcion: body.descripcion !== undefined ? body.descripcion : existing.descripcion,
                responsableId: body.responsableId !== undefined ? (body.responsableId || null) : existing.responsableId,
                estado: body.estado ?? existing.estado,
                habilitado: body.habilitado !== undefined ? body.habilitado : existing.habilitado,
                modoConsulta: body.modoConsulta ?? existing.modoConsulta,
                consultaSQL: consultaSQL,
                definicionVisual: body.definicionVisual !== undefined ? body.definicionVisual : existing.definicionVisual,
                variables: body.variables !== undefined ? body.variables : existing.variables,
                tipoEjecucion,
                cronExpresion: body.cronExpresion !== undefined ? body.cronExpresion : existing.cronExpresion,
                frecuencia,
                horaEjecucion,
                zonaHoraria: body.zonaHoraria ?? existing.zonaHoraria,
                proximaEjecucion,
                timeoutSegundos: body.timeoutSegundos !== undefined ? (Number(body.timeoutSegundos) || 30) : existing.timeoutSegundos,
                limiteRegistros: body.limiteRegistros !== undefined ? (Number(body.limiteRegistros) || 10000) : existing.limiteRegistros,
            },
            include: {
                responsable: { select: { id: true, nombreCompleto: true } },
            },
        });

        await logAudit({
            userId: auth.user.id,
            action: 'UPDATE',
            entity: 'DATASET',
            entityId: dataset.id,
            oldValue: existing,
            newValue: dataset,
        });

        return NextResponse.json(dataset);
    } catch (error: any) {
        console.error('Error updating dataset:', error);
        return NextResponse.json({ 
            error: 'Error del servidor al actualizar dataset',
            detalles: error?.message ? [error.message] : undefined,
        }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
    const auth = requireSGIRole(req, ['supervisor', 'admin']);
    if (auth.error) return auth.error;

    try {
        const existing = await prisma.dataset.findUnique({
            where: { id: params.id },
            include: { _count: { select: { kpisAsociados: true, graficosAsociados: true } } },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Dataset no encontrado' }, { status: 404 });
        }

        if (existing._count.kpisAsociados > 0 || existing._count.graficosAsociados > 0) {
            // Soft delete: desactivar para proteger integridad referencial de KPIs y gráficos
            await prisma.dataset.update({
                where: { id: params.id },
                data: { habilitado: false, estado: 'Inactivo' },
            });
            return NextResponse.json({ 
                success: true, 
                message: 'Dataset desactivado (tiene KPIs o Gráficos asociados vinculados)' 
            });
        }

        await prisma.dataset.delete({ where: { id: params.id } });

        await logAudit({
            userId: auth.user.id,
            action: 'DELETE',
            entity: 'DATASET',
            entityId: params.id,
            oldValue: existing,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting dataset:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
