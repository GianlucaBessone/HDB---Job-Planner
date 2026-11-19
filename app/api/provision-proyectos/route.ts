import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/provision-proyectos — proyectos activos con aprovisionamiento habilitado.
// Solo lectura: la corrección de estados de materiales está en POST /api/provision-proyectos/reparar.
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('id');
        // ── Main query ──────────────────────────────────────────────────────────────
        const proyectos = await prisma.project.findMany({
            where: {
                ...(projectId ? { id: projectId } : {
                    aprovisionamiento: true,
                    OR: [
                        { estado: { not: 'finalizado' } },
                        // Include finalized projects that still have pending returns
                        {
                            estado: 'finalizado',
                            materialesProyecto: {
                                some: {
                                    devoluciones: {
                                        some: {
                                            estado: { in: ['pendiente', 'delegacion_pendiente'] }
                                        }
                                    }
                                }
                            }
                        }
                    ],
                })
            },
            include: {
                client: { select: { nombre: true } },
                listaPrecio: { select: { id: true, codigo: true, nombre: true } },
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
