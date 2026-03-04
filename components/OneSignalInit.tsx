'use client';

import { useEffect, useState } from 'react';
import OneSignal from 'react-onesignal';

export default function OneSignalInit({ appId, user }: { appId: string, user?: any }) {
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
                if (user && user.id) {
                    try {
                        // Login to OneSignal with our User ID
                        console.log(`OneSignal: Logging in with external user ID: ${user.id}`);
                        await OneSignal.login(user.id);

                        if (user.nombreCompleto) {
                            // Tag the user for better segmentation
                            console.log(`OneSignal: Tagging user with role: ${user.role}`);
                            await OneSignal.User.addTag("name", user.nombreCompleto);
                            await OneSignal.User.addTag("role", user.role);
                        }
                    } catch (loginError) {
                        console.warn("OneSignal Login/Tagging error:", loginError);
                    }

                    // Automatic subscription prompt if not already decided
                    const permission = OneSignal.Notifications.permission;
                    const hasPrompted = localStorage.getItem('onesignal_prompted');

                    // If permission is denied/blocked, don't even try to prompt
                    if (permission === false || (permission as any) === 'denied') {
                        console.log("OneSignal: Notifications are blocked by the user.");
                        return;
                    }

                    const isGranted = (permission === true || (permission as any) === 'granted');

                    if (!isGranted && !hasPrompted) {
                        setTimeout(async () => {
                            try {
                                await OneSignal.Slidedown.promptPush();
                                localStorage.setItem('onesignal_prompted', 'true');
                            } catch (e) {
                                console.error("Error prompting for push:", e);
                            }
                        }, 3000);
                    }
                } else if (!user) {
                    // Logout from OneSignal if no user is present
                    console.log("OneSignal: Logging out because user is missing");
                    await OneSignal.logout();
                }
            } catch (error) {
                console.error('OneSignal Init Error:', error);
            }
        };

        if (typeof window !== 'undefined') {
            initOneSignal();
        }
    }, [appId, user]);


    // This component now only handles logic, no UI
    return null;
}

