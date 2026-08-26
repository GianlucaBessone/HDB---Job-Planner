import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/materiales-proyecto/uso
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { materialId, cantidadUtilizada, operadorNombre, ordenServicioId, operatorId } = body;

        if (!operatorId) {
            return NextResponse.json({ error: 'operatorId es requerido para esta acción' }, { status: 401 });
        }

        const operator = await prisma.operator.findUnique({ where: { id: operatorId, activo: true } });
        if (!operator) {
            return NextResponse.json({ error: 'Operador no válido o inactivo' }, { status: 401 });
        }

        if (!materialId || cantidadUtilizada === undefined || !operadorNombre) {
            return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
        }

        const finalCantidad = parseFloat(cantidadUtilizada);
        if (isNaN(finalCantidad) || finalCantidad <= 0) {
            return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            const matDb = await tx.materialProyecto.findUnique({
                where: { id: materialId },
                include: { usos: true, devoluciones: true }
            });

            if (!matDb) throw new Error('Material no encontrado');

            const totalUsado = matDb.usos.reduce((acc, u) => acc + u.cantidadUtilizada, 0);
            const totalDevueltoOk = matDb.devoluciones.filter(d => d.estado === 'cerrado_ok' || d.estado === 'cerrado_con_reserva').reduce((acc, d) => acc + d.cantidadADevolver, 0);
            const pendingDevolucion = matDb.devoluciones.filter(d => d.estado === 'pendiente' || d.estado === 'delegacion_pendiente').reduce((acc, d) => acc + d.cantidadADevolver, 0);
            
            const balance = matDb.cantidadEntregada - totalUsado - totalDevueltoOk - pendingDevolucion;
            const roundedBalance = Math.round(balance * 100) / 100;

            if (finalCantidad > roundedBalance) {
                throw new Error(`Saldo insuficiente. Balance actual: ${roundedBalance}`);
            }

            const uso = await tx.materialUso.create({
                data: {
                    materialId,
                    cantidadUtilizada: finalCantidad,
                    operadorNombre,
                    ordenServicioId: ordenServicioId || null,
                },
            });

            // Update material state: only set 'uso_confirmado' if not pending_devolucion
            const pendingCount = matDb.devoluciones.filter(d => ['pendiente', 'delegacion_pendiente', 'delegacion_rechazada'].includes(d.estado)).length;
            if (pendingCount === 0) {
                await tx.materialProyecto.update({
                    where: { id: materialId },
                    data: { estado: 'uso_confirmado' },
                });
            }

            return uso;
        });

        return NextResponse.json(result, { status: 201 });
    } catch (e: any) {
        console.error('Error en uso:', e);
        return NextResponse.json({ error: e.message || 'Error interno del servidor' }, { status: 400 });
    }
}
