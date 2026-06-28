'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Upload, Save, ArrowLeft, Trash2, FileSpreadsheet, Loader2 } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import * as XLSX from 'xlsx';

type GastoRow = {
  id: string; // internal id for React keys
  fechaEmision: string;
  proveedorCuit: string;
  proveedorRazonSocial: string;
  codigoGasto: string;
  tipoComprobante: string;
  puntoVenta: string;
  numeroComprobante: string;
  netoGeneral: number;
  neto21: number;
  neto10_5: number;
  neto27: number;
  iva21: number;
  iva10_5: number;
  iva27: number;
  noGravados: number;
  percepcionesIva: number;
  percepcionesIibb: number;
  impuestosInternos: number;
  otrosImpuestos: number;
  total: number;
};

const HEADERS = [
  'FechaEmision', 'ProveedorCUIT', 'ProveedorRazonSocial', 'CodigoGasto',
  'TipoComprobante', 'PuntoVenta', 'Numero',
  'NetoGeneral', 'Neto21', 'Neto10.5', 'Neto27',
  'IVA21', 'IVA10.5', 'IVA27', 'NoGravados',
  'PercepcionesIVA', 'PercepcionesIIBB', 'ImpuestosInternos', 'OtrosImpuestos', 'Total'
];

export default function ImportarGastos() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [data, setData] = useState<GastoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{type: 'error' | 'success' | 'warning', message: string} | null>(null);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([HEADERS]);
    
    // Set column widths roughly based on content
    ws['!cols'] = HEADERS.map(h => ({ wch: h.length + 5 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla Gastos");
    XLSX.writeFile(wb, "Plantilla_Importacion_Gastos.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setNotification(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bstr = event.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Parse with headers
        const json = XLSX.utils.sheet_to_json<any>(ws);
        
        // Map excel keys to our GastoRow format
        const mappedData: GastoRow[] = json.map((row, index) => ({
          id: `row-${Date.now()}-${index}`,
          fechaEmision: row.FechaEmision ? formatExcelDate(row.FechaEmision) : new Date().toISOString().split('T')[0],
          proveedorCuit: String(row.ProveedorCUIT || ''),
          proveedorRazonSocial: String(row.ProveedorRazonSocial || ''),
          codigoGasto: String(row.CodigoGasto || ''),
          tipoComprobante: row.Letra ? `${row.TipoComprobante || 'Factura'} ${row.Letra}` : String(row.TipoComprobante || 'Factura A'),
          puntoVenta: String(row.PuntoVenta || '0001'),
          numeroComprobante: String(row.Numero || ''),
          netoGeneral: Number(row.NetoGeneral) || 0,
          neto21: Number(row.Neto21) || 0,
          neto10_5: Number(row['Neto10.5']) || 0,
          neto27: Number(row.Neto27) || 0,
          iva21: Number(row.IVA21) || 0,
          iva10_5: Number(row['IVA10.5']) || 0,
          iva27: Number(row.IVA27) || 0,
          noGravados: Number(row.NoGravados) || 0,
          percepcionesIva: Number(row.PercepcionesIVA) || 0,
          percepcionesIibb: Number(row.PercepcionesIIBB) || 0,
          impuestosInternos: Number(row.ImpuestosInternos) || 0,
          otrosImpuestos: Number(row.OtrosImpuestos) || 0,
          total: Number(row.Total) || 0,
        }));

        setData(mappedData);
        setNotification({ type: 'success', message: `Se cargaron ${mappedData.length} registros para revisión.` });
      } catch (err) {
        console.error(err);
        setNotification({ type: 'error', message: 'Error al procesar el archivo Excel. Asegúrate de usar la plantilla.' });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Helper to handle Excel dates
  const formatExcelDate = (excelDate: any): string => {
    if (typeof excelDate === 'number') {
      const date = new Date((excelDate - (25567 + 2)) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    // Try to parse string
    try {
      return new Date(excelDate).toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  };

  const updateRow = (id: string, field: keyof GastoRow, value: any) => {
    setData(prev => prev.map(row => {
      if (row.id === id) {
        const updated = { ...row, [field]: value };
        // Recalculate total if any financial field changes manually
        if (field !== 'id' && field !== 'fechaEmision' && field !== 'proveedorCuit' && field !== 'proveedorRazonSocial' && field !== 'codigoGasto' && field !== 'tipoComprobante' && field !== 'puntoVenta' && field !== 'numeroComprobante' && field !== 'total') {
          updated.total = 
            Number(updated.netoGeneral) + Number(updated.neto21) + Number(updated.neto10_5) + Number(updated.neto27) +
            Number(updated.iva21) + Number(updated.iva10_5) + Number(updated.iva27) +
            Number(updated.noGravados) + Number(updated.percepcionesIva) + Number(updated.percepcionesIibb) +
            Number(updated.impuestosInternos) + Number(updated.otrosImpuestos);
        }
        return updated;
      }
      return row;
    }));
  };

  const removeRow = (id: string) => {
    setData(prev => prev.filter(r => r.id !== id));
  };

  const handleSave = async () => {
    if (data.length === 0) return;
    setSaving(true);
    setNotification(null);

    // Filter incomplete rows
    const validRows = data.filter(r => r.proveedorCuit && r.proveedorRazonSocial && r.numeroComprobante);

    if (validRows.length !== data.length) {
      const confirm = window.confirm(`Hay ${data.length - validRows.length} fila(s) incompletas (sin CUIT, Razón Social o Número). Serán ignoradas. ¿Continuar?`);
      if (!confirm) {
        setSaving(false);
        return;
      }
    }

    if (validRows.length === 0) {
      setNotification({ type: 'warning', message: 'No hay filas válidas para guardar.' });
      setSaving(false);
      return;
    }

    const payload = validRows.map(r => ({
      ...r,
      tipoComprobante: r.tipoComprobante.replace(/ [ABC]$/, ''),
      letraComprobante: r.tipoComprobante.match(/ ([ABC])$/) ? r.tipoComprobante.slice(-1) : ''
    }));

    try {
      const res = await fetch('/api/administracion/gastos/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error en importación masiva');
      }

      setNotification({ type: 'success', message: `Importación completada con éxito. Redirigiendo...` });
      setTimeout(() => router.push('/administracion/gastos'), 2000);

    } catch (err: any) {
      console.error(err);
      setNotification({ type: 'error', message: err.message || 'Ocurrió un error inesperado' });
      setSaving(false);
    }
  };

  // Base classes for the new condensed layout
  const inputClass = "w-full min-w-0 bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700/50 focus:bg-white dark:focus:bg-slate-800 focus:ring-0 rounded px-1.5 py-0.5 text-xs text-slate-800 dark:text-slate-200 transition-all outline-none font-medium h-[26px]";
  const numberClass = `${inputClass} text-right font-mono`;
  const thClass = "p-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700 align-middle leading-tight";

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      <ModuleHeader 
        title="Importar Gastos" 
        description="Carga masiva de facturas mediante planilla Excel"
      />

      <div className="flex flex-col flex-1 p-4 md:p-6 overflow-hidden">
        
        {/* Top Controls */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mb-4 shrink-0">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1">Instrucciones</h3>
              <p className="text-xs text-slate-500">1. Descarga la plantilla vacía. 2. Completa los datos. 3. Sube el archivo para revisar e importar.</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={downloadTemplate}
                className="flex items-center justify-center px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Descargar Plantilla
              </button>
              
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="flex items-center justify-center px-4 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-lg shadow-sm shadow-blue-600/20 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Subir Archivo Excel
              </button>
            </div>
          </div>

          {notification && (
            <div className={`mt-4 p-3 rounded-lg shadow-sm flex items-center border text-xs font-bold ${
              notification.type === 'error' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300' : 
              notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300' :
              'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-300'
            }`}>
              <span>{notification.message}</span>
            </div>
          )}
        </div>

        {/* Data Grid Preview */}
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col relative">
          <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 shrink-0">
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Vista Previa ({data.length} filas)</h3>
          </div>
          
          <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-900/20 p-2">
            {data.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <FileSpreadsheet className="w-12 h-12 mb-3 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-[10px]">Sube un archivo para previsualizar los datos</p>
              </div>
            ) : (
              <div className="min-w-max">
                <table className="w-full text-left border-collapse table-fixed" style={{ width: '2000px' }}>
                  <thead>
                    <tr>
                      <th className={`${thClass} text-center w-[110px]`}>Fecha</th>
                      <th className={`${thClass} text-center w-[100px]`}>CUIT</th>
                      <th className={`${thClass} text-left w-[220px]`}>Razón Social</th>
                      <th className={`${thClass} text-center w-[80px]`}>Cod. Gasto</th>
                      <th className={`${thClass} text-center w-[110px]`}>Tipo</th>
                      <th className={`${thClass} text-center w-[90px]`}>Punto Venta</th>
                      <th className={`${thClass} text-center w-[80px]`}>Número</th>
                      <th className={`${thClass} text-center w-[80px]`}>Neto Gral</th>
                      <th className={`${thClass} text-center w-[70px]`}>Neto 21%</th>
                      <th className={`${thClass} text-center w-[80px]`}>Neto 10.5%</th>
                      <th className={`${thClass} text-center w-[70px]`}>Neto 27%</th>
                      <th className={`${thClass} text-center w-[70px]`}>IVA 21%</th>
                      <th className={`${thClass} text-center w-[80px]`}>IVA 10.5%</th>
                      <th className={`${thClass} text-center w-[70px]`}>IVA 27%</th>
                      <th className={`${thClass} text-center w-[70px]`}>No Grav.</th>
                      <th className={`${thClass} text-center w-[70px]`}>Perc IVA</th>
                      <th className={`${thClass} text-center w-[80px]`}>Perc IIBB</th>
                      <th className={`${thClass} text-center w-[70px]`}>Imp Int.</th>
                      <th className={`${thClass} text-center w-[70px]`}>Otros</th>
                      <th className={`${thClass} text-center w-[90px]`}>Total</th>
                      <th className={`${thClass} w-[30px]`}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row) => (
                      <tr key={row.id} className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="p-0.5 align-top">
                          <input type="date" value={row.fechaEmision} onChange={(e) => updateRow(row.id, 'fechaEmision', e.target.value)} className={`${inputClass} text-center`} />
                        </td>
                        <td className="p-0.5 align-top">
                          <input type="text" value={row.proveedorCuit} onChange={(e) => updateRow(row.id, 'proveedorCuit', e.target.value)} className={`${inputClass} text-center font-mono`} placeholder="CUIT" />
                        </td>
                        <td className="p-0.5 align-top">
                          <input type="text" value={row.proveedorRazonSocial} onChange={(e) => updateRow(row.id, 'proveedorRazonSocial', e.target.value)} className={`${inputClass} text-left`} placeholder="Razón Social" />
                        </td>
                        <td className="p-0.5 align-top">
                          <input type="text" value={row.codigoGasto} onChange={(e) => updateRow(row.id, 'codigoGasto', e.target.value)} className={`${inputClass} text-center uppercase font-mono`} placeholder="Cod" />
                        </td>
                        <td className="p-0.5 align-top">
                          <select 
                            value={row.tipoComprobante} 
                            onChange={(e) => updateRow(row.id, 'tipoComprobante', e.target.value)} 
                            className={`${inputClass} text-center cursor-pointer`}
                          >
                            <option value="Factura A">Factura A</option>
                            <option value="Factura B">Factura B</option>
                            <option value="Factura C">Factura C</option>
                            <option value="Nota de Crédito">Nota de Crédito</option>
                            <option value="Ticket">Ticket</option>
                          </select>
                        </td>
                        <td className="p-0.5 align-top">
                          <input type="text" value={row.puntoVenta} onChange={(e) => updateRow(row.id, 'puntoVenta', e.target.value)} className={`${inputClass} text-center font-mono`} placeholder="PV" />
                        </td>
                        <td className="p-0.5 align-top">
                          <input type="text" value={row.numeroComprobante} onChange={(e) => updateRow(row.id, 'numeroComprobante', e.target.value)} className={`${inputClass} text-center font-mono`} placeholder="Número" />
                        </td>
                        <td className="p-0.5 align-top"><input type="number" value={row.netoGeneral} onChange={(e) => updateRow(row.id, 'netoGeneral', parseFloat(e.target.value) || 0)} className={numberClass} /></td>
                        <td className="p-0.5 align-top"><input type="number" value={row.neto21} onChange={(e) => updateRow(row.id, 'neto21', parseFloat(e.target.value) || 0)} className={numberClass} /></td>
                        <td className="p-0.5 align-top"><input type="number" value={row.neto10_5} onChange={(e) => updateRow(row.id, 'neto10_5', parseFloat(e.target.value) || 0)} className={numberClass} /></td>
                        <td className="p-0.5 align-top"><input type="number" value={row.neto27} onChange={(e) => updateRow(row.id, 'neto27', parseFloat(e.target.value) || 0)} className={numberClass} /></td>
                        <td className="p-0.5 align-top"><input type="number" value={row.iva21} onChange={(e) => updateRow(row.id, 'iva21', parseFloat(e.target.value) || 0)} className={numberClass} /></td>
                        <td className="p-0.5 align-top"><input type="number" value={row.iva10_5} onChange={(e) => updateRow(row.id, 'iva10_5', parseFloat(e.target.value) || 0)} className={numberClass} /></td>
                        <td className="p-0.5 align-top"><input type="number" value={row.iva27} onChange={(e) => updateRow(row.id, 'iva27', parseFloat(e.target.value) || 0)} className={numberClass} /></td>
                        <td className="p-0.5 align-top"><input type="number" value={row.noGravados} onChange={(e) => updateRow(row.id, 'noGravados', parseFloat(e.target.value) || 0)} className={numberClass} /></td>
                        <td className="p-0.5 align-top"><input type="number" value={row.percepcionesIva} onChange={(e) => updateRow(row.id, 'percepcionesIva', parseFloat(e.target.value) || 0)} className={numberClass} /></td>
                        <td className="p-0.5 align-top"><input type="number" value={row.percepcionesIibb} onChange={(e) => updateRow(row.id, 'percepcionesIibb', parseFloat(e.target.value) || 0)} className={numberClass} /></td>
                        <td className="p-0.5 align-top"><input type="number" value={row.impuestosInternos} onChange={(e) => updateRow(row.id, 'impuestosInternos', parseFloat(e.target.value) || 0)} className={numberClass} /></td>
                        <td className="p-0.5 align-top"><input type="number" value={row.otrosImpuestos} onChange={(e) => updateRow(row.id, 'otrosImpuestos', parseFloat(e.target.value) || 0)} className={numberClass} /></td>
                        <td className="p-0.5 align-top">
                          <input type="number" value={row.total} onChange={(e) => updateRow(row.id, 'total', parseFloat(e.target.value) || 0)} className={`${numberClass} font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10`} />
                        </td>
                        <td className="p-0.5 align-middle text-center">
                          <button onClick={() => removeRow(row.id)} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-40 flex justify-between items-center">
        <button 
          onClick={() => router.back()}
          className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" /> Cancelar
        </button>

        <button 
          onClick={handleSave}
          disabled={saving || data.length === 0}
          className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Guardar Importación
        </button>
      </div>

    </div>
  );
}
