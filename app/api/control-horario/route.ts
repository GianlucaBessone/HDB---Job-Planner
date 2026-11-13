import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { puede } from '@/lib/permisosServer';
import {
    horasEntre,
    round2,
    toMinutes,
    type ControlHorarioRow,
} from '@/lib/controlHorario';

export const dynamic = 'force-dynamic';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_DIAS = 186;

const querySchema = z.object({
    from: z.string().regex(FECHA, 'Fecha desde inválida'),
    to: z.string().regex(FECHA, 'Fecha hasta inválida'),
    operatorId: z.string().min(1).optional(),
    projectId: z.string().min(1).optional(),
});

const ajusteSchema = z.object({
    operatorId: z.string().min(1),
    fecha: z.string().regex(FECHA, 'Fecha inválida'),
    horaIngreso: z.string().regex(HORA, 'Ingreso inválido (HH:mm)'),
    horaEgreso: z.string().regex(HORA, 'Egreso inválido (HH:mm)'),
    observacion: z.string().trim().max(500).optional().nullable(),
});

const borrarSchema = z.object({
    operatorId: z.string().min(1),
    fecha: z.string().regex(FECHA, 'Fecha inválida'),
});

function forbidden() {
    return NextResponse.json({ error: 'Solo supervisores y administradores pueden usar el control horario.' }, { status: 403 });
}

/** La tabla de ajustes todavía no existe en la base (falta aplicar el esquema). */
function isMissingTable(err: any) {
    return err?.code === 'P2021' || /does not exist/i.test(err?.message || '');
}

const SIN_TABLA = 'Los ajustes no están disponibles: falta crear la tabla ControlHorarioAjuste en la base de datos.';

function minHora(a: string | null, b: string | null): string | null {
    const ma = toMinutes(a), mb = toMinutes(b);
    if (ma === null) return b;
    if (mb === null) return a;
    return mb < ma ? b : a;
}

function maxHora(a: string | null, b: string | null): string | null {
    const ma = toMinutes(a), mb = toMinutes(b);
    if (ma === null) return b;
    if (mb === null) return a;
    return mb > ma ? b : a;
}

export async function GET(req: Request) {
    if (!(await puede(req, 'timesheets.control_horario'))) return forbidden();

    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
        from: searchParams.get('from') ?? undefined,
        to: searchParams.get('to') ?? undefined,
        operatorId: searchParams.get('operatorId') || undefined,
        projectId: searchParams.get('projectId') || undefined,
    });
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Parámetros inválidos' }, { status: 400 });
    }
    const { from, to, operatorId, projectId } = parsed.data;
    if (from > to) return NextResponse.json({ error: 'La fecha desde es posterior a la fecha hasta.' }, { status: 400 });
    const dias = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
    if (dias > MAX_DIAS) return NextResponse.json({ error: 'El período no puede superar los 6 meses.' }, { status: 400 });

    try {
        const fechaFilter = { gte: from, lte: to };

        // Con filtro de proyecto se muestran los días de los operadores que trabajaron
        // en ese proyecto, pero con el día completo (el control horario es por jornada).
        let operatorDays: Set<string> | null = null;
        if (projectId) {
            const [te, fi] = await Promise.all([
                prisma.timeEntry.findMany({
                    where: { fecha: fechaFilter, projectId, deviceId: null, isDevolucion: false, ...(operatorId ? { operatorId } : {}) },
                    select: { operatorId: true, fecha: true },
                }),
                prisma.fichada.findMany({
                    where: { fecha: fechaFilter, projectId, ...(operatorId ? { operatorId } : {}) },
                    select: { operatorId: true, fecha: true },
                }),
            ]);
            operatorDays = new Set([...te, ...fi].map(e => `${e.operatorId}|${e.fecha}`));
        }

        const operatorIds = operatorDays ? Array.from(new Set(Array.from(operatorDays).map(k => k.split('|')[0]))) : null;
        const opFilter = operatorId ? { operatorId } : operatorIds ? { operatorId: { in: operatorIds } } : {};

        const [entries, fichadas] = await Promise.all([
            // Registro de tiempos: carga manual (las fichadas viejas guardadas en TimeEntry tienen deviceId)
            prisma.timeEntry.findMany({
                where: { fecha: fechaFilter, deviceId: null, isDevolucion: false, ...opFilter },
                select: {
                    operatorId: true, fecha: true, horaIngreso: true, horaEgreso: true, horasTrabajadas: true,
                    isExtra: true, causaRegistro: true,
                    operator: { select: { nombreCompleto: true } },
                    project: { select: { nombre: true } },
                },
            }),
            prisma.fichada.findMany({
                where: { fecha: fechaFilter, ...opFilter },
                select: {
                    operatorId: true, fecha: true, horaIngreso: true, horaEgreso: true,
                    operator: { select: { nombreCompleto: true } },
                    project: { select: { nombre: true } },
                },
            }),
        ]);

        let ajustesDisponibles = true;
        let ajustes: Awaited<ReturnType<typeof prisma.controlHorarioAjuste.findMany>> = [];
        try {
            ajustes = await prisma.controlHorarioAjuste.findMany({ where: { fecha: fechaFilter, ...opFilter } });
        } catch (err) {
            if (!isMissingTable(err)) throw err;
            ajustesDisponibles = false;
        }

        const rows = new Map<string, ControlHorarioRow & { _proyectos: Set<string> }>();
        const getRow = (opId: string, fecha: string, nombre: string) => {
            const key = `${opId}|${fecha}`;
            let row = rows.get(key);
            if (!row) {
                row = { key, operatorId: opId, operatorName: nombre, fecha, proyectos: [], registro: null, gps: null, ajuste: null, _proyectos: new Set() };
                rows.set(key, row);
            }
            return row;
        };
        const incluir = (opId: string, fecha: string) => !operatorDays || operatorDays.has(`${opId}|${fecha}`);

        for (const e of entries) {
            if (!incluir(e.operatorId, e.fecha)) continue;
            const row = getRow(e.operatorId, e.fecha, e.operator?.nombreCompleto || 'Sin nombre');
            const r = row.registro ?? (row.registro = { ingreso: null, egreso: null, horas: 0, horasExtra: 0, registros: 0, causas: [] });
            r.ingreso = minHora(r.ingreso, e.horaIngreso);
            r.egreso = maxHora(r.egreso, e.horaEgreso);
            r.horas = round2(r.horas + (e.horasTrabajadas || 0));
            if (e.isExtra) r.horasExtra = round2(r.horasExtra + (e.horasTrabajadas || 0));
            r.registros++;
            if (e.causaRegistro && !r.causas.includes(e.causaRegistro)) r.causas.push(e.causaRegistro);
            if (e.project?.nombre) row._proyectos.add(e.project.nombre);
        }

        for (const f of fichadas) {
            if (!incluir(f.operatorId, f.fecha)) continue;
            const row = getRow(f.operatorId, f.fecha, f.operator?.nombreCompleto || 'Sin nombre');
            const g = row.gps ?? (row.gps = { ingreso: null, egreso: null, horas: 0, fichadas: 0, abierta: false });
            g.ingreso = minHora(g.ingreso, f.horaIngreso);
            if (f.horaEgreso) {
                g.egreso = maxHora(g.egreso, f.horaEgreso);
                g.horas = round2(g.horas + horasEntre(f.horaIngreso, f.horaEgreso));
            } else {
                g.abierta = true;
            }
            g.fichadas++;
            row._proyectos.add(f.project?.nombre || 'Base / Empresa');
        }

        for (const a of ajustes) {
            const row = rows.get(`${a.operatorId}|${a.fecha}`);
            // Un ajuste sin registro ni fichada (datos borrados) no tiene fila que completar
            if (!row) continue;
            row.ajuste = {
                horaIngreso: a.horaIngreso,
                horaEgreso: a.horaEgreso,
                horas: a.horas,
                observacion: a.observacion,
                ajustadoPorNombre: a.ajustadoPorNombre,
                updatedAt: a.updatedAt.toISOString(),
            };
        }

        const result: ControlHorarioRow[] = Array.from(rows.values())
            .map(({ _proyectos, ...row }) => ({ ...row, proyectos: Array.from(_proyectos).sort() }))
            .sort((a, b) => a.operatorName.localeCompare(b.operatorName, 'es') || a.fecha.localeCompare(b.fecha));

        return NextResponse.json({ rows: result, ajustesDisponibles });
    } catch (error: any) {
        console.error('GET control-horario', error);
        return NextResponse.json({ error: error?.message || 'No se pudo cargar el control horario' }, { status: 500 });
    }
}

/** Guarda (crea o reemplaza) el ajuste de un operador para un día. */
export async function PUT(req: Request) {
    if (!(await puede(req, 'timesheets.control_horario'))) return forbidden();
    const userId = req.headers.get('x-user-id');

    const parsed = ajusteSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
    }
    const { operatorId, fecha, horaIngreso, horaEgreso } = parsed.data;
    const observacion = parsed.data.observacion || null;
    if (horaIngreso === horaEgreso) {
        return NextResponse.json({ error: 'El ingreso y el egreso no pueden ser iguales.' }, { status: 400 });
    }

    try {
        const user = userId ? await prisma.operator.findUnique({ where: { id: userId }, select: { nombreCompleto: true } }) : null;
        const horas = horasEntre(horaIngreso, horaEgreso);
        const where = { operatorId_fecha: { operatorId, fecha } };
        const anterior = await prisma.controlHorarioAjuste.findUnique({ where });
        const data = { horaIngreso, horaEgreso, horas, observacion, ajustadoPorId: userId, ajustadoPorNombre: user?.nombreCompleto || null };
        const ajuste = await prisma.controlHorarioAjuste.upsert({
            where,
            create: { operatorId, fecha, ...data },
            update: data,
        });

        await logAudit({
            userId: userId || undefined,
            userName: user?.nombreCompleto,
            action: anterior ? 'UPDATE' : 'CREATE',
            entity: 'CONTROL_HORARIO',
            entityId: ajuste.id,
            oldValue: anterior,
            newValue: ajuste,
        });

        return NextResponse.json({
            horaIngreso: ajuste.horaIngreso,
            horaEgreso: ajuste.horaEgreso,
            horas: ajuste.horas,
            observacion: ajuste.observacion,
            ajustadoPorNombre: ajuste.ajustadoPorNombre,
            updatedAt: ajuste.updatedAt.toISOString(),
        });
    } catch (error: any) {
        if (isMissingTable(error)) return NextResponse.json({ error: SIN_TABLA }, { status: 503 });
        console.error('PUT control-horario', error);
        return NextResponse.json({ error: error?.message || 'No se pudo guardar el ajuste' }, { status: 500 });
    }
}

/** Quita el ajuste de un operador para un día. */
export async function DELETE(req: Request) {
    if (!(await puede(req, 'timesheets.control_horario'))) return forbidden();
    const userId = req.headers.get('x-user-id');

    const { searchParams } = new URL(req.url);
    const parsed = borrarSchema.safeParse({ operatorId: searchParams.get('operatorId'), fecha: searchParams.get('fecha') });
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
    }

    try {
        const where = { operatorId_fecha: parsed.data };
        const anterior = await prisma.controlHorarioAjuste.findUnique({ where });
        if (!anterior) return NextResponse.json({ ok: true });
        await prisma.controlHorarioAjuste.delete({ where });

        const user = userId ? await prisma.operator.findUnique({ where: { id: userId }, select: { nombreCompleto: true } }) : null;
        await logAudit({
            userId: userId || undefined,
            userName: user?.nombreCompleto,
            action: 'DELETE',
            entity: 'CONTROL_HORARIO',
            entityId: anterior.id,
            oldValue: anterior,
        });
        return NextResponse.json({ ok: true });
    } catch (error: any) {
        if (isMissingTable(error)) return NextResponse.json({ error: SIN_TABLA }, { status: 503 });
        console.error('DELETE control-horario', error);
        return NextResponse.json({ error: error?.message || 'No se pudo quitar el ajuste' }, { status: 500 });
    }
}
