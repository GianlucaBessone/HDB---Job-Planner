'use client';

import { useEffect, useState } from 'react';
import OneSignal from 'react-onesignal';

export default function OneSignalInit({ appId }: { appId: string }) {
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const initOneSignal = async () => {
            try {
                // Initialize OneSignal
                await OneSignal.init({
                    appId: appId,
                    allowLocalhostAsSecureOrigin: true,
                });

                setIsInitialized(true);

                // Set external user ID if user is logged in
                const storedUser = localStorage.getItem('currentUser');
                if (storedUser) {
                    const user = JSON.parse(storedUser);
                    if (user && user.id) {
                        // Login to OneSignal with our User ID
                        await OneSignal.login(user.id);

                        if (user.nombreCompleto) {
                            // Tag the user for better segmentation
                            OneSignal.User.addTag("name", user.nombreCompleto);
                            OneSignal.User.addTag("role", user.role);
                        }

                        // Automatic subscription prompt if not already decided
                        const isSubscribed = OneSignal.Notifications.permission;
                        const hasPrompted = localStorage.getItem('onesignal_prompted');

                        if (!isSubscribed && !hasPrompted) {
                            // Small delay to ensure smooth UX after login
                            setTimeout(async () => {
                                try {
                                    await OneSignal.Slidedown.promptPush();
                                    localStorage.setItem('onesignal_prompted', 'true');
                                } catch (e) {
                                    console.error("Error prompting for push:", e);
                                }
                            }, 3000);
                        }
                    }
                }
            } catch (error) {
                console.error('OneSignal Init Error:', error);
            }
        };

        if (typeof window !== 'undefined') {
            initOneSignal();
        }
    }, [appId]);

    // This component now only handles logic, no UI
    return null;
}

