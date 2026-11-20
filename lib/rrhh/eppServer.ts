// EPP: lógica de servidor para las API routes de EPP, Mis EPP y la matriz pública.
// Módulo común (no es de server actions): solo lo llaman las API routes. No importar desde componentes cliente.
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { generateSignatureHash, generateSignatureId } from '@/lib/signature';
import { ErrorEpp, type ActorEpp } from '@/lib/rrhh/eppSesion';
import type { z } from 'zod';
import type {
    eppEntregaSchema, eppEnlaceSchema, eppFirmaEntregaSchema, eppIngresoStockSchema,
    eppItemCrearSchema, eppItemEditarSchema, eppResolverSolicitudSchema, eppSolicitudSchema,
} from '@/lib/rrhh/epp';

const DIA_MS = 24 * 60 * 60 * 1000;

/** Vigencia de un EPP firmado según su vencimiento. */
function vigencia(fechaVencimiento: Date, now: number) {
    const diasRestantes = Math.ceil((new Date(fechaVencimiento).getTime() - now) / DIA_MS);
    const estado = diasRestantes < 0 ? 'VENCIDO' : diasRestantes <= 30 ? 'POR_VENCER' : 'VIGENTE';
    return { diasRestantes, estado };
}

const celdaVacia = () => ({ estado: 'SIN_ENTREGA', item: null, diasRestantes: null, fechaEntrega: null, fechaVencimiento: null });

function catalogoDuplicado(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ErrorEpp('El código de catálogo ya se encuentra en uso por otro elemento de EPP', 409);
    }
    throw error;
}

// ==========================================
// 1. MATRIZ DE CONTROL DE EPP GLOBALES
// ==========================================

export async function getEppMatrix() {
    const [operadores, eppGlobales] = await Promise.all([
        prisma.operator.findMany({
            where: { activo: true },
            orderBy: { nombreCompleto: 'asc' },
            select: { id: true, nombreCompleto: true, dni: true, posicion: true, role: true, etiquetas: true },
        }),
        prisma.eppItem.findMany({ where: { esGlobal: true, activo: true }, orderBy: { nombre: 'asc' } }),
    ]);

    const deliveryItems = await prisma.eppDeliveryItem.findMany({
        where: { delivery: { operatorId: { in: operadores.map(o => o.id) } } },
        include: {
            delivery: {
                select: { id: true, codigoActa: true, estado: true, fechaEntrega: true, operatorId: true, signatureHash: true, entregadoPor: true },
            },
            eppItem: true,
        },
        orderBy: { fechaEntrega: 'desc' },
    });

    // Para cada par (operador, EPP global) vale la entrega más reciente.
    const matriz: Record<string, Record<string, any>> = {};
    for (const op of operadores) {
        matriz[op.id] = {};
        for (const epp of eppGlobales) matriz[op.id][epp.id] = celdaVacia();
    }

    const now = Date.now();
    for (const item of deliveryItems) {
        const celda = matriz[item.delivery.operatorId]?.[item.eppItemId];
        if (!celda || celda.estado !== 'SIN_ENTREGA') continue;
        const base = {
            item,
            fechaEntrega: item.fechaEntrega,
            fechaVencimiento: item.fechaVencimiento,
            codigoActa: item.delivery.codigoActa,
            deliveryId: item.delivery.id,
        };
        if (item.delivery.estado === 'PENDIENTE_FIRMA') {
            matriz[item.delivery.operatorId][item.eppItemId] = { estado: 'PENDIENTE_FIRMA', diasRestantes: null, ...base };
        } else if (item.delivery.estado === 'FIRMADA') {
            matriz[item.delivery.operatorId][item.eppItemId] = { ...vigencia(item.fechaVencimiento, now), ...base };
        }
    }

    const stats = { vigentesCount: 0, porVencerCount: 0, vencidosCount: 0, sinEntregaCount: 0, pendientesFirmaCount: 0 };
    for (const op of operadores) {
        for (const epp of eppGlobales) {
            const estado = matriz[op.id][epp.id].estado;
            if (estado === 'VIGENTE') stats.vigentesCount++;
            else if (estado === 'POR_VENCER') stats.porVencerCount++;
            else if (estado === 'VENCIDO') stats.vencidosCount++;
            else if (estado === 'PENDIENTE_FIRMA') stats.pendientesFirmaCount++;
            else stats.sinEntregaCount++;
        }
    }
    const totalCeldas = operadores.length * eppGlobales.length;

    return {
        operadores,
        eppGlobales,
        matriz,
        stats: {
            totalOperadores: operadores.length,
            totalEppGlobales: eppGlobales.length,
            ...stats,
            porcentajeCobertura: totalCeldas > 0 ? Math.round(((stats.vigentesCount + stats.porVencerCount) / totalCeldas) * 100) : 0,
        },
    };
}

// ==========================================
// 2. CATÁLOGO Y STOCK DE EPP
// ==========================================

export async function getEppCatalog() {
    return prisma.eppItem.findMany({
        orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
        include: { _count: { select: { deliveryItems: true, stockMovements: true } } },
    });
}

export async function createEppItem(data: z.output<typeof eppItemCrearSchema>, actor: ActorEpp) {
    const item = await prisma
        .$transaction(async tx => {
            const creado = await tx.eppItem.create({
                data: {
                    nombre: data.nombre,
                    codigo: data.codigo || undefined,
                    descripcion: data.descripcion || '',
                    categoria: data.categoria,
                    esGlobal: data.esGlobal,
                    diasValidez: data.diasValidez || 365,
                    stockActual: data.stockActual || 0,
                    stockMinimo: data.stockMinimo || 5,
                    talle: data.talle || null,
                    marca: data.marca || null,
                    normaCertificacion: data.normaCertificacion || null,
                },
            });
            // Con stock inicial, el alta queda registrada en el kardex.
            if (creado.stockActual > 0) {
                await tx.eppStockMovement.create({
                    data: {
                        eppItemId: creado.id,
                        tipo: 'INGRESO',
                        cantidad: creado.stockActual,
                        stockAnterior: 0,
                        stockPosterior: creado.stockActual,
                        motivo: 'Carga inicial de inventario',
                        registradoPor: actor.nombre,
                    },
                });
            }
            return creado;
        })
        .catch(catalogoDuplicado);

    await logAudit({
        action: 'CREATE', entity: 'EPP_ITEM', entityId: item.id, userId: actor.id, userName: actor.nombre,
        newValue: { nombre: item.nombre, codigo: item.codigo, categoria: item.categoria, esGlobal: item.esGlobal, stockActual: item.stockActual },
    });

    return { ...item, _count: { deliveryItems: 0, stockMovements: item.stockActual > 0 ? 1 : 0 } };
}

export async function updateEppItem(id: string, data: z.output<typeof eppItemEditarSchema>, actor: ActorEpp) {
    return prisma
        .$transaction(async tx => {
            const actual = await tx.eppItem.findUnique({ where: { id } });
            if (!actual) throw new ErrorEpp('Elemento de EPP no encontrado', 404);

            // 1. Ajuste manual de stock, con motivo y registro en el kardex.
            let stockFinal = actual.stockActual;
            if (data.ajusteStock && data.ajusteStock.nuevoStock !== actual.stockActual) {
                const nuevo = data.ajusteStock.nuevoStock;
                const diff = nuevo - actual.stockActual;
                stockFinal = nuevo;

                await tx.eppStockMovement.create({
                    data: {
                        eppItemId: id,
                        tipo: 'AJUSTE',
                        cantidad: Math.abs(diff),
                        stockAnterior: actual.stockActual,
                        stockPosterior: nuevo,
                        motivo: `[Ajuste Manual] ${data.ajusteStock.motivo} (Diferencia: ${diff > 0 ? '+' : ''}${diff})`,
                        registradoPor: actor.nombre,
                    },
                });
                await logAudit({
                    action: 'UPDATE', entity: 'EPP_STOCK_ADJUSTMENT', entityId: id, userId: actor.id, userName: actor.nombre,
                    oldValue: { stockActual: actual.stockActual },
                    newValue: { stockActual: nuevo, motivo: data.ajusteStock.motivo, diferencia: diff },
                    metadata: { eppNombre: actual.nombre, eppCodigo: actual.codigo },
                });
            }

            // 2. Campos del elemento.
            const actualizado = await tx.eppItem.update({
                where: { id },
                data: {
                    nombre: data.nombre,
                    codigo: data.codigo !== undefined ? data.codigo || null : undefined,
                    descripcion: data.descripcion,
                    categoria: data.categoria,
                    esGlobal: data.esGlobal,
                    diasValidez: data.diasValidez,
                    stockMinimo: data.stockMinimo,
                    stockActual: stockFinal,
                    talle: data.talle !== undefined ? data.talle || null : undefined,
                    marca: data.marca !== undefined ? data.marca || null : undefined,
                    normaCertificacion: data.normaCertificacion !== undefined ? data.normaCertificacion || null : undefined,
                    activo: data.activo,
                },
            });

            await logAudit({
                action: 'UPDATE', entity: 'EPP_ITEM', entityId: id, userId: actor.id, userName: actor.nombre,
                oldValue: { nombre: actual.nombre, codigo: actual.codigo, categoria: actual.categoria, esGlobal: actual.esGlobal, diasValidez: actual.diasValidez },
                newValue: { nombre: actualizado.nombre, codigo: actualizado.codigo, categoria: actualizado.categoria, esGlobal: actualizado.esGlobal, diasValidez: actualizado.diasValidez },
            });

            return actualizado;
        })
        .catch(catalogoDuplicado);
}

// ==========================================
// 3. INGRESO DE STOCK Y MOVIMIENTOS (KARDEX)
// ==========================================

export async function addEppStock(eppItemId: string, data: z.output<typeof eppIngresoStockSchema>, actor: ActorEpp) {
    return prisma.$transaction(async tx => {
        const item = await tx.eppItem.findUnique({ where: { id: eppItemId } });
        if (!item) throw new ErrorEpp('Elemento de EPP no encontrado', 404);

        // Incremento atómico: dos ingresos simultáneos no se pisan.
        const actualizado = await tx.eppItem.update({ where: { id: eppItemId }, data: { stockActual: { increment: data.cantidad } } });
        const movement = await tx.eppStockMovement.create({
            data: {
                eppItemId,
                tipo: 'INGRESO',
                cantidad: data.cantidad,
                stockAnterior: actualizado.stockActual - data.cantidad,
                stockPosterior: actualizado.stockActual,
                motivo: data.motivo || 'Ingreso de mercadería / Compra',
                remitoFactura: data.remitoFactura || null,
                proveedor: data.proveedor || null,
                registradoPor: actor.nombre,
            },
        });
        return { item: actualizado, movement };
    });
}

export async function getEppStockMovements(eppItemId?: string) {
    return prisma.eppStockMovement.findMany({
        where: eppItemId ? { eppItemId } : {},
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
            eppItem: { select: { id: true, nombre: true, codigo: true, categoria: true, talle: true } },
            delivery: { select: { codigoActa: true, operator: { select: { nombreCompleto: true } } } },
        },
    });
}

// ==========================================
// 4. REGISTRO Y DESPACHO DE ENTREGAS (RRHH)
// ==========================================

export async function createEppDelivery(data: z.output<typeof eppEntregaSchema>, actor: ActorEpp) {
    const entregadoPor = data.entregadoPor || actor.nombre;

    const delivery = await prisma.$transaction(async tx => {
        const operador = await tx.operator.findUnique({ where: { id: data.operatorId }, select: { id: true } });
        if (!operador) throw new ErrorEpp('Operador no encontrado', 404);

        // 1. Stock suficiente para el total pedido de cada elemento.
        const pedido = new Map<string, number>();
        for (const it of data.items) pedido.set(it.eppItemId, (pedido.get(it.eppItemId) || 0) + it.cantidad);
        const dbItems = await tx.eppItem.findMany({ where: { id: { in: Array.from(pedido.keys()) } } });
        const dbItemMap = new Map(dbItems.map(i => [i.id, i]));
        for (const [eppItemId, cantidad] of Array.from(pedido.entries())) {
            const dbItem = dbItemMap.get(eppItemId);
            if (!dbItem) throw new ErrorEpp(`Elemento no encontrado en catálogo: ${eppItemId}`, 404);
            if (dbItem.stockActual < cantidad) {
                throw new ErrorEpp(`Stock insuficiente para "${dbItem.nombre}". Disponible: ${dbItem.stockActual}, Solicitado: ${cantidad}`, 409);
            }
        }

        // 2. Código de acta.
        const countThisYear = await tx.eppDelivery.count();
        const codigoActa = `EPP-ENT-${new Date().getFullYear()}-${String(countThisYear + 1).padStart(4, '0')}`;
        const firmadaPresencial = Boolean(data.firmaPresencialBase64);

        // 3. Acta de entrega.
        const acta = await tx.eppDelivery.create({
            data: {
                codigoActa,
                operatorId: data.operatorId,
                entregadoPor,
                estado: firmadaPresencial ? 'FIRMADA' : 'PENDIENTE_FIRMA',
                firmaManuscritaUrl: data.firmaPresencialBase64 || null,
                signedAt: firmadaPresencial ? new Date() : null,
                observaciones: data.observaciones || null,
            },
        });

        // 4. Ítems, descuento de stock y kardex.
        const now = new Date();
        for (const it of data.items) {
            const dbItem = dbItemMap.get(it.eppItemId)!;
            const dias = dbItem.diasValidez || 365;

            await tx.eppDeliveryItem.create({
                data: {
                    deliveryId: acta.id,
                    eppItemId: dbItem.id,
                    cantidad: it.cantidad,
                    talle: it.talle || dbItem.talle || null,
                    confirmadoPorOperador: firmadaPresencial,
                    fechaEntrega: now,
                    diasValidez: dias,
                    fechaVencimiento: new Date(now.getTime() + dias * DIA_MS),
                    estado: firmadaPresencial ? 'VIGENTE' : 'PENDIENTE',
                },
            });

            // Descuento condicionado: si otro despacho se llevó el stock, falla en vez de quedar negativo.
            const descontado = await tx.eppItem.updateMany({
                where: { id: dbItem.id, stockActual: { gte: it.cantidad } },
                data: { stockActual: { decrement: it.cantidad } },
            });
            if (descontado.count === 0) throw new ErrorEpp(`Stock insuficiente para "${dbItem.nombre}".`, 409);
            const { stockActual } = await tx.eppItem.findUniqueOrThrow({ where: { id: dbItem.id }, select: { stockActual: true } });

            await tx.eppStockMovement.create({
                data: {
                    eppItemId: dbItem.id,
                    tipo: 'EGRESO_ENTREGA',
                    cantidad: it.cantidad,
                    stockAnterior: stockActual + it.cantidad,
                    stockPosterior: stockActual,
                    deliveryId: acta.id,
                    motivo: `Entrega a operador según Acta ${codigoActa}`,
                    registradoPor: entregadoPor,
                },
            });
        }

        return acta;
    });

    await logAudit({
        action: 'CREATE', entity: 'EPP_DELIVERY', entityId: delivery.id, userId: actor.id, userName: actor.nombre,
        newValue: { codigoActa: delivery.codigoActa, operatorId: delivery.operatorId, estado: delivery.estado, items: data.items.length },
    });
    return delivery;
}

// ==========================================
// 5. SOLICITUDES DE EPP (DESDE OPERADORES)
// ==========================================

export async function getEppRequests() {
    return prisma.eppRequest.findMany({
        orderBy: { fechaSolicitud: 'desc' },
        include: {
            operator: { select: { id: true, nombreCompleto: true, dni: true, posicion: true } },
            eppItem: true,
        },
    });
}

export async function resolveEppRequest(id: string, data: z.output<typeof eppResolverSolicitudSchema>, actor: ActorEpp) {
    const actual = await prisma.eppRequest.findUnique({ where: { id }, select: { estado: true } });
    if (!actual) throw new ErrorEpp('Solicitud no encontrada', 404);
    if (actual.estado !== 'PENDIENTE') throw new ErrorEpp('La solicitud ya fue resuelta.', 409);

    const updated = await prisma.eppRequest.update({
        where: { id },
        data: {
            estado: data.accion === 'APROBAR' ? 'APROBADA' : 'RECHAZADA',
            fechaResolucion: new Date(),
            resueltoPor: actor.nombre,
            motivoRechazo: data.motivoRechazo || null,
        },
    });
    await logAudit({
        action: data.accion === 'APROBAR' ? 'APPROVE' : 'REJECT', entity: 'EPP_REQUEST', entityId: id,
        userId: actor.id, userName: actor.nombre, newValue: { estado: updated.estado, motivoRechazo: updated.motivoRechazo },
    });
    return updated;
}

// ==========================================
// 6. HISTORIAL COMPLETO DE UN OPERADOR
// ==========================================

export async function getOperatorEppProfile(operatorId: string) {
    const [operator, deliveries, requests] = await Promise.all([
        prisma.operator.findUnique({
            where: { id: operatorId },
            select: { id: true, nombreCompleto: true, dni: true, posicion: true, role: true, etiquetas: true },
        }),
        prisma.eppDelivery.findMany({
            where: { operatorId },
            orderBy: { fechaEntrega: 'desc' },
            include: { items: { include: { eppItem: true } } },
        }),
        prisma.eppRequest.findMany({ where: { operatorId }, orderBy: { fechaSolicitud: 'desc' }, include: { eppItem: true } }),
    ]);
    if (!operator) throw new ErrorEpp('Operador no encontrado', 404);
    return { operator, deliveries, requests };
}

// ==========================================
// 7. ENLACES PÚBLICOS Y COMPARTICIÓN DE MATRIZ
// ==========================================

export async function getClientsForEppShare() {
    return prisma.hdbClient.findMany({ where: { activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } });
}

export async function createEppPublicShare(data: z.output<typeof eppEnlaceSchema>, actor: ActorEpp) {
    let clientNombre: string | null = null;
    let titulo = data.titulo || 'Matriz General de EPP';

    if (data.tipo === 'CLIENTE') {
        const client = await prisma.hdbClient.findUnique({ where: { id: data.clientId! } });
        if (!client) throw new ErrorEpp('Cliente no encontrado', 404);
        clientNombre = client.nombre;
        titulo = data.titulo || `Matriz de EPP - ${client.nombre}`;
    }

    const share = await prisma.eppPublicShare.create({
        data: {
            token: crypto.randomBytes(16).toString('hex'),
            titulo,
            tipo: data.tipo,
            clientId: data.tipo === 'CLIENTE' ? data.clientId! : null,
            clientNombre,
            creadoPor: actor.nombre,
            activo: true,
        },
    });
    await logAudit({
        action: 'CREATE', entity: 'EPP_PUBLIC_SHARE', entityId: share.id, userId: actor.id, userName: actor.nombre,
        newValue: { titulo: share.titulo, tipo: share.tipo, clientNombre },
    });
    return share;
}

export async function getEppPublicShares() {
    return prisma.eppPublicShare.findMany({
        orderBy: { createdAt: 'desc' },
        include: { client: { select: { id: true, nombre: true } } },
    });
}

export async function deleteEppPublicShare(id: string, actor: ActorEpp) {
    const share = await prisma.eppPublicShare.delete({ where: { id } });
    await logAudit({
        action: 'DELETE', entity: 'EPP_PUBLIC_SHARE', entityId: id, userId: actor.id, userName: actor.nombre,
        oldValue: { titulo: share.titulo, tipo: share.tipo, clientNombre: share.clientNombre },
    });
    return null;
}

/** Matriz que ve un cliente con el enlace público. Sin sesión: la protege el token. */
export async function getPublicEppMatrixData(token: string) {
    const share = await prisma.eppPublicShare.findFirst({ where: { token, activo: true } });
    if (!share) throw new ErrorEpp('El enlace de la matriz no es válido o ha sido desactivado.', 404);

    await prisma.eppPublicShare
        .update({ where: { id: share.id }, data: { visitas: { increment: 1 }, ultimaVisita: new Date() } })
        .catch(() => {});

    const selectOperador = { id: true, nombreCompleto: true, dni: true, posicion: true, role: true } as const;
    let operadores: { id: string; nombreCompleto: string; dni: string | null; posicion: string | null; role: string }[];

    if (share.tipo === 'CLIENTE' && share.clientId) {
        // Operarios con horas en proyectos del cliente durante los últimos 3 meses.
        const projects = await prisma.project.findMany({
            where: { OR: [{ clientId: share.clientId }, ...(share.clientNombre ? [{ cliente: share.clientNombre }] : [])] },
            select: { id: true },
        });
        const projectIds = projects.map(p => p.id);
        const desde = new Date();
        desde.setMonth(desde.getMonth() - 3);
        const fechaLimite = desde.toISOString().split('T')[0];
        const filtro = { projectId: { in: projectIds }, fecha: { gte: fechaLimite }, horasTrabajadas: { gt: 0 } };

        const [timeEntries, fichadas] = await Promise.all([
            prisma.timeEntry.findMany({ where: filtro, select: { operatorId: true }, distinct: ['operatorId'] }),
            prisma.fichada.findMany({ where: filtro, select: { operatorId: true }, distinct: ['operatorId'] }),
        ]);
        const ids = Array.from(new Set([...timeEntries.map(t => t.operatorId), ...fichadas.map(f => f.operatorId)]));
        operadores = await prisma.operator.findMany({ where: { id: { in: ids }, activo: true }, orderBy: { nombreCompleto: 'asc' }, select: selectOperador });
    } else {
        operadores = await prisma.operator.findMany({ where: { activo: true }, orderBy: { nombreCompleto: 'asc' }, select: selectOperador });
    }

    const eppGlobales = await prisma.eppItem.findMany({
        where: { esGlobal: true, activo: true },
        orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
    });

    const deliveries = await prisma.eppDelivery.findMany({
        where: { operatorId: { in: operadores.map(o => o.id) } },
        include: { items: { include: { eppItem: true } } },
        orderBy: { fechaEntrega: 'desc' },
    });

    const matriz: Record<string, Record<string, any>> = {};
    for (const op of operadores) {
        matriz[op.id] = {};
        for (const epp of eppGlobales) matriz[op.id][epp.id] = celdaVacia();
    }

    const now = Date.now();
    for (const del of deliveries) {
        for (const item of del.items) {
            const celda = matriz[del.operatorId]?.[item.eppItemId];
            if (!celda || celda.estado !== 'SIN_ENTREGA') continue;
            const base = {
                item,
                fechaEntrega: item.fechaEntrega,
                fechaVencimiento: item.fechaVencimiento,
                codigoActa: del.codigoActa,
                deliveryId: del.id,
            };
            if (del.estado === 'PENDIENTE_FIRMA') {
                matriz[del.operatorId][item.eppItemId] = { estado: 'PENDIENTE_FIRMA', diasRestantes: null, ...base };
            } else if (del.estado === 'FIRMADA') {
                matriz[del.operatorId][item.eppItemId] = {
                    ...vigencia(item.fechaVencimiento, now), ...base, signatureId: del.signatureId, signatureHash: del.signatureHash,
                };
            }
        }
    }

    const stats = { vigentesCount: 0, porVencerCount: 0, vencidosCount: 0, sinEntregaCount: 0, pendientesFirmaCount: 0 };
    const rows = operadores.map(op => {
        const cells = eppGlobales.map(epp => {
            const cell = matriz[op.id][epp.id];
            if (cell.estado === 'VIGENTE') stats.vigentesCount++;
            else if (cell.estado === 'POR_VENCER') stats.porVencerCount++;
            else if (cell.estado === 'VENCIDO') stats.vencidosCount++;
            else if (cell.estado === 'PENDIENTE_FIRMA') stats.pendientesFirmaCount++;
            else stats.sinEntregaCount++;
            return { eppItemId: epp.id, ...cell };
        });

        let generalStatus = 'AL_DIA';
        if (cells.some(c => c.estado === 'VENCIDO')) generalStatus = 'CON_VENCIDOS';
        else if (cells.some(c => c.estado === 'POR_VENCER')) generalStatus = 'POR_VENCER';
        else if (cells.some(c => c.estado === 'PENDIENTE_FIRMA')) generalStatus = 'PENDIENTE_FIRMA';
        else if (cells.every(c => c.estado === 'SIN_ENTREGA')) generalStatus = 'SIN_COBERTURA';

        return { operator: op, cells, generalStatus, historialDeliveries: deliveries.filter(d => d.operatorId === op.id) };
    });

    const totalSlots = operadores.length * eppGlobales.length;
    return {
        share: { id: share.id, titulo: share.titulo, tipo: share.tipo, clientNombre: share.clientNombre, createdAt: share.createdAt },
        operadoresCount: operadores.length,
        eppGlobales,
        rows,
        stats: {
            totalOperadores: operadores.length,
            totalEppGlobales: eppGlobales.length,
            ...stats,
            porcentajeCobertura: totalSlots > 0 ? Math.round((stats.vigentesCount / totalSlots) * 100) : 0,
        },
        updatedAt: new Date(),
    };
}

// ==========================================
// 8. MIS EPP (PORTAL DEL OPERADOR)
// ==========================================
// Siempre sobre el operador de la sesión: el cliente no elige de quién son los datos.

export async function getMyEppData(operatorId: string) {
    const now = Date.now();
    const includeItems = { items: { include: { eppItem: true } } } as const;

    const [operador, pendingDeliveries, signedDeliveries, requests, catalog] = await Promise.all([
        prisma.operator.findUnique({ where: { id: operatorId }, select: { id: true, nombreCompleto: true, dni: true } }),
        prisma.eppDelivery.findMany({ where: { operatorId, estado: 'PENDIENTE_FIRMA' }, include: includeItems, orderBy: { fechaEntrega: 'desc' } }),
        prisma.eppDelivery.findMany({ where: { operatorId, estado: 'FIRMADA' }, include: includeItems, orderBy: { fechaEntrega: 'desc' } }),
        prisma.eppRequest.findMany({ where: { operatorId }, include: { eppItem: true }, orderBy: { fechaSolicitud: 'desc' } }),
        prisma.eppItem.findMany({
            where: { activo: true },
            orderBy: [{ esGlobal: 'desc' }, { nombre: 'asc' }],
            select: { id: true, codigo: true, nombre: true, categoria: true, esGlobal: true, talle: true, diasValidez: true, stockActual: true },
        }),
    ]);
    if (!operador) throw new ErrorEpp('Operador no encontrado', 404);

    // EPP asignados: la última entrega confirmada de cada elemento.
    const asignados = new Map<string, any>();
    for (const delivery of signedDeliveries) {
        for (const item of delivery.items) {
            if (!item.confirmadoPorOperador || asignados.has(item.eppItemId)) continue;
            const v = vigencia(item.fechaVencimiento, now);
            asignados.set(item.eppItemId, {
                ...item,
                deliveryCode: delivery.codigoActa,
                entregadoPor: delivery.entregadoPor,
                signatureId: delivery.signatureId,
                signatureHash: delivery.signatureHash,
                diasRestantes: v.diasRestantes,
                estadoVigencia: v.estado,
            });
        }
    }

    return { operador, pendingDeliveries, assignedItems: Array.from(asignados.values()), signedDeliveries, requests, catalog };
}

/**
 * El operador de la sesión firma una entrega suya. La firma con checksum se
 * genera acá con los datos de la sesión, en la misma transacción que el acta.
 */
export async function signEppDelivery(
    deliveryId: string,
    data: z.output<typeof eppFirmaEntregaSchema>,
    actor: ActorEpp,
    ipAddress: string,
) {
    const operador = await prisma.operator.findUnique({ where: { id: actor.id }, select: { nombreCompleto: true, dni: true } });
    if (!operador) throw new ErrorEpp('Operador no encontrado', 404);

    const result = await prisma.$transaction(async tx => {
        const delivery = await tx.eppDelivery.findUnique({ where: { id: deliveryId }, include: { items: { include: { eppItem: true } } } });
        // Un acta de otro operador responde igual que una inexistente.
        if (!delivery || delivery.operatorId !== actor.id) throw new ErrorEpp('Acta de entrega no encontrada', 404);
        if (delivery.estado !== 'PENDIENTE_FIRMA') throw new ErrorEpp('Esta entrega ya fue firmada previamente', 409);

        const confirmados = new Set(data.itemIdsConfirmed.filter(id => delivery.items.some(i => i.id === id)));
        if (confirmados.size === 0) throw new ErrorEpp('Debe seleccionar y confirmar al menos un ítem entregado', 400);

        const now = new Date();
        const signatureId = generateSignatureId();
        const deviceId = data.deviceId || 'UNKNOWN_DEVICE';
        const dni = operador.dni || '00000000';
        const hash = generateSignatureHash(delivery.id, '1.0', actor.id, operador.nombreCompleto, dni, deviceId, now);

        // Marca la firma solo si sigue pendiente: dos firmas simultáneas no pasan las dos.
        const marcada = await tx.eppDelivery.updateMany({
            where: { id: deliveryId, operatorId: actor.id, estado: 'PENDIENTE_FIRMA' },
            data: { estado: 'FIRMADA', signatureId, signatureHash: hash, firmaManuscritaUrl: data.firmaManuscritaUrl || null, signedAt: now },
        });
        if (marcada.count === 0) throw new ErrorEpp('Esta entrega ya fue firmada previamente', 409);

        await tx.documentSignatureAudit.create({
            data: {
                SignatureID: signatureId,
                DocumentID: delivery.id,
                DocumentVersion: '1.0',
                UserID: actor.id,
                UserName: operador.nombreCompleto,
                DNI: dni,
                DeviceID: deviceId,
                IPAddress: ipAddress,
                SignedAtUTC: now,
                HashSignature: hash,
                VerificationStatus: 'VALIDA',
            },
        });

        for (const item of delivery.items) {
            if (confirmados.has(item.id)) {
                const dias = item.diasValidez || item.eppItem.diasValidez || 365;
                await tx.eppDeliveryItem.update({
                    where: { id: item.id },
                    data: { confirmadoPorOperador: true, fechaEntrega: now, fechaVencimiento: new Date(now.getTime() + dias * DIA_MS), estado: 'VIGENTE' },
                });
            } else {
                // No recibido: vuelve al stock.
                await tx.eppDeliveryItem.update({ where: { id: item.id }, data: { confirmadoPorOperador: false, estado: 'RECHAZADO_NO_RECIBIDO' } });
                const devuelto = await tx.eppItem.update({ where: { id: item.eppItemId }, data: { stockActual: { increment: item.cantidad } } });
                await tx.eppStockMovement.create({
                    data: {
                        eppItemId: item.eppItemId,
                        tipo: 'AJUSTE',
                        cantidad: item.cantidad,
                        stockAnterior: devuelto.stockActual - item.cantidad,
                        stockPosterior: devuelto.stockActual,
                        deliveryId: delivery.id,
                        motivo: `Devolución al pañol: no recibido por operario en Acta ${delivery.codigoActa}`,
                        registradoPor: `${operador.nombreCompleto} (operario)`,
                    },
                });
            }
        }

        return { id: delivery.id, codigoActa: delivery.codigoActa, estado: 'FIRMADA', signatureId, signatureHash: hash, signedAt: now };
    });

    await logAudit({
        action: 'CREATE', entity: 'SIGNATURE_AUDIT', entityId: result.signatureId, userId: actor.id, userName: operador.nombreCompleto,
        newValue: { documento: 'EPP_DELIVERY', deliveryId, codigoActa: result.codigoActa },
    });
    return result;
}

export async function createOperatorEppRequest(data: z.output<typeof eppSolicitudSchema>, actor: ActorEpp) {
    const item = await prisma.eppItem.findFirst({ where: { id: data.eppItemId, activo: true }, select: { id: true } });
    if (!item) throw new ErrorEpp('Elemento de EPP no encontrado', 404);

    return prisma.eppRequest.create({
        data: {
            operatorId: actor.id,
            eppItemId: data.eppItemId,
            talle: data.talle || null,
            motivo: data.motivo,
            comentario: data.comentario || null,
            estado: 'PENDIENTE',
        },
    });
}
