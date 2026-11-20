'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { z } from 'zod';
import { decrypt } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { datosFirmaSchema, firmarComoOperador, FirmaError, ipDesdeHeaders } from '@/lib/signatureServer';

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

/** Operador de la sesión. Las server actions no pasan por el middleware de /api. */
async function getOperadorSesionId(): Promise<string | null> {
    const token = (await cookies()).get('sgi_session')?.value;
    const session = token ? await decrypt(token) : null;
    return session?.id || null;
}

const firmaEppSchema = z.object({
    deliveryId: z.string().trim().min(1, 'Acta de entrega requerida'),
    itemIdsConfirmed: z.array(z.string().min(1)).min(1, 'Debe seleccionar y confirmar al menos un ítem entregado'),
    deviceId: datosFirmaSchema.shape.deviceId,
    firmaManuscritaUrl: z.string().optional(),
});

/**
 * Firma un acta de entrega de EPP. La firma digital (DocumentSignatureAudit) se
 * genera acá, a nombre del operador de la sesión, en la misma transacción que
 * actualiza el acta. Ni el operador ni la firma se aceptan del cliente.
 */
export async function signEppDelivery(data: z.input<typeof firmaEppSchema>) {
    try {
        const operatorId = await getOperadorSesionId();
        if (!operatorId) {
            return { success: false, error: 'Debe iniciar sesión para firmar la entrega' };
        }

        const parsed = firmaEppSchema.safeParse(data);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || 'Parámetros incompletos' };
        }
        const { deliveryId, itemIdsConfirmed, deviceId, firmaManuscritaUrl } = parsed.data;
        const ipAddress = ipDesdeHeaders(await headers());

        const result = await prisma.$transaction(async (tx) => {
            const delivery = await tx.eppDelivery.findUnique({
                where: { id: deliveryId },
                include: { items: { include: { eppItem: true } } }
            });

            if (!delivery) throw new Error('Acta de entrega no encontrada');
            if (delivery.operatorId !== operatorId) throw new Error('No autorizado para firmar esta entrega');
            if (delivery.estado === 'FIRMADA') throw new Error('Esta entrega ya fue firmada previamente');

            const now = new Date();

            // 1. Firma digital a nombre del operador de la sesión
            const firma = await firmarComoOperador(tx, {
                documentId: delivery.id,
                documentVersion: '1.0',
                deviceId,
                operatorId,
                ipAddress,
            });

            // 2. Actualizar acta de entrega
            const updatedDelivery = await tx.eppDelivery.update({
                where: { id: deliveryId },
                data: {
                    estado: 'FIRMADA',
                    signatureId: firma.SignatureID,
                    signatureHash: firma.HashSignature,
                    firmaManuscritaUrl: firmaManuscritaUrl || null,
                    signedAt: now
                }
            });

            // 3. Actualizar cada ítem de la entrega
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

            return { updatedDelivery, firma };
        });

        await logAudit({
            action: 'CREATE',
            entity: 'SIGNATURE_AUDIT',
            entityId: result.firma.SignatureID,
            newValue: result.firma,
            userId: result.firma.UserID,
            userName: result.firma.UserName,
            metadata: { eppDeliveryId: deliveryId }
        });

        safeRevalidate('/mis-epp');
        safeRevalidate('/rrhh/personal/epp');
        return { success: true, data: result.updatedDelivery };
    } catch (error: any) {
        if (error instanceof FirmaError) {
            return { success: false, error: error.message };
        }
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
