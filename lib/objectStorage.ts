// Almacenamiento de archivos compatible con S3 (Neon Storage). Solo servidor.
// Firma SigV4 por query string (URLs prefirmadas) con `crypto`, sin SDK.
//
// Variables: AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
// AWS_REGION (por defecto us-east-1) y S3_BUCKET (por defecto sgi-archivos).
import { createHash, createHmac } from 'crypto';

interface StorageConfig {
    endpoint: URL;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucket: string;
}

function config(): StorageConfig | null {
    const endpoint = process.env.AWS_ENDPOINT_URL_S3?.trim();
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
    if (!endpoint || !accessKeyId || !secretAccessKey) return null;
    return {
        endpoint: new URL(endpoint),
        accessKeyId,
        secretAccessKey,
        region: process.env.AWS_REGION?.trim() || 'us-east-1',
        bucket: process.env.S3_BUCKET?.trim() || 'sgi-archivos',
    };
}

export const storageConfigurado = () => config() !== null;

function requerirConfig(): StorageConfig {
    const c = config();
    if (!c) throw new Error('El almacenamiento de archivos no está configurado (AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).');
    return c;
}

// RFC 3986: encodeURIComponent deja sin codificar !'()*
const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const sha256Hex = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const hmac = (key: Buffer | string, s: string) => createHmac('sha256', key).update(s, 'utf8').digest();

export type MetodoStorage = 'GET' | 'PUT' | 'DELETE' | 'HEAD';

/**
 * URL prefirmada (path-style) para un objeto del bucket.
 * Solo se firma el header Host: quien la use puede mandar Content-Type libremente.
 */
export function urlPrefirmada(
    metodo: MetodoStorage,
    key: string,
    opciones: { expiraEnSeg?: number; descargaComo?: string; tipo?: string } = {},
): string {
    const c = requerirConfig();
    const ahora = new Date();
    const amzDate = ahora.toISOString().replace(/[:-]|\.\d{3}/g, ''); // AAAAMMDDTHHMMSSZ
    const fecha = amzDate.slice(0, 8);
    const scope = `${fecha}/${c.region}/s3/aws4_request`;

    const basePath = c.endpoint.pathname.replace(/\/+$/, '');
    const ruta = `${basePath}/${[c.bucket, ...key.split('/')].map(rfc3986).join('/')}`;

    const params: Record<string, string> = {
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': `${c.accessKeyId}/${scope}`,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': String(Math.min(Math.max(opciones.expiraEnSeg ?? 300, 1), 604800)),
        'X-Amz-SignedHeaders': 'host',
    };
    if (opciones.descargaComo) params['response-content-disposition'] = `inline; filename*=UTF-8''${rfc3986(opciones.descargaComo)}`;
    if (opciones.tipo) params['response-content-type'] = opciones.tipo;

    const query = Object.keys(params).sort().map(k => `${rfc3986(k)}=${rfc3986(params[k])}`).join('&');
    const canonical = [metodo, ruta, query, `host:${c.endpoint.host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
    const aFirmar = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonical)].join('\n');

    const kFecha = hmac(`AWS4${c.secretAccessKey}`, fecha);
    const kFirma = hmac(hmac(hmac(kFecha, c.region), 's3'), 'aws4_request');
    const firma = createHmac('sha256', kFirma).update(aFirmar, 'utf8').digest('hex');

    return `${c.endpoint.protocol}//${c.endpoint.host}${ruta}?${query}&X-Amz-Signature=${firma}`;
}

async function fallo(res: Response, accion: string) {
    let detalle = '';
    try { detalle = (await res.text()).slice(0, 300); } catch { /* sin cuerpo */ }
    return new Error(`Almacenamiento: no se pudo ${accion} (HTTP ${res.status}). ${detalle}`.trim());
}

export async function subirObjeto(key: string, datos: Buffer, tipo: string) {
    const res = await fetch(urlPrefirmada('PUT', key), { method: 'PUT', body: new Uint8Array(datos), headers: { 'Content-Type': tipo } });
    if (!res.ok) throw await fallo(res, 'guardar el archivo');
}

export async function leerObjeto(key: string): Promise<Buffer> {
    const res = await fetch(urlPrefirmada('GET', key), { cache: 'no-store' });
    if (!res.ok) throw await fallo(res, 'leer el archivo');
    return Buffer.from(await res.arrayBuffer());
}

/** Tamaño del objeto, o null si no existe. */
export async function tamanioObjeto(key: string): Promise<number | null> {
    const res = await fetch(urlPrefirmada('HEAD', key), { method: 'HEAD', cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw await fallo(res, 'consultar el archivo');
    return Number(res.headers.get('content-length') || 0);
}

export async function borrarObjeto(key: string) {
    const res = await fetch(urlPrefirmada('DELETE', key), { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw await fallo(res, 'borrar el archivo');
}
