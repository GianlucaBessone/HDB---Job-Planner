import { create } from 'zustand';
import { ReactNode } from 'react';

export interface CommandItem {
    id: string;
    label: string;
    action: () => void;
    icon?: string;
    category: 'Global' | 'Acciones' | 'Contextual';
    keys?: string[]; // e.g. ['ctrl', 'n']
    priority?: number;
}

interface CommandStore {
    commands: Record<string, CommandItem>;
    registerCommand: (cmd: CommandItem) => void;
    unregisterCommand: (id: string) => void;
    getCommandsArray: () => CommandItem[];
}

export const useCommandStore = create<CommandStore>()(
    (set, get) => ({
        commands: {},
        registerCommand: (cmd) => set((state) => ({
            commands: { ...state.commands, [cmd.id]: cmd }
        })),
        unregisterCommand: (id) => set((state) => {
            const newCommands = { ...state.commands };
            delete newCommands[id];
            return { commands: newCommands };
        }),
        getCommandsArray: () => {
            return Object.values(get().commands).sort((a, b) => {
                const pA = a.priority || 0;
                const pB = b.priority || 0;
                return pB - pA;
            });
        }
    })
);
