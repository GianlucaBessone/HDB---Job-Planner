// Carga de Google Maps JavaScript API (sin dependencias: script oficial con importLibrary).
// Se activa con NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Sin clave, o si Google la rechaza,
// el módulo de viajes usa OpenStreetMap (ver distancia.ts).
//
// La clave de Maps para navegador es pública por diseño: hay que restringirla en
// Google Cloud por referente HTTP (dominio de la app) y por API
// (Maps JavaScript API, Places API (New), Geocoding API).

/* eslint-disable @typescript-eslint/no-explicit-any */

const CLAVE = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

let carga: Promise<any> | null = null;
let rechazada = false;
const oyentes = new Set<() => void>();

/** Hay clave configurada y Google no la rechazó. */
export function googleDisponible(): boolean {
    return !!CLAVE && !rechazada && typeof window !== 'undefined';
}

/** Avisa cuando Google rechaza la clave, para pasar a OpenStreetMap. */
export function alRechazarGoogle(fn: () => void): () => void {
    oyentes.add(fn);
    return () => { oyentes.delete(fn); };
}

function marcarRechazo(motivo: string) {
    if (rechazada) return;
    rechazada = true;
    console.warn(`[VIAJES_MAPS] Google Maps no disponible (${motivo}). Se usa OpenStreetMap.`);
    oyentes.forEach(fn => fn());
}

/** Devuelve `google.maps` con las librerías maps, places y geocoding listas. */
export function cargarGoogleMaps(): Promise<any> {
    if (!googleDisponible()) return Promise.reject(new Error('Google Maps no está configurado.'));
    if (carga) return carga;

    carga = new Promise((resolve, reject) => {
        const w = window as any;
        // Google llama a esta función global cuando la clave es inválida o no tiene permiso.
        w.gm_authFailure = () => { marcarRechazo('clave rechazada'); reject(new Error('Google rechazó la clave de Maps.')); };
        w.__viajesMapsListo = async () => {
            try {
                const g = w.google.maps;
                await Promise.all([g.importLibrary('maps'), g.importLibrary('places'), g.importLibrary('geocoding')]);
                resolve(g);
            } catch (e) {
                marcarRechazo('librerías');
                reject(e);
            }
        };
        const qs = new URLSearchParams({ key: CLAVE, v: 'weekly', language: 'es', region: 'AR', loading: 'async', callback: '__viajesMapsListo' });
        const s = document.createElement('script');
        s.src = `https://maps.googleapis.com/maps/api/js?${qs}`;
        s.async = true;
        s.onerror = () => { marcarRechazo('sin conexión'); reject(new Error('No se pudo cargar Google Maps.')); };
        document.head.appendChild(s);
    });
    carga.catch(() => { carga = null; });
    return carga;
}
