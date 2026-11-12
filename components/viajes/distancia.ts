// Búsqueda de lugares y distancia por ruta.
// - Con Google Maps configurado (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY): Places (New) sugiere
//   mientras se escribe y Geocoding nombra el punto tocado en el mapa.
// - Sin Google, o si rechaza la clave: Photon (OpenStreetMap), sin clave de API.
// - La ruta y los km salen siempre de OSRM (OpenStreetMap), gratis y sin clave.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { cargarGoogleMaps, googleDisponible } from './googleMaps';

/** Lugar elegido. Una sugerencia de Google llega sin coordenadas (lat/lon NaN) hasta resolverla. */
export interface Lugar { nombre: string; detalle: string; lat: number; lon: number; placeId?: string }

export const tieneCoordenadas = (l: Lugar | null | undefined): boolean => !!l && Number.isFinite(l.lat) && Number.isFinite(l.lon);
export interface Ruta { km: number; trazado: [number, number][] }

const PHOTON = 'https://photon.komoot.io';
const OSRM = 'https://router.project-osrm.org/route/v1/driving';
// Argentina (minLon, minLat, maxLon, maxLat): las sugerencias se limitan al país.
const BBOX_AR = '-73.6,-55.1,-53.6,-21.7';
// Centro aproximado de Córdoba para ordenar primero lo cercano.
const SESGO = { lat: -31.4, lon: -64.2 };

const TIPOS_LUGAR = new Set(['city', 'town', 'village', 'hamlet', 'suburb', 'locality', 'district', 'county', 'neighbourhood']);

async function conTope<T>(p: Promise<T>, ms: number, mensaje: string): Promise<T> {
    let t: ReturnType<typeof setTimeout> | undefined;
    const tope = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error(mensaje)), ms); });
    try { return await Promise.race([p, tope]); } finally { clearTimeout(t); }
}

function aLugar(f: any): Lugar | null {
    const p = f?.properties || {};
    const [lon, lat] = f?.geometry?.coordinates || [];
    if (typeof lat !== 'number' || typeof lon !== 'number') return null;
    const nombre = p.name || p.street || p.city || p.county;
    if (!nombre) return null;
    const lugar = p.city && p.city !== nombre ? p.city : p.county && p.county !== nombre ? p.county : null;
    const detalle = [lugar, p.state, p.country && p.country !== 'Argentina' ? p.country : null].filter(Boolean).join(', ');
    return { nombre: p.street && p.housenumber ? `${p.street} ${p.housenumber}` : nombre, detalle, lat, lon };
}

/** Texto que se guarda en el viaje: "Arroyito, Córdoba". */
export function etiquetaLugar(l: Lugar): string {
    const provincia = l.detalle.split(', ').pop();
    return provincia && provincia !== l.nombre ? `${l.nombre}, ${provincia}` : l.nombre;
}

// ── Google ──────────────────────────────────────────────────────────

let sesionGoogle: any = null; // agrupa las consultas de una búsqueda (se factura por sesión)

async function buscarGoogle(q: string, signal?: AbortSignal): Promise<Lugar[]> {
    const g = await cargarGoogleMaps();
    if (signal?.aborted) throw new DOMException('Cancelada', 'AbortError');
    const { AutocompleteSuggestion, AutocompleteSessionToken } = g.places;
    sesionGoogle ||= new AutocompleteSessionToken();
    const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: q,
        includedRegionCodes: ['ar'],
        language: 'es',
        region: 'ar',
        sessionToken: sesionGoogle,
        locationBias: { center: { lat: SESGO.lat, lng: SESGO.lon }, radius: 50000 },
    });
    if (signal?.aborted) throw new DOMException('Cancelada', 'AbortError');
    return (suggestions || [])
        .map((s: any) => s.placePrediction)
        .filter(Boolean)
        .slice(0, 6)
        .map((p: any) => ({
            nombre: p.mainText?.text || p.text?.text || '',
            detalle: (p.secondaryText?.text || '').replace(/, Argentina$/, ''),
            lat: NaN,
            lon: NaN,
            placeId: p.placeId,
        }))
        .filter((l: Lugar) => l.nombre);
}

async function resolverGoogle(l: Lugar): Promise<Lugar> {
    const g = await cargarGoogleMaps();
    const place = new g.places.Place({ id: l.placeId, requestedLanguage: 'es' });
    await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress'] });
    sesionGoogle = null; // la sesión termina al elegir un lugar
    const loc = place.location;
    return { ...l, lat: loc.lat(), lon: loc.lng() };
}

function componente(res: any, tipo: string): string | undefined {
    return res?.address_components?.find((c: any) => c.types?.includes(tipo))?.long_name;
}

async function lugarEnGoogle(lat: number, lon: number): Promise<Lugar | null> {
    const g = await cargarGoogleMaps();
    const geocoder = new g.Geocoder();
    const { results } = await geocoder.geocode({ location: { lat, lng: lon }, language: 'es' });
    const r = results?.[0];
    if (!r) return null;
    const localidad = componente(r, 'locality') || componente(r, 'administrative_area_level_2') || componente(r, 'sublocality');
    const provincia = componente(r, 'administrative_area_level_1');
    return { nombre: localidad || r.formatted_address, detalle: [componente(r, 'administrative_area_level_2'), provincia].filter(Boolean).join(', '), lat, lon };
}

// ── Público ─────────────────────────────────────────────────────────

/** Coordenadas de una sugerencia (las de Google llegan sin coordenadas). */
export async function resolverLugar(l: Lugar): Promise<Lugar> {
    if (tieneCoordenadas(l)) return l;
    if (l.placeId && googleDisponible()) return resolverGoogle(l);
    throw new Error('No se pudo ubicar el lugar. Elegilo en el mapa.');
}

/** Sugerencias mientras se escribe (mínimo 3 letras). Cancelable con AbortSignal. */
export async function buscarLugares(texto: string, signal?: AbortSignal): Promise<Lugar[]> {
    const q = texto.trim();
    if (q.length < 3) return [];
    if (googleDisponible()) {
        try {
            return await buscarGoogle(q, signal);
        } catch (e: any) {
            if (e?.name === 'AbortError') throw e;
            if (googleDisponible()) throw e; // error puntual de Google: se informa
            // Google rechazó la clave: se sigue con OpenStreetMap
        }
    }
    const qs = new URLSearchParams({ q, limit: '8', bbox: BBOX_AR, lat: String(SESGO.lat), lon: String(SESGO.lon) });
    const res = await fetch(`${PHOTON}/api/?${qs}`, { signal });
    if (!res.ok) throw new Error('El buscador de lugares no respondió.');
    const data = await res.json();
    const features: any[] = Array.isArray(data?.features) ? data.features : [];
    // Primero ciudades y localidades, después calles y puntos de interés.
    features.sort((a, b) => Number(!TIPOS_LUGAR.has(a?.properties?.osm_value)) - Number(!TIPOS_LUGAR.has(b?.properties?.osm_value)));
    const vistos = new Set<string>();
    return features.map(aLugar).filter((l): l is Lugar => {
        if (!l) return false;
        const k = `${l.nombre}|${l.detalle}`;
        if (vistos.has(k)) return false;
        vistos.add(k);
        return true;
    }).slice(0, 6);
}

/** Nombre del lugar donde se tocó el mapa. */
export async function lugarEn(lat: number, lon: number): Promise<Lugar> {
    const fallback: Lugar = { nombre: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, detalle: '', lat, lon };
    if (googleDisponible()) {
        try { return (await lugarEnGoogle(lat, lon)) || fallback; } catch { /* sigue con OpenStreetMap */ }
    }
    try {
        const res = await conTope(fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lon}`), 8000, 'timeout');
        if (!res.ok) return fallback;
        const data = await res.json();
        const l = aLugar(data?.features?.[0]);
        return l ? { ...l, lat, lon } : fallback;
    } catch {
        return fallback;
    }
}

/** Recorrido en auto entre dos puntos. */
export async function calcularRuta(a: { lat: number; lon: number }, b: { lat: number; lon: number }): Promise<Ruta> {
    const res = await conTope(
        fetch(`${OSRM}/${a.lon},${a.lat};${b.lon},${b.lat}?overview=simplified&geometries=geojson`),
        12000,
        'El servicio de rutas no respondió. Cargá los km a mano.',
    );
    if (!res.ok) throw new Error('No se pudo calcular la ruta. Cargá los km a mano.');
    const data = await res.json();
    const r = data?.routes?.[0];
    if (data?.code !== 'Ok' || typeof r?.distance !== 'number') throw new Error('No hay ruta en auto entre esos lugares. Cargá los km a mano.');
    const trazado = (r.geometry?.coordinates || []).map(([lon, lat]: [number, number]) => [lat, lon] as [number, number]);
    return { km: Math.round(r.distance / 100) / 10, trazado };
}

/** Para origen/destino escritos a mano: toma la primera coincidencia de cada uno. */
export async function ubicarTexto(texto: string): Promise<Lugar> {
    const [l] = await conTope(buscarLugares(texto), 10000, 'El buscador de lugares no respondió. Cargá los km a mano.');
    if (!l) throw new Error(`No encontramos "${texto}". Elegilo de la lista o en el mapa.`);
    return resolverLugar(l);
}
