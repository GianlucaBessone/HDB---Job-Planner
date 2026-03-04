'use client';

import { useEffect, useRef } from 'react';
import OneSignal from 'react-onesignal';

export default function OneSignalInit({ appId, user }: { appId: string, user?: any }) {
    const initializedRef = useRef(false);
    const lastUserIdRef = useRef<string | null>(null);

    useEffect(() => {
        const initOneSignal = async () => {
            // Only run on client side
            if (typeof window === 'undefined') return;

            try {
                // Initialize if not already done
                if (!initializedRef.current) {
                    await OneSignal.init({
                        appId: appId,
                        allowLocalhostAsSecureOrigin: true,
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
                        console.log(`OneSignal: Updating user tags`);
                        await OneSignal.User.addTag("name", user.nombreCompleto);
                        await OneSignal.User.addTag("role", user.role);
                    }

                    // Log permission and subscription status
                    const permission = OneSignal.Notifications.permission;
                    console.log("🔐 [ONESIGNAL_PERMISSION]:", permission);

                    const isSubscribed = OneSignal.User.PushSubscription.optedIn;
                    console.log("📲 [ONESIGNAL_SUBSCRIBED]:", isSubscribed);

                    // Add foreground and click listeners
                    OneSignal.Notifications.addEventListener("foregroundWillDisplay", (event) => {
                        console.log("📩 [PUSH_RECEIVED_FOREGROUND]:", event);
                    });

                    OneSignal.Notifications.addEventListener("click", (event) => {
                        console.log("🖱️ [PUSH_CLICKED]:", event);
                    });

                    const hasPrompted = localStorage.getItem('onesignal_prompted');

                    if (permission === false || (permission as any) === 'denied') {
                        console.log("OneSignal: Notifications blocked by user");
                    } else if (permission !== true && (permission as any) !== 'granted' && !hasPrompted) {
                        // Delay prompt slightly for better UX
                        setTimeout(async () => {
                            try {
                                console.log("OneSignal: Prompting for push subscription");
                                await OneSignal.Slidedown.promptPush();
                                localStorage.setItem('onesignal_prompted', 'true');
                            } catch (e) {
                                console.error("OneSignal: Prompt error", e);
                            }
                        }, 5000);
                    }
                } else if (!currentUserId && lastUserIdRef.current) {
                    console.log("OneSignal: Logging out user");
                    await OneSignal.logout();
                    lastUserIdRef.current = null;
                }
            } catch (error) {
                console.error('OneSignal: Integration error', error);
            }
        };

        initOneSignal();
    }, [appId, user?.id, user?.nombreCompleto]);

    return null;
}

