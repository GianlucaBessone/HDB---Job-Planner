// Análisis de Pliegos: helpers de servidor (API routes). No importar desde componentes cliente.
import { createHash, randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import type { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import {
    claveTarea, PLIEGO_ANALISIS_TIMEOUT_MS, puedeGestionarPliegos, puedeVerPliegos,
    type ContenidoAnalisis, type MarcaInput, type PliegoAlta,
} from '@/lib/pliegos';
import { analizarPliegoIA, ErrorAnalisisPliego } from '@/lib/pliegosIA';
import { borrarObjeto, leerObjeto, storageConfigurado, urlPrefirmada } from '@/lib/objectStorage';

// ── Actor y respuestas ──────────────────────────────────────────────

export interface PliegoActor {
    id: string | null;
    nombre: string;
    rol: string;
    puedeGestionar: boolean;
    puedeVer: boolean;
}

/** Usuario de la sesión (middleware deja x-user-id / x-user-role; vale igual para login web y PIN). */
export async function getActor(req: NextRequest): Promise<PliegoActor> {
    const id = req.headers.get('x-user-id') || null;
    const rol = (req.headers.get('x-user-role') || '').toLowerCase();
    let nombre = 'Usuario';
    if (id) {
        const op = await prisma.operator.findUnique({ where: { id }, select: { nombreCompleto: true } });
        if (op) nombre = op.nombreCompleto;
    }
    return { id, nombre, rol, puedeGestionar: !!id && puedeGestionarPliegos(rol), puedeVer: !!id && puedeVerPliegos(rol) };
}

export function errorValidacion(error: ZodError) {
    return NextResponse.json(
        {
            error: error.issues[0]?.message || 'Datos inválidos',
            detalle: error.issues.map(i => ({ campo: i.path.join('.'), mensaje: i.message })),
        },
        { status: 400 },
    );
}

export const noEncontrado = (msg = 'Pliego no encontrado.') => NextResponse.json({ error: msg }, { status: 404 });
export const prohibido = (msg = 'No tenés permiso para esta acción.') => NextResponse.json({ error: msg }, { status: 403 });
export const conflicto = (msg: string, extra?: Record<string, unknown>) => NextResponse.json({ error: msg, ...extra }, { status: 409 });

// ── Listado y detalle ───────────────────────────────────────────────

const PLIEGO_LISTA_SELECT = {
    id: true, codigo: true, titulo: true, estado: true, ultimoError: true, createdAt: true, updatedAt: true, creadoPorNombre: true,
    project: { select: { id: true, nombre: true, codigoProyecto: true } },
    client: { select: { id: true, nombre: true } },
    archivo: { select: { nombre: true, size: true, completo: true } },
    analisis: {
        orderBy: { version: 'desc' },
        take: 1,
        select: { version: true, createdAt: true, contenido: true, tareas: { select: { alcance: true } } },
    },
} satisfies Prisma.PliegoSelect;

export async function listarPliegos(q?: string) {
    const where: Prisma.PliegoWhereInput = q
        ? {
            OR: [
                { codigo: { contains: q, mode: 'insensitive' } },
                { titulo: { contains: q, mode: 'insensitive' } },
                { client: { nombre: { contains: q, mode: 'insensitive' } } },
                { project: { nombre: { contains: q, mode: 'insensitive' } } },
            ],
        }
        : {};
    const pliegos = await prisma.pliego.findMany({ where, select: PLIEGO_LISTA_SELECT, orderBy: { createdAt: 'desc' }, take: 200 });

    return pliegos.map(p => {
        const ultimo = p.analisis[0];
        const alertas = ultimo ? ((ultimo.contenido as unknown as ContenidoAnalisis)?.alertas || []) : [];
        return {
            id: p.id, codigo: p.codigo, titulo: p.titulo, estado: p.estado, ultimoError: p.ultimoError,
            createdAt: p.createdAt, updatedAt: p.updatedAt, creadoPorNombre: p.creadoPorNombre,
            project: p.project, client: p.client,
            archivo: p.archivo ? { nombre: p.archivo.nombre, size: p.archivo.size, completo: p.archivo.completo } : null,
            ultimoAnalisis: ultimo
                ? {
                    version: ultimo.version,
                    createdAt: ultimo.createdAt,
                    tareas: ultimo.tareas.length,
                    tareasFuera: ultimo.tareas.filter(t => t.alcance === 'fuera').length,
                    tareasSinMarcar: ultimo.tareas.filter(t => !t.alcance).length,
                    alertas: alertas.length,
                    alertasAltas: alertas.filter(a => a.severidad === 'alta').length,
                }
                : null,
        };
    });
}

/** Detalle con la versión pedida (o la última) y la lista de versiones. */
export async function cargarPliego(id: string, version?: number) {
    const pliego = await prisma.pliego.findUnique({
        where: { id },
        select: {
            id: true, codigo: true, titulo: true, descripcion: true, estado: true, ultimoError: true,
            createdAt: true, updatedAt: true, creadoPorNombre: true,
            project: { select: { id: true, nombre: true, codigoProyecto: true } },
            client: { select: { id: true, nombre: true } },
            archivo: { select: { nombre: true, size: true, completo: true, createdAt: true } },
            analisis: { orderBy: { version: 'desc' }, select: { id: true, version: true, createdAt: true, creadoPorNombre: true, modelo: true } },
        },
    });
    if (!pliego) return null;

    const ultima = pliego.analisis[0]?.version ?? null;
    const elegida = version && pliego.analisis.some(a => a.version === version) ? version : ultima;
    const analisis = elegida
        ? await prisma.pliegoAnalisis.findUnique({
            where: { pliegoId_version: { pliegoId: id, version: elegida } },
            include: {
                tareas: {
                    orderBy: { orden: 'asc' },
                    include: { marcas: { orderBy: { createdAt: 'desc' } } },
                },
            },
        })
        : null;

    const { analisis: versiones, ...resto } = pliego;
    return {
        ...resto,
        versiones,
        ultimaVersion: ultima,
        analisis: analisis
            ? {
                id: analisis.id,
                version: analisis.version,
                soloLectura: analisis.version !== ultima,
                modelo: analisis.modelo,
                createdAt: analisis.createdAt,
                creadoPorNombre: analisis.creadoPorNombre,
                resumen: analisis.resumen,
                razonamiento: analisis.razonamiento,
                contenido: analisis.contenido as unknown as ContenidoAnalisis,
                tareas: analisis.tareas,
            }
            : null,
    };
}

// ── Alta y subida del PDF ───────────────────────────────────────────

async function siguienteCodigo(tx: Prisma.TransactionClient) {
    const year = new Date().getFullYear();
    const prefijo = `PLG-${year}-`;
    const ultimos = await tx.pliego.findMany({ where: { codigo: { startsWith: prefijo } }, select: { codigo: true } });
    const max = ultimos.reduce((m, p) => Math.max(m, parseInt(p.codigo.slice(prefijo.length), 10) || 0), 0);
    return `${prefijo}${String(max + 1).padStart(4, '0')}`;
}

export async function crearPliego(datos: PliegoAlta, actor: PliegoActor) {
    if (!storageConfigurado()) throw new ErrorNegocio('El almacenamiento de archivos no está configurado en el servidor.', 503);
    if (datos.projectId && !(await prisma.project.findUnique({ where: { id: datos.projectId }, select: { id: true } }))) {
        throw new ErrorNegocio('El proyecto elegido no existe.', 400);
    }
    if (datos.clientId && !(await prisma.hdbClient.findUnique({ where: { id: datos.clientId }, select: { id: true } }))) {
        throw new ErrorNegocio('El cliente elegido no existe.', 400);
    }

    for (let intento = 0; intento < 3; intento++) {
        try {
            const creado = await prisma.$transaction(async tx => {
                const codigo = await siguienteCodigo(tx);
                return tx.pliego.create({
                    data: {
                        codigo,
                        titulo: datos.titulo,
                        descripcion: datos.descripcion,
                        projectId: datos.projectId,
                        clientId: datos.clientId,
                        creadoPorId: actor.id!,
                        creadoPorNombre: actor.nombre,
                        archivo: { create: { nombre: datos.archivo.nombre, size: datos.archivo.size, storageKey: `pliegos/${randomUUID()}.pdf` } },
                    },
                    select: { id: true, codigo: true },
                });
            });
            await logAudit({
                userId: actor.id || undefined, userName: actor.nombre, action: 'CREATE', entity: 'Pliego', entityId: creado.id,
                newValue: { codigo: creado.codigo, titulo: datos.titulo, archivo: datos.archivo.nombre },
            });
            return creado;
        } catch (e) {
            // Dos altas simultáneas pueden calcular el mismo código.
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && intento < 2) continue;
            throw e;
        }
    }
    throw new ErrorNegocio('No se pudo generar el código del pliego.', 500);
}

export class ErrorNegocio extends Error {
    constructor(message: string, public status = 400, public extra?: Record<string, unknown>) { super(message); }
}

export function respuestaError(e: unknown, contexto: string, mensaje: string) {
    if (e instanceof ErrorNegocio) return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status });
    console.error(`[${contexto}]`, e);
    return NextResponse.json({ error: mensaje }, { status: 500 });
}

/** URL para que el navegador suba el PDF directo al almacenamiento (válida 15 minutos). */
export async function urlSubida(pliegoId: string) {
    const archivo = await prisma.pliegoArchivo.findUnique({ where: { pliegoId }, select: { storageKey: true, completo: true } });
    if (!archivo) throw new ErrorNegocio('Pliego no encontrado.', 404);
    if (archivo.completo) throw new ErrorNegocio('El PDF ya se subió.', 409);
    return { url: urlPrefirmada('PUT', archivo.storageKey, { expiraEnSeg: 15 * 60 }), metodo: 'PUT' as const, headers: { 'Content-Type': 'application/pdf' } };
}

/**
 * Verifica lo que subió el navegador (tamaño declarado y firma de PDF) y lo da por
 * completo. Si no es un PDF válido lo borra para que se pueda volver a subir.
 */
export async function confirmarSubida(pliegoId: string) {
    const archivo = await prisma.pliegoArchivo.findUnique({ where: { pliegoId }, select: { storageKey: true, size: true, completo: true } });
    if (!archivo) throw new ErrorNegocio('Pliego no encontrado.', 404);
    if (archivo.completo) return { completo: true };

    let datos: Buffer;
    try {
        datos = await leerObjeto(archivo.storageKey);
    } catch {
        throw new ErrorNegocio('Todavía no llegó el PDF al almacenamiento. Volvé a subirlo.', 409);
    }
    if (datos.length !== archivo.size || datos.subarray(0, 5).toString('latin1') !== '%PDF-') {
        await borrarObjeto(archivo.storageKey).catch(() => {});
        throw new ErrorNegocio(datos.length !== archivo.size ? 'El PDF llegó incompleto. Volvé a subirlo.' : 'El archivo no es un PDF válido.', 400);
    }
    const sha256 = createHash('sha256').update(datos).digest('hex');
    await prisma.pliegoArchivo.update({ where: { pliegoId }, data: { completo: true, sha256 } });
    return { completo: true };
}

/** URL de descarga (inline) del PDF, válida 5 minutos. */
export async function urlDescarga(pliegoId: string) {
    const archivo = await prisma.pliegoArchivo.findUnique({ where: { pliegoId }, select: { storageKey: true, nombre: true, completo: true } });
    if (!archivo?.completo) return null;
    return urlPrefirmada('GET', archivo.storageKey, { expiraEnSeg: 300, descargaComo: archivo.nombre, tipo: 'application/pdf' });
}

/** Borra el pliego (con sus versiones y marcas) y el PDF del almacenamiento. */
export async function borrarPliego(pliegoId: string, actor: PliegoActor) {
    const pliego = await prisma.pliego.findUnique({ where: { id: pliegoId }, select: { codigo: true, titulo: true, archivo: { select: { storageKey: true } } } });
    if (!pliego) throw new ErrorNegocio('Pliego no encontrado.', 404);
    await prisma.pliego.delete({ where: { id: pliegoId } });
    if (pliego.archivo) await borrarObjeto(pliego.archivo.storageKey).catch(e => console.error('[PLIEGO_BORRAR_ARCHIVO]', e));
    await logAudit({ userId: actor.id || undefined, userName: actor.nombre, action: 'DELETE', entity: 'Pliego', entityId: pliegoId, oldValue: { codigo: pliego.codigo, titulo: pliego.titulo } });
}

// ── Análisis ────────────────────────────────────────────────────────

/**
 * Analiza (o re-analiza) el PDF y guarda una versión nueva. Las versiones previas
 * quedan de solo lectura; las marcas se arrastran a las tareas de igual título.
 */
export async function analizarPliego(pliegoId: string, actor: PliegoActor) {
    const pliego = await prisma.pliego.findUnique({
        where: { id: pliegoId },
        select: { id: true, codigo: true, estado: true, updatedAt: true, archivo: { select: { completo: true } } },
    });
    if (!pliego) throw new ErrorNegocio('Pliego no encontrado.', 404);
    if (!pliego.archivo?.completo) throw new ErrorNegocio('El PDF todavía no terminó de subirse.', 409);

    // Toma el pliego para analizar; evita dos análisis en paralelo (salvo uno colgado).
    const colgado = new Date(Date.now() - PLIEGO_ANALISIS_TIMEOUT_MS);
    const tomado = await prisma.pliego.updateMany({
        where: { id: pliegoId, OR: [{ estado: { not: 'analizando' } }, { updatedAt: { lt: colgado } }] },
        data: { estado: 'analizando', ultimoError: null },
    });
    if (tomado.count === 0) throw new ErrorNegocio('Ya hay un análisis en curso para este pliego. Esperá a que termine.', 409);

    try {
        const archivo = await prisma.pliegoArchivo.findUnique({ where: { pliegoId }, select: { storageKey: true } });
        const pdf = await leerObjeto(archivo!.storageKey);
        const resultado = await analizarPliegoIA(pdf, {
            userId: actor.id || undefined, userName: actor.nombre, userRole: actor.rol, entityId: pliegoId,
        });
        const { resumen, razonamiento, tareas, ...contenido } = resultado.analisis;

        const nuevo = await prisma.$transaction(async tx => {
            const anterior = await tx.pliegoAnalisis.findFirst({
                where: { pliegoId },
                orderBy: { version: 'desc' },
                select: {
                    version: true,
                    tareas: { where: { alcance: { not: null } }, include: { marcas: { orderBy: { createdAt: 'asc' } } } },
                },
            });
            const marcasPrevias = new Map<string, NonNullable<typeof anterior>['tareas'][number]>();
            for (const t of anterior?.tareas || []) marcasPrevias.set(claveTarea(t.titulo), t);

            const analisis = await tx.pliegoAnalisis.create({
                data: {
                    pliegoId,
                    version: (anterior?.version || 0) + 1,
                    modelo: resultado.modelo,
                    resumen,
                    razonamiento,
                    contenido: contenido as unknown as Prisma.InputJsonValue,
                    inputTokens: resultado.inputTokens,
                    outputTokens: resultado.outputTokens,
                    costoUsd: resultado.costoUsd,
                    latenciaMs: resultado.latenciaMs,
                    creadoPorId: actor.id!,
                    creadoPorNombre: actor.nombre,
                },
                select: { id: true, version: true },
            });

            let arrastradas = 0;
            for (let i = 0; i < tareas.length; i++) {
                const t = tareas[i];
                const previa = marcasPrevias.get(claveTarea(t.titulo));
                if (previa) marcasPrevias.delete(claveTarea(t.titulo));
                await tx.pliegoTarea.create({
                    data: {
                        analisisId: analisis.id,
                        orden: i + 1,
                        titulo: t.titulo,
                        descripcion: t.descripcion,
                        origen: t.origen,
                        referencia: t.origen === 'PLIEGO' ? t.referencia : null,
                        ...(previa && {
                            alcance: previa.alcance,
                            modificacion: previa.modificacion,
                            motivo: previa.motivo,
                            marcadoPor: previa.marcadoPor,
                            marcadoEn: previa.marcadoEn,
                            marcas: {
                                create: previa.marcas.map(m => ({
                                    alcance: m.alcance, modificacion: m.modificacion, motivo: m.motivo,
                                    operatorId: m.operatorId, nombre: m.nombre, rol: m.rol, createdAt: m.createdAt,
                                })),
                            },
                        }),
                    },
                });
                if (previa) arrastradas++;
            }

            await tx.pliego.update({ where: { id: pliegoId }, data: { estado: 'analizado', ultimoError: null } });
            return { ...analisis, arrastradas, tareas: tareas.length };
        }, { timeout: 30_000 });

        await logAudit({
            userId: actor.id || undefined, userName: actor.nombre, action: 'UPDATE', entity: 'Pliego', entityId: pliegoId,
            newValue: { analisis: nuevo.version, tareas: nuevo.tareas, marcasArrastradas: nuevo.arrastradas },
            metadata: { modelo: resultado.modelo, intentos: resultado.intentos, latenciaMs: resultado.latenciaMs, costoUsd: resultado.costoUsd },
        });
        return nuevo;
    } catch (e) {
        const mensaje = e instanceof ErrorAnalisisPliego || e instanceof ErrorNegocio
            ? e.message
            : e instanceof Error && e.message.startsWith('Almacenamiento:')
                ? 'No se pudo leer el PDF del almacenamiento.'
                : 'Error inesperado al guardar el análisis.';
        await prisma.pliego.update({ where: { id: pliegoId }, data: { estado: 'error', ultimoError: mensaje.slice(0, 2000) } }).catch(() => {});
        if (e instanceof ErrorAnalisisPliego) throw new ErrorNegocio(mensaje, 502);
        throw e;
    }
}

// ── Marcas ──────────────────────────────────────────────────────────

export async function marcarTarea(tareaId: string, datos: MarcaInput, actor: PliegoActor) {
    const tarea = await prisma.pliegoTarea.findUnique({
        where: { id: tareaId },
        select: { id: true, alcance: true, analisis: { select: { version: true, pliegoId: true } } },
    });
    if (!tarea) throw new ErrorNegocio('Tarea no encontrada.', 404);

    const ultima = await prisma.pliegoAnalisis.findFirst({
        where: { pliegoId: tarea.analisis.pliegoId },
        orderBy: { version: 'desc' },
        select: { version: true },
    });
    if (ultima?.version !== tarea.analisis.version) {
        throw new ErrorNegocio('Esta versión del análisis es de solo lectura. Marcá la tarea en la versión vigente.', 409);
    }

    const ahora = new Date();
    const modificacion = datos.alcance === 'fuera' ? datos.modificacion : null;
    return prisma.$transaction(async tx => {
        await tx.pliegoTareaMarca.create({
            data: {
                tareaId, alcance: datos.alcance, modificacion, motivo: datos.motivo,
                operatorId: actor.id, nombre: actor.nombre, rol: actor.rol, createdAt: ahora,
            },
        });
        return tx.pliegoTarea.update({
            where: { id: tareaId },
            data: { alcance: datos.alcance, modificacion, motivo: datos.motivo, marcadoPor: actor.nombre, marcadoEn: ahora },
            include: { marcas: { orderBy: { createdAt: 'desc' } } },
        });
    });
}
