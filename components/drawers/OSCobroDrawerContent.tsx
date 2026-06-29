'use client';

import { useState, useEffect } from 'react';
import { X, FileText, Download, Calculator, Percent, Loader2, FileSpreadsheet, Plus, Trash2, AlertCircle } from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';
import * as XLSX from 'xlsx';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export default function OSCobroDrawerContent({ id, onClose }: { id: string, onClose: () => void }) {
    const [os, setOs] = useState<any>(null);
    const [loadingOS, setLoadingOS] = useState(true);
    const [errorOS, setErrorOS] = useState<string | null>(null);

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Cobro state
    const [valorMo, setValorMo] = useState<number | string>('');
    const [materiales, setMateriales] = useState<any[]>([]);
    const [descuentoAplicado, setDescuentoAplicado] = useState(false);
    const [descuentoPorcentaje, setDescuentoPorcentaje] = useState<number | string>('');
    const [ivaAplicado, setIvaAplicado] = useState<boolean>(true);
    const [observaciones, setObservaciones] = useState('');
    const [condicionPago, setCondicionPago] = useState('');
    const [otrosConceptos, setOtrosConceptos] = useState<{ id: string, nombre: string, precio: number | string }[]>([]);
    const [loading, setLoading] = useState(false);

    const formatARS = (num: number) => num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const safeNum = (val: string | number) => {
        const p = typeof val === 'string' ? parseFloat(val) : val;
        return isNaN(p) ? 0 : p;
    };
    const roundTo2 = (num: number) => Math.round(num * 100) / 100;

    // Fetch OS
    useEffect(() => {
        let mounted = true;
        setLoadingOS(true);
        safeApiRequest(`/api/ordenes-servicio/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('OS no encontrada');
                return res.json();
            })
            .then(data => {
                if (mounted) {
                    setOs(data);
                    
                    // Initialize state from OS
                    const defaultMO = data.cobroValorManoObra ?? 0;
                    setValorMo(defaultMO === 0 ? '' : roundTo2(Number(defaultMO)));
                    
                    setMateriales(data.materiales.map((m: any) => ({
                        id: m.id,
                        material: m.material,
                        codigo: m.codigo,
                        cantidad: m.cantidad,
                        precioUnitario: m.precioUnitario !== null && m.precioUnitario !== undefined ? roundTo2(Number(m.precioUnitario)) : '',
                    })));

                    setDescuentoAplicado(data.cobroDescuentoPorcentaje !== null && data.cobroDescuentoPorcentaje !== undefined);
                    setDescuentoPorcentaje(data.cobroDescuentoPorcentaje || '');
                    setIvaAplicado(data.cobroAplicarIva ?? true);
                    setObservaciones(data.cobroObservaciones || '');
                    setCondicionPago(data.cobroCondicionPago || '');
                    setOtrosConceptos(
                        Array.isArray(data.cobroOtrosConceptos) 
                            ? data.cobroOtrosConceptos.map((c: any) => ({ ...c, id: Math.random().toString() })) 
                            : []
                    );

                    // Fetch Config and Inventory if not generated yet
                    if (!data.cobroGenerado) {
                        safeApiRequest('/api/config/system')
                            .then(res => res.json())
                            .then(config => {
                                if (config?.valorManoObra && defaultMO === 0 && mounted) setValorMo(roundTo2(Number(config.valorManoObra)));
                            }).catch(() => {});
                        
                        safeApiRequest('/api/inventario')
                            .then(res => res.json())
                            .then(inventario => {
                                if (Array.isArray(inventario) && mounted) {
                                    setMateriales(prev => prev.map(m => {
                                        if (m.precioUnitario === '') {
                                            const invItem = inventario.find((i: any) => {
                                                if (m.codigo && i.codigo) {
                                                    const c1 = m.codigo.replace(/^0+/, '').toLowerCase().trim();
                                                    const c2 = i.codigo.replace(/^0+/, '').toLowerCase().trim();
                                                    if (c1 && c1 === c2) return true;
                                                }
                                                if (m.material && i.nombre) {
                                                    return m.material.toLowerCase().trim() === i.nombre.toLowerCase().trim();
                                                }
                                                return false;
                                            });
                                            if (invItem && invItem.precioVenta != null) {
                                                return { ...m, precioUnitario: roundTo2(Number(invItem.precioVenta)) };
                                            }
                                        }
                                        return m;
                                    }));
                                }
                            }).catch(() => {});
                    }
                }
            })
            .catch(err => {
                if (mounted) setErrorOS(err.message);
            })
            .finally(() => {
                if (mounted) setLoadingOS(false);
            });
        
        return () => { mounted = false; };
    }, [id]);

    if (loadingOS) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p>Cargando información para generar cobro...</p>
            </div>
        );
    }

    if (errorOS || !os) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-rose-500">
                <AlertCircle className="w-8 h-8 mb-4" />
                <p className="font-bold">{errorOS || 'No se pudo cargar la orden'}</p>
            </div>
        );
    }

    const handleMaterialPrice = (mId: string, price: number | string) => {
        setMateriales(prev => prev.map(m => m.id === mId ? { ...m, precioUnitario: price } : m));
    };

    const horasNormales = os.operadores.filter((op: any) => !op.isExtra).reduce((acc: number, op: any) => acc + (op.horas || 0), 0);
    const horasExtras = os.operadores.filter((op: any) => op.isExtra).reduce((acc: number, op: any) => acc + (op.horas || 0), 0);
    
    const parsedValorMo = safeNum(valorMo);
    const subtotalMo = (horasNormales + (horasExtras * 2)) * parsedValorMo;
    const subtotalMat = materiales.reduce((acc, m) => acc + (m.cantidad * safeNum(m.precioUnitario)), 0);
    const subtotalOtros = otrosConceptos.reduce((acc, oc) => acc + safeNum(oc.precio), 0);
    const subtotalBruto = roundTo2(subtotalMo + subtotalMat + subtotalOtros);
    
    const parsedDescuento = safeNum(descuentoPorcentaje);
    const montoDescuento = roundTo2(descuentoAplicado ? (subtotalBruto * (parsedDescuento / 100)) : 0);
    const subtotalConDescuento = roundTo2(subtotalBruto - montoDescuento);
    const montoIva = roundTo2(ivaAplicado ? (subtotalConDescuento * 0.21) : 0);
    const totalFinal = roundTo2(subtotalConDescuento + montoIva);

    const handleExportExcel = () => {
        if (materiales.some(m => m.precioUnitario === '' || m.precioUnitario === null || m.precioUnitario === undefined)) {
            return showToast('Faltan cargar precios a los materiales', 'error');
        }
        if (materiales.some(m => safeNum(m.precioUnitario) < 0)) return showToast('Precios de materiales inválidos', 'error');
        if (parsedValorMo < 0) return showToast('Valor MO inválido', 'error');

        const currencyCell = (val: number) => ({ t: 'n', v: val, z: '"$"#,##0.00' });
        const quantityCell = (val: number) => ({ t: 'n', v: val, z: '#,##0' });
        const hoursCell = (val: number) => ({ t: 'n', v: val, z: '0.00' });

        const aoa: any[][] = [
            ['ORDEN DE COBRO'],
            ['HDB - Job Planner'],
            [],
            ['Código OS', os.codigoOS || '#' + os.id.slice(-6)],
            ['Proyecto', os.project.nombre],
            ['Cliente', os.project.client?.nombre || os.project.cliente || 'Sin cliente'],
            ['Condición de Pago', condicionPago || '-'],
            ['Fecha Generación', new Date().toLocaleDateString('es-AR')],
            ['Observaciones', observaciones || '-'],
            [],
            ['DETALLE DE MANO DE OBRA'],
            ['Concepto', 'Horas / Cantidad', 'Valor Unitario', 'Subtotal'],
            ['Horas Normales', hoursCell(horasNormales), currencyCell(parsedValorMo), currencyCell(horasNormales * parsedValorMo)],
            ['Horas Extras (Recargo x2)', hoursCell(horasExtras * 2), currencyCell(parsedValorMo), currencyCell(horasExtras * 2 * parsedValorMo)],
            ['Subtotal Mano de Obra', '', '', currencyCell(subtotalMo)],
            [],
            ['DETALLE DE MATERIALES'],
            ['Código', 'Material', 'Cantidad', 'Precio Unitario', 'Subtotal']
        ];

        materiales.forEach(m => {
            aoa.push([
                m.codigo || '-',
                m.material,
                quantityCell(m.cantidad),
                currencyCell(safeNum(m.precioUnitario)),
                currencyCell(m.cantidad * safeNum(m.precioUnitario))
            ]);
        });

        aoa.push(
            ['Subtotal Materiales', '', '', '', currencyCell(subtotalMat)],
            []
        );

        if (otrosConceptos.length > 0) {
            aoa.push(['GASTOS OPERATIVOS']);
            aoa.push(['Concepto', '', '', '', 'Subtotal']);
            otrosConceptos.forEach(oc => {
                aoa.push([
                    oc.nombre || 'Concepto sin nombre', '', '', '', currencyCell(safeNum(oc.precio))
                ]);
            });
            aoa.push(
                ['Subtotal Gastos Operativos', '', '', '', currencyCell(subtotalOtros)],
                []
            );
        }

        aoa.push(
            ['RESUMEN DE TOTALES'],
            ['Subtotal Bruto', '', '', '', currencyCell(subtotalBruto)],
            [`Descuento (${descuentoAplicado ? parsedDescuento : 0}%)`, '', '', '', currencyCell(-montoDescuento)],
            [`IVA (${ivaAplicado ? '21' : '0'}%)`, '', '', '', currencyCell(ivaAplicado ? montoIva : 0)],
            ['TOTAL FINAL', '', '', '', currencyCell(totalFinal)]
        );

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        
        ws['!cols'] = [
            { wch: 25 },
            { wch: 30 },
            { wch: 18 },
            { wch: 18 },
            { wch: 18 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Orden de Cobro');
        
        const osCode = os.codigoOS || 'OS-' + os.id.slice(-6);
        XLSX.writeFile(wb, `Cobro_${osCode}.xlsx`);
    };

    const handleSaveAndGenerate = async () => {
        if (materiales.some(m => m.precioUnitario === '' || m.precioUnitario === null || m.precioUnitario === undefined)) {
            return showToast('Faltan cargar precios a los materiales', 'error');
        }
        if (materiales.some(m => safeNum(m.precioUnitario) < 0)) return showToast('Precios de materiales inválidos', 'error');
        if (otrosConceptos.some(oc => !oc.nombre.trim() || oc.precio === '' || safeNum(oc.precio) < 0)) return showToast('Conceptos adicionales incompletos o con precio inválido', 'error');
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
                otrosConceptos: otrosConceptos.map(oc => ({ nombre: oc.nombre, precio: safeNum(oc.precio) })),
                materiales: materiales.map(m => ({ id: m.id, precioUnitario: safeNum(m.precioUnitario) }))
            };

            const res = await safeApiRequest(`/api/ordenes-servicio/${os.id}/cobro`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) throw new Error('Failed to save');
            
            showToast('Cobro guardado con éxito', 'success');

            // Generate PDF using the new server-side API (works on mobile)
            window.open(`/api/ordenes-servicio/${os.id}/cobro/pdf`, '_blank');
            
            // Navigate back to the table
            onClose();

        } catch (e) {
            showToast('Error al procesar cobro', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background animate-in fade-in duration-200">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-card text-card-foreground shrink-0">
                <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-indigo-600" />
                        Generar Documento de Cobro
                    </h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        OS: <span className="text-slate-700 dark:text-slate-200 font-bold">{os.codigoOS || '#'+os.id.slice(-6)}</span> — {os.project.nombre}
                    </p>
                </div>
                <button onClick={onClose} className="p-2 -mr-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors shrink-0">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 items-start max-w-7xl mx-auto">
                    <div className="space-y-6">
                        {/* Mano de Obra Section */}
                        <div className="bg-card text-card-foreground p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                            <h4 className="font-black text-sm text-slate-800 dark:text-slate-100 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-col gap-1">
                                <div className="flex justify-between w-full">
                                    Mano de Obra
                                    <span className="text-slate-400 dark:text-slate-500">Total: {horasNormales + horasExtras} hs</span>
                                </div>
                                <div className="flex justify-between w-full text-[10px] lowercase items-center">
                                    <span className="text-slate-400 dark:text-slate-500 font-bold">{horasNormales} hs normales + {horasExtras} hs extras (x2)</span>
                                    <span className="text-indigo-400 font-black">{horasNormales + (horasExtras * 2)} hs facturables</span>
                                </div>
                            </h4>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Valor Unitario por Hora ($)</label>
                                <input 
                                    type="number" min="0" step="10"
                                    value={valorMo} onChange={e => setValorMo(e.target.value)}
                                    className="w-full bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                />
                            </div>
                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex justify-between items-center px-4">
                                <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Subtotal Mano de Obra</span>
                                <span className="font-black text-indigo-700 text-lg">${formatARS(subtotalMo)}</span>
                            </div>
                        </div>

                        {/* Materiales Section */}
                        {materiales.length > 0 && (
                            <div className="bg-card text-card-foreground p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                                <h4 className="font-black text-sm text-slate-800 dark:text-slate-100 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-3">
                                    Materiales
                                </h4>
                                <div className="space-y-4">
                                    {materiales.map(m => (
                                        <div key={m.id} className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start sm:items-center text-sm border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                                            <div className="flex-1 w-full">
                                                <div className="font-bold text-slate-700 dark:text-slate-200">{m.material}</div>
                                                {m.codigo && <div className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">{m.codigo}</div>}
                                            </div>
                                            <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-between sm:justify-end">
                                                <div className="text-center font-bold text-slate-500 dark:text-slate-400 bg-muted text-muted-foreground/50 rounded-lg py-1 px-3 min-w-[3rem]">{m.cantidad}</div>
                                                <div className="relative w-28">
                                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold">$</span>
                                                    <input 
                                                        type="number" min="0" step="0.01"
                                                        value={m.precioUnitario} onChange={e => handleMaterialPrice(m.id, e.target.value)}
                                                        onBlur={e => e.target.value && handleMaterialPrice(m.id, roundTo2(Number(e.target.value)))}
                                                        className="w-full border border-slate-200 dark:border-slate-700 rounded-lg pl-6 pr-2 py-1.5 font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
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

                        {/* Gastos Operativos Section */}
                        <div className="bg-card text-card-foreground p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                                <h4 className="font-black text-sm text-slate-800 dark:text-slate-100 uppercase tracking-widest">
                                    Gastos Operativos
                                </h4>
                                <button 
                                    type="button" 
                                    onClick={() => setOtrosConceptos(prev => [...prev, { id: Math.random().toString(), nombre: '', precio: '' }])}
                                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Agregar Concepto
                                </button>
                            </div>
                            
                            {otrosConceptos.length > 0 ? (
                                <div className="space-y-4">
                                    {otrosConceptos.map((concepto, index) => (
                                        <div key={concepto.id} className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start sm:items-center text-sm border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                                            <div className="flex-1 w-full">
                                                <input
                                                    type="text"
                                                    value={concepto.nombre}
                                                    onChange={e => setOtrosConceptos(prev => prev.map(c => c.id === concepto.id ? { ...c, nombre: e.target.value } : c))}
                                                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                                                    placeholder="Ej: Viáticos, Combustible, etc..."
                                                />
                                            </div>
                                            <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-between sm:justify-end">
                                                <div className="relative w-28">
                                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold">$</span>
                                                    <input 
                                                        type="number" min="0" step="1"
                                                        value={concepto.precio}
                                                        onChange={e => setOtrosConceptos(prev => prev.map(c => c.id === concepto.id ? { ...c, precio: e.target.value } : c))}
                                                        className="w-full border border-slate-200 dark:border-slate-700 rounded-lg pl-6 pr-2 py-1.5 font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => setOtrosConceptos(prev => prev.filter(c => c.id !== concepto.id))}
                                                    className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4 text-slate-400 text-xs font-bold">
                                    No hay conceptos adicionales
                                </div>
                            )}
                            
                            {otrosConceptos.length > 0 && (
                                <div className="bg-background text-foreground border border-slate-100 dark:border-slate-700 rounded-xl p-3 flex justify-between items-center px-4 mt-2">
                                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Subtotal Otros Gastos</span>
                                    <span className="font-black text-slate-700 dark:text-slate-200 text-lg">${formatARS(subtotalOtros)}</span>
                                </div>
                            )}
                        </div>

                        {/* Additional Options */}
                        <div className="bg-card text-card-foreground p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                            <h4 className="font-black text-sm text-slate-800 dark:text-slate-100 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-3">
                                Información Adicional
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Condición de Pago</label>
                                    <select 
                                        value={condicionPago} onChange={e => setCondicionPago(e.target.value)}
                                        className="w-full bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all"
                                    >
                                        <option value="">Seleccionar...</option>
                                        <option value="Contado">Contado</option>
                                        <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                                        <option value="30 días">30 días</option>
                                        <option value="60 días">60 días</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Observaciones Generales</label>
                                    <textarea 
                                        value={observaciones} onChange={e => setObservaciones(e.target.value)}
                                        className="w-full bg-background text-foreground/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 font-medium text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all min-h-[80px]"
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
                                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-card text-card-foreground shadow ring-0 transition duration-200 ease-in-out ${descuentoAplicado ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                        <span className="text-xs font-bold text-slate-300 uppercase tracking-widest align-middle cursor-pointer" onClick={() => setDescuentoAplicado(!descuentoAplicado)}>Aplicar Descuento</span>
                                    </div>
                                    {descuentoAplicado && (
                                        <div className="flex items-center gap-3">
                                            <div className="relative flex-1">
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold"><Percent className="w-3 h-3"/></span>
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
                                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-card text-card-foreground shadow ring-0 transition duration-200 ease-in-out ${ivaAplicado ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest align-middle cursor-pointer" onClick={() => setIvaAplicado(!ivaAplicado)}>Añadir IVA (21%)</span>
                                        </div>
                                        {ivaAplicado && <span className="text-rose-400 font-bold text-sm">+${formatARS(montoIva)}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-slate-900 p-6">
                            <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest font-black mb-1">Total a Cobrar</p>
                            <p className="text-3xl font-black text-white">${formatARS(totalFinal)}</p>
                        </div>

                        <div className="p-4 bg-slate-900/50 space-y-2">
                            <button
                                onClick={handleExportExcel}
                                type="button"
                                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 text-sm"
                            >
                                <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-400" /> Exportar a Excel
                            </button>
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
    );
}
