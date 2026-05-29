import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/provision-proyectos — proyectos activos con aprovisionamiento habilitado
export async function GET() {
    try {
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
                    const totalDevuelto = mat.devoluciones.filter(d => d.estado !== 'pendiente').reduce((acc, d) => acc + d.cantidadADevolver, 0);
                    const aDevolver = Math.max(0, mat.cantidadEntregada - totalUsado - totalDevuelto);
                    
                    const hasPending = mat.devoluciones.some(d => d.estado === 'pendiente');
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
                    const totalDevuelto = mat.devoluciones.filter(d => d.estado !== 'pendiente').reduce((acc, d) => acc + d.cantidadADevolver, 0);
                    const aDevolver = Math.max(0, mat.cantidadEntregada - totalUsado - totalDevuelto);
                    const hasPending = mat.devoluciones.some(d => d.estado === 'pendiente');

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

        // ── Main query ──────────────────────────────────────────────────────────────
        const proyectos = await prisma.project.findMany({
            where: {
                aprovisionamiento: true,
                OR: [
                    { estado: { not: 'finalizado' } },
                    // Include finalized projects that still have pending returns
                    {
                        estado: 'finalizado',
                        materialesProyecto: {
                            some: { estado: 'pendiente_devolucion' }
                        }
                    }
                ],
            },
            include: {
                client: { select: { nombre: true } },
                responsableUser: { select: { nombreCompleto: true } },
                materialesProyecto: {
                    include: {
                        usos: { orderBy: { createdAt: 'desc' } },
                        devoluciones: { orderBy: { createdAt: 'desc' } },
                    },
                    orderBy: { createdAt: 'asc' },
                },
                ordenesServicio: {
                    select: {
                        id: true,
                        cobroGenerado: true,
                        estado: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(proyectos);
    } catch (error: any) {
        console.error('Provision GET Error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
