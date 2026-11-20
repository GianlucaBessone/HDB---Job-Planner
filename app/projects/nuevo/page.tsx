'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Check, FolderPlus, Save } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';
import { Button, EmptyState, LoadingState } from '@/components/ui';
import { showToast } from '@/components/Toast';
import { cn } from '@/lib/cn';
import { useAcceso } from '@/lib/store/useAccessStore';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import { useAccessStore } from '@/lib/store/useAccessStore';
import { api, pesos, horasTxt, fechaCorta } from '@/components/presupuestosServicio/cliente';
import { estadoDesdePrecarga, estadoInicial, erroresPaso, horasTotales, payload, type WizardState } from '@/components/projects/wizard/estado';
import { PasoOrigen, PasoDatos, PasoTareas, PasoMateriales, PasoFechasEquipo, PasoRevision, type Catalogos } from '@/components/projects/wizard/Pasos';

const PASOS = ['Origen', 'Datos generales', 'Tareas y horas', 'Materiales', 'Fechas y equipo', 'Revisión'];
const CLAVE_LOCAL = (u: string | null) => `wizard-proyecto:${u || 'anon'}`;

function Wizard() {
    const router = useRouter();
    const sp = useSearchParams();
    const pathname = usePathname();
    const { puede, cargado } = useAcceso();
    const userId = useAccessStore((x) => x.userId);
    const setTitle = useHistoryStore((x) => x.setTitle);

    const [s, setS] = useState<WizardState>(estadoInicial);
    const [paso, setPaso] = useState(1);
    const [alcanzado, setAlcanzado] = useState(1);
    const [intento, setIntento] = useState<number | null>(null);
    const [borradorId, setBorradorId] = useState<string | null>(null);
    const [guardado, setGuardado] = useState<'' | 'guardando' | 'guardado' | 'local'>('');
    const [cat, setCat] = useState<Catalogos | null>(null);
    const [borradores, setBorradores] = useState<any[]>([]);
    const [cargandoPrecarga, setCargandoPrecarga] = useState<string | null>(null);
    const [creando, setCreando] = useState(false);
    const [advertencias, setAdvertencias] = useState<string[]>([]);
    const tocado = useRef(false);

    const set = useCallback((patch: Partial<WizardState> | ((p: WizardState) => Partial<WizardState>)) => {
        tocado.current = true;
        setS((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
    }, []);

    useEffect(() => { if (pathname) setTitle(pathname, 'Nuevo proyecto'); }, [pathname, setTitle]);

    // Catálogos y borradores
    useEffect(() => {
        (async () => {
            const [clientes, operadores, opciones, tags, listas] = await Promise.all([
                api<any[]>('/api/clients').catch(() => []),
                api<any[]>('/api/operators').catch(() => []),
                api<any[]>('/api/config/options').catch(() => []),
                api<any[]>('/api/config/tags').catch(() => []),
                api<any[]>('/api/ventas/listas-precios').catch(() => []),
            ]);
            setCat({
                clientes: (clientes || []).filter((c: any) => c.activo !== false),
                operadores: (operadores || []).filter((o: any) => o.activo !== false),
                categorias: (opciones || []).filter((o: any) => o.category === 'CATEGORIA' && o.active).map((o: any) => o.value),
                tiposActividad: (opciones || []).filter((o: any) => o.category === 'TIPO_ACTIVIDAD' && o.active).map((o: any) => o.value),
                etiquetas: (tags || []).filter((t: any) => t.active).map((t: any) => t.name),
                listas: (listas || []).filter((l: any) => l.activo),
            });
            setBorradores(await api<any[]>('/api/projects/borradores').catch(() => []));
        })();
    }, []);

    const elegirPresupuesto = useCallback(async (id: string) => {
        setCargandoPrecarga(id);
        try {
            const pre = await api<any>(`/api/presupuestos-servicio/${id}/precarga`);
            setS(estadoDesdePrecarga(pre));
            tocado.current = true;
            setPaso(2);
            setAlcanzado(2);
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setCargandoPrecarga(null);
        }
    }, []);

    const retomar = useCallback((b: any) => {
        if (b?.datos?.estado) {
            setS({ ...estadoInicial(), ...b.datos.estado });
            setBorradorId(b.id);
            setPaso(b.paso || 2);
            setAlcanzado(b.datos.alcanzado || b.paso || 2);
            tocado.current = false;
            showToast('Borrador recuperado', 'info');
        }
    }, []);

    const descartarBorrador = useCallback(async (id: string) => {
        try {
            await api(`/api/projects/borradores?id=${id}`, { method: 'DELETE' });
            setBorradores((bs) => bs.filter((b) => b.id !== id));
            showToast('Borrador descartado', 'success');
        } catch (e: any) {
            showToast(e.message, 'error');
        }
    }, []);

    // Entrada directa: ?presupuestoId= o ?borrador=
    const inicio = useRef(false);
    useEffect(() => {
        if (inicio.current) return;
        const pid = sp.get('presupuestoId');
        const bid = sp.get('borrador');
        if (pid) { inicio.current = true; void elegirPresupuesto(pid); }
        else if (bid && borradores.length) {
            inicio.current = true;
            retomar(borradores.find((b) => b.id === bid));
        }
    }, [sp, borradores, elegirPresupuesto, retomar]);

    // Guardado automático del borrador
    const guardarBorrador = useCallback(async (silencioso = true) => {
        if (!s.origen) return;
        const datos = { estado: s, alcanzado };
        try { localStorage.setItem(CLAVE_LOCAL(userId), JSON.stringify({ paso, datos, guardadoEn: Date.now() })); } catch { /* sin almacenamiento */ }
        setGuardado('guardando');
        try {
            const r = await api<any>('/api/projects/borradores', {
                method: 'PUT',
                json: { id: borradorId, titulo: s.nombre || s.presupuesto?.titulo || null, paso, presupuestoId: s.presupuesto?.id || null, datos },
            });
            setBorradorId(r.id);
            setGuardado('guardado');
            if (!silencioso) showToast('Borrador guardado', 'success');
        } catch {
            setGuardado('local');
            if (!silencioso) showToast('Sin conexión: el borrador quedó guardado en este dispositivo', 'info');
        }
    }, [s, paso, alcanzado, borradorId, userId]);

    useEffect(() => {
        if (!tocado.current || !s.origen || creando) return;
        const t = setTimeout(() => void guardarBorrador(true), 1500);
        return () => clearTimeout(t);
    }, [s, paso, guardarBorrador, creando]);

    // Advertencias para la revisión
    useEffect(() => {
        if (paso !== 6) return;
        const a: string[] = [];
        if (s.operadores.length === 0) a.push('No hay operadores asignados: se pueden asignar después desde el proyecto.');
        if (horasTotales(s) === 0) a.push('El proyecto queda con 0 horas estimadas.');
        if (s.operadores.length > 0) {
            api<any>(`/api/operators/disponibilidad?desde=${s.fechaInicio}&hasta=${s.fechaFin}`)
                .then((d) => {
                    for (const o of d.operadores.filter((x: any) => s.operadores.includes(x.id))) {
                        for (const dia of d.dias) {
                            const c = o.celdas[dia];
                            if (c && c.tipo !== 'libre') a.push(`${o.nombre}, ${fechaCorta(dia)}: ${c.detalle.join(', ')}`);
                        }
                        if (o.enVacaciones) a.push(`${o.nombre} figura de vacaciones hoy.`);
                    }
                    setAdvertencias([...a]);
                })
                .catch(() => setAdvertencias(a));
        } else setAdvertencias(a);
    }, [paso, s]);

    const errores = useMemo(() => erroresPaso(paso, s), [paso, s]);
    const erroresVisibles = intento === paso ? errores : {};

    const irA = (n: number) => {
        if (n <= alcanzado) setPaso(n);
    };
    const siguiente = () => {
        if (Object.keys(errores).length) {
            setIntento(paso);
            showToast(Object.values(errores)[0], 'error');
            return;
        }
        const n = Math.min(6, paso + 1);
        setPaso(n);
        setAlcanzado((a) => Math.max(a, n));
        setIntento(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const atras = () => setPaso((p) => Math.max(1, p - 1));

    const crear = async () => {
        for (let p = 1; p <= 5; p++) {
            const e = erroresPaso(p, s);
            if (Object.keys(e).length) {
                setPaso(p);
                setIntento(p);
                showToast(Object.values(e)[0], 'error');
                return;
            }
        }
        setCreando(true);
        try {
            const r = await api<any>('/api/projects/wizard', { method: 'POST', json: payload(s, borradorId) });
            try { localStorage.removeItem(CLAVE_LOCAL(userId)); } catch { /* noop */ }
            showToast(r.message, 'success');
            router.push(`/projects/ficha/${r.project.id}`);
        } catch (e: any) {
            showToast(e.message, 'error');
            setCreando(false);
        }
    };

    if (cargado && !puede('proyectos.crear')) {
        return <div className="surface"><EmptyState title="No tenés permiso para crear proyectos" description="Pedile a un administrador el acceso “Crear y planificar proyectos”." /></div>;
    }
    if (!cat) return <LoadingState label="Preparando el asistente…" />;

    const desc = s.origen === 'presupuesto' && s.presupuesto
        ? `Desde ${s.presupuesto.numero} · Revisión ${s.presupuesto.version} · ${s.presupuesto.clienteNombre}`
        : s.origen === 'manual' ? 'Proyecto manual' : 'Elegí de dónde sale el proyecto.';
    const textoGuardado = guardado === 'guardando' ? 'Guardando borrador…' : guardado === 'guardado' ? 'Borrador guardado' : guardado === 'local' ? 'Borrador guardado en este dispositivo' : '';
    const cliente = cat.clientes.find((c) => c.id === s.clientId)?.nombre;

    return (
        <div className="w-full space-y-5">
            <ModuleHeader
                title="Nuevo proyecto"
                description={desc}
                icon={<FolderPlus className="w-5 h-5" />}
                toolbar={textoGuardado ? <span className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">{textoGuardado}</span> : undefined}
            />

            {/* Móvil: progreso */}
            <div className="lg:hidden space-y-2">
                <div className="flex justify-between text-sm"><b className="font-semibold">Paso {paso} de 6 · {PASOS[paso - 1]}</b></div>
                <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuemin={1} aria-valuemax={6} aria-valuenow={paso} aria-label="Avance del asistente">
                    <div className="h-1 rounded-full bg-primary transition-all" style={{ width: `${(paso / 6) * 100}%` }} />
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-5 items-start">
                <nav aria-label="Pasos" className="hidden lg:flex surface p-2 w-56 shrink-0 flex-col gap-0.5 lg:sticky lg:top-20">
                    {PASOS.map((nombre, i) => {
                        const n = i + 1;
                        const hecho = n < paso || (n <= alcanzado && n !== paso);
                        const actual = n === paso;
                        return (
                            <button
                                key={nombre}
                                type="button"
                                onClick={() => irA(n)}
                                disabled={n > alcanzado}
                                aria-current={actual ? 'step' : undefined}
                                className={cn('flex items-center gap-2.5 h-10 px-2.5 rounded-lg text-left text-[13px] transition-colors btn-icon-inline',
                                    actual ? 'bg-brand-50 text-brand-700 font-semibold dark:bg-brand-950 dark:text-brand-200' : hecho ? 'text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800' : 'text-slate-400 dark:text-slate-500')}
                            >
                                <span className={cn('flex w-6 h-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                                    actual ? 'bg-primary border-primary text-white' : hecho ? 'bg-success-100 border-success-100 text-success-700 dark:bg-success-950 dark:border-success-950 dark:text-success-300' : 'border-border')}>
                                    {hecho && !actual ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : n}
                                </span>
                                {nombre}
                            </button>
                        );
                    })}
                </nav>

                <div className="flex-1 min-w-0 w-full">
                    {paso === 1 && <PasoOrigen s={s} set={set} errores={erroresVisibles} puedeConvertir={puede('presupuestos.convertir')} elegirPresupuesto={elegirPresupuesto} cargandoPrecarga={cargandoPrecarga} borradores={borradores} retomar={retomar} descartarBorrador={descartarBorrador} />}
                    {paso === 2 && <PasoDatos s={s} set={set} errores={erroresVisibles} cat={cat} />}
                    {paso === 3 && <PasoTareas s={s} set={set} errores={erroresVisibles} cat={cat} />}
                    {paso === 4 && <PasoMateriales s={s} set={set} errores={erroresVisibles} cat={cat} />}
                    {paso === 5 && <PasoFechasEquipo s={s} set={set} errores={erroresVisibles} />}
                    {paso === 6 && <PasoRevision s={s} cat={cat} irA={irA} advertencias={advertencias} />}
                </div>

                {paso > 1 && paso < 6 && (
                    <aside className="hidden xl:block surface p-4 w-64 shrink-0 lg:sticky lg:top-20" aria-label="Resumen">
                        <span className="eyebrow">Resumen</span>
                        <dl className="mt-2 text-sm divide-y divide-border">
                            {[
                                ['Cliente', cliente || '—'],
                                ['Tareas', `${s.tareas.length} · ${horasTxt(horasTotales(s))}`],
                                ['Materiales', `${s.materiales.length} ítems`],
                                ['Fechas', `${fechaCorta(s.fechaInicio)} → ${fechaCorta(s.fechaFin)}`],
                                ['Equipo', s.operadores.length ? `${s.operadores.length} operadores` : 'Sin asignar'],
                                ...(s.presupuesto ? [['Neto presupuestado', pesos(s.presupuesto.neto, 0)]] : []),
                            ].map(([k, v]) => (
                                <div key={k} className="flex justify-between gap-2 py-1.5"><dt className="text-slate-500 dark:text-slate-400">{k}</dt><dd className="text-right">{v}</dd></div>
                            ))}
                        </dl>
                    </aside>
                )}
            </div>

            <footer className="sticky bottom-0 z-30 surface rounded-xl px-4 py-3 shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    {paso === 1 ? (
                        <Button variant="ghost" onClick={() => router.push('/projects')}>Cancelar</Button>
                    ) : (
                        <Button variant="ghost" onClick={atras} disabled={creando}>Atrás</Button>
                    )}
                    <div className="flex gap-2">
                        {s.origen && <Button variant="secondary" icon={<Save />} onClick={() => guardarBorrador(false)} disabled={creando} className="hidden sm:inline-flex">Guardar borrador</Button>}
                        {paso < 6 ? (
                            <Button onClick={siguiente} disabled={Boolean(cargandoPrecarga)}>Siguiente</Button>
                        ) : (
                            <Button icon={<FolderPlus />} isLoading={creando} onClick={crear}>Crear proyecto</Button>
                        )}
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default function NuevoProyectoPage() {
    return (
        <Suspense fallback={<LoadingState label="Preparando el asistente…" />}>
            <Wizard />
        </Suspense>
    );
}
