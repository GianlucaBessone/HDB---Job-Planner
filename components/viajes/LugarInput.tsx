'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { Field } from '@/components/ui';
import { cn } from '@/lib/cn';
import { buscarLugares, etiquetaLugar, resolverLugar, type Lugar } from './distancia';

/** Campo de lugar con sugerencias de OpenStreetMap mientras se escribe. */
export default function LugarInput({
    label,
    marca,
    value,
    lugar,
    onChange,
    required,
    placeholder,
    autoFocus,
}: {
    label: string;
    marca: 'A' | 'B';
    value: string;
    lugar: Lugar | null;
    onChange: (texto: string, lugar: Lugar | null) => void;
    required?: boolean;
    placeholder?: string;
    autoFocus?: boolean;
}) {
    const id = useId();
    const listId = `${id}-lista`;
    const [sugerencias, setSugerencias] = useState<Lugar[]>([]);
    const [abierto, setAbierto] = useState(false);
    const [activo, setActivo] = useState(-1);
    const [buscando, setBuscando] = useState(false);
    const [sinResultados, setSinResultados] = useState(false);
    const [errorRed, setErrorRed] = useState(false);
    const consulta = useRef<string>('');
    const wrapRef = useRef<HTMLDivElement>(null);

    // Busca con una pausa de 300 ms y cancela la consulta anterior.
    useEffect(() => {
        const q = value.trim();
        if (lugar || q.length < 3 || q === consulta.current) {
            if (q.length < 3) { setSugerencias([]); setSinResultados(false); }
            return;
        }
        const ctrl = new AbortController();
        const t = setTimeout(async () => {
            setBuscando(true);
            setErrorRed(false);
            try {
                const r = await buscarLugares(q, ctrl.signal);
                consulta.current = q;
                setSugerencias(r);
                setSinResultados(r.length === 0);
                setActivo(r.length ? 0 : -1);
            } catch (e: any) {
                if (e?.name !== 'AbortError') { setErrorRed(true); setSugerencias([]); }
            } finally {
                if (!ctrl.signal.aborted) setBuscando(false);
            }
        }, 300);
        return () => { clearTimeout(t); ctrl.abort(); };
    }, [value, lugar]);

    useEffect(() => {
        const cerrar = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setAbierto(false); };
        document.addEventListener('mousedown', cerrar);
        return () => document.removeEventListener('mousedown', cerrar);
    }, []);

    const mostrarLista = abierto && !lugar && value.trim().length >= 3 && (sugerencias.length > 0 || sinResultados || errorRed);

    const elegir = async (sugerencia: Lugar) => {
        const etiqueta = etiquetaLugar(sugerencia);
        consulta.current = etiqueta;
        setAbierto(false);
        setSugerencias([]);
        onChange(etiqueta, null);
        // Las sugerencias de Google llegan sin coordenadas: se piden al elegir.
        setBuscando(true);
        try {
            onChange(etiqueta, await resolverLugar(sugerencia));
        } catch {
            setErrorRed(true);
            setAbierto(true);
        } finally {
            setBuscando(false);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Escape cierra primero la lista; con la lista cerrada, cierra el diálogo.
        if (e.key === 'Escape' && mostrarLista) { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); setAbierto(false); return; }
        if (!abierto || sugerencias.length === 0) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setActivo(i => (i + 1) % sugerencias.length); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo(i => (i <= 0 ? sugerencias.length - 1 : i - 1)); }
        else if (e.key === 'Enter' && activo >= 0) { e.preventDefault(); elegir(sugerencias[activo]); }
    };

    const colorMarca = marca === 'A' ? 'bg-success-600' : 'bg-danger-600';

    return (
        <div ref={wrapRef} className="relative">
            <Field
                label={label}
                required={required}
                htmlFor={id}
                hint={lugar ? 'Ubicado en el mapa' : value.trim().length >= 3 ? 'Elegí una opción de la lista o tocá el mapa' : undefined}
            >
                <div className="relative">
                    <span className={cn('absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full text-white text-xs font-semibold flex items-center justify-center pointer-events-none', colorMarca)} aria-hidden="true">
                        {marca}
                    </span>
                    <input
                        id={id}
                        role="combobox"
                        aria-expanded={!!mostrarLista}
                        aria-controls={listId}
                        aria-autocomplete="list"
                        aria-activedescendant={mostrarLista && activo >= 0 ? `${listId}-${activo}` : undefined}
                        autoComplete="off"
                        required={required}
                        autoFocus={autoFocus}
                        className="input !pl-10 !pr-9"
                        value={value}
                        placeholder={placeholder}
                        maxLength={160}
                        onFocus={() => setAbierto(true)}
                        onChange={e => { consulta.current = ''; onChange(e.target.value, null); setAbierto(true); }}
                        onKeyDown={onKeyDown}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true">
                        {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : lugar ? <MapPin className="w-4 h-4 text-success-600" /> : null}
                    </span>
                    {mostrarLista && (
                        <ul
                            id={listId}
                            role="listbox"
                            aria-label={`Sugerencias para ${label.toLowerCase()}`}
                            className="absolute z-30 left-0 right-0 top-full mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover shadow-xl py-1"
                        >
                            {errorRed && <li className="px-3 py-2 text-[13px] text-slate-500 dark:text-slate-400">El buscador no responde. Tocá el lugar en el mapa o dejalo escrito.</li>}
                            {sinResultados && !errorRed && <li className="px-3 py-2 text-[13px] text-slate-500 dark:text-slate-400">Sin coincidencias. Probá con otro nombre o tocá el mapa.</li>}
                            {sugerencias.map((s, i) => (
                                <li
                                    key={`${s.lat},${s.lon},${i}`}
                                    id={`${listId}-${i}`}
                                    role="option"
                                    aria-selected={i === activo}
                                    onMouseDown={e => { e.preventDefault(); elegir(s); }}
                                    onMouseEnter={() => setActivo(i)}
                                    className={cn('flex items-start gap-2 px-3 py-2 cursor-pointer min-h-10', i === activo && 'bg-slate-100 dark:bg-slate-800')}
                                >
                                    <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                                    <span className="min-w-0">
                                        <span className="block text-[13px] text-slate-900 dark:text-slate-100 truncate">{s.nombre}</span>
                                        {s.detalle && <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{s.detalle}</span>}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </Field>
        </div>
    );
}
