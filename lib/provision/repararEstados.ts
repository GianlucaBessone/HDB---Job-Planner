/**
 * Corrige materiales de proyectos con aprovisionamiento que quedaron en un estado
 * incoherente (datos de versiones anteriores). Antes corría dentro del GET de
 * /api/provision-proyectos; ahora es una acción explícita (POST .../reparar).
 *
 *  1. Proyecto con una OS firmada, cobrada o pagada y material todavía "entregado" o
 *     "uso confirmado": se cierra si no queda saldo, o se crea la devolución pendiente.
 *  2. Material en "pendiente de devolución" sin devoluciones pendientes: vuelve al estado
 *     que corresponde y se borran las devoluciones pendientes en cero.
 */
import { prisma } from '@/lib/prisma';

export async function repararEstadosMateriales(): Promise<{ revisados: number }> {
    // ── Auto-repair: fix materials stuck in wrong states ─────────────────────
    // If an OS is signed, materials must be either 'pendiente_devolucion' or 'cerrado_ok'
    const stuckMaterials = await prisma.materialProyecto.findMany({
        where: {
            proyecto: {
                aprovisionamiento: true,
                ordenesServicio: {
                    some: { estado: { in: ['firmada', 'cobrada', 'pagada'] } }
                }
            },
            // Only if NOT closed or already pending
            estado: { in: ['material_entregado', 'uso_confirmado'] },
        },
        include: { usos: true, devoluciones: true }
    });

    if (stuckMaterials.length > 0) {
        await prisma.$transaction(async (tx) => {
            for (const mat of stuckMaterials) {
                const totalUsado = mat.usos.reduce((acc, u) => acc + u.cantidadUtilizada, 0);
                const totalDevuelto = mat.devoluciones.filter(d => d.estado !== 'pendiente' && d.estado !== 'delegacion_pendiente' && d.estado !== 'delegacion_rechazada').reduce((acc, d) => acc + d.cantidadADevolver, 0);
                const aDevolver = Math.max(0, mat.cantidadEntregada - totalUsado - totalDevuelto);
                
                const hasPending = mat.devoluciones.some(d => d.estado === 'pendiente' || d.estado === 'delegacion_pendiente');
                const esCerrado = mat.cantidadEntregada > 0 && aDevolver <= 0;

                if (esCerrado) {
                    await tx.materialProyecto.update({
                        where: { id: mat.id },
                        data: { estado: 'cerrado_ok' }
                    });
                } else if (aDevolver > 0 && !hasPending) {
                    // Create pending return if missing
                    await tx.materialDevolucion.create({
                        data: {
                            materialId: mat.id,
                            cantidadADevolver: aDevolver,
                            estado: 'pendiente',
                        }
                    });
                    await tx.materialProyecto.update({
                        where: { id: mat.id },
                        data: { estado: 'pendiente_devolucion' }
                    });
                }
            }
        });
    }

    // Case 2 (damage repair): Fix materials wrongly set to pendiente_devolucion 
    // with 0 balance, no pending returns, or old 0-devolucion records.
    const wronglyPending = await prisma.materialProyecto.findMany({
        where: {
            proyecto: { aprovisionamiento: true },
            estado: 'pendiente_devolucion',
        },
        include: { usos: true, devoluciones: true }
    });

    if (wronglyPending.length > 0) {
        await prisma.$transaction(async (tx) => {
            for (const mat of wronglyPending) {
                const totalUsado = mat.usos.reduce((acc, u) => acc + u.cantidadUtilizada, 0);
                const totalDevuelto = mat.devoluciones.filter(d => d.estado !== 'pendiente' && d.estado !== 'delegacion_pendiente' && d.estado !== 'delegacion_rechazada').reduce((acc, d) => acc + d.cantidadADevolver, 0);
                const aDevolver = Math.max(0, mat.cantidadEntregada - totalUsado - totalDevuelto);
                const hasPending = mat.devoluciones.some(d => d.estado === 'pendiente' || d.estado === 'delegacion_pendiente');

                if (!hasPending) {
                    if (aDevolver <= 0) {
                        await tx.materialProyecto.update({
                            where: { id: mat.id },
                            data: { estado: 'cerrado_ok' }
                        });
                    } else {
                        await tx.materialProyecto.update({
                            where: { id: mat.id },
                            data: { estado: totalUsado > 0 ? 'uso_confirmado' : 'material_entregado' }
                        });
                    }
                    // Clean up any 0-pending returns
                    const zeroPendings = mat.devoluciones.filter(d => d.cantidadADevolver === 0 && d.estado === 'pendiente');
                    for (const zp of zeroPendings) {
                        await tx.materialDevolucion.delete({ where: { id: zp.id } });
                    }
                }
            }
        });
    }

    return { revisados: stuckMaterials.length + wronglyPending.length };
}
