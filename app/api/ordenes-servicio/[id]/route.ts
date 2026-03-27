import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

const include = {
    project: {
        select: {
            id: true, nombre: true, codigoProyecto: true, cliente: true, fechaInicio: true, fechaFin: true,
            client: { select: { nombre: true } },
            responsableUser: { select: { nombreCompleto: true } },
        }
    },
    materiales: true,
    operadores: { include: { operador: { select: { id: true, nombreCompleto: true } } } },
    firma: true,
};

// GET /api/ordenes-servicio/[id]  — por id interno o por token público
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const { id } = params;
    try {
        // Try by internal id first, then by linkPublico
        let os = await prisma.ordenServicio.findUnique({ where: { id }, include });
        if (!os) {
            os = await prisma.ordenServicio.findUnique({ where: { linkPublico: id }, include });
        }
        if (!os) return NextResponse.json({ error: 'Orden de servicio no encontrada' }, { status: 404 });
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
                            materialesProyecto: { include: { usos: true, devolucion: true } },
                        }
                    }
                }
            });

            if (!os) throw new Error('Orden de servicio no encontrada');
            if (os.estado === 'firmada') throw new Error('Esta orden ya ha sido firmada');

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
                where: { role: { in: ['supervisor', 'admin'] }, activo: true },
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
                await tx.notification.createMany({
                    data: uniqueRecipients.map(op => ({
                        operatorId: op.id,
                        title: notifTitle,
                        message: notifMsg,
                        type: 'OS_FIRMADA',
                        relatedId: os.id,
                    })),
                });
            }

            // 4. Auto-calculate returns if provisioning is active
            if (proyecto.aprovisionamiento && proyecto.materialesProyecto.length > 0) {
                for (const mat of proyecto.materialesProyecto) {
                    if (!mat.devolucion) {
                        const totalUsado = mat.usos.reduce((acc, u) => acc + u.cantidadUtilizada, 0);
                        const aDevolver = Math.max(0, mat.cantidadEntregada - totalUsado);
                        const esCerrado = mat.cantidadEntregada > 0 && aDevolver === 0;
                        
                        await tx.materialDevolucion.create({
                            data: {
                                materialId: mat.id,
                                cantidadADevolver: aDevolver,
                                estado: esCerrado ? 'cerrado_ok' : 'pendiente',
                            },
                        });
                        
                        await tx.materialProyecto.update({
                            where: { id: mat.id },
                            data: { estado: esCerrado ? 'cerrado_ok' : 'pendiente_devolucion' },
                        });
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
        const { reporte, comentario, materiales, operadores, estado } = body;

        // If it's a structural update and it's signed/billed, prevent it
        if ((reporte || materiales || operadores) && (os.estado === 'firmada' || os.estado === 'cobrada' || os.estado === 'pagada')) {
            return NextResponse.json({ error: 'No se puede modificar el contenido de una orden ya procesada' }, { status: 400 });
        }

        // If only updating status or archiving
        if (estado && !reporte && !materiales && !operadores) {
            const updated = await prisma.ordenServicio.update({
                where: { id },
                data: { estado },
                include
            });
            return NextResponse.json(updated);
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
                            material: m.material, codigo: m.codigo || null, cantidad: parseFloat(m.cantidad), unidadMedida: m.unidadMedida, materialProyectoId: m.materialProyectoId || null
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
