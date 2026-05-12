import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/provision-proyectos — proyectos activos con aprovisionamiento habilitado
export async function GET() {
    try {
        // ── Auto-repair: fix materials stuck in wrong states ─────────────────────

        // Case 1: Materials still in material_entregado/uso_confirmado on projects
        //         with a signed OS. They should have transitioned but didn't.
        //         Handles BOTH cases: with or without existing devolucion records.
        const stuckMaterials = await prisma.materialProyecto.findMany({
            where: {
                proyecto: {
                    aprovisionamiento: true,
                    ordenesServicio: {
                        some: {
                            estado: { in: ['firmada', 'cobrada', 'pagada'] }
                        }
                    }
                },
                estado: { in: ['material_entregado', 'uso_confirmado'] },
            },
            include: { usos: true, devoluciones: true }
        });

        if (stuckMaterials.length > 0) {
            await prisma.$transaction(async (tx) => {
                for (const mat of stuckMaterials) {
                    const totalUsado = mat.usos.reduce((acc, u) => acc + u.cantidadUtilizada, 0);
                    const aDevolver = Math.max(0, mat.cantidadEntregada - totalUsado);
                    const esCerrado = mat.cantidadEntregada > 0 && aDevolver === 0;
                    const nuevoEstado = esCerrado ? 'cerrado_ok' : 'pendiente_devolucion';
                    const devEstado = esCerrado ? 'cerrado_ok' : 'pendiente';

                    // Check if there is already a pending return for this material
                    const hasPending = mat.devoluciones.some(d => d.estado === 'pendiente');

                    if (!hasPending && aDevolver > 0) {
                        await tx.materialDevolucion.create({
                            data: {
                                materialId: mat.id,
                                cantidadADevolver: aDevolver,
                                estado: devEstado,
                            }
                        });
                    }

                    // Update material state
                    await tx.materialProyecto.update({
                        where: { id: mat.id },
                        data: { estado: nuevoEstado }
                    });
                }
            });
        }

        // Case 2 (damage repair): Materials wrongly set to pendiente_devolucion
        // when they should be cerrado_ok (100% consumed, cantidadADevolver = 0,
        // never confirmed by sales)
        const wronglyPending = await prisma.materialProyecto.findMany({
            where: {
                proyecto: {
                    aprovisionamiento: true,
                },
                estado: 'pendiente_devolucion',
                devoluciones: {
                    some: {
                        cantidadADevolver: 0,
                        confirmadoPor: null,
                    }
                }
            },
            include: { devoluciones: true }
        });

        if (wronglyPending.length > 0) {
            await prisma.$transaction(async (tx) => {
                for (const mat of wronglyPending) {
                    await tx.materialProyecto.update({
                        where: { id: mat.id },
                        data: { estado: 'cerrado_ok' }
                    });

                    // Update the specific record
                    const target = mat.devoluciones.find(d => d.cantidadADevolver === 0 && !d.confirmadoPor);
                    if (target) {
                        await tx.materialDevolucion.update({
                            where: { id: target.id },
                            data: { estado: 'cerrado_ok' }
                        });
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
