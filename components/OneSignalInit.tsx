'use client';

import { useEffect, useRef } from 'react';
import OneSignal from 'react-onesignal';

export default function OneSignalInit({ appId, user }: { appId: string, user?: any }) {
    const initializedRef = useRef(false);
    const lastUserIdRef = useRef<string | null>(null);
    const initFailedRef = useRef(false);
    const listenersAddedRef = useRef(false);

    useEffect(() => {
        const initOneSignal = async () => {
            if (typeof window === 'undefined') return;

            // If init already failed (e.g. IndexedDB corrupted), don't retry endlessly
            if (initFailedRef.current) return;

            try {
                // Initialize if not already done
                if (!initializedRef.current) {
                    console.log("OneSignal: Initializing...");
                    await OneSignal.init({
                        appId: appId,
                        allowLocalhostAsSecureOrigin: true,
                        serviceWorkerPath: 'sw.js',
                    });
                    initializedRef.current = true;
                    console.log("OneSignal: Initialized successfully");
                }

                const currentUserId = user?.id || null;

                // Handle Login / Logout logic
                if (currentUserId && currentUserId !== lastUserIdRef.current) {
                    console.log("👤 [ONESIGNAL_LOGIN] Logging with external ID:", currentUserId);
                    await OneSignal.login(currentUserId);
                    lastUserIdRef.current = currentUserId;

                    if (user.nombreCompleto) {
                        console.log("OneSignal: Updating user tags");
                        await OneSignal.User.addTag("name", user.nombreCompleto);
                        await OneSignal.User.addTag("role", user.role);
                    }

                    // Log permission and subscription status
                    const permission = OneSignal.Notifications.permission;
                    console.log("🔐 [ONESIGNAL_PERMISSION]:", permission);

                    const isSubscribed = OneSignal.User.PushSubscription.optedIn;
                    const subId = OneSignal.User.PushSubscription.id;
                    console.log("📲 [ONESIGNAL_SUBSCRIBED]:", isSubscribed);
                    console.log("🆔 [ONESIGNAL_EXTERNAL_ID]:", currentUserId);
                    console.log("📡 [ONESIGNAL_SUB_ID]:", subId || "Aún sin token asignado");

                    // Add foreground and click listeners (only once)
                    if (!listenersAddedRef.current) {
                        OneSignal.Notifications.addEventListener("foregroundWillDisplay", (event) => {
                            console.log("📩 [PUSH_RECEIVED_FOREGROUND]:", event);
                        });

                        OneSignal.Notifications.addEventListener("click", (event) => {
                            console.log("🖱️ [PUSH_CLICKED]:", event);
                        });
                        listenersAddedRef.current = true;
                    }

                    const hasPrompted = localStorage.getItem('onesignal_prompted');

                    if (permission === false || (permission as any) === 'denied') {
                        console.log("OneSignal: Notifications blocked by user");
                    } else if (permission !== true && (permission as any) !== 'granted' && !hasPrompted) {
                        setTimeout(async () => {
                            try {
                                console.log("OneSignal: Prompting for push subscription");
                                await OneSignal.Slidedown.promptPush();
                                localStorage.setItem('onesignal_prompted', 'true');
                            } catch (e) {
                                console.warn("OneSignal: Prompt error (non-fatal)", e);
                            }
                        }, 5000);
                    }
                } else if (!currentUserId && lastUserIdRef.current) {
                    console.log("OneSignal: Logging out user");
                    await OneSignal.logout();
                    lastUserIdRef.current = null;
                }
            } catch (error: any) {
                const errorMsg = error?.message || String(error);

                // IndexedDB corruption - mark as failed to prevent infinite retry loop
                if (errorMsg.includes('indexedDB') || errorMsg.includes('backing store')) {
                    console.error(
                        "❌ [ONESIGNAL_INIT_FAILED] IndexedDB is corrupted. " +
                        "Push notifications will not work until the user clears site data. " +
                        "Error:", errorMsg
                    );
                    initFailedRef.current = true;
                } else {
                    console.error('OneSignal: Integration error', error);
                }
            }
        };

        initOneSignal();
    }, [appId, user?.id, user?.nombreCompleto]);

    return null;
}
