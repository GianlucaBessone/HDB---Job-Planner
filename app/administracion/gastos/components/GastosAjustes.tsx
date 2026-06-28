'use client';

import { useState, useEffect } from 'react';
import { X, List, Building2, Trash2 } from 'lucide-react';

export default function GastosAjustes() {
  const [codigo, setCodigo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [cuit, setCuit] = useState('');

  const [codigosList, setCodigosList] = useState<any[]>([]);
  const [proveedoresList, setProveedoresList] = useState<any[]>([]);
  const [notification, setNotification] = useState<{type: 'error' | 'success', message: string} | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, type: 'codigo' | 'proveedor', title: string } | null>(null);

  const fetchCodigos = async () => {
    try {
      const res = await fetch('/api/administracion/codigos-gasto');
      if (res.ok) setCodigosList(await res.json());
    } catch (e) {}
  };

  const fetchProveedores = async () => {
    try {
      const res = await fetch('/api/administracion/proveedores');
      if (res.ok) setProveedoresList(await res.json());
    } catch (e) {}
  };

  useEffect(() => {
    fetchCodigos();
    fetchProveedores();
  }, []);

  const handleCreateCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/administracion/codigos-gasto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, descripcion }),
      });
      if (res.ok) {
        setNotification({ type: 'success', message: 'Código de gasto creado con éxito' });
        setCodigo('');
        setDescripcion('');
        fetchCodigos();
      } else {
        const error = await res.json();
        setNotification({ type: 'error', message: 'Error: ' + (error.error || 'No se pudo crear') });
      }
    } catch (e) {
      console.error(e);
      setNotification({ type: 'error', message: 'Error de red' });
    }
  };

  const confirmDeleteCodigo = (id: string) => setDeleteConfirm({ id, type: 'codigo', title: '¿Seguro que deseas eliminar este Código de Gasto?' });
  const confirmDeleteProveedor = (id: string) => setDeleteConfirm({ id, type: 'proveedor', title: '¿Seguro que deseas eliminar este Proveedor?' });

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const { id, type } = deleteConfirm;
    setDeleteConfirm(null);

    if (type === 'codigo') {
      try {
        const res = await fetch(`/api/administracion/codigos-gasto/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setNotification({ type: 'success', message: 'Código eliminado (soft delete)' });
          fetchCodigos();
        } else {
          setNotification({ type: 'error', message: 'No se pudo eliminar' });
        }
      } catch (e) {
        setNotification({ type: 'error', message: 'Error de red' });
      }
    } else {
      try {
        const res = await fetch(`/api/administracion/proveedores/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setNotification({ type: 'success', message: 'Proveedor eliminado (soft delete)' });
          fetchProveedores();
        } else {
          setNotification({ type: 'error', message: 'No se pudo eliminar' });
        }
      } catch (e) {
        setNotification({ type: 'error', message: 'Error de red' });
      }
    }
  };

  const handleCreateProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/administracion/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ razonSocial, cuit }),
      });
      if (res.ok) {
        setNotification({ type: 'success', message: 'Proveedor creado con éxito' });
        setRazonSocial('');
        setCuit('');
        fetchProveedores();
      } else {
        const error = await res.json();
        setNotification({ type: 'error', message: 'Error: ' + (error.error || 'No se pudo crear') });
      }
    } catch (e) {
      console.error(e);
      setNotification({ type: 'error', message: 'Error de red' });
    }
  };



  return (
    <div className="p-6 h-full overflow-y-auto bg-slate-50 dark:bg-slate-900/50 relative">
      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">{deleteConfirm.title}</h3>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                Cancelar
              </button>
              <button onClick={executeDelete} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Inline Notification */}
      {notification && (
        <div className={`sticky top-4 z-50 w-full max-w-md mx-auto mb-6 p-4 rounded-xl shadow-lg flex items-center justify-between border ${
          notification.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 
          'bg-green-50 text-green-800 border-green-200'
        }`}>
          <p className="text-sm font-medium">{notification.message}</p>
          <button onClick={() => setNotification(null)} className="ml-4 opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Columna Códigos de Gasto */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Nuevo Código de Gasto</h3>
            <form onSubmit={handleCreateCodigo} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Código</label>
                <input
                  type="text"
                  required
                  value={codigo}
                  onChange={e => setCodigo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  placeholder="Ej: G-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descripción</label>
                <input
                  type="text"
                  required
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  placeholder="Ej: Materiales de Oficina"
                />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                  Guardar Código
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200 flex items-center">
              <List className="w-5 h-5 mr-2 text-blue-500" />
              Listado de Códigos
            </h3>
            <div className="max-h-80 overflow-y-auto pr-2">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-medium text-slate-500">Código</th>
                    <th className="px-3 py-2 font-medium text-slate-500">Descripción</th>
                    <th className="px-3 py-2 font-medium text-slate-500"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {codigosList.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-slate-400">Sin códigos registrados.</td>
                    </tr>
                  ) : codigosList.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 font-medium">{c.codigo}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{c.descripcion}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => confirmDeleteCodigo(c.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Columna Proveedores */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Nuevo Proveedor Manual</h3>
          <form onSubmit={handleCreateProveedor} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Razón Social</label>
              <input
                type="text"
                required
                value={razonSocial}
                onChange={e => setRazonSocial(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CUIT</label>
              <input
                type="text"
                required
                value={cuit}
                onChange={e => setCuit(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                placeholder="Sin guiones"
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                Guardar Proveedor
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200 flex items-center">
            <Building2 className="w-5 h-5 mr-2 text-blue-500" />
            Listado de Proveedores
          </h3>
          <div className="max-h-80 overflow-y-auto pr-2">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 font-medium text-slate-500">CUIT</th>
                  <th className="px-3 py-2 font-medium text-slate-500">Razón Social</th>
                  <th className="px-3 py-2 font-medium text-slate-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {proveedoresList.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-slate-400">Sin proveedores registrados.</td>
                  </tr>
                ) : proveedoresList.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 font-mono text-xs">{p.cuit}</td>
                    <td className="px-3 py-2 font-medium truncate max-w-[200px]" title={p.razonSocial}>{p.razonSocial}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => confirmDeleteProveedor(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
