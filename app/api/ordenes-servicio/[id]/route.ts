import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const include = {
    project: {
        include: {
            client: { select: { nombre: true } },
            responsableUser: { select: { nombreCompleto: true } },
            documentChecklists: {
                orderBy: { order: 'asc' as const }
            }
        }
    },
    materiales: true,
    operadores: { include: { operador: { select: { id: true, nombreCompleto: true } } } },
    firma: true,
    documentosRequeridos: {
        include: {
            document: { select: { codigoDocumental: true, titulo: true, tipoDocumento: true, requiereConfirmacionLectura: true } },
            version: { select: { id: true, versionLabel: true, files: { select: { url: true, tipoArchivo: true } } } },
            acknowledgements: true
        }
    },
    checklists: {
        include: {
            items: { include: { evidencias: true } }
        }
    }
};

// GET /api/ordenes-servicio/[id]  — por id interno o por token público
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const { id } = params;
    try {
        // Try by internal id first, then by linkPublico
        let os = await prisma.ordenServicio.findUnique({ where: { id }, include });
        let isPublic = false;
        if (!os) {
            os = await prisma.ordenServicio.findUnique({ where: { linkPublico: id }, include });
            isPublic = true;
        }
        if (!os) return NextResponse.json({ error: 'Orden de servicio no encontrada' }, { status: 404 });
        
        // Security: Remove internal note for public client-facing links
        if (isPublic) {
            (os as any).notaInterna = null;
        }

        return NextResponse.json(os);
    } catch (e) {
        console.error('GET OS by id error:', e);
        return NextResponse.json({ error: 'Error al obtener la orden de servicio', details: String(e) }, { status: 500 });
    }
}

// POST /api/ordenes-servicio/[id]/firma — registrar firma del cliente
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const { id } = params;
    try {
        const body = await req.json();
        const { nombre, dni, firmaImagen } = body;

        if (!nombre || !dni || !firmaImagen) {
            return NextResponse.json({ error: 'Nombre, DNI y firma son requeridos' }, { status: 400 });
        }

        // Use a single transaction for everything to avoid orphaned records or inconsistent states
        const result = await prisma.$transaction(async (tx) => {
            // Find OS within the transaction to ensure state hasn't changed
            const os = await tx.ordenServicio.findFirst({
                where: { OR: [{ id }, { linkPublico: id }] },
                include: {
                    project: {
                        select: {
                            id: true, nombre: true, codigoProyecto: true, aprovisionamiento: true,
                            materialesProyecto: { include: { usos: true, devoluciones: true } },
                        }
                    }
                }
            });

            if (!os) throw new Error('Orden de servicio no encontrada');
            if (os.estado === 'firmada') throw new Error('Esta orden ya ha sido firmada');

            // --- VALIDACIÓN QMS (Bloqueos operativos) ---
            const osDocs = await tx.ordenServicioDocumento.findMany({
                where: { ordenServicioId: os.id }
            });
            const unreadBlocking = osDocs.filter(d => d.bloqueante && !d.leido);
            if (unreadBlocking.length > 0) {
                throw new Error('No se puede firmar: Existen documentos críticos pendientes de lectura.');
            }

            // Validar que los operadores asignados tengan las capacitaciones obligatorias aprobadas
            const osOperators = await tx.ordenServicioOperador.findMany({
                where: { ordenServicioId: os.id },
                include: { operador: true }
            });

            const documentIds = osDocs.map(d => d.documentId).filter(Boolean) as string[];
            if (documentIds.length > 0) {
                const { validateTechnicianEligibility } = await import('../../qms/compliance-engine');
                for (const op of osOperators) {
                    const eligibility = await validateTechnicianEligibility(op.operadorId, documentIds);
                    if (eligibility.eligible === 'no_apto') {
                        throw new Error(`No se puede firmar/cerrar la OS: El técnico "${op.operador?.nombreCompleto || 'asignado'}" no cumple con la capacitación QMS obligatoria o certificaciones vigentes: ${eligibility.reasons.join(', ')}`);
                    }
                }
            }

            // --- VALIDACIÓN DE DOCUMENTCHECKLIST SNAPSHOTS (QMS) ---
            const docChecklists = await tx.documentChecklist.findMany({
                where: { projectId: os.projectId }
            });
            for (const chk of docChecklists) {
                const snapshot: any = chk.snapshotData;
                const items = Array.isArray(snapshot?.items) ? snapshot.items : (Array.isArray(snapshot) ? snapshot : []);
                
                const reqEvidence = !!snapshot?.requiresEvidence;
                const reqPhotos = !!snapshot?.requiresPhotos;
                const reqSignature = !!snapshot?.requiresSignature;

                for (const item of items) {
                    if (item.esObligatorio && !item.completado) {
                        throw new Error(`No se puede firmar: El checklist "${chk.templateName}" tiene pasos obligatorios incompletos.`);
                    }
                    if (item.completado) {
                        if (reqEvidence && !item.observacion?.trim()) {
                            throw new Error(`No se puede firmar: El paso "${item.descripcion}" del checklist "${chk.templateName}" requiere evidencia descriptiva.`);
                        }
                        if (reqPhotos && !item.foto) {
                            throw new Error(`No se puede firmar: El paso "${item.descripcion}" del checklist "${chk.templateName}" requiere fotografía.`);
                        }
                        if (reqSignature && !item.firma) {
                            throw new Error(`No se puede firmar: El paso "${item.descripcion}" del checklist "${chk.templateName}" requiere firma de conformidad.`);
                        }
                    }
                }
            }
            // --------------------------------------------

            // 1. Register signature (upsert to handle orphaned records in dev environments)
            const firma = await tx.ordenServicioFirma.upsert({
                where: { ordenServicioId: os.id },
                create: { ordenServicioId: os.id, nombre, dni, firmaImagen },
                update: { nombre, dni, firmaImagen, fechaFirma: new Date() }
            });

            // 2. Update OS status
            await tx.ordenServicio.update({
                where: { id: os.id },
                data: { estado: 'firmada' }
            });

            // 3. Create internal notifications
            const proyecto = os.project;
            const osCode = os.codigoOS ? `${os.codigoOS} | ` : '';
            const prCode = proyecto.codigoProyecto ? `${proyecto.codigoProyecto} | ` : '';
            const notifTitle = `Orden firmada – ${osCode}${prCode}${proyecto.nombre}`;
            const notifMsg = `La OS fue firmada por ${nombre} (DNI: ${dni}).`;

            const supervisorsAdmins = await tx.operator.findMany({
                where: { role: { in: ['supervisor', 'admin', 'qa'] }, activo: true },
                select: { id: true },
            });
            
            const vendedores = proyecto.aprovisionamiento
                ? await tx.operator.findMany({
                    where: { role: 'vendedor', activo: true },
                    select: { id: true },
                })
                : [];

            const allRecipients = [...supervisorsAdmins, ...vendedores];
            
            // Filter unique IDs to avoid duplicate notifications if a user has multiple overlaps
            const uniqueRecipientsMap = new Map();
            allRecipients.forEach(op => uniqueRecipientsMap.set(op.id, op));
            const uniqueRecipients = Array.from(uniqueRecipientsMap.values());

            if (uniqueRecipients.length > 0) {
                const activity = await tx.activity.create({
                    data: {
                        type: 'OS_FIRMADA',
                        priority: 'HIGH',
                        category: 'Nota',
                        title: notifTitle,
                        message: notifMsg,
                        entityType: 'orden_servicio',
                        entityId: os.id,
                        metadata: { url: `/ordenes-servicio/ver/${os.id}` },
                    },
                });

                await tx.activityRecipient.createMany({
                    data: uniqueRecipients.map(op => ({
                        activityId: activity.id,
                        operatorId: op.id,
                    })),
                });
            }

            // 4. Auto-calculate returns if provisioning is active
            if (proyecto.aprovisionamiento && proyecto.materialesProyecto.length > 0) {
                for (const mat of proyecto.materialesProyecto) {
                    const hasPending = mat.devoluciones.some(d => d.estado === 'pendiente');
                    const isClosed = ['cerrado_ok', 'cerrado_con_reserva'].includes(mat.estado);

                    if (!hasPending && !isClosed) {
                        const totalUsado = mat.usos.reduce((acc, u) => acc + u.cantidadUtilizada, 0);
                        const totalDevuelto = mat.devoluciones.filter(d => d.estado !== 'pendiente').reduce((acc, d) => acc + d.cantidadADevolver, 0);
                        const aDevolver = Math.max(0, mat.cantidadEntregada - totalUsado - totalDevuelto);
                        
                        const esCerrado = mat.cantidadEntregada > 0 && aDevolver === 0;
                        
                        if (aDevolver > 0) {
                            await tx.materialDevolucion.create({
                                data: {
                                    materialId: mat.id,
                                    cantidadADevolver: aDevolver,
                                    estado: 'pendiente',
                                },
                            });
                            
                            await tx.materialProyecto.update({
                                where: { id: mat.id },
                                data: { estado: 'pendiente_devolucion' },
                            });
                        } else if (esCerrado) {
                            await tx.materialProyecto.update({
                                where: { id: mat.id },
                                data: { estado: 'cerrado_ok' },
                            });
                        }
                    }
                }
            }

            return firma;
        });

        return NextResponse.json({ success: true, firma: result });
    } catch (e: any) {
        console.error('POST firma error:', e);
        // Provide more detailed error if it's a known error
        const detail = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ 
            error: 'Error al registrar la firma', 
            details: detail,
            prismaError: e.code || undefined 
        }, { status: 500 });
    }
}


// PUT /api/ordenes-servicio/[id] — Actualizar OS existente (si no está firmada)
export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const { id } = params;
    try {
        const os = await prisma.ordenServicio.findUnique({ where: { id } });
        if (!os) return NextResponse.json({ error: 'Orden de servicio no encontrada' }, { status: 404 });

        const body = await req.json();
        const { reporte, comentario, materiales, operadores, estado, notaInterna } = body;

        // If it's a structural update and it's signed/billed, prevent it
        if ((reporte || materiales || operadores) && (os.estado === 'firmada' || os.estado === 'cobrada' || os.estado === 'pagada')) {
            return NextResponse.json({ error: 'No se puede modificar el contenido de una orden ya procesada' }, { status: 400 });
        }

        // If only updating non-structural fields (estado, notaInterna)
        if (!reporte && !materiales && !operadores) {
            const updateData: any = {};
            if (estado !== undefined) updateData.estado = estado;
            if (notaInterna !== undefined) updateData.notaInterna = notaInterna;

            if (Object.keys(updateData).length > 0) {
                const updated = await prisma.ordenServicio.update({
                    where: { id },
                    data: updateData,
                    include
                });
                return NextResponse.json(updated);
            }
        }

        // Transaction to delete relationships and recreate + update root
        const updatedOs = await prisma.$transaction(async (tx: any) => {
            // Drop old relations
            await tx.ordenServicioMaterial.deleteMany({ where: { ordenServicioId: id } });
            await tx.ordenServicioOperador.deleteMany({ where: { ordenServicioId: id } });
            await tx.materialUso.deleteMany({ where: { ordenServicioId: id } });

            // Create new ones & update reporter
            return await tx.ordenServicio.update({
                where: { id },
                data: {
                    reporte,
                    comentario: comentario || null,
                    materiales: {
                        create: materiales.map((m: any) => ({
                            material: m.material, 
                            codigo: m.codigo || null, 
                            cantidad: parseFloat(m.cantidad), 
                            unidadMedida: m.unidadMedida, 
                            materialProyectoId: m.materialProyectoId || null,
                            precioUnitario: m.precioUnitario || null
                        }))
                    },
                    operadores: {
                        create: operadores.map((op: any) => ({
                            operadorId: op.operadorId, horas: parseFloat(op.horas), isExtra: !!op.isExtra
                        }))
                    }
                },
                include
            });
        });

        // 2) Re-synchronize materials with the dynamic provisioning system
        const materialsToSync = updatedOs.materiales || [];
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
                            proyectoId: updatedOs.projectId,
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
                            ordenServicioId: id
                        }
                    });
                }
            }
        }

        return NextResponse.json(updatedOs);

    } catch (e) {
        console.error('PUT OS update error:', e);
        return NextResponse.json({ error: 'Error al actualizar la OS', details: String(e) }, { status: 500 });
    }
}

// DELETE /api/ordenes-servicio/[id] — Eliminar OS
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const { id } = params;
    try {
        const os = await prisma.ordenServicio.findUnique({ where: { id } });
        if (!os) return NextResponse.json({ error: 'Orden de servicio no encontrada' }, { status: 404 });

        await prisma.$transaction(async (tx: any) => {
            // Drop old relations
            await tx.ordenServicioMaterial.deleteMany({ where: { ordenServicioId: id } });
            await tx.ordenServicioOperador.deleteMany({ where: { ordenServicioId: id } });
            await tx.ordenServicioFirma.deleteMany({ where: { ordenServicioId: id } });
            await tx.materialUso.deleteMany({ where: { ordenServicioId: id } });
            
            // Delete root
            await tx.ordenServicio.delete({ where: { id } });
        });

        return NextResponse.json({ success: true, message: 'Orden de servicio eliminada' });
    } catch (e) {
        console.error('DELETE OS error:', e);
        return NextResponse.json({ error: 'Error al eliminar la OS', details: String(e) }, { status: 500 });
    }
}
