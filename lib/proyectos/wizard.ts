/**
 * Wizard de creación de proyectos (manual o desde un presupuesto de servicio aceptado).
 *
 * crearProyectoWizard crea en UNA transacción: el proyecto, su checklist por etiquetas,
 * las tareas, los materiales (si se cargan en aprovisionamiento), las asignaciones de
 * operadores y el vínculo con el presupuesto. Si cualquier paso falla no queda nada a medias.
 */
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { generateCodigoProyecto } from '@/lib/codeGenerator';
import { crearChecklistsPorEtiqueta } from './checklistsPorEtiqueta';
import { TIPOS_PROYECTO, TIPO_PROYECTO_INFO } from './tipos';
import { esFecha, hoyArgentina, sugerirFechas, r2 } from '@/lib/presupuestosServicio/calculos';
import { verificarSnapshot, type DatosSnapshot } from '@/lib/presupuestosServicio/servicio';
import { ErrorNegocio, type UsuarioSesion } from '@/lib/presupuestosServicio/sesion';

// ── Validación ─────────────────────────────────────────────────────

const fecha = z.string().trim().refine(esFecha, 'Fecha inválida');
const idOpcional = z.string().trim().max(64).optional().nullable().transform((v) => v || null);
const texto = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);

export const wizardSchema = z
    .object({
        presupuestoId: idOpcional,
        borradorId: idOpcional,
        nombre: z.string().trim().min(3, 'Escribí el nombre del proyecto (al menos 3 caracteres)').max(200),
        clientId: idOpcional,
        responsableId: idOpcional,
        categoria: texto(100),
        tipoActividad: texto(100),
        tags: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
        observaciones: texto(5000),
        fechaInicio: fecha,
        fechaFin: fecha,
        horasDia: z.coerce.number().min(1, 'Horas por día: mínimo 1').max(24, 'Horas por día: máximo 24').default(8),
        /** Solo para proyectos sin tareas: horas estimadas totales cargadas a mano. */
        horasEstimadas: z.coerce.number().min(0).max(1e6).optional().nullable(),
        tipo: z.enum(TIPOS_PROYECTO).default('obra'),
        generarOS: z.boolean().default(false),
        aprovisionamiento: z.boolean().default(false),
        cargarMateriales: z.boolean().default(true),
        listaPrecioId: idOpcional,
        fichajeHabilitado: z.boolean().default(false),
        geofenceLat: z.coerce.number().min(-90).max(90).optional().nullable(),
        geofenceLng: z.coerce.number().min(-180).max(180).optional().nullable(),
        geofenceRadius: z.coerce.number().min(10).max(100000).optional().nullable(),
        tareas: z
            .array(
                z.object({
                    descripcion: z.string().trim().min(1, 'Cada tarea necesita una descripción').max(300),
                    etiqueta: texto(80),
                    horasEstimadas: z.coerce.number().refine((n) => isFinite(n) && n > 0, 'Las horas de cada tarea tienen que ser mayores a 0'),
                    presupuestoTareaId: idOpcional,
                })
            )
            .max(200)
            .default([]),
        materiales: z
            .array(
                z.object({
                    productoId: idOpcional,
                    codigo: texto(64),
                    nombre: z.string().trim().min(1, 'Cada material necesita una descripción').max(300),
                    unidad: z.string().trim().max(20).default('unidad'),
                    cantidad: z.coerce.number().refine((n) => isFinite(n) && n > 0, 'La cantidad de cada material tiene que ser mayor a 0'),
                    precioVenta: z.coerce.number().min(0).optional().nullable(),
                })
            )
            .max(500)
            .default([]),
        operadores: z.array(z.string().trim().min(1).max(64)).max(100).default([]),
    })
    .refine((d) => d.fechaFin >= d.fechaInicio, { message: 'La fecha de fin no puede ser anterior a la de inicio', path: ['fechaFin'] });

export type WizardInput = z.infer<typeof wizardSchema>;

// ── Precarga desde un presupuesto aceptado ─────────────────────────

export async function precargaDesdePresupuesto(presupuestoId: string) {
    const p = await prisma.presupuestoServicio.findUnique({
        where: { id: presupuestoId },
        include: { snapshot: true, cliente: { select: { id: true, nombre: true, listaPrecioId: true } }, proyecto: { select: { id: true, codigoProyecto: true } } },
    });
    if (!p) throw new ErrorNegocio('Presupuesto no encontrado', 404);
    if (p.estado !== 'aceptado' || !p.snapshot) throw new ErrorNegocio('Solo se convierte en proyecto un presupuesto aceptado', 409);
    if (p.proyecto) throw new ErrorNegocio(`Este presupuesto ya se convirtió en el proyecto ${p.proyecto.codigoProyecto || ''}`.trim(), 409);

    const d = p.snapshot.datos as unknown as DatosSnapshot;
    const horas = r2(d.tareas.reduce((a, t) => a + t.horas, 0));
    // Las copias congeladas anteriores a "horas por día" no lo tienen: se usa 8, como entonces.
    const horasDia = d.horasDia || 8;
    const fechas = sugerirFechas({
        fechaInicioTentativa: d.fechaInicioTentativa,
        fechaFinTentativa: d.fechaFinTentativa,
        horas,
        operarios: d.operariosSimultaneos,
        horasDia,
    });
    const etiquetas = Array.from(new Set(d.tareas.map((t) => t.etiqueta).filter((e): e is string => Boolean(e))));

    return {
        presupuesto: {
            id: p.id,
            numero: p.numero,
            version: p.snapshot.numeroVersion,
            titulo: p.titulo,
            clienteNombre: p.clienteNombre,
            fechaAceptacion: p.snapshot.fechaAceptacion,
            neto: d.totales.neto,
            total: d.totales.total,
            horas,
            integra: verificarSnapshot(p.snapshot),
        },
        sugerido: {
            nombre: `${p.clienteNombre} – ${p.titulo}`.slice(0, 200),
            clientId: p.clienteId,
            tags: etiquetas,
            observaciones: d.alcance || '',
            listaPrecioId: d.listaPrecio?.id || p.cliente?.listaPrecioId || null,
            aprovisionamiento: d.materiales.length > 0,
            fechaInicio: fechas.fechaInicio,
            fechaFin: fechas.fechaFin,
            fechasAjustadas: fechas.ajustado,
            fechaInicioTentativa: d.fechaInicioTentativa,
            fechaFinTentativa: d.fechaFinTentativa,
            operariosSimultaneos: d.operariosSimultaneos,
            horasDia,
            tareas: d.tareas.map((t) => ({ descripcion: t.descripcion, etiqueta: t.etiqueta, horasEstimadas: t.horas, presupuestoTareaId: t.presupuestoTareaId })),
            materiales: d.materiales.map((m) => ({
                productoId: m.productoId,
                codigo: m.sku,
                nombre: m.descripcion,
                unidad: m.unidad || 'unidad',
                cantidad: m.cantidad,
                precioVenta: m.precioUnitario,
            })),
        },
    };
}

// ── Creación ───────────────────────────────────────────────────────

function nuevoToken(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function crearProyectoWizard(input: WizardInput, usuario: UsuarioSesion, opciones: { puedeConvertir: boolean }) {
    if (input.presupuestoId && !opciones.puedeConvertir) throw new ErrorNegocio('No tenés permiso para convertir presupuestos en proyectos', 403);

    const [cliente, responsable, operadores, presupuesto] = await Promise.all([
        input.clientId ? prisma.hdbClient.findUnique({ where: { id: input.clientId }, select: { id: true, nombre: true } }) : null,
        input.responsableId ? prisma.operator.findUnique({ where: { id: input.responsableId }, select: { id: true, nombreCompleto: true } }) : null,
        input.operadores.length ? prisma.operator.findMany({ where: { id: { in: input.operadores }, activo: true }, select: { id: true } }) : [],
        input.presupuestoId ? prisma.presupuestoServicio.findUnique({ where: { id: input.presupuestoId }, select: { id: true, numero: true, estado: true, proyectoId: true } }) : null,
    ]);
    if (input.clientId && !cliente) throw new ErrorNegocio('El cliente elegido no existe');
    if (input.responsableId && !responsable) throw new ErrorNegocio('El responsable elegido no existe');
    if (operadores.length !== new Set(input.operadores).size) throw new ErrorNegocio('Alguno de los operadores elegidos no existe o está inactivo');
    if (input.presupuestoId) {
        if (!presupuesto) throw new ErrorNegocio('Presupuesto no encontrado', 404);
        if (presupuesto.estado !== 'aceptado') throw new ErrorNegocio('Solo se convierte en proyecto un presupuesto aceptado', 409);
        if (presupuesto.proyectoId) throw new ErrorNegocio('Este presupuesto ya se convirtió en proyecto', 409);
    }

    const horasEstimadas = input.tareas.length
        ? Math.round(input.tareas.reduce((a, t) => a + t.horasEstimadas, 0))
        : Math.round(Number(input.horasEstimadas) || 0);
    const estado = input.fechaInicio > hoyArgentina() ? 'planificado' : 'activo';
    const ids = Array.from(new Set(input.operadores));

    const crear = async () =>
        prisma.$transaction(
            async (tx) => {
                const codigoProyecto = await generateCodigoProyecto();
                const project = await tx.project.create({
                    data: {
                        codigoProyecto,
                        nombre: input.nombre,
                        activo: true,
                        clientId: cliente?.id ?? null,
                        cliente: cliente?.nombre ?? null,
                        responsableId: responsable?.id ?? null,
                        responsable: responsable?.nombreCompleto ?? null,
                        categoria: input.categoria,
                        tipoActividad: input.tipoActividad,
                        tags: input.tags,
                        observaciones: input.observaciones,
                        horasEstimadas,
                        horasConsumidas: 0,
                        estado,
                        fechaInicio: input.fechaInicio,
                        fechaFin: input.fechaFin,
                        tipo: input.tipo,
                        // El asistente no muestra estos dos: salen del tipo de proyecto (P27)
                        proyectoFijo: TIPO_PROYECTO_INFO[input.tipo].valores.proyectoFijo,
                        noEnMetricas: TIPO_PROYECTO_INFO[input.tipo].valores.noEnMetricas,
                        generarOS: input.generarOS,
                        aprovisionamiento: input.aprovisionamiento,
                        listaPrecioId: input.listaPrecioId,
                        fichajeHabilitado: input.fichajeHabilitado,
                        geofenceLat: input.geofenceLat ?? null,
                        geofenceLng: input.geofenceLng ?? null,
                        geofenceRadius: input.geofenceRadius ?? null,
                        publicToken: nuevoToken(),
                    },
                });

                await crearChecklistsPorEtiqueta(tx, project.id, input.tags);

                if (input.tareas.length) {
                    await tx.proyectoTarea.createMany({
                        data: input.tareas.map((t, i) => ({
                            projectId: project.id,
                            presupuestoTareaId: t.presupuestoTareaId,
                            origen: t.presupuestoTareaId ? 'presupuesto' : 'manual',
                            orden: i + 1,
                            descripcion: t.descripcion,
                            etiqueta: t.etiqueta,
                            horasEstimadas: r2(t.horasEstimadas),
                        })),
                    });
                }

                if (input.cargarMateriales && input.materiales.length) {
                    await tx.materialProyecto.createMany({
                        data: input.materiales.map((m) => ({
                            proyectoId: project.id,
                            nombre: m.nombre,
                            codigo: m.codigo,
                            unidad: m.unidad || 'unidad',
                            cantidadSolicitada: m.cantidad,
                            precioVenta: m.precioVenta ?? null,
                        })),
                    });
                }

                if (ids.length) {
                    await tx.proyectoAsignacion.createMany({
                        data: ids.map((operatorId) => ({
                            projectId: project.id,
                            operatorId,
                            fechaDesde: input.fechaInicio,
                            fechaHasta: input.fechaFin,
                            horasDia: input.horasDia,
                            creadoPorId: usuario.id,
                        })),
                    });
                }

                if (input.presupuestoId) {
                    // Reclama el presupuesto: si otro usuario lo convirtió en paralelo, no matchea y se deshace todo.
                    const ok = await tx.presupuestoServicio.updateMany({
                        where: { id: input.presupuestoId, estado: 'aceptado', proyectoId: null },
                        data: { proyectoId: project.id, convertidoEn: new Date(), convertidoPorId: usuario.id },
                    });
                    if (ok.count !== 1) throw new ErrorNegocio('Este presupuesto ya se convirtió en proyecto', 409);
                }

                if (input.borradorId) {
                    await tx.proyectoBorrador.deleteMany({ where: { id: input.borradorId, creadoPorId: usuario.id } });
                }
                return project;
            },
            { maxWait: 15000, timeout: 60000 }
        );

    let project;
    try {
        project = await crear();
    } catch (e) {
        // Código de proyecto duplicado por una creación simultánea: un reintento.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && String(e.meta?.target || '').includes('codigoProyecto')) {
            project = await crear();
        } else {
            throw e;
        }
    }

    await logAudit({
        userId: usuario.id,
        userName: usuario.nombre,
        action: 'CREATE',
        entity: 'PROJECT',
        entityId: project.id,
        newValue: project,
        metadata: {
            origen: input.presupuestoId ? 'presupuesto_servicio' : 'wizard_manual',
            presupuestoId: input.presupuestoId,
            presupuestoNumero: presupuesto?.numero ?? null,
            tareas: input.tareas.length,
            materiales: input.cargarMateriales ? input.materiales.length : 0,
            operadores: ids.length,
        },
    });
    if (input.presupuestoId && presupuesto) {
        await logAudit({
            userId: usuario.id,
            userName: usuario.nombre,
            action: 'CONVERT',
            entity: 'PRESUPUESTO_SERVICIO',
            entityId: presupuesto.id,
            oldValue: { proyectoId: null },
            newValue: { proyectoId: project.id, codigoProyecto: project.codigoProyecto },
            metadata: { numero: presupuesto.numero },
        });
    }
    return project;
}

// ── Borradores del wizard ──────────────────────────────────────────

export async function listarBorradores(usuarioId: string) {
    return prisma.proyectoBorrador.findMany({
        where: { creadoPorId: usuarioId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, titulo: true, paso: true, presupuestoId: true, updatedAt: true, datos: true },
        take: 20,
    });
}

export async function guardarBorrador(
    usuarioId: string,
    data: { id?: string | null; titulo?: string | null; paso: number; presupuestoId?: string | null; datos: unknown }
) {
    const datos = data.datos as Prisma.InputJsonValue;
    if (data.id) {
        const ok = await prisma.proyectoBorrador.updateMany({
            where: { id: data.id, creadoPorId: usuarioId },
            data: { titulo: data.titulo ?? null, paso: data.paso, presupuestoId: data.presupuestoId ?? null, datos },
        });
        if (ok.count === 1) return prisma.proyectoBorrador.findUnique({ where: { id: data.id }, select: { id: true, updatedAt: true } });
    }
    return prisma.proyectoBorrador.create({
        data: { creadoPorId: usuarioId, titulo: data.titulo ?? null, paso: data.paso, presupuestoId: data.presupuestoId ?? null, datos },
        select: { id: true, updatedAt: true },
    });
}

export async function borrarBorrador(usuarioId: string, id: string) {
    await prisma.proyectoBorrador.deleteMany({ where: { id, creadoPorId: usuarioId } });
}
