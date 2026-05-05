import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/provision-proyectos — proyectos activos con aprovisionamiento habilitado
export async function GET() {
    try {
        // ── Auto-repair: fix materials stuck in wrong states ─────────────────────
        // Case 1: Materials in material_entregado/uso_confirmado with no devolucion,
        //         on projects that have a signed OS → calculate and transition
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
                devolucion: null
            },
            include: { usos: true }
        });

        if (stuckMaterials.length > 0) {
            await prisma.$transaction(async (tx) => {
                for (const mat of stuckMaterials) {
                    const totalUsado = mat.usos.reduce((acc, u) => acc + u.cantidadUtilizada, 0);
                    const aDevolver = Math.max(0, mat.cantidadEntregada - totalUsado);
                    const esCerrado = mat.cantidadEntregada > 0 && aDevolver === 0;

                    await tx.materialDevolucion.create({
                        data: {
                            materialId: mat.id,
                            cantidadADevolver: aDevolver,
                            estado: esCerrado ? 'cerrado_ok' : 'pendiente',
                        }
                    });

                    await tx.materialProyecto.update({
                        where: { id: mat.id },
                        data: { estado: esCerrado ? 'cerrado_ok' : 'pendiente_devolucion' }
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
                devolucion: {
                    cantidadADevolver: 0,
                    confirmadoPor: null,
                }
            }
        });

        if (wronglyPending.length > 0) {
            await prisma.$transaction(async (tx) => {
                for (const mat of wronglyPending) {
                    await tx.materialProyecto.update({
                        where: { id: mat.id },
                        data: { estado: 'cerrado_ok' }
                    });

                    await tx.materialDevolucion.update({
                        where: { materialId: mat.id },
                        data: { estado: 'cerrado_ok' }
                    });
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
                        devolucion: true,
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
