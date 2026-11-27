'use client';

import { useRef, useState } from 'react';
import { CalendarClock, Maximize2, Plus, UserRound } from 'lucide-react';
import { Button } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { safeApiRequest } from '@/lib/offline';
import { cn } from '@/lib/cn';
import { ATAJOS_VENCIMIENTO, fechaAtajo, type AtajoVencimiento } from '@/lib/tareas/vencimiento';
import PrioridadSlider from './PrioridadSlider';
import type { OperadorOpcion, Tarea } from './tipos';

export interface BorradorTarea {
    titulo: string;
    prioridad: string;
    responsableId: string;
    fechaVencimiento: string; // ISO o ''
}

/**
 * Alta rápida de tareas pendientes: título + Enter. La prioridad, el responsable
 * y el vencimiento se conservan entre una tarea y la siguiente para cargar varias seguidas.
 */
export default function QuickAddTarea({
    operators,
    onCreated,
    onMasDetalles,
}: {
    operators: OperadorOpcion[];
    onCreated: (tarea: Tarea) => void;
    onMasDetalles: (borrador: BorradorTarea) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [titulo, setTitulo] = useState('');
    const [prioridad, setPrioridad] = useState('media');
    const [responsableId, setResponsableId] = useState('');
    const [atajo, setAtajo] = useState<AtajoVencimiento | ''>('');
    const [fechaManual, setFechaManual] = useState(''); // yyyy-mm-dd
    const [guardando, setGuardando] = useState(false);

    const vencimientoISO = (): string => {
        if (atajo) return fechaAtajo(atajo).toISOString();
        if (fechaManual) {
            const d = new Date(`${fechaManual}T23:59`);
            return Number.isNaN(d.getTime()) ? '' : d.toISOString();
        }
        return '';
    };

    const crear = async () => {
        const t = titulo.trim();
        if (!t || guardando) return;
        setGuardando(true);
        try {
            const res = await safeApiRequest('/api/tareas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    titulo: t,
                    estado: 'pendiente',
                    prioridad,
                    fechaVencimiento: vencimientoISO() || undefined,
                    involucrados: responsableId ? [{ operatorId: responsableId, rol: 'responsable' }] : [],
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.error) throw new Error(data.error || 'No se pudo crear la tarea');
            onCreated(data);
            setTitulo('');
            showToast('Tarea creada', 'success');
        } catch (e: any) {
            showToast(e?.message || 'No se pudo crear la tarea', 'error');
        } finally {
            setGuardando(false);
            inputRef.current?.focus();
        }
    };

    return (
        <form
            className="surface p-3 space-y-2.5"
            onSubmit={e => { e.preventDefault(); crear(); }}
            aria-label="Alta rápida de tarea"
        >
            <div className="flex items-center gap-2">
                <input
                    ref={inputRef}
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    placeholder="Nueva tarea pendiente… (Enter para agregar)"
                    aria-label="Título de la nueva tarea"
                    maxLength={200}
                    className="input flex-1 min-w-0"
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Más detalles"
                    aria-label="Abrir con más detalles"
                    onClick={() => onMasDetalles({ titulo: titulo.trim(), prioridad, responsableId, fechaVencimiento: vencimientoISO() })}
                >
                    <Maximize2 className="w-4 h-4" />
                </Button>
                <Button type="submit" variant="primary" icon={<Plus />} isLoading={guardando} disabled={!titulo.trim()}>
                    <span className="hidden sm:inline">Agregar</span>
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <PrioridadSlider value={prioridad} onChange={setPrioridad} compact />

                <label className="flex items-center gap-1.5 min-w-0">
                    <UserRound className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    <span className="sr-only">Responsable</span>
                    <select
                        value={responsableId}
                        onChange={e => setResponsableId(e.target.value)}
                        className="input h-8 py-0 text-sm w-44"
                    >
                        <option value="">Sin responsable</option>
                        {operators.map(o => <option key={o.id} value={o.id}>{o.nombreCompleto}</option>)}
                    </select>
                </label>

                <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Vencimiento">
                    <CalendarClock className="w-4 h-4 text-muted-foreground shrink-0 mr-0.5" aria-hidden="true" />
                    <AtajoChip activo={!atajo && !fechaManual} onClick={() => { setAtajo(''); setFechaManual(''); }}>Sin fecha</AtajoChip>
                    {ATAJOS_VENCIMIENTO.map(a => (
                        <AtajoChip key={a.id} activo={atajo === a.id} onClick={() => { setAtajo(a.id); setFechaManual(''); }}>
                            {a.label}
                        </AtajoChip>
                    ))}
                    <input
                        type="date"
                        value={fechaManual}
                        onChange={e => { setFechaManual(e.target.value); setAtajo(''); }}
                        aria-label="Otra fecha de vencimiento"
                        className={cn('input h-8 py-0 text-sm w-36', fechaManual && 'border-brand-500')}
                    />
                </div>
            </div>
        </form>
    );
}

function AtajoChip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            aria-pressed={activo}
            onClick={onClick}
            className={cn(
                'h-7 px-2.5 rounded-full text-xs font-medium border transition-colors',
                activo
                    ? 'bg-brand-50 text-brand-700 border-brand-300 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-700'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-slate-300 dark:hover:border-slate-600'
            )}
        >
            {children}
        </button>
    );
}
