import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

let tablesInitializedPromise: Promise<void> | null = null;

/**
 * Garantiza de forma aditiva e idempotente que las tablas de Cuentas Corrientes existan en PostgreSQL
 * sin alterar ni borrar ninguna tabla existente.
 */
export async function ensureCuentaCorrienteTables(): Promise<void> {
  if (!tablesInitializedPromise) {
    tablesInitializedPromise = (async () => {
      try {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "CuentaCorrienteCounter" (
            "serie" TEXT NOT NULL,
            "year" INTEGER NOT NULL,
            "currentNumber" INTEGER NOT NULL DEFAULT 0,
            CONSTRAINT "CuentaCorrienteCounter_pkey" PRIMARY KEY ("serie", "year")
          );
        `);

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "CuentaCorrienteConfig" (
            "id" TEXT NOT NULL,
            "clienteId" TEXT NOT NULL,
            "limiteCredito" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "plazoDias" INTEGER NOT NULL DEFAULT 30,
            "estadoCredito" TEXT NOT NULL DEFAULT 'ACTIVO',
            "observaciones" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "CuentaCorrienteConfig_pkey" PRIMARY KEY ("id")
          );
        `);

        await prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "CuentaCorrienteConfig_clienteId_key" ON "CuentaCorrienteConfig"("clienteId");
        `);

        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "CuentaCorrienteConfig_estadoCredito_idx" ON "CuentaCorrienteConfig"("estadoCredito");
        `);

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "CuentaCorrienteMovimiento" (
            "id" TEXT NOT NULL,
            "numero" TEXT NOT NULL,
            "clienteId" TEXT NOT NULL,
            "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "tipo" TEXT NOT NULL,
            "concepto" TEXT NOT NULL,
            "debe" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "haber" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "saldoPendienteCargo" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "fechaVencimiento" TIMESTAMP(3),
            "mediosPago" JSONB,
            "imputaciones" JSONB,
            "ventaId" TEXT,
            "estado" TEXT NOT NULL DEFAULT 'CONFIRMADO',
            "operadorId" TEXT,
            "operadorNombre" TEXT,
            "observaciones" TEXT,
            "motivoAnulacion" TEXT,
            "anuladoEn" TIMESTAMP(3),
            "anuladoPorNombre" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "CuentaCorrienteMovimiento_pkey" PRIMARY KEY ("id")
          );
        `);

        await prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "CuentaCorrienteMovimiento_numero_key" ON "CuentaCorrienteMovimiento"("numero");
        `);

        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "CuentaCorrienteMovimiento_clienteId_idx" ON "CuentaCorrienteMovimiento"("clienteId");
        `);

        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "CuentaCorrienteMovimiento_fecha_idx" ON "CuentaCorrienteMovimiento"("fecha");
        `);

        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "CuentaCorrienteMovimiento_tipo_idx" ON "CuentaCorrienteMovimiento"("tipo");
        `);

        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "CuentaCorrienteMovimiento_estado_idx" ON "CuentaCorrienteMovimiento"("estado");
        `);
      } catch (err) {
        console.error('Error asegurando tablas de Cuentas Corrientes:', err);
        tablesInitializedPromise = null;
        throw err;
      }
    })();
  }
  return tablesInitializedPromise;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface MedioPagoCobranzaInput {
  metodo: 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO' | 'OTRO';
  monto: number;
  referencia?: string | null;
  observaciones?: string | null;
}

export interface ImputacionManualInput {
  destinoTipo: 'VENTA' | 'CARGO';
  destinoId: string;
  monto: number;
}

export interface RegistrarCobranzaInput {
  clienteId: string;
  mediosPago: MedioPagoCobranzaInput[];
  modoImputacion?: 'FIFO' | 'MANUAL';
  imputacionesManuales?: ImputacionManualInput[];
  concepto?: string | null;
  observaciones?: string | null;
  operadorId?: string | null;
  operadorNombre?: string | null;
}

export interface RegistrarMovimientoManualInput {
  clienteId: string;
  tipo: 'SALDO_INICIAL' | 'CARGO_MANUAL' | 'NOTA_CREDITO';
  sentidoSaldoInicial?: 'DEBE' | 'HABER';
  monto: number;
  concepto: string;
  fechaVencimiento?: string | Date | null;
  imputarFifo?: boolean; // Para NOTA_CREDITO: si se desea imputar automáticamente a deudas abiertas
  observaciones?: string | null;
  operadorId?: string | null;
  operadorNombre?: string | null;
}

export interface ConfigCuentaCorrienteInput {
  limiteCredito: number;
  plazoDias: number;
  estadoCredito: 'ACTIVO' | 'OBSERVADO' | 'SUSPENDIDO';
  observaciones?: string | null;
}

/**
 * Genera el siguiente número correlativo para comprobantes de Cuenta Corriente (REC, ND, NC)
 */
export async function generarNumeroCC(
  tx: any,
  serie: 'REC' | 'ND' | 'NC',
  year?: number
): Promise<string> {
  const currentYear = year || new Date().getFullYear();

  const counter = await tx.cuentaCorrienteCounter.upsert({
    where: {
      serie_year: {
        serie,
        year: currentYear,
      },
    },
    update: { currentNumber: { increment: 1 } },
    create: {
      serie,
      year: currentYear,
      currentNumber: 1,
    },
  });

  const seq = String(counter.currentNumber).padStart(6, '0');
  return `${serie}-${currentYear}-${seq}`;
}

/**
 * Calcula la fecha de vencimiento de una venta en CC dado su plazo en días
 */
function calcularFechaVencimiento(fechaBase: Date, plazoDias: number): Date {
  const d = new Date(fechaBase);
  d.setDate(d.getDate() + Math.max(0, plazoDias));
  return d;
}

function calcularDiasDiferencia(fechaVencimiento: Date, hoy: Date = new Date()): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const utcVenc = Date.UTC(
    fechaVencimiento.getFullYear(),
    fechaVencimiento.getMonth(),
    fechaVencimiento.getDate()
  );
  const utcHoy = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.floor((utcHoy - utcVenc) / msPerDay); // Positivo = días vencido (mora), Negativo = días por vencer
}

/**
 * Obtiene el listado resumido de todos los clientes y su estado en Cuenta Corriente + KPIs globales
 */
export async function listarResumenCuentasCorrientes(filtros?: {
  q?: string;
  estadoDeuda?: 'TODOS' | 'CON_DEUDA' | 'VENCIDOS' | 'EXCEDIDOS' | 'AL_DIA' | 'SALDO_FAVOR';
  soloConActividad?: boolean;
}) {
  await ensureCuentaCorrienteTables();

  const search = filtros?.q?.trim() || '';
  const whereClient: any = { activo: true };

  if (search) {
    whereClient.OR = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { telefono: { contains: search, mode: 'insensitive' } },
      { direccion: { contains: search, mode: 'insensitive' } },
    ];
  }

  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  const [clientesDb, ventasCC, movimientosCC, cobranzasMesAgg] = await Promise.all([
    prisma.hdbClient.findMany({
      where: whereClient,
      orderBy: { nombre: 'asc' },
      include: {
        listaPrecio: {
          select: { id: true, nombre: true, codigo: true, ivaDiscriminado: true },
        },
        cuentaCorrienteConfig: true,
      },
    }),
    prisma.venta.findMany({
      where: {
        clienteId: { not: null },
        estado: 'CONFIRMADA',
        OR: [{ imputadoCuentaCorriente: { gt: 0 } }, { saldoPendiente: { gt: 0 } }],
      },
      select: {
        id: true,
        numero: true,
        clienteId: true,
        fecha: true,
        total: true,
        imputadoCuentaCorriente: true,
        saldoPendiente: true,
        estadoPago: true,
      },
    }),
    prisma.cuentaCorrienteMovimiento.findMany({
      where: {
        estado: 'CONFIRMADO',
      },
      select: {
        id: true,
        numero: true,
        clienteId: true,
        fecha: true,
        tipo: true,
        debe: true,
        haber: true,
        saldoPendienteCargo: true,
        fechaVencimiento: true,
      },
    }),
    prisma.cuentaCorrienteMovimiento.aggregate({
      where: {
        estado: 'CONFIRMADO',
        tipo: 'RECIBO_PAGO',
        fecha: { gte: inicioMes },
      },
      _sum: { haber: true },
    }),
  ]);

  // Agrupar ventas y movimientos por clienteId
  const ventasPorCliente = new Map<string, typeof ventasCC>();
  for (const v of ventasCC) {
    if (!v.clienteId) continue;
    const arr = ventasPorCliente.get(v.clienteId) || [];
    arr.push(v);
    ventasPorCliente.set(v.clienteId, arr);
  }

  const movsPorCliente = new Map<string, typeof movimientosCC>();
  for (const m of movimientosCC) {
    const arr = movsPorCliente.get(m.clienteId) || [];
    arr.push(m);
    movsPorCliente.set(m.clienteId, arr);
  }

  // Calcular métricas globales (sobre todos los clientes activos o filtrados)
  let deudaTotalActiva = 0;
  let saldoAFavorTotal = 0;
  let clientesConDeuda = 0;
  let clientesConVencidos = 0;
  let clientesExcedidosLimite = 0;
  let comprobantesPendientesTotal = 0;

  const clientesProcesados = clientesDb.map((c) => {
    const config = c.cuentaCorrienteConfig || {
      limiteCredito: 0,
      plazoDias: 30,
      estadoCredito: 'ACTIVO',
      observaciones: null,
    };

    const misVentas = ventasPorCliente.get(c.id) || [];
    const misMovs = movsPorCliente.get(c.id) || [];

    let totalDebe = 0;
    let totalHaber = 0;
    let deudaVencida = 0;
    let comprobantesPendientes = 0;
    let proximoVencimiento: Date | null = null;
    let ultimaOperacionAt: Date | null = null;
    let diasMoraMax = 0;

    for (const v of misVentas) {
      const montoCC =
        v.imputadoCuentaCorriente > 0 ? v.imputadoCuentaCorriente : v.saldoPendiente;
      totalDebe += montoCC;

      const fVenta = new Date(v.fecha);
      if (!ultimaOperacionAt || fVenta > ultimaOperacionAt) {
        ultimaOperacionAt = fVenta;
      }

      if (v.saldoPendiente > 0.009) {
        comprobantesPendientes++;
        const fVenc = calcularFechaVencimiento(fVenta, config.plazoDias);
        if (!proximoVencimiento || fVenc < proximoVencimiento) {
          proximoVencimiento = fVenc;
        }
        const diasMora = calcularDiasDiferencia(fVenc, hoy);
        if (diasMora > 0) {
          deudaVencida += v.saldoPendiente;
          if (diasMora > diasMoraMax) diasMoraMax = diasMora;
        }
      }
    }

    for (const m of misMovs) {
      totalDebe += m.debe || 0;
      totalHaber += m.haber || 0;

      const fMov = new Date(m.fecha);
      if (!ultimaOperacionAt || fMov > ultimaOperacionAt) {
        ultimaOperacionAt = fMov;
      }

      if (
        (m.tipo === 'CARGO_MANUAL' || m.tipo === 'SALDO_INICIAL') &&
        m.saldoPendienteCargo > 0.009
      ) {
        comprobantesPendientes++;
        const fVenc = m.fechaVencimiento
          ? new Date(m.fechaVencimiento)
          : calcularFechaVencimiento(fMov, config.plazoDias);
        if (!proximoVencimiento || fVenc < proximoVencimiento) {
          proximoVencimiento = fVenc;
        }
        const diasMora = calcularDiasDiferencia(fVenc, hoy);
        if (diasMora > 0) {
          deudaVencida += m.saldoPendienteCargo;
          if (diasMora > diasMoraMax) diasMoraMax = diasMora;
        }
      }
    }

    totalDebe = round2(totalDebe);
    totalHaber = round2(totalHaber);
    const saldoActual = round2(totalDebe - totalHaber);
    deudaVencida = round2(Math.max(0, Math.min(deudaVencida, Math.max(0, saldoActual))));
    if (deudaVencida <= 0.01) {
      diasMoraMax = 0;
    }

    const excedidoLimite =
      config.limiteCredito > 0 && saldoActual > config.limiteCredito + 0.01;
    const tieneVencidos = deudaVencida > 0.01 && saldoActual > 0.01;

    let alertaCredito: 'SUSPENDIDO' | 'EXCEDIDO' | 'VENCIDO' | 'OBSERVADO' | 'AL_DIA' = 'AL_DIA';
    if (config.estadoCredito === 'SUSPENDIDO') {
      alertaCredito = 'SUSPENDIDO';
    } else if (excedidoLimite) {
      alertaCredito = 'EXCEDIDO';
    } else if (tieneVencidos) {
      alertaCredito = 'VENCIDO';
    } else if (config.estadoCredito === 'OBSERVADO') {
      alertaCredito = 'OBSERVADO';
    }

    if (saldoActual > 0.01) {
      deudaTotalActiva += saldoActual;
      clientesConDeuda++;
    } else if (saldoActual < -0.01) {
      saldoAFavorTotal += Math.abs(saldoActual);
    }

    if (tieneVencidos) {
      clientesConVencidos++;
    }
    if (excedidoLimite) {
      clientesExcedidosLimite++;
    }
    comprobantesPendientesTotal += comprobantesPendientes;

    return {
      id: c.id,
      nombre: c.nombre,
      email: c.email,
      telefono: c.telefono,
      direccion: c.direccion,
      listaPrecio: c.listaPrecio,
      config: {
        limiteCredito: config.limiteCredito,
        plazoDias: config.plazoDias,
        estadoCredito: config.estadoCredito,
        observaciones: config.observaciones,
      },
      totalDebe,
      totalHaber,
      saldoActual,
      deudaVencida,
      comprobantesPendientes,
      diasMoraMax,
      proximoVencimiento,
      ultimaOperacionAt,
      alertaCredito,
      tieneActividad: misVentas.length > 0 || misMovs.length > 0 || config.limiteCredito > 0,
    };
  });

  // Filtrado por estado de deuda
  const estadoFiltro = filtros?.estadoDeuda || 'TODOS';
  const clientesFiltrados = clientesProcesados.filter((c) => {
    if (filtros?.soloConActividad && !c.tieneActividad) return false;
    if (estadoFiltro === 'CON_DEUDA') return c.saldoActual > 0.01;
    if (estadoFiltro === 'VENCIDOS') return c.deudaVencida > 0.01 && c.saldoActual > 0.01;
    if (estadoFiltro === 'EXCEDIDOS')
      return c.config.limiteCredito > 0 && c.saldoActual > c.config.limiteCredito + 0.01;
    if (estadoFiltro === 'AL_DIA') return Math.abs(c.saldoActual) <= 0.01;
    if (estadoFiltro === 'SALDO_FAVOR') return c.saldoActual < -0.01;
    return true;
  });

  // Ordenar: primero los que tienen mayor saldo pendiente, luego alfabético
  clientesFiltrados.sort((a, b) => {
    if (b.saldoActual !== a.saldoActual) return b.saldoActual - a.saldoActual;
    return a.nombre.localeCompare(b.nombre);
  });

  return {
    kpis: {
      deudaTotalActiva: round2(deudaTotalActiva),
      saldoAFavorTotal: round2(saldoAFavorTotal),
      clientesConDeuda,
      clientesConVencidos,
      clientesExcedidosLimite,
      cobranzasMesActual: round2(cobranzasMesAgg._sum.haber || 0),
      comprobantesPendientesTotal,
    },
    clientes: clientesFiltrados,
  };
}

/**
 * Obtiene el estado de cuenta completo, comprobantes pendientes, libro mayor y recibos de un cliente
 */
export async function obtenerDetalleCuentaCorrienteCliente(
  clienteId: string,
  filtros?: {
    fechaDesde?: string;
    fechaHasta?: string;
  }
) {
  await ensureCuentaCorrienteTables();

  const cliente = await prisma.hdbClient.findUnique({
    where: { id: clienteId },
    include: {
      listaPrecio: {
        select: { id: true, nombre: true, codigo: true, ivaDiscriminado: true },
      },
      cuentaCorrienteConfig: true,
    },
  });

  if (!cliente) {
    throw new Error('Cliente no encontrado');
  }

  const config = cliente.cuentaCorrienteConfig || {
    limiteCredito: 0,
    plazoDias: 30,
    estadoCredito: 'ACTIVO',
    observaciones: null,
  };

  const [ventasCC, movimientos] = await Promise.all([
    prisma.venta.findMany({
      where: {
        clienteId,
        OR: [
          { imputadoCuentaCorriente: { gt: 0 } },
          { saldoPendiente: { gt: 0 } },
          { pagos: { some: { metodo: 'CUENTA_CORRIENTE' } } },
        ],
      },
      include: {
        items: true,
        pagos: true,
      },
      orderBy: { fecha: 'asc' },
    }),
    prisma.cuentaCorrienteMovimiento.findMany({
      where: { clienteId },
      orderBy: { fecha: 'asc' },
    }),
  ]);

  const hoy = new Date();
  let totalDebe = 0;
  let totalHaber = 0;
  let deudaVencida = 0;
  let diasMoraMaxima = 0;

  // 1. Armar lista de comprobantes pendientes (FIFO: más antiguos primero)
  const comprobantesPendientes: Array<{
    id: string;
    destinoTipo: 'VENTA' | 'CARGO';
    numero: string;
    fecha: Date;
    fechaVencimiento: Date;
    diasVencido: number;
    vencido: boolean;
    concepto: string;
    montoTotalOperacion: number;
    montoOriginalCC: number;
    montoPagadoCC: number;
    saldoPendiente: number;
    items?: any[];
  }> = [];

  for (const v of ventasCC) {
    if (v.estado !== 'CONFIRMADA') continue;
    const montoCC =
      v.imputadoCuentaCorriente > 0 ? v.imputadoCuentaCorriente : v.saldoPendiente;
    totalDebe += montoCC;

    if (v.saldoPendiente > 0.009) {
      const fVenta = new Date(v.fecha);
      const fVenc = calcularFechaVencimiento(fVenta, config.plazoDias);
      const diasVencido = calcularDiasDiferencia(fVenc, hoy);
      const vencido = diasVencido > 0;

      if (vencido) {
        deudaVencida += v.saldoPendiente;
        if (diasVencido > diasMoraMaxima) diasMoraMaxima = diasVencido;
      }

      comprobantesPendientes.push({
        id: v.id,
        destinoTipo: 'VENTA',
        numero: v.numero,
        fecha: fVenta,
        fechaVencimiento: fVenc,
        diasVencido,
        vencido,
        concepto: `Venta PDV ${v.numero} (${v.items?.length || 0} art.)`,
        montoTotalOperacion: v.total,
        montoOriginalCC: round2(montoCC),
        montoPagadoCC: round2(Math.max(0, montoCC - v.saldoPendiente)),
        saldoPendiente: round2(v.saldoPendiente),
        items: v.items,
      });
    }
  }

  for (const m of movimientos) {
    if (m.estado !== 'CONFIRMADO') continue;
    totalDebe += m.debe || 0;
    totalHaber += m.haber || 0;

    if (
      (m.tipo === 'CARGO_MANUAL' || m.tipo === 'SALDO_INICIAL') &&
      m.saldoPendienteCargo > 0.009
    ) {
      const fMov = new Date(m.fecha);
      const fVenc = m.fechaVencimiento
        ? new Date(m.fechaVencimiento)
        : calcularFechaVencimiento(fMov, config.plazoDias);
      const diasVencido = calcularDiasDiferencia(fVenc, hoy);
      const vencido = diasVencido > 0;

      if (vencido) {
        deudaVencida += m.saldoPendienteCargo;
        if (diasVencido > diasMoraMaxima) diasMoraMaxima = diasVencido;
      }

      comprobantesPendientes.push({
        id: m.id,
        destinoTipo: 'CARGO',
        numero: m.numero,
        fecha: fMov,
        fechaVencimiento: fVenc,
        diasVencido,
        vencido,
        concepto: m.concepto,
        montoTotalOperacion: round2(m.debe),
        montoOriginalCC: round2(m.debe),
        montoPagadoCC: round2(Math.max(0, m.debe - m.saldoPendienteCargo)),
        saldoPendiente: round2(m.saldoPendienteCargo),
      });
    }
  }

  // Ordenar comprobantes pendientes por fecha ascendente (FIFO)
  comprobantesPendientes.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  // 2. Armar Libro Mayor / Estado de Cuenta cronológico unificado
  type EntradaMayor = {
    id: string;
    origen: 'VENTA' | 'MOVIMIENTO_CC';
    tipo: string;
    numero: string;
    fecha: Date;
    fechaVencimiento?: Date | null;
    concepto: string;
    debe: number;
    haber: number;
    saldoAcumulado: number;
    saldoPendienteComprobante: number;
    estado: string;
    estadoPago?: string;
    operadorNombre?: string | null;
    observaciones?: string | null;
    mediosPago?: any;
    imputaciones?: any;
    venta?: any;
    movimiento?: any;
  };

  const entradasBrutas: Omit<EntradaMayor, 'saldoAcumulado'>[] = [];

  for (const v of ventasCC) {
    const montoCC =
      v.imputadoCuentaCorriente > 0 ? v.imputadoCuentaCorriente : v.saldoPendiente;
    const fVenta = new Date(v.fecha);
    const fVenc = calcularFechaVencimiento(fVenta, config.plazoDias);

    entradasBrutas.push({
      id: `vta-${v.id}`,
      origen: 'VENTA',
      tipo: 'VENTA_CC',
      numero: v.numero,
      fecha: fVenta,
      fechaVencimiento: fVenc,
      concepto: `Compra en Cuenta Corriente (${v.items?.length || 0} art.)${
        v.total > montoCC ? ` — Total Vta: $${v.total.toLocaleString('es-AR')}` : ''
      }`,
      debe: round2(montoCC),
      haber: 0,
      saldoPendienteComprobante: v.estado === 'CONFIRMADA' ? round2(v.saldoPendiente) : 0,
      estado: v.estado,
      estadoPago: v.estadoPago,
      operadorNombre: v.vendedorNombre,
      observaciones: v.observaciones,
      venta: v,
    });
  }

  for (const m of movimientos) {
    const fMov = new Date(m.fecha);
    entradasBrutas.push({
      id: `mov-${m.id}`,
      origen: 'MOVIMIENTO_CC',
      tipo: m.tipo,
      numero: m.numero,
      fecha: fMov,
      fechaVencimiento: m.fechaVencimiento ? new Date(m.fechaVencimiento) : null,
      concepto: m.concepto,
      debe: round2(m.debe || 0),
      haber: round2(m.haber || 0),
      saldoPendienteComprobante:
        m.estado === 'CONFIRMADO' && (m.tipo === 'CARGO_MANUAL' || m.tipo === 'SALDO_INICIAL')
          ? round2(m.saldoPendienteCargo)
          : 0,
      estado: m.estado,
      operadorNombre: m.operadorNombre,
      observaciones: m.observaciones,
      mediosPago: m.mediosPago,
      imputaciones: m.imputaciones,
      movimiento: m,
    });
  }

  // Ordenar cronológicamente ascendente para calcular saldo acumulado exacto
  entradasBrutas.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  let runningBalance = 0;
  const libroMayorCompleto: EntradaMayor[] = entradasBrutas.map((entry) => {
    const isAnulado = entry.estado === 'ANULADA' || entry.estado === 'ANULADO';
    if (!isAnulado) {
      runningBalance = round2(runningBalance + entry.debe - entry.haber);
    }
    return {
      ...entry,
      saldoAcumulado: runningBalance,
    };
  });

  // Aplicar filtro de fechas al libro mayor si se solicitó (conservando el saldo acumulado real)
  let libroMayor = libroMayorCompleto;
  if (filtros?.fechaDesde) {
    const desde = new Date(filtros.fechaDesde);
    libroMayor = libroMayor.filter((e) => e.fecha >= desde);
  }
  if (filtros?.fechaHasta) {
    const hasta = new Date(filtros.fechaHasta);
    hasta.setHours(23, 59, 59, 999);
    libroMayor = libroMayor.filter((e) => e.fecha <= hasta);
  }

  totalDebe = round2(totalDebe);
  totalHaber = round2(totalHaber);
  const saldoActual = round2(totalDebe - totalHaber);
  deudaVencida = round2(Math.max(0, Math.min(deudaVencida, Math.max(0, saldoActual))));
  if (deudaVencida <= 0.01) {
    diasMoraMaxima = 0;
  }
  const deudaNoVencida = round2(Math.max(0, saldoActual - deudaVencida));
  const disponibleCredito =
    config.limiteCredito > 0 ? round2(Math.max(0, config.limiteCredito - saldoActual)) : null;
  const porcentajeUsoCredito =
    config.limiteCredito > 0
      ? Math.min(999, Math.round((Math.max(0, saldoActual) / config.limiteCredito) * 100))
      : 0;

  return {
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre,
      email: cliente.email,
      telefono: cliente.telefono,
      direccion: cliente.direccion,
      activo: cliente.activo,
      listaPrecio: cliente.listaPrecio,
      config: {
        limiteCredito: config.limiteCredito,
        plazoDias: config.plazoDias,
        estadoCredito: config.estadoCredito,
        observaciones: config.observaciones,
      },
    },
    resumen: {
      totalDebe,
      totalHaber,
      saldoActual,
      deudaVencida,
      deudaNoVencida,
      disponibleCredito,
      porcentajeUsoCredito,
      comprobantesPendientesCount: comprobantesPendientes.length,
      diasMoraMaxima,
    },
    comprobantesPendientes,
    libroMayor: [...libroMayor].reverse(), // Más recientes arriba, con su saldoAcumulado histórico
    libroMayorCronologico: libroMayor, // Orden ascendente para impresión de Estado de Cuenta
    recibos: movimientos
      .filter((m) => m.tipo === 'RECIBO_PAGO' || m.tipo === 'NOTA_CREDITO')
      .reverse(),
  };
}

/**
 * Registra un Recibo de Cobranza en Cuenta Corriente con imputación FIFO o Manual
 */
export async function registrarCobranzaCC(input: RegistrarCobranzaInput) {
  await ensureCuentaCorrienteTables();

  if (!input.clienteId) {
    throw new Error('Debe especificar un cliente válido');
  }

  const mediosValidos = (input.mediosPago || []).filter((m) => (Number(m.monto) || 0) > 0);
  if (mediosValidos.length === 0) {
    throw new Error('Debe ingresar al menos un medio de pago con monto mayor a $0');
  }

  const montoTotalCobrado = round2(
    mediosValidos.reduce((acc, m) => acc + (Number(m.monto) || 0), 0)
  );

  if (montoTotalCobrado <= 0) {
    throw new Error('El monto total a cobrar debe ser mayor a $0');
  }

  const cliente = await prisma.hdbClient.findUnique({
    where: { id: input.clienteId },
  });

  if (!cliente) {
    throw new Error('Cliente no encontrado');
  }

  const operadorNombre = input.operadorNombre?.trim() || 'Administración HDB';

  const resultado = await prisma.$transaction(
    async (tx) => {
      // Obtener ventas y cargos pendientes dentro de la transacción
      const [ventasPendientes, cargosPendientes] = await Promise.all([
        tx.venta.findMany({
          where: {
            clienteId: input.clienteId,
            estado: 'CONFIRMADA',
            saldoPendiente: { gt: 0.009 },
          },
          orderBy: { fecha: 'asc' },
        }),
        tx.cuentaCorrienteMovimiento.findMany({
          where: {
            clienteId: input.clienteId,
            estado: 'CONFIRMADO',
            tipo: { in: ['CARGO_MANUAL', 'SALDO_INICIAL'] },
            saldoPendienteCargo: { gt: 0.009 },
          },
          orderBy: { fecha: 'asc' },
        }),
      ]);

      // Unificar pendientes ordenados por antigüedad (FIFO)
      type PendienteItem = {
        destinoTipo: 'VENTA' | 'CARGO';
        id: string;
        numero: string;
        fecha: Date;
        saldoPendiente: number;
        totalPagadoActual?: number;
      };

      const colaPendientes: PendienteItem[] = [
        ...ventasPendientes.map((v) => ({
          destinoTipo: 'VENTA' as const,
          id: v.id,
          numero: v.numero,
          fecha: new Date(v.fecha),
          saldoPendiente: round2(v.saldoPendiente),
          totalPagadoActual: round2(v.totalPagado),
        })),
        ...cargosPendientes.map((c) => ({
          destinoTipo: 'CARGO' as const,
          id: c.id,
          numero: c.numero,
          fecha: new Date(c.fecha),
          saldoPendiente: round2(c.saldoPendienteCargo),
        })),
      ].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

      const imputacionesRealizadas: Array<{
        destinoTipo: 'VENTA' | 'CARGO';
        destinoId: string;
        numero: string;
        montoImputado: number;
        saldoAnterior: number;
        saldoPosterior: number;
      }> = [];

      let montoRestantePorImputar = montoTotalCobrado;

      if (
        input.modoImputacion === 'MANUAL' &&
        input.imputacionesManuales &&
        input.imputacionesManuales.length > 0
      ) {
        const pendientesMap = new Map(
          colaPendientes.map((p) => [`${p.destinoTipo}:${p.id}`, p])
        );

        for (const imp of input.imputacionesManuales) {
          const montoSolicitado = round2(imp.monto);
          if (montoSolicitado <= 0) continue;

          const target = pendientesMap.get(`${imp.destinoTipo}:${imp.destinoId}`);
          if (!target) {
            throw new Error(
              `El comprobante seleccionado (${imp.destinoId}) no tiene saldo pendiente o no pertenece al cliente`
            );
          }

          if (montoSolicitado > target.saldoPendiente + 0.05) {
            throw new Error(
              `El monto imputado ($${montoSolicitado}) supera el saldo pendiente de ${target.numero} ($${target.saldoPendiente})`
            );
          }

          if (montoSolicitado > montoRestantePorImputar + 0.05) {
            throw new Error(
              'La suma de las imputaciones manuales supera el monto total de los medios de pago'
            );
          }

          const montoEfectivo = Math.min(target.saldoPendiente, montoSolicitado, montoRestantePorImputar);
          const saldoAnterior = target.saldoPendiente;
          const saldoPosterior = round2(Math.max(0, saldoAnterior - montoEfectivo));

          imputacionesRealizadas.push({
            destinoTipo: target.destinoTipo,
            destinoId: target.id,
            numero: target.numero,
            montoImputado: round2(montoEfectivo),
            saldoAnterior,
            saldoPosterior,
          });

          montoRestantePorImputar = round2(Math.max(0, montoRestantePorImputar - montoEfectivo));
        }
      } else {
        // Imputación automática FIFO (del comprobante más antiguo al más nuevo)
        for (const pend of colaPendientes) {
          if (montoRestantePorImputar <= 0.009) break;
          const montoEfectivo = round2(Math.min(pend.saldoPendiente, montoRestantePorImputar));
          if (montoEfectivo <= 0) continue;

          const saldoAnterior = pend.saldoPendiente;
          const saldoPosterior = round2(Math.max(0, saldoAnterior - montoEfectivo));

          imputacionesRealizadas.push({
            destinoTipo: pend.destinoTipo,
            destinoId: pend.id,
            numero: pend.numero,
            montoImputado: montoEfectivo,
            saldoAnterior,
            saldoPosterior,
          });

          montoRestantePorImputar = round2(Math.max(0, montoRestantePorImputar - montoEfectivo));
        }
      }

      // Actualizar cada Venta o Cargo afectado
      for (const imp of imputacionesRealizadas) {
        if (imp.destinoTipo === 'VENTA') {
          const nuevoEstadoPago = imp.saldoPosterior <= 0.009 ? 'PAGADO' : 'PARCIAL';
          const conciliada = imp.saldoPosterior <= 0.009;

          await tx.venta.update({
            where: { id: imp.destinoId },
            data: {
              saldoPendiente: imp.saldoPosterior,
              totalPagado: { increment: imp.montoImputado },
              estadoPago: nuevoEstadoPago,
              cuentaCorrienteConciliada: conciliada,
            },
          });
        } else {
          await tx.cuentaCorrienteMovimiento.update({
            where: { id: imp.destinoId },
            data: {
              saldoPendienteCargo: imp.saldoPosterior,
            },
          });
        }
      }

      const numeroRecibo = await generarNumeroCC(tx, 'REC');

      const detalleComprobantes =
        imputacionesRealizadas.length > 0
          ? `Cancela: ${imputacionesRealizadas.map((i) => i.numero).join(', ')}`
          : 'Pago a cuenta / Anticipo';

      const conceptoFinal =
        input.concepto?.trim() || `Recibo de Cobranza (${detalleComprobantes})`;

      const recibo = await tx.cuentaCorrienteMovimiento.create({
        data: {
          numero: numeroRecibo,
          clienteId: input.clienteId,
          tipo: 'RECIBO_PAGO',
          concepto: conceptoFinal,
          debe: 0,
          haber: montoTotalCobrado,
          saldoPendienteCargo: 0,
          mediosPago: mediosValidos.map((m) => ({
            metodo: m.metodo,
            monto: round2(m.monto),
            referencia: m.referencia?.trim() || null,
            observaciones: m.observaciones?.trim() || null,
          })),
          imputaciones: imputacionesRealizadas,
          estado: 'CONFIRMADO',
          operadorId: input.operadorId || null,
          operadorNombre,
          observaciones: input.observaciones?.trim() || null,
        },
        include: {
          cliente: true,
        },
      });

      return recibo;
    },
    {
      maxWait: 15000,
      timeout: 30000,
    }
  );

  await logAudit({
    userId: input.operadorId || undefined,
    userName: operadorNombre,
    action: 'CREATE',
    entity: 'CUENTA_CORRIENTE_RECIBO',
    entityId: resultado.id,
    newValue: {
      numero: resultado.numero,
      cliente: cliente.nombre,
      montoTotal: montoTotalCobrado,
      imputaciones: resultado.imputaciones,
    },
  });

  return resultado;
}

/**
 * Registra un movimiento manual en Cuenta Corriente (Saldo Inicial, Cargo / Nota de Débito, o Nota de Crédito)
 */
export async function registrarMovimientoManualCC(input: RegistrarMovimientoManualInput) {
  await ensureCuentaCorrienteTables();

  if (!input.clienteId) {
    throw new Error('Debe especificar un cliente');
  }
  const monto = round2(input.monto);
  if (monto <= 0) {
    throw new Error('El monto del movimiento debe ser mayor a $0');
  }
  if (!input.concepto || input.concepto.trim().length < 3) {
    throw new Error('Debe ingresar un concepto descriptivo (mínimo 3 caracteres)');
  }

  const cliente = await prisma.hdbClient.findUnique({
    where: { id: input.clienteId },
    include: { cuentaCorrienteConfig: true },
  });

  if (!cliente) {
    throw new Error('Cliente no encontrado');
  }

  const operadorNombre = input.operadorNombre?.trim() || 'Administración HDB';
  const esCredito =
    input.tipo === 'NOTA_CREDITO' ||
    (input.tipo === 'SALDO_INICIAL' && input.sentidoSaldoInicial === 'HABER');
  const serie = esCredito ? 'NC' : 'ND';

  const resultado = await prisma.$transaction(async (tx) => {
    const numero = await generarNumeroCC(tx, serie);

    let imputacionesRealizadas: any[] = [];

    const aplicarImputacionFifo =
      input.tipo === 'NOTA_CREDITO' ? input.imputarFifo !== false : Boolean(input.imputarFifo);

    if (esCredito && aplicarImputacionFifo) {
      // Imputar Nota de Crédito por FIFO a comprobantes pendientes
      const [ventasPendientes, cargosPendientes] = await Promise.all([
        tx.venta.findMany({
          where: {
            clienteId: input.clienteId,
            estado: 'CONFIRMADA',
            saldoPendiente: { gt: 0.009 },
          },
          orderBy: { fecha: 'asc' },
        }),
        tx.cuentaCorrienteMovimiento.findMany({
          where: {
            clienteId: input.clienteId,
            estado: 'CONFIRMADO',
            tipo: { in: ['CARGO_MANUAL', 'SALDO_INICIAL'] },
            saldoPendienteCargo: { gt: 0.009 },
          },
          orderBy: { fecha: 'asc' },
        }),
      ]);

      const cola = [
        ...ventasPendientes.map((v) => ({
          destinoTipo: 'VENTA' as const,
          id: v.id,
          numero: v.numero,
          fecha: new Date(v.fecha),
          saldoPendiente: round2(v.saldoPendiente),
        })),
        ...cargosPendientes.map((c) => ({
          destinoTipo: 'CARGO' as const,
          id: c.id,
          numero: c.numero,
          fecha: new Date(c.fecha),
          saldoPendiente: round2(c.saldoPendienteCargo),
        })),
      ].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

      let restante = monto;
      for (const pend of cola) {
        if (restante <= 0.009) break;
        const aplicado = round2(Math.min(pend.saldoPendiente, restante));
        if (aplicado <= 0) continue;

        const saldoAnterior = pend.saldoPendiente;
        const saldoPosterior = round2(Math.max(0, saldoAnterior - aplicado));

        imputacionesRealizadas.push({
          destinoTipo: pend.destinoTipo,
          destinoId: pend.id,
          numero: pend.numero,
          montoImputado: aplicado,
          saldoAnterior,
          saldoPosterior,
        });

        if (pend.destinoTipo === 'VENTA') {
          await tx.venta.update({
            where: { id: pend.id },
            data: {
              saldoPendiente: saldoPosterior,
              totalPagado: { increment: aplicado },
              estadoPago: saldoPosterior <= 0.009 ? 'PAGADO' : 'PARCIAL',
              cuentaCorrienteConciliada: saldoPosterior <= 0.009,
            },
          });
        } else {
          await tx.cuentaCorrienteMovimiento.update({
            where: { id: pend.id },
            data: {
              saldoPendienteCargo: saldoPosterior,
            },
          });
        }

        restante = round2(Math.max(0, restante - aplicado));
      }
    }

    const plazoDias = cliente.cuentaCorrienteConfig?.plazoDias ?? 30;
    let fVenc: Date | null = null;
    if (!esCredito) {
      fVenc = input.fechaVencimiento
        ? new Date(input.fechaVencimiento)
        : calcularFechaVencimiento(new Date(), plazoDias);
    }

    const mov = await tx.cuentaCorrienteMovimiento.create({
      data: {
        numero,
        clienteId: input.clienteId,
        tipo: input.tipo,
        concepto: input.concepto.trim(),
        debe: esCredito ? 0 : monto,
        haber: esCredito ? monto : 0,
        saldoPendienteCargo: esCredito ? 0 : monto,
        fechaVencimiento: fVenc,
        imputaciones: imputacionesRealizadas.length > 0 ? imputacionesRealizadas : undefined,
        estado: 'CONFIRMADO',
        operadorId: input.operadorId || null,
        operadorNombre,
        observaciones: input.observaciones?.trim() || null,
      },
      include: {
        cliente: true,
      },
    });

    return mov;
  });

  await logAudit({
    userId: input.operadorId || undefined,
    userName: operadorNombre,
    action: 'CREATE',
    entity: 'CUENTA_CORRIENTE_MOVIMIENTO',
    entityId: resultado.id,
    newValue: {
      numero: resultado.numero,
      tipo: resultado.tipo,
      debe: resultado.debe,
      haber: resultado.haber,
      cliente: cliente.nombre,
    },
  });

  return resultado;
}

/**
 * Anula un movimiento de Cuenta Corriente (Recibo de Pago, Cargo Manual, Saldo Inicial o Nota de Crédito)
 * revirtiendo las imputaciones realizadas sobre ventas o cargos.
 */
export async function anularMovimientoCC(
  movimientoId: string,
  motivo: string,
  usuarioId?: string,
  usuarioNombre?: string
) {
  await ensureCuentaCorrienteTables();

  if (!motivo || motivo.trim().length < 3) {
    throw new Error('Debe ingresar un motivo válido de anulación (mínimo 3 caracteres)');
  }

  const mov = await prisma.cuentaCorrienteMovimiento.findUnique({
    where: { id: movimientoId },
    include: { cliente: true },
  });

  if (!mov) {
    throw new Error('Movimiento de cuenta corriente no encontrado');
  }

  if (mov.estado === 'ANULADO') {
    throw new Error('Este comprobante ya se encuentra anulado');
  }

  // Si es un CARGO_MANUAL o SALDO_INICIAL, verificar que no tenga cobros aplicados activos
  if (mov.tipo === 'CARGO_MANUAL' || mov.tipo === 'SALDO_INICIAL') {
    if (mov.saldoPendienteCargo < mov.debe - 0.01) {
      throw new Error(
        'No se puede anular un cargo que ya posee cobros o créditos imputados. Anule primero el recibo correspondiente.'
      );
    }
  }

  const resultado = await prisma.$transaction(async (tx) => {
    // Si tiene imputaciones (RECIBO_PAGO o NOTA_CREDITO), revertirlas
    const imputaciones = Array.isArray(mov.imputaciones) ? (mov.imputaciones as any[]) : [];

    for (const imp of imputaciones) {
      const montoRevertir = round2(imp.montoImputado);
      if (montoRevertir <= 0) continue;

      if (imp.destinoTipo === 'VENTA') {
        const venta = await tx.venta.findUnique({ where: { id: imp.destinoId } });
        if (venta) {
          const nuevoSaldoPendiente = round2(venta.saldoPendiente + montoRevertir);
          const nuevoTotalPagado = round2(Math.max(0, venta.totalPagado - montoRevertir));
          const nuevoEstadoPago =
            nuevoSaldoPendiente <= 0.009
              ? 'PAGADO'
              : nuevoTotalPagado > 0.009
              ? 'PARCIAL'
              : 'PENDIENTE';

          await tx.venta.update({
            where: { id: venta.id },
            data: {
              saldoPendiente: nuevoSaldoPendiente,
              totalPagado: nuevoTotalPagado,
              estadoPago: nuevoEstadoPago,
              cuentaCorrienteConciliada: false,
            },
          });
        }
      } else if (imp.destinoTipo === 'CARGO') {
        const cargo = await tx.cuentaCorrienteMovimiento.findUnique({
          where: { id: imp.destinoId },
        });
        if (cargo) {
          const nuevoSaldoCargo = round2(
            Math.min(cargo.debe, cargo.saldoPendienteCargo + montoRevertir)
          );
          await tx.cuentaCorrienteMovimiento.update({
            where: { id: cargo.id },
            data: {
              saldoPendienteCargo: nuevoSaldoCargo,
            },
          });
        }
      }
    }

    const actualizado = await tx.cuentaCorrienteMovimiento.update({
      where: { id: movimientoId },
      data: {
        estado: 'ANULADO',
        saldoPendienteCargo: 0,
        motivoAnulacion: motivo.trim(),
        anuladoEn: new Date(),
        anuladoPorNombre: usuarioNombre || 'Administrador',
      },
      include: { cliente: true },
    });

    return actualizado;
  });

  await logAudit({
    userId: usuarioId,
    userName: usuarioNombre,
    action: 'UPDATE',
    entity: 'CUENTA_CORRIENTE_MOVIMIENTO',
    entityId: movimientoId,
    oldValue: { estado: 'CONFIRMADO' },
    newValue: { estado: 'ANULADO', motivo: motivo.trim() },
  });

  return resultado;
}

/**
 * Actualiza los parámetros crediticios de un cliente (límite de crédito, plazo en días, estado)
 */
export async function actualizarConfiguracionCC(
  clienteId: string,
  input: ConfigCuentaCorrienteInput,
  usuarioId?: string,
  usuarioNombre?: string
) {
  await ensureCuentaCorrienteTables();

  const cliente = await prisma.hdbClient.findUnique({ where: { id: clienteId } });
  if (!cliente) {
    throw new Error('Cliente no encontrado');
  }

  const limiteCredito = Math.max(0, round2(input.limiteCredito));
  const plazoDias = Math.max(0, Math.round(Number(input.plazoDias) || 30));
  const estadoCredito = ['ACTIVO', 'OBSERVADO', 'SUSPENDIDO'].includes(input.estadoCredito)
    ? input.estadoCredito
    : 'ACTIVO';

  const config = await prisma.cuentaCorrienteConfig.upsert({
    where: { clienteId },
    update: {
      limiteCredito,
      plazoDias,
      estadoCredito,
      observaciones: input.observaciones?.trim() || null,
    },
    create: {
      clienteId,
      limiteCredito,
      plazoDias,
      estadoCredito,
      observaciones: input.observaciones?.trim() || null,
    },
  });

  await logAudit({
    userId: usuarioId,
    userName: usuarioNombre,
    action: 'UPDATE',
    entity: 'CUENTA_CORRIENTE_CONFIG',
    entityId: clienteId,
    newValue: {
      cliente: cliente.nombre,
      limiteCredito,
      plazoDias,
      estadoCredito,
    },
  });

  return config;
}
