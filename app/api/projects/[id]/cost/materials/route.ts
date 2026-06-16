import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeCode(code: string | null | undefined): string {
    if (!code) return '';
    return code.replace(/^0+/, '').toLowerCase().trim();
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id } = params; // Project ID
        const body = await req.json();
        const { codigo, id: materialId, nombre, precioUnitario } = body;

        if (typeof precioUnitario !== 'number') {
            return NextResponse.json({ error: 'Precio unitario inválido' }, { status: 400 });
        }

        if (codigo) {
            const norm = normalizeCode(codigo);

            // Actualizamos todos los registros de MaterialProyecto de este proyecto que tengan códigos que coincidan al normalizar
            const allProjectMaterials = await prisma.materialProyecto.findMany({
                where: { 
                    proyectoId: id,
                    codigo: { not: null }
                }
            });
            const matchingProjectIds = allProjectMaterials
                .filter(m => normalizeCode(m.codigo) === norm)
                .map(m => m.id);

            if (matchingProjectIds.length > 0) {
                await prisma.materialProyecto.updateMany({
                    where: { id: { in: matchingProjectIds } },
                    data: {
                        precioVenta: precioUnitario
                    }
                });
            }

            // Actualizar en el Maestro de Materiales para uso futuro (todos los códigos equivalentes)
            const allMaestros = await prisma.materialMaestro.findMany();
            const matchingMaestroCodes = allMaestros
                .filter(m => normalizeCode(m.codigo) === norm)
                .map(m => m.codigo);

            if (matchingMaestroCodes.length > 0) {
                await prisma.materialMaestro.updateMany({
                    where: { codigo: { in: matchingMaestroCodes } },
                    data: { precioVenta: precioUnitario }
                });
            }
        } else if (materialId) {
            // Buscamos el material por su ID para obtener su nombre y actualizar todos los del mismo nombre sin código en este proyecto
            const mat = await prisma.materialProyecto.findUnique({
                where: { id: materialId }
            });

            if (mat) {
                await prisma.materialProyecto.updateMany({
                    where: {
                        proyectoId: id,
                        nombre: mat.nombre,
                        codigo: null
                    },
                    data: {
                        precioVenta: precioUnitario
                    }
                });
            }
        } else if (nombre) {
            await prisma.materialProyecto.updateMany({
                where: {
                    proyectoId: id,
                    nombre: nombre,
                    codigo: null
                },
                data: {
                    precioVenta: precioUnitario
                }
            });
        } else {
            return NextResponse.json({ error: 'Falta identificación del material (código, id o nombre)' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Error updating material price:', e);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

