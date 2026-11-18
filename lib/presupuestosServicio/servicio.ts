/**
 * Presupuestos de servicio: lógica de servidor.
 *
 * Estados del presupuesto: borrador → enviado → aceptado | rechazado | vencido.
 * Cada cambio después de enviar abre una revisión nueva (v2, v3…); las anteriores no se tocan.
 * Al aceptar se guarda una copia congelada (PresupuestoServicioSnapshot) con hash SHA-256.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { stringifyCanonical, computeSha256 } from '@/lib/ot/canonicalHash';
import {
    calcularPresupuesto,
    hoyArgentina,
    sumarDias,
    normalizarOpcionesDocumento,
    OPCIONES_DOCUMENTO_DEFECTO,
    r2,
    type EstadoPresupuesto,
    type OpcionesDocumento,
    type ResultadoCalculo,
} from './calculos';
import type { ContenidoPresupuestoInput } from './schemas';
import { ErrorNegocio, type UsuarioSesion } from './sesion';

const ENTIDAD = 'PRESUPUESTO_SERVICIO';
export const ESQUEMA_SNAPSHOT = '1.0';

type Tx = Prisma.TransactionClient;

export const includeVersion = {
    tareas: { orderBy: { orden: 'asc' as const }, include: { manoObra: { orderBy: { orden: 'asc' as const } } } },
    materiales: { orderBy: { orden: 'asc' as const } },
} satisfies Prisma.PresupuestoServicioVersionInclude;

// ── Lista de precios e IVA ─────────────────────────────────────────

/**
 * Lista de precios del presupuesto: la elegida; si no, la del cliente; si no, la predeterminada.
 * Define si el IVA va discriminado, igual que en Cotizaciones.
 */
export async function resolverListaPrecio(listaPrecioId: string | null, clienteId: string | null) {
    const sel = { id: true, nombre: true, ivaDiscriminado: true, activo: true } as const;
    if (listaPrecioId) {
        const l = await prisma.listaPrecio.findUnique({ where: { id: listaPrecioId }, select: sel });
        if (l && l.activo) return l;
    }
    if (clienteId) {
        const c = await prisma.hdbClient.findUnique({ where: { id: clienteId }, select: { listaPrecio: { select: sel } } });
        if (c?.listaPrecio?.activo) return c.listaPrecio;
    }
    const pred = await prisma.listaPrecio.findFirst({ where: { esPredeterminada: true, activo: true }, select: sel });
    if (pred) return pred;
    return prisma.listaPrecio.findFirst({ where: { activo: true }, orderBy: { orden: 'asc' }, select: sel });
}

// ── Preparación del contenido de una versión ───────────────────────

interface ContenidoPreparado {
    clienteId: string | null;
    clienteNombre: string;
    titulo: string;
    version: Omit<Prisma.PresupuestoServicioVersionUncheckedCreateInput, 'presupuestoId' | 'version' | 'estado' | 'tareas' | 'materiales'>;
    calculo: ResultadoCalculo;
}

async function prepararContenido(input: ContenidoPresupuestoInput, usuario: UsuarioSesion): Promise<ContenidoPreparado> {
    if (input.tareas.length === 0 && input.materiales.length === 0) {
        throw new ErrorNegocio('Cargá al menos una tarea o un material');
    }
    for (const t of input.tareas) {
        if (t.manoObra.length === 0) throw new ErrorNegocio(`La tarea "${t.descripcion}" no tiene mano de obra`);
    }

    let clienteId: string | null = null;
    let clienteNombre = input.clienteNombre || '';
    if (input.clienteId) {
        const c = await prisma.hdbClient.findUnique({ where: { id: input.clienteId }, select: { id: true, nombre: true } });
        if (!c) throw new ErrorNegocio('El cliente elegido no existe');
        clienteId = c.id;
        clienteNombre = clienteNombre || c.nombre;
    }
    if (!clienteNombre) throw new ErrorNegocio('Elegí el cliente');

    const lista = await resolverListaPrecio(input.listaPrecioId, clienteId);
    const ivaDiscriminado = Boolean(lista?.ivaDiscriminado);

    // Productos y categorías que ya no existen quedan como texto (sin vínculo).
    const productoIds = input.materiales.map((m) => m.productoId).filter((x): x is string => Boolean(x));
    const productosValidos = new Set(
        productoIds.length ? (await prisma.producto.findMany({ where: { id: { in: productoIds } }, select: { id: true } })).map((p) => p.id) : []
    );
    const categoriaIds = input.tareas.flatMap((t) => t.manoObra.map((l) => l.categoriaId)).filter((x): x is string => Boolean(x));
    const categoriasValidas = new Set(
        categoriaIds.length ? (await prisma.manoObraCategoria.findMany({ where: { id: { in: categoriaIds } }, select: { id: true } })).map((c) => c.id) : []
    );

    const calculo = calcularPresupuesto({
        ivaDiscriminado,
        descuentoPorcentaje: input.descuentoPorcentaje,
        tareas: input.tareas.map((t) => ({
            descripcion: t.descripcion,
            etiqueta: t.etiqueta,
            manoObra: t.manoObra.map((l) => ({ ...l, categoriaId: l.categoriaId && categoriasValidas.has(l.categoriaId) ? l.categoriaId : null })),
        })),
        materiales: input.materiales.map((m) => ({ ...m, productoId: m.productoId && productosValidos.has(m.productoId) ? m.productoId : null })),
    });

    return {
        clienteId,
        clienteNombre,
        titulo: input.titulo,
        calculo,
        version: {
            alcance: input.alcance,
            condiciones: input.condiciones,
            fechaInicioTentativa: input.fechaInicioTentativa,
            fechaFinTentativa: input.fechaFinTentativa,
            operariosSimultaneos: input.operariosSimultaneos,
            validezDias: input.validezDias,
            listaPrecioId: lista?.id ?? null,
            listaPrecioNombre: lista?.nombre ?? null,
            ivaDiscriminado,
            descuentoPorcentaje: calculo.descuentoPorcentaje,
            horasTotales: calculo.horasTotales,
            subtotalManoObra: calculo.subtotalManoObra,
            subtotalMateriales: calculo.subtotalMateriales,
            descuentoMonto: calculo.descuentoMonto,
            neto: calculo.neto,
            impuestos: calculo.impuestos,
            total: calculo.total,
            notaRevision: input.notaRevision,
            creadoPorId: usuario.id,
            creadoPorNombre: usuario.nombre,
        },
    };
}

/** Crea tareas, líneas de mano de obra y materiales de una versión. */
async function crearDetalle(tx: Tx, versionId: string, calculo: ResultadoCalculo) {
    for (let i = 0; i < calculo.tareas.length; i++) {
        const t = calculo.tareas[i];
        await tx.presupuestoServicioTarea.create({
            data: {
                versionId,
                orden: i + 1,
                descripcion: t.descripcion,
                etiqueta: t.etiqueta || null,
                horas: t.horas,
                importe: t.importe,
                manoObra: {
                    create: t.manoObra.map((l, j) => ({
                        orden: j + 1,
                        categoriaId: l.categoriaId || null,
                        categoriaNombre: l.categoriaNombre,
                        modo: l.modo,
                        horas: l.horas,
                        valorHora: l.valorHora,
                        importe: l.importe,
                        ivaPorcentaje: l.ivaPorcentaje,
                    })),
                },
            },
        });
    }
    if (calculo.materiales.length) {
        await tx.presupuestoServicioMaterial.createMany({
            data: calculo.materiales.map((m, i) => ({
                versionId,
                orden: i + 1,
                productoId: m.productoId || null,
                sku: m.sku || null,
                descripcion: m.descripcion,
                unidad: m.unidad || null,
                cantidad: m.cantidad,
                precioUnitario: m.precioUnitario,
                precioModificado: Boolean(m.precioModificado),
                ivaPorcentaje: m.ivaPorcentaje,
                subtotal: m.subtotal,
            })),
        });
    }
}

async function generarNumero(tx: Tx): Promise<string> {
    const year = Number(hoyArgentina().slice(0, 4));
    const c = await tx.presupuestoServicioCounter.upsert({
        where: { year },
        update: { currentNumber: { increment: 1 } },
        create: { year, currentNumber: 1 },
    });
    return `PS-${year}-${String(c.currentNumber).padStart(6, '0')}`;
}

// ── Lectura ────────────────────────────────────────────────────────

/** Pasa a "vencido" los enviados cuya validez terminó. Se llama al leer. */
export async function marcarVencidos(): Promise<number> {
    const hoy = hoyArgentina();
    const vencidos = await prisma.presupuestoServicio.findMany({
        where: { estado: 'enviado', fechaVencimiento: { not: null, lt: hoy } },
        select: { id: true, numero: true, fechaVencimiento: true },
    });
    if (vencidos.length === 0) return 0;
    await prisma.presupuestoServicio.updateMany({
        where: { id: { in: vencidos.map((v) => v.id) }, estado: 'enviado' },
        data: { estado: 'vencido' },
    });
    for (const v of vencidos) {
        await logAudit({
            userName: 'Sistema',
            action: 'UPDATE',
            entity: ENTIDAD,
            entityId: v.id,
            oldValue: { estado: 'enviado' },
            newValue: { estado: 'vencido' },
            metadata: { evento: 'VENCIMIENTO', numero: v.numero, fechaVencimiento: v.fechaVencimiento },
        });
    }
    return vencidos.length;
}

export async function listarPresupuestos(filtros: { q?: string; estado?: string; clienteId?: string; page?: number; limit?: number }) {
    await marcarVencidos();
    const page = Math.max(1, filtros.page || 1);
    const limit = Math.min(100, Math.max(1, filtros.limit || 25));
    const where: Prisma.PresupuestoServicioWhereInput = {};
    if (filtros.clienteId) where.clienteId = filtros.clienteId;
    if (filtros.q) {
        where.OR = [
            { numero: { contains: filtros.q, mode: 'insensitive' } },
            { clienteNombre: { contains: filtros.q, mode: 'insensitive' } },
            { titulo: { contains: filtros.q, mode: 'insensitive' } },
        ];
    }
    const whereEstado = filtros.estado ? { ...where, estado: filtros.estado } : where;

    const [total, filas, porEstado, sinConvertir] = await Promise.all([
        prisma.presupuestoServicio.count({ where: whereEstado }),
        prisma.presupuestoServicio.findMany({
            where: whereEstado,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                proyecto: { select: { id: true, codigoProyecto: true, nombre: true } },
                versiones: {
                    orderBy: { version: 'desc' },
                    take: 1,
                    select: {
                        version: true, estado: true, total: true, neto: true, horasTotales: true,
                        fechaInicioTentativa: true, fechaFinTentativa: true, ivaDiscriminado: true,
                    },
                },
            },
        }),
        prisma.presupuestoServicio.groupBy({ by: ['estado'], where, _count: { _all: true } }),
        prisma.presupuestoServicio.count({ where: { ...where, estado: 'aceptado', proyectoId: null } }),
    ]);

    const conteos: Record<string, number> = { borrador: 0, enviado: 0, aceptado: 0, rechazado: 0, vencido: 0 };
    for (const g of porEstado) conteos[g.estado] = g._count._all;

    return {
        presupuestos: filas.map(({ versiones, ...p }) => ({ ...p, versionVigente: versiones[0] || null })),
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        conteos,
        aceptadosSinConvertir: sinConvertir,
    };
}

export async function obtenerPresupuesto(id: string) {
    await marcarVencidos();
    const p = await prisma.presupuestoServicio.findUnique({
        where: { id },
        include: {
            cliente: { select: { id: true, nombre: true, email: true, telefono: true, direccion: true, listaPrecioId: true } },
            proyecto: { select: { id: true, codigoProyecto: true, nombre: true, estado: true } },
            versiones: { orderBy: { version: 'desc' }, include: includeVersion },
            snapshot: true,
        },
    });
    if (!p) throw new ErrorNegocio('Presupuesto no encontrado', 404);
    return {
        ...p,
        snapshot: p.snapshot ? { ...p.snapshot, integra: verificarSnapshot(p.snapshot) } : null,
    };
}

// ── Escritura ──────────────────────────────────────────────────────

export async function crearPresupuesto(input: ContenidoPresupuestoInput, usuario: UsuarioSesion) {
    const prep = await prepararContenido(input, usuario);
    const creado = await prisma.$transaction(
        async (tx) => {
            const numero = await generarNumero(tx);
            const p = await tx.presupuestoServicio.create({
                data: {
                    numero,
                    clienteId: prep.clienteId,
                    clienteNombre: prep.clienteNombre,
                    titulo: prep.titulo,
                    estado: 'borrador',
                    versionActual: 1,
                    creadoPorId: usuario.id,
                    creadoPorNombre: usuario.nombre,
                },
            });
            const v = await tx.presupuestoServicioVersion.create({
                data: { ...prep.version, presupuestoId: p.id, version: 1, estado: 'borrador', opcionesDocumento: OPCIONES_DOCUMENTO_DEFECTO as any },
            });
            await crearDetalle(tx, v.id, prep.calculo);
            return p;
        },
        { maxWait: 15000, timeout: 30000 }
    );
    await logAudit({
        userId: usuario.id,
        userName: usuario.nombre,
        action: 'CREATE',
        entity: ENTIDAD,
        entityId: creado.id,
        newValue: { numero: creado.numero, cliente: prep.clienteNombre, titulo: prep.titulo, version: 1, total: prep.calculo.total },
    });
    return creado;
}

/** Edita la revisión vigente. Solo mientras el presupuesto está en borrador. */
export async function actualizarPresupuesto(id: string, input: ContenidoPresupuestoInput, usuario: UsuarioSesion) {
    const actual = await prisma.presupuestoServicio.findUnique({
        where: { id },
        include: { versiones: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!actual) throw new ErrorNegocio('Presupuesto no encontrado', 404);
    const vigente = actual.versiones[0];
    if (actual.estado !== 'borrador' || !vigente || vigente.estado !== 'borrador') {
        throw new ErrorNegocio('Solo se puede editar un presupuesto en borrador. Para cambiar uno enviado, abrí una nueva revisión.', 409);
    }
    const prep = await prepararContenido(input, usuario);
    await prisma.$transaction(
        async (tx) => {
            await tx.presupuestoServicioTarea.deleteMany({ where: { versionId: vigente.id } });
            await tx.presupuestoServicioMaterial.deleteMany({ where: { versionId: vigente.id } });
            const { creadoPorId: _c, creadoPorNombre: _n, ...datosVersion } = prep.version;
            await tx.presupuestoServicioVersion.update({ where: { id: vigente.id }, data: datosVersion });
            await crearDetalle(tx, vigente.id, prep.calculo);
            await tx.presupuestoServicio.update({
                where: { id },
                data: { clienteId: prep.clienteId, clienteNombre: prep.clienteNombre, titulo: prep.titulo },
            });
        },
        { maxWait: 15000, timeout: 30000 }
    );
    await logAudit({
        userId: usuario.id,
        userName: usuario.nombre,
        action: 'UPDATE',
        entity: ENTIDAD,
        entityId: id,
        oldValue: { titulo: actual.titulo, cliente: actual.clienteNombre, total: vigente.total, horas: vigente.horasTotales },
        newValue: { titulo: prep.titulo, cliente: prep.clienteNombre, total: prep.calculo.total, horas: prep.calculo.horasTotales },
        metadata: { numero: actual.numero, version: vigente.version },
    });
    return obtenerPresupuesto(id);
}

/** Copia la revisión vigente a una nueva (v+1) en borrador. */
export async function crearRevision(id: string, nota: string | null, usuario: UsuarioSesion) {
    const actual = await prisma.presupuestoServicio.findUnique({
        where: { id },
        include: { versiones: { orderBy: { version: 'desc' }, take: 1, include: includeVersion } },
    });
    if (!actual) throw new ErrorNegocio('Presupuesto no encontrado', 404);
    if (!['enviado', 'rechazado', 'vencido'].includes(actual.estado)) {
        throw new ErrorNegocio(
            actual.estado === 'aceptado'
                ? 'Un presupuesto aceptado no se modifica. Duplicalo para armar uno nuevo.'
                : 'El presupuesto ya está en borrador: editalo directamente.',
            409
        );
    }
    const v = actual.versiones[0];
    const nueva = v.version + 1;

    await prisma.$transaction(
        async (tx) => {
            const ok = await tx.presupuestoServicio.updateMany({
                where: { id, estado: actual.estado, versionActual: v.version },
                data: { estado: 'borrador', versionActual: nueva, fechaVencimiento: null, motivoRechazo: null },
            });
            if (ok.count !== 1) throw new ErrorNegocio('El presupuesto cambió mientras tanto. Recargá la página.', 409);
            if (v.estado === 'enviada') {
                await tx.presupuestoServicioVersion.update({ where: { id: v.id }, data: { estado: 'reemplazada' } });
            }
            const copia = await tx.presupuestoServicioVersion.create({
                data: {
                    presupuestoId: id,
                    version: nueva,
                    estado: 'borrador',
                    alcance: v.alcance,
                    condiciones: v.condiciones,
                    fechaInicioTentativa: v.fechaInicioTentativa,
                    fechaFinTentativa: v.fechaFinTentativa,
                    operariosSimultaneos: v.operariosSimultaneos,
                    validezDias: v.validezDias,
                    listaPrecioId: v.listaPrecioId,
                    listaPrecioNombre: v.listaPrecioNombre,
                    ivaDiscriminado: v.ivaDiscriminado,
                    descuentoPorcentaje: v.descuentoPorcentaje,
                    horasTotales: v.horasTotales,
                    subtotalManoObra: v.subtotalManoObra,
                    subtotalMateriales: v.subtotalMateriales,
                    descuentoMonto: v.descuentoMonto,
                    neto: v.neto,
                    impuestos: v.impuestos,
                    total: v.total,
                    opcionesDocumento: (v.opcionesDocumento ?? OPCIONES_DOCUMENTO_DEFECTO) as any,
                    notaRevision: nota,
                    creadoPorId: usuario.id,
                    creadoPorNombre: usuario.nombre,
                },
            });
            for (const t of v.tareas) {
                await tx.presupuestoServicioTarea.create({
                    data: {
                        versionId: copia.id,
                        orden: t.orden,
                        descripcion: t.descripcion,
                        etiqueta: t.etiqueta,
                        horas: t.horas,
                        importe: t.importe,
                        manoObra: {
                            create: t.manoObra.map((l) => ({
                                orden: l.orden, categoriaId: l.categoriaId, categoriaNombre: l.categoriaNombre, modo: l.modo,
                                horas: l.horas, valorHora: l.valorHora, importe: l.importe, ivaPorcentaje: l.ivaPorcentaje,
                            })),
                        },
                    },
                });
            }
            if (v.materiales.length) {
                await tx.presupuestoServicioMaterial.createMany({
                    data: v.materiales.map((m) => ({
                        versionId: copia.id, orden: m.orden, productoId: m.productoId, sku: m.sku, descripcion: m.descripcion,
                        unidad: m.unidad, cantidad: m.cantidad, precioUnitario: m.precioUnitario, precioModificado: m.precioModificado,
                        ivaPorcentaje: m.ivaPorcentaje, subtotal: m.subtotal,
                    })),
                });
            }
        },
        { maxWait: 15000, timeout: 30000 }
    );
    await logAudit({
        userId: usuario.id,
        userName: usuario.nombre,
        action: 'UPDATE',
        entity: ENTIDAD,
        entityId: id,
        oldValue: { estado: actual.estado, version: v.version },
        newValue: { estado: 'borrador', version: nueva },
        metadata: { evento: 'NUEVA_REVISION', numero: actual.numero, nota },
    });
    return obtenerPresupuesto(id);
}

export async function enviarPresupuesto(id: string, opciones: Partial<OpcionesDocumento> | undefined, usuario: UsuarioSesion) {
    const actual = await prisma.presupuestoServicio.findUnique({
        where: { id },
        include: { versiones: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!actual) throw new ErrorNegocio('Presupuesto no encontrado', 404);
    const v = actual.versiones[0];
    if (actual.estado !== 'borrador' || v?.estado !== 'borrador') throw new ErrorNegocio('Solo se puede enviar un presupuesto en borrador', 409);
    if (!(v.total > 0)) throw new ErrorNegocio('El presupuesto tiene total $ 0: revisá precios y valores hora antes de enviarlo');

    const fechaVencimiento = sumarDias(hoyArgentina(), v.validezDias);
    const opcionesDocumento = opciones ? normalizarOpcionesDocumento({ ...normalizarOpcionesDocumento(v.opcionesDocumento), ...opciones }) : normalizarOpcionesDocumento(v.opcionesDocumento);

    await prisma.$transaction(async (tx) => {
        const ok = await tx.presupuestoServicio.updateMany({ where: { id, estado: 'borrador' }, data: { estado: 'enviado', fechaVencimiento } });
        if (ok.count !== 1) throw new ErrorNegocio('El presupuesto cambió mientras tanto. Recargá la página.', 409);
        await tx.presupuestoServicioVersion.update({
            where: { id: v.id },
            data: { estado: 'enviada', enviadaEn: new Date(), enviadaPorId: usuario.id, opcionesDocumento: opcionesDocumento as any },
        });
    });
    await logAudit({
        userId: usuario.id,
        userName: usuario.nombre,
        action: 'UPDATE',
        entity: ENTIDAD,
        entityId: id,
        oldValue: { estado: 'borrador' },
        newValue: { estado: 'enviado', fechaVencimiento },
        metadata: { evento: 'ENVIO', numero: actual.numero, version: v.version, total: v.total, nivelDocumento: opcionesDocumento.nivel },
    });
    return obtenerPresupuesto(id);
}

/** Guarda las opciones del documento en la revisión vigente (no en una aceptada). */
export async function guardarOpcionesDocumento(id: string, opciones: OpcionesDocumento, usuario: UsuarioSesion) {
    const v = await prisma.presupuestoServicioVersion.findFirst({ where: { presupuestoId: id }, orderBy: { version: 'desc' } });
    if (!v) throw new ErrorNegocio('Presupuesto no encontrado', 404);
    if (v.estado === 'aceptada') throw new ErrorNegocio('La revisión aceptada no se modifica', 409);
    const normalizadas = normalizarOpcionesDocumento(opciones);
    await prisma.presupuestoServicioVersion.update({ where: { id: v.id }, data: { opcionesDocumento: normalizadas as any } });
    void usuario;
    return normalizadas;
}

// ── Aceptación y copia congelada ───────────────────────────────────

type VersionCompleta = Prisma.PresupuestoServicioVersionGetPayload<{ include: typeof includeVersion }>;

/** Contenido canónico de la copia congelada. Lo que entra acá no se puede modificar después. */
export function construirDatosSnapshot(
    p: { id: string; numero: string; titulo: string; clienteId: string | null; clienteNombre: string },
    v: VersionCompleta,
    aceptacion: { fechaAceptacion: string; referenciaCliente: string | null; comentario: string | null; aceptadoPorId: string; aceptadoPorNombre: string }
) {
    const calculo = calcularPresupuesto({
        ivaDiscriminado: v.ivaDiscriminado,
        descuentoPorcentaje: v.descuentoPorcentaje,
        tareas: v.tareas.map((t) => ({
            descripcion: t.descripcion,
            etiqueta: t.etiqueta,
            manoObra: t.manoObra.map((l) => ({
                categoriaId: l.categoriaId, categoriaNombre: l.categoriaNombre, modo: l.modo as any,
                horas: l.horas, valorHora: l.valorHora, importe: l.importe, ivaPorcentaje: l.ivaPorcentaje,
            })),
        })),
        materiales: v.materiales.map((m) => ({
            productoId: m.productoId, sku: m.sku, descripcion: m.descripcion, unidad: m.unidad,
            cantidad: m.cantidad, precioUnitario: m.precioUnitario, ivaPorcentaje: m.ivaPorcentaje,
        })),
    });
    return {
        esquemaVersion: ESQUEMA_SNAPSHOT,
        presupuestoId: p.id,
        numero: p.numero,
        version: v.version,
        titulo: p.titulo,
        cliente: { id: p.clienteId, nombre: p.clienteNombre },
        alcance: v.alcance,
        condiciones: v.condiciones,
        listaPrecio: { id: v.listaPrecioId, nombre: v.listaPrecioNombre },
        ivaDiscriminado: v.ivaDiscriminado,
        fechaInicioTentativa: v.fechaInicioTentativa,
        fechaFinTentativa: v.fechaFinTentativa,
        operariosSimultaneos: v.operariosSimultaneos,
        validezDias: v.validezDias,
        tareas: v.tareas.map((t) => ({
            presupuestoTareaId: t.id,
            orden: t.orden,
            descripcion: t.descripcion,
            etiqueta: t.etiqueta,
            horas: r2(t.horas),
            importe: r2(t.importe),
            manoObra: t.manoObra.map((l) => ({
                categoriaId: l.categoriaId, categoriaNombre: l.categoriaNombre, modo: l.modo,
                horas: r2(l.horas), valorHora: r2(l.valorHora), importe: r2(l.importe), ivaPorcentaje: r2(l.ivaPorcentaje),
            })),
        })),
        materiales: v.materiales.map((m) => ({
            orden: m.orden, productoId: m.productoId, sku: m.sku, descripcion: m.descripcion, unidad: m.unidad,
            cantidad: r2(m.cantidad), precioUnitario: r2(m.precioUnitario), ivaPorcentaje: r2(m.ivaPorcentaje), subtotal: r2(m.subtotal),
        })),
        totales: {
            horasTotales: calculo.horasTotales,
            subtotalManoObra: calculo.subtotalManoObra,
            subtotalMateriales: calculo.subtotalMateriales,
            descuentoPorcentaje: calculo.descuentoPorcentaje,
            descuentoMonto: calculo.descuentoMonto,
            neto: calculo.neto,
            netoManoObra: calculo.netoManoObra,
            netoMateriales: calculo.netoMateriales,
            impuestos: calculo.impuestos,
            total: calculo.total,
        },
        opcionesDocumento: normalizarOpcionesDocumento(v.opcionesDocumento),
        aceptacion,
    };
}

export type DatosSnapshot = ReturnType<typeof construirDatosSnapshot>;

export function hashDatos(datos: unknown): string {
    return computeSha256(stringifyCanonical(datos));
}

/** true si la copia congelada no fue alterada desde que se guardó. */
export function verificarSnapshot(s: { datos: unknown; hashSha256: string }): boolean {
    try {
        return hashDatos(s.datos) === s.hashSha256;
    } catch {
        return false;
    }
}

export async function aceptarPresupuesto(
    id: string,
    datos: { fechaAceptacion: string; referenciaCliente: string | null; comentario: string | null },
    usuario: UsuarioSesion
) {
    const actual = await prisma.presupuestoServicio.findUnique({
        where: { id },
        include: { versiones: { orderBy: { version: 'desc' }, take: 1, include: includeVersion } },
    });
    if (!actual) throw new ErrorNegocio('Presupuesto no encontrado', 404);
    if (!['enviado', 'vencido'].includes(actual.estado)) {
        throw new ErrorNegocio(actual.estado === 'aceptado' ? 'El presupuesto ya fue aceptado' : 'Solo se registra la aceptación de un presupuesto enviado', 409);
    }
    const v = actual.versiones[0];
    if (datos.fechaAceptacion > hoyArgentina()) throw new ErrorNegocio('La fecha de aceptación no puede ser futura');

    const snapshotDatos = construirDatosSnapshot(actual, v, {
        ...datos,
        aceptadoPorId: usuario.id,
        aceptadoPorNombre: usuario.nombre,
    });
    const hashSha256 = hashDatos(snapshotDatos);

    await prisma.$transaction(async (tx) => {
        const ok = await tx.presupuestoServicio.updateMany({
            where: { id, estado: { in: ['enviado', 'vencido'] }, versionActual: v.version },
            data: { estado: 'aceptado' },
        });
        if (ok.count !== 1) throw new ErrorNegocio('El presupuesto cambió mientras tanto. Recargá la página.', 409);
        await tx.presupuestoServicioVersion.update({ where: { id: v.id }, data: { estado: 'aceptada' } });
        await tx.presupuestoServicioSnapshot.create({
            data: {
                presupuestoId: id,
                versionId: v.id,
                numeroVersion: v.version,
                datos: snapshotDatos as any,
                hashSha256,
                esquemaVersion: ESQUEMA_SNAPSHOT,
                fechaAceptacion: datos.fechaAceptacion,
                referenciaCliente: datos.referenciaCliente,
                comentario: datos.comentario,
                aceptadoPorId: usuario.id,
                aceptadoPorNombre: usuario.nombre,
            },
        });
    });
    await logAudit({
        userId: usuario.id,
        userName: usuario.nombre,
        action: 'APPROVE',
        entity: ENTIDAD,
        entityId: id,
        oldValue: { estado: actual.estado },
        newValue: { estado: 'aceptado', version: v.version, total: v.total, fechaAceptacion: datos.fechaAceptacion, referenciaCliente: datos.referenciaCliente },
        metadata: { numero: actual.numero, hashSha256 },
    });
    return obtenerPresupuesto(id);
}

export async function rechazarPresupuesto(id: string, motivo: string, usuario: UsuarioSesion) {
    const actual = await prisma.presupuestoServicio.findUnique({ where: { id }, include: { versiones: { orderBy: { version: 'desc' }, take: 1 } } });
    if (!actual) throw new ErrorNegocio('Presupuesto no encontrado', 404);
    if (!['enviado', 'vencido'].includes(actual.estado)) throw new ErrorNegocio('Solo se registra el rechazo de un presupuesto enviado', 409);
    const v = actual.versiones[0];
    await prisma.$transaction(async (tx) => {
        const ok = await tx.presupuestoServicio.updateMany({
            where: { id, estado: { in: ['enviado', 'vencido'] } },
            data: { estado: 'rechazado', motivoRechazo: motivo },
        });
        if (ok.count !== 1) throw new ErrorNegocio('El presupuesto cambió mientras tanto. Recargá la página.', 409);
        await tx.presupuestoServicioVersion.update({ where: { id: v.id }, data: { estado: 'rechazada' } });
    });
    await logAudit({
        userId: usuario.id,
        userName: usuario.nombre,
        action: 'REJECT',
        entity: ENTIDAD,
        entityId: id,
        oldValue: { estado: actual.estado },
        newValue: { estado: 'rechazado', motivo },
        metadata: { numero: actual.numero, version: v.version },
    });
    return obtenerPresupuesto(id);
}

/** Crea un presupuesto nuevo (v1, borrador) con el contenido de la revisión vigente de otro. */
export async function duplicarPresupuesto(id: string, usuario: UsuarioSesion) {
    const origen = await prisma.presupuestoServicio.findUnique({
        where: { id },
        include: { versiones: { orderBy: { version: 'desc' }, take: 1, include: includeVersion } },
    });
    if (!origen) throw new ErrorNegocio('Presupuesto no encontrado', 404);
    const v = origen.versiones[0];
    const creado = await crearPresupuesto(
        {
            clienteId: origen.clienteId,
            clienteNombre: origen.clienteNombre,
            titulo: `${origen.titulo} (copia)`.slice(0, 200),
            alcance: v.alcance,
            condiciones: v.condiciones,
            fechaInicioTentativa: null,
            fechaFinTentativa: null,
            operariosSimultaneos: v.operariosSimultaneos,
            validezDias: v.validezDias,
            listaPrecioId: v.listaPrecioId,
            descuentoPorcentaje: v.descuentoPorcentaje,
            notaRevision: `Duplicado de ${origen.numero} (revisión ${v.version})`,
            tareas: v.tareas.map((t) => ({
                descripcion: t.descripcion,
                etiqueta: t.etiqueta,
                manoObra: t.manoObra.map((l) => ({
                    categoriaId: l.categoriaId, categoriaNombre: l.categoriaNombre, modo: l.modo as any,
                    horas: l.horas, valorHora: l.valorHora, importe: l.importe, ivaPorcentaje: l.ivaPorcentaje,
                })),
            })),
            materiales: v.materiales.map((m) => ({
                productoId: m.productoId, sku: m.sku, descripcion: m.descripcion, unidad: m.unidad, cantidad: m.cantidad,
                precioUnitario: m.precioUnitario, precioModificado: m.precioModificado, ivaPorcentaje: m.ivaPorcentaje,
            })),
        },
        usuario
    );
    return creado;
}

/** Borra un presupuesto que nunca se envió. */
export async function descartarPresupuesto(id: string, usuario: UsuarioSesion) {
    const actual = await prisma.presupuestoServicio.findUnique({ where: { id }, include: { versiones: true } });
    if (!actual) throw new ErrorNegocio('Presupuesto no encontrado', 404);
    if (actual.estado !== 'borrador' || actual.versiones.length !== 1 || actual.versiones[0].estado !== 'borrador') {
        throw new ErrorNegocio('Solo se puede descartar un presupuesto que nunca se envió', 409);
    }
    await prisma.presupuestoServicio.delete({ where: { id } });
    await logAudit({
        userId: usuario.id,
        userName: usuario.nombre,
        action: 'DELETE',
        entity: ENTIDAD,
        entityId: id,
        oldValue: { numero: actual.numero, titulo: actual.titulo, cliente: actual.clienteNombre },
    });
}

export function esEstadoPresupuesto(s: string): s is EstadoPresupuesto {
    return ['borrador', 'enviado', 'aceptado', 'rechazado', 'vencido'].includes(s);
}
