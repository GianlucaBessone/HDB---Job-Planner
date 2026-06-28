'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, Loader2, Building2, FileText, Search } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import SearchableSelect from '@/components/SearchableSelect';

export default function CrearFacturaManual() {
  const router = useRouter();

  const [codigosGasto, setCodigosGasto] = useState<any[]>([]);
  const [selectedCodigo, setSelectedCodigo] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [searchingCuit, setSearchingCuit] = useState(false);
  const [notification, setNotification] = useState<{type: 'error' | 'success' | 'warning', message: string} | null>(null);

  // Form State
  const [proveedor, setProveedor] = useState({ id: '', razonSocial: '', cuit: '' });
  const [comprobante, setComprobante] = useState({ 
    fechaEmision: new Date().toISOString().split('T')[0], 
    tipoComprobante: 'Factura A', 
    puntoVenta: '0001', 
    numeroComprobante: '' 
  });
  const [totales, setTotales] = useState({
    netoGeneral: 0,
    neto21: 0,
    neto10_5: 0,
    neto27: 0,
    iva21: 0,
    iva10_5: 0,
    iva27: 0,
    noGravados: 0,
    percepcionesIva: 0,
    percepcionesIibb: 0,
    total: 0
  });

  useEffect(() => {
    fetch('/api/administracion/codigos-gasto')
      .then(res => res.json())
      .then(data => setCodigosGasto(data || []))
      .catch(console.error);
  }, []);

  // Update total whenever a partial value changes
  useEffect(() => {
    const sum = 
      totales.netoGeneral +
      totales.neto21 + totales.iva21 +
      totales.neto10_5 + totales.iva10_5 +
      totales.neto27 + totales.iva27 +
      totales.noGravados +
      totales.percepcionesIva +
      totales.percepcionesIibb;
    
    setTotales(prev => ({ ...prev, total: Number(sum.toFixed(2)) }));
  }, [
    totales.netoGeneral,
    totales.neto21, totales.iva21,
    totales.neto10_5, totales.iva10_5,
    totales.neto27, totales.iva27,
    totales.noGravados,
    totales.percepcionesIva,
    totales.percepcionesIibb
  ]);

  const buscarProveedorPorCuit = async () => {
    const rawCuit = proveedor.cuit.replace(/\D/g, '');
    if (rawCuit.length < 11) return;
    
    // Format CUIT just in case the DB has it with dashes
    const formattedCuit = `${rawCuit.slice(0, 2)}-${rawCuit.slice(2, 10)}-${rawCuit.slice(10)}`;

    setSearchingCuit(true);
    setNotification(null);
    try {
      // Fetch with both formats to be safe
      const res1 = await fetch(`/api/administracion/proveedores?search=${rawCuit}`);
      const res2 = await fetch(`/api/administracion/proveedores?search=${formattedCuit}`);
      
      let allData: any[] = [];
      if (res1.ok) allData = [...allData, ...(await res1.json())];
      if (res2.ok) allData = [...allData, ...(await res2.json())];

      // Find exact match ignoring dashes
      const match = allData.find((p: any) => p.cuit.replace(/\D/g, '') === rawCuit);
      
      if (match) {
        setProveedor({ id: match.id, razonSocial: match.razonSocial, cuit: match.cuit });
        setNotification({ type: 'success', message: `Proveedor encontrado: ${match.razonSocial}` });
      } else {
        setProveedor(prev => ({ ...prev, id: '' })); // Needs creation
        setNotification({ type: 'warning', message: 'Proveedor no encontrado. Será creado al guardar el comprobante.' });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearchingCuit(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setNotification(null);

    try {
      if (!proveedor.cuit || !proveedor.razonSocial) throw new Error("Faltan datos del proveedor");
      if (!comprobante.numeroComprobante || !comprobante.puntoVenta) throw new Error("Faltan datos del comprobante");
      
      let proveedorId = proveedor.id;
      
      // 1. Create Proveedor if it doesn't exist
      if (!proveedorId) {
        const provRes = await fetch('/api/administracion/proveedores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            cuit: proveedor.cuit, 
            razonSocial: proveedor.razonSocial 
          })
        });
        
        if (!provRes.ok) {
          const errData = await provRes.json();
          throw new Error("Error creando proveedor: " + JSON.stringify(errData));
        }
        const newProv = await provRes.json();
        proveedorId = newProv.id;
      }

      // 2. Insert Gasto
      const payload = {
        fechaEmision: new Date(comprobante.fechaEmision).toISOString(),
        proveedorId: proveedorId,
        codigoGastoId: selectedCodigo || null,
        tipoComprobante: comprobante.tipoComprobante.replace(/ [ABC]$/, ''),
        letraComprobante: comprobante.tipoComprobante.match(/ ([ABC])$/) ? comprobante.tipoComprobante.slice(-1) : '',
        puntoVenta: comprobante.puntoVenta,
        numeroComprobante: comprobante.numeroComprobante,
        netoGeneral: totales.netoGeneral || 0,
        neto21: totales.neto21 || 0,
        neto10_5: totales.neto10_5 || 0,
        neto27: totales.neto27 || 0,
        iva21: totales.iva21 || 0,
        iva10_5: totales.iva10_5 || 0,
        iva27: totales.iva27 || 0,
        noGravados: totales.noGravados || 0,
        percepcionesIva: totales.percepcionesIva || 0,
        percepcionesIibb: totales.percepcionesIibb || 0,
        total: totales.total || 0,
        esFactura: true
      };

      const res = await fetch('/api/administracion/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al guardar el comprobante');
      }

      setNotification({ type: 'success', message: 'Comprobante creado exitosamente. Redirigiendo...' });
      setTimeout(() => router.push('/administracion/gastos'), 2000);
      
    } catch (error: any) {
      setNotification({ type: 'error', message: error.message || 'Error desconocido' });
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <ModuleHeader 
        title="Crear Gasto Manualmente" 
        description="Ingresa los datos de la factura paso a paso"
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24">
        {notification && (
          <div className={`p-4 rounded-xl mb-6 shadow-sm flex items-center border ${
            notification.type === 'error' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300' : 
            notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300' :
            'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-300'
          }`}>
            <span>{notification.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
          
          {/* Col 1: Proveedor y Comprobante */}
          <div className="space-y-6">
            <div className="bg-card text-card-foreground rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">Datos del Proveedor</h3>
                  <p className="text-sm text-slate-500">Ingresa el CUIT y valida</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">CUIT</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      className="flex-1 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full p-3 dark:bg-slate-900 dark:border-slate-700 dark:placeholder-slate-400 dark:text-white" 
                      placeholder="Sin guiones"
                      value={proveedor.cuit}
                      onChange={(e) => setProveedor(p => ({ ...p, cuit: e.target.value, id: '' }))}
                      onBlur={buscarProveedorPorCuit}
                    />
                    <button 
                      onClick={buscarProveedorPorCuit}
                      disabled={searchingCuit || proveedor.cuit.length < 11}
                      className="px-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {searchingCuit ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Razón Social</label>
                  <input 
                    type="text" 
                    className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full p-3 dark:bg-slate-900 dark:border-slate-700 dark:text-white" 
                    value={proveedor.razonSocial}
                    onChange={(e) => setProveedor(p => ({ ...p, razonSocial: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="bg-card text-card-foreground rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">Datos del Comprobante</h3>
                  <p className="text-sm text-slate-500">Información general</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha de Emisión</label>
                    <input 
                      type="date" 
                      className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-purple-500 focus:border-purple-500 block w-full p-3 dark:bg-slate-900 dark:border-slate-700 dark:text-white" 
                      value={comprobante.fechaEmision}
                      onChange={(e) => setComprobante(c => ({ ...c, fechaEmision: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tipo</label>
                    <select 
                      className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-purple-500 focus:border-purple-500 block w-full p-3 dark:bg-slate-900 dark:border-slate-700 dark:text-white" 
                      value={comprobante.tipoComprobante}
                      onChange={(e) => setComprobante(c => ({ ...c, tipoComprobante: e.target.value }))}
                    >
                      <option value="Factura A">Factura A</option>
                      <option value="Factura B">Factura B</option>
                      <option value="Factura C">Factura C</option>
                      <option value="Nota de Crédito">Nota de Crédito</option>
                      <option value="Ticket">Ticket</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Punto Vta</label>
                    <input 
                      type="text" 
                      className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-purple-500 focus:border-purple-500 block w-full p-3 dark:bg-slate-900 dark:border-slate-700 dark:text-white text-center" 
                      value={comprobante.puntoVenta}
                      onChange={(e) => setComprobante(c => ({ ...c, puntoVenta: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Número</label>
                    <input 
                      type="text" 
                      className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-purple-500 focus:border-purple-500 block w-full p-3 dark:bg-slate-900 dark:border-slate-700 dark:text-white text-right font-mono" 
                      value={comprobante.numeroComprobante}
                      onChange={(e) => setComprobante(c => ({ ...c, numeroComprobante: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Código de Gasto</label>
                  <SearchableSelect
                    options={codigosGasto.map(c => ({ id: c.id, value: c.id, label: `${c.codigo} - ${c.descripcion}` }))}
                    value={selectedCodigo}
                    onChange={setSelectedCodigo}
                    placeholder="Seleccionar código..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Col 2: Importes */}
          <div className="bg-card text-card-foreground rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">Importes</h3>
            <div className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4 bg-background text-foreground/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Neto Gral / No Gravado</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="bg-white border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-emerald-500 focus:border-emerald-500 block w-full p-3 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-right font-mono" 
                    value={totales.netoGeneral}
                    onChange={(e) => setTotales(t => ({ ...t, netoGeneral: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Exentos / Otros</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="bg-white border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-emerald-500 focus:border-emerald-500 block w-full p-3 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-right font-mono" 
                    value={totales.noGravados}
                    onChange={(e) => setTotales(t => ({ ...t, noGravados: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Neto 21%</label>
                  <input type="number" step="0.01" className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl block w-full p-3 dark:bg-slate-900 dark:border-slate-700 dark:text-white text-right font-mono" value={totales.neto21} onChange={(e) => setTotales(t => ({ ...t, neto21: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">IVA 21%</label>
                  <input type="number" step="0.01" className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl block w-full p-3 dark:bg-slate-900 dark:border-slate-700 dark:text-white text-right font-mono" value={totales.iva21} onChange={(e) => setTotales(t => ({ ...t, iva21: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Neto 10.5%</label>
                  <input type="number" step="0.01" className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl block w-full p-3 dark:bg-slate-900 dark:border-slate-700 dark:text-white text-right font-mono" value={totales.neto10_5} onChange={(e) => setTotales(t => ({ ...t, neto10_5: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">IVA 10.5%</label>
                  <input type="number" step="0.01" className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl block w-full p-3 dark:bg-slate-900 dark:border-slate-700 dark:text-white text-right font-mono" value={totales.iva10_5} onChange={(e) => setTotales(t => ({ ...t, iva10_5: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Neto 27%</label>
                  <input type="number" step="0.01" className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl block w-full p-3 dark:bg-slate-900 dark:border-slate-700 dark:text-white text-right font-mono" value={totales.neto27} onChange={(e) => setTotales(t => ({ ...t, neto27: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">IVA 27%</label>
                  <input type="number" step="0.01" className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl block w-full p-3 dark:bg-slate-900 dark:border-slate-700 dark:text-white text-right font-mono" value={totales.iva27} onChange={(e) => setTotales(t => ({ ...t, iva27: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Perc. IVA</label>
                  <input type="number" step="0.01" className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl block w-full p-3 dark:bg-slate-900 dark:border-slate-700 dark:text-white text-right font-mono" value={totales.percepcionesIva} onChange={(e) => setTotales(t => ({ ...t, percepcionesIva: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Perc. IIBB</label>
                  <input type="number" step="0.01" className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl block w-full p-3 dark:bg-slate-900 dark:border-slate-700 dark:text-white text-right font-mono" value={totales.percepcionesIibb} onChange={(e) => setTotales(t => ({ ...t, percepcionesIibb: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>

              <div className="bg-slate-900 dark:bg-slate-950 p-6 rounded-2xl mt-6 shadow-inner text-white flex justify-between items-center">
                <span className="text-sm font-bold uppercase tracking-widest text-slate-400">Total Factura</span>
                <span className="text-3xl font-black">${totales.total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-40 flex justify-between items-center">
        <button 
          onClick={() => router.back()}
          className="px-6 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" /> Cancelar
        </button>

        <button 
          onClick={handleSave}
          disabled={saving || !proveedor.cuit || !proveedor.razonSocial || !comprobante.numeroComprobante}
          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Guardar Comprobante
        </button>
      </div>

    </div>
  );
}
