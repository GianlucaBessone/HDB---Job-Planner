import { test, expect } from '@playwright/test';
import { prisma } from '../lib/prisma';

// Helper to initialize current user session and stub geolocation on page load
async function setupUserAndGeolocation(page: any, context: any) {
  // Capture browser logs for debugging
  page.on('console', (msg: any) => console.log(`[Browser Console] [${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err: any) => console.error(`[Browser PageError] ${err.message}`));

  // Grant browser-level geolocation permission
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -34.6037, longitude: -58.3816 });

  // Stub navigator.geolocation API in browser to bypass dynamic prompts
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (success) => {
      success({
        coords: {
          latitude: -34.6037,
          longitude: -58.3816,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as any);
    };
  });

  // Load home page to initialize localStorage context
  await page.goto('/');

  // Warm up dynamic API endpoints to compile Next.js dev routes and avoid timeouts (3s)
  try {
    await page.evaluate(async () => {
      await fetch('/api/audit/ping').catch(() => {});
      await fetch('/api/projects').catch(() => {});
      await fetch('/api/config/system').catch(() => {});
    });
  } catch (e) {}

  // Insert mock current session
  await page.evaluate(() => {
    const user = {
      id: 'test-operator-id',
      nombreCompleto: 'Operador Playwright',
      activo: true,
      role: 'operador',
    };
    localStorage.setItem('currentUser', JSON.stringify(user));
  });

  // Navigate to punch-in page
  await page.goto('/fichado');
  await page.waitForLoadState('networkidle');
}

// Helper to query IndexedDB pendingActions store size in client browser context
async function getPendingActionsCount(page: any): Promise<number> {
  return await page.evaluate(() => {
    return new Promise<number>((resolve, reject) => {
      const request = indexedDB.open('offlineDB', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('pendingActions')) {
          resolve(0);
          return;
        }
        const tx = db.transaction('pendingActions', 'readonly');
        const store = tx.objectStore('pendingActions');
        const countRequest = store.count();
        countRequest.onsuccess = () => resolve(countRequest.result);
        countRequest.onerror = () => reject(countRequest.error);
      };
    });
  });
}

test.describe('E2E Test Suite - PWA Offline-First Engine & Idempotency', () => {
  
  test.beforeEach(async () => {
    // 1. Clean database tables sequentially to prevent cascade locks and isolated states
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "TimeEntry", "Fichada", "IdempotencyKey", "Operator", "Project", "Planning" CASCADE;`
    );

    // 2. Seed mock operator for verification
    await prisma.operator.create({
      data: {
        id: 'test-operator-id',
        nombreCompleto: 'Operador Playwright',
        activo: true,
        enVacaciones: false,
        etiquetas: [],
        pin: '1234',
        role: 'operador',
        posicion: 'QA Specialist',
      },
    });

    // 3. Seed mock project with geofence matching user geolocation coordinates
    await prisma.project.create({
      data: {
        id: 'test-project-id',
        codigoProyecto: 'PRJ-TEST-E2E',
        nombre: 'Proyecto Test E2E',
        activo: true,
        fichajeHabilitado: true,
        geofenceLat: -34.6037,
        geofenceLng: -58.3816,
        geofenceRadius: 500,
        tags: [],
      },
    });

    // 4. Seed company-wide settings with non-overlapping coordinates (0, 0)
    await prisma.systemSetting.upsert({
      where: { id: 'default' },
      update: {
        companyGeofenceLat: 0.0,
        companyGeofenceLng: 0.0,
        companyGeofenceRadius: 100,
        fichajeHabilitado: true,
      },
      create: {
        id: 'default',
        companyGeofenceLat: 0.0,
        companyGeofenceLng: 0.0,
        companyGeofenceRadius: 100,
        fichajeHabilitado: true,
      },
    });
  });

  // Test 1: Full offline-to-online cycle (Network resilience)
  test('Test 1: Full Offline-to-Online Synchronization Cycle', async ({ page, context }) => {
    // Set up user, geofence, and mock geolocation coordinates
    await setupUserAndGeolocation(page, context);

    // Assert that the page loaded, GPS is ready, and button is clickable
    await expect(page.locator('#btn-fichar-entrada')).toBeVisible();

    // Force network context to strict offline state
    await context.setOffline(true);

    // Simulate punch action (button click) while offline
    await page.click('#btn-fichar-entrada');

    // Verify action was captured and stored successfully inside IndexedDB queue
    const queuedCount = await getPendingActionsCount(page);
    expect(queuedCount).toBe(1);

    // Restore network context to online state
    await context.setOffline(false);

    // Dispatch sync execution loop programmatically
    await page.evaluate(async () => {
      await (window as any).processSyncQueue();
    });

    // Expect IndexedDB queue to be processed and become empty (0 items remaining)
    await expect.poll(async () => {
      return await getPendingActionsCount(page);
    }, {
      timeout: 5000,
      intervals: [500]
    }).toBe(0);

    // Confirm action was successfully persisted in PostgreSQL through Prisma ORM
    const entries = await prisma.fichada.findMany({
      where: { operatorId: 'test-operator-id' },
    });
    expect(entries.length).toBe(1);
    expect(entries[0].projectId).toBe('test-project-id');
  });

  // Test 2: Tab mutual exclusion locks (Web Locks API prevention)
  test('Test 2: Tab Concurrency Prevention via Web Locks', async ({ browser }) => {
    // Setup mutual browser contexts for sharing IndexedDB but separate tabs
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // Setup sessions on both pages
    await setupUserAndGeolocation(page1, context);
    await setupUserAndGeolocation(page2, context);

    // Disconnect connection
    await context.setOffline(true);

    // Perform offline modification on page1
    await page1.click('#btn-fichar-entrada');

    // Confirm both pages see the same queued action in IndexedDB
    const countPage1 = await getPendingActionsCount(page1);
    const countPage2 = await getPendingActionsCount(page2);
    expect(countPage1).toBe(1);
    expect(countPage2).toBe(1);

    // Reconnect connection
    await context.setOffline(false);

    // Spy on outgoing API endpoint calls to count dispatches
    let postRequestCount = 0;
    context.on('request', (req) => {
      if (req.url().includes('/api/time-entries/punch') && req.method() === 'POST') {
        postRequestCount++;
      }
    });

    // Concurrent asynchronous trigger of processSyncQueue on both pages
    await Promise.all([
      page1.evaluate(() => (window as any).processSyncQueue()),
      page2.evaluate(() => (window as any).processSyncQueue()),
    ]);

    // Expect queue to empty successfully
    await expect.poll(async () => {
      return await getPendingActionsCount(page1);
    }, {
      timeout: 5000,
      intervals: [500]
    }).toBe(0);

    // Guarantee that ONLY ONE request was ever sent, showing the Web Lock blocked double submission
    expect(postRequestCount).toBe(1);
  });

  // Test 3: Special connection cases (False online and captive portals)
  test('Test 3: Resiliency to Captive Portals and False Online States', async ({ page, context }) => {
    await setupUserAndGeolocation(page, context);

    // 1. Force network context to strict offline state and queue an action
    await context.setOffline(true);
    await page.click('#btn-fichar-entrada');

    // 2. Intercept active ping endpoints to return Gateway Timeout (504)
    await page.route('**/api/audit/ping', (route) => {
      route.fulfill({
        status: 504,
        body: 'Gateway Timeout',
      });
    });

    // 3. Simulate browser status as ONLINE
    await context.setOffline(false);

    // 4. Verify verifyRealConnectivity returns false, overriding navigator.onLine
    const realConnected = await page.evaluate(async () => {
      return await (window as any).verifyRealConnectivity();
    });
    expect(realConnected).toBe(false);

    // 5. Trigger queue sync attempts while online (should abort since ping fails)
    await page.evaluate(() => (window as any).processSyncQueue());

    // 6. Verify queue remains un-synced (still has 1 pending action)
    const countRemaining = await getPendingActionsCount(page);
    expect(countRemaining).toBe(1);

    // 7. Verify indicator showing "Modo Offline" still remains active in the layout
    const syncIndicator = page.locator('text=Modo Offline');
    await expect(syncIndicator).toBeVisible();
  });

  // Test 4: Dynamic webpack chunk loading stability (ChunkLoadError handling)
  test('Test 4: ChunkLoadError Recovery and PWA Purging', async ({ page, context }) => {
    await setupUserAndGeolocation(page, context);

    // Spy on window.location reloads
    let reloaded = false;
    await page.exposeFunction('markReloaded', () => {
      reloaded = true;
    });

    await page.addInitScript(() => {
      window.addEventListener('beforeunload', () => {
        (window as any).markReloaded();
      });
    });

    // Navigate to page adding query parameter trigger_error=true
    // This throws a mock ChunkLoadError inside the page layout
    await page.goto('/fichado?trigger_error=true');

    // Wait and verify if redirection/page reload happens to clear parameter
    await page.waitForURL((url) => !url.searchParams.has('trigger_error'), { timeout: 8000 });

    // Expect the page to clean history and reload gracefully
    const currentUrl = new URL(page.url());
    expect(currentUrl.searchParams.has('trigger_error')).toBe(false);
  });
});
