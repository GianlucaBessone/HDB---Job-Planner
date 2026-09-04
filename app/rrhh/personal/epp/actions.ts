'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit';
import crypto from 'crypto';

function safeRevalidate(path: string) {
    try {
        revalidatePath(path);
    } catch (_) {}
}

// ==========================================
// 1. MATRIZ DE CONTROL DE EPP GLOBALES
// ==========================================

export async function getEppMatrix() {
    try {
        const [operadores, eppGlobales] = await Promise.all([
            prisma.operator.findMany({
                where: { activo: true },
                orderBy: { nombreCompleto: 'asc' },
                select: {
                    id: true,
                    nombreCompleto: true,
                    dni: true,
                    posicion: true,
                    role: true,
                    etiquetas: true,
                }
            }),
            prisma.eppItem.findMany({
                where: { esGlobal: true, activo: true },
                orderBy: { nombre: 'asc' }
            })
        ]);

        const operatorIds = operadores.map(o => o.id);

        // Obtenemos todos los deliveryItems de estos operadores
        const deliveryItems = await prisma.eppDeliveryItem.findMany({
            where: {
                delivery: {
                    operatorId: { in: operatorIds }
                }
            },
            include: {
                delivery: {
                    select: {
                        id: true,
                        codigoActa: true,
                        estado: true,
                        fechaEntrega: true,
                        operatorId: true,
                        signatureHash: true,
                        entregadoPor: true
                    }
                },
                eppItem: true
            },
            orderBy: { fechaEntrega: 'desc' }
        });

        // Construimos la matriz para cada operador y cada EPP global
        // Encontramos la entrega más reciente para cada par (operador, eppItem)
        const matrixMap: Record<string, Record<string, any>> = {};

        operadores.forEach(op => {
            matrixMap[op.id] = {};
            eppGlobales.forEach(epp => {
                matrixMap[op.id][epp.id] = {
                    estado: 'SIN_ENTREGA', // SIN_ENTREGA | PENDIENTE_FIRMA | VIGENTE | POR_VENCER | VENCIDO
                    item: null,
                    diasRestantes: null,
                    fechaEntrega: null,
                    fechaVencimiento: null
                };
            });
        });

        const now = new Date().getTime();

        deliveryItems.forEach(item => {
            const opId = item.delivery.operatorId;
            const eppId = item.eppItemId;

            if (matrixMap[opId] && matrixMap[opId][eppId]) {
                // Si aún no se asignó (es la más reciente por el order desc)
                if (matrixMap[opId][eppId].estado === 'SIN_ENTREGA') {
                    if (item.delivery.estado === 'PENDIENTE_FIRMA') {
                        matrixMap[opId][eppId] = {
                            estado: 'PENDIENTE_FIRMA',
                            item,
                            diasRestantes: null,
                            fechaEntrega: item.fechaEntrega,
                            fechaVencimiento: item.fechaVencimiento,
                            codigoActa: item.delivery.codigoActa,
                            deliveryId: item.delivery.id
                        };
                    } else if (item.delivery.estado === 'FIRMADA') {
                        const vtoDate = new Date(item.fechaVencimiento).getTime();
                        const diffDays = Math.ceil((vtoDate - now) / (1000 * 60 * 60 * 24));
                        
                        let estado = 'VIGENTE';
                        if (diffDays < 0) {
                            estado = 'VENCIDO';
                        } else if (diffDays <= 30) {
                            estado = 'POR_VENCER';
                        }

                        matrixMap[opId][eppId] = {
                            estado,
                            item,
                            diasRestantes: diffDays,
                            fechaEntrega: item.fechaEntrega,
                            fechaVencimiento: item.fechaVencimiento,
                            codigoActa: item.delivery.codigoActa,
                            deliveryId: item.delivery.id
                        };
                    }
                }
            }
        });

        // Métricas de cobertura general
        let totalCeldas = operadores.length * eppGlobales.length;
        let vigentesCount = 0;
        let porVencerCount = 0;
        let vencidosCount = 0;
        let sinEntregaCount = 0;
        let pendientesFirmaCount = 0;

        operadores.forEach(op => {
            eppGlobales.forEach(epp => {
                const cell = matrixMap[op.id][epp.id];
                if (cell.estado === 'VIGENTE') vigentesCount++;
                else if (cell.estado === 'POR_VENCER') porVencerCount++;
                else if (cell.estado === 'VENCIDO') vencidosCount++;
                else if (cell.estado === 'PENDIENTE_FIRMA') pendientesFirmaCount++;
                else sinEntregaCount++;
            });
        });

        const porcentajeCobertura = totalCeldas > 0 
            ? Math.round(((vigentesCount + porVencerCount) / totalCeldas) * 100) 
            : 0;

        return {
            success: true,
            data: {
                operadores,
                eppGlobales,
                matriz: matrixMap,
                stats: {
                    totalOperadores: operadores.length,
                    totalEppGlobales: eppGlobales.length,
                    vigentesCount,
                    porVencerCount,
                    vencidosCount,
                    sinEntregaCount,
                    pendientesFirmaCount,
                    porcentajeCobertura
                }
            }
        };
    } catch (error: any) {
        console.error('Error al obtener matriz EPP:', error);
        return { success: false, error: error.message };
    }
}

// ==========================================
// 2. CATÁLOGO Y STOCK DE EPP
// ==========================================

export async function getEppCatalog() {
    try {
        const items = await prisma.eppItem.findMany({
            orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
            include: {
                _count: {
                    select: {
                        deliveryItems: true,
                        stockMovements: true
                    }
                }
            }
        });
        return { success: true, data: items };
    } catch (error: any) {
        console.error('Error al obtener catálogo EPP (reintentando):', error.message);
        try {
            const items = await prisma.eppItem.findMany({
                orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
                include: {
                    _count: {
                        select: {
                            deliveryItems: true,
                            stockMovements: true
                        }
                    }
                }
            });
            return { success: true, data: items };
        } catch (retryErr: any) {
            console.error('Error definitivo al obtener catálogo EPP:', retryErr);
            return { success: false, error: retryErr.message };
        }
    }
}

export async function createEppItem(data: {
    nombre: string;
    codigo?: string;
    descripcion?: string;
    categoria: string;
    esGlobal: boolean;
    diasValidez: number;
    stockActual: number;
    stockMinimo: number;
    talle?: string;
    marca?: string;
    normaCertificacion?: string;
}) {
    try {
        const newItem = await prisma.$transaction(async (tx) => {
            const item = await tx.eppItem.create({
                data: {
                    nombre: data.nombre,
                    codigo: data.codigo || undefined,
                    descripcion: data.descripcion || '',
                    categoria: data.categoria,
                    esGlobal: Boolean(data.esGlobal),
                    diasValidez: Number(data.diasValidez) || 365,
                    stockActual: Number(data.stockActual) || 0,
                    stockMinimo: Number(data.stockMinimo) || 5,
                    talle: data.talle || null,
                    marca: data.marca || null,
                    normaCertificacion: data.normaCertificacion || null
                }
            });

            // Si se dio de alta con stock inicial > 0, registramos movimiento
            if (item.stockActual > 0) {
                await tx.eppStockMovement.create({
                    data: {
                        eppItemId: item.id,
                        tipo: 'INGRESO',
                        cantidad: item.stockActual,
                        stockAnterior: 0,
                        stockPosterior: item.stockActual,
                        motivo: 'Carga inicial de inventario',
                        registradoPor: 'Sistema'
                    }
                });
            }

            return item;
        });

        safeRevalidate('/rrhh/personal/epp');
        safeRevalidate('/mis-epp');
        return { 
            success: true, 
            data: {
                ...newItem,
                _count: {
                    deliveryItems: 0,
                    stockMovements: newItem.stockActual > 0 ? 1 : 0
                }
            } 
        };
    } catch (error: any) {
        if (error.code === 'P2002' || error.message?.includes('Unique constraint')) {
            return { success: false, error: 'El código de catálogo ingresado ya está en uso por otro elemento de EPP' };
        }
        return { success: false, error: error.message || 'Error al guardar elemento en el catálogo' };
    }
}

export async function updateEppItem(id: string, data: {
    nombre?: string;
    codigo?: string;
    descripcion?: string;
    categoria?: string;
    esGlobal?: boolean;
    diasValidez?: number;
    stockMinimo?: number;
    talle?: string;
    marca?: string;
    normaCertificacion?: string;
    activo?: boolean;
    ajusteStock?: {
        nuevoStock: number;
        motivo: string;
        registradoPor?: string;
        userId?: string;
        userName?: string;
    };
}) {
    try {
        const result = await prisma.$transaction(async (tx) => {
            const currentItem = await tx.eppItem.findUnique({
                where: { id }
            });

            if (!currentItem) throw new Error('Elemento de EPP no encontrado');

            // 1. Manejo de ajuste manual de stock si fue enviado
            let finalStock = currentItem.stockActual;
            if (data.ajusteStock && data.ajusteStock.nuevoStock !== undefined) {
                const nuevoStockNum = Number(data.ajusteStock.nuevoStock);
                if (isNaN(nuevoStockNum) || nuevoStockNum < 0) {
                    throw new Error('La cantidad de stock no puede ser un número negativo');
                }
                if (!data.ajusteStock.motivo || data.ajusteStock.motivo.trim().length === 0) {
                    throw new Error('Debe ingresar un motivo obligatorio para auditar el ajuste de stock');
                }

                if (nuevoStockNum !== currentItem.stockActual) {
                    const diff = nuevoStockNum - currentItem.stockActual;
                    finalStock = nuevoStockNum;

                    // Registrar en Kardex de Movimientos de Stock de EPP
                    await tx.eppStockMovement.create({
                        data: {
                            eppItemId: id,
                            tipo: 'AJUSTE',
                            cantidad: Math.abs(diff),
                            stockAnterior: currentItem.stockActual,
                            stockPosterior: nuevoStockNum,
                            motivo: `[Ajuste Manual] ${data.ajusteStock.motivo.trim()} (Diferencia: ${diff > 0 ? '+' : ''}${diff})`,
                            registradoPor: data.ajusteStock.registradoPor || data.ajusteStock.userName || 'Supervisor'
                        }
                    });

                    // Auditoría general del sistema
                    await logAudit({
                        action: 'UPDATE',
                        entity: 'EPP_STOCK_ADJUSTMENT',
                        entityId: id,
                        userId: data.ajusteStock.userId,
                        userName: data.ajusteStock.userName || data.ajusteStock.registradoPor,
                        oldValue: { stockActual: currentItem.stockActual },
                        newValue: { stockActual: nuevoStockNum, motivo: data.ajusteStock.motivo, diferencia: diff },
                        metadata: { eppNombre: currentItem.nombre, eppCodigo: currentItem.codigo }
                    });
                }
            }

            // 2. Actualizar campos del elemento
            const updated = await tx.eppItem.update({
                where: { id },
                data: {
                    nombre: data.nombre,
                    codigo: data.codigo !== undefined ? (data.codigo || null) : undefined,
                    descripcion: data.descripcion,
                    categoria: data.categoria,
                    esGlobal: data.esGlobal !== undefined ? Boolean(data.esGlobal) : undefined,
                    diasValidez: data.diasValidez !== undefined ? Number(data.diasValidez) : undefined,
                    stockMinimo: data.stockMinimo !== undefined ? Number(data.stockMinimo) : undefined,
                    stockActual: finalStock,
                    talle: data.talle !== undefined ? (data.talle || null) : undefined,
                    marca: data.marca !== undefined ? (data.marca || null) : undefined,
                    normaCertificacion: data.normaCertificacion !== undefined ? (data.normaCertificacion || null) : undefined,
                    activo: data.activo !== undefined ? Boolean(data.activo) : undefined
                }
            });

            // Auditoría de edición general
            await logAudit({
                action: 'UPDATE',
                entity: 'EPP_ITEM',
                entityId: id,
                userId: data.ajusteStock?.userId,
                userName: data.ajusteStock?.userName || data.ajusteStock?.registradoPor,
                oldValue: {
                    nombre: currentItem.nombre,
                    codigo: currentItem.codigo,
                    categoria: currentItem.categoria,
                    esGlobal: currentItem.esGlobal,
                    diasValidez: currentItem.diasValidez
                },
                newValue: {
                    nombre: updated.nombre,
                    codigo: updated.codigo,
                    categoria: updated.categoria,
                    esGlobal: updated.esGlobal,
                    diasValidez: updated.diasValidez
                }
            });

            return updated;
        });

        safeRevalidate('/rrhh/personal/epp');
        safeRevalidate('/mis-epp');
        return { success: true, data: result };
    } catch (error: any) {
        if (error.code === 'P2002' || error.message?.includes('Unique constraint')) {
            return { success: false, error: 'El código de catálogo ya se encuentra en uso por otro elemento de EPP' };
        }
        return { success: false, error: error.message || 'Error al actualizar elemento de EPP' };
    }
}

export async function adjustEppStockManual(data: {
    eppItemId: string;
    nuevoStock: number;
    motivo: string;
    registradoPor?: string;
    userId?: string;
    userName?: string;
}) {
    return updateEppItem(data.eppItemId, {
        ajusteStock: {
            nuevoStock: data.nuevoStock,
            motivo: data.motivo,
            registradoPor: data.registradoPor,
            userId: data.userId,
            userName: data.userName
        }
    });
}

// ==========================================
// 3. INGRESO DE STOCK Y MOVIMIENTOS (KARDEX)
// ==========================================

export async function addEppStock(data: {
    eppItemId: string;
    cantidad: number;
    remitoFactura?: string;
    proveedor?: string;
    motivo?: string;
    registradoPor?: string;
}) {
    try {
        const qty = Number(data.cantidad);
        if (!qty || qty <= 0) {
            return { success: false, error: 'La cantidad debe ser mayor a cero' };
        }

        const result = await prisma.$transaction(async (tx) => {
            const item = await tx.eppItem.findUnique({
                where: { id: data.eppItemId }
            });

            if (!item) throw new Error('Elemento de EPP no encontrado');

            const stockAnterior = item.stockActual;
            const stockPosterior = stockAnterior + qty;

            const updatedItem = await tx.eppItem.update({
                where: { id: data.eppItemId },
                data: { stockActual: stockPosterior }
            });

            const movement = await tx.eppStockMovement.create({
                data: {
                    eppItemId: data.eppItemId,
                    tipo: 'INGRESO',
                    cantidad: qty,
                    stockAnterior,
                    stockPosterior,
                    motivo: data.motivo || 'Ingreso de mercadería / Compra',
                    remitoFactura: data.remitoFactura || null,
                    proveedor: data.proveedor || null,
                    registradoPor: data.registradoPor || 'Supervisor'
                }
            });

            return { item: updatedItem, movement };
        });

        safeRevalidate('/rrhh/personal/epp');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getEppStockMovements(eppItemId?: string) {
    try {
        const where = eppItemId ? { eppItemId } : {};
        const movements = await prisma.eppStockMovement.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: {
                eppItem: {
                    select: {
                        id: true,
                        nombre: true,
                        codigo: true,
                        categoria: true,
                        talle: true
                    }
                },
                delivery: {
                    select: {
                        codigoActa: true,
                        operator: {
                            select: { nombreCompleto: true }
                        }
                    }
                }
            }
        });
        return { success: true, data: movements };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ==========================================
// 4. REGISTRO Y DESPACHO DE ENTREGAS (RRHH)
// ==========================================

export async function createEppDelivery(data: {
    operatorId: string;
    items: Array<{
        eppItemId: string;
        cantidad: number;
        talle?: string;
    }>;
    entregadoPor?: string;
    observaciones?: string;
    firmaPresencialBase64?: string; // Si se firmó directamente en el puesto de entrega
    signatureId?: string;
    signatureHash?: string;
}) {
    try {
        if (!data.operatorId) return { success: false, error: 'Debe seleccionar un operador' };
        if (!data.items || data.items.length === 0) return { success: false, error: 'Debe seleccionar al menos un elemento de EPP' };

        const result = await prisma.$transaction(async (tx) => {
            // 1. Validar stock de todos los items
            const itemIds = data.items.map(i => i.eppItemId);
            const dbItems = await tx.eppItem.findMany({
                where: { id: { in: itemIds } }
            });
            const dbItemMap = new Map<string, any>(dbItems.map(i => [i.id, i]));

            for (const reqItem of data.items) {
                const dbItem = dbItemMap.get(reqItem.eppItemId);
                if (!dbItem) throw new Error(`Elemento no encontrado en catálogo: ${reqItem.eppItemId}`);
                if (dbItem.stockActual < reqItem.cantidad) {
                    throw new Error(`Stock insuficiente para "${dbItem.nombre}". Disponible: ${dbItem.stockActual}, Solicitado: ${reqItem.cantidad}`);
                }
            }

            // 2. Generar código de acta
            const todayYear = new Date().getFullYear();
            const countThisYear = await tx.eppDelivery.count();
            const codigoActa = `EPP-ENT-${todayYear}-${String(countThisYear + 1).padStart(4, '0')}`;

            const isPresencialSigned = Boolean(data.firmaPresencialBase64 || data.signatureHash);

            // 3. Crear acta de entrega
            const delivery = await tx.eppDelivery.create({
                data: {
                    codigoActa,
                    operatorId: data.operatorId,
                    entregadoPor: data.entregadoPor || 'Supervisor de Seguridad',
                    estado: isPresencialSigned ? 'FIRMADA' : 'PENDIENTE_FIRMA',
                    firmaManuscritaUrl: data.firmaPresencialBase64 || null,
                    signatureId: data.signatureId || null,
                    signatureHash: data.signatureHash || null,
                    signedAt: isPresencialSigned ? new Date() : null,
                    observaciones: data.observaciones || null
                }
            });

            // 4. Crear los deliveryItems y descontar stock
            const now = new Date();
            for (const reqItem of data.items) {
                const dbItem = dbItemMap.get(reqItem.eppItemId)!;
                const cant = reqItem.cantidad || 1;
                const dias = dbItem.diasValidez || 365;
                const vtoDate = new Date(now.getTime() + dias * 24 * 60 * 60 * 1000);

                await tx.eppDeliveryItem.create({
                    data: {
                        deliveryId: delivery.id,
                        eppItemId: dbItem.id,
                        cantidad: cant,
                        talle: reqItem.talle || dbItem.talle || null,
                        confirmadoPorOperador: isPresencialSigned,
                        fechaEntrega: now,
                        diasValidez: dias,
                        fechaVencimiento: vtoDate,
                        estado: isPresencialSigned ? 'VIGENTE' : 'PENDIENTE'
                    }
                });

                // Descontar stock
                const stockAnterior = dbItem.stockActual;
                const stockPosterior = stockAnterior - cant;

                await tx.eppItem.update({
                    where: { id: dbItem.id },
                    data: { stockActual: stockPosterior }
                });

                // Movimiento Kardex
                await tx.eppStockMovement.create({
                    data: {
                        eppItemId: dbItem.id,
                        tipo: 'EGRESO_ENTREGA',
                        cantidad: cant,
                        stockAnterior,
                        stockPosterior,
                        deliveryId: delivery.id,
                        motivo: `Entrega a operador según Acta ${codigoActa}`,
                        registradoPor: data.entregadoPor || 'Supervisor'
                    }
                });
            }

            return delivery;
        });

        safeRevalidate('/rrhh/personal/epp');
        safeRevalidate('/mis-epp');
        return { success: true, data: result };
    } catch (error: any) {
        console.error('Error al despachar entrega EPP:', error);
        return { success: false, error: error.message };
    }
}

// ==========================================
// 5. SOLICITUDES DE EPP (DESDE OPERADORES)
// ==========================================

export async function getEppRequests() {
    try {
        const requests = await prisma.eppRequest.findMany({
            orderBy: { fechaSolicitud: 'desc' },
            include: {
                operator: {
                    select: {
                        id: true,
                        nombreCompleto: true,
                        dni: true,
                        posicion: true
                    }
                },
                eppItem: true
            }
        });
        return { success: true, data: requests };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function resolveEppRequest(data: {
    requestId: string;
    accion: 'APROBAR' | 'RECHAZAR';
    resueltoPor: string;
    motivoRechazo?: string;
}) {
    try {
        const updated = await prisma.eppRequest.update({
            where: { id: data.requestId },
            data: {
                estado: data.accion === 'APROBAR' ? 'APROBADA' : 'RECHAZADA',
                fechaResolucion: new Date(),
                resueltoPor: data.resueltoPor,
                motivoRechazo: data.motivoRechazo || null
            }
        });
        safeRevalidate('/rrhh/personal/epp');
        safeRevalidate('/mis-epp');
        return { success: true, data: updated };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ==========================================
// 6. HISTORIAL COMPLETO DE UN OPERADOR
// ==========================================

export async function getOperatorEppProfile(operatorId: string) {
    try {
        const [operator, deliveries, requests] = await Promise.all([
            prisma.operator.findUnique({
                where: { id: operatorId },
                select: {
                    id: true,
                    nombreCompleto: true,
                    dni: true,
                    posicion: true,
                    role: true,
                    etiquetas: true
                }
            }),
            prisma.eppDelivery.findMany({
                where: { operatorId },
                orderBy: { fechaEntrega: 'desc' },
                include: {
                    items: {
                        include: {
                            eppItem: true
                        }
                    }
                }
            }),
            prisma.eppRequest.findMany({
                where: { operatorId },
                orderBy: { fechaSolicitud: 'desc' },
                include: { eppItem: true }
            })
        ]);

        if (!operator) return { success: false, error: 'Operador no encontrado' };

        return {
            success: true,
            data: {
                operator,
                deliveries,
                requests
            }
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ==========================================
// 6. ENLACES PÚBLICOS Y COMPARTICIÓN DE MATRIZ
// ==========================================

export async function getClientsForEppShare() {
    try {
        const clients = await prisma.hdbClient.findMany({
            where: { activo: true },
            select: { id: true, nombre: true },
            orderBy: { nombre: 'asc' }
        });
        return { success: true, data: clients };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createEppPublicShare(data: {
    tipo: 'GENERAL' | 'CLIENTE';
    clientId?: string;
    titulo?: string;
    creadoPor?: string;
}) {
    try {
        let clientNombre: string | null = null;
        let finalTitulo = data.titulo || 'Matriz General de EPP';

        if (data.tipo === 'CLIENTE') {
            if (!data.clientId) throw new Error('Debe seleccionar un cliente');
            const client = await prisma.hdbClient.findUnique({
                where: { id: data.clientId }
            });
            if (!client) throw new Error('Cliente no encontrado');
            clientNombre = client.nombre;
            finalTitulo = data.titulo || `Matriz de EPP - ${client.nombre}`;
        }

        const token = crypto.randomBytes(16).toString('hex');

        const share = await prisma.eppPublicShare.create({
            data: {
                token,
                titulo: finalTitulo,
                tipo: data.tipo,
                clientId: data.clientId || null,
                clientNombre,
                creadoPor: data.creadoPor || 'Administrador',
                activo: true
            }
        });

        safeRevalidate('/rrhh/personal/epp');
        return { success: true, data: share };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getEppPublicShares() {
    try {
        const shares = await prisma.eppPublicShare.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                client: {
                    select: { id: true, nombre: true }
                }
            }
        });
        return { success: true, data: shares };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteEppPublicShare(id: string) {
    try {
        await prisma.eppPublicShare.delete({
            where: { id }
        });
        safeRevalidate('/rrhh/personal/epp');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getPublicEppMatrixData(token: string) {
    try {
        const share = await prisma.eppPublicShare.findUnique({
            where: { token, activo: true },
            include: { client: true }
        });

        if (!share) {
            return { success: false, error: 'El enlace de la matriz no es válido o ha sido desactivado.' };
        }

        // Registrar visita
        await prisma.eppPublicShare.update({
            where: { id: share.id },
            data: {
                visitas: { increment: 1 },
                ultimaVisita: new Date()
            }
        }).catch(() => {});

        // 1. Obtener operadores según la configuración del enlace (EN TIEMPO REAL)
        let operadores: any[] = [];

        if (share.tipo === 'CLIENTE' && share.clientId) {
            // Buscar proyectos del cliente
            const projects = await prisma.project.findMany({
                where: {
                    OR: [
                        { clientId: share.clientId },
                        ...(share.clientNombre ? [{ cliente: share.clientNombre }] : [])
                    ]
                },
                select: { id: true }
            });
            const projectIds = projects.map(p => p.id);

            // Fecha límite: últimos 3 meses exactos
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            const fechaLimiteStr = threeMonthsAgo.toISOString().split('T')[0];

            // Buscar operadores con horas trabajadas en TimeEntry
            const timeEntries = await prisma.timeEntry.findMany({
                where: {
                    projectId: { in: projectIds },
                    fecha: { gte: fechaLimiteStr },
                    horasTrabajadas: { gt: 0 }
                },
                select: { operatorId: true },
                distinct: ['operatorId']
            });

            // Buscar operadores con horas trabajadas en Fichada
            const fichadas = await prisma.fichada.findMany({
                where: {
                    projectId: { in: projectIds },
                    fecha: { gte: fechaLimiteStr },
                    horasTrabajadas: { gt: 0 }
                },
                select: { operatorId: true },
                distinct: ['operatorId']
            });

            const uniqueOperatorIds = Array.from(new Set([
                ...timeEntries.map(t => t.operatorId),
                ...fichadas.map(f => f.operatorId)
            ]));

            // Filtrar SOLO los que no estén desactivados en ajustes de usuarios (activo: true)
            operadores = await prisma.operator.findMany({
                where: {
                    id: { in: uniqueOperatorIds },
                    activo: true
                },
                orderBy: { nombreCompleto: 'asc' },
                select: {
                    id: true,
                    nombreCompleto: true,
                    dni: true,
                    posicion: true,
                    role: true
                }
            });
        } else {
            // Matriz Completa: todos los operadores activos
            operadores = await prisma.operator.findMany({
                where: { activo: true },
                orderBy: { nombreCompleto: 'asc' },
                select: {
                    id: true,
                    nombreCompleto: true,
                    dni: true,
                    posicion: true,
                    role: true
                }
            });
        }

        // 2. Obtener los EPP Globales
        const eppGlobales = await prisma.eppItem.findMany({
            where: { esGlobal: true, activo: true },
            orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }]
        });

        const operatorIds = operadores.map(o => o.id);

        // 3. Obtenemos todas las entregas e historial de estos operadores
        const deliveries = await prisma.eppDelivery.findMany({
            where: { operatorId: { in: operatorIds } },
            include: {
                items: {
                    include: { eppItem: true }
                }
            },
            orderBy: { fechaEntrega: 'desc' }
        });

        // 4. Mapear historial por operador
        const deliveriesByOperator: Record<string, any[]> = {};
        operadores.forEach(op => {
            deliveriesByOperator[op.id] = deliveries.filter(d => d.operatorId === op.id);
        });

        // 5. Construir celdas de matriz para cada operador y cada EPP Global
        const matrixMap: Record<string, Record<string, any>> = {};
        operadores.forEach(op => {
            matrixMap[op.id] = {};
            eppGlobales.forEach(epp => {
                matrixMap[op.id][epp.id] = {
                    estado: 'SIN_ENTREGA',
                    item: null,
                    diasRestantes: null,
                    fechaEntrega: null,
                    fechaVencimiento: null
                };
            });
        });

        const now = new Date().getTime();

        for (const del of deliveries) {
            const opId = del.operatorId;
            for (const item of del.items) {
                const eppId = item.eppItemId;
                if (matrixMap[opId] && matrixMap[opId][eppId]) {
                    if (matrixMap[opId][eppId].estado === 'SIN_ENTREGA') {
                        if (del.estado === 'PENDIENTE_FIRMA') {
                            matrixMap[opId][eppId] = {
                                estado: 'PENDIENTE_FIRMA',
                                item,
                                diasRestantes: null,
                                fechaEntrega: item.fechaEntrega,
                                fechaVencimiento: item.fechaVencimiento,
                                codigoActa: del.codigoActa,
                                deliveryId: del.id
                            };
                        } else if (del.estado === 'FIRMADA') {
                            const vtoDate = new Date(item.fechaVencimiento).getTime();
                            const diffDays = Math.ceil((vtoDate - now) / (1000 * 60 * 60 * 24));
                            let estado = 'VIGENTE';
                            if (diffDays < 0) {
                                estado = 'VENCIDO';
                            } else if (diffDays <= 30) {
                                estado = 'POR_VENCER';
                            }

                            matrixMap[opId][eppId] = {
                                estado,
                                item,
                                diasRestantes: diffDays,
                                fechaEntrega: item.fechaEntrega,
                                fechaVencimiento: item.fechaVencimiento,
                                codigoActa: del.codigoActa,
                                deliveryId: del.id,
                                signatureId: del.signatureId,
                                signatureHash: del.signatureHash
                            };
                        }
                    }
                }
            }
        }

        // 6. Calcular filas y estadísticas
        let vigentesCount = 0;
        let porVencerCount = 0;
        let vencidosCount = 0;
        let sinEntregaCount = 0;
        let pendientesFirmaCount = 0;

        const rows = operadores.map(op => {
            const cells = eppGlobales.map(epp => {
                const cell = matrixMap[op.id][epp.id];
                if (cell.estado === 'VIGENTE') vigentesCount++;
                else if (cell.estado === 'POR_VENCER') porVencerCount++;
                else if (cell.estado === 'VENCIDO') vencidosCount++;
                else if (cell.estado === 'PENDIENTE_FIRMA') pendientesFirmaCount++;
                else sinEntregaCount++;

                return {
                    eppItemId: epp.id,
                    ...cell
                };
            });

            let generalStatus = 'AL_DIA';
            if (cells.some(c => c.estado === 'VENCIDO')) generalStatus = 'CON_VENCIDOS';
            else if (cells.some(c => c.estado === 'POR_VENCER')) generalStatus = 'POR_VENCER';
            else if (cells.some(c => c.estado === 'PENDIENTE_FIRMA')) generalStatus = 'PENDIENTE_FIRMA';
            else if (cells.every(c => c.estado === 'SIN_ENTREGA')) generalStatus = 'SIN_COBERTURA';

            return {
                operator: op,
                cells,
                generalStatus,
                historialDeliveries: deliveriesByOperator[op.id] || []
            };
        });

        const totalSlots = operadores.length * eppGlobales.length;
        const porcentajeCobertura = totalSlots > 0 ? Math.round((vigentesCount / totalSlots) * 100) : 0;

        return {
            success: true,
            data: {
                share: {
                    id: share.id,
                    titulo: share.titulo,
                    tipo: share.tipo,
                    clientNombre: share.clientNombre,
                    createdAt: share.createdAt
                },
                operadoresCount: operadores.length,
                eppGlobales,
                rows,
                stats: {
                    totalOperadores: operadores.length,
                    totalEppGlobales: eppGlobales.length,
                    vigentesCount,
                    porVencerCount,
                    vencidosCount,
                    sinEntregaCount,
                    pendientesFirmaCount,
                    porcentajeCobertura
                },
                updatedAt: new Date()
            }
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

