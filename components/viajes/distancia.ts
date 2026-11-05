// Distancia por ruta entre origen y destino con OpenStreetMap (sin clave de API).
// Nominatim ubica cada lugar y OSRM calcula el recorrido en auto.
// Se consulta solo al apretar el botón: Nominatim no admite autocompletar por tecla.

export interface LugarEncontrado { nombre: string; lat: number; lon: number }
export interface DistanciaRuta { origen: LugarEncontrado; destino: LugarEncontrado; kmIda: number }

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OSRM = 'https://router.project-osrm.org/route/v1/driving';

async function conTope<T>(p: Promise<T>, ms: number): Promise<T> {
    let t: ReturnType<typeof setTimeout> | undefined;
    const tope = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error('El servicio de mapas no respondió. Cargá los km a mano.')), ms); });
    try { return await Promise.race([p, tope]); } finally { clearTimeout(t); }
}

async function ubicar(texto: string): Promise<LugarEncontrado> {
    const qs = new URLSearchParams({ q: texto, format: 'jsonv2', limit: '1', countrycodes: 'ar', 'accept-language': 'es' });
    const res = await conTope(fetch(`${NOMINATIM}?${qs}`, { headers: { Accept: 'application/json' } }), 10000);
    if (!res.ok) throw new Error('No se pudo consultar el mapa. Cargá los km a mano.');
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error(`No encontramos "${texto}". Probá agregando la provincia (ej.: "Villa del Totoral, Córdoba").`);
    const r = data[0];
    return { nombre: String(r.display_name || texto).split(',').slice(0, 3).join(','), lat: Number(r.lat), lon: Number(r.lon) };
}

export async function calcularDistancia(origen: string, destino: string): Promise<DistanciaRuta> {
    const o = await ubicar(origen);
    // Pausa breve: Nominatim pide no más de una consulta por segundo.
    await new Promise(r => setTimeout(r, 1100));
    const d = await ubicar(destino);
    const res = await conTope(fetch(`${OSRM}/${o.lon},${o.lat};${d.lon},${d.lat}?overview=false`), 10000);
    if (!res.ok) throw new Error('No se pudo calcular la ruta. Cargá los km a mano.');
    const data = await res.json();
    const metros = data?.routes?.[0]?.distance;
    if (data?.code !== 'Ok' || typeof metros !== 'number') throw new Error('No hay ruta en auto entre esos lugares. Cargá los km a mano.');
    return { origen: o, destino: d, kmIda: Math.round(metros / 100) / 10 };
}
