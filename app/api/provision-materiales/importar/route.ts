import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolverPrecioProducto } from '@/lib/ventas/priceRules';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { sheets, mode = 'reemplazar' } = body;

        if (!sheets || !Array.isArray(sheets)) {
            return NextResponse.json({ error: 'Estructura de datos inválida' }, { status: 400 });
        }

        const results = [];

        // Lista de precios por defecto del sistema
        const defaultListaPrecio = await prisma.listaPrecio.findFirst({
            where: { esPredeterminada: true, activo: true }
        });

        for (const sheet of sheets) {
            const { codigoProyecto, rows } = sheet;
            if (!codigoProyecto || !Array.isArray(rows)) continue;

            const project = await prisma.project.findUnique({
                where: { codigoProyecto },
                include: {
                    materialesProyecto: true,
                    listaPrecio: true,
                    client: { select: { listaPrecioId: true } }
                }
            });

            if (!project) {
                results.push({
                    sheetName: codigoProyecto,
                    success: false,
                    ignored: true,
                    processedRows: 0,
                    ignoredRows: rows.length,
                    message: 'Proyecto no encontrado'
                });
                continue;
            }

            // Resolver lista de precios para este proyecto
            let effectiveListaPrecio = project.listaPrecio;
            if (!effectiveListaPrecio && project.client?.listaPrecioId) {
                effectiveListaPrecio = await prisma.listaPrecio.findUnique({
                    where: { id: project.client.listaPrecioId, activo: true }
                });
            }
            if (!effectiveListaPrecio) {
                effectiveListaPrecio = defaultListaPrecio;
            }

            let processedRows = 0;
            let ignoredRows = 0;

            for (const row of rows) {
                if (!row.nombre?.trim()) {
                    ignoredRows++;
                    continue;
                }

                const nombreMaterial = row.nombre?.trim();
                const codigoMaterial = row.codigo?.trim() || null;
                const numSolicitado = parseFloat(row.solicitado) || 0;
                const numDisponible = parseFloat(row.disponible) || 0;
                const numEntregada = parseFloat(row.entregado) || 0;

                // Match by codigo first, then by name
                const existingMaterial = project.materialesProyecto.find(
                    m => (codigoMaterial && m.codigo === codigoMaterial) || m.nombre.toLowerCase() === nombreMaterial?.toLowerCase()
                );

                try {
                    // Buscar producto en Gestión Comercial para obtener unidad y precio dinámico
                    let resolvedUnit = 'Unid.';
                    let resolvedPrecio: number | null = null;

                    if (codigoMaterial || nombreMaterial) {
                        const trimmedCode = codigoMaterial ? codigoMaterial.trim() : '';
                        const unpadded = trimmedCode ? trimmedCode.replace(/^0+/, '') : '';
                        const padded5 = unpadded ? unpadded.padStart(5, '0') : '';

                        const prodConditions: any[] = [];
                        if (trimmedCode) {
                            prodConditions.push({ sku: trimmedCode.toUpperCase() });
                            if (unpadded) prodConditions.push({ sku: unpadded });
                            if (padded5) prodConditions.push({ sku: padded5 });
                            prodConditions.push({ codigoBarras: trimmedCode });
                        }
                        if (nombreMaterial) {
                            prodConditions.push({ descripcion: { equals: nombreMaterial, mode: 'insensitive' } });
                        }

                        const prod = await prisma.producto.findFirst({
                            where: {
                                activo: true,
                                OR: prodConditions
                            },
                            include: {
                                unidad: { select: { codigo: true, nombre: true } },
                                iva: { select: { porcentaje: true } },
                                proveedores: { where: { esPrincipal: true }, take: 1, select: { costo: true } }
                            }
                        });

                        if (prod) {
                            resolvedUnit = prod.unidad?.codigo || prod.unidad?.nombre || 'Unid.';
                            const costo = prod.proveedores[0]?.costo ? Number(prod.proveedores[0].costo) : 0;
                            const calc = resolverPrecioProducto({
                                precioBase: prod.precioBase,
                                costo,
                                rentabilidad: prod.rentabilidad,
                                familiaId: prod.familiaId,
                                marcaId: prod.marcaId,
                                ivaPorcentaje: prod.iva?.porcentaje ?? 21,
                            }, effectiveListaPrecio);
                            resolvedPrecio = calc.precio;
                        }
                    }

                    if (existingMaterial) {
                        const newSolicitada = mode === 'sumar' ? existingMaterial.cantidadSolicitada + numSolicitado : numSolicitado;
                        const newDisponible = mode === 'sumar' ? existingMaterial.cantidadDisponible + numDisponible : numDisponible;
                        const newEntregada = mode === 'sumar' ? existingMaterial.cantidadEntregada + numEntregada : numEntregada;

                        // Evaluate implicit state
                        let nuevoEstado = existingMaterial.estado;
                        if (!['cerrado_ok', 'cerrado_con_reserva'].includes(existingMaterial.estado)) {
                            const materialToEval = await prisma.materialProyecto.findUnique({
                                where: { id: existingMaterial.id },
                                include: { usos: true }
                            });
                            
                            const totalUsado = materialToEval?.usos.reduce((a: any, u: any) => a + u.cantidadUtilizada, 0) || 0;

                            if (newEntregada > 0) {
                                if (totalUsado > 0 && totalUsado >= newEntregada) {
                                    nuevoEstado = 'cerrado_ok';
                                } else {
                                    nuevoEstado = 'material_entregado';
                                }
                            } else if (newDisponible > 0 || newSolicitada > 0) {
                                nuevoEstado = 'material_cargado';
                            }
                        }

                        await prisma.materialProyecto.update({
                            where: { id: existingMaterial.id },
                            data: {
                                cantidadSolicitada: newSolicitada,
                                cantidadDisponible: newDisponible,
                                cantidadEntregada: newEntregada,
                                estado: nuevoEstado,
                                codigo: codigoMaterial || existingMaterial.codigo,
                                unidad: existingMaterial.unidad || resolvedUnit,
                                precioVenta: existingMaterial.precioVenta ?? resolvedPrecio ?? undefined
                            }
                        });
                        processedRows++;
                    } else {
                        // Create
                        if (!nombreMaterial) {
                            ignoredRows++;
                            continue;
                        }
                        let nuevoEstado = (numEntregada > 0) ? 'material_entregado' : 'material_cargado';

                        await prisma.materialProyecto.create({
                            data: {
                                proyectoId: project.id,
                                nombre: nombreMaterial,
                                codigo: codigoMaterial,
                                unidad: resolvedUnit,
                                cantidadSolicitada: numSolicitado,
                                cantidadDisponible: numDisponible,
                                cantidadEntregada: numEntregada,
                                precioVenta: resolvedPrecio,
                                estado: nuevoEstado
                            }
                        });
                        processedRows++;
                    }

                    // Upsert MaterialMaestro en try/catch para retrocompatibilidad
                    if (codigoMaterial && nombreMaterial) {
                        try {
                            await prisma.materialMaestro.upsert({
                                where: { codigo: codigoMaterial },
                                update: { nombre: nombreMaterial, unidad: resolvedUnit },
                                create: { codigo: codigoMaterial, nombre: nombreMaterial, unidad: resolvedUnit, precioVenta: resolvedPrecio }
                            });
                        } catch (e) {
                            // Ignorar error en tabla legacy
                        }
                    }
                } catch (e) {
                    console.error('Error importing row:', e);
                    ignoredRows++;
                }
            }

            results.push({
                sheetName: codigoProyecto,
                success: true,
                ignored: false,
                processedRows,
                ignoredRows,
                message: processedRows > 0 ? 'Importado con éxito' : 'Sin datos válidos'
            });
        }

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        console.error('Error procesando importación masiva:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
