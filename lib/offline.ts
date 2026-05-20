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
let cachedOnlineState = false;
let lastPingTime = 0;

/**
 * Performs a lightweight healthcheck ping to verify actual IP-routing to the internet.
 * Uses 5-second caching to prevent duplicate network calls.
 */
export async function verifyRealConnectivity(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  if (!navigator.onLine) return false;

  const now = Date.now();
  if (now - lastPingTime < 5000) {
    return cachedOnlineState;
  }

  lastPingTime = now;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch('/api/healthcheck', {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    cachedOnlineState = res.status === 200;
  } catch (e) {
    console.warn('[SyncEngine] Passive connection ping failed:', e);
    cachedOnlineState = false;
  }

  return cachedOnlineState;
}

/**
 * Sequential FIFO sync execution loop.
 * Halts processing immediately on transient or permanent failures to prevent out-of-order execution.
 */
async function executeSyncLoop() {
  const db = await getDB();
  const pending = await db.getAll('pendingActions');

  if (pending.length === 0) {
    setStatus('online');
    return;
  }

  // Sort chronologically by timestamp to enforce strict FIFO ordering
  pending.sort((a, b) => a.timestamp - b.timestamp);

  console.log(`[SyncEngine] Processing queue sequentially. Length: ${pending.length}`);
  isSyncing = true;
  setStatus('syncing');
  let syncedCount = 0;

  for (const action of pending) {
    if (action.retryCount >= MAX_RETRIES) {
      console.error(`[SyncEngine] Action ${action.id} reached max retries. Mark status as failed.`);
      action.status = 'failed';
      await db.put('pendingActions', action);
      continue;
    }

    try {
      const hasRealInternet = await verifyRealConnectivity();
      if (!hasRealInternet) {
        console.warn('[SyncEngine] Real network check failed. Stopping queue.');
        break;
      }

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

      if (response.ok) {
        await db.delete('pendingActions', action.id);
        syncedCount++;
        console.log(`[SyncEngine] Successfully synced ${action.id}`);
      } else if (response.status >= 400 && response.status < 500 && response.status !== 409 && response.status !== 408) {
        // Permanent application error (Business logic / Validation failure)
        console.error(`[SyncEngine] Permanent failure (Status ${response.status}) on ${action.id}. Halting queue to preserve consistency.`);
        action.status = 'failed';
        await db.put('pendingActions', action);
        break;
      } else {
        // Transient errors (5xx server errors, timeouts, etc.)
        console.warn(`[SyncEngine] Transient failure (Status ${response.status}) for ${action.id}. Will retry later.`);
        action.retryCount += 1;
        await db.put('pendingActions', action);
        break;
      }
    } catch (err) {
      console.error(`[SyncEngine] Network error syncing ${action.id}:`, err);
      // Pure network/fetch drop: halt queue processing immediately but do not penalize retry count
      break;
    }
  }

  isSyncing = false;
  const remaining = await db.getAll('pendingActions');
  const activeRemaining = remaining.filter((a) => a.status === 'pending');
  setStatus(activeRemaining.length > 0 ? 'offline' : 'online');

  if (syncedCount > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('offline-sync', {
        detail: { message: `Datos sincronizados correctamente. (${syncedCount})` },
      })
    );
  }
}

/**
 * Public function to trigger queue synchronization.
 * Uses Web Locks API to guarantee mutual exclusion (mutex) across multiple browser tabs.
 */
export async function processSyncQueue() {
  if (typeof window === 'undefined') return;
  if (typeof navigator === 'undefined' || !navigator.onLine || isSyncing) return;

  if ('locks' in navigator) {
    try {
      await navigator.locks.request('sync_queue_lock', { ifAvailable: true }, async (lock) => {
        if (!lock) {
          console.log('[SyncEngine] Sync lock busy in another tab. Skipping execution.');
          return;
        }
        await executeSyncLoop();
      });
    } catch (err) {
      console.error('[SyncEngine] Web lock error, falling back to direct execution:', err);
      await executeSyncLoop();
    }
  } else {
    await executeSyncLoop();
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

  // Periodic sync check every 20 seconds
  setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine && !isSyncing) {
      processSyncQueue();
    }
  }, 20_000);
}
