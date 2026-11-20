import { prisma } from '@/lib/prisma';
import { ensureCuentaCorrienteTables, registrarMovimientoManualCC } from '@/lib/ventas/cuentaCorrienteService';

/**
 * Órdenes firmadas → cuenta corriente (auditoría, P15). Antes el trabajo firmado (OS y OT)
 * no se convertía en deuda del cliente: la cobranza de servicios dependía de un cargo manual.
 *
 * Qué se puede cargar:
 *  - OS con el cobro generado (estado "cobrada", total mayor a cero) de un proyecto con cliente.
 *  - Cada ciclo de OT firmado por el cliente en el portal (total mayor a cero).
 * Cada orden se carga una sola vez (movimiento CARGO_SERVICIO con su origen). Si el cargo se anula,
 * la orden vuelve a la lista.
 */

export type OrigenCargo = 'OS' | 'OT_CICLO';

export interface OrdenPorCargar {
    origenTipo: OrigenCargo;
    origenId: string;
    clienteId: string;
    clienteNombre: string;
    numero: string;
    detalle: string;
    proyecto: { id: string; nombre: string; codigoProyecto: string | null } | null;
    fecha: string | null;
    monto: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

async function cargadas(): Promise<Set<string>> {
    const movs = await prisma.cuentaCorrienteMovimiento.findMany({
        where: { estado: 'CONFIRMADO', origenTipo: { not: null } },
        select: { origenTipo: true, origenId: true },
    });
    return new Set(movs.map(m => `${m.origenTipo}:${m.origenId}`));
}

async function ordenesServicio(clienteId?: string) {
    return prisma.ordenServicio.findMany({
        where: {
            estado: 'cobrada',
            cobroTotalFinal: { gt: 0 },
            project: clienteId ? { clientId: clienteId } : { clientId: { not: null } },
        },
        select: {
            id: true,
            codigoOS: true,
            cobroTotalFinal: true,
            cobroFechaGeneracion: true,
            cobroCondicionPago: true,
            project: { select: { id: true, nombre: true, codigoProyecto: true, clientId: true, client: { select: { nombre: true } } } },
        },
        orderBy: { cobroFechaGeneracion: 'asc' },
    });
}

async function ciclosOT(clienteId?: string) {
    return prisma.otCiclo.findMany({
        where: {
            estado: 'FIRMADO',
            totalGeneral: { gt: 0 },
            ...(clienteId ? { ordenTrabajo: { clienteId } } : {}),
        },
        select: {
            id: true,
            numeroCiclo: true,
            periodo: true,
            totalGeneral: true,
            fechaFirma: true,
            tipoCierre: true,
            firmanteNombre: true,
            ordenTrabajo: {
                select: {
                    numeroOT: true,
                    clienteId: true,
                    cliente: { select: { nombre: true } },
                    proyecto: { select: { id: true, nombre: true, codigoProyecto: true } },
                },
            },
        },
        orderBy: { fechaFirma: 'asc' },
    });
}

type OS = Awaited<ReturnType<typeof ordenesServicio>>[number];
type Ciclo = Awaited<ReturnType<typeof ciclosOT>>[number];

function desdeOS(os: OS): OrdenPorCargar {
    return {
        origenTipo: 'OS',
        origenId: os.id,
        clienteId: os.project.clientId!,
        clienteNombre: os.project.client?.nombre || 'Sin nombre',
        numero: os.codigoOS || `OS ${os.id.slice(-6).toUpperCase()}`,
        detalle: `Orden de servicio${os.cobroCondicionPago ? ` · ${os.cobroCondicionPago}` : ''}`,
        proyecto: { id: os.project.id, nombre: os.project.nombre, codigoProyecto: os.project.codigoProyecto },
        fecha: os.cobroFechaGeneracion?.toISOString() ?? null,
        monto: round2(os.cobroTotalFinal || 0),
    };
}

function desdeCiclo(c: Ciclo): OrdenPorCargar {
    return {
        origenTipo: 'OT_CICLO',
        origenId: c.id,
        clienteId: c.ordenTrabajo.clienteId,
        clienteNombre: c.ordenTrabajo.cliente.nombre,
        numero: `${c.ordenTrabajo.numeroOT} · ciclo ${c.numeroCiclo}`,
        detalle: `Período ${c.periodo}${c.firmanteNombre ? ` · firmó ${c.firmanteNombre}` : ''}`,
        proyecto: c.ordenTrabajo.proyecto,
        fecha: c.fechaFirma?.toISOString() ?? null,
        monto: round2(c.totalGeneral),
    };
}

/** Órdenes firmadas que todavía no están en la cuenta corriente del cliente. */
export async function listarOrdenesPorCargar(clienteId?: string): Promise<OrdenPorCargar[]> {
    await ensureCuentaCorrienteTables();
    const [ya, os, ciclos] = await Promise.all([cargadas(), ordenesServicio(clienteId), ciclosOT(clienteId)]);
    return [...os.map(desdeOS), ...ciclos.map(desdeCiclo)]
        .filter(o => !ya.has(`${o.origenTipo}:${o.origenId}`))
        .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
}

/** Vuelve a leer la orden de la base: el monto y el cliente nunca vienen del navegador. */
async function leerOrden(origenTipo: OrigenCargo, origenId: string): Promise<OrdenPorCargar | null> {
    if (origenTipo === 'OS') {
        const os = await prisma.ordenServicio.findFirst({
            where: { id: origenId, estado: 'cobrada', cobroTotalFinal: { gt: 0 }, project: { clientId: { not: null } } },
            select: {
                id: true, codigoOS: true, cobroTotalFinal: true, cobroFechaGeneracion: true, cobroCondicionPago: true,
                project: { select: { id: true, nombre: true, codigoProyecto: true, clientId: true, client: { select: { nombre: true } } } },
            },
        });
        return os ? desdeOS(os) : null;
    }
    const c = await prisma.otCiclo.findFirst({
        where: { id: origenId, estado: 'FIRMADO', totalGeneral: { gt: 0 } },
        select: {
            id: true, numeroCiclo: true, periodo: true, totalGeneral: true, fechaFirma: true, tipoCierre: true, firmanteNombre: true,
            ordenTrabajo: {
                select: {
                    numeroOT: true, clienteId: true, cliente: { select: { nombre: true } },
                    proyecto: { select: { id: true, nombre: true, codigoProyecto: true } },
                },
            },
        },
    });
    return c ? desdeCiclo(c) : null;
}

export interface ResultadoCarga {
    origenTipo: OrigenCargo;
    origenId: string;
    ok: boolean;
    numero?: string;
    error?: string;
}

/** Carga cada orden como CARGO_SERVICIO en la cuenta de su cliente. Una que falla no frena al resto. */
export async function cargarOrdenesACuenta(
    items: { origenTipo: OrigenCargo; origenId: string }[],
    operador: { id: string; nombre: string }
): Promise<ResultadoCarga[]> {
    const resultados: ResultadoCarga[] = [];
    for (const item of items) {
        try {
            const orden = await leerOrden(item.origenTipo, item.origenId);
            if (!orden) {
                resultados.push({ ...item, ok: false, error: 'La orden no existe o todavía no se puede cargar (falta la firma o el cobro)' });
                continue;
            }
            const proyecto = orden.proyecto ? ` — ${orden.proyecto.codigoProyecto ? `${orden.proyecto.codigoProyecto} ` : ''}${orden.proyecto.nombre}` : '';
            const mov = await registrarMovimientoManualCC({
                clienteId: orden.clienteId,
                tipo: 'CARGO_SERVICIO',
                monto: orden.monto,
                concepto: `${orden.origenTipo === 'OS' ? 'Orden de servicio' : 'Orden de trabajo'} ${orden.numero}${proyecto}`,
                observaciones: orden.detalle,
                origen: { tipo: orden.origenTipo, id: orden.origenId },
                operadorId: operador.id,
                operadorNombre: operador.nombre,
            });
            resultados.push({ ...item, ok: true, numero: mov.numero });
        } catch (e) {
            resultados.push({ ...item, ok: false, error: e instanceof Error ? e.message : 'No se pudo cargar la orden' });
        }
    }
    return resultados;
}
