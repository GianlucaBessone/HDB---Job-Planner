'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, LifeBuoy, MessageSquareWarning, Ticket } from 'lucide-react';
import { OPEN_TICKET_EVENT } from '@/components/tickets/TicketQuickAction';
import { useAcceso } from '@/lib/store/useAccessStore';

/**
 * Ayuda y soporte del sistema, en el encabezado: guías de uso, tickets propios
 * y reportar un problema. No ocupan lugar en el menú de módulos.
 */
export function HelpMenu() {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const { puedeVer } = useAcceso();

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                title="Ayuda y soporte"
                aria-label="Ayuda y soporte"
                aria-haspopup="menu"
                aria-expanded={open}
                className="btn btn-ghost btn-icon btn-icon-inline"
            >
                <LifeBuoy />
            </button>
            {open && (
                <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+6px)] w-64 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl p-1 z-[70] animate-in fade-in slide-in-from-top-1 duration-150"
                >
                    <p className="eyebrow px-2.5 pt-1.5 pb-1">Ayuda y soporte</p>
                    <button
                        role="menuitem"
                        onClick={() => { setOpen(false); window.dispatchEvent(new Event(OPEN_TICKET_EVENT)); }}
                        className="nav-item w-full"
                    >
                        <MessageSquareWarning /> Reportar un problema o sugerencia
                    </button>
                    {puedeVer('/tickets') && (
                        <Link role="menuitem" href="/tickets" onClick={() => setOpen(false)} className="nav-item w-full">
                            <Ticket /> Tickets de soporte
                        </Link>
                    )}
                    {puedeVer('/centro-ayuda') && (
                        <Link role="menuitem" href="/centro-ayuda" onClick={() => setOpen(false)} className="nav-item w-full">
                            <BookOpen /> Centro de ayuda
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
