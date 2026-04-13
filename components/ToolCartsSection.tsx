'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit2, Save, X, Wrench, ScanLine } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';
import { QRCodeCanvas } from 'qrcode.react';

interface ToolCartItem {
    nombre: string;
    cantidad: number;
}

interface ToolCart {
    id: string;
    nombre: string;
    descripcion: string | null;
    estado: string;
    items: ToolCartItem[];
}

export default function ToolCartsSection() {
    const [carts, setCarts] = useState<ToolCart[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [deletingCart, setDeletingCart] = useState<ToolCart | null>(null);
    
    const [formData, setFormData] = useState<{ id?: string, nombre: string, descripcion: string, items: ToolCartItem[] }>({
        nombre: '',
        descripcion: '',
        items: []
    });
    
    // QR Modal
    const [qrCart, setQrCart] = useState<ToolCart | null>(null);
    const qrRef = useRef<HTMLDivElement>(null);

    const loadCarts = async () => {
        setIsLoading(true);
        try {
            const res = await safeApiRequest('/api/carros');
            if (res.ok) setCarts(await res.json());
        } catch (e) {
            console.error('Failed to load tool carts');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadCarts();
    }, []);

    const resetForm = () => {
        setFormData({ nombre: '', descripcion: '', items: [] });
        setIsEditing(false);
    };

    const handleEdit = (cart: ToolCart) => {
        setFormData({
            id: cart.id,
            nombre: cart.nombre,
            descripcion: cart.descripcion || '',
            items: cart.items.map(i => ({ nombre: i.nombre, cantidad: i.cantidad || 1 }))
        });
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!formData.nombre.trim()) {
            showToast('El nombre es obligatorio', 'error');
            return;
        }
        if (formData.items.length === 0) {
            showToast('Debe agregar al menos una herramienta al carro', 'error');
            return;
        }

        try {
            const url = formData.id ? `/api/carros/${formData.id}` : '/api/carros';
            const method = formData.id ? 'PUT' : 'POST';

            const res = await safeApiRequest(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const error = await res.json();
                showToast(error.error || 'Generó un error', 'error');
                return;
            }

            showToast(formData.id ? 'Carro actualizado' : 'Carro creado', 'success');
            resetForm();
            loadCarts();
        } catch (e) {
            showToast('Fallo la conexión', 'error');
        }
    };

    const confirmDelete = async (id: string) => {
        try {
            const res = await safeApiRequest(`/api/carros/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const error = await res.json();
                showToast(error.error || 'No se puede eliminar', 'error');
                return;
            }
            showToast('Carro eliminado', 'success');
            loadCarts();
        } catch (e) {
            showToast('Fallo la conexión', 'error');
        }
    };

    const handlePrintQr = () => {
        if (!qrRef.current || !qrCart) return;
        const canvas = qrRef.current.querySelector('canvas');
        if (!canvas) return;
        const qrDataUrl = canvas.toDataURL('image/png');
        const printWindow = window.open('', '', 'width=700,height=400');
        if (printWindow) {
            printWindow.document.write(`
                <html><head><title>QR - ${qrCart.nombre}</title>
                <style>
                    @page { size: landscape; margin: 0; }
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        height: 100vh; 
                        background: #fff;
                        font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    }
                    .tarjetero {
                        width: 100mm;
                        height: 60mm;
                        border: 1px solid #eee;
                        display: flex;
                        align-items: center;
                        padding: 5mm;
                        gap: 8mm;
                        overflow: hidden;
                    }
                    .qr-container {
                        flex-shrink: 0;
                        display: flex;
                        align-items: center;
                    }
                    .qr-container img {
                        width: 45mm;
                        height: 45mm;
                    }
                    .info {
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        border-left: 2px solid #f1f5f9;
                        padding-left: 6mm;
                        height: 40mm;
                    }
                    .info h2 {
                        font-size: 24px;
                        font-weight: 900;
                        color: #0f172a;
                        text-transform: uppercase;
                        line-height: 1.1;
                        margin-bottom: 4px;
                        max-width: 40mm;
                        word-wrap: break-word;
                    }
                    .info .label {
                        font-size: 10px;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 1.5px;
                        font-weight: 800;
                        margin-bottom: 8px;
                    }
                    .info .id {
                        font-size: 11px;
                        color: #94a3b8;
                        font-family: 'Courier New', Courier, monospace;
                        font-weight: bold;
                        background: #f8fafc;
                        padding: 4px 8px;
                        border-radius: 4px;
                    }
                </style>
                </head><body>
                <div class="tarjetero">
                    <div class="qr-container">
                        <img src="${qrDataUrl}" alt="QR" />
                    </div>
                    <div class="info">
                        <div class="label">Carro de Herramientas</div>
                        <h2>${qrCart.nombre}</h2>
                        <div class="id">ID: ${qrCart.id}</div>
                    </div>
                </div>
                <script>window.onload = function() { window.print(); window.close(); }<\/script>
                </body></html>
            `);
            printWindow.document.close();
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl">
                        <Wrench className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Gestión de Carros de Herramientas</h3>
                        <p className="text-sm text-slate-500">Registra carros, herramientas y genera QRs.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Formulario */}
                    <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <h4 className="font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                            {isEditing ? 'Editar Carro' : 'Nuevo Carro'}
                            {isEditing && (
                                <button onClick={resetForm} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 uppercase tracking-widest font-black">
                                    <X className="w-3 h-3" /> Cancelar
                                </button>
                            )}
                        </h4>
                        
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Nombre / Identificador</label>
                            <input 
                                type="text"
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                                placeholder="Ej: Mecánica A, Carro Soldadura 1"
                                value={formData.nombre}
                                onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Descripción (Opcional)</label>
                            <input 
                                type="text"
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                                value={formData.descripcion}
                                onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                            />
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Herramientas del Carro</label>
                            <div className="space-y-2 mb-3">
                                {formData.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <input 
                                            type="text"
                                            className="flex-1 bg-transparent text-sm font-bold outline-none min-w-0"
                                            value={item.nombre}
                                            onChange={e => {
                                                const newItems = [...formData.items];
                                                newItems[idx].nombre = e.target.value;
                                                setFormData({ ...formData, items: newItems });
                                            }}
                                            placeholder="Nombre herramienta"
                                        />
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cant.</label>
                                            <input 
                                                type="number"
                                                min={1}
                                                className="w-14 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm font-bold text-center outline-none focus:ring-1 focus:ring-primary"
                                                value={item.cantidad}
                                                onChange={e => {
                                                    const newItems = [...formData.items];
                                                    newItems[idx].cantidad = Math.max(1, parseInt(e.target.value) || 1);
                                                    setFormData({ ...formData, items: newItems });
                                                }}
                                            />
                                        </div>
                                        <button 
                                            onClick={() => setFormData({ ...formData, items: formData.items.filter((_, i) => i !== idx) })}
                                            className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button 
                                    onClick={() => setFormData({ ...formData, items: [...formData.items, { nombre: '', cantidad: 1 }] })}
                                    className="w-full py-2 flex items-center justify-center gap-2 text-xs font-black text-primary border-2 border-dashed border-primary/20 hover:border-primary/50 rounded-xl transition-colors uppercase tracking-widest"
                                >
                                    <Plus className="w-4 h-4" /> Agregar Herramienta
                                </button>
                            </div>
                        </div>

                        <button 
                            onClick={handleSave}
                            className="w-full py-3 bg-primary text-white rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
                        >
                            <Save className="w-4 h-4" /> {isEditing ? 'Guardar Cambios' : 'Crear Carro'}
                        </button>
                    </div>

                    {/* Listado */}
                    <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                        {isLoading ? (
                            <p className="text-sm text-slate-400 font-bold p-4 text-center">Cargando...</p>
                        ) : carts.length === 0 ? (
                            <div className="text-center p-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                                <p className="text-sm font-bold text-slate-500">No hay carros registrados.</p>
                            </div>
                        ) : (
                            carts.map(cart => (
                                <div key={cart.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col gap-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h5 className="font-black text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2">
                                                {cart.nombre}
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest ${cart.estado === 'DISPONIBLE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {cart.estado}
                                                </span>
                                            </h5>
                                            {cart.descripcion && <p className="text-xs text-slate-500 font-medium">{cart.descripcion}</p>}
                                        </div>
                                        <div className="flex gap-1.5 bg-slate-50 dark:bg-slate-700 p-1 rounded-xl">
                                            <button onClick={() => setQrCart(cart)} className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Generar QR">
                                                <ScanLine className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleEdit(cart)} className="p-2 text-slate-600 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setDeletingCart(cart)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {cart.items.map(item => (
                                            <span key={item.nombre} className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                                {item.nombre} ×{item.cantidad || 1}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">
                                        ID: {cart.id}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Modal para ver QR */}
            {qrCart && (
                <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setQrCart(null)}>
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="text-center mb-6">
                            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{qrCart.nombre}</h3>
                            <p className="text-sm font-bold text-slate-500 mt-1">Código QR de Escaneo</p>
                        </div>
                        
                        <div className="flex justify-center bg-white p-4 rounded-xl border-2 border-dashed border-slate-200 mb-6" ref={qrRef}>
                            <QRCodeCanvas 
                                value={`TOOLCART:${qrCart.id}`}
                                size={200}
                                level="H"
                                includeMargin={true}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setQrCart(null)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
                                Cerrar
                            </button>
                            <button onClick={handlePrintQr} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors">
                                Imprimir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de confirmación de eliminación */}
            <ConfirmDialog 
                isOpen={deletingCart !== null}
                title="Eliminar Carro" 
                message={`¿Seguro que deseas eliminar el carro ${deletingCart?.nombre}?`} 
                onConfirm={() => {
                    if (deletingCart) confirmDelete(deletingCart.id);
                    setDeletingCart(null);
                }}
                onCancel={() => setDeletingCart(null)}
                confirmLabel="Eliminar"
            />
        </div>
    );
}
