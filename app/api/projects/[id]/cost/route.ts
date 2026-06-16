import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id } = params;

        // Fetch project
        const project = await prisma.project.findUnique({
            where: { id },
        });

        if (!project) {
            return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
        }

        // Fetch hourly rate
        const settings = await prisma.systemSetting.findUnique({
            where: { id: 'default' }
        });
        const valorManoObra = settings?.valorManoObra || 0;

        // Fetch time entries
        const timeEntries = await prisma.timeEntry.findMany({
            where: { projectId: id },
            include: {
                operator: true
            }
        });

        const operatorHoursMap = new Map<string, { name: string; hours: number }>();
        let totalHours = 0;

        for (const entry of timeEntries) {
            const opId = entry.operatorId;
            const opName = entry.operator?.nombreCompleto || 'Desconocido';
            const hours = entry.horasTrabajadas || 0;

            if (!operatorHoursMap.has(opId)) {
                operatorHoursMap.set(opId, { name: opName, hours: 0 });
            }
            operatorHoursMap.get(opId)!.hours += hours;
            totalHours += hours;
        }

        const operators = Array.from(operatorHoursMap.values()).map(o => ({
            name: o.name,
            hours: o.hours,
            cost: o.hours * valorManoObra
        }));

        const totalHoursCost = totalHours * valorManoObra;

        // Fetch materials
        const materialesProyecto = await prisma.materialProyecto.findMany({
            where: { proyectoId: id },
            include: {
                usos: true
            }
        });

        const materialMap = new Map<string, { id: string, name: string, codigo: string | null, unidad: string, cantidad: number, precioUnitario: number }>();

        for (const m of materialesProyecto) {
            const cantidadUsada = m.usos && m.usos.length > 0 
                ? m.usos.reduce((acc, uso) => acc + uso.cantidadUtilizada, 0)
                : m.cantidadEntregada;

            const key = m.codigo || m.nombre;
            if (!materialMap.has(key)) {
                materialMap.set(key, {
                    id: m.codigo || m.id,
                    name: m.nombre,
                    codigo: m.codigo,
                    unidad: m.unidad,
                    cantidad: 0,
                    precioUnitario: m.precioVenta || 0
                });
            }
            materialMap.get(key)!.cantidad += cantidadUsada;
        }

        let totalMaterialsCost = 0;
        const materials = Array.from(materialMap.values())
            .filter(m => m.cantidad > 0)
            .map(m => {
                const costo = m.cantidad * m.precioUnitario;
                totalMaterialsCost += costo;
                return {
                    ...m,
                    costo
                };
            });

        const totalCost = totalHoursCost + totalMaterialsCost;

        return NextResponse.json({
            project: {
                id: project.id,
                nombre: project.nombre,
                codigoProyecto: project.codigoProyecto
            },
            operators,
            materials,
            summary: {
                totalHours,
                valorManoObra,
                totalHoursCost,
                totalMaterialsCost,
                totalCost
            }
        });
    } catch (e) {
        console.error('Error fetching project cost:', e);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
