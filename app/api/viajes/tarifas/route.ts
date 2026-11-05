import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { fromISODate, hoyISO, TARIFA_INICIAL, TARIFA_INICIAL_VIGENCIA, toISODate, type ValoresTarifa } from '@/lib/viajes';
import { tarifaSchema } from '@/lib/viajesSchemas';
import { errorValidacion, getActor, prohibido } from '@/lib/viajesServer';

export const dynamic = 'force-dynamic';

function serializar(t: { id: string; vigenciaDesde: Date; valores: unknown; creadoPorNombre: string; createdAt: Date }) {
    return {
        id: t.id,
        vigenciaDesde: toISODate(t.vigenciaDesde),
        valores: { ...TARIFA_INICIAL, ...(t.valores as Partial<ValoresTarifa>) },
        creadoPorNombre: t.creadoPorNombre,
        createdAt: t.createdAt,
    };
}

/** Valores de referencia vigentes (la última versión con vigencia hasta hoy) y el historial. */
export async function GET(req: NextRequest) {
    try {
        const actor = await getActor(req);
        if (!actor.esGestor) return prohibido();

        const versiones = await prisma.viajeTarifa.findMany({
            orderBy: [{ vigenciaDesde: 'desc' }, { createdAt: 'desc' }],
            take: 50,
        });
        const hoy = hoyISO();
        const vigente = versiones.find(v => toISODate(v.vigenciaDesde) <= hoy) || versiones[versiones.length - 1];

        return NextResponse.json({
            vigente: vigente
                ? { ...serializar(vigente), guardada: true }
                : { id: null, vigenciaDesde: TARIFA_INICIAL_VIGENCIA, valores: TARIFA_INICIAL, creadoPorNombre: null, createdAt: null, guardada: false },
            historial: versiones.map(serializar),
        });
    } catch (error) {
        console.error('[VIAJES_TARIFAS_GET]', error);
        return NextResponse.json({ error: 'Error al obtener los valores de referencia.' }, { status: 500 });
    }
}

/** Guarda una versión nueva. Los viajes ya estimados no cambian: conservan sus montos. */
export async function POST(req: NextRequest) {
    try {
        const actor = await getActor(req);
        if (!actor.esGestor) return prohibido('Solo administración configura los valores de referencia.');

        const parsed = tarifaSchema.safeParse(await req.json());
        if (!parsed.success) return errorValidacion(parsed.error);

        const creada = await prisma.viajeTarifa.create({
            data: {
                vigenciaDesde: fromISODate(parsed.data.vigenciaDesde),
                valores: parsed.data.valores,
                creadoPorId: actor.userId,
                creadoPorNombre: actor.nombre,
            },
        });

        await logAudit({
            userId: actor.userId || undefined, userName: actor.nombre, action: 'CREATE',
            entity: 'ViajeTarifa', entityId: creada.id, newValue: parsed.data,
        });

        return NextResponse.json({ ...serializar(creada), guardada: true }, { status: 201 });
    } catch (error) {
        console.error('[VIAJES_TARIFAS_POST]', error);
        return NextResponse.json({ error: 'Error al guardar los valores de referencia.' }, { status: 500 });
    }
}
