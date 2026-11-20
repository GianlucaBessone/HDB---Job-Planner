// EPP: cliente de las API routes para las pantallas. Mismos nombres que las
// antiguas server actions y la misma respuesta { success, data?, error? }.
// La identidad (quién entrega, registra, resuelve o firma) la pone el servidor desde la sesión.
import type * as Server from '@/lib/rrhh/eppServer';
import type {
    EppEnlace, EppEntrega, EppIngresoStock, EppItemCrear, EppItemEditar, EppResolverSolicitud, EppSolicitud,
} from '@/lib/rrhh/epp';

/** Lo que llega por JSON: las fechas viajan como texto. */
type Json<T> = T extends Date
    ? string
    : T extends (infer U)[]
      ? Json<U>[]
      : T extends object
        ? { [K in keyof T]: Json<T[K]> }
        : T;

type Datos<F extends (...args: any[]) => Promise<unknown>> = Json<Awaited<ReturnType<F>>>;

export type Resultado<T> = { success: true; data: T; error?: undefined } | { success: false; data?: undefined; error: string };

async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<Resultado<T>> {
    try {
        const res = await fetch(url, {
            method: init?.method ?? 'GET',
            headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
            body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
            cache: 'no-store',
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
            const error = json?.error || (res.status === 401 ? 'Tu sesión expiró. Volvé a ingresar.' : res.status === 403 ? 'No tenés permiso para esta acción.' : 'Error de conexión con el servidor');
            return { success: false, error };
        }
        return { success: true, data: json?.data as T };
    } catch {
        return { success: false, error: 'Error de conexión con el servidor' };
    }
}

const BASE = '/api/rrhh/epp';
const seg = (id: string) => encodeURIComponent(id);

// ── Matriz, catálogo y stock ────────────────────────────────────────

export const getEppMatrix = () => api<Datos<typeof Server.getEppMatrix>>(`${BASE}/matriz`);

export const getEppCatalog = () => api<Datos<typeof Server.getEppCatalog>>(`${BASE}/catalogo`);

export const createEppItem = (data: EppItemCrear) =>
    api<Datos<typeof Server.createEppItem>>(`${BASE}/catalogo`, { method: 'POST', body: data });

/** Edita el elemento; con `ajusteStock` también corrige el stock con motivo. */
export const updateEppItem = (id: string, data: EppItemEditar) =>
    api<Datos<typeof Server.updateEppItem>>(`${BASE}/catalogo/${seg(id)}`, { method: 'PATCH', body: data });

export const addEppStock = ({ eppItemId, ...data }: EppIngresoStock & { eppItemId: string }) =>
    api<Datos<typeof Server.addEppStock>>(`${BASE}/catalogo/${seg(eppItemId)}/stock`, { method: 'POST', body: data });

export const getEppStockMovements = (eppItemId?: string) =>
    api<Datos<typeof Server.getEppStockMovements>>(`${BASE}/movimientos${eppItemId ? `?eppItemId=${seg(eppItemId)}` : ''}`);

// ── Entregas, solicitudes y fichas ──────────────────────────────────

export const createEppDelivery = (data: EppEntrega) =>
    api<Datos<typeof Server.createEppDelivery>>(`${BASE}/entregas`, { method: 'POST', body: data });

export const getEppRequests = () => api<Datos<typeof Server.getEppRequests>>(`${BASE}/solicitudes`);

export const resolveEppRequest = ({ requestId, ...data }: EppResolverSolicitud & { requestId: string }) =>
    api<Datos<typeof Server.resolveEppRequest>>(`${BASE}/solicitudes/${seg(requestId)}`, { method: 'PATCH', body: data });

export const getOperatorEppProfile = (operatorId: string) =>
    api<Datos<typeof Server.getOperatorEppProfile>>(`${BASE}/operadores/${seg(operatorId)}`);

// ── Enlaces públicos ────────────────────────────────────────────────

export const getClientsForEppShare = () => api<Datos<typeof Server.getClientsForEppShare>>(`${BASE}/clientes`);

export const createEppPublicShare = (data: EppEnlace) =>
    api<Datos<typeof Server.createEppPublicShare>>(`${BASE}/enlaces`, { method: 'POST', body: data });

export const getEppPublicShares = () => api<Datos<typeof Server.getEppPublicShares>>(`${BASE}/enlaces`);

export const deleteEppPublicShare = (id: string) => api<null>(`${BASE}/enlaces/${seg(id)}`, { method: 'DELETE' });

/** Matriz del enlace público (no requiere sesión). */
export const getPublicEppMatrixData = (token: string) =>
    api<Datos<typeof Server.getPublicEppMatrixData>>(`/api/public/epp-matriz/${seg(token)}`);

// ── Mis EPP (operario de la sesión) ─────────────────────────────────

export const getMyEppData = () => api<Datos<typeof Server.getMyEppData>>('/api/mis-epp');

/** Firma un acta propia. La firma con checksum se genera en el servidor. */
export const signEppDelivery = ({ deliveryId, ...data }: { deliveryId: string; itemIdsConfirmed: string[]; deviceId?: string; firmaManuscritaUrl?: string }) =>
    api<Datos<typeof Server.signEppDelivery>>(`/api/mis-epp/entregas/${seg(deliveryId)}/firmar`, { method: 'POST', body: data });

export const createOperatorEppRequest = (data: EppSolicitud) =>
    api<Datos<typeof Server.createOperatorEppRequest>>('/api/mis-epp/solicitudes', { method: 'POST', body: data });
