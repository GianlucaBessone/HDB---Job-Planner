'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    ArrowLeft, Clock, Plus, Trash2, FileSignature, AlertCircle,
    Package, FileText, CheckCircle2, Loader2, MessageSquare,
    Search, Tag, Layers, Hash
} from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';
import { MaterialSearchSelector, MaterialOption } from '@/components/os/MaterialSearchSelector';

const UNIDADES = ['Unidad', 'Metro', 'Kg', 'Litro', 'Otro'];

interface Operator {
    id: string;
    nombreCompleto: string;
    role?: string;
}

interface TimeEntryGroup {
    operadorId: string;
    nombreCompleto: string;
    totalHoras: number;
    isExtra: boolean;
}

interface MaterialRow {
    id?: string;
    productoId?: string | null;
    material: string;
    codigo?: string;
    skuProveedor?: string | null;
    cantidad: string;
    unidadMedida: string;
    costoUnitario?: number | null;
    precioUnitario?: number | string | null;
    esManual?: boolean;
    materialProyectoId?: string | null;
    disponible?: number;
    entregada?: number;
}

interface OperadorRow {
    operadorId: string;
    nombreCompleto: string;
    horas: string;
    isExtra: boolean;
}

function GenerarOSContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const projectId = searchParams.get('projectId') || '';
    const editId = searchParams.get('editId') || null;

    const [project, setProject] = useState<any>(null);
    const [operators, setOperators] = useState<Operator[]>([]);
    const [existingHoras, setExistingHoras] = useState<TimeEntryGroup[]>([]);
    const [listasPrecios, setListasPrecios] = useState<any[]>([]);
    const [selectedListaPrecioId, setSelectedListaPrecioId] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isFirmada, setIsFirmada] = useState(false);
    const [isSearchSelectorOpen, setIsSearchSelectorOpen] = useState(false);

    // Form state
    const [reporte, setReporte] = useState('');
    const [comentario, setComentario] = useState('');
    const [materiales, setMateriales] = useState<MaterialRow[]>([]);
    const [operadores, setOperadores] = useState<OperadorRow[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!projectId) return;
        loadData();
    }, [projectId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const promises: any[] = [
                safeApiRequest(`/api/projects/${projectId}`),
                safeApiRequest('/api/operators'),
                safeApiRequest(`/api/time-entries?projectId=${projectId}`),
                safeApiRequest('/api/ventas/listas-precios'),
            ];
            if (editId) promises.push(safeApiRequest(`/api/ordenes-servicio/${editId}`));

            const responses = await Promise.all(promises);
            const projectData = await responses[0].json();
            const operatorsData = await responses[1].json();
            const entriesData = await responses[2].json();
            const listasData = await responses[3].json().catch(() => []);

            setProject(projectData);
            setOperators(operatorsData.filter((o: Operator) => o.role !== 'admin'));
            setListasPrecios(Array.isArray(listasData) ? listasData : []);

            let defaultOperadores: OperadorRow[] = [{ operadorId: '', nombreCompleto: '', horas: '', isExtra: false }];

            // Group time entries by operator AND isExtra category
            const grouped: Record<string, { nombre: string; horas: number }> = {};
            if (Array.isArray(entriesData)) {
                for (const entry of entriesData) {
                    const key = `${entry.operatorId}_${entry.isExtra ? 'extra' : 'normal'}`;
                    if (!grouped[key]) {
                        grouped[key] = {
                            nombre: entry.operator?.nombreCompleto || 'Desconocido',
                            horas: 0,
                        };
                    }
                    grouped[key].horas += entry.horasTrabajadas || 0;
                }
            }
            const groups: TimeEntryGroup[] = Object.entries(grouped).map(([key, v]) => {
                const [operadorId, type] = key.split('_');
                return {
                    operadorId,
                    nombreCompleto: v.nombre,
                    totalHoras: Math.round(v.horas * 100) / 100,
                    isExtra: type === 'extra'
                };
            });
            setExistingHoras(groups);

            if (groups.length > 0) {
                defaultOperadores = groups.map(g => ({
                    operadorId: g.operadorId,
                    nombreCompleto: g.nombreCompleto,
                    horas: String(g.totalHoras),
                    isExtra: g.isExtra
                }));
            }

            // Pre-populate si está editando
            if (editId && responses[4] && responses[4].ok) {
                const osData = await responses[4].json();
                if (osData.estado === 'firmada') setIsFirmada(true);
                setReporte(osData.reporte || '');
                setComentario(osData.comentario || '');
                setSelectedListaPrecioId(osData.listaPrecioId || osData.project?.listaPrecioId || null);

                if (osData.materiales && osData.materiales.length > 0) {
                    setMateriales(osData.materiales.map((m: any) => ({
                        id: m.id,
                        productoId: m.productoId || null,
                        material: m.material, 
                        codigo: m.codigo || '',
                        skuProveedor: m.skuProveedor || null,
                        cantidad: String(m.cantidad), 
                        unidadMedida: m.unidadMedida, 
                        costoUnitario: m.costoUnitario,
                        precioUnitario: m.precioUnitario,
                        esManual: Boolean(m.esManual || m.codigo === '999999'),
                        materialProyectoId: m.materialProyectoId,
                    })));
                } else {
                    cargarMaterialesProyectoDefault(projectData);
                }

                if (osData.operadores && osData.operadores.length > 0) {
                    setOperadores(osData.operadores.map((op: any) => ({
                        operadorId: op.operador.id, 
                        nombreCompleto: op.operador.nombreCompleto, 
                        horas: String(op.horas),
                        isExtra: !!op.isExtra
                    })));
                } else {
                    setOperadores(defaultOperadores);
                }
            } else {
                setSelectedListaPrecioId(projectData.listaPrecioId || null);
                cargarMaterialesProyectoDefault(projectData);
                setOperadores(defaultOperadores);
            }
        } catch (e) {
            console.error(e);
            showToast('Error al cargar datos', 'error');
        } finally {
            setLoading(false);
        }
    };

    const cargarMaterialesProyectoDefault = (projectData: any) => {
        let dm: MaterialRow[] = [];
        if (projectData?.aprovisionamiento && projectData.materialesProyecto) {
            const actives = projectData.materialesProyecto.filter((m: any) => m.estado !== 'cerrado_ok' && m.estado !== 'cerrado_con_reserva');
            if (actives.length > 0) {
                dm = actives.map((m: any) => ({ 
                    material: m.nombre, 
                    codigo: m.codigo || '',
                    cantidad: '', 
                    unidadMedida: m.unidad || 'Unidad', 
                    materialProyectoId: m.id, 
                    disponible: m.cantidadDisponible, 
                    entregada: m.cantidadEntregada,
                    precioUnitario: m.precioVenta
                }));
            }
        }
        setMateriales(dm);
    };

    // Selección de producto desde Gestión Comercial (Sección 1, 14, 15)
    const handleSelectProduct = (product: MaterialOption, cantidad = 1) => {
        setMateriales(prev => {
            // Si ya existe el producto en la lista, sumar la cantidad
            const existingIndex = prev.findIndex(m => !m.esManual && m.productoId && m.productoId === product.id);
            if (existingIndex !== -1) {
                const next = [...prev];
                const currentQty = parseFloat(next[existingIndex].cantidad) || 0;
                next[existingIndex] = {
                    ...next[existingIndex],
                    cantidad: String(currentQty + cantidad),
                };
                showToast(`Se actualizó la cantidad de "${product.descripcion}"`, 'success');
                return next;
            }

            const newRow: MaterialRow = {
                productoId: product.esManual ? null : product.id,
                material: product.descripcion,
                codigo: product.sku,
                skuProveedor: product.skuProveedor || null,
                cantidad: String(cantidad > 0 ? cantidad : 1),
                unidadMedida: product.unidad || 'Unidad',
                costoUnitario: product.costo,
                precioUnitario: product.precioReferencia,
                esManual: Boolean(product.esManual || product.sku === '999999'),
                materialProyectoId: null,
            };

            showToast(`Material "${product.descripcion}" agregado`, 'success');
            return [...prev, newRow];
        });
    };

    const removeMaterial = (i: number) => setMateriales(prev => prev.filter((_, idx) => idx !== i));

    const updateMaterialRow = (i: number, field: keyof MaterialRow, value: any) => {
        setMateriales(prev => {
            const newMats = [...prev];
            newMats[i] = { ...newMats[i], [field]: value };
            return newMats;
        });
    };

    // Operadores
    const addOperador = () => setOperadores(prev => [...prev, { operadorId: '', nombreCompleto: '', horas: '', isExtra: false }]);
    const removeOperador = (i: number) => setOperadores(prev => prev.filter((_, idx) => idx !== i));
    const updateOperador = (i: number, field: keyof OperadorRow, value: any) => {
        setOperadores(prev => prev.map((op, idx) => {
            if (idx !== i) return op;
            if (field === 'operadorId') {
                const found = operators.find(o => o.id === value);
                return { ...op, operadorId: value, nombreCompleto: found?.nombreCompleto || '', isExtra: op.isExtra };
            }
            return { ...op, [field]: value };
        }));
    };

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!reporte.trim()) errs.reporte = 'El reporte del trabajo es obligatorio';

        const opsValidas = operadores.filter(op => op.operadorId && op.horas);
        if (opsValidas.length === 0) errs.operadores = 'Debe haber al menos un operador con horas';
        for (const op of opsValidas) {
            if (Number(op.horas) <= 0) {
                errs.operadores = 'Las horas de cada operador deben ser mayores a 0';
                break;
            }
        }

        const matsParaGuardar = materiales.filter(m => {
            if (m.materialProyectoId) return Boolean(m.cantidad) && Number(m.cantidad) > 0;
            return m.material || m.cantidad;
        });

        for (const m of matsParaGuardar) {
            if (!m.material || !m.cantidad || !m.unidadMedida || Number(m.cantidad) <= 0) {
                errs.materiales = 'Todos los materiales deben tener descripción y cantidad válida mayor a 0';
                break;
            }
        }

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async () => {
        if (isFirmada || !validate()) return;

        const opsValidas = operadores
            .filter(op => op.operadorId && op.horas && Number(op.horas) > 0)
            .map(op => ({ operadorId: op.operadorId, horas: Number(op.horas), isExtra: op.isExtra }));

        const matsValidos = materiales
            .filter(m => {
                if (m.materialProyectoId) return Boolean(m.cantidad) && Number(m.cantidad) > 0;
                return Boolean(m.material && m.cantidad && Number(m.cantidad) > 0);
            })
            .map(m => ({ 
                productoId: m.productoId || null,
                material: m.material.trim(), 
                codigo: m.codigo ? m.codigo.trim() : null,
                skuProveedor: m.skuProveedor || null,
                cantidad: Number(m.cantidad), 
                unidadMedida: m.unidadMedida,
                costoUnitario: m.costoUnitario !== undefined && m.costoUnitario !== null ? Number(m.costoUnitario) : null,
                precioUnitario: m.precioUnitario ? Number(m.precioUnitario) : null,
                esManual: Boolean(m.esManual || m.codigo === '999999'),
                materialProyectoId: m.materialProyectoId || null,
            }));

        setSubmitting(true);
        try {
            const url = editId ? `/api/ordenes-servicio/${editId}` : '/api/ordenes-servicio';
            const method = editId ? 'PUT' : 'POST';

            const res = await safeApiRequest(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    reporte,
                    comentario,
                    listaPrecioId: selectedListaPrecioId || null,
                    materiales: matsValidos,
                    operadores: opsValidas,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                showToast(err.error || 'Error al guardar la OS', 'error');
                return;
            }

            const savedOS = await res.json();
            showToast(editId ? 'Orden de Servicio actualizada exitosamente' : 'Orden de Servicio creada exitosamente', 'success');
            router.push(`/ordenes-servicio/qr/${savedOS.id}`);
        } catch (e) {
            console.error(e);
            showToast('Error de conexión', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const activeListaObj = listasPrecios.find(l => l.id === selectedListaPrecioId);
    const activeListaNombre = activeListaObj ? activeListaObj.nombre : 'Precio Base';

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto p-6 space-y-6">
                <div className="h-12 bg-muted rounded-2xl animate-pulse" />
                <div className="h-40 bg-muted rounded-3xl animate-pulse" />
                <div className="h-40 bg-muted rounded-3xl animate-pulse" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="max-w-2xl mx-auto p-6 text-center space-y-4 py-20">
                <AlertCircle className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Proyecto no encontrado</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
            {/* Header */}
            <div className="space-y-1">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-primary transition-colors mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver
                </button>
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-600 p-2.5 rounded-2xl shadow-lg shadow-emerald-200 text-white">
                        <FileSignature className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
                            {isFirmada ? 'Orden de Servicio Firmada' : editId ? 'Modificar Orden de Servicio' : 'Generar Orden de Servicio'}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                            {project.codigoProyecto ? `${project.codigoProyecto} | ` : ''}{project.nombre}
                        </p>
                    </div>
                </div>
            </div>

            {isFirmada && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex gap-3 text-emerald-800 animate-in zoom-in-95 duration-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div className="text-sm font-medium">
                        Esta orden de servicio ya ha sido firmada por el cliente y no puede ser modificada. Las horas, materiales y reporte a continuación son de solo lectura.
                    </div>
                </div>
            )}

            {/* 3.1 — Horas del Proyecto */}
            <section className="bg-card text-card-foreground rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                        Horas del Proyecto
                    </h2>
                </div>

                {existingHoras.length > 0 && !isFirmada && (
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-indigo-50/50 dark:bg-indigo-500/10">
                        <p className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-3">
                            Horas ya registradas (del listado de tiempos)
                        </p>
                        <div className="space-y-2">
                            {existingHoras.map((g, idx) => (
                                <div key={idx} className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                        {g.nombreCompleto}
                                        {g.isExtra && (
                                            <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 px-1.5 py-0.5 rounded font-black uppercase">
                                                Extra
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                                        {g.totalHoras}h
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="px-6 py-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                            Operadores y horas {isFirmada ? 'en esta OS' : 'para esta OS'}
                        </p>
                        {!isFirmada && (
                            <button
                                onClick={addOperador}
                                className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" /> Agregar operador
                            </button>
                        )}
                    </div>

                    {errors.operadores && (
                        <p className="text-xs text-red-600 font-bold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> {errors.operadores}
                        </p>
                    )}

                    <div className="space-y-2">
                        {operadores.map((op, i) => (
                            <div key={i} className="flex gap-2 items-center">
                                <div className="flex-1 min-w-0">
                                    <select
                                        disabled={isFirmada}
                                        value={op.operadorId}
                                        onChange={e => updateOperador(i, 'operadorId', e.target.value)}
                                        className="w-full disabled:opacity-75 disabled:bg-slate-100 bg-background border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    >
                                        <option value="">Seleccionar operador...</option>
                                        {operators.map(o => (
                                            <option key={o.id} value={o.id}>{o.nombreCompleto}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-20 shrink-0">
                                    <button
                                        type="button"
                                        disabled={isFirmada}
                                        onClick={() => updateOperador(i, 'isExtra', !op.isExtra)}
                                        className={`w-full h-10 px-2 rounded-xl text-[10px] font-black uppercase border transition-all ${
                                            op.isExtra 
                                            ? 'bg-amber-100 border-amber-300 text-amber-700 shadow-sm' 
                                            : 'bg-card border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                                        }`}
                                    >
                                        {op.isExtra ? 'Extra' : 'Normal'}
                                    </button>
                                </div>
                                <div className="w-24">
                                    <div className="relative">
                                        <input
                                            type="number"
                                            disabled={isFirmada}
                                            min="0"
                                            step="0.5"
                                            inputMode="decimal"
                                            placeholder="0"
                                            value={op.horas}
                                            onChange={e => updateOperador(i, 'horas', e.target.value)}
                                            className="w-full disabled:opacity-75 disabled:bg-slate-100 bg-background border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-7"
                                        />
                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 dark:text-slate-500">h</span>
                                    </div>
                                </div>
                                {!isFirmada && (
                                    <button
                                        onClick={() => removeOperador(i)}
                                        disabled={operadores.length === 1}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 3.2 — Reporte del Trabajo */}
            <section className="bg-card text-card-foreground rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                        Reporte del Trabajo
                    </h2>
                    {!isFirmada && <span className="text-red-500 font-bold text-xs ml-auto">* Obligatorio</span>}
                </div>
                <div className="px-6 py-4">
                    {errors.reporte && (
                        <p className="text-xs text-red-600 font-bold flex items-center gap-1 mb-2">
                            <AlertCircle className="w-3.5 h-3.5" /> {errors.reporte}
                        </p>
                    )}
                    <textarea
                        rows={5}
                        disabled={isFirmada}
                        value={reporte}
                        onChange={e => setReporte(e.target.value)}
                        placeholder="Descripción detallada del trabajo realizado..."
                        className={`w-full disabled:opacity-75 disabled:bg-slate-100 bg-background border rounded-2xl py-3 px-4 text-sm font-medium outline-none focus:ring-4 transition-all resize-none ${errors.reporte
                            ? 'border-red-300 focus:ring-red-500/10 focus:border-red-400'
                            : 'border-slate-200 dark:border-slate-700 focus:ring-primary/10 focus:border-primary'
                            }`}
                    />
                    <p className="text-right text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">{reporte.length} caracteres</p>
                </div>
            </section>

            {/* 3.3 — Comentario Adicional */}
            <section className="bg-card text-card-foreground rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                        Comentario Adicional
                    </h2>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 ml-auto">(Opcional)</span>
                </div>
                <div className="px-6 py-4">
                    <textarea
                        rows={3}
                        disabled={isFirmada}
                        value={comentario}
                        onChange={e => setComentario(e.target.value)}
                        placeholder="Cualquier nota adicional o comentario para el cliente..."
                        className="w-full disabled:opacity-75 disabled:bg-slate-100 bg-background border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                    />
                </div>
            </section>

            {/* 3.4 — Materiales Utilizados (Vinculados a Gestión Comercial) */}
            <section className="bg-card text-card-foreground rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-amber-500" />
                        <div>
                            <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                                Materiales Utilizados
                            </h2>
                            <p className="text-[11px] text-slate-400 font-medium">
                                Fuente maestra: Gestión Comercial → Productos
                            </p>
                        </div>
                    </div>

                    {/* Selector de Lista de Precios aplicable (modificable desde la OS) */}
                    <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="text-[11px] font-black uppercase text-slate-400">Lista:</span>
                        <select
                            disabled={isFirmada}
                            value={selectedListaPrecioId || ''}
                            onChange={(e) => setSelectedListaPrecioId(e.target.value || null)}
                            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                        >
                            <option value="">Precio Base (Gestión Comercial)</option>
                            {listasPrecios.filter((lp: any) => lp.activo).map((lp: any) => (
                                <option key={lp.id} value={lp.id}>
                                    {lp.nombre} {lp.valorAjuste ? `(${lp.tipoAjuste?.includes('DESCUENTO') ? '-' : '+'}${lp.valorAjuste}%)` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="px-6 py-4 space-y-4">
                    {errors.materiales && (
                        <p className="text-xs text-red-600 font-bold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> {errors.materiales}
                        </p>
                    )}

                    {/* Botones de acción para agregar material */}
                    {!isFirmada && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            <button
                                id="btn-add-material-gc"
                                type="button"
                                onClick={() => setIsSearchSelectorOpen(true)}
                                className="px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 active:scale-95 transition-all flex items-center gap-2 shadow-sm shadow-primary/20"
                            >
                                <Search className="w-4 h-4" /> Buscar en Gestión Comercial
                            </button>

                            <button
                                id="btn-add-material-manual"
                                type="button"
                                onClick={() => setIsSearchSelectorOpen(true)}
                                className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                            >
                                <Hash className="w-4 h-4 text-amber-500" /> Material Manual (999999)
                            </button>
                        </div>
                    )}

                    {/* Listado de materiales agregados */}
                    {materiales.length === 0 ? (
                        <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
                            <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                No hay materiales agregados a esta Orden de Servicio
                            </p>
                            {!isFirmada && (
                                <p className="text-[11px] text-slate-400">
                                    Haz clic en &ldquo;Buscar en Gestión Comercial&rdquo; para seleccionar del catálogo oficial.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {materiales.map((m, i) => {
                                const isManual = m.esManual || m.codigo === '999999';

                                return (
                                    <div
                                        key={i}
                                        className={`rounded-2xl border p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4 transition-all ${
                                            m.materialProyectoId
                                                ? 'border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/20 dark:bg-indigo-950/10'
                                                : isManual
                                                ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10'
                                                : 'border-slate-200 dark:border-slate-800 bg-card hover:border-slate-300'
                                        }`}
                                    >
                                        {/* Información del producto */}
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {m.codigo && (
                                                    <span className="font-mono text-xs font-black text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                                                        {m.codigo}
                                                    </span>
                                                )}

                                                {m.skuProveedor && (
                                                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                                                        Prov: {m.skuProveedor}
                                                    </span>
                                                )}

                                                {isManual && (
                                                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                                        Material Manual (999999)
                                                    </span>
                                                )}

                                                {m.materialProyectoId && (
                                                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                                                        Provisión Proyecto
                                                    </span>
                                                )}
                                            </div>

                                            {isManual && !isFirmada ? (
                                                <input
                                                    type="text"
                                                    value={m.material}
                                                    onChange={(e) => updateMaterialRow(i, 'material', e.target.value)}
                                                    placeholder="Descripción del material manual..."
                                                    className="w-full bg-background border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20"
                                                />
                                            ) : (
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                                                    {m.material}
                                                </p>
                                            )}

                                            {/* Snapshots de precios informativos */}
                                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                                                <span>Unidad: <strong>{m.unidadMedida}</strong></span>
                                                {m.costoUnitario !== undefined && m.costoUnitario !== null && m.costoUnitario > 0 && (
                                                    <span>Costo: <strong>${m.costoUnitario.toLocaleString('es-AR')}</strong></span>
                                                )}
                                                {m.precioUnitario !== undefined && m.precioUnitario !== null && Number(m.precioUnitario) > 0 && (
                                                    <span className="text-primary font-bold">
                                                        Ref: ${Number(m.precioUnitario).toLocaleString('es-AR')}
                                                    </span>
                                                )}
                                            </div>

                                            {m.materialProyectoId && (
                                                <div className="flex gap-2 items-center text-[10px] font-bold">
                                                    <span className="text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">Entregado: {m.entregada} {m.unidadMedida}</span>
                                                    <span className="text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">Disponible: {m.disponible} {m.unidadMedida}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Input de Cantidad y Unidad */}
                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="w-24">
                                                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                                    Cant. Usada
                                                </label>
                                                <input
                                                    type="number"
                                                    disabled={isFirmada}
                                                    min="0.01"
                                                    step="any"
                                                    inputMode="decimal"
                                                    placeholder="0"
                                                    value={m.cantidad}
                                                    onChange={(e) => updateMaterialRow(i, 'cantidad', e.target.value)}
                                                    className="w-full bg-background border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-sm font-black text-center text-slate-900 dark:text-slate-50 outline-none focus:ring-2 focus:ring-primary/20"
                                                />
                                            </div>

                                            <div className="w-20">
                                                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                                    Unidad
                                                </label>
                                                {isManual && !isFirmada ? (
                                                    <input
                                                        type="text"
                                                        value={m.unidadMedida}
                                                        onChange={(e) => updateMaterialRow(i, 'unidadMedida', e.target.value)}
                                                        className="w-full bg-background border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-xs font-bold text-center outline-none focus:ring-2 focus:ring-primary/20"
                                                    />
                                                ) : (
                                                    <span className="block py-2 text-xs font-bold text-slate-500 text-center">
                                                        {m.unidadMedida}
                                                    </span>
                                                )}
                                            </div>

                                            {!isFirmada && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeMaterial(i)}
                                                    className="p-2 mt-4 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all"
                                                    title="Eliminar material"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* Modal de búsqueda de materiales desde Gestión Comercial */}
            <MaterialSearchSelector
                isOpen={isSearchSelectorOpen}
                onClose={() => setIsSearchSelectorOpen(false)}
                onSelect={handleSelectProduct}
                listaPrecioId={selectedListaPrecioId}
                listaPrecioNombre={activeListaNombre}
            />

            {/* Submit */}
            <div className="pt-4">
                {!isFirmada ? (
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-base shadow-xl shadow-emerald-200 hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {submitting ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Guardando OS...</>
                        ) : (
                            <><CheckCircle2 className="w-5 h-5" /> {editId ? 'Guardar Cambios y Ver QR' : 'Generar y Ver QR para Firma'}</>
                        )}
                    </button>
                ) : (
                    <button
                        onClick={() => router.back()}
                        className="w-full py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2"
                    >
                        Volver
                    </button>
                )}
            </div>
        </div>
    );
}

export default function GenerarOSPage() {
    return (
        <Suspense fallback={
            <div className="max-w-3xl mx-auto p-6 space-y-6">
                {[1, 2, 3].map(i => <div key={i} className="h-40 bg-muted rounded-3xl animate-pulse" />)}
            </div>
        }>
            <GenerarOSContent />
        </Suspense>
    );
}
