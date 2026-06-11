import { prisma } from '@/lib/prisma';
import { generateCodigoOS } from '@/lib/codeGenerator';

export async function createOrdenServicio(data: {
    projectId: string,
    reporte: string,
    comentario?: string,
    materiales?: any[],
    operadores: any[]
}) {
    const { projectId, reporte, comentario, materiales, operadores } = data;

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

    // Update project total hours
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

    return os;
}
