import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedResponsible, getAuthorizedProjectIds } from '@/lib/portalAuth';
import { obtenerDetalleCuentaCorrienteCliente } from '@/lib/ventas/cuentaCorrienteService';
import { hoyArgentina } from '@/lib/presupuestosServicio/calculos';

/**
 * Portal del cliente completo (auditoría, faltante): además de las OT, el responsable ve las órdenes de servicio de
 * sus proyectos, los presupuestos de servicio enviados al cliente (y, si está habilitado, los acepta o rechaza) y,
 * si está habilitado, el estado de cuenta.
 *
 * Cada pedido vuelve a leer al responsable de la base: un acceso revocado o un permiso quitado rige al instante,
 * aunque el token de la sesión siga vigente.
 */

export interface ResponsablePortal {
    id: string;
    nombre: string;
    clientId: string;
    verCuentaCorriente: boolean;
    aprobarPresupuestos: boolean;
}

export const SIN_CACHE = { 'Cache-Control': 'private, no-store' };

export async function responsablePortal(req: Request): Promise<ResponsablePortal | NextResponse> {
    const s = await getAuthenticatedResponsible(req);
    if (!s) return NextResponse.json({ error: 'No autenticado' }, { status: 401, headers: SIN_CACHE });
    const r = await prisma.clientResponsable.findUnique({
        where: { id: s.responsibleId },
        select: { id: true, nombre: true, clientId: true, activo: true, portalHabilitado: true, mustChangePassword: true, verCuentaCorriente: true, aprobarPresupuestos: true },
    });
    if (!r || !r.activo || !r.portalHabilitado) return NextResponse.json({ error: 'Sesión no válida o revocada' }, { status: 401, headers: SIN_CACHE });
    if (r.mustChangePassword) return NextResponse.json({ error: 'Cambiá la clave antes de continuar' }, { status: 403, headers: SIN_CACHE });
    return { id: r.id, nombre: r.nombre, clientId: r.clientId, verCuentaCorriente: r.verCuentaCorriente, aprobarPresupuestos: r.aprobarPresupuestos };
}

export const sinPermiso = (mensaje: string) => NextResponse.json({ error: mensaje }, { status: 403, headers: SIN_CACHE });

// ── Órdenes de servicio ─────────────────────────────────────────────────────────────────────────────

export async function ordenesServicioPortal(r: ResponsablePortal) {
    const proyectos = await getAuthorizedProjectIds(r.id);
    if (proyectos.length === 0) return [];
    const os = await prisma.ordenServicio.findMany({
        where: { projectId: { in: proyectos }, project: { clientId: r.clientId }, estado: { not: 'cancelada' } },
        select: {
            id: true,
            codigoOS: true,
            fechaCreacion: true,
            estado: true,
            linkPublico: true,
            reporte: true,
            project: { select: { id: true, nombre: true, codigoProyecto: true } },
            firma: { select: { nombre: true, fechaFirma: true } },
        },
        orderBy: { fechaCreacion: 'desc' },
        take: 300,
    });
    return os.map((o) => ({
        id: o.id,
        codigo: o.codigoOS,
        fecha: o.fechaCreacion.toISOString(),
        proyecto: o.project,
        resumen: o.reporte.length > 160 ? `${o.reporte.slice(0, 159)}…` : o.reporte,
        firmada: !!o.firma,
        firma: o.firma ? { nombre: o.firma.nombre, fecha: o.firma.fechaFirma.toISOString() } : null,
        // La firma usa el mismo link público que se le manda al cliente
        url: `/os/${o.linkPublico}`,
    }));
}

// ── Presupuestos de servicio ────────────────────────────────────────────────────────────────────────

/** Estados que ve el cliente (un borrador o una revisión en curso no se muestran). */
const ESTADOS_VISIBLES = ['enviado', 'vencido', 'aceptado', 'rechazado'];

export async function presupuestosPortal(r: ResponsablePortal) {
    const hoy = hoyArgentina();
    const ps = await prisma.presupuestoServicio.findMany({
        where: { clienteId: r.clientId, estado: { in: ESTADOS_VISIBLES } },
        select: {
            id: true,
            numero: true,
            titulo: true,
            estado: true,
            versionActual: true,
            fechaVencimiento: true,
            motivoRechazo: true,
            versiones: { orderBy: { version: 'desc' }, take: 1, select: { version: true, total: true, ivaDiscriminado: true, enviadaEn: true } },
            snapshot: { select: { fechaAceptacion: true, aceptadoPorNombre: true, referenciaCliente: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 200,
    });
    return ps.map((p) => {
        const v = p.versiones[0];
        const vigente = p.estado === 'enviado' && (!p.fechaVencimiento || p.fechaVencimiento >= hoy);
        return {
            id: p.id,
            numero: p.numero,
            titulo: p.titulo,
            estado: p.estado === 'enviado' && !vigente ? 'vencido' : p.estado,
            revision: v?.version ?? p.versionActual,
            total: v?.total ?? 0,
            ivaDiscriminado: v?.ivaDiscriminado ?? true,
            enviado: v?.enviadaEn?.toISOString() ?? null,
            vence: p.fechaVencimiento,
            puedeResponder: vigente && r.aprobarPresupuestos,
            aceptacion: p.snapshot ? { fecha: p.snapshot.fechaAceptacion, por: p.snapshot.aceptadoPorNombre, referencia: p.snapshot.referenciaCliente } : null,
            motivoRechazo: p.estado === 'rechazado' ? p.motivoRechazo : null,
        };
    });
}

/** Presupuesto del cliente en un estado visible, o null. */
export async function presupuestoDelCliente(r: ResponsablePortal, id: string) {
    return prisma.presupuestoServicio.findFirst({
        where: { id, clienteId: r.clientId, estado: { in: ESTADOS_VISIBLES } },
        include: { cliente: { select: { nombre: true, direccion: true, telefono: true, email: true } } },
    });
}

/** Usuario con el que se registra la respuesta del cliente (queda en el sellado y en la auditoría). */
export const usuarioPortal = (r: ResponsablePortal, nombreCliente: string) => ({
    id: `portal:${r.id}`,
    nombre: `${r.nombre} (${nombreCliente}, portal del cliente)`,
});

// ── Estado de cuenta ────────────────────────────────────────────────────────────────────────────────

/**
 * Estado de cuenta para el cliente: saldo, deuda vencida, comprobantes pendientes y movimientos. Sin datos internos
 * (observaciones, operadores, medios de pago ni imputaciones).
 */
export async function estadoCuentaPortal(r: ResponsablePortal) {
    const d = await obtenerDetalleCuentaCorrienteCliente(r.clientId);
    const iso = (f: Date | string | null | undefined) => (f ? new Date(f).toISOString() : null);
    return {
        resumen: {
            saldo: d.resumen.saldoActual,
            vencido: d.resumen.deudaVencida,
            noVencido: d.resumen.deudaNoVencida,
            limiteCredito: d.cliente.config.limiteCredito || null,
            disponible: d.resumen.disponibleCredito,
            plazoDias: d.cliente.config.plazoDias,
        },
        pendientes: d.comprobantesPendientes.map((c) => ({
            numero: c.numero,
            fecha: iso(c.fecha),
            vence: iso(c.fechaVencimiento),
            vencido: c.vencido,
            diasVencido: c.diasVencido,
            concepto: c.concepto,
            saldo: c.saldoPendiente,
        })),
        movimientos: d.libroMayor
            .filter((m) => m.estado !== 'ANULADA' && m.estado !== 'ANULADO')
            .slice(0, 300)
            .map((m) => ({
                numero: m.numero,
                fecha: iso(m.fecha),
                tipo: m.tipo,
                concepto: m.concepto,
                debe: m.debe,
                haber: m.haber,
                saldo: m.saldoAcumulado,
            })),
    };
}
