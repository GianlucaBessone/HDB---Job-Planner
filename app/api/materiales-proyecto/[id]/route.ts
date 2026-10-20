import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolverPrecioProducto } from '@/lib/ventas/priceRules';

// PUT /api/materiales-proyecto/[id] — actualizar material
export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const { id } = params;
    const body = await req.json();
    const { nombre, unidad, codigo, cantidadSolicitada, cantidadDisponible, cantidadEntregada, estado, precioVenta } = body;

    const dataToUpdate: any = {};
    if (nombre !== undefined) dataToUpdate.nombre = nombre;
    if (unidad !== undefined) dataToUpdate.unidad = unidad;
    if (codigo !== undefined) dataToUpdate.codigo = codigo || null;
    if (cantidadSolicitada !== undefined) dataToUpdate.cantidadSolicitada = parseFloat(cantidadSolicitada);
    if (cantidadDisponible !== undefined) dataToUpdate.cantidadDisponible = parseFloat(cantidadDisponible);
    if (cantidadEntregada !== undefined) dataToUpdate.cantidadEntregada = parseFloat(cantidadEntregada);
    if (estado !== undefined) dataToUpdate.estado = estado;
    if (precioVenta !== undefined) dataToUpdate.precioVenta = precioVenta ? parseFloat(precioVenta) : null;

    // Si el código cambió y no se envió un precio explícito, auto-resolver desde Gestión Comercial
    if (codigo && precioVenta === undefined) {
        try {
            const current = await prisma.materialProyecto.findUnique({
                where: { id },
                select: { codigo: true, proyectoId: true, precioVenta: true }
            });
            if (current && (current.codigo !== codigo || current.precioVenta === null)) {
                const trimmedCode = String(codigo).trim();
                const upperCode = trimmedCode.toUpperCase();
                const unpadded = trimmedCode.replace(/^0+/, '') || '0';
                const padded5 = unpadded.padStart(5, '0');

                const prod = await prisma.producto.findFirst({
                    where: {
                        activo: true,
                        OR: [
                            { sku: upperCode },
                            { sku: padded5 },
                            { sku: unpadded },
                            { codigoBarras: trimmedCode }
                        ]
                    },
                    include: {
                        iva: { select: { porcentaje: true } },
                        proveedores: { where: { esPrincipal: true }, take: 1, select: { costo: true } }
                    }
                });

                if (prod) {
                    let lp: any = null;
                    const prj = await prisma.project.findUnique({
                        where: { id: current.proyectoId },
                        select: { listaPrecio: true, client: { select: { listaPrecioId: true } } }
                    });
                    if (prj?.listaPrecio) lp = prj.listaPrecio;
                    else if (prj?.client?.listaPrecioId) {
                        lp = await prisma.listaPrecio.findUnique({ where: { id: prj.client.listaPrecioId, activo: true } });
                    }
                    if (!lp) {
                        lp = await prisma.listaPrecio.findFirst({ where: { esPredeterminada: true, activo: true } });
                    }
                    const costo = prod.proveedores[0]?.costo ? Number(prod.proveedores[0].costo) : 0;
                    const calculated = resolverPrecioProducto({
                        precioBase: prod.precioBase,
                        costo,
                        rentabilidad: prod.rentabilidad,
                        familiaId: prod.familiaId,
                        marcaId: prod.marcaId,
                        ivaPorcentaje: prod.iva?.porcentaje ?? 21,
                    }, lp);
                    dataToUpdate.precioVenta = calculated.precio;
                }
            }
        } catch (e) {
            console.error('Error auto-resolving price on PUT:', e);
        }
    }

    let material = await prisma.materialProyecto.update({
        where: { id },
        data: dataToUpdate,
        include: { usos: true, devoluciones: true },
    });

    // Actualizar MaterialMaestro si se usó un código en la actualización (en try/catch retrocompatible)
    if (material.codigo && (nombre || unidad)) {
        try {
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
        } catch (e) {
            console.warn('Fallback legacy MaterialMaestro update ignored:', e);
        }
    }

    // Auto-calculate implicit states unless we explicitly set a closed state
    if (!['cerrado_ok', 'cerrado_con_reserva'].includes(material.estado)) {
        const totalUsado = material.usos.reduce((a, u) => a + u.cantidadUtilizada, 0);
        let nuevoEstado = material.estado;

        if (material.cantidadEntregada > 0) {
            // Si ya se usó todo lo que se entregó, marcar como completo
            if (totalUsado > 0 && totalUsado >= material.cantidadEntregada) {
                nuevoEstado = 'cerrado_ok';
            } else {
                nuevoEstado = 'material_entregado';
            }
        } else if (material.cantidadDisponible > 0 || material.cantidadSolicitada > 0) {
            nuevoEstado = 'material_cargado';
        }

        // If the state needs implicitly changing, save it
        if (nuevoEstado !== material.estado) {
            material = await prisma.materialProyecto.update({
                where: { id },
                data: { estado: nuevoEstado },
                include: { usos: true, devoluciones: true }
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
