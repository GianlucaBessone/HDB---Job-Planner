import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Tarifas de mano de obra con una sola regla (auditoría, P20 / FU8).
 *
 * Antes había tres valores hora sin relación: el global de Configuración (cobro de OS y costo del
 * proyecto), las categorías de presupuestos (Oficial, Ayudante…) y la tarifa por cliente y persona
 * de las OT, que si no estaba cargada dejaba la hora en $0.
 *
 * Ahora, para una persona y (opcionalmente) un cliente, el valor hora es el primero que exista de:
 *   1. Excepción del cliente para esa persona   (ClientOperatorRate activa)
 *   2. Valor del cliente para la categoría de la persona   (ClienteTarifaCategoria)
 *   3. Valor de la categoría de la persona   (ManoObraCategoria.valorHora > 0)
 *   4. Valor por defecto   (Proyectos → Ajustes → Mano de obra)
 */

type Db = Prisma.TransactionClient | typeof prisma;

import type { OrigenTarifa } from '@/lib/manoObra/etiquetas';
export type { OrigenTarifa } from '@/lib/manoObra/etiquetas';
export { ETIQUETA_ORIGEN_TARIFA } from '@/lib/manoObra/etiquetas';

export interface Tarifa {
    valorHora: number;
    origen: OrigenTarifa;
    categoria: string | null;
}


export async function valorPorDefecto(db: Db = prisma): Promise<number> {
    const s = await db.systemSetting.findUnique({ where: { id: 'default' }, select: { valorManoObra: true } });
    return Number(s?.valorManoObra) || 0;
}

/** Valor hora de varias personas para un cliente (o sin cliente), en una sola pasada. */
export async function tarifasHora(
    operatorIds: string[],
    clienteId: string | null | undefined,
    db: Db = prisma
): Promise<Map<string, Tarifa>> {
    const ids = Array.from(new Set(operatorIds.filter(Boolean)));
    const res = new Map<string, Tarifa>();
    if (!ids.length) return res;

    const [personas, excepciones, defecto] = await Promise.all([
        db.operator.findMany({
            where: { id: { in: ids } },
            select: { id: true, manoObraCategoria: { select: { id: true, nombre: true, valorHora: true, activo: true } } },
        }),
        clienteId
            ? db.clientOperatorRate.findMany({ where: { clientId: clienteId, operatorId: { in: ids }, activo: true }, select: { operatorId: true, valorHora: true } })
            : Promise.resolve([] as { operatorId: string; valorHora: number }[]),
        valorPorDefecto(db),
    ]);
    const categoriaIds = Array.from(new Set(personas.map(p => p.manoObraCategoria?.id).filter(Boolean) as string[]));
    const delCliente = clienteId && categoriaIds.length
        ? await db.clienteTarifaCategoria.findMany({ where: { clientId: clienteId, categoriaId: { in: categoriaIds } }, select: { categoriaId: true, valorHora: true } })
        : [];

    const excepcion = new Map(excepciones.map(e => [e.operatorId, e.valorHora]));
    const porCategoria = new Map(delCliente.map(t => [t.categoriaId, t.valorHora]));

    for (const id of ids) {
        const cat = personas.find(p => p.id === id)?.manoObraCategoria || null;
        const nombre = cat?.nombre ?? null;
        if (excepcion.has(id)) {
            res.set(id, { valorHora: excepcion.get(id)!, origen: 'excepcion_persona', categoria: nombre });
        } else if (cat && porCategoria.has(cat.id)) {
            res.set(id, { valorHora: porCategoria.get(cat.id)!, origen: 'cliente_categoria', categoria: nombre });
        } else if (cat && cat.activo && cat.valorHora > 0) {
            res.set(id, { valorHora: cat.valorHora, origen: 'categoria', categoria: nombre });
        } else {
            res.set(id, { valorHora: defecto, origen: 'por_defecto', categoria: nombre });
        }
    }
    return res;
}

/** Valor hora de una persona para un cliente. */
export async function tarifaHora(operatorId: string, clienteId: string | null | undefined, db: Db = prisma): Promise<Tarifa> {
    return (await tarifasHora([operatorId], clienteId, db)).get(operatorId)!;
}
