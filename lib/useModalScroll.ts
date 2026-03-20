import { useEffect } from 'react';

/**
 * Locks the body scroll when a modal is open.
 * Preserves the current scroll position so content doesn't jump.
 * Works correctly on iOS, Android, and desktop.
 *
 * Usage:
 *   useModalScroll(isModalOpen);
 */
export function useModalScroll(isOpen: boolean) {
    useEffect(() => {
        if (!isOpen) return;

        const scrollY = window.scrollY;
        const body = document.body;

        // Set the body's top offset to preserve visual position
        body.style.top = `-${scrollY}px`;
        body.classList.add('modal-open');

        return () => {
            body.classList.remove('modal-open');
            body.style.top = '';
            // Restore scroll position without animation
            window.scrollTo({ top: scrollY, behavior: 'instant' as ScrollBehavior });
        };
    }, [isOpen]);
}
