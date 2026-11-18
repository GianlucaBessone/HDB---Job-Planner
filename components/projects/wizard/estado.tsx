'use client';

/**
 * Estado, validaciones por paso y piezas compartidas del wizard de nuevo proyecto.
 */
import { FileText, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui';
import { contarDiasHabiles, diasHabilesEstimados, esFecha, finSegunDiasHabiles, hoyArgentina, siguienteDiaHabil } from '@/lib/presupuestosServicio/calculos';

export interface TareaWiz {
    key: string;
    descripcion: string;
    etiqueta: string;
    horasEstimadas: string;
    presupuestoTareaId: string | null;
    horasPresupuesto: number | null;
}

export interface MaterialWiz {
    key: string;
    productoId: string | null;
    codigo: string;
    nombre: string;
    unidad: string;
    cantidad: string;
    cantidadPresupuesto: number | null;
    precioVenta: number | null;
}

export interface PresupuestoInfo {
    id: string;
    numero: string;
    version: number;
    titulo: string;
    clienteNombre: string;
    neto: number;
    total: number;
    horas: number;
    integra: boolean;
}

export interface Sugerido {
    nombre: string;
    clientId: string | null;
    tags: string[];
    observaciones: string;
    listaPrecioId: string | null;
    fechaInicio: string;
    fechaFin: string;
    fechasAjustadas: boolean;
    fechaInicioTentativa: string | null;
    fechaFinTentativa: string | null;
    operariosSimultaneos: number;
    tareas: { descripcion: string; horasEstimadas: number; presupuestoTareaId: string | null }[];
    materiales: { codigo: string | null; nombre: string; cantidad: number; unidad: string }[];
}

export interface WizardState {
    origen: 'presupuesto' | 'manual' | null;
    presupuesto: PresupuestoInfo | null;
    sugerido: Sugerido | null;
    nombre: string;
    clientId: string;
    responsableId: string;
    categoria: string;
    tipoActividad: string;
    tags: string[];
    observaciones: string;
    generarOS: boolean;
    aprovisionamiento: boolean;
    listaPrecioId: string;
    fichajeHabilitado: boolean;
    geofenceLat: number | null;
    geofenceLng: number | null;
    geofenceRadius: number | null;
    tareas: TareaWiz[];
    horasSinTareas: string;
    materiales: MaterialWiz[];
    cargarMateriales: boolean;
    fechaInicio: string;
    fechaFin: string;
    finManual: boolean;
    horasDia: string;
    operadores: string[];
}

let seq = 0;
export const nuevaKey = () => `w${Date.now().toString(36)}${(seq++).toString(36)}`;

export const num = (s: string | number | null | undefined): number => {
    const v = parseFloat(String(s ?? '').replace(/\s/g, '').replace(',', '.'));
    return isFinite(v) ? v : 0;
};

export function estadoInicial(): WizardState {
    const inicio = siguienteDiaHabil(hoyArgentina());
    return {
        origen: null,
        presupuesto: null,
        sugerido: null,
        nombre: '',
        clientId: '',
        responsableId: '',
        categoria: '',
        tipoActividad: '',
        tags: [],
        observaciones: '',
        generarOS: false,
        aprovisionamiento: false,
        listaPrecioId: '',
        fichajeHabilitado: false,
        geofenceLat: null,
        geofenceLng: null,
        geofenceRadius: null,
        tareas: [],
        horasSinTareas: '',
        materiales: [],
        cargarMateriales: true,
        fechaInicio: inicio,
        fechaFin: inicio,
        finManual: false,
        horasDia: '8',
        operadores: [],
    };
}

/** Arma el estado del wizard con la precarga de un presupuesto aceptado. */
export function estadoDesdePrecarga(pre: any): WizardState {
    const s = pre.sugerido;
    return {
        ...estadoInicial(),
        origen: 'presupuesto',
        presupuesto: pre.presupuesto,
        sugerido: s,
        nombre: s.nombre,
        clientId: s.clientId || '',
        tags: s.tags || [],
        observaciones: s.observaciones || '',
        aprovisionamiento: Boolean(s.aprovisionamiento),
        listaPrecioId: s.listaPrecioId || '',
        tareas: (s.tareas || []).map((t: any) => ({
            key: nuevaKey(),
            descripcion: t.descripcion,
            etiqueta: t.etiqueta || '',
            horasEstimadas: String(t.horasEstimadas),
            presupuestoTareaId: t.presupuestoTareaId || null,
            horasPresupuesto: t.horasEstimadas,
        })),
        materiales: (s.materiales || []).map((m: any) => ({
            key: nuevaKey(),
            productoId: m.productoId || null,
            codigo: m.codigo || '',
            nombre: m.nombre,
            unidad: m.unidad || 'unidad',
            cantidad: String(m.cantidad),
            cantidadPresupuesto: m.cantidad,
            precioVenta: m.precioVenta ?? null,
        })),
        cargarMateriales: (s.materiales || []).length > 0,
        fechaInicio: s.fechaInicio,
        fechaFin: s.fechaFin,
        finManual: false,
    };
}

export function horasTotales(s: WizardState): number {
    return s.tareas.length ? Math.round(s.tareas.reduce((a, t) => a + num(t.horasEstimadas), 0) * 100) / 100 : num(s.horasSinTareas);
}

/** Fin sugerido según horas, operadores elegidos (o los del presupuesto) y horas por día. */
export function finSugerido(s: WizardState): { fin: string; dias: number } | null {
    if (!esFecha(s.fechaInicio)) return null;
    const operarios = s.operadores.length || s.sugerido?.operariosSimultaneos || 1;
    const dias = diasHabilesEstimados(horasTotales(s), operarios, num(s.horasDia) || 8);
    if (dias <= 0) return null;
    return { fin: finSegunDiasHabiles(s.fechaInicio, dias), dias };
}

export function diasDelRango(s: WizardState): number {
    return contarDiasHabiles(s.fechaInicio, s.fechaFin);
}

/** Errores por paso. Clave = campo, valor = mensaje. */
export function erroresPaso(paso: number, s: WizardState): Record<string, string> {
    const e: Record<string, string> = {};
    if (paso === 1 && !s.origen) e.origen = 'Elegí el origen del proyecto';
    if (paso === 1 && s.origen === 'presupuesto' && !s.presupuesto) e.presupuesto = 'Elegí el presupuesto aceptado';
    if (paso === 2) {
        if (s.nombre.trim().length < 3) e.nombre = 'Escribí el nombre del proyecto (al menos 3 caracteres)';
    }
    if (paso === 3) {
        s.tareas.forEach((t, i) => {
            if (!t.descripcion.trim()) e[`tarea.${i}.descripcion`] = 'Escribí qué hay que hacer';
            if (!(num(t.horasEstimadas) > 0)) e[`tarea.${i}.horas`] = 'Mayor a 0';
        });
    }
    if (paso === 4) {
        s.materiales.forEach((m, i) => {
            if (!m.nombre.trim()) e[`material.${i}.nombre`] = 'Escribí la descripción';
            if (!(num(m.cantidad) > 0)) e[`material.${i}.cantidad`] = 'Mayor a 0';
        });
    }
    if (paso === 5) {
        if (!esFecha(s.fechaInicio)) e.fechaInicio = 'Elegí la fecha de inicio';
        if (!esFecha(s.fechaFin)) e.fechaFin = 'Elegí la fecha de fin';
        else if (esFecha(s.fechaInicio) && s.fechaFin < s.fechaInicio) e.fechaFin = 'La fecha de fin no puede ser anterior a la de inicio';
        const h = num(s.horasDia);
        if (!(h >= 1 && h <= 24)) e.horasDia = 'Entre 1 y 24 horas';
    }
    return e;
}

export function payload(s: WizardState, borradorId: string | null) {
    return {
        presupuestoId: s.origen === 'presupuesto' ? s.presupuesto?.id || null : null,
        borradorId,
        nombre: s.nombre.trim(),
        clientId: s.clientId || null,
        responsableId: s.responsableId || null,
        categoria: s.categoria || null,
        tipoActividad: s.tipoActividad || null,
        tags: s.tags,
        observaciones: s.observaciones || null,
        fechaInicio: s.fechaInicio,
        fechaFin: s.fechaFin,
        horasDia: num(s.horasDia) || 8,
        horasEstimadas: s.tareas.length ? null : num(s.horasSinTareas),
        generarOS: s.generarOS,
        aprovisionamiento: s.aprovisionamiento,
        cargarMateriales: s.cargarMateriales,
        listaPrecioId: s.aprovisionamiento ? s.listaPrecioId || null : null,
        fichajeHabilitado: s.fichajeHabilitado,
        geofenceLat: s.fichajeHabilitado ? s.geofenceLat : null,
        geofenceLng: s.fichajeHabilitado ? s.geofenceLng : null,
        geofenceRadius: s.fichajeHabilitado ? s.geofenceRadius : null,
        tareas: s.tareas.map((t) => ({ descripcion: t.descripcion.trim(), etiqueta: t.etiqueta || null, horasEstimadas: num(t.horasEstimadas), presupuestoTareaId: t.presupuestoTareaId })),
        materiales: s.materiales.map((m) => ({ productoId: m.productoId, codigo: m.codigo || null, nombre: m.nombre.trim(), unidad: m.unidad || 'unidad', cantidad: num(m.cantidad), precioVenta: m.precioVenta })),
        operadores: s.operadores,
    };
}

/** Cambios del proyecto respecto del presupuesto, en lenguaje llano. */
export function cambiosVsPresupuesto(s: WizardState): string[] {
    if (s.origen !== 'presupuesto' || !s.presupuesto || !s.sugerido) return [];
    const c: string[] = [];
    const sug = s.sugerido;
    if (s.nombre.trim() !== sug.nombre) c.push('Nombre del proyecto editado');
    if (s.clientId !== (sug.clientId || '')) c.push('Cliente cambiado');
    if (s.observaciones !== (sug.observaciones || '')) c.push('Observaciones editadas');
    const tagsSug = [...sug.tags].sort().join('|');
    if ([...s.tags].sort().join('|') !== tagsSug) c.push('Etiquetas técnicas cambiadas');
    for (const t of s.tareas) {
        if (!t.presupuestoTareaId) c.push(`Tarea agregada: ${t.descripcion || 'sin descripción'} (${num(t.horasEstimadas)} h)`);
        else if (t.horasPresupuesto !== null && num(t.horasEstimadas) !== t.horasPresupuesto) c.push(`${t.descripcion}: ${t.horasPresupuesto} h → ${num(t.horasEstimadas)} h`);
    }
    const tareasActuales = new Set(s.tareas.map((t) => t.presupuestoTareaId).filter(Boolean));
    for (const t of sug.tareas || []) if (t.presupuestoTareaId && !tareasActuales.has(t.presupuestoTareaId)) c.push(`Tarea quitada: ${t.descripcion} (${t.horasEstimadas} h)`);
    const matActuales = new Set(s.materiales.map((m) => `${m.codigo}|${m.nombre}`));
    for (const m of sug.materiales || []) if (!matActuales.has(`${m.codigo || ''}|${m.nombre}`)) c.push(`Material quitado: ${m.nombre}`);
    const horas = horasTotales(s);
    if (Math.round(horas * 100) !== Math.round(s.presupuesto.horas * 100)) c.push(`Horas: ${s.presupuesto.horas} h → ${horas} h`);
    for (const m of s.materiales) {
        if (m.cantidadPresupuesto === null) c.push(`Material agregado: ${m.nombre || 'sin descripción'}`);
        else if (num(m.cantidad) !== m.cantidadPresupuesto) c.push(`${m.nombre}: ${m.cantidadPresupuesto} → ${num(m.cantidad)} ${m.unidad}`);
    }
    if (!s.cargarMateriales && s.materiales.length) c.push('Materiales sin cargar en aprovisionamiento');
    if (s.fechaInicio !== sug.fechaInicio || s.fechaFin !== sug.fechaFin) c.push(`Fechas: ${fmt(sug.fechaInicio)} – ${fmt(sug.fechaFin)} → ${fmt(s.fechaInicio)} – ${fmt(s.fechaFin)}`);
    return c;
}

export function fmt(f: string | null | undefined): string {
    if (!f) return '—';
    const [y, m, d] = f.split('-');
    return `${d}/${m}/${y}`;
}

/** Marca de un dato que viene del presupuesto (o que se cambió, con opción de restaurarlo). */
export function MarcaOrigen({ desdePresupuesto, modificado, onRestaurar, texto = 'Presupuesto' }: { desdePresupuesto: boolean; modificado?: boolean; onRestaurar?: () => void; texto?: string }) {
    if (!desdePresupuesto) return null;
    if (modificado) {
        return (
            <span className="inline-flex items-center gap-1.5">
                <Badge tone="neutral">Modificado</Badge>
                {onRestaurar && (
                    <button type="button" onClick={onRestaurar} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <RotateCcw className="w-3 h-3" aria-hidden="true" /> Restaurar
                    </button>
                )}
            </span>
        );
    }
    return <Badge tone="neutral"><FileText aria-hidden="true" />{texto}</Badge>;
}
