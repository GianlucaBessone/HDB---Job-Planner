'use client';

/** Pedidos del portal del cliente: devuelve el JSON o lanza el mensaje de error de la API. */
export async function portalApi<T = any>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
    const { json, ...rest } = init;
    const r = await fetch(url, {
        cache: 'no-store',
        ...rest,
        ...(json !== undefined ? { body: JSON.stringify(json), headers: { 'Content-Type': 'application/json' } } : {}),
    }).catch(() => null);
    if (!r) throw new Error('No se pudo conectar. Revisá la conexión.');
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data?.error || `Error ${r.status}`), { status: r.status });
    return data as T;
}

export const pesosPortal = (n: number) => `$ ${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fechaPortal = (f: string | null | undefined) => {
    if (!f) return '—';
    const d = f.length === 10 ? new Date(`${f}T12:00:00`) : new Date(f);
    return d.toLocaleDateString('es-AR');
};
