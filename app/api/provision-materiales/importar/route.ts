import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { sheets, mode = 'reemplazar' } = body;

        if (!sheets || !Array.isArray(sheets)) {
            return NextResponse.json({ error: 'Estructura de datos inválida' }, { status: 400 });
        }

        const results = [];

        for (const sheet of sheets) {
            const { codigoProyecto, rows } = sheet;
            if (!codigoProyecto || !Array.isArray(rows)) continue;

            const project = await prisma.project.findUnique({
                where: { codigoProyecto },
                include: { materialesProyecto: true }
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

                            if (newEntregada > 0 && totalUsado === newEntregada) {
                                nuevoEstado = 'cerrado_ok';
                            } else if (newEntregada > 0 && newEntregada < newSolicitada) {
                                nuevoEstado = 'material_entregado'; 
                            } else if (newEntregada > 0 && newEntregada === newSolicitada) {
                                nuevoEstado = 'material_entregado';
                            } else if (newDisponible > 0) {
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
                                codigo: codigoMaterial || existingMaterial.codigo
                            }
                        });
                        processedRows++;
                    } else {
                        // Create
                        if (!nombreMaterial) {
                            ignoredRows++;
                            continue;
                        }
                        let nuevoEstado = 'material_cargado';
                        if (numEntregada > 0 && numEntregada < numSolicitado) nuevoEstado = 'material_entregado';
                        else if (numEntregada > 0 && numEntregada === numSolicitado) nuevoEstado = 'material_entregado';

                        await prisma.materialProyecto.create({
                            data: {
                                proyectoId: project.id,
                                nombre: nombreMaterial,
                                codigo: codigoMaterial,
                                unidad: 'Unid.', // Default unit
                                cantidadSolicitada: numSolicitado,
                                cantidadDisponible: numDisponible,
                                cantidadEntregada: numEntregada,
                                estado: nuevoEstado
                            }
                        });
                        processedRows++;
                    }

                    // Upsert MaterialMaestro
                    if (codigoMaterial && nombreMaterial) {
                        await prisma.materialMaestro.upsert({
                            where: { codigo: codigoMaterial },
                            update: { nombre: nombreMaterial },
                            create: { codigo: codigoMaterial, nombre: nombreMaterial, unidad: 'Unid.' }
                        });
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
