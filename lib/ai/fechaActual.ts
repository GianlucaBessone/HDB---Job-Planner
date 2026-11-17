/**
 * Contexto de fecha actual para la IA.
 *
 * Los modelos tienen una fecha de corte de entrenamiento y, sin otra
 * referencia, toman como "futuras" fechas que ya pasaron (por ejemplo, un CV
 * con experiencia 2025–2026 marcado como inconsistente). Este bloque se agrega
 * a las instrucciones de sistema de TODAS las llamadas, en la capa de
 * proveedores (lib/ai/providers/*), así ningún prompt depende de acordarse.
 */

const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

/** Fecha de hoy en Argentina: { larga: "martes, 17 de noviembre de 2026", iso: "2026-11-17", anio: 2026 }. */
export function fechaActual(ahora: Date = new Date()) {
    const larga = new Intl.DateTimeFormat('es-AR', {
        timeZone: ZONA_HORARIA, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(ahora);
    // en-CA da AAAA-MM-DD
    const iso = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
    return { larga, iso, anio: Number(iso.slice(0, 4)) };
}

export function contextoFechaActual(ahora: Date = new Date()): string {
    const { larga, iso, anio } = fechaActual(ahora);
    return `CONTEXTO TEMPORAL (obligatorio):
- Hoy es ${larga} (${iso}), hora de Argentina. Esta es la fecha actual real: usala como "hoy" en todo el análisis, aunque tu conocimiento sugiera otra.
- Cualquier fecha igual o anterior a ${iso} es pasada o presente, NO futura. Por ejemplo, fechas de ${anio - 1} y de ${anio} hasta hoy ya ocurrieron.
- Solo es futura una fecha posterior a ${iso}. No marques como error, inconsistencia o fecha imposible una fecha anterior o igual a hoy.
- "Actualidad", "Presente", "a la fecha" o un período sin fin significan hasta hoy (${iso}).
- Calculá antigüedades, duraciones, edades de documentos y vencimientos contra esta fecha.`;
}

/** Antepone el contexto de fecha a las instrucciones de sistema. */
export function conFechaActual(systemInstruction?: string): string {
    const base = (systemInstruction || '').trim();
    return base ? `${contextoFechaActual()}\n\n${base}` : contextoFechaActual();
}
