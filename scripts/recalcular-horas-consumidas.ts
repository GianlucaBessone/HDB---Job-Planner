/**
 * Recalcula Project.horasConsumidas desde el registro de tiempos (TimeEntry).
 *
 * Por qué: hasta ahora, generar una Orden de Servicio volvía a sumar al proyecto las horas de sus
 * operadores, que ya se habían contado al cargar los registros de tiempo (se precargan desde ahí),
 * y el campo se podía editar a mano. Desde este cambio la única fuente es el registro de tiempos.
 * Este script alinea los datos existentes con esa regla. No se corre solo: lo decide una persona.
 *
 * Regla (la misma de app/api/time-entries/route.ts al crear, editar o borrar un registro):
 *   - registros manuales con proyecto: projectId no nulo, deviceId nulo (las fichadas de legado
 *     y los registros por causa no cuentan; mismo criterio que /api/time-entries)
 *   - sin devoluciones
 *   - por registro: ceil(horasTrabajadas), ×2 si es extra
 *
 * Uso:
 *   1) Ver diferencias (no escribe nada):
 *        DATABASE_URL=<base> npx tsx scripts/recalcular-horas-consumidas.ts
 *      Opcionales: --proyecto=<id o código>   --csv=<archivo.csv>
 *   2) Aplicar, después de revisar y con un respaldo (o branch de Neon) de la base:
 *        DATABASE_URL=<base> npx tsx scripts/recalcular-horas-consumidas.ts --aplicar
 *
 * Cómo leer el informe:
 *   - "Horas OS" es lo que la creación de OS sumaba (ceil, extras ×2) con las OS actuales del proyecto.
 *   - Si actual − recalculado = Horas OS, la diferencia es el doble conteo de las OS.
 *   - Si no coincide, revisar a mano: pudo haber ediciones manuales del campo, OS editadas después
 *     de creadas, horas cargadas solo en la OS (sin registro de tiempo) o fichadas de legado.
 *
 * Al aplicar:
 *   - Solo toca proyectos con diferencia.
 *   - Si el valor del proyecto cambió mientras corría el script (alguien cargó horas), ese proyecto
 *     no se toca y se informa: volver a correrlo.
 *   - Cada cambio queda en Auditoría (entidad PROJECT, acción UPDATE).
 */
import { writeFileSync } from 'node:fs';
import { prisma } from '../lib/prisma';
import { logAudit } from '../lib/audit';

const OPCIONES = ['aplicar', 'proyecto', 'csv'] as const;

function leerArgumentos(argv: string[]) {
    const out: { aplicar: boolean; proyecto?: string; csv?: string } = { aplicar: false };
    for (const arg of argv) {
        const m = /^--([a-z]+)(?:=(.*))?$/.exec(arg);
        if (!m || !(OPCIONES as readonly string[]).includes(m[1])) {
            throw new Error(`Argumento desconocido: ${arg}. Opciones: --aplicar, --proyecto=<id o código>, --csv=<archivo>`);
        }
        const [, nombre, valor] = m;
        if (nombre === 'aplicar') {
            if (valor !== undefined) throw new Error('--aplicar no lleva valor');
            out.aplicar = true;
        } else {
            if (!valor) throw new Error(`--${nombre} necesita un valor: --${nombre}=...`);
            out[nombre as 'proyecto' | 'csv'] = valor;
        }
    }
    return out;
}

/** Horas que un registro suma al proyecto. Misma regla que app/api/time-entries/route.ts. */
function horasDelRegistro(r: { horasTrabajadas: number; isExtra: boolean; isDevolucion: boolean }): number {
    if (r.isDevolucion || !(r.horasTrabajadas > 0)) return 0;
    const h = Math.ceil(r.horasTrabajadas);
    return r.isExtra ? h * 2 : h;
}

/** Lo que sumaba la creación de una OS por cada operador (regla anterior de lib/services/osService.ts). */
function horasDeOperadorOS(o: { horas: number; isExtra: boolean }): number {
    const h = Math.ceil(Number(o.horas) || 0);
    return o.isExtra ? h * 2 : h;
}

function hostDeLaBase(): string {
    try {
        return new URL(process.env.DATABASE_URL || '').host || '(sin host)';
    } catch {
        return '(DATABASE_URL no es una URL válida)';
    }
}

const csvCampo = (v: string | number) => {
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

interface Fila {
    id: string;
    codigo: string;
    nombre: string;
    estado: string;
    actual: number;
    recalculado: number;
    diferencia: number;
    normales: number;
    extras: number;
    registros: number;
    horasOS: number;
    fichadasLegado: number;
    lectura: string;
}

async function main() {
    const args = leerArgumentos(process.argv.slice(2));

    console.log(`Base: ${hostDeLaBase()}`);
    console.log(args.aplicar ? 'Modo: APLICAR (escribe en la base)' : 'Modo: simulación (no escribe nada)');
    console.log('');

    const proyectos = await prisma.project.findMany({
        where: args.proyecto ? { OR: [{ id: args.proyecto }, { codigoProyecto: args.proyecto }] } : undefined,
        select: { id: true, codigoProyecto: true, nombre: true, estado: true, horasConsumidas: true },
        orderBy: { createdAt: 'asc' },
    });
    if (args.proyecto && proyectos.length === 0) throw new Error(`No existe el proyecto ${args.proyecto}`);

    const ids = args.proyecto ? proyectos.map((p) => p.id) : undefined;
    const filtro = ids ? { in: ids } : { not: null };

    const [registros, operadoresOS, legado] = await Promise.all([
        prisma.timeEntry.findMany({
            where: { projectId: filtro, deviceId: null },
            select: { projectId: true, horasTrabajadas: true, isExtra: true, isDevolucion: true },
        }),
        prisma.ordenServicioOperador.findMany({
            where: ids ? { ordenServicio: { projectId: { in: ids } } } : undefined,
            select: { horas: true, isExtra: true, ordenServicio: { select: { projectId: true } } },
        }),
        prisma.timeEntry.groupBy({
            by: ['projectId'],
            where: { projectId: filtro, deviceId: { not: null } },
            _count: { _all: true },
        }),
    ]);

    const porProyecto = new Map<string, { normales: number; extras: number; registros: number; horasOS: number; fichadasLegado: number }>();
    const acumulado = (id: string) => {
        let a = porProyecto.get(id);
        if (!a) porProyecto.set(id, (a = { normales: 0, extras: 0, registros: 0, horasOS: 0, fichadasLegado: 0 }));
        return a;
    };
    for (const r of registros) {
        const horas = horasDelRegistro(r);
        if (horas === 0) continue;
        const a = acumulado(r.projectId!);
        if (r.isExtra) a.extras += horas;
        else a.normales += horas;
        a.registros++;
    }
    for (const o of operadoresOS) acumulado(o.ordenServicio.projectId).horasOS += horasDeOperadorOS(o);
    for (const l of legado) if (l.projectId) acumulado(l.projectId).fichadasLegado = l._count._all;

    const filas: Fila[] = proyectos.map((p) => {
        const a = porProyecto.get(p.id) || { normales: 0, extras: 0, registros: 0, horasOS: 0, fichadasLegado: 0 };
        const recalculado = a.normales + a.extras;
        const diferencia = recalculado - p.horasConsumidas;
        let lectura = '';
        if (diferencia !== 0) {
            lectura = a.horasOS > 0 && -diferencia === a.horasOS ? 'Doble conteo de OS' : 'Revisar a mano';
        }
        return {
            id: p.id,
            codigo: p.codigoProyecto || '—',
            nombre: p.nombre,
            estado: p.estado,
            actual: p.horasConsumidas,
            recalculado,
            diferencia,
            ...a,
            lectura,
        };
    });

    const conDiferencia = filas
        .filter((f) => f.diferencia !== 0)
        .sort((x, y) => Math.abs(y.diferencia) - Math.abs(x.diferencia));
    const totalActual = filas.reduce((s, f) => s + f.actual, 0);
    const totalRecalculado = filas.reduce((s, f) => s + f.recalculado, 0);

    console.log(`Proyectos revisados: ${filas.length}`);
    console.log(`Con diferencia: ${conDiferencia.length} (bajan: ${conDiferencia.filter((f) => f.diferencia < 0).length}, suben: ${conDiferencia.filter((f) => f.diferencia > 0).length})`);
    console.log(`  Doble conteo de OS: ${conDiferencia.filter((f) => f.lectura === 'Doble conteo de OS').length}`);
    console.log(`  Revisar a mano:     ${conDiferencia.filter((f) => f.lectura === 'Revisar a mano').length}`);
    console.log(`Horas consumidas en total: ${totalActual} → ${totalRecalculado} (${totalRecalculado - totalActual >= 0 ? '+' : ''}${totalRecalculado - totalActual})`);
    console.log('');

    if (conDiferencia.length > 0) {
        console.table(
            conDiferencia.map((f) => ({
                Código: f.codigo,
                Proyecto: f.nombre.length > 40 ? `${f.nombre.slice(0, 39)}…` : f.nombre,
                Estado: f.estado,
                Actual: f.actual,
                Recalculado: f.recalculado,
                Diferencia: f.diferencia,
                'Horas OS': f.horasOS,
                'Fichadas legado': f.fichadasLegado,
                Lectura: f.lectura,
            }))
        );
    }

    if (args.csv) {
        const encabezado = ['id', 'codigo', 'nombre', 'estado', 'actual', 'recalculado', 'diferencia', 'horas_normales', 'horas_extras_x2', 'registros', 'horas_os', 'fichadas_legado', 'lectura'];
        const lineas = conDiferencia.map((f) =>
            [f.id, f.codigo, f.nombre, f.estado, f.actual, f.recalculado, f.diferencia, f.normales, f.extras, f.registros, f.horasOS, f.fichadasLegado, f.lectura]
                .map(csvCampo)
                .join(',')
        );
        writeFileSync(args.csv, [encabezado.join(','), ...lineas].join('\n') + '\n', 'utf8');
        console.log(`CSV con las diferencias: ${args.csv}`);
    }

    if (!args.aplicar) {
        console.log('Simulación: no se escribió nada. Para aplicar, volver a correr con --aplicar.');
        return;
    }
    if (conDiferencia.length === 0) {
        console.log('Nada para aplicar.');
        return;
    }

    let aplicados = 0;
    const salteados: Fila[] = [];
    for (const f of conDiferencia) {
        // Solo si el valor sigue siendo el que se leyó: si alguien cargó horas mientras corría, no se pisa.
        const res = await prisma.project.updateMany({
            where: { id: f.id, horasConsumidas: f.actual },
            data: { horasConsumidas: f.recalculado },
        });
        if (res.count === 0) {
            salteados.push(f);
            continue;
        }
        aplicados++;
        await logAudit({
            userName: 'Script recalcular-horas-consumidas',
            action: 'UPDATE',
            entity: 'PROJECT',
            entityId: f.id,
            oldValue: { horasConsumidas: f.actual },
            newValue: { horasConsumidas: f.recalculado },
            metadata: {
                motivo: 'Recálculo de horas consumidas desde el registro de tiempos',
                regla: 'ceil(horas) por registro, extras ×2, sin devoluciones ni fichadas de legado',
                horasOS: f.horasOS,
                lectura: f.lectura,
            },
        });
    }

    console.log(`Aplicados: ${aplicados}`);
    if (salteados.length > 0) {
        console.log(`No aplicados porque cambiaron mientras corría el script (volver a correrlo): ${salteados.map((f) => f.codigo).join(', ')}`);
    }
}

main()
    .catch((e) => {
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
