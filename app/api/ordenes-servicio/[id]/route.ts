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

        // Find OS by linkPublico or id
        const os = await prisma.ordenServicio.findFirst({
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
        if (!os) return NextResponse.json({ error: 'Orden de servicio no encontrada' }, { status: 404 });
        if (os.estado === 'firmada') {
            return NextResponse.json({ error: 'Esta orden ya ha sido firmada' }, { status: 400 });
        }

        const [firma] = await prisma.$transaction([
            prisma.ordenServicioFirma.create({
                data: { ordenServicioId: os.id, nombre, dni, firmaImagen }
            }),
            prisma.ordenServicio.update({
                where: { id: os.id },
                data: { estado: 'firmada' }
            })
        ]);

        // ── Notificaciones post-firma ──────────────────────────────────────────
        const proyecto = os.project;
        const osCode = os.codigoOS ? `${os.codigoOS} | ` : '';
        const prCode = proyecto.codigoProyecto ? `${proyecto.codigoProyecto} | ` : '';
        const notifTitle = `Orden firmada – ${osCode}${prCode}${proyecto.nombre}`;
        const notifMsg = `La OS fue firmada por ${nombre} (DNI: ${dni}).`;

        // Always notify supervisors + admins
        const supervisorsAdmins = await prisma.operator.findMany({
            where: { role: { in: ['supervisor', 'admin'] }, activo: true },
            select: { id: true },
        });
        // If project has aprovisionamiento, also notify vendedores
        const vendedores = proyecto.aprovisionamiento
            ? await prisma.operator.findMany({
                where: { role: 'vendedor', activo: true },
                select: { id: true },
            })
            : [];

        const notifRecipients = [...supervisorsAdmins, ...vendedores];
        if (notifRecipients.length > 0) {
            await prisma.notification.createMany({
                data: notifRecipients.map(op => ({
                    operatorId: op.id,
                    title: notifTitle,
                    message: notifMsg,
                    type: 'OS_FIRMADA',
                    relatedId: os.id,
                })),
            });
        }

        // ── Auto-calcular devolución si hay aprovisionamiento ──────────────────
        if (proyecto.aprovisionamiento && proyecto.materialesProyecto.length > 0) {
            for (const mat of proyecto.materialesProyecto) {
                // Sum all usos for this material across any OS generated for the project
                const totalUsado = mat.usos.reduce((acc, u) => acc + u.cantidadUtilizada, 0);
                const aDevolver = Math.max(0, mat.cantidadEntregada - totalUsado);

                if (!mat.devolucion) {
                    await prisma.materialDevolucion.create({
                        data: {
                            materialId: mat.id,
                            cantidadADevolver: aDevolver,
                            estado: 'pendiente',
                        },
                    });
                    await prisma.materialProyecto.update({
                        where: { id: mat.id },
                        data: { estado: 'pendiente_devolucion' },
                    });
                }
            }
        }

        return NextResponse.json({ success: true, firma });
    } catch (e) {
        console.error('POST firma error:', e);
        return NextResponse.json({ error: 'Error al registrar la firma', details: String(e) }, { status: 500 });
    }
}


// PUT /api/ordenes-servicio/[id] — Actualizar OS existente (si no está firmada)
export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const { id } = params;
    try {
        const os = await prisma.ordenServicio.findUnique({ where: { id } });
        if (!os) return NextResponse.json({ error: 'Orden de servicio no encontrada' }, { status: 404 });
        if (os.estado === 'firmada') return NextResponse.json({ error: 'No se puede modificar una orden ya firmada' }, { status: 400 });

        const body = await req.json();
        const { reporte, materiales, operadores } = body;

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
                    materiales: {
                        create: materiales.map((m: any) => ({
                            material: m.material, cantidad: parseFloat(m.cantidad), unidadMedida: m.unidadMedida, materialProyectoId: m.materialProyectoId || null
                        }))
                    },
                    operadores: {
                        create: operadores.map((op: any) => ({
                            operadorId: op.operadorId, horas: parseFloat(op.horas)
                        }))
                    }
                },
                include
            });
        });

        // Recrear usos de material
        const aprovisionados = (materiales || []).filter((m: any) => m.materialProyectoId && Number(m.cantidad) > 0);
        if (aprovisionados.length > 0) {
            const firstOp = await prisma.operator.findUnique({ where: { id: operadores[0].operadorId } });
            const opName = firstOp ? firstOp.nombreCompleto : 'Desconocido';

            for (const m of aprovisionados) {
                await prisma.materialUso.create({
                    data: {
                        cantidadUtilizada: Number(m.cantidad),
                        operadorNombre: opName,
                        materialId: m.materialProyectoId,
                        ordenServicioId: id
                    }
                });
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
