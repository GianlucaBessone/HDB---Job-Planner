/**
 * Reporte presupuestado vs. real de un proyecto creado desde un presupuesto de servicio.
 *
 * Presupuestado: la copia congelada (PresupuestoServicioSnapshot), nunca el presupuesto editable.
 * Real (solo lectura, mismos criterios que ya usa el sistema):
 *  - Horas consumidas: Project.horasConsumidas, el valor del dashboard y los KPI (extras ×2).
 *    Lo mantiene solo el registro de tiempos (app/api/time-entries); las OS no lo tocan.
 *  - Horas por operador: registros de horas del proyecto (sin devoluciones).
 *  - Materiales: lo usado (o lo entregado si no hay usos), igual que /api/projects/[id]/cost.
 * Proyectos sin presupuesto: { tienePresupuesto: false } y nada más.
 */
import { prisma } from '@/lib/prisma';
import { r2 } from './calculos';
import { verificarSnapshot, type DatosSnapshot } from './servicio';
import { ErrorNegocio, esTablaFaltante } from './sesion';

const norm = (s: string | null | undefined) => (s || '').replace(/^0+/, '').trim().toLowerCase();

export async function presupuestadoVsReal(projectId: string) {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, codigoProyecto: true, nombre: true, horasEstimadas: true, horasConsumidas: true, estado: true },
    });
    if (!project) throw new ErrorNegocio('Proyecto no encontrado', 404);

    let presupuesto;
    try {
        presupuesto = await prisma.presupuestoServicio.findUnique({
            where: { proyectoId: projectId },
            select: { id: true, numero: true, titulo: true, snapshot: true },
        });
    } catch (e) {
        if (esTablaFaltante(e)) return { tienePresupuesto: false as const };
        throw e;
    }
    if (!presupuesto?.snapshot) return { tienePresupuesto: false as const };

    const snap = presupuesto.snapshot;
    const d = snap.datos as unknown as DatosSnapshot;
    const ivaDisc = Boolean(d.ivaDiscriminado);

    const [tareas, materiales, registros] = await Promise.all([
        prisma.proyectoTarea.findMany({ where: { projectId }, orderBy: { orden: 'asc' } }),
        prisma.materialProyecto.findMany({ where: { proyectoId: projectId }, include: { usos: true } }),
        prisma.timeEntry.findMany({
            where: { projectId, isDevolucion: false },
            select: { horasTrabajadas: true, isExtra: true, operator: { select: { id: true, nombreCompleto: true } } },
        }),
    ]);

    // ── Horas ──
    const horasPresupuestadas = d.totales.horasTotales;
    const horasProyecto = tareas.length ? r2(tareas.reduce((a, t) => a + t.horasEstimadas, 0)) : project.horasEstimadas;
    const horasConsumidas = project.horasConsumidas;
    const horasHechas = r2(tareas.filter((t) => t.completada).reduce((a, t) => a + t.horasEstimadas, 0));
    const avance = horasProyecto > 0 ? horasHechas / horasProyecto : 0;
    const proyeccion = avance > 0 ? Math.round(horasConsumidas / avance) : null;

    const porTareaPresupuesto = new Map(d.tareas.map((t) => [t.presupuestoTareaId, t]));
    const filasTareas = tareas.map((t) => ({
        descripcion: t.descripcion,
        horasPresupuesto: t.presupuestoTareaId ? porTareaPresupuesto.get(t.presupuestoTareaId)?.horas ?? null : null,
        horasProyecto: t.horasEstimadas,
        completada: t.completada,
        origen: t.origen,
    }));
    const usadas = new Set(tareas.map((t) => t.presupuestoTareaId).filter(Boolean));
    for (const t of d.tareas) {
        if (t.presupuestoTareaId && !usadas.has(t.presupuestoTareaId)) {
            filasTareas.push({ descripcion: t.descripcion, horasPresupuesto: t.horas, horasProyecto: 0, completada: false, origen: 'quitada' });
        }
    }

    const porOperador = new Map<string, { nombre: string; horas: number; extras: number }>();
    for (const r of registros) {
        const k = r.operator?.id || 'sin';
        const o = porOperador.get(k) || { nombre: r.operator?.nombreCompleto || 'Sin operador', horas: 0, extras: 0 };
        o.horas += r.horasTrabajadas || 0;
        if (r.isExtra) o.extras += r.horasTrabajadas || 0;
        porOperador.set(k, o);
    }
    const operadores = Array.from(porOperador.values())
        .map((o) => ({ ...o, horas: r2(o.horas), extras: r2(o.extras) }))
        .sort((a, b) => b.horas - a.horas);

    // ── Materiales ──
    const presMat = d.materiales.map((m) => ({ ...m, usada: 0, real: 0, encontrado: false }));
    const extras: { descripcion: string; codigo: string | null; unidad: string; cantidad: number; real: number }[] = [];
    for (const m of materiales) {
        const cantidad = m.usos.length > 0 ? m.usos.reduce((a, u) => a + u.cantidadUtilizada, 0) : m.cantidadEntregada;
        const importe = cantidad * (m.precioVenta || 0);
        const destino = presMat.find((p) => (p.sku && m.codigo && norm(p.sku) === norm(m.codigo)) || (!m.codigo && p.descripcion.trim().toLowerCase() === m.nombre.trim().toLowerCase()));
        if (destino) {
            destino.usada += cantidad;
            destino.real += importe;
            destino.encontrado = true;
        } else if (cantidad > 0) {
            extras.push({ descripcion: m.nombre, codigo: m.codigo, unidad: m.unidad, cantidad: r2(cantidad), real: r2(importe) });
        }
    }
    const netearMat = (importe: number, iva: number) => (ivaDisc ? importe : importe / (1 + iva / 100));
    const filasMateriales = presMat.map((m) => ({
        descripcion: m.descripcion,
        codigo: m.sku,
        unidad: m.unidad,
        cantidadPresupuesto: m.cantidad,
        cantidadUsada: r2(m.usada),
        importePresupuesto: m.subtotal,
        importeReal: r2(m.real),
        desvio: r2(m.real - m.subtotal),
    }));
    const matPresupuestado = r2(filasMateriales.reduce((a, m) => a + m.importePresupuesto, 0));
    const matReal = r2(filasMateriales.reduce((a, m) => a + m.importeReal, 0) + extras.reduce((a, m) => a + m.real, 0));
    const matRealNeto = r2(
        presMat.reduce((a, m) => a + netearMat(m.real, m.ivaPorcentaje), 0) + extras.reduce((a, m) => a + netearMat(m.real, 21), 0)
    );

    // ── Monto (neto, sin IVA) ──
    const valorHoraPromedio = horasPresupuestadas > 0 ? d.totales.netoManoObra / horasPresupuestadas : 0;
    const manoObraReal = r2(horasConsumidas * valorHoraPromedio);

    return {
        tienePresupuesto: true as const,
        proyecto: project,
        presupuesto: {
            id: presupuesto.id,
            numero: presupuesto.numero,
            version: snap.numeroVersion,
            fechaAceptacion: snap.fechaAceptacion,
            integra: verificarSnapshot(snap),
            ivaDiscriminado: ivaDisc,
        },
        horas: {
            presupuestadas: horasPresupuestadas,
            proyecto: horasProyecto,
            consumidas: horasConsumidas,
            porcentajeConsumido: horasPresupuestadas > 0 ? horasConsumidas / horasPresupuestadas : 0,
            avance,
            proyeccion,
            desvioProyectado: proyeccion !== null && horasPresupuestadas > 0 ? proyeccion / horasPresupuestadas - 1 : null,
            tareas: filasTareas,
            operadores,
        },
        materiales: {
            filas: filasMateriales,
            extras,
            presupuestado: matPresupuestado,
            real: matReal,
            desvio: r2(matReal - matPresupuestado),
        },
        monto: {
            valorHoraPromedio: r2(valorHoraPromedio),
            presupuestado: { manoObra: d.totales.netoManoObra, materiales: d.totales.netoMateriales, total: d.totales.neto },
            real: { manoObra: manoObraReal, materiales: matRealNeto, total: r2(manoObraReal + matRealNeto) },
        },
    };
}
