'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Building2,
  MapPin,
  Clock,
  CheckCircle2,
  FileSignature,
  DollarSign,
  TrendingUp,
  Loader2,
  Users,
  Boxes,
  Activity,
  Layers,
  PieChart,
} from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import ReactECharts to avoid SSR issues
const ReactECharts = dynamic(() => import('echarts-for-react'), {
  ssr: false,
  loading: () => (
    <div className="h-56 flex items-center justify-center text-xs text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando gráfico...
    </div>
  ),
});

export default function PortalDashboardPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [quarter, setQuarter] = useState<string>('TODOS');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [selectedEstado, setSelectedEstado] = useState<string>('TODOS');

  const [data, setData] = useState<any | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    loadDashboard(controller.signal);
    return () => controller.abort();
  }, [year, quarter, selectedProjectId, selectedSector, selectedEstado]);

  const loadDashboard = async (signal?: AbortSignal) => {
    if (!data) {
      setInitialLoading(true);
    } else {
      setIsUpdating(true);
    }
    try {
      let url = `/api/portal-clientes/dashboard?year=${year}`;
      if (quarter !== 'TODOS') url += `&quarter=${quarter}`;
      if (selectedProjectId) url += `&proyectoId=${selectedProjectId}`;
      if (selectedSector) url += `&sector=${encodeURIComponent(selectedSector)}`;
      if (selectedEstado && selectedEstado !== 'TODOS') url += `&estado=${selectedEstado}`;

      const res = await fetch(url, { signal });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(err);
      }
    } finally {
      setInitialLoading(false);
      setIsUpdating(false);
    }
  };

  const kpis = data?.kpis || {
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
  };

  // 1. Gráfico OTs por período (Barras) con soporte de actualización fluida
  const barChartOption = useMemo(() => ({
    animation: true,
    animationDuration: 500,
    animationEasing: 'cubicOut' as const,
    animationDurationUpdate: 500,
    animationEasingUpdate: 'cubicOut' as const,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {
      data: ['Abiertas', 'Cerradas'],
      textStyle: { color: '#64748b', fontSize: 11 },
      bottom: 0,
      itemHeight: 8,
      itemWidth: 12,
    },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: data?.graficoOts?.categories || [],
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { fontSize: 10, color: '#64748b' },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
      axisLabel: { fontSize: 10, color: '#64748b' },
    },
    series: [
      {
        name: 'Abiertas',
        type: 'bar',
        data: data?.graficoOts?.abiertas || [],
        itemStyle: { color: '#3b82f6', borderRadius: [3, 3, 0, 0] },
      },
      {
        name: 'Cerradas',
        type: 'bar',
        data: data?.graficoOts?.cerradas || [],
        itemStyle: { color: '#10b981', borderRadius: [3, 3, 0, 0] },
      },
    ],
  }), [data?.graficoOts]);

  // 2. Gráfico Distribución por Estado (Dona) con actualización fluida
  const donutChartOption = useMemo(() => ({
    animation: true,
    animationDuration: 500,
    animationEasing: 'cubicOut' as const,
    animationDurationUpdate: 500,
    animationEasingUpdate: 'cubicOut' as const,
    tooltip: {
      trigger: 'item',
      formatter: '{b}: <strong>{c}</strong> ({d}%)',
    },
    legend: {
      bottom: 0,
      textStyle: { color: '#64748b', fontSize: 10 },
      itemHeight: 8,
      itemWidth: 12,
    },
    series: [
      {
        name: 'Estado OTs',
        type: 'pie',
        radius: ['45%', '72%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 11,
            fontWeight: 'bold',
            formatter: '{b}\n{c}',
          },
        },
        data: (data?.graficoEstados || []).filter((item: any) => item.value > 0),
      },
    ],
  }), [data?.graficoEstados]);

  // 3. Gráfico Evolución de Costos (Líneas) con actualización fluida
  const lineChartOption = useMemo(() => ({
    animation: true,
    animationDuration: 500,
    animationEasing: 'cubicOut' as const,
    animationDurationUpdate: 500,
    animationEasingUpdate: 'cubicOut' as const,
    tooltip: {
      trigger: 'axis',
      formatter: function (params: any) {
        let str = `<strong>${params[0]?.name || ''}</strong><br/>`;
        params.forEach((p: any) => {
          str += `${p.marker} ${p.seriesName}: $${Number(p.value).toLocaleString('es-AR')}<br/>`;
        });
        return str;
      },
    },
    legend: {
      data: ['Total', 'M. Obra', 'Materiales'],
      textStyle: { color: '#64748b', fontSize: 11 },
      bottom: 0,
      itemHeight: 8,
      itemWidth: 12,
    },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: data?.graficoCostos?.categories || [],
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { fontSize: 10, color: '#64748b' },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        fontSize: 10,
        color: '#64748b',
        formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`,
      },
      splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
    },
    series: [
      {
        name: 'Total',
        type: 'line',
        smooth: true,
        data: data?.graficoCostos?.total || [],
        itemStyle: { color: '#059669' },
        lineStyle: { width: 2.5 },
      },
      {
        name: 'M. Obra',
        type: 'line',
        smooth: true,
        data: data?.graficoCostos?.manoObra || [],
        itemStyle: { color: '#6366f1' },
        lineStyle: { width: 1.5, type: 'dashed' },
      },
      {
        name: 'Materiales',
        type: 'line',
        smooth: true,
        data: data?.graficoCostos?.materiales || [],
        itemStyle: { color: '#f59e0b' },
        lineStyle: { width: 1.5 },
      },
    ],
  }), [data?.graficoCostos]);

  // 4. Gráfico Costos por Sector (Barras horizontales) con actualización fluida
  const sectoresData = data?.graficoSectores || [];
  const sectorNames = useMemo(() => [...sectoresData].reverse().map((s: any) => s.sector), [sectoresData]);
  const sectorTotals = useMemo(() => [...sectoresData].reverse().map((s: any) => s.costoTotal), [sectoresData]);

  const sectorChartOption = useMemo(() => ({
    animation: true,
    animationDuration: 500,
    animationEasing: 'cubicOut' as const,
    animationDurationUpdate: 500,
    animationEasingUpdate: 'cubicOut' as const,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (p: any) => `${p[0]?.name}: <strong>$${Number(p[0]?.value || 0).toLocaleString('es-AR')}</strong>`,
    },
    grid: { left: '3%', right: '5%', bottom: '8%', top: '6%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: {
        fontSize: 10,
        color: '#64748b',
        formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`,
      },
      splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
    },
    yAxis: {
      type: 'category',
      data: sectorNames,
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: {
        fontSize: 10,
        color: '#64748b',
        formatter: (val: string) => (val.length > 18 ? val.substring(0, 16) + '...' : val),
      },
    },
    series: [
      {
        type: 'bar',
        data: sectorTotals,
        itemStyle: { color: '#059669', borderRadius: [0, 3, 3, 0] },
      },
    ],
  }), [sectorNames, sectorTotals]);

  return (
    <div className="space-y-4">
      {/* Header Compacto */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Dashboard Operativo & Económico
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Control de rendimiento, evolución de costos y seguimiento de OTs autorizadas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isUpdating && (
            <div className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1.5 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Actualizando datos...</span>
            </div>
          )}
          <div className="self-start sm:self-auto px-3 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-bold flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>{quarter === 'TODOS' ? `Año ${year}` : `${quarter} ${year}`}</span>
          </div>
        </div>
      </div>

      {/* 8.1 Barra Superior de Filtros Compacta */}
      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 text-xs font-medium">
          {/* Período: Año */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Año</label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Período: Trimestre */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Trimestre</label>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="TODOS">Año Completo</option>
              <option value="Q1">Q1 (Ene - Mar)</option>
              <option value="Q2">Q2 (Abr - Jun)</option>
              <option value="Q3">Q3 (Jul - Sep)</option>
              <option value="Q4">Q4 (Oct - Dic)</option>
            </select>
          </div>

          {/* Proyecto */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Proyecto</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary truncate"
            >
              <option value="">Todos los Proyectos</option>
              {(data?.proyectosDisponibles || []).map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Sector / Ubicación */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Sector / Ubicación</label>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary truncate"
            >
              <option value="">Todos los Sectores</option>
              {(data?.sectoresDisponibles || []).map((s: string) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Estado */}
          <div className="col-span-2 sm:col-span-4 lg:col-span-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Estado</label>
            <select
              value={selectedEstado}
              onChange={(e) => setSelectedEstado(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="ABIERTA">Abiertas</option>
              <option value="PAUSADA">Pausadas</option>
              <option value="PENDIENTE_FIRMA">Pendiente Firma</option>
              <option value="CERRADA">Cerradas</option>
            </select>
          </div>
        </div>

        {/* Barra sutil de carga en caliente */}
        <div
          className={`h-0.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2 transition-opacity duration-200 ${
            isUpdating ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="h-full bg-primary animate-pulse w-full" />
        </div>
      </div>

      {initialLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-xs font-semibold">Cargando métricas y gráficos...</p>
        </div>
      ) : (
        <div className={`space-y-4 transition-opacity duration-300 ${isUpdating ? 'opacity-85' : 'opacity-100'}`}>
          {/* 8.2 Métricas Clave (KPIs) Compactas en Fila Única */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {/* OTs del Período */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] uppercase font-bold tracking-wider">OTs Período</span>
                <Layers className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-slate-100 leading-tight">
                {kpis.totalOts}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                <span className="text-blue-600 font-bold">{kpis.abiertasActuales} act.</span> ·{' '}
                <span className="text-emerald-600 font-bold">{kpis.cerradasPeriodo} cer.</span>
              </div>
            </div>

            {/* Horas Totales */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] uppercase font-bold tracking-wider">Horas Acum.</span>
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono leading-tight">
                {kpis.totalHoras} h
              </div>
              <div className="text-[10px] text-slate-500 mt-1 font-medium">
                {kpis.tiempoPromedioHoras ? `~${kpis.tiempoPromedioHoras}h / res.` : 'Tiempo cargado'}
              </div>
            </div>

            {/* Costo Total */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] uppercase font-bold tracking-wider">Costo Total</span>
                <DollarSign className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="text-xl font-black text-primary font-mono leading-tight">
                ${kpis.costoTotal.toLocaleString('es-AR')}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 font-medium truncate">
                Mano de obra + Mat.
              </div>
            </div>

            {/* Mano de Obra */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] uppercase font-bold tracking-wider">Mano de Obra</span>
                <Users className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono leading-tight">
                ${kpis.manoObra.toLocaleString('es-AR')}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 font-medium truncate">
                {kpis.costoTotal > 0 ? `${Math.round((kpis.manoObra / kpis.costoTotal) * 100)}% del total` : '0%'}
              </div>
            </div>

            {/* Materiales */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] uppercase font-bold tracking-wider">Materiales</span>
                <Boxes className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono leading-tight">
                ${kpis.materiales.toLocaleString('es-AR')}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 font-medium truncate">
                {kpis.costoTotal > 0 ? `${Math.round((kpis.materiales / kpis.costoTotal) * 100)}% del total` : '0%'}
              </div>
            </div>

            {/* Promedio / OT */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] uppercase font-bold tracking-wider">Promedio / OT</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono leading-tight">
                ${kpis.costoPromedioOt.toLocaleString('es-AR')}
              </div>
              <div className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 font-semibold truncate">
                {kpis.pendientesFirma} pend. firma
              </div>
            </div>
          </div>

          {/* 8.3 Grilla de Gráficos 2x2 (Altura compacta 220-240px) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {/* Gráfico 1: OTs por período */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-blue-500" />
                    Órdenes de Trabajo por Período
                  </h3>
                  <p className="text-[10px] text-slate-400">Volumen mensual de OTs abiertas vs cerradas</p>
                </div>
              </div>
              <div className="h-[220px]">
                <ReactECharts
                  option={barChartOption}
                  notMerge={true}
                  lazyUpdate={true}
                  style={{ height: '100%', width: '100%' }}
                />
              </div>
            </div>

            {/* Gráfico 2: Distribución por Estado */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <PieChart className="w-3.5 h-3.5 text-purple-500" />
                    Distribución por Estado
                  </h3>
                  <p className="text-[10px] text-slate-400">Proporción de OTs abiertas, pausadas, pendientes y cerradas</p>
                </div>
              </div>
              <div className="h-[220px]">
                <ReactECharts
                  option={donutChartOption}
                  notMerge={true}
                  lazyUpdate={true}
                  style={{ height: '100%', width: '100%' }}
                />
              </div>
            </div>

            {/* Gráfico 3: Evolución de Costos */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    Evolución Económica de Costos
                  </h3>
                  <p className="text-[10px] text-slate-400">Costo total acumulado, mano de obra y materiales por mes</p>
                </div>
              </div>
              <div className="h-[220px]">
                <ReactECharts
                  option={lineChartOption}
                  notMerge={true}
                  lazyUpdate={true}
                  style={{ height: '100%', width: '100%' }}
                />
              </div>
            </div>

            {/* Gráfico 4: Costos por Sector / Ubicación */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    Costos por Sector / Ubicación
                  </h3>
                  <p className="text-[10px] text-slate-400">Ranking de sectores o plantas con mayor costo acumulado</p>
                </div>
              </div>
              <div className="h-[220px]">
                {sectorNames.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    Sin datos de sectores registrados en este período
                  </div>
                ) : (
                  <ReactECharts
                    option={sectorChartOption}
                    notMerge={true}
                    lazyUpdate={true}
                    style={{ height: '100%', width: '100%' }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
