import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Parse "HH:mm" -> total minutes from midnight
function toMinutes(hhmm: string | null | undefined): number | null {
    if (!hhmm) return null;
    const parts = hhmm.split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
}

function minutesToHHMM(mins: number): string {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Effective egreso for a fichada: if no egreso, auto-close at 16h from ingreso
function efectiveEgreso(ingreso: string | null, egreso: string | null): { time: string; autoClose: boolean } | null {
    if (!ingreso) return null;
    if (egreso) return { time: egreso, autoClose: false };
    const inMins = toMinutes(ingreso);
    if (inMins === null) return null;
    const autoMins = (inMins + 16 * 60) % (24 * 60); // wrap around midnight
    return { time: minutesToHHMM(autoMins), autoClose: true };
}

function calcHorasTrabajadas(ingreso: string | null, egreso: string | null): number {
    const inMins = toMinutes(ingreso);
    const outMins = toMinutes(egreso);
    if (inMins === null || outMins === null) return 0;
    let diff = outMins - inMins;
    if (diff < 0) diff += 24 * 60; // overnight
    return Math.round((diff / 60) * 100) / 100;
}

interface CruceRow {
    operatorId: string;
    operatorName: string;
    fecha: string;
    manualPrimeraEntrada: string | null;
    manualUltimaSalida: string | null;
    manualHoras: number;
    manualRegistros: number;
    fichadaPrimeraEntrada: string | null;
    fichadaUltimaSalida: string | null;
    fichadaHoras: number;
    fichadaCantidad: number;
    fichadaTieneAbierta: boolean;
    fichadaAutoCerrada: boolean;
    sinFichada: boolean;
    sinManual: boolean;
    entradaOk: boolean | null;
    salidaOk: boolean | null;
    horasOk: boolean | null;
    status: 'OK' | 'ALERTA' | 'SIN_FICHADA' | 'SIN_MANUAL';
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const operatorIdFilter = searchParams.get('operatorId');

        if (!from || !to) {
            return NextResponse.json({ error: 'from and to are required' }, { status: 400 });
        }

        // Fetch manual time entries (no deviceId = manual)
        const manualWhere: any = {
            fecha: { gte: from, lte: to },
            deviceId: null,
            isDevolucion: false, // devolutions don't represent worked hours
        };
        if (operatorIdFilter) manualWhere.operatorId = operatorIdFilter;

        const manualEntries = await prisma.timeEntry.findMany({
            where: manualWhere,
            include: { operator: { select: { id: true, nombreCompleto: true } } },
            orderBy: [{ fecha: 'asc' }, { horaIngreso: 'asc' }],
        });

        // Fetch fichadas
        const fichadaWhere: any = {
            fecha: { gte: from, lte: to },
        };
        if (operatorIdFilter) fichadaWhere.operatorId = operatorIdFilter;

        const fichadas = await prisma.fichada.findMany({
            where: fichadaWhere,
            include: { operator: { select: { id: true, nombreCompleto: true } } },
            orderBy: [{ fecha: 'asc' }, { horaIngreso: 'asc' }],
        });

        // ── Build per-operator, per-day aggregations ──────────────────────────

        // Key: `${operatorId}|${fecha}`
        type DayKey = string;

        interface ManualDay {
            operatorId: string;
            operatorName: string;
            fecha: string;
            primeraEntrada: string | null;   // earliest horaIngreso
            ultimaSalida: string | null;      // latest horaEgreso
            horasTotales: number;             // sum
            registros: number;                // count
        }

        interface FichadaDay {
            operatorId: string;
            operatorName: string;
            fecha: string;
            primeraEntrada: string | null;   // earliest horaIngreso among all fichadas that day
            ultimaSalida: string | null;      // latest effective horaEgreso
            horasTotales: number;
            fichadas: number;
            tieneAbierta: boolean;            // any fichada with no egreso
            salidasAutoCerradas: boolean;     // any egreso was auto-computed
        }

        const manualByDay = new Map<DayKey, ManualDay>();
        const fichadaByDay = new Map<DayKey, FichadaDay>();

        // Aggregate manual entries
        for (const e of manualEntries) {
            const key: DayKey = `${e.operatorId}|${e.fecha}`;
            const existing = manualByDay.get(key);

            const inMins = toMinutes(e.horaIngreso);
            const outMins = toMinutes(e.horaEgreso);

            if (!existing) {
                manualByDay.set(key, {
                    operatorId: e.operatorId,
                    operatorName: e.operator.nombreCompleto,
                    fecha: e.fecha,
                    primeraEntrada: e.horaIngreso,
                    ultimaSalida: e.horaEgreso,
                    horasTotales: e.horasTrabajadas,
                    registros: 1,
                });
            } else {
                // Earliest entry
                const exInMins = toMinutes(existing.primeraEntrada);
                if (inMins !== null && (exInMins === null || inMins < exInMins)) {
                    existing.primeraEntrada = e.horaIngreso;
                }
                // Latest exit
                const exOutMins = toMinutes(existing.ultimaSalida);
                if (outMins !== null && (exOutMins === null || outMins > exOutMins)) {
                    existing.ultimaSalida = e.horaEgreso;
                }
                existing.horasTotales = Math.round((existing.horasTotales + e.horasTrabajadas) * 100) / 100;
                existing.registros++;
            }
        }

        // Aggregate fichadas
        for (const f of fichadas) {
            const key: DayKey = `${f.operatorId}|${f.fecha}`;
            const egInfo = efectiveEgreso(f.horaIngreso, f.horaEgreso);
            const efectivaEgreso = egInfo?.time ?? null;
            const isAutoClose = egInfo?.autoClose ?? false;
            const tieneAbierta = !f.horaEgreso;

            const horasFichada = efectivaEgreso
                ? calcHorasTrabajadas(f.horaIngreso, efectivaEgreso)
                : 0;

            const existing = fichadaByDay.get(key);
            const inMins = toMinutes(f.horaIngreso);
            const outMins = toMinutes(efectivaEgreso);

            if (!existing) {
                fichadaByDay.set(key, {
                    operatorId: f.operatorId,
                    operatorName: f.operator.nombreCompleto,
                    fecha: f.fecha,
                    primeraEntrada: f.horaIngreso,
                    ultimaSalida: efectivaEgreso,
                    horasTotales: horasFichada,
                    fichadas: 1,
                    tieneAbierta,
                    salidasAutoCerradas: isAutoClose,
                });
            } else {
                // Earliest entry
                const exInMins = toMinutes(existing.primeraEntrada);
                if (inMins !== null && (exInMins === null || inMins < exInMins)) {
                    existing.primeraEntrada = f.horaIngreso;
                }
                // Latest exit
                const exOutMins = toMinutes(existing.ultimaSalida);
                if (outMins !== null && (exOutMins === null || outMins > exOutMins)) {
                    existing.ultimaSalida = efectivaEgreso;
                }
                existing.horasTotales = Math.round((existing.horasTotales + horasFichada) * 100) / 100;
                existing.fichadas++;
                if (tieneAbierta) existing.tieneAbierta = true;
                if (isAutoClose) existing.salidasAutoCerradas = true;
            }
        }

        // ── Build the cross-validation result ─────────────────────────────────
        const manualKeys = Array.from(manualByDay.keys());
        const fichadaKeys = Array.from(fichadaByDay.keys());
        const allKeys = new Set<string>();
        manualKeys.forEach(k => allKeys.add(k));
        fichadaKeys.forEach(k => allKeys.add(k));

        const keysArray = Array.from(allKeys);
        const rows: CruceRow[] = [];

        for (let idx = 0; idx < keysArray.length; idx++) {
            const key = keysArray[idx];
            const manual = manualByDay.get(key);
            const fichada = fichadaByDay.get(key);
            const [operatorId, fecha] = key.split('|');
            const operatorName = manual?.operatorName ?? fichada?.operatorName ?? '';

            const sinFichada = !!manual && !fichada;
            const sinManual = !manual && !!fichada;

            let entradaOk: boolean | null = null;
            let salidaOk: boolean | null = null;
            let horasOk: boolean | null = null;

            if (manual && fichada) {
                // entrada: fichada should be ≤ manual (punched in before/at manual start)
                const fichadaInMins = toMinutes(fichada.primeraEntrada);
                const manualInMins = toMinutes(manual.primeraEntrada);
                if (fichadaInMins !== null && manualInMins !== null) {
                    entradaOk = fichadaInMins <= manualInMins;
                }

                // salida: fichada should be ≥ manual (punched out after/at manual end)
                const fichadaOutMins = toMinutes(fichada.ultimaSalida);
                const manualOutMins = toMinutes(manual.ultimaSalida);
                if (fichadaOutMins !== null && manualOutMins !== null) {
                    // Handle overnight: if fichada salida < 12:00 and manual salida > 12:00, shift fichada by +24h
                    let fOut = fichadaOutMins;
                    if (fOut < 360 && manualOutMins > 720) fOut += 24 * 60;
                    salidaOk = fOut >= manualOutMins;
                } else if (!fichada.ultimaSalida) {
                    // Open fichada: we can't validate exit
                    salidaOk = null;
                }

                // horas: fichada horas should be ≥ manual horas
                if (fichada.horasTotales > 0 && manual.horasTotales > 0) {
                    horasOk = fichada.horasTotales >= manual.horasTotales - 0.25; // 15min tolerance
                }
            }

            let status: CruceRow['status'] = 'OK';
            if (sinFichada) status = 'SIN_FICHADA';
            else if (sinManual) status = 'SIN_MANUAL';
            else if (entradaOk === false || salidaOk === false || horasOk === false) status = 'ALERTA';

            rows.push({
                operatorId,
                operatorName,
                fecha,
                manualPrimeraEntrada: manual?.primeraEntrada ?? null,
                manualUltimaSalida: manual?.ultimaSalida ?? null,
                manualHoras: manual?.horasTotales ?? 0,
                manualRegistros: manual?.registros ?? 0,
                fichadaPrimeraEntrada: fichada?.primeraEntrada ?? null,
                fichadaUltimaSalida: fichada?.ultimaSalida ?? null,
                fichadaHoras: fichada?.horasTotales ?? 0,
                fichadaCantidad: fichada?.fichadas ?? 0,
                fichadaTieneAbierta: fichada?.tieneAbierta ?? false,
                fichadaAutoCerrada: fichada?.salidasAutoCerradas ?? false,
                sinFichada,
                sinManual,
                entradaOk,
                salidaOk,
                horasOk,
                status,
            });
        }

        // Sort: operator name, then date
        rows.sort((a, b) => {
            const nameCompare = a.operatorName.localeCompare(b.operatorName);
            if (nameCompare !== 0) return nameCompare;
            return a.fecha.localeCompare(b.fecha);
        });

        return NextResponse.json(rows);
    } catch (error: any) {
        console.error('Error in verificar-cruce', error);
        return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
    }
}
