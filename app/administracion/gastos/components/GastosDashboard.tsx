'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { DonutChart, TrendChart } from '@/app/dashboard/EChartsComponents';
import { DollarSign, FileText, PieChart, Info, Activity, TrendingUp, Filter, Calendar, BarChart3, XCircle, ChevronDown, CalendarDays } from 'lucide-react';

function MultiSelectDropdown({ 
    options, 
    selected, 
    onChange, 
    label, 
    icon 
}: { 
    options: { value: string, label: string }[], 
    selected: string[], 
    onChange: (val: string[]) => void, 
    label: string, 
    icon?: React.ReactNode 
}) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (opt: string) => {
        onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
    };

    return (
        <div className="relative min-w-[160px] flex-1" ref={containerRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full h-11 bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors outline-none focus:ring-4 focus:ring-blue-500/10"
            >
                <div className="flex items-center gap-2 truncate">
                    {icon}
                    <span className="truncate">{selected.length === 0 ? `Todo (${label})` : `${selected.length} seleccionados`}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isOpen && (
                <div className="absolute z-[60] mt-1 w-full min-w-[200px] bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto p-1 animate-in fade-in zoom-in-95 duration-200">
                    {options.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 text-center font-bold">No hay opciones</div>
                    ) : (
                        options.map(opt => (
                            <button 
                                key={opt.value} 
                                onClick={(e) => {
                                    e.preventDefault();
                                    toggleOption(opt.value);
                                }}
                                className="w-full flex items-center text-left gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-lg cursor-pointer transition-colors"
                            >
                                <div className="flex items-center justify-center w-5 h-5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 overflow-hidden shrink-0">
                                    <div className={`w-full h-full bg-blue-500 transition-transform flex items-center justify-center ${selected.includes(opt.value) ? 'scale-100' : 'scale-0'}`}>
                                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{opt.label}</span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

function MetricTooltip({ def, purpose, calc }: { def: string; purpose: string; calc: string }) {
    return (
        <div className="group/tooltip relative">
            <Info className="w-5 h-5 text-slate-300 hover:text-blue-500 transition-colors cursor-pointer" />
            <div className="absolute top-0 right-full mr-3 w-64 p-4 bg-slate-900 text-white rounded-2xl text-[10px] leading-relaxed hidden group-hover/tooltip:block z-[50] shadow-2xl animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="space-y-3">
                    <div>
                        <span className="block font-black uppercase tracking-widest text-blue-500 mb-1">¿Qué mide?</span>
                        <p className="text-slate-300 font-medium">{def}</p>
                    </div>
                    <div>
                        <span className="block font-black uppercase tracking-widest text-emerald-400 mb-1">¿Para qué sirve?</span>
                        <p className="text-slate-300 font-medium">{purpose}</p>
                    </div>
                    {calc && calc !== "N/A" && (
                        <div className="pt-2 border-t border-slate-700/50">
                            <span className="block font-black uppercase tracking-widest text-amber-400 mb-1">Cálculo</span>
                            <code className="text-[9px] font-mono bg-black/30 p-1.5 rounded block text-slate-300">{calc}</code>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function KpiCard({ title, value, icon, color, trend, tooltip, active }: { title: string; value: string | number; icon: React.ReactNode; color: string; trend: string; tooltip?: { def: string; purpose: string; calc: string }, active?: boolean }) {
    return (
        <div className={`bg-card text-card-foreground p-2.5 md:p-3 rounded-xl border ${active ? 'border-blue-500 ring-1 ring-blue-500 shadow-md' : 'border-slate-200 dark:border-slate-700 shadow-sm'} hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between h-[64px] md:h-[72px] gap-2`}>
            <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center shrink-0 ${color} text-white shadow-sm`}>
                    <div className="[&>svg]:w-4 [&>svg]:h-4 md:[&>svg]:w-5 md:[&>svg]:h-5">
                        {icon}
                    </div>
                </div>
                <div className="flex flex-col justify-center min-w-0 py-0.5">
                    <p className="text-[10px] md:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest line-clamp-1">{title}</p>
                    <h4 className="text-lg md:text-xl lg:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tighter truncate leading-none mt-0.5">{value}</h4>
                </div>
            </div>
            
            <div className="flex flex-col items-end justify-between shrink-0 h-full py-0.5">
                {tooltip ? <MetricTooltip {...tooltip} /> : <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1.5 py-0.5 bg-background text-foreground/50 rounded-md">KPI</div>}
                <div className="flex items-center gap-1.5 mt-auto">
                    <div className={`w-1.5 h-1.5 rounded-full ${color.replace('bg-', 'bg-').replace('500', '400')} animate-pulse`} />
                    <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase max-w-[60px] lg:max-w-[80px] truncate" title={trend}>{trend}</p>
                </div>
            </div>
        </div>
    );
}

export default function GastosDashboard() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [selectedYears, setSelectedYears] = useState<string[]>([new Date().getFullYear().toString()]);
  const [selectedQuarters, setSelectedQuarters] = useState<string[]>([]);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Cross-Filters State
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMonthTrend, setSelectedMonthTrend] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/administracion/gastos')
      .then(res => res.json())
      .then(resData => {
        setData(Array.isArray(resData) ? resData : []);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  const enrichedData = useMemo(() => {
    return data.map(item => {
      const d = new Date(item.fechaEmision);
      const year = d.getFullYear().toString();
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const periodo = `${year}${month}`;
      const q = `Q${Math.floor(d.getMonth() / 3) + 1}`;
      const categoria = item.codigoGasto?.descripcion || 'Sin categorizar';
      return { ...item, year, month, periodo, q, categoria };
    });
  }, [data]);

  // Unique filter options
  const availableYears = useMemo(() => Array.from(new Set(enrichedData.map(d => d.year))).sort((a, b) => b.localeCompare(a)).map(y => ({ value: y, label: y })), [enrichedData]);
  const availableQuarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const availablePeriods = useMemo(() => Array.from(new Set(enrichedData.map(d => d.periodo))).sort((a, b) => b.localeCompare(a)).map(p => ({ value: p, label: `${p.substring(0,4)} - Mes ${p.substring(4)}` })), [enrichedData]);

  // Apply filters
  const filteredData = useMemo(() => {
    return enrichedData.filter(d => {
      if (selectedYears.length > 0 && !selectedYears.includes(d.year)) return false;
      if (selectedQuarters.length > 0 && !selectedQuarters.includes(d.q)) return false;
      if (selectedPeriods.length > 0 && !selectedPeriods.includes(d.periodo)) return false;
      if (selectedCategory && d.categoria !== selectedCategory) return false;
      if (selectedMonthTrend && d.periodo !== selectedMonthTrend) return false;
      
      if (dateFrom) {
          if (new Date(d.fechaEmision) < new Date(dateFrom)) return false;
      }
      if (dateTo) {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          if (new Date(d.fechaEmision) > end) return false;
      }

      return true;
    });
  }, [enrichedData, selectedYears, selectedQuarters, selectedPeriods, selectedCategory, selectedMonthTrend, dateFrom, dateTo]);

  // Data for Trend Chart (ignores selectedMonthTrend to show the full line)
  const trendDataRaw = useMemo(() => {
    return enrichedData.filter(d => {
      if (selectedYears.length > 0 && !selectedYears.includes(d.year)) return false;
      if (selectedQuarters.length > 0 && !selectedQuarters.includes(d.q)) return false;
      if (selectedPeriods.length > 0 && !selectedPeriods.includes(d.periodo)) return false;
      if (selectedCategory && d.categoria !== selectedCategory) return false;
      
      if (dateFrom) {
          if (new Date(d.fechaEmision) < new Date(dateFrom)) return false;
      }
      if (dateTo) {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          if (new Date(d.fechaEmision) > end) return false;
      }
      return true;
    });
  }, [enrichedData, selectedYears, selectedQuarters, selectedPeriods, selectedCategory, dateFrom, dateTo]);

  const totalGasto = filteredData.reduce((acc, curr) => acc + curr.total, 0);

  const pieData = useMemo(() => {
    const porCodigo: Record<string, number> = {};
    filteredData.forEach(item => {
      porCodigo[item.categoria] = (porCodigo[item.categoria] || 0) + item.total;
    });
    return Object.entries(porCodigo)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const trendData = useMemo(() => {
    const porPeriodo: Record<string, number> = {};
    trendDataRaw.forEach(item => {
      porPeriodo[item.periodo] = (porPeriodo[item.periodo] || 0) + item.total;
    });
    return Object.entries(porPeriodo)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value }));
  }, [trendDataRaw]);

  const uniqueCategoriesCount = useMemo(() => {
      const map: Record<string, boolean> = {};
      filteredData.forEach(d => map[d.categoria] = true);
      return Object.keys(map).length;
  }, [filteredData]);

  // ECharts Events Handlers
  const onDonutClick = (params: any) => {
    if (params.name) {
        setSelectedCategory(prev => prev === params.name ? null : params.name);
    }
  };

  const onTrendClick = (params: any) => {
    if (params.name) {
        setSelectedMonthTrend(prev => prev === params.name ? null : params.name);
    }
  };

  const clearAllFilters = () => {
      setSelectedYears([]);
      setSelectedQuarters([]);
      setSelectedPeriods([]);
      setSelectedCategory(null);
      setSelectedMonthTrend(null);
      setDateFrom('');
      setDateTo('');
  };

  const hasAnyFilter = selectedYears.length > 0 || selectedQuarters.length > 0 || selectedPeriods.length > 0 || selectedCategory || selectedMonthTrend || dateFrom || dateTo;

  const toggleArrayItem = (arr: string[], item: string, setArr: any) => {
      setArr(arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item]);
  };

  if (loading) {
    return (
        <div className="w-full h-[60vh] flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 p-2 md:p-4 pb-12 overflow-y-auto h-full">
      
      {/* Top Filters Header */}
      <div className="bg-card text-card-foreground border border-slate-200 dark:border-slate-700 rounded-2xl md:rounded-[2rem] p-3 md:p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 text-sm">
                  <Filter className="w-4 h-4 text-blue-500" />
                  Filtros de Análisis
              </h3>
              {hasAnyFilter && (
                  <button onClick={clearAllFilters} className="flex items-center gap-1 text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 px-2 py-1 rounded-md transition-colors">
                      <XCircle className="w-3 h-3" /> Limpiar Todo
                  </button>
              )}
          </div>
          
          <div className="flex flex-wrap items-end gap-4 md:gap-6">
              {/* Fechas (Desde/Hasta) */}
              <div className="flex flex-wrap gap-4">
                  <div className="space-y-1.5 min-w-[140px]">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Desde</label>
                      <input 
                          type="date" 
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="w-full h-11 bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                      />
                  </div>
                  <div className="space-y-1.5 min-w-[140px]">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Hasta</label>
                      <input 
                          type="date" 
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="w-full h-11 bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                      />
                  </div>
              </div>

              {/* Año Dropdown */}
              <div className="space-y-1.5 flex-1 min-w-[160px]">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Años</label>
                  <MultiSelectDropdown 
                      options={availableYears} 
                      selected={selectedYears} 
                      onChange={setSelectedYears} 
                      label="Años"
                      icon={<CalendarDays className="w-4 h-4 text-slate-400" />}
                  />
              </div>

              {/* Periodos Dropdown */}
              <div className="space-y-1.5 flex-1 min-w-[200px]">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Períodos</label>
                  <MultiSelectDropdown 
                      options={availablePeriods} 
                      selected={selectedPeriods} 
                      onChange={setSelectedPeriods} 
                      label="Períodos"
                      icon={<Calendar className="w-4 h-4 text-slate-400" />}
                  />
              </div>

              {/* Trimestre Filter (Chips) */}
              <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Cuatrimestre</label>
                  <div className="flex flex-wrap gap-1">
                      {availableQuarters.map(q => (
                          <button 
                              key={q}
                              onClick={() => toggleArrayItem(selectedQuarters, q, setSelectedQuarters)}
                              className={`px-4 h-11 text-sm font-bold rounded-xl transition-all ${selectedQuarters.includes(q) ? 'bg-indigo-500 text-white shadow-sm ring-2 ring-indigo-500/20' : 'bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                          >
                              {q}
                          </button>
                      ))}
                  </div>
              </div>
          </div>

          {/* Active Cross-Filters Badges */}
          {(selectedCategory || selectedMonthTrend) && (
              <div className="flex flex-wrap gap-2 pt-3 mt-2 border-t border-slate-100 dark:border-slate-700/50">
                  <span className="text-[10px] font-black text-slate-400 uppercase pt-1">Filtros Cruzados Activos:</span>
                  {selectedCategory && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg text-xs font-bold border border-amber-200 dark:border-amber-900/50">
                          <Activity className="w-3 h-3" />
                          Categoría: {selectedCategory}
                          <button onClick={() => setSelectedCategory(null)} className="hover:text-amber-900 hover:bg-amber-200 dark:hover:bg-amber-900/50 rounded-full p-0.5 transition-colors"><XCircle className="w-3 h-3" /></button>
                      </span>
                  )}
                  {selectedMonthTrend && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-xs font-bold border border-emerald-200 dark:border-emerald-900/50">
                          <BarChart3 className="w-3 h-3" />
                          Período (Evolución): {selectedMonthTrend}
                          <button onClick={() => setSelectedMonthTrend(null)} className="hover:text-emerald-900 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 rounded-full p-0.5 transition-colors"><XCircle className="w-3 h-3" /></button>
                      </span>
                  )}
              </div>
          )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 auto-rows-fr relative z-20">
        <KpiCard
            title="Total Gastos"
            value={`$${totalGasto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
            icon={<DollarSign className="w-6 h-6" />}
            color="bg-emerald-500"
            trend="Acumulado"
            active={!!selectedMonthTrend || !!selectedCategory}
            tooltip={{
                def: "La sumatoria total de todos los gastos procesados y guardados en el sistema.",
                purpose: "Mide la salida de capital acumulado en concepto de gastos registrados.",
                calc: "Sumatoria del campo total de todas las facturas."
            }}
        />
        <KpiCard
            title="Facturas"
            value={filteredData.length}
            icon={<FileText className="w-6 h-6" />}
            color="bg-blue-500"
            trend="Comprobantes"
            tooltip={{
                def: "Cantidad total de comprobantes o facturas registradas.",
                purpose: "Mide el volumen operativo de carga de documentación.",
                calc: "Conteo simple de registros."
            }}
        />
        <KpiCard
            title="Categorías"
            value={uniqueCategoriesCount}
            icon={<Activity className="w-6 h-6" />}
            color="bg-indigo-500"
            trend="Códigos únicos"
        />
        <KpiCard
            title="Promedio por Factura"
            value={`$${filteredData.length > 0 ? (totalGasto / filteredData.length).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 0}`}
            icon={<TrendingUp className="w-6 h-6" />}
            color="bg-amber-500"
            trend="Ticket Medio"
            tooltip={{
                def: "Importe promedio erogado por cada comprobante o factura.",
                purpose: "Permite estimar el ticket medio de gasto.",
                calc: "Total Gastos / Facturas."
            }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-visible">
        {/* Trend Line Chart (NEW) */}
        <div className="bg-card text-card-foreground p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Evolución de Gastos</h3>
                </div>
                <MetricTooltip
                    def="Evolución temporal del gasto total mes a mes."
                    purpose="Analizar tendencias, estacionalidad o picos de consumo."
                    calc="Sumatoria de gastos agrupados por el periodo de fecha de emisión."
                />
            </div>
            {trendData.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px]">Sin datos para graficar</div>
            ) : (
                <TrendChart 
                    data={trendData} 
                    color="#3b82f6" 
                    height={250} 
                    valuePrefix="$"
                    onEvents={{
                        'click': onTrendClick
                    }}
                />
            )}
            <div className="mt-2 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Tip: Clickea un punto en el gráfico para filtrar por mes
            </div>
        </div>

        {/* Classification Donut */}
        <div className="bg-card text-card-foreground p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center overflow-visible lg:col-span-1">
            <div className="flex items-center justify-between w-full mb-6">
                <div className="flex items-center gap-3">
                    <PieChart className="w-5 h-5 text-indigo-500" />
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Distribución</h3>
                </div>
            </div>

            <div className="w-full h-56 mb-4 mt-2">
                {pieData.length > 0 ? (
                  <DonutChart 
                      data={pieData.slice(0, 5)}
                      colors={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b']}
                      centerText=""
                      centerSubtext="CATEGORÍAS"
                      height={224}
                      onEvents={{
                          'click': onDonutClick
                      }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 font-bold text-[10px] uppercase tracking-widest">Sin datos</div>
                )}
            </div>
            <div className="mt-auto mb-4 w-full text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Tip: Clickea una porción para filtrar
            </div>
        </div>

        {/* Breakdown List */}
        <div className="lg:col-span-3 bg-card text-card-foreground p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-emerald-500" />
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Desglose de Categorías</h3>
                </div>
            </div>
            <div className="mt-4">
                {pieData.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 font-bold text-[10px] uppercase tracking-widest">No hay categorías registradas</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pieData.map((cat, idx) => (
                            <div key={idx} className={`space-y-1.5 p-3 rounded-xl transition-colors ${selectedCategory === cat.name ? 'bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200' : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}>
                                <div className="flex justify-between items-center px-1">
                                    <span className="font-bold text-slate-700 dark:text-slate-200 text-sm truncate pr-4">{cat.name}</span>
                                    <span className="text-sm font-black text-slate-900 dark:text-white">
                                        ${cat.value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="h-2.5 bg-muted text-muted-foreground/80 rounded-full overflow-hidden border border-slate-50 dark:border-slate-700">
                                    <div
                                        className="h-full rounded-full transition-all duration-1000 bg-emerald-500"
                                        style={{ width: `${Math.min((cat.value / totalGasto) * 100, 100)}%` }}
                                    />
                                </div>
                                <div className="flex justify-between px-1">
                                    <span className="text-[10px] font-bold text-slate-400 cursor-pointer hover:text-blue-500" onClick={() => setSelectedCategory(prev => prev === cat.name ? null : cat.name)}>
                                        {selectedCategory === cat.name ? 'Quitar filtro' : 'Filtrar categoría'}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400">
                                        {((cat.value / totalGasto) * 100).toFixed(1)}% del total
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
