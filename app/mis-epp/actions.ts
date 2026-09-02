'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

function safeRevalidate(path: string) {
    try {
        revalidatePath(path);
    } catch (_) {}
}

// ==========================================
// ACCIONES PARA EL PORTAL DEL OPERADOR: MIS EPP
// ==========================================

export async function getMyEppData(operatorId: string) {
    try {
        if (!operatorId) {
            return { success: false, error: 'Identificador de operador requerido' };
        }

        const now = Date.now();

        // 1. Entregas pendientes de firma para este operador
        const pendingDeliveries = await prisma.eppDelivery.findMany({
            where: {
                operatorId,
                estado: 'PENDIENTE_FIRMA'
            },
            include: {
                items: {
                    include: {
                        eppItem: true
                    }
                }
            },
            orderBy: { fechaEntrega: 'desc' }
        });

        // 2. Historial de todas las entregas firmadas
        const signedDeliveries = await prisma.eppDelivery.findMany({
            where: {
                operatorId,
                estado: 'FIRMADA'
            },
            include: {
                items: {
                    include: {
                        eppItem: true
                    }
                }
            },
            orderBy: { fechaEntrega: 'desc' }
        });

        // 3. EPP Asignados actualmente vigentes / vencidos (última entrega de cada EPP)
        const assignedItemsMap = new Map<string, any>();

        for (const delivery of signedDeliveries) {
            for (const item of delivery.items) {
                if (item.confirmadoPorOperador && !assignedItemsMap.has(item.eppItemId)) {
                    const vtoDate = new Date(item.fechaVencimiento).getTime();
                    const diffDays = Math.ceil((vtoDate - now) / (1000 * 60 * 60 * 24));

                    let estado = 'VIGENTE';
                    if (diffDays < 0) {
                        estado = 'VENCIDO';
                    } else if (diffDays <= 30) {
                        estado = 'POR_VENCER';
                    }

                    assignedItemsMap.set(item.eppItemId, {
                        ...item,
                        deliveryCode: delivery.codigoActa,
                        entregadoPor: delivery.entregadoPor,
                        signatureId: delivery.signatureId,
                        signatureHash: delivery.signatureHash,
                        diasRestantes: diffDays,
                        estadoVigencia: estado
                    });
                }
            }
        }

        const assignedItems = Array.from(assignedItemsMap.values());

        // 4. Solicitudes de EPP realizadas por el operador
        const requests = await prisma.eppRequest.findMany({
            where: { operatorId },
            include: { eppItem: true },
            orderBy: { fechaSolicitud: 'desc' }
        });

        // 5. Catálogo de EPP disponibles para solicitar
        const catalog = await prisma.eppItem.findMany({
            where: { activo: true },
            orderBy: [{ esGlobal: 'desc' }, { nombre: 'asc' }],
            select: {
                id: true,
                codigo: true,
                nombre: true,
                categoria: true,
                esGlobal: true,
                talle: true,
                diasValidez: true,
                stockActual: true
            }
        });

        return {
            success: true,
            data: {
                pendingDeliveries,
                assignedItems,
                signedDeliveries,
                requests,
                catalog
            }
        };
    } catch (error: any) {
        console.error('Error en getMyEppData:', error);
        return { success: false, error: error.message };
    }
}

export async function signEppDelivery(data: {
    deliveryId: string;
    operatorId: string;
    itemIdsConfirmed: string[];
    signatureId: string;
    signatureHash: string;
    firmaManuscritaUrl?: string;
}) {
    try {
        const { deliveryId, operatorId, itemIdsConfirmed, signatureId, signatureHash, firmaManuscritaUrl } = data;

        if (!deliveryId || !operatorId) {
            return { success: false, error: 'Parámetros incompletos' };
        }
        if (!itemIdsConfirmed || itemIdsConfirmed.length === 0) {
            return { success: false, error: 'Debe seleccionar y confirmar al menos un ítem entregado' };
        }
        if (!signatureId || !signatureHash) {
            return { success: false, error: 'Firma digital con checksum requerida' };
        }

        const result = await prisma.$transaction(async (tx) => {
            const delivery = await tx.eppDelivery.findUnique({
                where: { id: deliveryId },
                include: { items: { include: { eppItem: true } } }
            });

            if (!delivery) throw new Error('Acta de entrega no encontrada');
            if (delivery.operatorId !== operatorId) throw new Error('No autorizado para firmar esta entrega');
            if (delivery.estado === 'FIRMADA') throw new Error('Esta entrega ya fue firmada previamente');

            const now = new Date();

            // 1. Actualizar acta de entrega
            const updatedDelivery = await tx.eppDelivery.update({
                where: { id: deliveryId },
                data: {
                    estado: 'FIRMADA',
                    signatureId,
                    signatureHash,
                    firmaManuscritaUrl: firmaManuscritaUrl || null,
                    signedAt: now
                }
            });

            // 2. Actualizar cada ítem de la entrega
            for (const item of delivery.items) {
                const isConfirmed = itemIdsConfirmed.includes(item.id);

                if (isConfirmed) {
                    const dias = item.diasValidez || item.eppItem.diasValidez || 365;
                    const vtoDate = new Date(now.getTime() + dias * 24 * 60 * 60 * 1000);

                    await tx.eppDeliveryItem.update({
                        where: { id: item.id },
                        data: {
                            confirmadoPorOperador: true,
                            fechaEntrega: now,
                            fechaVencimiento: vtoDate,
                            estado: 'VIGENTE'
                        }
                    });
                } else {
                    // Ítem no confirmado: se reincorpora al stock
                    await tx.eppDeliveryItem.update({
                        where: { id: item.id },
                        data: {
                            confirmadoPorOperador: false,
                            estado: 'RECHAZADO_NO_RECIBIDO'
                        }
                    });

                    // Devolver al stock
                    await tx.eppItem.update({
                        where: { id: item.eppItemId },
                        data: { stockActual: { increment: item.cantidad } }
                    });

                    await tx.eppStockMovement.create({
                        data: {
                            eppItemId: item.eppItemId,
                            tipo: 'AJUSTE',
                            cantidad: item.cantidad,
                            stockAnterior: item.eppItem.stockActual,
                            stockPosterior: item.eppItem.stockActual + item.cantidad,
                            deliveryId: delivery.id,
                            motivo: `Devolución al pañol: no recibido por operario en Acta ${delivery.codigoActa}`,
                            registradoPor: 'Sistema / Operador'
                        }
                    });
                }
            }

            return updatedDelivery;
        });

        safeRevalidate('/mis-epp');
        safeRevalidate('/rrhh/personal/epp');
        return { success: true, data: result };
    } catch (error: any) {
        console.error('Error al firmar entrega de EPP:', error);
        return { success: false, error: error.message };
    }
}

export async function createOperatorEppRequest(data: {
    operatorId: string;
    eppItemId: string;
    talle?: string;
    motivo: string;
    comentario?: string;
}) {
    try {
        if (!data.operatorId || !data.eppItemId) {
            return { success: false, error: 'Operador y elemento de EPP requeridos' };
        }

        const newRequest = await prisma.eppRequest.create({
            data: {
                operatorId: data.operatorId,
                eppItemId: data.eppItemId,
                talle: data.talle || null,
                motivo: data.motivo || 'VENCIMIENTO',
                comentario: data.comentario || null,
                estado: 'PENDIENTE'
            }
        });

        safeRevalidate('/mis-epp');
        safeRevalidate('/rrhh/personal/epp');
        return { success: true, data: newRequest };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
