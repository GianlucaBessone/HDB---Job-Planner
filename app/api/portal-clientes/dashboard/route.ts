import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedResponsible, getAuthorizedProjectIds } from '@/lib/portalAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthenticatedResponsible(req);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const authorizedProjectIds = await getAuthorizedProjectIds(session.responsibleId);
    if (authorizedProjectIds.length === 0) {
      return NextResponse.json({
        kpis: {
          totalOts: 0,
          abiertasActuales: 0,
          cerradasPeriodo: 0,
          pendientesFirma: 0,
          totalHoras: 0,
          costoTotal: 0,
          manoObra: 0,
          materiales: 0,
          costoPromedioOt: 0,
          tiempoPromedioHoras: 0,
        },
        graficoOts: { categories: [], abiertas: [], cerradas: [] },
        graficoEstados: [],
        graficoCostos: { categories: [], total: [], manoObra: [], materiales: [] },
        graficoSectores: [],
        proyectosDisponibles: [],
        sectoresDisponibles: [],
      });
    }

    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get('proyectoId') || undefined;
    const sector = searchParams.get('sector') || undefined;
    const estado = searchParams.get('estado') || undefined;
    const yearStr = searchParams.get('year') || String(new Date().getFullYear());
    const year = parseInt(yearStr, 10);
    const quarter = searchParams.get('quarter') || undefined; // 'Q1' | 'Q2' | 'Q3' | 'Q4'

    if (proyectoId && !authorizedProjectIds.includes(proyectoId)) {
      return NextResponse.json({ error: 'Proyecto no autorizado' }, { status: 403 });
    }

    const baseWhere: any = {
      clienteId: session.clientId,
      proyectoId: proyectoId ? proyectoId : { in: authorizedProjectIds },
    };

    if (sector && sector !== 'TODOS') {
      baseWhere.sector = sector;
    }

    if (estado && estado !== 'TODOS') {
      baseWhere.estado = estado;
    }

    // Fetch all OTs for this client & authorized projects
    const allOts = await prisma.ordenTrabajo.findMany({
      where: baseWhere,
      include: {
        ciclos: {
          include: {
            operadores: true,
            materiales: true,
          },
        },
        proyecto: { select: { id: true, nombre: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Determine period date boundaries
    let startDate = new Date(year, 0, 1);
    let endDate = new Date(year, 11, 31, 23, 59, 59);

    if (quarter === 'Q1') {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 2, 31, 23, 59, 59);
    } else if (quarter === 'Q2') {
      startDate = new Date(year, 3, 1);
      endDate = new Date(year, 5, 30, 23, 59, 59);
    } else if (quarter === 'Q3') {
      startDate = new Date(year, 6, 1);
      endDate = new Date(year, 8, 30, 23, 59, 59);
    } else if (quarter === 'Q4') {
      startDate = new Date(year, 9, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59);
    }

    // 1. Current Snapshot KPIs
    const abiertasActuales = allOts.filter((ot) => ot.estado === 'ABIERTA' || ot.estado === 'PAUSADA').length;
    const pendientesFirma = allOts.filter((ot) => ot.estado === 'PENDIENTE_FIRMA').length;

    // Filter OTs closed or active within selected period
    const otsCerradasEnPeriodo = allOts.filter((ot) => {
      if (ot.estado !== 'CERRADA' || !ot.fechaCierre) return false;
      const cDate = new Date(ot.fechaCierre);
      return cDate >= startDate && cDate <= endDate;
    });

    const cerradasPeriodo = otsCerradasEnPeriodo.length;

    // Calculate Costs for OTs created or active in period
    const otsEnPeriodo = allOts.filter((ot) => {
      const crDate = new Date(ot.createdAt);
      return crDate >= startDate && crDate <= endDate;
    });

    let costoTotal = 0;
    let manoObra = 0;
    let materiales = 0;
    let totalHoras = 0;

    for (const ot of otsEnPeriodo) {
      for (const ciclo of ot.ciclos) {
        costoTotal += ciclo.totalGeneral;
        manoObra += ciclo.totalManoObra;
        materiales += ciclo.totalMateriales;
        totalHoras += ciclo.totalHoras;
      }
    }

    const costoPromedioOt = otsEnPeriodo.length > 0 ? Math.round((costoTotal / otsEnPeriodo.length) * 100) / 100 : 0;

    // Average execution time for closed OTs in period (in hours)
    let tiempoTotalHoras = 0;
    for (const ot of otsCerradasEnPeriodo) {
      if (ot.fechaCierre) {
        const diffMs = new Date(ot.fechaCierre).getTime() - new Date(ot.createdAt).getTime();
        tiempoTotalHoras += diffMs / (1000 * 60 * 60);
      }
    }
    const tiempoPromedioHoras =
      cerradasPeriodo > 0 ? Math.round((tiempoTotalHoras / cerradasPeriodo) * 10) / 10 : 0;

    // 2. Gráfico OTs por período (Monthly breakdown for the year)
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const otsPorMesAbiertas = new Array(12).fill(0);
    const otsPorMesCerradas = new Array(12).fill(0);
    const costoTotalPorMes = new Array(12).fill(0);
    const costoMoPorMes = new Array(12).fill(0);
    const costoMatPorMes = new Array(12).fill(0);

    for (const ot of allOts) {
      const crDate = new Date(ot.createdAt);
      if (crDate.getFullYear() === year) {
        const m = crDate.getMonth();
        otsPorMesAbiertas[m] += 1;
        for (const c of ot.ciclos) {
          costoTotalPorMes[m] += c.totalGeneral;
          costoMoPorMes[m] += c.totalManoObra;
          costoMatPorMes[m] += c.totalMateriales;
        }
      }
      if (ot.estado === 'CERRADA' && ot.fechaCierre) {
        const fcDate = new Date(ot.fechaCierre);
        if (fcDate.getFullYear() === year) {
          otsPorMesCerradas[fcDate.getMonth()] += 1;
        }
      }
    }

    // 3. Gráfico Estado de OTs (Donut distribution)
    const graficoEstados = [
      { name: 'Abiertas', value: allOts.filter((ot) => ot.estado === 'ABIERTA').length, itemStyle: { color: '#3b82f6' } },
      { name: 'Pausadas', value: allOts.filter((ot) => ot.estado === 'PAUSADA').length, itemStyle: { color: '#f59e0b' } },
      { name: 'Pendientes Firma', value: allOts.filter((ot) => ot.estado === 'PENDIENTE_FIRMA').length, itemStyle: { color: '#a855f7' } },
      { name: 'Cerradas', value: allOts.filter((ot) => ot.estado === 'CERRADA').length, itemStyle: { color: '#10b981' } },
    ];

    // 4. Gráfico Costos por Sector
    const sectorCostsMap: Record<string, { total: number; mo: number; mat: number; horas: number }> = {};
    for (const ot of otsEnPeriodo) {
      const sKey = ot.sector || 'Sin sector';
      if (!sectorCostsMap[sKey]) {
        sectorCostsMap[sKey] = { total: 0, mo: 0, mat: 0, horas: 0 };
      }
      for (const c of ot.ciclos) {
        sectorCostsMap[sKey].total += c.totalGeneral;
        sectorCostsMap[sKey].mo += c.totalManoObra;
        sectorCostsMap[sKey].mat += c.totalMateriales;
        sectorCostsMap[sKey].horas += c.totalHoras;
      }
    }

    const graficoSectores = Object.entries(sectorCostsMap)
      .map(([sectorName, data]) => ({
        sector: sectorName,
        costoTotal: Math.round(data.total),
        manoObra: Math.round(data.mo),
        materiales: Math.round(data.mat),
        horas: Math.round(data.horas * 10) / 10,
      }))
      .sort((a, b) => b.costoTotal - a.costoTotal)
      .slice(0, 8);

    // Lists of available projects & sectors for filtering
    const [proyectosDisponibles, clientSectores, otSectores] = await Promise.all([
      prisma.project.findMany({
        where: { id: { in: authorizedProjectIds } },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
      prisma.clientSector.findMany({
        where: { clientId: session.clientId },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
      prisma.ordenTrabajo.findMany({
        where: {
          clienteId: session.clientId,
          proyectoId: { in: authorizedProjectIds },
          sector: { not: null },
        },
        select: { sector: true },
        distinct: ['sector'],
      }),
    ]);

    const allSectores = Array.from(
      new Set([
        ...clientSectores.map((s) => s.nombre.trim()),
        ...otSectores.map((o) => (o.sector || '').trim()).filter(Boolean),
      ])
    ).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      kpis: {
        totalOts: allOts.length,
        abiertasActuales,
        cerradasPeriodo,
        pendientesFirma,
        totalHoras: Math.round(totalHoras * 10) / 10,
        costoTotal: Math.round(costoTotal),
        manoObra: Math.round(manoObra),
        materiales: Math.round(materiales),
        costoPromedioOt,
        tiempoPromedioHoras,
      },
      graficoOts: {
        categories: monthNames,
        abiertas: otsPorMesAbiertas,
        cerradas: otsPorMesCerradas,
      },
      graficoEstados,
      graficoCostos: {
        categories: monthNames,
        total: costoTotalPorMes.map((v) => Math.round(v)),
        manoObra: costoMoPorMes.map((v) => Math.round(v)),
        materiales: costoMatPorMes.map((v) => Math.round(v)),
      },
      graficoSectores,
      proyectosDisponibles,
      sectoresDisponibles: allSectores,
    });
  } catch (error: any) {
    console.error('Error in portal GET /api/portal-clientes/dashboard:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener dashboard' }, { status: 500 });
  }
}
