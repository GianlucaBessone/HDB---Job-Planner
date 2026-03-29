'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    ArrowLeft, Clock, Plus, Trash2, FileSignature, AlertCircle,
    User, Package, FileText, CheckCircle2, Loader2, Users, MessageSquare
} from 'lucide-react';
import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';

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
    material: string;
    codigo?: string;
    cantidad: string;
    unidadMedida: string;
    materialProyectoId?: string;
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
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isFirmada, setIsFirmada] = useState(false);

    // Form state
    const [reporte, setReporte] = useState('');
    const [comentario, setComentario] = useState('');
    const [materiales, setMateriales] = useState<MaterialRow[]>([
        { material: '', codigo: '', cantidad: '', unidadMedida: 'Unidad' }
    ]);
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
            ];
            if (editId) promises.push(safeApiRequest(`/api/ordenes-servicio/${editId}`));

            const data = await Promise.all(promises);
            const projectData = await data[0].json();
            const operatorsData = await data[1].json();
            const entriesData = await data[2].json();

            setProject(projectData);
            setOperators(operatorsData.filter((o: Operator) => o.role !== 'admin'));

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
            if (editId && data[3] && data[3].ok) {
                const osData = await data[3].json();
                if (osData.estado === 'firmada') setIsFirmada(true);
                setReporte(osData.reporte || '');
                setComentario(osData.comentario || '');
                if (osData.materiales && osData.materiales.length > 0) {
                    setMateriales(osData.materiales.map((m: any) => ({
                        material: m.material, 
                        codigo: m.codigo || '',
                        cantidad: String(m.cantidad), 
                        unidadMedida: m.unidadMedida, 
                        materialProyectoId: m.materialProyectoId
                    })));
                } else {
                    let dm: MaterialRow[] = [{ material: '', codigo: '', cantidad: '', unidadMedida: 'Unidad' }];
                    if (projectData.aprovisionamiento && projectData.materialesProyecto) {
                        const actives = projectData.materialesProyecto.filter((m:any) => m.estado !== 'cerrado_ok' && m.estado !== 'cerrado_con_reserva');
                        if (actives.length > 0) {
                            dm = actives.map((m:any) => ({ 
                                material: m.nombre, 
                                codigo: m.codigo || '',
                                cantidad: '', 
                                unidadMedida: m.unidad || 'Unidad', 
                                materialProyectoId: m.id, 
                                disponible: m.cantidadDisponible, 
                                entregada: m.cantidadEntregada 
                            }));
                        }
                    }
                    setMateriales(dm);
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
                let dm: MaterialRow[] = [{ material: '', codigo: '', cantidad: '', unidadMedida: 'Unidad' }];
                if (projectData.aprovisionamiento && projectData.materialesProyecto) {
                    const actives = projectData.materialesProyecto.filter((m:any) => m.estado !== 'cerrado_ok' && m.estado !== 'cerrado_con_reserva');
                    if (actives.length > 0) {
                        dm = actives.map((m:any) => ({ 
                            material: m.nombre, 
                            codigo: m.codigo || '',
                            cantidad: '', 
                            unidadMedida: m.unidad || 'Unidad', 
                            materialProyectoId: m.id, 
                            disponible: m.cantidadDisponible, 
                            entregada: m.cantidadEntregada 
                        }));
                    }
                }
                setMateriales(dm);
                setOperadores(defaultOperadores);
            }
        } catch (e) {
            console.error(e);
            showToast('Error al cargar datos', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Materials
    const addMaterial = () => setMateriales(prev => [...prev, { material: '', codigo: '', cantidad: '', unidadMedida: 'Unidad' }]);
    const removeMaterial = (i: number) => setMateriales(prev => prev.filter((_, idx) => idx !== i));
    const updateMaterial = async (i: number, field: keyof MaterialRow, value: string) => {
        setMateriales(prev => {
            const newMats = [...prev];
            newMats[i] = { ...newMats[i], [field]: value };
            return newMats;
        });

        if (field === 'codigo' && value.length >= 2) {
            try {
                const res = await fetch(`/api/materiales-proyecto?codigo=${value.toUpperCase()}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.nombre) {
                        setMateriales(prev => {
                            const newMats = [...prev];
                            newMats[i] = { 
                                ...newMats[i], 
                                material: data.nombre, 
                                unidadMedida: data.unidad || newMats[i].unidadMedida,
                                codigo: value.toUpperCase()
                            };
                            return newMats;
                        });
                    }
                }
            } catch (e) {
                console.error('Autocomplete error:', e);
            }
        }
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
                errs.materiales = 'Los materiales utilizados deben tener nombre y cantidad válida (mayor a 0)';
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
                material: m.material, 
                codigo: m.codigo || null,
                cantidad: Number(m.cantidad), 
                unidadMedida: m.unidadMedida,
                materialProyectoId: m.materialProyectoId
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

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto p-6 space-y-6">
                <div className="h-12 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
                <div className="h-40 bg-slate-100 dark:bg-slate-800/50 rounded-3xl animate-pulse" />
                <div className="h-40 bg-slate-100 dark:bg-slate-800/50 rounded-3xl animate-pulse" />
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
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                    <div className="bg-emerald-600 p-2 rounded-xl shadow-lg shadow-emerald-200">
                        <FileSignature className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
                            {isFirmada ? 'Orden de Servicio Firmada' : editId ? 'Modificar Orden de Servicio' : 'Generar Orden de Servicio'}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{project.nombre}</p>
                    </div>
                </div>
            </div>

            {isFirmada && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex gap-3 text-emerald-800 animate-in zoom-in-95 duration-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div className="text-sm font-medium">Esta orden de servicio ya ha sido firmada por el cliente y no puede ser modificada. Las horas, materiales y reporte a continuación son de solo lectura.</div>
                </div>
            )}

            {/* 3.1 — Horas del Proyecto */}
            <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">Horas del Proyecto</h2>
                </div>

                {/* Existing hours summary */}
                {existingHoras.length > 0 && !isFirmada && (
                    <div className="px-6 py-4 border-b border-slate-50 bg-indigo-50/50">
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3">Horas ya registradas (del listado de tiempos)</p>
                        <div className="space-y-2">
                            {existingHoras.map((g, idx) => (
                                <div key={idx} className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                        {g.nombreCompleto}
                                        {g.isExtra && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-black uppercase">Extra</span>}
                                    </span>
                                    <span className="text-sm font-black text-indigo-600">{g.totalHoras}h</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Editable operadores table */}
                <div className="px-6 py-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Operadores y horas {isFirmada ? 'en esta OS' : 'para esta OS'}</p>
                        {!isFirmada && (
                            <button
                                onClick={addOperador}
                                className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" /> Agregar
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
                                        className="w-full disabled:opacity-75 disabled:bg-slate-100 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
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
                                            className="w-full disabled:opacity-75 disabled:bg-slate-100 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-7"
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
            <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">Reporte del Trabajo</h2>
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
                        className={`w-full disabled:opacity-75 disabled:bg-slate-100 bg-slate-50 dark:bg-slate-900/50 border rounded-2xl py-3 px-4 text-sm font-medium outline-none focus:ring-4 transition-all resize-none ${errors.reporte
                            ? 'border-red-300 focus:ring-red-500/10 focus:border-red-400'
                            : 'border-slate-200 dark:border-slate-700 focus:ring-primary/10 focus:border-primary'
                            }`}
                    />
                    <p className="text-right text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">{reporte.length} caracteres</p>
                </div>
            </section>

            {/* 3.3 — Comentario Adicional */}
            <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">Comentario Adicional</h2>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 ml-auto">(Opcional)</span>
                </div>
                <div className="px-6 py-4">
                    <textarea
                        rows={3}
                        disabled={isFirmada}
                        value={comentario}
                        onChange={e => setComentario(e.target.value)}
                        placeholder="Cualquier nota adicional, detalle técnico extra o comentario para el cliente..."
                        className="w-full disabled:opacity-75 disabled:bg-slate-100 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                    />
                </div>
            </section>

            {/* 3.4 — Materiales Utilizados */}
            <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-amber-500" />
                        <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">Materiales Utilizados</h2>
                        {!isFirmada && <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">(Opcional)</span>}
                    </div>
                    {!isFirmada && (
                        <button
                            onClick={addMaterial}
                            className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" /> Agregar fila
                        </button>
                    )}
                </div>
                <div className="px-6 py-4 space-y-3">
                    {errors.materiales && (
                        <p className="text-xs text-red-600 font-bold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> {errors.materiales}
                        </p>
                    )}

                    {/* Eliminado Header antiguo por diseño responsivo */}

                    <div className="space-y-3">
                        {materiales.map((m, i) => (
                            <div key={i} className={`bg-slate-50 dark:bg-slate-900/50 border ${m.materialProyectoId ? 'border-primary/20 bg-primary/5' : 'border-slate-200 dark:border-slate-700'} rounded-2xl p-4 sm:p-3 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4 transition-colors`}>
                                <div className="flex-1 min-w-0">
                                    <div className="flex gap-2 mb-2 sm:mb-0">
                                        <div className="w-24 shrink-0">
                                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest sm:sr-only block mb-1">Cod.</label>
                                            <input
                                                type="text"
                                                disabled={isFirmada || !!m.materialProyectoId}
                                                placeholder="Código"
                                                value={m.codigo}
                                                onChange={e => updateMaterial(i, 'codigo', e.target.value.toUpperCase())}
                                                className={`w-full ${m.materialProyectoId ? 'bg-transparent text-primary/70 font-mono px-0' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-xl border'} text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all uppercase`}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest sm:sr-only block mb-1">Descripción</label>
                                            <input
                                                type="text"
                                                disabled={isFirmada || !!m.materialProyectoId}
                                                placeholder="Nombre del material"
                                                value={m.material}
                                                onChange={e => updateMaterial(i, 'material', e.target.value)}
                                                className={`w-full ${m.materialProyectoId ? 'bg-transparent text-primary focus:ring-0 border-transparent px-0 text-base font-bold' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-xl border text-sm font-medium'} disabled:opacity-90 outline-none focus:ring-2 focus:ring-primary/20 transition-all`}
                                            />
                                        </div>
                                    </div>
                                    {m.materialProyectoId && (
                                        <div className="mt-1 flex flex-wrap gap-2 items-center">
                                            <span className="text-[10px] font-black tracking-tight text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">Entregado: {m.entregada} {m.unidadMedida}</span>
                                            <span className="text-[10px] font-black tracking-tight text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200">Stock Proyecto: {m.disponible} {m.unidadMedida}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-end sm:items-center gap-3">
                                    <div className="w-24 shrink-0">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 sm:sr-only mb-1 block">Cant. Usada</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                disabled={isFirmada}
                                                min="0"
                                                step="any"
                                                inputMode="decimal"
                                                placeholder="0.0"
                                                value={m.cantidad}
                                                onChange={e => updateMaterial(i, 'cantidad', e.target.value)}
                                                className="w-full bg-white dark:bg-slate-800 disabled:opacity-75 disabled:bg-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-black text-slate-900 dark:text-slate-50 outline-none focus:ring-2 focus:border-primary focus:ring-primary/20 transition-all text-center"
                                            />
                                        </div>
                                    </div>
                                    <div className="w-24 shrink-0">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 sm:sr-only mb-1 block">Unidad</label>
                                        <select
                                            disabled={isFirmada || !!m.materialProyectoId}
                                            value={m.unidadMedida}
                                            onChange={e => updateMaterial(i, 'unidadMedida', e.target.value)}
                                            className={`w-full ${m.materialProyectoId ? 'bg-transparent border-transparent px-0 font-bold text-slate-500 dark:text-slate-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 px-2.5 py-2.5 rounded-xl border appearance-none font-medium text-sm'} disabled:opacity-90 outline-none focus:ring-2 focus:ring-primary/20 transition-all`}
                                        >
                                            {!UNIDADES.includes(m.unidadMedida) && m.unidadMedida && (
                                                <option value={m.unidadMedida}>{m.unidadMedida}</option>
                                            )}
                                            {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                    {!isFirmada && !m.materialProyectoId && (
                                        <button
                                            onClick={() => removeMaterial(i)}
                                            disabled={materiales.length === 1 && !m.materialProyectoId}
                                            className="p-2 mb-0.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-30 shrink-0 border border-transparent hover:border-red-100"
                                            title="Eliminar fila"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Submit */}
            <div className="pb-10">
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
                        className="w-full py-4 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2"
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
            <div className="max-w-2xl mx-auto p-6 space-y-6">
                {[1, 2, 3].map(i => <div key={i} className="h-40 bg-slate-100 dark:bg-slate-800/50 rounded-3xl animate-pulse" />)}
            </div>
        }>
            <GenerarOSContent />
        </Suspense>
    );
}
