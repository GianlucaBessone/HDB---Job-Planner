/// <reference lib="webworker" />

// Custom Service Worker for HDB Planner
// This file is compiled by @ducanh2912/next-pwa into public/sw.js

importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

self.addEventListener('push', (event: PushEvent) => {
    let payload = null;
    try {
        payload = event.data ? event.data.json() : null;
    } catch (e) {
        payload = event.data ? event.data.text() : null;
    }

    console.log("⚙️ [SERVICE_WORKER] Evento PUSH background (Custom):", {
        hasData: !!event.data,
        payload
    });
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
    console.log("🖱️ [SERVICE_WORKER] Click background (Custom):", event.notification);
});

// The workbox-next-pwa logic will be appended here automatically by the build process
export {};
