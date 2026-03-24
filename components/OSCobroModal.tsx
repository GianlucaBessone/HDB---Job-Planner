import { useState, useEffect } from 'react';
import { X, FileText, Download, Calculator, Percent, Save, Loader2 } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';

export default function OSCobroModal({ os, onClose, onSaveSuccess }: { os: any, onClose: () => void, onSaveSuccess: (updatedOS: any) => void }) {
    const defaultMO = os.cobroValorManoObra ?? 0;
    const [valorMo, setValorMo] = useState<number | string>(defaultMO === 0 ? '' : defaultMO);
    
    const [materiales, setMateriales] = useState<any[]>(
        os.materiales.map((m: any) => ({
            id: m.id,
            material: m.material,
            cantidad: m.cantidad,
            precioUnitario: m.precioUnitario ?? '',
        }))
    );
    
    const [descuentoAplicado, setDescuentoAplicado] = useState(os.cobroDescuentoPorcentaje !== null && os.cobroDescuentoPorcentaje !== undefined);
    const [descuentoPorcentaje, setDescuentoPorcentaje] = useState<number | string>(os.cobroDescuentoPorcentaje || '');
    const [ivaAplicado, setIvaAplicado] = useState<boolean>(os.cobroAplicarIva ?? true);
    const [observaciones, setObservaciones] = useState(os.cobroObservaciones || '');
    const [condicionPago, setCondicionPago] = useState(os.cobroCondicionPago || '');
    const [loading, setLoading] = useState(false);

    const formatARS = (num: number) => num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const safeNum = (val: string | number) => {
        const p = typeof val === 'string' ? parseFloat(val) : val;
        return isNaN(p) ? 0 : p;
    };

    // Initial load generic config
    useEffect(() => {
        if (!os.cobroGenerado) {
            safeApiRequest('/api/config/system')
                .then(res => res.json())
                .then(data => {
                    if (data?.valorManoObra && defaultMO === 0) setValorMo(data.valorManoObra);
                })
                .catch(() => {});
        }
    }, [os.cobroGenerado, defaultMO]);

    const handleMaterialPrice = (id: string, price: number | string) => {
        setMateriales(prev => prev.map(m => m.id === id ? { ...m, precioUnitario: price } : m));
    };

    const horasTotales = os.operadores.reduce((acc: number, op: any) => acc + (op.horas || 0), 0);
    const parsedValorMo = safeNum(valorMo);
    const subtotalMo = horasTotales * parsedValorMo;
    const subtotalMat = materiales.reduce((acc, m) => acc + (m.cantidad * safeNum(m.precioUnitario)), 0);
    const subtotalBruto = subtotalMo + subtotalMat;
    
    const parsedDescuento = safeNum(descuentoPorcentaje);
    const montoDescuento = descuentoAplicado ? (subtotalBruto * (parsedDescuento / 100)) : 0;
    const subtotalConDescuento = subtotalBruto - montoDescuento;
    const montoIva = ivaAplicado ? (subtotalConDescuento * 0.21) : 0;
    const totalFinal = subtotalConDescuento + montoIva;

    const round2 = (num: number) => Math.round(num * 100) / 100;

    const generatePdfContent = () => `
        <style>
            @page { margin: 0; size: A4 portrait; }
            * { box-sizing: border-box; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 20mm; color: #1e293b; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .header { border-bottom: 3px solid #6366f1; padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
            .logo { max-height: 80px; object-fit: contain; }
            h2 { font-size: 20px; font-weight: 900; color: #0f172a; margin: 0 0 4px; }
            h3 { font-size: 13px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
            .section { margin-bottom: 24px; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            .field label { font-size: 9px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 2px; }
            .field p { font-size: 13px; font-weight: 700; color: #1e293b; margin: 0; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
            th { background: #f8fafc; text-align: left; padding: 8px 12px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
            td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: 600; }
            .text-right { text-align: right; }
            .totals-box { width: 300px; margin-left: auto; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 16px; }
            .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; font-weight: 600; color: #475569; }
            .totals-row.desc { color: #059669; }
            .totals-row.iva { color: #e11d48; }
            .totals-row.final { font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 8px; padding-top: 8px; border-top: 2px solid #e2e8f0; }
            .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; }
        </style>

        <div class="header">
            <div>
                <img class="logo" src="${window.location.origin}/logo-hdb.jpg" alt="HDB Servicios Electricos" />
                <h2 style="margin-top:10px;">Orden de Cobro — ${os.codigoOS || os.id.slice(-8).toUpperCase()}</h2>
                <p style="font-size:12px;color:#64748b;margin:4px 0 0;">${os.project.codigoProyecto ? os.project.codigoProyecto + ' | ' : ''}${os.project.nombre}</p>
            </div>
            <div style="text-align:right;">
                <p style="font-size:11px;color:#94a3b8;font-weight:700;">Fecha de emisión: ${new Date().toLocaleDateString('es-AR')}</p>
            </div>
        </div>

        <div class="section">
            <div class="grid-2">
                <div class="field"><label>Cliente</label><p>${os.project.client?.nombre || os.project.cliente || 'No especificado'}</p></div>
                <div class="field"><label>Condición de Pago</label><p>${condicionPago || 'No especificada'}</p></div>
            </div>
        </div>

        <div class="section">
            <h3>Detalle de Servicios</h3>
            <table>
                <thead>
                    <tr><th>Concepto</th><th class="text-right">Horas</th><th class="text-right">Valor Unit.</th><th class="text-right">Subtotal</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Mano de Obra</td>
                        <td class="text-right">${horasTotales}h</td>
                        <td class="text-right">$${formatARS(parsedValorMo)}</td>
                        <td class="text-right">$${formatARS(subtotalMo)}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        ${materiales.length > 0 ? `
        <div class="section">
            <h3>Materiales Suministrados</h3>
            <table>
                <thead>
                    <tr><th>Material</th><th class="text-right">Cantidad</th><th class="text-right">Precio Unit.</th><th class="text-right">Subtotal</th></tr>
                </thead>
                <tbody>
                    ${materiales.map(m => `
                        <tr>
                            <td>${m.material}</td>
                            <td class="text-right">${m.cantidad}</td>
                            <td class="text-right">$${formatARS(safeNum(m.precioUnitario))}</td>
                            <td class="text-right">$${formatARS(m.cantidad * safeNum(m.precioUnitario))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        ${observaciones ? `
        <div class="section">
            <h3>Observaciones</h3>
            <p style="font-size:12px;color:#475569;margin:0;white-space:pre-wrap;">${observaciones}</p>
        </div>
        ` : ''}

        <div class="totals-box">
            <div class="totals-row"><span>Subtotal (Mano de Obra + Materiales)</span><span>$${formatARS(subtotalBruto)}</span></div>
            ${descuentoAplicado ? `<div class="totals-row desc"><span>Descuento (${parsedDescuento}%)</span><span>-$${formatARS(montoDescuento)}</span></div>` : ''}
            ${ivaAplicado ? `<div class="totals-row iva"><span>IVA (21%)</span><span>+$${formatARS(montoIva)}</span></div>` : ''}
            <div class="totals-row final"><span>TOTAL FINAL</span><span>$${formatARS(totalFinal)}</span></div>
        </div>

        <div class="footer">
            <p>Documento de control interno y detalle de servicios. No válido como factura electrónica AFIP.</p>
        </div>
    `;

    const handleSaveAndGenerate = async () => {
        if (materiales.some(m => safeNum(m.precioUnitario) < 0)) return showToast('Precios de materiales inválidos', 'error');
        if (parsedValorMo < 0) return showToast('Valor MO inválido', 'error');

        setLoading(true);
        try {
            const body = {
                valorManoObra: parsedValorMo,
                descuentoPorcentaje: descuentoAplicado ? parsedDescuento : null,
                aplicarIva: ivaAplicado,
                totalFinal,
                observaciones,
                condicionPago,
                materiales: materiales.map(m => ({ id: m.id, precioUnitario: safeNum(m.precioUnitario) }))
            };

            const res = await safeApiRequest(`/api/ordenes-servicio/${os.id}/cobro`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) throw new Error('Failed to save');
            const data = await res.json();
            onSaveSuccess(data);
            showToast('Cobro guardado con éxito', 'success');

            // Generate PDF
            const win = window.open('', '_blank');
            if (win) {
                win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cobro - ${os.project.nombre}</title></head><body>${generatePdfContent()}</body></html>`);
                win.document.close();
                win.focus();
                setTimeout(() => { win.print(); win.close(); }, 500);
            }
        } catch (e) {
            showToast('Error al procesar cobro', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-4xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-200 animate-in slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                    <div className="space-y-1">
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <Calculator className="w-5 h-5 text-indigo-600" />
                            Generar Documento de Cobro
                        </h3>
                        <p className="text-sm font-medium text-slate-500">
                            OS: <span className="text-slate-700 font-bold">{os.codigoOS || '#'+os.id.slice(-6)}</span> — {os.project.nombre}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 items-start">
                        <div className="space-y-6">
                            {/* Mano de Obra Section */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                <h4 className="font-black text-sm text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-3 flex justify-between">
                                    Mano de Obra
                                    <span className="text-indigo-600">{horasTotales} hs totales</span>
                                </h4>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Valor Unitario por Hora ($)</label>
                                    <input 
                                        type="number" min="0" step="10"
                                        value={valorMo} onChange={e => setValorMo(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    />
                                </div>
                                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex justify-between items-center px-4">
                                    <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Subtotal Mano de Obra</span>
                                    <span className="font-black text-indigo-700 text-lg">${formatARS(subtotalMo)}</span>
                                </div>
                            </div>

                            {/* Materiales Section */}
                            {materiales.length > 0 && (
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                    <h4 className="font-black text-sm text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-3">
                                        Materiales
                                    </h4>
                                    <div className="space-y-4">
                                        {materiales.map(m => (
                                            <div key={m.id} className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start sm:items-center text-sm border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                                                <div className="font-bold text-slate-700 flex-1 w-full">{m.material}</div>
                                                <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-between sm:justify-end">
                                                    <div className="text-center font-bold text-slate-500 bg-slate-100 rounded-lg py-1 px-3 min-w-[3rem]">{m.cantidad}</div>
                                                    <div className="relative w-28">
                                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                                        <input 
                                                            type="number" min="0" step="1"
                                                            value={m.precioUnitario} onChange={e => handleMaterialPrice(m.id, e.target.value)}
                                                            className="w-full border border-slate-200 rounded-lg pl-6 pr-2 py-1.5 font-bold text-slate-700 focus:outline-none focus:border-amber-500 transition-colors"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                    <div className="text-right font-black text-amber-600 min-w-[5rem]">
                                                        ${formatARS(m.cantidad * safeNum(m.precioUnitario))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex justify-between items-center px-4 mt-2">
                                        <span className="text-xs font-black text-amber-500 uppercase tracking-widest">Subtotal Materiales</span>
                                        <span className="font-black text-amber-700 text-lg">${formatARS(subtotalMat)}</span>
                                    </div>
                                </div>
                            )}

                            {/* Additional Options */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                <h4 className="font-black text-sm text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-3">
                                    Información Adicional
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Condición de Pago</label>
                                        <select 
                                            value={condicionPago} onChange={e => setCondicionPago(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all"
                                        >
                                            <option value="">Seleccionar...</option>
                                            <option value="Contado">Contado</option>
                                            <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                                            <option value="30 días">30 días</option>
                                            <option value="60 días">60 días</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Observaciones Generales</label>
                                        <textarea 
                                            value={observaciones} onChange={e => setObservaciones(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all min-h-[80px]"
                                            placeholder="Detalles del acuerdo, cuentas, etc..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Summary Panel */}
                        <div className="bg-slate-800 rounded-3xl overflow-hidden shadow-xl sticky top-6">
                            <div className="p-6 space-y-5">
                                <h3 className="text-white font-black text-lg flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-indigo-400" />
                                    Resumen
                                </h3>
                                
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-300 font-medium">Subtotal Inicial</span>
                                        <span className="text-white font-bold">${formatARS(subtotalBruto)}</span>
                                    </div>

                                    {/* Descuento Control */}
                                    <div className="pt-2 border-t border-slate-700/50">
                                        <div className="mb-2">
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={descuentoAplicado}
                                                onClick={() => setDescuentoAplicado(!descuentoAplicado)}
                                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none align-middle mr-2 ${descuentoAplicado ? 'bg-emerald-500' : 'bg-slate-600'}`}
                                            >
                                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${descuentoAplicado ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest align-middle cursor-pointer" onClick={() => setDescuentoAplicado(!descuentoAplicado)}>Aplicar Descuento</span>
                                        </div>
                                        {descuentoAplicado && (
                                            <div className="flex items-center gap-3">
                                                <div className="relative flex-1">
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold"><Percent className="w-3 h-3"/></span>
                                                    <input 
                                                        type="number" min="0" max="100"
                                                        value={descuentoPorcentaje} onChange={e => setDescuentoPorcentaje(e.target.value)}
                                                        className="w-full bg-slate-700 border border-slate-600 rounded-lg py-1.5 pl-3 pr-8 text-white font-bold text-sm outline-none focus:border-emerald-500"
                                                    />
                                                </div>
                                                <span className="text-emerald-400 font-bold text-sm w-20 text-right">-${formatARS(montoDescuento)}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* IVA Control */}
                                    <div className="pt-3 border-t border-slate-700/50">
                                        <div className="flex justify-between items-center w-full">
                                            <div>
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={ivaAplicado}
                                                    onClick={() => setIvaAplicado(!ivaAplicado)}
                                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none align-middle mr-2 ${ivaAplicado ? 'bg-rose-500' : 'bg-slate-600'}`}
                                                >
                                                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${ivaAplicado ? 'translate-x-5' : 'translate-x-0'}`} />
                                                </button>
                                                <span className="text-xs font-bold text-slate-300 uppercase tracking-widest align-middle cursor-pointer" onClick={() => setIvaAplicado(!ivaAplicado)}>Añadir IVA (21%)</span>
                                            </div>
                                            {ivaAplicado && <span className="text-rose-400 font-bold text-sm">+${formatARS(montoIva)}</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-slate-900 p-6">
                                <p className="text-xs text-slate-400 uppercase tracking-widest font-black mb-1">Total a Cobrar</p>
                                <p className="text-3xl font-black text-white">${formatARS(totalFinal)}</p>
                            </div>

                            <div className="p-4 bg-slate-900/50">
                                <button
                                    onClick={handleSaveAndGenerate}
                                    disabled={loading || parsedValorMo < 0}
                                    className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-black py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex flex-col items-center justify-center disabled:opacity-50 active:scale-95 group"
                                >
                                    {loading ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : (
                                        <>
                                            <span className="flex items-center gap-2"><Download className="w-5 h-5"/> Generar Documento</span>
                                            <span className="text-[10px] uppercase font-bold text-indigo-200 mt-1">Guarda e imprime PDF</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
