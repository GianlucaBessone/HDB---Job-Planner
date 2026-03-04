importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

self.addEventListener('fetch', function (event) {
    // Dummy fetch event to pass Chrome PWA installation criteria.
});

self.addEventListener('push', function (event) {
    let payload = null;
    try {
        payload = event.data ? event.data.json() : null;
    } catch (e) {
        payload = event.data ? event.data.text() : null;
    }

    console.log("⚙️ [SERVICE_WORKER] Evento PUSH background:", {
        hasData: !!event.data,
        payload
    });
});

self.addEventListener('notificationclick', function (event) {
    console.log("🖱️ [SERVICE_WORKER] Click background:", event.notification);
});