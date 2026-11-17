/**
 * Cliente de las APIs de EPP (app/api/rrhh/epp/** y /api/public/epp-matriz).
 *
 * Mantiene la forma { success, data, error } que usaban las pantallas. Quién
 * hace cada acción lo decide el servidor con la sesión: estas funciones no
 * mandan nombres ni ids de usuario.
 */

export interface ResultadoEpp<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

const BASE = '/api/rrhh/epp';

async function pedir<T = any>(url: string, init?: RequestInit): Promise<ResultadoEpp<T>> {
    let res: Response;
    try {
        res = await fetch(url, {
            ...init,
            cache: 'no-store',
            headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
        });
    } catch {
        return { success: false, error: 'Sin conexión con el servidor' };
    }

    let body: any = null;
    try {
        body = await res.json();
    } catch {
        body = null;
    }

    if (body && typeof body === 'object' && 'success' in body) return body as ResultadoEpp<T>;
    if (res.status === 401) return { success: false, error: 'Iniciá sesión para continuar' };
    if (res.status === 403) return { success: false, error: 'No tenés permiso para esta acción' };
    return { success: false, error: body?.error || `Error ${res.status}` };
}

const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) });

// ── Gestión (RRHH) ─────────────────────────────────────────────────

export const getEppMatrix = () => pedir(`${BASE}/matriz`);

export const getEppCatalog = () => pedir<any[]>(`${BASE}/catalogo`);

export const createEppItem = (data: {
    nombre: string;
    codigo?: string;
    descripcion?: string;
    categoria: string;
    esGlobal: boolean;
    diasValidez: number;
    stockActual: number;
    stockMinimo: number;
    talle?: string;
    marca?: string;
    normaCertificacion?: string;
}) => pedir(`${BASE}/catalogo`, json('POST', data));

export const updateEppItem = (id: string, data: {
    nombre?: string;
    codigo?: string;
    descripcion?: string;
    categoria?: string;
    esGlobal?: boolean;
    diasValidez?: number;
    stockMinimo?: number;
    talle?: string;
    marca?: string;
    normaCertificacion?: string;
    activo?: boolean;
    ajusteStock?: { nuevoStock: number; motivo: string };
}) => pedir(`${BASE}/catalogo/${encodeURIComponent(id)}`, json('PATCH', data));

export const addEppStock = ({ eppItemId, ...data }: {
    eppItemId: string;
    cantidad: number;
    remitoFactura?: string;
    proveedor?: string;
    motivo?: string;
}) => pedir(`${BASE}/catalogo/${encodeURIComponent(eppItemId)}/stock`, json('POST', data));

export const getEppStockMovements = (eppItemId?: string) =>
    pedir<any[]>(`${BASE}/movimientos${eppItemId ? `?eppItemId=${encodeURIComponent(eppItemId)}` : ''}`);

export const createEppDelivery = (data: {
    operatorId: string;
    items: Array<{ eppItemId: string; cantidad: number; talle?: string }>;
    observaciones?: string;
    firmaPresencialBase64?: string;
    signatureId?: string;
    signatureHash?: string;
}) => pedir(`${BASE}/entregas`, json('POST', data));

export const getEppRequests = () => pedir<any[]>(`${BASE}/solicitudes`);

export const resolveEppRequest = ({ requestId, ...data }: {
    requestId: string;
    accion: 'APROBAR' | 'RECHAZAR';
    motivoRechazo?: string;
}) => pedir(`${BASE}/solicitudes/${encodeURIComponent(requestId)}`, json('PATCH', data));

export const getOperatorEppProfile = (operatorId: string) =>
    pedir(`${BASE}/operadores/${encodeURIComponent(operatorId)}`);

export const getClientsForEppShare = () => pedir<any[]>(`${BASE}/enlaces/clientes`);

export const createEppPublicShare = (data: {
    tipo: 'GENERAL' | 'CLIENTE';
    clientId?: string;
    titulo?: string;
}) => pedir(`${BASE}/enlaces`, json('POST', data));

export const getEppPublicShares = () => pedir<any[]>(`${BASE}/enlaces`);

export const deleteEppPublicShare = (id: string) =>
    pedir(`${BASE}/enlaces/${encodeURIComponent(id)}`, { method: 'DELETE' });

// ── Mis EPP (operador de la sesión) ────────────────────────────────

export const getMyEppData = () => pedir(`${BASE}/mis-epp`);

export const signEppDelivery = ({ deliveryId, ...data }: {
    deliveryId: string;
    itemIdsConfirmed: string[];
    signatureId: string;
    signatureHash: string;
    firmaManuscritaUrl?: string;
}) => pedir(`${BASE}/mis-epp/entregas/${encodeURIComponent(deliveryId)}/firma`, json('POST', data));

export const createOperatorEppRequest = (data: {
    eppItemId: string;
    talle?: string;
    motivo: string;
    comentario?: string;
}) => pedir(`${BASE}/mis-epp/solicitudes`, json('POST', data));

// ── Público por token ──────────────────────────────────────────────

export const getPublicEppMatrixData = (token: string) =>
    pedir(`/api/public/epp-matriz/${encodeURIComponent(token)}`);
