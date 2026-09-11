'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { normalizeSku } from '@/lib/ventas/skuUtils';
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Loader2,
  RefreshCw,
  Download,
  Filter,
  Check,
  Plus,
  Search,
  ShieldCheck,
  Building2,
  Package,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import { formatARS, parseExcelNumber } from '@/lib/formatCurrency';
import VentasNavTabs from '@/components/ventas/VentasNavTabs';

interface ColumnMapping {
  sku: string;
  codigoBarras: string;
  nombre: string;
  categoria: string;
  marca: string;
  familia: string;
  subFamilia: string;
  unidad: string;
  precioBase: string;
  costo: string;
  stock: string;
}

const DEFAULT_MAPPING: ColumnMapping = {
  sku: '',
  codigoBarras: '',
  nombre: '',
  categoria: '',
  marca: '',
  familia: '',
  subFamilia: '',
  unidad: '',
  precioBase: '',
  costo: '',
  stock: '',
};

export default function ImportarProductosPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard Step: 1. Archivo | 2. Mapeo | 3. Validación | 4. Previsualización | 5. Confirmación / Resultado
  const [step, setStep] = useState<'archivo' | 'mapeo' | 'validacion' | 'previsualizacion' | 'resultado'>('archivo');

  // File data
  const [fileName, setFileName] = useState('');
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [totalRowsDetected, setTotalRowsDetected] = useState(0);

  // Mapping
  const [mapping, setMapping] = useState<ColumnMapping>(DEFAULT_MAPPING);

  // Existing metadata from system
  const [meta, setMeta] = useState<any>({
    marcas: [],
    categorias: [],
    familias: [],
    unidades: [],
  });

  // Validation report
  const [isValidating, setIsValidating] = useState(false);
  const [diagnosticoFilas, setDiagnosticoFilas] = useState<any[]>([]);
  const [resumenValidacion, setResumenValidacion] = useState<{
    totalFilas: number;
    correctas: number;
    advertencias: number;
    errores: number;
  }>({ totalFilas: 0, correctas: 0, advertencias: 0, errores: 0 });

  // Missing masters to explicitly create or map
  const [maestrosFaltantes, setMaestrosFaltantes] = useState<{
    marcas: string[];
    categorias: string[];
    familias: string[];
    subfamilias: Array<{ subfamilia: string; familia: string }>;
    unidades: string[];
  }>({ marcas: [], categorias: [], familias: [], subfamilias: [], unidades: [] });

  // Explicit user choices for missing masters
  const [maestrosACrear, setMaestrosACrear] = useState<{
    marcas: Set<string>;
    categorias: Set<string>;
    familias: Set<string>;
    subfamilias: Set<string>; // key: "fam:::subfam"
    unidades: Set<string>;
  }>({
    marcas: new Set(),
    categorias: new Set(),
    familias: new Set(),
    subfamilias: new Set(),
    unidades: new Set(),
  });

  // Duplicate strategy (Default: Omitir productos con SKU existente)
  const [omitirExistentes, setOmitirExistentes] = useState(true);

  // Preview filtering & search
  const [previewFilter, setPreviewFilter] = useState<'todas' | 'correcta' | 'advertencia' | 'error'>('todas');
  const [previewSearch, setPreviewSearch] = useState('');

  // Execution & Results
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [executionStatusText, setExecutionStatusText] = useState('');
  const [resultadoFinal, setResultadoFinal] = useState<{
    totalFilas: number;
    creados: number;
    omitidos: number;
    errores: number;
    reporteDetalles: Array<{ filaNumero: number; sku: string; campo: string; valor: string; motivo: string }>;
  } | null>(null);

  // Load system masters
  useEffect(() => {
    fetch('/api/ventas/meta')
      .then((r) => r.json())
      .then((d) => {
        if (d && !d.error) setMeta(d);
      })
      .catch((e) => console.error(e));
  }, []);

  // File selection and parsing
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (data.length === 0) {
          showToast('El archivo Excel no contiene filas en la primera hoja', 'error');
          return;
        }

        const cols = Object.keys(data[0] || {});
        setFileColumns(cols);
        setRawRows(data);
        setTotalRowsDetected(data.length);

        // Auto-match columns by standard naming
        const findCol = (pattern: RegExp) => cols.find((c) => pattern.test(c.trim())) || '';

        const autoMap: ColumnMapping = {
          sku: findCol(/^sku$/i) || findCol(/sku|c[oó]digo.*interno|cod.*art/i) || '',
          codigoBarras: findCol(/c[oó]digo.*barras|barcode|ean|upc/i) || '',
          nombre: findCol(/^nombre$/i) || findCol(/^descripci[oó]n$/i) || findCol(/nombre|descripci[oó]n|producto|art[ií]culo/i) || '',
          categoria: findCol(/^categor[ií]a$/i) || findCol(/categor[ií]a|rubro/i) || '',
          marca: findCol(/^marca$/i) || findCol(/marca|fabricante/i) || '',
          familia: findCol(/^familia$/i) || findCol(/familia/i) || '',
          subFamilia: findCol(/^sub-?familia$/i) || findCol(/sub-?familia|subgrupo/i) || '',
          unidad: findCol(/^unidad$/i) || findCol(/unidad|medida|u\.?m\.?/i) || '',
          precioBase: findCol(/^precio.*venta$/i) || findCol(/precio.*base|precio.*venta|precio/i) || '',
          costo: findCol(/^costo$/i) || findCol(/costo/i) || '',
          stock: findCol(/^stock$/i) || findCol(/stock|cantidad/i) || '',
        };

        setMapping(autoMap);
        setStep('mapeo');
        showToast(`Archivo leído: ${data.length} filas detectadas`, 'success');
      } catch (err: any) {
        showToast('Error al leer el archivo Excel: ' + err.message, 'error');
      }
    };

    reader.readAsBinaryString(file);
  };

  // Run Validation step
  const handleRunValidation = async () => {
    if (!mapping.sku) {
      showToast('Debe asignar la columna correspondiente a SKU Interno', 'error');
      return;
    }
    if (!mapping.nombre) {
      showToast('Debe asignar la columna correspondiente a Nombre / Descripción', 'error');
      return;
    }

    setIsValidating(true);
    try {
      // Map rows into standardized objects
      const mappedRows = rawRows.map((r) => ({
        sku: normalizeSku(r[mapping.sku]),
        codigoBarras: mapping.codigoBarras ? String(r[mapping.codigoBarras] || '').trim() : '',
        nombre: String(r[mapping.nombre] || '').trim(),
        categoria: mapping.categoria ? String(r[mapping.categoria] || '').trim() : '',
        marca: mapping.marca ? String(r[mapping.marca] || '').trim() : '',
        familia: mapping.familia ? String(r[mapping.familia] || '').trim() : '',
        subFamilia: mapping.subFamilia ? String(r[mapping.subFamilia] || '').trim() : '',
        unidad: mapping.unidad ? String(r[mapping.unidad] || '').trim() : '',
        precioBase: mapping.precioBase ? parseExcelNumber(r[mapping.precioBase]) : 0,
        costo: mapping.costo ? parseExcelNumber(r[mapping.costo]) : 0,
        stock: mapping.stock ? parseExcelNumber(r[mapping.stock]) : 0,
      }));

      const res = await fetch('/api/ventas/productos/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo: 'validar',
          filas: mappedRows,
          opciones: { omitirExistentes },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al validar datos');

      setResumenValidacion(data.resumen);
      setDiagnosticoFilas(data.filas || []);
      setMaestrosFaltantes(data.maestrosFaltantes || { marcas: [], categorias: [], familias: [], subfamilias: [], unidades: [] });

      setStep('validacion');
      showToast(`Validación finalizada: ${data.resumen.correctas} correctas, ${data.resumen.advertencias} advertencias, ${data.resumen.errores} errores`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Error en validación', 'error');
    } finally {
      setIsValidating(false);
    }
  };

  // Toggle explicit creation of missing master
  const toggleCrearMaestro = (tipo: 'marcas' | 'categorias' | 'familias' | 'unidades', valor: string) => {
    setMaestrosACrear((prev) => {
      const nextSet = new Set(prev[tipo]);
      if (nextSet.has(valor)) {
        nextSet.delete(valor);
      } else {
        nextSet.add(valor);
      }
      return { ...prev, [tipo]: nextSet };
    });
  };

  const toggleCrearSubfamilia = (fam: string, sub: string) => {
    const key = `${fam}:::${sub}`;
    setMaestrosACrear((prev) => {
      const nextSet = new Set(prev.subfamilias);
      if (nextSet.has(key)) {
        nextSet.delete(key);
      } else {
        nextSet.add(key);
      }
      return { ...prev, subfamilias: nextSet };
    });
  };

  // Filtered rows for preview
  const filteredRows = useMemo(() => {
    let result = diagnosticoFilas;

    if (previewFilter !== 'todas') {
      result = result.filter((r) => r.estado === previewFilter);
    }

    if (previewSearch.trim()) {
      const words = previewSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
      result = result.filter((r) => {
        return words.every((w) => {
          const isNum = /^\d+$/.test(w);
          const padded = isNum && w.length <= 5 ? w.padStart(5, '0') : null;
          const matchSku = padded
            ? r.sku.toLowerCase() === padded || r.sku.toLowerCase() === w
            : r.sku.toLowerCase().includes(w);

          return (
            matchSku ||
            r.nombre.toLowerCase().includes(w) ||
            (r.marca && r.marca.toLowerCase().includes(w)) ||
            (r.categoria && r.categoria.toLowerCase().includes(w))
          );
        });
      });
    }

    return result;
  }, [diagnosticoFilas, previewFilter, previewSearch]);

  // Execute Import in resilient client batches
  const handleExecuteImport = async () => {
    setIsExecuting(true);
    setExecutionProgress(0);
    setExecutionStatusText('Iniciando importación...');
    try {
      // Collect authorized masters to create
      const payloadMaestros = {
        marcas: Array.from(maestrosACrear.marcas),
        categorias: Array.from(maestrosACrear.categorias),
        familias: Array.from(maestrosACrear.familias),
        subfamilias: Array.from(maestrosACrear.subfamilias).map((key) => {
          const [familia, subfamilia] = key.split(':::');
          return { familia, subfamilia };
        }),
        unidades: Array.from(maestrosACrear.unidades),
      };

      const rowsToImport = diagnosticoFilas;
      const totalRows = rowsToImport.length;
      const CLIENT_CHUNK_SIZE = 100;

      let totalCreados = 0;
      let totalOmitidos = 0;
      let totalErrores = 0;
      const allReporteDetalles: Array<{ filaNumero: number; sku: string; campo: string; valor: string; motivo: string }> = [];

      for (let offset = 0; offset < totalRows; offset += CLIENT_CHUNK_SIZE) {
        const chunk = rowsToImport.slice(offset, offset + CLIENT_CHUNK_SIZE);
        const isFirstChunk = offset === 0;
        const currentBatch = Math.floor(offset / CLIENT_CHUNK_SIZE) + 1;
        const totalBatches = Math.ceil(totalRows / CLIENT_CHUNK_SIZE);

        setExecutionStatusText(`Procesando lote ${currentBatch} de ${totalBatches} (${offset} / ${totalRows} productos)...`);

        const res = await fetch('/api/ventas/productos/importar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modo: 'ejecutar',
            filas: chunk,
            opciones: { omitirExistentes },
            maestrosACrear: isFirstChunk ? payloadMaestros : undefined,
            nombreArchivo: fileName,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Error en lote ${currentBatch}`);
        }

        totalCreados += data.resumen?.creados || 0;
        totalOmitidos += data.resumen?.omitidos || 0;
        totalErrores += data.resumen?.errores || 0;
        if (Array.isArray(data.reporteDetalles)) {
          allReporteDetalles.push(...data.reporteDetalles);
        }

        const processed = Math.min(offset + CLIENT_CHUNK_SIZE, totalRows);
        setExecutionProgress(Math.round((processed / totalRows) * 100));
      }

      setResultadoFinal({
        totalFilas: totalRows,
        creados: totalCreados,
        omitidos: totalOmitidos,
        errores: totalErrores,
        reporteDetalles: allReporteDetalles,
      });

      setExecutionProgress(100);
      setStep('resultado');
      showToast(`Importación completada: ${totalCreados} productos procesados con éxito`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error durante la importación', 'error');
    } finally {
      setIsExecuting(false);
      setExecutionStatusText('');
    }
  };

  // Export CSV of error / skipped report
  const handleDownloadReport = () => {
    if (!resultadoFinal || resultadoFinal.reporteDetalles.length === 0) {
      showToast('No hay registros de incidencias para exportar', 'info');
      return;
    }

    const headers = ['Fila Excel', 'SKU', 'Campo', 'Valor Ingresado', 'Motivo / Observación'];
    const rows = resultadoFinal.reporteDetalles.map((d) => [
      d.filaNumero,
      `"${d.sku}"`,
      `"${d.campo}"`,
      `"${d.valor}"`,
      `"${d.motivo.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `reporte-importacion-${fileName.replace(/\.[^/.]+$/, '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Reporte descargado con éxito', 'success');
  };

  return (
    <div className="flex flex-col space-y-2 max-w-7xl mx-auto w-full pb-16">
      {/* 4-Area Navigation Tabs */}
      <VentasNavTabs currentTab="gestion" />

      {/* Main Full-Screen ERP Import Container */}
      <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[620px]">
        {/* Compact Header */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          {/* Left: Volver + Title */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => router.push('/ventas/gestion')}
              className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors shadow-sm"
              title="Volver a Gestión Comercial"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a Gestión</span>
            </button>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <h1 className="text-sm md:text-base font-black tracking-tight text-slate-900 dark:text-slate-100">
                Importación Masiva de Productos
              </h1>
              {fileName && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  {fileName}
                </span>
              )}
            </div>
          </div>

          {/* Right: Step Indicator */}
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 overflow-x-auto">
            <span className={step === 'archivo' ? 'text-primary font-black' : ''}>1. Archivo</span>
            <span>→</span>
            <span className={step === 'mapeo' ? 'text-primary font-black' : ''}>2. Mapeo</span>
            <span>→</span>
            <span className={step === 'validacion' ? 'text-primary font-black' : ''}>3. Validación</span>
            <span>→</span>
            <span className={step === 'previsualizacion' ? 'text-primary font-black' : ''}>4. Revisión</span>
            <span>→</span>
            <span className={step === 'resultado' ? 'text-emerald-600 dark:text-emerald-400 font-black' : ''}>5. Resultado</span>
          </div>
        </div>

        {/* STEP 1: ARCHIVO */}
        {step === 'archivo' && (
          <div className="flex-1 p-6 md:p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-2 shadow-inner">
              <Upload className="w-8 h-8" />
            </div>

            <div className="max-w-md space-y-1">
              <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-slate-100">
                Seleccionar planilla de productos Excel
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Formatos soportados: <strong>.xlsx</strong> o <strong>.xls</strong>. El sistema analizará la estructura y cantidad de filas sin realizar modificaciones inmediatas.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileSelected}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 h-10 px-6 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/25 hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Examinar archivo en el equipo</span>
            </button>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 text-left max-w-lg w-full text-xs text-slate-500 space-y-1.5">
              <div className="font-bold text-slate-700 dark:text-slate-300">Columnas esperadas en el archivo:</div>
              <p className="text-[11px] leading-relaxed font-mono bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                Nombre | Categoría | Marca | Familia | Sub-Familia | SKU | Código de barras | Precio de venta | Costo | Stock | Unidad
              </p>
              <p className="text-[11px] text-slate-400">
                * Las listas de precio no son campos de producto y se aplican dinámicamente en ventas. Proveedor y SKU proveedor quedarán vacíos.
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: MAPEO DE COLUMNAS */}
        {step === 'mapeo' && (
          <div className="flex-1 p-4 md:p-6 space-y-4 flex flex-col">
            {/* Header info */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0" />
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">{fileName}</div>
                  <div className="text-[11px] text-slate-500">
                    <strong>{totalRowsDetected.toLocaleString('es-AR')}</strong> filas detectadas • <strong>{fileColumns.length}</strong> columnas
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('archivo');
                    setRawRows([]);
                    setFileName('');
                  }}
                  className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cambiar archivo
                </button>
              </div>
            </div>

            {/* Notice banner on unmapped supplier */}
            <div className="p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-blue-500" />
              <span>
                <strong>Regla de Proveedor:</strong> El archivo Excel no incluye proveedor. Los campos <em>Proveedor Ventas</em> y <em>SKU Proveedor</em> quedarán vacíos y no se inferirán de la Marca.
              </span>
            </div>

            {/* Mapping Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* SKU Interno */}
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  SKU Interno <span className="text-rose-500">*</span>
                </label>
                <select
                  value={mapping.sku}
                  onChange={(e) => setMapping({ ...mapping, sku: e.target.value })}
                  className="w-full h-8 px-2 rounded border border-slate-300 dark:border-slate-600 bg-background text-xs font-mono font-semibold"
                >
                  <option value="">-- Seleccionar columna --</option>
                  {fileColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">Identificador único del producto.</p>
              </div>

              {/* Nombre / Descripción */}
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Nombre / Descripción <span className="text-rose-500">*</span>
                </label>
                <select
                  value={mapping.nombre}
                  onChange={(e) => setMapping({ ...mapping, nombre: e.target.value })}
                  className="w-full h-8 px-2 rounded border border-slate-300 dark:border-slate-600 bg-background text-xs font-semibold"
                >
                  <option value="">-- Seleccionar columna --</option>
                  {fileColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">Descripción comercial del artículo.</p>
              </div>

              {/* Código de Barras */}
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Código de Barras
                </label>
                <select
                  value={mapping.codigoBarras}
                  onChange={(e) => setMapping({ ...mapping, codigoBarras: e.target.value })}
                  className="w-full h-8 px-2 rounded border border-slate-300 dark:border-slate-600 bg-background text-xs font-mono"
                >
                  <option value="">-- Sin columna / Omitir --</option>
                  {fileColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">Para lector láser o pistola de escaneo.</p>
              </div>

              {/* Categoría */}
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Categoría
                </label>
                <select
                  value={mapping.categoria}
                  onChange={(e) => setMapping({ ...mapping, categoria: e.target.value })}
                  className="w-full h-8 px-2 rounded border border-slate-300 dark:border-slate-600 bg-background text-xs font-semibold"
                >
                  <option value="">-- Sin columna / Omitir --</option>
                  {fileColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">Independiente de Familia y Sub-Familia.</p>
              </div>

              {/* Marca */}
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Marca
                </label>
                <select
                  value={mapping.marca}
                  onChange={(e) => setMapping({ ...mapping, marca: e.target.value })}
                  className="w-full h-8 px-2 rounded border border-slate-300 dark:border-slate-600 bg-background text-xs font-semibold"
                >
                  <option value="">-- Sin columna / Omitir --</option>
                  {fileColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">Maestro de marcas comerciales.</p>
              </div>

              {/* Familia */}
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Familia
                </label>
                <select
                  value={mapping.familia}
                  onChange={(e) => setMapping({ ...mapping, familia: e.target.value })}
                  className="w-full h-8 px-2 rounded border border-slate-300 dark:border-slate-600 bg-background text-xs font-semibold"
                >
                  <option value="">-- Sin columna / Omitir --</option>
                  {fileColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">Agrupación técnica principal.</p>
              </div>

              {/* Sub-Familia */}
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Sub-Familia
                </label>
                <select
                  value={mapping.subFamilia}
                  onChange={(e) => setMapping({ ...mapping, subFamilia: e.target.value })}
                  className="w-full h-8 px-2 rounded border border-slate-300 dark:border-slate-600 bg-background text-xs font-semibold"
                >
                  <option value="">-- Sin columna / Omitir --</option>
                  {fileColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">Jerárquica respecto a la Familia.</p>
              </div>

              {/* Unidad */}
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Unidad de Medida
                </label>
                <select
                  value={mapping.unidad}
                  onChange={(e) => setMapping({ ...mapping, unidad: e.target.value })}
                  className="w-full h-8 px-2 rounded border border-slate-300 dark:border-slate-600 bg-background text-xs font-semibold"
                >
                  <option value="">-- Sin columna / Omitir --</option>
                  {fileColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">Ej: UN, M, KG, ROLLO, CAJA.</p>
              </div>

              {/* Precio Base de Venta (Corresponde a Precio de venta) */}
              <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/10 space-y-1">
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
                  Precio Base de Venta <span className="text-rose-500">*</span>
                </label>
                <select
                  value={mapping.precioBase}
                  onChange={(e) => setMapping({ ...mapping, precioBase: e.target.value })}
                  className="w-full h-8 px-2 rounded border border-primary/40 bg-background text-xs font-mono font-bold"
                >
                  <option value="">-- Seleccionar columna --</option>
                  {fileColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Columna "Precio de venta". Es el precio base comercial, NO una lista de precios.
                </p>
              </div>

              {/* Costo */}
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Costo de Adquisición
                </label>
                <select
                  value={mapping.costo}
                  onChange={(e) => setMapping({ ...mapping, costo: e.target.value })}
                  className="w-full h-8 px-2 rounded border border-slate-300 dark:border-slate-600 bg-background text-xs font-mono"
                >
                  <option value="">-- Sin columna / Omitir --</option>
                  {fileColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">Costo neto de adquisición del producto.</p>
              </div>

              {/* Stock Inicial */}
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Stock Inicial (Apertura)
                </label>
                <select
                  value={mapping.stock}
                  onChange={(e) => setMapping({ ...mapping, stock: e.target.value })}
                  className="w-full h-8 px-2 rounded border border-slate-300 dark:border-slate-600 bg-background text-xs font-mono"
                >
                  <option value="">-- Sin columna / Omitir --</option>
                  {fileColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">Se registrará como movimiento inicial de almacén.</p>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-auto">
              <button
                type="button"
                onClick={() => setStep('archivo')}
                className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              >
                Volver a Archivo
              </button>

              <button
                type="button"
                disabled={isValidating}
                onClick={handleRunValidation}
                className="flex items-center gap-1.5 h-8 px-5 rounded-lg bg-primary text-white text-xs font-bold shadow-sm shadow-primary/25 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Validando registros...</span>
                  </>
                ) : (
                  <>
                    <span>Validar Archivo y Datos</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: VALIDACIÓN Y RESOLUCIÓN DE MAESTROS */}
        {step === 'validacion' && (
          <div className="flex-1 p-4 md:p-6 space-y-4 flex flex-col">
            {/* Status Summary Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total de Filas</div>
                <div className="text-xl font-black text-slate-900 dark:text-slate-100">{resumenValidacion.totalFilas.toLocaleString('es-AR')}</div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
                <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Correctas
                </div>
                <div className="text-xl font-black text-emerald-700 dark:text-emerald-300">{resumenValidacion.correctas.toLocaleString('es-AR')}</div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Advertencias
                </div>
                <div className="text-xl font-black text-amber-700 dark:text-amber-300">{resumenValidacion.advertencias.toLocaleString('es-AR')}</div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40">
                <div className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  Errores
                </div>
                <div className="text-xl font-black text-rose-700 dark:text-rose-300">{resumenValidacion.errores.toLocaleString('es-AR')}</div>
              </div>
            </div>

            {/* Duplicates Strategy */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-background flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Estrategia para SKUs ya existentes en el sistema</div>
                <div className="text-[11px] text-slate-500">
                  Por seguridad, la opción predeterminada protege los productos ya creados evitando sobreescrituras destructivas.
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={omitirExistentes}
                  onChange={(e) => setOmitirExistentes(e.target.checked)}
                  className="rounded border-slate-300 text-primary h-4 w-4"
                />
                <span className="text-slate-700 dark:text-slate-300">Omitir productos existentes</span>
              </label>
            </div>

            {/* UNKNOWN MASTERS RESOLUTION PANEL (STRICT RULE: NO SILENT AUTO-CREATION) */}
            {(maestrosFaltantes.marcas.length > 0 ||
              maestrosFaltantes.categorias.length > 0 ||
              maestrosFaltantes.familias.length > 0 ||
              maestrosFaltantes.subfamilias.length > 0 ||
              maestrosFaltantes.unidades.length > 0) && (
              <div className="p-3.5 rounded-xl bg-amber-50/40 dark:bg-amber-950/15 border border-amber-200 dark:border-amber-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                      Maestros no encontrados en el sistema (Requiere acción del usuario)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">No se realizan correcciones silenciosas</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                  {/* Marcas faltantes */}
                  {maestrosFaltantes.marcas.map((m) => {
                    const isSelected = maestrosACrear.marcas.has(m);
                    return (
                      <div key={m} className="p-2 rounded-lg bg-background border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400">Marca: </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">"{m}"</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleCrearMaestro('marcas', m)}
                          className={`h-6 px-2 rounded text-[10px] font-bold transition-colors ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50'
                          }`}
                        >
                          {isSelected ? '✓ Se creará' : '+ Crear Marca'}
                        </button>
                      </div>
                    );
                  })}

                  {/* Categorías faltantes */}
                  {maestrosFaltantes.categorias.map((c) => {
                    const isSelected = maestrosACrear.categorias.has(c);
                    return (
                      <div key={c} className="p-2 rounded-lg bg-background border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400">Categoría: </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">"{c}"</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleCrearMaestro('categorias', c)}
                          className={`h-6 px-2 rounded text-[10px] font-bold transition-colors ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50'
                          }`}
                        >
                          {isSelected ? '✓ Se creará' : '+ Crear Categoría'}
                        </button>
                      </div>
                    );
                  })}

                  {/* Familias faltantes */}
                  {maestrosFaltantes.familias.map((f) => {
                    const isSelected = maestrosACrear.familias.has(f);
                    return (
                      <div key={f} className="p-2 rounded-lg bg-background border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400">Familia: </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">"{f}"</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleCrearMaestro('familias', f)}
                          className={`h-6 px-2 rounded text-[10px] font-bold transition-colors ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50'
                          }`}
                        >
                          {isSelected ? '✓ Se creará' : '+ Crear Familia'}
                        </button>
                      </div>
                    );
                  })}

                  {/* Subfamilias faltantes */}
                  {maestrosFaltantes.subfamilias.map((sf) => {
                    const key = `${sf.familia}:::${sf.subfamilia}`;
                    const isSelected = maestrosACrear.subfamilias.has(key);
                    return (
                      <div key={key} className="p-2 rounded-lg bg-background border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div className="truncate max-w-[140px]" title={`${sf.familia} > ${sf.subfamilia}`}>
                          <span className="text-[10px] font-bold uppercase text-slate-400">Sub-Fam: </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">"{sf.subfamilia}"</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleCrearSubfamilia(sf.familia, sf.subfamilia)}
                          className={`h-6 px-2 rounded text-[10px] font-bold transition-colors ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50'
                          }`}
                        >
                          {isSelected ? '✓ Se creará' : '+ Crear SubFam'}
                        </button>
                      </div>
                    );
                  })}

                  {/* Unidades faltantes */}
                  {maestrosFaltantes.unidades.map((u) => {
                    const isSelected = maestrosACrear.unidades.has(u);
                    return (
                      <div key={u} className="p-2 rounded-lg bg-background border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400">Unidad: </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">"{u}"</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleCrearMaestro('unidades', u)}
                          className={`h-6 px-2 rounded text-[10px] font-bold transition-colors ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50'
                          }`}
                        >
                          {isSelected ? '✓ Se creará' : '+ Crear Unidad'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-auto">
              <button
                type="button"
                onClick={() => setStep('mapeo')}
                className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              >
                Volver a Mapeo
              </button>

              <button
                type="button"
                onClick={() => setStep('previsualizacion')}
                className="flex items-center gap-1.5 h-8 px-5 rounded-lg bg-primary text-white text-xs font-bold shadow-sm shadow-primary/25 hover:opacity-90 transition-opacity"
              >
                <span>Revisar Tabla de Previsualización</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: PREVISUALIZACIÓN Y REVISIÓN */}
        {step === 'previsualizacion' && (
          <div className="flex-1 p-4 flex flex-col space-y-3">
            {/* Toolbar: Filter Tabs + Search + Count */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPreviewFilter('todas')}
                  className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-colors ${
                    previewFilter === 'todas'
                      ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                      : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Todas ({diagnosticoFilas.length})
                </button>
                <button
                  onClick={() => setPreviewFilter('correcta')}
                  className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-colors ${
                    previewFilter === 'correcta'
                      ? 'bg-emerald-600 text-white'
                      : 'border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 text-emerald-600'
                  }`}
                >
                  ✓ Correctas ({resumenValidacion.correctas})
                </button>
                <button
                  onClick={() => setPreviewFilter('advertencia')}
                  className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-colors ${
                    previewFilter === 'advertencia'
                      ? 'bg-amber-600 text-white'
                      : 'border border-slate-200 dark:border-slate-700 hover:bg-amber-50 text-amber-600'
                  }`}
                >
                  ⚠ Advertencias ({resumenValidacion.advertencias})
                </button>
                <button
                  onClick={() => setPreviewFilter('error')}
                  className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-colors ${
                    previewFilter === 'error'
                      ? 'bg-rose-600 text-white'
                      : 'border border-slate-200 dark:border-slate-700 hover:bg-rose-50 text-rose-600'
                  }`}
                >
                  ✕ Errores ({resumenValidacion.errores})
                </button>
              </div>

              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={previewSearch}
                  onChange={(e) => setPreviewSearch(e.target.value)}
                  placeholder="Buscar en la previsualización..."
                  className="w-full h-7 pl-8 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs"
                />
              </div>
            </div>

            {/* Dense Data Table */}
            <div className="flex-1 overflow-x-auto overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg max-h-[480px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 dark:bg-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 sticky top-0 z-10">
                  <tr>
                    <th className="py-2 px-2 text-center w-8">Est.</th>
                    <th className="py-2 px-2 w-10">Fila</th>
                    <th className="py-2 px-2">SKU</th>
                    <th className="py-2 px-2">Descripción</th>
                    <th className="py-2 px-2">Categoría</th>
                    <th className="py-2 px-2">Marca</th>
                    <th className="py-2 px-2">Familia / SubFam</th>
                    <th className="py-2 px-2 text-right">Precio Base</th>
                    <th className="py-2 px-2 text-right">Costo</th>
                    <th className="py-2 px-2 text-center">Stock Inic.</th>
                    <th className="py-2 px-2">Unidad</th>
                    <th className="py-2 px-2">Detalles / Advertencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-400 text-xs">
                        No hay filas para mostrar con el filtro seleccionado.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.slice(0, 200).map((r) => {
                      const isCorrecta = r.estado === 'correcta';
                      const isWarn = r.estado === 'advertencia';
                      const isErr = r.estado === 'error';

                      return (
                        <tr
                          key={r.filaNumero}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                            isErr
                              ? 'bg-rose-50/20 dark:bg-rose-950/10'
                              : isWarn
                              ? 'bg-amber-50/20 dark:bg-amber-950/10'
                              : ''
                          }`}
                        >
                          <td className="py-1.5 px-2 text-center">
                            {isCorrecta && <span className="text-emerald-500 font-bold" title="Correcta">✓</span>}
                            {isWarn && <span className="text-amber-500 font-bold" title="Advertencia">⚠</span>}
                            {isErr && <span className="text-rose-500 font-bold" title="Error">✕</span>}
                          </td>
                          <td className="py-1.5 px-2 font-mono text-[10px] text-slate-400">{r.filaNumero}</td>
                          <td className="py-1.5 px-2 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {r.sku || '-'}
                          </td>
                          <td className="py-1.5 px-2 max-w-[200px] truncate text-slate-800 dark:text-slate-200" title={r.nombre}>
                            {r.nombre || '-'}
                          </td>
                          <td className="py-1.5 px-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {r.categoria || '-'}
                          </td>
                          <td className="py-1.5 px-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {r.marca || '-'}
                          </td>
                          <td className="py-1.5 px-2 text-slate-500 whitespace-nowrap text-[11px]">
                            {r.familia ? `${r.familia}${r.subFamilia ? ` > ${r.subFamilia}` : ''}` : '-'}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {formatARS(r.precioBase)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-500 whitespace-nowrap">
                            {formatARS(r.costo)}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono font-bold whitespace-nowrap">
                            {r.stock} u.
                          </td>
                          <td className="py-1.5 px-2 text-slate-500 whitespace-nowrap font-mono text-[10px]">
                            {r.unidad || '-'}
                          </td>
                          <td className="py-1.5 px-2 text-[10px] max-w-[240px] truncate">
                            {r.errores?.length > 0 ? (
                              <span className="text-rose-600 dark:text-rose-400 font-semibold">{r.errores.join(' • ')}</span>
                            ) : r.advertencias?.length > 0 ? (
                              <span className="text-amber-600 dark:text-amber-400">{r.advertencias.join(' • ')}</span>
                            ) : (
                              <span className="text-emerald-600">Listo para importar</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredRows.length > 200 && (
              <p className="text-[10px] text-slate-400 text-center">
                Mostrando las primeras 200 filas de {filteredRows.length}.
              </p>
            )}

            {/* Execution Progress Bar */}
            {isExecuting && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    {executionStatusText || 'Importando productos...'}
                  </span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{executionProgress}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-2 transition-all duration-300 rounded-full"
                    style={{ width: `${executionProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('validacion')}
                className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              >
                Volver a Diagnóstico
              </button>

              <button
                type="button"
                disabled={isExecuting}
                onClick={handleExecuteImport}
                className="flex items-center gap-1.5 h-8 px-6 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-sm shadow-emerald-600/25 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Procesando por lotes ({executionProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <span>Confirmar e Importar {resumenValidacion.correctas + resumenValidacion.advertencias} Productos</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: RESULTADO FINAL */}
        {step === 'resultado' && resultadoFinal && (
          <div className="flex-1 p-6 md:p-12 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="max-w-md space-y-1">
              <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-slate-100">
                Importación completada con éxito
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Los productos han sido incorporados al maestro comercial con su respectivo stock inicial y trazabilidad de movimientos.
              </p>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-3 gap-4 max-w-lg w-full text-center">
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Creados</div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                  {resultadoFinal.creados.toLocaleString('es-AR')}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Omitidos</div>
                <div className="text-2xl font-black text-slate-700 dark:text-slate-300">
                  {resultadoFinal.omitidos.toLocaleString('es-AR')}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40">
                <div className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Errores</div>
                <div className="text-2xl font-black text-rose-700 dark:text-rose-300">
                  {resultadoFinal.errores.toLocaleString('es-AR')}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 flex-wrap">
              {resultadoFinal.reporteDetalles.length > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadReport}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-primary" />
                  <span>Descargar Reporte de Incidencias (.CSV)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => router.push('/ventas/gestion')}
                className="flex items-center gap-1.5 h-9 px-6 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/25 hover:opacity-90 transition-opacity"
              >
                <span>Volver a Gestión Comercial</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
