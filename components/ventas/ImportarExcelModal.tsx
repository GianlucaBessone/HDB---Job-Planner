'use client';

import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Loader2, Download, ArrowLeft, Info } from 'lucide-react';
import * as XLSX from 'xlsx';
import { showToast } from '@/components/Toast';
import { formatARS } from '@/lib/formatCurrency';

interface MetaData {
  listasPrecios: Array<{ id: string; codigo: string; nombre: string }>;
}

interface ImportarExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  meta: MetaData;
}

// Expected template columns (fixed order)
const TEMPLATE_COLUMNS = [
  'SKU',
  'SKU Proveedor',
  'Costo',
  'Precio Venta',
  '% Ajuste sobre costo',
  '% Ajuste sobre venta',
];

// Types for validation
interface FilaParseada {
  filaNumero: number;
  sku: string;
  skuProveedor: string;
  costo: number | null;
  precioVenta: number | null;
  pctAjusteCosto: number | null;
  pctAjusteVenta: number | null;
}

interface CambioPreview {
  filaNumero: number;
  sku: string;
  skuProveedor: string;
  descripcion: string;
  cambios: Array<{
    campo: string;
    valorActual: string;
    valorNuevo: string;
  }>;
}

interface ValidationReport {
  resumen: {
    totalFilas: number;
    productosEncontrados: number;
    productosNoEncontrados: number;
    filasConError: number;
    cambiosPendientes: number;
  };
  errores: Array<{ filaNumero: number; sku: string; skuProveedor: string; motivo: string }>;
  previsualizacion: CambioPreview[];
}

interface ImportResult {
  success: boolean;
  mensaje: string;
  resumen: {
    filasProcesadas?: number;
    filasProcessadas?: number;
    productosActualizados: number;
    filasOmitidas: number;
    errores: number;
  };
  errores: Array<{ filaNumero: number; sku: string; skuProveedor: string; motivo: string }>;
}

export default function ImportarExcelModal({
  isOpen,
  onClose,
  onSuccess,
  meta,
}: ImportarExcelModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [parsedFilas, setParsedFilas] = useState<FilaParseada[]>([]);

  // Validation results
  const [isValidating, setIsValidating] = useState(false);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);

  // Apply
  const [isApplying, setIsApplying] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Reset state when closing
  const handleClose = () => {
    setStep('upload');
    setFileName('');
    setRawRows([]);
    setParsedFilas([]);
    setValidationReport(null);
    setImportResult(null);
    setIsValidating(false);
    setIsApplying(false);
    onClose();
  };

  // ── Download template ────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS]);

    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // SKU
      { wch: 18 }, // SKU Proveedor
      { wch: 14 }, // Costo
      { wch: 14 }, // Precio Venta
      { wch: 22 }, // % Ajuste sobre costo
      { wch: 22 }, // % Ajuste sobre venta
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'Plantilla_Importacion_Productos.xlsx');
  };

  // ── Parse numeric value (returns null if empty/invalid) ──────────
  const parseNumericValue = (val: any): number | null => {
    if (val === null || val === undefined || val === '') return null;
    const str = String(val).replace('%', '').replace(',', '.').trim();
    if (str === '') return null;
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  };

  // ── File change handler ──────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (data.length === 0) {
          showToast('El archivo no contiene registros en la primera hoja', 'error');
          return;
        }

        setRawRows(data);

        // Parse rows using the fixed column names
        const detectedCols = Object.keys(data[0] || {});

        // Auto-detect columns by matching template headers (flexible)
        const findCol = (patterns: RegExp[]) =>
          detectedCols.find(c => patterns.some(p => p.test(c))) || '';

        const skuCol = findCol([/^sku$/i, /^codigo$/i, /^art[ií]culo$/i]);
        const skuProvCol = findCol([/sku.?prov/i, /c[oó]d.?prov/i, /proveedor/i]);
        const costoCol = findCol([/^costo$/i, /^cost$/i]);
        const precioCol = findCol([/precio.?venta/i, /^precio$/i, /^pv$/i, /^pvta$/i]);
        const pctCostoCol = findCol([/%.*ajuste.*costo/i, /ajuste.*costo/i, /^%\s*costo$/i]);
        const pctVentaCol = findCol([/%.*ajuste.*venta/i, /ajuste.*venta/i, /^%\s*venta$/i]);

        const filas: FilaParseada[] = data.map((r, i) => ({
          filaNumero: i + 2, // Excel 1-based with header
          sku: String(r[skuCol] || '').trim(),
          skuProveedor: String(r[skuProvCol] || '').trim(),
          costo: parseNumericValue(r[costoCol]),
          precioVenta: parseNumericValue(r[precioCol]),
          pctAjusteCosto: parseNumericValue(r[pctCostoCol]),
          pctAjusteVenta: parseNumericValue(r[pctVentaCol]),
        }));

        setParsedFilas(filas);

        // Auto-validate immediately
        await validateFilas(filas, file.name);
      } catch (err: any) {
        showToast('Error al leer el archivo Excel: ' + err.message, 'error');
      }
    };

    reader.readAsBinaryString(file);
  };

  // ── Validate rows via API ────────────────────────────────────────
  const validateFilas = async (filas: FilaParseada[], nombre: string) => {
    setIsValidating(true);
    try {
      const res = await fetch('/api/ventas/precios/importar-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filas,
          confirmar: false,
          nombreArchivo: nombre,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al validar importación');

      setValidationReport(data);
      setStep('preview');
    } catch (err: any) {
      showToast(err.message || 'Error en validación', 'error');
    } finally {
      setIsValidating(false);
    }
  };

  // ── Confirm and Apply ────────────────────────────────────────────
  const handleConfirmImport = async () => {
    if (!validationReport || validationReport.resumen.cambiosPendientes === 0) {
      showToast('No hay cambios válidos para aplicar', 'error');
      return;
    }

    setIsApplying(true);
    try {
      const res = await fetch('/api/ventas/precios/importar-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filas: parsedFilas,
          confirmar: true,
          nombreArchivo: fileName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al aplicar cambios');

      setImportResult(data);
      setStep('result');
      onSuccess();
    } catch (err: any) {
      showToast(err.message || 'Error al procesar archivo', 'error');
    } finally {
      setIsApplying(false);
    }
  };

  // ── Download error report ────────────────────────────────────────
  const handleDownloadErrors = (errores: Array<{ filaNumero: number; sku: string; skuProveedor: string; motivo: string }>) => {
    const rows = errores.map(e => ({
      'Fila': e.filaNumero,
      'SKU': e.sku,
      'SKU Proveedor': e.skuProveedor,
      'Motivo': e.motivo,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 8 }, { wch: 15 }, { wch: 20 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Errores');
    XLSX.writeFile(wb, 'Reporte_Errores_Importacion.xlsx');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-slate-200 dark:border-slate-800 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Importar Ajustes de Productos desde Excel
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {step === 'upload' && 'Paso 1: Subir planilla de cálculo (.xlsx, .xls, .csv)'}
                {step === 'preview' && 'Paso 2: Validar y previsualizar cambios'}
                {step === 'result' && 'Resultado de importación'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ── STEP 1: UPLOAD ── */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Download template link */}
              <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Use la plantilla oficial para asegurar compatibilidad
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Columnas: SKU, SKU Proveedor, Costo, Precio Venta, % Ajuste sobre costo, % Ajuste sobre venta
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar Plantilla
                </button>
              </div>

              {/* File upload area */}
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-12 text-center bg-slate-50/50 dark:bg-slate-900/30">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {isValidating ? (
                  <>
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-1">
                      Validando archivo...
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Verificando productos en base de datos y calculando cambios
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                      <Upload className="w-8 h-8" />
                    </div>

                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-1">
                      Arrastre o seleccione su archivo Excel
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
                      Puede actualizar <strong>Costo</strong>, <strong>Precio Venta</strong>, <strong>SKU Proveedor</strong> y aplicar <strong>ajustes porcentuales</strong>. Los campos vacíos no modifican datos existentes.
                    </p>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/25 hover:opacity-90 transition-opacity"
                    >
                      Elegir Archivo Excel
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 2: PREVIEW & VALIDATION SUMMARY ── */}
          {step === 'preview' && validationReport && (
            <div className="space-y-5">
              {/* File info */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{fileName}</span>
                  <span className="text-[10px] text-slate-400">
                    ({validationReport.resumen.totalFilas} filas)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('upload');
                    setValidationReport(null);
                  }}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Cambiar archivo
                </button>
              </div>

              {/* Metric summary boxes */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-slate-600 text-white shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-lg font-black text-slate-700 dark:text-slate-200">
                      {validationReport.resumen.totalFilas}
                    </span>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Filas
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-600 text-white shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                      {validationReport.resumen.productosEncontrados}
                    </span>
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                      Encontrados
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-600 text-white shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-lg font-black text-amber-700 dark:text-amber-300">
                      {validationReport.resumen.productosNoEncontrados}
                    </span>
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                      No Encontrados
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-rose-600 text-white shrink-0">
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-lg font-black text-rose-700 dark:text-rose-300">
                      {validationReport.resumen.filasConError}
                    </span>
                    <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                      Errores
                    </p>
                  </div>
                </div>
              </div>

              {/* Error details */}
              {validationReport.errores.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200">
                      Detalle de Errores ({validationReport.errores.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleDownloadErrors(validationReport.errores)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Download className="w-3 h-3" />
                      Descargar Errores
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    {validationReport.errores.map((err, i) => (
                      <div key={`err-${i}`} className="flex items-start gap-2">
                        <span className="text-rose-600 font-bold shrink-0">Fila {err.filaNumero}:</span>
                        <span className="text-slate-500">
                          {err.sku && `SKU "${err.sku}"`}
                          {err.sku && err.skuProveedor && ' / '}
                          {err.skuProveedor && `SKU Prov. "${err.skuProveedor}"`}
                        </span>
                        <span className="text-slate-400">— {err.motivo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Table: shows actual field-level changes */}
              {validationReport.previsualizacion.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    Vista Previa de Cambios ({validationReport.resumen.cambiosPendientes} modificaciones)
                  </h4>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Fila</th>
                          <th className="py-2.5 px-3">Producto (SKU)</th>
                          <th className="py-2.5 px-3">Campo</th>
                          <th className="py-2.5 px-3 text-right">Valor Actual</th>
                          <th className="py-2.5 px-3 text-right">Nuevo Valor</th>
                          <th className="py-2.5 px-3 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {validationReport.previsualizacion.map((item, idx) =>
                          item.cambios.map((cambio, cIdx) => (
                            <tr key={`${idx}-${cIdx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                              {cIdx === 0 ? (
                                <>
                                  <td className="py-2 px-3 text-slate-400 font-mono text-[10px]" rowSpan={item.cambios.length}>
                                    {item.filaNumero}
                                  </td>
                                  <td className="py-2 px-3" rowSpan={item.cambios.length}>
                                    <div>
                                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{item.sku}</span>
                                      <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{item.descripcion}</p>
                                    </div>
                                  </td>
                                </>
                              ) : null}
                              <td className="py-2 px-3 text-slate-700 dark:text-slate-300 font-semibold">{cambio.campo}</td>
                              <td className="py-2 px-3 text-right font-mono text-slate-500">{cambio.valorActual}</td>
                              <td className="py-2 px-3 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">{cambio.valorNuevo}</td>
                              <td className="py-2 px-3 text-center">
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
                                  Modificar
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {validationReport.previsualizacion.length === 0 && validationReport.errores.length > 0 && (
                <div className="p-8 text-center text-slate-400">
                  <XCircle className="w-8 h-8 mx-auto mb-2 text-rose-300 dark:text-rose-600" />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    No hay cambios válidos para aplicar
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Todas las filas contienen errores. Revise el detalle de errores arriba.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: RESULT ── */}
          {step === 'result' && importResult && (
            <div className="space-y-5">
              {/* Success banner */}
              <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" />
                <h4 className="text-base font-black text-emerald-800 dark:text-emerald-200 mb-1">
                  Importación Completada
                </h4>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {importResult.mensaje}
                </p>
              </div>

              {/* Result metrics */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-xl font-black text-slate-700 dark:text-slate-200">
                    {importResult.resumen.filasProcesadas ?? importResult.resumen.filasProcessadas ?? 0}
                  </span>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Filas Procesadas
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-center">
                  <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                    {importResult.resumen.productosActualizados}
                  </span>
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                    Actualizados
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-center">
                  <span className="text-xl font-black text-amber-700 dark:text-amber-300">
                    {importResult.resumen.filasOmitidas}
                  </span>
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                    Omitidas
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-center">
                  <span className="text-xl font-black text-rose-700 dark:text-rose-300">
                    {importResult.resumen.errores}
                  </span>
                  <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                    Errores
                  </p>
                </div>
              </div>

              {/* Error download if any */}
              {importResult.errores && importResult.errores.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {importResult.errores.length} filas con errores fueron omitidas
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDownloadErrors(importResult.errores)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar Reporte de Errores
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
          >
            {step === 'result' ? 'Cerrar' : 'Cancelar'}
          </button>

          {step === 'preview' && validationReport && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep('upload');
                  setValidationReport(null);
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver
              </button>
              <button
                type="button"
                disabled={isApplying || validationReport.resumen.cambiosPendientes === 0}
                onClick={handleConfirmImport}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-600/25 hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Aplicando Cambios...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar y Aplicar ({validationReport.resumen.cambiosPendientes} cambios)
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
