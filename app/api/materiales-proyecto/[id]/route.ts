import { NextResponse } from 'next/server';
import { prisma } from '@/lib/dataLayer';

// PUT /api/materiales-proyecto/[id] — actualizar material
export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const { id } = params;
    const body = await req.json();
    const { nombre, unidad, codigo, cantidadSolicitada, cantidadDisponible, cantidadEntregada, estado } = body;

    const dataToUpdate: any = {};
    if (nombre !== undefined) dataToUpdate.nombre = nombre;
    if (unidad !== undefined) dataToUpdate.unidad = unidad;
    if (codigo !== undefined) dataToUpdate.codigo = codigo || null;
    if (cantidadSolicitada !== undefined) dataToUpdate.cantidadSolicitada = parseFloat(cantidadSolicitada);
    if (cantidadDisponible !== undefined) dataToUpdate.cantidadDisponible = parseFloat(cantidadDisponible);
    if (cantidadEntregada !== undefined) dataToUpdate.cantidadEntregada = parseFloat(cantidadEntregada);
    if (estado !== undefined) dataToUpdate.estado = estado;

    let material = await prisma.materialProyecto.update({
        where: { id },
        data: dataToUpdate,
        include: { usos: true, devolucion: true },
    });

    // Actualizar MaterialMaestro si se usó un código en la actualización
    if (material.codigo && (nombre || unidad)) {
        await prisma.materialMaestro.upsert({
            where: { codigo: material.codigo },
            update: { 
                nombre: nombre || material.nombre, 
                unidad: unidad || material.unidad 
            },
            create: { 
                codigo: material.codigo, 
                nombre: nombre || material.nombre, 
                unidad: unidad || material.unidad 
            },
        });
    }

    // Auto-calculate implicit states unless we explicitly set a closed state
    if (!['cerrado_ok', 'cerrado_con_reserva'].includes(material.estado)) {
        const totalUsado = material.usos.reduce((a, u) => a + u.cantidadUtilizada, 0);
        let nuevoEstado = material.estado;

        if (material.cantidadEntregada > 0 && totalUsado === material.cantidadEntregada) {
            nuevoEstado = 'cerrado_ok'; // Auto-confirm
        } else if (material.cantidadEntregada > 0 && material.cantidadEntregada < material.cantidadSolicitada) {
            nuevoEstado = 'material_entregado'; 
        } else if (material.cantidadEntregada > 0 && material.cantidadEntregada === material.cantidadSolicitada) {
            nuevoEstado = 'material_entregado';
        } else if (material.cantidadDisponible > 0) {
            nuevoEstado = 'material_cargado';
        }

        // If the state needs implicitly changing, save it
        if (nuevoEstado !== material.estado) {
            material = await prisma.materialProyecto.update({
                where: { id },
                data: { estado: nuevoEstado },
                include: { usos: true, devolucion: true }
            });
        }
    }

    return NextResponse.json(material);
}

// DELETE /api/materiales-proyecto/[id]
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
    const { id } = params;

    // Check if any OS using this material is billed
    const usesWithBilledOS = await prisma.ordenServicioMaterial.findFirst({
        where: {
            materialProyectoId: id,
            ordenServicio: {
                estado: { in: ['cobrada', 'pagada'] }
            }
        }
    });

    if (usesWithBilledOS) {
        return NextResponse.json({ error: 'No se puede borrar un material que ya está incluido en un cobro emitido.' }, { status: 400 });
    }

    try {
        await prisma.materialProyecto.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Error al eliminar el material' }, { status: 500 });
    }
}
