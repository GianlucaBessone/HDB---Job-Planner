import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
                firma: {
                    select: {
                        id: true,
                        nombre: true,
                        dni: true,
                        fechaFirma: true
                        // EXCLUDING firmaImagen intentionally to save payload size (~100KB per OS) and drop TTFB.
                    }
                },
            },
            orderBy: { fechaCreacion: 'desc' },
        });
        
        // Use stale-while-revalidate to cache the heavy DB query and drop API TTFB to 0ms for subsequent requests
        return NextResponse.json(ordenes, {
            headers: {
                'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=30',
            },
        });
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
                        precioUnitario: m.precioUnitario || null,
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
                            estado: 'uso_confirmado',
                            precioVenta: osm.precioUnitario
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

        // 3) Update project total hours
        const totalOSHours = operadores.reduce((acc: number, op: any) => {
            const h = Number(op.horas);
            return acc + (op.isExtra ? Math.ceil(h) * 2 : Math.ceil(h));
        }, 0);

        if (totalOSHours > 0) {
            await prisma.project.update({
                where: { id: projectId },
                data: { horasConsumidas: { increment: totalOSHours } }
            });
        }

        // 4) INTEGRACIÓN QMS: Auto-asignación de Documentos y Checklists
        try {
            // Obtener datos del proyecto para evaluar reglas de aplicabilidad
            const proj = await prisma.project.findUnique({
                where: { id: projectId },
                select: { tipoActividad: true, categoria: true, clientId: true, tags: true }
            });

            if (proj) {
                // Buscar documentos vigentes y sus reglas de aplicabilidad
                const docsVigentes = await prisma.controlledDocument.findMany({
                    where: { estado: 'vigente' },
                    include: {
                        applicabilityRules: true,
                        versions: { where: { estado: 'vigente' }, take: 1 }
                    }
                });

                for (const doc of docsVigentes) {
                    if (doc.versions.length === 0) continue;
                    const versionVigente = doc.versions[0];

                    let aplica = false;
                    let bloqueante = false;
                    let generaChecklist = false;

                    // Evaluar reglas de aplicabilidad
                    for (const rule of doc.applicabilityRules) {
                        const matchTipo = !rule.tipoActividad || rule.tipoActividad === proj.tipoActividad;
                        const matchCategoria = !rule.categoriaProyecto || rule.categoriaProyecto === proj.categoria;
                        const matchCliente = !rule.clienteId || rule.clienteId === proj.clientId;
                        
                        let matchTags = true;
                        if (rule.tagsRequeridos && Array.isArray(rule.tagsRequeridos) && rule.tagsRequeridos.length > 0) {
                            const pTags = (proj.tags as string[]) || [];
                            matchTags = rule.tagsRequeridos.some((t: any) => pTags.includes(t));
                        }

                        if (matchTipo && matchCategoria && matchCliente && matchTags) {
                            aplica = true;
                            if (rule.bloqueanteDeInicio) bloqueante = true;
                            if (rule.generaChecklist) generaChecklist = true;
                            break; // Si una regla aplica, asignamos
                        }
                    }

                    if (aplica) {
                        // Asignar documento a la OS
                        await prisma.ordenServicioDocumento.create({
                            data: {
                                ordenServicioId: os.id,
                                documentId: doc.id,
                                versionId: versionVigente.id,
                                versionSnapshot: `${versionVigente.versionMayor}.${versionVigente.versionMenor}`,
                                requerido: true,
                                bloqueante: bloqueante,
                                leido: false
                            }
                        });

                        // Generar checklist derivado si aplica y tiene template
                        if (generaChecklist && versionVigente.checklistTemplate) {
                            const templateItems = versionVigente.checklistTemplate as any[];
                            if (Array.isArray(templateItems) && templateItems.length > 0) {
                                await prisma.oSChecklist.create({
                                    data: {
                                        ordenServicioId: os.id,
                                        documentVersionId: versionVigente.id,
                                        titulo: `Checklist: ${doc.titulo}`,
                                        estado: 'pendiente',
                                        items: {
                                            create: templateItems.map(item => ({
                                                descripcion: item.descripcion || 'Paso',
                                                esObligatorio: !!item.esObligatorio,
                                                requiereEvidencia: !!item.requiereEvidencia,
                                                completado: false
                                            }))
                                        }
                                    }
                                });
                            }
                        }
                    }
                }
            }
        } catch (qmsError) {
            console.error('QMS Auto-assignment error on OS creation:', qmsError);
            // Non-blocking error
        }

        return NextResponse.json(os);
    } catch (e) {
        console.error('POST ordenes-servicio error:', e);
        return NextResponse.json({ error: 'Error al crear la orden de servicio', details: String(e) }, { status: 500 });
    }
}
