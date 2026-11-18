'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { HardHat, Plus, Save } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { Badge, Button, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { useAcceso } from '@/lib/store/useAccessStore';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import { api, pesos } from '@/components/presupuestosServicio/cliente';

interface Fila {
    id?: string;
    key: string;
    nombre: string;
    valorHora: string;
    ivaPorcentaje: string;
    orden: string;
    activo: boolean;
    original?: string;
}

const IVAS = ['21', '10.5', '27', '0'];
const firma = (f: Fila) => JSON.stringify([f.nombre.trim(), f.valorHora, f.ivaPorcentaje, f.orden, f.activo]);

export default function ManoObraPage() {
    const { puede, cargado } = useAcceso();
    const pathname = usePathname();
    const setTitle = useHistoryStore((s) => s.setTitle);
    useEffect(() => { if (pathname) setTitle(pathname, 'Mano de obra'); }, [pathname, setTitle]);
    const [filas, setFilas] = useState<Fila[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [guardando, setGuardando] = useState<string | null>(null);
    const editable = puede('ventas.mano_obra_gestionar');

    const cargar = useCallback(async () => {
        setError(null);
        try {
            const data = await api<any[]>('/api/presupuestos-servicio/mano-obra');
            setFilas(
                data.map((c) => {
                    const f: Fila = { id: c.id, key: c.id, nombre: c.nombre, valorHora: String(c.valorHora), ivaPorcentaje: String(c.ivaPorcentaje), orden: String(c.orden), activo: c.activo };
                    return { ...f, original: firma(f) };
                })
            );
        } catch (e: any) {
            setError(e.message);
        }
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    const editar = (key: string, patch: Partial<Fila>) => setFilas((fs) => fs?.map((f) => (f.key === key ? { ...f, ...patch } : f)) || null);

    const guardar = async (f: Fila) => {
        const valorHora = parseFloat(f.valorHora.replace(',', '.'));
        if (f.nombre.trim().length < 2) return showToast('Escribí el nombre de la categoría', 'error');
        if (!isFinite(valorHora) || valorHora < 0) return showToast('El valor hora tiene que ser un número mayor o igual a 0', 'error');
        setGuardando(f.key);
        try {
            const payload = { nombre: f.nombre.trim(), valorHora, ivaPorcentaje: parseFloat(f.ivaPorcentaje), orden: parseInt(f.orden, 10) || 0, activo: f.activo };
            const r = f.id
                ? await api<any>(`/api/presupuestos-servicio/mano-obra/${f.id}`, { method: 'PUT', json: payload })
                : await api<any>('/api/presupuestos-servicio/mano-obra', { method: 'POST', json: payload });
            showToast(r.message, 'success');
            await cargar();
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setGuardando(null);
        }
    };

    const agregar = () =>
        setFilas((fs) => [...(fs || []), { key: `nueva-${Date.now()}`, nombre: '', valorHora: '0', ivaPorcentaje: '21', orden: String((fs?.length || 0) + 1), activo: true }]);

    return (
        <div className="w-full space-y-5">
            <ModuleHeader
                title="Mano de obra"
                description="Categorías y valor hora neto (sin IVA) que proponen los presupuestos de servicio. Cada línea del presupuesto se puede ajustar."
                icon={<HardHat className="w-5 h-5" />}
                actions={editable ? [{ id: 'nueva', label: 'Nueva categoría', icon: <Plus className="w-4 h-4" />, onClick: agregar, variant: 'primary' }] : []}
            />
            {error && !filas ? (
                <ErrorState description={error} onRetry={cargar} />
            ) : !filas ? (
                <LoadingState label="Cargando categorías…" />
            ) : filas.length === 0 ? (
                <div className="surface"><EmptyState icon={<HardHat />} title="Sin categorías" description="Creá la primera, por ejemplo Oficial o Ayudante." /></div>
            ) : (
                <div className="surface overflow-x-auto">
                    <table className="w-full min-w-[720px]">
                        <thead>
                            <tr>
                                <th className="text-left">Categoría</th>
                                <th className="text-right w-40">Valor hora (neto)</th>
                                <th className="text-left w-28">IVA</th>
                                <th className="text-right w-24">Orden</th>
                                <th className="text-left w-28">Estado</th>
                                <th className="w-28"><span className="sr-only">Guardar</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map((f) => {
                                const cambiada = firma(f) !== f.original;
                                return (
                                    <tr key={f.key}>
                                        <td>
                                            {editable ? <input className="input h-8" value={f.nombre} onChange={(e) => editar(f.key, { nombre: e.target.value })} aria-label="Nombre de la categoría" maxLength={80} placeholder="Ej.: Oficial" /> : f.nombre}
                                        </td>
                                        <td className="text-right">
                                            {editable ? (
                                                <input className="input h-8 text-right tabular-nums" inputMode="decimal" value={f.valorHora} onChange={(e) => editar(f.key, { valorHora: e.target.value })} aria-label="Valor hora neto" />
                                            ) : (
                                                <span className="tabular-nums">{pesos(parseFloat(f.valorHora), 0)}</span>
                                            )}
                                            {parseFloat(f.valorHora) === 0 && <span className="block text-xs text-warning-700 dark:text-warning-300 mt-0.5">Sin valor cargado</span>}
                                        </td>
                                        <td>
                                            {editable ? (
                                                <select className="input h-8" value={f.ivaPorcentaje} onChange={(e) => editar(f.key, { ivaPorcentaje: e.target.value })} aria-label="Alícuota de IVA">
                                                    {Array.from(new Set([...IVAS, f.ivaPorcentaje])).map((i) => <option key={i} value={i}>{i.replace('.', ',')} %</option>)}
                                                </select>
                                            ) : `${f.ivaPorcentaje.replace('.', ',')} %`}
                                        </td>
                                        <td className="text-right">
                                            {editable ? <input className="input h-8 text-right tabular-nums" inputMode="numeric" value={f.orden} onChange={(e) => editar(f.key, { orden: e.target.value.replace(/\D/g, '') })} aria-label="Orden" /> : f.orden}
                                        </td>
                                        <td>
                                            {editable ? (
                                                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                                                    <input type="checkbox" className="w-4 h-4" checked={f.activo} onChange={(e) => editar(f.key, { activo: e.target.checked })} /> Activa
                                                </label>
                                            ) : f.activo ? <Badge tone="success">Activa</Badge> : <Badge tone="neutral">Inactiva</Badge>}
                                        </td>
                                        <td className="text-right">
                                            {editable && (cambiada || !f.id) && (
                                                <Button size="sm" variant={f.id ? 'secondary' : 'primary'} icon={<Save />} isLoading={guardando === f.key} onClick={() => guardar(f)}>
                                                    {f.id ? 'Guardar' : 'Crear'}
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            {cargado && !editable && <p className="text-xs text-slate-500 dark:text-slate-400">Solo lectura: editar el catálogo requiere el acceso “Gestionar mano de obra”.</p>}
        </div>
    );
}
