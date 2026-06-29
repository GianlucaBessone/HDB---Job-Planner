import { useEffect } from 'react';
import { useCommandStore } from '../store/useCommandStore';

export function useHotkeys() {
    const getCommandsArray = useCommandStore((state) => state.getCommandsArray);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input/textarea unless it's a specific global hotkey
            const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
            
            const commands = getCommandsArray();

            for (const cmd of commands) {
                if (!cmd.keys) continue;

                // Simple check for keys: e.g. ['ctrl', 'n']
                const requiresCtrl = cmd.keys.includes('ctrl') || cmd.keys.includes('meta');
                const requiresAlt = cmd.keys.includes('alt');
                const requiresShift = cmd.keys.includes('shift');
                const targetKey = cmd.keys.find(k => !['ctrl', 'meta', 'alt', 'shift'].includes(k));

                const hasCtrl = e.ctrlKey || e.metaKey;
                const hasAlt = e.altKey;
                const hasShift = e.shiftKey;

                if (
                    requiresCtrl === hasCtrl &&
                    requiresAlt === hasAlt &&
                    requiresShift === hasShift &&
                    targetKey && e.key.toLowerCase() === targetKey.toLowerCase()
                ) {
                    // Do not block default if typing in input UNLESS it's a global command that should override (like ctrl+s)
                    if (isTyping && targetKey !== 's') continue;
                    
                    e.preventDefault();
                    cmd.action();
                    return;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [getCommandsArray]);
}
