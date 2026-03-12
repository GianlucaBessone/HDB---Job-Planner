'use client';

import { useEffect, useRef } from 'react';
import OneSignal from 'react-onesignal';

export default function OneSignalInit({ appId, user }: { appId: string, user?: any }) {
    const initializedRef = useRef(false);
    const lastUserIdRef = useRef<string | null>(null);

    useEffect(() => {
        async function syncOneSignal() {
            if (typeof window === 'undefined') return;

            // 1. Initialize if needed
            if (!initializedRef.current) {
                try {
                    console.log("🔔 OneSignal: Initializing...");
                    await OneSignal.init({
                        appId: appId,
                        notifyButton: { enable: false } as any,
                        allowLocalhostAsSecureOrigin: true,
                    });
                    initializedRef.current = true;
                    console.log("✅ OneSignal initialized");
                } catch (error) {
                    console.error("❌ OneSignal init error:", error);
                    return;
                }
            }

            // 2. Handle Authentication State changes
            const currentUserId = user?.id || null;

            if (currentUserId !== lastUserIdRef.current) {
                try {
                    if (currentUserId) {
                        console.log("👤 OneSignal: Identifying user (External ID):", currentUserId);
                        await OneSignal.login(currentUserId);
                        
                        // Sync Metadata Tags for segmentation
                        if (user.nombreCompleto) {
                            await OneSignal.User.addTag("name", user.nombreCompleto);
                        }
                        if (user.role) {
                            await OneSignal.User.addTag("role", user.role);
                        }
                        
                        console.log("✅ OneSignal: Login and tags synced");
                    } else {
                        console.log("🚪 OneSignal: User logged out, clearing session");
                        await OneSignal.logout();
                    }
                    lastUserIdRef.current = currentUserId;
                } catch (error) {
                    console.error("❌ OneSignal identity error:", error);
                }
            }

            // 3. Optional Debug Logs (only on identity change)
            if (currentUserId !== lastUserIdRef.current) {
                console.log("🔐 Push permission:", OneSignal.Notifications.permission);
                console.log("📲 Push subscription:", OneSignal.User.PushSubscription);
            }
        }

        syncOneSignal();
    }, [appId, user?.id, user?.nombreCompleto]);

    return null;
}
