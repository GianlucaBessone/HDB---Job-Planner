import { prisma } from '@/lib/prisma';
import { generateCodigoOS } from '@/lib/codeGenerator';

export async function createOrdenServicio(data: {
    projectId: string;
    reporte: string;
    comentario?: string;
    listaPrecioId?: string | null;
    materiales?: any[];
    operadores: any[];
}) {
    const { projectId, reporte, comentario, listaPrecioId, materiales, operadores } = data;

    // Obtener proyecto para heredar listaPrecioId si no fue enviada explícitamente
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, listaPrecioId: true }
    });

    const effectiveListaPrecioId = listaPrecioId !== undefined ? listaPrecioId : (project?.listaPrecioId || null);

    // Auto-generate unique OS code
    const codigoOS = await generateCodigoOS();

    // 1. Procesamiento y validación consistente de materiales (Secciones 3, 16, 17, 18)
    const rawMaterials = materiales || [];
    const productoIds = rawMaterials
        .map(m => m.productoId)
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);

    // Consulta batch para evitar N+1 queries (Sección 18)
    const dbProductos = productoIds.length > 0
        ? await prisma.producto.findMany({
            where: { id: { in: productoIds } },
            include: {
                proveedores: {
                    orderBy: [{ esPrincipal: 'desc' }, { orden: 'asc' }],
                    take: 1
                }
            }
        })
        : [];

    const productosMap = new Map(dbProductos.map(p => [p.id, p]));

    const processedMateriales = rawMaterials.map(m => {
        const isExplicitManual = m.codigo === '999999' || m.esManual === true;

        if (isExplicitManual) {
            return {
                material: m.material.trim(),
                codigo: '999999',
                skuProveedor: null,
                cantidad: Number(m.cantidad),
                unidadMedida: m.unidadMedida || 'Unidad',
                costoUnitario: m.costoUnitario !== undefined && m.costoUnitario !== null ? Number(m.costoUnitario) : null,
                precioUnitario: m.precioUnitario !== undefined && m.precioUnitario !== null ? Number(m.precioUnitario) : null,
                esManual: true,
                productoId: null,
                materialProyectoId: m.materialProyectoId || null,
            };
        }

        let matchedProduct = m.productoId ? productosMap.get(m.productoId) : null;

        // Si se especificó un productoId, debe existir y estar activo para nuevas OS (Sección 17)
        if (m.productoId && !matchedProduct) {
            throw new Error(`El producto seleccionado (ID: ${m.productoId}) no existe en Gestión Comercial.`);
        }

        if (matchedProduct && !matchedProduct.activo) {
            throw new Error(`El producto con SKU ${matchedProduct.sku} está inactivo en Gestión Comercial.`);
        }

        const primaryProv = matchedProduct?.proveedores?.[0];
        const costoSnapshot = m.costoUnitario !== undefined && m.costoUnitario !== null
            ? Number(m.costoUnitario)
            : (primaryProv?.costo ?? null);

        const precioSnapshot = m.precioUnitario !== undefined && m.precioUnitario !== null
            ? Number(m.precioUnitario)
            : (matchedProduct?.precioBase ?? null);

        const skuProveedorSnapshot = m.skuProveedor || primaryProv?.skuProveedor || null;

        return {
            material: m.material.trim(),
            codigo: m.codigo ? String(m.codigo).trim() : (matchedProduct?.sku || null),
            skuProveedor: skuProveedorSnapshot,
            cantidad: Number(m.cantidad),
            unidadMedida: m.unidadMedida || 'Unidad',
            costoUnitario: costoSnapshot,
            precioUnitario: precioSnapshot,
            esManual: false,
            productoId: matchedProduct?.id || m.productoId || null,
            materialProyectoId: m.materialProyectoId || null,
        };
    });

    const os = await prisma.ordenServicio.create({
        data: {
            projectId,
            codigoOS,
            reporte,
            comentario: comentario || null,
            estado: 'pendiente',
            listaPrecioId: effectiveListaPrecioId,
            materiales: {
                create: processedMateriales,
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
            listaPrecio: { select: { id: true, codigo: true, nombre: true } },
            materiales: {
                include: {
                    producto: {
                        select: { id: true, sku: true, descripcion: true }
                    }
                }
            },
            operadores: { include: { operador: { select: { id: true, nombreCompleto: true } } } },
            firma: true,
        },
    });

    // Update project total hours
    const totalOSHours = operadores.reduce((acc: number, op: any) => {
        const h = Number(op.horas);
        return acc + (op.isExtra ? Math.ceil(h) * 2 : Math.ceil(h));
    }, 0);

    // Update project total hours and automatically set state to 'finalizado'
    const updateData: any = { estado: 'finalizado' };
    
    if (totalOSHours > 0) {
        updateData.horasConsumidas = { increment: totalOSHours };
    }

    await prisma.project.update({
        where: { id: projectId },
        data: updateData
    });

    return os;
}
