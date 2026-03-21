import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

const include = {
    project: {
        select: {
            id: true, nombre: true, cliente: true, fechaInicio: true, fechaFin: true,
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
            where: { OR: [{ id }, { linkPublico: id }] }
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

            // Create new ones & update reporter
            return await tx.ordenServicio.update({
                where: { id },
                data: {
                    reporte,
                    materiales: {
                        create: materiales.map((m: any) => ({
                            material: m.material, cantidad: parseFloat(m.cantidad), unidadMedida: m.unidadMedida
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
            
            // Delete root
            await tx.ordenServicio.delete({ where: { id } });
        });

        return NextResponse.json({ success: true, message: 'Orden de servicio eliminada' });
    } catch (e) {
        console.error('DELETE OS error:', e);
        return NextResponse.json({ error: 'Error al eliminar la OS', details: String(e) }, { status: 500 });
    }
}
