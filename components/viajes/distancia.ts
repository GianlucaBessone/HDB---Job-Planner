// Búsqueda de lugares y distancia por ruta con OpenStreetMap, sin clave de API.
// - Photon (komoot): búsqueda mientras se escribe y búsqueda inversa al tocar el mapa.
// - OSRM: recorrido en auto entre origen y destino (km y trazado).

export interface Lugar { nombre: string; detalle: string; lat: number; lon: number }
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

/** Sugerencias mientras se escribe (mínimo 3 letras). Cancelable con AbortSignal. */
export async function buscarLugares(texto: string, signal?: AbortSignal): Promise<Lugar[]> {
    const q = texto.trim();
    if (q.length < 3) return [];
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
    return l;
}
