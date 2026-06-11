import { prisma } from '@/lib/prisma';

export async function syncInventoryForOS(os: any, materiales: any[], operadores: any[]) {
    if (!materiales || materiales.length === 0) return;

    const firstOp = await prisma.operator.findUnique({ where: { id: operadores[0].operadorId } });
    const opName = firstOp ? firstOp.nombreCompleto : 'Desconocido';

    for (const osm of os.materiales) {
        let finalMatId = osm.materialProyectoId;
        const cant = Number(osm.cantidad);

        // If this material was NOT linked to a previous provision, create one automatically
        if (!finalMatId) {
            const newMatProv = await prisma.materialProyecto.create({
                data: {
                    proyectoId: os.projectId,
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
