'use client';

import { useEffect, useRef } from 'react';
import OneSignal from 'react-onesignal';

export default function OneSignalInit({ appId, user }: { appId: string, user?: any }) {
    const initializedRef = useRef(false);

    useEffect(() => {
        async function init() {
            if (typeof window === 'undefined') return;
            if (initializedRef.current) return;

            try {
                console.log("🔔 OneSignal: Initializing...");
                await OneSignal.init({
                    appId: appId,
                    notifyButton: { 
                        enable: false,
                    } as any,
                    allowLocalhostAsSecureOrigin: true,
                });
                initializedRef.current = true;
                console.log("✅ OneSignal initialized");

                // Debug logs requested by user
                console.log("🔐 Push permission:", await OneSignal.Notifications.permission);
                console.log("📲 Push subscription:", await OneSignal.User.PushSubscription);

                // Handle User Identity
                if (user?.id) {
                    console.log("👤 OneSignal: Logging in user:", user.id);
                    await OneSignal.login(user.id);
                    
                    if (user.nombreCompleto) {
                        await OneSignal.User.addTag("name", user.nombreCompleto);
                        await OneSignal.User.addTag("role", user.role);
                    }
                }
            } catch (error) {
                console.error("❌ OneSignal init error:", error);
            }
        }

        init();
    }, [appId, user?.id]);

    return null;
}
