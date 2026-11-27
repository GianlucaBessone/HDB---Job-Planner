import { prisma } from '@/lib/prisma';
import type { AccesoSesion } from '@/lib/permisosServer';
import { canOpenView, getViewConfig, type ViewConfig } from '@/lib/viewAccess';
import { estadoDocumento, DIAS_AVISO } from '@/lib/legajoTipos';
import type { FichaPersona, SeccionFicha } from '@/lib/fichaPersonaTipos';

/**
 * Ficha única de la persona (auditoría, P16): antes los datos de alguien estaban repartidos entre Usuarios (rol,
 * PIN), RRHH (EPP), Legajo, Calidad (competencias y capacitaciones), Asistencia (horas) y Viajes. La ficha los junta.
 *
 * Cada sección se incluye solo si quien mira puede abrir el módulo de origen (igual que el menú). La persona ve su
 * propia ficha ("Mi ficha") en solo lectura: su legajo sin las observaciones internas, su EPP, su formación, sus
 * horas y sus viajes. Los accesos de otra persona solo los ve quien gestiona usuarios.
 */

async function vistasConfiguradas(): Promise<ViewConfig[]> {
    const opciones = await prisma.configOption.findMany({ where: { category: 'VIEW_ACCESS' } }).catch(() => []);
    return getViewConfig(
        opciones
            .map((o) => {
                try {
                    return JSON.parse(o.value);
                } catch {
                    return null;
                }
            })
            .filter(Boolean)
    );
}

const dia = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const hoyIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
const masDias = (iso: string, n: number) => {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};

/** Quién puede abrir la ficha de otra persona: quien ve Usuarios y accesos o el legajo del personal. */
export async function puedeVerFicha(acceso: AccesoSesion, operatorId: string) {
    if (acceso.userId === operatorId) return true;
    const vistas = await vistasConfiguradas();
    return ['/operators', '/rrhh/legajo'].some((v) => canOpenView(v, acceso.role, vistas, acceso.permisos));
}

export async function fichaPersona(acceso: AccesoSesion, operatorId: string): Promise<FichaPersona | null> {
    const p = await prisma.operator.findUnique({
        where: { id: operatorId },
        select: {
            id: true,
            nombreCompleto: true,
            posicion: true,
            role: true,
            activo: true,
            enVacaciones: true,
            manoObraCategoria: { select: { nombre: true } },
            legajo: { select: { legajo: true, fechaIngreso: true } },
        },
    });
    if (!p) return null;

    const propia = acceso.userId === operatorId;
    const vistas = await vistasConfiguradas();
    const ve = (vista: string) => canOpenView(vista, acceso.role, vistas, acceso.permisos);
    const hoy = hoyIso();

    const editaLegajo = !propia && acceso.puede('rrhh.legajo_gestionar');
    const secciones: SeccionFicha[] = [];
    if (propia || acceso.puede('rrhh.legajo_ver') || acceso.puede('rrhh.legajo_gestionar')) secciones.push('legajo');
    if (!propia && ve('/operators') && (acceso.puede('usuarios.gestionar') || acceso.puede('usuarios.accesos'))) secciones.push('accesos');
    if (propia || ve('/rrhh')) secciones.push('epp');
    if (propia || ve('/calidad/formacion')) secciones.push('formacion');
    if (propia || ve('/monitoreo-fichadas')) secciones.push('horas');
    if (propia || ve('/viajes')) secciones.push('viajes');
    const tiene = (s: SeccionFicha) => secciones.includes(s);

    const ficha: FichaPersona = {
        persona: {
            id: p.id,
            nombreCompleto: p.nombreCompleto,
            posicion: p.posicion,
            role: p.role,
            activo: p.activo,
            enVacaciones: p.enVacaciones,
            categoriaManoObra: p.manoObraCategoria?.nombre ?? null,
            fechaIngreso: dia(p.legajo?.fechaIngreso),
            legajo: p.legajo?.legajo ?? null,
        },
        propia,
        secciones,
        editaLegajo,
        resumen: { documentosVencidos: 0, documentosPorVencer: 0, eppVencido: 0, eppPorVencer: 0, competenciasPorVencer: 0, horas30: null, viajesActivos: 0 },
    };

    const tareas: Promise<void>[] = [];

    if (tiene('legajo')) {
        tareas.push(
            prisma.documentoPersonal.findMany({ where: { operatorId }, select: { fechaVencimiento: true } }).then((docs) => {
                for (const d of docs) {
                    const e = estadoDocumento(dia(d.fechaVencimiento), hoy);
                    if (e === 'vencido') ficha.resumen.documentosVencidos++;
                    if (e === 'por_vencer') ficha.resumen.documentosPorVencer++;
                }
            })
        );
    }

    if (tiene('accesos')) {
        tareas.push(
            prisma.operatorPermiso
                .count({ where: { operatorId } })
                .catch(() => 0)
                .then((n) => {
                    ficha.accesos = {
                        permisosEspeciales: n,
                        puedeEditarUsuario: acceso.puede('usuarios.gestionar'),
                        puedeAdministrarAccesos: acceso.puede('usuarios.accesos'),
                    };
                })
        );
    }

    if (tiene('epp')) {
        tareas.push(
            Promise.all([
                prisma.eppDeliveryItem.findMany({
                    where: { estado: { in: ['VIGENTE', 'POR_VENCER'] }, delivery: { operatorId, estado: { not: 'RECHAZADA' } } },
                    select: { id: true, talle: true, fechaEntrega: true, fechaVencimiento: true, eppItem: { select: { nombre: true } } },
                    orderBy: { fechaVencimiento: 'asc' },
                    take: 200,
                }),
                prisma.eppDelivery.count({ where: { operatorId, estado: 'PENDIENTE_FIRMA' } }),
            ]).then(([items, actas]) => {
                const limite = masDias(hoy, DIAS_AVISO);
                ficha.epp = {
                    actasPorFirmar: actas,
                    vigentes: items.map((i) => {
                        const vence = dia(i.fechaVencimiento)!;
                        const estado = vence < hoy ? 'vencido' : vence <= limite ? 'por_vencer' : 'vigente';
                        if (estado === 'vencido') ficha.resumen.eppVencido++;
                        if (estado === 'por_vencer') ficha.resumen.eppPorVencer++;
                        return { id: i.id, nombre: i.eppItem.nombre, talle: i.talle, entregado: dia(i.fechaEntrega)!, vence, estado };
                    }),
                };
            })
        );
    }

    if (tiene('formacion')) {
        tareas.push(
            Promise.all([
                prisma.technicianCompetency.findMany({
                    where: { operatorId, estado: { not: 'inactiva' } },
                    select: { id: true, nombre: true, estado: true, vencimiento: true },
                    orderBy: { nombre: 'asc' },
                    take: 200,
                }),
                prisma.technicianTraining.findMany({
                    where: { operatorId },
                    select: { id: true, titulo: true, estado: true, fechaFin: true, puntaje: true },
                    orderBy: { updatedAt: 'desc' },
                    take: 50,
                }),
            ]).then(([comps, caps]) => {
                const limite = masDias(hoy, DIAS_AVISO);
                ficha.formacion = {
                    competencias: comps.map((c) => {
                        const vence = dia(c.vencimiento);
                        if (vence && vence <= limite) ficha.resumen.competenciasPorVencer++;
                        return { id: c.id, nombre: c.nombre, estado: c.estado, vence };
                    }),
                    capacitaciones: caps.map((c) => ({ id: c.id, titulo: c.titulo, estado: c.estado, fin: dia(c.fechaFin), puntaje: c.puntaje })),
                };
            })
        );
    }

    if (tiene('horas')) {
        const desde = masDias(hoy, -29);
        tareas.push(
            prisma.timeEntry
                .findMany({
                    where: { operatorId, fecha: { gte: desde, lte: hoy } },
                    select: { fecha: true, horasTrabajadas: true, status: true, project: { select: { nombre: true } } },
                    take: 2000,
                })
                .then((entradas) => {
                    const porProyecto = new Map<string, number>();
                    let total = 0;
                    for (const e of entradas) {
                        total += e.horasTrabajadas || 0;
                        const k = e.project?.nombre ?? 'Sin proyecto';
                        porProyecto.set(k, (porProyecto.get(k) || 0) + (e.horasTrabajadas || 0));
                    }
                    const r1 = (n: number) => Math.round(n * 10) / 10;
                    ficha.horas = {
                        desde,
                        hasta: hoy,
                        total: r1(total),
                        dias: new Set(entradas.filter((e) => (e.horasTrabajadas || 0) > 0).map((e) => e.fecha)).size,
                        porAprobar: entradas.filter((e) => e.status === 'PENDING_APPROVAL').length,
                        porProyecto: Array.from(porProyecto.entries())
                            .map(([proyecto, horas]) => ({ proyecto, horas: r1(horas) }))
                            .sort((a, b) => b.horas - a.horas),
                    };
                    ficha.resumen.horas30 = r1(total);
                })
        );
    }

    if (tiene('viajes')) {
        tareas.push(
            prisma.viaje
                .findMany({
                    where: { OR: [{ responsableId: operatorId }, { participantes: { some: { operatorId } } }] },
                    select: { id: true, codigo: true, destino: true, motivo: true, fechaInicio: true, fechaFin: true, estado: true, responsableId: true },
                    orderBy: { fechaInicio: 'desc' },
                    take: 20,
                })
                .then((vs) => {
                    ficha.viajes = vs.map((v) => ({
                        id: v.id,
                        codigo: v.codigo,
                        destino: v.destino,
                        motivo: v.motivo,
                        inicio: dia(v.fechaInicio)!,
                        fin: dia(v.fechaFin)!,
                        estado: v.estado,
                        responsable: v.responsableId === operatorId,
                    }));
                    ficha.resumen.viajesActivos = vs.filter((v) => ['planificado', 'en_curso'].includes(v.estado)).length;
                })
        );
    }

    // Una sección que falla no deja sin ficha al resto
    await Promise.allSettled(tareas);
    return ficha;
}
