'use client';

import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Loader2 } from 'lucide-react';
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

export default function ImportarExcelModal({
  isOpen,
  onClose,
  onSuccess,
  meta,
}: ImportarExcelModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [columns, setColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);

  // Mapping state
  const [skuColumn, setSkuColumn] = useState<string>('');
  const [porcentajeColumn, setPorcentajeColumn] = useState<string>('');
  const [selectedListas, setSelectedListas] = useState<string[]>(['LISTA_1']);

  // Validation results
  const [isValidating, setIsValidating] = useState(false);
  const [validationReport, setValidationReport] = useState<{
    resumen: { totalFilas: number; correctos: number; noEncontrados: number; errores: number };
    errores: Array<{ filaNumero: number; sku: string; motivo: string }>;
    noEncontrados: Array<{ filaNumero: number; sku: string; motivo: string }>;
    previsualizacion: Array<{
      filaNumero: number;
      sku: string;
      descripcion: string;
      porcentaje: number;
      precios: Array<{ listaCodigo: string; listaNombre: string; precioActual: number; nuevoPrecio: number }>;
    }>;
  } | null>(null);

  const [isApplying, setIsApplying] = useState(false);

  // File change handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
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

        const detectedCols = Object.keys(data[0] || {});
        setColumns(detectedCols);
        setRawRows(data);

        // Auto-detect matching column names
        const autoSku = detectedCols.find((c) => /sku|codigo|art|item/i.test(c)) || detectedCols[0] || '';
        const autoPorc = detectedCols.find((c) => /porc|%|ajuste|aumento|descuento|margen/i.test(c)) || detectedCols[1] || '';

        setSkuColumn(autoSku);
        setPorcentajeColumn(autoPorc);

        setStep('mapping');
      } catch (err: any) {
        showToast('Error al leer el archivo Excel: ' + err.message, 'error');
      }
    };

    reader.readAsBinaryString(file);
  };

  // Run validation
  const handleValidateMapping = async () => {
    if (!skuColumn) {
      showToast('Seleccione la columna que contiene el SKU', 'info');
      return;
    }
    if (!porcentajeColumn) {
      showToast('Seleccione la columna que contiene el Porcentaje de Ajuste', 'info');
      return;
    }

    setIsValidating(true);
    try {
      // Transform raw rows into parsed objects
      const parsedFilas = rawRows.map((r, i) => {
        let rawPorc = String(r[porcentajeColumn] || '').replace('%', '').trim();
        // Handle comma decimal separator: "10,5" -> 10.5
        rawPorc = rawPorc.replace(',', '.');
        const numPorc = parseFloat(rawPorc);

        return {
          filaNumero: i + 2, // Excel 1-based index with header
          sku: String(r[skuColumn] || '').trim(),
          porcentaje: isNaN(numPorc) ? 0 : numPorc,
        };
      });

      const res = await fetch('/api/ventas/precios/importar-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filas: parsedFilas,
          listas: selectedListas,
          confirmar: false,
          nombreArchivo: fileName,
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

  // Confirm and Apply
  const handleConfirmImport = async () => {
    if (!validationReport || validationReport.resumen.correctos === 0) {
      showToast('No hay registros correctos para aplicar', 'error');
      return;
    }

    setIsApplying(true);
    try {
      const parsedFilas = rawRows.map((r, i) => {
        let rawPorc = String(r[porcentajeColumn] || '').replace('%', '').trim();
        rawPorc = rawPorc.replace(',', '.');
        const numPorc = parseFloat(rawPorc);

        return {
          filaNumero: i + 2,
          sku: String(r[skuColumn] || '').trim(),
          porcentaje: isNaN(numPorc) ? 0 : numPorc,
        };
      });

      const res = await fetch('/api/ventas/precios/importar-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filas: parsedFilas,
          listas: selectedListas,
          confirmar: true,
          nombreArchivo: fileName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al aplicar cambios');

      showToast(data.mensaje || 'Ajuste desde Excel aplicado correctamente', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Error al procesar archivo', 'error');
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Importar Ajustes de Precios desde Excel
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {step === 'upload' && 'Paso 1: Subir planilla de cálculo (.xlsx, .xls, .csv)'}
                {step === 'mapping' && 'Paso 2: Mapear columnas de SKU y porcentaje'}
                {step === 'preview' && 'Paso 3: Validar discrepancias, previsualizar y confirmar'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-12 text-center bg-slate-50/50 dark:bg-slate-900/30">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                <Upload className="w-8 h-8" />
              </div>

              <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-1">
                Arrastre o seleccione su archivo Excel
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
                El archivo debe incluir al menos una columna con el <strong>SKU</strong> de cada producto y otra con el <strong>% de ajuste</strong> (ej: 10, 15%, -5%).
              </p>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/25 hover:opacity-90 transition-opacity"
              >
                Elegir Archivo Excel
              </button>
            </div>
          )}

          {/* STEP 2: MAPPING */}
          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{fileName}</span>
                  <span className="text-[10px] text-slate-400">({rawRows.length} filas detectadas)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Cambiar archivo
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Columna con SKU del Producto <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={skuColumn}
                    onChange={(e) => setSkuColumn(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">-- Seleccionar Columna --</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Columna con % de Ajuste <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={porcentajeColumn}
                    onChange={(e) => setPorcentajeColumn(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">-- Seleccionar Columna --</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Precio Afectado: Precio Base de Venta
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    El porcentaje del archivo modificará el Precio Base del SKU indicado. Las listas comerciales se sincronizan de forma dinámica.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-primary text-white text-[10px] font-bold tracking-wider uppercase">
                  PRECIO BASE
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & VALIDATION SUMMARY */}
          {step === 'preview' && validationReport && (
            <div className="space-y-6">
              {/* Metric summary boxes */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                      {validationReport.resumen.correctos}
                    </span>
                    <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                      Correctos
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-600 text-white shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xl font-black text-amber-700 dark:text-amber-300">
                      {validationReport.resumen.noEncontrados}
                    </span>
                    <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                      No Encontrados
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-rose-600 text-white shrink-0">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xl font-black text-rose-700 dark:text-rose-300">
                      {validationReport.resumen.errores}
                    </span>
                    <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                      Con Errores
                    </p>
                  </div>
                </div>
              </div>

              {/* Discrepancies details if any */}
              {(validationReport.noEncontrados.length > 0 || validationReport.errores.length > 0) && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Detalle de Filas Ignoradas por Discrepancia:
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    {validationReport.noEncontrados.map((ne, i) => (
                      <div key={`ne-${i}`} className="flex items-center gap-2">
                        <span className="text-amber-600 font-bold">Fila {ne.filaNumero}:</span>
                        <span>SKU "{ne.sku}"</span>
                        <span className="text-slate-400">— {ne.motivo}</span>
                      </div>
                    ))}
                    {validationReport.errores.map((err, i) => (
                      <div key={`err-${i}`} className="flex items-center gap-2">
                        <span className="text-rose-600 font-bold">Fila {err.filaNumero}:</span>
                        <span>SKU "{err.sku}"</span>
                        <span className="text-slate-400">— {err.motivo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                  Previsualización de Nuevos Precios Calculados
                </h4>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Fila</th>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Descripción</th>
                        <th className="py-2.5 px-3 text-center">% Ajuste</th>
                        <th className="py-2.5 px-3 text-right">Precio Actual</th>
                        <th className="py-2.5 px-3 text-right">Nuevo Precio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {validationReport.previsualizacion.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">{item.filaNumero}</td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                            {item.sku}
                          </td>
                          <td className="py-2 px-3 truncate max-w-xs">{item.descripcion}</td>
                          <td className="py-2 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">
                            {item.porcentaje > 0 ? `+${item.porcentaje}%` : `${item.porcentaje}%`}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-500">
                            {formatARS(item.precios[0]?.precioActual)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                            {formatARS(item.precios[0]?.nuevoPrecio)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
          >
            Cancelar
          </button>

          {step === 'mapping' && (
            <button
              type="button"
              disabled={isValidating}
              onClick={handleValidateMapping}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/25 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Validando SKUs en Base de Datos...
                </>
              ) : (
                <>
                  Validar y Previsualizar
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}

          {step === 'preview' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep('mapping')}
                className="px-4 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Modificar Mapeo
              </button>
              <button
                type="button"
                disabled={isApplying || validationReport?.resumen.correctos === 0}
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
                    Confirmar y Aplicar Cambios
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
