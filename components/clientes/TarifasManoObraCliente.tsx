'use client';

import { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { EmptyState, Panel } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';
import { formatARS } from '@/lib/formatCurrency';

interface Fila { id: string; nombre: string; valorCategoria: number; valorCliente: number | null }

/**
 * Valor hora del cliente por categoría de mano de obra (P20). Vacío = usa el de la categoría.
 * Las excepciones por persona siguen en "Portal y OT → Tarifas".
 */
export default function TarifasManoObraCliente({ clienteId, puedeEditar }: { clienteId: string; puedeEditar: boolean }) {
    const [filas, setFilas] = useState<Fila[] | null>(null);
    const [defecto, setDefecto] = useState(0);
    const [valores, setValores] = useState<Record<string, string>>({});
    const [guardando, setGuardando] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        try {
            const res = await safeApiRequest(`/api/clients/${clienteId}/tarifas-categoria`);
            if (!res.ok) return setFilas([]);
            const d = await res.json();
            setDefecto(d.valorPorDefecto || 0);
            setFilas(d.categorias || []);
            setValores(Object.fromEntries((d.categorias || []).map((c: Fila) => [c.id, c.valorCliente === null ? '' : String(c.valorCliente)])));
        } catch {
            setFilas([]);
        }
    }, [clienteId]);

    useEffect(() => { cargar(); }, [cargar]);

    const guardar = async (f: Fila) => {
        const texto = (valores[f.id] ?? '').trim().replace(',', '.');
        const valorHora = texto === '' ? null : Number(texto);
        if (valorHora !== null && !(valorHora >= 0)) return showToast('Ingresá un valor válido', 'error');
        setGuardando(f.id);
        try {
            const res = await safeApiRequest(`/api/clients/${clienteId}/tarifas-categoria`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categoriaId: f.id, valorHora }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) return showToast(data?.error || 'No se pudo guardar', 'error');
            showToast(valorHora === null ? `${f.nombre}: vuelve al valor de la categoría` : `${f.nombre}: valor del cliente guardado`, 'success');
            cargar();
        } catch {
            showToast('Error de conexión', 'error');
        } finally {
            setGuardando(null);
        }
    };

    if (filas === null) return null;

    return (
        <Panel
            title="Valor hora por categoría"
            description="Lo que se le cobra a este cliente por hora según la categoría de cada persona. Vacío: el valor de la categoría."
        >
            {filas.length === 0 ? (
                <EmptyState title="Sin categorías" description="Se cargan en Presupuestos de servicio → Mano de obra." />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr><th scope="col">Categoría</th><th scope="col" className="text-right">Valor de la categoría</th><th scope="col">Valor para este cliente</th></tr>
                        </thead>
                        <tbody>
                            {filas.map(f => {
                                const cambiado = (valores[f.id] ?? '') !== (f.valorCliente === null ? '' : String(f.valorCliente));
                                return (
                                    <tr key={f.id}>
                                        <td>{f.nombre}</td>
                                        <td className="text-right tabular-nums">
                                            {f.valorCategoria > 0 ? formatARS(f.valorCategoria) : <span className="text-muted-foreground">{formatARS(defecto)} (por defecto)</span>}
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    className="input w-40"
                                                    inputMode="decimal"
                                                    aria-label={`Valor hora de ${f.nombre} para este cliente`}
                                                    placeholder="Valor de la categoría"
                                                    value={valores[f.id] ?? ''}
                                                    onChange={e => setValores(v => ({ ...v, [f.id]: e.target.value }))}
                                                    disabled={!puedeEditar}
                                                />
                                                {puedeEditar && cambiado && (
                                                    <button type="button" className="btn btn-primary btn-sm" disabled={guardando === f.id} onClick={() => guardar(f)}>
                                                        <Save aria-hidden="true" /> {guardando === f.id ? 'Guardando…' : 'Guardar'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
                Orden de la regla: excepción del cliente para una persona (Portal y OT → Tarifas) → valor del cliente para la categoría → valor de la categoría → valor por defecto (Proyectos → Ajustes → Mano de obra).
            </p>
        </Panel>
    );
}
