'use client';

import { useEffect, useState } from 'react';
import OneSignal from 'react-onesignal';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { showToast } from './Toast';

export default function OneSignalInit({ appId }: { appId: string }) {
    const [isInitialized, setIsInitialized] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const initOneSignal = async () => {
            try {
                await OneSignal.init({
                    appId: appId,
                    allowLocalhostAsSecureOrigin: true,
                });

                setIsInitialized(true);
                const state = OneSignal.Notifications.permission;
                setIsSubscribed(state);

                // Set external user ID if user is logged in
                const storedUser = localStorage.getItem('currentUser');
                if (storedUser) {
                    const user = JSON.parse(storedUser);
                    if (user && user.id) {
                        await OneSignal.login(user.id);
                        if (user.nombreCompleto) {
                            // Tag the user for better segmentation
                            OneSignal.User.addTag("name", user.nombreCompleto);
                            OneSignal.User.addTag("role", user.role);
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

    const handleSubscription = async () => {
        if (!isInitialized) return;
        setIsLoading(true);
        try {
            if (isSubscribed) {
                // OneSignal v16 doesn't have a direct "unsubscribe" but you can opt out
                // However, usually we just want to show the prompt if they are not subscribed
                showToast('Ya estás suscrito a las notificaciones.', 'success');
            } else {
                await OneSignal.Slidedown.promptPush();
            }

            // Update state
            const state = await OneSignal.Notifications.permission;
            setIsSubscribed(state);
        } catch (error) {
            console.error('OneSignal Action Error:', error);
            showToast('Error al procesar la suscripción', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={handleSubscription}
            disabled={isLoading || !isInitialized}
            className={`p-2 rounded-xl transition-all flex items-center justify-center gap-2 ${isSubscribed
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                }`}
            title={isSubscribed ? 'Notificaciones Activas' : 'Activar Notificaciones'}
        >
            {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
            ) : isSubscribed ? (
                <Bell className="w-5 h-5" />
            ) : (
                <BellOff className="w-5 h-5" />
            )}
            <span className="text-xs font-bold hidden md:inline">
                {isSubscribed ? 'Activas' : 'Notificarme'}
            </span>
        </button>
    );
}
