'use client';

import { useEffect, useState } from 'react';
import ReportTicketModal from '@/components/tickets/ReportTicketModal';
import { useCommandStore } from '@/lib/store/useCommandStore';

export const OPEN_TICKET_EVENT = 'sgi:open-ticket-report';

/**
 * Acción rápida global del buscador (Ctrl/Cmd + K) para reportar fallas,
 * pedir funciones o dejar sugerencias. También abre desde el botón del header.
 */
export default function TicketQuickAction() {
    const [open, setOpen] = useState(false);
    const registerCommand = useCommandStore(state => state.registerCommand);
    const unregisterCommand = useCommandStore(state => state.unregisterCommand);

    useEffect(() => {
        registerCommand({
            id: 'ticket-reportar',
            label: 'Reportar una falla o sugerencia',
            description: 'Abrir el formulario guiado de soporte',
            category: 'Acciones',
            icon: 'LifeBuoy',
            priority: 100,
            keywords: [
                'error', 'falla', 'bug', 'incidente', 'problema', 'no funciona',
                'sugerencia', 'mejora', 'nueva funcion', 'nueva función',
                'ticket', 'soporte', 'reportar', 'ayuda', 'consulta',
            ],
            action: () => setOpen(true),
        });

        return () => unregisterCommand('ticket-reportar');
    }, [registerCommand, unregisterCommand]);

    useEffect(() => {
        const handler = () => setOpen(true);
        window.addEventListener(OPEN_TICKET_EVENT, handler);
        return () => window.removeEventListener(OPEN_TICKET_EVENT, handler);
    }, []);

    return <ReportTicketModal open={open} onClose={() => setOpen(false)} />;
}
