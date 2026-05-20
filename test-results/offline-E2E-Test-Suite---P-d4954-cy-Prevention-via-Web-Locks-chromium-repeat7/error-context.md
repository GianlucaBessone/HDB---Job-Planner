# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: offline.spec.ts >> E2E Test Suite - PWA Offline-First Engine & Idempotency >> Test 2: Tab Concurrency Prevention via Web Locks
- Location: tests/offline.spec.ts:181:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 1

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - button [ref=e6] [cursor=pointer]:
            - img [ref=e7]
          - link "HDBSGI" [ref=e8] [cursor=pointer]:
            - /url: /
            - img [ref=e10]
            - generic [ref=e13]: HDBSGI
        - generic [ref=e15]:
          - button "Alternar modo oscuro" [ref=e16] [cursor=pointer]:
            - generic [ref=e17]: Toggle theme
            - img [ref=e19]
            - img [ref=e26]
            - img [ref=e29]
          - generic [ref=e35]:
            - img [ref=e36]
            - generic [ref=e41]: Sincronizando (1)
          - button [ref=e43] [cursor=pointer]:
            - img [ref=e44]
    - complementary [ref=e47]:
      - generic [ref=e48]:
        - generic [ref=e49]:
          - img [ref=e50]
          - generic [ref=e53]: HDBSGI
        - button [ref=e54] [cursor=pointer]:
          - img [ref=e55]
      - navigation [ref=e58]:
        - generic [ref=e59]:
          - button "Principal" [ref=e60] [cursor=pointer]:
            - generic [ref=e61]:
              - img [ref=e62]
              - text: Principal
            - img [ref=e65]
          - link "Inicio" [ref=e68] [cursor=pointer]:
            - /url: /
            - img [ref=e69]
            - text: Inicio
        - button "Operaciones" [ref=e73] [cursor=pointer]:
          - generic [ref=e74]:
            - img [ref=e75]
            - text: Operaciones
          - img [ref=e77]
        - button "Calidad" [ref=e80] [cursor=pointer]:
          - generic [ref=e81]:
            - img [ref=e82]
            - text: Calidad
          - img [ref=e86]
        - button "Administración" [ref=e89] [cursor=pointer]:
          - generic [ref=e90]:
            - img [ref=e91]
            - text: Administración
          - img [ref=e94]
      - generic [ref=e96]:
        - generic [ref=e98]:
          - paragraph [ref=e99]: operador
          - paragraph [ref=e100]: Operador Playwright
        - button "Activar Notificaciones" [ref=e101] [cursor=pointer]:
          - img [ref=e102]
          - generic [ref=e107]: Activar Notificaciones
        - button "Cerrar Sesión" [ref=e108] [cursor=pointer]:
          - img [ref=e109]
          - generic [ref=e112]: Cerrar Sesión
        - paragraph [ref=e114]: v2.0.4 Premium
    - main [ref=e115]:
      - generic [ref=e116]:
        - generic [ref=e118]:
          - img [ref=e120]
          - generic [ref=e123]:
            - heading "Operador Playwright" [level=2] [ref=e124]
            - paragraph [ref=e125]:
              - img [ref=e126]
              - text: 15:37 — 20/05/2026
        - generic [ref=e129]:
          - generic [ref=e130]:
            - img [ref=e132]
            - generic [ref=e135]:
              - paragraph [ref=e136]: Ubicación Obtenida
              - paragraph [ref=e137]: "-34.60370, -58.38160"
          - button [ref=e138] [cursor=pointer]:
            - img [ref=e139]
        - generic [ref=e144]:
          - generic [ref=e145]:
            - img [ref=e146]
            - generic [ref=e148]: "ID de Dispositivo:"
          - code [ref=e149]: 99162f58...
        - generic [ref=e150]:
          - generic [ref=e151]:
            - heading "Iniciar Nueva Jornada" [level=3] [ref=e152]
            - paragraph [ref=e153]: Selecciona el destino y método de validación.
          - generic [ref=e154]:
            - button "GPS" [ref=e155] [cursor=pointer]:
              - img [ref=e156]
              - text: GPS
            - button "Código QR" [ref=e159] [cursor=pointer]:
              - img [ref=e160]
              - text: Código QR
          - generic [ref=e166]:
            - generic [ref=e168]:
              - img [ref=e170]
              - generic [ref=e173]:
                - paragraph [ref=e174]: Destino Detectado (GPS)
                - heading "Proyecto Test E2E" [level=4] [ref=e175]
            - generic [ref=e176]:
              - img [ref=e178]
              - generic [ref=e181]:
                - heading "Ubicación Lista" [level=4] [ref=e182]
                - paragraph [ref=e183]: Requerido para validar zona de trabajo.
            - button "Ingresar a Obra" [ref=e184] [cursor=pointer]:
              - img [ref=e185]
              - text: Ingresar a Obra
        - generic [ref=e187]:
          - heading "Tips de Validación" [level=4] [ref=e188]:
            - img [ref=e189]
            - text: Tips de Validación
          - generic [ref=e192]:
            - generic [ref=e193]:
              - img [ref=e194]
              - paragraph [ref=e197]: Asegúrate de estar dentro del radio permitido.
            - generic [ref=e198]:
              - img [ref=e199]
              - paragraph [ref=e201]: Usa siempre tu dispositivo principal.
    - contentinfo [ref=e202]:
      - generic [ref=e203]: © 2026 HDB SGI - Sistema de Gestión Integral
  - alert [ref=e204]
```

# Test source

```ts
  126 |         fichajeHabilitado: true,
  127 |       },
  128 |       create: {
  129 |         id: 'default',
  130 |         companyGeofenceLat: 0.0,
  131 |         companyGeofenceLng: 0.0,
  132 |         companyGeofenceRadius: 100,
  133 |         fichajeHabilitado: true,
  134 |       },
  135 |     });
  136 |   });
  137 | 
  138 |   // Test 1: Full offline-to-online cycle (Network resilience)
  139 |   test('Test 1: Full Offline-to-Online Synchronization Cycle', async ({ page, context }) => {
  140 |     // Set up user, geofence, and mock geolocation coordinates
  141 |     await setupUserAndGeolocation(page, context);
  142 | 
  143 |     // Assert that the page loaded, GPS is ready, and button is clickable
  144 |     await expect(page.locator('#btn-fichar-entrada')).toBeVisible();
  145 | 
  146 |     // Force network context to strict offline state
  147 |     await context.setOffline(true);
  148 | 
  149 |     // Simulate punch action (button click) while offline
  150 |     await page.click('#btn-fichar-entrada');
  151 | 
  152 |     // Verify action was captured and stored successfully inside IndexedDB queue
  153 |     const queuedCount = await getPendingActionsCount(page);
  154 |     expect(queuedCount).toBe(1);
  155 | 
  156 |     // Restore network context to online state
  157 |     await context.setOffline(false);
  158 | 
  159 |     // Dispatch sync execution loop programmatically
  160 |     await page.evaluate(async () => {
  161 |       await (window as any).processSyncQueue();
  162 |     });
  163 | 
  164 |     // Expect IndexedDB queue to be processed and become empty (0 items remaining)
  165 |     await expect.poll(async () => {
  166 |       return await getPendingActionsCount(page);
  167 |     }, {
  168 |       timeout: 5000,
  169 |       intervals: [500]
  170 |     }).toBe(0);
  171 | 
  172 |     // Confirm action was successfully persisted in PostgreSQL through Prisma ORM
  173 |     const entries = await prisma.fichada.findMany({
  174 |       where: { operatorId: 'test-operator-id' },
  175 |     });
  176 |     expect(entries.length).toBe(1);
  177 |     expect(entries[0].projectId).toBe('test-project-id');
  178 |   });
  179 | 
  180 |   // Test 2: Tab mutual exclusion locks (Web Locks API prevention)
  181 |   test('Test 2: Tab Concurrency Prevention via Web Locks', async ({ browser }) => {
  182 |     // Setup mutual browser contexts for sharing IndexedDB but separate tabs
  183 |     const context = await browser.newContext();
  184 |     const page1 = await context.newPage();
  185 |     const page2 = await context.newPage();
  186 | 
  187 |     // Setup sessions on both pages
  188 |     await setupUserAndGeolocation(page1, context);
  189 |     await setupUserAndGeolocation(page2, context);
  190 | 
  191 |     // Disconnect connection
  192 |     await context.setOffline(true);
  193 | 
  194 |     // Perform offline modification on page1
  195 |     await page1.click('#btn-fichar-entrada');
  196 | 
  197 |     // Confirm both pages see the same queued action in IndexedDB
  198 |     const countPage1 = await getPendingActionsCount(page1);
  199 |     const countPage2 = await getPendingActionsCount(page2);
  200 |     expect(countPage1).toBe(1);
  201 |     expect(countPage2).toBe(1);
  202 | 
  203 |     // Reconnect connection
  204 |     await context.setOffline(false);
  205 | 
  206 |     // Spy on outgoing API endpoint calls to count dispatches
  207 |     let postRequestCount = 0;
  208 |     context.on('request', (req) => {
  209 |       if (req.url().includes('/api/time-entries/punch') && req.method() === 'POST') {
  210 |         postRequestCount++;
  211 |       }
  212 |     });
  213 | 
  214 |     // Concurrent asynchronous trigger of processSyncQueue on both pages
  215 |     await Promise.all([
  216 |       page1.evaluate(() => (window as any).processSyncQueue()),
  217 |       page2.evaluate(() => (window as any).processSyncQueue()),
  218 |     ]);
  219 | 
  220 |     // Expect queue to empty successfully
  221 |     await expect.poll(async () => {
  222 |       return await getPendingActionsCount(page1);
  223 |     }, {
  224 |       timeout: 5000,
  225 |       intervals: [500]
> 226 |     }).toBe(0);
      |        ^ Error: expect(received).toBe(expected) // Object.is equality
  227 | 
  228 |     // Guarantee that ONLY ONE request was ever sent, showing the Web Lock blocked double submission
  229 |     expect(postRequestCount).toBe(1);
  230 |   });
  231 | 
  232 |   // Test 3: Special connection cases (False online and captive portals)
  233 |   test('Test 3: Resiliency to Captive Portals and False Online States', async ({ page, context }) => {
  234 |     await setupUserAndGeolocation(page, context);
  235 | 
  236 |     // 1. Force network context to strict offline state and queue an action
  237 |     await context.setOffline(true);
  238 |     await page.click('#btn-fichar-entrada');
  239 | 
  240 |     // 2. Intercept active ping endpoints to return Gateway Timeout (504)
  241 |     await page.route('**/api/audit/ping', (route) => {
  242 |       route.fulfill({
  243 |         status: 504,
  244 |         body: 'Gateway Timeout',
  245 |       });
  246 |     });
  247 | 
  248 |     // 3. Simulate browser status as ONLINE
  249 |     await context.setOffline(false);
  250 | 
  251 |     // 4. Verify verifyRealConnectivity returns false, overriding navigator.onLine
  252 |     const realConnected = await page.evaluate(async () => {
  253 |       return await (window as any).verifyRealConnectivity();
  254 |     });
  255 |     expect(realConnected).toBe(false);
  256 | 
  257 |     // 5. Trigger queue sync attempts while online (should abort since ping fails)
  258 |     await page.evaluate(() => (window as any).processSyncQueue());
  259 | 
  260 |     // 6. Verify queue remains un-synced (still has 1 pending action)
  261 |     const countRemaining = await getPendingActionsCount(page);
  262 |     expect(countRemaining).toBe(1);
  263 | 
  264 |     // 7. Verify indicator showing "Modo Offline" still remains active in the layout
  265 |     const syncIndicator = page.locator('text=Modo Offline');
  266 |     await expect(syncIndicator).toBeVisible();
  267 |   });
  268 | 
  269 |   // Test 4: Dynamic webpack chunk loading stability (ChunkLoadError handling)
  270 |   test('Test 4: ChunkLoadError Recovery and PWA Purging', async ({ page, context }) => {
  271 |     await setupUserAndGeolocation(page, context);
  272 | 
  273 |     // Spy on window.location reloads
  274 |     let reloaded = false;
  275 |     await page.exposeFunction('markReloaded', () => {
  276 |       reloaded = true;
  277 |     });
  278 | 
  279 |     await page.addInitScript(() => {
  280 |       window.addEventListener('beforeunload', () => {
  281 |         (window as any).markReloaded();
  282 |       });
  283 |     });
  284 | 
  285 |     // Navigate to page adding query parameter trigger_error=true
  286 |     // This throws a mock ChunkLoadError inside the page layout
  287 |     await page.goto('/fichado?trigger_error=true');
  288 | 
  289 |     // Wait and verify if redirection/page reload happens to clear parameter
  290 |     await page.waitForURL((url) => !url.searchParams.has('trigger_error'), { timeout: 8000 });
  291 | 
  292 |     // Expect the page to clean history and reload gracefully
  293 |     const currentUrl = new URL(page.url());
  294 |     expect(currentUrl.searchParams.has('trigger_error')).toBe(false);
  295 |   });
  296 | });
  297 | 
```