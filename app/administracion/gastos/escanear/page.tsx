'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, X, Check, Loader2, Save, Upload, ArrowLeft, Usb } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import SearchableSelect from '@/components/SearchableSelect';

export default function EscanearFactura() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [ocrData, setOcrData] = useState<any>(null);
  const [codigosGasto, setCodigosGasto] = useState<any[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [scannerFolderHandle, setScannerFolderHandle] = useState<any>(null);
  const [initialFiles, setInitialFiles] = useState<string[]>([]);
  const [isWaitingScanner, setIsWaitingScanner] = useState(false);

  // Form State
  const [selectedCodigo, setSelectedCodigo] = useState('');
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{type: 'error' | 'success' | 'warning', message: string} | null>(null);

  const [proveedor, setProveedor] = useState({ razonSocial: '', cuit: '' });
  const [comprobante, setComprobante] = useState({ fechaEmision: '', tipoComprobante: '', letraComprobante: '', puntoVenta: '', numeroComprobante: '' });
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
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));

    // Fetch Codigos de Gasto
    fetch('/api/administracion/codigos-gasto')
      .then(res => res.json())
      .then(data => setCodigosGasto(data || []))
      .catch(console.error);
  }, []);

  const connectScannerFolder = async () => {
    try {
      if (!('showDirectoryPicker' in window)) {
        setNotification({ type: 'warning', message: 'Tu navegador no soporta esta función. Usa Chrome o Edge.' });
        return;
      }
      const handle = await (window as any).showDirectoryPicker({ mode: 'read' });
      setScannerFolderHandle(handle);
      
      const fileNames = [];
      for await (const entry of handle.values()) {
        if (entry.kind === 'file') fileNames.push(entry.name);
      }
      setInitialFiles(fileNames);
      setIsWaitingScanner(true);
      setNotification({ type: 'success', message: 'Escáner vinculado. Pásalo por la factura y haz clic en "Confirmar Escaneo".' });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(err);
        setNotification({ type: 'error', message: 'Error al vincular: ' + err.message });
      }
    }
  };

  const confirmScan = async () => {
    if (!scannerFolderHandle) return;
    try {
      const currentFiles = [];
      let newFileHandle = null;
      for await (const entry of scannerFolderHandle.values()) {
        if (entry.kind === 'file') {
          currentFiles.push(entry.name);
          if (!initialFiles.includes(entry.name)) {
            newFileHandle = entry;
            break;
          }
        }
      }
      
      if (!newFileHandle) {
        setNotification({ type: 'warning', message: 'No se detectó el nuevo escaneo. ¿Seguro que se guardó ahí?' });
        setInitialFiles(currentFiles);
        return;
      }
      
      const file = await newFileHandle.getFile();
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedImage(event.target?.result as string);
        setIsWaitingScanner(false);
        setScannerFolderHandle(null);
      };
      reader.readAsDataURL(file);

    } catch (err: any) {
      console.error(err);
      setNotification({ type: 'error', message: 'Error al leer el archivo nuevo: ' + err.message });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async () => {
    if (!capturedImage) return;
    setProcessing(true);
    
    try {
      // Convert DataURL to File
      const res = await fetch(capturedImage);
      const blob = await res.blob();
      const file = new File([blob], 'factura.jpg', { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/ia/ocr-factura', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.details || 'Error procesando OCR');
      
      if (!data.data.es_factura) {
        setNotification({ type: 'warning', message: 'La IA detectó que el documento no parece ser una factura válida. Revisa los datos.' });
      } else {
        setNotification(null);
      }
      
      setOcrData(data.data);
      setProveedor({
        razonSocial: data.data.proveedor?.razon_social || '',
        cuit: data.data.proveedor?.cuit || ''
      });
      setComprobante({
        fechaEmision: data.data.fecha_emision || new Date().toISOString().split('T')[0],
        tipoComprobante: data.data.tipo_comprobante || '',
        letraComprobante: data.data.letra_comprobante || '',
        puntoVenta: data.data.punto_venta || '',
        numeroComprobante: data.data.numero_comprobante || ''
      });
      setTotales({
        netoGeneral: data.data.totales?.subtotal || 0,
        neto21: data.data.totales?.neto_21 || 0,
        neto10_5: data.data.totales?.neto_10_5 || 0,
        neto27: data.data.totales?.neto_27 || 0,
        iva21: data.data.totales?.iva_21 || 0,
        iva10_5: data.data.totales?.iva_10_5 || 0,
        iva27: data.data.totales?.iva_27 || 0,
        noGravados: (data.data.totales?.no_gravado || 0) + (data.data.totales?.impuestos_internos || 0) + (data.data.totales?.otros_impuestos || 0),
        percepcionesIva: data.data.totales?.percepciones_iva || 0,
        percepcionesIibb: data.data.totales?.percepciones_iibb || 0,
        total: data.data.totales?.total || 0
      });
    } catch (err: any) {
      console.error(err);
      setNotification({ type: 'error', message: 'Error de IA: ' + (err.message || 'Error desconocido') });
    } finally {
      setProcessing(false);
    }
  };

  const retake = () => {
    setCapturedImage(null);
    setOcrData(null);
    setIsWaitingScanner(false);
    setScannerFolderHandle(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const saveFactura = async () => {
    if (!ocrData) return;
    setSaving(true);

    try {
      // 1. Verificar/Crear Proveedor
      let proveedorId = '';
      if (proveedor.cuit) {
        const provRes = await fetch(`/api/administracion/proveedores?search=${proveedor.cuit}`);
        const provs = await provRes.json();
        if (provs && provs.length > 0) {
          proveedorId = provs[0].id;
        } else {
          // Create Provider
          const createProv = await fetch('/api/administracion/proveedores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razonSocial: proveedor.razonSocial || 'Proveedor Desconocido',
              cuit: proveedor.cuit,
              condicionIva: ocrData.proveedor?.condicion_iva || null,
              domicilio: ocrData.proveedor?.domicilio || null
            })
          });
          const newProv = await createProv.json();
          proveedorId = newProv.id;
        }
      }

      if (!proveedorId) {
        setNotification({ type: 'error', message: 'No se pudo identificar ni crear el proveedor (Falta CUIT).' });
        setSaving(false);
        return;
      }

      // 2. Guardar Factura
      const factRes = await fetch('/api/administracion/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fechaEmision: comprobante.fechaEmision,
          proveedorId: proveedorId,
          codigoGastoId: selectedCodigo || null,
          tipoComprobante: comprobante.tipoComprobante,
          letraComprobante: comprobante.letraComprobante,
          puntoVenta: comprobante.puntoVenta,
          numeroComprobante: comprobante.numeroComprobante,
          netoGeneral: totales.netoGeneral,
          neto21: totales.neto21,
          neto10_5: totales.neto10_5,
          neto27: totales.neto27,
          iva21: totales.iva21,
          iva10_5: totales.iva10_5,
          iva27: totales.iva27,
          noGravados: totales.noGravados,
          percepcionesIva: totales.percepcionesIva,
          percepcionesIibb: totales.percepcionesIibb,
          total: totales.total,
          esFactura: true,
          statusIaConfianza: ocrData.confianza_extraccion,
          iaRawData: ocrData
        })
      });

      if (factRes.ok) {
        setNotification({ type: 'success', message: 'Factura guardada con éxito' });
        setTimeout(() => router.push('/administracion/gastos'), 1500);
      } else {
        const err = await factRes.json();
        setNotification({ type: 'error', message: 'Error al guardar: ' + (err.error || JSON.stringify(err)) });
      }
    } catch (err: any) {
      console.error(err);
      setNotification({ type: 'error', message: 'Error de red al guardar: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white relative">
      <div className="px-6 pt-6">
        <button 
          onClick={() => router.push('/administracion/gastos')}
          className="mb-4 flex items-center text-sm font-medium text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700/50 w-fit"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Gastos
        </button>
        <ModuleHeader 
          title="Escáner Inteligente" 
          description="Captura y extracción de datos"
        />
      </div>

      {/* Global Inline Notification */}
      {notification && (
        <div className={`absolute top-20 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md p-4 rounded-xl shadow-2xl flex items-center justify-between border ${
          notification.type === 'error' ? 'bg-red-50 dark:bg-red-900/90 text-red-800 dark:text-red-100 border-red-200 dark:border-red-800' : 
          notification.type === 'success' ? 'bg-green-50 dark:bg-green-900/90 text-green-800 dark:text-green-100 border-green-200 dark:border-green-800' :
          'bg-yellow-50 dark:bg-yellow-900/90 text-yellow-800 dark:text-yellow-100 border-yellow-200 dark:border-yellow-800'
        }`}>
          <p className="text-sm font-medium">{notification.message}</p>
          <button onClick={() => setNotification(null)} className="ml-4 opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      <div className="flex-1 relative flex flex-col items-center justify-center overflow-hidden">
        
        {/* Native Camera & Upload View */}
        {!capturedImage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-100 dark:bg-slate-800">
            
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 text-center flex flex-col items-center">
              
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6">
                <Camera className="w-10 h-10 text-blue-600 dark:text-blue-400" />
              </div>
              
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Capturar Documento</h3>
              <p className="text-slate-500 mb-8">Usa la cámara de tu dispositivo o selecciona un archivo de tu galería para procesar la factura.</p>
              
              <div className="w-full space-y-4">
                {isMobile && (
                  <>
                    <button 
                      onClick={() => cameraInputRef.current?.click()}
                      className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-3"
                    >
                      <Camera className="w-5 h-5" />
                      Tomar Foto (Cámara)
                    </button>
                    <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleFileUpload} />
                  </>
                )}

                {!isMobile && !isWaitingScanner && (
                  <button 
                    onClick={connectScannerFolder}
                    className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold shadow-lg shadow-slate-800/30 transition-all flex items-center justify-center gap-3"
                  >
                    <Usb className="w-5 h-5" />
                    Vincular Escáner USB
                  </button>
                )}

                {!isMobile && isWaitingScanner && (
                  <button 
                    onClick={confirmScan}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 rounded-xl font-bold transition-all flex items-center justify-center gap-3 animate-pulse"
                  >
                    <Check className="w-5 h-5" />
                    Confirmar Escaneo
                  </button>
                )}

                {!isWaitingScanner && (
                  <>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className={`w-full py-4 ${isMobile ? 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-2 border-slate-200 dark:border-slate-700' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30'} rounded-xl font-bold transition-all flex items-center justify-center gap-3`}
                    >
                      <Upload className="w-5 h-5" />
                      Subir Archivo de Factura
                    </button>
                    <input type="file" accept="image/*,.pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                  </>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Captured Image Preview & Processing */}
        {capturedImage && !ocrData && (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-6 bg-slate-900">
            <img src={capturedImage} alt="Captured" className="max-h-[60vh] rounded-xl shadow-2xl object-contain mb-8 border-2 border-slate-700" />
            
            {processing ? (
              <div className="flex flex-col items-center">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
                <p className="text-lg font-medium text-blue-400">Analizando documento con IA...</p>
                <p className="text-sm text-slate-400 mt-2">Extrayendo importes, CUIT y conceptos</p>
              </div>
            ) : (
              <div className="flex space-x-4">
                <button 
                  onClick={retake}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
                >
                  <X className="w-5 h-5 inline mr-2" />
                  Reintentar
                </button>
                <button 
                  onClick={processImage}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-colors shadow-lg shadow-blue-900/50"
                >
                  <Check className="w-5 h-5 inline mr-2" />
                  Procesar Factura
                </button>
              </div>
            )}
          </div>
        )}

        {/* Validation Form */}
        {ocrData && (
          <div className="absolute inset-0 bg-white dark:bg-slate-900 text-slate-900 dark:text-white overflow-y-auto p-4 md:p-8">
            <div className="max-w-3xl mx-auto space-y-6">
              
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Validar Datos Extraídos</h2>
                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${ocrData.confianza_extraccion > 0.8 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  Confianza IA: {Math.round(ocrData.confianza_extraccion * 100)}%
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                
                {/* Proveedor e Info General */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Proveedor Info */}
                  <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Datos del Proveedor</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-slate-500">Razón Social</label>
                        <input type="text" value={proveedor.razonSocial} onChange={e => setProveedor({...proveedor, razonSocial: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm mt-1" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500">CUIT</label>
                        <input type="text" value={proveedor.cuit} onChange={e => setProveedor({...proveedor, cuit: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm mt-1 font-mono" />
                      </div>
                    </div>
                  </div>

                  {/* Comprobante Info */}
                  <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Datos del Comprobante</h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500">Fecha Emisión</label>
                          <input type="date" value={comprobante.fechaEmision} onChange={e => setComprobante({...comprobante, fechaEmision: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm mt-1" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500">Tipo (Ej: Factura)</label>
                          <input type="text" value={comprobante.tipoComprobante} onChange={e => setComprobante({...comprobante, tipoComprobante: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm mt-1" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500">Letra</label>
                          <input type="text" value={comprobante.letraComprobante} onChange={e => setComprobante({...comprobante, letraComprobante: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm mt-1" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500">Pto. Vta.</label>
                          <input type="text" value={comprobante.puntoVenta} onChange={e => setComprobante({...comprobante, puntoVenta: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm mt-1 font-mono" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500">Nro.</label>
                          <input type="text" value={comprobante.numeroComprobante} onChange={e => setComprobante({...comprobante, numeroComprobante: e.target.value})} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm mt-1 font-mono" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Código de Gasto (Categorización)</label>
                        <SearchableSelect
                          value={selectedCodigo}
                          onChange={setSelectedCodigo}
                          options={codigosGasto.map(c => ({ id: c.id, label: `${c.codigo} - ${c.descripcion}` }))}
                          placeholder="Seleccione una categoría..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Importes */}
                <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Importes y Totales</h3>
                  
                  {/* Fila 1 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-slate-500">Neto General</label>
                      <input type="number" step="0.01" value={totales.netoGeneral} onChange={e => setTotales({...totales, netoGeneral: parseFloat(e.target.value) || 0})} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm mt-1 font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">Neto 21%</label>
                      <input type="number" step="0.01" value={totales.neto21} onChange={e => setTotales({...totales, neto21: parseFloat(e.target.value) || 0})} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm mt-1 font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">Neto 10.5%</label>
                      <input type="number" step="0.01" value={totales.neto10_5} onChange={e => setTotales({...totales, neto10_5: parseFloat(e.target.value) || 0})} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm mt-1 font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">Neto 27%</label>
                      <input type="number" step="0.01" value={totales.neto27} onChange={e => setTotales({...totales, neto27: parseFloat(e.target.value) || 0})} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm mt-1 font-mono" />
                    </div>
                  </div>

                  {/* Fila 2 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-slate-500">IVA 21%</label>
                      <input type="number" step="0.01" value={totales.iva21} onChange={e => setTotales({...totales, iva21: parseFloat(e.target.value) || 0})} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm mt-1 font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">IVA 10.5%</label>
                      <input type="number" step="0.01" value={totales.iva10_5} onChange={e => setTotales({...totales, iva10_5: parseFloat(e.target.value) || 0})} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm mt-1 font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">IVA 27%</label>
                      <input type="number" step="0.01" value={totales.iva27} onChange={e => setTotales({...totales, iva27: parseFloat(e.target.value) || 0})} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm mt-1 font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">No Gravados</label>
                      <input type="number" step="0.01" value={totales.noGravados} onChange={e => setTotales({...totales, noGravados: parseFloat(e.target.value) || 0})} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm mt-1 font-mono" />
                    </div>
                  </div>

                  {/* Fila 3 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs text-slate-500">Perc. IVA</label>
                      <input type="number" step="0.01" value={totales.percepcionesIva} onChange={e => setTotales({...totales, percepcionesIva: parseFloat(e.target.value) || 0})} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm mt-1 font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">Perc. IIBB</label>
                      <input type="number" step="0.01" value={totales.percepcionesIibb} onChange={e => setTotales({...totales, percepcionesIibb: parseFloat(e.target.value) || 0})} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm mt-1 font-mono" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-slate-500 font-bold text-blue-600 dark:text-blue-400">Total a Pagar</label>
                      <input type="number" step="0.01" value={totales.total} onChange={e => setTotales({...totales, total: parseFloat(e.target.value) || 0})} className="w-full bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-md px-3 py-2 text-lg font-bold text-blue-700 dark:text-blue-300 mt-1 text-right font-mono" />
                    </div>
                  </div>
                </div>

              </div>

              <div className="flex justify-end space-x-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                <button 
                  onClick={retake}
                  disabled={saving}
                  className="px-6 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={saveFactura}
                  disabled={saving || !selectedCodigo}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-medium transition-colors flex items-center shadow-sm"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {saving ? 'Guardando...' : 'Confirmar y Guardar'}
                </button>
              </div>
              {!selectedCodigo && (
                <p className="text-right text-sm text-amber-600 dark:text-amber-400 mt-2">
                  Debe seleccionar un Código de Gasto antes de guardar.
                </p>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
