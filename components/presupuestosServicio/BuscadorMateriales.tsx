'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, X, Check, Plus } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { api, pesos } from './cliente';

export interface ProductoBuscado {
    id: string;
    sku: string;
    descripcion: string;
    marca: string | null;
    unidad: string;
    precioAplicado: number;
    ivaPorcentaje: number;
    stockActual: number;
}

interface Props {
    listaPrecioId?: string | null;
    /** Cantidad ya cargada de cada producto (por id), para marcarlo en los resultados. */
    cantidades: Map<string, number>;
    /** Agrega el producto o, si ya está, le suma 1. */
    onAgregar: (p: ProductoBuscado) => void;
}

/**
 * Búsqueda de productos de Gestión Comercial. Los resultados quedan a la vista mientras se
 * agregan, así se pueden sumar varios de la misma búsqueda sin volver a escribir.
 */
export default function BuscadorMateriales({ listaPrecioId, cantidades, onAgregar }: Props) {
    const [q, setQ] = useState('');
    const [res, setRes] = useState<ProductoBuscado[]>([]);
    const [buscando, setBuscando] = useState(false);
    const [buscado, setBuscado] = useState('');
    const input = useRef<HTMLInputElement>(null);
    const termino = q.trim();
    const abierto = termino.length >= 2;

    useEffect(() => {
        if (!abierto) { setRes([]); setBuscado(''); return; }
        let vigente = true;
        const t = setTimeout(async () => {
            setBuscando(true);
            const r = await api<any>(`/api/ventas/pdv/buscar-productos?q=${encodeURIComponent(termino)}&limit=25${listaPrecioId ? `&listaPrecioId=${listaPrecioId}` : ''}`).catch(() => null);
            if (!vigente) return;
            setRes(r?.productos || []);
            setBuscado(termino);
            setBuscando(false);
        }, 250);
        return () => { vigente = false; clearTimeout(t); };
    }, [termino, abierto, listaPrecioId]);

    const cerrar = () => { setQ(''); input.current?.focus(); };

    return (
        <div className="p-4 pb-2 space-y-2">
            <label className="relative block">
                <span className="sr-only">Buscar producto en Gestión Comercial</span>
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                    ref={input}
                    className="input pl-9 pr-16"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape' && q) { e.preventDefault(); setQ(''); } }}
                    placeholder="Agregar desde Gestión Comercial: SKU o nombre…"
                    aria-controls="resultados-materiales"
                    aria-expanded={abierto}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {buscando && <Loader2 className="w-4 h-4 animate-spin text-slate-400" aria-hidden="true" />}
                    {q && <Button variant="ghost" size="icon-sm" icon={<X />} aria-label="Limpiar búsqueda" onClick={cerrar} />}
                </span>
            </label>
            {abierto && (
                <div id="resultados-materiales" className="rounded-lg border border-border">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border bg-slate-50 dark:bg-slate-800/40 rounded-t-lg">
                        <span className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
                            {buscando && buscado !== termino ? 'Buscando…' : `${res.length}${res.length === 25 ? '+' : ''} ${res.length === 1 ? 'producto' : 'productos'} · clic para agregar, la lista queda abierta`}
                        </span>
                        <button type="button" className="text-xs text-primary hover:underline" onClick={cerrar}>Cerrar búsqueda</button>
                    </div>
                    {res.length === 0 && !buscando ? (
                        <p className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">Sin resultados para «{termino}». Probá con otro nombre o cargalo como ítem manual.</p>
                    ) : (
                        <ul className="max-h-80 overflow-auto divide-y divide-border" aria-label="Productos encontrados">
                            {res.map((p) => {
                                const cant = cantidades.get(p.id);
                                return (
                                    <li key={p.id}>
                                        <button
                                            type="button"
                                            className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-3"
                                            onClick={() => onAgregar(p)}
                                            title={cant ? 'Sumar 1 a la cantidad' : 'Agregar a la lista'}
                                        >
                                            <span className="min-w-0">
                                                <span className="font-mono text-xs text-slate-500 mr-2">{p.sku}</span>
                                                <span>{p.descripcion}</span>
                                                {p.marca && <span className="text-xs text-slate-500 dark:text-slate-400"> · {p.marca}</span>}
                                            </span>
                                            <span className="flex items-center gap-2 shrink-0">
                                                {cant ? (
                                                    <Badge tone="success"><Check className="w-3 h-3" aria-hidden="true" /> {cant} {p.unidad}</Badge>
                                                ) : (
                                                    <Plus className="w-4 h-4 text-slate-400" aria-hidden="true" />
                                                )}
                                                <span className="tabular-nums text-sm whitespace-nowrap">{pesos(p.precioAplicado)}</span>
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
