'use client';

import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, FileSpreadsheet, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';

export default function GastosPlanilla() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{type: 'error' | 'success', message: string} | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, title: string } | null>(null);

  const fetchGastos = () => {
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
  };

  useEffect(() => {
    fetchGastos();
  }, []);

  const confirmDeleteFactura = (id: string) => setDeleteConfirm({ id, title: '¿Seguro que deseas eliminar esta factura? (Acción irreversible)' });

  const executeDeleteFactura = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeleteConfirm(null);

    try {
      const res = await fetch(`/api/administracion/gastos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotification({ type: 'success', message: 'Factura eliminada correctamente' });
        fetchGastos();
      } else {
        setNotification({ type: 'error', message: 'No se pudo eliminar la factura' });
      }
    } catch (e) {
      setNotification({ type: 'error', message: 'Error de red' });
    }
  };

  const exportToExcel = () => {
    const exportData = data.map(item => ({
      'Fecha': format(new Date(item.fechaEmision), 'dd/MM/yyyy'),
      'Cod. Gasto': item.codigoGasto?.codigo || '',
      'Descripción Gasto': item.codigoGasto?.descripcion || '',
      'CUIT': item.proveedor?.cuit || '',
      'Proveedor': item.proveedor?.razonSocial || '',
      'Tipo Comprobante': `${item.tipoComprobante || ''}${item.letraComprobante ? ' ' + item.letraComprobante : ''}`.trim(),
      'Punto Venta': item.puntoVenta || '',
      'Nro Factura': item.numeroComprobante || '',
      'Valor Neto': item.netoGeneral,
      'Neto 21%': item.neto21,
      'Neto 10.5%': item.neto10_5,
      'Neto 27%': item.neto27,
      'IVA 21%': item.iva21,
      'IVA 10.5%': item.iva10_5,
      'IVA 27%': item.iva27,
      'No Gravados': item.noGravados,
      'Perc. IVA': item.percepcionesIva,
      'Perc. Ing. Brutos': item.percepcionesIibb,
      'Total': item.total,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Gastos");
    XLSX.writeFile(workbook, `Gastos_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Cargando planilla...</div>;
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-card text-card-foreground p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">{deleteConfirm.title}</h3>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                Cancelar
              </button>
              <button onClick={executeDeleteFactura} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Inline Notification */}
      {notification && (
        <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md p-4 rounded-xl shadow-lg flex items-center justify-between border ${
          notification.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 
          'bg-green-50 text-green-800 border-green-200'
        }`}>
          <p className="text-sm font-medium">{notification.message}</p>
          <button onClick={() => setNotification(null)} className="ml-4 opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center">
          <FileSpreadsheet className="w-5 h-5 mr-2" />
          Planilla de Gastos
        </h3>
        <button
          onClick={exportToExcel}
          className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar a Excel
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-muted text-muted-foreground/50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Fecha</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Cod. Gasto</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Desc. Gasto</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">CUIT</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Proveedor</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Tipo Cbte</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Pto Vta</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Nro Factura</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">Neto General</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">Neto 21%</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">Neto 10.5%</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">Neto 27%</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">IVA 21%</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">IVA 10.5%</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">IVA 27%</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">No Gravados</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">Perc. IVA</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">Perc. IIBB</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 text-right">Total</th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {data.length === 0 ? (
              <tr>
                <td colSpan={20} className="px-4 py-8 text-center text-slate-500">No hay gastos registrados.</td>
              </tr>
            ) : (
              data.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-200">
                    {format(new Date(item.fechaEmision), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-200">
                    {item.codigoGasto?.codigo || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-200">
                    {item.codigoGasto?.descripcion || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-200">
                    {item.proveedor?.cuit || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-200">
                    {item.proveedor?.razonSocial || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-200">
                    {`${item.tipoComprobante || '-'}${item.letraComprobante ? ' ' + item.letraComprobante : ''}`.trim()}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-200">
                    {item.puntoVenta || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-200">
                    {item.numeroComprobante || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-200 text-right">
                    ${item.netoGeneral?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-200 text-right">
                    ${item.neto21?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-200 text-right">
                    ${item.neto10_5?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-200 text-right">
                    ${item.neto27?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-200 text-right">
                    ${item.iva21?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-200 text-right">
                    ${item.iva10_5?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-200 text-right">
                    ${item.iva27?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-200 text-right">
                    ${item.noGravados?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-200 text-right">
                    ${item.percepcionesIva?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-200 text-right">
                    ${item.percepcionesIibb?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-200 font-medium text-right">
                    ${item.total?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => confirmDeleteFactura(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors" title="Eliminar Factura">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
