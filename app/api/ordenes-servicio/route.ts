import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';
import { generateCodigoOS } from '@/lib/codeGenerator';

// GET /api/ordenes-servicio  — listado para admin/supervisor
// GET /api/ordenes-servicio?projectId=xxx  — OS de un proyecto
export async function GET(req: Request) {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');

    try {
        const ordenes = await prisma.ordenServicio.findMany({
            where: projectId ? { projectId } : undefined,
            include: {
                project: { select: { id: true, nombre: true, codigoProyecto: true, client: { select: { nombre: true } }, cliente: true } },
                materiales: true,
                operadores: { include: { operador: { select: { id: true, nombreCompleto: true } } } },
                firma: true,
            },
            orderBy: { fechaCreacion: 'desc' },
        });
        return NextResponse.json(ordenes);
    } catch (e) {
        console.error('GET ordenes-servicio error:', e);
        return NextResponse.json({ error: 'Error al obtener órdenes de servicio', details: String(e) }, { status: 500 });
    }
}

// POST /api/ordenes-servicio — crear nueva OS
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { projectId, reporte, materiales, operadores, comentario } = body;

        if (!projectId || !reporte) {
            return NextResponse.json({ error: 'projectId y reporte son obligatorios' }, { status: 400 });
        }
        if (!operadores || operadores.length === 0) {
            return NextResponse.json({ error: 'Debe haber al menos un operador con horas' }, { status: 400 });
        }
        for (const op of operadores) {
            if (!op.operadorId || !op.horas || op.horas <= 0) {
                return NextResponse.json({ error: 'Todos los operadores deben tener horas > 0' }, { status: 400 });
            }
        }
        if (materiales && materiales.length > 0) {
            for (const m of materiales) {
                if (!m.material || !m.cantidad || !m.unidadMedida) {
                    return NextResponse.json({ error: 'Todos los campos de materiales son obligatorios' }, { status: 400 });
                }
            }
        }

        // Auto-generate unique OS code
        const codigoOS = await generateCodigoOS();

        const os = await prisma.ordenServicio.create({
            data: {
                projectId,
                codigoOS,
                reporte,
                comentario: comentario || null,
                estado: 'pendiente',
                materiales: {
                    create: (materiales || []).map((m: any) => ({
                        material: m.material,
                        codigo: m.codigo || null,
                        cantidad: Number(m.cantidad),
                        unidadMedida: m.unidadMedida,
                        materialProyectoId: m.materialProyectoId || null,
                    })),
                },
                operadores: {
                    create: operadores.map((op: any) => ({
                        operadorId: op.operadorId,
                        horas: Number(op.horas),
                        isExtra: !!op.isExtra,
                    })),
                },
            },
            include: {
                project: { select: { nombre: true, codigoProyecto: true, client: { select: { nombre: true } }, cliente: true } },
                materiales: true,
                operadores: { include: { operador: { select: { id: true, nombreCompleto: true } } } },
                firma: true,
            },
        });

        // 2) Synchronize materials with the dynamic provisioning system
        const materialsToSync = os.materiales || [];
        if (materialsToSync.length > 0) {
            const firstOp = await prisma.operator.findUnique({ where: { id: operadores[0].operadorId } });
            const opName = firstOp ? firstOp.nombreCompleto : 'Desconocido';

            for (const osm of materialsToSync) {
                let finalMatId = osm.materialProyectoId;
                const cant = Number(osm.cantidad);

                // If this material was NOT linked to a previous provision, create one automatically
                if (!finalMatId) {
                    const newMatProv = await prisma.materialProyecto.create({
                        data: {
                            proyectoId: projectId,
                            nombre: osm.material,
                            codigo: osm.codigo,
                            unidad: osm.unidadMedida,
                            cantidadSolicitada: cant,
                            cantidadDisponible: cant,
                            cantidadEntregada: cant,
                            estado: 'uso_confirmado'
                        }
                    });
                    finalMatId = newMatProv.id;
                    
                    // Link OS material to the new provision record
                    await prisma.ordenServicioMaterial.update({
                        where: { id: osm.id },
                        data: { materialProyectoId: finalMatId }
                    });
                } else {
                    // Update existing MaterialProyecto state
                    await prisma.materialProyecto.update({
                        where: { id: finalMatId },
                        data: { estado: 'uso_confirmado' }
                    });
                }

                // Create usage record
                if (cant > 0) {
                    await prisma.materialUso.create({
                        data: {
                            cantidadUtilizada: cant,
                            operadorNombre: opName,
                            materialId: finalMatId,
                            ordenServicioId: os.id
                        }
                    });
                }
            }
        }

        return NextResponse.json(os);
    } catch (e) {
        console.error('POST ordenes-servicio error:', e);
        return NextResponse.json({ error: 'Error al crear la orden de servicio', details: String(e) }, { status: 500 });
    }
}
