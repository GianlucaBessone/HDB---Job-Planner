'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import { useCommandStore } from '@/lib/store/useCommandStore';
import { useHotkeys } from '@/lib/hooks/useHotkeys';
import { DEFAULT_VIEWS } from '@/lib/viewAccess';

export function ERPProviders({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const pushHistory = useHistoryStore((state) => state.push);
    const registerCommand = useCommandStore((state) => state.registerCommand);
    const unregisterCommand = useCommandStore((state) => state.unregisterCommand);

    // Track navigation history
    useEffect(() => {
        if (!pathname) return;
        
        // Find view title
        const view = DEFAULT_VIEWS.find(v => v.key === pathname);
        const title = view ? view.label : pathname.split('/').pop() || 'Vista';
        
        // Push to history (setTimeout to ensure it runs after renders if needed)
        pushHistory(pathname, title);
    }, [pathname, pushHistory]);

    // Initialize global hotkeys listener
    useHotkeys();

    // Register global commands
    useEffect(() => {
        const globalCommands = [
            { id: 'global-home', label: 'Ir al Dashboard', action: () => router.push('/dashboard'), category: 'Global' as const },
            { id: 'global-settings', label: 'Abrir Configuración', action: () => router.push('/configuracion'), category: 'Global' as const },
            { id: 'global-back', label: 'Volver atrás', action: () => {
                const prev = useHistoryStore.getState().getPrevious();
                if (prev) {
                    useHistoryStore.getState().pop();
                    router.push(prev.url);
                } else {
                    router.back();
                }
            }, category: 'Global' as const, keys: ['alt', 'ArrowLeft'] },
        ];

        globalCommands.forEach(registerCommand);

        return () => {
            globalCommands.forEach(cmd => unregisterCommand(cmd.id));
        };
    }, [registerCommand, unregisterCommand, router]);

    return <>{children}</>;
}
