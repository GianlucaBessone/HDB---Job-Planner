/**
 * Lógica del portal "Mis EPP". Solo se usa desde app/api/rrhh/epp/mis-epp/**:
 * el operador siempre es el de la sesión, nunca uno que mande el cliente.
 * No es un módulo de server actions: no le agregues esa directiva, o sus
 * funciones quedarían invocables sin pasar por las APIs.
 */
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import type { UsuarioEpp } from '@/lib/rrhh/eppSesion';

export async function getMyEppData(operador: UsuarioEpp) {
    try {
        const operatorId = operador.id;
        const now = Date.now();

        const operator = await prisma.operator.findUnique({
            where: { id: operatorId },
            select: { id: true, nombreCompleto: true, dni: true }
        });
        if (!operator) return { success: false, error: 'Operador no encontrado' };

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
                operator,
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

export async function signEppDelivery(operador: UsuarioEpp, data: {
    deliveryId: string;
    itemIdsConfirmed: string[];
    signatureId: string;
    signatureHash: string;
    firmaManuscritaUrl?: string;
}) {
    try {
        const { deliveryId, itemIdsConfirmed, signatureId, signatureHash, firmaManuscritaUrl } = data;
        const operatorId = operador.id;

        if (!deliveryId) {
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
            if (delivery.estado !== 'PENDIENTE_FIRMA') throw new Error('Esta entrega ya fue firmada previamente');

            const confirmados = itemIdsConfirmed.filter(id => delivery.items.some(i => i.id === id));
            if (confirmados.length === 0) throw new Error('Debe seleccionar y confirmar al menos un ítem entregado');

            // La firma con checksum la genera /api/signatures/sign con la sesión. Acá se
            // comprueba que exista, que sea de este operador y de esta acta, y que no se
            // haya usado ya en otra: el cliente no puede inventar ni reutilizar una firma.
            const firma = await tx.documentSignatureAudit.findUnique({ where: { SignatureID: signatureId } });
            if (
                !firma ||
                firma.DocumentID !== deliveryId ||
                firma.UserID !== operatorId ||
                firma.HashSignature !== signatureHash ||
                firma.VerificationStatus !== 'VALIDA'
            ) {
                throw new Error('La firma digital no corresponde a esta entrega');
            }
            const usada = await tx.eppDelivery.findFirst({ where: { signatureId, NOT: { id: deliveryId } }, select: { id: true } });
            if (usada) throw new Error('La firma digital ya se usó en otra entrega');

            const now = new Date();

            // 1. Marcar el acta solo si sigue pendiente: dos firmas simultáneas no pasan las dos.
            const marcada = await tx.eppDelivery.updateMany({
                where: { id: deliveryId, operatorId, estado: 'PENDIENTE_FIRMA' },
                data: {
                    estado: 'FIRMADA',
                    signatureId,
                    signatureHash,
                    firmaManuscritaUrl: firmaManuscritaUrl || null,
                    signedAt: now
                }
            });
            if (marcada.count === 0) throw new Error('Esta entrega ya fue firmada previamente');
            const updatedDelivery = await tx.eppDelivery.findUniqueOrThrow({ where: { id: deliveryId } });

            // 2. Actualizar cada ítem de la entrega
            for (const item of delivery.items) {
                const isConfirmed = confirmados.includes(item.id);

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

                    // Devolver al stock (el kardex usa el valor real después del incremento)
                    const devuelto = await tx.eppItem.update({
                        where: { id: item.eppItemId },
                        data: { stockActual: { increment: item.cantidad } }
                    });

                    await tx.eppStockMovement.create({
                        data: {
                            eppItemId: item.eppItemId,
                            tipo: 'AJUSTE',
                            cantidad: item.cantidad,
                            stockAnterior: devuelto.stockActual - item.cantidad,
                            stockPosterior: devuelto.stockActual,
                            deliveryId: delivery.id,
                            motivo: `Devolución al pañol: no recibido por operario en Acta ${delivery.codigoActa}`,
                            registradoPor: operador.nombre
                        }
                    });
                }
            }

            return updatedDelivery;
        });

        await logAudit({
            action: 'UPDATE',
            entity: 'EPP_DELIVERY_SIGNATURE',
            entityId: result.id,
            userId: operador.id,
            userName: operador.nombre,
            newValue: { estado: result.estado, signatureId, itemIdsConfirmed: data.itemIdsConfirmed.filter(id => id) },
            metadata: { codigoActa: result.codigoActa }
        });

        return { success: true, data: result };
    } catch (error: any) {
        console.error('Error al firmar entrega de EPP:', error);
        return { success: false, error: error.message };
    }
}

export async function createOperatorEppRequest(operador: UsuarioEpp, data: {
    eppItemId: string;
    talle?: string;
    motivo: string;
    comentario?: string;
}) {
    try {
        if (!data.eppItemId) {
            return { success: false, error: 'Elemento de EPP requerido' };
        }

        const item = await prisma.eppItem.findUnique({
            where: { id: data.eppItemId },
            select: { activo: true }
        });
        if (!item || !item.activo) {
            return { success: false, error: 'El elemento de EPP no está disponible' };
        }

        const newRequest = await prisma.eppRequest.create({
            data: {
                operatorId: operador.id,
                eppItemId: data.eppItemId,
                talle: data.talle || null,
                motivo: data.motivo || 'VENCIMIENTO',
                comentario: data.comentario || null,
                estado: 'PENDIENTE'
            }
        });

        return { success: true, data: newRequest };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
