import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';

// =============  DB Schema  =============

interface OfflineDB extends DBSchema {
  pendingActions: {
    key: string;
    value: {
      id: string;
      type: string;
      endpoint: string;
      method: string;
      payload: any;
      timestamp: number;
      retryCount: number;
      status: 'pending' | 'syncing' | 'failed';
    };
  };
  cachedData: {
    key: string;
    value: {
      url: string;
      data: any;
      timestamp: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

async function getDB(): Promise<IDBPDatabase<OfflineDB>> {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is only available in the browser');
  }

  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>('offlineDB', 1, {
      upgrade(db) {
        console.log('[OfflineDB] Upgrading/Creating stores...');
        if (!db.objectStoreNames.contains('pendingActions')) {
          db.createObjectStore('pendingActions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('cachedData')) {
          db.createObjectStore('cachedData', { keyPath: 'url' });
        }
      },
    }).catch(err => {
      console.error('[OfflineDB] Error reaching IndexedDB:', err);
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

// ============= Observer Pattern for UI =============

type SyncStatus = 'online' | 'syncing' | 'offline';
type SyncObserver = (status: SyncStatus, pendingCount: number) => void;
const observers: SyncObserver[] = [];

export function subscribeToSync(observer: SyncObserver) {
  observers.push(observer);
  // Initial notification
  notifyObservers();
  return () => {
    const index = observers.indexOf(observer);
    if (index > -1) observers.splice(index, 1);
  };
}

let currentStatus: SyncStatus = typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline';

async function notifyObservers() {
  try {
    const db = await getDB();
    const actions = await db.getAll('pendingActions');
    const status = !navigator.onLine ? 'offline' : (currentStatus === 'syncing' ? 'syncing' : 'online');
    observers.forEach(obs => obs(status, actions.length));
  } catch {
    observers.forEach(obs => obs(currentStatus, 0));
  }
}

function setStatus(status: SyncStatus) {
  console.log(`[OfflineSync] Status changed to: ${status}`);
  currentStatus = status;
  notifyObservers();
}

// ============= Offline Response helper =============

function createOfflineResponse(data: any, ok = true, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: {
      'Content-Type': 'application/json',
      'X-Offline-Response': 'true'
    }
  });
}

// ============= Safe API Request =============

/**
 * Drop-in replacement for fetch() that handles offline scenarios.
 */
export async function safeApiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();

  // ----------- ONLINE PATH -----------
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const response = await fetch(endpoint, options);

      // Cache GET responses on success
      if (method === 'GET' && response.ok) {
        try {
          const clone = response.clone();
          const data = await clone.json();
          const db = await getDB();
          await db.put('cachedData', { url: endpoint, data, timestamp: Date.now() });
        } catch { /* silently fail cache write */ }
      }

      return response;
    } catch (error) {
      console.warn(`[SafeAPI] Fetch failed for ${endpoint}. Checking if it's a network error:`, error);
      // If fetch explicitly fails (network error), fallback to offline
      return handleOfflineRequest(endpoint, method, options);
    }
  }

  // ----------- OFFLINE PATH -----------
  console.log(`[SafeAPI] Offline detected for ${endpoint} (${method})`);
  return handleOfflineRequest(endpoint, method, options);
}

async function handleOfflineRequest(
  endpoint: string,
  method: string,
  options: RequestInit
): Promise<Response> {
  try {
    const db = await getDB();

    // For GET requests, try to serve from cache
    if (method === 'GET') {
      const cached = await db.get('cachedData', endpoint);
      if (cached) {
        console.log(`[SafeAPI] Serving ${endpoint} from cache`);
        return createOfflineResponse(cached.data);
      }
      return createOfflineResponse({ error: 'Sin conexión y sin datos en caché' }, false, 503);
    }

    // For mutation requests (POST, PUT, DELETE) → queue them
    let payload: any = undefined;
    if (options.body) {
      try {
        if (typeof options.body === 'string') {
          payload = JSON.parse(options.body);
        } else if (options.body instanceof FormData) {
          payload = Object.fromEntries((options.body as any).entries());
        }
      } catch {
        payload = options.body;
      }
    }

    const actionId = uuidv4();
    console.log(`[SafeAPI] Queuing mutation: ${method} ${endpoint} (ID: ${actionId})`);

    await db.put('pendingActions', {
      id: actionId,
      type: `OFFLINE_${method}`,
      endpoint,
      method,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    });

    setStatus('offline');

    // Dispatch event for toast feedback
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('offline-save', {
          detail: { message: 'Guardado localmente. Se sincronizará cuando haya conexión.' },
        })
      );
    }

    // Return a mock success response
    const localId = `local_${uuidv4().slice(0, 8)}`;
    const mockBody = {
      success: true,
      _offline: true,
      id: payload?.id || localId,
      ...(typeof payload === 'object' ? payload : {}),
    };

    return createOfflineResponse(mockBody);
  } catch (err) {
    console.error('[SafeAPI] Critical error in handleOfflineRequest:', err);
    // Ultimate fallback if even IndexedDB fails
    return createOfflineResponse({ error: 'Error crítico en modo offline' }, false, 500);
  }
}

// ============= Sync Engine =============

const MAX_RETRIES = 5;
let isSyncing = false;

export async function processSyncQueue() {
  if (typeof navigator === 'undefined' || !navigator.onLine || isSyncing) return;

  try {
    const db = await getDB();
    const pending = await db.getAll('pendingActions');

    if (pending.length === 0) {
      setStatus('online');
      return;
    }

    console.log(`[SyncEngine] Starting synchronization of ${pending.length} actions...`);
    isSyncing = true;
    setStatus('syncing');
    let syncedCount = 0;

    for (const action of pending) {
      if (action.retryCount >= MAX_RETRIES) continue;

      try {
        console.log(`[SyncEngine] Syncing: ${action.method} ${action.endpoint}`);
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': action.id,
        };

        const response = await fetch(action.endpoint, {
          method: action.method,
          headers,
          body: action.payload ? JSON.stringify(action.payload) : undefined,
        });

        if (response.ok || response.status === 409) {
          await db.delete('pendingActions', action.id);
          syncedCount++;
          console.log(`[SyncEngine] Successfully synced ${action.id}`);
        } else {
          console.warn(`[SyncEngine] Failed to sync ${action.id}: Status ${response.status}`);
          action.retryCount += 1;
          action.status = 'failed';
          await db.put('pendingActions', action);
        }
      } catch (err) {
        console.error(`[SyncEngine] Network error syncing ${action.id}:`, err);
        action.retryCount += 1;
        await db.put('pendingActions', action);
      }
    }

    isSyncing = false;
    console.log(`[SyncEngine] Sync cycle finished. Synced: ${syncedCount}`);

    if (syncedCount > 0) {
      window.dispatchEvent(
        new CustomEvent('offline-sync', {
          detail: { message: `Datos sincronizados correctamente. (${syncedCount})` },
        })
      );
    }

    const remaining = (await db.getAll('pendingActions')).filter(
      (a) => a.retryCount < MAX_RETRIES
    );
    setStatus(remaining.length > 0 ? 'offline' : 'online');
  } catch (err) {
    console.error('[SyncEngine] Critical error in processSyncQueue:', err);
    isSyncing = false;
    setStatus('offline');
  }
}

// ============= Auto-init listeners (client only) =============

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Offline] Window online event fired');
    setStatus('online');
    processSyncQueue();
  });

  window.addEventListener('offline', () => {
    console.log('[Offline] Window offline event fired');
    setStatus('offline');
  });

  // Periodic sync every 20 seconds
  setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine && !isSyncing) {
      processSyncQueue();
    }
  }, 20_000);
}
