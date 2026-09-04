'use client';

import React, { useState, useEffect } from 'react';
import { 
    Package, 
    Plus, 
    ArrowDownRight, 
    ArrowUpRight, 
    AlertTriangle, 
    CheckCircle2, 
    Search, 
    Tag, 
    Layers, 
    History, 
    FileText,
    Loader2,
    Edit2,
    SlidersHorizontal,
    X,
    Shield
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import { 
    createEppItem, 
    updateEppItem,
    addEppStock, 
    getEppStockMovements 
} from '@/app/rrhh/personal/epp/actions';

interface EppStockManagerProps {
    items: any[];
    onRefresh: () => void;
}

export default function EppStockManager({ items, onRefresh }: EppStockManagerProps) {
    const [localItems, setLocalItems] = useState<any[]>(items || []);
    const [subTab, setSubTab] = useState<'ITEMS' | 'KARDEX'>('ITEMS');
    const [search, setSearch] = useState('');
    const [movements, setMovements] = useState<any[]>([]);
    const [loadingMovements, setLoadingMovements] = useState(false);

    useEffect(() => {
        if (items) {
            setLocalItems(items);
        }
    }, [items]);

    // Modal Crear Elemento
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [creatingItem, setCreatingItem] = useState(false);
    const [newItemData, setNewItemData] = useState({
        nombre: '',
        codigo: '',
        descripcion: '',
        categoria: 'Cabeza',
        esGlobal: true,
        diasValidez: 365,
        stockActual: 10,
        stockMinimo: 5,
        talle: '',
        marca: '',
        normaCertificacion: 'IRAM'
    });

    // Modal Ingreso de Stock (Compras / Remitos)
    const [stockModalOpen, setStockModalOpen] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState('');
    const [addingStock, setAddingStock] = useState(false);
    const [stockData, setStockData] = useState({
        cantidad: 10,
        remitoFactura: '',
        proveedor: '',
        motivo: 'Compra / Reposición de almacén',
        registradoPor: 'Supervisor'
    });

    // Modal Editar Elemento & Ajuste Manual de Stock
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);
    const [editFormData, setEditFormData] = useState({
        nombre: '',
        codigo: '',
        descripcion: '',
        categoria: 'Cabeza',
        esGlobal: true,
        diasValidez: 365,
        stockMinimo: 5,
        talle: '',
        marca: '',
        normaCertificacion: '',
        activo: true,
        // Campos de ajuste manual de stock auditado
        stockActualOriginal: 0,
        enableStockAdjustment: false,
        nuevoStockManual: 0,
        motivoAjuste: '',
        supervisorAjuste: 'Supervisor de Pañol'
    });

    const categories = [
        'Cabeza', 
        'Protección Ocular', 
        'Auditivo', 
        'Respiratorio', 
        'Manos', 
        'Calzado', 
        'Altura', 
        'Ropa de Trabajo', 
        'Otros'
    ];

    useEffect(() => {
        if (subTab === 'KARDEX') {
            loadMovements();
        }
    }, [subTab]);

    const loadMovements = async () => {
        setLoadingMovements(true);
        try {
            const res = await getEppStockMovements();
            if (res.success) setMovements(res.data || []);
        } finally {
            setLoadingMovements(false);
        }
    };

    const handleCreateItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemData.nombre) {
            showToast('El nombre del elemento es requerido', 'error');
            return;
        }

        setCreatingItem(true);
        try {
            const res = await createEppItem(newItemData);
            if (res.success && res.data) {
                showToast(
                    res.data.esGlobal 
                        ? 'Elemento de EPP Global creado correctamente' 
                        : 'Elemento de EPP Específico creado correctamente', 
                    'success'
                );
                setCreateModalOpen(false);

                // Inserción optimista inmediata en la lista local para visualización instantánea
                setLocalItems(prev => {
                    const filtered = prev.filter(i => i.id !== res.data.id);
                    return [...filtered, res.data].sort((a, b) => {
                        if (a.activo !== b.activo) return a.activo ? -1 : 1;
                        return a.nombre.localeCompare(b.nombre);
                    });
                });

                setNewItemData({
                    nombre: '',
                    codigo: '',
                    descripcion: '',
                    categoria: 'Cabeza',
                    esGlobal: true,
                    diasValidez: 365,
                    stockActual: 10,
                    stockMinimo: 5,
                    talle: '',
                    marca: '',
                    normaCertificacion: 'IRAM'
                });
                await onRefresh();
            } else {
                showToast(res.error || 'Error al crear elemento', 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Error de red', 'error');
        } finally {
            setCreatingItem(false);
        }
    };

    const handleAddStock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItemId) {
            showToast('Seleccione un elemento de EPP', 'error');
            return;
        }

        setAddingStock(true);
        try {
            const res = await addEppStock({
                eppItemId: selectedItemId,
                cantidad: Number(stockData.cantidad),
                remitoFactura: stockData.remitoFactura,
                proveedor: stockData.proveedor,
                motivo: stockData.motivo,
                registradoPor: stockData.registradoPor
            });

            if (res.success && res.data) {
                showToast('Stock ingresado y registrado en Kardex correctamente', 'success');
                setStockModalOpen(false);
                const updatedItem = (res.data as any).item || res.data;
                setLocalItems(prev => prev.map(i => i.id === selectedItemId ? { ...i, stockActual: updatedItem?.stockActual ?? ((i.stockActual || 0) + Number(stockData.cantidad)) } : i));
                setStockData({
                    cantidad: 10,
                    remitoFactura: '',
                    proveedor: '',
                    motivo: 'Compra / Reposición de almacén',
                    registradoPor: 'Supervisor'
                });
                await onRefresh();
                if (subTab === 'KARDEX') loadMovements();
            } else {
                showToast(res.error || 'Error al registrar stock', 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Error de red', 'error');
        } finally {
            setAddingStock(false);
        }
    };

    const handleOpenEdit = (item: any, focusAdjustment = false) => {
        // Extraer usuario de sesión para la auditoría si existe
        let supervisorName = 'Supervisor de Pañol';
        try {
            const storedUser = localStorage.getItem('currentUser');
            if (storedUser) {
                const parsed = JSON.parse(storedUser);
                if (parsed.nombreCompleto) supervisorName = parsed.nombreCompleto;
            }
        } catch (e) {}

        setEditingItemId(item.id);
        setEditFormData({
            nombre: item.nombre || '',
            codigo: item.codigo || '',
            descripcion: item.descripcion || '',
            categoria: item.categoria || 'Cabeza',
            esGlobal: item.esGlobal !== undefined ? Boolean(item.esGlobal) : true,
            diasValidez: item.diasValidez || 365,
            stockMinimo: item.stockMinimo !== undefined ? item.stockMinimo : 5,
            talle: item.talle || '',
            marca: item.marca || '',
            normaCertificacion: item.normaCertificacion || '',
            activo: item.activo !== undefined ? Boolean(item.activo) : true,
            stockActualOriginal: item.stockActual || 0,
            enableStockAdjustment: focusAdjustment,
            nuevoStockManual: item.stockActual || 0,
            motivoAjuste: '',
            supervisorAjuste: supervisorName
        });
        setEditModalOpen(true);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItemId) return;
        if (!editFormData.nombre) {
            showToast('El nombre del elemento es requerido', 'error');
            return;
        }

        if (editFormData.enableStockAdjustment) {
            if (editFormData.nuevoStockManual < 0) {
                showToast('La cantidad de stock no puede ser negativa', 'error');
                return;
            }
            if (editFormData.nuevoStockManual !== editFormData.stockActualOriginal && !editFormData.motivoAjuste.trim()) {
                showToast('Debe ingresar un motivo para auditar el ajuste de stock', 'error');
                return;
            }
        }

        setSavingEdit(true);
        try {
            const payload: any = {
                nombre: editFormData.nombre,
                codigo: editFormData.codigo || undefined,
                descripcion: editFormData.descripcion,
                categoria: editFormData.categoria,
                esGlobal: editFormData.esGlobal,
                diasValidez: Number(editFormData.diasValidez),
                stockMinimo: Number(editFormData.stockMinimo),
                talle: editFormData.talle,
                marca: editFormData.marca,
                normaCertificacion: editFormData.normaCertificacion,
                activo: editFormData.activo
            };

            if (editFormData.enableStockAdjustment && editFormData.nuevoStockManual !== editFormData.stockActualOriginal) {
                payload.ajusteStock = {
                    nuevoStock: Number(editFormData.nuevoStockManual),
                    motivo: editFormData.motivoAjuste.trim(),
                    registradoPor: editFormData.supervisorAjuste
                };
            }

            const res = await updateEppItem(editingItemId, payload);
            if (res.success && res.data) {
                showToast('Elemento de EPP actualizado con éxito', 'success');
                setEditModalOpen(false);
                setLocalItems(prev => prev.map(i => i.id === editingItemId ? { ...i, ...res.data } : i));
                await onRefresh();
                if (subTab === 'KARDEX') loadMovements();
            } else {
                showToast(res.error || 'Error al actualizar elemento', 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Error de red', 'error');
        } finally {
            setSavingEdit(false);
        }
    };

    const filteredItems = localItems.filter(it => 
        it.nombre.toLowerCase().includes(search.toLowerCase()) ||
        (it.codigo && it.codigo.toLowerCase().includes(search.toLowerCase())) ||
        it.categoria.toLowerCase().includes(search.toLowerCase())
    );

    const adjustmentDiff = editFormData.nuevoStockManual - editFormData.stockActualOriginal;

    return (
        <div className="space-y-4">
            {/* Cabecera y Selector de Subpestañas */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSubTab('ITEMS')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            subTab === 'ITEMS'
                                ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                    >
                        <Package className="w-4 h-4" />
                        Catálogo de EPP ({localItems.length})
                    </button>

                    <button
                        onClick={() => setSubTab('KARDEX')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            subTab === 'KARDEX'
                                ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                    >
                        <History className="w-4 h-4" />
                        Kardex de Movimientos
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setSelectedItemId('');
                            setStockModalOpen(true);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                        <ArrowDownRight className="w-4 h-4" />
                        Ingresar Stock (Remito)
                    </button>

                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo Elemento
                    </button>
                </div>
            </div>

            {/* VISTA 1: CATÁLOGO DE ELEMENTOS */}
            {subTab === 'ITEMS' && (
                <div className="space-y-4">
                    <div className="relative w-full max-w-sm">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar en catálogo..."
                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100"
                        />
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-wider">
                                        <th className="p-4">Elemento de EPP</th>
                                        <th className="p-4">Categoría</th>
                                        <th className="p-4 text-center">Tipo</th>
                                        <th className="p-4 text-center">Validez</th>
                                        <th className="p-4 text-center">Stock Disponible</th>
                                        <th className="p-4 text-center">Stock Mínimo</th>
                                        <th className="p-4 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                                    {filteredItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                                                No hay elementos registrados en el catálogo
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredItems.map(item => {
                                            const isLowStock = item.stockActual <= item.stockMinimo;
                                            return (
                                                <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl">
                                                                <Package className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <span className="font-bold text-slate-900 dark:text-slate-100 block">
                                                                    {item.nombre}
                                                                </span>
                                                                <span className="text-[11px] text-slate-400 block">
                                                                    {item.codigo || 'Sin código'} {item.normaCertificacion ? `· ${item.normaCertificacion}` : ''} {item.talle ? `· Talle: ${item.talle}` : ''}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="p-4 font-semibold text-slate-600 dark:text-slate-400">
                                                        {item.categoria}
                                                    </td>

                                                    <td className="p-4 text-center">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                                            item.esGlobal
                                                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                                                : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800'
                                                        }`}>
                                                            {item.esGlobal ? 'Global (Todos)' : 'Específico'}
                                                        </span>
                                                    </td>

                                                    <td className="p-4 text-center font-bold text-slate-700 dark:text-slate-300">
                                                        {item.diasValidez} días
                                                    </td>

                                                    <td className="p-4 text-center">
                                                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-black ${
                                                            isLowStock
                                                                ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse'
                                                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                                        }`}>
                                                            {item.stockActual} u.
                                                            {isLowStock && <AlertTriangle className="w-3 h-3" />}
                                                        </span>
                                                    </td>

                                                    <td className="p-4 text-center text-slate-400 font-medium">
                                                        {item.stockMinimo} u.
                                                    </td>

                                                    <td className="p-4 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            {/* Botón Editar Elemento */}
                                                            <button
                                                                onClick={() => handleOpenEdit(item, false)}
                                                                title="Editar información de EPP"
                                                                className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white rounded-lg text-slate-600 dark:text-slate-300 transition-all"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>

                                                            {/* Botón Ajustar Stock Manual */}
                                                            <button
                                                                onClick={() => handleOpenEdit(item, true)}
                                                                title="Ajuste manual de stock auditado"
                                                                className="px-2 py-1 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-600 hover:text-white rounded-lg text-amber-700 dark:text-amber-300 text-xs font-bold transition-all flex items-center gap-1"
                                                            >
                                                                <SlidersHorizontal className="w-3 h-3" />
                                                                Ajustar
                                                            </button>

                                                            {/* Botón Ingreso de Stock */}
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedItemId(item.id);
                                                                    setStockModalOpen(true);
                                                                }}
                                                                title="Ingreso de mercadería por remito/compra"
                                                                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white rounded-lg text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
                                                            >
                                                                + Stock
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* VISTA 2: KARDEX DE MOVIMIENTOS */}
            {subTab === 'KARDEX' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                    {loadingMovements ? (
                        <div className="p-12 text-center text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                            <span className="text-xs">Cargando movimientos de Kardex...</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 font-black uppercase tracking-wider">
                                        <th className="p-4">Fecha</th>
                                        <th className="p-4">Tipo</th>
                                        <th className="p-4">Elemento de EPP</th>
                                        <th className="p-4 text-center">Cantidad</th>
                                        <th className="p-4 text-center">Stock Resultante</th>
                                        <th className="p-4">Motivo / Auditoría</th>
                                        <th className="p-4">Registrado Por</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                    {movements.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                                                No hay movimientos de stock registrados aún
                                            </td>
                                        </tr>
                                    ) : (
                                        movements.map(mov => {
                                            const isIngreso = mov.tipo === 'INGRESO';
                                            const isAjuste = mov.tipo === 'AJUSTE';
                                            const isEgreso = mov.tipo === 'EGRESO_ENTREGA';

                                            return (
                                                <tr key={mov.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                                    <td className="p-4 font-mono text-slate-500">
                                                        {new Date(mov.createdAt).toLocaleString()}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                                            isIngreso
                                                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                                                : isAjuste
                                                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                                                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                                        }`}>
                                                            {isIngreso && <ArrowDownRight className="w-3 h-3" />}
                                                            {isAjuste && <SlidersHorizontal className="w-3 h-3" />}
                                                            {isEgreso && <ArrowUpRight className="w-3 h-3" />}
                                                            {isIngreso ? 'Ingreso' : isAjuste ? 'Ajuste Manual' : 'Entrega'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 font-bold text-slate-800 dark:text-slate-200">
                                                        {mov.eppItem?.nombre}
                                                    </td>
                                                    <td className={`p-4 text-center font-black ${
                                                        isIngreso ? 'text-emerald-600' : isAjuste ? 'text-amber-600' : 'text-rose-600'
                                                    }`}>
                                                        {isIngreso ? `+${mov.cantidad}` : isAjuste ? `±${mov.cantidad}` : `-${mov.cantidad}`}
                                                    </td>
                                                    <td className="p-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                                                        {mov.stockPosterior} u.
                                                    </td>
                                                    <td className="p-4 text-slate-600 dark:text-slate-400">
                                                        {mov.motivo}
                                                        {mov.remitoFactura && ` · Remito: ${mov.remitoFactura}`}
                                                        {mov.proveedor && ` (${mov.proveedor})`}
                                                    </td>
                                                    <td className="p-4 text-slate-500 font-medium">
                                                        {mov.registradoPor || 'Sistema'}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL 1: CREAR ELEMENTO */}
            {createModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl my-8">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="font-black text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
                                <Package className="w-5 h-5 text-indigo-600" />
                                Registrar Nuevo Elemento de EPP
                            </h3>
                            <button onClick={() => setCreateModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateItem} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                    Nombre del Elemento *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newItemData.nombre}
                                    onChange={(e) => setNewItemData({ ...newItemData, nombre: e.target.value })}
                                    placeholder="Ej: Casco de Seguridad con Barbijo"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                        Código de Catálogo
                                    </label>
                                    <input
                                        type="text"
                                        value={newItemData.codigo}
                                        onChange={(e) => setNewItemData({ ...newItemData, codigo: e.target.value })}
                                        placeholder="Ej: EPP-CASCO-01"
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                        Categoría
                                    </label>
                                    <select
                                        value={newItemData.categoria}
                                        onChange={(e) => setNewItemData({ ...newItemData, categoria: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                                    >
                                        {categories.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Clasificación: Global vs Específico */}
                            <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 rounded-2xl space-y-2">
                                <label className="text-xs font-bold text-indigo-900 dark:text-indigo-200 block">
                                    Clasificación de Asignación
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setNewItemData({ ...newItemData, esGlobal: true })}
                                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                                            newItemData.esGlobal
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                                : 'bg-white dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700'
                                        }`}
                                    >
                                        Global (Se entrega a todos)
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setNewItemData({ ...newItemData, esGlobal: false })}
                                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                                            !newItemData.esGlobal
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                                : 'bg-white dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700'
                                        }`}
                                    >
                                        Específico (Por tarea/rol)
                                    </button>
                                </div>
                                <span className="text-[11px] text-slate-500 block leading-tight">
                                    * Los elementos Globales aparecen como columnas obligatorias en la Matriz General de Operadores.
                                </span>
                            </div>

                            {/* Días de Validez y Stocks */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                        Validez (Días) *
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={newItemData.diasValidez}
                                        onChange={(e) => setNewItemData({ ...newItemData, diasValidez: parseInt(e.target.value) || 365 })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center text-slate-800 dark:text-slate-100"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                        Stock Inicial
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={newItemData.stockActual}
                                        onChange={(e) => setNewItemData({ ...newItemData, stockActual: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center text-slate-800 dark:text-slate-100"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                        Stock Mínimo
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={newItemData.stockMinimo}
                                        onChange={(e) => setNewItemData({ ...newItemData, stockMinimo: parseInt(e.target.value) || 5 })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center text-slate-800 dark:text-slate-100"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                        Norma / Certificación
                                    </label>
                                    <input
                                        type="text"
                                        value={newItemData.normaCertificacion}
                                        onChange={(e) => setNewItemData({ ...newItemData, normaCertificacion: e.target.value })}
                                        placeholder="Ej: IRAM 3620 / ANSI"
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                        Talle / Variante (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={newItemData.talle}
                                        onChange={(e) => setNewItemData({ ...newItemData, talle: e.target.value })}
                                        placeholder="Ej: 42, L, Universal"
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCreateModalOpen(false)}
                                    className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingItem}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                                >
                                    {creatingItem && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Guardar en Catálogo
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: EDITAR ELEMENTO Y AJUSTE MANUAL AUDITADO */}
            {editModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl my-8">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
                            <h3 className="font-black text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
                                <Edit2 className="w-5 h-5 text-indigo-600" />
                                Editar Elemento de EPP
                            </h3>
                            <button onClick={() => setEditModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEdit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                    Nombre del Elemento *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={editFormData.nombre}
                                    onChange={(e) => setEditFormData({ ...editFormData, nombre: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                        Código de Catálogo
                                    </label>
                                    <input
                                        type="text"
                                        value={editFormData.codigo}
                                        onChange={(e) => setEditFormData({ ...editFormData, codigo: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                        Categoría
                                    </label>
                                    <select
                                        value={editFormData.categoria}
                                        onChange={(e) => setEditFormData({ ...editFormData, categoria: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                                    >
                                        {categories.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Clasificación: Global vs Específico */}
                            <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 rounded-2xl space-y-2">
                                <label className="text-xs font-bold text-indigo-900 dark:text-indigo-200 block">
                                    Clasificación de Asignación
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditFormData({ ...editFormData, esGlobal: true })}
                                        className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                                            editFormData.esGlobal
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                                : 'bg-white dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700'
                                        }`}
                                    >
                                        Global (Para todos)
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setEditFormData({ ...editFormData, esGlobal: false })}
                                        className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                                            !editFormData.esGlobal
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                                : 'bg-white dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700'
                                        }`}
                                    >
                                        Específico (Por rol)
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                        Validez (Días) *
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={editFormData.diasValidez}
                                        onChange={(e) => setEditFormData({ ...editFormData, diasValidez: parseInt(e.target.value) || 365 })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center text-slate-800 dark:text-slate-100"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                        Stock Mínimo
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editFormData.stockMinimo}
                                        onChange={(e) => setEditFormData({ ...editFormData, stockMinimo: parseInt(e.target.value) || 5 })}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center text-slate-800 dark:text-slate-100"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                        Norma / Certificación
                                    </label>
                                    <input
                                        type="text"
                                        value={editFormData.normaCertificacion}
                                        onChange={(e) => setEditFormData({ ...editFormData, normaCertificacion: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                        Talle / Variante
                                    </label>
                                    <input
                                        type="text"
                                        value={editFormData.talle}
                                        onChange={(e) => setEditFormData({ ...editFormData, talle: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                                    />
                                </div>
                            </div>

                            {/* SECCIÓN ESPECIAL: AJUSTE MANUAL DE STOCK AUDITADO */}
                            <div className="p-4 bg-amber-50/60 dark:bg-amber-950/30 border-2 border-amber-400/60 dark:border-amber-700/60 rounded-2xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <SlidersHorizontal className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                        <span className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                                            Ajuste Manual de Stock (Auditoría ISO)
                                        </span>
                                    </div>

                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editFormData.enableStockAdjustment}
                                            onChange={(e) => setEditFormData({ ...editFormData, enableStockAdjustment: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                                    <span>Stock Registrado en Sistema:</span>
                                    <strong className="text-slate-900 dark:text-slate-100 font-bold text-sm">
                                        {editFormData.stockActualOriginal} unidades
                                    </strong>
                                </div>

                                {editFormData.enableStockAdjustment && (
                                    <div className="space-y-3 pt-2 border-t border-amber-300 dark:border-amber-800/60 animate-in fade-in">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                                    Nuevo Stock Físico *
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    required
                                                    value={editFormData.nuevoStockManual}
                                                    onChange={(e) => setEditFormData({ ...editFormData, nuevoStockManual: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-black text-center text-slate-900 dark:text-slate-100"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                                    Diferencial resultante
                                                </label>
                                                <div className={`px-3 py-2 rounded-xl text-xs font-black text-center border ${
                                                    adjustmentDiff === 0 
                                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200' 
                                                        : adjustmentDiff > 0 
                                                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300' 
                                                        : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300'
                                                }`}>
                                                    {adjustmentDiff === 0 ? 'Sin cambios' : adjustmentDiff > 0 ? `+${adjustmentDiff} (Sobrante)` : `${adjustmentDiff} (Merma/Faltante)`}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                                Motivo / Justificación del Ajuste (Obligatorio) *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={editFormData.motivoAjuste}
                                                onChange={(e) => setEditFormData({ ...editFormData, motivoAjuste: e.target.value })}
                                                placeholder="Ej: Recuento físico de inventario / Descarte por rotura"
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                                Supervisor / Auditor Responsable
                                            </label>
                                            <input
                                                type="text"
                                                value={editFormData.supervisorAjuste}
                                                onChange={(e) => setEditFormData({ ...editFormData, supervisorAjuste: e.target.value })}
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200"
                                            />
                                        </div>

                                        <p className="text-[10px] text-amber-800 dark:text-amber-300">
                                            * Esta modificación quedará registrada de forma permanente en el Kardex y en el log de auditoría del sistema.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditModalOpen(false)}
                                    className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingEdit}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                                >
                                    {savingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: INGRESO DE STOCK POR REMITO */}
            {stockModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl my-8">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="font-black text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
                                <ArrowDownRight className="w-5 h-5 text-emerald-600" />
                                Registrar Ingreso de Stock
                            </h3>
                            <button onClick={() => setStockModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAddStock} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                    Elemento de EPP *
                                </label>
                                <select
                                    required
                                    value={selectedItemId}
                                    onChange={(e) => setSelectedItemId(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100"
                                >
                                    <option value="">-- Seleccione elemento --</option>
                                    {localItems.map(it => (
                                        <option key={it.id} value={it.id}>
                                            {it.nombre} (Stock actual: {it.stockActual})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                        Cantidad a Ingresar *
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={stockData.cantidad}
                                        onChange={(e) => setStockData({ ...stockData, cantidad: parseInt(e.target.value) || 1 })}
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-center text-slate-800 dark:text-slate-100"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                        N° Remito / Factura
                                    </label>
                                    <input
                                        type="text"
                                        value={stockData.remitoFactura}
                                        onChange={(e) => setStockData({ ...stockData, remitoFactura: e.target.value })}
                                        placeholder="Ej: R-0001-00045"
                                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                    Proveedor / Origen
                                </label>
                                <input
                                    type="text"
                                    value={stockData.proveedor}
                                    onChange={(e) => setStockData({ ...stockData, proveedor: e.target.value })}
                                    placeholder="Ej: Seguridad Industrial SRL"
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                                    Motivo / Observaciones
                                </label>
                                <input
                                    type="text"
                                    value={stockData.motivo}
                                    onChange={(e) => setStockData({ ...stockData, motivo: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                                />
                            </div>

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setStockModalOpen(false)}
                                    className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={addingStock}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                                >
                                    {addingStock && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Confirmar Ingreso
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
