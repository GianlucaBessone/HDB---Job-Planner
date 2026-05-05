import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/provision-proyectos — proyectos activos con aprovisionamiento habilitado
export async function GET() {
    try {
        // ── Auto-repair: fix materials stuck in wrong states from old signing logic ──
        // Case 1: Materials with no devolucion record but project has signed OS
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
            });
        }

        // Case 2: Materials auto-closed as cerrado_ok without sales confirmation
        const autoClosedMaterials = await prisma.materialProyecto.findMany({
            where: {
                proyecto: {
                    aprovisionamiento: true,
                    ordenesServicio: {
                        some: {
                            estado: { in: ['firmada', 'cobrada', 'pagada'] }
                        }
                    }
                },
                estado: 'cerrado_ok',
                devolucion: {
                    confirmadoPor: null
                }
            }
        });

        if (autoClosedMaterials.length > 0) {
            await prisma.$transaction(async (tx) => {
                for (const mat of autoClosedMaterials) {
                    await tx.materialProyecto.update({
                        where: { id: mat.id },
                        data: { estado: 'pendiente_devolucion' }
                    });

                    await tx.materialDevolucion.update({
                        where: { materialId: mat.id },
                        data: { estado: 'pendiente' }
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
